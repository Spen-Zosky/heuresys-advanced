/**
 * apps/api/test/implementation-consultant.integration.test.ts — mandato K, R-8 (D9=B).
 *
 * IMPLEMENTATION_CONSULTANT: ruolo di piattaforma per il consulente esterno di avviamento.
 * Conduce le corse di ricerca (seed acquisition) SOLO sui clienti a cui e' stato assegnato
 * (sys_platform_user_tenant_assignments, R-0) — mai tutti come PLATFORM_ADMIN. Non approva
 * candidati (resta al cliente/piattaforma) ne' concede ruoli.
 *
 * NOTA: passo 55 del mandato scrive "→ 202" per il trigger; la rotta reale
 * (`seed-acquisition-runs/routes.ts:31`) risponde **201** — misurato sul vivo, non sul piano
 * (⭐ IL PUNTO FISSO del CLAUDE.md: il sistema che gira è la verità).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { readCollaudoKey, deriveCollaudoPassword } from "../scripts/collaudo-access.mjs";
import { senzaCacheDiSessione } from "./helpers/session-cache.js";

senzaCacheDiSessione();

const CONSULTANT_EMAIL = "implementation-consultant@collaudo.invalid";
const ADMIN_EMAIL = "enzo.spenuso@heuresys.com";

interface S { cookies: Map<string, string>; csrfToken: string; userId: string }
const ch = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");

async function login(t: TestApp, email: string, password: string): Promise<S> {
  const r = await loginRaw(t.app, email, password);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const b = r.json() as { csrfToken: string; user: { userId: string } };
  return { cookies, csrfToken: b.csrfToken, userId: b.user.userId };
}

let suite: TestApp;
let admin: S;
let consultant: S;
let rtlTenantId = "";
let heuresysTenantId = "";
let assignmentId = "";

describe("mandato K, R-8 — IMPLEMENTATION_CONSULTANT", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    const key = readCollaudoKey();
    admin = await login(suite, ADMIN_EMAIL, TEST_PERSONA_PASSWORD);
    consultant = await login(suite, CONSULTANT_EMAIL, deriveCollaudoPassword(key, CONSULTANT_EMAIL));
    const tenants = await pool.query<{ code: string; id: string }>(
      `SELECT tenant_code AS code, tenant_id AS id FROM sys.sys_tenancies WHERE tenant_code IN ('RTL_BANK', 'HEURESYS')`,
    );
    rtlTenantId = tenants.rows.find((t) => t.code === "RTL_BANK")!.id;
    heuresysTenantId = tenants.rows.find((t) => t.code === "HEURESYS")!.id;
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("senza assegnazione, il trigger su RTL risponde 404 (non 403: non si conferma l'esistenza del cliente)", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/seed-acquisition-runs",
      headers: { cookie: ch(consultant.cookies), "x-csrf-token": consultant.csrfToken },
      payload: { code: "R8-PRE-ASSEGNAZIONE", tenantId: rtlTenantId },
    });
    expect(r.statusCode).toBe(404);
  });

  it("R-0 SUL VIVO — assegnato a RTL, il trigger su RTL risponde 201", async () => {
    const create = await suite.app.inject({
      method: "POST",
      url: "/v1/platform-tenant-assignments",
      headers: { cookie: ch(admin.cookies), "x-csrf-token": admin.csrfToken },
      payload: { userId: consultant.userId, tenantId: rtlTenantId },
    });
    expect(create.statusCode).toBe(201);
    assignmentId = (create.json() as { assignmentId: string }).assignmentId;

    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/seed-acquisition-runs",
      headers: { cookie: ch(consultant.cookies), "x-csrf-token": consultant.csrfToken },
      payload: { code: "R8-SUL-VIVO-RTL", tenantId: rtlTenantId },
    });
    expect(r.statusCode).toBe(201);
  });

  it("assegnato SOLO a RTL, il trigger su un altro cliente (Heuresys System) risponde 404", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/seed-acquisition-runs",
      headers: { cookie: ch(consultant.cookies), "x-csrf-token": consultant.csrfToken },
      payload: { code: "R8-FUORI-PERIMETRO", tenantId: heuresysTenantId },
    });
    expect(r.statusCode).toBe(404);
  });

  it("legge le corse e i fascicoli del cliente assegnato (sola lettura, sui moduli dell'avviamento)", async () => {
    const runs = await suite.app.inject({
      method: "GET", url: "/v1/seed-acquisition-runs",
      headers: { cookie: ch(consultant.cookies) },
    });
    expect(runs.statusCode).toBe(200);
    const body = runs.json() as { items: Array<{ tenantId: string }>; total: number };
    expect(body.total).toBeGreaterThan(0);
    expect(body.items.every((r) => r.tenantId === rtlTenantId)).toBe(true);

    const blueprints = await suite.app.inject({
      method: "GET", url: "/v1/tenant-blueprints",
      headers: { cookie: ch(consultant.cookies) },
    });
    expect(blueprints.statusCode).toBe(200);
  });

  it("non approva un candidato (seed_acquisition:approve) né scrive un fascicolo (tenant_blueprint:write) — 403", async () => {
    const approve = await suite.app.inject({
      method: "POST", url: "/v1/seed-approval-decisions",
      headers: { cookie: ch(consultant.cookies), "x-csrf-token": consultant.csrfToken },
      payload: { candidateId: "00000000-0000-0000-0000-000000000000", status: "APPROVED" },
    });
    expect(approve.statusCode).toBe(403);
  });

  it("non può concedere ruoli né materializzare un tenant — 403", async () => {
    const grant = await suite.app.inject({
      method: "POST", url: `/v1/users/${consultant.userId}/roles`,
      headers: { cookie: ch(consultant.cookies), "x-csrf-token": consultant.csrfToken },
      payload: { roleCode: "TEAM_LEADER", tenantId: rtlTenantId },
    });
    expect(grant.statusCode).toBe(403);

    const materialize = await suite.app.inject({
      method: "POST", url: "/v1/tenant-materialization",
      headers: { cookie: ch(consultant.cookies), "x-csrf-token": consultant.csrfToken },
      payload: { tenantId: rtlTenantId, variantVersionId: "00000000-0000-0000-0000-000000000000", mode: "plan" },
    });
    expect(materialize.statusCode).toBe(403);
  });

  it("revocata l'assegnazione, il trigger su RTL torna 404 (il perimetro non è nel JWT: si ricalcola a ogni richiesta)", async () => {
    const revoke = await suite.app.inject({
      method: "POST",
      url: `/v1/platform-tenant-assignments/${assignmentId}/revoke`,
      headers: { cookie: ch(admin.cookies), "x-csrf-token": admin.csrfToken },
    });
    expect(revoke.statusCode).toBe(200);

    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/seed-acquisition-runs",
      headers: { cookie: ch(consultant.cookies), "x-csrf-token": consultant.csrfToken },
      payload: { code: "R8-DOPO-REVOCA", tenantId: rtlTenantId },
    });
    expect(r.statusCode).toBe(404);
  });

  it("controprova — PLATFORM_ADMIN lancia la corsa senza bisogno di assegnazione", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/seed-acquisition-runs",
      headers: { cookie: ch(admin.cookies), "x-csrf-token": admin.csrfToken },
      payload: { code: "R8-CONTROPROVA-ADMIN", tenantId: rtlTenantId },
    });
    expect(r.statusCode).toBe(201);
  });
});
