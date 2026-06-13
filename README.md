# 🐟 Fish Banks — Policy Sandbox

The simulation you played in the workshop, packaged so you can **play with it and break it open with your AI coding agent**. Same verified engine, no login, runs fully offline.

It's a tragedy-of-the-commons model: each fishing company chases cash; collectively they can overfish a shared ocean to collapse. The lesson isn't "be nice" — it's that the *structure* (a shared stock + a build delay + a "maximize my cash" goal) drives the collapse, and only the right **rule** prevents it.

> Want the detailed step-by-step (running locally, reading the charts, troubleshooting, extending)? See **[`MANUAL.md`](./MANUAL.md)**.
>
> Want the full **model + multiplayer-architecture spec** (parameters, equations, the Meadows leverage map, the 3 escapes, and how the live classroom game is built)? See **[`FISHBANKS-SPEC.md`](./FISHBANKS-SPEC.md)**.

> **Your cohort never collapsed it** (room 8305: ocean survived, +$23.6M). But that was *low fishing pressure + luck*, not safety. You averaged ~1 ship bought/team/round — below the threshold. **If any one team had floored it to buy-5, the shared ocean dies and everyone goes bankrupt.** Your restraint was only as good as the least restrained player. This package lets you prove that to yourself in 10 seconds.

---

## Play it now (no setup)

Hosted: **https://prediction-gallery.fly.dev/fishbanks-sandbox.html**
Hit the **▶ Your cohort** preset, then flip **😈 …now one of you defects**.

## Run it locally

**Just open `index.html`** — double-click it (or drag it into a browser tab). It's fully self-contained, so it works straight from your disk with no server and no install.

## Explore headless (the fun part)

```bash
node explore.mjs
```

Prints the collapse threshold, your real game vs. one defector, and the enforced-quota cure — straight from the engine. Then go edit it.

---

## The model in 30 seconds

Three functions, all pure, in [`fishbanks.js`](./fishbanks.js):

```js
import { fishBanksParams, fbNewState, stepRound } from './fishbanks.js';

const P = fishBanksParams();        // tuned constants (K=6000, costs, regen curve)
let state = fbNewState(P, 4);       // 4 teams, 4800 fish to start
// one round = 3 simulated years; a decision per team:
const decisions = state.teams.map(() => ({ buy: 5, toSea: 99, sendNewToSea: true }));
const result = stepRound(state, decisions, P);   // mutates `state`, returns this round's outcome
// result.fish, result.catchPerShip, result.teams[i].roundCatch
// state.fish, state.teams[i].cash / shipsSea / shipsPort / bankrupt
```

A **decision** is `{ buy, toSea, sendNewToSea }`:
- `buy` — ships ordered this round (they cost $25k and **arrive next round** — the build delay that causes overshoot).
- `toSea` — move ships from port to sea (`99` = send them all). Ships at sea earn; ships in port idle cheaply.

Key numbers (engine-verified): carrying capacity **6,000**, max sustainable yield **~8,688/round** (regen peaks at 70% density), the commons cliff is **~75 ships at sea**, a sea ship breaks even at **25 t/yr**. With 3 teams it collapses at **buy ≥ 3/team**; with 4 teams at **buy ≥ 3–4**.

---

## Explore with your agent (Claude Code / Codex)

This folder ships a `CLAUDE.md` / `AGENTS.md` so your agent already knows the engine. Open the folder in Claude Code or Codex and try:

**Warm-ups**
- "Run `explore.mjs` and explain why buy-2 survives but buy-3 collapses."
- "Find the exact MSY by sweeping a constant total catch per round."
- "Plot the fish stock for buy-4 as ASCII in the terminal."

**Add a policy lever**
- "Add **supply-demand pricing**: make fish sell for more as they get scarcer. Does collapse happen sooner or later? Why?" *(it speeds up — scarcity rewards fishing harder)*
- "Add a **ship tax** and a **cap-and-trade quota**. Which one sustains the fishery with the least lost profit?"
- "Add a **subsidy** on ship purchases and show it *guarantees* collapse."

**Make it agentic**
- "Replace the `decision` function with a call to an LLM — let Claude play one fishing company each round, given only what a real player sees (its own cash + catch, not the stock). Watch it strip-mine the ocean."
- "Now change *only the goal* you give the LLM from 'maximize my cash' to 'maximize total catch over 50 years without collapse.' Does it self-restrain? This is the whole point: the optimizer obeys the goal, not your intent."

**Make it yours**
- "Re-skin this as **[your domain]** — groundwater / API rate limits / ad-auction CAC / shared codebase tech-debt. Keep the same dynamics, rename the variables."

---

## Files

| File | What |
|---|---|
| `index.html` | the sandbox UI (sliders, presets, live charts) |
| `fishbanks.js` | the simulation engine — pure functions, the source of truth |
| `draw.js` | tiny canvas chart helpers (used by `index.html` only) |
| `explore.mjs` | headless policy explorer + your starting point for extensions |
| `MANUAL.md` | full step-by-step instruction manual (run, read, extend, troubleshoot) |
| `CLAUDE.md` / `AGENTS.md` | context for your AI coding agent |

From the **AI + Systems Thinking** course, Workshop 5 (Fish Banks). Model ported & tuned from Dennis Meadows' classic; engine validated round-by-round. Have fun breaking it.
