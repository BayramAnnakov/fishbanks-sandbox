# Fish Banks Policy Sandbox — Instruction Manual

A complete, step-by-step guide to running, reading, and extending the Fish Banks model. If you just want to click around, the hosted link in `README.md` is enough — this manual is for running it locally and hacking on it with your AI coding agent.

---

## 1. What this is

A small, self-contained simulation of the **tragedy of the commons**: several fishing companies share one ocean; each rationally maximizes its own cash; together they can overfish the stock to collapse. It's the exact engine from Workshop 5 — *verified round-by-round against the live game*.

You can use it three ways:
1. **Play** the UI (sliders + presets + live charts) — fastest way to build intuition.
2. **Run experiments headless** with `explore.mjs` — for precise policy sweeps.
3. **Extend it** with Claude Code / Codex — add policies, wire an LLM player, re-skin to your domain.

---

## 2. Requirements

- **Node.js 18+** (for `explore.mjs` and to extend the engine). Check: `node --version`.
- **A modern browser** (for the UI).
- **Python 3** *or* `npx` (only to serve the UI locally — see §4). Most Macs already have Python 3.
- No `npm install`, no API keys, no internet (except if you choose `npx serve`).

---

## 3. Files

| File | Purpose | You edit it? |
|---|---|---|
| `index.html` | The sandbox UI (sliders, presets, charts) | rarely |
| `fishbanks.js` | **The engine** — pure simulation functions. Source of truth. | carefully (§7) |
| `FISHBANKS-SPEC.md` | Full model + multiplayer-architecture spec | — |
| `explore.mjs` | Headless policy explorer — **your main playground** | yes |
| `package.json` | `npm start` / `npm run explore` shortcuts | no |
| `README.md` | Quickstart + challenge list | — |
| `MANUAL.md` | This file | — |
| `CLAUDE.md` / `AGENTS.md` | Context for your AI agent | no |

---

## 4. Running the UI

**Just open `index.html`.** Double-click it, or drag it into a browser tab. The engine and charts are inlined, so it's a single self-contained page — it runs straight from your disk (`file://`), no server, no install.

*(Optional)* If you want to serve it over http instead — e.g. you edited `index.html` to import the external `fishbanks.js` again — run a local server from this folder: `python3 -m http.server 8080` (or `npx serve`) and open the printed URL. `npm start` does this. Note: the headless explorer (`explore.mjs`, §6) does still need Node.

---

## 5. Using the sandbox UI

**Controls (top panel):**
- **Fishing companies** (2–6) — how many teams share the ocean.
- **Aggression** (0–10) — ships each company buys per round. This is the single biggest lever.
- **One company defects** — one team floors it to buy-10 regardless of the rest. *The key toggle.*
- **Enforced quota** — caps the total fleet at a sustainable size and makes it binding.

**Presets:**
- **▶ Your cohort (room 8305)** — replays the workshop's *real* decisions. Ocean survives.
- **😈 …now one of you defects** — same cohort, one defector → ocean dies, bankruptcies.
- **🔥 Everyone floors it** — overshoot and collapse.
- **🛡 Enforced quota** — everyone wants to overfish, but the rule keeps it alive *and richer*.

**Reading the three charts:**
- **Fish stock (cyan)** — the ocean. Flat-ish = healthy; a cliff to zero = collapse (marked `OCEAN DEAD · Rn`). Turns **red** when it collapses.
- **Catch per ship (orange)** — the *leading indicator*. It sags **before** the stock visibly crashes — the early warning a real fishery actually sees.
- **Total cohort cash (green/red)** — everyone's money combined. Watch it go negative in collapse runs.

**The verdict bar** summarizes: survived/collapsed, cohort cash, minimum density reached, peak fleet vs the ~75-ship cliff, and bankruptcies.

**A good first experiment:** load *Your cohort* (survives, +$23.6M) → flip *one company defects* → watch the same cautious cohort collapse. That's the tragedy of the commons in two clicks: your restraint is only as good as the least restrained player.

---

## 6. Running experiments headless

```bash
node explore.mjs
```

It prints three blocks, all straight from the engine:
1. **Collapse threshold** — sweeps buy 0→6 for 3 teams (buy-2 survives, buy-3 collapses).
2. **Real game vs. one defector** — the workshop's actual decisions, then with one defector.
3. **Enforced quota** — 4 greedy teams, enforcement off vs on.

To run your own experiment, open `explore.mjs` and edit the calls to `simulate(...)`. A `decision(teamIndex, round, state)` function returns `{ buy, toSea, sendNewToSea }` for each team each round. The `YOUR TURN` comment block at the bottom lists starter ideas.

---

## 7. How the model works

Three pure functions in `fishbanks.js`:

```js
import { fishBanksParams, fbNewState, stepRound } from './fishbanks.js';

const P = fishBanksParams();          // tuned constants
let state = fbNewState(P, 4);         // 4 teams, 4800 fish to start
const decisions = state.teams.map(() => ({ buy: 5, toSea: 99, sendNewToSea: true }));
const result = stepRound(state, decisions, P);   // advance 1 round (= 3 years); MUTATES state
```

