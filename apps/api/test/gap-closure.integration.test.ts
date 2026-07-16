/**
 * apps/api/test/gap-closure.integration.test.ts — #30 (S1018).
 *
 * Gap-closure read layer: plans (user+position-keyed), per-gap actions,
 * analysis results, ESS self view. Org axis on the subject user (EVALUATION):
 * subtree scope = allow-list; actions inherit the parent gap's gate.
 * Live-derived expectations + deterministic fixtures (tx-isolation).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const PFX = `IT_GC_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

let suite: TestApp;
let federica: S; let paolo: S; let tommaso: S;
let rtlTenantId: string; let tommasoId: string; let antonioId: string;
let gapTommaso: string; let gapAntonio: string;

describe("#30 gap-closure read layer", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    federica = await login(suite, "federica.marchetti@rtl-bank.org");
    paolo = await login(suite, "paolo.caputo@rtl-bank.org");
    tommaso = await login(suite, "tommaso.fiore@rtl-bank.org");
    const u = await pool.query<{ user_id: string; user_email: string; user_tenant_id: string }>(
      `SELECT user_id, user_email, user_tenant_id FROM sys.sys_users WHERE user_email = ANY($1)`,
      [["tommaso.fiore@rtl-bank.org", "antonio.parisi@rtl-bank.org"]]);
    for (const row of u.rows) {
      if (row.user_email.startsWith("tommaso")) { tommasoId = row.user_id; rtlTenantId = row.user_tenant_id; }
      else antonioId = row.user_id;
    }

    // Fixture gaps via the real API (federica), one per subject.
    const mkGap = async (subject: string): Promise<string> => {
      const r = await suite.app.inject({
        method: "POST", url: "/v1/learning-gaps",
        headers: { cookie: ch(federica.cookies), "x-csrf-token": federica.csrfToken, "content-type": "application/json" },
        payload: { userId: subject, severity: "MEDIUM", metadata: { fixture: PFX } },
      });
      expect(r.statusCode).toBe(201);
      return (r.json() as { learningGapId: string }).learningGapId;
    };
    gapTommaso = await mkGap(tommasoId);
    gapAntonio = await mkGap(antonioId);

    // Fixture actions on both gaps + plans + analysis results.
    await pool.query(
      `INSERT INTO sys.sys_gap_closure_actions
         (gap_closure_action_gap_id, gap_closure_action_tenant_id, gap_closure_action_kind, gap_closure_action_status)
       VALUES ($1,$3,'TRAINING_ASSIGNMENT','PROPOSED'), ($1,$3,'MENTORING','IN_PROGRESS'),
              ($2,$3,'PEER_COACHING','PROPOSED')`,
      [gapTommaso, gapAntonio, rtlTenantId]);
    await pool.query(
      `INSERT INTO sys.sys_gap_closure_plans
         (gap_closure_plan_tenant_id, gap_closure_plan_user_id, gap_closure_plan_status, gap_closure_plan_milestones)
       VALUES ($1,$2,'ACTIVE','[{"label":"kickoff"}]'::jsonb), ($1,$3,'PROPOSED','[]'::jsonb)`,
      [rtlTenantId, tommasoId, antonioId]);
    await pool.query(
      `INSERT INTO sys.sys_gap_analysis_results
         (gap_analysis_result_tenant_id, gap_analysis_result_user_id, gap_analysis_result_kind, gap_analysis_result_overall_score)
       VALUES ($1,$2,'SKILL',62.5), ($1,$3,'COMPOSITE',48.0)`,
      [rtlTenantId, tommasoId, antonioId]);
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("closure-plans: tenant scope sees both fixtures; subtree scope only its own (I19)", async () => {
    const asFederica = await suite.app.inject({
      method: "GET", url: `/v1/learning-gaps/closure-plans?limit=200`,
      headers: { cookie: ch(federica.cookies) },
    });
    expect(asFederica.statusCode).toBe(200);
    const fed = asFederica.json() as { items: { userId: string }[]; total: number };
    expect(fed.items.some((p) => p.userId === tommasoId)).toBe(true);
    expect(fed.items.some((p) => p.userId === antonioId)).toBe(true);

    const asPaolo = await suite.app.inject({
      method: "GET", url: `/v1/learning-gaps/closure-plans?limit=200`,
      headers: { cookie: ch(paolo.cookies) },
    });
    const pa = asPaolo.json() as { items: { userId: string }[] };
    expect(pa.items.some((p) => p.userId === tommasoId)).toBe(true);
    expect(pa.items.some((p) => p.userId === antonioId)).toBe(false);
  });

  it("analysis-results: same org-axis semantics + kind filter", async () => {
    const asPaolo = await suite.app.inject({
      method: "GET", url: `/v1/learning-gaps/analysis-results?kind=SKILL&limit=200`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(asPaolo.statusCode).toBe(200);
    const body = asPaolo.json() as { items: { userId: string; kind: string; overallScore: number | null }[] };
    expect(body.items.every((r) => r.kind === "SKILL")).toBe(true);
    expect(body.items.some((r) => r.userId === antonioId)).toBe(false);
    const mine = body.items.find((r) => r.userId === tommasoId);
    expect(mine?.overallScore).toBe(62.5);
  });

  it("per-gap actions inherit the parent gate: in-subtree 200, out-of-subtree 404", async () => {
    const ok = await suite.app.inject({
      method: "GET", url: `/v1/learning-gaps/${gapTommaso}/closure-actions`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(ok.statusCode).toBe(200);
    expect((ok.json() as { total: number }).total).toBe(2);

    const blocked = await suite.app.inject({
      method: "GET", url: `/v1/learning-gaps/${gapAntonio}/closure-actions`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(blocked.statusCode).toBe(404);
  });

  it("ESS self view /v1/me/gaps/closure: own plans + own-gap actions only", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/me/gaps/closure",
      headers: { cookie: ch(tommaso.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { plans: { userId: string; milestones: unknown[] }[]; actions: { gapId: string }[] };
    expect(body.plans.length).toBeGreaterThanOrEqual(1);
    expect(body.plans.every((p) => p.userId === tommasoId)).toBe(true);
    expect(body.actions.length).toBeGreaterThanOrEqual(2);
    // Invariant (live-data aware): EVERY action belongs to one of MY OWN gaps —
    // tommaso may carry real imported gaps+actions besides the fixture.
    const ownGaps = await pool.query<{ id: string }>(
      `SELECT learning_gap_id AS id FROM sys.sys_learning_gaps WHERE learning_gap_user_id = $1`,
      [tommasoId]);
    const ownGapIds = new Set(ownGaps.rows.map((g) => g.id));
    expect(body.actions.every((a) => ownGapIds.has(a.gapId))).toBe(true);
    expect(body.actions.some((a) => a.gapId === gapTommaso)).toBe(true);
  });

  it("USER without gap_analysis:read gets 403 on the admin closure reads", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/learning-gaps/closure-plans",
      headers: { cookie: ch(tommaso.cookies) },
    });
    expect(r.statusCode).toBe(403);
  });
});
