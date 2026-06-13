# Fish Banks — Systems-Thinking Simulation · Full Spec

A tuned, digital re-implementation of Dennis Meadows' classic **Fish Banks** tragedy-of-the-commons exercise, built for an *AI + Systems Thinking* workshop.

This spec is in **two parts**:

1. **The model** — the simulation engine, parameters, dynamics, and the systems-thinking payload. This is what ships in this repo (runnable, single-player sandbox + headless explorer).
2. **The live multiplayer architecture** — how the classroom game was built, described as a reusable pattern. **No backend code or credentials are published here** — only the architecture, so you can build your own on top of the same engine.

> **Origin (why this exists).** The whole thing started as a hand-drawn stock-and-flow model. An AI coding agent generated and tuned the engine from it, then built two front-ends: this reduced single-player sandbox, and a live multiplayer classroom game (Part 2). The point of publishing it is the workshop's own thesis — *the production bottleneck for experiential learning is gone; here is the model, rebuild and extend it with your own agent.*

---

## Part 0 — What ships vs. what's described

| | In this repo | Documented only (Part 2) |
|---|---|---|
| Engine (`fishbanks.js`) | ✅ runnable | — |
| Single-player sandbox (`index.html`) | ✅ open it, no server | — |
| Headless explorer (`explore.mjs`) | ✅ `node explore.mjs` | — |
| Agent scaffolding (`CLAUDE.md`/`AGENTS.md`) | ✅ | — |
| Live multiplayer game (Firebase/rooms/roles) | ❌ not included | ✅ architecture pattern, secrets stripped |

---

## Part 1 — The Model

### 1.1 System structure (stocks, flows, delays)

Three **stocks**:
- **Fish** — one shared ocean stock (the commons). *Hidden from players.*
- **Fleet** — each company's ships, split `shipsSea` (fishing, earning) / `shipsPort` (idle, cheaper).
- **Cash** — each company's money. The win metric.

**Flows:**
- *Births* → fish (density-dependent regeneration).
- *Catch* → out of fish, into cash as revenue.
- *Costs* → out of cash (sea ships and port ships both cost; sea costs more).
- *Ship orders* → into fleet, but **delayed one round** (the build delay).

