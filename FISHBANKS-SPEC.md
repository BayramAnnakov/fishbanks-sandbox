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

### 2.5 The hidden-state chokepoint (the pedagogy, in code)

The team view is **physically incapable** of reading `ocean.fish / density / catchPerShip`. It derives "your boats' average" purely from the team's **own** `roundCatch ÷ ownShipsSea ÷ yearsPerRound`. The hidden stock is the whole lesson: players must **infer** the commons from catch-per-ship — exactly as real fisheries do (no one counts the fish; they watch catch-per-vessel).

### 2.6 Realtime + hosting + classroom mechanics

- Vanilla HTML/JS + `<canvas>` charts; **a realtime DB** (we used Firebase Realtime Database — any realtime KV/document store works); static hosting (we used fly.io — any works).
- **Kahoot-style join:** a click-to-join link with the room code embedded, pasted into chat (no read-aloud PINs, no lobby-straggler tax).
- **Straggler default:** on round-timer expiry a missing team's input defaults to *repeat last decision*; one frozen phone never stalls the shared ocean.
- **Presenter-pace lock:** the facilitator owns every round reveal; teams can't self-advance or peek ahead.

### 2.7 Build it yourself

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
