// Noli — game data: tuning numbers and all lore text.
// Text is original writing based on events in José Rizal's "Noli Me Tangere" (1887); no direct quotations.
window.Noli = window.Noli || {};

(function () {
  function pct(v) { return Math.round(v * 100) + '%'; }
  function x(v) { return '×' + (v >= 10 ? Math.round(v) : v.toFixed(2)); }
  function wait(l) { return l >= 4 ? 'leave at once' : 'leave on their own after ' + (8 - 2 * l) + ' seconds'; }

  Noli.Data = {
    DAY_LENGTH: 8, // seconds in a day before any bonus
    STEPS: 4, // building steps in each stage of the school
    HOUSE_EVERY: 5, // workers hired (of any kind) for each new household that settles in San Diego; there are twenty to come
    // The town's giving: pesos a second while the works go on, growing with every building step.
    STIPEND: 2, STIPEND_GROWTH: 1.3,

    // Everything that can be gathered, made or spent.
    res: {
      pesos: { icon: 'coin', name: 'Pesos' },
      labor: { icon: 'shovel', name: 'Labour' },
      wood: { icon: 'log', name: 'Timber' },
      stone: { icon: 'stone', name: 'Stone' },
      clay: { icon: 'clay', name: 'Clay' },
      brick: { icon: 'brick', name: 'Bricks and tiles' },
      shell: { icon: 'shell', name: 'Shells' },
      lime: { icon: 'lime', name: 'Lime' }
    },
    resOrder: ['labor', 'wood', 'stone', 'clay', 'brick', 'shell', 'lime'],

    // Stages of the school. need: materials for the first step of the stage; later steps cost more (stepMult).
    stages: [
      { name: 'The Cleared Lot',         note: 'Stakes and cord mark the plan. First, dig the trenches.', need: { labor: 40 } },
      { name: 'Trenches & Foundations',  note: 'Timber for the forms, the shoring and the derrick.', need: { labor: 210, wood: 180 } },
      { name: 'The Cornerstone',         note: 'Stone from the quarry for the lower walls, timber for the scaffold.', need: { labor: 1150, wood: 820, stone: 950 } },
      { name: 'Rising Walls',            note: 'Brick above the stone: dig clay and fire it.', need: { labor: 2200, stone: 1600, brick: 2300 } },
      { name: 'Timber & Tile',           note: 'Rafters, tiles, and lime burned from lake shells for mortar and plaster.', need: { labor: 13000, wood: 9000, brick: 13000, lime: 12000 } },
      { name: 'The School of San Diego', note: 'The doors are open.', need: {} }
    ],
    stepMult: [1, 1.6, 2.5, 4],

    // Places where you (by clicking) and your people (on their own) gather a material. pos: where the marker floats in the world.
    spots: [
      { id: 'site', res: 'labor', stage: 0, pos: [4.2, 3.2, 4.2], name: 'The works', desc: 'Dig, lay and raise.', worker: 'obreros', mult: ['andamyo', 'kabria'], hazard: 'friar' },
      { id: 'forest', res: 'wood', stage: 1, pos: [21, 5, 10.2], name: 'Ibarra\'s wood', desc: 'Fell timber in the family wood across the river.', worker: 'magtotroso', mult: ['palakol', 'kalabaw'], hazard: 'guardia' },
      { id: 'quarry', res: 'stone', stage: 2, pos: [14.6, 2.6, -11.4], name: 'The quarry', desc: 'Cut stone at the foot of the mountains.', worker: 'kantero', mult: ['kalso', 'kalabaw'], hazard: 'guardia' },
      { id: 'claypit', res: 'clay', stage: 3, pos: [3.1, 2.5, 14.8], name: 'The clay pit', desc: 'Dig clay on the river bank. The kiln fires it into bricks and tiles.', worker: 'maglulupa', mult: ['tapahan', 'kalabaw'], hazard: 'flood' },
      { id: 'lake', res: 'shell', stage: 4, pos: [-17.1, 2.5, 20.9], name: 'The lake shore', desc: 'Rake shells from the shallows. The lime kiln burns them into lime.', worker: 'mangingisda', mult: ['bangka'], hazard: 'croc' }
    ],
    // Kilns turn one material into another, all day, on their own. Each click on a kiln stokes it: STOKE seconds of its work at once.
    STOKE: 0.5,
    kilns: [
      { id: 'brick', icon: 'kiln', from: 'clay', to: 'brick', stage: 3, rate: 'hurno', gain: 'molde', pos: [-1.4, 3.6, 13.3], name: 'The brick kiln', desc: 'Fires clay into bricks and tiles all day. Click to stoke it.' },
      { id: 'lime', icon: 'lime', from: 'shell', to: 'lime', stage: 4, rate: 'apog', gain: null, pos: [-10.5, 3, 23.2], name: 'The lime kiln', desc: 'Burns shells into lime all day. Click to stoke it.' }
    ],

    // The shop. worth: what one unit of each material is worth beside one unit of labour. The shop buys at SELL and sells at BUY times
    // the going rate, which follows the town's daily giving, so trade helps at every stage and never replaces the work.
    worth: { labor: 1, wood: 1.1, stone: 1.2, clay: 0.5, brick: 1.6, shell: 0.5, lime: 2 },
    SHOP_BUY: 3, SHOP_SELL: 0.75,
    // The price in pesos of a standing order: sell whatever the school does not need of a material, every evening.
    standing: { labor: 400, wood: 1500, stone: 4000, clay: 6000, brick: 15000, shell: 20000, lime: 40000 },

    // Interruptions. While one stands at a place, nobody there works; click it away. fam decides which bonus sends it off automatically.
    hazards: {
      friar: { icon: 'damaso', fam: 'misa', name: 'A friar lectures the men', desc: 'He has come to ask who gave permission. Nobody works while he talks.' },
      guardia: { icon: 'guardia', fam: 'guevara', name: 'The Guardia Civil', desc: 'Papers, all of you. The men are lined up on the road.' },
      flood: { icon: 'storm', fam: 'elias', name: 'A cloudburst', desc: 'The pit is filling with water.' },
      croc: { icon: 'croc', fam: 'elias', name: 'The crocodile', desc: 'The old caiman of the lake is in the shallows again.' }
    },

    // The convento strikes back: one confrontation closes each stage. Wear it down by clicking; it is untouchable while any interruption stands.
    // Each confrontation has its own way of fighting back:
    //   every: seconds between the interruptions it sends (on that day none of them leaves on its own).
    //   guard: [seconds open, seconds closed]. While it is closed, a click on it costs you GUARD_COST seconds of daylight.
    //   weak:  seconds between openings, small marks that show beside it for a moment; a click on one counts for OPENING clicks.
    //   heal:  the share of its full strength it wins back each second while any interruption stands.
    //   strike: your people stay at home that day.
    //   rout:  it cannot be clicked at all; hp is the number of its interruptions to see off, each of them patrol strong.
    //          The next one comes every seconds after the last, or ROUT_GAP seconds after the road is clear.
    GUARD_COST: 0.5, OPENING: 6, OPENING_TIME: 1.6, ROUT_GAP: 0.5,
    bosses: [
      { icon: 'damaso', hp: 12, every: 4, guard: [3, 1], name: 'Padre Dámaso\'s Sermon',
        text: 'The old curate preaches for an hour against proud young men who come home from Europe despising the faith of their fathers. He names no one. Everyone knows whom he means.',
        how: 'When he raises his voice the mark turns dark: hold your tongue. A click then costs you half a second of the day.' },
      { icon: 'crane', hp: 140, every: 3, weak: 1.4, heal: 0.04, name: 'The Derrick',
        text: 'The town gathers for the cornerstone. The yellowish man who built the hoist smiles too much, and Elías has told you not to stand under it.',
        how: 'Frayed ropes show for a moment around the hoist: each one you click counts for six. It mends itself while any interruption stands.' },
      { icon: 'guardia', hp: 6, rout: true, patrol: 20, every: 2.2, name: 'The Alférez\'s Raid',
        text: 'Sour from a quarrel with Doña Consolación, the commander of the Guardia Civil decides that every man at the works is a tulisán without a cédula.',
        how: 'He keeps behind his men: you cannot touch him. See off six of his patrols before the Angelus, and the raid is over.' },
      { icon: 'cross', hp: 650, every: 2.6, guard: [2, 1.4], weak: 2, strike: true, name: 'Excommunication',
        text: 'At table Padre Dámaso insults your dead father once too often, and you lay hands on him. By evening no one may speak to you.',
        how: 'Nobody may work for you today. The ban closes and opens: do not click while it is dark, and catch the openings beside it.' },
      { icon: 'salvi', hp: 1300, every: 3.6, guard: [2.6, 1.2], weak: 1.5, heal: 0.015, name: 'Padre Salvi\'s Plot',
        text: 'Thin, silent Padre Salvi has arranged an uprising, with your name on it. In the novel it works. Here, the town has a school to defend.',
        how: 'Everything at once: he closes and opens, his agents interrupt the work, and he recovers while they stand. Take the openings.' }
    ],

    branches: {
      school: 'The school', hand: 'Ibarra\'s own work', crew: 'The crew', wood: 'Timber', stone: 'Stone', clay: 'Clay and brick',
      lake: 'The lake', time: 'The length of the day', money: 'The town\'s money', trade: 'Trade', shadow: 'Friends against the convento'
    },

    // The tree of bonuses. x, y: place on the tree (the school at 0,0). req: levels of other bonuses needed first
    // ("school: 4" means four building steps done). cost: first-level price in each material, multiplied by growth per level.
    // val(level) is the number the game uses; show(val) is how the tooltip words it.
    upgrades: [
      { id: 'school', icon: 'school', branch: 'school', x: 0, y: 0, req: {}, max: 20, cost: {}, growth: 1,
        name: 'Build the School', desc: 'Pay the materials for the next step of the building. New stages open new places, materials and bonuses.',
        val: function (l) { return l; }, show: function (v) { return 'step ' + v + ' of 20'; } },

      // ----- Ibarra's own work (north)
      { id: 'lakas', icon: 'hand', branch: 'hand', x: 0, y: -1, req: { school: 0 }, max: 20, cost: { pesos: 8 }, growth: 1.45,
        name: 'Ibarra\'s Own Hands', desc: 'Off with the European coat, and down into the trench with the men.',
        val: function (l) { return 1 + l; }, show: function (v) { return v + ' per click, at every place'; } },
      { id: 'suwerte', icon: 'spark', branch: 'hand', x: 0, y: -2, req: { lakas: 3 }, max: 5, cost: { pesos: 60 }, growth: 2,
        name: 'A True Blow', desc: 'Now and then the stroke lands exactly right.',
        val: function (l) { return 0.05 * l; }, show: function (v) { return pct(v) + ' of clicks are true blows'; } },
      { id: 'bato', icon: 'crack', branch: 'hand', x: 0, y: -3, req: { suwerte: 2 }, max: 5, cost: { pesos: 400 }, growth: 2.4,
        name: 'With the Grain', desc: 'Find the grain, and one stroke does the work of many.',
        val: function (l) { return 3 + l; }, show: function (v) { return 'true blows count ×' + v; } },
      { id: 'pawis', icon: 'drop', branch: 'hand', x: 1, y: -3, req: { suwerte: 1 }, max: 5, cost: { pesos: 250 }, growth: 2.3,
        name: 'He Does Not Rest', desc: 'Ibarra keeps working at the last place you clicked, whether or not you do.',
        val: function (l) { return l; }, show: function (v) { return v + ' clicks a second on their own'; } },
      { id: 'ritmo', icon: 'rhythm', branch: 'hand', x: -1, y: -3, req: { suwerte: 1 }, max: 5, cost: { pesos: 150 }, growth: 2.1,
        name: 'Rhythm of the Work', desc: 'The men sing and the blows fall in time. Clicking without pause builds up power.',
        val: function (l) { return 10 * l; }, show: function (v) { return 'up to +' + v + '% while you keep clicking'; } },

      // ----- The length of the day (north, beside Ibarra's own work)
      { id: 'lampara', icon: 'lamp', branch: 'time', x: 1, y: -2, req: { lakas: 1 }, max: 8, cost: { pesos: 15 }, growth: 2.6,
        name: 'Lamps at the Works', desc: 'Coconut-oil lamps hung along the trenches. The day\'s work goes on a little longer.',
        val: function (l) { return l; }, show: function (v) { return 'the day lasts ' + (Noli.Data.DAY_LENGTH + v) + ' seconds'; } },
      { id: 'kampana', icon: 'bell', branch: 'time', x: 2, y: -3, req: { lampara: 2 }, max: 4, cost: { pesos: 120 }, growth: 3,
        name: 'The Bell-Ringers', desc: 'Basilio and Crispín watch from the belfry. Each donor or visitor greeted, and each interruption you send away yourself, holds the Angelus back one second.',
        val: function (l) { return l; }, show: function (v) { return 'up to ' + v + (v === 1 ? ' extra second' : ' extra seconds') + ' a day'; } },

      // ----- The crew (west)
      { id: 'obreros', icon: 'worker', branch: 'crew', x: -1, y: 0, req: { school: 1 }, max: 20, cost: { pesos: 10 }, growth: 1.25,
        name: 'Hire Laborers', desc: 'Men of the town who dig and build at the works all day.',
        val: function (l) { return l; }, show: function (v) { return v + (v === 1 ? ' laborer' : ' laborers'); } },
      { id: 'juan', icon: 'juan', branch: 'crew', x: -2, y: 0, req: { obreros: 3 }, max: 10, cost: { pesos: 60 }, growth: 1.8,
        name: 'Ñor Juan, Foreman', desc: 'The master of the works drives every crew harder, wherever it is.',
        val: function (l) { return 1 + 0.15 * l; }, show: function (v) { return x(v) + ' speed for all your people'; } },
      { id: 'madaling', icon: 'dawn', branch: 'crew', x: -3, y: 0, req: { juan: 2 }, max: 4, cost: { pesos: 300 }, growth: 2.3,
        name: 'Madaling-Araw', desc: 'Everyone is at work before sunrise, while the air is cool.',
        val: function (l) { return 0.4 * l; }, show: function (v) { return '+' + pct(v) + ' for all your people in the first 3 seconds'; } },
      { id: 'andamyo', icon: 'scaffold', branch: 'crew', x: -3, y: -1, req: { juan: 1, school: 4 }, max: 6, cost: { pesos: 120, wood: 40 }, growth: 2.1,
        name: 'Bamboo Scaffolding', desc: 'Lashed poles all round the works. Clicks and laborers both do more there.',
        val: function (l) { return Math.pow(1.3, l); }, show: function (v) { return x(v) + ' labour at the works'; } },
      { id: 'bayanihan', icon: 'hut', branch: 'crew', x: -3, y: 1, req: { juan: 3 }, max: 3, cost: { pesos: 900 }, growth: 2.8,
        name: 'Bayanihan', desc: 'When neighbours lift together, every hand makes the others lighter.',
        val: function (l) { return 0.003 * l; }, show: function (v) { return '+' + (v * 100).toFixed(1) + '% speed for every person you employ'; } },

      // ----- Timber (north-west), from the foundations on
      { id: 'magtotroso', icon: 'cutter', branch: 'wood', x: -1, y: -1, req: { school: 4 }, max: 20, cost: { pesos: 30 }, growth: 1.25,
        name: 'Woodcutters', desc: 'Men who fell and trim timber in Ibarra\'s wood on their own.',
        val: function (l) { return l; }, show: function (v) { return v + (v === 1 ? ' woodcutter' : ' woodcutters'); } },
      { id: 'palakol', icon: 'axe', branch: 'wood', x: -2, y: -2, req: { magtotroso: 2 }, max: 6, cost: { pesos: 150, wood: 30 }, growth: 2.1,
        name: 'Felling Axes', desc: 'Proper axes with ash handles instead of bolos.',
        val: function (l) { return Math.pow(1.3, l); }, show: function (v) { return x(v) + ' timber'; } },
      { id: 'kalabaw', icon: 'carabao', branch: 'wood', x: -3, y: -3, req: { palakol: 2 }, max: 6, cost: { pesos: 500 }, growth: 2.3,
        name: 'Carabao Teams', desc: 'Sledges dragged by carabao: logs, stone and clay all travel faster.',
        val: function (l) { return Math.pow(1.2, l); }, show: function (v) { return x(v) + ' timber, stone and clay'; } },

      // ----- Stone (north-east), from the cornerstone on
      { id: 'kantero', icon: 'quarryman', branch: 'stone', x: 1, y: -1, req: { school: 8 }, max: 20, cost: { pesos: 120 }, growth: 1.25,
        name: 'Quarrymen', desc: 'Canteros who cut stone at the foot of the mountains on their own.',
        val: function (l) { return l; }, show: function (v) { return v + (v === 1 ? ' quarryman' : ' quarrymen'); } },
      { id: 'kalso', icon: 'pick', branch: 'stone', x: 2, y: -2, req: { kantero: 2 }, max: 6, cost: { pesos: 600, wood: 200 }, growth: 2.1,
        name: 'Picks and Wedges', desc: 'Iron picks, and hardwood wedges soaked until the rock splits.',
        val: function (l) { return Math.pow(1.3, l); }, show: function (v) { return x(v) + ' stone'; } },
      { id: 'kabria', icon: 'crane', branch: 'stone', x: 3, y: -3, req: { kalso: 2 }, max: 6, cost: { pesos: 2000, stone: 500 }, growth: 2.3,
        name: 'An Honest Hoist', desc: 'A derrick built by Ñor Juan himself, and inspected twice.',
        val: function (l) { return Math.pow(1.3, l); }, show: function (v) { return x(v) + ' labour at the works'; } },

      // ----- Clay and brick (south-west), from the walls on
      { id: 'maglulupa', icon: 'clayman', branch: 'clay', x: -1, y: 1, req: { school: 12 }, max: 20, cost: { pesos: 500 }, growth: 1.25,
        name: 'Clay Diggers', desc: 'Men who dig clay on the river bank on their own.',
        val: function (l) { return l; }, show: function (v) { return v + (v === 1 ? ' clay digger' : ' clay diggers'); } },
      { id: 'hurno', icon: 'kiln', branch: 'clay', x: -2, y: 2, req: { maglulupa: 1 }, max: 8, cost: { pesos: 1500, stone: 600 }, growth: 1.9,
        name: 'The Brick Kiln', desc: 'A bigger kiln fires more clay into bricks and tiles every second.',
        val: function (l) { return 12 * Math.pow(1.7, l); }, show: function (v) { return 'fires ' + Math.round(v) + ' clay a second'; } },
      { id: 'molde', icon: 'brick', branch: 'clay', x: -3, y: 3, req: { hurno: 2 }, max: 5, cost: { pesos: 4000 }, growth: 2.3,
        name: 'Brick Moulds', desc: 'Even moulds and careful stacking: fewer bricks crack in the fire.',
        val: function (l) { return Math.pow(1.25, l); }, show: function (v) { return v.toFixed(2) + ' bricks from each clay'; } },
      { id: 'tapahan', icon: 'shed', branch: 'clay', x: -2, y: 3, req: { hurno: 1 }, max: 6, cost: { pesos: 2500, wood: 1200 }, growth: 2.1,
        name: 'Drying Sheds', desc: 'Nipa sheds on the bank, so digging does not stop for every shower.',
        val: function (l) { return Math.pow(1.3, l); }, show: function (v) { return x(v) + ' clay'; } },

      // ----- The lake (south-east), from the roof on
      { id: 'mangingisda', icon: 'fisher', branch: 'lake', x: 1, y: 1, req: { school: 16 }, max: 20, cost: { pesos: 2500 }, growth: 1.25,
        name: 'Shell Gatherers', desc: 'Fishermen who rake shells from the shallows on their own.',
        val: function (l) { return l; }, show: function (v) { return v + (v === 1 ? ' shell gatherer' : ' shell gatherers'); } },
      { id: 'apog', icon: 'lime', branch: 'lake', x: 2, y: 2, req: { mangingisda: 1 }, max: 8, cost: { pesos: 6000, brick: 2000 }, growth: 1.9,
        name: 'The Lime Kiln', desc: 'A bigger kiln burns more shells into lime every second.',
        val: function (l) { return 24 * Math.pow(1.7, l); }, show: function (v) { return 'burns ' + Math.round(v) + ' shells a second'; } },
      { id: 'bangka', icon: 'boat', branch: 'lake', x: 2, y: 3, req: { apog: 1 }, max: 6, cost: { pesos: 8000, wood: 3000 }, growth: 2.1,
        name: 'Bancas', desc: 'Outrigger boats reach the shell beds beyond wading depth.',
        val: function (l) { return Math.pow(1.3, l); }, show: function (v) { return x(v) + ' shells'; } },
      { id: 'capiz', icon: 'shell', branch: 'lake', x: 3, y: 3, req: { apog: 2 }, max: 4, cost: { pesos: 20000, shell: 5000 }, growth: 2.5,
        name: 'Capiz Windows', desc: 'Panes of translucent shell for the schoolroom. The whole town comes to look, and to give.',
        val: function (l) { return Math.pow(1.2, l); }, show: function (v) { return x(v) + ' pesos'; } },

      // ----- The town's money (east)
      { id: 'suscripcion', icon: 'scroll', branch: 'money', x: 1, y: 0, req: { school: 1 }, max: 15, cost: { pesos: 25 }, growth: 1.6,
        name: 'Town Subscription', desc: 'The better families pledge money for every day the works go on.',
        val: function (l) { return Math.pow(1.1, l); }, show: function (v) { return x(v) + ' pesos'; } },
      { id: 'donor', icon: 'donor', branch: 'money', x: 2, y: 0, req: { suscripcion: 2 }, max: 6, cost: { pesos: 80 }, growth: 2,
        name: 'Passing the Plate', desc: 'Well-wishers stop in the plaza with a coin held up. Click them before they wander off.',
        val: function (l) { return 1 + 0.5 * l; }, show: function (v) { return x(v) + ' as many donors'; } },
      { id: 'maria', icon: 'maria', branch: 'money', x: 3, y: -1, req: { donor: 1 }, max: 5, cost: { pesos: 200 }, growth: 2.2,
        name: 'María Clara\'s Visits', desc: 'Once a day she comes to see the walls. Click her, and for a while nobody wishes to seem idle.',
        val: function (l) { return l ? 2 + 2 * l : 0; }, show: function (v) { return 'everything ×2 for ' + v + ' seconds'; } },
      { id: 'tiago', icon: 'tiago', branch: 'money', x: 3, y: 0, req: { donor: 2 }, max: 8, cost: { pesos: 400 }, growth: 2.2,
        name: 'Capitán Tiago\'s Purse', desc: 'Your future father-in-law gives to anything that is seen to be given to.',
        val: function (l) { return Math.pow(1.15, l); }, show: function (v) { return x(v) + ' pesos'; } },
      { id: 'sinang', icon: 'sinang', branch: 'money', x: 3, y: 1, req: { donor: 3 }, max: 3, cost: { pesos: 1500 }, growth: 3,
        name: 'Sinang and the Girls', desc: 'María Clara\'s friends work the plaza for you. Donors and visitors you miss are caught anyway.',
        val: function (l) { return l ? 3 - 0.8 * l : 0; }, show: function (v) { return 'collected for you after ' + v.toFixed(1) + ' seconds'; } },
      { id: 'general', icon: 'medal', branch: 'money', x: 4, y: 0, req: { tiago: 3, school: 12 }, max: 1, cost: { pesos: 60000 }, growth: 1,
        name: 'The Captain-General\'s Favour', desc: 'His Excellency lets it be known that he approves. Purses open, and the friars think twice.',
        val: function (l) { return l ? 2 : 1; }, show: function (v) { return x(v) + ' pesos and ' + x(v) + ' resolve'; } },

      // ----- Trade (south-east, beside the town's money)
      { id: 'tindahan', icon: 'bag', branch: 'trade', x: 2, y: 1, req: { suscripcion: 2, school: 4 }, max: 1, cost: { pesos: 150 }, growth: 1,
        name: 'The Shop', desc: 'A Chinese trader opens a store on the plaza. At night you can sell him what you have too much of, and buy what you lack.',
        val: function (l) { return l; }, show: function () { return 'opens the shop, at night'; } },
      { id: 'tawad', icon: 'talk', branch: 'trade', x: 3, y: 2, req: { tindahan: 1 }, max: 5, cost: { pesos: 400 }, growth: 2.6,
        name: 'Haggling', desc: 'Tía Isabel teaches you to sigh, turn away, and come back.',
        val: function (l) { return 1 - 0.06 * l; }, show: function (v) { return 'you buy ' + pct(1 - v) + ' cheaper'; } },
      { id: 'suki', icon: 'book', branch: 'trade', x: 4, y: 2, req: { tawad: 1 }, max: 5, cost: { pesos: 600 }, growth: 2.6,
        name: 'A Regular Customer', desc: 'Your name goes into the trader\'s book, and he pays a regular better.',
        val: function (l) { return 1 + 0.1 * l; }, show: function (v) { return 'you sell ' + pct(v - 1) + ' dearer'; } },

      // ----- Friends against the convento (south)
      { id: 'tasio', icon: 'tasio', branch: 'shadow', x: 0, y: 1, req: { school: 2 }, max: 12, cost: { pesos: 40 }, growth: 1.7,
        name: 'Counsel of Tasio', desc: 'The old philosopher teaches you what to say to a friar, and what never to say.',
        val: function (l) { return 1 + l; }, show: function (v) { return v + ' resolve per click against interruptions and the convento'; } },
      { id: 'misa', icon: 'candle', branch: 'shadow', x: -1, y: 2, req: { tasio: 1 }, max: 4, cost: { pesos: 150 }, growth: 2.5,
        name: 'Candles and Novenas', desc: 'Be seen at church with wax in your hand, and the friars lose interest sooner.',
        val: function (l) { return l; }, show: function (v) { return 'friars ' + wait(v); } },
      { id: 'gantimpala', icon: 'talk', branch: 'shadow', x: -1, y: 3, req: { misa: 1 }, max: 5, cost: { pesos: 300 }, growth: 2.2,
        name: 'The Town Takes Your Side', desc: 'Every interruption seen off becomes a story told in your favour at the market.',
        val: function (l) { return 0.04 * l; }, show: function (v) { return 'each one sent away pays ' + pct(v) + ' of yesterday\'s pesos'; } },
      { id: 'guevara', icon: 'shield', branch: 'shadow', x: 0, y: 2, req: { tasio: 2, school: 4 }, max: 4, cost: { pesos: 400 }, growth: 2.5,
        name: 'Teniente Guevara', desc: 'The old lieutenant was your father\'s friend. A word from him, and the patrol moves on.',
        val: function (l) { return l; }, show: function (v) { return 'the Guardia Civil ' + wait(v); } },
      { id: 'elias', icon: 'boat', branch: 'shadow', x: 1, y: 2, req: { tasio: 3, school: 12 }, max: 4, cost: { pesos: 3000 }, growth: 2.5,
        name: 'Elías the Pilot', desc: 'He knows the river and the lake, the weather and the crocodile.',
        val: function (l) { return l; }, show: function (v) { return 'floods and the crocodile ' + wait(v); } },
      { id: 'filipo', icon: 'filipo', branch: 'shadow', x: 0, y: 3, req: { guevara: 1 }, max: 6, cost: { pesos: 1200 }, growth: 2.2,
        name: 'Don Filipo\'s Party', desc: 'The teniente mayor and the young liberals stand up to the convento without being asked.',
        val: function (l) { return 0.6 * l; }, show: function (v) { return 'they strike the convento for ' + v.toFixed(1) + '× your resolve every second'; } },
      { id: 'maestro', icon: 'slate', branch: 'shadow', x: 0, y: 4, req: { filipo: 2, school: 8 }, max: 4, cost: { pesos: 5000 }, growth: 5,
        name: 'The Schoolmaster\'s Plans', desc: 'He has waited years for a classroom without a rattan. Now everyone knows what the walls are for.',
        val: function (l) { return Math.pow(1.25, l); }, show: function (v) { return x(v) + ' everything gathered'; } }
    ],

    quiet: [
      'Old Tasio passes the works at dusk and says nothing. At home he goes on writing in his hieroglyphs, for a generation not yet born.',
      'From the belfry, two sacristan boys watch the masons below. Basilio and Crispín would rather be at a desk than at the bell ropes.',
      'The schoolmaster lingers by the trenches. For years he has taught under the convento\'s eye, with a rattan he was told never to put down.',
      'Lamps are lit along the lake shore. The fishermen say the works can be seen from the water now.',
      'Ñor Juan counts the day\'s work twice and pronounces himself satisfied.',
      'Sisa goes home along the road with a basket of vegetables for her sons. She stops a moment to look at the walls.',
      'The evening is still. Somewhere a guitar is being tuned for the fiesta.'
    ],

    ending: 'On a clear morning the children of San Diego walk in under a tiled roof and sit down at desks. In Rizal\'s novel this never happens: the school is left unfinished, its founder is accused of a rebellion staged to ruin him, and he escapes across the lake while Elías dies in his place. Here, for once, the bell that rings is the school\'s own.'
  };
})();
