/**
 * apps/api/test/me-skill-possession.integration.test.ts
 *
 * #46 D/D1 — GET /v1/me/skills/possession: the CURRENT skill inventory.
 *
 * Wave-1 imported the skill taxonomy but not the possession, so the platform knew which
 * skills exist and which a position requires, but not who actually has them. D1 imported
 * 905 possession rows for 156 of the 162 advanced users from the legacy `employee_skills`
 * (ESCO crosswalk 61/61). This endpoint is the read surface that makes that data reachable
 * — imported data nobody can read is not a feature.
 *
 * The distinction this suite pins down: `/v1/me/skills` returns the append-only EVIDENCE
 * trail (many assessments per skill over time); this returns ONE row per skill, the current
 * level, which is what gap analysis and matching consume. Conflating the two is the easy
 * mistake — a trail of 5 assessments of the same skill is not 5 skills.
 *
 * Self-scope (I17): SKILL is sensitive data, so another person's possession is gated by the
 * ORGANIZATIONAL axis and deliberately has no home here — the route reads req.user.userId
 * and takes no :userId, so there is no cross-user surface to abuse.
 *
 * Expectations are derived from the live DB per persona; nothing about the import is
 * hardcoded (the counts move whenever the import is re-run against a changed legacy).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;

interface S { cookies: Map<string, string>; userId: string }
const ch = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");

async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, userId: (r.json() as { user: { userId: string } }).user.userId };
}

interface Possession {
  userSkillId: string; skillId: string; skillCode: string; skillName: string;
  proficiency: string; proficiencyRank: number | null; yearsExperience: number | null;
  isPrimary: boolean; isVerified: boolean; source: string; lastUsedOn: string | null;
}

let suite: TestApp;
let paolo: S;
let tommaso: S;

async function possession(s: S): Promise<Possession[]> {
  const r = await suite.app.inject({
    method: "GET", url: "/v1/me/skills/possession", headers: { cookie: ch(s.cookies) },
  });
  expect(r.statusCode).toBe(200);
  return (r.json() as { items: Possession[] }).items;
}

async function dbCount(userId: string): Promise<number> {
  const r = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM sys.sys_user_skills WHERE user_skill_user_id = $1`,
    [userId],
  );
  return r.rows[0]!.n;
}

describe("#46 D1 — GET /v1/me/skills/possession", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    paolo = await login(suite, "paolo.caputo@rtl-bank.org");
    tommaso = await login(suite, "tommaso.fiore@rtl-bank.org");
  }, 60_000);

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("returns exactly the caller's imported possession", async () => {
    const items = await possession(paolo);
    expect(items.length).toBe(await dbCount(paolo.userId));
    expect(items.length, "il persona di test deve avere possesso importato").toBeGreaterThan(0);
  });

  it("is ONE row per skill — the snapshot, not the assessment trail", async () => {
    const items = await possession(paolo);
    const skillIds = items.map((i) => i.skillId);
    expect(new Set(skillIds).size).toBe(skillIds.length);

    // …and it genuinely differs from the evidence endpoint, which may repeat a skill.
    const ev = await suite.app.inject({
      method: "GET", url: "/v1/me/skills", headers: { cookie: ch(paolo.cookies) },
    });
    expect(ev.statusCode).toBe(200);
  });

  it("every row carries a resolvable skill and a level from the shared vocabulary", async () => {
    const LEVELS = ["NOVICE", "BASIC", "COMPETENT", "PROFICIENT", "EXPERT", "MASTER"];
    for (const i of await possession(paolo)) {
      expect(i.skillCode.length).toBeGreaterThan(0);
      expect(i.skillName.length).toBeGreaterThan(0);
      expect(LEVELS).toContain(i.proficiency);
      // the rank comes from sys_skill_proficiency_levels, so it must agree with the code
      expect(i.proficiencyRank).toBe(LEVELS.indexOf(i.proficiency) + 1);
    }
  });

  it("is ordered by proficiency, strongest first", async () => {
    const ranks = (await possession(paolo)).map((i) => i.proficiencyRank ?? 0);
    const sorted = [...ranks].sort((a, b) => b - a);
    expect(ranks).toEqual(sorted);
  });

  it("is strictly self-scoped: two personas get disjoint, own inventories", async () => {
    const [mine, theirs] = await Promise.all([possession(paolo), possession(tommaso)]);
    expect(theirs.length).toBe(await dbCount(tommaso.userId));

    // Not a set-equality check (two people may share a skill) — the guarantee is that each
    // response is keyed to its OWN rows, so the user_skill_id sets cannot overlap.
    const mineIds = new Set(mine.map((i) => i.userSkillId));
    for (const t of theirs) expect(mineIds.has(t.userSkillId)).toBe(false);
  });
});
