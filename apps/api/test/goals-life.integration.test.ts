/**
 * apps/api/test/goals-life.integration.test.ts — #26 (S1018).
 *
 * Goal-life sub-resources (updates / check-ins / milestones / comments /
 * alignments / templates / timeline) + OKR check-ins, read-only over the
 * 000037 satellites. Authorization is centralized in canReadGoal/loadReadableOkr
 * (F4 contract): every sub-read inherits the parent's org gate — proven here
 * with the real personas (paolo MANAGER → tommaso in-subtree, antonio outsider).
 * Expectations derive from the LIVE DB (no hardcoded counts); fixtures are
 * created through the real API + direct inserts, rolled back by tx-isolation.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { idDi, unSottopostoOrganizzativo, unEstraneoOrganizzativo } from "./helpers/org-actors.js";

const PWD = TEST_PERSONA_PASSWORD;
const PFX = `IT_GL_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}
async function userId(email: string): Promise<string> {
  const r = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM sys.sys_users WHERE user_email = $1`, [email]);
  return r.rows[0]!.user_id;
}

let suite: TestApp;
let federica: S; let paolo: S; let tommaso: S;
let tommasoId: string; let antonioId: string; let paoloId: string; let federicaId: string;
let rtlTenantId: string;
let goalTommaso: string; // fixture goal, subject = tommaso (in paolo's subtree)
let goalAntonio: string; // fixture goal, subject = antonio (outside paolo's subtree)
let okrId: string;

describe("#26 goal/OKR life sub-resources", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    federica = await login(suite, "federica.marchetti@rtl-bank.org");
    paolo = await login(suite, "paolo.caputo@rtl-bank.org");
    // [S1043] Sottoposto ed estraneo derivati dall'albero delle UNITA': la
    // ricostruzione dell'organigramma ha invertito i ruoli dei due indirizzi che
    // stavano qui. Vedi helpers/org-actors.ts.
    const paoloOrg = await idDi(pool, "paolo.caputo@rtl-bank.org");
    const sottoposto = await unSottopostoOrganizzativo(pool, paoloOrg);
    const estraneo = await unEstraneoOrganizzativo(pool, paoloOrg);
    tommaso = await login(suite, sottoposto.email);
    tommasoId = sottoposto.userId;
    antonioId = estraneo.userId;
    paoloId = await userId("paolo.caputo@rtl-bank.org");
    federicaId = await userId("federica.marchetti@rtl-bank.org");
    const t = await pool.query<{ user_tenant_id: string }>(
      `SELECT user_tenant_id FROM sys.sys_users WHERE user_id = $1`, [tommasoId]);
    rtlTenantId = t.rows[0]!.user_tenant_id;

    // Fixture goals via the REAL API (federica TENANT_ADMIN).
    const mk = async (subject: string, title: string): Promise<string> => {
      const r = await suite.app.inject({
        method: "POST", url: "/v1/goals",
        headers: { cookie: ch(federica.cookies), "x-csrf-token": federica.csrfToken, "content-type": "application/json" },
        payload: { title, subjectUserId: subject, type: "INDIVIDUAL" },
      });
      expect(r.statusCode).toBe(201);
      return (r.json() as { goalId: string }).goalId;
    };
    goalTommaso = await mk(tommasoId, `${PFX} tommaso goal`);
    goalAntonio = await mk(antonioId, `${PFX} antonio goal`);

    // Satellite fixtures (direct inserts — event logs have no write API by design).
    await pool.query(
      `INSERT INTO sys.sys_goal_updates (update_tenant_id, update_goal_id, update_author_user_id,
         update_natural_key, update_type, update_new_progress, update_content)
       VALUES ($1,$2,$3,$4,'PROGRESS',25,'first quarter progress')`,
      [rtlTenantId, goalTommaso, paoloId, `${PFX}::u1`]);
    await pool.query(
      `INSERT INTO sys.sys_goal_check_ins (check_in_tenant_id, check_in_goal_id, check_in_subject_user_id,
         check_in_natural_key, check_in_new_progress, check_in_status_update, check_in_confidence_level)
       VALUES ($1,$2,$3,$4,30,'ON_TRACK',4)`,
      [rtlTenantId, goalTommaso, tommasoId, `${PFX}::c1`]);
    await pool.query(
      `INSERT INTO sys.sys_goal_milestones (milestone_tenant_id, milestone_goal_id, milestone_natural_key,
         milestone_title, milestone_status, milestone_target_date)
       VALUES ($1,$2,$3,'Q1 milestone','IN_PROGRESS', CURRENT_DATE + 30)`,
      [rtlTenantId, goalTommaso, `${PFX}::m1`]);
    // Comments: public + private(paolo) + private(federica) — visibility semantics.
    await pool.query(
      `INSERT INTO sys.sys_goal_comments (comment_tenant_id, comment_goal_id, comment_author_user_id,
         comment_natural_key, comment_content, comment_is_private)
       VALUES ($1,$2,$3,$4,'public note',false),
              ($1,$2,$5,$6,'paolo private note',true),
              ($1,$2,$7,$8,'federica private note',true)`,
      [rtlTenantId, goalTommaso, paoloId, `${PFX}::cm1`, paoloId, `${PFX}::cm2`, federicaId, `${PFX}::cm3`]);
    await pool.query(
      `INSERT INTO sys.sys_goal_alignments (alignment_tenant_id, alignment_source_goal_id,
         alignment_aligned_goal_id, alignment_natural_key, alignment_type)
       VALUES ($1,$2,$3,$4,'SUPPORTS')`,
      [rtlTenantId, goalTommaso, goalAntonio, `${PFX}::a1`]);

    // OKR fixture + 1 aggregate check-in.
    const okr = await suite.app.inject({
      method: "POST", url: "/v1/okrs",
      headers: { cookie: ch(federica.cookies), "x-csrf-token": federica.csrfToken, "content-type": "application/json" },
      payload: { objective: `${PFX} okr`, ownerUserId: tommasoId, periodStart: "2026-01-01", periodEnd: "2026-12-31" },
    });
    expect(okr.statusCode).toBe(201);
    okrId = (okr.json() as { okrId: string }).okrId;
    await pool.query(
      `INSERT INTO sys.sys_okr_check_ins (check_in_tenant_id, check_in_okr_id, check_in_subject_user_id,
         check_in_natural_key, check_in_scope, check_in_new_progress, check_in_status_update)
       VALUES ($1,$2,$3,$4,'OKR_AGGREGATE',40,'on track so far')`,
      [rtlTenantId, okrId, tommasoId, `${PFX}::oc1`]);
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("templates list matches the live catalog count (federica)", async () => {
    const live = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_goal_templates
        WHERE template_tenant_id = $1 AND template_deleted_at IS NULL`, [rtlTenantId]);
    const r = await suite.app.inject({
      method: "GET", url: "/v1/goals/templates?limit=200",
      headers: { cookie: ch(federica.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; total: number };
    expect(body.total).toBe(Number(live.rows[0]!.n));
    expect(body.total).toBeGreaterThan(0); // 40 seeded live — invariant: non-empty catalog
  });

  it("sub-resources of an in-subtree goal are readable by the MANAGER (paolo → tommaso)", async () => {
    for (const seg of ["updates", "check-ins", "milestones", "alignments"]) {
      const r = await suite.app.inject({
        method: "GET", url: `/v1/goals/${goalTommaso}/${seg}`,
        headers: { cookie: ch(paolo.cookies) },
      });
      expect(r.statusCode).toBe(200);
      expect((r.json() as { total: number }).total).toBeGreaterThan(0);
    }
  });

  it("the SAME sub-reads on an out-of-subtree goal are 404 for the MANAGER (I19, no leak)", async () => {
    for (const seg of ["updates", "check-ins", "milestones", "comments", "alignments", "timeline"]) {
      const r = await suite.app.inject({
        method: "GET", url: `/v1/goals/${goalAntonio}/${seg}`,
        headers: { cookie: ch(paolo.cookies) },
      });
      expect(r.statusCode).toBe(404);
    }
  });

  it("private comments: author-only for subtree scope, all for tenant scope", async () => {
    const asPaolo = await suite.app.inject({
      method: "GET", url: `/v1/goals/${goalTommaso}/comments`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(asPaolo.statusCode).toBe(200);
    const paoloBody = asPaolo.json() as { items: { content: string }[]; total: number };
    expect(paoloBody.total).toBe(2); // public + own private; federica's private hidden
    expect(paoloBody.items.map((c) => c.content)).not.toContain("federica private note");

    const asFederica = await suite.app.inject({
      method: "GET", url: `/v1/goals/${goalTommaso}/comments`,
      headers: { cookie: ch(federica.cookies) },
    });
    expect((asFederica.json() as { total: number }).total).toBe(3);
  });

  it("alignments carry direction + the other goal's title", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/goals/${goalTommaso}/alignments`,
      headers: { cookie: ch(federica.cookies) },
    });
    const body = r.json() as { items: { direction: string; alignedGoalTitle: string | null }[] };
    expect(body.items[0]!.direction).toBe("OUT");
    expect(body.items[0]!.alignedGoalTitle).toBe(`${PFX} antonio goal`);
  });

  it("USER without goal:read gets 403 on admin sub-reads (tommaso)", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/goals/${goalTommaso}/updates`,
      headers: { cookie: ch(tommaso.cookies) },
    });
    expect(r.statusCode).toBe(403);
  });

  it("ESS self timeline: own goal 200 with merged events; someone else's goal 404 (I17 floor)", async () => {
    const own = await suite.app.inject({
      method: "GET", url: `/v1/me/goals/${goalTommaso}/timeline`,
      headers: { cookie: ch(tommaso.cookies) },
    });
    expect(own.statusCode).toBe(200);
    const body = own.json() as { goal: { goalId: string }; events: { kind: string }[] };
    expect(body.goal.goalId).toBe(goalTommaso);
    const kinds = new Set(body.events.map((e) => e.kind));
    expect(kinds.has("UPDATE")).toBe(true);
    expect(kinds.has("CHECK_IN")).toBe(true);
    expect(kinds.has("MILESTONE")).toBe(true);

    const foreign = await suite.app.inject({
      method: "GET", url: `/v1/me/goals/${goalAntonio}/timeline`,
      headers: { cookie: ch(tommaso.cookies) },
    });
    expect(foreign.statusCode).toBe(404);
  });

  it("admin timeline endpoint mirrors the same events (federica)", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/goals/${goalTommaso}/timeline`,
      headers: { cookie: ch(federica.cookies) },
    });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { events: unknown[] }).events.length).toBeGreaterThanOrEqual(3);
  });

  it("OKR check-ins list is readable and totals match the fixture (federica + paolo)", async () => {
    for (const s of [federica, paolo]) {
      const r = await suite.app.inject({
        method: "GET", url: `/v1/okrs/${okrId}/check-ins`,
        headers: { cookie: ch(s.cookies) },
      });
      expect(r.statusCode).toBe(200);
      const body = r.json() as { items: { scope: string; newProgress: number | null }[]; total: number };
      expect(body.total).toBe(1);
      expect(body.items[0]!.scope).toBe("OKR_AGGREGATE");
      expect(body.items[0]!.newProgress).toBe(40);
    }
  });

  it("LIVE reservoir: the legacy-imported satellites are reachable through the API (federica)", async () => {
    // Pick a real goal with live updates (1.8k rows imported) and assert the API serves them.
    const g = await pool.query<{ id: string; n: string }>(
      `SELECT u.update_goal_id AS id, count(*)::text AS n
         FROM sys.sys_goal_updates u
         JOIN sys.sys_goals g ON g.goal_id = u.update_goal_id
        WHERE g.goal_tenant_id = $1
        GROUP BY u.update_goal_id ORDER BY count(*) DESC LIMIT 1`, [rtlTenantId]);
    if (!g.rows[0]) return; // no live updates in this tenant — fixture tests above still cover the path
    const r = await suite.app.inject({
      method: "GET", url: `/v1/goals/${g.rows[0].id}/updates?limit=200`,
      headers: { cookie: ch(federica.cookies) },
    });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { total: number }).total).toBe(Number(g.rows[0].n));
  });
});