**The three structural ingredients that drive collapse** (none is "people being greedy"):
1. a **shared** stock (your catch depends on everyone's fishing),
2. a **delay** (ships ordered this round arrive next round, so you keep ordering into a stock that has already turned), and
3. a private **"maximize my cash"** goal.

### 1.2 Parameters (`fishBanksParams()`)

```json
{
  "carryingCapacity": 6000,
  "initialFish": 4800,
  "shipCost": 25000,
  "portCost": 7000,
  "seaCost": 25000,
  "fishPrice": 1000,
  "startCash": 250000,
  "buildDelay": 1,
  "yearsPerRound": 3,
  "maxShipCatch": 50,
  "startShipsPort": 2,
  "startShipsSea": 2,
  "recommendedTeams": 4,
  "recommendedRounds": 8,
  "birthCoefTable":    [0, 0.0476, 0.335, 0.866, 0.89, 0.884, 0.793, 0.689, 0.098, 0.055, 0.018],
  "catchPerShipTable": [2, 7, 12, 18, 25, 31, 37, 42, 46, 49, 50]
}
```

### 1.3 The two density curves

Both tables are **0..1 density lookups** (`density = fish / carryingCapacity`, step 0.1, linearly interpolated via `fbInterp`).

- **`birthCoefTable`** — fractional regeneration per year as a function of density. It is **humped**: regeneration peaks around **density ≈ 0.7** and is low both when the stock is tiny *and* when it's packed near carrying capacity (crowding). This is why **moderate fishing can make the stock more productive** — you pull density down toward the regeneration peak.
- **`catchPerShipTable`** — tonnes/ship/year as a function of density, rising monotonically to the `maxShipCatch` (50t) cap. As the hidden stock thins, **catch-per-ship falls** — the only signal players can see.

### 1.4 Round algorithm (`stepRound`)

One round = `yearsPerRound` (3) simulated years, decision held constant. A **decision** per team is `{ buy, toSea, sendNewToSea }`.

1. **Deliver + reorder (per team):** ships ordered `buildDelay` rounds ago arrive now (to sea if `sendNewToSea`, else port). Apply this round's `buy` (costs `buy × shipCost`, queued with `ready = buildDelay`). Apply `toSea` redeploy (`>0` port→sea, `<0` sea→port; `99` = send all).
2. **Simulate 3 years, decision constant.** Each year:
   - `density = fish / K`; `cps = min(catchPerShipTable[density], maxShipCatch)`.
   - `births = fish × birthCoefTable[density]`.
   - `totalCatch = totalShipsAtSea × cps`, **capped** at `fish + births` (can't catch what isn't there).
   - `fish = max(0, fish + births − totalCatch)`.
   - Each company's catch = `totalCatch × (ownShipsSea / totalShipsSea)` (share of the shared haul). `cash += catch×fishPrice − (shipsPort×portCost + shipsSea×seaCost)`.
   - If `cash < 0` → **bankrupt** (fleet recalled to idle port, stops fishing).
3. Returns `{ fish, density, catchPerShip, teams:[{cash, shipsSea, shipsPort, bankrupt, roundCatch, roundRevenue}] }`. Mutates `state` in place.

`fbForceCollapseDecisions()` is a facilitator-insurance lever: forces an aggressive buy/deploy for all live teams to guarantee the stock hits the cliff on the clock.

### 1.5 Tuning rationale (why these numbers, not realism)

The engine is tuned for a **pedagogically legible overshoot-and-collapse**, not biological realism:
- **`seaCost` raised 10k → 25k** so an over-built/idle fleet bleeds cash fast post-crash → produces *visible bankruptcies* (without it the boom is so lucrative no one ever goes broke).
- **`catchPerShipTable` tuned** to a gradual, less-flat-topped curve so catch-per-ship *visibly erodes* as the stock drops — this is the early-warning beat; a flat table kills it.
- **`initialFish = 4800` (density 0.80)** = near carrying capacity → early fishing is very lucrative (cps ≈ 47, tempting expansion) but already *past* peak regeneration, so **overshoot is baked in**.

### 1.6 Emergent dynamics (engine-verified)

- **All-greedy** (4 teams, buy-5/round, all to sea): fish crashes to 0, **collapse ~round 6–7, all bankrupt**.
- **Moderate** (cautious buying): survives all rounds, fish settles ~density 0.5, no bankruptcies.
- **Cooperative** (hold a small fleet): rock-stable at density ≈ 0.89, lower peak cash, never ends.
- **The early-warning:** catch-per-ship turns **down** while *total* catch is still **rising** — a degrading leading indicator under a green headline number. This is the one transferable skill.
- **The commons cliff** is at **~75 ships at sea** (aggregate). **MSY ≈ 8,688 t/round** at density 0.68; a robust sustainable quota is **~7,400 t/round**.
- **Worked example — the workshop cohort (room 8305, 3 teams, 13 rounds):** the ocean **survived** (cohort ≈ **+$23.6M**), but from **low fishing pressure + luck** (~1.1 ships bought/team/round — below the threshold), *not* safety. Flip one company to a defector at buy-5 and **the shared ocean dies and everyone goes bankrupt**. Restraint is only as good as the least-restrained player. (The sandbox ships this as the `▶ Your cohort` / `😈 …now one of you defects` presets.)

### 1.7 The leverage-points map (Meadows) + the three escapes

Map the game onto Donella Meadows' leverage points (weakest → strongest):

| Lever | In the game | Strength |
|---|---|---|
| **#12 Parameters** | the buy rate, the deploy split — *where an optimizer lives* | weakest |
| **#6/#5 Add a missing loop / Rules** | a progressive ship tax, a quota cap (balancing feedback) | medium |
| **#3 Goal** | change "maximize my cash" → "sustainable yield / a living ocean" | strong |
| **#2 Paradigm** | "we are competitors on a shared stock" → "we are co-owners of it" | strongest |

The **three classic escapes**, ranked:
1. **Quota / total-allowable-catch** = a *rule* (knob #5). *A quota without monitoring + graduated sanctions is a wish* (Ostrom's 5-finger test: boundaries / monitoring / graduated sanctions / who-makes-the-rule / conflict-resolution).
2. **Privatization / property rights** = ownership/structure. Collapse depends on the stock being *one-of-N shared*; an owner of the whole ocean with a long horizon conserves.
3. **Self-governance via communication** = the *goal/paradigm* (knobs #3–#2) — the oxygen the other two need. A quota nobody agreed to and nobody monitors is just the tragedy with extra steps.

### 1.8 The AI / optimization payload (the point)

Run an optimizer on this model with the objective `maximize own_cumulative_cash` and it wins big mid-game, then **strip-mines the ocean and bankrupts itself** — because an optimizer searches a **fixed decision space you hand it**: that is leverage **#12, the weakest lever**. Local optimization can't fix a system-structure problem; it *is* the problem, executed optimally.

The sharper, honest version (objective vs. search space): an LLM **will redesign the board for any goal you give it** — propose a tax, a quota, a stop-signal (it can operate above #12). What it **won't** do is decide that the goal *shouldn't* be "maximize cash." **The objective is always handed in from outside. That's the one lever that stays on the human's side of the table.**

---

## Part 2 — The Live Multiplayer Architecture (described pattern; not shipped)

> This repo ships the **single-player** sandbox only. The classroom multiplayer game is documented here as a **reusable architecture**. **No backend code, config, or credentials are included.** To build your own, point the same `stepRound` engine (Part 1) at any realtime store.

### 2.1 Design philosophy — "almost-boring app, instrumented for the debrief"

Build **only** features that feed a named debrief beat. A janky app with a rehearsed 22-minute debrief beats a gorgeous app with an improvised one, every time. The five features that earned their place: private decision inputs · a round timer · a fish-stock + catch-per-ship plot · per-round decision logging · a facilitator submitted/waiting grid + force-collapse lever. *If a feature doesn't feed a debrief beat, it doesn't ship.*

### 2.2 Roles (three views, one room)

- **Facilitator** — drives rounds (advance / force-collapse), sees a submitted/waiting grid, can manually override a team's decision, toggles a "summit" (negotiated rule), and flips the shared screen between *standings*, *reveal*, and *re-live*.
- **Player / team** — own phone; picks a company; enters a **private** `{buy, toSea, sendNewToSea}`; sees **only its own** cash, fleet, and last haul. *Crucially cannot see the ocean stock.*
- **Spectator / projector** — the shared screen: live cash standings during play; after the game, **"the ocean you couldn't see"** (the hidden fish-stock + catch-per-ship reveal).

### 2.3 Room state model (schema — no secrets)

A room is one realtime document keyed by a short room code:

```
room/<code> = {
  phase:      'setup' | 'lobby' | 'playing' | 'debrief' | 'act2',
  round:      Int,           teamCount: Int,   maxRounds: Int,
  ocean:      { fish, density, catchPerShip },          // shared truth — facilitator/spectator only
  teams: {
    "<slot>": {
      name, joined, clientId,
      cash, shipsPort, shipsSea, pending:[{count,ready}], bankrupt,
      decision: { buy, toSea, sendNewToSea, submitted }
    }, ...
  },
  history:  [ { round, fish, density, catchPerShip,
                teams:[{name,cash,shipsSea,shipsPort,bankrupt,roundCatch,buy,toSea}],
                summitActive, summitRule } ],
  summit:   { active, rule },
  sharedMode: 'play' | 'reveal' | 'replay'
}
```

### 2.4 Round-resolution flow

1. Players submit decisions (`teams/<slot>/decision.submitted = true`).
2. Facilitator hits **Advance**. The client rebuilds engine state from the room doc, runs `stepRound` (Part 1), and writes back: new `ocean`, per-team `cash/fleet`, a pushed `history` entry, and reset decisions; `round++`, `phase → playing|debrief`.
3. The realtime store pushes the new doc to every client, which re-renders for its role. State is **server-authoritative**; a rejoining player just re-reads.

**Room-doc ↔ engine field mapping** (the room schema in §2.3 is *not* the engine schema in Part 1 — map it explicitly):

| Room doc (§2.3) | Engine (Part 1) | Note |
|---|---|---|
| `ocean.fish` | `state.fish` | the only ocean field the engine stores; `density` / `catchPerShip` are **returned** by `stepRound`, recompute them on write-back |
| `teams.<slot>.{cash,shipsPort,shipsSea,bankrupt}` | `state.teams[i].{cash,shipsPort,shipsSea,bankrupt}` | 1:1 |
| `teams.<slot>.pending` | `state.teams[i].pendingShips` | **name differs — the only rename** |
| `teams.<slot>.decision` | `decisions[i]` | drop `submitted`; pass `{buy,toSea,sendNewToSea}` only |
| (a stable, ordered list of slot keys) | array index `i` | fix the order **once** at game start (see subtleties) |

**Worked `advanceRound` (the whole round-trip, against the real Part 1 signatures):**

```js
import { fishBanksParams, stepRound, fbForceCollapseDecisions } from './fishbanks.js';
const P = fishBanksParams();

// `slots`: a STABLE, ordered array of the room's team slot-keys, frozen at game start.
function advanceRound(room, slots, { forceCollapse = false } = {}) {
  // 1) room doc -> engine state (note the ONE rename: room `pending` -> engine `pendingShips`)
  const state = {
    fish: room.ocean.fish,
    teams: slots.map(k => {
      const t = room.teams[k];
      return { cash: t.cash, shipsPort: t.shipsPort, shipsSea: t.shipsSea,
               pendingShips: t.pending || [], bankrupt: t.bankrupt };
    }),
  };

  // 2) decisions array, parallel to `slots`. Drop `submitted`; a team that never
  //    submitted defaults to "repeat last decision" (the straggler rule, §2.8).
  let decisions = slots.map(k => {
    const d = room.teams[k].decision || room.teams[k].lastDecision || {};
    return { buy: d.buy || 0, toSea: d.toSea || 0, sendNewToSea: d.sendNewToSea !== false };
  });

  // 2b) Act 2: if a summit rule is active, enforce it on the decisions BEFORE stepping
  //     — the engine knows nothing about rules (see §2.7; the quota variant is the
  //     shipped `enforceCap()` in explore.mjs). Facilitator force-collapse overrides all.
  if (forceCollapse) decisions = fbForceCollapseDecisions(state);
  else if (room.summit?.active) decisions = applySummit(decisions, state, room.summit.rule);

  // 3) run the SAME engine the sandbox runs. Mutates `state`; returns this round's result.
  const result = stepRound(state, decisions, P);

  // 4) write back to the room doc (server-authoritative)
  room.ocean = { fish: result.fish, density: result.density, catchPerShip: result.catchPerShip };
  slots.forEach((k, i) => {
    const rt = result.teams[i], st = state.teams[i], t = room.teams[k];
    t.cash = rt.cash; t.shipsSea = rt.shipsSea; t.shipsPort = rt.shipsPort; t.bankrupt = rt.bankrupt;
    t.pending = st.pendingShips;                    // delay queue lives on the MUTATED state, not on result
    t.lastDecision = decisions[i];                  // for the straggler default next round
    t.decision = { buy: 0, toSea: 0, sendNewToSea: true, submitted: false };
  });
  room.history.push({
    round: room.round, fish: result.fish, density: result.density, catchPerShip: result.catchPerShip,
    teams: slots.map((k, i) => ({ name: room.teams[k].name, cash: result.teams[i].cash,
      shipsSea: result.teams[i].shipsSea, shipsPort: result.teams[i].shipsPort,
      bankrupt: result.teams[i].bankrupt, roundCatch: result.teams[i].roundCatch })),
    summitActive: !!room.summit?.active, summitRule: room.summit?.rule || null,
  });
  room.round += 1;
  room.phase = room.round > room.maxRounds ? 'debrief' : 'playing';
  return room;   // persist this whole doc back to your realtime store in ONE write
}
```

**Three subtleties the prose hides:**
- **Read the delay queue back from `state`, not `result`.** `stepRound` returns `result.teams[i]` with cash/fleet/bankrupt/roundCatch only — the build-delay queue (`pendingShips`) lives on the **mutated `state.teams[i]`**. Persist it from there or you lose every in-flight ship order.
- **Slot order is load-bearing.** `stepRound` addresses teams by array index *and* the delay queue persists across rounds — so freeze the `slots` ordering at game start and never reshuffle it (a dropped/rejoined player keeps its index).
- **One write, not N.** Resolve the whole round in memory, then write the doc once — so clients never observe a half-stepped room (some teams advanced, others not).

### 2.5 The hidden-state chokepoint (the pedagogy, in code)

The team view is **incapable** of reading `ocean.fish / density / catchPerShip`. It derives "your boats' average" purely from the team's **own** `roundCatch ÷ ownShipsSea ÷ yearsPerRound`. The hidden stock is the whole lesson: players must **infer** the commons from catch-per-ship — exactly as real fisheries do (no one counts the fish; they watch catch-per-vessel).

> **What "incapable" actually requires (don't ship it as a view-only trick).** In a single shared room doc, hiding the ocean in the player UI is *not* enough — a curious player can read the raw doc. To make it real, the realtime store must **enforce** it: either (a) read-rules that deny player clients access to `ocean`, to other teams' `decision`, and to unrevealed `history` fields; or (b) split the doc — a public team-scoped path each phone can read + a **facilitator/spectator-only** path holding `ocean` and the full history, merged only at the debrief reveal. Treat the chokepoint as an **access-control requirement**, not a CSS one.

### 2.6 Joining & rejoining (slot claim)

A phone claims a team slot with a **compare-and-set**, so two players racing for the same team can't both win:

1. Read `teams/<slot>/clientId`. If empty, **atomically** write your own `clientId` (use the store's transaction / CAS primitive — a plain read-then-write races and double-seats a team). If it already holds another `clientId`, the slot is taken; offer the next free one.
2. Persist your `clientId` in `localStorage`. On refresh or reconnect, match it back to your slot and **re-read** the doc — state is server-authoritative (§2.4), so a rejoin needs no extra server state and your array index (§2.4 subtleties) is preserved.
3. **Facilitator and spectator are roles, not slots** — they read the room doc (the facilitator also writes it) but never occupy a `teams` entry, so they don't consume a company.

### 2.7 Act 2 — the summit (negotiated rule)

After the debrief reveal, an optional second act turns the lesson from *demonstrated* into *actionable*: the cohort negotiates one shared rule at a "summit," then **replays under it** to see whether changing the structure beats the tragedy.

- State: `phase: 'act2'`, `summit: { active: true, rule }`.
- `summit.rule` is an **open enum** — the three escapes of §1.7, as data:
  - `{ type:'quota', maxFleetTotal:45 }` — a binding cap on total ships at sea (a *rule*, Meadows #5). **This is the variant already implemented** as `enforceCap()` in `explore.mjs`.
  - `{ type:'tax', perShipPerRound:N }` — a fee that bites where the optimizer lives (#12), shifting the payoff without banning anything.
  - `{ type:'goal', objective:'sustainable_yield' }` — change *what teams are told to maximize* (#3) rather than constraining the move set.
- **How a rule is enforced:** the engine has **no concept** of a summit rule — the round-resolution layer applies it by transforming each decision **before** `stepRound`, via the `applySummit(decisions, state, rule)` hook in §2.4. The `quota` case is `explore.mjs`'s `enforceCap` almost verbatim (cap `buy` and `toSea` so the cohort fleet stays under a sustainable total); `tax`/`goal` are the natural agent-extension exercises.
- **The Ostrom catch (§1.7), in code:** a rule only works because the resolution layer **re-derives and enforces it server-side every round** — not because a team promised. A `summit.rule` that the layer reads but doesn't apply is exactly "a quota nobody monitors": the tragedy with extra steps.

### 2.8 Realtime + hosting + classroom mechanics

- Vanilla HTML/JS + `<canvas>` charts; **a realtime DB** (we used Firebase Realtime Database — any realtime KV/document store works); static hosting (we used fly.io — any works).
- **Kahoot-style join:** a click-to-join link with the room code embedded, pasted into chat (no read-aloud PINs, no lobby-straggler tax).
- **Straggler default:** on round-timer expiry a missing team's input defaults to *repeat last decision*; one frozen phone never stalls the shared ocean.
- **Presenter-pace lock:** the facilitator owns every round reveal; teams can't self-advance or peek ahead.

### 2.9 Build it yourself

The engine in this repo (`fishbanks.js` → `stepRound`) is the **same** one the live game used. Wrap it with any realtime sync layer + the schema in §2.3 and you have the multiplayer game. Hand this spec + `CLAUDE.md` to your agent and ask it to build the sync layer.

---

## Part 3 — Build / extend with your agent

`CLAUDE.md` / `AGENTS.md` give your coding agent the engine context. `MANUAL.md` is the human step-by-step. Then:

- **Warm-up:** "Run `explore.mjs` and explain why buy-2 survives but buy-3 collapses."
- **Add a lever:** "Add a progressive ship tax / a cap-and-trade quota / scarcity pricing — print a before/after (collapse round, cohort cash, min density)."
- **The homework (the real point):** ask your agent to find a fix **by changing the structure** — add a missing balancing loop, change the goal, change the paradigm — **not** by tuning parameters. That is the move an optimizer can't make for you.
- **Re-skin it:** keep the dynamics, rename the variables — groundwater, API rate limits, ad-auction CAC, a shared codebase's tech debt, the open web vs. AI crawlers.

---

## Credits

From the **AI + Systems Thinking** course, Workshop 5 (Fish Banks). Model after Dennis Meadows' classic *Fish Banks, Ltd.*; engine ported from a 2009 Stella model and re-tuned + round-by-round validated. Leverage points: Donella Meadows. Commons governance: Elinor Ostrom.

MIT licensed. Have fun breaking it.
