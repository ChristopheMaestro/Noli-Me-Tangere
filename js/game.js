// Noli — game state, the short day (gathering, donors, interruptions, the convento), the evening and the night (the tree of bonuses).
(function () {
  var D = Noli.Data, W = Noli.World, I = Noli.Icon;
  var SAVE_KEY = 'noli-save-v3';
  var $ = function (id) { return document.getElementById(id); };
  var S, R = null, phase = 'title', muted = false, audio = null, botting = false, cur = 'site';

  function setPhase(p) { phase = p; document.body.setAttribute('data-phase', p); }

  function fresh() {
    var up = {}, res = { pesos: 0 }; D.upgrades.forEach(function (u) { up[u.id] = 0; });
    D.resOrder.forEach(function (r) { res[r] = 0; });
    return { day: 1, res: res, up: up, boss: 0, last: 0, time: 0, finished: false, auto: {}, sg: null }; // sg: the siege that follows the school (siege.js)
  }
  // Debug mode (in the options): its settings are kept apart from the saved game.
  var DBG_KEY = 'noli-debug', INF = 1e15, paused = false, hush = false;
  var dbg = { on: false, auto: false, cps: 10, mult: 1, inf: false, spree: false, ord: 0 }, kept = null, keptOf = null, clickAcc = 0, loudAcc = 0;
  function mult() { return dbg.on && !botting ? dbg.mult : 1; }
  function save() {
    if (botting) return;
    var o = S, k;
    if (kept && keptOf === S) { o = {}; for (k in S) o[k] = S[k]; o.res = kept; } // endless stores are never written down: the save keeps what was really there
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(o)); } catch (e) { /* storage unavailable */ }
  }
  // Endless stores: everything is topped up every frame, and what was there before comes back when the box is unticked.
  function pin() {
    var k;
    if (!(dbg.on && dbg.inf) || botting) { if (kept) { if (keptOf === S) for (k in kept) S.res[k] = kept[k]; kept = keptOf = null; } return; }
    if (keptOf !== S) { keptOf = S; kept = {}; for (k in S.res) kept[k] = S.res[k]; }
    for (k in S.res) S.res[k] = INF;
  }
  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY); if (!raw) return null;
      var s = JSON.parse(raw), f = fresh(), k;
      for (k in f) if (!(k in s)) s[k] = f[k];
      for (k in f.up) if (!(k in s.up)) s.up[k] = 0;
      for (k in f.res) if (!(k in s.res)) s.res[k] = 0;
      for (k in s.up) if (!(k in f.up)) delete s.up[k];
      return s;
    } catch (e) { return null; }
  }

  // ---------- derived values ----------
  var byId = {}, spotById = {}; D.upgrades.forEach(function (u) { byId[u.id] = u; }); D.spots.forEach(function (s) { spotById[s.id] = s; });
  var MAXSTEP = byId.school.max;
  function L(id) { return S.up[id] || 0; }
  function V(id) { return byId[id].val(L(id)); }
  function stage() { return Math.min(D.stages.length - 1, Math.floor(L('school') / D.STEPS)); }
  function bill() {
    var l = L('school'), out = {}; if (l >= MAXSTEP) return out;
    var need = D.stages[Math.floor(l / D.STEPS)].need, m = D.stepMult[l % D.STEPS];
    for (var k in need) out[k] = Math.ceil(need[k] * m);
    return out;
  }
  function bossDue() { var l = L('school'); return l < MAXSTEP && l % D.STEPS === D.STEPS - 1 && S.boss <= Math.floor(l / D.STEPS); }
  function cost(u) {
    if (u.id === 'school') return bill();
    var out = {}, m = Math.pow(u.growth, L(u.id));
    for (var k in u.cost) out[k] = Math.ceil(u.cost[k] * m);
    return out;
  }
  function can(c) { for (var k in c) if (S.res[k] < c[k]) return false; return true; }
  function pay(c) { for (var k in c) S.res[k] -= c[k]; }
  function open(sp) { return sp.stage <= stage(); }
  function spotMult(sp) { var m = 1; sp.mult.forEach(function (id) { m *= V(id); }); return m; }
  function people() { var n = 0; D.spots.forEach(function (sp) { n += L(sp.worker); }); return n; }
  function clickPower(sp) { return V('lakas') * spotMult(sp) * V('maestro'); }
  function workerRate(sp, t) { // units per second from the people employed there
    var r = L(sp.worker) * 0.6 * V('juan') * (1 + V('bayanihan') * people()) * spotMult(sp) * V('maestro');
    if (t !== undefined && t < 3) r *= 1 + V('madaling');
    return r;
  }
  function pesoRate() { return D.STIPEND * Math.pow(D.STIPEND_GROWTH, L('school')) * V('suscripcion') * V('tiago') * V('general') * V('capiz'); } // pesos per second
  function resolve() { return V('tasio') * V('general'); }
  function baseLen() { return D.DAY_LENGTH + V('lampara'); } // seconds in a day
  function dayLen() { return baseLen() + (R ? R.extra - R.lost : 0); }
  function hazardHp() { return Math.max(Math.ceil(2 * Math.pow(1.7, stage())), R && R.boss ? Math.ceil(resolve() * 1.5) : 0); } // on the day of a confrontation none goes at the first word
  // The shop. One unit of a material is worth a share of the town's daily giving, measured against the labour the next step of the school asks for.
  function unitPrice(k) {
    var l = Math.min(L('school'), MAXSTEP - 1), q = D.stages[Math.floor(l / D.STEPS)].need.labor * D.stepMult[l % D.STEPS];
    return pesoRate() * baseLen() * D.worth[k] / q;
  }
  function buyPrice(k, n) { return Math.ceil(n * unitPrice(k) * D.SHOP_BUY * V('tawad')); }
  function sellPrice(k, n) { return Math.floor(n * unitPrice(k) * D.SHOP_SELL * V('suki')); }
  function keep(k) { // what the next step of the school still wants of a material, counting what the kilns must be fed
    var b = bill(), n = b[k] || 0;
    D.kilns.forEach(function (kn) { if (kn.from === k && b[kn.to]) n += Math.max(0, b[kn.to] - S.res[kn.to]) / (kn.gain ? V(kn.gain) : 1); });
    return Math.ceil(n);
  }
  function spent(k) { return D.upgrades.every(function (u) { return u.id === 'school' || !u.cost[k] || L(u.id) >= u.max; }); } // every bonus paid in this material is bought out
  function fmt(n) {
    n = Math.floor(n + 1e-6);
    if (n >= INF / 10) return '∞';
    if (n < 100000) return n.toLocaleString('en-US');
    var u = ['K', 'M', 'B', 'T'], i = -1;
    while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
    return n.toFixed(n < 100 ? 1 : 0) + u[i];
  }
  function priceHtml(c) { var h = ''; for (var k in c) h += '<span class="' + (S.res[k] >= c[k] ? '' : 'no') + '">' + I(D.res[k].icon) + fmt(c[k]) + '</span>'; return h; }

  // ---------- audio (synthesised, no assets) ----------
  function ac() {
    if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audio = null; } }
    return audio;
  }
  function tone(freq, dur, vol, type, when) {
    if (botting || muted || hush) return;
    var a = ac(); if (!a) return;
    var o = a.createOscillator(), g = a.createGain(), t = a.currentTime + (when || 0);
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  var PITCH = { site: 140, forest: 220, quarry: 110, claypit: 170, lake: 300 };
  function sfxWork(id, crit) { tone((crit ? 2 : 1) * PITCH[id] + Math.random() * 40, crit ? 0.18 : 0.09, 0.12, 'triangle'); }
  function sfxBell() {
    for (var i = 0; i < 3; i++) [[196, 0.22], [392, 0.12], [494, 0.07], [587, 0.06], [823, 0.03]].forEach(function (p) { tone(p[0], 2.6, p[1], 'sine', i * 1.0); });
  }
  function sfxBuy() { tone(660, 0.12, 0.08, 'triangle'); tone(880, 0.16, 0.07, 'triangle', 0.07); }
  function sfxNo() { tone(110, 0.1, 0.06, 'square'); }
  function sfxHit() { tone(90, 0.12, 0.1, 'sawtooth'); }
  function sfxCoin() { tone(990, 0.1, 0.07, 'triangle'); tone(1320, 0.18, 0.06, 'triangle', 0.06); }
  function sfxWin() { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.3, 0.09, 'triangle', i * 0.11); }); }

  // ---------- tooltips: every pictogram explains itself on hover ----------
  var tipCur = null, tipX = 0, tipY = 0;
  function tip(el, what) { el._tip = typeof what === 'function' ? what : function () { return what; }; }
  function drawTip() {
    var box = $('tip'), html = tipCur && tipCur._tip && document.body.contains(tipCur) ? tipCur._tip() : '';
    if (!html) { box.classList.remove('show'); return; }
    if (box._html !== html) { box.innerHTML = html; box._html = html; }
    box.classList.add('show');
    var w = box.offsetWidth, h = box.offsetHeight, x = tipX + 16, y = tipY + 20;
    if (x + w > window.innerWidth - 8) x = tipX - w - 12;
    if (y + h > window.innerHeight - 8) y = tipY - h - 12;
    box.style.left = Math.max(8, x) + 'px'; box.style.top = Math.max(8, y) + 'px';
  }
  function tipHtml(title, lines) {
    var h = '<b>' + title + '</b>';
    (lines || []).forEach(function (l) { if (l) h += '<span class="' + (l[1] || 'd') + '">' + l[0] + '</span>'; });
    return h;
  }
  function billLines(c) {
    var out = [];
    for (var k in c) out.push([I(D.res[k].icon) + fmt(Math.min(S.res[k], c[k])) + ' / ' + fmt(c[k]) + ' ' + D.res[k].name.toLowerCase(), S.res[k] >= c[k] ? 'good' : 'bad']);
    return out;
  }

  // ---------- markers: clickable pictograms that float over places in the world ----------
  var marks = [];
  function addMark(cls, icon, pos, off, onHit, tipFn) {
    var el = document.createElement('button');
    el.className = 'mark ' + cls; el.innerHTML = I(icon) + '<i></i>';
    el.addEventListener('pointerdown', function (e) { e.preventDefault(); onHit(); });
    if (tipFn) tip(el, tipFn);
    $('marks').appendChild(el);
    var m = { el: el, pos: pos, off: off || [0, 0] }; marks.push(m); placeMark(m); return m;
  }
  function dropMark(m) { var i = marks.indexOf(m); if (i >= 0) marks.splice(i, 1); m.el.remove(); }
  function placeMark(m) {
    var p = W.screen(m.pos[0], m.pos[1], m.pos[2]);
    m.x = p.x + m.off[0]; m.y = p.y + m.off[1];
    var tr = 'translate(' + Math.round(m.x) + 'px,' + Math.round(m.y) + 'px)';
    if (tr !== m.tr) { m.tr = tr; m.el.style.transform = tr; }
  }
  function bump(m) { if (hush) return; m.el.classList.remove('hit'); void m.el.offsetWidth; m.el.classList.add('hit'); }

  var spotMarks = {};
  function buildSpots() {
    D.spots.forEach(function (sp) {
      spotMarks[sp.id] = addMark('spot', D.res[sp.res].icon, sp.pos, null, function () { work(sp.id); showSpots(); }, function () {
        var lines = [[sp.desc], ['+' + fmt(clickPower(sp)) + ' ' + D.res[sp.res].name.toLowerCase() + ' per click', 'good']];
        if (L(sp.worker)) lines.push([I(byId[sp.worker].icon) + fmt(workerRate(sp)) + ' a second from ' + byId[sp.worker].show(L(sp.worker)), 'good']);
        if (R && hazardAt(sp.id)) lines.push(['Stopped. Click the interruption away.', 'bad']);
        return tipHtml(sp.name, lines);
      });
    });
    D.kilns.forEach(function (k) {
      kilnMarks[k.id] = addMark('spot kiln', k.icon, k.pos, null, function () { stoke(k); }, function () {
        var out = k.gain ? V(k.gain) : 1, from = D.res[k.from].name.toLowerCase();
        return tipHtml(k.name, [[k.desc], [I(D.res[k.from].icon) + Math.round(V(k.rate)) + ' ' + from + ' a second → ' + I(D.res[k.to].icon) + fmt(V(k.rate) * out), 'good'],
          ['Each click: ' + fmt(V(k.rate) * D.STOKE) + ' ' + from + ' at once', 'good'], S.res[k.from] < 1 ? ['No ' + from + ' to burn.', 'bad'] : null]);
      });
    });
  }
  var kilnMarks = {};
  function crew(active) { // show the world who is at work, and where the work is stopped
    var n = {}, stop = {};
    D.spots.forEach(function (sp) { n[sp.id] = open(sp) ? L(sp.worker) : 0; stop[sp.id] = !!(R && (R.strike || hazardAt(sp.id))); });
    W.setCrew(n, Math.min(4, V('juan')), active, stop);
  }
  function showSpots() {
    D.spots.forEach(function (sp) {
      var el = spotMarks[sp.id].el;
      el.style.display = open(sp) ? '' : 'none';
      el.classList.toggle('cur', sp.id === cur);
      el.classList.toggle('stopped', !!(R && hazardAt(sp.id)));
    });
    D.kilns.forEach(function (k) {
      var el = kilnMarks[k.id].el;
      el.style.display = k.stage <= stage() ? '' : 'none';
      el.classList.toggle('stopped', S.res[k.from] < 1);
    });
    if (phase === 'day') crew(true);
  }

  // ---------- the day ----------
  function startDay(bossDay) {
    setPhase('day');
    R = { t: 0, earn: 0, gain: {}, combo: 0, comboT: 0, auto: 0, frenzy: 0, haz: [], tg: [], sched: [], donorAt: 1.5, mariaAt: -1, extra: 0, lost: 0, strike: false, sold: 0, boss: null, won: false, bossDay: !!bossDay };
    hide('title'); hide('dusk'); hide('tree');
    if (!open(spotById[cur])) cur = 'site';
    $('hint').classList.toggle('show', S.day <= 2);
    W.setDaylight(0); W.setSuspicion(0);
    if (bossDay === true) {
      var def = D.bosses[S.boss];
      R.boss = { def: def, hp: def.hp, max: def.hp, next: 1, g: 0, shut: false, weakAt: def.weak || 0, weak: [] };
      R.strike = !!def.strike;
      R.boss.mark = addMark('boss', def.icon, BOSS_AT, null, hitBoss, function () {
        var b = R.boss, now = def.rout ? ['He keeps behind his men. See off ' + Math.ceil(b.hp) + ' more of his patrols, and the raid is over.', 'good'] : R.haz.length ? ['Untouchable while any interruption stands. Clear them first.', 'bad'] : b.shut ? ['Closed. A click now costs you daylight.', 'bad'] : ['Click to wear it down before the Angelus.', 'good'];
        return tipHtml(def.name, [[def.text], [def.how, 'k2'], now, [(def.rout ? 'Patrols left: ' : '') + fmt(Math.max(0, b.hp)) + ' / ' + fmt(b.max) + ' · your resolve: ' + fmt(resolve()) + ' per click']]);
      });
    } else if (L('school') >= 2) {
      var n = 1 + Math.floor(stage() / 2) + (Math.random() < 0.5 ? 1 : 0);
      for (var i = 0; i < n; i++) R.sched.push(1 + Math.random() * (baseLen() - 3.5));
      R.sched.sort(function (a, b) { return a - b; });
    }
    if (L('maria')) R.mariaAt = 1 + Math.random() * (baseLen() - 4);
    showSpots();
  }

  function gain(res, n) { n *= mult(); S.res[res] += n; R.gain[res] = (R.gain[res] || 0) + n; return n; }
  function gather(sp, n) {
    if (R.frenzy > 0) n *= 2;
    return gain(sp.res, n);
  }
  function hazardAt(id) { for (var i = 0; i < R.haz.length; i++) if (R.haz[i].spot === id) return R.haz[i]; return null; }
  var BOSS_AT = [-14, 9.5, -14.2]; // over the church door

  // Kilns: n units of the raw material go into the fire. Returns what came out.
  function fire(k, n) {
    n = Math.min(n * (R.frenzy > 0 ? 2 : 1), S.res[k.from]);
    if (n <= 0) return 0;
    S.res[k.from] -= n;
    return gain(k.to, n * (k.gain ? V(k.gain) : 1));
  }
  function stoke(k) { // one click on a kiln
    if (phase !== 'day' || k.stage > stage()) return;
    R.combo = Math.min(V('ritmo'), R.combo + 1); R.comboT = 0.7;
    var n = fire(k, V(k.rate) * D.STOKE * (1 + 0.01 * R.combo));
    if (botting) return;
    var m = kilnMarks[k.id]; bump(m);
    if (n > 0) { tone(260 + Math.random() * 40, 0.1, 0.1, 'triangle'); floater('+' + fmt(n), m.x + (Math.random() - 0.5) * 70, m.y - 30 + (Math.random() - 0.5) * 30, 'gold'); }
    else sfxNo();
  }

  function work(id, auto) { // one click at a place
    if (phase !== 'day') return;
    var sp = spotById[id]; if (!open(sp)) return;
    if (auto !== true) { cur = id; R.combo = Math.min(V('ritmo'), R.combo + 1); R.comboT = 0.7; }
    var n = clickPower(sp) * (1 + 0.01 * R.combo), crit = Math.random() < V('suwerte');
    if (crit) n *= V('bato');
    n = gather(sp, n);
    if (botting) return;
    if (id === 'site') W.pulse();
    if (auto !== true || crit) sfxWork(id, crit);
    var m = spotMarks[id]; bump(m);
    floater('+' + fmt(n), m.x + (Math.random() - 0.5) * 70, m.y - 30 + (Math.random() - 0.5) * 30, crit ? 'crit' : '');
  }

  // Interruptions
  function spawnHazard() {
    var free = D.spots.filter(function (sp) { return open(sp) && !hazardAt(sp.id); });
    if (!free.length) return;
    var sp = free[Math.floor(Math.random() * free.length)], def = D.hazards[R.boss && R.boss.def.rout ? 'guardia' : sp.hazard], hp = R.boss && R.boss.def.patrol ? R.boss.def.patrol : hazardHp();
    var h = { spot: sp.id, def: def, hp: hp, max: hp, t: 0 };
    h.mark = addMark('haz', def.icon, sp.pos, [40, -36], function () { hitHazard(h); }, function () {
      var lines = [[def.desc], ['Nobody works at ' + sp.name.toLowerCase() + ' until it is gone. Click it away.', 'bad'],
        [fmt(Math.max(0, h.hp)) + ' / ' + fmt(h.max) + ' · your resolve: ' + fmt(resolve()) + ' per click']];
      return tipHtml(def.name, lines);
    });
    R.haz.push(h); hazardBar(h); friarWalk(); showSpots();
    tone(70, 0.35, 0.1, 'sawtooth');
  }
  function hazardBar(h) { h.mark.el.lastChild.style.width = Math.max(0, h.hp / h.max * 100) + '%'; }
  function friarWalk() { W.setSuspicion(R.haz.some(function (h) { return h.def.fam === 'misa'; }) ? 100 : 0); }
  function hitHazard(h) {
    if (phase !== 'day' || h.hp <= 0) return;
    h.hp -= resolve(); hazardBar(h); bump(h.mark); sfxHit();
    if (h.hp <= 0) { holdBell(h.mark); clearHazard(h); }
  }
  // The bell-ringers: each event you deal with holds the Angelus back a second, up to the level of the bonus each day.
  function holdBell(m) {
    if (R.extra >= V('kampana')) return;
    R.extra += 1;
    if (!botting) floater('+1 s', m.x, m.y - 52, 'time');
  }
  function clearHazard(h) {
    var i = R.haz.indexOf(h); if (i < 0) return;
    R.haz.splice(i, 1);
    var pay = V('gantimpala') * S.last;
    if (pay > 0) { pay = gain('pesos', pay); floater('+' + fmt(pay), h.mark.x, h.mark.y - 30, 'gold'); }
    dropMark(h.mark); friarWalk(); showSpots(); sfxCoin();
    var b = R.boss; // a raid is beaten by seeing off its patrols; the next one comes as soon as the road is clear
    if (b && b.def.rout && b.hp > 0) { if (!R.haz.length) b.next = Math.min(b.next, R.t + D.ROUT_GAP); hurtBoss(1); }
  }
  function autoLeave(h) { var l = L(h.def.fam); return l > 0 && !R.boss ? Math.max(0.25, 8 - 2 * l) : Infinity; }

  // The convento
  function hitBoss() {
    var b = R.boss; if (phase !== 'day' || !b || b.hp <= 0) return;
    bump(b.mark);
    if (b.shut) { // it was closed: the blow falls on you
      R.lost += D.GUARD_COST; sfxNo();
      if (!botting) floater('−½ s', b.mark.x, b.mark.y - 60, 'bad');
      return;
    }
    if (b.def.rout) { sfxNo(); if (!botting) floater('his patrols first', b.mark.x, b.mark.y - 60, 'bad'); return; }
    if (R.haz.length) { sfxNo(); return; }
    hurtBoss(resolve() * (Math.random() < V('suwerte') ? V('bato') : 1)); sfxHit();
  }
  function bossBar() { var b = R.boss; b.mark.el.lastChild.style.width = Math.max(0, b.hp / b.max * 100) + '%'; }
  function hurtBoss(n) {
    var b = R.boss; b.hp -= n; bossBar();
    if (b.hp > 0) return;
    R.won = true; R.wonAt = R.t; S.boss += 1;
    var prize = gain('pesos', Math.max(20, S.last * 0.5));
    if (!botting) floater('+' + fmt(prize), b.mark.x, b.mark.y - 40, 'crit');
    dropMark(b.mark); b.weak.forEach(function (w) { dropMark(w.mark); }); b.weak = []; sfxWin();
    R.haz.slice().forEach(clearHazard);
  }
  // An opening: a small mark beside the confrontation that is worth several clicks, if you are quick.
  function spawnWeak() {
    var b = R.boss, a = Math.random() * Math.PI * 2, r = 95 + Math.random() * 45, w = { t: 0 };
    w.mark = addMark('tg weak', 'spark', BOSS_AT, [Math.cos(a) * r, Math.sin(a) * r * 0.8], function () { hitWeak(w); },
      tipHtml('An opening', [['Click it before it closes: it counts for ' + D.OPENING + ' clicks, whatever else stands.', 'good']]));
    b.weak.push(w);
  }
  function hitWeak(w) {
    var b = R.boss, i = b ? b.weak.indexOf(w) : -1; if (i < 0 || phase !== 'day') return;
    b.weak.splice(i, 1);
    if (!botting) floater('×' + D.OPENING, w.mark.x, w.mark.y - 30, 'crit');
    dropMark(w.mark); sfxCoin();
    hurtBoss(resolve() * D.OPENING);
  }
  function tickBoss(dt) {
    var b = R.boss, d = b.def, i;
    if (R.t >= b.next) { b.next += d.every; spawnHazard(); }
    if (d.guard) {
      b.g += dt;
      var shut = b.g % (d.guard[0] + d.guard[1]) >= d.guard[0];
      if (shut !== b.shut) { b.shut = shut; b.mark.el.classList.toggle('shut', shut); if (shut) tone(60, 0.3, 0.1, 'sawtooth'); }
    }
    if (d.weak && R.t >= b.weakAt) { b.weakAt += d.weak; spawnWeak(); }
    for (i = b.weak.length - 1; i >= 0; i--) { b.weak[i].t += dt; if (b.weak[i].t >= D.OPENING_TIME) { dropMark(b.weak[i].mark); b.weak.splice(i, 1); } }
    if (R.haz.length) { if (d.heal && b.hp < b.max) { b.hp = Math.min(b.max, b.hp + d.heal * b.max * dt); bossBar(); } }
    else if (!b.shut && !d.rout && L('filipo')) hurtBoss(V('filipo') * resolve() * dt);
  }

  // Donors and visitors in the plaza
  function spawnTarget(kind) {
    // Try a few places in the plaza and keep the one furthest from every other marker, so nothing pops up on top of anything else.
    var pos, best = -1, t = { kind: kind, t: 0 };
    for (var n = 0; n < 14 && best < 80; n++) {
      var c = [-18 + Math.random() * 9, 2.2, -12.7 + Math.random() * 6], p = W.screen(c[0], c[1], c[2]), near = 1e9;
      marks.forEach(function (m) { if (m.el.style.display !== 'none') near = Math.min(near, Math.hypot(m.x - p.x, m.y - p.y)); });
      if (near > best) { best = near; pos = c; }
    }
    t.mark = addMark('tg ' + kind, kind === 'maria' ? 'maria' : 'coin', pos, null, function () { collect(t); }, kind === 'maria'
      ? tipHtml('María Clara is visiting', [['Click her: everything gathered is doubled for ' + V('maria') + ' seconds.', 'good']])
      : tipHtml('A donor', [['Click before they wander off.'], ['+' + fmt(donorGift()) + ' pesos', 'good']]));
    R.tg.push(t);
  }
  function donorGift() { return 4 + 0.04 * S.last; }
  function collect(t) {
    var i = R.tg.indexOf(t); if (i < 0 || phase !== 'day') return;
    R.tg.splice(i, 1); holdBell(t.mark);
    if (t.kind === 'maria') { R.frenzy = V('maria'); sfxWin(); }
    else { var g = gain('pesos', donorGift()); floater('+' + fmt(g), t.mark.x, t.mark.y - 30, 'gold'); sfxCoin(); }
    dropMark(t.mark);
  }

  function tickDay(dt) {
    R.t += dt; S.time += dt;
    var alms = pesoRate() * dt * (R.frenzy > 0 ? 2 : 1); gain('pesos', alms); R.earn += alms;
    var i, sp;
    for (i = 0; i < D.spots.length; i++) {
      sp = D.spots[i];
      if (open(sp) && L(sp.worker) && !R.strike && !hazardAt(sp.id)) gather(sp, workerRate(sp, R.t) * dt);
    }
    D.kilns.forEach(function (k) { if (k.stage <= stage()) fire(k, V(k.rate) * dt); });
    R.auto += V('pawis') * dt;
    while (R.auto >= 1) { R.auto -= 1; work(cur, true); }
    R.comboT -= dt; if (R.comboT <= 0) R.combo = Math.max(0, R.combo - 25 * dt);
    if (R.frenzy > 0) R.frenzy -= dt;

    while (R.sched.length && R.t >= R.sched[0]) { R.sched.shift(); spawnHazard(); }
    for (i = R.haz.length - 1; i >= 0; i--) { R.haz[i].t += dt; if (R.haz[i].t >= autoLeave(R.haz[i])) clearHazard(R.haz[i]); }
    if (R.boss && R.boss.hp > 0) tickBoss(dt);

    if (L('donor') && R.t >= R.donorAt && R.t < dayLen() - 2) { R.donorAt += 5 / V('donor') * (0.7 + Math.random() * 0.6); spawnTarget('donor'); }
    if (R.mariaAt > 0 && R.t >= R.mariaAt) { R.mariaAt = -1; spawnTarget('maria'); }
    var grab = L('sinang') ? V('sinang') : Infinity;
    for (i = R.tg.length - 1; i >= 0; i--) {
      var t = R.tg[i]; t.t += dt;
      if (t.t >= grab) collect(t);
      else if (t.t >= 3.5) { R.tg.splice(i, 1); dropMark(t.mark); }
    }

    W.setDaylight(Math.min(1, R.t / dayLen()));
    if (R.t >= dayLen()) endDay();
  }

  // Debug: the autoclicker. It clicks what a player would: an opening, an interruption, a donor, the confrontation, or else the place last worked at.
  // Only a few of its clicks a second are heard and shown, or a hundred of them would bury the screen.
  function autoClick(dt) {
    clickAcc = Math.min(200, clickAcc + dbg.cps * dt);
    while (clickAcc >= 1 && phase === 'day') {
      clickAcc -= 1; loudAcc += Math.min(1, 8 / dbg.cps); hush = loudAcc < 1; if (!hush) loudAcc -= 1;
      var b = R.boss && R.boss.hp > 0 ? R.boss : null;
      if (b && b.weak.length) hitWeak(b.weak[0]);
      else if (R.haz.length) hitHazard(R.haz[0]);
      else if (R.tg.length) collect(R.tg[0]);
      else if (b && !b.def.rout && !b.shut) hitBoss();
      else work(cur);
    }
    hush = false;
  }

  // ---------- the evening ----------
  function endDay() {
    setPhase('event');
    $('hint').classList.remove('show');
    R.haz.forEach(function (h) { dropMark(h.mark); }); R.tg.forEach(function (t) { dropMark(t.mark); });
    if (R.boss) { if (R.boss.hp > 0) dropMark(R.boss.mark); R.boss.weak.forEach(function (w) { dropMark(w.mark); }); R.boss.weak = []; }
    R.haz = []; R.tg = [];
    S.last = R.earn; // only what the work itself brought in, so gifts cannot feed on gifts
    // Standing orders at the shop: whatever the next step of the school does not need is sold.
    for (var k in S.auto) {
      var n = S.auto[k] === 1 ? Math.floor(S.res[k] - keep(k)) : 0;
      if (n > 0) { var p = sellPrice(k, n); S.res[k] -= n; S.res.pesos += p; R.sold += p; }
    }
    // Debug standing order, for every material the shop deals in: everything the next step does not need (full), or half of that (half).
    if (dbg.on && dbg.ord && !botting) D.resOrder.forEach(function (k) {
      if (!L('tindahan') || !resOpen(k) || S.auto[k] === 1) return;
      var n = Math.floor((S.res[k] - keep(k)) / (dbg.ord === 2 ? 2 : 1));
      if (n > 0) { var p = sellPrice(k, n); S.res[k] -= n; S.res.pesos += p; R.sold += p; }
    });
    if (botting) return;
    W.ringBell(); sfxBell(); W.setDaylight(1.6); W.setSuspicion(0);
    crew(false);
    showDusk();
  }

  // The evening: a title, a line or two, and the day's takings as a plain list.
  var duskGo = null; // what the evening's button does, when it is not the tree
  function duskScreen(title, text, rows, next, go) {
    duskGo = go || null;
    $('duskTitle').textContent = title; $('duskText').textContent = text; $('duskNext').textContent = next;
    $('duskList').innerHTML = rows.map(function (r) { return '<li class="' + (r[3] || '') + '">' + I(r[0]) + '<b>' + r[1] + '</b><span>' + r[2] + '</span></li>'; }).join('');
    $('dusk').classList.add('show');
  }
  function showDusk() {
    var rows = [], text = D.quiet[Math.floor(Math.random() * D.quiet.length)];
    if (R.boss) {
      text = R.won ? R.boss.def.name + ' is seen off. The convento gives way, and the next stage of the school can be built.'
        : R.boss.def.name + ' still stands in the way, with ' + fmt(R.boss.hp) + ' of ' + fmt(R.boss.max) + ' left. Gather strength, and confront it again.';
    }
    ['pesos'].concat(D.resOrder).forEach(function (k) {
      if (R.gain[k] >= 1) rows.push([D.res[k].icon, '+' + fmt(R.gain[k]), D.res[k].name.toLowerCase()]);
    });
    if (R.sold >= 1) rows.push(['bag', '+' + fmt(R.sold), 'pesos for the surplus sold at the shop', 'gold']);
    duskScreen('End of day ' + S.day, text, rows, 'Plan tomorrow\'s work');
  }

  function showEnding() {
    var mins = Math.round(S.time / 60 + S.day * 0.25);
    hide('tree'); hide('shop'); setPhase('event'); R = null; sfxWin();
    duskScreen('The School of San Diego', D.ending, [['sun', S.day - 1, 'days of work'], ['bell', mins, 'minutes, more or less']], 'And then…', function () { Noli.Siege.enter(); });
  }

  // ---------- the night: the tree of bonuses ----------
  var CELL = 116, NODE = 68, NS = 'http://www.w3.org/2000/svg';
  var tv = { x: 0, y: 0, z: 1, drag: false, moved: 0, px: 0, py: 0 }, nodeEls = {}, edges = [];

  function met(u) { for (var r in u.req) if (L(r) < u.req[r]) return false; return true; }
  function nodeState(u) {
    if (L(u.id) >= u.max) return 'maxed';
    if (met(u) || L(u.id) > 0) return 'open';
    // A bonus shows, locked, only once the bonuses before it are owned and the stage of the school it waits for is the next one at most.
    for (var r in u.req) if (r === 'school' ? u.req[r] > (stage() + 1) * D.STEPS : !L(r)) return 'hidden';
    return 'locked';
  }
  function reqName(r, n) {
    if (r !== 'school') return byId[r].name + (n > 1 ? ' ' + n : '');
    return n % D.STEPS === 0 ? 'School: ' + D.stages[n / D.STEPS].name : 'School: step ' + n;
  }

  function buildTree() {
    var world = $('treeWorld'), svg = $('treeEdges');
    D.upgrades.forEach(function (u) {
      var n = 0, r; for (r in u.req) n++;
      for (r in u.req) {
        if (r === 'school' && n > 1) continue; // the school gates whole branches; only draw its line to the first bonus of each
        var p = byId[r], ln = document.createElementNS(NS, 'line');
        ln.setAttribute('x1', p.x * CELL); ln.setAttribute('y1', p.y * CELL);
        ln.setAttribute('x2', u.x * CELL); ln.setAttribute('y2', u.y * CELL);
        svg.appendChild(ln); edges.push({ el: ln, to: u });
      }
    });
    D.upgrades.forEach(function (u) {
      var b = document.createElement('button');
      b.style.left = (u.x * CELL - NODE / 2) + 'px'; b.style.top = (u.y * CELL - NODE / 2) + 'px';
      b.innerHTML = '<span class="nic">' + I(u.icon) + '</span><span class="lv"></span><span class="lk">' + I('lock') + '</span><span class="pr"></span>';
      tip(b, function () { return nodeTip(u); });
      b.onclick = function (e) { if (tv.moved > 6) return; buy(u, e.shiftKey); b.blur(); };
      world.appendChild(b); nodeEls[u.id] = b;
    });

    var tree = $('tree');
    tree.addEventListener('pointerdown', function (e) { tv.drag = true; tv.moved = 0; tv.px = e.clientX; tv.py = e.clientY; });
    window.addEventListener('pointermove', function (e) {
      if (!tv.drag) return;
      var dx = e.clientX - tv.px, dy = e.clientY - tv.py; tv.px = e.clientX; tv.py = e.clientY;
      tv.moved += Math.abs(dx) + Math.abs(dy);
      if (tv.moved > 6) { tv.x += dx; tv.y += dy; applyView(); tree.classList.add('grab'); }
    });
    window.addEventListener('pointerup', function () { tv.drag = false; tree.classList.remove('grab'); });
    tree.addEventListener('wheel', function (e) {
      e.preventDefault();
      var z = Math.max(0.45, Math.min(1.7, tv.z * Math.exp(-e.deltaY * 0.0015)));
      tv.x = e.clientX - (e.clientX - tv.x) * z / tv.z; tv.y = e.clientY - (e.clientY - tv.y) * z / tv.z; tv.z = z;
      applyView();
    }, { passive: false });
  }
  function applyView() { $('treeWorld').style.transform = 'translate(' + tv.x + 'px,' + tv.y + 'px) scale(' + tv.z + ')'; }
  function centerTree() {
    var w = window.innerWidth, h = window.innerHeight;
    var top = 110, bottom = 124; // room for the HUD above and the buttons below
    tv.z = Math.max(0.45, Math.min(1, w / 1050, (h - top - bottom) / 930));
    tv.x = w / 2 - 0.5 * CELL * tv.z; tv.y = top + (h - top - bottom) / 2 - 0.55 * CELL * tv.z;
    applyView();
  }

  function nodeTip(u) {
    var l = L(u.id), st = nodeState(u), lines = [[D.branches[u.branch], 'k']], r;
    if (u.id === 'school') {
      if (st === 'maxed') return tipHtml(D.stages[D.stages.length - 1].name, lines.concat([[D.stages[D.stages.length - 1].note], [I('star'), 'c']]));
      var s = Math.floor(l / D.STEPS);
      lines.push([D.stages[s].note], ['Step ' + (l % D.STEPS + 1) + ' of ' + D.STEPS + ' towards "' + D.stages[s + 1].name + '"', 'k']);
      lines = lines.concat(billLines(bill()));
      if (l === MAXSTEP - 1) lines.push(['The last step: paying for it finishes the school and closes this tree. Buy everything else first.', 'k2']);
      if (bossDue()) lines.push([I(D.bosses[S.boss].icon) + D.bosses[S.boss].name + ' stands in the way. Confront it first.', 'bad']);
      return tipHtml(u.name + ' <i>' + l + '/' + u.max + '</i>', lines);
    }
    lines.push([u.desc]);
    if (st === 'locked') {
      for (r in u.req) if (L(r) < u.req[r]) lines.push([I('lock') + reqName(r, u.req[r]), 'bad']);
      return tipHtml(u.name, lines);
    }
    if (st === 'maxed') { lines.push([u.show(u.val(l)), 'good'], [I('star'), 'c']); return tipHtml(u.name, lines); }
    lines.push([(l ? u.show(u.val(l)) + ' → ' : '') + u.show(u.val(l + 1)), 'good']);
    lines.push([priceHtml(cost(u)), 'c']);
    return tipHtml(u.name + (u.max > 1 ? ' <i>' + l + '/' + u.max + '</i>' : ''), lines);
  }

  function buyable(u) { return nodeState(u) === 'open' && can(cost(u)) && !(u.id === 'school' && bossDue()); }
  function updateTree() {
    D.upgrades.forEach(function (u) {
      var b = nodeEls[u.id], st = nodeState(u), l = L(u.id);
      b.className = 'node b-' + u.branch + ' ' + st + (l > 0 || u.id === 'school' ? ' owned' : '') + (buyable(u) ? ' can' : '') + (u.id === 'school' && bossDue() ? ' gated' : '');
      b.children[1].textContent = st === 'maxed' ? '★' : l > 0 && u.max > 1 ? l : '';
      b.children[3].innerHTML = st === 'open' ? priceHtml(cost(u)) : '';
    });
    edges.forEach(function (e) {
      var st = nodeState(e.to);
      e.el.setAttribute('class', st === 'hidden' ? 'hidden' : st === 'locked' ? 'dim' : 'on b-' + e.to.branch);
    });
    var bb = $('bossBtn');
    bb.style.display = bossDue() ? '' : 'none';
    if (bossDue()) { bb.firstChild.innerHTML = I(D.bosses[S.boss].icon); put($('bossName'), 'Confront ' + D.bosses[S.boss].name); }
    put($('nextDayT'), 'Begin day ' + S.day);
    $('shopBtn').style.display = L('tindahan') ? '' : 'none';
    drawTip();
  }

  // A question asked on the game's own screen. yes runs only if the player agrees.
  var asking = null;
  function ask(title, text, yes, no, fn) {
    $('askTitle').textContent = title; $('askText').textContent = text; $('askYes').textContent = yes; $('askNo').textContent = no;
    asking = fn; $('ask').classList.add('show');
  }
  function answer(ok) { var fn = asking; asking = null; hide('ask'); if (ok && fn) fn(); }
  function buy(u, many, sure) {
    var bought = 0, before = stage();
    if (u.id === 'school' && L('school') === MAXSTEP - 1 && buyable(u) && sure !== true) {
      ask('The last step', 'Paying for it finishes the school, and the building is over: the tree of bonuses closes for good.\nBuy every bonus you still want first, and hire every worker. They are all you will have for what comes after.', 'Finish the school', 'Not yet', function () { buy(u, false, true); });
      return;
    }
    do {
      if (!buyable(u)) break;
      pay(cost(u)); S.up[u.id] += 1; bought++;
    } while (many && u.id !== 'school');
    if (!bought) { sfxNo(); return; }
    save();
    if (u.id === 'school') {
      if (L('school') >= MAXSTEP) { S.finished = true; save(); updateTree(); showEnding(); return; }
      if (stage() > before) { toast(D.stages[stage()].name); sfxWin(); } else sfxBuy();
    } else sfxBuy();
    nodeEls[u.id].classList.remove('pop'); void nodeEls[u.id].offsetWidth; updateTree(); nodeEls[u.id].classList.add('pop');
    crew(false);
  }

  // Debug "shopping spree": buy the bonuses one by one, cheapest first, topping up what is missing at the shop with pesos. The school itself is never bought.
  function spree() {
    var shop = L('tindahan') > 0, again = true, guard = 0, bought = 0;
    function worth(c) { var v = 0; for (var k in c) v += k === 'pesos' ? c[k] : c[k] * unitPrice(k) * D.SHOP_BUY; return v; }
    function toppedUp(c) { // the pesos needed once what is missing is bought at the shop, or -1 if it cannot be
      var p = c.pesos || 0;
      for (var k in c) { if (k === 'pesos') continue; var m = Math.max(0, Math.ceil(c[k] - S.res[k])); if (m) { if (!shop || !resOpen(k)) return -1; p += buyPrice(k, m); } }
      return p <= S.res.pesos ? p : -1;
    }
    while (again && guard++ < 2000) {
      again = false;
      var best = null, bv = Infinity;
      D.upgrades.forEach(function (u) {
        if (u.id === 'school' || nodeState(u) !== 'open') return;
        var c = cost(u), v = worth(c);
        if (v < bv && toppedUp(c) >= 0) { best = u; bv = v; }
      });
      if (!best) break;
      var c = cost(best);
      for (var k in c) { if (k === 'pesos') continue; var m = Math.max(0, Math.ceil(c[k] - S.res[k])); if (m) { S.res.pesos -= buyPrice(k, m); S.res[k] += m; } }
      pay(c); S.up[best.id] += 1; bought++; again = true;
    }
    if (bought) { save(); sfxBuy(); updateTree(); crew(false); }
  }

  function showTree() {
    if (S.finished) { hide('title'); hide('shop'); hide('tree'); R = null; Noli.Siege.enter(); return; } // the building is over: what is left is to defend it
    setPhase('tree');
    hide('dusk'); hide('title'); hide('shop');
    if (R) { S.day += 1; R = null; }
    W.setDaylight(1.6); crew(false);
    save(); updateTree(); centerTree();
    if (dbg.on && dbg.spree && !botting) spree();
    $('tree').classList.add('show');
  }

  // ---------- the shop: sell what you have too much of, buy what you lack ----------
  function nice(v) { var p = Math.pow(10, Math.floor(Math.log(Math.max(1, v)) / Math.LN10)); return Math.max(1, Math.round(v / p) * p); }
  function trade(k, n) { // n > 0 buys, n < 0 sells
    if (n > 0) { var c = buyPrice(k, n); if (S.res.pesos < c) { sfxNo(); return; } S.res.pesos -= c; S.res[k] += n; sfxBuy(); }
    else { n = Math.min(-n, Math.floor(S.res[k])); if (n < 1) { sfxNo(); return; } S.res[k] -= n; S.res.pesos += sellPrice(k, n); sfxCoin(); }
    save(); showShop(); updateTree();
  }
  function shopLink(text, price, on, act, tipText) {
    var b = document.createElement('button'); b.className = 'lnk'; b.disabled = !on;
    b.innerHTML = text + (price ? ' <i>' + price + '</i>' : '');
    b.onclick = function () { act(); tipCur = null; drawTip(); };
    if (tipText) tip(b, tipText);
    return b;
  }
  function showShop() {
    var list = $('shopList'), l = Math.min(L('school'), MAXSTEP - 1), lot = nice(D.stages[Math.floor(l / D.STEPS)].need.labor * D.stepMult[l % D.STEPS] / 10), b = bill();
    list.innerHTML = '';
    D.resOrder.forEach(function (k) {
      if (!resOpen(k)) return;
      var have = Math.floor(S.res[k]), half = Math.floor(have / 2), lack = Math.max(0, Math.ceil((b[k] || 0) - S.res[k])), name = D.res[k].name.toLowerCase();
      var row = document.createElement('div'), cell = function (cls) { var c = document.createElement('span'); c.className = cls; row.appendChild(c); return c; };
      row.className = 'srow';
      cell('what').innerHTML = I(D.res[k].icon) + '<b>' + D.res[k].name + '</b><em>' + fmt(have) + (b[k] ? ' / ' + fmt(b[k]) : '') + '</em>';
      var sell = cell('sell'), buyc = cell('buy'), ord = cell('ord');
      sell.appendChild(shopLink('Sell half', '+' + fmt(sellPrice(k, half)), half >= 1, function () { trade(k, -half); }, tipHtml('Sell ' + fmt(half) + ' ' + name, [['The trader pays ' + fmt(sellPrice(k, half)) + ' pesos.', 'good']])));
      sell.appendChild(shopLink('Sell all', '+' + fmt(sellPrice(k, have)), have >= 1, function () { trade(k, -have); }, tipHtml('Sell ' + fmt(have) + ' ' + name, [['The trader pays ' + fmt(sellPrice(k, have)) + ' pesos.', 'good'], b[k] ? ['The next step of the school needs ' + fmt(b[k]) + ' of it.', 'bad'] : null])));
      buyc.appendChild(shopLink('Buy ' + fmt(lot), '−' + fmt(buyPrice(k, lot)), S.res.pesos >= buyPrice(k, lot), function () { trade(k, lot); }, tipHtml('Buy ' + fmt(lot) + ' ' + name, [['For ' + fmt(buyPrice(k, lot)) + ' pesos.']])));
      if (lack) buyc.appendChild(shopLink('Buy the ' + fmt(lack) + ' missing', '−' + fmt(buyPrice(k, lack)), S.res.pesos >= buyPrice(k, lack), function () { trade(k, lack); }, tipHtml('Buy ' + fmt(lack) + ' ' + name, [['Just what the next step of the school still lacks, for ' + fmt(buyPrice(k, lack)) + ' pesos.']])));
      var what = 'Every evening the trader takes whatever ' + name + ' the next step of the school does not need.';
      if (S.auto[k]) ord.appendChild(shopLink('Standing order: ' + (S.auto[k] === 1 ? 'on' : 'off'), '', true, function () { S.auto[k] = S.auto[k] === 1 ? 2 : 1; save(); showShop(); }, tipHtml('Standing order', [[what], ['Click to turn it ' + (S.auto[k] === 1 ? 'off.' : 'on.')]])));
      else if (spent(k)) ord.appendChild(shopLink('Standing order', '−' + fmt(D.standing[k]), S.res.pesos >= D.standing[k], function () { S.res.pesos -= D.standing[k]; S.auto[k] = 1; sfxBuy(); save(); showShop(); updateTree(); }, tipHtml('Standing order', [[what], ['Arranged once, for ' + fmt(D.standing[k]) + ' pesos.']])));
      else ord.appendChild(shopLink('Standing order', '', false, function () {}, tipHtml('Standing order', [[what], ['The trader will arrange it once you have bought every bonus that is paid for in ' + name + '.', 'bad']])));
      list.appendChild(row);
    });
    $('shopNote').textContent = 'Prices follow the town\'s purse: the more San Diego gives each day, the more everything costs, and fetches.';
    $('shop').classList.add('show');
  }

  // ---------- HUD ----------
  var resChips = {};
  function buildHud() {
    D.resOrder.forEach(function (k) {
      var el = document.createElement('div'); el.className = 'res';
      el.innerHTML = I(D.res[k].icon) + '<b></b>';
      tip(el, function () {
        var need = bill()[k], lines = [];
        D.spots.forEach(function (sp) { if (sp.res === k) lines.push([sp.name + ': ' + sp.desc]); });
        D.kilns.forEach(function (kn) { if (kn.to === k) lines.push(['Made from ' + D.res[kn.from].name.toLowerCase() + ' by the kiln, ' + Math.round(V(kn.rate)) + ' a second.']); });
        if (need) lines.push([fmt(S.res[k]) + ' of the ' + fmt(need) + ' the next step of the school needs', S.res[k] >= need ? 'good' : 'bad']);
        return tipHtml(D.res[k].name, lines);
      });
      $('resBar').appendChild(el); resChips[k] = el;
    });
  }
  function resOpen(k) {
    for (var i = 0; i < D.spots.length; i++) if (D.spots[i].res === k) return open(D.spots[i]);
    for (i = 0; i < D.kilns.length; i++) if (D.kilns[i].to === k) return D.kilns[i].stage <= stage();
    return false;
  }
  // Write to the page only when something has changed: the HUD is redrawn every frame.
  function put(el, text) { if (el._t !== text) { el._t = text; el.textContent = text; } }
  function wide(el, pct) { pct = pct.toFixed(1) + '%'; if (el._w !== pct) { el._w = pct; el.style.width = pct; } }
  function hud() {
    if (S.sg) { W.setSchool(D.stages.length - 1, 0); W.setHouses(S.sg.houses); Noli.Siege.hud(); return; }
    Noli.Siege.off();
    var b = bill(), sum = 0, n = 0, k;
    for (k in b) { sum += Math.min(1, S.res[k] / b[k]); n++; }
    put($('hudDay'), 'Day ' + S.day);
    put($('hudPesos'), fmt(S.res.pesos));
    put($('hudStage'), D.stages[stage()].name);
    put($('hudStep'), L('school') >= MAXSTEP ? 'finished' : 'step ' + (L('school') + 1) + ' of ' + MAXSTEP);
    wide($('barStage'), n ? sum / n * 100 : 100);
    D.resOrder.forEach(function (r) {
      var el = resChips[r], on = resOpen(r), cls = 'res' + (b[r] ? (S.res[r] >= b[r] ? ' ok' : ' want') : '');
      if (el._on !== on) { el._on = on; el.style.display = on ? '' : 'none'; }
      if (!on) return;
      put(el.lastChild, b[r] ? fmt(S.res[r]) + ' / ' + fmt(b[r]) : fmt(S.res[r]));
      if (el._c !== cls) { el._c = cls; el.className = cls; }
    });
    var len = phase === 'day' ? dayLen() : 1, left = phase === 'day' ? Math.max(0, len - R.t) : 0;
    wide($('barTime'), phase === 'day' ? (1 - left / len) * 100 : 100);
    var fr = phase === 'day' && R.frenzy > 0, bf = $('buff');
    if (bf._on !== fr) { bf._on = fr; bf.classList.toggle('show', fr); }
    if (fr) put($('buffT'), '×2  ' + Math.ceil(R.frenzy));
    W.setSchool(stage(), (L('school') % D.STEPS) / D.STEPS);
    var hands = 0; for (k = 0; k < D.spots.length; k++) hands += L(D.spots[k].worker);
    W.setHouses(Math.floor(hands / D.HOUSE_EVERY)); // the town grows with the number of people at work
    if (phase === 'day') for (var i = 0; i < marks.length; i++) placeMark(marks[i]);
  }

  function hudTips() {
    tip($('chipDay'), function () {
      if (S.sg) return Noli.Siege.tipOf('day');
      return tipHtml('Day ' + S.day, [[phase === 'day' ? 'The Angelus rings in ' + Math.ceil(dayLen() - R.t) + ' seconds and work stops.' : 'Night. A day lasts ' + baseLen() + ' seconds.']]);
    });
    tip($('chipStage'), function () {
      if (S.sg) return Noli.Siege.tipOf('stage');
      var s = stage();
      if (L('school') >= MAXSTEP) return tipHtml(D.stages[s].name, [[D.stages[s].note]]);
      return tipHtml(D.stages[s].name, [[D.stages[s].note], ['The next step needs:', 'k']].concat(billLines(bill())).concat([['Pay for it at night, at the centre of the tree.']]));
    });
    tip($('chipPesos'), function () {
      if (S.sg) return Noli.Siege.tipOf('pesos');
      return tipHtml('Pesos', [['The town gives ' + fmt(pesoRate() * baseLen()) + ' pesos a day while the works go on, and more with every step of the school. Spend them at night on the tree of bonuses.']]);
    });
    tip($('buff'), tipHtml('María Clara is watching', [['Everything gathered is doubled.', 'good']]));
    tip($('btnL'), tipHtml('Turn the view', [['Q, or E the other way. Drag the map to move it, or use the arrow keys.']]));
    tip($('btnSpeed'), function () { return tipHtml('Speed', [[speed === 1 ? 'Time runs as usual.' : 'Time runs ' + speed + ' times as fast.'], ['Click for ' + (speed === 1 ? '×2' : speed === 2 ? '×5' : '×1') + '.']]); });
    tip($('btnMute'), function () { return tipHtml(muted ? 'Sound is off' : 'Sound is on'); });
    tip($('shopBtn'), tipHtml('The shop', [['Sell what you have too much of, buy what you lack.']]));
    tip($('nextDay'), function () { return tipHtml('Dawn', [['Begin day ' + S.day + ', an ordinary working day.']]); });
    tip($('bossBtn'), function () {
      var def = D.bosses[Math.min(S.boss, D.bosses.length - 1)];
      if (def.rout) return tipHtml('Confront: ' + def.name, [[def.text], [def.how, 'k2'], ['If you fail, try again another day.'], [def.hp + ' patrols to see off · your resolve: ' + fmt(resolve()) + ' per click', 'good']]);
      return tipHtml('Confront: ' + def.name, [[def.text], ['Wear it down by clicking before the Angelus. It sends interruptions, and is untouchable while any of them stands. If you fail, try again another day.'], [def.how, 'k2'],
        [fmt(def.hp) + ' to wear down · your resolve: ' + fmt(resolve()) + ' per click', 'good']]);
    });
  }

  function hide(id) { $(id).classList.remove('show'); }
  var toastTimer = 0;
  function toast(title) {
    $('toastTitle').textContent = title;
    $('toast').classList.add('show'); clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { $('toast').classList.remove('show'); }, 3200);
  }
  function floater(text, x, y, cls) {
    if (botting || hush) return;
    var el = document.createElement('div'); el.className = 'floater ' + (cls || ''); el.textContent = text;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    $('floaters').appendChild(el); setTimeout(function () { el.remove(); }, 800);
  }

  // ---------- a robot player, to measure how long the game takes: index.html?bot=1 ----------
  function runBot(cps) {
    botting = true; S = fresh();
    var days = 0, fails = 0, marksAt = [], lastStage = 0, bossLog = [];
    function need() { // the place whose material is furthest from the bill
      var b = bill(), worst = 'site', ratio = Infinity;
      D.spots.forEach(function (sp) {
        if (!open(sp)) return;
        var k = sp.res; D.kilns.forEach(function (kn) { if (kn.from === sp.res) k = kn.to; });
        if (!b[k]) return;
        var r = (S.res[k] + (k !== sp.res ? S.res[sp.res] : 0)) / b[k];
        if (r < ratio) { ratio = r; worst = sp.id; }
      });
      return worst;
    }
    function click() {
      var i, b = R.boss && R.boss.hp > 0 ? R.boss : null;
      if (b) for (i = 0; i < b.weak.length; i++) if (b.weak[i].t > 0.45) { hitWeak(b.weak[i]); return; }
      for (i = 0; i < R.haz.length; i++) if (R.haz[i].t > 0.5) { hitHazard(R.haz[i]); return; }
      for (i = 0; i < R.tg.length; i++) if (R.tg[i].t > 0.5) { collect(R.tg[i]); return; }
      if (b && !b.def.rout && !R.haz.length && !b.shut && (!b.def.guard || b.g % (b.def.guard[0] + b.def.guard[1]) > 0.3)) { hitBoss(); return; }
      var id = need(), kiln = null;
      D.kilns.forEach(function (k) { if (k.from === spotById[id].res && k.stage <= stage() && S.res[k.from] >= V(k.rate) * D.STOKE) kiln = k; });
      if (kiln) stoke(kiln); else work(id);
    }
    function shop() {
      for (var guard = 0; guard < 500; guard++) {
        var sc = byId.school;
        if (buyable(sc)) { pay(cost(sc)); S.up.school++; continue; }
        var best = null, bp = Infinity, b = bill(), due = bossDue();
        D.upgrades.forEach(function (u) {
          if (u.id === 'school' || !buyable(u)) return;
          var c = cost(u), k, p = c.pesos;
          for (k in c) if (k !== 'pesos' && b[k] && S.res[k] - c[k] < b[k]) return; // do not eat what the school needs
          if (due && u.branch === 'shadow') p /= 1000; // with a confrontation waiting, friends against the convento come first
          if (p < bp) { bp = p; best = u; }
        });
        if (!best) break;
        pay(cost(best)); S.up[best.id]++;
      }
    }
    while (L('school') < MAXSTEP && days < 600) {
      var boss = bossDue(); startDay(boss);
      var acc = 0;
      for (var i = 0; i < 600 && phase === 'day'; i++) { acc += cps * 0.1; while (acc >= 1 && phase === 'day') { acc -= 1; click(); } if (phase === 'day') tickDay(0.1); }
      if (boss) { // for each confrontation: how many days it took, and the resolve and the second of the day it was won with
        var bi = S.boss - (R.won ? 1 : 0); bossLog[bi] = bossLog[bi] || { n: 0 }; bossLog[bi].n++;
        bossLog[bi].s = R.won ? 'won at ' + R.wonAt.toFixed(1) + ' of ' + dayLen().toFixed(1) + ' s, resolve ' + resolve() : 'not won, ' + Math.round(R.boss.hp / R.boss.max * 100) + '% left, resolve ' + resolve();
      }
      if (boss && !R.won) fails++;
      days++; S.day++; R = null; shop();
      if (stage() > lastStage) { lastStage = stage(); var got = 0, all = 0; D.upgrades.forEach(function (u) { if (u.id !== 'school') { got += L(u.id); all += u.max; } }); marksAt.push(days + '(' + Math.round(got / all * 100) + '%)'); }
    }
    var lv = []; D.upgrades.forEach(function (u) { lv.push(u.id + ':' + L(u.id)); });
    console.log('BOT cps=' + cps + ' days=' + days + ' stageDays=' + marksAt.join(',') + ' bossFails=' + fails + ' minutes~' + Math.round((S.time + days * 15) / 60) + ' daySeconds=' + baseLen() + ' pesos=' + fmt(S.res.pesos));
    console.log('BOT confrontations ' + bossLog.map(function (b, i) { return (i + 1) + ': ' + b.n + ' tries, ' + b.s; }).join(' | '));
    console.log('BOT levels ' + lv.join(' '));
    botting = false; marks.slice().forEach(function (m) { if (m.el.className.indexOf('spot') < 0) dropMark(m); });
    S = fresh(); R = null; setPhase('title');
  }

  // ---------- boot ----------
  function boot() {
    var canvas = $('scene');
    W.init(canvas);
    Array.prototype.forEach.call(document.querySelectorAll('[data-ic]'), function (el) { el.innerHTML = I(el.getAttribute('data-ic')); });
    var saved = load();
    S = saved || fresh();
    buildTree(); buildHud(); buildSpots(); hudTips();
    Noli.Siege.init({ s: function () { return S; }, put: function (s) { S = s; R = null; }, fresh: fresh, save: save, phase: setPhase, now: function () { return phase; }, tip: tip, tipHtml: tipHtml, drawTip: drawTip, fmt: fmt, toast: toast,
      floater: floater, tone: tone, mult: mult, dusk: duskScreen, hide: hide, crew: crew, put2: put, wide: wide, sfx: { buy: sfxBuy, no: sfxNo, hit: sfxHit, coin: sfxCoin, win: sfxWin, bell: sfxBell } });

    var menuCur = 'menuMain';
    function menu(id) {
      menuCur = id;
      ['menuMain', 'menuOptions', 'menuCredits'].forEach(function (m) { $(m).style.display = m === id ? 'flex' : 'none'; });
      if (id === 'menuOptions') dbgDraw();
    }
    // Esc, in the middle of a game: the same menu, with the game stopped behind it.
    function pause() {
      paused = true; document.body.classList.add('paused'); held = {}; tipCur = null; drawTip();
      menu('menuMain'); hasSave(); $('title').classList.add('show');
    }
    function resume() { paused = false; document.body.classList.remove('paused'); hide('title'); }

    // Debug mode: an autoclicker, a jump to any confrontation of either part of the game, and stores multiplied or endless.
    try { var d0 = JSON.parse(localStorage.getItem(DBG_KEY) || '{}'); for (var dk in dbg) if (typeof d0[dk] === typeof dbg[dk]) dbg[dk] = d0[dk]; } catch (e) { /* storage unavailable */ }
    function dbgKeep() { try { localStorage.setItem(DBG_KEY, JSON.stringify(dbg)); } catch (e) { /* storage unavailable */ } }
    function dbgDraw(keepBoss) {
      var war = !!(S.finished || S.sg), list = war ? D.siege.bosses : D.bosses, sel = $('dbgBoss');
      $('optDebug').textContent = 'Debug mode: ' + (dbg.on ? 'on' : 'off'); $('dbg').classList.toggle('show', dbg.on);
      $('dbgAuto').checked = dbg.auto; $('dbgCps').value = dbg.cps; $('dbgCps').disabled = !dbg.auto; $('dbgCpsT').textContent = dbg.cps + ' a second';
      $('dbgMult').value = dbg.mult; $('dbgMult').disabled = dbg.inf; $('dbgMultT').textContent = '×' + dbg.mult; $('dbgInf').checked = dbg.inf;
      $('dbgSpree').checked = dbg.spree; $('dbgOrd').value = String(dbg.ord);
      $('dbgStage').value = war ? 'siege' : 'build';
      if (keepBoss === true && sel._war === war) return;
      sel._war = war;
      sel.innerHTML = '<option value="">Choose a boss</option>' + list.map(function (b, i) { return '<option value="' + i + '">' + (i + 1) + '. ' + b.name + '</option>'; }).join('');
    }
    // Put the game on the night before confrontation i of one part or the other (i < 0: at the very start of that part). The bonuses bought stay as they are.
    function jump(war, i) {
      marks.slice().forEach(function (m) { if (m.el.className.indexOf('spot') < 0) dropMark(m); });
      R = null; asking = null; ['dusk', 'tree', 'shop', 'ask'].forEach(hide);
      if (war) { S.up.school = MAXSTEP; S.finished = true; S.boss = D.bosses.length; if (i < 0) S.sg = null; else Noli.Siege.jump(i); }
      else { S.sg = null; S.finished = false; S.up.school = i < 0 ? 0 : i * D.STEPS + D.STEPS - 1; S.boss = Math.max(0, i); }
      paused = false; document.body.classList.remove('paused'); setPhase('title'); $('title').classList.add('show');
      W.setDaylight(0); W.setSuspicion(0); crew(false);
      save(); saved = S; hasSave(); dbgDraw(true);
    }
    $('optDebug').onclick = function () { dbg.on = !dbg.on; dbgKeep(); dbgDraw(); };
    $('dbgAuto').onchange = function () { dbg.auto = this.checked; dbgKeep(); dbgDraw(true); };
    $('dbgCps').oninput = function () { dbg.cps = +this.value; dbgKeep(); dbgDraw(true); };
    $('dbgMult').oninput = function () { dbg.mult = +this.value; dbgKeep(); dbgDraw(true); };
    $('dbgInf').onchange = function () { dbg.inf = this.checked; dbgKeep(); dbgDraw(true); };
    $('dbgSpree').onchange = function () { dbg.spree = this.checked; dbgKeep(); dbgDraw(true); if (dbg.on && dbg.spree && phase === 'tree') spree(); };
    $('dbgOrd').onchange = function () { dbg.ord = +this.value; dbgKeep(); dbgDraw(true); };
    $('dbgStage').onchange = function () { jump(this.value === 'siege', -1); };
    $('dbgBoss').onchange = function () { if (this.value !== '') jump($('dbgStage').value === 'siege', +this.value); };
    function setMuted(m) {
      muted = m; $('btnMute').innerHTML = I(muted ? 'mute' : 'sound'); $('optSound').textContent = 'Sound: ' + (muted ? 'off' : 'on'); drawTip();
    }
    function hasSave() { $('btnContinue').style.display = saved || paused ? 'block' : 'none'; $('btnPlay').style.display = paused ? 'none' : ''; $('optErase').disabled = !saved && !paused; }
    menu('menuMain'); hasSave();
    $('btnContinue').onclick = function () { ac(); if (paused) resume(); else showTree(); };
    $('btnPlay').onclick = function () {
      var go = function () { ac(); S = fresh(); R = null; save(); startDay(); };
      if (saved) ask('A new game', 'This erases your saved school.', 'Start over', 'Keep it', go); else go();
    };
    $('askYes').onclick = function () { answer(true); };
    $('askNo').onclick = function () { answer(false); };
    $('btnOptions').onclick = function () { menu('menuOptions'); };
    $('btnCredits').onclick = function () { menu('menuCredits'); };
    Array.prototype.forEach.call(document.querySelectorAll('.menu .back'), function (b) { b.onclick = function () { menu('menuMain'); }; });
    $('optSound').onclick = function () { setMuted(!muted); };
    $('optErase').onclick = function () {
      ask('Erase the save', 'Your saved school will be gone for good.', 'Erase it', 'Keep it', function () {
        try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* storage unavailable */ }
        marks.slice().forEach(function (m) { if (m.el.className.indexOf('spot') < 0) dropMark(m); });
        ['dusk', 'tree', 'shop'].forEach(hide);
        saved = null; S = fresh(); R = null; paused = false; document.body.classList.remove('paused'); setPhase('title'); W.setDaylight(0); W.setSuspicion(0); crew(false);
        hasSave(); dbgDraw();
      });
    };
    $('duskNext').onclick = function () { var go = duskGo; duskGo = null; if (go) go(); else showTree(); };
    $('shopBtn').onclick = function () { if (tv.moved <= 6 && L('tindahan')) showShop(); };
    $('shopBack').onclick = function () { hide('shop'); };
    $('nextDay').onclick = function () { if (tv.moved <= 6) startDay(); };
    $('bossBtn').onclick = function () { if (tv.moved <= 6 && bossDue()) startDay(true); };
    $('btnMute').onclick = function () { setMuted(!muted); this.blur(); };
    $('btnL').onclick = function () { W.rotate(1); this.blur(); };
    $('btnSpeed').onclick = function () { speed = speed === 1 ? 2 : speed === 2 ? 5 : 1; this.textContent = '×' + speed; this.classList.toggle('fast', speed > 1); this.blur(); drawTip(); };
    canvas.addEventListener('wheel', function (e) { W.zoom(e.deltaY); e.preventDefault(); }, { passive: false });
    // Drag the map to move it. W.dragged tells a click that ends a drag from a plain one.
    var drag = null;
    canvas.addEventListener('pointerdown', function (e) { if (e.button === 0) { drag = { x: e.clientX, y: e.clientY, far: 0 }; W.dragged = false; } });
    window.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.far += Math.abs(dx) + Math.abs(dy);
      if (drag.far > 6) { W.dragged = true; W.pan(dx, dy); canvas.classList.add('grab'); }
    });
    var drop = function () { drag = null; canvas.classList.remove('grab'); };
    window.addEventListener('pointerup', drop); window.addEventListener('pointercancel', drop);
    var held = {}, ARROWS = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    window.addEventListener('keyup', function (e) { held[e.code] = false; });
    panKeys = function (dt) { for (var k in ARROWS) if (held[k]) W.pan(ARROWS[k][0] * 700 * dt, ARROWS[k][1] * 700 * dt); };
    window.addEventListener('keydown', function (e) {
      var shopOpen = $('shop').classList.contains('show');
      if (e.code === 'Escape') { // a question first, then whatever is open or in hand, and otherwise the menu
        if (asking) answer(false);
        else if (menuCur !== 'menuMain' && (paused || phase === 'title')) menu('menuMain');
        else if (paused) resume();
        else if (phase === 'title') return;
        else if (shopOpen) hide('shop');
        else if (!Noli.Siege.esc()) pause();
        return;
      }
      if (paused || /^(INPUT|SELECT)$/.test(e.target.tagName || '')) return;
      if (ARROWS[e.code] && phase !== 'title' && phase !== 'tree' && phase !== 'siegeNight') { held[e.code] = true; e.preventDefault(); }
      if (e.code === 'KeyQ') W.rotate(1);
      if (e.code === 'KeyE') W.rotate(-1);
      if (e.code === 'Enter' && phase === 'event') $('duskNext').click();
      else if (e.code === 'Enter' && phase === 'tree' && !shopOpen) startDay();
    });
    document.addEventListener('mouseover', function (e) {
      var el = e.target; while (el && !el._tip) el = el.parentNode;
      tipCur = el || null; drawTip();
    });
    document.addEventListener('mousemove', function (e) { tipX = e.clientX; tipY = e.clientY; if (tipCur) drawTip(); });
    window.addEventListener('resize', function () { if (phase === 'tree') centerTree(); });

    // Debug: index.html?auto=1&step=9 jumps into a day with nine building steps done. auto=tree opens the tree, auto=dusk an evening,
    // boss=1 makes it a confrontation, up=2 sets every bonus to level 2, rich=1 fills the stores. bot=4 plays the whole game at 4 clicks a second.
    var q = new URLSearchParams(location.search);
    if (q.get('sbot')) { W.update(0.016); Noli.Siege.bot(+q.get('sbot')); }
    if (q.get('bot')) { W.update(0.016); q.get('bot').split(',').forEach(function (c) { runBot(+c); }); }
    if (q.get('auto')) {
      S = fresh();
      if (q.get('up')) D.upgrades.forEach(function (u) { if (u.id !== 'school') S.up[u.id] = Math.min(u.max, +q.get('up')); });
      if (q.get('step')) { S.up.school = +q.get('step'); S.boss = Math.floor((+q.get('step') + (q.get('boss') ? 0 : 1)) / D.STEPS); }
      if (q.get('rich')) for (var k in S.res) S.res[k] = +q.get('rich');
      if (q.get('day')) S.day = +q.get('day');
      S.last = 200;
      W.update(0.016);
      if (q.get('auto') === 'siege') Noli.Siege.debug(q); // siege.js lists what it takes
      else if (q.get('auto') === 'tree') showTree();
      else if (q.get('auto') === 'shop') { showTree(); showShop(); }
      else if (q.get('auto') === 'ask') { showTree(); D.resOrder.concat(['pesos']).forEach(function (k) { S.res[k] = 1e9; }); S.boss = D.bosses.length; updateTree(); buy(byId.school); }
      else {
        startDay(!!q.get('boss') && bossDue());
        if (q.get('auto') === 'dusk') R.t = dayLen() - 0.3;
        if (q.get('auto') === 'busy') { tickDay(3); spawnHazard(); spawnHazard(); spawnTarget('donor'); spawnTarget('maria'); R.frenzy = 5; lockT = true; }
      }
      if (q.get('hover')) { tipCur = nodeEls[q.get('hover')] || $(q.get('hover')); var rc = tipCur.getBoundingClientRect(); tipX = rc.right - 10; tipY = rc.bottom - 10; }
    }

    // Debug: menu=options or menu=credits opens that page of the title; menu=pause opens the Esc menu; dbgon=1 turns debug mode on.
    if (q.get('dbgon')) { dbg.on = true; }
    if (q.get('menu') === 'pause') pause();
    else if (q.get('menu')) { menu(q.get('menu') === 'credits' ? 'menuCredits' : 'menuOptions'); }

    // Show the title only when the lettering, the logo and the first picture of the town are all there, so nothing pops in piece by piece.
    hud(); W.update(0.016);
    var shown = false, show = function () { if (!shown) { shown = true; document.body.classList.add('ready'); } };
    var logo = $('logo'), waits = [document.fonts && document.fonts.ready, logo.decode ? logo.decode() : null];
    Promise.all(waits).then(show, show); setTimeout(show, 2500);

    // Debug: index.html?perf=1 shows the frame time, the number of draw calls and the drawing quality.
    var perf = q.get('perf') ? document.createElement('div') : null;
    if (perf) { perf.id = 'perf'; document.body.appendChild(perf); }

    var last = performance.now(), tipClock = 0;
    function frame(now) {
      var dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now;
      for (var n = 0; n < speed; n++) { // the speed button: time is run two or five times over, in the same small steps
        if (paused || lockT) break;
        if (phase === 'day') { if (dbg.on && dbg.auto) autoClick(dt); tickDay(dt); }
        else if (phase === 'siege') Noli.Siege.tick(dt);
      }
      pin();
      var war = !!(S.finished || S.sg) || titleWar, word = $('h2Word'); if (word._w !== war) { word._w = war; word.classList.toggle('war', war); } // the title, once the school is built
      panKeys(dt); hud(); W.update(dt, phase === 'tree' || phase === 'siegeNight' || paused);
      tipClock += dt;
      if (tipClock > 0.25) {
        tipClock = 0; if (tipCur) drawTip(); if (phase === 'day') showSpots();
        if (perf) perf.textContent = W.stats.ms.toFixed(1) + ' ms a frame · ' + W.stats.calls + ' draw calls · ' + Math.round(W.stats.tris / 1000) + 'k triangles · quality ' + W.stats.quality + ' (×' + W.stats.scale.toFixed(2) + ')';
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  var lockT = false; // debug: freeze the day for screenshots
  var titleWar = /[?&]title=war/.test(location.search); // debug: the title as it reads once the school is built
  var speed = 1, panKeys = function () {}; // speed: 1, 2 or 5 times, from the button beside the view

  window.addEventListener('error', function (e) { var b = $('err'); if (b) { b.style.display = 'block'; b.textContent = 'Error: ' + e.message + ' (' + (e.filename || '').split('/').pop() + ':' + e.lineno + ')'; } });
  window.addEventListener('DOMContentLoaded', boot);
})();
