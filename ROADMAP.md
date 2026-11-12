# Noli: Concept and Roadmap

Written for: the project owner, as a design concept. No code yet.

## 1. Pitch

An incremental game set in San Diego, the fictional Laguna town of *Noli Me Tangere* (1887). You are Crisóstomo Ibarra, returned from Europe, and you are building a school. Each round is a 15-second push of work and tension. Between rounds you spend what you earned to make the next round easier. The school is built stone by stone while the town, the friars and the Guardia Civil watch.

The tone should follow Rizal: satirical, humane, and tragic. The game is not a power fantasy. Progress should always cost something.

## 2. Lore anchors (to verify against the text before implementation)

- **Setting:** San Diego, a town in Laguna province. Rizal based it on Calamba. The lakeshore, the church, the convent, the plaza and the cemetery are the core locations.
- **Ibarra's school:** his project to give the town's children a modern education. It is the spine of the plot and the thing the friars resist most.
- **Opposition:** Padre Dámaso (hostile to the Ibarra family) and the friars, who see education for Filipinos as a threat.
- **Allies and foils:** Elías (loyal, unseen help), Capitán Tiago (wealthy, cautious), Pilosopo Tasyo (the old scholar who thinks the reformist plan is naive), Basilio and Sisa (the human cost of the system).
- **Institutions:** the parish, the Guardia Civil, the colonial bureaucracy, and gossip as a social force.

Before building, I will check each name, event and location against the novel to confirm exact wording and scenes. I am not certain enough of every detail to commit to it now.

## 3. Core loop

1. **Round (15 seconds).** Ibarra works: laying foundations, raising walls, teaching, collecting donations. Earnings grow the school.
2. **Round ends.** Something happens (see section 4).
3. **Upgrade menu.** Spend the round's earnings on stats that carry into the next round.
4. **Repeat.** Each round is harder, with new threats and new numbers.

## 4. What ends a round (candidates)

| Event | Lore basis | Effect |
|---|---|---|
| **Friar's inspection** | Padre Dámaso or Padre Salvi visits to check the school | Suspicion rises. If it's too high, the round ends in a loss of funds. |
| **Guardia Civil raid** | Colonial order enforcing its authority | Students are dispersed; the school loses progress. |
| **Typhoon or lake flood** | Rainy season on the Laguna shore | Construction is damaged; you must repair before the next round. |
| **Rumor (chismis)** | The town's gossip network | Reputation shifts up or down, and the next round is modified. |
| **Mass bell** | The parish's authority over the calendar | A forced pause: you can work, but only on what the church allows. |

Recommendation: start with **inspection** and **rumor**. They are readable, they tie to the plot, and they test the core stat system before adding weather or raids.

## 5. Stats (upgrade menu)

| Stat | What it does | Lore flavor |
|---|---|---|
| **Pedagogy** | More learning per round | Ibarra's modern methods |
| **Funds** | Starting resources each round | Family wealth, donations |
| **Reputation** | Fewer negative events from the town | Standing with families and gossip |
| **Discretion** | Lowers suspicion from the friars | Tact: winning without provoking |
| **Influence** | Unlocks allies (Elías, Capitán Tiago) | Connections in the town |
| **Resilience** | Survive typhoons and raids | Building quality |

Design goal: every stat is a trade-off. Pure Funds grows the school but attracts the friars. Pure Discretion protects the school but slows it. Players will choose their own Ibarra.

## 6. Isometric world and art direction

- **Camera:** fixed 3D isometric, rotatable in 90° steps, zoom limited.
- **Map:** designed first as geography (lakeshore, road, plaza, church, convent, cemetery, the school site), then placed. This follows the Macondo-style rule of geography before locations.
- **Architecture:** bahay na bato, nipa and galvanized roofs, capiz-shell windows, adobe church walls, wooden convent.
- **Palette:** warm adobe and sampaguita white, lake blues, narra wood browns, with a cooler colonial grey for the friars' buildings. Colors shift as suspicion rises.
- **Characters:** stylized low-poly with readable silhouettes. Friars in cassock, Guardia Civil in tricornes, students in simple barong or baro't saya.
- **Feedback:** construction progress is visible on the building itself. Each round adds a visible layer.

## 7. Roadmap

**Phase 0: Lore and design (now)**
- Verify characters, locations and scenes against the novel.
- Finalize the map layout (geography first).
- Write the event list and the stat balance sheet.

**Phase 1: Vertical slice**
- One isometric plot with the school site.
- One 15-second round loop with a timer and earnings.
- One round-ending event (rumor), one upgrade menu, two stats.

**Phase 2: Systems**
- All five round-ending events with suspicion and loss mechanics.
- All six stats and their effects.
- Save and load between sessions.

**Phase 3: Art and world**
- Isometric town: plaza, church, convent, lake, cemetery, school.
- Building stages for the school (foundation, walls, roof, interior).
- Characters and a simple animation set.

**Phase 4: Narrative beats**
- Story milestones tied to progress (Ibarra's arrival, the friars' first visit, the school's blessing and its threats).
- Lore cards that quote or paraphrase the novel, with attribution.

**Phase 5: Balance and polish**
- Tune the 15-second round length, event frequency and upgrade costs.
- Playtest the trade-offs between Funds, Discretion and Pedagogy.
- Audio: church bells, lake wind, market sounds.

## 8. Open questions for you

1. **Engine:** Godot is a good fit for 3D isometric and is available through the tooling here. Do you want Godot, or another engine?
2. **Tone:** should the game stay close to the novel's tragedy (school eventually destroyed or lost), or can the player choose a hopeful ending?
3. **Round-end events:** which of the five should be in the first build?
4. **Scope:** a short game (one story arc, about 2 hours) or a longer incremental game with endless rounds after the story?
5. **Language:** English only, or English with Tagalog and Spanish flavor text?
