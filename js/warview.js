// Noli — the revolution as it is seen: the map of the south of Luzon and the field of each battle, built of the same plain solids,
// painted ground and pixel people as San Diego, and drawn through the same lens (world.js lends its stage and its tools).
// Nothing here knows the rules: war.js says who holds what and where everyone stands, and this draws it.
(function () {
  var T = THREE, Art = Noli.Art, WD = Noli.Data.war, C = Noli.Coast, W = Noli.World, K = null, V = {};
  var KM = 1 / (C.CELL * 110.6); // cells of the map to a kilometre
  function mx(lon) { return (lon - C.LON0) * C.KX / C.CELL; }
  function mz(lat) { return (C.LAT1 - lat) / C.CELL; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  var hash = Art.hash;
  function vnoise(x, y) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function rng(seed) { var s = Math.floor(seed) % 2147483647 || 7; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  function lin(hex) { return new T.Color(hex).convertSRGBToLinear(); }
  function fmat(tex) { return tex._wm || (tex._wm = new T.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: T.DoubleSide })); }
  function dmat(tex) { return tex._wd || (tex._wd = new T.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: T.DoubleSide, color: 0x8a8a94 })); }
  function frames(look) { return look._f || (look._f = Art.person(look)); }
  function sub(g0, x, z, rot) { var g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rot || 0; g0.add(g); return g; }
  function put(parent, mesh, x, y, z) { mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh; }
  var flagT = {};
  function flagTex(ph) { // the two flags, a few pixels each
    if (flagT[ph]) return flagT[ph];
    var cv = document.createElement('canvas'); cv.width = 30; cv.height = 20; var c = cv.getContext('2d'), y;
    if (ph) {
      c.fillStyle = '#2f5fc0'; c.fillRect(0, 0, 30, 10); c.fillStyle = '#d2281e'; c.fillRect(0, 10, 30, 10);
      c.fillStyle = '#ffffff'; for (y = 0; y < 20; y++) c.fillRect(0, y, Math.round(13 * (1 - Math.abs(y - 9.5) / 10)), 1);
      c.fillStyle = '#f7c930'; c.fillRect(3, 8, 4, 4); c.fillRect(4, 7, 2, 6); c.fillRect(2, 9, 6, 2); c.fillRect(0, 1, 1, 1); c.fillRect(0, 18, 1, 1); c.fillRect(10, 9, 1, 2);
    } else {
      c.fillStyle = '#c8202a'; c.fillRect(0, 0, 30, 20); c.fillStyle = '#f7c930'; c.fillRect(0, 5, 30, 10); c.fillStyle = '#c8202a'; c.fillRect(8, 7, 4, 6); c.fillStyle = '#8a5a2e'; c.fillRect(9, 6, 2, 1);
    }
    var t = new T.CanvasTexture(cv); t.magFilter = T.NearestFilter; t.minFilter = T.NearestFilter; t.generateMipmaps = false; t.encoding = T.sRGBEncoding;
    return (flagT[ph] = new T.MeshBasicMaterial({ map: t, side: T.DoubleSide }));
  }
  function lights(scene, cx, cz, span, dx, dz, col) {
    scene.add(new T.HemisphereLight(0xdfeeff, 0x9a8a60, 0.58));
    var sun = new T.DirectionalLight(col || 0xfff6e0, 1.0); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    var sc = sun.shadow.camera; sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.near = 1; sc.far = span * 4;
    sun.shadow.bias = -0.0012; sun.position.set(cx + dx * span, span * 1.1, cz + dz * span); sun.target.position.set(cx, 0, cz); scene.add(sun); scene.add(sun.target);
    return sun;
  }
  function cloned(name, rx, ry) { var t = Art.tile(name).clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return t; }

  // =====================================================================================================================
  // The map
  // =====================================================================================================================
  var M = { EL: Math.PI / 4, cam: { x: C.W / 2, z: C.H / 2, v: 200 }, stage: null, flags: {}, rings: {}, cols: [], ST: 2 };
  var SIN = Math.sin(M.EL), COS = Math.cos(M.EL);
  // The mountains: [latitude, longitude, how far they spread in km, how high they stand on the table].
  var MTS = [[15.5, 121.36, 13, 10], [15.3, 121.34, 13, 11], [15.1, 121.33, 12, 11], [14.95, 121.34, 11, 10], [14.8, 121.34, 11, 10], [14.66, 121.39, 10, 10], [14.52, 121.46, 9, 9], [14.39, 121.53, 8, 8],
    [15.2, 121.5, 10, 7], [14.9, 121.52, 9, 7], [14.068, 121.49, 9, 20], [14.065, 121.425, 5, 11], [14.135, 121.195, 4.5, 9], [14.115, 120.93, 6, 4.5], [14.04, 120.8, 4, 6], [13.92, 121.07, 2.6, 5],
    [14.012, 120.997, 1.9, 3.2], [13.96, 121.25, 5, 8], [13.68, 121.25, 8, 7], [13.86, 121.47, 6, 5], [13.74, 120.92, 3, 3], [14.52, 120.47, 9, 12], [14.71, 120.4, 9, 11], [14.62, 120.43, 6, 6],
    [15.0, 120.3, 12, 11], [15.3, 120.25, 12, 12], [15.14, 120.35, 8, 14], [15.5, 120.15, 10, 9], [15.2, 120.742, 3.6, 9], [13.26, 120.99, 14, 20], [13.2, 120.7, 14, 12], [13.45, 120.75, 8, 6], [13.15, 121.3, 12, 9],
    [13.37, 121.97, 8, 8], [13.6, 122.5, 10, 5], [13.95, 122.0, 10, 5], [14.1, 122.3, 9, 5], [13.8, 120.15, 5, 4], [14.85, 121.93, 8, 3], [14.62, 121.2, 6, 3.2], [14.34, 121.235, 1.8, 2.4], [14.33, 121.33, 3, 3],
    [14.21, 120.65, 5, 6], [14.0, 121.38, 3, 4], [13.3, 122.6, 10, 5]];
  var RIVERS = [[[14.596, 120.962], [14.594, 120.99], [14.576, 121.03], [14.557, 121.065], [14.535, 121.095]], [[14.76, 121.15], [14.69, 121.115], [14.62, 121.085], [14.56, 121.068]],
    [[15.3, 120.72], [15.06, 120.74], [14.95, 120.77], [14.86, 120.74], [14.79, 120.69]], [[15.2, 121.1], [14.96, 121.12], [14.915, 120.97], [14.88, 120.84], [14.82, 120.76]],
    [[14.25, 121.56], [14.268, 121.47], [14.29, 121.43]], [[13.92, 121.13], [13.82, 121.075], [13.76, 121.062]], [[13.93, 120.95], [13.89, 120.925], [13.87, 120.915]], [[14.29, 120.98], [14.37, 120.95], [14.455, 120.93]]];
  function decode() {
    var g = new Float32Array(C.W * C.H), A64 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_', s = C.runs, k = 0, i = 0, v = 1, n, c;
    while (k < s.length && i < g.length) { c = A64.indexOf(s[k++]); n = c < 62 ? c : A64.indexOf(s[k++]) * 64 + A64.indexOf(s[k++]); if (v) g.fill(1, i, i + n); i += n; v = 1 - v; }
    return g; // 1 where there is land
  }
  function blur(src, gw, gh, r, times) {
    var a = src, b, x, y, s, w = 2 * r + 1;
    while (times-- > 0) {
      b = new Float32Array(gw * gh);
      for (y = 0; y < gh; y++) { s = 0; for (x = -r; x <= r; x++) s += a[y * gw + clamp(x, 0, gw - 1)]; for (x = 0; x < gw; x++) { b[y * gw + x] = s / w; s += a[y * gw + Math.min(gw - 1, x + r + 1)] - a[y * gw + Math.max(0, x - r)]; } }
      a = new Float32Array(gw * gh);
      for (x = 0; x < gw; x++) { s = 0; for (y = -r; y <= r; y++) s += b[clamp(y, 0, gh - 1) * gw + x]; for (y = 0; y < gh; y++) { a[y * gw + x] = s / w; s += b[Math.min(gh - 1, y + r + 1) * gw + x] - b[Math.max(0, y - r) * gw + x]; } }
    }
    return a;
  }
  M.h = function (x, z) { // how high the ground stands there (the sea counts as 0)
    var ST = M.ST, fx = clamp(x / ST, 0, M.nx - 1.001), fz = clamp(z / ST, 0, M.nz - 1.001), ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz, H = M.hgt, o = iz * M.nx + ix;
    return Math.max(0, H[o] + (H[o + 1] - H[o]) * tx + (H[o + M.nx] - H[o]) * tz + (H[o] - H[o + 1] - H[o + M.nx] + H[o + M.nx + 1]) * tx * tz);
  };
  function ribbon(pts, wd, lift, P, I, each) { // a road or a river laid over the ground: pts are [x, z]
    var out = [], i, j;
    for (i = 1; i < pts.length; i++) { var a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.2)); for (j = i === 1 ? 0 : 1; j <= n; j++) out.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]); }
    var base = P.length / 3;
    for (i = 0; i < out.length; i++) {
      var p = out[i], q0 = out[Math.max(0, i - 1)], q1 = out[Math.min(out.length - 1, i + 1)], dx = q1[0] - q0[0], dz = q1[1] - q0[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l * wd / 2, nz = dx / l * wd / 2;
      var y = Math.max(M.h(p[0], p[1]), M.h(p[0] + nx, p[1] + nz), M.h(p[0] - nx, p[1] - nz)) + lift;
      P.push(p[0] + nx, y, p[1] + nz, p[0] - nx, y, p[1] - nz); if (each) each(p);
      if (i) I.push(base + i * 2 - 2, base + i * 2, base + i * 2 - 1, base + i * 2 - 1, base + i * 2, base + i * 2 + 1);
    }
    return out.length * 2;
  }
  function paintSea(land, near, gw, gh) {
    var wide = blur(land, gw, gh, 22, 2), small = document.createElement('canvas'), g = small.getContext('2d'), im, d, x, y, o, i;
    var tones = [[104, 204, 230], [80, 188, 226], [62, 170, 222], [47, 150, 214], [39, 131, 201]]; // from the shallows to the deep
    small.width = gw; small.height = gh; im = g.createImageData(gw, gh); d = im.data;
    for (y = 0; y < gh; y++) for (x = 0; x < gw; x++) {
      o = y * gw + x;
      var depth = clamp(1 - (near[o] * 1.6 + wide[o] * 1.2) * 1.5, 0, 1) + (vnoise(x / 41, y / 41) - 0.5) * 0.42 + (vnoise(x / 11 + 3, y / 11) - 0.5) * 0.12, t = tones[clamp(Math.floor(depth * 5), 0, 4)];
      d[o * 4] = t[0]; d[o * 4 + 1] = t[1]; d[o * 4 + 2] = t[2]; d[o * 4 + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    var cv = document.createElement('canvas'), k = 2, r = rng(1896); cv.width = gw * k; cv.height = gh * k; g = cv.getContext('2d'); g.imageSmoothingEnabled = true; g.drawImage(small, 0, 0, cv.width, cv.height);
    g.lineCap = 'round';
    for (i = 0; i < 5200; i++) { // the strokes of the swell, thick in some waters and rare in others
      x = r() * gw; y = r() * gh; o = Math.floor(y) * gw + Math.floor(x);
      var l = 2 + r() * 5, bend = (r() - 0.3) * 1.6, pale = r() < 0.72;
      if (near[o] > 0.2 || vnoise(x / 57 + 20, y / 57) < 0.36 + r() * 0.2) continue;
      g.strokeStyle = pale ? 'rgba(236, 250, 255, ' + (0.22 + r() * 0.3) + ')' : 'rgba(18, 84, 150, ' + (0.16 + r() * 0.16) + ')'; g.lineWidth = (0.7 + r() * 0.6) * k;
      g.beginPath(); g.moveTo((x - l) * k, y * k); g.quadraticCurveTo(x * k, (y - bend) * k, (x + l) * k, y * k); g.stroke();
    }
    var t2 = new T.CanvasTexture(cv); t2.encoding = T.sRGBEncoding; t2.anisotropy = 4; return t2;
  }
  function townOf(id) { for (var i = 0; i < WD.towns.length; i++) if (WD.towns[i].id === id) return WD.towns[i]; return WD.HOME; }
  function buildMap() {
    if (M.stage) return;
    K = K || W.kit();
    var gw = C.W, gh = C.H, ST = M.ST, land = decode(), b1 = blur(land, gw, gh, 1, 1), b2 = blur(land, gw, gh, 6, 2), nx = M.nx = Math.floor((gw - 1) / ST) + 1, nz = M.nz = Math.floor((gh - 1) / ST) + 1;
    var H = M.hgt = new Float32Array(nx * nz), pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), ix, iz, i, j, o;
    var mts = MTS.map(function (m) { var r = m[2] * KM; return [mx(m[1]), mz(m[0]), r * r, m[3]]; });
    var cSand = lin(0xf0dc9c), cGrass = lin(0x62b548), cGrass2 = lin(0x74c04e), cPad = lin(0x8ccc58), cPad2 = lin(0xa4d466), cWood = lin(0x2f8a46), cHill = lin(0x2c8a48), cMid = lin(0x6b9358), cHi = lin(0x9c8b68), cTop = lin(0xb9a888), c = new T.Color();
    for (iz = 0; iz < nz; iz++) for (ix = 0; ix < nx; ix++) {
      var gx = ix * ST, gz = iz * ST, m = b1[gz * gw + gx], d = b2[gz * gw + gx], n1 = vnoise(gx / 23, gz / 23), n2 = vnoise(gx / 7 + 9, gz / 7), y, mt = 0;
      if (m < 0.5) y = (m - 0.5) * 4;
      else {
        var inl = clamp((d - 0.5) * 2.4, 0, 1);
        for (i = 0; i < mts.length; i++) { var q = mts[i], dd = (gx - q[0]) * (gx - q[0]) + (gz - q[1]) * (gz - q[1]); if (dd < q[2] * 7) mt += q[3] * Math.exp(-dd / q[2]); }
        y = Math.min(0.3, (m - 0.5) * 3) + inl * 0.45 + (mt * (0.72 + 0.56 * n2) + n1 * n2 * 1.3) * Math.pow(inl, 0.8);
      }
      o = iz * nx + ix; H[o] = y; pos[o * 3] = gx; pos[o * 3 + 1] = y; pos[o * 3 + 2] = gz;
      if (y < 0.16) c.copy(cSand);
      else {
        if (n1 > 0.57) c.copy(cWood); else if (n1 < 0.38) c.copy(n2 > 0.5 ? cPad : cPad2); else c.copy(n2 > 0.5 ? cGrass : cGrass2);
        if (y > 1.1) c.lerp(cHill, clamp((y - 1.1) / 1.6, 0, 1));
        if (y > 5) c.lerp(cMid, clamp((y - 5) / 4, 0, 1));
        if (y > 10) c.lerp(cHi, clamp((y - 10) / 4, 0, 1));
        if (y > 15) c.lerp(cTop, clamp((y - 15) / 4, 0, 1));
      }
      col[o * 3] = c.r; col[o * 3 + 1] = c.g; col[o * 3 + 2] = c.b;
    }
    var idx = [];
    for (iz = 0; iz < nz - 1; iz++) for (ix = 0; ix < nx - 1; ix++) {
      o = iz * nx + ix; if (H[o] < -0.45 && H[o + 1] < -0.45 && H[o + nx] < -0.45 && H[o + nx + 1] < -0.45) continue; // open water: nothing to draw
      idx.push(o, o + nx, o + 1, o + 1, o + nx, o + nx + 1);
    }
    var scene = new T.Scene(); scene.background = new T.Color(0x2f9ad8);
    var tg = new T.BufferGeometry(); tg.setAttribute('position', new T.BufferAttribute(pos, 3)); tg.setAttribute('color', new T.BufferAttribute(col, 3)); tg.setIndex(idx); tg.computeVertexNormals();
    var terr = new T.Mesh(tg, new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 })); terr.castShadow = terr.receiveShadow = true; scene.add(terr);
    // The sea: deep water far out, a pale shelf along every coast, painted once for the whole table so that no two bays look alike; a faint ripple drifts over it.
    var deep = new T.Mesh(new T.PlaneGeometry(2400, 2400), new T.MeshStandardMaterial({ color: lin(0x2783c9), roughness: 0.45, metalness: 0 })); deep.rotation.x = -Math.PI / 2; deep.position.set(gw / 2, -0.04, gh / 2); scene.add(deep);
    var sea = new T.Mesh(new T.PlaneGeometry(gw, gh), new T.MeshStandardMaterial({ map: paintSea(land, b2, gw, gh), roughness: 0.45, metalness: 0 })); sea.rotation.x = -Math.PI / 2; sea.position.set(gw / 2, 0, gh / 2); sea.receiveShadow = true; scene.add(sea);
    M.water = new T.Mesh(new T.PlaneGeometry(2400, 2400), new T.MeshBasicMaterial({ map: cloned('water', 300, 300), transparent: true, opacity: 0.13, depthWrite: false }));
    M.water.rotation.x = -Math.PI / 2; M.water.position.set(gw / 2, 0.03, gh / 2); scene.add(M.water);
    M.sun = lights(scene, gw / 2, gh / 2, 520, -0.75, 0.3);

    // Towns and roads know where they stand.
    var all = WD.towns.concat([WD.HOME]), mask = new Uint8Array(gw * gh);
    all.forEach(function (t) { t.x = mx(t.at[1]); t.z = mz(t.at[0]); t.gy = M.h(t.x, t.z); });
    function near(p) { for (var a = -2; a <= 2; a++) for (var b = -2; b <= 2; b++) { var qx = Math.round(p[0]) + a, qz = Math.round(p[1]) + b; if (qx >= 0 && qz >= 0 && qx < gw && qz < gh) mask[qz * gw + qx] = 1; } }
    var RP = [], RI = [], RC = []; M.links = [];
    WD.links.forEach(function (l) {
      var a = townOf(l.a), b = townOf(l.b), pts = [[a.x, a.z]]; (l.via || []).forEach(function (v) { pts.push([mx(v[1]), mz(v[0])]); }); pts.push([b.x, b.z]);
      var v0 = RP.length / 3, n = ribbon(pts, 1.25, 0.16, RP, RI, near); M.links.push({ l: l, v0: v0, n: n }); for (i = 0; i < n * 3; i++) RC.push(1);
    });
    var rg = new T.BufferGeometry(); rg.setAttribute('position', new T.Float32BufferAttribute(RP, 3)); rg.setAttribute('color', new T.Float32BufferAttribute(RC, 3)); rg.setIndex(RI); rg.computeVertexNormals();
    M.roads = new T.Mesh(rg, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })); M.roads.receiveShadow = true; scene.add(M.roads);
    var VP = [], VI = [];
    RIVERS.forEach(function (rv) { ribbon(rv.map(function (p) { return [mx(p[1]), mz(p[0])]; }), 1.3, 0.1, VP, VI, near); });
    var vg = new T.BufferGeometry(); vg.setAttribute('position', new T.Float32BufferAttribute(VP, 3)); vg.setIndex(VI); vg.computeVertexNormals();
    scene.add(new T.Mesh(vg, new T.MeshStandardMaterial({ color: lin(0x4cb8ea), roughness: 0.5, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })));

    // The woods: a few thousand trees, each one a faceted ball, drawn in two calls.
    var spots = [[], []], cx = mx(WD.MANILA[1]), cz = mz(WD.MANILA[0]);
    for (iz = 3; iz < gh - 3; iz += 5) for (ix = 3; ix < gw - 3; ix += 5) {
      var tx = ix + (hash(ix, iz) - 0.5) * 4, tz = iz + (hash(iz, ix) - 0.5) * 4, ty = M.h(tx, tz); if (ty < 0.3 || ty > 13) continue;
      if (!(vnoise(tx / 23, tz / 23) > 0.55 || (ty > 1.4 && hash(ix * 3, iz * 7) > 0.3))) continue;
      if (mask[Math.round(tz) * gw + Math.round(tx)] || Math.hypot(tx - cx, tz - cz) < 15) continue;
      var okT = true; for (i = 0; i < all.length && okT; i++) if (Math.hypot(tx - all[i].x, tz - all[i].z) < 8) okT = false;
      if (okT) spots[hash(ix, iz * 3) > 0.5 ? 1 : 0].push([tx, ty, tz, 0.9 + hash(ix * 5, iz) * 0.8]);
    }
    var dummy = new T.Object3D();
    spots.forEach(function (list, k) {
      var im = new T.InstancedMesh(new T.DodecahedronGeometry(1, 0), new T.MeshStandardMaterial({ color: lin(k ? 0x2e8744 : 0x1f6e4a), flatShading: true, roughness: 1, metalness: 0 }), list.length);
      list.forEach(function (s, n) { dummy.position.set(s[0], s[1] + s[3] * 0.75, s[2]); dummy.scale.set(s[3], s[3] * 1.25, s[3]); dummy.rotation.y = s[3] * 9; dummy.updateMatrix(); im.setMatrixAt(n, dummy.matrix); });
      im.castShadow = im.receiveShadow = true; im.frustumCulled = false; scene.add(im);
    });

    // The towns: a handful of houses round a flagpole, a church in a capital.
    var towns = new T.Group(); scene.add(towns);
    K.weldInto(towns, function (root) {
      all.forEach(function (t, n) {
        var man = t.prov === 'manila', sc = man ? 0.95 : t.boss ? 2.5 : t === WD.HOME ? 2.2 : 2, g = new T.Group(), r = rng(n * 131 + 17), cnt = man ? 5 : 4 + (n > 12 ? 1 : 0) + (t.boss ? 2 : 0), a0 = r() * 6.283;
        g.position.set(t.x, t.gy, t.z); g.scale.setScalar(sc); root.add(g); t.pole = 4.3 * sc;
        K.cyl(g, 0.07, 0.1, 4.3, 0x6b4a2e, 0, 0, 0, 5);
        for (i = 0; i < cnt; i++) {
          var a = a0 + i / cnt * 6.283 + (r() - 0.5) * 0.5, d = 1.9 + r() * 1.5, h = sub(g, Math.cos(a) * d, Math.sin(a) * d, r() * 6.283);
          if (t.boss && i === 0 && t.id !== 'intramuros') { // the church
            h.rotation.y = 0; K.tbox(h, 1.9, 2.1, 3.4, 'plaster', 0, 0, 0); K.roof(h, 2.3, 3.8, 1, 'tile', 0, 2.1, 0); K.tbox(h, 1.1, 3.7, 1.1, 'plaster', 1.4, 0, 1.3); K.roof(h, 1.4, 1.4, 0.9, 'tile', 1.4, 3.7, 1.3); K.cross(h, 0.6, 0x3a3440, 1.4, 4.6, 1.3);
          } else if (man || r() < (t.boss ? 0.7 : 0.35)) { K.tbox(h, 2, 1.6, 1.6, 'plaster', 0, 0, 0); K.roof(h, 2.5, 2.1, 0.9, 'tile', 0, 1.6, 0); }
          else { K.tbox(h, 1.7, 1, 1.4, 'sawali', 0, 0.2, 0); K.roof(h, 2.3, 2, 1.05, 'nipa', 0, 1.2, 0); }
        }
        if (t.id === 'intramuros') [[0, -3.4, 7.4, 0.6], [0, 3.4, 7.4, 0.6], [-3.4, 0, 0.6, 7.4], [3.4, 0, 0.6, 7.4]].forEach(function (wl) { K.tbox(g, wl[2], 1.1, wl[3], 'stone', wl[0], 0, wl[1], 0xe0dccc, 1); });
      });
    });
    all.forEach(function (t) {
      var fs = t.prov === 'manila' ? 0.75 : t.boss ? 1.5 : 1.15, geo = new T.PlaneGeometry(3 * fs, 2 * fs, 5, 1); geo.translate(1.5 * fs, 0, 0);
      var f = new T.Mesh(geo, flagTex(t === WD.HOME)); f.position.set(t.x, t.gy + t.pole - fs, t.z + 0.06); f.userData.ph = t === WD.HOME; f.userData.top = t.gy + t.pole; f.userData.fs = fs; scene.add(f); M.flags[t.id] = f;
      if (t === WD.HOME) return;
      var rg2 = new T.RingGeometry(4.2, 5, 36); rg2.rotateX(-Math.PI / 2);
      var ring = new T.Mesh(rg2, M.ringM || (M.ringM = new T.MeshBasicMaterial({ color: 0xffd35a, transparent: true, opacity: 0.9, depthTest: false }))); ring.position.set(t.x, t.gy + 0.3, t.z); ring.renderOrder = 4; ring.visible = false; scene.add(ring); M.rings[t.id] = ring;
      if (t.prov === 'manila') ring.scale.setScalar(0.5);
    });

    // The wall the Captain-General threw round Manila: whole, and breached.
    var R = WD.MANILA[2] * KM, N = 44; M.wall = [new T.Group(), new T.Group()]; scene.add(M.wall[0]); scene.add(M.wall[1]);
    [0, 1].forEach(function (broken) {
      K.weldInto(M.wall[broken], function (root) {
        for (i = 0; i < N; i++) {
          var a = i / N * 6.283, x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R, gy = M.h(x, z); if (gy < 0.12) continue;
          var gone = broken && (i % 11 < 4), g = sub(root, x, z, -a + Math.PI / 2); g.position.y = gy;
          if (gone) { if (i % 2) for (j = 0; j < 3; j++) K.tbox(g, 0.5, 0.3, 0.5, 'stone', -0.6 + j * 0.6, 0, (j - 1) * 0.4, 0xc8c4b8, 1).rotation.y = j; continue; }
          K.tbox(g, R * 6.283 / N + 0.1, 1.5, 0.75, 'stone', 0, 0, 0, 0xe0dccc, 1);
          if (i % 4 === 0) { K.tbox(g, 1.15, 2.3, 1.15, 'stone', 0, 0, 0, 0xd0ccbc, 1); K.box(g, 1.35, 0.14, 1.35, 0x8a8478, 0, 2.3, 0); }
        }
      });
    });
    M.colG = new T.Group(); scene.add(M.colG);
    M.camera = new T.OrthographicCamera(-1, 1, 1, -1, 10, 2600);
    M.stage = { scene: scene, camera: M.camera, update: mapUpdate, soft: 0.55, red: 0, shadow: true };
  }
  M.maxV = function () { return Math.min(C.W / 2 / (window.innerWidth / window.innerHeight), C.H * SIN / 2) * 0.985; };
  M.bound = function (wide) { // nothing beyond the edge of the table is ever seen
    var c = M.cam, a = window.innerWidth / window.innerHeight, top = M.maxV(); c.v = clamp(c.v, top / (wide ? 40 : 7), top);
    var hw = c.v * a, hd = c.v / SIN; c.x = clamp(c.x, hw + 1, C.W - hw - 1); c.z = clamp(c.z, hd + 1, C.H - hd - 1);
  };
  M.screen = function (x, z, y) { var c = M.cam, k = window.innerHeight / 2 / c.v; return [window.innerWidth / 2 + (x - c.x) * k, window.innerHeight / 2 + ((z - c.z) * SIN - (y || 0) * COS) * k]; };
  M.pick = function (px, py) { var c = M.cam, k = c.v / (window.innerHeight / 2); return [c.x + (px - window.innerWidth / 2) * k, c.z + (py - window.innerHeight / 2) * k / SIN]; };
  function mapUpdate(dt, clock) {
    var c = M.cam, cam = M.camera, a = window.innerWidth / window.innerHeight, key = c.v + '|' + a, i, k;
    if (key !== M.camKey) { M.camKey = key; cam.left = -c.v * a; cam.right = c.v * a; cam.top = c.v; cam.bottom = -c.v; cam.updateProjectionMatrix(); }
    cam.position.set(c.x, SIN * 900, c.z + COS * 900); cam.lookAt(c.x, 0, c.z);
    M.water.material.map.offset.set(clock * 0.006, clock * 0.01);
    var fz = clamp(c.v / 95, 1, 2.3);
    for (k in M.flags) { var f = M.flags[k], p = f.geometry.attributes.position; f.scale.setScalar(fz); f.position.y = f.userData.top - f.userData.fs * fz; for (i = 0; i < p.count; i++) { var u = p.getX(i); p.setZ(i, Math.sin(clock * 4 - u * 1.6 + f.position.x) * 0.1 * u); } p.needsUpdate = true; }
    var s = 1 + 0.16 * Math.sin(clock * 4); for (k in M.rings) if (M.rings[k].visible) M.rings[k].scale.setScalar(s * (M.rings[k].userData.s || 1));
    for (i = 0; i < M.cols.length; i++) {
      var h = M.cols[i]; if (!h.visible) continue;
      for (k = 0; k < 3; k++) { var fr = h.userData.fr[k], m = h.children[k]; m.material = (h.userData.ok ? fmat : dmat)(fr[[0, 2, 1, 2][Math.floor(clock * 7 + k * 1.3 + i) % 4]]); m.position.y = Math.abs(Math.sin(clock * 7 + k * 1.3 + i)) * 0.12; }
    }
  }
  // state: owns(id), open(t), wallDown
  M.sync = function (owns, open, wallDown) {
    var k, col = M.roads.geometry.attributes.color, held = lin(0xb98f5a), free = lin(0xffe680), i;
    WD.towns.forEach(function (t) {
      var ph = owns(t.id), f = M.flags[t.id]; if (f.userData.ph !== ph) { f.userData.ph = ph; f.material = flagTex(ph); }
      var r = M.rings[t.id]; r.visible = open(t); r.userData.s = t.prov === 'manila' ? 0.5 : 1;
    });
    M.links.forEach(function (e) { var c = owns(e.l.a) && owns(e.l.b) ? free : held; for (i = e.v0; i < e.v0 + e.n; i++) col.setXYZ(i, c.r, c.g, c.b); });
    col.needsUpdate = true;
    if (M.wall[0].visible !== !wallDown || M.wall[1].visible !== !!wallDown) { M.wall[0].visible = !wallDown; M.wall[1].visible = !!wallDown; M.stage.shadow = true; }
  };
  var PRISONER = { top: 0xf4ecd8, bottom: 0x8a6a48, hair: 0x2a1c16 };
  M.setCols = function (list) { // the columns and convoys on the roads: [{ x, z, kind, dir, ok }]
    var g = WD.kinds.guardia.look, i, k;
    for (i = 0; i < list.length; i++) {
      var c = list[i], h = M.cols[i];
      if (!h) {
        h = new T.Group(); var geo = new T.PlaneGeometry(2.3, 4.5); geo.translate(0, 2.25, 0);
        for (k = 0; k < 3; k++) { var m = new T.Mesh(geo, fmat(frames(g)[2])); h.add(m); }
        var sg = new T.CircleGeometry(2.2, 14); sg.rotateX(-Math.PI / 2); var sh = new T.Mesh(sg, new T.MeshBasicMaterial({ color: 0x10142a, transparent: true, opacity: 0.3, depthWrite: false })); sh.scale.z = 0.6; sh.position.y = 0.2; h.add(sh);
        M.colG.add(h); M.cols.push(h);
      }
      h.visible = true; h.position.set(c.x, M.h(c.x, c.z) + 0.2, c.z); h.userData.ok = c.ok;
      h.userData.fr = [frames(g), frames(c.kind === 'conv' ? PRISONER : g), frames(g)];
      for (k = 0; k < 3; k++) { h.children[k].position.x = (k - 1) * 1.7; h.children[k].position.z = k === 1 ? 0.3 : 0; h.children[k].scale.x = c.dir < 0 ? -1 : 1; }
    }
    for (; i < M.cols.length; i++) M.cols[i].visible = false;
  };
  M.show = function () { buildMap(); if (W.showing() !== M.stage) W.show(M.stage); };
  M.build = buildMap;
  V.map = M; V.mx = mx; V.mz = mz; V.KM = KM;

  // =====================================================================================================================
  // The field of a battle. The rules count in a field of 100 by 56 (x east, y south); here two of those make one world unit.
  // =====================================================================================================================
  var Bt = { EL: Math.atan(Math.SQRT1_2), stage: null, tx: 3, tz: -1, v: 16, shots: [], blasts: [], puffs: [], sn: 0, bn: 0, pn: 0, gates: null };
  var BS = Math.sin(Bt.EL), BC = Math.cos(Bt.EL);
  function wx(x) { return (x - 50) * 0.5; }
  function wz(y) { return (y - 28) * 0.5; }
  // Every town has its own lie of the land. f: what grows before it; w: its waters; ch: its church (t towers, dome, s size, tall, conv);
  // hs: the share of stone houses; n: houses; def: what the garrison stands behind; mt: mountains behind [x, r, h]; tr: its trees; ex: the rest.
  var SITES = {
    binan: { f: 'rice', hs: 0.75, n: 10, def: 'carts', tr: ['mango', 'palm', 'banana'], ch: { x: 98, y: 13, t: 1 }, ex: [['stalls', 85, 41], ['stalls', 91, 42]] },
    sanpablo: { f: 'coco', w: [{ t: 'pond', x: 28, y: -11, r: 11 }], hs: 0.4, n: 9, def: 'stakes', tr: ['palm', 'palm', 'palm', 'banana'], td: 70, ch: { x: 98, y: 14, t: 1 }, mt: [[70, 8, 10], [92, 6, 7]], ex: [['boat', 26, -10, 0.5]] },
    pagsanjan: { f: 'coco', w: [{ t: 's', y: 53.5 }], hs: 0.5, n: 9, def: 'stone', tr: ['palm', 'mango', 'forest'], ch: { x: 99, y: 13, t: 1 }, mt: [[20, 7, 8], [40, 8, 10], [62, 7, 8]], ex: [['arch', 70, 28], ['boat', 40, 58, 0.3], ['boat', 75, 59, -0.2]] },
    santacruz: { f: 'rice', w: [{ t: 'n', y: 2 }], hs: 0.6, n: 12, def: 'sacks', tr: ['palm', 'acacia', 'mango'], ch: { x: 97, y: 13, t: 2, s: 1.1 }, casa: [96, 45], ex: [['boat', 20, -6, 0.4], ['boat', 52, -9, -0.3], ['boat', 70, -5, 0.9]] },
    silang: { f: 'forest', hs: 0.3, n: 8, def: 'stakes', tr: ['forest', 'forest', 'mango', 'acacia'], td: 80, ch: { x: 98, y: 13, t: 1, s: 0.95 }, mt: [[5, 9, 8], [30, 8, 7], [55, 10, 9], [80, 8, 7]] },
    imus: { f: 'rice', w: [{ t: 'riv', p: [[-40, -2], [20, 3], [45, 1], [70, -6], [140, -10]], hw: 3 }], hs: 0.5, n: 10, def: 'trench', tr: ['palm', 'banana', 'mango'], ch: { x: 98, y: 14, t: 1 }, casa: [95, 45], ex: [['road', [30, 26], [32, 6]], ['bridge', 32, 2.3, 1.571, 5, 1]] },
    malabon: { f: 'rice', hs: 0.2, n: 12, def: 'sacks', tr: ['banana', 'palm', 'mango'], ch: { x: 96, y: 13, t: 1, conv: 1, s: 1.05 } },
    cavite: { f: 'grass', w: [{ t: 'n', y: 3 }, { t: 's', y: 53 }], hs: 0.9, n: 9, def: 'stone', tr: ['palm'], td: 14, ch: { x: 99, y: 14, t: 1 }, fort: [93, 46, 2.7], paved: 1, ex: [['ship', 45, -9, 0.1], ['boat', 20, 59, 0.3], ['shed', 84, 11], ['shed', 91, 11]] },
    tanauan: { f: 'cane', hs: 0.4, n: 9, def: 'carts', tr: ['mango', 'acacia', 'palm'], ch: { x: 98, y: 13, t: 1 }, mt: [[45, 11, 11]] },
    lipa: { f: 'coffee', hs: 0.9, n: 12, def: 'stone', tr: ['forest', 'mango', 'flame'], ch: { x: 97, y: 12, t: 1, dome: 1, s: 1.2, tall: 1 }, ex: [['stalls', 86, 41]] },
    taal: { f: 'cane', w: [{ t: 's', y: 53.5 }], hs: 0.7, n: 10, def: 'sacks', tr: ['palm', 'mango', 'flame'], ch: { x: 97, y: 11, t: 2, s: 1.45 }, mt: [[25, 9, 7]], ex: [['boat', 30, 59, 0.2], ['boat', 60, 58, -0.4]] },
    batangas: { f: 'coco', w: [{ t: 's', y: 52.5 }], hs: 0.7, n: 12, def: 'stone', tr: ['palm', 'palm', 'acacia'], td: 55, ch: { x: 98, y: 12, t: 1, dome: 1, s: 1.1 }, casa: [85, 7], ex: [['ship', 70, 61, 3.2], ['boat', 30, 58, 0.3]] },
    binangonan: { f: 'grass', w: [{ t: 's', y: 52 }], hs: 0.2, n: 9, def: 'stakes', tr: ['banana', 'palm', 'forest'], ch: { x: 98, y: 13, t: 1, s: 0.95 }, mt: [[25, 8, 6], [65, 9, 8]], ex: [['boat', 25, 58, 0.2], ['boat', 48, 61, -0.5], ['boat', 80, 57, 0.8], ['baklad', 62, 59]] },
    tanay: { f: 'rice', w: [{ t: 'riv', p: [[-40, 4], [30, 1], [60, 4], [140, -2]], hw: 2.2 }], hs: 0.3, n: 9, def: 'trench', tr: ['forest', 'forest', 'palm'], td: 60, ch: { x: 98, y: 14, t: 1 }, mt: [[10, 10, 11], [38, 11, 14], [68, 10, 12], [98, 9, 10]], ex: [['road', [44, 26], [45, 8]], ['bridge', 45, 2.6, 1.571, 4, 0]] },
    antipolo: { f: 'forest', hs: 0.4, n: 9, def: 'stakes', tr: ['forest', 'forest', 'acacia', 'mango'], td: 100, ch: { x: 96, y: 12, t: 2, dome: 1, s: 1.2 }, mt: [[15, 8, 6]] },
    morong: { f: 'rice', w: [{ t: 's', y: 53 }], hs: 0.5, n: 11, def: 'stone', tr: ['mango', 'palm', 'acacia'], ch: { x: 98, y: 12, t: 1, s: 1.15, tall: 2 }, casa: [85, 7], mt: [[60, 8, 7]], ex: [['boat', 50, 59, 0.2]] },
    sanjose: { f: 'forest', hs: 0.1, n: 7, def: 'stakes', tr: ['forest', 'forest', 'forest', 'banana'], td: 110, ch: { x: 98, y: 14, t: 0, s: 0.8 }, mt: [[8, 9, 8], [32, 8, 7], [58, 9, 9], [86, 8, 8]] },
    meycauayan: { f: 'rice', w: [{ t: 'riv', p: [[-40, 1], [40, 3], [90, 0], [140, 2]], hw: 2.6 }], hs: 0.6, n: 10, def: 'carts', tr: ['mango', 'banana', 'palm'], ch: { x: 98, y: 15, t: 1, s: 1.15 }, ex: [['road', [52, 26], [53, 8]], ['bridge', 53, 2.4, 1.571, 4.6, 1], ['boat', 20, 2, 0.1]] },
    malolos: { f: 'rice', w: [{ t: 's', y: 53 }], hs: 0.7, n: 12, def: 'sacks', tr: ['mango', 'acacia', 'palm', 'flame'], ch: { x: 97, y: 12, t: 1, conv: 1, s: 1.1 }, ex: [['boat', 35, 58, 0.2], ['boat', 85, 59, -0.2], ['stalls', 86, 41]] },
    bulacan: { f: 'pond', w: [{ t: 'n', y: 2.5 }], hs: 0.5, n: 12, def: 'stone', tr: ['palm', 'banana'], td: 22, ch: { x: 97, y: 13, t: 1, s: 1.2 }, casa: [96, 45], ex: [['boat', 30, -7, 0.3], ['boat', 66, -5, -0.4]] },
    tondo: { f: 'huts', w: [{ t: 'n', y: 2 }], hs: 0, n: 18, def: 'carts', tr: ['banana', 'palm'], td: 20, ch: { x: 99, y: 13, t: 2 }, ex: [['casco', 20, -5, 0.05], ['casco', 50, -8, -0.1], ['boat', 75, -4, 0.3]] },
    sampaloc: { f: 'garden', hs: 1, n: 14, def: 'sacks', tr: ['flame', 'acacia', 'narra', 'mango'], td: 55, ch: { x: 98, y: 13, t: 1 }, paved: 1 },
    santaana: { f: 'rice', w: [{ t: 'n', y: 3 }], hs: 0.7, n: 11, def: 'stone', tr: ['mango', 'palm', 'acacia'], ch: { x: 97, y: 14, t: 1, dome: 1 }, paved: 1, ex: [['casco', 25, -6, 0.05], ['casco', 60, -9, -0.08], ['boat', 85, -5, 0.4]] },
    malate: { f: 'coco', w: [{ t: 's', y: 52.5 }], hs: 0.6, n: 10, def: 'trench', tr: ['palm', 'palm', 'acacia'], td: 45, ch: { x: 97, y: 12, t: 2 }, fort: [91, 46, 2.5], paved: 1, ex: [['boat', 25, 59, 0.2], ['boat', 55, 61, -0.3]] },
    intramuros: { f: 'grass', w: [{ t: 'n', y: -14 }, { t: 'rect', b: [57.5, -40, 61.8, 21.5] }, { t: 'rect', b: [57.5, 34.5, 61.8, 80] }], tr: ['acacia', 'flame', 'palm'], td: 26, paved: 2, walled: 1, flag: [63.5, 28, 5.6] }
  };
  function wild(seed) { // a place on the road, for a skirmish
    var r = rng(seed * 7919 + 5), f = ['rice', 'cane', 'coco', 'grass', 'forest'][Math.floor(r() * 5)], s = { f: f, tr: [['palm', 'banana', 'mango'], ['forest', 'forest', 'mango'], ['palm', 'acacia']][Math.floor(r() * 3)], td: 40 + r() * 50, n: 0, open: 1 };
    var k = r(); if (k < 0.3) s.w = [{ t: 'n', y: 2.5 }]; else if (k < 0.55) s.w = [{ t: 's', y: 53 }]; else if (k < 0.7) s.w = [{ t: 'riv', p: [[-40, 2], [50, 4 - r() * 4], [140, 1]], hw: 2.4 }];
    if (r() < 0.5) { s.mt = []; for (var i = 0; i < 3; i++) s.mt.push([10 + i * 35 + r() * 15, 7 + r() * 4, 6 + r() * 7]); }
    s.huts = 2 + Math.floor(r() * 3); return s;
  }
  var G3 = [0x4f9f3e, 0x62b548, 0x7fcb55], GD3 = [0x3f8438, 0x4e9540, 0x65a84b], GL3 = [0x7fbf66, 0x8fcf6c, 0xa4dd76], PV = [0xe8d6a8, 0xdcc898, 0xf0e0b8], FLW = [0xfff2a0, 0xffffff, 0xff7ab0, 0xff5a4a, 0xc58cff];
  function segD(px, pz, a, b) { var dx = b[0] - a[0], dz = b[1] - a[1], t = clamp(((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz), 0, 1); return Math.hypot(px - a[0] - dx * t, pz - a[1] - dz * t); }
  function waterD(site, x, y) { // how far from water (below nought: in it)
    var d = 99, w = site.w, i, j, e;
    if (!w) return d;
    for (i = 0; i < w.length; i++) {
      var s = w[i];
      if (s.t === 'n') e = y - s.y; else if (s.t === 's') e = s.y - y; else if (s.t === 'pond') e = Math.hypot(x - s.x, y - s.y) - s.r;
      else if (s.t === 'rect') e = Math.max(s.b[0] - x, x - s.b[2], s.b[1] - y, y - s.b[3]);
      else { e = 99; for (j = 1; j < s.p.length; j++) e = Math.min(e, segD(x, y, s.p[j - 1], s.p[j]) - s.hw); }
      if (e < d) d = e;
    }
    return d;
  }
  // The ground of a field, painted in the hand of the town's (sprites.js, ground): 6 pixels to a unit of the field.
  var GW = 1080, GH = 720;
  function paintGround(site, seed) {
    var cv = Bt.cv || (Bt.cv = document.createElement('canvas')); cv.width = GW; cv.height = GH;
    var ctx = cv.getContext('2d'), img = ctx.createImageData(GW, GH), d = img.data, px, py, o = 0, f = site.f, roads = (site.ex || []).filter(function (e) { return e[0] === 'road'; }), stone = site.paved, walled = site.walled, i;
    for (py = 0; py < GH; py++) for (px = 0; px < GW; px++, o += 4) {
      var x = px / 6 - 40, y = py / 6 - 40, h = hash(px, py), n = vnoise(x * 0.11 + seed, y * 0.11 + seed * 2), n2 = vnoise(x * 0.45 + 7, y * 0.45 + 3), gi = n + (h - 0.5) * 0.18, gk = gi < 0.38 ? 0 : gi < 0.62 ? 1 : 2, a = 255;
      var c = h < 0.03 ? GD3[gk] : h > 0.975 ? GL3[gk] : G3[gk], road = Math.abs(y - (28 + 2.2 * Math.sin(x / 14 + seed))) - 2.6 + (n2 - 0.5) * 0.7, inF = x < 53 + (n2 - 0.5) * 4 && road > 2.2, fx, fz;
      if (n2 > 0.6 && h > 0.9 && h < 0.94) c = FLW[(px * 7 + py * 13) % 5];
      if (f === 'forest' && (inF || x < 60) && n > 0.42) c = gi < 0.55 ? 0x2f7a3c : 0x3f8f44;
      else if (f === 'rice' && inF) {
        fx = (x + seed * 5) / 6.2; fz = y / 6.2; var lx = fx - Math.floor(fx), lz = fz - Math.floor(fz);
        if (hash(Math.floor(fx) + 3, Math.floor(fz) * 5 + Math.floor(seed)) > 0.3) {
          if (lx < 0.06 || lx > 0.94 || lz < 0.06 || lz > 0.94) c = h < 0.3 ? 0x7a5a38 : 0x94703f;
          else if (hash(Math.floor(fx) + 9, Math.floor(fz) * 3) > 0.55) c = (px & 1) ? (h > 0.9 ? 0xf2e06a : 0xc6d84a) : 0x86b03c;
          else c = (px % 4 === 1 && py % 4 < 3) ? 0x9aea4a : (n2 > 0.6 ? 0x6cc0b8 : 0x4fa6a6);
        }
      } else if (f === 'cane' && inF) {
        fx = (x + seed * 3) / 15; fz = y / 11; if (fx - Math.floor(fx) > 0.08 && fz - Math.floor(fz) > 0.1 && hash(Math.floor(fx) + 1, Math.floor(fz) * 7 + Math.floor(seed)) > 0.25) c = (px % 3 === 0) ? 0x5c9a34 : (h > 0.85 ? 0xd8e07a : (py & 1) ? 0x9cc84a : 0x86b83e);
      } else if (f === 'coffee' && inF) { if (px % 10 < 5 && py % 10 < 5 && hash(px / 10 | 0, py / 10 | 0) > 0.12) c = (px % 10 === 2 && py % 10 === 2 && h > 0.5) ? 0xd8322a : h > 0.5 ? 0x2f7a3c : 0x266a34; }
      else if (f === 'garden' && inF) { if (h > 0.9) c = FLW[(px * 3 + py * 5) % 5]; if (Math.abs(((x + y) % 16) - 8) < 0.5 || Math.abs(((x - y + 160) % 16) - 8) < 0.5) c = 0xdcc084; }
      else if (f === 'pond' && x < 60 && (y < 9.5 || y > 46.5) && road > 2.2) {
        fx = (x + seed) / 9; fz = y / 7; var qx = fx - Math.floor(fx), qz = fz - Math.floor(fz);
        if (qx < 0.07 || qx > 0.93 || qz < 0.09 || qz > 0.91) c = h < 0.3 ? 0x7a5a38 : 0x94703f; else a = 0;
      }
      if (x > 64 && !site.open) { // the trodden earth of the town, or its paving
        var k = clamp((x - 64) / 9, 0, 1) * (stone ? 1 : 0.85);
        if (h < k || (stone && x > 72)) c = stone ? ((px % 12 === 0 || py % 12 === 0) ? 0xb8a47e : PV[Math.floor(hash(px / 12 | 0, py / 12 | 0) * 3) % 3]) : (h < 0.1 ? 0x8f6f45 : h > 0.93 ? 0xe0c48c : 0xbc9866);
        if (!stone && x > 81 && x < 96 && y > 20.5 && y < 35.5) c = (px % 12 === 0 || py % 12 === 0) ? 0xb8a47e : PV[Math.floor(hash(px / 12 | 0, py / 12 | 0) * 3) % 3]; // the plaza
      }
      if (site.def === 'trench' && x > 62.4 && x < 63.9 && y > 6 && y < 50 && Math.abs(y - 28) > 4) c = x < 62.7 || x > 63.6 ? 0x8f6f45 : h < 0.4 ? 0x3a2a1e : 0x4a3626;
      for (i = 0; i < roads.length; i++) road = Math.min(road, segD(x, y, roads[i][1], roads[i][2]) - 1.6 + (n2 - 0.5) * 0.5);
      if (road < 0) c = h < 0.12 ? 0xb9975f : h > 0.92 ? 0xf0dcae : 0xdcc084; else if (road < 0.4 && h < 0.6) c = 0xa8935a;
      if (walled && x > 56.6 && x < 66.5) c = (px % 12 === 0 || py % 12 === 0) ? 0xa89878 : 0xc8bc9c; // the glacis under the wall
      var wd = waterD(site, x, y); if (wd < 90) { wd += walled && wd > -50 && x > 56 && x < 63 ? 0 : (n - 0.5) * 2.4; if (wd < 0) a = 0; else if (wd < 1.3) c = wd < 0.3 ? 0xc2a872 : (h > 0.9 ? 0xfff2cc : h < 0.1 ? 0xdcc88c : 0xeeddaa); }
      var e = Math.max(-36 - x, x - 136, -36 - y, y - 76); if (e > 0 && h < e / 4 && a) c = G3[gk]; // fade into the open country
      d[o] = (c >> 16) & 255; d[o + 1] = (c >> 8) & 255; d[o + 2] = c & 255; d[o + 3] = a;
    }
    ctx.putImageData(img, 0, 0);
    if (!Bt.gtex) { Bt.gtex = new T.CanvasTexture(cv); Bt.gtex.magFilter = T.NearestFilter; Bt.gtex.minFilter = T.LinearMipmapLinearFilter; Bt.gtex.encoding = T.sRGBEncoding; }
    Bt.gtex.needsUpdate = true;
  }

  // ---------- what stands on a field ----------
  function tree(root, kind, x, y, s, v) { var m = new T.Mesh(K.treeGeo(kind, v || 0), K.treeMat); m.position.set(wx(x), 0, wz(y)); m.scale.setScalar(s); m.rotation.y = hash(x * 3.7 + 1, y * 5.3 + 2) * 6.283; m.castShadow = m.receiveShadow = true; root.add(m); }
  function hut(root, x, y, rot, k) {
    var g = sub(root, wx(x), wz(y), rot);
    [[-0.8, -0.6], [0.8, -0.6], [-0.8, 0.6], [0.8, 0.6]].forEach(function (p) { K.cyl(g, 0.07, 0.07, 0.7, 0x7a5234, p[0], 0, p[1], 5); });
    K.tbox(g, 2.1, 0.12, 1.7, 'wood', 0, 0.62, 0); K.tbox(g, 2, 1.0, 1.6, 'sawali', 0, 0.74, 0);
    K.quad(g, 0.45, 0.75, K.mat(0x3a2616), 0.35, 0.74, 0.81, 0); K.quad(g, 0.5, 0.42, K.win, -0.45, 1.05, 0.81, 0);
    for (var i = 0; i < 3; i++) K.box(g, 0.5, 0.05, 0.12, 0xc9a66b, 0.35, 0.12 + i * 0.22, 0.95 + (2 - i) * 0.12);
    K.roof(g, 2.8, 2.4, 1.25, 'nipa', 0, 1.74, 0, k % 2 ? 0xfff0d8 : 0xffffff);
  }
  var TINTS = [0xffffff, 0xfff0d8, 0xf4e4d0, 0xe8f0f4, 0xfff6c8];
  function bato(root, x, y, rot, k, low) { // a bahay na bato: stone below, wood and capiz above
    var g = sub(root, wx(x), wz(y), rot), w = 2.6 + (k % 3) * 0.5, d = 2.1 + (k % 2) * 0.4, i;
    K.tbox(g, w, 1.3, d, k % 2 ? 'adobe' : 'stone', 0, 0, 0, 0xfff4e0, 1); K.quad(g, 0.6, 0.95, K.mat(0x3a2616), 0, 0, d / 2 + 0.01, 0);
    if (!low) { K.tbox(g, w + 0.4, 1.25, d + 0.4, 'plaster', 0, 1.3, 0, TINTS[k % 5]); K.box(g, w + 0.5, 0.1, d + 0.5, 0x7a5234, 0, 1.25, 0); for (i = 0; i < 3; i++) K.quad(g, 0.55, 0.6, K.win, (i - 1) * (w / 3), 1.65, d / 2 + 0.21, 0); }
    K.roof(g, w + 1, d + 1, 1.1, 'tile', 0, low ? 1.3 : 2.55, 0);
  }
  function church(root, o) {
    var s = o.s || 1, g = sub(root, wx(o.x), wz(o.y), 0), L = 7 * s, Wd = 4 * s, Hh = 3.6 * s, fx = -L / 2 - 0.1, tint = o.tint || 0xfff6e4, i, z;
    K.tbox(g, L, Hh, Wd, 'plaster', 0, 0, 0, tint); K.roof(g, L + 0.5, Wd + 0.6, 1.5 * s, 'tile', 0, Hh, 0);
    K.tbox(g, 0.5, Hh + 1.3 * s, Wd + 0.5, 'plaster', fx, 0, 0, 0xffffff); K.tbox(g, 0.5, 0.8 * s, Wd * 0.5, 'plaster', fx, Hh + 1.3 * s, 0, 0xffffff); K.cross(g, 0.9 * s, 0x3a3440, fx, Hh + 2.1 * s, 0);
    K.quad(g, 1.1 * s, 1.8 * s, K.mat(0x3a2616), fx - 0.26, 0, 0, -Math.PI / 2); K.quad(g, 0.8 * s, 0.8 * s, K.mat(0x7ab8d8), fx - 0.26, Hh * 0.62, 0, -Math.PI / 2);
    for (i = 0; i < 4; i++) K.tbox(g, 0.5, Hh * 0.8, 0.5, 'stone', -L * 0.3 + i * L * 0.22, 0, Wd / 2 + 0.2, 0xe8e0d0, 1); // buttresses
    for (i = 0; i < (o.t || 0); i++) {
      z = (i ? 1 : -1) * (Wd / 2 + 0.95 * s); var th = Hh + (o.tall ? 2.6 + o.tall * 1.6 : 2.4) * s;
      K.tbox(g, 1.7 * s, th, 1.7 * s, o.tall === 2 ? 'stone' : 'plaster', fx + 0.7, 0, z, tint); K.box(g, 1.9 * s, 0.14, 1.9 * s, 0x8a8478, fx + 0.7, th - 1.3 * s, z);
      K.quad(g, 0.6 * s, 0.9 * s, K.mat(0x2a1a12), fx + 0.7 - 0.86 * s, th - 1.15 * s, z, -Math.PI / 2); K.quad(g, 0.6 * s, 0.9 * s, K.mat(0x2a1a12), fx + 0.7, th - 1.15 * s, z + 0.86 * s, 0);
      K.roof(g, 2 * s, 2 * s, 1.3 * s, 'tile', fx + 0.7, th, z); K.cross(g, 0.6 * s, 0x3a3440, fx + 0.7, th + 1.3 * s, z);
    }
    if (o.dome) {
      K.cyl(g, 1.45 * s, 1.5 * s, 1.1 * s, 0xe8e0d0, L * 0.18, Hh + 0.5 * s, 0, 10);
      put(g, new T.Mesh(new T.SphereGeometry(1.5 * s, 10, 5, 0, 6.2832, 0, 1.5708), K.mat(0x8a9ab8)), L * 0.18, Hh + 1.6 * s, 0); K.cyl(g, 0.25 * s, 0.3 * s, 0.6 * s, 0xe8e0d0, L * 0.18, Hh + 3 * s, 0, 6); K.cross(g, 0.5 * s, 0x3a3440, L * 0.18, Hh + 3.6 * s, 0);
    }
    if (o.conv) { K.tbox(g, L * 0.85, Hh * 0.62, Wd * 0.7, 'plaster', 0.4, 0, -Wd / 2 - Wd * 0.35, tint); K.roof(g, L * 0.85 + 0.5, Wd * 0.7 + 0.5, 1 * s, 'tile', 0.4, Hh * 0.62, -Wd / 2 - Wd * 0.35); }
  }
  function casa(root, x, y, rot, tower) { // a casa real, or a casa hacienda: long, two floors, an arcade below
    var g = sub(root, wx(x), wz(y), rot), i;
    K.tbox(g, 8, 1.4, 3.2, 'adobe', 0, 0, 0, 0xfff4e0, 1); K.tbox(g, 8.4, 1.2, 3.6, 'plaster', 0, 1.4, 0); K.roof(g, 9.2, 4.4, 1.15, 'tile', 0, 2.6, 0);
    for (i = 0; i < 5; i++) { K.quad(g, 0.8, 1.0, K.mat(0x3a2616), -3.2 + i * 1.6, 0, 1.61, 0); K.quad(g, 0.7, 0.6, K.win, -3.2 + i * 1.6, 1.7, 1.81, 0); }
    if (tower) { K.tbox(g, 1.6, 5, 1.6, 'plaster', 0, 0, 0); K.quad(g, 0.7, 0.7, K.mat(0xfff6e4), 0, 3.9, 0.81, 0); K.roof(g, 1.9, 1.9, 1.1, 'tile', 0, 5, 0); }
  }
  function fort(root, x, y, r) {
    var g = sub(root, wx(x), wz(y), 0), i;
    [[0, -r, 2 * r, 0.6], [0, r, 2 * r, 0.6], [-r, 0, 0.6, 2 * r], [r, 0, 0.6, 2 * r]].forEach(function (w) { K.tbox(g, w[2], 1.5, w[3], 'stone', w[0], 0, w[1], 0xe8e2d4); });
    for (i = 0; i < 4; i++) { var bx = (i & 1 ? 1 : -1) * r, bz = (i & 2 ? 1 : -1) * r; K.cyl(g, 0.85, 1.0, 1.9, 0xc4bfb2, bx, 0, bz, 6); K.cyl(g, 0.95, 0.95, 0.12, 0x9a958a, bx, 1.9, bz, 6); }
    K.tbox(g, r, 1.1, r * 0.8, 'plaster', 0, 0, 0); K.roof(g, r + 0.4, r * 0.8 + 0.4, 0.7, 'tile', 0, 1.1, 0); K.quad(g, 0.8, 1.1, K.mat(0x3a2616), -r - 0.31, 0, 0, -Math.PI / 2);
  }
  function stalls(root, x, y) {
    [0xe8463a, 0x2f86e0, 0xf7b21a].forEach(function (col, i) {
      var g = sub(root, wx(x) + (i - 1) * 2.2, wz(y), 0);
      [[-0.8, -0.5], [0.8, -0.5], [-0.8, 0.5], [0.8, 0.5]].forEach(function (p) { K.cyl(g, 0.04, 0.04, 1.5, 0x8a6238, p[0], 0, p[1], 5); });
      K.tbox(g, 1.6, 0.5, 0.8, 'wood', 0, 0, 0); K.box(g, 1.9, 0.07, 1.3, col, 0, 1.5, 0).rotation.x = -0.25; K.box(g, 0.5, 0.2, 0.4, 0xffc21a, -0.3, 0.5, 0); K.box(g, 0.5, 0.2, 0.4, 0x58c43a, 0.35, 0.5, 0);
    });
  }
  function bridge(root, x, y, rot, len, stone) {
    var g = sub(root, wx(x), wz(y), rot), nm = stone ? 'stone' : 'wood';
    K.tbox(g, len, 0.28, 2.1, nm, 0, 0.05, 0, stone ? 0xe8e2d4 : 0xffe2c0, 1); [-1, 1].forEach(function (s) { K.tbox(g, len, 0.45, 0.18, nm, 0, 0.33, s * 1.0, stone ? 0xd8d2c4 : 0xf0d0a8, 1); });
    if (stone) [-0.28, 0.28].forEach(function (k) { K.tbox(g, 0.6, 0.6, 2.3, 'stone', len * k, -0.5, 0, 0xc8c2b4, 1); });
  }
  function boat(root, x, y, rot, col) {
    var g = sub(root, wx(x), wz(y), rot); g.position.y = 0.02;
    K.box(g, 2.3, 0.26, 0.5, 0x7a4a2a, 0, 0, 0); K.box(g, 2.3, 0.08, 0.52, col, 0, 0.2, 0); K.box(g, 1.8, 0.05, 0.08, 0xc9a66b, 0, 0.05, 0.85); K.box(g, 0.06, 0.05, 0.85, 0xc9a66b, -0.6, 0.14, 0.42); K.box(g, 0.06, 0.05, 0.85, 0xc9a66b, 0.6, 0.14, 0.42);
  }
  function casco(root, x, y, rot) { var g = sub(root, wx(x), wz(y), rot); K.box(g, 4.4, 0.45, 1.3, 0x6a4a2a, 0, 0, 0); K.box(g, 4.6, 0.08, 1.4, 0x8a6238, 0, 0.42, 0); K.roof(g, 2.8, 1.4, 0.75, 'nipa', 0.2, 0.5, 0); K.cyl(g, 0.04, 0.04, 2.2, 0x8a6238, -1.8, 0.4, 0, 5); }
  function ship(root, x, y, rot) { // a gunboat of the squadron, at anchor
    var g = sub(root, wx(x), wz(y), rot);
    K.box(g, 7.4, 1.0, 1.9, 0x2a2634, 0, 0, 0); K.box(g, 7, 0.16, 1.7, 0xc9a66b, 0, 1, 0); K.box(g, 2.2, 0.8, 1.2, 0xf0e8d8, 0.4, 1.16, 0); K.cyl(g, 0.34, 0.4, 1.9, 0xe0c460, 0.2, 1.9, 0, 8); K.cyl(g, 0.36, 0.36, 0.2, 0x2a2634, 0.2, 3.7, 0, 8);
    [-2.4, 2.6].forEach(function (m) { K.cyl(g, 0.06, 0.08, 4.4, 0x8a6238, m, 1.1, 0, 5); K.box(g, 0.05, 0.05, 2, 0x8a6238, m, 4.2, 0); }); K.box(g, 0.9, 0.55, 0.04, 0xc8202a, -3.5, 2.2, 0); K.cyl(g, 0.04, 0.04, 1.8, 0x8a6238, -3.9, 1.1, 0, 5);
  }
  function arch(root, x, y) { // the gate of Pagsanján, three arches across the royal road
    var g = sub(root, wx(x), wz(y), 0);
    [-3.4, -1.9, 1.9, 3.4].forEach(function (z, i) { K.tbox(g, 0.9, i % 3 ? 3 : 2.2, 0.8, 'plaster', 0, 0, z, 0xfff6e4); });
    K.tbox(g, 0.9, 0.9, 4.6, 'plaster', 0, 3, 0, 0xfff6e4); K.tbox(g, 0.9, 0.6, 1.7, 'plaster', 0, 2.2, -2.65, 0xfff6e4); K.tbox(g, 0.9, 0.6, 1.7, 'plaster', 0, 2.2, 2.65, 0xfff6e4);
    K.tbox(g, 0.7, 0.8, 1.6, 'plaster', 0, 3.9, 0, 0xffffff); K.quad(g, 0.9, 0.6, K.mat(0xc8202a), -0.46, 3.95, 0, -Math.PI / 2); [-1.9, 1.9].forEach(function (z) { K.box(g, 0.5, 0.4, 0.5, 0xd8d2c4, 0, 3.9, z); });
  }
  function defences(root, site, r) {
    var kind = site.def, y, X = wx(62.6);
    for (y = 9; y < 48; y += 7.2) {
      if (Math.abs(y + 1.6 - 28) < 5.5 || r() > 0.86) continue; var Z = wz(y + 1.6);
      if (kind === 'sacks') K.barricade(root, X, Z, -Math.PI / 2);
      else if (kind === 'stakes') { K.stakes(root, X - 0.4, Z, Math.PI / 2); K.sacks(root, X + 0.5, Z, -Math.PI / 2); }
      else if (kind === 'stone') { K.tbox(root, 0.6, 1.0, 3.3, 'stone', X, 0, Z, 0xe8e2d4, 1); K.tbox(root, 0.7, 0.3, 0.7, 'stone', X, 1, Z - 1.2, 0xd8d2c4, 1); K.tbox(root, 0.7, 0.3, 0.7, 'stone', X, 1, Z + 1.2, 0xd8d2c4, 1); }
      else if (kind === 'carts') { if (r() < 0.5) K.cart(root, X, Z, 0.2 + r() * 0.5, true); else { K.crates(root, X - 0.2, Z - 0.6); K.sacks(root, X, Z + 0.7, -Math.PI / 2); } }
      else { K.sacks(root, X - 0.75, Z, -Math.PI / 2); K.stakes(root, X - 1.5, Z, Math.PI / 2); }
    }
  }
  function intramuros(root, taken) { // the walled city, as the engravings of the century show it: curtain, bastions, garitas, the gate and its bridge
    var X = wx(63.5), i, z, top = 3.2, stoneT = 0xe4dece;
    [[-34, 21.5], [34.5, 80]].forEach(function (s) {
      var z0 = wz(s[0]), z1 = wz(s[1]), len = z1 - z0, zc = (z0 + z1) / 2;
      K.tbox(root, 1.5, top, len, 'stone', X, 0, zc, stoneT); K.tbox(root, 2.1, 1, len, 'stone', X - 0.12, 0, zc, 0xc8c2b2); K.box(root, 1.7, 0.12, len, 0x9a958a, X, top, zc);
      for (z = z0 + 0.5; z < z1; z += 1.5) K.tbox(root, 0.36, 0.5, 0.8, 'stone', X - 0.6, top + 0.1, z, stoneT, 1);
    });
    [3, 53].forEach(function (y) { // the bastions, each with its garita at the point
      var bx = X - 1.3, bz = wz(y); K.cyl(root, 3.3, 3.7, top, 0xcfc9ba, bx, 0, bz, 4); K.cyl(root, 3.4, 3.4, 0.14, 0x9a958a, bx, top, bz, 4);
      K.cyl(root, 0.42, 0.42, 1.1, stoneT, bx - 3, top, bz, 8); put(root, new T.Mesh(new T.ConeGeometry(0.58, 0.7, 8), K.mat(0xc4553a)), bx - 3, top + 1.45, bz);
      var gg = new T.Group(); gg.position.y = top; root.add(gg); K.gun(gg, bx - 1.2, bz - 0.8, -Math.PI / 2);
    });
    // The gate, after the Puerta Real: two piers, a heavy lintel, the royal arms above, garitas at its shoulders.
    [21.5, 34.5].forEach(function (y) { K.tbox(root, 2.3, 4.5, 1.5, 'stone', X, 0, wz(y), 0xf0eadc); K.cyl(root, 0.4, 0.4, 1, stoneT, X - 0.7, 4.5, wz(y), 8); put(root, new T.Mesh(new T.ConeGeometry(0.55, 0.7, 8), K.mat(0xc4553a)), X - 0.7, 5.85, wz(y)); });
    K.tbox(root, 2.3, 1.8, wz(33.75) - wz(22.25), 'stone', X, 2.7, wz(28), 0xf0eadc); K.tbox(root, 1.7, 1, 2.8, 'plaster', X, 4.5, wz(28), 0xffffff); K.box(root, 1.9, 0.14, 3.1, 0x9a958a, X, 5.5, wz(28));
    K.quad(root, 1.5, 1.1, K.mat(0xc8202a), X - 1.16, 3.15, wz(28), -Math.PI / 2); K.quad(root, 1.5, 0.5, K.mat(0xf7c930), X - 1.17, 3.45, wz(28), -Math.PI / 2);
    K.tbox(root, wx(62.2) - wx(57.1), 0.3, 6.2, 'stone', wx(59.65), 0.02, wz(28), 0xe8e2d4, 1); [-1, 1].forEach(function (s) { K.tbox(root, wx(62.2) - wx(57.1), 0.5, 0.25, 'stone', wx(59.65), 0.3, wz(28) + s * 3, 0xd8d2c4, 1); });
    // Inside: the cathedral under its dome, the Ayuntamiento with its clock, San Agustín, Fort Santiago by the river, and street after street of tile.
    church(root, { x: 84, y: 8, t: 1, dome: 1, s: 1.35, tint: 0xf4ecd8, tall: 1 }); casa(root, 102, 13, 0, true); church(root, { x: 101, y: -7, t: 2, s: 1.05, tint: 0xe8dcc4 });
    fort(root, 73, -7, 2.6); K.cyl(root, 0.06, 0.08, 4, 0x6b4a2e, wx(73), 1.1, wz(-7), 5);
    var r = rng(1571);
    for (i = 0; i < 26; i++) { var hx = 69 + (i % 9) * 6 + r() * 1.5, hy = i < 9 ? 46.5 : i < 18 ? 54 : -1 - r() * 2; if (i >= 18 && (hx > 76 && hx < 108)) hy = -17 + r() * 3; bato(root, hx, hy, i < 18 ? Math.PI : 0, i, i < 9); }
    [[70, 16], [78, 40], [92, 20], [92, 37], [106, 22]].forEach(function (p, k) { tree(root, k % 2 ? 'palm' : 'acacia', p[0], p[1], 1.05, k); });
    [[20, -10, 0.05], [48, -12, -0.1]].forEach(function (c) { casco(root, c[0], c[1] - 8, c[2]); });
  }
  function buildSite(root, site, spec, seed) {
    var r = rng(seed * 131 + 9), taken = [], i, x, y, k;
    function free(x, y, rad) { if (waterD(site, x, y) < rad + 0.8) return false; for (var j = 0; j < taken.length; j++) if (Math.hypot(x - taken[j][0], y - taken[j][1]) < rad + taken[j][2]) return false; return true; }
    function take(x, y, rad) { taken.push([x, y, rad]); }
    (site.ex || []).forEach(function (e) { if (e[0] === 'road') take((e[1][0] + e[2][0]) / 2, (e[1][1] + e[2][1]) / 2, 9); });
    if (site.walled) { intramuros(root); take(63, -6, 12); take(63, 60, 12); take(84, 8, 12); take(102, 13, 11); take(101, -7, 10); take(73, -7, 8); for (x = 66; x < 120; x += 6) { take(x, 50, 6); take(x, 0, 5); } }
    if (site.mt) site.mt.forEach(function (m) { K.mountain(wx(m[0]), -30 - m[1] * 0.35 - r() * 2, m[1], m[2], root); });
    if (site.ch) { church(root, site.ch); take(site.ch.x, site.ch.y, 9 * (site.ch.s || 1)); }
    if (site.casa) { casa(root, site.casa[0], site.casa[1], site.casa[1] > 28 ? Math.PI : 0); take(site.casa[0], site.casa[1], 9.5); K.cyl(root, 0.06, 0.08, 3.6, 0x6b4a2e, wx(site.casa[0] - 9), 0, wz(site.casa[1]), 5); }
    if (site.fort) { fort(root, site.fort[0], site.fort[1], site.fort[2]); take(site.fort[0], site.fort[1], site.fort[2] * 2 + 3.5); }
    (site.ex || []).forEach(function (e, n) {
      if (e[0] === 'stalls') { stalls(root, e[1], e[2]); take(e[1], e[2], 7); }
      else if (e[0] === 'boat') boat(root, e[1], e[2], e[3], [0x2f86e0, 0xe0463a, 0xf7c930][n % 3]);
      else if (e[0] === 'casco') casco(root, e[1], e[2], e[3]); else if (e[0] === 'ship') ship(root, e[1], e[2], e[3]);
      else if (e[0] === 'bridge') bridge(root, e[1], e[2], e[3], e[4], e[5]); else if (e[0] === 'arch') { arch(root, e[1], e[2]); }
      else if (e[0] === 'shed') { K.tbox(root, 3, 1.5, 2.4, 'adobe', wx(e[1]), 0, wz(e[2]), 0xfff4e0, 1); K.roof(root, 3.5, 2.9, 0.9, 'tile', wx(e[1]), 1.5, wz(e[2])); take(e[1], e[2], 4.5); }
      else if (e[0] === 'baklad') for (k = 0; k < 14; k++) K.cyl(root, 0.03, 0.03, 0.8, 0x8a6238, wx(e[1]) + Math.cos(k * 0.45) * 1.6 + k * 0.12, 0, wz(e[2]) + Math.sin(k * 0.45) * 1.2, 4);
    });
    // The houses, in rows either side of the street; the low ones to the south, so that the street is never hidden.
    var slots = [];
    if (!site.open && !site.walled) [16, 8, 0, -9, 44.5, 52].forEach(function (ry, ri) { for (x = 82; x < 116; x += 6.4) slots.push([x + (r() - 0.5) * 1.6, ry + (r() - 0.5) * 1.6, ri > 3, ri]); });
    if (site.f === 'huts') [5.5, 51].forEach(function (ry) { for (x = 6; x < 60; x += 7) slots.push([x + r() * 2, ry + r(), true, 0]); });
    slots.sort(function (a, b) { return (a[3] + hash(a[0], a[1]) * 2.2) - (b[3] + hash(b[0], b[1]) * 2.2); });
    var left = site.n || 0;
    slots.forEach(function (s, n) {
      if (left <= 0 || !free(s[0], s[1], 3.6)) return; left--; take(s[0], s[1], 3.4);
      var south = s[1] > 28, stone = r() < (site.hs || 0);
      if (stone) bato(root, s[0], s[1], south ? Math.PI : 0, n, south); else hut(root, s[0], s[1], south ? Math.PI : (r() - 0.5) * 0.5, n);
    });
    for (i = 0; i < (site.huts || 0); i++) { x = 66 + r() * 40; y = r() < 0.5 ? 6 + r() * 8 : 44 + r() * 8; if (free(x, y, 3.6)) { take(x, y, 3.4); hut(root, x, y, y > 28 ? Math.PI : 0, i); } }
    if (!site.open && !site.walled) defences(root, site, r);
    if (spec.type === 'conv') { K.cart(root, wx(93), wz(27), 0.2, false); take(93, 27, 4); }
    else if (spec.type === 'col') { K.tent(root, wx(90), wz(20), 0.3); K.crates(root, wx(94), wz(33)); }
    // The trees: thick along the far side and the near edge, a few inside the field's own margins.
    var kinds = site.tr || ['palm', 'mango'], n = Math.round(site.td || 34), tries = 0, placed = 0;
    while (placed < n && tries++ < n * 6) {
      k = r(); x = -26 + r() * 150; y = k < 0.55 ? -20 + r() * 26 : k < 0.85 ? 56 + r() * 12 : (r() < 0.5 ? 5 + r() * 4 : 47 + r() * 4);
      if (x > 62 && y > 4 && y < 52 && !site.open) continue;
      if (site.mt && y < -17) continue;
      if (!free(x, y, 1.6)) continue;
      var kind = kinds[Math.floor(r() * kinds.length)]; tree(root, kind, x, y, 0.9 + r() * 0.45, Math.floor(r() * 5)); take(x, y, kind === 'palm' ? 1.2 : 2.2); placed++;
    }
    if (site.f === 'coffee') for (x = 4; x < 50; x += 3.4) [7.5, 48.5].forEach(function (yy) { tree(root, 'bush', x, yy, 0.8, 0xd8322a); });
  }

  // ---------- the field, set up for one battle ----------
  function buildField() {
    if (Bt.stage) return;
    K = K || W.kit();
    var scene = new T.Scene(); scene.background = new T.Color(0x58c4e8);
    var outer = new T.Mesh(new T.PlaneGeometry(800, 800), new T.MeshStandardMaterial({ map: cloned('grass', 400, 400), roughness: 1, metalness: 0 })); outer.rotation.x = -Math.PI / 2; outer.position.y = -0.1; outer.receiveShadow = true; scene.add(outer);
    Bt.water = new T.Mesh(new T.PlaneGeometry(89.6, 59.6), new T.MeshStandardMaterial({ map: cloned('water', 22.5, 15), roughness: 0.45, metalness: 0 })); Bt.water.rotation.x = -Math.PI / 2; Bt.water.position.set(0, -0.05, -4); Bt.water.receiveShadow = true; scene.add(Bt.water);
    paintGround({ f: 'grass' }, 1);
    var gg = new T.PlaneGeometry(90, 60); gg.rotateX(-Math.PI / 2);
    var ground = new T.Mesh(gg, new T.MeshStandardMaterial({ map: Bt.gtex, alphaTest: 0.5, roughness: 1, metalness: 0 })); ground.position.set(0, 0, -4); ground.receiveShadow = true; scene.add(ground);
    Bt.sun = lights(scene, 10, -3, 48, -0.7, 0.45);
    Bt.statics = new T.Group(); scene.add(Bt.statics); Bt.units = new T.Group(); scene.add(Bt.units); Bt.extra = new T.Group(); scene.add(Bt.extra);
    var fg = new T.PlaneGeometry(2.6, 1.7, 5, 1); fg.translate(1.3, 0, 0); Bt.flag = new T.Mesh(fg, flagTex(false)); scene.add(Bt.flag);
    Bt.pole = K.cyl(scene, 0.06, 0.09, 1, 0x6b4a2e, 0, 0, 0, 5);
    var i, g, m;
    for (i = 0; i < 48; i++) { g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(6), 3)); m = new T.Line(g, new T.LineBasicMaterial({ color: 0xffffff, transparent: true })); m.frustumCulled = false; m.visible = false; scene.add(m); Bt.shots.push(m); }
    for (i = 0; i < 12; i++) { g = new T.CircleGeometry(1, 20); g.rotateX(-Math.PI / 2); m = new T.Mesh(g, new T.MeshBasicMaterial({ color: 0xffb040, transparent: true, depthWrite: false })); m.visible = false; scene.add(m); Bt.blasts.push(m); }
    for (i = 0; i < 16; i++) { m = new T.Mesh(new T.DodecahedronGeometry(0.45, 0), new T.MeshBasicMaterial({ color: 0xf0ece0, transparent: true, depthWrite: false })); m.visible = false; scene.add(m); Bt.puffs.push(m); }
    Bt.barGeo = new T.PlaneGeometry(0.9, 0.11); Bt.barM = [new T.MeshBasicMaterial({ color: 0x8fe06a, depthTest: false }), new T.MeshBasicMaterial({ color: 0xff4a3a, depthTest: false })];
    var sg = new T.CircleGeometry(0.32, 12); sg.rotateX(-Math.PI / 2); Bt.blobGeo = sg; Bt.blobM = new T.MeshBasicMaterial({ color: 0x10142a, transparent: true, opacity: 0.3, depthWrite: false });
    Bt.geo = {};
    Bt.camera = new T.OrthographicCamera(-1, 1, 1, -1, 10, 400);
    Bt.stage = { scene: scene, camera: Bt.camera, update: fieldUpdate, soft: 1, red: 0, shadow: true };
  }
  var SUNS = [0xfff6e0, 0xffd9a0, 0xffc890];
  V.battle = {
    // spec: what war.js fights over ({ type, town, lvl, ... }); seed: a number that never changes for that place
    build: function (spec, seed) {
      buildField();
      var site = spec.type === 'town' ? SITES[spec.town] : wild(seed), i;
      Bt.site = site; paintGround(site, seed % 50);
      K.weldInto(Bt.statics, function (root) { buildSite(root, site, spec, seed); });
      while (Bt.units.children.length) Bt.units.remove(Bt.units.children[0]);
      while (Bt.extra.children.length) Bt.extra.remove(Bt.extra.children[0]);
      if (spec.type === 'conv') for (i = 0; i < 5; i++) { var p = new T.Mesh(planeGeo(1), fmat(frames(PRISONER)[2])); p.position.set(wx(88 + i * 1.6), 0, wz(30.5 + (i % 2))); Bt.extra.add(p); }
      var f = site.flag || (site.open ? null : [84, 23.5, 0]);
      Bt.flag.visible = Bt.pole.visible = !!f; Bt.flag.material = flagTex(false);
      if (f) { Bt.pole.scale.y = 4.6; Bt.pole.position.set(wx(f[0]), f[2] || 0, wz(f[1])); Bt.flag.position.set(wx(f[0]), (f[2] || 0) + 3.7, wz(f[1]) + 0.05); }
      Bt.sun.color.setHex(SUNS[spec.town === 'intramuros' ? 2 : seed % 3]); Bt.stage.shadow = true;
      Bt.shots.concat(Bt.blasts, Bt.puffs).forEach(function (m) { m.visible = false; });
    },
    show: function () { buildField(); if (W.showing() !== Bt.stage) W.show(Bt.stage); },
    won: function () { if (Bt.flag) Bt.flag.material = flagTex(true); },
    screen: function (x, y, h) { var k = window.innerHeight / 2 / Bt.v; return [window.innerWidth / 2 + (wx(x) - Bt.tx) * k, window.innerHeight / 2 + ((wz(y) - Bt.tz) * BS - (h || 0) * BC) * k]; },
    shot: function (ax, ay, bx, by, kind, r) { // 0 a rifle, 1 a gun (and its burst), 2 Elías from the trees
      var s = Bt.shots[Bt.sn++ % Bt.shots.length], p = s.geometry.attributes.position;
      p.setXYZ(0, wx(ax), kind === 2 ? 9 : 1, wz(ay)); p.setXYZ(1, wx(bx), 0.8, wz(by)); p.needsUpdate = true; s.material.color.setHex(kind === 1 ? 0xffb040 : kind === 2 ? 0xffffff : 0xfff2b0); s.visible = true; s.userData.t = s.userData.life = kind ? 0.16 : 0.11;
      if (kind) { var b = Bt.blasts[Bt.bn++ % Bt.blasts.length]; b.position.set(wx(bx), 0.12, wz(by)); b.material.color.setHex(kind === 2 ? 0xffffff : 0xffb040); b.userData.t = 0.34; b.userData.r = (r || 3) * 0.5; b.visible = true; }
    },
    puff: function (x, y) { var p = Bt.puffs[Bt.pn++ % Bt.puffs.length]; p.position.set(wx(x), 0.7, wz(y)); p.userData.t = 0; p.visible = true; },
    sync: function (B, clock) { // every company where the rules have it
      var us = B.units, i, u;
      for (i = 0; i < us.length; i++) {
        u = us[i]; var h = u._h;
        if (u.hp <= 0) { if (h) h.visible = false; continue; }
        if (!h) h = u._h = holder(u);
        h.visible = true; h.position.set(wx(u.x), 0, wz(u.y));
        var m = h.userData.m, fr = h.userData.fr; m.material = fmat(fr[u.mv ? [0, 2, 1, 2][Math.floor(clock * 8 + u.ph) % 4] : u.at > 0 ? (u.at > 0.15 ? 0 : 1) : 2]);
        m.scale.x = u.face; m.position.y = u.mv ? Math.abs(Math.sin(clock * 9 + u.ph)) * 0.06 : 0;
        if (h.userData.gun) h.userData.gun.rotation.y = u.face > 0 ? Math.PI / 2 : -Math.PI / 2, h.userData.gun.position.x = u.face * 0.95;
        var bar = h.userData.bar, f = Math.max(0, u.hp / u.max); bar.visible = f < 0.995 || u.k === 'jefe'; bar.scale.x = Math.max(0.03, f) * h.userData.s * (u.k === 'jefe' ? 1.6 : 1);
      }
      Bt.stage.red = B.charge > 0 ? 0.3 : 0.08;
    }
  };
  function planeGeo(s) { if (Bt.geo[s]) return Bt.geo[s]; var g = new T.PlaneGeometry(18 * K.PX * s, 27 * K.PX * s * 1.12); g.translate(0, 27 * K.PX * s * 0.56, 0); return (Bt.geo[s] = g); }
  function holder(u) {
    var d = u.d, s = d.look.big || 1, fr = frames(d.look), h = new T.Group(), m = new T.Mesh(planeGeo(s), fmat(fr[2])), sh = new T.Mesh(Bt.blobGeo, Bt.blobM), bar = new T.Mesh(Bt.barGeo, Bt.barM[u.side]);
    sh.position.y = 0.03; sh.scale.set(s, 1, s * 0.6); bar.position.y = 27 * K.PX * s * 1.12 + 0.16; bar.renderOrder = 5; h.add(m); h.add(sh); h.add(bar);
    h.userData = { m: m, fr: fr, bar: bar, s: s };
    if (d.gun) { var g = new T.Group(); h.add(g); K.gun(g, 0, 0.25, 0); h.userData.gun = g; }
    Bt.units.add(h); return h;
  }
  function fieldUpdate(dt, clock) {
    var a = window.innerWidth / window.innerHeight, v = Bt.v = Math.max(29 / a, 13.5), cam = Bt.camera, i, o, key = v + '|' + a;
    if (key !== Bt.camKey) { Bt.camKey = key; cam.left = -v * a; cam.right = v * a; cam.top = v; cam.bottom = -v; cam.updateProjectionMatrix(); }
    cam.position.set(Bt.tx, BS * 120, Bt.tz + BC * 120); cam.lookAt(Bt.tx, 0, Bt.tz);
    Bt.water.material.map.offset.set(clock * 0.012, clock * 0.02);
    if (Bt.flag.visible) { var p = Bt.flag.geometry.attributes.position; for (i = 0; i < p.count; i++) { var ux = p.getX(i); p.setZ(i, Math.sin(clock * 5 - ux * 1.8) * 0.09 * ux); } p.needsUpdate = true; }
    for (i = 0; i < Bt.shots.length; i++) { o = Bt.shots[i]; if (o.visible) { o.userData.t -= dt; o.material.opacity = Math.max(0, o.userData.t / o.userData.life); if (o.userData.t <= 0) o.visible = false; } }
    for (i = 0; i < Bt.blasts.length; i++) { o = Bt.blasts[i]; if (!o.visible) continue; o.userData.t -= dt; var k = 1 - Math.max(0, o.userData.t) / 0.34; o.scale.setScalar(o.userData.r * (0.35 + 0.65 * k)); o.material.opacity = 0.75 * (1 - k); if (o.userData.t <= 0) o.visible = false; }
    for (i = 0; i < Bt.puffs.length; i++) { o = Bt.puffs[i]; if (!o.visible) continue; o.userData.t += dt; o.position.y = 0.7 + o.userData.t * 2.2; o.scale.setScalar(1 + o.userData.t * 2.5); o.material.opacity = 0.75 * (1 - o.userData.t / 0.6); if (o.userData.t >= 0.6) o.visible = false; }
    if (Bt.onFrame) Bt.onFrame(clock);
  }
  V.battle.each = function (fn) { Bt.onFrame = fn; };
  V.sites = SITES;
  V.hide = function () { if (W.showing()) W.show(null); };
  Noli.WarView = V;
})();
