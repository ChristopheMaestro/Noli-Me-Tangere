// Noli — the HD-2D diorama of San Diego: pixel-art people and textures in a lit 3D town of plain solids,
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
  var folk = [], hens = [], cattle = [], palms = [], balete, PART = {}; // what a siege empties, kills, fells or pulls down
  var billboards = [], unlit = [], water, winMat, glassMat, glowMat, flies;
  var bellSwing = 0, pulse = 0, clock = 0, friarPos = 0;
  var state = { crew: {}, stop: {}, speed: 1, active: false, susp: 0 };
  var tint = new T.Color(1, 1, 1), solid = []; // solid: where the huts stand

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
  // ---------- Trees and plants ----------
  // Built like the houses, out of a few plain solids, each tree one mesh coloured by its corners. Only people and animals are sprites.
  var TPAL = {
    mango: [0x1d5c38, 0x2e8744, 0x4db357, 0x93dc6c], forest: [0x154a3c, 0x1f6e4a, 0x359654, 0x67c06a],
    flame: [0x8f2430, 0xd43d2e, 0xf46a36, 0xffb84d], narra: [0x6d8a26, 0xa3ba30, 0xdcd443, 0xfff383],
    acacia: [0x23663a, 0x3a9148, 0x62bd55, 0xa8e574]
  };
  var TP = [], TG = {}, treeMat, BARK = 0x7a5234, ASH = 0x241c1c, ASH2 = 0x33282a;
  function lcg(s) { s = (s * 7919 + 13) % 2147483647; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  // One solid of the tree being built. pal: four tones, picked face by face from the way each face looks at the light.
  function tAdd(geo, color, pal, leaf) { // leaf: a leaf colour, kept as deep as it is written (plain colours wash out in the light)
    if (geo.index) { var ng = geo.toNonIndexed(); geo.dispose(); geo = ng; }
    var P = geo.attributes.position, n = P.count, col = new Float32Array(n * 3), c = new T.Color(), i, k;
    for (i = 0; i < n; i += 3) {
      if (pal) {
        var ax = P.getX(i), ay = P.getY(i), az = P.getZ(i), ux = P.getX(i + 1) - ax, uy = P.getY(i + 1) - ay, uz = P.getZ(i + 1) - az, vx = P.getX(i + 2) - ax, vy = P.getY(i + 2) - ay, vz = P.getZ(i + 2) - az;
        var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, len = Math.hypot(nx, ny, nz) || 1;
        var l = (ny * 0.75 - nx * 0.25 + nz * 0.3) / len + (Art.hash(ax * 7.1 + az * 3.3, ay * 5.7) - 0.5) * 0.45;
        c.setHex(pal[l > 0.55 ? 3 : l > 0.15 ? 2 : l > -0.3 ? 1 : 0]).convertSRGBToLinear();
      } else { c.setHex(color); if (leaf) c.convertSRGBToLinear(); }
      for (k = 0; k < 3; k++) { col[(i + k) * 3] = c.r; col[(i + k) * 3 + 1] = c.g; col[(i + k) * 3 + 2] = c.b; }
    }
    TP.push({ p: P.array, c: col }); geo.dispose();
  }
  function tDone() {
    var n = 0, at = 0; TP.forEach(function (p) { n += p.p.length; });
    var pos = new Float32Array(n), col = new Float32Array(n);
    TP.forEach(function (p) { pos.set(p.p, at); col.set(p.c, at); at += p.p.length; }); TP = [];
    var g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3));
    g.computeVertexNormals(); return g;
  }
  function tBlob(r, pal, x, y, z, sy, turn) { var g = new T.DodecahedronGeometry(r, 0); g.rotateY(turn || 0); g.scale(1, sy || 0.82, 1); g.translate(x, y, z); tAdd(g, 0, pal); }
  var tUp = new T.Vector3(0, 1, 0), tQ = new T.Quaternion();
  function tLimb(a, b, r0, r1, color, seg) { // a tapering round limb from a to b
    var d = new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length(), g = new T.CylinderGeometry(r1, r0, len, seg || 5);
    g.translate(0, len / 2, 0); g.applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(tQ.setFromUnitVectors(tUp, d.normalize()))); g.translate(a[0], a[1], a[2]); tAdd(g, color);
  }
  function tStrip(a, b, w, color) { // a flat blade from a to b: a frond, a leaf
    var d = new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length(), g = new T.BoxGeometry(w, 0.05, len);
    d.normalize(); var x = new T.Vector3().crossVectors(tUp, d); if (x.lengthSq() < 1e-4) x.set(1, 0, 0); x.normalize();
    g.applyMatrix4(new T.Matrix4().makeBasis(x, new T.Vector3().crossVectors(d, x), d)); g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); tAdd(g, color, null, color !== ASH && color !== ASH2);
  }
  // burnt: what a fire leaves of it, bare and black, not a leaf on it.
  function treeGeo(kind, v, burnt) {
    var key = kind + ':' + v + (burnt ? ':b' : ''); if (TG[key]) return TG[key];
    var r = lcg((v % 97) * 31 + kind.length * 7 + kind.charCodeAt(0)), i, a, d, y, c, s;
    if (kind === 'palm') {
      var H = 2.8, lean = (r() - 0.5) * 1.1, la = r() * 6.28, lx = Math.cos(la) * lean, lz = Math.sin(la) * lean, pt = function (t) { return [lx * t * t, H * t, lz * t * t]; };
      for (i = 0; i < 6; i++) tLimb(pt(i / 6), pt((i + 1) / 6), 0.15 - i * 0.012, 0.138 - i * 0.012, burnt ? (i % 2 ? ASH : ASH2) : (i % 2 ? 0xa8845a : 0x8f6f48), 6);
      var top = pt(1), n = burnt ? 4 : 9;
      for (i = 0; i < n; i++) {
        a = i / n * 6.283 + r() * 0.4; c = Math.cos(a); s = Math.sin(a);
        if (burnt) { var e1 = [top[0] + c * 0.5, top[1] + 0.12, top[2] + s * 0.5]; tLimb(top, e1, 0.035, 0.025, ASH, 4); tLimb(e1, [top[0] + c * 0.85, top[1] - 0.55 - r() * 0.3, top[2] + s * 0.85], 0.025, 0.012, ASH2, 4); continue; }
        var up = i % 3 === 0 ? 0.42 : 0.2, p1 = [top[0] + c * 0.55, top[1] + up, top[2] + s * 0.55], p2 = [top[0] + c * 1.12, top[1] + up - 0.08, top[2] + s * 1.12], p3 = [top[0] + c * 1.55, top[1] + up - 0.62, top[2] + s * 1.55];
        tStrip(top, p1, 0.3, 0x4fae45); tStrip(p1, p2, 0.36, i % 2 ? 0x9fe05a : 0x62c048); tStrip(p2, p3, 0.24, 0x2b7a3c);
      }
      if (!burnt) {
        tStrip(top, [top[0] + 0.1, top[1] + 0.7, top[2] - 0.1], 0.26, 0x9fe05a);
        for (i = 0; i < 3; i++) tBlob(0.11, [0x5a3e24, 0x6a4a2a, 0x7a5632, 0x9a7446], top[0] + Math.cos(i * 2.1) * 0.14, top[1] - 0.12, top[2] + Math.sin(i * 2.1) * 0.14, 1, i);
      }
    } else if (kind === 'banana') {
      tLimb([0, 0, 0], [0, burnt ? 0.8 : 1.2, 0], 0.11, 0.07, burnt ? ASH : 0x9fbe52, 6);
      for (i = 0; i < (burnt ? 3 : 6); i++) {
        a = i * 1.05 + r() * 0.3; c = Math.cos(a); s = Math.sin(a);
        if (burnt) { tStrip([0, 0.8, 0], [c * 0.35, 0.72, s * 0.35], 0.2, ASH2); tStrip([c * 0.35, 0.72, s * 0.35], [c * 0.5, 0.25, s * 0.5], 0.14, ASH); continue; }
        var q1 = [c * 0.55, 1.62 + (i % 2) * 0.12, s * 0.55], q2 = [c * 1.05, 1.42, s * 1.05];
        tStrip([0, 1.15, 0], q1, 0.4, i % 2 ? 0xb6ec62 : 0x62c048); tStrip(q1, q2, 0.3, i % 2 ? 0x62c048 : 0x358a3c);
      }
      if (!burnt) tStrip([0, 1.15, 0], [0.08, 2.05, 0.05], 0.3, 0xb6ec62);
    } else if (kind === 'bush') {
      tBlob(0.4, TPAL.mango, -0.3, 0.3, 0, 0.85, 0.4); tBlob(0.4, TPAL.mango, 0.3, 0.3, 0.06, 0.85, 1.3); tBlob(0.44, TPAL.acacia, 0, 0.46, -0.05, 0.85, 2.1);
      c = new T.Color(v).lerp(new T.Color(0xffffff), 0.45).getHex();
      for (i = 0; i < 14; i++) {
        a = r() * 6.283; d = r() * 1.1; var fg = new T.BoxGeometry(0.1, 0.1, 0.1);
        fg.translate(Math.cos(a) * Math.cos(d) * 0.66, 0.36 + Math.sin(d) * 0.5, Math.sin(a) * Math.cos(d) * 0.44); tAdd(fg, i % 3 ? v : c, null, true);
      }
    } else if (kind === 'balete') {
      var bark = burnt ? [ASH, ASH2, ASH] : [0x6a5038, 0x5c442e, 0x8a6a48];
      tLimb([0, 0, 0], [0, 4.4, 0], 1.0, 0.7, bark[0], 9);
      for (i = 0; i < 10; i++) { a = i * 0.63 + r() * 0.3; d = 1.2 + r() * 0.6; tLimb([Math.cos(a) * d, 0, Math.sin(a) * d], [Math.cos(a) * 0.7, 3.4 + r() * 1.2, Math.sin(a) * 0.7], 0.22, 0.13, bark[1 + i % 2], 5); }
      for (i = 0; i < 7; i++) { a = i * 0.9 + r() * 0.4; d = 2.4 + r() * 1.2; tLimb([0, 3.9, 0], [Math.cos(a) * d, 5.4 + r() * 0.8, Math.sin(a) * d], 0.34, 0.14, bark[i % 3], 5); }
      if (!burnt) {
        for (i = 0; i < 14; i++) { a = r() * 6.283; d = 1.6 + r() * 2.4; tLimb([Math.cos(a) * d, 1 + r() * 2.6, Math.sin(a) * d], [Math.cos(a) * d, 5.6, Math.sin(a) * d], 0.035, 0.035, 0x8f7c5c, 4); }
        for (i = 0; i < 22; i++) { a = i * 2.4 + r(); d = Math.sqrt(r()) * 3.9; tBlob(1.15 + r() * 0.5, TPAL.forest, Math.cos(a) * d, 5.6 + (1 - d / 4.2) * 1.5 + r() * 0.7, Math.sin(a) * d, 0.8, r() * 3); }
      }
    } else {
      var wide = kind === 'flame' || kind === 'acacia', pal = TPAL[kind], tx = (r() - 0.5) * 0.3, tz = (r() - 0.5) * 0.3, wood = burnt ? ASH : BARK;
      tLimb([0, 0, 0], [0, 0.3, 0], 0.3, 0.2, wood, 6); tLimb([0, 0.25, 0], [tx, burnt ? 2.1 : 1.9, tz], 0.2, burnt ? 0.1 : 0.13, wood, 6);
      if (burnt) {
        for (i = 0; i < 6; i++) {
          a = i * 1.05 + r() * 0.6; d = (wide ? 1.3 : 0.95) * (0.7 + r() * 0.5); y = 1.2 + i * 0.16;
          var m1 = [tx + Math.cos(a) * d * 0.55, y + 0.6 + r() * 0.3, tz + Math.sin(a) * d * 0.55], m2 = [tx + Math.cos(a) * d, y + 1.1 + r() * 0.6, tz + Math.sin(a) * d];
          tLimb([tx * y / 2, y, tz * y / 2], m1, 0.085, 0.055, i % 2 ? ASH : ASH2, 4); tLimb(m1, m2, 0.055, 0.02, ASH, 4);
          tLimb(m1, [m1[0] + Math.cos(a + 1.3) * 0.45, m1[1] + 0.5, m1[2] + Math.sin(a + 1.3) * 0.45], 0.04, 0.015, ASH2, 4);
        }
        tLimb([tx, 2.1, tz], [tx + 0.12, 3.1, tz - 0.1], 0.1, 0.02, ASH, 4);
      } else {
        for (i = 0; i < 3; i++) { a = i * 2.1 + r(); tLimb([tx * 0.8, 1.6, tz * 0.8], [Math.cos(a) * 0.7, 2.4, Math.sin(a) * 0.7], 0.08, 0.05, BARK, 4); }
        tBlob(1.02, pal, tx, 2.85, tz, 0.85, r() * 3);
        for (i = 0; i < 7; i++) {
          a = i * 0.9 + r() * 0.5; d = wide ? 0.8 + r() * 0.55 : 0.45 + r() * 0.5; y = wide ? 2.5 + r() * 0.5 : 2.3 + r() * 1.05;
          tBlob(0.62 + r() * (wide ? 0.2 : 0.3), kind === 'flame' && r() < 0.22 ? TPAL.acacia : pal, Math.cos(a) * d, y, Math.sin(a) * d, 0.82, r() * 3);
        }
        if (kind === 'mango') for (i = 0; i < 9; i++) { a = r() * 6.283; d = 0.9 + r() * 0.45; var mg = new T.BoxGeometry(0.11, 0.14, 0.11); mg.translate(Math.cos(a) * d, 2.05 + r() * 0.5, Math.sin(a) * d); tAdd(mg, 0xf7a928, null, true); }
      }
    }
    return (TG[key] = tDone());
  }
  function plant(kind, v, x, z, s, parent) {
    var m = new T.Mesh(treeGeo(kind, v), treeMat || (treeMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })));
    m.position.set(x, 0, z); m.scale.setScalar(s || 1); m.rotation.y = Art.hash(x * 3.7 + 1, z * 5.3 + 2) * 6.283;
    m.castShadow = m.receiveShadow = true; m.userData.kind = kind; m.userData.v = v;
    (parent || scene).add(m);
    if (kind !== 'bush') { m.userData.dyn = true; m.userData.sway = rnd() * 6; m.layers.set(1); trees.push(m); } // a bush never changes, so it is welded with the rest
    if (kind === 'palm' && !parent) palms.push(m);
    return m;
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
    // (The water sheet stops just short of the painted ground's edge: lying a little lower, it would otherwise show as a blue line along the two near sides.)
    // Plain grass out to the horizon, the animated water sheet, then the painted ground with holes where water shows.
    var ot = Art.tile('grass'); ot.repeat.set(400, 400);
    var outer = new T.Mesh(new T.PlaneGeometry(800, 800), new T.MeshStandardMaterial({ map: ot, roughness: 1, metalness: 0 }));
    outer.rotation.x = -Math.PI / 2; outer.position.y = -0.1; outer.receiveShadow = true; scene.add(outer);
    var wt = Art.tile('water'); wt.repeat.set(MAP / 2, MAP / 2);
    water = new T.Mesh(new T.PlaneGeometry(MAP * 2 - 0.4, MAP * 2 - 0.4), new T.MeshStandardMaterial({ map: wt, roughness: 0.45, metalness: 0 }));
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
    cattle[0] = bb(scene, Art.animal('carabao'), -34.2, 0, -9.5, 0.075, 0.9);

    // Ibarra's wood, east of the river, with the old balete.
    var kinds = ['forest', 'forest', 'mango', 'forest', 'acacia'];
    for (var i = 0; i < 130; i++) {
      var tx = 16 + rnd() * 46, tz = -2 + rnd() * 62;
      if (tx + (tz - 7) * 0.6 < 19.6 || tz - tx * 0.3 < -6.5) continue;
      if (Math.hypot(tx - 29.4, tz - 21) < 3.6) continue;
      if (Math.hypot(tx - CLEARING[0], tz - CLEARING[1]) < 4.2 || segD(tx, tz, PATH[1][0], PATH[1][1]) < 1.7 || segD(tx, tz, PATH[2][0], PATH[2][1]) < 1.7) continue; // keep the footpath and the felling place open
      plant(kinds[i % 5], i % 4, tx, tz, 0.85 + rnd() * 0.5);
    }
    balete = plant('balete', 0, 29.4, 21, 1);

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
    [-0.58, 0.58].forEach(function (pz) { beam(br, new T.Vector3(-2.5, 0.82, pz), new T.Vector3(2.5, 0.82, pz), 0.045, 0xb07a3c).userData.tag = 'brRail'; });
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
    if (!parent) solid.push([x, z]);
    g.userData.tag = (parent ? 'g' : 'k') + k; KUBO[g.userData.tag] = [x, z, rot || 0];
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
    var g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rot || 0; scene.add(g); g.userData.tag = 'stall';
    [[-0.85, -0.5, 1.35], [0.85, -0.5, 1.35], [-0.85, 0.5, 1.7], [0.85, 0.5, 1.7]].forEach(function (p) { cyl(g, 0.04, 0.04, p[2], 0x8a6238, p[0], 0, p[1], 5); });
    tbox(g, 1.7, 0.55, 0.8, 'wood', 0, 0, 0);
    var ag = new T.BoxGeometry(2, 0.06, 1.4); scaleUV(ag, 2, 0.06, 1.4, 1);
    var aw = new T.Mesh(ag, new T.MeshStandardMaterial({ map: Art.awning(color), roughness: 1 }));
    add(g, aw, 0, 1.55, 0); aw.rotation.x = -0.33; aw.userData.tag = 'awn';
    var fruit = [0xffc21a, 0xe8352a, 0x58c43a, 0xff8a1a, 0x9a3ad0];
    for (var i = 0; i < 9; i++) {
      var f = new T.Mesh(new T.SphereGeometry(0.1, 6, 5), mat(fruit[(i + (color & 3)) % 5]));
      add(g, f, -0.64 + (i % 5) * 0.32, 0.62, i < 5 ? 0.14 : -0.14); f.userData.tag = 'fruit';
    }
  }
  function bunting(a, b) {
    var L = a.distanceTo(b), g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute([a.x, a.y, a.z, b.x, b.y, b.z, a.x, a.y - 0.5, a.z, b.x, b.y - 0.5, b.z], 3));
    g.setAttribute('uv', new T.Float32BufferAttribute([0, 1, L / 4, 1, 0, 0, L / 4, 0], 2));
    g.setIndex([0, 2, 1, 1, 2, 3]);
    if (!mats.bunt) mats.bunt = reg(new T.MeshBasicMaterial({ map: Art.bunting(), alphaTest: 0.5, side: T.DoubleSide }));
    var bm = new T.Mesh(g, mats.bunt); bm.userData.tag = 'bunt'; scene.add(bm);
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
    roof(ch, 6.9, 11.9, 2.6, 'tile', 0, 5.2, 0).userData.tag = 'chRoof';
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
    roof(ch, 3.4, 3.4, 1.9, 'tile', 4.6, 10.12, 4.6).userData.tag = 'twRoof';
    cross(ch, 0.9, 0x3d2f25, 4.6, 12, 4.6).userData.tag = 'twRoof';
    bell = new T.Group(); bell.position.set(4.6, 9.9, 4.6); bell.userData.dyn = true; ch.add(bell);
    var bm = new T.Mesh(new T.CylinderGeometry(0.3, 0.7, 1.1, 10), new T.MeshStandardMaterial({ color: 0xf2b83c, roughness: 0.35, metalness: 0.5 }));
    bm.position.y = -0.7; bm.castShadow = true; bell.add(bm);

    // Convento beside the church.
    var cv = new T.Group(); cv.position.set(-22.5, 0, -18.7); scene.add(cv);
    var cvTop = new T.Group(); cvTop.userData.tag = 'cvTop'; cv.add(cvTop); // the upper floor, which a fire can take
    tbox(cv, 7, 2.2, 5, 'adobe', 0, 0, 0); tbox(cvTop, 7.3, 1.9, 5.3, 'wood', 0, 2.2, 0);
    roof(cv, 8.1, 6.1, 1.7, 'tile', 0, 4.1, 0).userData.tag = 'cvRoof';
    for (i = 0; i < 5; i++) quad(cvTop, 0.9, 1, winMat, -2.6 + i * 1.3, 2.65, 2.66, 0);
    for (i = 0; i < 3; i++) { quad(cvTop, 0.9, 1, winMat, -3.66, 2.65, -1.5 + i * 1.5, -Math.PI / 2); quad(cvTop, 0.9, 1, winMat, 3.66, 2.65, -1.5 + i * 1.5, Math.PI / 2); }
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
    var fl = new T.Group(); fl.userData.tag = 'trFlag'; tr.add(fl);
    box(fl, 0.9, 0.16, 0.04, 0xd8222a, 2.97, 4.14, 2.2); box(fl, 0.9, 0.28, 0.04, 0xf7c930, 2.97, 3.86, 2.2); box(fl, 0.9, 0.16, 0.04, 0xd8222a, 2.97, 3.7, 2.2);

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
    school.flag = [box(school.done, 1, 0.6, 0.04, 0xfff8e8, w / 2 + 2.12, 2.95, d / 2 + 1.2), box(school.done, 1, 0.2, 0.05, 0x2f86e0, w / 2 + 2.12, 3.35, d / 2 + 1.2)];
    lamp(school.done, -w / 2 - 1, d / 2 + 1.3, 1.7);
    var kidTops = [0x2f86e0, 0xfff6ea, 0xe8463a, 0xf7c930, 0x3fba5e, 0xf06aa0];
    [[-1.6, 3.4], [-0.8, 3.9], [0.9, 3.5], [1.7, 4.1], [0.2, 4.4], [-2.4, 4.2]].forEach(function (k, n) {
      var kid = n % 2 ? figure(school.done, { robe: kidTops[n], top: 0xfff6ea, style: 'long' }, k[0], k[1], 0.66)
        : figure(school.done, { top: kidTops[n], bottom: 0x4a4a6a }, k[0], k[1], 0.66);
      kid.userData.hop = n * 1.3; school.kids = school.kids || []; school.kids.push(kid); folk.push(kid);
    });
    folk.push(figure(school.done, { top: 0xfff6ea, bottom: 0x3a3440, shoe: 0x1a1420, hair: 0x4a4a4a }, 0, d / 2 + 0.7, 1));
    [[-3, 3.2, 0xff4fa0], [3, 3.2, 0xffe04a], [-4.4, 0, 0xff3a3a], [-4.4, -1.6, 0xffffff], [4.4, -1.4, 0xc070ff]].forEach(function (p) {
      plant('bush', p[2], p[0], p[1], 1, school.done);
    });

    // Ibarra himself, overseeing the works.
    ibarra = figure(g, { hat: 'tophat', top: 0x2a2634, bottom: 0x2a2634, shoe: 0x15121a, skin: 0xdba87c, sash: 0xfff6ea }, 4.8, 1.0, 1.05);
  }

  // ---------- People ----------
  function buildPeople() {
    friar = figure(scene, FRIAR, CHURCH_DOOR.x, CHURCH_DOOR.z, 1.15);

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
      var a = lay(t[1], t[2]), h = figure(scene, t[0], a[0], a[1], t[5] || 1); folk.push(h);
      if (t[3] != null) { h.userData.a = a; h.userData.b = lay(t[3], t[4]); h.userData.ph = n * 1.7; walkers.push(h); }
    });
    [[-14, 1.3, 0xffffff], [-11, 6.3, 0xc8782e], [-18, 5.3, 0xffffff], [-5.2, -1.7, 0xc8782e], [-10.2, 12.2, 0xffffff], [-14.6, 13.4, 0x3a3440]].forEach(function (c) {
      var q = lay(c[0], c[1]); hens.push(bb(scene, Art.animal('chicken', c[2]), q[0], 0, q[1], 0.05, 0.14));
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
  function haystack(g0, x, z) { var g = new T.Group(); g.userData.tag = 'hay'; g0.add(g); cyl(g, 0.05, 0.05, 1.95, 0x7a5234, x, 0, z, 5); cyl(g, 0.14, 0.95, 1.5, 0xe6c85a, x, 0.06, z, 9); cyl(g, 0.95, 0.8, 0.12, 0xcfae48, x, 0, z, 9); }
  function kamalig(g0, x, z, rot) { // a granary on posts
    var g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rot || 0; g0.add(g);
    [[-1, -0.75], [1, -0.75], [-1, 0.75], [1, 0.75]].forEach(function (p) { cyl(g, 0.09, 0.09, 1, 0x7a5234, p[0], 0, p[1], 5); });
    tbox(g, 2.5, 0.12, 2, 'wood', 0, 0.95, 0); tbox(g, 2.3, 1.1, 1.8, 'sawali', 0, 1.07, 0, 0xf0dcb0);
    quad(g, 0.5, 0.7, mat(0x3a2616), 0, 1.07, 0.91, 0);
    roof(g, 3.1, 2.6, 1.35, 'nipa', 0, 2.17, 0, 0xfff0d8);
    beam(g, new T.Vector3(-0.2, 0, 1.7), new T.Vector3(-0.2, 1.05, 1.02), 0.035, 0xc9a66b); beam(g, new T.Vector3(0.2, 0, 1.7), new T.Vector3(0.2, 1.05, 1.02), 0.035, 0xc9a66b);
  }
  function washing(g0, a, b) { // a line of washing between two posts
    var g = new T.Group(); g.userData.tag = 'wash'; g0.add(g);
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
    var up = new T.Group(); up.userData.tag = 'shTop'; g.add(up);
    tbox(g, 4.4, 1.8, 3.4, 'stone', 0, 0, 0, 0xfff2e0); tbox(up, 4.9, 1.6, 3.9, 'wood', 0, 1.8, 0, 0xffe2c0);
    roof(up, 5.7, 4.7, 1.5, 'tile', 0, 3.4, 0, 0xffd8d0);
    for (i = 0; i < 3; i++) quad(up, 0.95, 0.95, winMat, -1.3 + i * 1.3, 2.15, 1.96, 0);
    for (i = 0; i < 2; i++) { quad(up, 0.95, 0.95, winMat, -2.46, 2.15, -0.7 + i * 1.4, -Math.PI / 2); quad(up, 0.95, 0.95, winMat, 2.46, 2.15, -0.7 + i * 1.4, Math.PI / 2); }
    quad(g, 1.05, 1.55, mats.door, 0, 0, 1.71, 0);
    lamp(g, 1.9, 2.5, 1.7);
  }
  function hen(live, x, z, c) { hens.push(bb(live, Art.animal('chicken', c == null ? 0xffffff : c), x, 0, z, 0.05, 0.14)); }
  var SAYA = [[0xe8463a, 0xf7c930], [0x2f86e0, 0xffffff], [0x3fba5e, 0xf7c930], [0xf06aa0, 0xffffff]];
  function woman(live, x, z, k) { folk.push(figure(live, { robe: SAYA[k][0], stripe: SAYA[k][1], top: 0xfff6ea, style: 'long' }, x, z, 1)); }
  function man(live, x, z, top) { folk.push(figure(live, { top: top, bottom: 0x6a4a34, hat: 'salakot' }, x, z, 1)); }

  var GROW = [
    // between the plaza and the works
    { hut: [-0.2, -6.6, 0], to: [-0.9, -3.6], paths: [[[-0.9, -3.6], [-2.5, 1.4], 0.8]], yards: [[2.8, -5.3, 1.2]],
      add: function (g, live) { well(g, 2.8, -5.3); woman(live, 3.9, -4.6, 0); } },
    // a lane north between the paddies and the convento, to the open ground behind the church
    { hut: [-32, -19.8, Math.PI], to: [-32, -23.7], paths: [[[-23.8, -1.4], [-26.6, -7], 0.8], [[-26.6, -7], [-28, -15.5], 0.8], [[-28, -15.5], [-28, -24], 0.8], [[-28, -24], [-32.5, -23.7], 0.7]],
      yards: [[-35.2, -19.6, 1.1]],
      add: function (g, live) { haystack(g, -35.2, -19.6); man(live, -30.2, -22.4, 0xf4ecd8); } },
    { hut: [-8.6, 3.8, Math.PI], to: [-8.4, -0.6], garden: [[-7, 2.3, -4.6, 4.9]],
      add: function (g, live) { hen(live, -9.9, 5.7); hen(live, -7.6, 5.9, 0xc8782e); } },
    // over the footbridge and down the far bank
    { hut: [8.8, 21.5, -1.2], to: [6.7, 22.3], paths: [[[12.2, 12], [10.4, 16], 0.8], [[10.4, 16], [6.8, 20.5], 0.8], [[6.8, 20.5], [6.6, 23], 0.8]],
      add: function (g, live) { plant('banana', 0, 11, 20.2, 1, live); hen(live, 7.4, 19.2); } },
    // the lane that leaves the plaza eastwards, past the Ibarras' door
    { hut: [-1.6, -14.6, 1.2], to: [0.6, -13.4], paths: [[[-9.5, -9.2], [-2.5, -9.2], 0.8], [[-2.5, -9.2], [1, -13], 0.8], [[1, -13], [2.9, -12], 0.6]],
      add: function (g, live) { washing(g, [-3.6, -12.3], [-1.7, -11.9]); hen(live, -0.4, -16.6, 0x3a3440); } },
    // behind the church
    { hut: [-21.6, -27.6, -1.2], to: [-25, -29.5], paths: [[[-28, -24], [-24, -31], 0.8]], yards: [[-28.6, -31.6, 1.2]],
      add: function (g, live) { well(g, -28.6, -31.6); woman(live, -27.4, -30.4, 1); } },
    // west of the old road, beyond the paddies
    { hut: [-40, -0.9, 0], to: [-39.6, 2.1], paths: [[[-30.8, 2.8], [-40.5, 2], 0.8]], paddy: [[-52.1, -13.6, 3, 3]], yards: [[-42.8, -1.4, 1.1]],
      add: function (g, live) { haystack(g, -42.8, -1.4); } },
    // further down the far bank, south of the wood
    { hut: [12.6, 39.6, -Math.PI / 2], to: [10, 39.6], paths: [[[6.6, 23], [7.6, 27], 0.8], [[7.6, 27], [8.6, 29.6], 0.8], [[8.6, 29.6], [10.5, 37], 0.8], [[10.5, 37], [9, 42.5], 0.8]], paddy: [[-1, 30, 3, 2]],
      add: function (g, live) { cattle[1] = bb(live, Art.animal('carabao'), 3.6, 0, 33, 0.075, 0.9); plant('banana', 0, 13.4, 36.6, 1, live); } },
    // north of the paddies, a track going west
    { hut: [-40, -26.6, 0], to: [-40, -23.7], paths: [[[-32.5, -23.7], [-36, -23.6], 0.8], [[-36, -23.6], [-45, -24], 0.8]], yards: [[-43.2, -27, 1.1]],
      add: function (g, live) { haystack(g, -43.2, -27); hen(live, -38, -25.2); hen(live, -41.6, -24.8, 0xc8782e); } },
    { hut: [6.3, -15.2, -1.35], to: [2.3, -15], paths: [[[1, -13], [4.6, -18.5], 0.8]], garden: [[8.2, -16.8, 11.4, -13.7]],
      add: function (g, live) { woman(live, 7.6, -13.2, 2); } },
    // the cemetery takes in another plot
    { hut: [-40.8, 6.8, -2.3], to: [-43.3, 4.9], paths: [[[-40.5, 2], [-45.5, 6.5], 0.8]], graves: [[CEM[0] - 9.4, CEM[1] - 2.9, CEM[0] - 3, CEM[1] + 2.9]],
      add: function (g) {
        var x = CEM[0] - 6, z = CEM[1], i;
        tbox(g, 6, 0.6, 0.25, 'stone', x, 0, z - 2.5, null, 1); tbox(g, 6, 0.6, 0.25, 'stone', x, 0, z + 2.5, null, 1); tbox(g, 0.25, 0.6, 5, 'stone', x - 3, 0, z, null, 1);
        for (i = 0; i < 8; i++) cross(g, 0.6, i % 2 ? 0xd8d6e2 : 0xb4b6c8, x - 2 + (i % 4) * 1.35 + Art.hash(i, 3) * 0.4, 0, z - 1.3 + Math.floor(i / 4) * 2.3 + Art.hash(i, 9) * 0.5);
      } },
    { hut: [-19.5, -37.4, 0], to: [-19.3, -33.4], paths: [[[-24, -31], [-16, -35], 0.8]], garden: [[-25, -38.6, -22, -35.8]],
      add: function (g, live) { kamalig(g, -15.2, -39.4, 0.3); } },
    { hut: [5.4, 40.6, Math.PI / 2], to: [9.5, 40.6], garden: [[0.4, 38.2, 3.6, 40.8]],
      add: function (g, live) { man(live, 4.4, 38.4, 0xe0563a); hen(live, 7.6, 42.4); } },
    // a house of stone at the end of the lane
    { paths: [[[4.6, -18.5], [4.2, -24.4], 0.8], [[4.2, -24.4], [-0.5, -25.3], 0.8], [[-0.5, -25.3], [-0.5, -26.1], 0.7]],
      add: function (g, live) { stoneHouse(g, -0.5, -27.9); plant('bush', 0xff4fa0, -3.4, -25.9, 1, live); plant('bush', 0xffe04a, 2.4, -25.8, 1, live); } },
    { hut: [-46.4, -20.4, Math.PI], to: [-46.6, -23.9], paths: [[[-45, -24], [-53, -21.5], 0.8], [[-53, -21.5], [-56.8, -14], 0.8]], garden: [[-52.4, -19.2, -49.2, -16.6]],
      add: function (g, live) { woman(live, -48.6, -20.4, 3); } },
    { hut: [-11.6, -39.6, 0], to: [-11.6, -36.4], paths: [[[-16, -35], [-8, -37.6], 0.8]],
      add: function (g, live) { washing(g, [-9.4, -40.6], [-7.6, -39.8]); plant('banana', 0, -13.8, -41, 1, live); } },
    { hut: [10.8, 47.4, -Math.PI / 2], to: [7.3, 47.4], paths: [[[9, 42.5], [7, 48], 0.8], [[7, 48], [3.4, 51.6], 0.8]], yards: [[4, 45.6, 1.2]],
      add: function (g, live) { well(g, 4, 45.6); woman(live, 5.2, 46.4, 0); } },
    { hut: [-60, -9.6, Math.PI / 2], to: [-56.6, -9.9], paths: [[[-56.8, -14], [-56, -5], 0.8]], yards: [[-59.4, -5.6, 1.2]],
      add: function (g, live) { well(g, -59.4, -5.6); man(live, -58, -6.6, 0x3aa69a); } },
    { hut: [-23.6, -42.6, -Math.PI / 2], to: [-27.2, -42.2], paths: [[[-24, -31], [-28, -37.5], 0.8], [[-28, -37.5], [-27, -44.5], 0.8]], yards: [[-31.4, -39.4, 1.1]],
      add: function (g, live) { haystack(g, -31.4, -39.4); cattle[2] = bb(live, Art.animal('carabao'), -31, 0, -43, 0.075, 0.9); } },
    { hut: [-59.2, -1.4, Math.PI / 2], to: [-55.8, -1.8], paths: [[[-56, -5], [-55.6, 1.5], 0.8]],
      add: function (g, live) { plant('palm', 1, -60.6, 1.4, 1.1, live); hen(live, -57.4, 0.6); } }
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
    if (n === grown || SG.on) return; shadowDirty = treesDirty = true; // nothing is built or pulled down during a siege: its roads are painted over the town's
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
  // The trees: each one is a record (a mesh on layer 1, which no camera draws) and all of them are drawn as one mesh, rebuilt whenever
  // one is hidden, burnt or added. The sway is done on the graphics card: each vertex leans by its height, in its own tree's phase.
  var swayU = { value: 0 }, treeMesh = null, treesDirty = true, swayMat = null;
  function weldTrees() {
    treesDirty = false;
    var list = [], n = 0, at = 0, i, j, g;
    trees.forEach(function (m) {
      for (var p = m; p; p = p.parent) if (!p.visible) return;
      m.updateWorldMatrix(true, false); g = m.geometry.clone(); g.applyMatrix4(m.matrixWorld); list.push([g, m]); n += g.attributes.position.count;
    });
    if (treeMesh) { scene.remove(treeMesh); treeMesh.geometry.dispose(); treeMesh = null; }
    if (!list.length) return;
    var pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), sw = new Float32Array(n * 3);
    list.forEach(function (e) {
      var a = e[0].attributes, m = e[1], k = a.position.count, ry = m.rotation.y;
      pos.set(a.position.array, at * 3); nor.set(a.normal.array, at * 3); col.set(a.color.array, at * 3);
      for (j = 0; j < k; j++) { sw[(at + j) * 3] = m.userData.sway; sw[(at + j) * 3 + 1] = Math.cos(ry); sw[(at + j) * 3 + 2] = Math.sin(ry); }
      at += k; e[0].dispose();
    });
    g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3));
    g.setAttribute('color', new T.BufferAttribute(col, 3)); g.setAttribute('tswa', new T.BufferAttribute(sw, 3));
    if (!swayMat) {
      swayMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
      swayMat.onBeforeCompile = function (sh) {
        sh.uniforms.uClock = swayU;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 tswa; uniform float uClock;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat tsw = sin(uClock * 1.1 + tswa.x) * 0.018 * transformed.y; transformed.x -= tsw * tswa.y; transformed.z += tsw * tswa.z;');
      };
    }
    treeMesh = new T.Mesh(g, swayMat); treeMesh.castShadow = treeMesh.receiveShadow = true; treeMesh.frustumCulled = false;
    scene.add(treeMesh); shadowDirty = true;
  }
  function weld(root, into, keep) {
    var groups = {}, k, seen = {};
    root.traverse(function (o) {
      if (!o.isMesh) return;
      if (!o.userData.still) for (var p = o; p; p = p.parent) if (p.userData.dyn) return;
      var key = tagOf(o) + '|' + o.material.uuid + '|' + Object.keys(o.geometry.attributes).sort().join() + '|' + o.castShadow + o.receiveShadow;
      (groups[key] || (groups[key] = [])).push(o);
    });
    for (k in groups) {
      var list = groups[k], tg = tagOf(list[0]);
      if (tg && !seen[tg]) { seen[tg] = true; PART[tg] = []; }
      if (!keep && list.length < 2) { if (tg) PART[tg].push(list[0]); continue; }
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
      into.add(m); if (tg) PART[tg].push(m);
    }
  }
  // A tag on a piece, or on a group it stands in, keeps it apart in the weld, so that a siege can take it away: PART[tag] lists its meshes.
  function tagOf(o) { for (var p = o; p; p = p.parent) if (p.userData.tag) return p.userData.tag; return ''; }

  // ---------- Post-processing: tilt-shift, bloom, colour ----------
  function buildPost() {
    rt = new T.WebGLRenderTarget(4, 4, { minFilter: T.LinearFilter, magFilter: T.LinearFilter });
    rt.texture.encoding = T.sRGBEncoding;
    rt.depthTexture = new T.DepthTexture(4, 4, T.UnsignedIntType); // the default 16-bit depth z-fights on the ground layers
    var m = new T.ShaderMaterial({
      uniforms: { tD: { value: rt.texture }, res: { value: new T.Vector2(4, 4) }, war: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: [
        'uniform sampler2D tD; uniform vec2 res; uniform float war; varying vec2 vUv;',
        'void main(){',
        '  vec2 px = 1.0 / res;',
        '  float blur = smoothstep(0.17, 0.5, abs(vUv.y - 0.5)) * res.y * 0.0045;',
        '  vec3 col = vec3(0.0); vec3 glow = vec3(0.0);',
        '  if (blur < 0.5) col = texture2D(tD, vUv).rgb;', // the middle band is sharp: one read is the same as ten identical ones
        '  for (int i = 0; i < 10; i++) {',
        '    float a = float(i) * 2.39996; float r = sqrt((float(i) + 0.5) / 10.0);',
        '    vec2 o = vec2(cos(a), sin(a)) * r;',
        '    if (blur >= 0.5) col += texture2D(tD, vUv + o * px * blur).rgb;',
        '    vec3 b = texture2D(tD, vUv + o * px * res.y * 0.016).rgb;',
        '    glow += max(b - 0.86, 0.0);',
        '  }',
        '  if (blur >= 0.5) col /= 10.0; col += glow / 10.0 * 1.5;',
        '  float l = dot(col, vec3(0.299, 0.587, 0.114));',
        '  col = mix(vec3(l), col, 1.2);',
        '  col = mix(col, col * col * (3.0 - 2.0 * col), 0.3);',
        '  col = mix(col, vec3(col.r * 0.95 + col.g * 0.55, col.g * 0.52 + col.r * 0.1, col.b * 0.5 + col.r * 0.06), war);', // a siege reddens everything
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
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false; // the shadows come from things that stand still: drawn again only when one of them changes (see shadowDirty)
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
    var aq = /[?&]at=(-?[\d.]+),(-?[\d.]+)/.exec(location.search); if (aq) { TARGET.x = +aq[1]; TARGET.z = +aq[2]; } // debug: look at this place
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
    if (sun.shadow.mapSize.x !== ms) { sun.shadow.mapSize.set(ms, ms); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } shadowDirty = true; }
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
  W.zoom = function (delta) { zoom = Math.max(0.75, Math.min(2.4, zoom * (delta > 0 ? 0.9 : 1.1))); resize(); W.pan(0, 0); };
  // Slide the view by so many screen pixels, as if the map were dragged. It stops where the painted country stops: the closer
  // the view, the further it may wander.
  var HOME = [-2.5, -1.5];
  W.pan = function (dx, dy) {
    var upp = (camera.top - camera.bottom) / window.innerHeight, fx = -Math.cos(yaw), fz = -Math.sin(yaw), lim = Math.max(6, 60 - 36 / zoom);
    var x = TARGET.x - (-fz) * dx * upp + fx * dy * upp / Math.sin(Math.atan(Math.SQRT1_2));
    var z = TARGET.z - fx * dx * upp + fz * dy * upp / Math.sin(Math.atan(Math.SQRT1_2));
    TARGET.x = Math.max(HOME[0] - lim, Math.min(HOME[0] + lim, x)); TARGET.z = Math.max(HOME[1] - lim, Math.min(HOME[1] + lim, z));
  };

  // stage: 0..5, frac: 0..1 progress inside the stage
  W.setSchool = function (stage, frac) {
    frac = frac || 0;
    var sig = stage + '|' + frac.toFixed(3); if (sig !== schoolSig) { schoolSig = sig; shadowDirty = true; }
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
  var shadowDirty = true, shadowAcc = 0, shadowF = -1, schoolSig = '';
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
    if (treesDirty) weldTrees();
    swayU.value = clock;

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
    siegeFx(dt);

    shadowAcc += dt;
    if (pulse > 0 || shadowDirty || shadowAcc > 0.5 || Math.abs(dayF - shadowF) > 0.0005) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; shadowAcc = 0; shadowF = dayF; }
    renderer.info.reset();
    if (post) {
      renderer.setRenderTarget(rt); renderer.render(scene, camera);
      renderer.setRenderTarget(null); renderer.render(post.scene, post.cam);
    } else renderer.render(scene, camera);
    stats.calls = renderer.info.render.calls; stats.tris = renderer.info.render.triangles;
  };

  // ---------- The siege ----------
  // After the school is finished the town is defended: roads to the edge of the map, posts raised beside them, the enemy walking in,
  // and more and more signs of war as the defence grows.
  var SG = { on: false, routes: [], paint: [], warPaint: [], hidden: [], undo: [], smokeSrc: [], ruined: {}, war: -1, pools: {}, fx: [], key: '' };
  var BLOCKS = [[-17.6, -26.4, -8.6, -13.6], [-26.6, -21.8, -18.4, -15.6], [-24, -12.7, -19, -6.7], [-9.6, -15.8, -3.4, -10.8], [0.2, 1.4, 8.2, 7]]; // church, convento, tribunal, the Ibarras, the school
  var V3 = function (x, y, z) { return new T.Vector3(x, y, z); };
  var FRIAR = { robe: 0x6e4a32, cord: 0xfff6e0, hair: 0x4a3020, style: 'tonsure', skin: 0xe6bc9c };
  var FILI = { hat: 'salakot', top: 0xf4ecd8, bottom: 0x6a4a34, sash: 0xd8222a };

  // The point of the ground under a point of the screen.
  W.pick = function (cx, cy) {
    var v = V3(cx / window.innerWidth * 2 - 1, 1 - cy / window.innerHeight * 2, -1).unproject(camera), d = new T.Vector3();
    camera.getWorldDirection(d);
    var t = -v.y / d.y; return [v.x + d.x * t, v.z + d.z * t];
  };
  // Dry, open ground: not water, not under a building or a hut.
  W.free = function (x, z) {
    if (Math.abs(x) > MAP - 1 || Math.abs(z) > MAP - 1) return false;
    if (!groundTex.image.getContext('2d').getImageData(Math.floor((x + MAP) * 16), Math.floor((z + MAP) * 16), 1, 1).data[3]) return false;
    var i, k;
    for (i = 0; i < BLOCKS.length; i++) if (x > BLOCKS[i][0] && x < BLOCKS[i][2] && z > BLOCKS[i][1] && z < BLOCKS[i][3]) return false;
    for (i = 0; i < solid.length; i++) if (Math.hypot(x - solid[i][0], z - solid[i][1]) < 2) return false;
    for (k = 0; k < grown; k++) if (GROW[k].hut && Math.hypot(x - GROW[k].hut[0], z - GROW[k].hut[1]) < 2) return false;
    return true;
  };

  function clear(group) { while (group.children.length) { var m = group.children[0]; group.remove(m); if (m.geometry) m.geometry.dispose(); } }
  function weldInto(group, build) { // build(root) makes the pieces; they end as one mesh for each material
    clear(group);
    var root = new T.Group(); build(root); root.updateMatrixWorld(true); weld(root, group, true);
    root.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
  }
  function across(x, z) { // the turn that sets something square across the nearest road
    var best = 1e9, r = 0;
    SG.routes.forEach(function (rt) { for (var i = 1; i < rt.length; i++) { var d = segD(x, z, rt[i - 1], rt[i]); if (d < best) { best = d; r = Math.atan2(-(rt[i][0] - rt[i - 1][0]), -(rt[i][1] - rt[i - 1][1])); } } });
    return r;
  }

  // routes: the roads the enemy comes by, or null when there is no siege.
  W.siege = function (routes) {
    if (!!routes === SG.on) return;
    SG.on = !!routes; shadowDirty = treesDirty = true;
    if (!routes) {
      W.setWar(-1); W.setTowers([]); W.setFoes([]); W.ghost(); W.setPaths(0);
      while (SG.paint.length) Art.groundRestore(groundTex, SG.paint.pop());
      SG.hidden.forEach(function (h) { h.visible = true; }); SG.hidden = []; SG.routes = [];
      if (post) post.mat.uniforms.war.value = 0;
      return;
    }
    SG.routes = routes;
    routes.forEach(function (r) {
      var roads = [], b = [1e9, 1e9, -1e9, -1e9], i;
      for (i = 0; i < r.length; i++) { b[0] = Math.min(b[0], r[i][0] - 1.5); b[1] = Math.min(b[1], r[i][1] - 1.5); b[2] = Math.max(b[2], r[i][0] + 1.5); b[3] = Math.max(b[3], r[i][1] + 1.5); if (i) roads.push([r[i - 1], r[i], 1.1]); }
      SG.paint.push(Art.groundPatch(groundTex, MAP, { roads: roads, box: b }));
      trees.forEach(function (m) { // the road is cut through whatever stood on it
        var h = m; if (!h.visible) return;
        for (i = 0; i < roads.length; i++) if (segD(h.position.x, h.position.z, roads[i][0], roads[i][1]) < 1.6) { h.visible = false; SG.hidden.push(h); return; }
      });
    });
    W.setWar(0);
  };

  // ---------- What war does to the town ----------
  // One step for every day held, 0 to 30. STEP[n](g, now) lays down what that day leaves (g: what stands still; now: the step the
  // town is at). Whatever a step hides, repaints or swaps is noted in SG.undo, so that the whole town can be put back and laid out
  // again from step 0 each time the count changes.
  function wHide(o) { if (o && o.visible) { o.visible = false; SG.undo.push(function () { o.visible = true; }); } }
  function wPart(tag) { (PART[tag] || []).forEach(wHide); }
  function wMat(m, material) { var old = m.material; m.material = material; SG.undo.push(function () { m.material = old; }); }
  function wPaint(p) { SG.warPaint.push(Art.groundPatch(groundTex, MAP, p)); }
  function wScorch(x, z, r) { wPaint({ scorch: [[x, z, r]], box: [x - r - 1.5, z - r - 1.5, x + r + 1.5, z + r + 1.5] }); }
  function wDry(r) { wPaint({ dry: [r], box: r }); }
  function wSmoke(x, y, z, h) { if (SG.smokeSrc.length < 44) SG.smokeSrc.push([x, y, z, h || 5]); }
  function has(i) { return grown > i; } // has that household of the grown town settled?
  function sub(g0, x, z, rot) { var g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rot || 0; g0.add(g); return g; }
  function hsh(a, b) { return Art.hash(a * 1.37 + 0.11, b * 2.91 + 0.7); }

  // Defences.
  function sacks(g0, x, z, rot) {
    var g = sub(g0, x, z, rot == null ? across(x, z) : rot), i;
    for (i = 0; i < 5; i++) box(g, 0.6, 0.26, 0.42, i % 2 ? 0xc9b48a : 0xb8a276, -1.24 + i * 0.62, 0, 0);
    for (i = 0; i < 4; i++) box(g, 0.6, 0.26, 0.42, i % 2 ? 0xb8a276 : 0xd2be94, -0.93 + i * 0.62, 0.26, 0);
    return g;
  }
  function barricade(g0, x, z, rot) {
    var g = sacks(g0, x, z, rot);
    [-1, 0, 1].forEach(function (k) {
      beam(g, V3(k * 1.1 - 0.4, 0, 0.75), V3(k * 1.1 + 0.4, 1.05, 0.25), 0.045, 0x7a5234); beam(g, V3(k * 1.1 + 0.4, 0, 0.75), V3(k * 1.1 - 0.4, 1.05, 0.25), 0.045, 0x7a5234);
    });
    beam(g, V3(-1.6, 0.55, 0.5), V3(1.6, 0.55, 0.5), 0.04, 0x8a6238);
  }
  function stakes(g0, x, z, rot) {
    var g = sub(g0, x, z, rot == null ? across(x, z) : rot);
    for (var i = 0; i < 7; i++) beam(g, V3(-1.5 + i * 0.5, 0, 0.2), V3(-1.5 + i * 0.5, 1.1, -0.55), 0.05, i % 2 ? 0x8a6238 : 0x7a5234);
    beam(g, V3(-1.7, 0.4, -0.05), V3(1.7, 0.4, -0.05), 0.04, 0x6b4a2e);
  }
  function tent(g, x, z, rot) { var r = roof(g, 2.3, 1.7, 1.25, 'plaster', x, 0, z, 0xe6dcc0); r.rotation.y = rot || 0; cyl(g, 0.03, 0.03, 1.5, 0x6b4a2e, x, 0, z, 5); }
  function banner(g, x, z, h) { cyl(g, 0.045, 0.06, h, 0x6b4a2e, x, 0, z, 5); box(g, 0.95, 0.6, 0.04, 0xc81e28, x + 0.5, h - 0.68, z); }
  function crates(g, x, z) { tbox(g, 0.7, 0.6, 0.7, 'wood', x, 0, z, 0xffe2c0, 1); tbox(g, 0.6, 0.5, 0.6, 'wood', x + 0.75, 0, z + 0.1, 0xf0d0a8, 1); tbox(g, 0.55, 0.5, 0.55, 'wood', x + 0.3, 0.6, z, 0xffe2c0, 1); }
  function fire(g, x, y, z, s) {
    if (SG.war >= 30) return; // the last day puts every fire out
    if (!mats.fire) mats.fire = new T.MeshBasicMaterial({ color: 0xffa030 });
    var f = new T.Mesh(new T.ConeGeometry(0.26 * s, 0.75 * s, 6), mats.fire); f.position.set(x, y + 0.37 * s, z); g.add(f);
    var f2 = new T.Mesh(new T.ConeGeometry(0.15 * s, 0.5 * s, 5), mats.fire); f2.position.set(x + 0.2 * s, y + 0.25 * s, z + 0.1 * s); g.add(f2);
  }
  function watchfire(g, x, z) {
    for (var i = 0; i < 3; i++) { var l = box(g, 0.9, 0.14, 0.14, 0x4a3424, x, 0.02, z); l.rotation.y = i * 1.05; }
    fire(g, x, 0.1, z, 1);
  }
  function cart(g0, x, z, rot, over) {
    var g1 = sub(g0, x, z, rot), g = new T.Group(); g1.add(g);
    if (over) { g.rotation.x = 1.8; g.position.set(0, 0.5, 0.2); }
    tbox(g, 1.7, 0.1, 0.95, 'wood', 0, 0.5, 0, 0xffe2c0, 1);
    [-0.45, 0.45].forEach(function (s) {
      tbox(g, 1.7, 0.4, 0.06, 'wood', 0, 0.6, s, 0xf0d0a8, 1);
      var w = cyl(g, 0.42, 0.42, 0.08, 0x6b4a2e, -0.2, 0.42, s * 1.3 - 0.04, 10); w.rotation.x = Math.PI / 2;
      beam(g, V3(0.85, 0.5, s * 0.7), V3(1.95, over ? 0.5 : 0.12, s * 0.7), 0.035, 0x8a6238);
    });
  }
  function barrel(g, x, z) { cyl(g, 0.28, 0.25, 0.7, 0x8a5a2e, x, 0, z, 8); cyl(g, 0.3, 0.3, 0.06, 0x3a3440, x, 0.14, z, 8); cyl(g, 0.3, 0.3, 0.06, 0x3a3440, x, 0.5, z, 8); }
  function pews(g0, x, z, rot) { // benches dragged out of the church and piled up
    var g = sub(g0, x, z, rot);
    [[0, 0, 0, 0], [0.15, 0.42, 0.25, 0.1], [-0.2, 0, 0.75, -0.12], [0.1, 0.84, 0.1, -0.2], [0.3, 0.42, 0.85, 0.3]].forEach(function (p) {
      var b = sub(g, p[0], p[2], p[3]); b.position.y = p[1];
      box(b, 1.9, 0.1, 0.42, 0x7a4a26, 0, 0.3, 0); box(b, 1.9, 0.5, 0.07, 0x6b4226, 0, 0.3, -0.2); box(b, 0.08, 0.3, 0.4, 0x5a3820, -0.9, 0, 0); box(b, 0.08, 0.3, 0.4, 0x5a3820, 0.9, 0, 0);
    });
  }
  function junk(g0, x, z, rot) { // whatever the houses could spare: a table, a chest, a door, a wardrobe on its side
    var g = sub(g0, x, z, rot), t;
    tbox(g, 1.3, 0.08, 0.8, 'wood', -0.7, 0.62, 0, 0xffe2c0, 1); [[-1.25, -0.3], [-0.15, -0.3], [-1.25, 0.3], [-0.15, 0.3]].forEach(function (p) { box(g, 0.08, 0.62, 0.08, 0x7a5234, p[0], 0, p[1]); });
    t = tbox(g, 1.6, 0.6, 0.7, 'wood', 0.75, 0, 0, 0xd8a878, 1); t.rotation.y = 0.2;
    t = box(g, 0.9, 1.5, 0.07, 0x5a3820, 0.2, 0, 0.45); t.rotation.x = -0.35;
    tbox(g, 0.6, 0.45, 0.5, 'wood', -0.6, 0.7, 0, 0xc89868, 1);
  }
  function hullOver(g0, x, z, rot, color) { var g = sub(g0, x, z, rot); box(g, 2.3, 0.26, 0.5, color, 0, 0, 0); box(g, 2.1, 0.1, 0.3, 0x7a4a2a, 0, 0.26, 0); box(g, 2.3, 0.05, 0.08, 0x5a3a20, 0, 0.36, 0); }

  // The dead, and what is broken.
  function corpse(g0, x, z, rot, cloth, shroud, y) {
    var g = sub(g0, x, z, rot); g.position.y = y || 0;
    if (shroud) { box(g, 0.36, 0.2, 1.1, 0xe8e0cc, 0, 0.02, 0); box(g, 0.38, 0.05, 0.07, 0x9a8a6a, 0, 0.19, 0.3); box(g, 0.38, 0.05, 0.07, 0x9a8a6a, 0, 0.19, -0.3); return; }
    box(g, 0.36, 0.16, 0.5, cloth, 0, 0.02, 0.05); box(g, 0.8, 0.08, 0.13, cloth, 0, 0.03, 0.2);
    box(g, 0.3, 0.13, 0.5, 0x4a4050, 0, 0.02, -0.44); box(g, 0.2, 0.18, 0.2, 0xd9a877, 0, 0.02, 0.42);
  }
  function crow(g, x, y, z) { box(g, 0.26, 0.14, 0.13, 0x16121c, x, y, z); box(g, 0.1, 0.1, 0.1, 0x16121c, x + 0.15, y + 0.1, z); box(g, 0.07, 0.03, 0.04, 0xd8a236, x + 0.23, y + 0.13, z); }
  function rubble(g, x, z, n, color, r, y) {
    for (var i = 0; i < n; i++) {
      var a = hsh(i + x, z) * 6.28, d = Math.sqrt(hsh(i, x + z)) * r, s = 0.16 + hsh(i * 3, x) * 0.3, b = box(g, s * 1.4, s * 0.7, s, color, x + Math.cos(a) * d, y || 0, z + Math.sin(a) * d);
      b.rotation.y = a;
    }
  }
  var CHAR = 0x241c1c;
  function rafters(g, x, y, z, w, d, n) { // what is left of a roof: charred beams lying across the walls
    for (var i = 0; i < n; i++) {
      var k = (i + 0.5) / n - 0.5, lean = hsh(i, x) * 1.6;
      beam(g, V3(x + k * w, y + 0.05, z - d / 2), V3(x + k * w + (hsh(i, z) - 0.5) * 0.8, y + 0.1 + lean, z + d / 2 * (0.3 + hsh(i, 7) * 0.7)), 0.07, CHAR);
    }
    beam(g, V3(x - w / 2, y + 0.12, z - d * 0.2), V3(x + w * 0.3, y + 0.5, z + d * 0.1), 0.08, CHAR);
  }
  function stubs(g, x, y, z, w, d, h) { // the ragged, burnt remains of the upper walls
    var i, n = Math.round(w / 0.8), m = Math.round(d / 0.8);
    for (i = 0; i < n; i++) { box(g, w / n, 0.2 + hsh(i, x) * h, 0.14, i % 2 ? 0x2e2422 : CHAR, x - w / 2 + (i + 0.5) * w / n, y, z + d / 2 - 0.07); box(g, w / n, 0.2 + hsh(i, z) * h, 0.14, CHAR, x - w / 2 + (i + 0.5) * w / n, y, z - d / 2 + 0.07); }
    for (i = 0; i < m; i++) { box(g, 0.14, 0.2 + hsh(i + 9, x) * h, d / m, i % 2 ? CHAR : 0x2e2422, x - w / 2 + 0.07, y, z - d / 2 + (i + 0.5) * d / m); box(g, 0.14, 0.2 + hsh(i + 5, z) * h, d / m, CHAR, x + w / 2 - 0.07, y, z - d / 2 + (i + 0.5) * d / m); }
  }
  function gutted(g, x, y, z, w, d, n) { box(g, w - 0.3, 0.05, d - 0.3, 0x18121a, x, y, z); stubs(g, x, y, z, w, d, 1.3); rafters(g, x, y, z, w - 0.6, d - 0.4, n); }
  // A hut whose stilts were cut: it has tipped over and its roof has slid off.
  function kuboFallen(g0, x, z, rot) {
    var g = sub(g0, x, z, rot), m;
    [[-0.8, -0.6, 0.32], [0.8, -0.6, 0.16], [-0.8, 0.6, 0.26], [0.8, 0.6, 0.12]].forEach(function (p) { cyl(g, 0.07, 0.07, p[2], 0x7a5234, p[0], 0, p[1], 5); });
    m = tbox(g, 2.1, 0.12, 1.7, 'wood', 0.25, 0.02, 0.1); m.rotation.z = -0.4;
    m = tbox(g, 2, 1.0, 1.6, 'sawali', 0.4, 0.1, 0.1, 0xd0bc98); m.rotation.z = -0.4;
    m = roof(g, 2.8, 2.4, 1.25, 'nipa', 1.5, 0.2, 0.3, 0xa89878); m.rotation.z = -1.0; m.rotation.y = 0.3;
    beam(g, V3(0.9, 0.9, -0.9), V3(2.4, 1.5, 0.1), 0.04, 0x7a5234); beam(g, V3(1.2, 0.4, 1.2), V3(2.3, 1.3, 0.5), 0.04, 0x7a5234);
    [[-1.4, 0.9, 0.4], [-1.6, -0.3, 1.9], [-0.7, 1.5, 2.6], [-1.1, -1.2, 0.9]].forEach(function (p) { var l = box(g, 1.2, 0.08, 0.1, 0x8a6238, p[0], 0.02, p[1]); l.rotation.y = p[2]; });
    [[-0.5, 1.5], [0.3, -1.4], [-1.5, -0.9], [2.6, -1.1], [2.9, 1]].forEach(function (p, i) { var t = box(g, 0.7, 0.05, 0.5, i % 2 ? 0xc9a66b : 0xa89060, p[0], 0.02, p[1]); t.rotation.y = i * 1.1; });
  }
  // A hut burnt down to its posts.
  function kuboBurnt(g0, x, z, rot) {
    var g = sub(g0, x, z, rot), m;
    [[-0.8, -0.6, 1.5], [0.8, -0.6, 0.8], [-0.8, 0.6, 2.1], [0.8, 0.6, 1.2]].forEach(function (p) { cyl(g, 0.07, 0.07, p[2], CHAR, p[0], 0, p[1], 5); });
    m = box(g, 2.1, 0.08, 1.7, 0x2e2422, 0, 0.5, 0); m.rotation.z = 0.14;
    beam(g, V3(-0.8, 2.1, 0.6), V3(0.7, 0.62, 0.2), 0.05, CHAR); beam(g, V3(-0.8, 1.5, -0.6), V3(0.9, 0.66, -0.5), 0.05, CHAR); beam(g, V3(-0.8, 1.9, 0.6), V3(-0.8, 1.4, -0.6), 0.05, CHAR);
    rubble(g, 0, 0, 9, CHAR, 1.5); rubble(g, 0.3, 0.2, 4, 0x6a625e, 1.2);
    wScorch(x, z, 1.7); wSmoke(x, 0.8, z, 4);
  }
  var KUBO = {}; // every hut by its tag: [x, z, turn]
  function ruin(g, tag, burnt) {
    var k = KUBO[tag]; if (!k || SG.ruined[tag] || !PART[tag] || (tag.charAt(0) === 'g' && !has(+tag.slice(1)))) return;
    SG.ruined[tag] = true; wPart(tag); (burnt ? kuboBurnt : kuboFallen)(g, k[0], k[1], k[2]);
  }
  // An open pit with the dead thrown in.
  function pit(g0, x, z, w, d, n, rot) {
    var g = sub(g0, x, z, rot), cloth = [0xf4ecd8, 0xe0563a, 0x3a6aa0, 0x3aa69a, 0xd8d0c0], i;
    box(g, w, 0.05, d, 0x1e1612, 0, 0, 0);
    box(g, w + 0.6, 0.24, 0.32, 0x8f6f45, 0, 0, -d / 2 - 0.16); box(g, w + 0.6, 0.12, 0.3, 0x9a7648, 0, 0, d / 2 + 0.15);
    box(g, 0.32, 0.2, d, 0x9a7648, -w / 2 - 0.16, 0, 0); box(g, 0.32, 0.16, d, 0x8f6f45, w / 2 + 0.16, 0, 0);
    cyl(g, 0.2, 1.0, 0.8, 0x9a7648, -w / 2 - 1.3, 0, -0.4, 7); cyl(g, 0.15, 0.75, 0.55, 0x8f6f45, -w / 2 - 1.1, 0, 0.9, 7); cyl(g, 0.15, 0.8, 0.6, 0x9a7648, 0.4, 0, -d / 2 - 1, 7);
    for (i = 0; i < n; i++) corpse(g, -w / 2 + 0.55 + hsh(i, w) * (w - 1.1), -d / 2 + 0.6 + hsh(i, d + 3) * (d - 1.2), hsh(i, 11) * 6.28, cloth[i % 5], i % 3 === 0, 0.05 + (i % 3) * 0.1);
    beam(g, V3(w / 2 + 0.6, 0, 0.4), V3(w / 2 + 0.85, 1.2, 0.2), 0.03, 0x8a6238); box(g, 0.22, 0.26, 0.03, 0x8c8fa6, w / 2 + 0.6, 0, 0.4);
  }
  function fellPalm(g, i, ang) {
    var h = palms[i]; if (!h || !h.visible) return;
    wHide(h); palmLog(g, h.position.x, h.position.z, ang, true);
  }
  function palmLog(g, x, z, ang, stump) {
    var dx = Math.sin(ang), dz = Math.cos(ang), L = 3.6, k;
    if (stump) cyl(g, 0.13, 0.17, 0.4, 0x7a5632, x, 0, z, 6);
    beam(g, V3(x + dx * 0.35, 0.16, z + dz * 0.35), V3(x + dx * L, 0.2, z + dz * L), 0.13, 0x8a6238);
    for (k = 0; k < 5; k++) { var a = ang + (k - 2) * 0.55, f = box(g, 0.34, 0.06, 1.6, new T.Color(k % 2 ? 0x4fae45 : 0x2b7a3c).convertSRGBToLinear().getHex(), x + dx * L + Math.sin(a) * 0.75, 0.06 + k * 0.03, z + dz * L + Math.cos(a) * 0.75); f.rotation.y = a; }
  }
  // test(x, z, chance) says what becomes of each tree: 1 it stands burnt, 2 only a charred stump is left.
  function burnTrees(g, test) {
    trees.forEach(function (m, i) {
      var h = m; if (!h.visible || !h.parent.visible) return;
      var k = test(h.position.x, h.position.z, Art.hash(i * 7 + 3, 11)); if (!k) return;
      if (k === 2) { wHide(h); cyl(g, 0.1, 0.17, 0.55, CHAR, h.position.x, 0, h.position.z, 6); return; }
      if (m.userData.burnt) return;
      var green = m.geometry; m.userData.burnt = true; m.geometry = treeGeo(m.userData.kind, m.userData.v, true); // bare and black: not a leaf left
      SG.undo.push(function () { m.userData.burnt = false; m.geometry = green; });
    });
  }
  // The point `back` units before the end of a road, and the way the road runs there.
  function along(rt, back) {
    for (var i = rt.length - 1; i > 0; i--) {
      var a = rt[i - 1], b = rt[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (back <= L || i === 1) { var t = Math.min(1, back / L); return [b[0] + (a[0] - b[0]) * t, b[1] + (a[1] - b[1]) * t, (b[0] - a[0]) / L, (b[1] - a[1]) / L]; }
      back -= L;
    }
  }
  // Besides what each day names, every day held sets one more thing down at the edge of a road in use.
  function defences(g, n) {
    for (var s = 1; s <= n; s++) {
      var nr = s >= 12 ? 3 : s >= 6 ? 2 : 1, rt = SG.routes[s % nr], side = s % 2 ? 1 : -1, back = 7 + hsh(s, 5) * 40, p, x, z, t;
      for (t = 0; t < 5; t++, back += 3.1) { p = along(rt, back); x = p[0] - p[3] * side * 1.3; z = p[1] + p[2] * side * 1.3; if (W.free(x, z)) break; }
      if (t === 5) continue;
      var rot = Math.atan2(-p[2], -p[3]);
      if (s % 5 === 0) sacks(g, x, z, rot); else if (s % 5 === 1) cart(g, x, z, rot + 1.2, s % 4 === 1); else if (s % 5 === 2) stakes(g, x, z, rot);
      else if (s % 5 === 3) { barrel(g, x, z); barrel(g, x + 0.62, z + 0.2); crates(g, x - 1.3, z - 0.3); } else junk(g, x, z, rot);
    }
  }

  var STALLS = [[-17.2, -7.3, 0xe8463a], [-10.8, -7.3, 0x2f86e0], [-17.6, -11.9, 0xf7b21a], [-10.4, -11.9, 0x3fba5e]];
  var HAY = [[1, -35.2, -19.6], [6, -42.8, -1.4], [8, -43.2, -27], [18, -31.4, -39.4]]; // [household, x, z]
  var SCORCH = [[-36, -10, 2.2], [-6, 1.6, 1.3], [-20.5, 0.8, 1.6], [14, 9.4, 1.5], [-31, 21, 1.8], [-24.5, -34, 2], [26, 13.4, 1.7], [-44, -6, 2.4], [-11, -1.2, 1.2], [-34.5, 5.5, 1.5],
    [3, 11.2, 1.4], [-27.5, -18.6, 1.7], [34, 9.6, 2.2], [-41.5, 31, 2], [-18.4, -3.2, 1.3], [-48, -12, 2.6], [8.6, 14.6, 1.6], [-22, -41, 2.3], [-3, -2, 1.1], [44, 15.5, 2.4]];
  var CH = [-14, -20.2], CV = [-22.5, -18.7], TW = [-9.4, -15.6]; // church, convento, bell tower
  var STEP = [];
  STEP[0] = function (g) { barricade(g, -3, 0.3); banner(g, 8.8, 7, 4.2); crates(g, 0.2, 8.6); };

  // ----- The town shuts itself in -----
  STEP[1] = function (g) { // the fiesta is over: bunting down, awnings folded, the colonial flag struck; carts and crates on the graveyard road
    wPart('bunt'); wPart('awn'); wPart('fruit'); wPart('trFlag');
    STALLS.forEach(function (s) { var r = box(g, 1.7, 0.16, 0.2, s[2], s[0], 0.56, s[1]); r.rotation.y = s[1] < -10 ? Math.PI / 2 : 0; });
    cart(g, -31.3, 7.6, 0.3, false); crates(g, -29.4, 6.2); barrel(g, -31.6, 6.1);
  };
  STEP[2] = function (g) { // washing taken in, the hens gone; sacks and stakes at the way into the plaza
    wPart('wash'); barricade(g, -14, -5); stakes(g, -17.8, -5.3); sacks(g, -10.4, -5.6, 0);
  };
  STEP[3] = function (g) { // the boats are pulled up and turned over; a cart is thrown across the bridge road
    hullOver(g, -27.4, 18.5, 0.3, 0x2f86e0); hullOver(g, -23.6, 18.2, -0.2, 0xe0463a); hullOver(g, -19.9, 19.2, 0.5, 0xf7c930);
    cart(g, 15.4, 13.3, 0.4, true); crates(g, 13.2, 13.1);
  };
  STEP[4] = function (g) { // tents on the plaza; the nearest paddies are trampled
    tent(g, -16.1, -9.7, 0.2); tent(g, -11.9, -9.6, -0.2); tent(g, -2.4, 8.4, 0.5); crates(g, -13, -12.9); banner(g, -16.6, -13.3, 5.2); banner(g, -11.4, -13.3, 5.2);
    wDry([-34.3, -16.9, -29.6, -3.4]);
  };
  STEP[5] = function (g) { // the church windows are shot out; its benches are piled before the door
    SG.undo.push(function () { glassMat.map = glassMat.emissiveMap = Art.one('stained'); mats.rose.map = mats.rose.emissiveMap = Art.one('rose'); });
    glassMat.map = glassMat.emissiveMap = Art.one('stainedBroken'); mats.rose.map = mats.rose.emissiveMap = Art.one('roseBroken');
    pews(g, -14, -12.9, 0.1); rubble(g, -14, -13.4, 7, 0x8ab0e0, 2.6); rubble(g, -11.9, -13.5, 5, 0xe0463a, 1.2); rubble(g, -16.1, -13.5, 5, 0xf7c930, 1.2);
  };
  STEP[6] = function (g) { // palms are felled across the road behind the church; the first watchfires
    fellPalm(g, 4, 1.2); fellPalm(g, 9, 0.9); fellPalm(g, 10, 2.2);
    palmLog(g, -29.9, -19.6, 1.45); palmLog(g, -26.2, -20.6, -1.7); palmLog(g, -29.6, -27.4, 1.3, true);
    watchfire(g, -14, -7.6); watchfire(g, 1.6, 9.2); watchfire(g, -25.6, 1.6);
  };

  // ----- The first shots land -----
  function roofHole(g, x, z) { // a ragged hole in the south slope of the convento's roof
    var P = [], n = 11, cu = 1.3, cv = 0.52, i;
    function pt(u, v) { return [x + u, 4.1 + 1.7 * v + 0.06, z + 3.05 * (1 - v) + 0.04]; }
    function rim(i) { var a = i / n * 6.283, r = (i % 2 ? 1 : 0.62) * (0.8 + hsh(i, 4) * 0.4); return pt(cu + Math.cos(a) * 1.05 * r, cv + Math.sin(a) * 0.3 * r); }
    for (i = 0; i < n; i++) { var a = pt(cu, cv), b = rim(i), c = rim((i + 1) % n); P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], a[0], a[1], a[2], c[0], c[1], c[2], b[0], b[1], b[2]); }
    var geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(P, 3)); geo.computeVertexNormals();
    g.add(new T.Mesh(geo, mats.hole || (mats.hole = new T.MeshBasicMaterial({ color: 0x120e16 }))));
    var m = pt(cu, cv);
    beam(g, V3(m[0] - 0.6, m[1] - 0.1, m[2] + 0.2), V3(m[0] - 0.2, m[1] + 0.7, m[2] + 0.5), 0.05, 0x5a3820); beam(g, V3(m[0] + 0.5, m[1], m[2]), V3(m[0] + 0.8, m[1] + 0.5, m[2] + 0.6), 0.05, 0x5a3820);
  }
  STEP[7] = function (g, now) { // a cannonball has gone through the convento's roof
    if (now < 25) { roofHole(g, CV[0], CV[1]); wSmoke(CV[0] + 1.3, 5.2, CV[1] + 1.4, 4); }
    rubble(g, CV[0] + 1.4, CV[1] + 3.9, 12, 0xc8523a, 1.5); rubble(g, CV[0] + 1, CV[1] + 3.6, 5, 0x7a5234, 1.2);
    sacks(g, -24.8, -13.6, 0);
  };
  STEP[8] = function (g) { // every paddy is dry, the haystacks are burnt, the gardens trampled
    wDry([has(6) ? -52.3 : -43, -16.9, -34.3, -3.4]); if (has(7)) wDry([-1.2, 29.8, 8.5, 36.4]);
    wPart('hay');
    HAY.forEach(function (h) { if (!has(h[0])) return; cyl(g, 0.3, 1.0, 0.3, CHAR, h[1], 0, h[2], 9); cyl(g, 0.05, 0.05, 1.2, CHAR, h[1], 0, h[2], 5); wScorch(h[1], h[2], 1.5); wSmoke(h[1], 0.4, h[2], 3.5); });
    GROW.forEach(function (s, i) { if (has(i)) (s.garden || []).forEach(wDry); });
  };
  STEP[9] = function (g) { // the carabao lies dead in the field
    var c = cattle[0]; wMat(c.userData.m, smat(Art.animal('deadbao'))); c.position.y = -0.12; SG.undo.push(function () { c.position.y = 0; });
    crow(g, -36.2, 0, -8.9); crow(g, -32.6, 0, -10.4);
  };
  STEP[10] = function (g) { ruin(g, 'k0'); }; // the first hut falls, its stilts cut
  STEP[11] = function (g) { // stakes and a second barricade round the school; banners
    stakes(g, 2.2, 0.9, 0); stakes(g, 6.2, 0.9, 0); stakes(g, -0.5, 4.4, Math.PI / 2); stakes(g, 9, 3.2, -Math.PI / 2);
    barricade(g, 9.4, 9.2); banner(g, -1.4, 3.4, 3.8); banner(g, 9.6, 1.4, 3.8); crates(g, 22.6, 12.4);
  };
  STEP[12] = function (g) { // the edge of the wood is burnt
    burnTrees(g, function (x, z, c) { return x > 14 && z < 34 && x + (z - 7) * 0.6 < 27.5 ? (c < 0.3 ? 2 : c < 0.9 ? 1 : 0) : 0; });
    wScorch(21, 6.6, 2.2); wScorch(23.5, 14.6, 2); wScorch(19.5, 19, 2.2); wScorch(25, 2.5, 1.8);
    wSmoke(21, 0.5, 6.6, 5); wSmoke(19.5, 0.5, 19, 5);
  };

  // ----- The town is hit -----
  STEP[13] = function (g) { // the old balete is down, half of it burnt
    var x = 29.4, z = 21, i;
    burnTrees(g, function (tx, tz) { return Math.abs(tx - x) + Math.abs(tz - z) > 0.1 && segD(tx, tz, [x, z], [x - 7.5, z + 5.6]) < 2.6 ? 2 : 0; });
    wHide(balete);
    cyl(g, 0.8, 1.05, 0.85, 0x5a4030, x, 0, z, 9); cyl(g, 0.12, 0.2, 1.5, 0x5a4030, x + 0.4, 0.5, z - 0.2, 5); cyl(g, 0.1, 0.18, 1.2, 0x6b4a2e, x - 0.3, 0.5, z + 0.3, 5);
    beam(g, V3(x - 1, 0.65, z + 0.8), V3(x - 4, 0.6, z + 3), 0.62, 0x6b4a2e); beam(g, V3(x - 4, 0.6, z + 3), V3(x - 7, 0.5, z + 5.2), 0.5, CHAR);
    [[-7, 5.2, -9.4, 5.4, 1.5], [-7, 5.2, -8.4, 7.6, 1.2], [-6, 4.4, -6.4, 7, 1.8], [-5, 3.7, -7.6, 2.6, 1.4], [-3, 2.2, -2.6, 4.6, 1.1]].forEach(function (b) { beam(g, V3(x + b[0], 0.5, z + b[1]), V3(x + b[2], b[4], z + b[3]), 0.16, CHAR); });
    for (i = 0; i < 6; i++) cyl(g, 0.5, 0.95, 0.6, i % 2 ? CHAR : 0x2f5a34, x - 5.4 - hsh(i, 2) * 4, 0, z + 2.6 + hsh(i, 8) * 5, 7);
    wScorch(x - 6.6, z + 5, 3); wSmoke(x - 6, 0.8, z + 4.6, 5); fire(g, x - 5, 0.9, z + 3.8, 1.2);
  };
  STEP[14] = function (g) { ruin(g, 'k3'); ruin(g, 'k2', true); fellPalm(g, 12, 2.4); fellPalm(g, 0, -0.6); }; // two more huts: one down, one burnt out
  STEP[15] = function (g) { // the market is smashed; cannonballs have cratered the plaza
    wPart('stall');
    STALLS.forEach(function (s, i) {
      var t = tbox(g, 1.7, 0.5, 0.8, 'wood', s[0], 0, s[1], 0xd8b890, 1); t.rotation.z = 0.5; t.rotation.y = i;
      t = box(g, 1.8, 0.04, 1.2, s[2], s[0] + 0.9, 0.03, s[1] + 0.5); t.rotation.y = i * 0.8 + 0.3;
      rubble(g, s[0], s[1], 7, 0x8a6238, 1.4);
      [0, 1, 2].forEach(function (k) { var p = box(g, 1.5, 0.05, 0.07, 0x8a6238, s[0] - 0.6 + k * 0.5, 0.02, s[1] - 0.7 + k * 0.4); p.rotation.y = k * 1.3 + i; });
    });
    [[-15.4, -8.4, 0.9], [-12.3, -10.9, 0.75], [-13.3, -7.2, 0.6], [-16.9, -10.2, 0.65]].forEach(function (c, i) {
      wScorch(c[0], c[1], c[2]); cyl(g, c[2] * 0.75, c[2] * 0.75, 0.04, 0x1e1612, c[0], 0.01, c[1], 9); rubble(g, c[0], c[1], 6, 0xa89878, c[2] + 0.5);
      var b = new T.Mesh(new T.SphereGeometry(0.17, 7, 6), mat(0x1c1a22)); add(g, b, c[0] + 0.2, 0.17, c[1] - 0.1 + i * 0.05);
    });
  };
  STEP[16] = function (g) { // rows of fresh graves outside the cemetery wall
    for (var i = 0; i < 12; i++) {
      var x = -37.6 + (i % 6) * 0.98, z = i < 6 ? 7.1 : 8.7;
      box(g, 0.5, 0.16, 1.1, i % 2 ? 0x8f6f45 : 0x9a7648, x, 0, z); cross(g, 0.55, 0x7a5234, x, 0.1, z - 0.62);
    }
    wPaint({ yards: [[-35.2, 7.9, 2.4], [-37, 7.9, 2], [-33.4, 7.9, 2]], box: [-41, 4, -30, 12] });
    beam(g, V3(-31.8, 0, 8.2), V3(-31.6, 1.2, 8), 0.03, 0x8a6238);
  };
  STEP[17] = function (g) { // the footbridge is half broken; a boat lies sunk by the shore
    wPart('brRail');
    var b = sub(g, BRIDGE[0], BRIDGE[1], -0.6435), h;
    beam(b, V3(-2.5, 0.82, -0.58), V3(-0.7, 0.82, -0.58), 0.045, 0xb07a3c); beam(b, V3(-0.7, 0.82, -0.58), V3(0.2, 0.3, -0.75), 0.045, 0xb07a3c);
    beam(b, V3(0.9, 0.82, 0.58), V3(2.5, 0.82, 0.58), 0.045, 0xb07a3c); beam(b, V3(-2.5, 0.82, 0.58), V3(-1.6, 0.82, 0.58), 0.045, 0xb07a3c);
    box(b, 0.6, 0.03, 0.85, 0x123a5a, 0.35, 0.31, 0.12); box(b, 0.45, 0.03, 0.7, 0x123a5a, -1.35, 0.31, -0.2); box(b, 0.3, 0.03, 0.5, 0x123a5a, 1.7, 0.31, 0.3);
    h = box(b, 1.1, 0.06, 0.3, 0x8a6238, 0.5, 0.3, 0.2); h.rotation.z = 0.5;
    h = sub(g, -19.6, 22.6, 0.9); h.rotation.z = 0.45; h.position.y = -0.12;
    box(h, 2.3, 0.26, 0.5, 0x7a4a2a, 0, 0, 0); box(h, 2.3, 0.08, 0.52, 0x3fba5e, 0, 0.2, 0); box(h, 1.2, 0.05, 0.08, 0xc9a66b, 0.3, 0.3, 0.5);
  };
  STEP[18] = function (g) { // the stone house at the end of the lane is burnt out
    if (!has(13)) return;
    var x = -0.5, z = -27.9;
    wPart('shTop'); gutted(g, x, 1.8, z, 4.4, 3.4, 5);
    rubble(g, x, z + 2.6, 10, 0xc8523a, 1.8); rubble(g, x - 2.8, z + 0.4, 6, CHAR, 1.2);
    wScorch(x, z + 2.4, 2.2); wSmoke(x, 2.2, z, 5); fire(g, x + 0.8, 1.85, z - 0.3, 1);
  };

  // ----- The dead -----
  STEP[19] = function (g) { // the bell tower has lost its roof; the bell lies on the ground
    wPart('twRoof');
    var p = bell.position.clone(); SG.undo.push(function () { bell.position.copy(p); bell.rotation.x = 0; });
    bell.position.set(6.6, 0.95, 7.9); bell.rotation.x = 1.25;
    beam(g, V3(TW[0] - 1.1, 10.1, TW[1] + 1.1), V3(TW[0] + 0.6, 10.9, TW[1] + 0.2), 0.07, CHAR); beam(g, V3(TW[0] + 1.1, 10.1, TW[1] - 1.1), V3(TW[0] + 0.1, 10.6, TW[1] + 0.9), 0.07, CHAR);
    rubble(g, TW[0] + 1.6, TW[1] + 3.2, 14, 0xc8523a, 2); rubble(g, TW[0] + 2.2, TW[1] + 2.6, 7, 0xe8dcc0, 1.6); wSmoke(TW[0], 10.2, TW[1], 4);
  };
  STEP[20] = function (g) { // the first open grave, beside the cemetery
    burnTrees(g, function (x, z) { return Math.hypot(x + 25.2, z - 10.2) < 3 || Math.hypot(x + 25.4, z - 14.4) < 3.4 ? 2 : 0; });
    pit(g, -25.2, 10.2, 3.6, 2.4, 9, 0.15);
    wPaint({ yards: [[-25.2, 10.2, 2.9], [-27.2, 10, 2]], box: [-31, 6, -21, 14.5] });
    crow(g, -23, 0.24, 9); crow(g, -27.6, 0.6, 9.9);
  };
  STEP[21] = function (g) { // more huts burnt to their posts; the second carabao is dead
    ruin(g, 'k4', true); ruin(g, 'k9', true); ruin(g, 'g0', true); ruin(g, 'g2', true); ruin(g, 'g4', true);
    var c = cattle[1]; if (has(7) && c) { wMat(c.userData.m, smat(Art.animal('deadbao'))); c.position.y = -0.12; SG.undo.push(function () { c.position.y = 0; }); }
  };
  STEP[22] = function (g) { // a second, larger pit; the shrouded dead in a row by the road; a cart of them
    pit(g, -25.4, 14.6, 4.6, 2.9, 15, -0.2);
    wPaint({ yards: [[-25.4, 14.6, 3.5], [-27.8, 14.4, 2.3]], box: [-32.5, 10, -20.5, 19.5] });
    for (var i = 0; i < 7; i++) corpse(g, -28.1, 3.6 + i * 0.62, Math.PI / 2 + (hsh(i, 3) - 0.5) * 0.3, 0, true);
    cart(g, -28.6, 17.6, 0.5, false);
    corpse(g, -28.7, 17.5, 0.5 + Math.PI / 2, 0xf4ecd8, false, 0.6); corpse(g, -28.3, 17.8, 0.5 + Math.PI / 2, 0, true, 0.6); corpse(g, -28.5, 17.6, 2.3, 0xe0563a, false, 0.78);
    crow(g, -24.4, 0.3, 16.3); crow(g, -28.2, 0.24, 5.4); crow(g, -28, 0.55, 14.2);
  };
  STEP[23] = function (g) { // the trees of the town are burnt stumps, the ground scorched
    burnTrees(g, function (x, z, c) { return x < 12 && x > -30 && z > -30 && z < 24 ? (c < 0.5 ? 2 : c < 0.9 ? 1 : 0) : 0; });
    SCORCH.slice(0, 12).forEach(function (s) { wScorch(s[0], s[1], s[2]); });
    fellPalm(g, 1, 1); fellPalm(g, 3, -2); fellPalm(g, 13, 0.4); fellPalm(g, 15, 2.8);
    wSmoke(-6, 0.4, 1.6, 4); wSmoke(-20.5, 0.4, 0.8, 4); wSmoke(-11, 0.4, -1.2, 4);
  };
  STEP[24] = function (g) { // Padre Salvi, the parish priest, is hanged before his own church
    var x = -14, z = -11.9, i;
    tbox(g, 2.8, 0.5, 1.9, 'wood', x, 0, z, 0xe0c098, 1);
    for (i = 0; i < 3; i++) box(g, 0.34, 0.5 - i * 0.16, 0.8, 0xb07a3c, x + 1.57 + i * 0.34, 0, z);
    cyl(g, 0.1, 0.11, 3.9, 0x6b4a2e, x - 1.1, 0.5, z - 0.55, 6);
    beam(g, V3(x - 1.1, 4.3, z - 0.55), V3(x + 0.7, 4.3, z - 0.55), 0.085, 0x6b4a2e); beam(g, V3(x - 1.1, 3.4, z - 0.55), V3(x - 0.3, 4.3, z - 0.55), 0.05, 0x6b4a2e);
    beam(g, V3(x + 0.3, 4.3, z - 0.55), V3(x + 0.3, 3.05, z - 0.55), 0.022, 0xe8dcc0);
    var f = figure(SG.warLive, FRIAR, x + 0.3, z - 0.55, 1.1); f.position.y = 1.15; f.children[1].visible = false;
    crow(g, x - 1.1, 4.4, z - 0.55); crow(g, x + 0.55, 4.38, z - 0.55);
  };

  // ----- Ruin -----
  STEP[25] = function (g) { // the convento is roofless and gutted
    wPart('cvRoof'); wPart('cvTop'); gutted(g, CV[0], 2.2, CV[1], 7, 5, 7);
    rubble(g, CV[0] - 1, CV[1] + 3.8, 14, 0xc8523a, 2.6); rubble(g, CV[0] - 4.6, CV[1], 9, CHAR, 1.6);
    wScorch(CV[0], CV[1] + 3.6, 2.6); wSmoke(CV[0] - 1.5, 2.6, CV[1], 6); wSmoke(CV[0] + 2, 2.6, CV[1] + 0.5, 5); fire(g, CV[0] + 1.6, 2.25, CV[1] + 0.6, 1.2); fire(g, CV[0] - 2, 2.25, CV[1] - 0.8, 0.9);
  };
  STEP[26] = function (g) { // the enemy's dead are left where they fell, along every road
    for (var i = 0; i < 18; i++) {
      var p = along(SG.routes[i % 3], 9 + hsh(i, 21) * 46), o = (hsh(i, 33) - 0.5) * 3.4, x = p[0] - p[3] * o, z = p[1] + p[2] * o;
      corpse(g, x, z, hsh(i, 5) * 6.28, i % 4 === 3 ? 0xd8d0c0 : 0x2a4a9a);
      if (i % 3 === 0) crow(g, x + 0.1, 0.2, z); if (i % 5 === 1) crow(g, x + 0.7, 0, z + 0.5);
    }
  };
  // One end of a hip roof whose ridge runs north and south, from the cut at z0 out to the eave (dir 1: the south end, -1: the north).
  // The cut is left open, lined dark inside, with the last truss and the broken ridge-pole showing.
  function roofEnd(g, x, y, z, w, d, h, z0, dir) {
    var e = dir * d / 2, rz = dir * (d - w) / 2, sl = Math.hypot(h, w / 2) / 2;
    function geo(k) { // k: shrink, for the lining
      var P = [], U = [], hw = w / 2 * k, hh = h * k, q = function (p, u) { P.push(x + p[0], y + p[1] - (1 - k) * 0.02, z + p[2]); U.push(u[0], u[1]); };
      var A = [-hw, 0, z0], B = [-hw, 0, e * (k < 1 ? 0.99 : 1)], C = [0, hh, rz], D = [0, hh, z0], A2 = [hw, 0, z0], B2 = [hw, 0, B[2]], u = function (p, top) { return [Math.abs(p[2] - z0) / 2, top ? sl : 0]; };
      [[A, B, C], [A, C, D], [A2, C, B2], [A2, D, C]].forEach(function (t) { t.forEach(function (p) { q(p, u(p, p[1] > 0)); }); });
      q(B, [0, 0]); q(B2, [w / 2, 0]); q(C, [w / 4, sl]);
      var bg = new T.BufferGeometry(); bg.setAttribute('position', new T.Float32BufferAttribute(P, 3)); bg.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); bg.computeVertexNormals(); return bg;
    }
    var m = new T.Mesh(geo(1), tmat('tile')); m.material.side = T.DoubleSide; m.castShadow = m.receiveShadow = true; g.add(m);
    if (!mats.soot) mats.soot = new T.MeshBasicMaterial({ color: 0x120e16, side: T.DoubleSide });
    g.add(new T.Mesh(geo(0.96), mats.soot));
    beam(g, V3(x - w / 2 + 0.1, y + 0.05, z + z0), V3(x, y + h - 0.05, z + z0), 0.075, 0x4a3020); beam(g, V3(x + w / 2 - 0.1, y + 0.05, z + z0), V3(x, y + h - 0.05, z + z0), 0.075, 0x4a3020);
    beam(g, V3(x - w / 2 + 0.2, y + 0.06, z + z0), V3(x + w / 2 - 0.2, y + 0.06, z + z0), 0.06, 0x4a3020);
    beam(g, V3(x, y + h - 0.08, z + z0 + dir * 0.4), V3(x + 0.15, y + h - 0.35, z + z0 - dir * 0.75), 0.07, CHAR);
    beam(g, V3(x - 1.7, y + 1.3, z + z0 + dir * 0.2), V3(x - 1.9, y + 0.9, z + z0 - dir * 0.6), 0.05, CHAR); beam(g, V3(x + 1.5, y + 1.45, z + z0 + dir * 0.2), V3(x + 1.2, y + 1.2, z + z0 - dir * 0.5), 0.05, CHAR);
  }
  STEP[27] = function (g) { // the middle of the church roof has fallen in, and it burns inside
    wPart('chRoof');
    // The two ends of the roof still stand, each cut off square where the middle went: an open gable, its rafters showing.
    var w = 6.9, d = 11.9, h = 2.6, x = CH[0], y = 5.2, z = CH[1], S0 = -2.2, S1 = 1.2;
    roofEnd(g, x, y, z, w, d, h, S1, 1); roofEnd(g, x, y, z, w, d, h, S0, -1);
    box(g, 5.9, 0.05, S1 - S0, 0x18121a, x, y, z + (S0 + S1) / 2); rafters(g, x, y, z + (S0 + S1) / 2, 5.6, S1 - S0 - 0.2, 5);
    beam(g, V3(x - 3.45, y, z + S0 + 1.1), V3(x - 1.9, y + 1.15, z + S0 + 1.1), 0.07, CHAR); beam(g, V3(x + 3.45, y, z + S1 - 0.9), V3(x + 2.3, y + 0.85, z + S1 - 0.9), 0.07, CHAR);
    fire(g, x - 1, y + 0.05, z - 0.4, 1.5); fire(g, x + 1.2, y + 0.05, z - 1.1, 1.2); fire(g, x + 0.2, y + 0.05, z + 0.3, 1);
    wSmoke(x, 5.6, z - 0.5, 7); wSmoke(x - 1.4, 5.6, z - 0.9, 6);
    rubble(g, CH[0] - 4.4, CH[1] - 0.8, 12, 0xc8523a, 1.8);
  };
  STEP[28] = function (g) { // hardly a hut is left standing
    Object.keys(KUBO).forEach(function (tag, i) { if (tag !== 'k1' && tag !== 'g7' && tag !== 'g16') ruin(g, tag, hsh(i, 17) < 0.65); });
    wPart('wash');
  };
  STEP[29] = function (g) { // smoke over the whole town, everything that grew burnt
    burnTrees(g, function (x, z, c) { return c < 0.25 ? 2 : c < 0.92 ? 1 : 0; });
    SCORCH.slice(12).forEach(function (s) { wScorch(s[0], s[1], s[2]); });
    [[-21.5, 2.6, -9.7], [-6.5, 4, -13.2], [-14, 0.3, -9.5], [3, 0.4, 11.2], [-34.5, 0.4, 5.5], [8.6, 0.4, 14.6], [-27.5, 0.4, -18.6], [-18.4, 0.4, -3.2]].forEach(function (s) { wSmoke(s[0], s[1], s[2], 6); });
    fire(g, -18.4, 0, -3.2, 1.1); fire(g, 3, 0, 11.2, 1); fire(g, -34.5, 0, 5.5, 1.1);
  };
  STEP[30] = function (g) { // it is over: the fires are out, and the school still stands, its colours flying
    banner(g, 0.4, 1, 5.4); banner(g, 8, 1, 5.4); banner(g, 4.2, 8.4, 4.6);
  };

  // ---------- The school turns barracks ----------
  // One more stage for each leader beaten, 0 to 5: boarded windows, then arms at the door, a redoubt and a lookout, guns, a garrison.
  function rifles(g, x, z) { // three muskets stacked muzzles together
    for (var i = 0; i < 3; i++) {
      var a = i * 2.094 + 0.4, c = Math.cos(a), s = Math.sin(a);
      beam(g, V3(x + c * 0.3, 0, z + s * 0.3), V3(x + c * 0.1, 0.7, z + s * 0.1), 0.035, 0x6b4a2e); beam(g, V3(x + c * 0.1, 0.7, z + s * 0.1), V3(x - c * 0.06, 1.3, z - s * 0.06), 0.02, 0x8c8fa6);
    }
  }
  function gun(g0, x, z, rot) { // a bronze lantaka on a field carriage, its shot piled beside it
    var g = sub(g0, x, z, rot), i, w;
    box(g, 0.5, 0.26, 1.1, 0x7a5234, 0, 0.3, 0);
    [-0.36, 0.36].forEach(function (s) { w = cyl(g, 0.4, 0.4, 0.08, 0x5a3820, s, 0.4, 0.1, 10); w.rotation.z = Math.PI / 2; w.position.x = s + 0.04; });
    var c = beam(g, V3(0, 0.66, -0.55), V3(0, 0.84, 1.05), 0.13, 0xc8962e); c.material = mats.bronze || (mats.bronze = new T.MeshStandardMaterial({ color: 0xd8a236, roughness: 0.4, metalness: 0.5 }));
    beam(g, V3(0, 0.3, -0.5), V3(0, 0.05, -1.3), 0.05, 0x7a5234);
    for (i = 0; i < 4; i++) add(g, new T.Mesh(new T.SphereGeometry(0.13, 7, 6), mat(0x1c1a22)), 0.75 + (i < 3 ? Math.cos(i * 2.1) * 0.14 : 0), i < 3 ? 0.13 : 0.34, 0.4 + (i < 3 ? Math.sin(i * 2.1) * 0.14 : 0));
  }
  function barracks(g, b) {
    if (b < 1) return;
    var X = SITE.x, Z = SITE.z, w = 7, d = 4.6, S = Z + d / 2, i;
    // 1: every window boarded over with heavy planks, the door barred
    var boards = function (x, z, ry) {
      var s = sub(g, x, z, ry);
      [[1.33, 0.09], [1.66, -0.13], [2.02, 0.06]].forEach(function (p, k) { var pl = box(s, 1.1, 0.22, 0.06, k % 2 ? 0x7a5234 : 0x8a6238, 0, p[0], 0.05); pl.rotation.z = p[1]; });
      box(s, 0.05, 0.05, 0.05, 0x2a2630, -0.42, 1.42, 0.09); box(s, 0.05, 0.05, 0.05, 0x2a2630, 0.42, 2.1, 0.09);
    };
    [-2.5, -1.4, 1.4, 2.5].forEach(function (x) { boards(X + x, S, 0); boards(X + x, Z - d / 2, Math.PI); });
    [-1, 1].forEach(function (z) { boards(X + w / 2, Z + z, Math.PI / 2); boards(X - w / 2, Z + z, -Math.PI / 2); });
    box(g, 1.5, 0.15, 0.08, 0x5a3820, X, 0.95, S + 0.04); box(g, 1.5, 0.15, 0.08, 0x5a3820, X, 1.65, S + 0.04);
    if (b < 2) return;
    // 2: arms by the door: stacked muskets, a rack of spears and bolos, powder and shot, two sentries
    rifles(g, X - 1.55, S + 1.25); rifles(g, X + 1.55, S + 1.25);
    barrel(g, X - 2.05, S + 0.4); barrel(g, X - 2.65, S + 0.45); crates(g, X + 1.95, S + 0.45);
    var wx = X - w / 2;
    cyl(g, 0.05, 0.05, 1.2, 0x6b4a2e, wx - 0.3, 0, Z - 0.55, 5); cyl(g, 0.05, 0.05, 1.2, 0x6b4a2e, wx - 0.3, 0, Z + 0.55, 5); beam(g, V3(wx - 0.3, 1.15, Z - 0.6), V3(wx - 0.3, 1.15, Z + 0.6), 0.035, 0x8a6238);
    for (i = 0; i < 6; i++) {
      var rz = Z - 0.5 + i * 0.2, long = i % 2 === 0;
      beam(g, V3(wx - 0.62, 0, rz), V3(wx - 0.14, long ? 2.2 : 1.5, rz), 0.025, 0x8a6238);
      box(g, 0.05, long ? 0.34 : 0.42, long ? 0.07 : 0.1, 0xb8bcc8, wx - 0.12, long ? 2.15 : 1.45, rz);
    }
    guard(SG.warLive, X - 0.95, 0, S + 0.5); guard(SG.warLive, X + 0.95, 0, S + 0.5);
    if (b < 3) return;
    // 3: a redoubt of sandbags before the door, a lookout on the ridge, and the school's flag struck for the red one
    sacks(g, X, S + 2.3, 0); sacks(g, X - 2.15, S + 1.5, -1.03); sacks(g, X + 2.15, S + 1.5, 1.03);
    tbox(g, 1.8, 0.1, 1.6, 'wood', X, 4.95, Z, 0xffe2c0, 1);
    [[-0.8, -0.7], [0.8, -0.7], [-0.8, 0.7], [0.8, 0.7]].forEach(function (p) { cyl(g, 0.05, 0.06, 2.2, 0x8a6238, X + p[0], 4.3, Z + p[1], 5); });
    beam(g, V3(X - 0.8, 5.55, Z + 0.7), V3(X + 0.8, 5.55, Z + 0.7), 0.035, 0xb07a3c); beam(g, V3(X - 0.8, 5.55, Z - 0.7), V3(X - 0.8, 5.55, Z + 0.7), 0.035, 0xb07a3c); beam(g, V3(X + 0.8, 5.55, Z - 0.7), V3(X + 0.8, 5.55, Z + 0.7), 0.035, 0xb07a3c);
    roof(g, 2.2, 2, 0.6, 'nipa', X, 6.5, Z); guard(SG.warLive, X, 5.05, Z);
    school.flag.forEach(wHide); box(g, 1.05, 0.75, 0.05, 0xc81e28, X + w / 2 + 2.14, 2.82, S + 1.2);
    if (b < 4) return;
    // 4: guns: one covering the door, one the west road, and a lean-to armoury against the west wall
    gun(g, X + 2.9, S + 2.2, 0.35); gun(g, wx - 1.9, Z + 2.2, -1.2);
    barrel(g, X + 3.6, S + 1.2); barrel(g, X + 4.1, S + 1.5);
    var lr = tbox(g, 1.9, 0.08, 3.6, 'nipa', wx - 0.95, 2.55, Z, 0xd8c8a0, 1); lr.rotation.z = 0.3;
    [-1.7, 1.7].forEach(function (z) { cyl(g, 0.05, 0.05, 2.3, 0x8a6238, wx - 1.75, 0, Z + z, 5); });
    crates(g, wx - 1.2, Z - 1.45); barrel(g, wx - 0.5, Z + 1.5); barrel(g, wx - 1.15, Z + 1.55);
    for (i = 0; i < 3; i++) { var l = box(g, 0.8, 0.12, 0.12, 0x4a3424, X - 3, 0.02, S + 1.1); l.rotation.y = i * 1.05; }
    fire(g, X - 3, 0.1, S + 1.1, 0.8); cyl(g, 0.2, 0.15, 0.24, 0x1c1a22, X - 3, 0.75, S + 1.1, 8);
    [0, 2.1, 4.2].forEach(function (a) { beam(g, V3(X - 3 + Math.cos(a) * 0.5, 0, S + 1.1 + Math.sin(a) * 0.5), V3(X - 3, 1.25, S + 1.1), 0.025, 0x3a3440); });
    if (b < 5) return;
    // 5: a garrison: the walls banked with sandbags, a watchtower at the back corner, the colours over the roof, men at every post
    [-2.6, -1.3, 1.3, 2.6].forEach(function (x) { for (i = 0; i < 2; i++) box(g, 1.2, 0.26, 0.42, (x + i) % 2 ? 0xc9b48a : 0xb8a276, X + x, 0.35 + i * 0.26, S + 0.25); });
    var tx = X + w / 2 + 1, tz = Z - d / 2 - 0.6;
    platform(g, tx, tz, 4.4, 0.7); roof(g, 2.2, 2.2, 0.8, 'nipa', tx, 5.75, tz, 0xfff0d8); guard(SG.warLive, tx, 4.5, tz);
    cyl(g, 0.05, 0.06, 2.6, 0x6b4a2e, X, 7.05, Z, 5); box(g, 1.5, 0.95, 0.05, 0xc81e28, X + 0.78, 8.6, Z); box(g, 0.34, 0.34, 0.06, 0xf7c930, X + 0.6, 8.9, Z);
    guard(SG.warLive, X - 0.9, 0, S + 1.7); guard(SG.warLive, X + 1, 0, S + 1.75); guard(SG.warLive, wx - 1.5, 0, Z + 1.3); guard(SG.warLive, X + 2.3, 0, S + 2.6);
  }

  // Who is still about: the streets and the lake empty over the first days.
  function people(n) {
    folk.forEach(function (h, i) { h.visible = n <= 0 || (n === 1 ? i % 2 === 0 : n === 2 && i % 7 === 3); });
    hens.forEach(function (h) { h.visible = n < 2; });
    boats.forEach(function (b, i) { b.hull.visible = b.man.visible = n < 0 || i < [3, 2, 1, 0][Math.min(3, n)]; });
    friar.visible = n < 0;
  }
  function liveClear(group) {
    group.children.slice().forEach(function (h) { h.userData.m.userData.gone = true; group.remove(h); h.userData.m.geometry.dispose(); });
    billboards = billboards.filter(function (m) { return !m.userData.gone; });
  }
  // n: the days held, 0 to 30 (or anything when there is no siege).
  // b: the leaders beaten, 0 to 5, which is how far the school has turned barracks.
  W.setWar = function (n, b) {
    n = SG.on ? Math.max(0, Math.min(30, n | 0)) : -1; b = n < 0 ? 0 : Math.max(0, Math.min(5, b | 0));
    if (n === SG.war && b === SG.barr) return; SG.war = n; SG.barr = b; shadowDirty = treesDirty = true;
    while (SG.undo.length) SG.undo.pop()();
    while (SG.warPaint.length) Art.groundRestore(groundTex, SG.warPaint.pop());
    SG.smokeSrc = []; SG.ruined = {};
    if (!SG.dress) { SG.dress = new T.Group(); scene.add(SG.dress); SG.warLive = new T.Group(); scene.add(SG.warLive); }
    clear(SG.dress); liveClear(SG.warLive);
    people(n);
    if (n < 0) return;
    weldInto(SG.dress, function (root) { for (var s = 0; s <= n; s++) if (STEP[s]) STEP[s](root, n); defences(root, n); barracks(root, b); });
    if (n >= 30) SG.smokeSrc = [];
    if (post) post.mat.uniforms.war.value = n >= 30 ? 0.6 : 0.36 + n * 0.018;
  };
  // Smoke: a few puffs climbing from each place that burns.
  function smokeFx() {
    var src = SG.smokeSrc || [], per = 7, i, j;
    if (!SG.smoke) {
      if (!src.length) return;
      var sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(new Float32Array(44 * per * 3), 3));
      SG.smoke = new T.Points(sg, new T.PointsMaterial({ map: Art.one('puff'), size: 26, sizeAttenuation: false, alphaTest: 0.5, transparent: true, opacity: 0.62, depthWrite: false }));
      SG.smoke.frustumCulled = false; scene.add(SG.smoke);
    }
    SG.smoke.visible = src.length > 0; if (!src.length) return;
    SG.smoke.material.size = 13 * stats.scale * zoom;
    SG.smoke.material.color.setRGB(0.25 + tint.r * 0.5, 0.25 + tint.g * 0.5, 0.25 + tint.b * 0.5);
    var P = SG.smoke.geometry.attributes.position;
    for (i = 0; i < 44; i++) for (j = 0; j < per; j++) {
      var s = src[i], t = (clock * 0.13 + j / per + i * 0.37) % 1;
      if (!s) P.setXYZ(i * per + j, 0, -99, 0);
      else P.setXYZ(i * per + j, s[0] + t * t * 2.4 + Math.sin(t * 9 + i) * 0.22, s[1] + t * s[3], s[2] - t * 0.9 + Math.cos(t * 7 + i * 2) * 0.2);
    }
    P.needsUpdate = true;
  }

  // The posts.
  function platform(g, x, z, h, w) {
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (p) { cyl(g, 0.07, 0.08, h + 1.25, 0x8a6238, x + p[0] * w, 0, z + p[1] * w, 5); });
    tbox(g, w * 2 + 0.3, 0.1, w * 2 + 0.3, 'wood', x, h, z, 0xffe2c0, 1);
    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(function (p) { beam(g, V3(x + (p[0] - p[1]) * w, h + 0.5, z + (p[1] - p[0]) * w), V3(x + (p[0] + p[1]) * w, h + 0.5, z + (p[1] + p[0]) * w), 0.035, 0xb07a3c); });
    beam(g, V3(x - w, 0, z + w), V3(x + w, h, z - w), 0.04, 0xb07a3c); beam(g, V3(x + w, 0, z + w), V3(x - w, h, z - w), 0.04, 0xb07a3c);
    beam(g, V3(x + w + 0.5, 0, z + w * 0.4), V3(x + w + 0.08, h + 0.1, z + w * 0.4), 0.03, 0xc9a66b); beam(g, V3(x + w + 0.5, 0, z - w * 0.2), V3(x + w + 0.08, h + 0.1, z - w * 0.2), 0.03, 0xc9a66b);
  }
  function guard(live, x, y, z) { var f = figure(live, FILI, x, z, 0.92); f.position.y = y; f.children[1].visible = y < 0.1; return f; }
  var TOWER = {
    tirador: function (g, live, x, z) { platform(g, x, z, 1.5, 0.6); roof(g, 1.9, 1.9, 0.7, 'nipa', x, 2.75, z); guard(live, x, 1.6, z); },
    escopeta: function (g, live, x, z) {
      platform(g, x, z, 2.3, 0.6); roof(g, 1.9, 1.9, 0.7, 'nipa', x, 3.55, z, 0xfff0d8);
      cyl(g, 0.035, 0.035, 1.5, 0x6b4a2e, x - 0.6, 3.5, z - 0.6, 5); box(g, 0.6, 0.38, 0.03, 0xc81e28, x - 0.28, 4.6, z - 0.6); guard(live, x, 2.4, z);
    },
    lantaka: function (g, live, x, z) {
      tbox(g, 2, 0.6, 2, 'stone', x, 0, z, 0xe8e4dc, 1);
      for (var i = 0; i < 4; i++) box(g, 0.6, 0.26, 0.42, i % 2 ? 0xc9b48a : 0xb8a276, x - 0.93 + i * 0.62, 0.6, z + 0.8);
      box(g, 0.5, 0.3, 0.9, 0x7a5234, x + 0.3, 0.6, z); var c = beam(g, V3(x + 0.3, 1.05, z - 0.5), V3(x + 0.3, 1.25, z + 0.85), 0.13, 0xc8962e); c.material = mats.bronze || (mats.bronze = new T.MeshStandardMaterial({ color: 0xd8a236, roughness: 0.4, metalness: 0.5 }));
      guard(live, x - 0.5, 0.6, z - 0.2);
    },
    bitag: function (g, live, x, z) {
      platform(g, x, z, 0.8, 0.6);
      cyl(g, 0.05, 0.06, 3, 0x6b4a2e, x - 0.6, 0.8, z - 0.6, 5); beam(g, V3(x - 0.6, 3.7, z - 0.6), V3(x + 0.9, 3.2, z + 0.5), 0.035, 0xb07a3c);
      for (var i = 0; i < 4; i++) { beam(g, V3(x + 0.9, 3.2, z + 0.5), V3(x + 0.9 + [0.5, -0.5, 0, 0][i], 2.1, z + 0.5 + [0, 0, 0.5, -0.5][i]), 0.018, 0xe8dcc0); }
      box(g, 1, 0.03, 1, 0xd8ccb0, x + 0.9, 2.1, z + 0.5); guard(live, x, 0.9, z);
    }
  };
  W.setTowers = function (list) {
    var key = list.map(function (t) { return t.k + Math.round(t.x * 10) + ',' + Math.round(t.z * 10); }).join('|');
    if (key === SG.key) return; SG.key = key; shadowDirty = true;
    if (!SG.tw) { SG.tw = new T.Group(); scene.add(SG.tw); SG.twLive = new T.Group(); scene.add(SG.twLive); }
    SG.twLive.children.slice().forEach(function (h) { h.userData.m.userData.gone = true; SG.twLive.remove(h); h.userData.m.geometry.dispose(); });
    billboards = billboards.filter(function (m) { return !m.userData.gone; });
    weldInto(SG.tw, function (root) { list.forEach(function (t) { TOWER[t.k](root, SG.twLive, t.x, t.z); }); });
    // What marks a post as yours: a gold ring on the ground and a gold pin over it, which shows through trees and roofs.
    if (!SG.twMark) {
      SG.twMark = new T.Group(); scene.add(SG.twMark);
      var rg = new T.RingGeometry(1.32, 1.56, 40); rg.rotateX(-Math.PI / 2); SG.twRingG = rg;
      SG.twRingM = new T.MeshBasicMaterial({ color: 0xffcf2e, transparent: true, opacity: 0.9, depthWrite: false });
      var c = document.createElement('canvas'); c.width = 64; c.height = 80; var x = c.getContext('2d');
      x.beginPath(); x.moveTo(32, 76); x.lineTo(13, 40); x.arc(32, 28, 22, Math.PI * 0.83, Math.PI * 0.17); x.closePath();
      x.fillStyle = '#ffcf2e'; x.fill(); x.lineWidth = 6; x.lineJoin = 'round'; x.strokeStyle = '#2a1a10'; x.stroke();
      x.beginPath(); x.arc(32, 28, 8, 0, 7); x.fillStyle = '#2a1a10'; x.fill();
      SG.twPinM = new T.SpriteMaterial({ map: new T.CanvasTexture(c), depthTest: false, depthWrite: false });
    }
    while (SG.twMark.children.length) SG.twMark.remove(SG.twMark.children[0]);
    list.forEach(function (t) {
      var ring = new T.Mesh(SG.twRingG, SG.twRingM); ring.position.set(t.x, 0.08, t.z); SG.twMark.add(ring);
      var pin = new T.Sprite(SG.twPinM); pin.center.set(0.5, 0); pin.scale.set(1.04, 1.3, 1); pin.renderOrder = 6;
      pin.userData.y = PIN[t.k]; pin.position.set(t.x, PIN[t.k], t.z); SG.twMark.add(pin);
    });
  };
  var PIN = { tirador: 3.7, escopeta: 5, lantaka: 2.3, bitag: 4.1 }; // how high the pin floats over each kind of post

  // The way the enemy comes: red arrowheads running down the first n roads, from where he first shows (starts[r] along the road)
  // to the school door. a: how strongly they are drawn.
  W.setPaths = function (n, starts, a) {
    if (!SG.pathM) {
      if (!n) return;
      var c = document.createElement('canvas'); c.width = 128; c.height = 64; var x = c.getContext('2d'); // one arrowhead and as much road left bare
      x.lineCap = 'round'; x.lineJoin = 'round';
      [[19, 'rgba(20,0,0,.8)'], [10, '#fff']].forEach(function (s) { x.lineWidth = s[0]; x.strokeStyle = s[1]; x.beginPath(); x.moveTo(20, 13); x.lineTo(42, 32); x.lineTo(20, 51); x.stroke(); });
      var tx = new T.CanvasTexture(c); tx.wrapS = T.RepeatWrapping;
      SG.pathM = new T.MeshBasicMaterial({ map: tx, color: 0xc40404, transparent: true, depthWrite: false, side: T.DoubleSide });
      SG.path = new T.Group(); scene.add(SG.path);
    }
    SG.pathM.opacity = a == null ? 1 : a;
    if (n === SG.pathN) return; SG.pathN = n; clear(SG.path);
    for (var r = 0; r < n && r < SG.routes.length; r++) {
      var rt = SG.routes[r], pts = [], d = 0, i, j, k, l;
      for (i = 1; i < rt.length; i++) { // from where he shows, and no further than where this road joins an earlier one
        l = Math.hypot(rt[i][0] - rt[i - 1][0], rt[i][1] - rt[i - 1][1]);
        if (!pts.length && d + l > starts[r]) { k = (starts[r] - d) / l; pts.push([rt[i - 1][0] + (rt[i][0] - rt[i - 1][0]) * k, rt[i - 1][1] + (rt[i][1] - rt[i - 1][1]) * k]); }
        d += l; if (!pts.length) continue;
        pts.push(rt[i]);
        for (j = 0, k = false; j < r && !k; j++) k = SG.routes[j].some(function (q, m) { return m > 0 && segD(rt[i][0], rt[i][1], SG.routes[j][m - 1], q) < 0.3; });
        if (k) break;
      }
      if (pts.length < 2) continue;
      var pos = [], uv = [], idx = [], u = 0, w = 0.8;
      for (i = 0; i < pts.length; i++) {
        var p = pts[i], a0 = pts[i - 1] || p, b0 = pts[i + 1] || p, n0 = null, n1 = null;
        if (i) { l = Math.hypot(p[0] - a0[0], p[1] - a0[1]) || 1; n0 = [-(p[1] - a0[1]) / l, (p[0] - a0[0]) / l]; u += l / 5.2; }
        if (i < pts.length - 1) { l = Math.hypot(b0[0] - p[0], b0[1] - p[1]) || 1; n1 = [-(b0[1] - p[1]) / l, (b0[0] - p[0]) / l]; }
        n0 = n0 || n1; n1 = n1 || n0;
        var mx = n0[0] + n1[0], mz = n0[1] + n1[1], ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
        var s = w / Math.max(0.5, mx * n0[0] + mz * n0[1]); // a mitre at the bends
        pos.push(p[0] + mx * s, 0.07, p[1] + mz * s, p[0] - mx * s, 0.07, p[1] - mz * s); uv.push(u, 0, u, 1);
        if (i) idx.push(i * 2 - 2, i * 2 - 1, i * 2, i * 2 - 1, i * 2 + 1, i * 2);
      }
      var g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
      var m = new T.Mesh(g, SG.pathM); m.renderOrder = 3; SG.path.add(m);
    }
  };

  // The enemy on the roads. list: [{ sp, x, z, f }] (sprite name, place, share of strength left); looks: how each sprite is drawn.
  var barGeo = new T.PlaneGeometry(0.9, 0.11), barMat = new T.MeshBasicMaterial({ color: 0xff4a3a, depthTest: false });
  W.setFoes = function (list, looks) {
    var used = {}, i, k;
    if (!SG.foes) { SG.foes = new T.Group(); scene.add(SG.foes); }
    for (i = 0; i < list.length; i++) {
      var e = list[i], pool = SG.pools[e.sp] || (SG.pools[e.sp] = []), n = used[e.sp] = (used[e.sp] || 0) + 1, h = pool[n - 1];
      if (!h) {
        var L = looks[e.sp], s = L.big || 1, fr = L._f || (L._f = Art.person(L));
        h = bb(SG.foes, fr[2], 0, 0, 0, PX * s, 0.32 * s); h.userData.frames = fr;
        var bar = new T.Mesh(barGeo, barMat); bar.position.y = 27 * PX * s * 1.12 + 0.16; bar.scale.set(s, s, 1); bar.renderOrder = 5; h.add(bar); billboards.push(bar);
        h.userData.bar = bar; h.userData.s = s; pool.push(h);
      }
      h.visible = true; h.position.set(e.x, 0, e.z); setFrame(h, true, n * 1.3);
      h.userData.m.position.y = Math.abs(Math.sin(clock * 9 + n * 1.3)) * 0.05;
      h.userData.bar.visible = e.f < 0.999; h.userData.bar.scale.x = Math.max(0.03, e.f) * h.userData.s;
    }
    for (k in SG.pools) for (i = used[k] || 0; i < SG.pools[k].length; i++) SG.pools[k][i].visible = false;
  };

  // A shot (a streak from a to b) and a burst on the ground.
  var shotN = 0, blastN = 0;
  W.shot = function (ax, ay, az, bx, by, bz, color) {
    if (!SG.shots) {
      SG.shots = [];
      for (var i = 0; i < 36; i++) {
        var g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(6), 3));
        var l = new T.Line(g, new T.LineBasicMaterial({ color: 0xffffff, transparent: true })); l.frustumCulled = false; l.visible = false; scene.add(l); SG.shots.push(l);
      }
    }
    var s = SG.shots[shotN++ % SG.shots.length], p = s.geometry.attributes.position;
    p.setXYZ(0, ax, ay, az); p.setXYZ(1, bx, by, bz); p.needsUpdate = true; s.material.color.setHex(color || 0xfff2b0); s.visible = true; s.userData.t = 0.11;
  };
  W.blast = function (x, z, r, color) {
    if (!SG.blasts) {
      SG.blasts = [];
      for (var i = 0; i < 10; i++) {
        var g = new T.CircleGeometry(1, 20); g.rotateX(-Math.PI / 2);
        var m = new T.Mesh(g, new T.MeshBasicMaterial({ color: 0xffb040, transparent: true, depthWrite: false })); m.visible = false; scene.add(m); SG.blasts.push(m);
      }
    }
    var b = SG.blasts[blastN++ % SG.blasts.length];
    b.position.set(x, 0.12, z); b.material.color.setHex(color || 0xffb040); b.userData.t = 0.32; b.userData.r = r; b.visible = true;
  };
  function siegeFx(dt) {
    var i, o;
    smokeFx();
    if (SG.pathM) SG.pathM.map.offset.x = -(clock * 0.45 % 1);
    if (SG.twMark) for (i = 0; i < SG.twMark.children.length; i++) { o = SG.twMark.children[i]; if (o.isSprite) o.position.y = o.userData.y + Math.sin(clock * 2.6 + o.position.x) * 0.12; }
    if (SG.shots) for (i = 0; i < SG.shots.length; i++) { o = SG.shots[i]; if (o.visible) { o.userData.t -= dt; o.material.opacity = Math.max(0, o.userData.t / 0.11); if (o.userData.t <= 0) o.visible = false; } }
    if (SG.blasts) for (i = 0; i < SG.blasts.length; i++) {
      o = SG.blasts[i]; if (!o.visible) continue;
      o.userData.t -= dt; var k = 1 - Math.max(0, o.userData.t) / 0.32;
      o.scale.setScalar(o.userData.r * (0.35 + 0.65 * k)); o.material.opacity = 0.75 * (1 - k); if (o.userData.t <= 0) o.visible = false;
    }
  }

  // A ring on the ground: how far a post reaches. ok: 0 it cannot stand here, 1 it can, 2 a post that is already there.
  W.ghost = function (x, z, range, ok) {
    if (x == null) { if (SG.ring) { SG.ring.visible = false; SG.spot.visible = false; } return; }
    if (!SG.ring) {
      SG.ring = new T.Group(); scene.add(SG.ring);
      var rg = new T.RingGeometry(0.975, 1, 72); rg.rotateX(-Math.PI / 2);
      var dg = new T.CircleGeometry(1, 72); dg.rotateX(-Math.PI / 2);
      var cg = new T.CircleGeometry(0.9, 20); cg.rotateX(-Math.PI / 2);
      SG.ringM = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false });
      SG.discM = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthTest: false });
      SG.ring.add(new T.Mesh(rg, SG.ringM)); SG.ring.add(new T.Mesh(dg, SG.discM));
      SG.spot = new T.Mesh(cg, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthTest: false })); scene.add(SG.spot);
      SG.ring.children.forEach(function (m) { m.renderOrder = 4; }); SG.spot.renderOrder = 4;
    }
    var c = ok === 2 ? 0xffd35a : ok ? 0x9af06a : 0xff5a4a;
    SG.ring.visible = true; SG.ring.position.set(x, 0.1, z); SG.ring.scale.set(range, 1, range); SG.ringM.color.setHex(c); SG.discM.color.setHex(c);
    SG.spot.visible = ok !== 2; SG.spot.position.set(x, 0.11, z); SG.spot.material.color.setHex(c);
  };

  Noli.World = W;
})();
