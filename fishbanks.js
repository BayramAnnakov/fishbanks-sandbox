// ===== Fish Banks (W5) — validated simulation engine =====
// Tragedy-of-the-commons multiplayer game model. Ported from Bayram's 2009 Stella
// model (rybolovstvo.stmx) and TUNED + Bash-validated (Node v22) by the W5 design
// workflow for a clean, pedagogically legible overshoot-and-collapse.
//
// Validation summary (see workshop5-design-brief.md §D):
//   - 4 teams, ~40%/round greedy growth -> COLLAPSE at round 7, all bankrupt.
//   - catch-per-ship erodes ~17% by rounds 3-5, BEFORE the stock visibly crashes
//     (the early-warning beat).
//   - sustainable quota (max total-allowable-catch w/o collapse) ~7,400 t/round.
//   - single-company cash-maximizer: 4-5x mid-game, then bankrupt at R12.
//
// One ROUND = params.yearsPerRound (3) simulated years, decision held constant.

export function fishBanksParams() {
  return {
    carryingCapacity: 6000, initialFish: 4800,
    shipCost: 25000, portCost: 7000, seaCost: 25000, fishPrice: 1000,
    startCash: 250000, buildDelay: 1, yearsPerRound: 3, maxShipCatch: 50,
    startShipsPort: 2, startShipsSea: 2,
    recommendedTeams: 4, recommendedRounds: 8,
    // Both tables are 0..1 density lookups (step 0.1), linearly interpolated.
    birthCoefTable:    [0, 0.0476, 0.335, 0.866, 0.89, 0.884, 0.793, 0.689, 0.098, 0.055, 0.018],
    catchPerShipTable: [2, 7, 12, 18, 25, 31, 37, 42, 46, 49, 50],
  };
}

// Linear interpolation over a 0..1 (step 0.1) lookup table.
export function fbInterp(table, x) {
  if (x <= 0) return table[0];
  if (x >= 1) return table[table.length - 1];
  const pos = x * 10, i = Math.floor(pos), f = pos - i;
  return table[i] + (table[i + 1] - table[i]) * f;
}

// Factory: a fresh team at game start.
export function fbNewTeam(params) {
  return {
    cash: params.startCash, shipsPort: params.startShipsPort,
    shipsSea: params.startShipsSea, pendingShips: [], bankrupt: false,
  };
}

// Factory: a fresh shared-ocean game state for N teams.
export function fbNewState(params, nTeams) {
  const teams = [];
  for (let i = 0; i < nTeams; i++) teams.push(fbNewTeam(params));
  return { fish: params.initialFish, teams };
}

// Advance one ROUND (yearsPerRound years) of the shared ocean.
//   state:     { fish, teams:[ { cash, shipsPort, shipsSea, pendingShips:[{count,ready}], bankrupt } ] }
//   decisions: [ { buy:0..10, toSea:Number(>0 port->sea, <0 sea->port), sendNewToSea:Bool }, ... ]  parallel to state.teams
//   params:    fishBanksParams()
// Returns { fish, density, catchPerShip, teams:[{cash, shipsSea, shipsPort, bankrupt, roundCatch, roundRevenue}] }
// Mutates state in place. roundCatch/roundRevenue summed over the 3 simulated years.
export function stepRound(state, decisions, params) {
  const P = params, K = P.carryingCapacity, n = state.teams.length;
  let i, k, b, c, y;

  // 1) Deliver ships ordered buildDelay rounds ago, then apply this round's buy + redeploy.
  for (i = 0; i < n; i++) {
    const t = state.teams[i], d = decisions[i] || {};
    if (t.bankrupt) continue;
    const keep = [];
    let delivered = 0;
    for (k = 0; k < t.pendingShips.length; k++) {
      const p = t.pendingShips[k]; p.ready -= 1;
      if (p.ready <= 0) delivered += p.count; else keep.push(p);
    }
    t.pendingShips = keep;
    if (delivered > 0) { if (d.sendNewToSea) t.shipsSea += delivered; else t.shipsPort += delivered; }
    const buy = Math.max(0, Math.min(10, d.buy || 0));
    if (buy > 0) { t.cash -= buy * P.shipCost; t.pendingShips.push({ count: buy, ready: P.buildDelay }); }
    const toSea = d.toSea || 0;
    if (toSea > 0) { const m = Math.min(toSea, t.shipsPort); t.shipsPort -= m; t.shipsSea += m; }
    else if (toSea < 0) { const m2 = Math.min(-toSea, t.shipsSea); t.shipsSea -= m2; t.shipsPort += m2; }
  }

  // 2) Simulate yearsPerRound years with the decision held constant.
  const roundCatch = new Array(n).fill(0), roundRevenue = new Array(n).fill(0);
  let density = 0, cps = 0;
  for (y = 0; y < P.yearsPerRound; y++) {
    density = state.fish / K;
    cps = Math.min(fbInterp(P.catchPerShipTable, density), P.maxShipCatch);
    let totalSea = 0;
    for (b = 0; b < n; b++) totalSea += state.teams[b].bankrupt ? 0 : state.teams[b].shipsSea;
    const birth = state.fish * fbInterp(P.birthCoefTable, density);
    let totalCatch = totalSea * cps;
    if (totalCatch > state.fish + birth) totalCatch = state.fish + birth; // can't catch more than exists
    state.fish = Math.max(0, state.fish + birth - totalCatch);
    for (c = 0; c < n; c++) {
      const tc = state.teams[c];
      if (tc.bankrupt) continue;
      const yearCatch = (totalSea > 0 && tc.shipsSea > 0) ? totalCatch * (tc.shipsSea / totalSea) : 0;
      const yearRev = yearCatch * P.fishPrice;
      const costs = tc.shipsPort * P.portCost + tc.shipsSea * P.seaCost;
      tc.cash += yearRev - costs;
      roundCatch[c] += yearCatch; roundRevenue[c] += yearRev;
      if (tc.cash < 0) { tc.bankrupt = true; tc.shipsPort += tc.shipsSea; tc.shipsSea = 0; } // recall fleet to idle port
    }
  }

  density = state.fish / K;
  cps = Math.min(fbInterp(P.catchPerShipTable, density), P.maxShipCatch);
  return {
    fish: state.fish, density, catchPerShip: cps,
    teams: state.teams.map((t, idx) => ({
      cash: t.cash, shipsSea: t.shipsSea, shipsPort: t.shipsPort, bankrupt: t.bankrupt,
      roundCatch: roundCatch[idx], roundRevenue: roundRevenue[idx],
    })),
  };
}

// Force-collapse lever (facilitator insurance): apply an aggressive buy+deploy for all
// live teams so the stock is guaranteed onto the cliff by the act-clock mark.
export function fbForceCollapseDecisions(state) {
  return state.teams.map(t => t.bankrupt ? { buy: 0, toSea: 0 } : { buy: 10, toSea: 99, sendNewToSea: true });
}
