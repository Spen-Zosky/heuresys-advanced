/**
 * apps/api/test/vrio-scorecard.integration.test.ts
 *
 * #56 F/F2 — VRIO scorecard: GET /v1/capability/composition/vrio.
 *
 * Classifies each capability (skill group) the organization actually uses into Barney's
 * lattice: Valuable / Rare / costly to Imitate / Organized to exploit. A scorecard that
 * merely *looks* plausible is worse than none — a board would act on it — so this suite
 * pins three things that a drifting implementation cannot all satisfy at once:
 *   1. every dimension is RECOMPUTABLE by hand from the evidence shipped in the same row;
 *   2. the verdict is the lattice read over the declared thresholds, never an average;
 *   3. the CONTROL CASE holds — a capability nobody holds cannot come out as an advantage.
 *
 * Nothing is hardcoded: expectations are derived from the live database in this file, per
 * the project rule against test data that duplicates a source of truth.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import {
  VRIO_VALUE_WEIGHTS as VW,
  VRIO_INIMITABILITY_WEIGHTS as IW,
  VRIO_THRESHOLDS as VT,
  VRIO_MAX_PROFICIENCY_RANK,
} from "@heuresys/shared";

const PWD = TEST_PERSONA_PASSWORD;
interface S { cookies: Map<string, string> }
const ch = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies };
}

type Verdict =
  | "CAPABILITY_GAP" | "DISADVANTAGE" | "PARITY" | "TEMPORARY_ADVANTAGE" | "UNUSED_ADVANTAGE"
  | "SUSTAINED_ADVANTAGE";
interface Item {
  skillGroupId: string; skillGroupName: string; skillCount: number;
  value: number; rarity: number; inimitability: number; organization: number;
  isValuable: boolean; isRare: boolean; isInimitable: boolean; isOrganized: boolean;
  verdict: Verdict;
  evidence: {
    valueRaw: number; rarityRaw: number; inimitabilityRaw: number; organizationRaw: number;
    positionsRequiring: number; criticalPositions: number;
    avgCompensationBandEur: number | null; econPercentile: number; criticalityShare: number;
    holders: number; headcount: number;
    avgHeldRank: number | null; verifiedShare: number; evidenceShare: number;
    totalRequirements: number; coveredRequirements: number;
  };
}
interface Scorecard {
  items: Item[]; total: number; headcount: number;
  summary: Record<Verdict, number>;
  thresholds: { value: number; rarity: number; inimitability: number; organization: number };
  weights: { value: { econ: number; crit: number }; inimitability: { depth: number; verified: number; evidence: number } };
  generatedAt: string;
}

let suite: TestApp;
let tenantAdmin: S; // federica.marchetti — capability:read
let plainUser: S; // tommaso.fiore — no capability:read

async function vrio(s: S) {
  return suite.app.inject({
    method: "GET", url: "/v1/capability/composition/vrio", headers: { cookie: ch(s.cookies) },
  });
}

describe("#56 F2 — VRIO scorecard", () => {
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
    expect((await vrio(plainUser)).statusCode).toBe(403);
  });

  it("returns a non-empty scorecard echoing the declared thresholds and weights", async () => {
    const r = await vrio(tenantAdmin);
    expect(r.statusCode).toBe(200);
    const b = r.json() as Scorecard;
    expect(b.total).toBe(b.items.length);
    expect(b.items.length).toBeGreaterThan(0);
    expect(b.thresholds).toEqual({ ...VT });
    expect(b.weights.value).toEqual({ ...VW });
    expect(b.weights.inimitability).toEqual({ ...IW });
  });

  it("the headcount is the tenant's real workforce, not a constant", async () => {
    const b = (await vrio(tenantAdmin)).json() as Scorecard;
    const { rows } = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_users u
         JOIN sys.sys_tenancies t ON t.tenant_id = u.user_tenant_id
        WHERE t.tenant_name = 'RTL Bank'`,
    );
    expect(b.headcount).toBe(Number(rows[0]?.n));
    for (const it of b.items) expect(it.evidence.headcount).toBe(b.headcount);
  });

  it("every dimension is in [0,1] and every group is a real, in-play capability", async () => {
    const b = (await vrio(tenantAdmin)).json() as Scorecard;
    for (const it of b.items) {
      for (const d of [it.value, it.rarity, it.inimitability, it.organization] as const) {
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThanOrEqual(1);
      }
      expect(it.skillGroupName.length).toBeGreaterThan(0);
      expect(it.skillCount).toBeGreaterThan(0);
      // in play = demanded by a position or held by someone; never a dormant taxonomy group
      expect(it.evidence.positionsRequiring + it.evidence.holders).toBeGreaterThan(0);
      // coverage can never exceed the demand it covers
      expect(it.evidence.coveredRequirements).toBeLessThanOrEqual(it.evidence.totalRequirements);
    }
  });

  it("every RAW measure EQUALS its declared formula over the evidence in the same row", async () => {
    const b = (await vrio(tenantAdmin)).json() as Scorecard;
    for (const it of b.items) {
      const e = it.evidence;
      expect(e.valueRaw).toBeCloseTo(VW.econ * e.econPercentile + VW.crit * e.criticalityShare, 3);
      expect(e.rarityRaw).toBeCloseTo(1 - e.holders / e.headcount, 3);
      const depth = e.avgHeldRank === null ? 0 : e.avgHeldRank / VRIO_MAX_PROFICIENCY_RANK;
      expect(e.inimitabilityRaw).toBeCloseTo(
        IW.depth * depth + IW.verified * e.verifiedShare + IW.evidence * e.evidenceShare, 3,
      );
      const org = e.totalRequirements > 0 ? e.coveredRequirements / e.totalRequirements : 0;
      expect(e.organizationRaw).toBeCloseTo(org, 3);
    }
  });

  it("each reported dimension is the PERCENTILE of its raw measure — order-preserving", async () => {
    const b = (await vrio(tenantAdmin)).json() as Scorecard;
    const dims = [
      ["value", "valueRaw"], ["rarity", "rarityRaw"],
      ["inimitability", "inimitabilityRaw"], ["organization", "organizationRaw"],
    ] as const;
    for (const [dim, rawKey] of dims) {
      for (const a of b.items) {
        for (const c of b.items) {
          // a strictly larger raw measure can never yield a smaller percentile
          if (a.evidence[rawKey] > c.evidence[rawKey]) {
            expect(a[dim]).toBeGreaterThanOrEqual(c[dim]);
          }
        }
      }
      // and the ranking must actually separate: not every capability can share one percentile
      expect(new Set(b.items.map((i) => i[dim])).size).toBeGreaterThan(1);
    }
  });

  it("the four dimensions each discriminate — none marks the whole set 'present'", async () => {
    // The failure this pins: with absolute cuts on uncalibrated scales, rarity/inimitability/
    // organization were true for every capability and the verdict collapsed onto Value alone.
    const b = (await vrio(tenantAdmin)).json() as Scorecard;
    for (const flag of ["isValuable", "isRare", "isInimitable", "isOrganized"] as const) {
      const yes = b.items.filter((i) => i[flag]).length;
      expect(yes, `${flag} is true for every capability — the axis is not discriminating`)
        .toBeLessThan(b.items.length);
      expect(yes, `${flag} is false for every capability — the axis is not discriminating`)
        .toBeGreaterThan(0);
    }
  });

  it("the verdict is the Barney lattice over the thresholds, not an average of the four", async () => {
    const b = (await vrio(tenantAdmin)).json() as Scorecard;
    for (const it of b.items) {
      // the booleans must themselves be the threshold reading
      expect(it.isValuable).toBe(it.value >= VT.value);
      expect(it.isRare).toBe(it.rarity >= VT.rarity);
      expect(it.isInimitable).toBe(it.inimitability >= VT.inimitability);
      expect(it.isOrganized).toBe(it.organization >= VT.organization);
      const isGap = it.evidence.holders === 0 && it.evidence.positionsRequiring > 0;
      const expected: Verdict =
        isGap ? "CAPABILITY_GAP"
        : !it.isValuable ? "DISADVANTAGE"
        : !it.isRare ? "PARITY"
        : !it.isInimitable ? "TEMPORARY_ADVANTAGE"
        : !it.isOrganized ? "UNUSED_ADVANTAGE"
        : "SUSTAINED_ADVANTAGE";
      expect(it.verdict).toBe(expected);
      // a sustained advantage requires ALL four — no partial credit
      if (it.verdict === "SUSTAINED_ADVANTAGE") {
        expect([it.isValuable, it.isRare, it.isInimitable, it.isOrganized]).toEqual([true, true, true, true]);
      }
    }
  });

  it("CONTROL CASE: a capability nobody holds is never reported as an advantage", async () => {
    // Derive the control group from the database rather than naming it: any skill group that
    // positions demand but no employee holds. If the compute were wrong (e.g. treating an
    // absent holder as full coverage) this is exactly where it would show.
    const { rows } = await pool.query<{ skill_group_name: string; positions: string }>(
      `SELECT g.skill_group_name, count(DISTINCT r.position_id)::text AS positions
         FROM sys.sys_position_skill_requirements r
         JOIN sys.sys_positions p ON p.position_id = r.position_id AND p.position_is_active
         JOIN sys.sys_tenancies t ON t.tenant_id = p.position_tenant_id AND t.tenant_name = 'RTL Bank'
         JOIN sys.sys_skills s ON s.skill_id = r.skill_id AND s.skill_group_id IS NOT NULL
         JOIN sys.sys_skill_groups g ON g.skill_group_id = s.skill_group_id
        WHERE NOT EXISTS (
                SELECT 1 FROM sys.sys_user_skills us
                 JOIN sys.sys_skills s2 ON s2.skill_id = us.user_skill_skill_id
                WHERE s2.skill_group_id = s.skill_group_id)
        GROUP BY g.skill_group_name
        ORDER BY 2 DESC`,
    );
    // The dataset must actually contain such a case, else this test proves nothing.
    expect(rows.length).toBeGreaterThan(0);
    const controlName = rows[0]!.skill_group_name;

    const b = (await vrio(tenantAdmin)).json() as Scorecard;
    const control = b.items.find((i) => i.skillGroupName === controlName);
    expect(control, `control group "${controlName}" must appear in the scorecard`).toBeDefined();
    expect(control!.evidence.holders).toBe(0);
    expect(control!.evidence.coveredRequirements).toBe(0);
    expect(control!.evidence.organizationRaw).toBe(0); // demanded, met by nobody
    expect(control!.evidence.inimitabilityRaw).toBe(0); // no holder -> no depth, no verification
    // Raw rarity reads 1.0 precisely BECAUSE nobody holds it — the trap this verdict avoids.
    expect(control!.evidence.rarityRaw).toBe(1);
    expect(control!.verdict).toBe("CAPABILITY_GAP");
    // and it must never be dressed up as any flavour of advantage
    for (const bad of ["SUSTAINED_ADVANTAGE", "UNUSED_ADVANTAGE", "TEMPORARY_ADVANTAGE"] as const) {
      expect(control!.verdict).not.toBe(bad);
    }
  });

  it("the summary counts match the items, and ordering is strongest-first", async () => {
    const b = (await vrio(tenantAdmin)).json() as Scorecard;
    const tally: Record<string, number> = {};
    for (const it of b.items) tally[it.verdict] = (tally[it.verdict] ?? 0) + 1;
    for (const [verdict, n] of Object.entries(b.summary)) expect(n).toBe(tally[verdict] ?? 0);
    expect(Object.values(b.summary).reduce((a, c) => a + c, 0)).toBe(b.total);

    const rank: Record<Verdict, number> = {
      SUSTAINED_ADVANTAGE: 6, UNUSED_ADVANTAGE: 5, TEMPORARY_ADVANTAGE: 4, PARITY: 3,
      DISADVANTAGE: 2, CAPABILITY_GAP: 1,
    };
    const seq = b.items.map((i) => rank[i.verdict]);
    expect(seq).toEqual([...seq].sort((a, c) => c - a));
  });

  it("is deterministic: two calls give the same classification", async () => {
    const key = (s: Scorecard) => s.items.map((i) => `${i.skillGroupId}:${i.verdict}:${i.value}`);
    expect(key((await vrio(tenantAdmin)).json() as Scorecard))
      .toEqual(key((await vrio(tenantAdmin)).json() as Scorecard));
  });
});
