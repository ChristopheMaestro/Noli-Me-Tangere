# Noli me Tangere: Building the School of San Diego

An incremental game after José Rizal's *Noli Me Tangere*. You are Crisóstomo Ibarra, building a school in San Diego in days that last 8 seconds at first. A full game takes somewhat under an hour.

## Run

Open `index.html` in a browser. Nothing to install; three.js is vendored in `vendor/`.

## Play

The interface is pictograms and plain lettering laid over the town; hover over anything to read what it is.

- **Gather.** Round markers float over the places where work is done: the works (labour), Ibarra's wood (timber), the quarry (stone), the clay pit (clay, fired into bricks by the kiln) and the lake shore (shells, burned into lime). Click a marker to work there; a click counts on the marker or just around it (about one and a half times its size), not elsewhere on the map. Only the works are open at first; the others open as the school rises.
- **Kilns.** The brick kiln and the lime kiln work all day on their own. Click one to stoke it: each click fires half a second of its work at once.
- **Donors.** Coins and visitors pop up in the plaza for a few seconds. Click them.
- **Interruptions.** A friar, the Guardia Civil, a cloudburst or the crocodile stops all work at one place until you click it away. Bonuses in the tree later send them off without you.
- **The length of the day.** Two bonuses stretch it: lamps at the works add one second per level, and the bell-ringers hold the Angelus back one second for each donor, visitor or interruption you deal with, up to their level each day.
- **Night.** When the day is over the Angelus rings and the tree of bonuses opens. The school is at its centre: pay the materials for the next building step there. Every fourth step completes a stage and opens a new place, a new material and new branches. Drag to move the tree, wheel to zoom, Shift-click to buy several levels.
- **The shop.** A bonus on the tree opens a shop at night: sell what you have too much of, buy what you lack. Prices follow the town's daily giving. Once every bonus paid for in a material is bought, a standing order sells each evening whatever the next step of the school does not need.
- **The convento.** The last step of each stage is blocked until you win a confrontation (the red words beside the sunrise). Wear it down by clicking before the Angelus; it is untouchable while any interruption stands. Each one fights back in its own way: some close up (the mark turns dark, and a click then costs you daylight), some show openings beside them that count for six clicks, some recover while an interruption stands, one (the Alférez) cannot be clicked at all and is beaten by seeing off six of his patrols, and one keeps your people at home. Losing costs nothing: try again another day.
- **The town grows.** For every five workers you hire, of any kind, a new household settles in San Diego: a hut with its path, and with it a well, a field, a haystack, a granary or a bigger cemetery. There are twenty to come.
- Q / E or the corner buttons rotate the view. The mouse wheel zooms.

## Files

- `js/data.js`: materials, places, stages, confrontations, the tree of bonuses and all lore text. All tuning numbers are here.
- `js/sprites.js`: all pixel art, drawn in code at load time (textures, the painted ground, people, trees).
- `js/icons.js`: the pictograms (small SVG drawings, and busts cut from the character sprites).
- `js/world.js`: the HD-2D isometric town: sprites in a lit 3D scene, with tilt-shift blur and bloom. Everything that never moves is welded into one mesh per material (the households that come later are welded again each time one arrives, and their paths and fields are painted into the ground), and the drawing resolution steps down by itself if frames run slow.
- `js/game.js`: game state, the day, the tree, tooltips, saving, and a robot player for measuring length.
- `Noli_Me_Tangere.svg`: the title logo.
- `ROADMAP.md`: the original concept (older than the current design).

## Debug

- `index.html?bot=2.5` plays the whole game with a robot at 2.5 clicks a second and prints the number of days per stage, and how many tries each confrontation took, to the browser console. Use it after changing numbers in `data.js`. It counts the seconds of each day plus 15 seconds for each night.
- `?auto=1&step=9&up=2&rich=500` jumps into a day with nine building steps done, every bonus at level 2 and 500 of everything. `auto=tree` opens the tree, `auto=dusk` ends a day at once, `boss=1` makes the day a confrontation.
- `perf=1` shows the frame time, the number of draw calls and the drawing quality; `q=0` to `q=3` fixes the quality (0 is the sharpest).
- `auto=shop` opens the shop. `houses=12` shows the town with twelve of its new households. `zoom=2` sets the zoom, `light=1.6` freezes the hour (0 dawn, 0.5 noon, 1 dusk, above 1 night), `nopost=1` turns off the blur and bloom, and `top=1` looks at the map from above with north up (for checking where things stand).
