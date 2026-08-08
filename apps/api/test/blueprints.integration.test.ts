/**
 * apps/api/test/blueprints.integration.test.ts
 * Blueprint pipeline:
 *   family → variant → 2 processes → tenant activation → override.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const SUITE_PREFIX = `IT_BP_${randomUUID().slice(0, 8).toUpperCase()}`;

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
let platformS: S;
let tenantS: S;
let familyId: string;
let variantId: string;
let procBId: string;
let activationId: string;
let overrideId: string;

describe("/v1/blueprint-* pipeline", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "enzo.spenuso@heuresys.com");
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
  });

  afterAll(async () => {
    if (overrideId) { try { await pool.query(`DELETE FROM sys.sys_blueprint_overrides WHERE blueprint_override_id = $1`, [overrideId]); } catch { /* ignore */ } }
    if (activationId) { try { await pool.query(`DELETE FROM sys.sys_blueprint_activations WHERE blueprint_activation_id = $1`, [activationId]); } catch { /* ignore */ } }
    if (familyId) { try { await pool.query(`DELETE FROM sys.sys_blueprint_families WHERE blueprint_family_id = $1`, [familyId]); } catch { /* ignore */ } }
    await suite.app.close();
    await closePool();
  });

  it("PLATFORM_ADMIN creates family + variant + 2 processes", async () => {
    const f = await suite.app.inject({
      method: "POST", url: "/v1/blueprint-families",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_FAM`, name: "Test Family" },
    });
    expect(f.statusCode).toBe(201);
    familyId = (f.json() as { blueprintFamilyId: string }).blueprintFamilyId;

    const v = await suite.app.inject({
      method: "POST", url: "/v1/blueprint-variants",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { familyId, code: `${SUITE_PREFIX}_VAR`, name: "Test Variant" },
    });
    expect(v.statusCode).toBe(201);
    variantId = (v.json() as { blueprintVariantId: string }).blueprintVariantId;

    const pA = await suite.app.inject({
      method: "POST", url: "/v1/blueprint-processes",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { variantId, code: "PROC_A", name: "Process A", ordinal: 1 },
    });
    expect(pA.statusCode).toBe(201);

    const pB = await suite.app.inject({
      method: "POST", url: "/v1/blueprint-processes",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { variantId, code: "PROC_B", name: "Process B", ordinal: 2, isOptional: true },
    });
    expect(pB.statusCode).toBe(201);
    procBId = (pB.json() as { blueprintProcessId: string }).blueprintProcessId;
  });

  it("TENANT_ADMIN cannot create family → 403", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/blueprint-families",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_TEN`, name: "Should fail" },
    });
    expect(r.statusCode).toBe(403);
  });

  it("Duplicate family code → 409 BLUEPRINT_FAMILY_CODE_CONFLICT", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/blueprint-families",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_FAM`, name: "Duplicate" },
    });
    expect(r.statusCode).toBe(409);
    expect((r.json() as { error: { code: string } }).error.code).toBe("BLUEPRINT_FAMILY_CODE_CONFLICT");
  });

  // #131 E9 (2026-08-08) — `blueprint:activate`, `:override` e `:delete` NON sono
  // piu' di TENANT_ADMIN: dopo la firma i dati sono del cliente, ma il modello
  // deciso PRIMA della firma non si riscrive. Questi tre test descrivevano il
  // comportamento precedente e ora usano la sessione della piattaforma; il
  // rifiuto al cliente e' verificato dal test dedicato in fondo al file, che
  // prima non esisteva — senza quello la revoca non avrebbe una guardia.
  it("PLATFORM_ADMIN activates blueprint and only one ACTIVE allowed", async () => {
    // L'azienda per cui si attiva si DERIVA dall'utente cliente, non si scrive a
    // mano: l'identificativo del tenant e' una fonte di verita' del database.
    const {
      rows: [azienda],
    } = await pool.query<{ tenant_id: string }>(
      `SELECT user_tenant_id AS tenant_id FROM sys.sys_users WHERE user_id = $1`,
      [tenantS.userId],
    );
    const tenantId = azienda!.tenant_id;

    // First check whether tenant already has an ACTIVE activation from prior runs.
    const existing = await pool.query<{ blueprint_activation_id: string }>(
      `SELECT blueprint_activation_id FROM sys.sys_blueprint_activations
        WHERE blueprint_activation_tenant_id = $1
          AND blueprint_activation_status = 'ACTIVE'
        LIMIT 1`,
      [tenantId],
    );
    const tenantHasActive = existing.rows.length > 0;

    // Chi attiva dalla piattaforma DEVE dire per quale azienda: il servizio
    // rifiuta con TENANT_ID_REQUIRED, ed e' giusto — un amministratore di
    // piattaforma non ha un'azienda propria da presumere.
    const a1 = await suite.app.inject({
      method: "POST", url: "/v1/blueprint-activations",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { variantId, tenantId, status: "PROPOSED", effectiveFrom: "2026-06-01" },
    });
    expect(a1.statusCode).toBe(201);
    activationId = (a1.json() as { blueprintActivationId: string }).blueprintActivationId;

    const promote = await suite.app.inject({
      method: "PATCH", url: `/v1/blueprint-activations/${activationId}`,
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { status: "ACTIVE" },
    });
    if (tenantHasActive) {
      expect(promote.statusCode).toBe(409);
      expect((promote.json() as { error: { code: string } }).error.code).toBe("BLUEPRINT_ACTIVATION_ACTIVE_CONFLICT");
    } else {
      expect(promote.statusCode).toBe(200);
      expect((promote.json() as { status: string }).status).toBe("ACTIVE");
    }
  });

  it("PUT override is idempotent on (activation, process)", async () => {
    const o1 = await suite.app.inject({
      method: "PUT", url: "/v1/blueprint-overrides",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { activationId, processId: procBId, inclusion: "OUT", rationale: "Not needed" },
    });
    expect(o1.statusCode).toBe(200);
    const r1 = o1.json() as { blueprintOverrideId: string; inclusion: string };
    expect(r1.inclusion).toBe("OUT");
    overrideId = r1.blueprintOverrideId;

    const o2 = await suite.app.inject({
      method: "PUT", url: "/v1/blueprint-overrides",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { activationId, processId: procBId, inclusion: "PARTIAL" },
    });
    expect(o2.statusCode).toBe(200);
    expect((o2.json() as { blueprintOverrideId: string }).blueprintOverrideId).toBe(overrideId);
    expect((o2.json() as { inclusion: string }).inclusion).toBe("PARTIAL");
  });

  it("Override with mismatched variant process → 403 OVERRIDE_PROCESS_VARIANT_MISMATCH", async () => {
    const f2 = await suite.app.inject({
      method: "POST", url: "/v1/blueprint-families",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_FAM2`, name: "Family 2" },
    });
    const fam2Id = (f2.json() as { blueprintFamilyId: string }).blueprintFamilyId;
    const v2 = await suite.app.inject({
      method: "POST", url: "/v1/blueprint-variants",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { familyId: fam2Id, code: `${SUITE_PREFIX}_VAR2`, name: "Variant 2" },
    });
    const v2Id = (v2.json() as { blueprintVariantId: string }).blueprintVariantId;
    const otherP = await suite.app.inject({
      method: "POST", url: "/v1/blueprint-processes",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { variantId: v2Id, code: "OTHER", name: "Other process", ordinal: 1 },
    });
    const otherPId = (otherP.json() as { blueprintProcessId: string }).blueprintProcessId;

    const bad = await suite.app.inject({
      method: "PUT", url: "/v1/blueprint-overrides",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { activationId, processId: otherPId, inclusion: "IN" },
    });
    expect(bad.statusCode).toBe(403);
    expect((bad.json() as { error: { code: string } }).error.code).toBe("OVERRIDE_PROCESS_VARIANT_MISMATCH");

    await pool.query(`DELETE FROM sys.sys_blueprint_families WHERE blueprint_family_id = $1`, [fam2Id]);
  });

  // #131 E9 — LA GUARDIA CHE MANCAVA ALLA DECISIONE.
  // Spostare i tre test qui sopra sulla sessione della piattaforma li fa tornare
  // verdi, ma da solo non dimostra NIENTE sulla revoca: sarebbero verdi anche se
  // TENANT_ADMIN avesse ancora tutti i permessi. Serve il rifiuto, dichiarato.
  it("#131 E9 — TENANT_ADMIN non attiva e non sovrascrive piu' il modello → 403", async () => {
    const attiva = await suite.app.inject({
      method: "POST",
      url: "/v1/blueprint-activations",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { variantId, status: "PROPOSED", effectiveFrom: "2026-06-01" },
    });
    expect(attiva.statusCode, "TENANT_ADMIN non deve poter attivare un modello").toBe(403);

    const sovrascrivi = await suite.app.inject({
      method: "PUT",
      url: "/v1/blueprint-overrides",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { activationId, processId: procBId, inclusion: "OUT", rationale: "non deve passare" },
    });
    expect(sovrascrivi.statusCode, "TENANT_ADMIN non deve poter sovrascrivere un processo").toBe(403);
  });

  // Cio' che la decisione NON toglie: il cliente continua a VEDERE il proprio
  // modello. Se questo diventasse rosso, la revoca avrebbe travolto anche la
  // lettura — un effetto collaterale, non la decisione.
  it("#131 E9 — TENANT_ADMIN continua a leggere il proprio modello", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/blueprint-families",
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
  });
});
