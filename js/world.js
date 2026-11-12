// Noli — the HD-2D diorama of San Diego: pixel-art sprites and textures in a lit 3D town,
// finished with a tilt-shift blur, bloom and a vignette.
// Geography first: mountains NE, river running NE -> SW into the lake, town on the west bank,
// rice paddies west, Ibarra's wood east of the river, school site in the middle.
// Axes: +x east, +z south, +y up.
(function () {
  var T = THREE, Art = Noli.Art;
  var W = {};
  var renderer, scene, camera, sun, hemi, rt, post;
  var yaw = Math.PI * 0.75, yawTarget = yaw, zoom = 1;
  var TARGET = new T.Vector3(-2.5, 0, -1.5);
  var VIEW = 40;
  var SITE = new T.Vector3(4.2, 0, 4.2);
  var PILE = new T.Vector3(-7, 0, 9.8);
  var CHURCH_DOOR = new T.Vector3(-14, 0, -13.7);
  var school = {}, workers = [], friar, ibarra, bell, boats = [], walkers = [], trees = [];
  var billboards = [], unlit = [], water, winMat, glassMat, glowMat, flies;
  var bellSwing = 0, pulse = 0, clock = 0, friarPos = 0;
  var state = { crew: {}, stop: {}, speed: 1, active: false, susp: 0 };
  var tint = new T.Color(1, 1, 1);

  // Seeded random so the town looks the same every time.
  var seed = 1887;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

  // ---------- Materials ----------
  var mats = {};
  function mat(color) { var k = 'c' + color; return mats[k] || (mats[k] = new T.MeshStandardMaterial({ color: color, roughness: 1, metalness: 0, flatShading: true })); }
  function tmat(name, tintHex) {
    var k = name + (tintHex || '');
    return mats[k] || (mats[k] = new T.MeshStandardMaterial({ map: Art.tile(name), color: tintHex || 0xffffff, roughness: 1, metalness: 0 }));
  }
  function reg(m) { unlit.push(m); return m; }
  function smat(t) { return t._m || (t._m = reg(new T.MeshBasicMaterial({ map: t, alphaTest: 0.5, side: T.DoubleSide }))); }

  // ---------- Geometry helpers ----------
  function add(parent, mesh, x, y, z) {
    mesh.position.set(x || 0, y || 0, z || 0);
    mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  }
  // Tile a box's UVs at world scale so every wall shares one texel density.
  function scaleUV(g, w, h, d, tile, y0) {
    var uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (var f = 0; f < 6; f++) for (var i = 0; i < 4; i++) {
      var k = f * 4 + i, side = f !== 2 && f !== 3;
      uv.setXY(k, uv.getX(k) * dims[f][0] / tile, uv.getY(k) * dims[f][1] / tile + (side ? (y0 || 0) / tile : 0));
    }
  }
  // Plain coloured box whose base sits at y.
  function box(parent, w, h, d, color, x, y, z) {
    var g = new T.BoxGeometry(w, h, d); g.translate(0, h / 2, 0);
    return add(parent, new T.Mesh(g, mat(color)), x, y, z);
  }
  // Textured box whose base sits at y.
  function tbox(parent, w, h, d, name, x, y, z, tintHex, tile) {
    var g = new T.BoxGeometry(w, h, d); scaleUV(g, w, h, d, tile || 2, y); g.translate(0, h / 2, 0);
    return add(parent, new T.Mesh(g, tmat(name, tintHex)), x, y, z);
  }
  function cyl(parent, rt_, rb, h, color, x, y, z, seg) {
    var g = new T.CylinderGeometry(rt_, rb, h, seg || 8); g.translate(0, h / 2, 0);
    return add(parent, new T.Mesh(g, mat(color)), x, y, z);
  }
  // Hip roof with a ridge along the longer side; UVs run along the eaves and up the slope.
  function roofGeo(w, d, h, tile) {
    var sw = w >= d, W_ = sw ? w : d, D_ = sw ? d : w, r = (W_ - D_) / 2, s = Math.sqrt(h * h + D_ * D_ / 4) / tile;
    var A = [-W_ / 2, 0, -D_ / 2], B = [W_ / 2, 0, -D_ / 2], C = [W_ / 2, 0, D_ / 2], D = [-W_ / 2, 0, D_ / 2], R1 = [-r, h, 0], R2 = [r, h, 0];
    var P = [], U = [];
    function tri(a, ua, b, ub, c, uc) { P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); U.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]); }
    var u0 = [0, 0], u1 = [W_ / tile, 0], u2 = [(W_ - D_ / 2) / tile, s], u3 = [D_ / 2 / tile, s], e1 = [D_ / tile, 0], e2 = [D_ / 2 / tile, s];
    tri(D, u0, C, u1, R2, u2); tri(D, u0, R2, u2, R1, u3);
    tri(B, u0, A, u1, R1, u2); tri(B, u0, R1, u2, R2, u3);
    tri(C, u0, B, e1, R2, e2); tri(A, u0, D, e1, R1, e2);
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(U, 2));
    if (!sw) g.rotateY(Math.PI / 2);
    g.computeVertexNormals(); return g;
  }
  function roof(parent, w, d, h, name, x, y, z, tintHex) {
    var m = add(parent, new T.Mesh(roofGeo(w, d, h, 2), tmat(name, tintHex)), x, y, z);
    m.material.side = T.DoubleSide; return m;
  }
  // Flat upright panel (door, window) just proud of a wall. ry: 0 faces south, PI/2 east, -PI/2 west, PI north.
  function quad(parent, w, h, material, x, y, z, ry) {
    var g = new T.PlaneGeometry(w, h); g.translate(0, h / 2, 0);
    var m = new T.Mesh(g, material); m.position.set(x, y, z); m.rotation.y = ry || 0; m.receiveShadow = true;
    parent.add(m); return m;
  }
  function beam(parent, a, b, r, color) {
    var dir = new T.Vector3().subVectors(b, a), len = dir.length();
    var m = new T.Mesh(new T.CylinderGeometry(r, r, len, 6), mat(color));
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize());
    m.castShadow = true; parent.add(m); return m;
  }
  function cross(parent, h, color, x, y, z) {
    var g = new T.Group(); g.position.set(x, y, z); parent.add(g);
    box(g, h * 0.14, h, h * 0.14, color, 0, 0, 0);
    box(g, h * 0.6, h * 0.14, h * 0.14, color, 0, h * 0.6, 0);
    return g;
  }

  // ---------- Sprites ----------
  var blobMat = new T.MeshBasicMaterial({ color: 0x10142a, transparent: true, opacity: 0.3, depthWrite: false });
  // Upright billboard that turns to face the camera. upp = world units per pixel. Parent must be unrotated.
  function bb(parent, texture, x, y, z, upp, shadowR) {
    var w = texture.image.width * upp, h = texture.image.height * upp * 1.12;
    var g = new T.PlaneGeometry(w, h); g.translate(0, h / 2, 0);
    var m = new T.Mesh(g, smat(texture)), holder = new T.Group();
    holder.position.set(x, y, z); holder.add(m); holder.userData.m = m; holder.userData.dyn = true;
    if (shadowR) {
      var sg = new T.CircleGeometry(shadowR, 14); sg.rotateX(-Math.PI / 2);
      var sh = new T.Mesh(sg, blobMat); sh.position.y = 0.03; sh.scale.z = 0.6; holder.add(sh);
    }
    parent.add(holder); billboards.push(m); return holder;
  }
  var PX = 1 / 18;
  function figure(parent, def, x, z, scale) {
    var frames = Art.person(def), h = bb(parent, frames[2], x, 0, z, PX * (scale || 1), 0.32 * (scale || 1));
    h.userData.frames = frames; return h;
  }
  function setFrame(h, walking, phase) {
    var f = h.userData.frames, i = walking ? [0, 2, 1, 2][Math.floor(clock * 8 + (phase || 0)) % 4] : 2;
    h.userData.m.material = smat(f[i]);
  }
  function plant(kind, v, x, z, s, parent) {
    var t = Art.plant(kind, v), upp = (kind === 'balete' ? 0.1 : kind === 'bush' ? 0.06 : kind === 'banana' ? 0.075 : 1 / 15) * (s || 1);
    var h = bb(parent || scene, t, x, 0, z, upp, t.image.width * upp * (kind === 'palm' ? 0.16 : 0.32));
    if (kind !== 'bush') { h.userData.m.userData.sway = rnd() * 6; trees.push(h.userData.m); }
    h.children[1].userData.still = true; // a plant's shadow never moves, so it can be welded with the others
    return h;
  }

  // ---------- Terrain ----------
  // The town was first drawn on a smaller plan. lay() spreads that plan out over the wider map: the church, the plaza and
  // the houses on it move together as one block, and everything else moves out from the middle.
  function lay(x, z) { return (x > -23 && x < 2 && z > -24 && z < -2.5) ? [x - 4, z - 3.2] : [x * 1.4, z * 1.4]; }
  function segD(px, pz, a, b) {
    var dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(px - a[0] - dx * t, pz - a[1] - dz * t);
  }
  var MAP = 64; // the painted ground reaches this far from the middle; plain grass goes on beyond it
  var RIVER = [[25.2, -22.4], [18.2, -8.4], [12.6, 7], [4.2, 18.2], [-7, 25.2], [-16.8, 29.4], [-20, 31.5]];
  var PATH = [[[7, 7.4], [8, 8.8], 0.8], [[12.2, 12], [16, 12.4], 0.8], [[16, 12.4], [21, 10.4], 0.8]]; // the footpath over the river to Ibarra's wood
  var ROADS = [[[-10, -10], [-10, -2], 1.3], [[-10, -2], [1, 2], 1.3], [[-10, -4], [-22, 2], 1.3], [[-10, -2], [-8, 14], 1.3], [[-5, 7], [0, 4], 1], [[-22, 2], [-24.5, 5.8], 1]]
    .map(function (r) { return [lay(r[0][0], r[0][1]), lay(r[1][0], r[1][1]), r[2]]; }).concat(PATH);
  var BRIDGE = [10.1, 10.4]; // where the footpath crosses the river, south-east of the works
  var CLEARING = [21, 10.2]; // the felling place in the wood
  var LAKE = [-25, 31.5, 12];
  var CEM = [-34.3, 11.9];
  var QUARRY = [14.6, -11.4], CLAY = [3.1, 14.8], BRICKKILN = [-1.4, 13.3], LIMEKILN = [-10.5, 23.2];
  function rel(o, list) { return list.map(function (p) { return [o[0] + p[0], o[1] + p[1], p[2]]; }); }

  function mountain(x, z, r, h) {
    var g = new T.ConeGeometry(r, h, 11, 5), pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new T.Color();
    var lo = new T.Color(0x2c8a48), mid = new T.Color(0x4f9a78), hi = new T.Color(0x8f9ad0), top = new T.Color(0xd8dcf6);
    for (var i = 0; i < pos.count; i++) {
      var px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i), y = py / h + 0.5;
      if (y > 0.05 && y < 0.95) {
        var j = Art.hash(Math.round(px * 10) + x, Math.round(pz * 10) + Math.round(py * 10) * 3);
        pos.setX(i, px * (0.88 + j * 0.28)); pos.setZ(i, pz * (0.88 + j * 0.28));
      }
      if (y < 0.4) c.copy(lo).lerp(mid, y / 0.4); else if (y < 0.8) c.copy(mid).lerp(hi, (y - 0.4) / 0.4); else c.copy(hi).lerp(top, (y - 0.8) / 0.2);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    var m = new T.Mesh(g, mats.mtn || (mats.mtn = new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 })));
    add(scene, m, x, h / 2 - 0.2, z);
  }

  function buildTerrain() {
    // The earth slab, the animated water sheet, then the painted ground with holes where water shows.
    // Plain grass out to the horizon, the animated water sheet, then the painted ground with holes where water shows.
    var ot = Art.tile('grass'); ot.repeat.set(400, 400);
    var outer = new T.Mesh(new T.PlaneGeometry(800, 800), new T.MeshStandardMaterial({ map: ot, roughness: 1, metalness: 0 }));
    outer.rotation.x = -Math.PI / 2; outer.position.y = -0.1; outer.receiveShadow = true; scene.add(outer);
    var wt = Art.tile('water'); wt.repeat.set(MAP / 2, MAP / 2);
    water = new T.Mesh(new T.PlaneGeometry(MAP * 2, MAP * 2), new T.MeshStandardMaterial({ map: wt, roughness: 0.45, metalness: 0 }));
    water.rotation.x = -Math.PI / 2; water.position.y = -0.05; water.receiveShadow = true; scene.add(water);
    var gt = Art.ground({ half: MAP, site: [SITE.x, SITE.z], pile: [PILE.x, PILE.z], paddy: [-42.8, -29.8, -16.7, -3.6], roads: ROADS, plaza: [-18.5, -9.5, -13.2, -6.2], lake: LAKE, river: RIVER,
      quarry: QUARRY, clay: [CLAY[0] - 1.3, CLAY[1] + 0.9], cem: CEM, yards: [BRICKKILN, LIMEKILN, CLEARING] });
    var gg = new T.PlaneGeometry(MAP * 2, MAP * 2); gg.rotateX(-Math.PI / 2);
    groundTex = gt;
    var ground = new T.Mesh(gg, new T.MeshStandardMaterial({ map: gt, alphaTest: 0.5, roughness: 1, metalness: 0 }));
    ground.receiveShadow = true; scene.add(ground);

    [[31, -31, 12.5, 18], [19.6, -35, 10, 12], [36.4, -18.2, 10, 13], [26.6, -38, 8.5, 10], [38, -35, 11, 14],
      [52, -42, 12, 16], [42, -54, 11, 13], [60, -58, 14, 18], [30, -52, 10, 11], [56, -24, 10, 12], [66, -40, 11, 13], [48, -68, 12, 14]]
      .forEach(function (m) { mountain(m[0], m[1], m[2], m[3]); });

    // The carabao in the paddies, with its egret.
    bb(scene, Art.animal('carabao'), -34.2, 0, -9.5, 0.075, 0.9);

    // Ibarra's wood, east of the river, with the old balete.
    var kinds = ['forest', 'forest', 'mango', 'forest', 'acacia'];
    for (var i = 0; i < 130; i++) {
      var tx = 16 + rnd() * 46, tz = -2 + rnd() * 62;
      if (tx + (tz - 7) * 0.6 < 19.6 || tz - tx * 0.3 < -6.5) continue;
      if (Math.hypot(tx - 29.4, tz - 21) < 3.6) continue;
      if (Math.hypot(tx - CLEARING[0], tz - CLEARING[1]) < 4.2 || segD(tx, tz, PATH[1][0], PATH[1][1]) < 1.7 || segD(tx, tz, PATH[2][0], PATH[2][1]) < 1.7) continue; // keep the footpath and the felling place open
      plant(kinds[i % 5], i % 4, tx, tz, 0.85 + rnd() * 0.5);
    }
    plant('balete', 0, 29.4, 21, 1);

    // Trees, palms and bananas about the town and shore.
    [[-15, 8], [-17, 11], [-3, 12.5], [-9, 15.5], [-20, -1], [-4, -18], [2, -14], [6, -9], [-1, -7], [-22, -24], [-27, 3], [8, -18], [-14, 4], [-25.5, 13.2], [2, 17.5], [-21.5, 12], [-4.5, 15]]
      .forEach(function (p, k) { p = lay(p[0], p[1]); plant('palm', k % 5, p[0], p[1], 0.95 + rnd() * 0.35); });
    [[-4, -22, 'flame'], [3, -20, 'mango'], [9, -13, 'narra'], [-20, -12, 'flame'], [-26, -19, 'mango'], [-1, -14, 'acacia'], [7, -3, 'flame'], [-16, -24, 'narra'], [10, -24, 'forest'], [5, -26, 'forest'], [-15.6, -10.8, 'acacia'], [-21, 4.6, 'narra'], [-1, 7.4, 'mango']]
      .forEach(function (p, k) { var q = lay(p[0], p[1]); plant(p[2], k % 4, q[0], q[1], 1 + rnd() * 0.35); });
    [[-13.6, 1.4], [-20.6, 4.8], [-10.4, 5.6], [-1.9, -3.9], [-12.6, 11.4], [4.6, -8.4], [-26.2, 0.2], [-1.5, 19.5]].forEach(function (p) { p = lay(p[0], p[1]); plant('banana', 0, p[0], p[1], 0.9 + rnd() * 0.3); });

    // Flowers: bougainvillea, gumamela, sampaguita, santan.
    var FLW = [0xff4fa0, 0xff3a3a, 0xffffff, 0xffa02e, 0xc070ff, 0xffe04a];
    [[-13.4, -10.6], [-6.6, -10.6], [-5.4, -7.6], [0.4, -7.6], [-4.6, -12.4], [-0.6, -12.6], [-20.6, -13.2], [-15.8, -12.6], [-20, -3.6], [-15.2, -9],
      [-27.2, 6.2], [-21.8, 6.2], [-27.2, 10.8], [-21.8, 10.8], [-16.4, 1.2], [-17.6, 3.2], [-7.4, -1.8], [-9.6, 12.2], [-17.4, 12.8], [-6.5, 15.2], [4.4, -6.6], [8.8, -4.8],
      [-12, -1], [-8, 3], [-3, 5.2], [8.4, -1], [-6, 10], [-28.5, 13.5], [-19.5, 12.5], [-13, 8.5], [0, -17], [6, -15]]
      .forEach(function (p, k) { p = lay(p[0], p[1]); plant('bush', FLW[k % 6], p[0], p[1], 0.9 + rnd() * 0.4); });

    // Bangkas on the lake.
    var fisher = { hat: 'salakot', top: 0xf4ecd8, bottom: 0x3a6aa0 };
    [[-24, 26.7, 0.4, 0x2f86e0], [-30, 34.7, -0.8, 0xe0463a], [-20, 35.7, 1.9, 0xf7c930]].forEach(function (b) {
      var g = new T.Group(); g.position.set(b[0], 0.05, b[1]); g.rotation.y = b[2]; g.userData.dyn = true; scene.add(g);
      box(g, 2.3, 0.26, 0.5, 0x7a4a2a, 0, 0, 0); box(g, 2.3, 0.08, 0.52, b[3], 0, 0.2, 0);
      box(g, 1.8, 0.05, 0.08, 0xc9a66b, 0, 0.05, 0.85);
      box(g, 0.06, 0.05, 0.85, 0xc9a66b, -0.6, 0.14, 0.42); box(g, 0.06, 0.05, 0.85, 0xc9a66b, 0.6, 0.14, 0.42);
      var f = figure(scene, fisher, b[0], b[1], 0.85); f.position.y = 0.2; f.children[1].visible = false;
      boats.push({ hull: g, man: f });
    });

    // The footbridge to Ibarra's wood.
    var br = new T.Group(); br.position.set(BRIDGE[0], 0, BRIDGE[1]); br.rotation.y = -0.6435; scene.add(br);
    tbox(br, 5.2, 0.12, 1.2, 'wood', 0, 0.2, 0, 0xffe2c0, 1);
    [-2.3, -0.8, 0.8, 2.3].forEach(function (px) {
      [-0.58, 0.58].forEach(function (pz) { cyl(br, 0.07, 0.07, 1.35, 0x7a5234, px, -0.45, pz, 5); });
    });
    [-0.58, 0.58].forEach(function (pz) { beam(br, new T.Vector3(-2.5, 0.82, pz), new T.Vector3(2.5, 0.82, pz), 0.045, 0xb07a3c); });
    [-2.75, 2.75].forEach(function (px, n) { var rp = tbox(br, 0.6, 0.1, 1.2, 'wood', px, 0.1, 0, 0xffe2c0, 1); rp.rotation.z = n ? -0.3 : 0.3; });

    // The quarry: an outcrop of grey rock with cut blocks waiting for the sledge.
    var qr = new T.Group(); qr.position.set(QUARRY[0], 0, QUARRY[1]); scene.add(qr);
    [[0.4, -0.9, 2.2, 1.5, 1.6], [-0.9, -0.5, 1.4, 1.0, 1.3], [1.5, -0.3, 1.2, 0.8, 1.1]].forEach(function (q, n) {
      var rk = tbox(qr, q[2], q[3], q[4], 'stone', q[0], 0, q[1], 0xc8ccd8, 1); rk.rotation.y = 0.3 * n - 0.2;
    });
    for (i = 0; i < 5; i++) tbox(qr, 0.55, 0.38, 0.45, 'stone', -0.9 + (i % 3) * 0.62, Math.floor(i / 3) * 0.38, 1.0, null, 1);

    // The clay pit on the river bank: heaps of dug clay.
    var cp = new T.Group(); cp.position.set(CLAY[0], 0, CLAY[1]); scene.add(cp);
    [[0.9, -0.9, 0.9], [-0.2, -1.5, 0.7], [-2.6, -0.6, 0.8]].forEach(function (h) { cyl(cp, h[2] * 0.35, h[2], h[2] * 0.6, 0xb85a36, h[0], 0, h[1], 7); });

    // The brick kiln: clay goes in, bricks and tiles come out.
    var bk = new T.Group(); bk.position.set(BRICKKILN[0], 0, BRICKKILN[1]); scene.add(bk);
    tbox(bk, 2.2, 1.5, 2, 'adobe', 0, 0, 0, 0xffc0a0, 1); roof(bk, 2.6, 2.4, 0.9, 'tile', 0, 1.5, 0);
    tbox(bk, 0.5, 2.9, 0.5, 'adobe', 0.7, 0, -0.6, 0xe0a890, 1);
    quad(bk, 0.7, 0.75, mat(0x2a1a12), 0, 0.02, 1.01, 0); quad(bk, 0.4, 0.4, glowMat, 0, 0.1, 1.02, 0);
    for (i = 0; i < 12; i++) box(bk, 0.5, 0.16, 0.26, 0xc8603a, 1.7 + (i % 2) * 0.56, Math.floor(i / 4) * 0.16, -0.5 + (Math.floor(i / 2) % 2) * 0.32);

    // The lime kiln by the lake: a stone drum, baskets of shells, a heap of white lime.
    var lk = new T.Group(); lk.position.set(LIMEKILN[0], 0, LIMEKILN[1]); scene.add(lk);
    var drum = cyl(lk, 0.85, 1.1, 1.7, 0xd0cec6, 0, 0, 0, 10); drum.material = tmat('stone', 0xe8e4dc);
    cyl(lk, 0.6, 0.6, 0.08, 0x2a1a12, 0, 1.68, 0, 10);
    quad(lk, 0.6, 0.6, mat(0x2a1a12), 0, 0.02, 1.02, 0); quad(lk, 0.34, 0.34, glowMat, 0, 0.08, 1.03, 0);
    cyl(lk, 0.2, 0.75, 0.5, 0xf6f4ee, 1.7, 0, 0.3, 8);
    [[-1.5, 0.6], [-1.9, 0], [-1.3, -0.2]].forEach(function (b) { cyl(lk, 0.28, 0.22, 0.3, 0xc9a66b, b[0], 0, b[1], 7); cyl(lk, 0.24, 0.24, 0.04, 0xfff6ea, b[0], 0.3, b[1], 7); });

    // Fireflies for the evenings.
    var fp = [];
    for (i = 0; i < 110; i++) {
      var w = rnd();
      if (w < 0.5) fp.push(18 + rnd() * 26, 0.6 + rnd() * 3, 2 + rnd() * 38);
      else if (w < 0.8) fp.push(-42 + rnd() * 12, 0.4 + rnd() * 1.5, -16 + rnd() * 30);
      else fp.push(-24 + rnd() * 28, 0.5 + rnd() * 2, -16 + rnd() * 36);
    }
    var fg = new T.BufferGeometry(); fg.setAttribute('position', new T.Float32BufferAttribute(fp, 3));
    flies = new T.Points(fg, new T.PointsMaterial({ color: 0xfff6a0, size: 4, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }));
    scene.add(flies);
  }

  // ---------- Town ----------
  function kubo(x, z, rot, k, parent) {
    var g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rot || 0; (parent || scene).add(g);
    [[-0.8, -0.6], [0.8, -0.6], [-0.8, 0.6], [0.8, 0.6]].forEach(function (p) { cyl(g, 0.07, 0.07, 0.7, 0x7a5234, p[0], 0, p[1], 5); });
    tbox(g, 2.1, 0.12, 1.7, 'wood', 0, 0.62, 0);
    tbox(g, 2, 1.0, 1.6, 'sawali', 0, 0.74, 0);
    quad(g, 0.45, 0.75, mat(0x3a2616), 0.35, 0.74, 0.81, 0);
    quad(g, 0.5, 0.42, winMat, -0.45, 1.05, 0.81, 0);
    quad(g, 0.5, 0.42, winMat, -1.01, 1.05, 0, -Math.PI / 2);
    for (var i = 0; i < 3; i++) box(g, 0.5, 0.05, 0.12, 0xc9a66b, 0.35, 0.12 + i * 0.22, 0.95 + (2 - i) * 0.12);
    roof(g, 2.8, 2.4, 1.25, 'nipa', 0, 1.74, 0, k % 2 ? 0xfff0d8 : 0xffffff);
  }
  function stall(x, z, color, rot) {
    var g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rot || 0; scene.add(g);
    [[-0.85, -0.5, 1.35], [0.85, -0.5, 1.35], [-0.85, 0.5, 1.7], [0.85, 0.5, 1.7]].forEach(function (p) { cyl(g, 0.04, 0.04, p[2], 0x8a6238, p[0], 0, p[1], 5); });
    tbox(g, 1.7, 0.55, 0.8, 'wood', 0, 0, 0);
    var ag = new T.BoxGeometry(2, 0.06, 1.4); scaleUV(ag, 2, 0.06, 1.4, 1);
    var aw = new T.Mesh(ag, new T.MeshStandardMaterial({ map: Art.awning(color), roughness: 1 }));
    add(g, aw, 0, 1.55, 0); aw.rotation.x = -0.33;
    var fruit = [0xffc21a, 0xe8352a, 0x58c43a, 0xff8a1a, 0x9a3ad0];
    for (var i = 0; i < 9; i++) {
      var f = new T.Mesh(new T.SphereGeometry(0.1, 6, 5), mat(fruit[(i + (color & 3)) % 5]));
      add(g, f, -0.64 + (i % 5) * 0.32, 0.62, i < 5 ? 0.14 : -0.14);
    }
  }
  function bunting(a, b) {
    var L = a.distanceTo(b), g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute([a.x, a.y, a.z, b.x, b.y, b.z, a.x, a.y - 0.5, a.z, b.x, b.y - 0.5, b.z], 3));
    g.setAttribute('uv', new T.Float32BufferAttribute([0, 1, L / 4, 1, 0, 0, L / 4, 0], 2));
    g.setIndex([0, 2, 1, 1, 2, 3]);
    if (!mats.bunt) mats.bunt = reg(new T.MeshBasicMaterial({ map: Art.bunting(), alphaTest: 0.5, side: T.DoubleSide }));
    scene.add(new T.Mesh(g, mats.bunt));
  }
  function lamp(parent, x, z, h) {
    cyl(parent, 0.05, 0.07, h, 0x3a3440, x, 0, z, 6);
    var l = new T.Mesh(new T.BoxGeometry(0.26, 0.32, 0.26), glowMat); l.position.set(x, h + 0.16, z); parent.add(l);
    box(parent, 0.36, 0.06, 0.36, 0x3a3440, x, h + 0.32, z);
  }

  function buildTown() {
    winMat = new T.MeshStandardMaterial({ map: Art.one('capiz'), emissiveMap: Art.one('capiz'), emissive: 0x000000, roughness: 1 });
    glassMat = new T.MeshStandardMaterial({ map: Art.one('stained'), emissiveMap: Art.one('stained'), emissive: 0x000000, roughness: 0.6 });
    var roseMat = new T.MeshStandardMaterial({ map: Art.one('rose'), emissiveMap: Art.one('rose'), emissive: 0x000000, roughness: 0.6 });
    mats.rose = roseMat;
    glowMat = new T.MeshStandardMaterial({ color: 0xfff0b0, emissive: 0x000000, roughness: 1 });
    var doorMat = new T.MeshStandardMaterial({ map: Art.one('door'), roughness: 1 });
    mats.door = doorMat;
    var i;

    // Church of San Diego: nave runs north-south, facade faces the plaza (south).
    var ch = new T.Group(); ch.position.set(-14, 0, -20.2); scene.add(ch);
    tbox(ch, 6, 5.2, 11, 'adobe', 0, 0, 0);
    [-4, -1, 2].forEach(function (z) { tbox(ch, 0.7, 3.8, 0.9, 'adobe', -3.3, 0, z, 0xf0e4d0); tbox(ch, 0.7, 3.8, 0.9, 'adobe', 3.3, 0, z, 0xf0e4d0); });
    [-2.5, 0.5].forEach(function (z) { quad(ch, 0.9, 1.5, glassMat, -3.01, 2.6, z, -Math.PI / 2); quad(ch, 0.9, 1.5, glassMat, 3.01, 2.6, z, Math.PI / 2); });
    roof(ch, 6.9, 11.9, 2.6, 'tile', 0, 5.2, 0);
    tbox(ch, 6.6, 6.6, 0.8, 'plaster', 0, 0, 5.6);
    box(ch, 6.9, 0.22, 1.05, 0xe0a83c, 0, 3.9, 5.6); box(ch, 6.9, 0.22, 1.05, 0xe0a83c, 0, 6.6, 5.6);
    roof(ch, 6.6, 0.8, 1.6, 'plaster', 0, 6.82, 5.6);
    cross(ch, 1.2, 0x3d2f25, 0, 8.4, 5.6);
    [-2.9, -1.2, 1.2, 2.9].forEach(function (x) { box(ch, 0.4, 3.9, 0.2, 0xfff4dc, x, 0, 6.05); });
    quad(ch, 1.7, 2.7, doorMat, 0, 0, 6.02, 0);
    quad(ch, 0.9, 1.5, glassMat, -2.05, 1.6, 6.02, 0); quad(ch, 0.9, 1.5, glassMat, 2.05, 1.6, 6.02, 0);
    var rose = new T.Mesh(new T.CircleGeometry(0.85, 20), roseMat); rose.position.set(0, 5.25, 6.02); ch.add(rose);
    // Bell tower.
    tbox(ch, 2.8, 8, 2.8, 'adobe', 4.6, 0, 4.6);
    box(ch, 3.1, 0.22, 3.1, 0xe0a83c, 4.6, 4.2, 4.6); box(ch, 3.1, 0.22, 3.1, 0xe0a83c, 4.6, 7.9, 4.6);
    quad(ch, 0.7, 1.2, glassMat, 4.6, 5.2, 6.02, 0); quad(ch, 0.7, 1.2, glassMat, 3.19, 5.2, 4.6, -Math.PI / 2);
    [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]].forEach(function (p) { tbox(ch, 0.5, 2, 0.5, 'plaster', 4.6 + p[0], 8.12, 4.6 + p[1]); });
    roof(ch, 3.4, 3.4, 1.9, 'tile', 4.6, 10.12, 4.6);
    cross(ch, 0.9, 0x3d2f25, 4.6, 12, 4.6);
    bell = new T.Group(); bell.position.set(4.6, 9.9, 4.6); bell.userData.dyn = true; ch.add(bell);
    var bm = new T.Mesh(new T.CylinderGeometry(0.3, 0.7, 1.1, 10), new T.MeshStandardMaterial({ color: 0xf2b83c, roughness: 0.35, metalness: 0.5 }));
    bm.position.y = -0.7; bm.castShadow = true; bell.add(bm);

    // Convento beside the church.
    var cv = new T.Group(); cv.position.set(-22.5, 0, -18.7); scene.add(cv);
    tbox(cv, 7, 2.2, 5, 'adobe', 0, 0, 0); tbox(cv, 7.3, 1.9, 5.3, 'wood', 0, 2.2, 0);
    roof(cv, 8.1, 6.1, 1.7, 'tile', 0, 4.1, 0);
    for (i = 0; i < 5; i++) quad(cv, 0.9, 1, winMat, -2.6 + i * 1.3, 2.65, 2.66, 0);
    for (i = 0; i < 3; i++) { quad(cv, 0.9, 1, winMat, -3.66, 2.65, -1.5 + i * 1.5, -Math.PI / 2); quad(cv, 0.9, 1, winMat, 3.66, 2.65, -1.5 + i * 1.5, Math.PI / 2); }
    quad(cv, 1.1, 1.7, doorMat, 0, 0, 2.51, 0);

    // Plaza: stone cross, market stalls, lamps, and fiesta bunting.
    var pz = new T.Group(); pz.position.set(-4, 0, -3.2); scene.add(pz); // the cross and lamps keep their places on the old, smaller plan
    tbox(pz, 1.4, 0.3, 1.4, 'stone', -10, 0, -6.5, null, 1); tbox(pz, 1, 0.3, 1, 'stone', -10, 0.3, -6.5, null, 1);
    cross(pz, 1.6, 0xd8d6e2, -10, 0.6, -6.5);
    stall(-17.2, -7.3, 0xe8463a, Math.PI); stall(-10.8, -7.3, 0x2f86e0, Math.PI); stall(-17.6, -11.9, 0xf7b21a, Math.PI / 2); stall(-10.4, -11.9, 0x3fba5e, -Math.PI / 2);
    lamp(pz, -14.2, -9.7, 1.9); lamp(pz, -5.8, -9.7, 1.9);
    var pA = new T.Vector3(-18.2, 3.2, -6.5), pB = new T.Vector3(-9.8, 3.2, -6.5), top = new T.Vector3(-14, 6.4, -14.1);
    cyl(scene, 0.06, 0.08, 3.2, 0x8a6238, pA.x, 0, pA.z, 6); cyl(scene, 0.06, 0.08, 3.2, 0x8a6238, pB.x, 0, pB.z, 6);
    bunting(top, pA); bunting(top, pB); bunting(pA, pB);
    bunting(new T.Vector3(-18.2, 2.2, -12.9), pA); bunting(new T.Vector3(-9.8, 2.2, -12.9), pB);

    // The Ibarra house: a bahay na bato (stone below, wood and capiz above).
    var ib = new T.Group(); ib.position.set(-6.5, 0, -13.2); scene.add(ib);
    tbox(ib, 5, 1.9, 4, 'stone', 0, 0, 0, 0xfff2e0); tbox(ib, 5.5, 1.8, 4.5, 'wood', 0, 1.9, 0, 0xffe2c0);
    roof(ib, 6.3, 5.3, 1.7, 'tile', 0, 3.7, 0, 0xffd8d0);
    for (i = 0; i < 4; i++) quad(ib, 0.95, 1, winMat, -1.8 + i * 1.2, 2.3, 2.26, 0);
    for (i = 0; i < 3; i++) { quad(ib, 0.95, 1, winMat, -2.76, 2.3, -1.2 + i * 1.2, -Math.PI / 2); quad(ib, 0.95, 1, winMat, 2.76, 2.3, -1.2 + i * 1.2, Math.PI / 2); }
    quad(ib, 1.1, 1.6, doorMat, 0, 0, 2.01, 0);

    // Tribunal (town hall) on the plaza's west side, flying the colonial flag.
    var tr = new T.Group(); tr.position.set(-21.5, 0, -9.7); scene.add(tr);
    tbox(tr, 4, 2.4, 5, 'plaster', 0, 0, 0, 0xffe9c0); roof(tr, 4.8, 5.8, 1.5, 'tile', 0, 2.4, 0);
    quad(tr, 1, 1.6, doorMat, 2.01, 0, 0, Math.PI / 2);
    quad(tr, 0.8, 0.9, winMat, 2.01, 1.0, -1.6, Math.PI / 2); quad(tr, 0.8, 0.9, winMat, 2.01, 1.0, 1.6, Math.PI / 2);
    quad(tr, 0.8, 0.9, winMat, -1, 1.0, 2.51, 0); quad(tr, 0.8, 0.9, winMat, 1, 1.0, 2.51, 0);
    cyl(tr, 0.04, 0.05, 4.4, 0x6b4a2e, 2.5, 0, 2.2, 5);
    box(tr, 0.9, 0.16, 0.04, 0xd8222a, 2.97, 4.14, 2.2); box(tr, 0.9, 0.28, 0.04, 0xf7c930, 2.97, 3.86, 2.2); box(tr, 0.9, 0.16, 0.04, 0xd8222a, 2.97, 3.7, 2.2);

    // Nipa houses.
    [[-15, 0, 0.3], [-19, 4, -0.2], [-12, 5, 1.2], [-3.5, -3.4, 0.1], [-11, 11, 0.7], [-16, 12.6, -0.4], [-4.4, 12.8, 0.5], [3, -8, 1.4], [-24, -0.2, 0.9], [6.2, -5.2, 0.2]]
      .forEach(function (k, n) { var q = lay(k[0], k[1]); kubo(q[0], q[1], k[2], n); });

    // Cemetery, out among the fields to the west, with its great cross.
    var ce = new T.Group(); ce.position.set(CEM[0], 0, CEM[1]); scene.add(ce);
    tbox(ce, 6, 0.6, 0.25, 'stone', 0, 0, -2.5, null, 1); tbox(ce, 6, 0.6, 0.25, 'stone', 0, 0, 2.5, null, 1);
    tbox(ce, 0.25, 0.6, 5, 'stone', -3, 0, 0, null, 1); tbox(ce, 0.25, 0.6, 1.8, 'stone', 3, 0, -1.6, null, 1); tbox(ce, 0.25, 0.6, 1.8, 'stone', 3, 0, 1.6, null, 1);
    cross(ce, 2.2, 0x5a4636, 0, 0, 0);
    for (i = 0; i < 9; i++) cross(ce, 0.6, i % 2 ? 0xd8d6e2 : 0xb4b6c8, -2.2 + (i % 3) * 2.2 + (rnd() - 0.5) * 0.6, 0, -1.6 + Math.floor(i / 3) * 1.6 + 0.4);

    // Stockpile of stone and timber for the works.
    var sp = new T.Group(); sp.position.copy(PILE); scene.add(sp);
    for (i = 0; i < 14; i++) {
      var b = tbox(sp, 0.5 + rnd() * 0.3, 0.35, 0.4 + rnd() * 0.3, 'stone', (rnd() - 0.5) * 2, Math.floor(i / 6) * 0.35, (rnd() - 0.5) * 1.6, null, 1);
      b.rotation.y = rnd();
    }
    for (i = 0; i < 4; i++) { var lg = box(sp, 2.6, 0.2, 0.2, 0xb07a3c, -2.2, i * 0.2, -0.4 + (i % 2) * 0.25); lg.rotation.y = 0.2; }
  }

  // ---------- The school ----------
  function buildSchool() {
    var g = new T.Group(); g.position.copy(SITE); scene.add(g); school.group = g;
    var w = 7, d = 4.6, wallH = 2.6, baseH = 0.35, i;

    school.stakes = new T.Group(); g.add(school.stakes);
    var corners = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
    corners.forEach(function (c, k) {
      cyl(school.stakes, 0.05, 0.05, 0.7, 0x8a5a2e, c[0], 0, c[1], 5);
      box(school.stakes, 0.3, 0.2, 0.02, k % 2 ? 0xe8463a : 0xf7c930, c[0] + 0.15, 0.5, c[1]);
      var n = corners[(k + 1) % 4];
      beam(school.stakes, new T.Vector3(c[0], 0.6, c[1]), new T.Vector3(n[0], 0.6, n[1]), 0.015, 0xffffff);
    });

    school.base = tbox(g, w + 0.5, baseH, d + 0.5, 'stone', 0, 0, 0);

    school.derrick = new T.Group(); g.add(school.derrick);
    var top = new T.Vector3(0, 4.6, 0);
    [[-1.8, 1.4], [1.8, 1.4], [0, -1.9]].forEach(function (f) { beam(school.derrick, new T.Vector3(f[0], baseH, f[1]), top, 0.08, 0xb07a3c); });
    beam(school.derrick, top, new T.Vector3(0, 2.1, 0), 0.025, 0x2f2a25);
    box(school.derrick, 0.5, 0.3, 0.02, 0xe8463a, 0.25, 4.7, 0);
    school.stone = tbox(school.derrick, 0.9, 0.7, 0.9, 'plaster', 0, 1.4, 0, null, 1);

    // The walls go up course by course, then get their coat of lime.
    school.rows = [];
    for (i = 0; i < 13; i++) school.rows.push(tbox(g, w, wallH / 13, d, 'adobe', 0, baseH + i * wallH / 13, 0));
    school.walls = tbox(g, w, wallH, d, 'plaster', 0, baseH, 0);

    school.scaffold = new T.Group(); g.add(school.scaffold);
    for (i = 0; i < 5; i++) {
      var x = -w / 2 - 0.35 + i * (w + 0.7) / 4;
      beam(school.scaffold, new T.Vector3(x, 0, d / 2 + 0.4), new T.Vector3(x, 3.6, d / 2 + 0.4), 0.045, 0xd8c04a);
    }
    [1.2, 2.4, 3.4].forEach(function (y) { beam(school.scaffold, new T.Vector3(-w / 2 - 0.5, y, d / 2 + 0.4), new T.Vector3(w / 2 + 0.5, y, d / 2 + 0.4), 0.04, 0xc2a83c); });

    school.details = new T.Group(); g.add(school.details);
    quad(school.details, 1.2, 1.9, mats.door, 0, baseH, d / 2 + 0.02, 0);
    [-2.5, -1.4, 1.4, 2.5].forEach(function (x) { quad(school.details, 0.8, 1, winMat, x, baseH + 1, d / 2 + 0.02, 0); quad(school.details, 0.8, 1, winMat, x, baseH + 1, -d / 2 - 0.02, Math.PI); });
    [-1, 1].forEach(function (z) {
      quad(school.details, 0.8, 1, winMat, w / 2 + 0.02, baseH + 1, z, Math.PI / 2);
      quad(school.details, 0.8, 1, winMat, -w / 2 - 0.02, baseH + 1, z, -Math.PI / 2);
    });
    box(school.details, w + 0.2, 0.14, d + 0.2, 0x2f86e0, 0, baseH + wallH - 0.14, 0);

    school.roof = roof(g, w + 1, d + 1, 2, 'tile', 0, baseH + wallH, 0);

    school.done = new T.Group(); g.add(school.done);
    cyl(school.done, 0.04, 0.04, 3.6, 0x8a5a2e, w / 2 + 1.6, 0, d / 2 + 1.2, 5);
    box(school.done, 1, 0.6, 0.04, 0xfff8e8, w / 2 + 2.12, 2.95, d / 2 + 1.2); box(school.done, 1, 0.2, 0.05, 0x2f86e0, w / 2 + 2.12, 3.35, d / 2 + 1.2);
    lamp(school.done, -w / 2 - 1, d / 2 + 1.3, 1.7);
    var kidTops = [0x2f86e0, 0xfff6ea, 0xe8463a, 0xf7c930, 0x3fba5e, 0xf06aa0];
    [[-1.6, 3.4], [-0.8, 3.9], [0.9, 3.5], [1.7, 4.1], [0.2, 4.4], [-2.4, 4.2]].forEach(function (k, n) {
      var kid = n % 2 ? figure(school.done, { robe: kidTops[n], top: 0xfff6ea, style: 'long' }, k[0], k[1], 0.66)
        : figure(school.done, { top: kidTops[n], bottom: 0x4a4a6a }, k[0], k[1], 0.66);
      kid.userData.hop = n * 1.3; school.kids = school.kids || []; school.kids.push(kid);
    });
    figure(school.done, { top: 0xfff6ea, bottom: 0x3a3440, shoe: 0x1a1420, hair: 0x4a4a4a }, 0, d / 2 + 0.7, 1);
    [[-3, 3.2, 0xff4fa0], [3, 3.2, 0xffe04a], [-4.4, 0, 0xff3a3a], [-4.4, -1.6, 0xffffff], [4.4, -1.4, 0xc070ff]].forEach(function (p) {
      bb(school.done, Art.plant('bush', p[2]), p[0], 0, p[1], 0.06, 0.4);
    });

    // Ibarra himself, overseeing the works.
    ibarra = figure(g, { hat: 'tophat', top: 0x2a2634, bottom: 0x2a2634, shoe: 0x15121a, skin: 0xdba87c, sash: 0xfff6ea }, 4.8, 1.0, 1.05);
  }

  // ---------- People ----------
  function buildPeople() {
    friar = figure(scene, { robe: 0x6e4a32, cord: 0xfff6e0, hair: 0x4a3020, style: 'tonsure', skin: 0xe6bc9c }, CHURCH_DOOR.x, CHURCH_DOOR.z, 1.15);

    var saya = function (c, s) { return { robe: c, stripe: s, top: 0xfff6ea, style: 'long' }; };
    // Townsfolk at the fiesta: [definition, x, z, (walk to) x2, z2]
    [
      [saya(0xe8463a, 0xf7c930), -12.2, -5.3], [saya(0x2f86e0, 0xffffff), -11.3, -5], [{ top: 0xfff6ea, bottom: 0x8a4a2a, hat: 'salakot' }, -7.6, -7.6],
      [{ hat: 'cap', top: 0x2a4a9a, bottom: 0xf0e8d8, shoe: 0x1a1420, sash: 0xfff6ea }, -15, -5.2],
      [{ top: 0x8a8a9a, bottom: 0x5a5a6a, hair: 0xf0f0f0 }, -6.4, -5.6],                                    // Tasio
      [{ robe: 0xffb0cc, stripe: 0xffffff, top: 0xfff6ea, style: 'long', skin: 0xecc6a0 }, -2.5, -7.3],      // María Clara
      [saya(0x3fba5e, 0xf7c930), -13.2, -3.2], [{ top: 0xf7c930, bottom: 0x4a4a6a }, -6.8, -3.2], [saya(0xa455d0, 0xf06aa0), -14.5, -8.7], [{ top: 0xf58a2e, bottom: 0xe9dfc6, hat: 'salakot' }, -5.5, -8.7],
      [saya(0xf7b21a, 0xe8463a), -10.6, -9.4, -9.4, -4], [{ top: 0x2fc4c0, bottom: 0x6a4a34 }, -13, -6.6, -7.4, -6.2], [{ top: 0xe8463a, bottom: 0x4a4a6a }, -8.2, -5.6, -12, -8.4, 0.66],
      [saya(0xf06aa0, 0xffffff), -9.8, 0, -8.6, 8]
    ].forEach(function (t, n) {
      var a = lay(t[1], t[2]), h = figure(scene, t[0], a[0], a[1], t[5] || 1);
      if (t[3] != null) { h.userData.a = a; h.userData.b = lay(t[3], t[4]); h.userData.ph = n * 1.7; walkers.push(h); }
    });
    [[-14, 1.3, 0xffffff], [-11, 6.3, 0xc8782e], [-18, 5.3, 0xffffff], [-5.2, -1.7, 0xc8782e], [-10.2, 12.2, 0xffffff], [-14.6, 13.4, 0x3a3440]].forEach(function (c) {
      var q = lay(c[0], c[1]); bb(scene, Art.animal('chicken', c[2]), q[0], 0, q[1], 0.05, 0.14);
    });
  }

  // ---------- Crews at the other places of work ----------
  // at: where each one stands and works ([x, z, 1] puts a tree or a boulder beside them); drop: where they carry what they have cut.
  var CREW = {
    forest: { tool: 0xc8ccd8, load: 0xb07a3c, top: 0x5a9a4a, bottom: 0x6a4a34, drop: [CLEARING[0] - 1.7, CLEARING[1] - 0.6],
      at: rel(CLEARING, [[2.2, -1.8, 1], [2.6, 0.8, 1], [1.2, 2.8, 1], [-1.2, 3, 1], [0.4, -3.2, 1], [3.8, -0.4, 1]]) },
    quarry: { tool: 0x8c8fa6, load: 0xb6b8ca, top: 0xd8d0c0, bottom: 0x5a5a6a, drop: [QUARRY[0] - 0.4, QUARRY[1] + 1.7],
      at: rel(QUARRY, [[-2.1, -1.2], [-2.2, 0.1], [-1.9, 2.2, 1], [1, 2.1, 1], [-3.5, 1, 1], [-0.4, 3.1, 1]]) },
    claypit: { tool: 0x7a5234, load: 0xc0623a, top: 0xe0a04a, bottom: 0x7a4a34, drop: [BRICKKILN[0], BRICKKILN[1] + 1.3],
      at: rel(CLAY, [[0.1, -0.2], [-0.9, 1.1], [-2.1, 1.6], [-3.2, 0.9], [-1.2, 2.3], [-3, 2.4]]) },
    lake: { tool: 0xc9a66b, load: 0xf2ecdc, top: 0x4a8ac0, bottom: 0xe9dfc6, drop: [LIMEKILN[0] - 1, LIMEKILN[1] + 1], wade: true,
      at: rel(LAKE, [[4.4, -10], [5.2, -9.4], [6, -8.8], [6.8, -8.2], [7.6, -7.6], [8.4, -7]]) }
  };
  function buildCrews() {
    var i, id;
    for (id in CREW) {
      var c = CREW[id], who = { hat: 'salakot', top: c.top, bottom: c.bottom };
      var withTool = { hat: 'salakot', top: c.top, bottom: c.bottom, tool: c.tool }, withLoad = { hat: 'salakot', top: c.top, bottom: c.bottom, load: true, loadC: c.load };
      c.sets = { work: Art.person(withTool), carry: Art.person(withLoad), empty: Art.person(who) };
      c.men = c.at.map(function (a, n) {
        var p = bb(scene, c.sets.work[2], a[0], 0, a[1], PX, 0.32);
        p.userData.u = n * 1.37 % 3; p.visible = false;
        if (a[2] && id === 'forest') plant(n % 2 ? 'mango' : 'forest', n % 4, a[0] + 0.95, a[1] - 0.1, 0.9);
        if (a[2] && id === 'quarry') { var rk = tbox(scene, 0.8, 0.75, 0.7, 'stone', a[0] + 0.85, 0, a[1], 0xc8ccd8, 1); rk.rotation.y = n * 0.5; }
        return p;
      });
    }
    // Felled logs stacked where the footpath reaches the wood.
    for (i = 0; i < 7; i++) { var lg = box(scene, 2.4, 0.22, 0.22, i % 2 ? 0xb07a3c : 0x9a6a34, CLEARING[0] - 2.5, Math.floor(i / 3) * 0.22, CLEARING[1] - 1.6 + (i % 3) * 0.25 + Math.floor(i / 3) * 0.12); lg.rotation.y = 0.15; }
    // The laborers at the works, who carry stone from the stockpile.
    var w1 = { hat: 'salakot', top: 0xf4ecd8, bottom: 0x3a6aa0 }, w2 = { hat: 'salakot', top: 0xe0563a, bottom: 0xe9dfc6 }, w3 = { hat: 'salakot', top: 0x3aa69a, bottom: 0x6a4a34 };
    var sets = [w1, w2, w3].map(function (d) {
      var k, c2 = {}; for (k in d) c2[k] = d[k]; c2.load = true;
      return { empty: Art.person(d), carry: Art.person(c2) };
    });
    for (i = 0; i < 14; i++) {
      var s = sets[i % 3], p = bb(scene, s.empty[2], PILE.x, 0, PILE.z, PX, 0.32);
      p.userData.set = s; p.userData.u = i / 14 * 2; p.userData.lane = ((i % 5) - 2) * 0.32;
      p.visible = false; workers.push(p);
    }
  }
  function moveCrews(dt) {
    for (var id in CREW) {
      var c = CREW[id], n = Math.min(c.men.length, state.crew[id] || 0), busy = state.active && !state.stop[id];
      for (var i = 0; i < c.men.length; i++) {
        var p = c.men[i]; p.visible = i < n;
        if (!p.visible) continue;
        if (busy) p.userData.u = (p.userData.u + dt * 0.5) % 3;
        // A turn: work on the spot, carry the load to the stack, walk back.
        var u = p.userData.u, a = c.at[i], k = u < 1.5 ? 0 : u < 2.25 ? (u - 1.5) / 0.75 : (3 - u) / 0.75;
        var set = u < 1.5 ? c.sets.work : u < 2.25 ? c.sets.carry : c.sets.empty, step = Math.floor(clock * (u < 1.5 ? 4 : 9) + i * 1.3);
        p.position.set(a[0] + (c.drop[0] - a[0]) * k, c.wade ? -0.26 * Math.max(0, 1 - k * 4) : 0, a[1] + (c.drop[1] - a[1]) * k);
        p.userData.m.material = smat(set[!busy ? 2 : u < 1.5 ? step % 2 : [0, 2, 1, 2][step % 4]]);
        p.userData.m.position.y = busy && u >= 1.5 ? Math.abs(Math.sin(clock * 9 + i * 1.3)) * 0.06 : 0;
      }
    }
  }

