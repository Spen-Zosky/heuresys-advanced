/**
 * apps/api/test/user-target-positions.integration.test.ts
 *
 * L'obiettivo di carriera e — soprattutto — la sua REVISIONE, che è il rilievo
 * #40 della coda C5: lo stato di revisione stava sul dato da sempre e nessuna
 * API sapeva scriverlo. Qui si prova che l'atto esiste, che il revisore è chi
 * agisce (non un id passato dal chiamante) e che i due divieti reggono:
 * nessuno rivede il proprio obiettivo, un obiettivo ritirato non si rivede.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const SUITE_PREFIX = `IT_UTP_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; csrfToken: string; userId: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { csrfToken: string; user: { userId: string } };
  return { cookies, csrfToken: body.csrfToken, userId: body.user.userId };
}

let suite: TestApp;
let tenantS: S;
let managerS: S;
let positionId: string;
const created: string[] = [];

async function createTarget(subjectUserId: string, extra: Record<string, unknown> = {}) {
  const r = await suite.app.inject({
    method: "POST", url: "/v1/user-target-positions",
    headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
    payload: { userId: subjectUserId, positionId, metadata: { suitePrefix: SUITE_PREFIX }, ...extra },
  });
  if (r.statusCode === 201) created.push((r.json() as { userTargetPositionId: string }).userTargetPositionId);
  return r;
}

describe("/v1/user-target-positions integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
    managerS = await login(suite, "paolo.caputo@rtl-bank.org");

    // una posizione reale del tenant, presa dal dato e non inventata
    const pos = await pool.query<{ position_id: string }>(
      `SELECT p.position_id FROM sys.sys_positions p
        JOIN sys.sys_users u ON u.user_tenant_id = p.position_tenant_id
       WHERE u.user_email = 'federica.marchetti@rtl-bank.org' LIMIT 1`,
    );
    const row = pos.rows[0];
    if (!row) throw new Error("nessuna posizione nel tenant di prova");
    positionId = row.position_id;
  });

  afterAll(async () => {
    for (const id of created) {
      try { await pool.query(`DELETE FROM sys.sys_user_target_positions WHERE user_target_position_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("CREATE / LIST / GET happy path, e nasce in attesa di revisione", async () => {
    const c = await createTarget(managerS.userId, { horizon: "MEDIUM_TERM" });
    expect(c.statusCode).toBe(201);
    const t = c.json() as {
      userTargetPositionId: string; reviewStatus: string; horizon: string | null; reviewerUserId: string | null;
    };
    expect(t.reviewStatus).toBe("PENDING_REVIEW");
    expect(t.horizon).toBe("MEDIUM_TERM");
    expect(t.reviewerUserId).toBeNull();

    const got = await suite.app.inject({
      method: "GET", url: `/v1/user-target-positions/${t.userTargetPositionId}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(got.statusCode).toBe(200);

    const list = await suite.app.inject({
      method: "GET", url: `/v1/user-target-positions?userId=${managerS.userId}&reviewStatus=PENDING_REVIEW`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(list.statusCode).toBe(200);
    const body = list.json() as { items: Array<{ userTargetPositionId: string }>; total: number };
    expect(body.items.some((i) => i.userTargetPositionId === t.userTargetPositionId)).toBe(true);
  });

  it("REVIEW: l'obiettivo viene approvato e il revisore è chi ha agito", async () => {
    const c = await createTarget(managerS.userId);
    expect(c.statusCode).toBe(201);
    const id = (c.json() as { userTargetPositionId: string }).userTargetPositionId;

    const rev = await suite.app.inject({
      method: "POST", url: `/v1/user-target-positions/${id}/review`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { decision: "APPROVED", notes: "Condiviso in sede di colloquio di sviluppo." },
    });
    expect(rev.statusCode).toBe(200);
    const t = rev.json() as { reviewStatus: string; reviewerUserId: string | null; reviewNotes: string | null };
    expect(t.reviewStatus).toBe("APPROVED");
    expect(t.reviewerUserId).toBe(tenantS.userId);
    expect(t.reviewNotes).toBe("Condiviso in sede di colloquio di sviluppo.");

    // la decisione è persistita, non solo restituita
    const db = await pool.query<{ s: string; r: string | null }>(
      `SELECT user_target_position_review_status AS s, user_target_position_reviewer_user_id AS r
         FROM sys.sys_user_target_positions WHERE user_target_position_id = $1`, [id],
    );
    expect(db.rows[0]?.s).toBe("APPROVED");
    expect(db.rows[0]?.r).toBe(tenantS.userId);
  });

  it("REVIEW: si può anche respingere, e la decisione successiva sovrascrive", async () => {
    const c = await createTarget(managerS.userId);
    const id = (c.json() as { userTargetPositionId: string }).userTargetPositionId;

    const rej = await suite.app.inject({
      method: "POST", url: `/v1/user-target-positions/${id}/review`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { decision: "REJECTED", notes: "Prerequisiti di ruolo non ancora maturi." },
    });
    expect(rej.statusCode).toBe(200);
    expect((rej.json() as { reviewStatus: string }).reviewStatus).toBe("REJECTED");

    const ok = await suite.app.inject({
      method: "POST", url: `/v1/user-target-positions/${id}/review`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { decision: "APPROVED" },
    });
    expect(ok.statusCode).toBe(200);
    expect((ok.json() as { reviewStatus: string }).reviewStatus).toBe("APPROVED");
  });

  it("REVIEW: nessuno rivede il proprio obiettivo → 403 SELF_REVIEW_FORBIDDEN", async () => {
    const c = await createTarget(tenantS.userId);
    expect(c.statusCode).toBe(201);
    const id = (c.json() as { userTargetPositionId: string }).userTargetPositionId;

    const r = await suite.app.inject({
      method: "POST", url: `/v1/user-target-positions/${id}/review`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { decision: "APPROVED" },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("SELF_REVIEW_FORBIDDEN");
  });

  it("REVIEW: un obiettivo ritirato non si rivede → 409 TARGET_WITHDRAWN", async () => {
    const c = await createTarget(managerS.userId, { reviewStatus: "WITHDRAWN" });
    expect(c.statusCode).toBe(201);
    const id = (c.json() as { userTargetPositionId: string }).userTargetPositionId;

    const r = await suite.app.inject({
      method: "POST", url: `/v1/user-target-positions/${id}/review`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { decision: "APPROVED" },
    });
    expect(r.statusCode).toBe(409);
    expect((r.json() as { error: { code: string } }).error.code).toBe("TARGET_WITHDRAWN");
  });

  it("REVIEW: un esito che non è una decisione viene respinto dallo schema → 400", async () => {
    const c = await createTarget(managerS.userId);
    const id = (c.json() as { userTargetPositionId: string }).userTargetPositionId;
    const r = await suite.app.inject({
      method: "POST", url: `/v1/user-target-positions/${id}/review`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { decision: "PENDING_REVIEW" },
    });
    expect(r.statusCode).toBe(400);
  });

  it("Soggetto inesistente → 404; posizione inesistente → 404", async () => {
    const r1 = await suite.app.inject({
      method: "POST", url: "/v1/user-target-positions",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { userId: randomUUID(), positionId },
    });
    expect(r1.statusCode).toBe(404);

    const r2 = await suite.app.inject({
      method: "POST", url: "/v1/user-target-positions",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { userId: managerS.userId, positionId: randomUUID() },
    });
    expect(r2.statusCode).toBe(404);
  });

  it("PATCH orizzonte poi DELETE", async () => {
    const c = await createTarget(managerS.userId);
    const id = (c.json() as { userTargetPositionId: string }).userTargetPositionId;

    const p = await suite.app.inject({
      method: "PATCH", url: `/v1/user-target-positions/${id}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { horizon: "LONG_TERM" },
    });
    expect(p.statusCode).toBe(200);
    expect((p.json() as { horizon: string | null }).horizon).toBe("LONG_TERM");

    const del = await suite.app.inject({
      method: "DELETE", url: `/v1/user-target-positions/${id}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
    });
    expect(del.statusCode).toBe(204);
  });
});
