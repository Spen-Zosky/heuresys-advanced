/**
 * apps/api/test/essential-capability.integration.test.ts
 *
 * #55 F/F1 — Essential Capability Ranker: GET /v1/capability/composition/essential-ranking.
 *
 * Ranks the skills the organization depends on by investment priority, to answer the CFO
 * question "where do I put L&D budget?". Every score is a declared blend of drillable
 * components (economic value, criticality, scarcity, maturity) — this suite pins both the
 * contract (RBAC, shape, ordering) AND the formula (the reported score must equal the blend
 * of its own components), so the ranker can never silently drift from its stated math.
 *
 * Input note: this ranker only became meaningful once #46 D1 imported per-employee skill
 * possession — the scarcity/maturity components read sys_user_skills. The batch fed itself.
 *
 * Live data, real personas; nothing about the ranking is hardcoded.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { ESSENTIAL_CAPABILITY_WEIGHTS as W } from "@heuresys/shared";

const PWD = TEST_PERSONA_PASSWORD;
interface S { cookies: Map<string, string> }
const ch = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies };
}

interface Item {
  skillId: string; skillCode: string; skillName: string;
  positionsRequiring: number; criticalPositions: number;
  econ: number; crit: number; scarcity: number; maturity: number; holders: number;
  essentialityScore: number; investmentPriority: number;
}
interface Ranking { items: Item[]; total: number; weights: { econ: number; crit: number; scarcity: number } }

let suite: TestApp;
let tenantAdmin: S; // federica.marchetti — capability:read
let plainUser: S; // tommaso.fiore — no capability:read

async function ranking(s: S) {
  return suite.app.inject({
    method: "GET", url: "/v1/capability/composition/essential-ranking", headers: { cookie: ch(s.cookies) },
  });
}

describe("#55 F1 — Essential Capability Ranker", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    tenantAdmin = await login(suite, "federica.marchetti@rtl-bank.org");
    plainUser = await login(suite, "tommaso.fiore@rtl-bank.org");
  }, 60_000);

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("RBAC: a plain USER without capability:read is denied", async () => {
    expect((await ranking(plainUser)).statusCode).toBe(403);
  });

  it("returns a non-empty ranking with the declared weights", async () => {
    const r = await ranking(tenantAdmin);
    expect(r.statusCode).toBe(200);
    const b = r.json() as Ranking;
    expect(b.total).toBe(b.items.length);
    expect(b.items.length).toBeGreaterThan(0);
    expect(b.weights).toEqual({ econ: W.econ, crit: W.crit, scarcity: W.scarcity });
  });

  it("every component is in range and every skill is real", async () => {
    const b = (await ranking(tenantAdmin)).json() as Ranking;
    for (const it of b.items) {
      for (const c of [it.econ, it.crit, it.scarcity, it.maturity] as const) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
      }
      expect(it.essentialityScore).toBeGreaterThanOrEqual(0);
      expect(it.essentialityScore).toBeLessThanOrEqual(100);
      expect(it.investmentPriority).toBeGreaterThanOrEqual(0);
      expect(it.investmentPriority).toBeLessThanOrEqual(100);
      expect(it.skillCode.length).toBeGreaterThan(0);
      expect(it.positionsRequiring).toBeGreaterThan(0); // only required skills are ranked
    }
  });

  it("the reported score EQUALS the declared blend of its own components (no black box)", async () => {
    const b = (await ranking(tenantAdmin)).json() as Ranking;
    for (const it of b.items) {
      const essentiality = W.econ * it.econ + W.crit * it.crit + W.scarcity * it.scarcity;
      expect(it.essentialityScore).toBeCloseTo(essentiality * 100, 1);
      expect(it.investmentPriority).toBeCloseTo(essentiality * (1 - it.maturity) * 100, 1);
    }
  });

  it("is ordered by investment priority, highest first", async () => {
    const pr = ((await ranking(tenantAdmin)).json() as Ranking).items.map((i) => i.investmentPriority);
    expect(pr).toEqual([...pr].sort((a, b) => b - a));
  });

  // D-81: maturity used to be normalised by the literal 5 while the proficiency scale
  // reaches 6, and `service.ts` already divided the same quantity by 6 for the VRIO depth.
  // Both sides of this assertion are read from the live DB — nothing about the scale, the
  // holdings or the expected value is written here (regola no-hardcoded-test-data).
  it("maturity is normalised by the proficiency SCALE, not by the highest rank observed", async () => {
    const scale = await pool.query<{ scale_max: string; observed_max: string }>(
      `SELECT (SELECT max(skill_proficiency_level_rank) FROM sys.sys_skill_proficiency_levels)::text AS scale_max,
              (SELECT max(pl.skill_proficiency_level_rank)
                 FROM sys.sys_user_skills us
                 JOIN sys.sys_skill_proficiency_levels pl
                   ON pl.skill_proficiency_level_code = us.user_skill_proficiency)::text AS observed_max`,
    );
    const scaleMax = Number(scale.rows[0]?.scale_max);
    const observedMax = Number(scale.rows[0]?.observed_max);
    expect(scaleMax).toBeGreaterThan(0);

    const held = await pool.query<{ skill_id: string; avg_rank: string }>(
      `SELECT us.user_skill_skill_id AS skill_id, avg(pl.skill_proficiency_level_rank)::text AS avg_rank
         FROM sys.sys_user_skills us
         LEFT JOIN sys.sys_skill_proficiency_levels pl
                ON pl.skill_proficiency_level_code = us.user_skill_proficiency
        GROUP BY us.user_skill_skill_id`,
    );
    const avgBySkill = new Map(held.rows.map((r) => [r.skill_id, Number(r.avg_rank)]));

    const b = (await ranking(tenantAdmin)).json() as Ranking;
    let checked = 0;
    for (const it of b.items) {
      const avg = avgBySkill.get(it.skillId);
      if (avg === undefined || Number.isNaN(avg)) continue; // skill with no holders → maturity 0
      expect(it.maturity).toBeCloseTo(Math.min(1, avg / scaleMax), 4);
      checked++;
    }
    expect(checked).toBeGreaterThan(0); // an empty loop would assert nothing

    // The half that makes this falsifiable: while the scale is wider than what the data
    // uses, dividing by the observed maximum gives a DIFFERENT number — so this suite goes
    // red if the old literal comes back. If one day a MASTER is recorded the two collapse
    // into one and the guard below stands down on its own, by design.
    if (observedMax > 0 && observedMax !== scaleMax) {
      const withHolders = b.items.filter((i) => {
        const a = avgBySkill.get(i.skillId);
        return a !== undefined && !Number.isNaN(a) && a > 0;
      });
      expect(withHolders.length).toBeGreaterThan(0);
      for (const it of withHolders) {
        const avg = avgBySkill.get(it.skillId) as number;
        expect(it.maturity).not.toBeCloseTo(Math.min(1, avg / observedMax), 4);
      }
    }
  });

  it("is deterministic: two calls give the same ordered scores", async () => {
    const a = ((await ranking(tenantAdmin)).json() as Ranking).items.map((i) => `${i.skillId}:${i.investmentPriority}`);
    const b = ((await ranking(tenantAdmin)).json() as Ranking).items.map((i) => `${i.skillId}:${i.investmentPriority}`);
    expect(a).toEqual(b);
  });
});
