// Noli — the siege. Once the school stands it has to be defended: the workers become filibusteros, posts are raised beside the roads,
// the enemy walks in by day, and at night a second tree is paid for with what he left behind. All its numbers are in data.js (siege).
(function () {
  var D = Noli.Data, SD = D.siege, W = Noli.World, I = Noli.Icon, G = null;
  var $ = function (id) { return document.getElementById(id); };
  var R = null, on = false, botting = false, mouse = null, T_DAY = 20, barKey = '';
  var towerBy = {}, upBy = {}, LOOKS = {}, nodeEls = {}, edges = [], towerBtns = {};
  var CELL = 116, NODE = 68, NS = 'http://www.w3.org/2000/svg';
  var SHOT = { tirador: [2.3, 0xfff2b0], escopeta: [3.1, 0xffffff], lantaka: [1.2, 0xffb040], bitag: [1.7, 0xbfe8ff] };

  SD.towers.forEach(function (t) { towerBy[t.id] = t; });
  SD.upgrades.forEach(function (u) { upBy[u.id] = u; });
  SD.foeOrder.forEach(function (k) { LOOKS[k] = SD.foes[k].look; });
  SD.bosses.forEach(function (b) { LOOKS[b.id] = b.look; });

  // ---------- the roads ----------
  var routes = SD.routes.map(function (pts) {
    var len = [0];
    for (var i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { p: pts, len: len, total: len[len.length - 1] };
  });
  function at(r, d) { // the point d units along road r
    var rt = routes[r], i = 1;
    while (i < rt.p.length - 1 && rt.len[i] < d) i++;
    var a = rt.p[i - 1], b = rt.p[i], k = Math.max(0, Math.min(1, (d - rt.len[i - 1]) / (rt.len[i] - rt.len[i - 1])));
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  }
  function roadDist(x, z) {
    var best = 1e9;
    routes.forEach(function (rt) {
      for (var i = 1; i < rt.p.length; i++) {
        var a = rt.p[i - 1], b = rt.p[i], dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
        best = Math.min(best, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t));
      }
    });
    return best;
  }

  // ---------- derived values ----------
  function S() { return G.s(); }
  function sg() { return G.s().sg; }
  function lv(id) { return sg().up[id] || 0; }
  function val(id) { return upBy[id].val(lv(id)); }
  function cost(u) { return Math.round(u.cost * Math.pow(u.growth, lv(u.id))); }
  function met(u) { for (var r in u.req) if (lv(r) < u.req[r]) return false; return true; }
  function totalF() { return sg().f + val('recluta'); }
  function freeF() { var n = totalF(); sg().towers.forEach(function (t) { n -= towerBy[t.k].cost; }); return n; }
  function maxHp() { return SD.HP + val('pader'); }
  function unlocked(k) { return k === 'tirador' || lv(k) > 0; }
  function stat(k, level) { // what a post of this kind does, at the level bought (or at another, for the tooltips)
    var d = towerBy[k], l = level != null ? level : lv(k), n = Math.max(0, k === 'tirador' ? l : l - 1);
    return { dmg: d.dmg * Math.pow(SD.LEVEL_DMG, n), rate: d.rate * val('pulbura'), range: d.range * val('tanaw'), splash: d.splash || 0, slow: d.slow ? Math.min(0.8, d.slow + 0.03 * n) : 0, slowT: d.slowT || 0 };
  }
  function statLine(k, level) { var s = stat(k, level); return s.dmg.toFixed(s.dmg < 10 ? 1 : 0) + ' a shot · ' + s.rate.toFixed(2) + ' shots a second · reach ' + s.range.toFixed(1) + (s.slow ? ' · slows by ' + Math.round(s.slow * 100) + '%' : ''); }
  // How far the town has sunk into war, 0 to 30: one step for each day held, and never less than six for each leader beaten.
  function warLevel() { var s = sg(); return Math.min(30, Math.max(s.wave, s.boss * 6)); }
  function bossDay() { var s = sg(); return s.boss < SD.bosses.length && s.since >= SD.BOSS_EVERY; }
  function active() { return Math.min(routes.length, 1 + sg().boss); } // roads in use
  function okSpot(x, z) {
    var d = roadDist(x, z), tw = sg().towers;
    if (d < SD.SPOT[0] || d > SD.SPOT[1]) return false;
    for (var i = 0; i < tw.length; i++) if (Math.hypot(tw[i].x - x, tw[i].z - z) < SD.SPOT[2]) return false;
    return W.free(x, z);
  }
  function coins(n, have) { return '<span class="' + (have ? '' : 'no') + '">' + I('coin') + G.fmt(n) + '</span>'; }

  // ---------- the beginning ----------
  function start() { // the works are over: every worker takes up arms, and nothing else is left
    var s = S(), f = 0, k;
    D.spots.forEach(function (sp) { f += s.up[sp.worker] || 0; s.up[sp.worker] = 0; });
    for (k in s.res) s.res[k] = 0;
    s.auto = {};
    s.sg = { f: Math.max(SD.MIN_F, f), up: {}, towers: [], since: 0, boss: 0, wave: 0, houses: Math.floor(f / D.HOUSE_EVERY), won: false };
    if (!botting) { G.crew(false); G.save(); }
  }
  function enter() {
    G.hide('tree'); G.hide('shop'); G.hide('title');
    if (!sg()) {
      start(); G.phase('event'); W.setDaylight(1.25); G.sfx.hit();
      G.dusk('The Siege of San Diego', SD.intro, [['fili', sg().f, 'filibusteros, to raise posts beside the roads'], ['heart', maxHp(), 'is what the school can take in a day']], 'Defend the school', dawn);
      return;
    }
    night();
  }

  // ---------- the day ----------
  function newRun() {
    var s = sg(), boss = bossDay() ? SD.bosses[s.boss] : null, w = s.wave, q = [], i;
    var n = Math.min(SD.MAX_FOES, Math.round((SD.FOES + SD.FOES_GROW * w) * (boss ? SD.BOSS_ESCORT : 1)));
    var kinds = SD.foeOrder.filter(function (k) { return SD.foes[k].from <= w; });
    for (i = 0; i < n; i++) q.push({ at: (i + 0.3 + Math.random() * 0.4) / n * T_DAY, k: kinds[Math.floor(Math.pow(Math.random(), 1.5) * kinds.length)] });
    if (boss) q.push({ at: Math.min(3, T_DAY / 4), boss: boss });
    q.sort(function (a, b) { return a.at - b.at; });
    var gift = Math.round(val('kaban') * Math.pow(SD.BOUNTY_GROW, w) * G.mult());
    S().res.pesos += gift;
    R = { t: 0, started: false, over: false, won: false, q: q, foes: [], hp: maxHp(), earn: 0, kills: 0, leaks: 0, gift: gift, boss: boss, bossFoe: null, bossDown: false,
      cd: s.towers.map(function () { return 0; }), place: null, sel: -1, elias: 3, call: 0, st: {} };
    SD.towers.forEach(function (t) { R.st[t.id] = stat(t.id); });
  }
  function dawn() {
    newRun(); G.phase('siege'); G.hide('dusk'); G.hide('title'); $('tree2').classList.remove('show');
    W.setDaylight(0.02);
    if (R.boss) { G.toast(R.boss.name); G.sfx.hit(); }
  }
  function go() { // the alarm: the enemy starts coming
    if (!R || R.started || G.now() !== 'siege') return;
    R.started = true; W.ringBell(); G.sfx.bell();
  }

  function spawn(q, by) { // by: the leader this one falls in beside
    var s = sg(), def = q.boss || SD.foes[q.k], r = by ? by.r : Math.floor(Math.random() * active());
    var e = { sp: q.boss ? q.boss.id : q.k, def: def, boss: !!q.boss, r: r, d: by ? Math.max(0, by.d - 1.2) : SD.START[r], hp: def.hp * Math.pow(SD.HP_GROW, s.wave), speed: def.speed,
      hit: q.boss ? 1e9 : def.hit, bounty: by ? 0 : def.bounty * Math.pow(SD.BOUNTY_GROW, s.wave) * val('gantimpala') * (botting ? 1 : G.mult()), slow: 0, slowT: 0, burn: 0, burnT: 0, noSlow: !!def.noSlow || def.trait === 'stone', f: 1 };
    e.max = e.hp; var p = at(r, e.d); e.x = p[0]; e.z = p[1];
    if (q.boss) { e.hp *= s.hurt || 1; e.f = s.hurt || 1; } // a leader comes back with the wounds of the day before
    if (by) { e.hp *= SD.CALL_HP; e.max = e.hp; }
    R.foes.push(e); if (q.boss) R.bossFoe = e;
  }
  function hurt(e, n) {
    if (e.hp <= 0) return;
    e.hp -= n;
    var a = val('apoy'); if (a) { e.burn = e.burnT > 0 ? Math.max(e.burn, n * a) : n * a; e.burnT = 3; }
  }
  function fire(t, st, e) {
    if (!botting) W.shot(t.x, SHOT[t.k][0], t.z, e.x, 0.8, e.z, SHOT[t.k][1]);
    if (st.splash) {
      if (!botting) W.blast(e.x, e.z, st.splash);
      for (var i = 0; i < R.foes.length; i++) if (Math.hypot(R.foes[i].x - e.x, R.foes[i].z - e.z) <= st.splash) hurt(R.foes[i], st.dmg);
    } else hurt(e, st.dmg);
    if (st.slow && !e.noSlow) { e.slow = st.slow; e.slowT = st.slowT; }
  }
  function kill(e, i) {
    R.foes.splice(i, 1); R.kills++;
    S().res.pesos += e.bounty; R.earn += e.bounty;
    if (e.boss) R.bossDown = true;
    if (botting) return;
    var p = W.screen(e.x, 1.4, e.z);
    if (e.bounty >= 1) G.floater('+' + G.fmt(e.bounty), p.x - 10, p.y - 20, 'gold');
    if (e.boss) { G.toast(e.def.name + ' is down'); G.sfx.win(); } else G.tone(240 + Math.random() * 120, 0.05, 0.035, 'square');
  }
  function leak(e) { // one of them is in
    R.leaks++; R.hp -= e.hit;
    if (!botting) { var p = W.siteScreen(); G.floater(e.boss ? e.def.name : '−' + e.hit, p.x - 10, p.y, 'bad'); G.sfx.hit(); W.pulse(); }
    if (R.hp <= 0) { R.hp = 0; finish(false); }
  }

  function tick(dt) {
    if (!R || !R.started || R.over) return;
    var s = sg(), i, j, e, slowAll = val('barikada'), b;
    R.t += dt; if (!botting) S().time += dt;
    while (R.q.length && R.q[0].at <= R.t) spawn(R.q.shift());
    b = R.bossFoe && R.bossFoe.hp > 0 ? R.bossFoe : null;
    if (b && b.def.trait === 'call') { R.call -= dt; if (R.call <= 0) { R.call = SD.CALL_EVERY; spawn({ k: 'guardia' }, b); } }
    if (b && b.def.trait === 'stone') b.hp = Math.min(b.max, b.hp + b.max * 0.005 * dt);

    for (i = R.foes.length - 1; i >= 0; i--) {
      e = R.foes[i];
      if (e.burnT > 0) { e.burnT -= dt; e.hp -= e.burn * dt; }
      var near = b && e !== b && Math.hypot(e.x - b.x, e.z - b.z) < 8;
      if (near && b.def.trait === 'heal' && e.hp > 0) e.hp = Math.min(e.max, e.hp + e.max * 0.05 * dt);
      var v = SD.SPEED * e.speed * slowAll * (near && b.def.trait === 'whip' ? 1.5 : 1);
      if (e.slowT > 0) { e.slowT -= dt; v *= 1 - e.slow; }
      e.d += v * dt;
      if (e.d >= routes[e.r].total) { R.foes.splice(i, 1); leak(e); if (R.over) return; continue; }
      var p = at(e.r, e.d); e.x = p[0]; e.z = p[1];
    }

    for (i = 0; i < s.towers.length; i++) {
      R.cd[i] -= dt; if (R.cd[i] > 0) continue;
      var t = s.towers[i], st = R.st[t.k], best = null, bp = -9, rr = st.range * st.range;
      for (j = 0; j < R.foes.length; j++) {
        e = R.foes[j]; if (e.hp <= 0) continue;
        var dx = e.x - t.x, dz = e.z - t.z; if (dx * dx + dz * dz > rr) continue;
        var pr = e.d / routes[e.r].total - (e.boss ? SD.BOSS_LAST : 0) - (st.slow && (e.slowT > 0.4 || e.noSlow) ? 2 : 0); // the one furthest along (a leader's escort before the leader); snares go for whoever is not caught yet
        if (pr > bp) { bp = pr; best = e; }
      }
      if (!best) { R.cd[i] = 0; continue; }
      R.cd[i] = 1 / st.rate; fire(t, st, best);
    }

    if (lv('elias')) {
      R.elias -= dt;
      if (R.elias <= 0) {
        var top = null;
        for (j = 0; j < R.foes.length; j++) { e = R.foes[j]; if (e.hp > 0 && (!top || e.hp > top.hp)) top = e; }
        if (top) {
          R.elias = 6.5 - 0.5 * lv('elias');
          hurt(top, top.max * (top.boss ? 0.01 + 0.005 * lv('elias') : 0.25 + 0.1 * lv('elias')));
          if (!botting) { W.shot(top.x + 7, 16, top.z - 7, top.x, 0.8, top.z, 0xffffff); W.blast(top.x, top.z, 1.1, 0xffffff); }
        } else R.elias = 0;
      }
    }

    for (i = R.foes.length - 1; i >= 0; i--) { e = R.foes[i]; if (e.hp <= 0) kill(e, i); else e.f = e.hp / e.max; }
    R.hp = Math.min(maxHp(), R.hp + val('lunas') * dt);
    if (!botting) W.setDaylight(Math.min(1, R.t / T_DAY) * 0.97);
    if (!R.q.length && !R.foes.length) finish(true);
  }

  // ---------- the evening ----------
  function finish(win) {
    var s = sg(), S0 = S(), boss = R.boss, day = S0.day;
    R.over = true; R.won = win; R.foes = []; R.place = null; R.sel = -1;
    S0.day += 1;
    if (boss) { if (R.bossDown) { s.boss += 1; s.since = 0; s.hurt = 1; } else if (R.bossFoe) s.hurt = Math.max(SD.WOUND_MIN, R.bossFoe.hp / R.bossFoe.max); } else s.since += 1;
    if (win) s.wave += 1;
    var last = !!boss && R.bossDown && s.boss >= SD.bosses.length && !s.won; if (last) s.won = true;
    if (botting) return;
    G.save(); G.phase('event'); W.setDaylight(1.6); W.ringBell(); G.sfx.bell(); W.ghost();
    var rows = [['guardia', R.kills, 'brought down'], ['coin', '+' + G.fmt(R.earn + R.gift), 'pesos'], ['heart', Math.ceil(R.hp) + ' / ' + maxHp(), 'the school at nightfall', win ? '' : 'gold']];
    if (last) { G.sfx.win(); G.dusk('San Diego Holds', SD.victory, rows, 'Stay on the lookouts', night); return; }
    var title = win ? 'Day ' + day + ' is held' : 'The school is overrun', text;
    if (boss && R.bossDown) {
      text = boss.name + ' will not be back. ' + (s.boss < routes.length ? 'But word comes that they have found another road into the town.' : 'The convento is running out of champions.') +
        (win ? '' : ' The school was overrun all the same: they wreck what they can and are gone by dark.');
      title = boss.name + ' is beaten';
    } else if (boss) text = boss.name + ' walked in through the school door, and it took the whole night to get the last of them out. He will be back tomorrow, but not whole: he keeps the wounds you gave him (' + Math.round((s.hurt || 1) * 100) + '% of his strength is left). Raise more posts, and better ones.';
    else if (win) text = bossDay() ? 'They are gone by dark. Tonight the lookouts send word: ' + SD.bosses[s.boss].name + ' is coming in person at dawn.' : 'They are gone by dark, and they leave their rifles behind. Tomorrow there will be more of them.';
    else text = 'Too many got through. They break the desks and tear up the books; by morning the town has taken the school back. Nothing is lost but the day: what they dropped on the roads is yours.';
    G.dusk(title, text, rows, 'Night falls', night);
  }

  // ---------- the night: the tree of the siege ----------
  function night() {
    R = null; G.phase('siegeNight'); G.hide('dusk'); G.hide('title'); W.setDaylight(1.6); W.ghost();
    G.save(); drawTree(); $('tree2').classList.add('show');
  }
  function state(u) { return lv(u.id) >= u.max ? 'maxed' : met(u) ? 'open' : 'locked'; }
  function buyable(u) { return state(u) === 'open' && S().res.pesos >= cost(u); }
  function buy(u, many) {
    var n = 0;
    do { if (!buyable(u)) break; S().res.pesos -= cost(u); sg().up[u.id] = lv(u.id) + 1; n++; } while (many);
    if (!n) { if (!botting) G.sfx.no(); return; }
    if (botting) return;
    G.sfx.buy(); G.save(); drawTree();
    nodeEls[u.id].classList.remove('pop'); void nodeEls[u.id].offsetWidth; nodeEls[u.id].classList.add('pop');
  }
  function nodeTip(u) {
    var l = lv(u.id), st = state(u), lines = [[SD.branches[u.branch], 'k'], [u.desc]], r, post = towerBy[u.id];
    if (st === 'locked') {
      for (r in u.req) if (lv(r) < u.req[r]) lines.push([I('lock') + upBy[r].name + ' ' + u.req[r], 'bad']);
      return G.tipHtml(u.name, lines);
    }
    if (st === 'maxed') { lines.push([post ? statLine(u.id) : u.show(u.val(l)), 'good'], [I('star'), 'c']); return G.tipHtml(u.name, lines); }
    if (post) { if (unlocked(u.id)) lines.push(['Now: ' + statLine(u.id, l)]); lines.push(['Next: ' + statLine(u.id, l + 1), 'good']); }
    else lines.push([(l ? u.show(u.val(l)) + ' → ' : '') + u.show(u.val(l + 1)), 'good']);
    lines.push([coins(cost(u), S().res.pesos >= cost(u)), 'c']);
    return G.tipHtml(u.name + ' <i>' + l + '/' + u.max + '</i>', lines);
  }
  function buildTree() {
    var ov = document.createElement('div'); ov.id = 'tree2'; ov.className = 'overlay';
    ov.innerHTML = '<div id="tree2World"><svg id="tree2Edges" width="1" height="1"></svg></div><div id="tree2Bar"><button id="sgDawn" class="tbtn go"><span></span><b></b></button></div>';
    document.body.insertBefore(ov, $('ask'));
    var world = $('tree2World'), svg = $('tree2Edges');
    SD.upgrades.forEach(function (u) {
      for (var r in u.req) {
        var p = upBy[r], ln = document.createElementNS(NS, 'line');
        ln.setAttribute('x1', p.x * CELL); ln.setAttribute('y1', p.y * CELL); ln.setAttribute('x2', u.x * CELL); ln.setAttribute('y2', u.y * CELL);
        svg.appendChild(ln); edges.push({ el: ln, to: u });
      }
    });
    SD.upgrades.forEach(function (u) {
      var b = document.createElement('button');
      b.style.left = (u.x * CELL - NODE / 2) + 'px'; b.style.top = (u.y * CELL - NODE / 2) + 'px';
      b.innerHTML = '<span class="nic">' + I(u.icon) + '</span><span class="lv"></span><span class="lk">' + I('lock') + '</span><span class="pr"></span>';
      G.tip(b, function () { return nodeTip(u); });
      b.onclick = function (e) { buy(u, e.shiftKey); b.blur(); };
      world.appendChild(b); nodeEls[u.id] = b;
    });
    $('sgDawn').onclick = dawn;
    G.tip($('sgDawn'), function () {
      if (!sg()) return '';
      if (bossDay()) { var b = SD.bosses[sg().boss]; return G.tipHtml(b.name, [[b.text], [b.how, 'k2'], ['If he reaches the school the day is lost, and he comes again tomorrow with the wounds you gave him.'], (sg().hurt || 1) < 1 ? [Math.round(sg().hurt * 100) + '% of his strength is left.', 'good'] : null]); }
      return G.tipHtml('Dawn', [['Go out to the roads. Nothing comes until you sound the alarm, so there is time to raise posts.']]);
    });
    window.addEventListener('resize', fitTree);
  }
  function fitTree() {
    var z = Math.max(0.5, Math.min(1, window.innerWidth / 760, (window.innerHeight - 250) / 620));
    $('tree2World').style.transform = 'translate(' + (window.innerWidth / 2) + 'px,' + (118 + (window.innerHeight - 250) / 2) + 'px) scale(' + z + ')';
  }
  function drawTree() {
    SD.upgrades.forEach(function (u) {
      var b = nodeEls[u.id], st = state(u), l = lv(u.id);
      b.className = 'node s-' + u.branch + ' ' + st + (l > 0 || u.id === 'tirador' ? ' owned' : '') + (buyable(u) ? ' can' : '');
      b.children[1].textContent = st === 'maxed' ? '★' : l > 0 ? l : '';
      b.children[3].innerHTML = st === 'open' ? coins(cost(u), S().res.pesos >= cost(u)) : '';
    });
    edges.forEach(function (e) { e.el.setAttribute('class', state(e.to) === 'locked' ? 'dim' : 'on'); });
    var boss = bossDay() ? SD.bosses[sg().boss] : null, d = $('sgDawn');
    d.className = 'tbtn go' + (boss ? ' fight' : ''); d.firstChild.innerHTML = I(boss ? boss.icon : 'dawn');
    d.lastChild.textContent = boss ? 'Day ' + S().day + ': face ' + boss.name : 'Begin day ' + S().day;
    fitTree(); G.drawTip();
  }

  // ---------- the bar of posts, under the town ----------
  function buildBar() {
    var bar = document.createElement('div'); bar.id = 'sgBar';
    bar.innerHTML = '<p id="sgHint"></p><div id="sgRow"></div>';
    document.body.insertBefore(bar, $('controls'));
    var row = $('sgRow');
    SD.towers.forEach(function (d) {
      var b = document.createElement('button'); b.className = 'tbtn post';
      b.innerHTML = '<span>' + I(d.icon) + '</span><b>' + d.name + '</b><i>' + I('fili') + d.cost + '</i>';
      b.onclick = function () { b.blur(); if (!R || R.over) return; R.sel = -1; if (freeF() < d.cost) { G.sfx.no(); return; } R.place = R.place === d.id ? null : d.id; };
      G.tip(b, function () {
        return sg() ? G.tipHtml(d.name, [[d.desc], [statLine(d.id), 'good'], [I('fili') + d.cost + ' filibusteros, of the ' + freeF() + ' you have free', freeF() >= d.cost ? 'c' : 'c bad'],
          ['Click it, then click beside a road. A post can be taken down again and its men used elsewhere.']]) : '';
      });
      row.appendChild(b); towerBtns[d.id] = b;
    });
    var sell = document.createElement('button'); sell.id = 'sgSell'; sell.className = 'tbtn';
    sell.onclick = function () {
      sell.blur(); if (!R || R.sel < 0) return;
      sg().towers.splice(R.sel, 1); R.cd.splice(R.sel, 1); R.sel = -1; G.sfx.coin(); G.save();
    };
    G.tip(sell, function () { return G.tipHtml('Take the post down', [['Its men come back to you, all of them, to be posted somewhere else.']]); });
    row.appendChild(sell);
    var alarm = document.createElement('button'); alarm.id = 'sgGo'; alarm.className = 'tbtn go';
    alarm.innerHTML = '<span>' + I('bell') + '</span><b></b>'; alarm.onclick = function () { alarm.blur(); go(); };
    G.tip(alarm, function () { return G.tipHtml('Sound the alarm', [['The enemy comes for ' + T_DAY + ' seconds. The day ends when the last of them is down, or when the school is overrun.'], ['Enter']]); });
    row.appendChild(alarm);

    var hp = document.createElement('div'); hp.id = 'sgHp'; hp.className = 'res'; hp.innerHTML = I('school') + '<b></b>'; $('chipDay').appendChild(hp);
    G.tip(hp, function () { return sg() ? G.tipHtml('The school', [['Every enemy who reaches the door costs it something. At nothing the day is lost, though not the war: it is whole again by morning.'], lv('lunas') ? ['It mends by ' + (val('lunas') * 10).toFixed(1) + ' every ten seconds.', 'good'] : null]) : ''; });
    var fl = document.createElement('div'); fl.id = 'sgFili'; fl.innerHTML = I('fili') + '<b></b>'; document.body.insertBefore(fl, $('controls'));
    G.tip(fl, function () { return sg() ? G.tipHtml('Filibusteros', [['Your men: ' + freeF() + ' free of ' + totalF() + '. Posts are raised with them. Recruit more at night.']]) : ''; });

    var canvas = $('scene');
    canvas.addEventListener('click', function (e) { if (e.button === 0 && !W.dragged) down(e.clientX, e.clientY); }); // a click, not the end of a drag across the map
    canvas.addEventListener('contextmenu', function (e) { if (on) { e.preventDefault(); if (R) { R.place = null; R.sel = -1; } } });
    window.addEventListener('pointermove', function (e) { mouse = [e.clientX, e.clientY]; });
    window.addEventListener('keydown', function (e) {
      if (!on) return;
      var ph = G.now();
      if (document.body.classList.contains('paused')) return;
      if (e.code === 'Enter' && ph === 'siegeNight') dawn();
      else if (e.code === 'Enter' && ph === 'siege') go();
    });
  }
  function down(cx, cy) {
    if (G.now() !== 'siege' || !R || R.over) return;
    var s = sg(), i;
    if (R.place) {
      var d = towerBy[R.place], p = W.pick(cx, cy);
      if (freeF() < d.cost || !okSpot(p[0], p[1])) { G.sfx.no(); return; }
      s.towers.push({ k: R.place, x: Math.round(p[0] * 10) / 10, z: Math.round(p[1] * 10) / 10 }); R.cd.push(0.3);
      G.sfx.buy(); G.save();
      if (freeF() < d.cost) R.place = null;
      return;
    }
    var best = -1, bd = 46;
    for (i = 0; i < s.towers.length; i++) { var q = W.screen(s.towers[i].x, 1.3, s.towers[i].z), dd = Math.hypot(q.x - cx, q.y - cy); if (dd < bd) { bd = dd; best = i; } }
    R.sel = best === R.sel ? -1 : best;
  }
  function drawBar() {
    var ph = G.now(), fr = freeF(), key = ph + '|' + fr + '|' + (R ? R.place + '|' + R.sel + '|' + R.started + '|' + R.over : '') + '|' + JSON.stringify(sg().up);
    if (key === barKey) return; barKey = key;
    SD.towers.forEach(function (d) {
      var b = towerBtns[d.id];
      b.style.display = unlocked(d.id) ? '' : 'none';
      b.className = 'tbtn post' + (R && R.place === d.id ? ' cur' : '') + (fr < d.cost ? ' poor' : '');
    });
    var sell = $('sgSell'), t = R && R.sel >= 0 ? sg().towers[R.sel] : null;
    sell.style.display = t ? '' : 'none';
    if (t) sell.innerHTML = '<span>' + I(towerBy[t.k].icon) + '</span><b>Take down</b><i>+' + towerBy[t.k].cost + I('fili') + '</i>';
    var al = $('sgGo'); al.style.display = R && !R.started ? '' : 'none';
    if (R && !R.started) { al.className = 'tbtn go' + (R.boss ? ' fight' : ''); al.lastChild.textContent = R.boss ? 'Face ' + R.boss.name : 'Sound the alarm'; }
    var hint = '';
    if (R && !R.over) hint = R.place ? 'Click beside a road to raise it there. Right-click or Esc to put it back.' : t ? '' : !sg().towers.length ? 'Choose a post below, then click beside a road to raise it.' : !R.started && fr >= SD.towers[0].cost ? 'You have men to spare for another post.' : '';
    $('sgHint').textContent = hint;
  }

  // ---------- HUD ----------
  function hud() {
    var S0 = S(), s = S0.sg, ph = G.now(), fight = ph === 'siege' && R, P = G.put2;
    if (!on) { on = true; document.body.classList.add('siege'); barKey = ''; }
    W.setSchool(D.stages.length - 1, 0); W.setHouses(s.houses); // the town first: nothing is built once the war roads are painted
    W.siege(SD.routes); W.setWar(warLevel(), s.boss); W.setTowers(s.towers);
    P($('hudDay'), 'Day ' + S0.day); P($('hudPesos'), G.fmt(Math.floor(S0.res.pesos)));
    var next = s.boss < SD.bosses.length ? SD.bosses[s.boss] : null;
    if (R && R.boss) {
      P($('hudStage'), R.boss.name); G.wide($('barStage'), R.bossFoe ? Math.max(0, R.bossFoe.hp / R.bossFoe.max * 100) : R.bossDown ? 0 : 100);
      P($('hudStep'), R.bossDown ? 'beaten' : R.bossFoe ? 'on the road' : 'coming');
    } else {
      P($('hudStage'), 'The Siege of San Diego'); G.wide($('barStage'), next ? Math.min(1, s.since / SD.BOSS_EVERY) * 100 : 100);
      var left = SD.BOSS_EVERY - s.since;
      P($('hudStep'), !next ? 'the school holds' : left <= 0 ? next.name + ' comes at dawn' : left === 1 ? next.name + ' comes tomorrow' : left + ' days until ' + next.name);
    }
    G.wide($('barTime'), fight ? Math.min(1, R.t / T_DAY) * 100 : ph === 'siege' ? 0 : 100);
    var hp = fight ? Math.ceil(R.hp) : maxHp(), he = $('sgHp'), low = fight && R.hp < maxHp() * 0.35 ? 'res want' : 'res';
    P(he.lastChild, hp + ' / ' + maxHp()); if (he._c !== low) { he._c = low; he.className = low; }
    P($('sgFili').lastChild, freeF() + ' / ' + totalF());
    W.setFoes(fight && !R.over ? R.foes : [], LOOKS);
    if (fight && !R.over && R.place && mouse) { var p = W.pick(mouse[0], mouse[1]); W.ghost(p[0], p[1], R.st[R.place].range, okSpot(p[0], p[1]) ? 1 : 0); }
    else if (fight && R.sel >= 0 && s.towers[R.sel]) W.ghost(s.towers[R.sel].x, s.towers[R.sel].z, R.st[s.towers[R.sel].k].range, 2);
    else W.ghost();
    var prep = fight && !R.over;
    W.setPaths(prep ? active() : 0, SD.START, prep && R.started ? 0.7 : 1);
    drawBar();
  }
  function off() { // no siege (a new game, or none yet): put the town back as it was
    if (!on) return;
    on = false; R = null; document.body.classList.remove('siege'); $('tree2').classList.remove('show'); W.siege(null);
  }
  function tipOf(what) {
    var s = sg(), S0 = S(), next = s.boss < SD.bosses.length ? SD.bosses[s.boss] : null;
    if (what === 'day') return G.tipHtml('Day ' + S0.day, [[R && R.started && !R.over ? (R.t < T_DAY ? 'They keep coming for ' + Math.ceil(T_DAY - R.t) + ' more seconds. ' : 'No more are coming. ') + 'The day ends when the last of them is down.' : 'The enemy comes for ' + T_DAY + ' seconds each day, once you sound the alarm.']]);
    if (what === 'pesos') return G.tipHtml('Pesos', [['Every enemy brought down leaves something worth selling. Spend the pesos at night, on the tree of the siege.']]);
    var lines = [['They come by ' + ['one road', 'two roads', 'three roads'][active() - 1] + ', ' + Math.min(SD.MAX_FOES, Math.round(SD.FOES + SD.FOES_GROW * s.wave)) + ' or so a day. Each day you hold, there are more of them and they are tougher.']];
    if (next) lines.push([I(next.icon) + next.name + (bossDay() ? ' comes at dawn.' : ' comes in ' + (SD.BOSS_EVERY - s.since) + ' days.'), 'k2'], [next.text], [next.how, 'bad']);
    else lines.push(['All five leaders are beaten. They still come, out of habit.', 'good']);
    return G.tipHtml('The Siege of San Diego', lines);
  }

  // ---------- a robot, to measure how long the siege takes: index.html?sbot=1 ----------
  function botSpot(r) {
    var rt = routes[r];
    for (var d = rt.total - 4; d > SD.START[r] + 6; d -= 1.5) {
      var p = at(r, d), q = at(r, d + 0.5), dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz) || 1;
      for (var side = 1; side >= -1; side -= 2) { var x = p[0] - dz / l * 2.5 * side, z = p[1] + dx / l * 2.5 * side; if (okSpot(x, z)) return [x, z]; }
    }
    return null;
  }
  function botPlace(limit) {
    var s = sg(), n = 0;
    for (var guard = 0; guard < 80 && (limit == null || n < limit); guard++) {
      var count = {}, tot = s.towers.length; s.towers.forEach(function (t) { count[t.k] = (count[t.k] || 0) + 1; });
      var k = unlocked('bitag') && (count.bitag || 0) < tot / 7 ? 'bitag' : unlocked('lantaka') && (count.lantaka || 0) <= tot / 3 ? 'lantaka' : unlocked('escopeta') && (count.escopeta || 0) <= tot / 3 ? 'escopeta' : 'tirador';
      if (freeF() < towerBy[k].cost) k = 'tirador';
      if (freeF() < towerBy[k].cost) break;
      var spot = botSpot(tot % active()) || botSpot(0); if (!spot) break;
      s.towers.push({ k: k, x: spot[0], z: spot[1] }); n++;
    }
  }
  function botBuy() {
    for (var guard = 0; guard < 400; guard++) {
      var best = null; SD.upgrades.forEach(function (u) { if (buyable(u) && (!best || cost(u) < cost(best))) best = u; });
      if (!best) break; buy(best);
    }
  }
  function bot(times) {
    botting = true;
    var Q = new URLSearchParams(location.search); // try other numbers without editing data.js: hp=120,140,... hg=1.17 bg=1.1 fg=1.6
    if (Q.get('hp')) Q.get('hp').split(',').forEach(function (v, i) { SD.bosses[i].hp = +v; });
    if (Q.get('hg')) SD.HP_GROW = +Q.get('hg'); if (Q.get('bg')) SD.BOUNTY_GROW = +Q.get('bg'); if (Q.get('fg')) SD.FOES_GROW = +Q.get('fg');
    for (var n = 0; n < times; n++) {
      var s0 = G.fresh(); D.spots.forEach(function (sp) { s0.up[sp.worker] = 20; }); s0.finished = true; G.put(s0); start();
      var days = 0, secs = 0, lost = 0, log = [];
      while (!sg().won && days < 250) {
        botBuy(); botPlace(); newRun(); R.started = true;
        var boss = R.boss, g = 0; while (!R.over && g++ < 40000) tick(0.05);
        secs += R.t; days++; if (!R.won) { lost++; if (!boss) log.push('day ' + days + ' LOST plain w' + sg().wave); }
        if (boss) log.push('day ' + days + ' ' + boss.id + (R.bossDown ? ' BEATEN' : ' lost ' + (R.bossFoe ? Math.round(R.bossFoe.hp / R.bossFoe.max * 100) + '%left' : '') + (R.hp <= 0 && R.leaks > 1 ? ' byLeaks' + R.leaks : '')) + ' k' + R.kills + ' +' + Math.round(R.earn) + ' (wave ' + sg().wave + ', ' + sg().towers.length + ' posts, ' + totalF() + ' men)');
      }
      var lvl = []; SD.upgrades.forEach(function (u) { lvl.push(u.id + ':' + lv(u.id)); });
      console.log('SBOT days=' + days + ' lost=' + lost + ' fightMinutes=' + (secs / 60).toFixed(1) + ' withNights~' + ((secs + days * 20) / 60).toFixed(0) + ' wave=' + sg().wave + ' pesos=' + Math.round(S().res.pesos) + ' ' + lvl.join(' '));
      console.log('SBOT ' + log.join(' | '));
    }
    botting = false; R = null; G.put(G.fresh());
  }

  // Debug: index.html?auto=siege jumps into the siege with a hundred workers turned filibusteros. sw=12 sets the days already held,
  // sb=2 the leaders beaten, sup=3 every bonus of the siege at level 3, sp=500 the pesos, st=8 raises eight posts,
  // day=10 shows the town as ten days held leave it (0 to 30),
  // sv=night opens the tree, sv=fight sounds the alarm and runs sf seconds of it.
  function debug(q) {
    var s0 = S(); D.spots.forEach(function (sp) { s0.up[sp.worker] = 20; }); s0.up.school = 20; s0.finished = true;
    botting = true; start(); botting = false;
    var s = sg();
    s.wave = +q.get('sw') || 0; s.boss = +q.get('sb') || 0; s.since = +q.get('ss') || 0; s0.res.pesos = +q.get('sp') || 0;
    if (q.get('day')) { var dn = Math.max(0, Math.min(30, +q.get('day'))); s.wave = dn; s.boss = Math.min(SD.bosses.length, Math.floor(dn / 6)); s.since = dn - s.boss * 6; s.won = dn >= 30; } // day=10: the town as ten days held leave it
    if (q.get('sup')) SD.upgrades.forEach(function (u) { s.up[u.id] = Math.min(u.max, +q.get('sup')); });
    hud(); botPlace(+q.get('st') || 0);
    if (q.get('sv') === 'night') { G.hide('title'); G.phase('siegeNight'); drawTree(); $('tree2').classList.add('show'); return; }
    if (q.get('sv') === 'intro') { s0.sg = null; s0.up.obreros = 20; enter(); return; }
    dawn();
    if (q.get('sv') === 'fight') { go(); for (var i = 0; i < (+q.get('sf') || 14) * 20; i++) tick(0.05); if (q.get('place')) { R.place = q.get('place'); mouse = [window.innerWidth * 0.42, window.innerHeight * 0.55]; } }
  }

  // Esc puts back the post in hand, or lets go of the one picked. Says whether there was anything to put back (if not, Esc opens the menu).
  function esc() {
    if (!on || !R || R.over || (!R.place && R.sel < 0)) return false;
    R.place = null; R.sel = -1; return true;
  }
  // Debug mode: the night before leader i comes, with the town as worn as it would be by then. Posts and bonuses stay as they are.
  function jump(i) {
    R = null; barKey = ''; $('tree2').classList.remove('show');
    if (!sg()) { botting = true; start(); botting = false; }
    var s = sg();
    s.boss = i; s.since = SD.BOSS_EVERY; s.wave = i * (SD.BOSS_EVERY + 1) + SD.BOSS_EVERY; s.hurt = 1; s.won = false;
  }

  Noli.Siege = {
    init: function (api) {
      G = api;
      var by = {}; D.upgrades.forEach(function (u) { by[u.id] = u; });
      T_DAY = D.DAY_LENGTH + by.lampara.val(by.lampara.max) + by.kampana.val(by.kampana.max); // the longest day the first part of the game allows
      buildTree(); buildBar();
    },
    enter: enter, hud: hud, off: off, tick: tick, tipOf: tipOf, bot: bot, debug: debug, esc: esc, jump: jump
  };
})();
