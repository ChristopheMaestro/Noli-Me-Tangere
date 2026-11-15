// Noli — the revolution. Once the siege is won the fight leaves San Diego: the view pulls back to a map of the south of Luzon,
// and the towns are taken one battle at a time, province by province, until Intramuros. Enemies brought down pay salapi, spent on a
// third tree; men are never bought, they join in the towns you free. All its numbers are in data.js (war); the coasts are in coast.js;
// the map and the fields are drawn by warview.js. Here are the rules, the flow, and the lettering laid over the scene.
(function () {
  var D = Noli.Data, WD = D.war, C = Noli.Coast, W = Noli.World, I = Noli.Icon, VW = Noli.WarView, MV = VW && VW.map, G = null;
  var $ = function (id) { return document.getElementById(id); };
  var botting = false, on = false, B = null;
  var upBy = {}, townBy = {}, PROVS = ['laguna', 'cavite', 'batangas', 'morong', 'bulacan'];
  var KM = 1 / (C.CELL * 110.6); // cells of the map to a kilometre
  function mx(lon) { return (lon - C.LON0) * C.KX / C.CELL; }
  function my(lat) { return (C.LAT1 - lat) / C.CELL; }

  WD.upgrades.forEach(function (u) { upBy[u.id] = u; });
  WD.towns.forEach(function (t, i) { t.lvl = i + 1; townBy[t.id] = t; });
  townBy[WD.HOME.id] = WD.HOME;
  WD.towns.concat([WD.HOME]).forEach(function (t) { t.x = mx(t.at[1]); t.y = my(t.at[0]); });
  WD.links.forEach(function (l) { // each road as a line of map points, with the distance run at each
    var a = townBy[l.a], b = townBy[l.b], pts = [[a.x, a.y]];
    (l.via || []).forEach(function (v) { pts.push([mx(v[1]), my(v[0])]); });
    pts.push([b.x, b.y]); l.pts = pts; l.len = [0];
    for (var i = 1; i < pts.length; i++) l.len.push(l.len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    l.total = l.len[l.len.length - 1];
  });
  function along(l, d) {
    var i = 1; while (i < l.pts.length - 1 && l.len[i] < d) i++;
    var a = l.pts[i - 1], b = l.pts[i], k = Math.max(0, Math.min(1, (d - l.len[i - 1]) / (l.len[i] - l.len[i - 1] || 1)));
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  }

  // ---------- derived values ----------
  function S() { return G.s(); }
  function w() { return G.s().war; }
  function lv(id) { return w().up[id] || 0; }
  function val(id) { return upBy[id].val(lv(id)); }
  function cost(u) { return Math.round(u.cost * WD.PRICE * Math.pow(u.growth, lv(u.id))); }
  function met(u) { for (var r in u.req) if (lv(r) < u.req[r]) return false; return true; }
  function owns(id) { return id === WD.HOME.id || !!w().own[id]; }
  function provLeft(p) { var n = 0; WD.towns.forEach(function (t) { if (t.prov === p && !owns(t.id)) n++; }); return n; }
  function wallDown() { return PROVS.every(function (p) { return !provLeft(p); }); }
  function freed() { var n = 0; WD.towns.forEach(function (t) { if (owns(t.id)) n++; }); return n; }
  function open(t) { // can it be attacked now?
    if (owns(t.id)) return false;
    if (t.prov === 'manila' && !wallDown()) return false;
    if (t.id === 'intramuros') return provLeft('manila') === 1;
    return WD.links.some(function (l) { return (l.a === t.id && owns(l.b)) || (l.b === t.id && owns(l.a)); });
  }
  function held(l) { return !owns(l.a) || !owns(l.b); }   // a road the Spaniards still use
  function reach(l) { return owns(l.a) !== owns(l.b); }   // and one of them that starts at a town of yours
  function garrison(l, size) { return Math.max(8, Math.round(WD.E0 * Math.pow(WD.E_GROW, l - 1) * (size || 1) * val('espiya'))); }
  function joiners(t) { return Math.round(WD.JOIN * Math.pow(WD.JOIN_GROW, t.lvl - 1) * (t.boss ? WD.JOIN_BOSS : 1)); }
  function worth(l) { return WD.BOUNTY * Math.pow(WD.BOUNTY_GROW, l - 1) * val('samsam') * (botting ? 1 : G.mult()); }
  function front() { // the weakest garrison that can be attacked now: the columns on the roads are measured against it
    var best = 0; WD.towns.forEach(function (t) { if (open(t) && (!best || t.lvl < best)) best = t.lvl; });
    return best || WD.towns.length;
  }
  function coins(n, have) { return '<span class="' + (have ? '' : 'no') + '">' + I('coin') + G.fmt(n) + '</span>'; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ---------- the battle: its rules, with nothing drawn ----------
  // The field is 100 by 56. Your men come on from the left; the town, or the column, is on the right. Nobody is sent anywhere:
  // every company picks its own enemy, the bolo men closing with him and the rifles stopping as soon as he is in reach.
  var FW = 100, FH = 56, YMIN = 7, YMAX = 49, GATE = { x0: 57.5, x1: 65.5, y0: 23, y1: 33 }; // GATE: the wall and moat of Intramuros, and the one way through
  function mods() { // what the tree makes of the army
    return { hp: val('anting') * val('kartilya') * val('ranggo'), rhp: val('maestranza'), all: val('bandera') * val('supremo') * val('ranggo'), melee: val('itak'), mrate: val('sandugo'), parry: val('arnis'),
      shot: val('punteria'), rate: val('polvora'), range: val('paltik'), speed: val('martsa'), gun: val('bala'), splash: val('polvorin'), cover: val('trinchera'), regen: val('botica'), revive: val('tandang'),
      share: val('fusil'), guns: lv('lantaka'), boss: val('gomburza'), cd: val('lakambini') };
  }
  function mk(side, k, x, y, men, hpK, dmgK) {
    var d = WD.kinds[k], u = { side: side, k: k, d: d, x: x, y: y, hx: x, hy: y, men: men, hp: men * WD.HP * d.hp * hpK, dmg: men * d.dps / d.rate * dmgK, rate: d.rate, rng: d.range, spl: d.splash || 0,
      cd: Math.random() / d.rate, tg: null, think: Math.random() * 0.3, hot: false, mv: false, at: 0, face: side ? -1 : 1, ph: Math.random() * 9 };
    u.max = u.hp; return u;
  }
  // spec: { type: 'town' | 'col' | 'conv', lvl, size, town (for a town), boss, men (prisoners, for a convoy), name }
  function newBattle(spec) {
    var m = mods(), men = w().men, n = clamp(Math.round(men / WD.UNIT), 4, WD.MAX_UNITS), per = men / n, nr = Math.min(n - 1, Math.round(n * m.share)), nb = n - nr, us = [], i, u, ROWS = 11;
    for (i = 0; i < n; i++) {
      var bolo = i < nb, col = Math.floor(i / ROWS), row = i % ROWS, inRow = Math.min(ROWS, n - col * ROWS);
      u = mk(0, bolo ? 'bolo' : 'rifle', 25 - col * 2.3 + (Math.random() - 0.5) * 0.6, 28 + (row - (inRow - 1) / 2) * 2.7 + (Math.random() - 0.5) * 0.6, per, m.hp * (bolo ? 1 : m.rhp), m.all * (bolo ? m.melee : m.shot));
      if (bolo) u.rate *= m.mrate; else { u.rate *= m.rate; u.rng += m.range; }
      us.push(u);
    }
    for (i = 0; i < m.guns; i++) { u = mk(0, 'lantaka', 3 + (i % 2) * 2.5, 28 + (i - (m.guns - 1) / 2) * Math.min(5, 38 / m.guns), per, m.hp, m.all * m.gun); u.rate *= m.rate; u.spl += m.splash; us.push(u); }

    var l = spec.lvl, town = spec.type === 'town', gate = spec.town === 'intramuros' ? GATE : null, E = garrison(l, spec.size), nE = clamp(Math.round(E / WD.UNIT), 2, WD.MAX_UNITS), perE = E / nE, hk = Math.pow(WD.Q_HP, l - 1), dk = Math.pow(WD.Q_DMG, l - 1);
    var kinds = ['guardia', 'cuadrillero', 'cazador', 'carabinero'].filter(function (k) { return WD.kinds[k].from <= l; }), tot = 0, by = {}, list = [], seen = {}, hp0 = 0;
    kinds.forEach(function (k) { tot += WD.kinds[k].w; });
    for (i = 0; i < nE; i++) { // each kind gets its share of the figures
      var pick = (i + 0.5) / nE * tot, kk = 0;
      while (kk < kinds.length - 1 && pick > WD.kinds[kinds[kk]].w) { pick -= WD.kinds[kinds[kk]].w; kk++; }
      list.push(kinds[kk]); by[kinds[kk]] = (by[kinds[kk]] || 0) + 1;
    }
    list.forEach(function (k, idx) {
      var d = WD.kinds[k], j = seen[k] = (seen[k] || 0) + 1, cnt = by[k], x, y;
      if (town) { // a garrison: the hired men out in front, the rifles behind the barricade, the regulars behind them
        var rows = Math.ceil(cnt / 14), rr = (j - 1) % rows, ii = Math.floor((j - 1) / rows), inCol = Math.ceil(cnt / rows);
        x = (d.melee ? (gate ? 48 : 56) : k === 'cazador' ? 73 : 66.5) + rr * 2.4; y = 28 + (ii - (inCol - 1) / 2) * Math.min(3.2, 39 / inCol);
      } else { x = 72 + Math.floor(idx / 9) * 2.4; y = 28 + (idx % 9 - (Math.min(9, nE - Math.floor(idx / 9) * 9) - 1) / 2) * 2.7; } // a column on the march
      u = mk(1, k, x + (Math.random() - 0.5) * 0.6, y + (Math.random() - 0.5) * 0.6, perE, hk, dk); u.hot = !town || !!d.melee; us.push(u);
    });
    var nC = town ? Math.floor(l / 6) + (spec.boss ? 1 : 0) : 0;
    for (i = 0; i < nC; i++) us.push(mk(1, 'canon', 78.5, 28 + (i - (nC - 1) / 2) * (36 / Math.max(1, nC)) + (nC === 1 ? -7 : 0), perE, hk, dk));
    var jefe = null; if (spec.boss) { jefe = mk(1, 'jefe', 86, 28, Math.max(perE, E * 0.05), hk, dk); us.push(jefe); }
    us.forEach(function (q) { if (q.side) hp0 += q.max; });
    return { spec: spec, t: 0, over: false, won: false, units: us, earn: 0, kills: 0, lost: 0, hp0: hp0, hpNow: hp0, gate: gate,
      men0: E, m: m, worth: worth(l) * (town ? 1 : val('kalayaan')), charge: 0, chargeCd: 0, volleyCd: 0, hornCd: 0, elias: 4, jefe: jefe, mine: n, foes: nE };
  }
  function nearest(u) {
    var us = B.units, best = null, bd = 1e9, i, e, d;
    for (i = 0; i < us.length; i++) { e = us[i]; if (e.side === u.side || e.hp <= 0) continue; d = (e.x - u.x) * (e.x - u.x) + (e.y - u.y) * (e.y - u.y); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  function hurt(e, n, shot) { // shot: it came from a rifle or a gun
    if (e.hp <= 0) return;
    if (!e.side) n *= shot ? B.m.cover : e.d.melee ? B.m.parry : 1; else if (e.k === 'jefe') n *= B.m.boss;
    e.hp -= n; if (e.side) e.hot = true;
    if (e.hp > 0) return;
    if (e.side) {
      var b = e.men * B.worth * (e.k === 'jefe' ? 3 : 1); w().cash += b; B.earn += b; B.kills += e.men;
      if (!botting) fall(e, b);
    } else {
      if (!e.rev && B.m.revive && Math.random() < B.m.revive) { e.rev = true; e.hp = e.max * 0.35; return; } // Tandang Sora has him on his feet again
      B.lost += e.men; if (!botting) fall(e, 0);
    }
  }
  function strike(u, t, k) {
    var d = u.d, dmg = u.dmg * k * (!u.side && d.melee && B.charge > 0 ? 1.5 : 1), us = B.units, i, e;
    u.cd = 1 / u.rate; u.at = 0.3;
    if (u.spl) { for (i = 0; i < us.length; i++) { e = us[i]; if (e.side === t.side && e.hp > 0 && Math.hypot(e.x - t.x, e.y - t.y) <= u.spl) hurt(e, e === t ? dmg : dmg * 0.5, true); } }
    else hurt(t, dmg, !d.melee);
    if (!botting && !d.melee) VW.battle.shot(u.x, u.y, t.x, t.y, u.spl ? 1 : 0, u.spl);
  }
  function step(dt) {
    if (!B || B.over) return;
    var us = B.units, m = B.m, g = B.gate, i, j, u, t, d, dist, gx, gy, dx, dy, dd, k, mine = 0, foes = 0, hp = 0;
    B.t += dt; if (B.charge > 0) B.charge -= dt; B.chargeCd -= dt; B.volleyCd -= dt; B.hornCd -= dt;
    for (i = 0; i < us.length; i++) {
      u = us[i]; if (u.hp <= 0) continue; d = u.d; u.px = u.x;
      u.cd -= dt; u.think -= dt; if (u.at > 0) u.at -= dt;
      if (u.think <= 0 || !u.tg || u.tg.hp <= 0) { u.think = 0.25 + Math.random() * 0.1; u.tg = nearest(u); }
      t = u.tg; dist = t ? Math.hypot(t.x - u.x, t.y - u.y) : 1e9;
      if (t && dist <= u.rng && u.cd <= 0) strike(u, t, 1);
      gx = u.x; gy = u.y;
      if (!u.side) { if (t && B.t > 1.2 && dist > u.rng * (d.melee ? 0.8 : 0.9)) { gx = t.x; gy = t.y; } } // yours go for the nearest of them, and stop when he is in reach
      else if (u.hot && t && B.t > 2.5) { if (dist > u.rng * 0.85) { gx = t.x; gy = t.y; } } // the enemy: out for you once roused, or else holding his place
      else { gx = u.hx; gy = u.hy; }
      if (g) { // Intramuros: nobody goes through the wall, only through the gate
        var su = u.x < g.x0 ? -1 : u.x > g.x1 ? 1 : 0, sg = gx < g.x0 ? -1 : gx > g.x1 ? 1 : 0;
        if (su !== sg || su === 0) {
          if (su !== 0 && (u.y < g.y0 + 1 || u.y > g.y1 - 1)) { gx = su < 0 ? g.x0 - 1.5 : g.x1 + 1.5; gy = clamp(u.y, g.y0 + 2, g.y1 - 2); }
          else gy = clamp(gy, g.y0 + 1, g.y1 - 1);
        }
      }
      k = d.speed * (u.side ? 1 : m.speed * (d.melee && B.charge > 0 ? 1.5 : 1)) * dt; dx = gx - u.x; dy = gy - u.y; dd = Math.hypot(dx, dy);
      u.mv = dd > 0.35 && k > 0;
      if (u.mv) { k = Math.min(1, k / dd); u.x = clamp(u.x + dx * k, 1, FW - 1); u.y = clamp(u.y + dy * k, YMIN, YMAX); if (Math.abs(dx) > 0.2) u.face = dx > 0 ? 1 : -1; }
      else if (t) u.face = t.x >= u.x ? 1 : -1;
      if (!u.side && m.regen) u.hp = Math.min(u.max, u.hp + u.max * m.regen * dt);
    }
    for (i = 0; i < us.length; i++) { // nobody stands on a comrade
      u = us[i]; if (u.hp <= 0) continue;
      if (u.side) { foes++; hp += u.hp; } else mine++;
      for (j = i + 1; j < us.length; j++) {
        t = us[j]; if (t.hp <= 0 || t.side !== u.side) continue;
        dx = t.x - u.x; dy = t.y - u.y; if (dx > 1.8 || dx < -1.8 || dy > 1.8 || dy < -1.8) continue;
        dd = dx * dx + dy * dy; if (dd >= 3.24 || dd < 1e-6) continue;
        dd = Math.sqrt(dd); k = (1.8 - dd) / dd * 0.25;
        if (u.d.speed) { u.x -= dx * k; u.y -= dy * k; } if (t.d.speed) { t.x += dx * k; t.y += dy * k; }
      }
    }
    if (g) for (i = 0; i < us.length; i++) { // and nobody is jostled into the moat
      u = us[i]; if (u.hp <= 0 || u.x <= g.x0 || u.x >= g.x1 || (u.y >= g.y0 + 0.5 && u.y <= g.y1 - 0.5)) continue;
      if (u.px <= g.x0) u.x = g.x0; else if (u.px >= g.x1) u.x = g.x1; else u.y = clamp(u.y, g.y0 + 0.5, g.y1 - 0.5);
    }
    B.mine = mine; B.foes = foes; B.hpNow = hp;
    if (lv('elias') && foes) {
      B.elias -= dt;
      if (B.elias <= 0) {
        var top = null; for (i = 0; i < us.length; i++) { u = us[i]; if (u.side && u.hp > 0 && (!top || u.hp > top.hp)) top = u; }
        B.elias = 7 - 0.5 * lv('elias');
        if (!botting) VW.battle.shot(top.x - 9, top.y - 14, top.x, top.y, 2, 3);
        hurt(top, top.max * (top.k === 'jefe' ? 0.03 + 0.01 * lv('elias') : 0.3 + 0.1 * lv('elias')), true);
      }
    }
    if (!foes) end(true); else if (!mine || B.t >= WD.T) end(false);
  }
  function end(win) { B.over = true; B.won = win; settle(); if (!botting) after(); }
  // The three words a commander has. Everything else the men do themselves.
  function doCharge() { if (!B || B.over || !lv('sugod') || B.chargeCd > 0) return false; B.charge = val('sugod'); B.chargeCd = WD.CHARGE_CD * B.m.cd; return true; }
  function doVolley() {
    if (!B || B.over || !lv('descarga') || B.volleyCd > 0) return false;
    var n = 0; B.units.forEach(function (u) { if (u.side || u.k !== 'rifle' || u.hp <= 0) return; var t = nearest(u); if (t && Math.hypot(t.x - u.x, t.y - u.y) <= u.rng * 1.15) { strike(u, t, val('descarga')); n++; } });
    if (!n) return false;
    B.volleyCd = WD.VOLLEY_CD * B.m.cd; return true;
  }
  function doHorn() {
    if (!B || B.over || !lv('tambuli') || B.hornCd > 0) return false;
    var k = val('tambuli'); B.units.forEach(function (u) { if (!u.side && u.hp > 0) u.hp = Math.min(u.max, u.hp + u.max * k); });
    B.hornCd = WD.HORN_CD * B.m.cd; return true;
  }
  // What a battle leaves behind: the town and its men if it was won, and whatever fell on the field either way.
  function settle() {
    var s = w(), sp = B.spec; s.fights++; S().day += 1; B.join = 0; B.purse = 0;
    if (sp.x != null) s.at = [sp.x, sp.y];
    if (!B.won) return;
    if (sp.type === 'town') {
      var t = townBy[sp.town]; s.own[t.id] = 1; B.join = joiners(t); B.purse = Math.round(B.men0 * B.worth * WD.PURSE * val('cedula'));
      if (t.id === 'intramuros') s.won = true;
    } else if (sp.type === 'conv') B.join = sp.men;
    else B.purse = Math.round(B.men0 * B.worth * WD.PURSE * 0.5);
    s.men += B.join; s.cash += B.purse;
  }

  // ---------- the beginning ----------
  function begin() { // the siege is over: its men march out, and its money stays behind
    var s = S(), f = s.sg ? s.sg.f + ((s.sg.up && s.sg.up.recluta) || 0) * 5 : WD.MEN[0];
    s.res.pesos = 0;
    s.war = { men: clamp(f, WD.MEN[0], WD.MEN[1]), cash: 0, up: {}, own: {}, fights: 0, won: false, seen: false, at: null };
    if (!botting) G.save();
  }
  function quiet() { if (!on) return; on = false; B = null; anim = lift = swap = null; fade.a = fade.to = 0; document.body.classList.remove('war'); $('tree3').classList.remove('show'); cols.slice().forEach(dropCol); W.setLift(1); }
  function wake() { if (!on) { on = true; document.body.classList.add('war'); markKey = barKey = camKey = ''; } }
  function enter() {
    ['tree', 'shop', 'title', 'dusk'].forEach(G.hide); $('tree2').classList.remove('show');
    if (!w()) begin();
    wake();
    if (!w().seen) { // the last look at San Diego
      VW.hide(); G.phase('event'); W.setDaylight(0.9); G.sfx.hit(); MV.build();
      G.dusk('The Revolution', WD.intro, [['fili', G.fmt(w().men), 'freedom fighters, who were filibusteros yesterday'], ['coin', '0', 'salapi: the pesos are thrown away']], 'Take the road', function () { w().seen = true; G.save(); showMap('unzoom'); });
      return;
    }
    showMap();
  }
  // Behind the title, once the revolution has begun, lies the whole map.
  function backdrop() {
    quiet();
    if (W.showing() === MV.stage && MV.stage) return;
    MV.show(); cam.x = C.W / 2; cam.z = C.H / 2; cam.v = MV.maxV(); MV.bound(); MV.sync(owns, function () { return false; }, wallDown()); MV.setCols([]);
  }

  // ---------- the view of the map ----------
  var cam = MV ? MV.cam : null, anim = null, lift = null, swap = null, fade = { a: 0, to: 0, shown: -1 }, clock = 0;
  var townEls = {}, manilaEl = null, homeEl = null, names = [], cols = [], colT = [0, 0, 0], convT = 30, markKey = '', camKey = '';
  function whole() { return MV.maxV(); }
  function isWhole() { return cam.v > whole() * 0.97; }
  function fly(x, z, v, dur, done) { anim = { t: 0, dur: dur, ax: cam.x, az: cam.z, av: cam.v, bx: x, bz: z, bv: v, done: done || null }; }
  function home() { fly(C.W / 2, C.H / 2, whole(), 0.9); }
  function front0() { var p = w().at || [WD.HOME.x, WD.HOME.y]; return [p[0], p[1], whole() * 0.4]; } // where the last battle was fought: the map opens there
  function manilaAt() { return [mx(WD.MANILA[1]), my(WD.MANILA[0])]; }
  function over(fn) { swap = fn; fade.to = 1; } // change the scene behind a breath of cloud
  function showMap(mode) {
    B = null; G.phase(mode === 'unzoom' ? 'warFly' : 'warMap'); ['dusk', 'title'].forEach(G.hide); $('tree3').classList.remove('show'); wake();
    if (mode === 'unzoom') { lift = { t: 0 }; G.sfx.bell(); W.ringBell(); VW.hide(); return; } // out of the village, and up, until the whole south of Luzon is on the table
    mapUp();
  }
  function mapUp() { MV.show(); var f = front0(); cam.x = f[0]; cam.z = f[1]; cam.v = f[2]; MV.bound(); anim = null; sync(); }
  function sync() { MV.sync(owns, open, wallDown()); markKey = ''; marks(); }

  function townTip(t) {
    var p = WD.provinces[t.prov], lines = [[p.name + (t.boss ? (t.prov === 'manila' ? ' · the walled city' : ' · the capital') : ''), 'k']], g = garrison(t.lvl);
    if (owns(t.id)) { lines.push(['Free. ' + joiners(t) + ' of its people marched out with you.', 'good']); return G.tipHtml(t.name, lines); }
    lines.push(['Held by a garrison of about ' + G.fmt(g) + (t.boss ? ', under ' + p.jefe + '.' : '.')], ['Your army: ' + G.fmt(w().men) + ' men', 'k2'], ['+' + joiners(t) + ' men will join you if it falls', 'good']);
    if (open(t)) lines.push(['Click to attack.']);
    else if (t.prov === 'manila' && !wallDown()) lines.push(['Behind the wall of Manila. Free the five provinces round it first: ' + PROVS.filter(provLeft).map(function (q) { return WD.provinces[q].name + ' (' + provLeft(q) + ' to go)'; }).join(', ') + '.', 'bad']);
    else if (t.id === 'intramuros') lines.push(['The arrabales first: Tondo, Sampaloc, Santa Ana and Malate.', 'bad']);
    else lines.push(['No road of yours leads here yet.', 'bad']);
    return G.tipHtml(t.name, lines);
  }
  var NAMES = [['Bahía de Manila', 14.60, 120.76, 'sea'], ['Laguna de Bay', 14.335, 121.215, 'sea'], ['Mar de China', 14.05, 120.28, 'sea big'], ['L. de Bombón', 13.95, 121.005, 'sea small'], ['Seno de Balayán', 13.80, 120.77, 'sea small'],
    ['Seno de Tayabas', 13.72, 121.78, 'sea'], ['Mar Pacífico', 14.72, 122.3, 'sea big'], ['Bataán', 14.64, 120.48, 'land'], ['Pampanga', 15.06, 120.66, 'land'], ['Tayabas', 13.97, 121.74, 'land'], ['Mindoro', 13.33, 121.05, 'land'],
    ['Marinduque', 13.39, 121.97, 'land small'], ['I. de Polillo', 14.86, 121.93, 'land small']];
  function buildMarks() {
    var box = document.createElement('div'); box.id = 'warMarks'; document.body.insertBefore(box, $('controls'));
    NAMES.forEach(function (n) { var s = document.createElement('span'); s.className = 'wname ' + n[3]; s.textContent = n[0]; box.appendChild(s); names.push({ el: s, x: mx(n[2]), y: my(n[1]) }); });
    for (var p in WD.provinces) if (p !== 'manila') { var pr = WD.provinces[p], e = document.createElement('span'); e.className = 'wname prov'; e.textContent = pr.name; box.appendChild(e); names.push({ el: e, x: mx(pr.at[1]), y: my(pr.at[0]), prov: p }); }
    WD.towns.forEach(function (t) {
      var b = document.createElement('button'); b.className = 'wtown'; b.innerHTML = '<i></i><b>' + t.name + '</b>';
      b.onclick = function () { b.blur(); if (G.now() === 'warMap' && !anim && !swap && open(t)) askTown(t); else if (!owns(t.id)) G.sfx.no(); };
      G.tip(b, function () { return w() ? townTip(t) : ''; });
      box.appendChild(b); townEls[t.id] = b;
    });
    manilaEl = document.createElement('button'); manilaEl.className = 'wtown'; manilaEl.innerHTML = '<i></i><b>Manila</b>';
    manilaEl.onclick = function () { manilaEl.blur(); if (anim || swap) return; var m = manilaAt(); fly(m[0], m[1], whole() * 0.085, 0.9); };
    G.tip(manilaEl, function () {
      if (!w()) return '';
      return G.tipHtml('Manila', [['The capital and its arrabales', 'k'], wallDown() ? ['The wall is breached. ' + provLeft('manila') + ' of its five quarters are still held: Tondo, Sampaloc, Santa Ana, Malate, and Intramuros last of all.'] :
        ['The Captain-General has thrown a wall round the whole city. It cannot be stormed while the provinces behind you are his.', 'bad'],
      wallDown() ? null : ['Still to free: ' + PROVS.filter(provLeft).map(function (q) { return WD.provinces[q].name + ' (' + provLeft(q) + ')'; }).join(', '), 'k2'], ['Click to look closer.']]);
    });
    box.appendChild(manilaEl);
    homeEl = document.createElement('button'); homeEl.className = 'wtown home own'; homeEl.innerHTML = '<i></i><b>San Diego</b>';
    G.tip(homeEl, function () { return G.tipHtml('San Diego', [['La Laguna', 'k'], ['Where it began: a school, then a siege. The lake town Rizal drew from his own Calamba.']]); });
    box.appendChild(homeEl);
    var fd = document.createElement('div'); fd.id = 'warFade'; document.body.insertBefore(fd, $('hud')); fade.el = fd;
  }
  function colTip(c) {
    return function () {
      if (!w()) return '';
      var l = front(), g = garrison(l, c.size), far = reach(WD.links[c.li]) ? null : ['Too far: it is not on a road that leaves a town of yours.', 'bad'];
      if (c.kind === 'conv') return G.tipHtml('A convoy of prisoners', [['On the road', 'k'], ['Men taken in the raids, roped together and bound for the cells of Fort Santiago, with an escort of about ' + G.fmt(g) + '.'], ['+' + convMen() + ' men will join you if you free them', 'good'], far || ['Click to fall on the escort. It will not be on the road for long.']]);
      return G.tipHtml('A Spanish column', [['On the road', 'k'], ['About ' + G.fmt(g) + ' men on the march between two garrisons.'], ['Their rifles and their pay chest are worth having.', 'good'], far || ['Click to ambush it.']]);
    };
  }
  function convMen() { var l = Math.min(WD.towns.length, front()); return Math.round(WD.JOIN * Math.pow(WD.JOIN_GROW, l - 1) * WD.CONVOY_MEN); }
  // near: it must be within reach, on a road out of one of your towns (the first column always is, and so is every convoy).
  function spawnCol(kind, size, slot, near) {
    var ok = []; WD.links.forEach(function (l, j) { if ((near ? reach(l) : held(l)) && l.total > 6) ok.push(j); });
    if (!ok.length) return;
    var c = { kind: kind, size: size, slot: slot, near: near, li: ok[Math.floor(Math.random() * ok.length)], dir: Math.random() < 0.5 ? 1 : -1, life: kind === 'conv' ? 55 : 1e9, face: 1 };
    c.d = (0.2 + Math.random() * 0.6) * WD.links[c.li].total; var p0 = along(WD.links[c.li], c.d); c.x = p0[0]; c.y = p0[1];
    c.el = document.createElement('button'); c.el.className = 'wcol ' + kind; c.el.innerHTML = I(kind === 'conv' ? 'chain' : 'guardia');
    c.el.onclick = function () { c.el.blur(); if (G.now() !== 'warMap' || anim || swap) return; if (reach(WD.links[c.li])) askCol(c); else G.sfx.no(); };
    G.tip(c.el, colTip(c)); $('warMarks').appendChild(c.el); cols.push(c);
  }
  function dropCol(c) { var i = cols.indexOf(c); if (i >= 0) cols.splice(i, 1); c.el.remove(); }
  function near(x, y) { var best = null, bd = 1e9; WD.towns.forEach(function (t) { var d = Math.hypot(t.x - x, t.y - y); if (d < bd) { bd = d; best = t; } }); return best; }
  function tickMap(dt) {
    if (w().won) { cols.slice().forEach(dropCol); return; }
    for (var i = cols.length - 1; i >= 0; i--) {
      var c = cols[i], l = WD.links[c.li]; c.life -= dt;
      if (c.life <= 0 || !held(l) || (c.near && !reach(l))) { dropCol(c); continue; } // its road has been freed under it
      c.d += WD.COL_SPEED * dt * c.dir * (c.kind === 'conv' ? 0.7 : 1);
      if (c.d < 0 || c.d > l.total) { // at a town: take another road out of it
        var at = c.d < 0 ? l.a : l.b, next = []; WD.links.forEach(function (q, j) { if (j !== c.li && (q.a === at || q.b === at) && (c.near ? reach(q) : held(q))) next.push(j); });
        if (!next.length) { c.dir = -c.dir; c.d = clamp(c.d, 0, l.total); }
        else { c.li = next[Math.floor(Math.random() * next.length)]; l = WD.links[c.li]; c.dir = l.a === at ? 1 : -1; c.d = l.a === at ? 0 : l.total; }
      }
      var p = along(WD.links[c.li], c.d); if (Math.abs(p[0] - c.x) > 0.001) c.face = p[0] > c.x ? 1 : -1; c.x = p[0]; c.y = p[1];
    }
    WD.COLS.forEach(function (size, slot) { // there is always something on the roads to fall on, and always one of them within reach
      if (cols.some(function (c) { return c.slot === slot; })) return;
      colT[slot] -= dt; if (colT[slot] <= 0) { colT[slot] = 5 + Math.random() * 6; spawnCol('col', size, slot, slot === 0); }
    });
    if (!cols.some(function (c) { return c.kind === 'conv'; })) { convT -= dt; if (convT <= 0) { convT = WD.CONVOY_EVERY * (0.8 + Math.random() * 0.4); spawnCol('conv', WD.CONVOY_SIZE, -1, true); } }
  }
  function place(el, p) { var tr = 'translate(' + Math.round(p[0]) + 'px,' + Math.round(p[1]) + 'px)'; if (el._tr !== tr) { el._tr = tr; el.style.transform = tr; } }
  function marks() { // the lettering over the map. Towns and names are moved only when the view has moved; only the columns move by themselves.
    if (!w() || !MV.stage) return;
    var close = cam.v < whole() * 0.2, far = cam.v > whole() * 0.62, key = close + '|' + far + '|' + freed() + '|' + w().fights, box = $('warMarks'), ck = cam.x.toFixed(2) + '|' + cam.z.toFixed(2) + '|' + cam.v.toFixed(3) + '|' + window.innerWidth + '|' + window.innerHeight;
    if (key !== markKey) {
      markKey = key; box.classList.toggle('far', far); box.classList.toggle('close', close);
      WD.towns.forEach(function (t) {
        var el = townEls[t.id], own = owns(t.id), cls = 'wtown ' + (own ? 'own' : open(t) ? 'open' : 'locked') + (t.boss ? ' boss' : '') + (t.left ? ' lt' : '') + (t.prov === 'manila' && !close ? ' gone' : '');
        if (el.className !== cls) el.className = cls;
      });
      var left = provLeft('manila'), mc = 'wtown boss manila ' + (!left ? 'own' : wallDown() ? 'open' : 'locked') + (close ? ' gone' : '');
      if (manilaEl.className !== mc) manilaEl.className = mc;
      names.forEach(function (n) { if (n.prov) n.el.classList.toggle('free', !provLeft(n.prov)); });
    }
    if (ck !== camKey) {
      camKey = ck;
      WD.towns.forEach(function (t) { place(townEls[t.id], MV.screen(t.x, t.y, t.gy)); });
      var m = manilaAt(); place(manilaEl, MV.screen(m[0] - 1, m[1], 0)); place(homeEl, MV.screen(WD.HOME.x, WD.HOME.y, WD.HOME.gy));
      names.forEach(function (n) { place(n.el, MV.screen(n.x, n.y, 0)); });
    }
    cols.forEach(function (c) { var ok = reach(WD.links[c.li]); if (c.ok !== ok) { c.ok = ok; c.el.classList.toggle('far', !ok); } place(c.el, MV.screen(c.x, c.y, MV.h(c.x, c.y) + 7.5)); });
    MV.setCols(cols.map(function (c) { return { x: c.x, z: c.y, kind: c.kind, dir: c.face, ok: c.ok }; }));
  }

  // ---------- the flow: the map, a battle, its evening ----------
  function fall(e, b) {
    VW.battle.puff(e.x, e.y);
    if (b >= 1) { var p = VW.battle.screen(e.x, e.y, 1.9); G.floater('+' + G.fmt(b), p[0] - 10, p[1] - 10, 'gold'); }
    if (e.k === 'jefe') { G.toast(cap(WD.provinces[townBy[B.spec.town].prov].jefe) + ' is down'); G.sfx.win(); } else G.tone(e.side ? 240 + Math.random() * 120 : 130, 0.05, 0.03, 'square');
  }
  function askTown(t) {
    var p = WD.provinces[t.prov], g = garrison(t.lvl);
    G.ask('Battle of ' + t.name, 'A garrison of about ' + G.fmt(g) + (t.boss ? ', under ' + p.jefe : '') + '. You have ' + G.fmt(w().men) + ' men.\nIf the day goes badly they fall back and nothing is lost but the day: whatever fell on the field is yours.', 'Attack', 'Not yet',
      function () { fight({ type: 'town', town: t.id, lvl: t.lvl, size: 1, boss: !!t.boss, name: 'Battle of ' + t.name, x: t.x, y: t.y, seed: t.lvl }); });
  }
  function askCol(c) {
    var l = front(), t = near(c.x, c.y), g = garrison(l, c.size), conv = c.kind === 'conv';
    G.ask(conv ? 'A convoy of prisoners' : 'A Spanish column', (conv ? 'About ' + G.fmt(g) + ' men escort a string of prisoners along the road near ' + t.name + '. Free them, and ' + convMen() + ' more will march with you.' : 'About ' + G.fmt(g) + ' men are on the road near ' + t.name + '. Fall on them and take what they carry.') + '\nYou have ' + G.fmt(w().men) + ' men.', conv ? 'Free them' : 'Ambush', 'Let them pass',
      function () { fight({ type: c.kind, lvl: l, size: c.size, men: convMen(), name: (conv ? 'Rescue near ' : 'Skirmish near ') + t.name, x: c.x, y: c.y, col: c, seed: 100 + Math.floor(c.x * 7 + c.y * 13) }); });
  }
  function fight(spec) {
    G.sfx.hit();
    fly(spec.x, spec.y, whole() * 0.12, 0.7, function () { over(function () { startBattle(spec); }); });
  }
  function startBattle(spec) {
    B = newBattle(spec); VW.battle.build(spec, spec.seed || 1); VW.battle.show(); G.phase('battle'); W.ringBell(); G.sfx.bell(); barKey = '';
  }
  function after() { // the evening of a battle
    var sp = B.spec, s = w(), t = sp.type === 'town' ? townBy[sp.town] : null, rows = [['guardia', G.fmt(B.kills), 'of theirs brought down'], ['coin', '+' + G.fmt(B.earn + B.purse), 'salapi']], title, text;
    if (sp.col && B.won) dropCol(sp.col);
    if (B.won && t) VW.battle.won();
    G.save(); G.phase('event'); W.ringBell();
    if (B.join) rows.push(['fili', '+' + G.fmt(B.join), sp.type === 'conv' ? 'prisoners freed, who take up arms' : 'men of ' + t.name + ' join you', 'gold']);
    if (!B.won) {
      G.sfx.hit(); title = t ? 'Beaten back at ' + t.name : sp.type === 'conv' ? 'The convoy gets through' : 'The column gets away';
      text = (B.mine ? 'The day runs out and the bugles call them off: the ' + (t ? 'garrison still holds the town.' : 'enemy is still on his feet.') : 'The line breaks, and the men scatter into the cane to gather again by night.') + ' Nobody is lost for good, and what fell on the field is yours. Better arms, more men, and back again.';
      G.dusk(title, text, rows, 'Back to the map', back); return;
    }
    G.sfx.win();
    if (s.won) { G.dusk('The Philippines is free', WD.victory, rows.concat([['sun', S().day - 1, 'days, from the first stone of the school']]), 'Look at the map', back); return; }
    if (t) {
      var p = WD.provinces[t.prov], left = provLeft(t.prov), wall = t.prov !== 'manila' && wallDown();
      title = t.name + ' is free';
      text = wall ? WD.wall : t.boss ? cap(p.jefe) + ' gives up his sword in the plaza, and the red and gold comes down from the casa real. ' + (left ? left + (left === 1 ? ' town' : ' towns') + ' of ' + p.name + ' still fly it.' : 'All ' + p.name + ' is free.')
        : 'The garrison is gone and the flag of the sun and three stars goes up over the tribunal. ' + (left ? left + (left === 1 ? ' town' : ' towns') + ' of ' + p.name + ' still to free.' : 'All ' + p.name + ' is free.');
      if (wall) title = 'The wall of Manila is breached';
    } else if (sp.type === 'conv') { title = 'The prisoners are free'; text = 'The ropes are cut on the road. Most of them ask for a bolo before they ask for water.'; }
    else { title = 'The column is scattered'; text = 'They leave their rifles, their boots and the regimental chest. There will be another along soon enough.'; }
    G.dusk(title, text, rows, 'Back to the map', back);
  }
  function back() {
    var was = B; G.hide('dusk');
    over(function () {
      showMap();
      if (w().won) home();
      else if (was && was.spec.type === 'town' && was.won && townBy[was.spec.town].prov !== 'manila' && wallDown()) { var m = manilaAt(); fly(m[0], m[1], whole() * 0.1, 1.6); } // the wall has just come down: look
    });
  }
  function tick(dt) {
    if (!w() || swap || lift) return;
    var ph = G.now();
    if (ph === 'battle' && B) step(dt); else if (ph === 'warMap') tickMap(dt);
  }
  function draw(dt) { // every frame: whatever is in motion on the screen that is not the rules
    if (!on) { if (fade.shown !== 0 && fade.el) { fade.shown = 0; fade.el.style.opacity = 0; } return; }
    clock += dt;
    if (lift) { // the eye rises over San Diego, into the cloud, and comes down again over the whole south of Luzon
      lift.t += dt; var q = Math.min(1, lift.t / 1.7); W.setLift(1 + 4.5 * q * q); fade.a = fade.to = clamp((q - 0.55) / 0.45, 0, 1);
      if (q >= 1) {
        lift = null; W.setLift(1); for (var i = 0; i < 4; i++) W.zoom(1);
        MV.show(); cam.x = WD.HOME.x; cam.z = WD.HOME.y; cam.v = whole() / 11; MV.bound(true); G.phase('warMap'); sync(); fade.to = 0;
        fly(C.W / 2, C.H / 2, whole(), 4.2, function () { G.toast('The south of Luzon'); });
      }
    }
    if (swap && fade.a >= 0.999) { var fn = swap; swap = null; fade.to = 0; fn(); }
    if (fade.a !== fade.to) fade.a = fade.a < fade.to ? Math.min(fade.to, fade.a + dt * 4.5) : Math.max(fade.to, fade.a - dt * (anim ? 1.2 : 3.5));
    if (fade.shown !== fade.a) { fade.shown = fade.a; fade.el.style.opacity = fade.a; }
    if (anim) {
      anim.t += dt; var k = Math.min(1, anim.t / anim.dur), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2, la = Math.log(anim.av), lb = Math.log(anim.bv);
      cam.v = Math.exp(la + (lb - la) * e);
      var r = Math.abs(anim.av - anim.bv) < 1e-6 ? e : (cam.v - anim.av) / (anim.bv - anim.av); // the place looked at moves with the scale, so a point of the map holds still under the eye
      cam.x = anim.ax + (anim.bx - anim.ax) * r; cam.z = anim.az + (anim.bz - anim.az) * r; MV.bound(true);
      if (k >= 1) { var done = anim.done; anim = null; MV.bound(); barKey = ''; if (done) done(); }
    }
    var ph = G.now();
    if (B && (ph === 'battle' || ph === 'event')) VW.battle.sync(B, clock);
    else if (W.showing() === MV.stage && MV.stage) marks();
  }

  // ---------- the tree of the revolution ----------
  var CELL = 116, NODE = 68, NS = 'http://www.w3.org/2000/svg', nodeEls = {}, edges = [];
  function state(u) { return lv(u.id) >= u.max ? 'maxed' : met(u) ? 'open' : 'locked'; }
  function buyable(u) { return state(u) === 'open' && w().cash >= cost(u); }
  function buy(u, many) {
    var n = 0;
    do { if (!buyable(u)) break; w().cash -= cost(u); w().up[u.id] = lv(u.id) + 1; n++; } while (many);
    if (!n) { if (!botting) G.sfx.no(); return; }
    if (botting) return;
    G.sfx.buy(); G.save(); drawTree();
    nodeEls[u.id].classList.remove('pop'); void nodeEls[u.id].offsetWidth; nodeEls[u.id].classList.add('pop');
  }
  function nodeTip(u) {
    var l = lv(u.id), st = state(u), lines = [[WD.branches[u.branch], 'k'], [u.desc]], r;
    if (st === 'locked') { for (r in u.req) if (lv(r) < u.req[r]) lines.push([I('lock') + upBy[r].name + ' ' + u.req[r], 'bad']); return G.tipHtml(u.name, lines); }
    if (st === 'maxed') { lines.push([u.show(u.val(l)), 'good'], [I('star'), 'c']); return G.tipHtml(u.name, lines); }
    lines.push([(l || u.id === 'fusil' ? u.show(u.val(l)) + ' → ' : '') + u.show(u.val(l + 1)), 'good'], [coins(cost(u), w().cash >= cost(u)), 'c']);
    return G.tipHtml(u.name + ' <i>' + l + '/' + u.max + '</i>', lines);
  }
  function buildTree() {
    var ov = document.createElement('div'); ov.id = 'tree3'; ov.className = 'overlay';
    ov.innerHTML = '<div id="tree3World"><svg id="tree3Edges" width="1" height="1"></svg></div><div id="tree3Bar"><button id="warBack" class="tbtn go"><span>' + I('flagPh') + '</span><b>Back to the map</b></button></div>';
    document.body.insertBefore(ov, $('ask'));
    var world = $('tree3World'), svg = $('tree3Edges');
    WD.upgrades.forEach(function (u) {
      for (var r in u.req) { var p = upBy[r], ln = document.createElementNS(NS, 'line'); ln.setAttribute('x1', p.x * CELL); ln.setAttribute('y1', p.y * CELL); ln.setAttribute('x2', u.x * CELL); ln.setAttribute('y2', u.y * CELL); svg.appendChild(ln); edges.push({ el: ln, to: u }); }
    });
    WD.upgrades.forEach(function (u) {
      var b = document.createElement('button');
      b.style.left = (u.x * CELL - NODE / 2) + 'px'; b.style.top = (u.y * CELL - NODE / 2) + 'px';
      b.innerHTML = '<span class="nic">' + I(u.icon) + '</span><span class="lv"></span><span class="lk">' + I('lock') + '</span><span class="pr"></span>';
      G.tip(b, function () { return w() ? nodeTip(u) : ''; });
      b.onclick = function (e) { buy(u, e.shiftKey); b.blur(); };
      world.appendChild(b); nodeEls[u.id] = b;
    });
    $('warBack').onclick = closeTree;
    G.tip($('warBack'), function () { return G.tipHtml('Back to the map', [['Salapi buys better arms, never more men: those join you in the towns you free, and on the roads when you free prisoners.'], ['Enter, or Esc']]); });
    window.addEventListener('resize', fitTree);
  }
  function fitTree() {
    var z = Math.max(0.4, Math.min(1, window.innerWidth / 1130, (window.innerHeight - 250) / 600));
    $('tree3World').style.transform = 'translate(' + (window.innerWidth / 2) + 'px,' + (122 + (window.innerHeight - 250) / 2) + 'px) scale(' + z + ')';
  }
  function drawTree() {
    WD.upgrades.forEach(function (u) {
      var b = nodeEls[u.id], st = state(u), l = lv(u.id);
      b.className = 'node s-' + u.branch + ' ' + st + (l > 0 ? ' owned' : '') + (buyable(u) ? ' can' : '');
      b.children[1].textContent = st === 'maxed' ? '★' : l > 0 ? l : '';
      b.children[3].innerHTML = st === 'open' ? coins(cost(u), w().cash >= cost(u)) : '';
    });
    edges.forEach(function (e) { e.el.setAttribute('class', state(e.to) === 'locked' ? 'dim' : 'on'); });
    fitTree(); G.drawTip();
  }
  function openTree() { if (G.now() !== 'warMap' || anim || swap) return; G.phase('warTree'); drawTree(); $('tree3').classList.add('show'); }
  function closeTree() { if (G.now() !== 'warTree') return; $('tree3').classList.remove('show'); G.save(); G.phase('warMap'); }

  // ---------- the bar under the map and under the field ----------
  var barKey = '', btn = {};
  function tbtn(row, id, icon, text, fn, tipFn) {
    var b = document.createElement('button'); b.className = 'tbtn'; b.innerHTML = '<span>' + I(icon) + '</span><b>' + text + '</b><i></i>';
    b.onclick = function () { b.blur(); fn(); }; if (tipFn) G.tip(b, tipFn); row.appendChild(b); btn[id] = b; return b;
  }
  function buildBar() {
    var bar = document.createElement('div'); bar.id = 'warBar'; bar.innerHTML = '<p id="warHint"></p><div id="warRow" class="map"></div><div id="warRow2" class="fight"></div>';
    document.body.insertBefore(bar, $('controls'));
    tbtn($('warRow'), 'tree', 'rifle', 'The armoury', openTree, function () { return G.tipHtml('The armoury', [['Spend salapi on the tree of the revolution: bolos, rifles, guns, the camp, the Katipunan.'], w() && WD.upgrades.some(buyable) ? ['There is something you can afford.', 'good'] : null]); });
    tbtn($('warRow2'), 'charge', 'rush', 'Sugod!', function () { if (doCharge()) { G.sfx.win(); G.toast('Sugod!'); } else G.sfx.no(); }, function () { return G.tipHtml('Sugod!', [['For ' + val('sugod') + ' seconds the bolo men run and strike half as hard again.'], ['Z']]); });
    tbtn($('warRow2'), 'volley', 'flame', 'Volley', function () { if (doVolley()) G.sfx.hit(); else G.sfx.no(); }, function () { return G.tipHtml('Volley', [['Every rifleman with an enemy in reach fires at once, for ' + val('descarga') + ' shots each.'], ['X']]); });
    tbtn($('warRow2'), 'horn', 'shell', 'Tambuli', function () { if (doHorn()) { G.sfx.bell(); G.toast('The tambuli sounds'); } else G.sfx.no(); }, function () { return G.tipHtml('The Tambuli', [['Every company still standing gets back ' + Math.round(val('tambuli') * 100) + '% of its strength.'], ['C']]); });
    tbtn($('warRow2'), 'flee', 'bell', 'Fall back', function () { if (B && !B.over) G.ask('Fall back', 'Call the men off? The day is lost, but what has fallen on the field is yours.', 'Fall back', 'Fight on', function () { if (B && !B.over) end(false); }); }, function () { return G.tipHtml('Fall back', [['Give the day up. Nobody is lost for good.']]); });
    var list = document.createElement('div'); list.id = 'warList'; $('chipDay').appendChild(list);
    G.tip(list, function () { return w() ? tipOf('stage') : ''; });
  }
  function cdText(b, t, has) { b.style.display = has ? '' : 'none'; b.disabled = t > 0; b.lastChild.textContent = t > 0 ? Math.ceil(t) : ''; }
  function drawBar() {
    var ph = G.now(), cd = function (t) { return t > 0 ? Math.ceil(t) : 0; }, key = ph + '|' + (B ? cd(B.chargeCd) + '|' + cd(B.volleyCd) + '|' + cd(B.hornCd) + '|' + B.over + '|' + (B.t > 7) : '') + '|' + (w().up.sugod || 0) + (w().up.descarga || 0) + (w().up.tambuli || 0) + '|' + (ph === 'warMap' && WD.upgrades.some(buyable)) + '|' + freed();
    if (key === barKey) return; barKey = key;
    var hint = '';
    if (ph === 'battle' && B) {
      cdText(btn.charge, B.chargeCd, lv('sugod')); cdText(btn.volley, B.volleyCd, lv('descarga')); cdText(btn.horn, B.hornCd, lv('tambuli'));
      if (B.t <= 7) hint = lv('sugod') || lv('descarga') || lv('tambuli') ? 'Your men pick their own fights. Give the word when it counts.' : 'Your men pick their own fights. The armoury will give you words of command.';
    } else if (ph === 'warMap') {
      btn.tree.classList.toggle('go', WD.upgrades.some(buyable));
      hint = w().won ? 'Every flag on the map is yours.' : !freed() ? 'Click a town under a Spanish flag to attack it. Start with the ones nearest San Diego.' : freed() < 3 ? 'Columns on the roads out of your towns can be ambushed for salapi. Spend it in the armoury.' : '';
    }
    $('warHint').textContent = hint;
    $('warList').innerHTML = PROVS.concat(['manila']).map(function (p) { var n = provLeft(p), all = p === 'manila' ? 5 : 4; return '<div class="' + (n ? '' : 'done') + (p === 'manila' && !wallDown() ? ' shut' : '') + '">' + I(n ? 'flagEs' : 'flagPh') + '<b>' + WD.provinces[p].name + '</b><span>' + (all - n) + ' / ' + all + '</span></div>'; }).join('');
  }

  // ---------- HUD ----------
  function hud() {
    var s = w(), ph = G.now(), P2 = G.put2, fightOn = !!B && (ph === 'battle' || ph === 'event');
    if (!on) { wake(); if (s.seen && !B && !lift) mapUp(); }
    P2($('hudDay'), G.fmt(s.men) + ' men'); P2($('hudPesos'), G.fmt(Math.floor(s.cash)));
    if (fightOn) {
      P2($('hudStage'), B.spec.name); G.wide($('barStage'), Math.max(0, B.hpNow / B.hp0 * 100));
      P2($('hudStep'), B.over ? (B.won ? 'won' : 'lost') : B.foes + (B.foes === 1 ? ' company' : ' companies') + ' of theirs · ' + B.mine + ' of yours');
      G.wide($('barTime'), Math.min(1, B.t / WD.T) * 100);
    } else {
      P2($('hudStage'), s.won ? 'The Philippines is free' : 'The Revolution'); G.wide($('barStage'), freed() / WD.towns.length * 100);
      P2($('hudStep'), freed() + ' of ' + WD.towns.length + ' towns free'); G.wide($('barTime'), 0);
    }
    drawBar();
  }
  function off() { // no revolution on the screen (a new game, the earlier parts): put the map away
    quiet();
    if (VW && W.showing()) VW.hide();
  }
  function tipOf(what) {
    var s = w();
    if (what === 'day') return G.tipHtml(G.fmt(s.men) + ' freedom fighters', [['Money cannot buy men. They join you in each town you free, and on the roads when you free a convoy of prisoners.'], ['About ' + Math.round(val('fusil') * 100) + '% carry a rifle; the rest carry a bolo.', 'k2'],
      B && !B.over ? ['The bugles call them off in ' + Math.ceil(WD.T - B.t) + ' seconds.', 'bad'] : ['A battle lasts ' + WD.T + ' seconds at the most.']]);
    if (what === 'pesos') return G.tipHtml('Salapi', [['The money of the revolution: every enemy brought down leaves something worth having, and every town has a chest. Spend it in the armoury.']]);
    var lines = [[freed() + ' of ' + WD.towns.length + ' towns are free.']];
    PROVS.concat(['manila']).forEach(function (p) { var n = provLeft(p); lines.push([WD.provinces[p].name + ': ' + (n ? n + ' still held' : 'free'), n ? 'd' : 'good']); });
    if (!wallDown()) lines.push(['Manila stands behind its wall until the five provinces are free. Intramuros falls last.', 'k2']);
    return G.tipHtml('The Revolution', lines);
  }

  // ---------- a robot, to measure how long the revolution takes: index.html?wbot=1 ----------
  function botFight(spec) {
    B = newBattle(spec); var g = 0, acc = 0;
    while (!B.over && g++ < 4000) {
      acc -= 0.05;
      if (acc <= 0) { // twice a second it gives whatever word it can; it sounds the horn once the line is half gone
        acc = 0.5; var hpN = 0, hpM = 0, close = false; B.units.forEach(function (u) { if (u.side || u.hp <= 0) return; hpN += u.hp; hpM += u.max; if (u.d.melee && u.tg && Math.hypot(u.tg.x - u.x, u.tg.y - u.y) < 6) close = true; });
        if (close) doCharge(); doVolley(); if (hpN < hpM * 0.6) doHorn();
      }
      step(0.05);
    }
    return B;
  }
  function botBuy() { for (var g = 0; g < 900; g++) { var best = null; WD.upgrades.forEach(function (u) { if (buyable(u) && (!best || cost(u) < cost(best))) best = u; }); if (!best) break; buy(best); } }
  function share() { var a = 0, b = 0; WD.upgrades.forEach(function (u) { a += lv(u.id); b += u.max; }); return Math.round(a / b * 100); }
  function bot(times) {
    botting = true; var out = [];
    for (var n = 0; n < times; n++) {
      var s0 = G.fresh(); s0.finished = true; s0.sg = { f: 100, up: { recluta: 10 } }; G.put(s0); begin();
      var fights = 0, secs = 0, log = [], tries = {}, lostAt = -1, skirm = 0, guard = 0, atWall = '';
      while (!w().won && guard++ < 1500) {
        botBuy();
        var tg = null; WD.towns.forEach(function (t) { if (open(t) && (!tg || t.lvl < tg.lvl)) tg = t; });
        var r;
        if (tg && (lostAt !== tg.lvl || skirm >= 2)) {
          r = botFight({ type: 'town', town: tg.id, lvl: tg.lvl, size: 1, boss: !!tg.boss }); tries[tg.id] = (tries[tg.id] || 0) + 1; skirm = 0;
          if (r.won) { log.push(tg.id + ':' + tries[tg.id] + 'x ' + Math.round(r.t) + 's men' + w().men + ' left' + r.mine + ' tree' + share() + '% f' + fights); lostAt = -1; if (!atWall && wallDown()) atWall = 'atWall: tree ' + share() + '% fights ' + fights; } else lostAt = tg.lvl;
        } else { r = botFight(skirm % 2 ? { type: 'conv', lvl: front(), size: WD.CONVOY_SIZE, men: convMen() } : { type: 'col', lvl: front(), size: WD.COLS[1] }); skirm++; }
        fights++; secs += r.t;
      }
      var lvl = []; WD.upgrades.forEach(function (u) { lvl.push(u.id + ':' + lv(u.id) + '/' + u.max); });
      out.push('WBOT fights=' + fights + ' fightMinutes=' + (secs / 60).toFixed(1) + ' withMap~' + Math.round((secs + fights * 25) / 60) + ' men=' + w().men + ' cash=' + Math.round(w().cash) + ' won=' + w().won + ' tree=' + share() + '% ' + atWall);
      out.push('WBOT ' + lvl.join(' ')); out.push('WBOT ' + log.join(' | '));
    }
    botting = false; B = null; G.put(G.fresh());
    out.forEach(function (l) { console.log(l); });
    return out;
  }

  // Debug: index.html?auto=war jumps into the revolution. wn=7 frees the seven weakest towns, wup=3 sets every bonus to level 3, wc=500 the salapi,
  // wm=900 the men, wv=intro shows the opening words, wv=unzoom the pull back from the village (wf seconds into it), wv=tree the tree, wv=fight a battle
  // (town=imus, or col=1 / conv=1) and runs wf seconds of it, wv=won its last moment; wz=3&wat=14.59,120.98 looks closer at a place; wv=whole shows all of the map, wv=title the title over it.
  function debug(q) {
    var s0 = S(); s0.finished = true; s0.sg = s0.sg || { f: 100, up: { recluta: 10 }, towers: [], since: 0, boss: 5, wave: 30, houses: 20, won: true };
    botting = true; begin(); botting = false;
    var s = w(), v = q.get('wv'), i; s.seen = v !== 'intro';
    WD.towns.forEach(function (t) { if (t.lvl <= (+q.get('wn') || 0)) { s.own[t.id] = 1; s.at = [t.x, t.y]; } });
    if (q.get('wup')) WD.upgrades.forEach(function (u) { s.up[u.id] = Math.min(u.max, +q.get('wup')); });
    s.cash = +q.get('wc') || 0; if (q.get('wm')) s.men = +q.get('wm');
    if (v === 'title') return; // the title, with the map behind it
    if (v === 'intro') { enter(); return; }
    if (v === 'unzoom') { showMap('unzoom'); for (i = 0; i < (+q.get('wf') || 0) * 30; i++) { draw(1 / 30); } return; }
    showMap();
    if (v === 'whole') { cam.x = C.W / 2; cam.z = C.H / 2; cam.v = whole(); MV.bound(); barKey = ''; }
    if (q.get('wz')) { var at = (q.get('wat') || '14.3,121').split(','); cam.v = whole() / +q.get('wz'); cam.x = mx(+at[1]); cam.z = my(+at[0]); MV.bound(); }
    for (i = 0; i < 300; i++) tickMap(0.1);
    if (v === 'tree') openTree();
    if (v === 'fight' || v === 'won') {
      var t = townBy[q.get('town') || 'binan'], spec = q.get('col') ? { type: 'col', lvl: front(), size: WD.COLS[2], name: 'Skirmish near ' + t.name, seed: +q.get('col') + 100 } : q.get('conv') ? { type: 'conv', lvl: front(), size: WD.CONVOY_SIZE, men: convMen(), name: 'Rescue near ' + t.name, seed: +q.get('conv') + 100 } :
        { type: 'town', town: t.id, lvl: t.lvl, size: 1, boss: !!t.boss, name: 'Battle of ' + t.name, seed: t.lvl };
      startBattle(spec);
      for (i = 0; i < (+q.get('wf') || 0) * 20 && !B.over; i++) step(0.05);
      if (v === 'won' && !B.over) { B.units.forEach(function (u) { if (u.side) u.hp = 0; }); B.foes = 0; end(true); }
    }
  }
  // Debug mode: the eve of the battle for capital i (every weaker town already free), or the very start (i < 0).
  function jump(i) {
    var s = S(); quiet();
    var caps = WD.towns.filter(function (t) { return t.boss; }), keep = s.war ? s.war.up : {}, cash = s.war ? s.war.cash : 0;
    botting = true; begin(); botting = false; s.war.up = keep; s.war.cash = cash;
    if (i < 0) return; // the very start: no town taken yet, and the farewell to San Diego still to come
    s.war.seen = true;
    WD.towns.forEach(function (t) { if (t.lvl < caps[i].lvl) { s.war.own[t.id] = 1; s.war.men += joiners(t); s.war.at = [t.x, t.y]; } });
  }
  function esc() { if (!on) return false; if (G.now() === 'warTree') { closeTree(); return true; } return false; }

  function init(api) {
    G = api;
    var cv = $('scene');
    buildMarks(); buildTree(); buildBar();
    var drag = null, mapOn = function () { return on && G.now() === 'warMap' && !anim && !swap && !lift && W.showing() === MV.stage; };
    cv.addEventListener('pointerdown', function (e) { if (e.button === 0 && on) drag = { x: e.clientX, y: e.clientY, far: 0 }; });
    window.addEventListener('pointermove', function (e) {
      if (!drag || !mapOn()) return;
      var a = MV.pick(drag.x, drag.y), b = MV.pick(e.clientX, e.clientY); drag.far += Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y); drag.x = e.clientX; drag.y = e.clientY;
      if (drag.far > 6) { cam.x += a[0] - b[0]; cam.z += a[1] - b[1]; MV.bound(); cv.classList.add('grab'); barKey = ''; }
    });
    var drop = function () { drag = null; if (on) cv.classList.remove('grab'); };
    window.addEventListener('pointerup', drop); window.addEventListener('pointercancel', drop);
    var wheel = function (e) {
      if (!on) return; e.preventDefault();
      if (!mapOn()) return;
      var a = MV.pick(e.clientX, e.clientY); cam.v *= Math.exp(e.deltaY * 0.0015); MV.bound();
      var b = MV.pick(e.clientX, e.clientY); cam.x += a[0] - b[0]; cam.z += a[1] - b[1]; MV.bound(); barKey = ''; // the place under the pointer stays under it
    };
    cv.addEventListener('wheel', wheel, { passive: false }); $('warMarks').addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keydown', function (e) {
      if (!on || document.body.classList.contains('paused') || $('ask').classList.contains('show')) return;
      var ph = G.now();
      if (ph === 'warTree' && e.code === 'Enter') closeTree();
      else if (ph === 'battle' && B) { if (e.code === 'KeyZ') btn.charge.click(); else if (e.code === 'KeyX') btn.volley.click(); else if (e.code === 'KeyC') btn.horn.click(); }
    });
  }

  // setApi: for running the robot outside a page (node), where init has nothing to build.
  Noli.War = { init: init, setApi: function (api) { G = api; }, enter: enter, hud: hud, off: off, backdrop: backdrop, active: function () { return on; }, tick: tick, draw: draw, tipOf: tipOf, bot: bot, debug: debug, jump: jump, esc: esc,
    capitals: function () { return WD.towns.filter(function (t) { return t.boss; }); } };
})();
