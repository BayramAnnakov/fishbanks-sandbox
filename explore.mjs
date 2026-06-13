// Fish Banks — headless policy explorer.
//
//   node explore.mjs
//
// Same verified engine the workshop used. Tweak the runs below, add your own
// policies, or hand this whole folder to Claude Code / Codex and ask it to
// extend it (see README.md → "Explore with your agent").

import { fishBanksParams, fbNewState, stepRound } from './fishbanks.js';

const P = fishBanksParams();
const K = P.carryingCapacity;     // 6000 — ocean carrying capacity
const MSY = 8688;                 // analytic max sustainable yield / round

// --- model an ENFORCED quota as: cap each team's ships-at-sea so the cohort
//     total fleet stays around a sustainable ~45 ships ---
const SUSTAIN_FLEET = 45;
const capPerTeam = n => Math.max(2, Math.round(SUSTAIN_FLEET / n));
function enforceCap(dec, t, cap) {
  const pending = (t.pendingShips || []).reduce((a, p) => a + p.count, 0);
  const room = Math.max(0, cap - t.shipsSea);
  return {
    buy: Math.min(dec.buy, Math.max(0, cap - t.shipsSea - pending)),
    toSea: dec.toSea > 0 ? Math.min(dec.toSea, room) : dec.toSea,
    sendNewToSea: true,
  };
}

// --- generic simulator. decision(teamIndex, round, state) -> {buy, toSea, sendNewToSea} ---
//     buy: ships ordered this round (arrive next round). toSea: 99 = send all port ships out.
function simulate({ teams = 3, rounds = 13, decision, enforced = false } = {}) {
  const s = fbNewState(P, teams);
  const cap = capPerTeam(teams);
  const fish = [P.initialFish];
  let collapse = null;
  for (let r = 1; r <= rounds; r++) {
    const decs = s.teams.map((t, i) => {
      if (t.bankrupt) return { buy: 0, toSea: 0 };
      const d = decision(i, r, s);
      return enforced ? enforceCap(d, t, cap) : d;
    });
    const res = stepRound(s, decs, P);
    fish.push(Math.round(res.fish));
    if (collapse == null && res.fish < 300) collapse = r;
  }
  return {
    fish,
    collapse,
    cash: Math.round(s.teams.reduce((a, t) => a + t.cash, 0)),
    minDensity: +(Math.min(...fish) / K).toFixed(2),
    bankrupts: s.teams.filter(t => t.bankrupt).length,
  };
}

const fmt$ = v => (v < 0 ? '-$' : '+$') + Math.abs(v / 1e6).toFixed(1) + 'M';
const verdict = r => (r.collapse ? `COLLAPSE R${r.collapse}` : 'survives');

// ============================================================
// 1) Where is the collapse threshold? (everyone buys B ships/round)
// ============================================================
console.log('\n# Collapse threshold — 3 teams, everyone buys B ships/round');
for (let B = 0; B <= 6; B++) {
  const r = simulate({ teams: 3, decision: () => ({ buy: B, toSea: 99, sendNewToSea: true }) });
  console.log(`  buy ${B}/round  ->  ${verdict(r).padEnd(13)} cash ${fmt$(r.cash)}  minDensity ${r.minDensity}`);
}

// ============================================================
// 2) The real game (workshop room 8305) — and the one-defector test
// ============================================================
// 13 rounds x 3 teams x [buy, toSea, sendNewToSea] — the actual decisions played.
const ACTUAL = [[[1,1,1],[0,1,1],[3,2,1]],[[2,1,1],[2,1,1],[0,0,1]],[[1,1,1],[2,0,1],[0,2,1]],[[1,2,1],[3,2,1],[1,1,1]],[[1,1,1],[3,2,1],[1,0,1]],[[1,1,1],[1,3,1],[2,1,1]],[[2,1,1],[0,3,1],[1,1,1]],[[2,1,1],[2,1,1],[1,2,1]],[[2,2,1],[0,0,1],[1,1,1]],[[2,2,1],[2,2,1],[2,1,1]],[[1,2,1],[0,0,1],[0,1,1]],[[0,2,1],[0,2,1],[0,2,1]],[[0,1,1],[0,0,1],[0,0,1]]];
const play = defectorIdx => (i, r) => {
  if (i === defectorIdx) return { buy: 10, toSea: 99, sendNewToSea: true }; // floors it
  const a = ACTUAL[r - 1][i];
  return { buy: a[0], toSea: a[1], sendNewToSea: !!a[2] };
};
console.log('\n# The real game vs. one defector (others keep their actual moves)');
const real = simulate({ teams: 3, decision: play(-1) });
console.log(`  as actually played   ->  ${verdict(real).padEnd(13)} cash ${fmt$(real.cash)}  minDensity ${real.minDensity}`);
const defect = simulate({ teams: 3, decision: play(0) });
console.log(`  ONE team defects     ->  ${verdict(defect).padEnd(13)} cash ${fmt$(defect.cash)}  bankrupts ${defect.bankrupts}`);

// ============================================================
// 3) Does an enforced quota fix it? (everyone WANTS to overfish)
// ============================================================
console.log('\n# Enforced quota — 4 teams, all want buy 8/round');
for (const mode of ['off', 'on']) {
  const r = simulate({ teams: 4, enforced: mode === 'on', decision: () => ({ buy: 8, toSea: 99, sendNewToSea: true }) });
  console.log(`  enforcement ${mode.padEnd(3)}      ->  ${verdict(r).padEnd(13)} cash ${fmt$(r.cash)}  minDensity ${r.minDensity}`);
}

// ============================================================
// YOUR TURN — great starting prompts for Claude Code / Codex (see README.md):
//   • Add a `price` that rises as fish get scarce; watch collapse SPEED UP.
//   • Add a ship tax, or tradeable quotas (cap-and-trade). Which sustains best?
//   • Replace `decision` with a call to an LLM and let Claude run a company.
//   • Find the exact MSY by sweeping a constant total catch (hint: ~8,688/round).
// ============================================================
console.log('\n(now edit explore.mjs — the "YOUR TURN" block at the bottom — or ask your agent)\n');