**A decision** `{ buy, toSea, sendNewToSea }`:
- `buy` (0–10): ships ordered this round. Paid now, but **delivered next round** (`buildDelay: 1`) — this lag causes overshoot. Keep it.
- `toSea`: net ships moved port→sea this round (`99` ≈ "send everything"; negative pulls back to port).
- `sendNewToSea`: whether newly-delivered ships go straight to sea.

**After `stepRound`:** read `result.fish`, `result.catchPerShip`, `result.teams[i].roundCatch`; and on the mutated `state`: `state.teams[i].cash / shipsSea / shipsPort / bankrupt`. A team goes bankrupt when cash < 0.

**Tuned constants** (in `P`): `carryingCapacity 6000`, `initialFish 4800`, `shipCost 25000`, `seaCost 25000/yr`, `portCost 7000/yr`, `fishPrice 1000/t`, `startCash 250000`, `buildDelay 1`, `yearsPerRound 3`, `maxShipCatch 50`, start `2 sea + 2 port`. Two lookup tables drive the biology (`birthCoefTable`, `catchPerShipTable`). **These are pedagogically tuned — don't edit them in place unless you mean to change the dynamics. Add a new parameter or wrap the function instead.**

**Verified facts** (cite, don't re-derive):
- Max sustainable yield ≈ **8,688 t/round** at ~70% density. Commons cliff ≈ **75 ships at sea**. A sea ship breaks even at **25 t/yr**.
- Collapse: **3 teams** at buy ≥ 3/team (buy-2 survives); **4 teams** at buy ≥ 3–4. No hard extinction floor — the stock recovers if fishing stops.
- The workshop cohort survived because it averaged ~1.1 buy/team/round; a single defector at buy-5+ collapses it for everyone.

---

## 8. Extending it with Claude Code / Codex

This folder ships `CLAUDE.md` (Claude Code) and `AGENTS.md` (Codex) so your agent already knows the API and the guardrails. Open the folder in your agent and go.

**Recommended workflow**
1. Ask the agent to run `node explore.mjs` and explain the output.
2. Describe the policy you want to add in plain language.
3. Have it implement the change *as a new option in `explore.mjs`* (compose, don't fork the engine) and **print a before/after** (collapse round, cohort cash, min density). Never accept a change with no measured effect.

**Prompt recipes (copy/paste)**
- *"Add supply-demand pricing: fish sell for more as they get scarcer. Re-run the threshold sweep and tell me whether collapse happens sooner or later, and why."*
- *"Add a progressive tax on ships (each extra ship costs more). Find the tax level that keeps the fishery alive with the least lost profit."*
- *"Add a cap-and-trade quota and compare it to the flat enforced quota already in `explore.mjs`."*
- *"Replace the `decision` function for one team with a call to an LLM. Give it ONLY what a real player sees (its own cash and catch, not the stock). Run 13 rounds and show what it does."*
- *"Now change only the LLM's goal from 'maximize my cash' to 'maximize total catch over 50 years without collapse.' Does it self-restrain? Summarize the difference."* ← this is the systems-thinking punchline.
- *"Re-skin the whole thing as [groundwater / API rate limits / ad-auction CAC / shared codebase]. Keep the dynamics; rename the variables; update the UI labels."*

---

## 9. Troubleshooting / FAQ

| Symptom | Fix |
|---|---|
| **Blank page / nothing renders** | Hard-refresh (Cmd/Ctrl-Shift-R). `index.html` is self-contained and works on double-click; if you re-added external imports, serve it over http (§4). |
| **`node: command not found`** | Install Node 18+ (nodejs.org or `brew install node`). |
| **Charts look squished on mobile** | The UI is responsive but designed for a laptop; rotate or widen the window. |
| **I changed `fishbanks.js` and numbers look wrong** | You likely edited a tuned constant/table. Revert and add a *new* parameter instead (§7). |
| **Edited `fishbanks.js` but the UI didn't change** | Expected — the UI runs its **own inlined copy** of the engine (§4). Mirror your change into the inline block at the top of `index.html`, or re-externalize the import. |

---

## 10. Glossary

- **Commons** — a shared resource no single actor owns (the ocean, a talent pool, an ad auction, a codebase).
- **Overshoot** — growing past what the system can sustain because feedback arrives late (the 3-year build delay here).
- **Catch per ship** — total catch ÷ ships at sea; the leading indicator of the hidden stock.
- **MSY** — Maximum Sustainable Yield; the most you can harvest indefinitely (~8,688 t/round).
- **Density** — fish ÷ carrying capacity; regeneration peaks around 70%.
- **Leverage points (Meadows)** — places to intervene; tuning a number (#12) is weakest, changing the rule/goal/paradigm (#5/#3/#2) is strongest. An optimizer lives at #12.

---

From the **AI + Systems Thinking** course, Workshop 5 (Fish Banks). Model ported and tuned from Dennis Meadows' classic; engine validated against the live game. Break it, extend it, make it yours.
