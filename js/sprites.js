// Noli — procedural pixel art: tiling textures, the painted ground, and character/tree sprites.
// Everything is drawn pixel by pixel at load time, so the game still needs no asset files.
(function () {
  var T = THREE;
  var A = {};

  function rgb(c) { return [(c >> 16) & 255, (c >> 8) & 255, c & 255]; }
  function mix(a, b, t) {
    var x = rgb(a), y = rgb(b);
    return (Math.round(x[0] + (y[0] - x[0]) * t) << 16) | (Math.round(x[1] + (y[1] - x[1]) * t) << 8) | Math.round(x[2] + (y[2] - x[2]) * t);
  }
  // Shadows lean violet, highlights lean warm: the usual pixel-art hue shift.
  function dk(c, t) { return mix(c, 0x24163a, t == null ? 0.3 : t); }
  function lt(c, t) { return mix(c, 0xfff3c4, t == null ? 0.3 : t); }
  function hash(x, y) { var s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
  function vnoise(x, y) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function rng(seed) { var s = seed || 7; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  A.hash = hash;

  // A tiny pixel canvas: -1 is transparent, anything else is 0xRRGGBB.
  function Pix(w, h) { this.w = w; this.h = h; this.d = new Int32Array(w * h); for (var i = 0; i < w * h; i++) this.d[i] = -1; }
  Pix.prototype.set = function (x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c; };
  Pix.prototype.get = function (x, y) { x = Math.round(x); y = Math.round(y); return (x >= 0 && y >= 0 && x < this.w && y < this.h) ? this.d[y * this.w + x] : -1; };
  Pix.prototype.rect = function (x, y, w, h, c) { for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) this.set(x + i, y + j, c); };
  Pix.prototype.shade = function (x, y, w, h, t) {
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) { var c = this.get(x + i, y + j); if (c >= 0) this.set(x + i, y + j, dk(c, t)); }
  };
  Pix.prototype.outline = function (c) {
    var o = new Int32Array(this.d), w = this.w, h = this.h;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      if (this.d[y * w + x] >= 0) continue;
      if (this.get(x - 1, y) >= 0 || this.get(x + 1, y) >= 0 || this.get(x, y - 1) >= 0 || this.get(x, y + 1) >= 0) o[y * w + x] = c;
    }
    this.d = o; return this;
  };
  Pix.prototype.canvas = function () {
    var cv = document.createElement('canvas'); cv.width = this.w; cv.height = this.h;
    var ctx = cv.getContext('2d'), im = ctx.createImageData(this.w, this.h);
    for (var i = 0; i < this.d.length; i++) {
      var c = this.d[i]; if (c < 0) continue;
      im.data[i * 4] = (c >> 16) & 255; im.data[i * 4 + 1] = (c >> 8) & 255; im.data[i * 4 + 2] = c & 255; im.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(im, 0, 0); return cv;
  };

  function tex(cv, repeat) {
    var t = new T.CanvasTexture(cv);
    t.magFilter = T.NearestFilter; t.encoding = T.sRGBEncoding;
    if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.minFilter = T.LinearMipmapLinearFilter; }
    else { t.minFilter = T.LinearFilter; t.generateMipmaps = false; }
    return t;
  }

  // ---------- Tiling 32x32 textures (one tile = 2 world units) ----------
  function brick(p, bw, bh, c1, c2, mortar, moss) {
    for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) {
      var row = Math.floor(y / bh), off = (row % 2) * (bw / 2), xx = (x + off) % 32, bx = Math.floor(xx / bw);
      var c = mix(c1, c2, hash(bx + row * 7, row * 3 + 1)), lx = xx % bw, ly = y % bh;
      if (ly === bh - 1 || lx === bw - 1) c = mortar; else if (ly === 0 || lx === 0) c = lt(c, 0.25);
      else { var s = hash(x * 3.1 + 5, y * 1.7 + 9); if (s < 0.07) c = dk(c, 0.12); else if (moss && s > 0.985) c = moss; }
      p.set(x, y, c);
    }
  }
  var TILE = {
    grass: function (p) { // the plain green beyond the painted map
      for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) { var h = hash(x, y); p.set(x, y, h < 0.03 ? dk(0x62b548, 0.2) : h > 0.975 ? lt(0x62b548, 0.25) : 0x62b548); }
    },
    adobe: function (p) { brick(p, 16, 8, 0xecd9a8, 0xd6be88, 0xb0966a, 0x9db060); },
    stone: function (p) { brick(p, 16, 8, 0xb0b3c6, 0x8e92ac, 0x666a88, 0x7fa070); },
    plaster: function (p) {
      for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) {
        var h = hash(x * 1.3 + 2, y * 2.1 + 4), n = hash(x >> 3, y >> 3);
        var c = n < 0.3 ? 0xf3e7c6 : n < 0.75 ? 0xfaf1d8 : 0xfff8e4;
        if (h < 0.05) c = 0xe6d6b0; else if (h > 0.97) c = 0xffffff;
        p.set(x, y, c);
      }
    },
    wood: function (p) {
      for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) {
        var c = mix(0xa0643a, 0x86502e, hash(x >> 3, 1));
        if ((x & 7) === 7) c = 0x5a3620; else if ((x & 7) === 0) c = lt(c, 0.2);
        else if (hash(x, y >> 2) < 0.16) c = dk(c, 0.18);
        p.set(x, y, c);
      }
    },
    tile: function (p) {
      for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) {
        var row = y >> 3, ly = y & 7, xx = (x + (row % 2) * 2) % 32, lx = xx & 3, tx = xx >> 2;
        var c = mix(0xdc5f3a, 0xbf4a30, hash(tx, row));
        if (hash(tx + 9, row + 3) > 0.9) c = 0xa2553a;
        if (lx === 3) c = dk(c, 0.35); else if (lx === 0) c = lt(c, 0.3);
        if (ly === 7) c = dk(c, 0.45); else if (ly === 0) c = lt(c, 0.22);
        p.set(x, y, c);
      }
    },
    nipa: function (p) {
      for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) {
        var row = y >> 3, ly = y & 7, c = mix(0xe0b65a, 0xbd8f3c, hash(x, row));
        if (hash(x * 1.3, y * 0.7) < 0.2) c = lt(c, 0.25);
        if (ly === 7) c = 0x7c5a26; else if (ly === 6 && hash(x, row + 5) < 0.5) c = 0x94702f; else if (ly === 0) c = lt(c, 0.2);
        p.set(x, y, c);
      }
    },
    sawali: function (p) {
      for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) {
        var c = (((x >> 2) + (y >> 2)) & 1) ? 0xe2c07c : 0xc9a360;
        if ((x & 3) === 3 || (y & 3) === 3) c = dk(c, 0.2);
        p.set(x, y, c);
      }
    },
    water: function (p) {
      var r = rng(31), i, k;
      for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) p.set(x, y, hash(x >> 2, y >> 1) > 0.55 ? 0x2f9ad8 : 0x2488cc);
      for (i = 0; i < 16; i++) { var x0 = Math.floor(r() * 32), y0 = Math.floor(r() * 32), len = 3 + Math.floor(r() * 4); for (k = 0; k < len; k++) p.set((x0 + k) % 32, y0, 0x7fd6f2); }
      for (i = 0; i < 5; i++) { x0 = Math.floor(r() * 32); y0 = Math.floor(r() * 32); p.set(x0, y0, 0xf0fdff); p.set((x0 + 1) % 32, y0, 0xf0fdff); }
    },
    earth: function (p) {
      for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) {
        var c = mix(0x96603c, 0x70442e, hash(1, y >> 2)), h = hash(x * 1.7, y * 2.3);
        if (h < 0.05) c = 0xc0a07c; else if (h > 0.95) c = dk(c, 0.25);
        p.set(x, y, c);
      }
    }
  };
  var tiles = {};
  A.tile = function (name) {
    if (tiles[name]) return tiles[name];
    var p = new Pix(32, 32); TILE[name](p);
    return (tiles[name] = tex(p.canvas(), true));
  };

  // ---------- One-off textures ----------
  var one = {};
  var ONE = {
    capiz: function () {
      var p = new Pix(16, 16); p.rect(0, 0, 16, 16, 0x6b4426);
      for (var y = 1; y < 15; y++) for (var x = 1; x < 15; x++) {
        var lx = (x - 1) % 5, ly = (y - 1) % 5; if (lx === 4 || ly === 4) continue;
        var c = mix(0xfff8dc, 0xead9ae, hash(Math.floor((x - 1) / 5), Math.floor((y - 1) / 5) + 3));
        p.set(x, y, lx === 0 && ly === 0 ? 0xffffff : c);
      }
      return p;
    },
    door: function () {
      var p = new Pix(16, 24);
      for (var y = 0; y < 24; y++) for (var x = 0; x < 16; x++) {
        var inside = y >= 7 ? (x >= 1 && x <= 14) : ((x - 7.5) * (x - 7.5) + (y - 7) * (y - 7) <= 46);
        var c = inside ? ((x & 3) === 3 ? 0x4a2c18 : mix(0x7a4a28, 0x6a3e22, hash(x >> 2, 2))) : 0xd8c49a;
        if (inside && (x === 7 || x === 8)) c = 0x3a2212;
        p.set(x, y, c);
      }
      [[4, 11], [11, 11], [4, 18], [11, 18]].forEach(function (s) { p.set(s[0], s[1], 0xe2ae45); });
      return p;
    },
    stained: function () {
      var p = new Pix(16, 24), pal = [0xe0463a, 0x2f86e0, 0xf7c930, 0x3fba5e, 0xa455d0, 0xf58a2e];
      for (var y = 0; y < 24; y++) for (var x = 0; x < 16; x++) {
        var d2 = (x - 7.5) * (x - 7.5) + (y - 7) * (y - 7);
        var inside = y >= 7 ? (x >= 2 && x <= 13) : d2 <= 34, edge = y >= 7 ? (x === 2 || x === 13 || y === 23) : d2 > 24;
        var c = 0xd8c49a;
        if (inside) {
          c = pal[Math.floor(hash(x >> 2, (y + (x >> 2) * 2) >> 2) * 6) % 6];
          if (edge || (x & 3) === 0 || ((y + (x >> 2) * 2) & 3) === 0) c = 0x2a2238;
        }
        p.set(x, y, c);
      }
      return p;
    },
    rose: function () {
      var p = new Pix(16, 16), pal = [0xe0463a, 0xf7c930, 0x2f86e0, 0x3fba5e, 0xa455d0, 0xf58a2e, 0x2fc4c0, 0xf06aa0];
      for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
        var dx = x - 7.5, dy = y - 7.5, r = Math.sqrt(dx * dx + dy * dy), a = Math.atan2(dy, dx) + Math.PI;
        var c = 0x2a2238;
        if (r < 2) c = 0xffe36a; else if (r < 7 && Math.abs(r - 4.5) > 0.5) { var k = a / (Math.PI * 2) * 8; if (k - Math.floor(k) > 0.14) c = pal[(Math.floor(k) + (r > 4.5 ? 3 : 0)) % 8]; }
        p.set(x, y, c);
      }
      return p;
    },
    // What a siege leaves of them: a dark hole with shards of glass round its edge.
    stainedBroken: function () {
      var p = ONE.stained();
      for (var y = 0; y < 24; y++) for (var x = 0; x < 16; x++) {
        if (p.get(x, y) === 0xd8c49a) continue;
        if (Math.abs(x - 7.5) / 5.6 + Math.abs(y - 13) / 10 + (hash(x * 3, y * 5) - 0.5) * 0.55 < 0.8) p.set(x, y, hash(x, y) > 0.94 ? 0x3a3048 : 0x120e18);
      }
      return p;
    },
    roseBroken: function () {
      var p = ONE.rose();
      for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
        var r = Math.sqrt((x - 7.5) * (x - 7.5) + (y - 7.5) * (y - 7.5));
        if (r < 5.2 + (hash(x * 3, y * 7) - 0.5) * 3) p.set(x, y, 0x120e18);
      }
      return p;
    },
    puff: function () { // a puff of smoke
      var p = new Pix(8, 8);
      for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) { var d = (x - 3.5) * (x - 3.5) + (y - 3.5) * (y - 3.5); if (d < 13) p.set(x, y, d < 4 && y < 4 ? 0x8a8086 : y > 4 ? 0x4a4248 : 0x6a6066); }
      return p;
    }
  };
  A.one = function (name) { return one[name] || (one[name] = tex(ONE[name]().canvas(), false)); };

  A.bunting = function () {
    if (one.bunting) return one.bunting;
    var p = new Pix(64, 8), pal = [0xe8463a, 0xf7c930, 0x2f86e0, 0x3fba5e, 0xf06aa0, 0xffffff, 0xf58a2e, 0x2fc4c0];
    p.rect(0, 0, 64, 1, 0x4a3524);
    for (var i = 0; i < 8; i++) for (var y = 1; y <= 4; y++) for (var x = i * 8 + (y - 1); x <= i * 8 + 6 - (y - 1); x++) p.set(x, y, y === 1 ? lt(pal[i], 0.2) : pal[i]);
    return (one.bunting = tex(p.canvas(), true));
  };
  A.awning = function (color) {
    var k = 'aw' + color; if (one[k]) return one[k];
    var p = new Pix(16, 16);
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) p.set(x, y, ((x >> 2) & 1) ? color : 0xfff6e6);
    return (one[k] = tex(p.canvas(), true));
  };

  // ---------- Character sprites: 18 x 27, three frames (left step, right step, standing) ----------
  function drawPerson(o, f) {
    var p = new Pix(18, 27);
    var sk = o.skin || 0xc98d5e, skD = dk(sk, 0.25), hair = o.hair != null ? o.hair : 0x2a1c16;
    var hasRobe = o.robe != null, hasTop = o.top != null;
    var top = hasTop ? o.top : (hasRobe ? o.robe : 0xf2ead8), bot = o.bottom != null ? o.bottom : 0x5a4a3a;
    var arm = top, y;
    if (hasRobe) {
      p.rect(5, 11, 8, 6, o.robe); p.rect(4, 17, 10, 7, o.robe);
      if (o.stripe != null) for (y = 18; y < 24; y += 2) p.rect(4, y, 10, 1, o.stripe);
      if (hasTop) p.rect(5, 11, 8, 5, top);
      p.shade(11, 11, 2, 6, 0.22); p.shade(12, 17, 2, 7, 0.22);
      if (o.cord != null) { p.rect(5, 15, 8, 1, o.cord); p.rect(10, 16, 1, 3, o.cord); }
      if (f !== 1) p.rect(6, 24, 2, 1, 0x3a2a20);
      if (f !== 0) p.rect(10, 24, 2, 1, 0x3a2a20);
    } else {
      var ly = f === 0 ? 1 : 0, ry = f === 1 ? 1 : 0, shoe = o.shoe != null ? o.shoe : skD;
      p.rect(6, 17, 3, 7 - ly, bot); p.rect(9, 17, 3, 7 - ry, dk(bot, 0.25));
      p.rect(6, 24 - ly, 3, 1, shoe); p.rect(9, 24 - ry, 3, 1, dk(shoe, 0.2));
      p.rect(5, 11, 8, 6, top); p.shade(11, 11, 2, 6, 0.22); p.shade(5, 16, 8, 1, 0.15);
      if (o.sash != null) p.rect(5, 15, 8, 1, o.sash);
    }
    // Arms swing against the legs.
    var la = f === 0 ? 1 : 0, ra = f === 1 ? 1 : 0;
    p.rect(4, 11, 1, 5 - la, arm); p.set(4, 16 - la, sk);
    if (o.load) { p.rect(13, 9, 1, 4, dk(arm, 0.2)); }
    else if (o.tool != null) {
      // A tool in the right hand: frame 0 raised, frame 1 struck, frame 2 at rest.
      var hd = 0x8a5a2e, tc = o.tool;
      if (f === 0) { p.rect(13, 8, 1, 4, dk(arm, 0.2)); p.set(13, 7, skD); [[14, 6], [14, 5], [15, 4], [15, 3], [16, 2]].forEach(function (q) { p.set(q[0], q[1], hd); }); p.rect(16, 0, 2, 2, tc); p.set(17, 2, dk(tc, 0.3)); }
      else if (f === 1) { p.rect(13, 11, 1, 3, dk(arm, 0.2)); p.set(14, 14, skD); [[15, 15], [15, 16], [16, 17], [16, 18]].forEach(function (q) { p.set(q[0], q[1], hd); }); p.rect(16, 19, 2, 2, tc); p.set(15, 20, dk(tc, 0.3)); }
      else { p.rect(13, 11, 1, 4, dk(arm, 0.2)); p.set(13, 15, skD); p.rect(14, 10, 1, 14, hd); p.rect(15, 9, 2, 2, tc); p.set(14, 9, dk(tc, 0.3)); }
    }
    else { p.rect(13, 11, 1, 5 - ra, dk(arm, 0.2)); p.set(13, 16 - ra, skD); }
    // Head.
    p.rect(8, 10, 2, 1, skD);
    p.rect(6, 4, 6, 6, sk); p.rect(11, 5, 1, 5, skD);
    p.rect(6, 3, 6, 2, hair); p.set(6, 5, hair); p.set(11, 5, hair);
    p.set(7, 7, 0x2a1a12); p.set(10, 7, 0x2a1a12);
    if (o.style === 'long') { p.rect(5, 4, 1, 7, hair); p.rect(12, 4, 1, 7, hair); p.rect(8, 2, 2, 1, hair); }
    if (o.style === 'tonsure') p.rect(7, 3, 4, 1, sk);
    if (o.hat === 'salakot') { var st = 0xe2bb62; p.rect(7, 1, 4, 1, st); p.rect(5, 2, 8, 1, st); p.rect(3, 3, 12, 1, lt(st, 0.35)); p.rect(3, 4, 12, 1, dk(st, 0.3)); }
    if (o.hat === 'tophat') { p.rect(6, 0, 6, 3, 0x1e1a26); p.rect(6, 2, 6, 1, 0x8a2a3a); p.rect(5, 3, 8, 1, 0x1e1a26); }
    if (o.hat === 'cap') { p.rect(6, 2, 6, 2, 0x2a4a9a); p.rect(5, 4, 8, 1, 0x16224a); p.set(8, 2, 0xf7c930); p.set(9, 2, 0xf7c930); }
    if (o.load) { var lc = o.loadC != null ? o.loadC : 0xb6b8ca; p.rect(11, 5, 6, 5, lc); p.rect(11, 5, 6, 1, lt(lc, 0.5)); p.rect(11, 9, 6, 1, dk(lc, 0.35)); p.rect(16, 6, 1, 3, dk(lc, 0.2)); }
    return p.outline(0x2b1b33);
  }
  A.person = function (o) { return [0, 1, 2].map(function (f) { return tex(drawPerson(o, f).canvas(), false); }); };

  // ---------- Animals (trees and plants are solids now: see world.js) ----------
  function drawCarabao() {
    var p = new Pix(32, 22), B = 0x4c4858, H = 0xdcd6c2;
    p.rect(5, 8, 17, 8, B); p.rect(6, 7, 15, 1, lt(B, 0.25)); p.rect(5, 14, 17, 2, dk(B, 0.3));
    p.rect(21, 6, 7, 7, B); p.rect(26, 9, 4, 4, lt(B, 0.18)); p.set(29, 11, 0x1a1420); p.set(24, 8, 0xffffff); p.set(25, 8, 0x1a1420); p.set(21, 7, dk(B, 0.4));
    [[23, 5], [22, 4], [21, 3], [20, 3], [19, 4], [26, 5], [27, 4], [28, 3]].forEach(function (h) { p.set(h[0], h[1], H); });
    p.rect(6, 16, 3, 5, B); p.rect(10, 16, 3, 5, dk(B, 0.3)); p.rect(16, 16, 3, 5, B); p.rect(19, 16, 3, 5, dk(B, 0.3));
    [6, 10, 16, 19].forEach(function (x) { p.rect(x, 20, 3, 1, 0x1a1420); });
    [[4, 9], [3, 10], [3, 11], [3, 12], [3, 13]].forEach(function (t) { p.set(t[0], t[1], B); }); p.set(3, 14, 0x1a1420);
    // The egret that rides it.
    p.rect(10, 4, 4, 3, 0xffffff); p.set(14, 3, 0xffffff); p.set(14, 2, 0xffffff); p.set(15, 1, 0xffffff); p.set(16, 1, 0xf2b632); p.set(17, 1, 0xf2b632); p.set(9, 5, 0xe6eef6);
    return p.outline(0x231a2e);
  }
  function drawDeadCarabao() { // on its side, legs stiff, the crows already at it
    var p = new Pix(32, 16), B = 0x4c4858, H = 0xdcd6c2;
    p.rect(5, 7, 18, 7, B); p.rect(6, 6, 16, 1, lt(B, 0.2)); p.rect(5, 12, 18, 2, dk(B, 0.3));
    [[7, 2, 5], [11, 3, 4], [16, 2, 5], [20, 3, 4]].forEach(function (l, i) { p.rect(l[0], l[1], 2, l[2], i % 2 ? dk(B, 0.3) : B); p.rect(l[0], l[1], 2, 1, 0x1a1420); });
    p.rect(22, 9, 7, 5, B); p.rect(27, 11, 3, 3, lt(B, 0.18)); p.set(25, 10, 0x1a1420); p.set(26, 11, 0x1a1420); p.set(26, 10, 0xffffff); p.set(25, 11, 0xffffff);
    [[23, 8], [22, 7], [21, 7], [26, 8], [27, 7], [28, 7]].forEach(function (h) { p.set(h[0], h[1], H); });
    p.rect(12, 9, 4, 3, 0x8a2a2a); p.set(13, 12, 0x8a2a2a); p.set(11, 10, 0x6a1e22);
    [[13, 5], [14, 5], [14, 4], [15, 5], [18, 5], [19, 5], [19, 4]].forEach(function (c) { p.set(c[0], c[1], 0x14101a); }); p.set(16, 5, 0xd8a236); p.set(20, 4, 0xd8a236);
    return p.outline(0x231a2e);
  }
  function drawChicken(body) {
    var p = new Pix(10, 10);
    p.rect(2, 4, 5, 3, body); p.set(1, 3, body); p.set(1, 4, dk(body, 0.2)); p.rect(6, 2, 2, 3, body);
    p.set(6, 1, 0xe0463a); p.set(7, 1, 0xe0463a); p.set(8, 3, 0xf2b632); p.set(7, 3, 0x1a1420);
    p.set(3, 7, 0xf2b632); p.set(5, 7, 0xf2b632); p.rect(2, 6, 5, 1, dk(body, 0.2));
    return p.outline(0x231a2e);
  }
  A.animal = function (kind, v) {
    var k = kind + ':' + (v || 0);
    return one[k] || (one[k] = tex((kind === 'carabao' ? drawCarabao() : kind === 'deadbao' ? drawDeadCarabao() : drawChicken(v || 0xffffff)).canvas(), false));
  };

  // ---------- The ground: one painting, 16 pixels per world unit, reaching g.half units from the middle ----------
  // Water is left transparent so the animated water plane shows through.
  A.ground = function (g) {
    var H = g.half, N = H * 32, cv = document.createElement('canvas'); cv.width = cv.height = N;
    var ctx = cv.getContext('2d', { willReadFrequently: true }), img = ctx.createImageData(N, N), d = img.data; // read back when the town grows
    function segD(px, pz, a, b) {
      var dx = b[0] - a[0], dz = b[1] - a[1], t = ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz);
      t = t < 0 ? 0 : t > 1 ? 1 : t; var ex = px - a[0] - dx * t, ez = pz - a[1] - dz * t; return Math.sqrt(ex * ex + ez * ez);
    }
    var G = [0x4f9f3e, 0x62b548, 0x7fcb55], GD = G.map(function (c) { return dk(c, 0.2); }), GL = G.map(function (c) { return lt(c, 0.25); });
    var F = [0x2f7a3c, 0x3f8f44], FL = [0xfff2a0, 0xffffff, 0xff7ab0, 0xff5a4a, 0xc58cff];
    var PV = [0xe8d6a8, 0xdcc898, 0xf0e0b8];
    for (var py = 0; py < N; py++) for (var px = 0; px < N; px++) {
      var x = px / 16 - H, z = py / 16 - H, h = hash(px, py), n = vnoise(x * 0.22 + 40, z * 0.22 + 40), n2 = vnoise(x * 0.9 + 7, z * 0.9 + 3);
      var a = 255, c, i, gi = n + (h - 0.5) * 0.18, rim = (H - Math.max(Math.abs(x), Math.abs(z))) / 10;
      if (rim < 1) gi = 0.5 + (gi - 0.5) * rim; // fade to plain grass at the rim, where the painting meets the open country
      var gk = gi < 0.38 ? 0 : gi < 0.62 ? 1 : 2;
      var wn = (n - 0.5) * 7 + (n2 - 0.5) * 1.5; // a ragged edge to the wood
      var inWood = x > 13 + wn && z - x * 0.3 > -9 + wn && x + (z - 7) * 0.6 > 18.6 + wn * 0.4 && rim > hash(px >> 3, py >> 3) * 0.8;
      c = inWood ? F[gi < 0.5 ? 0 : 1] : (h < 0.03 ? GD[gk] : h > 0.975 ? GL[gk] : G[gk]);
      if (!inWood && n2 > 0.6 && h > 0.9 && h < 0.94) c = FL[(px * 7 + py * 13) % 5];
      if (x - z > 50 && rim > 0.6) c = gi < 0.5 ? 0x4a8a5a : 0x5a9a66;

      // Cemetery, works site, stockpile.
      if (Math.abs(x - g.cem[0]) < 3.4 && Math.abs(z - g.cem[1]) < 2.9) c = gi < 0.45 ? 0x6f8f4a : (h > 0.95 ? 0xb8a878 : 0x86a055);
      var edge = (n2 - 0.5) * 0.7;
      var site = Math.abs(x - g.site[0]) < 4.9 + edge && Math.abs(z - g.site[1]) < 3.7 + edge;
      var pdx = x - g.pile[0], pdz = z - g.pile[1];
      var yard = site || pdx * pdx + pdz * pdz < (2.7 + edge) * (2.7 + edge);
      for (i = 0; i < g.yards.length && !yard; i++) { var yx = x - g.yards[i][0], yz = z - g.yards[i][1]; yard = yx * yx + yz * yz < (2.6 + edge) * (2.6 + edge); }
      if (yard) c = h < 0.1 ? 0x8f6f45 : h > 0.93 ? 0xe0c48c : 0xbc9866;

      // Quarry floor (grey rubble) and clay pit (red earth).
      var qx = x - g.quarry[0], qz = z - g.quarry[1], kx = x - g.clay[0], kz = z - g.clay[1];
      if (qx * qx + qz * qz < (3.6 + edge) * (3.6 + edge)) c = h < 0.15 ? 0x8a8e9c : h > 0.9 ? 0xdadde8 : 0xb0b4c2;
      if (kx * kx + kz * kz < (2.9 + edge) * (2.9 + edge)) c = h < 0.15 ? 0x9a4a2c : h > 0.9 ? 0xe08a5a : 0xc0623a;

      // Rice paddies with their earthen dikes.
      var pr = g.paddy;
      if (x > pr[0] && x < pr[1] && z > pr[2] && z < pr[3]) {
        var cxn = (x - pr[0]) / 3.1, czn = (z - pr[2]) / 3.1, fx = cxn - Math.floor(cxn), fz = czn - Math.floor(czn);
        if (fx < 0.06 || fx > 0.94 || fz < 0.06 || fz > 0.94) c = h < 0.3 ? 0x7a5a38 : 0x94703f;
        else if (hash(Math.floor(cxn) + 3, Math.floor(czn) * 5) > 0.55) c = (px & 1) ? (h > 0.9 ? 0xf2e06a : 0xc6d84a) : 0x86b03c;
        else c = (px % 4 === 1 && py % 4 < 3) ? 0x9aea4a : (n2 > 0.6 ? 0x6cc0b8 : 0x4fa6a6);
      }

      // Roads.
      var rd = 99;
      if (x > -37 && x < 24 && z > -16 && z < 22) for (i = 0; i < g.roads.length; i++) { var rr = segD(x, z, g.roads[i][0], g.roads[i][1]) - g.roads[i][2] / 2; if (rr < rd) rd = rr; }
      rd += (n2 - 0.5) * 0.3;
      if (rd < 0) c = h < 0.12 ? 0xb9975f : h > 0.92 ? 0xf0dcae : 0xdcc084;
      else if (rd < 0.2 && h < 0.6) c = 0xa8935a;

      // Plaza paving.
      var pl = g.plaza;
      if (x > pl[0] && x < pl[1] && z > pl[2] && z < pl[3]) {
        if (x < pl[0] + 0.2 || x > pl[1] - 0.2 || z < pl[2] + 0.2 || z > pl[3] - 0.2) c = 0xa89878;
        else if (px % 12 === 0 || py % 12 === 0) c = 0xb8a47e;
        else c = h < 0.04 ? 0xcab686 : PV[Math.floor(hash(Math.floor(px / 12), Math.floor(py / 12)) * 3) % 3];
      }

      // Lake and river: banks, sand, then open water.
      var lx = x - g.lake[0], lz = z - g.lake[1], dl = Math.sqrt(lx * lx + lz * lz) - g.lake[2] + (n - 0.5) * 1.6, dr = 99;
      if (x > -24 && z > -28) for (i = 0; i < g.river.length - 1; i++) { var r2 = segD(x, z, g.river[i], g.river[i + 1]); if (r2 < dr) dr = r2; }
      dr -= 1.15 + (n - 0.5) * 0.5;
      if (dr < 0.7 && dr >= 0) c = (h > 0.85) ? 0x8fd45a : (dr < 0.25 ? 0xb89f6a : 0x3f9a3a);
      if (dl < 1.7 && dl >= 0) c = dl < 0.25 ? 0xc2a872 : (dl > 1.3 && h < 0.5) ? c : (h > 0.9 ? 0xfff2cc : h < 0.1 ? 0xdcc88c : 0xeeddaa);
      if (dl < 0 || dr < 0) { a = 0; c = 0x2f9ad8; }

      var k = (py * N + px) * 4;
      d[k] = (c >> 16) & 255; d[k + 1] = (c >> 8) & 255; d[k + 2] = c & 255; d[k + 3] = a;
    }
    ctx.putImageData(img, 0, 0);
    var t = new T.CanvasTexture(cv);
    t.magFilter = T.NearestFilter; t.minFilter = T.LinearMipmapLinearFilter; t.encoding = T.sRGBEncoding;
    return t;
  };

  // Paint what the town adds as it grows (footpaths, fields, bare yards) into a part of the ground, in the same hand as the rest.
  // H: the ground's half width. p.box: [x0, z0, x1, z1]. Hands back what was there, for groundRestore.
  A.groundPatch = function (t, H, p) {
    var cv = t.image, ctx = cv.getContext('2d'), N = cv.width, i;
    var X0 = Math.max(0, Math.floor((p.box[0] + H) * 16)), Y0 = Math.max(0, Math.floor((p.box[1] + H) * 16));
    var X1 = Math.min(N, Math.ceil((p.box[2] + H) * 16)), Y1 = Math.min(N, Math.ceil((p.box[3] + H) * 16)), w = X1 - X0, hh = Y1 - Y0;
    var img = ctx.getImageData(X0, Y0, w, hh), d = img.data, old = new Uint8ClampedArray(d);
    ['graves', 'yards', 'paddy', 'garden', 'roads', 'dry', 'scorch'].forEach(function (n) { p[n] = p[n] || []; });
    function segD(px, pz, a, b) {
      var dx = b[0] - a[0], dz = b[1] - a[1], t = ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz);
      t = t < 0 ? 0 : t > 1 ? 1 : t; var ex = px - a[0] - dx * t, ez = pz - a[1] - dz * t; return Math.sqrt(ex * ex + ez * ez);
    }
    for (var py = Y0; py < Y1; py++) for (var px = X0; px < X1; px++) {
      var k = ((py - Y0) * w + px - X0) * 4; if (!d[k + 3]) continue; // water stays water
      var x = px / 16 - H, z = py / 16 - H, h = hash(px, py), n2 = vnoise(x * 0.9 + 7, z * 0.9 + 3), edge = (n2 - 0.5) * 0.7, c = -1, r;
      for (i = 0; i < p.graves.length; i++) { r = p.graves[i]; if (x > r[0] && x < r[2] && z > r[1] && z < r[3]) c = n2 < 0.45 ? 0x6f8f4a : (h > 0.95 ? 0xb8a878 : 0x86a055); }
      for (i = 0; i < p.yards.length; i++) { r = p.yards[i]; var yx = x - r[0], yz = z - r[1]; if (yx * yx + yz * yz < (r[2] + edge) * (r[2] + edge)) c = h < 0.1 ? 0x8f6f45 : h > 0.93 ? 0xe0c48c : 0xbc9866; }
      for (i = 0; i < p.paddy.length; i++) {
        r = p.paddy[i];
        if (x > r[0] && x < r[0] + r[2] * 3.1 && z > r[1] && z < r[1] + r[3] * 3.1) {
          var cxn = (x - r[0]) / 3.1, czn = (z - r[1]) / 3.1, fx = cxn - Math.floor(cxn), fz = czn - Math.floor(czn);
          if (fx < 0.06 || fx > 0.94 || fz < 0.06 || fz > 0.94) c = h < 0.3 ? 0x7a5a38 : 0x94703f;
          else if (hash(Math.floor(cxn) + 3 + i * 7, Math.floor(czn) * 5 + Math.floor(r[0])) > 0.55) c = (px & 1) ? (h > 0.9 ? 0xf2e06a : 0xc6d84a) : 0x86b03c;
          else c = (px % 4 === 1 && py % 4 < 3) ? 0x9aea4a : (n2 > 0.6 ? 0x6cc0b8 : 0x4fa6a6);
        }
      }
      for (i = 0; i < p.garden.length; i++) { // a kitchen plot: rows of camote, corn and gabi between furrows
        r = p.garden[i];
        if (x > r[0] && x < r[2] && z > r[1] && z < r[3]) {
          var row = py % 8, rim = x < r[0] + 0.15 || x > r[2] - 0.15 || z < r[1] + 0.15 || z > r[3] - 0.15;
          if (rim || row < 3) c = h < 0.3 ? 0x7a5a38 : 0x94703f;
          else c = h > 0.92 ? 0xf2e06a : (px + (row > 5 ? 1 : 0)) % 3 === 0 ? 0x2f8a3c : (row === 5 ? 0x8fd45a : 0x4fae48);
        }
      }
      var rd = 99;
      for (i = 0; i < p.roads.length; i++) { var rr = segD(x, z, p.roads[i][0], p.roads[i][1]) - p.roads[i][2] / 2; if (rr < rd) rd = rr; }
      rd += (n2 - 0.5) * 0.3;
      if (rd < 0) c = h < 0.12 ? 0xb9975f : h > 0.92 ? 0xf0dcae : 0xdcc084;
      else if (rd < 0.2 && h < 0.6 && c < 0) c = 0xa8935a;
      if (c >= 0) { d[k] = (c >> 16) & 255; d[k + 1] = (c >> 8) & 255; d[k + 2] = c & 255; }
      // War: fields left to dry out, and ground where something has burned.
      for (i = 0; i < p.dry.length; i++) {
        r = p.dry[i];
        if (x > r[0] && x < r[2] && z > r[1] && z < r[3]) { var lum = d[k] * 0.3 + d[k + 1] * 0.59 + d[k + 2] * 0.11; d[k] = Math.min(255, lum * 0.92 + 42); d[k + 1] = lum * 0.74 + 26; d[k + 2] = lum * 0.4 + 10; }
      }
      for (i = 0; i < p.scorch.length; i++) {
        r = p.scorch[i]; var sx = x - r[0], sz = z - r[1], sr = r[2] + edge * 1.6;
        if (sx * sx + sz * sz < sr * sr) { var ash = h > 0.93 ? 70 : 0, kk = sx * sx + sz * sz < sr * sr * 0.45 ? 0.3 : 0.55; d[k] = d[k] * kk + 16 + ash; d[k + 1] = d[k + 1] * kk * 0.85 + 12 + ash; d[k + 2] = d[k + 2] * kk * 0.8 + 12 + ash; }
      }
    }
    ctx.putImageData(img, X0, Y0); t.needsUpdate = true;
    return { x: X0, y: Y0, img: new ImageData(old, w, hh) };
  };
  A.groundRestore = function (t, s) { t.image.getContext('2d').putImageData(s.img, s.x, s.y); t.needsUpdate = true; };

  Noli.Art = A;
})();
