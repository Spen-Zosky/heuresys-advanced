import { describe, it, expect, beforeAll } from "vitest";
import { pool } from "../src/db/client.js";
import { runInsightsRecomputeCli } from "../src/modules/insights/recompute-cli.js";

// Cap③ data-mining — scheduled-recompute CLI (the systemd-timer entrypoint).
// The CLI runs PLATFORM-scoped (all tenants/subjects) via a synthetic system actor,
// recomputing all three insight slices in-process against the live DB. These assertions
// prove (a) it actually scores subjects and (b) the D-18 bound holds: re-running NEVER
// grows the score tables (delete-then-insert keeps exactly one active row per subject).
//
// NB: importing the module does NOT trigger the auto-run/pool.end() block — that fires
// only when process.argv[1] ends with recompute-cli.* (here it's the vitest runner).

const COUNTS = `
  SELECT (SELECT count(*) FROM sys.sys_flight_risk_scores)          AS flight,
         (SELECT count(*) FROM sys.sys_succession_readiness_scores) AS succ,
         (SELECT count(*) FROM sys.sys_skill_gap_scores)            AS gap`;

async function counts(): Promise<{ flight: number; succ: number; gap: number }> {
  const { rows } = await pool.query<{ flight: string; succ: string; gap: string }>(COUNTS);
  return { flight: Number(rows[0]!.flight), succ: Number(rows[0]!.succ), gap: Number(rows[0]!.gap) };
}

let first: Awaited<ReturnType<typeof runInsightsRecomputeCli>>;
let afterFirst: { flight: number; succ: number; gap: number };

describe("insights-recompute CLI (cap③ scheduled recompute)", () => {
  beforeAll(async () => {
    first = await runInsightsRecomputeCli();
    afterFirst = await counts();
  });

  it("scores subjects in all three slices (PLATFORM scope)", () => {
    expect(first.flightRisk).toBeGreaterThan(0);
    expect(first.successionReadiness).toBeGreaterThan(0);
    expect(first.skillGap).toBeGreaterThan(0);
  });

  it("stores exactly one active row per scored subject (no orphan growth)", () => {
    // PLATFORM recompute covers every subject → the returned `scored` count equals the
    // live row count for the single-row-per-subject tables (flight-risk, skill-gap).
    expect(afterFirst.flight).toBe(first.flightRisk);
    expect(afterFirst.gap).toBe(first.skillGap);
    // succession-readiness is top-N rows per subject → at least `scored`, and bounded.
    expect(afterFirst.succ).toBeGreaterThanOrEqual(first.successionReadiness);
  });

  it("is idempotent — a second run keeps the score tables bounded (D-18)", async () => {
    const second = await runInsightsRecomputeCli();
    const afterSecond = await counts();
    expect(second.flightRisk).toBe(first.flightRisk);
    expect(second.successionReadiness).toBe(first.successionReadiness);
    expect(second.skillGap).toBe(first.skillGap);
    expect(afterSecond).toEqual(afterFirst); // no monotonic growth across runs
  });
});
