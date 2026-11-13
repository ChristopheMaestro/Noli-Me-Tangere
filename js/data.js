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

  // ---------- The siege: what comes after the school is finished ----------
  // The workers take up arms as filibusteros, the materials are gone, and the game becomes a defence of the school.
  var plus = function (v) { return '+' + Math.round((v - 1) * 100) + '%'; };
  Noli.Data.siege = {
    HP: 20,            // what the school can take in a day before it is overrun
    MIN_F: 20,         // filibusteros you have at the least, however few workers were hired
    BOSS_EVERY: 5,     // days between one leader and the next
    SPEED: 3,          // world units a second for an enemy of speed 1
    FOES: 9, FOES_GROW: 1.6, MAX_FOES: 70, // enemies in a day: FOES + FOES_GROW for each day already held
    HP_GROW: 1.17, BOUNTY_GROW: 1.105,     // each day held, enemies are this much tougher and pay this much more
    BOSS_ESCORT: 0.6,  // on a leader's day, this share of the usual numbers march with him
    BOSS_LAST: 0.12,   // posts shoot whoever is furthest along the road; a leader counts as this share of the road further back, so his escort is not let through
    WOUND_MIN: 0.15,   // a leader who gets through comes back the next day with the wounds he took, but never with less than this share of his strength
    CALL_EVERY: 4, CALL_HP: 0.4, // the Alférez: seconds between the guardias who fall in beside him, and their strength beside an ordinary one's
    LEVEL_DMG: 1.3,    // each level of a post multiplies what it does
    SPOT: [1.2, 4.4, 2.4], // a post stands at least and at most this far from a road, and this far from another post

    // The roads the enemy comes by, from the edge of the map to the school door. The first is used from the start,
    // the second once the first leader is beaten, the third after the second.
    routes: [
      [[-41, 64], [-40, 50], [-39.5, 40], [-37, 24], [-33, 17.2], [-29.4, 12.5], [-30.8, 2.8], [-16.5, -5.7], [-14, -2.8], [1.4, 2.8], [0.4, 5.6], [3.4, 7.3]],
      [[-21, -64], [-25, -54], [-27, -44.5], [-28, -37.5], [-24, -31], [-28, -24], [-28, -15.5], [-26.6, -7], [-23.8, -1.4], [-16.5, -5.7], [-14, -2.8], [1.4, 2.8], [0.4, 5.6], [3.4, 7.3]],
      [[64, 17], [52, 14.5], [40, 13], [21, 10.4], [16, 12.4], [12.2, 12], [10.1, 10.4], [8, 8.8], [7, 7.6], [5, 7.4]]
    ],
    START: [14, 10, 12], // how far along each road the enemy first shows (the roads themselves run on to the edge)

    // The posts. cost in filibusteros; dmg a shot, rate shots a second, range in world units.
    towers: [
      { id: 'tirador', icon: 'tower', name: 'Tiradores', cost: 20, dmg: 4, rate: 1, range: 7,
        desc: 'Slingers on a bamboo lookout. Cheap, and quick with a stone.' },
      { id: 'escopeta', icon: 'rifle', name: 'Escopeteros', cost: 35, dmg: 17, rate: 0.5, range: 11,
        desc: 'Old fowling pieces dug up from under the floorboards. A long reach, slow to load.' },
      { id: 'lantaka', icon: 'cannon', name: 'Lantaka', cost: 50, dmg: 11, rate: 0.42, range: 6.5, splash: 2.8,
        desc: 'A bronze swivel gun off a lake boat. Its shot hurts everyone near where it lands.' },
      { id: 'bitag', icon: 'net', name: 'Snares', cost: 25, dmg: 1.5, rate: 0.8, range: 6, slow: 0.4, slowT: 2.2,
        desc: 'Fishing nets and trip-lines. Whoever is caught walks slowly for a while.' }
    ],

    // The enemy. hp, bounty in pesos and speed are for the first day; hit is what one costs the school if he gets in.
    // from: the first day (counting days held) he is seen.
    foeOrder: ['guardia', 'cuadrillero', 'cazador', 'lego', 'carabinero'],
    foes: {
      guardia: { name: 'Guardia Civil', hp: 10, speed: 1, bounty: 2, hit: 1, from: 0, look: { hat: 'cap', top: 0x2a4a9a, bottom: 0xf0e8d8, shoe: 0x1a1420, sash: 0xfff6ea } },
      cuadrillero: { name: 'Cuadrillero', hp: 6, speed: 1.6, bounty: 2, hit: 1, from: 2, look: { top: 0xb8a070, bottom: 0x4a4a6a, hair: 0x2a1c16, sash: 0xd8222a } },
      cazador: { name: 'Cazador', hp: 36, speed: 0.75, bounty: 6, hit: 2, from: 4, look: { hat: 'cap', top: 0xf0e8d8, bottom: 0xd8222a, shoe: 0x1a1420, sash: 0x2a4a9a, big: 1.12 } },
      lego: { name: 'Lay brother', hp: 22, speed: 1, bounty: 5, hit: 2, from: 7, noSlow: true, look: { robe: 0x3a3440, cord: 0xfff6e0, style: 'tonsure', hair: 0x2a1c16 } },
      carabinero: { name: 'Carabinero', hp: 30, speed: 1.35, bounty: 7, hit: 3, from: 11, look: { hat: 'cap', top: 0x3a6a4a, bottom: 0x2a2634, shoe: 0x1a1420, sash: 0xf7c930 } }
    },

    // The five leaders. hp is for the first day and grows like everyone else's; a leader who reaches the school takes it for the day.
    bosses: [
      { id: 'sacristan', icon: 'bossSacristan', name: 'The Sacristan Mayor', hp: 120, speed: 0.55, bounty: 60,
        look: { robe: 0x2a2634, cord: 0xfff6e0, hair: 0x2a1c16, skin: 0xd0a070, big: 1.7 },
        text: 'The man who beat little Crispín over two gold pieces he never took comes up the road at the head of the convento\'s servants, swinging his rattan.',
        how: 'Nothing clever about him: he is simply hard to stop.' },
      { id: 'consolacion', icon: 'bossConsolacion', name: 'Doña Consolación', hp: 150, speed: 0.6, bounty: 90, trait: 'whip',
        look: { robe: 0x8a2a3a, stripe: 0x2a2634, top: 0xe8463a, style: 'long', hair: 0x1a1420, big: 1.7 },
        text: 'The Alférez\'s wife, the Muse of the Guardia Civil, who made mad Sisa dance under the whip. She has brought it with her.',
        how: 'Everyone near her whip walks half as fast again. Snares slow them down all the same.' },
      { id: 'alferez', icon: 'bossAlferez', name: 'The Alférez', hp: 170, speed: 0.55, bounty: 120, trait: 'call',
        look: { hat: 'cap', top: 0xf0e8d8, bottom: 0x2a4a9a, shoe: 0x1a1420, sash: 0xf7c930, big: 1.75 },
        text: 'The commander of the Guardia Civil of San Diego, drunk and delighted: at last, a rebellion he can report to Manila.',
        how: 'A guardia falls in beside him every four seconds, for as long as he walks.' },
      { id: 'salvi', icon: 'salvi', name: 'Padre Salvi', hp: 420, speed: 0.5, bounty: 150, trait: 'heal',
        look: { robe: 0x5a4034, cord: 0xfff6e0, hair: 0x2a1c16, style: 'tonsure', skin: 0xf2dcc8, big: 1.75 },
        text: 'Thin, silent Padre Salvi, who denounced a rising he had arranged himself. He walks in the middle of his men and blesses them.',
        how: 'Those who walk near him are healed as they go. Bring him down first, or hit them all at once.' },
      { id: 'damaso', icon: 'damaso', name: 'Padre Dámaso', hp: 800, speed: 0.45, bounty: 200, trait: 'stone',
        look: { robe: 0x6e4a32, cord: 0xfff6e0, hair: 0x4a3020, style: 'tonsure', skin: 0xe6bc9c, big: 2 },
        text: 'Twenty years curate of San Diego, the man who had your father dug out of his grave. He has come to see the school pulled down stone by stone.',
        how: 'No snare holds him, and he gets his breath back as he walks.' }
    ],

    branches: { men: 'The filibusteros', post: 'The posts', arms: 'Arms', town: 'The town', chest: 'The war chest', friend: 'Friends' },
    // The tree of the siege, paid in pesos. Same fields as the tree of bonuses above.
    upgrades: [
      { id: 'recluta', icon: 'fili', branch: 'men', x: 0, y: 0, req: {}, max: 40, cost: 22, growth: 1.14,
        name: 'Recruits', desc: 'Men come down from the hills to join you. Filibusteros are what posts are raised with.',
        val: function (l) { return l * 5; }, show: function (v) { return '+' + v + ' filibusteros'; } },
      { id: 'tirador', icon: 'tower', branch: 'post', x: -1, y: -1, req: { recluta: 0 }, max: 10, cost: 28, growth: 1.6,
        name: 'Tiradores', desc: 'Better slings, and more practice with them.',
        val: function (l) { return l + 1; }, show: function (v) { return 'level ' + v; } },
      { id: 'bitag', icon: 'net', branch: 'post', x: -2, y: -1, req: { tirador: 2 }, max: 10, cost: 55, growth: 1.55,
        name: 'Snares', desc: 'The first level lets you raise snares. Each level after catches harder.',
        val: function (l) { return l; }, show: function (v) { return 'level ' + v; } },
      { id: 'escopeta', icon: 'rifle', branch: 'post', x: 0, y: -1, req: { tirador: 2 }, max: 10, cost: 70, growth: 1.6,
        name: 'Escopeteros', desc: 'The first level lets you raise posts of escopeteros. Each level after makes them deadlier.',
        val: function (l) { return l; }, show: function (v) { return 'level ' + v; } },
      { id: 'lantaka', icon: 'cannon', branch: 'post', x: 1, y: -1, req: { escopeta: 2 }, max: 10, cost: 180, growth: 1.6,
        name: 'Lantaka', desc: 'The first level lets you mount lantakas. Each level after gives them a heavier charge.',
        val: function (l) { return l; }, show: function (v) { return 'level ' + v; } },
      { id: 'tanaw', icon: 'eye', branch: 'arms', x: -1, y: -2, req: { tirador: 3 }, max: 6, cost: 60, growth: 1.75,
        name: 'Lookouts', desc: 'Boys in the palm tops call out who is coming. Every post reaches further.',
        val: function (l) { return 1 + 0.06 * l; }, show: plus },
      { id: 'pulbura', icon: 'spark', branch: 'arms', x: 0, y: -2, req: { escopeta: 1 }, max: 10, cost: 80, growth: 1.62,
        name: 'Dry Powder', desc: 'Powder kept in sealed jars, shot counted out beforehand. Every post fires faster.',
        val: function (l) { return 1 + 0.07 * l; }, show: plus },
      { id: 'apoy', icon: 'flame', branch: 'arms', x: 1, y: -2, req: { lantaka: 1 }, max: 5, cost: 160, growth: 1.8,
        name: 'Tasio\'s Fire-pots', desc: 'The old philosopher has read how the Greeks did it. Whatever is hit goes on burning for three seconds.',
        val: function (l) { return 0.12 * l; }, show: function (v) { return Math.round(v * 100) + '% of each hit again, every second'; } },
      { id: 'pader', icon: 'wall', branch: 'town', x: -1, y: 1, req: { recluta: 0 }, max: 10, cost: 35, growth: 1.55,
        name: 'Shored Walls', desc: 'Beams against the doors, sacks in the windows. The school can take more.',
        val: function (l) { return l * 5; }, show: function (v) { return '+' + v + ' for the school'; } },
      { id: 'lunas', icon: 'heart', branch: 'town', x: -2, y: 1, req: { pader: 2 }, max: 5, cost: 110, growth: 1.8,
        name: 'The Infirmary', desc: 'Sisa\'s boy Basilio carries water and lint. The school mends while the fight goes on.',
        val: function (l) { return l * 0.12; }, show: function (v) { return '+' + (v * 10).toFixed(1) + ' every ten seconds'; } },
      { id: 'barikada', icon: 'scaffold', branch: 'town', x: 0, y: 1, req: { recluta: 0 }, max: 8, cost: 60, growth: 1.65,
        name: 'Barricades', desc: 'Carts, benches and church pews across every road. All the enemy walk more slowly.',
        val: function (l) { return 1 - 0.04 * l; }, show: function (v) { return Math.round((1 - v) * 100) + '% slower'; } },
      { id: 'elias', icon: 'boat', branch: 'friend', x: 0, y: 2, req: { barikada: 2 }, max: 6, cost: 220, growth: 1.75,
        name: 'Elías', desc: 'The pilot is not dead, whatever the novel says. Every few seconds he picks off the strongest man on the road.',
        val: function (l) { return l; }, show: function (v) { return 'a shot every ' + (6.5 - 0.5 * v) + ' seconds'; } },
      { id: 'gantimpala', icon: 'bag', branch: 'chest', x: 1, y: 1, req: { recluta: 0 }, max: 10, cost: 45, growth: 1.6,
        name: 'Spoils', desc: 'Rifles, boots and cartridge belts fetch a price across the lake. More pesos for every enemy brought down.',
        val: function (l) { return 1 + 0.15 * l; }, show: plus },
      { id: 'kaban', icon: 'stack', branch: 'chest', x: 2, y: 1, req: { gantimpala: 2 }, max: 5, cost: 90, growth: 1.9,
        name: 'Capitán Tiago\'s Purse', desc: 'He backs every side, and yours too. Pesos arrive each dawn, more the longer you hold.',
        val: function (l) { return l * 12; }, show: function (v) { return v + ' pesos each dawn, growing with the days'; } }
    ],

    intro: 'The town is with you. The convento is not. The friars have told Manila that the school is a nest of filibusteros, and the Guardia Civil is on the road with every bully the curate could hire. Your workers have put down their tools and picked up what they could find. The materials are spent, the money is gone: all you have is them.',
    victory: 'Padre Dámaso is carried back to the convento on a door. The Captain-General, who never liked the friars, lets it be known that the school of San Diego is under his protection. They may come again; but the children are at their desks, and the men on the lookouts are not going home yet.'
  };
})();