// ---------- The town grows ----------
  // One more household for every few workers hired, set down where the map was empty. Each brings its hut, the path that reaches
  // it and something beside it. hut: [x, z, turn]. to: where the path from its doorstep joins. paths, paddy [x, z, columns, rows],
  // garden and graves [x0, z0, x1, z1] and yards [x, z, radius] are painted into the ground when the household appears.
  // add(g, live): the rest (g: what stands still; live: plants, animals and people).
  function well(g, x, z) {
    var w = cyl(g, 0.55, 0.62, 0.55, 0xd0cec6, x, 0, z, 10); w.material = tmat('stone', 0xe8e4dc);
    cyl(g, 0.4, 0.4, 0.02, 0x2a6aa8, x, 0.545, z, 10);
    cyl(g, 0.05, 0.05, 1.55, 0x7a5234, x - 0.62, 0, z, 5); cyl(g, 0.05, 0.05, 1.55, 0x7a5234, x + 0.62, 0, z, 5);
    beam(g, new T.Vector3(x - 0.62, 1.3, z), new T.Vector3(x + 0.62, 1.3, z), 0.04, 0xb07a3c);
    roof(g, 1.8, 1.2, 0.55, 'nipa', x, 1.55, z);
    cyl(g, 0.13, 0.1, 0.2, 0x8a6238, x + 0.9, 0, z + 0.45, 7);
  }
  function haystack(g, x, z) { cyl(g, 0.05, 0.05, 1.95, 0x7a5234, x, 0, z, 5); cyl(g, 0.14, 0.95, 1.5, 0xe6c85a, x, 0.06, z, 9); cyl(g, 0.95, 0.8, 0.12, 0xcfae48, x, 0, z, 9); }
  function kamalig(g0, x, z, rot) { // a granary on posts
    var g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rot || 0; g0.add(g);
    [[-1, -0.75], [1, -0.75], [-1, 0.75], [1, 0.75]].forEach(function (p) { cyl(g, 0.09, 0.09, 1, 0x7a5234, p[0], 0, p[1], 5); });
    tbox(g, 2.5, 0.12, 2, 'wood', 0, 0.95, 0); tbox(g, 2.3, 1.1, 1.8, 'sawali', 0, 1.07, 0, 0xf0dcb0);
    quad(g, 0.5, 0.7, mat(0x3a2616), 0, 1.07, 0.91, 0);
    roof(g, 3.1, 2.6, 1.35, 'nipa', 0, 2.17, 0, 0xfff0d8);
    beam(g, new T.Vector3(-0.2, 0, 1.7), new T.Vector3(-0.2, 1.05, 1.02), 0.035, 0xc9a66b); beam(g, new T.Vector3(0.2, 0, 1.7), new T.Vector3(0.2, 1.05, 1.02), 0.035, 0xc9a66b);
  }
  function washing(g, a, b) { // a line of washing between two posts
    var dx = b[0] - a[0], dz = b[1] - a[1], cols = [0xfff6ea, 0xe8463a, 0x2f86e0, 0xf7c930];
    cyl(g, 0.04, 0.04, 1.5, 0x8a6238, a[0], 0, a[1], 5); cyl(g, 0.04, 0.04, 1.5, 0x8a6238, b[0], 0, b[1], 5);
    beam(g, new T.Vector3(a[0], 1.42, a[1]), new T.Vector3(b[0], 1.42, b[1]), 0.012, 0xfff6ea);
    for (var i = 0; i < 4; i++) {
      var k = 0.16 + i * 0.23, c = box(g, 0.34, 0.5 - (i % 2) * 0.14, 0.03, cols[(i + Math.round(a[0])) & 3], a[0] + dx * k, 0.9 + (i % 2) * 0.14, a[1] + dz * k);
      c.rotation.y = -Math.atan2(dz, dx);
    }
  }
  function stoneHouse(g0, x, z) { // a second bahay na bato, smaller than the Ibarras'
    var g = new T.Group(), i; g.position.set(x, 0, z); g0.add(g);
    tbox(g, 4.4, 1.8, 3.4, 'stone', 0, 0, 0, 0xfff2e0); tbox(g, 4.9, 1.6, 3.9, 'wood', 0, 1.8, 0, 0xffe2c0);
    roof(g, 5.7, 4.7, 1.5, 'tile', 0, 3.4, 0, 0xffd8d0);
    for (i = 0; i < 3; i++) quad(g, 0.95, 0.95, winMat, -1.3 + i * 1.3, 2.15, 1.96, 0);
    for (i = 0; i < 2; i++) { quad(g, 0.95, 0.95, winMat, -2.46, 2.15, -0.7 + i * 1.4, -Math.PI / 2); quad(g, 0.95, 0.95, winMat, 2.46, 2.15, -0.7 + i * 1.4, Math.PI / 2); }
    quad(g, 1.05, 1.55, mats.door, 0, 0, 1.71, 0);
    lamp(g, 1.9, 2.5, 1.7);
  }
  function hen(live, x, z, c) { bb(live, Art.animal('chicken', c == null ? 0xffffff : c), x, 0, z, 0.05, 0.14); }
  var SAYA = [[0xe8463a, 0xf7c930], [0x2f86e0, 0xffffff], [0x3fba5e, 0xf7c930], [0xf06aa0, 0xffffff]];
  function woman(live, x, z, k) { figure(live, { robe: SAYA[k][0], stripe: SAYA[k][1], top: 0xfff6ea, style: 'long' }, x, z, 1); }
  function man(live, x, z, top) { figure(live, { top: top, bottom: 0x6a4a34, hat: 'salakot' }, x, z, 1); }

  var GROW = [
    // between the plaza and the works
    { hut: [-0.2, -6.6, 0], to: [-0.9, -3.6], paths: [[[-0.9, -3.6], [-2.5, 1.4], 0.8]], yards: [[2.8, -5.3, 1.2]],
      add: function (g, live) { well(g, 2.8, -5.3); woman(live, 3.9, -4.6, 0); } },
    { hut: [-8.6, 3.8, Math.PI], to: [-8.4, -0.6], garden: [[-7, 2.3, -4.6, 4.9]],
      add: function (g, live) { hen(live, -9.9, 5.7); hen(live, -7.6, 5.9, 0xc8782e); } },
    // the lane that leaves the plaza eastwards, past the Ibarras' door
    { hut: [-1.6, -14.6, 1.2], to: [0.6, -13.4], paths: [[[-9.5, -9.2], [-2.5, -9.2], 0.8], [[-2.5, -9.2], [1, -13], 0.8], [[1, -13], [2.9, -12], 0.6]],
      add: function (g, live) { washing(g, [-3.6, -12.3], [-1.7, -11.9]); hen(live, -0.4, -16.6, 0x3a3440); } },
    // by the paddies
    { hut: [-26.5, -5.6, 0.9], to: [-23.8, -1.4], yards: [[-28.4, -3.6, 1.1]],
      add: function (g, live) { haystack(g, -28.4, -3.6); man(live, -27.2, -2.6, 0xf4ecd8); } },
    { hut: [5.2, -2.7, 0], to: [5.4, -1.1], paths: [[[-1.3, -2.4], [5.4, -1.1], 0.7]],
      add: function (g, live) { plant('banana', 0, 7.4, -2.6, 1, live); washing(g, [2.2, -3.4], [3.6, -2.6]); } },
    { hut: [6.3, -15.2, -1.35], to: [2.3, -15], paths: [[[1, -13], [4.6, -18.5], 0.8]], garden: [[8.2, -16.8, 11.4, -13.7]],
      add: function (g, live) { woman(live, 7.6, -13.2, 2); } },
    // over the footbridge and down the far bank
    { hut: [8.8, 21.5, -1.2], to: [6.7, 22.3], paths: [[[12.2, 12], [10.4, 16], 0.8], [[10.4, 16], [6.8, 20.5], 0.8], [[6.8, 20.5], [6.6, 23], 0.8]],
      add: function (g, live) { plant('banana', 0, 11, 20.2, 1, live); hen(live, 7.4, 19.2); } },
    // west of the old road, beyond the paddies
    { hut: [-40, -0.9, 0], to: [-39.6, 2.1], paths: [[[-30.8, 2.8], [-40.5, 2], 0.8]], paddy: [[-52.1, -13.6, 3, 3]], yards: [[-42.8, -1.4, 1.1]],
      add: function (g, live) { haystack(g, -42.8, -1.4); } },
    { hut: [1.2, -21.6, 1.4], to: [4.3, -21.9], paths: [[[4.6, -18.5], [4.2, -24.4], 0.8]], yards: [[6.5, -20.7, 1.2]],
      add: function (g, live) { well(g, 6.5, -20.7); hen(live, 2.6, -23.6, 0xc8782e); } },
    { hut: [4.6, 26.2, 1.5], to: [7.3, 25.8], paths: [[[6.6, 23], [7.6, 27], 0.8]], garden: [[9.4, 24, 12.6, 26.6]],
      add: function (g, live) { man(live, 8.6, 25.2, 0xe0563a); } },
    // the cemetery takes in another plot
    { hut: [-40.8, 6.8, -2.3], to: [-43.3, 4.9], paths: [[[-40.5, 2], [-45.5, 6.5], 0.8]], graves: [[CEM[0] - 9.4, CEM[1] - 2.9, CEM[0] - 3, CEM[1] + 2.9]],
      add: function (g) {
        var x = CEM[0] - 6, z = CEM[1], i;
        tbox(g, 6, 0.6, 0.25, 'stone', x, 0, z - 2.5, null, 1); tbox(g, 6, 0.6, 0.25, 'stone', x, 0, z + 2.5, null, 1); tbox(g, 0.25, 0.6, 5, 'stone', x - 3, 0, z, null, 1);
        for (i = 0; i < 8; i++) cross(g, 0.6, i % 2 ? 0xd8d6e2 : 0xb4b6c8, x - 2 + (i % 4) * 1.35 + Art.hash(i, 3) * 0.4, 0, z - 1.3 + Math.floor(i / 4) * 2.3 + Art.hash(i, 9) * 0.5);
      } },
    { hut: [9, -23.6, -1.5], to: [4.3, -23.4],
      add: function (g, live) { kamalig(g, 8, -27.4, -0.3); plant('banana', 0, 11.2, -22, 1, live); } },
    // a house of stone at the end of the lane
    { paths: [[[4.2, -24.4], [-0.5, -25.3], 0.8], [[-0.5, -25.3], [-0.5, -26.1], 0.7]],
      add: function (g, live) { stoneHouse(g, -0.5, -27.9); plant('bush', 0xff4fa0, -3.4, -25.9, 1, live); plant('bush', 0xffe04a, 2.4, -25.8, 1, live); } },
    { hut: [-49.5, 10, 1.5], to: [-45.8, 9.9], paths: [[[-45.5, 6.5], [-46, 14], 0.8]], yards: [[-50.2, 13.6, 1.1]],
      add: function (g, live) { haystack(g, -50.2, 13.6); bb(live, Art.animal('carabao'), -48.2, 0, 14.2, 0.075, 0.9); } },
    { hut: [11.2, 29, -1.6], to: [8.6, 29.4], paths: [[[7.6, 27], [8.6, 29.6], 0.8]], paddy: [[-1, 30, 3, 2]],
      add: function (g, live) { bb(live, Art.animal('carabao'), 3.6, 0, 33, 0.075, 0.9); } },
    { hut: [-41.5, 17.4, -1.5], to: [-44.4, 17.9], paths: [[[-46, 14], [-43.5, 20.5], 0.8]],
      add: function (g, live) { washing(g, [-41.8, 19.6], [-40, 20]); woman(live, -39.6, 18.6, 3); } },
    { hut: [10, -19.8, -1.2], to: [4.6, -18.5],
      add: function (g, live) { plant('palm', 2, 12.2, -21.6, 1.1, live); hen(live, 8.4, -18.2); } },
    { hut: [0.6, 27.4, 0], to: [1.2, 29], paths: [[[7.8, 27.8], [5, 29.2], 0.7], [[5, 29.2], [1.2, 29], 0.7]],
      add: function (g, live) { plant('banana', 0, -1.2, 25.4, 1, live); hen(live, 2.6, 28.4, 0xc8782e); } },
    { hut: [-48.6, 18.6, 1.5], to: [-44.5, 18.4], garden: [[-51.6, 20.6, -48.4, 23.2]],
      add: function (g, live) { plant('palm', 1, -51, 17, 1.1, live); } },
    { hut: [-40, 23, Math.PI], to: [-40.6, 21.2], paths: [[[-43.5, 20.5], [-40.6, 21.2], 0.8]], yards: [[-37.2, 21.4, 1.2]],
      add: function (g, live) { well(g, -37.2, 21.4); man(live, -36.2, 22.2, 0x3aa69a); } }
  ];
  var grown = 0, growth, groundTex, painted = [], houseLock = null;
  function buildGrowth() {
    growth = new T.Group(); scene.add(growth);
    GROW.forEach(function (s, n) {
      s.g = new T.Group(); s.live = new T.Group(); s.live.visible = false; scene.add(s.live);
      var paths = (s.paths || []).slice(), h = s.hut, b = [1e9, 1e9, -1e9, -1e9];
      if (h) {
        var sn = Math.sin(h[2]), cs = Math.cos(h[2]);
        kubo(h[0], h[1], h[2], n, s.g);
        paths.push([[h[0] + 1.3 * sn + 0.35 * cs, h[1] + 1.3 * cs - 0.35 * sn], s.to, 0.6]);
      }
      if (s.add) s.add(s.g, s.live);
      var p = s.paint = { roads: paths, paddy: s.paddy || [], garden: s.garden || [], graves: s.graves || [], yards: s.yards || [] };
      var take = function (x, z) { b[0] = Math.min(b[0], x - 1.5); b[1] = Math.min(b[1], z - 1.5); b[2] = Math.max(b[2], x + 1.5); b[3] = Math.max(b[3], z + 1.5); };
      paths.forEach(function (r) { take(r[0][0], r[0][1]); take(r[1][0], r[1][1]); });
      p.paddy.forEach(function (r) { take(r[0], r[1]); take(r[0] + r[2] * 3.1, r[1] + r[3] * 3.1); });
      p.garden.concat(p.graves).forEach(function (r) { take(r[0], r[1]); take(r[2], r[3]); });
      p.yards.forEach(function (r) { take(r[0] - r[2], r[1] - r[2]); take(r[0] + r[2], r[1] + r[2]); });
      p.box = b;
    });
  }
  // n: how many of the new households stand. Their ground is painted in (and taken out again for a new game), and all that
  // stands still is welded into one mesh for each material.
  W.setHouses = function (n) {
    n = Math.max(0, Math.min(GROW.length, (houseLock != null ? houseLock : n) | 0));
    if (n === grown) return;
    while (painted.length > n) Art.groundRestore(groundTex, painted.pop());
    while (painted.length < n) painted.push(Art.groundPatch(groundTex, MAP, GROW[painted.length].paint));
    while (growth.children.length) { var m = growth.children[0]; growth.remove(m); m.geometry.dispose(); }
    var root = new T.Group();
    GROW.forEach(function (s, i) { s.live.visible = i < n; if (i < n) root.add(s.g); });
    root.updateMatrixWorld(true); weld(root, growth, true);
    grown = n;
  };

  // ---------- One mesh for each material ----------
  // Everything that never moves is welded together by material, so the town is drawn in a few dozen calls instead of many hundreds.
  function mergeStatic() { scene.updateMatrixWorld(true); weld(scene, scene); }
  // keep: leave the pieces as they are (they are welded again each time the town grows)
  function weld(root, into, keep) {
    var groups = {}, k;
    root.traverse(function (o) {
      if (!o.isMesh) return;
      if (!o.userData.still) for (var p = o; p; p = p.parent) if (p.userData.dyn) return;
      var key = o.material.uuid + '|' + Object.keys(o.geometry.attributes).sort().join() + '|' + o.castShadow + o.receiveShadow;
      (groups[key] || (groups[key] = [])).push(o);
    });
    for (k in groups) {
      var list = groups[k]; if (!keep && list.length < 2) continue;
      var parts = list.map(function (o) { var g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrixWorld); return g; });
      var merged = new T.BufferGeometry();
      Object.keys(parts[0].attributes).forEach(function (name) {
        var size = parts[0].attributes[name].itemSize, total = 0, at = 0;
        parts.forEach(function (g) { total += g.attributes[name].array.length; });
        var arr = new Float32Array(total);
        parts.forEach(function (g) { arr.set(g.attributes[name].array, at); at += g.attributes[name].array.length; });
        merged.setAttribute(name, new T.BufferAttribute(arr, size));
      });
      var m = new T.Mesh(merged, list[0].material); m.castShadow = list[0].castShadow; m.receiveShadow = list[0].receiveShadow;
      if (!keep) list.forEach(function (o) { o.parent.remove(o); o.geometry.dispose(); });
      parts.forEach(function (g) { g.dispose(); });
      into.add(m);
    }
  }

  // ---------- Post-processing: tilt-shift, bloom, colour ----------
  function buildPost() {
    rt = new T.WebGLRenderTarget(4, 4, { minFilter: T.LinearFilter, magFilter: T.LinearFilter });
    rt.texture.encoding = T.sRGBEncoding;
    rt.depthTexture = new T.DepthTexture(4, 4, T.UnsignedIntType); // the default 16-bit depth z-fights on the ground layers
    var m = new T.ShaderMaterial({
      uniforms: { tD: { value: rt.texture }, res: { value: new T.Vector2(4, 4) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: [
        'uniform sampler2D tD; uniform vec2 res; varying vec2 vUv;',
        'void main(){',
        '  vec2 px = 1.0 / res;',
        '  float blur = smoothstep(0.17, 0.5, abs(vUv.y - 0.5)) * res.y * 0.0045;',
        '  vec3 col = vec3(0.0); vec3 glow = vec3(0.0);',
        '  for (int i = 0; i < 10; i++) {',
        '    float a = float(i) * 2.39996; float r = sqrt((float(i) + 0.5) / 10.0);',
        '    vec2 o = vec2(cos(a), sin(a)) * r;',
        '    col += texture2D(tD, vUv + o * px * blur).rgb;',
        '    vec3 b = texture2D(tD, vUv + o * px * res.y * 0.016).rgb;',
        '    glow += max(b - 0.86, 0.0);',
        '  }',
        '  col /= 10.0; col += glow / 10.0 * 1.5;',
        '  float l = dot(col, vec3(0.299, 0.587, 0.114));',
        '  col = mix(vec3(l), col, 1.2);',
        '  col = mix(col, col * col * (3.0 - 2.0 * col), 0.3);',
        '  vec2 q = vUv - 0.5; col *= 1.0 - dot(q, q) * 0.6;',
        '  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);',
        '}'
      ].join('\n'),
      depthTest: false, depthWrite: false
    });
    var mesh = new T.Mesh(new T.PlaneGeometry(2, 2), m); mesh.frustumCulled = false;
    post = { scene: new T.Scene(), cam: new T.OrthographicCamera(-1, 1, 1, -1, 0, 1), mat: m };
    post.scene.add(mesh);
  }

  W.init = function (canvas) {
    var usePost = !/[?&]nopost=1/.test(location.search);
    renderer = new T.WebGLRenderer({ canvas: canvas, antialias: !usePost, powerPreference: 'high-performance' }); // with the post pass the scene is drawn off-screen, where canvas anti-aliasing does nothing
    renderer.info.autoReset = false;
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene(); scene.background = new T.Color(0x58c4e8);
    camera = new T.OrthographicCamera(-1, 1, 1, -1, 10, 220);
    hemi = new T.HemisphereLight(0xdfeeff, 0x9a8a60, 0.55); scene.add(hemi);
    sun = new T.DirectionalLight(0xffffff, 1.0); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    var sc = sun.shadow.camera; sc.left = -58; sc.right = 58; sc.top = 58; sc.bottom = -58; sc.near = 1; sc.far = 220;
    sun.shadow.bias = -0.0006; scene.add(sun); scene.add(sun.target);
    buildTown(); buildTerrain(); buildCrews(); mergeStatic(); buildSchool(); buildPeople(); buildGrowth();
    if (usePost) buildPost();
    var qq = /[?&]q=(\d)/.exec(location.search); if (qq) { quality = Math.min(3, +qq[1]); qLock = true; } // debug: fix the drawing quality
    var hq = /[?&]houses=(\d+)/.exec(location.search); if (hq) houseLock = +hq[1]; // debug: fix how far the town has grown
    W.setSchool(0); W.setHouses(0); W.setDaylight(0.3);
    var zq = /[?&]zoom=([\d.]+)/.exec(location.search); if (zq) zoom = +zq[1]; // debug
    var lq = /[?&]light=([\d.]+)/.exec(location.search); if (lq) lockLight = +lq[1]; // debug: freeze the hour
    window.addEventListener('resize', resize); resize();
  };

  function resize() {
    var w = window.innerWidth, h = window.innerHeight, dpr = window.devicePixelRatio || 1;
    // Pixels drawn for each screen pixel: a little more than the screen for cheap anti-aliasing, never more than about four million
    // in all, and less at each step down in quality.
    var k = Math.min(Math.max(dpr, 1.5), 2, Math.sqrt(4.2e6 / (w * h))) * QUALITY[quality];
    renderer.setPixelRatio(Math.min(dpr, k)); renderer.setSize(w, h, false);
    var ms = quality >= 2 ? 1024 : 2048;
    if (sun.shadow.mapSize.x !== ms) { sun.shadow.mapSize.set(ms, ms); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    stats.scale = k; stats.quality = quality;
    var a = w / h, v = VIEW / zoom / 2;
    if (a < 1.3) v *= 1.3 / a; // keep the town in view on narrow screens
    camera.left = -v * a; camera.right = v * a; camera.top = v; camera.bottom = -v;
    camera.updateProjectionMatrix();
    if (post) {
      var rw = Math.max(4, Math.floor(w * k)), rh = Math.max(4, Math.floor(h * k));
      rt.setSize(rw, rh); post.mat.uniforms.res.value.set(rw, rh);
    }
  }

  W.rotate = function (dir) { yawTarget += dir * Math.PI / 2; };
  W.zoom = function (delta) { zoom = Math.max(0.75, Math.min(2.4, zoom * (delta > 0 ? 0.9 : 1.1))); resize(); };

  // stage: 0..5, frac: 0..1 progress inside the stage
  W.setSchool = function (stage, frac) {
    frac = frac || 0;
    school.stakes.visible = stage < 3;
    school.base.visible = stage >= 1;
    school.base.scale.y = stage === 1 ? 0.25 + 0.75 * frac : 1;
    school.derrick.visible = stage === 2;
    school.stone.position.y = 1.4 - frac * 1.0;
    var n = Math.max(1, Math.ceil(frac * school.rows.length));
    for (var i = 0; i < school.rows.length; i++) school.rows[i].visible = stage === 3 && i < n;
    school.walls.visible = stage >= 4;
    school.scaffold.visible = stage === 3 || stage === 4;
    school.details.visible = stage >= 4;
    school.roof.visible = stage >= 4;
    school.roof.scale.y = stage === 4 ? Math.max(0.06, frac) : 1;
    school.done.visible = stage >= 5;
  };

  // crew: how many people work at each place; stop: the places where an interruption has stopped the work.
  W.setCrew = function (crew, speed, active, stop) { state.crew = crew; state.speed = speed; state.active = active; state.stop = stop || {}; };
  W.setSuspicion = function (s) { state.susp = s; };
  W.ringBell = function () { bellSwing = 3.2; };
  W.pulse = function () { pulse = 1; };

  var cMorning = new T.Color(0xffd9a0), cNoon = new T.Color(0xfff6e0), cDusk = new T.Color(0xff8a4a), cNight = new T.Color(0x7088e0);
  var sMorning = new T.Color(0xffb9a0), sNoon = new T.Color(0x4cc0ec), sDusk = new T.Color(0xf47a5a), sNight = new T.Color(0x1a1c4a);
  var hDay = new T.Color(0xdfeeff), hNight = new T.Color(0x7a8ae0), warm = new T.Color(0xffb040);
  var tmpC = new T.Color(), tmpS = new T.Color(), dayF = 0.3, dayTarget = 0.3, nightK = 0;
  // f: 0 = dawn, 0.5 = noon, 1 = dusk, >1 = night
  var lockLight = null, topView = /[?&]top=1/.test(location.search); // debug: look at the map from above, north up
  W.setDaylight = function (f) { dayTarget = lockLight != null ? lockLight : f; };

  function applyLight() {
    var f = dayF, inten, hI, k, n = 0;
    if (f <= 0.5) { k = f * 2; tmpC.copy(cMorning).lerp(cNoon, k); tmpS.copy(sMorning).lerp(sNoon, Math.min(1, k * 1.7)); inten = 0.8 + 0.2 * k; hI = 0.5 + 0.08 * k; }
    else if (f <= 1) { k = (f - 0.5) * 2; k = k * k; tmpC.copy(cNoon).lerp(cDusk, k); tmpS.copy(sNoon).lerp(sDusk, k); inten = 1.0 - 0.2 * k; hI = 0.58 - 0.1 * k; }
    else { n = Math.min(1, (f - 1) * 2); tmpC.copy(cDusk).lerp(cNight, n); tmpS.copy(sDusk).lerp(sNight, n); inten = 0.8 - 0.4 * n; hI = 0.48 - 0.04 * n; }
    sun.color.copy(tmpC); sun.intensity = inten; hemi.intensity = hI; hemi.color.copy(hDay).lerp(hNight, n); scene.background.copy(tmpS);
    var ang = Math.PI * (0.15 + 0.7 * Math.min(1, f));
    sun.position.set(TARGET.x + Math.cos(ang) * 50, 22 + Math.sin(ang) * 30, TARGET.z + 28);
    sun.target.position.copy(TARGET);
    // Sprites are unlit, so tint them with the light of the hour.
    tint.setRGB(Math.min(1, tmpC.r * inten * 0.6 + hemi.color.r * hI * 0.85), Math.min(1, tmpC.g * inten * 0.6 + hemi.color.g * hI * 0.85), Math.min(1, tmpC.b * inten * 0.6 + hemi.color.b * hI * 0.85));
    for (var i = 0; i < unlit.length; i++) unlit[i].color.copy(tint);
    // Lamps and capiz windows light up as evening falls.
    nightK = Math.max(0, Math.min(1, (f - 0.82) / 0.4));
    winMat.emissive.copy(warm).multiplyScalar(nightK * 0.95);
    glassMat.emissive.setRGB(nightK * 0.8, nightK * 0.8, nightK * 0.8); mats.rose.emissive.copy(glassMat.emissive);
    glowMat.emissive.copy(warm).multiplyScalar(nightK * 1.2);
    flies.material.opacity = nightK * (0.55 + 0.45 * Math.sin(clock * 3));
  }

  W.siteScreen = function () {
    var v = new T.Vector3(SITE.x, 2.2, SITE.z).project(camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
  };

  var projV = new T.Vector3();
  W.screen = function (x, y, z) { // world point to screen pixels
    projV.set(x, y, z).project(camera);
    return { x: (projV.x * 0.5 + 0.5) * window.innerWidth, y: (-projV.y * 0.5 + 0.5) * window.innerHeight };
  };

  // The game watches its own frame rate. If frames run slow it draws fewer pixels, one step at a time; if a step does not help
  // (the screen is simply capped, or the slowness is elsewhere) it steps back and stops trying.
  var QUALITY = [1, 0.8, 0.64, 0.5], quality = 0, qLock = false, fAcc = 0, fN = 0, fSkip = 3, fBefore = 0, idleAcc = 0;
  var stats = { calls: 0, tris: 0, scale: 1, quality: 0, ms: 0 };
  W.stats = stats;
  function watch(dt) {
    if (dt <= 0 || dt >= 0.1) return;
    fAcc += dt; fN++; if (fN < 50) return;
    var avg = fAcc / fN; fAcc = fN = 0; stats.ms = avg * 1000;
    if (fSkip > 0) { fSkip--; return; }
    if (qLock) return;
    if (fBefore) { if (avg > fBefore * 0.9) { quality--; qLock = true; resize(); } fBefore = 0; fSkip = 1; return; }
    if (avg > 1 / 42 && quality < QUALITY.length - 1) { fBefore = avg; quality++; fSkip = 1; resize(); }
  }

  // idle: the world is only a backdrop (the tree is open), so it is drawn at a third of the pace.
  W.update = function (dt, idle) {
    if (idle) { idleAcc += dt; if (idleAcc < 0.05) return; dt = Math.min(0.1, idleAcc); idleAcc = 0; } else watch(dt);
    clock += dt;
    yaw += (yawTarget - yaw) * Math.min(1, dt * 7);
    dayF += (dayTarget - dayF) * Math.min(1, dt * (Math.abs(dayTarget - dayF) > 0.4 ? 2.5 : 12));
    applyLight();
    var el = topView ? 1.25 : Math.atan(Math.SQRT1_2), R = 90, i;
    if (topView) yaw = Math.PI / 2;
    camera.position.set(TARGET.x + Math.cos(yaw) * Math.cos(el) * R, Math.sin(el) * R, TARGET.z + Math.sin(yaw) * Math.cos(el) * R);
    camera.lookAt(TARGET);
    var face = Math.PI / 2 - yaw;
    for (i = 0; i < billboards.length; i++) billboards[i].rotation.y = face;
    for (i = 0; i < trees.length; i++) trees[i].rotation.z = Math.sin(clock * 1.1 + trees[i].userData.sway) * 0.018;

    // Laborers carry stone from the stockpile to the site and walk back empty.
    var ex = SITE.x - 4.4, ez = SITE.z + 1.2;
    var vis = Math.min(workers.length, state.crew.site || 0), siteBusy = state.active && !state.stop.site;
    moveCrews(dt);
    for (i = 0; i < workers.length; i++) {
      var p = workers[i]; p.visible = i < vis;
      if (!p.visible) continue;
      if (siteBusy) p.userData.u = (p.userData.u + dt * 0.3 * Math.min(2.2, 0.6 + 0.4 * state.speed)) % 2;
      var u = p.userData.u, going = u < 1, k = going ? u : 2 - u;
      var dx = ex - PILE.x, dz = ez - PILE.z, len = Math.hypot(dx, dz), lane = p.userData.lane * (going ? 1 : -1) + (going ? 0.3 : -0.3);
      p.position.set(PILE.x + 1 + dx * k + (-dz / len) * lane, 0, PILE.z + dz * k + (dx / len) * lane);
      var set = going ? p.userData.set.carry : p.userData.set.empty;
      p.userData.m.material = smat(set[siteBusy ? [0, 2, 1, 2][Math.floor(clock * 9 + i * 1.3) % 4] : 2]);
      p.userData.m.position.y = siteBusy ? Math.abs(Math.sin(clock * 9 + i * 1.3)) * 0.06 : 0;
    }

    // The friar leaves the church and walks toward the works as suspicion grows.
    var want = state.susp / 100, old = friarPos;
    friarPos += (want - friarPos) * Math.min(1, dt * 1.5);
    var fx = SITE.x - 2.5, fz = SITE.z - 4.6;
    friar.position.set(CHURCH_DOOR.x + (fx - CHURCH_DOOR.x) * friarPos, 0, CHURCH_DOOR.z + (fz - CHURCH_DOOR.z) * friarPos);
    setFrame(friar, Math.abs(friarPos - old) > 0.0004, 0);

    // Townsfolk strolling the fiesta.
    for (i = 0; i < walkers.length; i++) {
      var wk = walkers[i], ph = clock * 0.22 + wk.userData.ph, t = 0.5 - 0.5 * Math.cos(ph);
      wk.position.x = wk.userData.a[0] + (wk.userData.b[0] - wk.userData.a[0]) * t;
      wk.position.z = wk.userData.a[1] + (wk.userData.b[1] - wk.userData.a[1]) * t;
      setFrame(wk, Math.abs(Math.sin(ph)) > 0.25, i * 1.1);
    }
    if (school.done.visible && school.kids) for (i = 0; i < school.kids.length; i++) school.kids[i].userData.m.position.y = Math.max(0, Math.sin(clock * 5 + school.kids[i].userData.hop)) * 0.18;

    if (bellSwing > 0) { bellSwing -= dt; bell.rotation.z = Math.sin(bellSwing * 7) * 0.5 * Math.min(1, bellSwing); } else bell.rotation.z = 0;
    if (pulse > 0) { pulse = Math.max(0, pulse - dt * 7); }
    var s = 1 + pulse * 0.035; school.group.scale.set(s, 1 + pulse * 0.05, s);
    ibarra.userData.m.position.y = pulse * 0.3;
    for (i = 0; i < boats.length; i++) {
      var by = Math.sin(clock * 1.3 + i * 2) * 0.04;
      boats[i].hull.position.y = 0.05 + by; boats[i].hull.rotation.z = Math.sin(clock + i) * 0.04; boats[i].man.position.y = 0.2 + by;
    }
    water.material.map.offset.set(clock * 0.012, clock * 0.02);

    renderer.info.reset();
    if (post) {
      renderer.setRenderTarget(rt); renderer.render(scene, camera);
      renderer.setRenderTarget(null); renderer.render(post.scene, post.cam);
    } else renderer.render(scene, camera);
    stats.calls = renderer.info.render.calls; stats.tris = renderer.info.render.triangles;
  };

  Noli.World = W;
})();
