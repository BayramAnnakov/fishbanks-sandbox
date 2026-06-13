# Fish Banks — agent context

This is a **tragedy-of-the-commons simulation** from an AI + Systems Thinking course. A user (a course participant) will ask you to help them play with it, understand it, or extend it. This file is your map. (Codex: same content lives in `AGENTS.md`.)

## What's here
- `fishbanks.js` — the **engine**. Pure ES module, no dependencies, no I/O. The source of truth.
- `index.html` — a browser sandbox UI (sliders, presets, canvas charts). **Self-contained**: it carries its *own inlined copy* of the engine + chart code, so it runs from `file://` on a double-click (no server, no module loading). It does **not** import `fishbanks.js` / `draw.js` at runtime — those are kept as the standalone source for Node + your agent. (Consequence: editing `fishbanks.js` changes `explore.mjs` and Node, **not** the UI. To change the UI, edit the inline block in `index.html` too — or re-externalize the imports.)
- `explore.mjs` — a headless Node script that runs policy experiments and prints results. **This is the best place to add new experiments.**
- `draw.js` — minimal canvas helpers — the standalone source the UI's inline charts were copied from (the shipped `index.html` carries its own inline copy; `draw.js` is for Node/agent reference).

## Engine API (fishbanks.js)
```js
fishBanksParams() -> P            // tuned constants object (see below)
fbNewState(P, nTeams) -> state    // { fish, teams:[ {cash, shipsPort, shipsSea, pendingShips:[], bankrupt} ] }
stepRound(state, decisions, P) -> result   // MUTATES state; advances 1 round (= 3 simulated years)
fbInterp(table, x)                // linear interp on a 0..1 step-0.1 lookup table
fbForceCollapseDecisions(state)   // returns max-greed decisions for every team
```
- **decisions**: array parallel to `state.teams`, each `{ buy, toSea, sendNewToSea }`.
  - `buy` (0–10): ships ordered this round. Cost $25k each, deducted now, but **delivered NEXT round** (`buildDelay:1`). This lag is what causes overshoot — keep it.
  - `toSea`: net move port→sea this round. `99` ≈ "send all port ships out". Negative pulls ships back to port.
  - `sendNewToSea`: whether newly-delivered ships go straight to sea.
- **result** (and post-call `state`): `result.fish`, `result.catchPerShip`, `result.teams[i].roundCatch`; `state.teams[i].cash / shipsSea / shipsPort / bankrupt`. A team goes bankrupt when cash < 0 (fleet recalled to idle port).

## Tuned constants (P) — do NOT change silently
`carryingCapacity 6000`, `initialFish 4800` (density 0.80), `shipCost 25000`, `seaCost 25000/yr`, `portCost 7000/yr`, `fishPrice 1000/t`, `startCash 250000`, `buildDelay 1`, `yearsPerRound 3`, `maxShipCatch 50`, start `2 sea + 2 port`. Two lookup tables drive the biology: `birthCoefTable` (recruitment vs density, peaks ~0.70) and `catchPerShipTable` (catch vs density). These are **pedagogically tuned and round-by-round validated** — if a task needs different dynamics, add a *new* parameter or a wrapper, don't edit these in place unless the user explicitly asks.

## Verified facts (cite these instead of re-deriving)
- MSY ≈ **8,688 t/round** at density 0.70. Commons cliff ≈ **75 ships at sea**. Sea ship breaks even at **25 t/yr**.
- Collapse thresholds: **3 teams** collapse at buy ≥ 3/team (buy-2 survives); **4 teams** at buy ≥ 3–4. No hard extinction floor — the stock recovers if fishing stops.
- The workshop cohort (3 teams, room 8305) **survived** because they averaged ~1.1 buy/team/round — below threshold. A **single defector at buy-5+ collapses the shared ocean** for everyone. That's the centerpiece insight.

## How to run
- Headless experiments: `node explore.mjs` (Node 18+, no install).
- UI: serve the folder (`python3 -m http.server 8080` or `npx serve`) and open it — ES modules won't load from `file://`.

## Adding a policy (the clean pattern)
Most extensions are either (a) a new `decision(teamIndex, round, state)` strategy, or (b) a tweak inside the per-year loop of `stepRound` (e.g. a scarcity price, a tax, a quota cap). Prefer composing in `explore.mjs` (wrap `simulate`) over forking the engine. When you change biology or economics, **always print a before/after** (collapse round, cohort cash, min density) so the user sees the effect — never silently alter behavior.

## Good extension directions (if the user wants ideas)
Supply-demand pricing (scarcer → pricier → faster collapse), ship tax, cap-and-trade quotas, subsidy (guarantees collapse), an **LLM-as-fishing-company** loop (give it only what a real player sees), and the key one: keep the LLM's *capability* fixed and change only its *goal* from "max my cash" to "max 50-yr catch without collapse" — that's the systems-thinking punchline.
