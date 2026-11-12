// Noli — pictograms. Noli.Icon(name) returns HTML: a small SVG drawing, or a bust cut from one of the game's own pixel sprites.
(function () {
  var Art = Noli.Art;
  var INK = '#2e2318', GOLD = '#f2b632', PALE = '#f7d774', RED = '#d9503a', BLUE = '#3f8ad8', GREEN = '#5fae4a',
    STONE = '#b9b3a6', PAPER = '#f6ecd2', WOOD = '#9a6a3c', BAMBOO = '#c9a04a';

  var BELL = '<path d="M6 17c1.500-1.500 2-3.500 2-7a4 4 0 0 1 8 0c0 3.500.5 5.500 2 7z" fill="' + GOLD + '"/><circle cx="12" cy="19.500" r="1.500" fill="' + GOLD + '"/><path d="M12 4v2"/>';
  var CUBE = '<path d="M3 9l9-4 9 4v7l-9 4-9-4z" fill="' + STONE + '"/><path d="M3 9l9 4 9-4M12 13v7"/>';
  var TURN = '<path d="M5 12a7 7 0 1 0 2.200-5.100"/><path d="M3.200 6.900h4v-4"/>';
  var SPEAKER = '<path d="M4 9.500h3l4-3.500v12l-4-3.500H4z" fill="' + PAPER + '"/>';

  var SVG = {
    coin: '<circle cx="12" cy="12" r="8.500" fill="' + GOLD + '"/><circle cx="12" cy="12" r="5.200" fill="' + PALE + '"/><path d="M12 9.500v5"/>',
    stone: CUBE,
    sun: '<circle cx="12" cy="12" r="4.500" fill="' + GOLD + '"/><path d="M12 2.500v3M12 18.500v3M2.500 12h3M18.500 12h3M5.300 5.300l2.100 2.100M16.600 16.600l2.100 2.100M5.300 18.700l2.100-2.100M16.600 7.400l2.100-2.100"/>',
    bell: BELL,
    school: '<path d="M2.500 11.500l9.500-6.500 9.500 6.500z" fill="' + RED + '"/><path d="M5 11.500h14V20H5z" fill="' + PAPER + '"/><path d="M10.500 20v-5h3v5z" fill="' + WOOD + '"/><path d="M12 5V2h3.500v2H12" fill="' + GOLD + '"/>',
    eye: '<path d="M2 12c3-5 7-7 10-7s7 2 10 7c-3 5-7 7-10 7s-7-2-10-7z" fill="' + PAPER + '"/><circle cx="12" cy="12" r="3.600" fill="' + RED + '"/><circle cx="12" cy="12" r="1.300" fill="' + INK + '" stroke="none"/>',
    moon: '<path d="M19 14.500A8 8 0 1 1 9.500 5a6.500 6.500 0 0 0 9.500 9.500z" fill="#f7e9a8"/>',
    dawn: '<path d="M7 18a5 5 0 0 1 10 0z" fill="' + GOLD + '"/><path d="M3 18h18M12 7.500v2.500M5.500 10.500l1.800 1.800M18.500 10.500l-1.800 1.800M2.500 15h2M19.500 15h2"/>',
    play: '<path d="M7 4.500l12 7.500-12 7.500z" fill="' + GREEN + '"/>',
    reset: TURN,
    rotL: TURN,
    rotR: '<g transform="translate(24 0) scale(-1 1)">' + TURN + '</g>',
    sound: SPEAKER + '<path d="M15 9a4 4 0 0 1 0 6M17.500 6.500a8 8 0 0 1 0 11"/>',
    mute: SPEAKER + '<path d="M15 9.500l5 5M20 9.500l-5 5"/>',
    mouse: '<rect x="7" y="3" width="10" height="18" rx="5" fill="' + PAPER + '"/><path d="M7 10V8a5 5 0 0 1 5-5v7z" fill="' + GOLD + '"/><path d="M7 10h10"/>',
    lock: '<rect x="5.500" y="11" width="13" height="9" rx="1.500" fill="' + STONE + '"/><path d="M8.500 11V8a3.500 3.500 0 0 1 7 0v3"/>',
    candle: '<rect x="9.500" y="10" width="5" height="10" fill="' + PAPER + '"/><path d="M12 3c2 2.500 2 4.500 0 6-2-1.500-2-3.500 0-6z" fill="' + GOLD + '"/><path d="M7 20h10"/>',
    book: '<path d="M12 6c-2-1.500-5-2-8-1.500V18c3-.5 6 0 8 1.500 2-1.500 5-2 8-1.500V4.500c-3-.5-6 0-8 1.500z" fill="' + PAPER + '"/><path d="M12 6v13.500"/>',
    hand: '<path d="M7 13V6.500a1.300 1.300 0 0 1 2.600 0V11 4.500a1.300 1.300 0 0 1 2.600 0V11 5.500a1.300 1.300 0 0 1 2.600 0V12 8a1.300 1.300 0 0 1 2.600 0v7c0 4-2.500 6.500-6 6.500-3 0-4.500-1.500-6.500-5l-1.500-2.700c-.6-1.200 1-2.300 2-1.300z" fill="#e0a878"/>',
    hammer: '<path d="M10.500 9.500l3 3-8 8.500-3-3z" fill="' + WOOD + '"/><path d="M9 5l4-2.500 7 7-2.500 3.500-3-3-2 1-3-3 1-1.500z" fill="' + STONE + '"/>',
    rhythm: '<path d="M9 17V6l10-2v11"/><ellipse cx="6.500" cy="17" rx="2.800" ry="2.200" fill="' + BLUE + '"/><ellipse cx="16.500" cy="15" rx="2.800" ry="2.200" fill="' + BLUE + '"/>',
    spark: '<path d="M12 2l2.200 6.300L21 6.500 16.700 12 21 17.500l-6.800-1.800L12 22l-2.200-6.300L3 17.500 7.300 12 3 6.500l6.800 1.800z" fill="' + GOLD + '"/>',
    crack: CUBE + '<path d="M13 5.500l-2.500 3.500 3 3-2.500 3 1.500 4.500" stroke="' + RED + '" stroke-width="1.800"/>',
    drop: '<path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z" fill="' + BLUE + '"/><path d="M9.500 14.500a2.500 2.500 0 0 0 2 2.500" stroke="' + PAPER + '"/>',
    rush: '<g transform="translate(3.500 0)">' + BELL + '</g><path d="M2 8.500h3.500M1.500 12.500h4M2 16.500h3.500"/>',
    scaffold: '<g stroke="' + INK + '" stroke-width="3.400"><path d="M6 21V3M18 21V3M6 8h12M6 15h12"/></g><g stroke="' + BAMBOO + '" stroke-width="2"><path d="M6 21V3M18 21V3M6 8h12M6 15h12"/></g><path d="M6 15l12-7"/>',
    crane: '<path d="M6 21l3-17 3 17M7.200 14h3.600M8 9.500h2M3 21h12M9 4l11 4M18 7.300v5.200"/><rect x="15.500" y="12.500" width="5" height="4.500" fill="' + STONE + '"/>',
    hut: '<path d="M2.500 12L12 4l9.500 8z" fill="' + BAMBOO + '"/><path d="M5.500 12h13v6h-13z" fill="' + WOOD + '"/><path d="M7 18v3.500M17 18v3.500"/><path d="M10.500 18v-3.500h3V18z" fill="' + INK + '"/>',
    scroll: '<path d="M5 3.500h11a2 2 0 0 1 2 2v15H7.500A2.500 2.500 0 0 1 5 18z" fill="' + PAPER + '"/><path d="M8 8h7M8 11.500h7M8 15h3"/><circle cx="17" cy="17.500" r="3.800" fill="' + GOLD + '"/>',
    bag: '<path d="M9 7.500L7.500 4h9L15 7.500z" fill="' + WOOD + '"/><path d="M9 7.500h6c3.500 3 5 6 5 9 0 3-2 4.500-8 4.500s-8-1.500-8-4.500c0-3 1.500-6 5-9z" fill="#c98f4a"/><circle cx="12" cy="14.500" r="3" fill="' + GOLD + '"/>',
    talk: '<path d="M3 4.500h12.500v8.500H9.500L6 16v-3H3z" fill="' + PAPER + '"/><path d="M18 9h3v7.500h-1.500V19l-3-2.500h-4" fill="' + PALE + '"/><path d="M6 8h6.500M6 10.500h4"/>',
    stack: '<ellipse cx="9" cy="17.500" rx="5.500" ry="2.500" fill="' + GOLD + '"/><ellipse cx="9" cy="14" rx="5.500" ry="2.500" fill="' + GOLD + '"/><ellipse cx="9" cy="10.500" rx="5.500" ry="2.500" fill="' + PALE + '"/><g stroke="' + GREEN + '" stroke-width="2.200"><path d="M18.500 18V6.500M15.500 9.500l3-3 3 3"/></g>',
    medal: '<path d="M8 2.500h8l-2.500 7h-3z" fill="' + RED + '"/><circle cx="12" cy="15" r="6.200" fill="' + GOLD + '"/><path d="M12 11.300l1.100 2.300 2.500.3-1.800 1.700.5 2.500-2.300-1.200-2.300 1.200.5-2.500-1.800-1.700 2.500-.3z" fill="' + PALE + '"/>',
    boat: '<path d="M2.500 14h19c-1.500 3.500-4 5-9.500 5s-8-1.500-9.500-5z" fill="' + WOOD + '"/><path d="M12 14V3.500"/><path d="M12 4.500l6.500 7.500H12z" fill="' + PAPER + '"/><path d="M2 21.800c2-1 3-1 5 0s3 1 5 0 3-1 5 0 3 1 5 0" stroke="' + BLUE + '"/>',
    shield: '<path d="M12 3l8 2.500v6c0 5-3.500 8-8 10-4.500-2-8-5-8-10v-6z" fill="' + BLUE + '"/><path d="M12 7.500v9.500M8 12h8" stroke="' + PAPER + '" stroke-width="2"/>',
    chalice: '<path d="M6.500 4h11c0 5-2 8-5.500 8S6.500 9 6.500 4z" fill="' + GOLD + '"/><path d="M12 12v6"/><path d="M8 20.500c0-1.500 1.500-2.500 4-2.500s4 1 4 2.500z" fill="' + GOLD + '"/>',
    kiln: '<path d="M4 20.500V12a8 8 0 0 1 16 0v8.500z" fill="#c9684a"/><path d="M12 20.500c-3 0-4-2-4-3.500 0-2 2-3 2.500-5.500 1 1 1.500 2 1.500 3 .7-.5 1-1.200 1-2 2 1.500 3 3 3 4.500 0 1.500-1 3.500-4 3.500z" fill="' + GOLD + '"/>',
    wall: '<path d="M3 6h18v13H3z" fill="' + STONE + '"/><path d="M3 10.300h18M3 14.700h18M9 6v4.300M15 6v4.300M6 10.300v4.400M12 10.300v4.400M18 10.300v4.400M9 14.700V19M15 14.700V19"/>',
    lamp: '<path d="M9 8h6l2 9H7z" fill="#f7e08a"/><path d="M8 17h8v2.500H8zM10 8V6h4v2z" fill="' + WOOD + '"/><path d="M12 6V3M9.500 3h5"/>',
    slate: '<rect x="3.500" y="5" width="17" height="13.500" rx="1" fill="#3a4a44" stroke="' + WOOD + '" stroke-width="2.200"/><path d="M7 15l2-6 2 6M7.800 13h2.400M13.800 9v6h2a1.500 1.500 0 0 0 0-3h-2 1.700a1.500 1.500 0 0 0 0-3z" stroke="' + PAPER + '" stroke-width="1.300"/>',
    storm: '<path d="M7 15a4 4 0 0 1 .5-8 5 5 0 0 1 9.500 1 3.500 3.500 0 0 1 0 7z" fill="#8a94a8"/><g stroke="' + BLUE + '" stroke-width="1.800"><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/></g>',
    cross: '<path d="M10 3h4v5h5v4h-5v9h-4v-9H5V8h5z" fill="' + RED + '"/>',
    shovel: '<path d="M12 3v11M9.500 3h5"/><path d="M8 13h8v3c0 3-2 5-4 6-2-1-4-3-4-6z" fill="' + STONE + '"/>',
    log: '<rect x="3" y="8.500" width="15" height="7" rx="1" fill="' + WOOD + '"/><ellipse cx="18" cy="12" rx="2.500" ry="3.500" fill="#e0b070"/><path d="M6 11h6M8 13.500h5"/>',
    clay: '<path d="M3 18c1-6 4-9 9-9s8 3 9 9z" fill="#c9684a"/><path d="M8 14c1-1 2-1 3 0M13 12.500c1-1 2-1 3 0"/>',
    brick: '<path d="M3 8.500h18v8H3z" fill="#d9603a"/><path d="M3 12.500h18M9 8.500v4M15 8.500v4M6 12.500v4M12 12.500v4M18 12.500v4"/>',
    shell: '<path d="M12 19.500c-5 0-9-4-9-9 3-4 6-5.500 9-5.500s6 1.500 9 5.500c0 5-4 9-9 9z" fill="#f9e2d2"/><path d="M12 19.500V5M12 19.500L6.500 6.500M12 19.500l5.500-13M12 19.500L3.500 11M12 19.500l8.500-8.500"/>',
    lime: '<path d="M7 5.500h10l-1.500 3c3 2 4 5 4 8 0 2-1.500 3.500-3.500 3.500H8c-2 0-3.500-1.500-3.500-3.500 0-3 1-6 4-8z" fill="#f4f1e8"/><path d="M8.500 8.500h7M9.500 14h5"/>',
    axe: '<g stroke="' + INK + '" stroke-width="3.600"><path d="M6 21L15.500 7"/></g><g stroke="' + WOOD + '" stroke-width="2"><path d="M6 21L15.500 7"/></g><path d="M12.500 4l6.500 1 1 6c-3 1-5 0-6-1.500l-2.500-2.500c-.5-1.500 0-2.500 1-3z" fill="' + STONE + '"/>',
    pick: '<g stroke="' + INK + '" stroke-width="3.600"><path d="M7 21l7-12"/></g><g stroke="' + WOOD + '" stroke-width="2"><path d="M7 21l7-12"/></g><path d="M4.500 9.500c4-5.500 11-6.500 16.500-2.500-5-.5-9 .5-13 4.500z" fill="' + STONE + '"/>',
    croc: '<path d="M2 15c2-4 6-6 10-5.500l10-1-1.500 3-6 1 6 1 1.500 3-10-.5c-4 1-8 0-10-1z" fill="' + GREEN + '"/><circle cx="10.500" cy="11.500" r="1" fill="' + INK + '" stroke="none"/><path d="M16 12.500l1 1 1-1.200 1 1.200"/>',
    shed: '<path d="M3 10l9-5 9 5z" fill="' + BAMBOO + '"/><path d="M5 10v10M19 10v10M5 15h14"/><path d="M7 15h4v-3H7zM13 15h4v-3h-4z" fill="#d9603a"/>',
    star: '<path d="M12 3l2.700 5.800 6.300.7-4.700 4.300 1.300 6.200-5.600-3.200L6.400 20l1.300-6.200L3 9.500l6.300-.7z" fill="' + GOLD + '"/>'
  };

  // Busts cut from the same sprites that walk around the town.
  var SPR = {
    worker: { hat: 'salakot', top: 0xf4ecd8, bottom: 0x3a6aa0 },
    juan: { hat: 'salakot', top: 0xe0563a, bottom: 0xe9dfc6, hair: 0x9a9a9a },
    damaso: { robe: 0x6e4a32, cord: 0xfff6e0, hair: 0x4a3020, style: 'tonsure', skin: 0xe6bc9c },
    salvi: { robe: 0x5a4034, cord: 0xfff6e0, hair: 0x2a1c16, style: 'tonsure', skin: 0xf2dcc8 },
    guardia: { hat: 'cap', top: 0x2a4a9a, bottom: 0xf0e8d8, shoe: 0x1a1420, sash: 0xfff6ea },
    maria: { robe: 0xffb0cc, stripe: 0xffffff, top: 0xfff6ea, style: 'long', skin: 0xecc6a0 },
    tasio: { top: 0xe9dfc6, bottom: 0x6a5a4a, hair: 0xe0e0e0 },
    tiago: { hat: 'tophat', top: 0x7a3a2a, bottom: 0x2a2634, sash: 0xf7c930 },
    filipo: { top: 0xfff6ea, bottom: 0x3a3440, hair: 0x2a1c16 },
    cutter: { hat: 'salakot', top: 0x3f9a5a, bottom: 0x6a4a34 },
    quarryman: { hat: 'salakot', top: 0x9a9aa6, bottom: 0x4a4a6a },
    clayman: { hat: 'salakot', top: 0xd9703a, bottom: 0xe9dfc6 },
    fisher: { hat: 'salakot', top: 0x3f8ad8, bottom: 0xf4ecd8 },
    donor: { top: 0xf7c930, bottom: 0x4a4a6a },
    sinang: { robe: 0x2f86e0, stripe: 0xffffff, top: 0xfff6ea, style: 'long' },
    carabao: 'animal', chicken: 'animal'
  };
  var cache = {};
  function spriteURL(name) {
    if (cache[name]) return cache[name];
    var d = SPR[name], cv = document.createElement('canvas'), g = cv.getContext('2d'), src;
    if (d === 'animal') {
      src = Art.animal(name, 0).image;
      var n = Math.max(src.width, src.height); cv.width = cv.height = n;
      g.drawImage(src, (n - src.width) >> 1, (n - src.height) >> 1);
    } else {
      src = Art.person(d)[2].image;
      var w = src.width; cv.width = cv.height = w;
      g.drawImage(src, 0, 0, w, w, 0, 0, w, w);
    }
    return (cache[name] = cv.toDataURL());
  }

  Noli.Icon = function (name) {
    if (SPR[name]) {
      try { return '<img class="ic px" alt="" draggable="false" src="' + spriteURL(name) + '">'; } catch (e) { name = 'star'; }
    }
    return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="' + INK + '" stroke-width="1.400" stroke-linejoin="round" stroke-linecap="round">' +
      (SVG[name] || SVG.star) + '</g></svg>';
  };
})();
