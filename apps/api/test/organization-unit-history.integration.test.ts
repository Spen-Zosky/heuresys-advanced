/**
 * apps/api/test/organization-unit-history.integration.test.ts
 *
 * La storia dell'organigramma: il registro che rendeva la riorganizzazione del
 * marzo 2025 invisibile finché non è stato scritto (cluster C6), e che nessuna
 * API sapeva leggere finché il cancello di esposizione non l'ha segnalato.
 * Append-only per scelta: si aggiunge, non si riscrive.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;

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
let unitId: string;
const created: string[] = [];

describe("/v1/organization-unit-history integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
    const u = await pool.query<{ id: string }>(
      `SELECT o.organization_unit_id AS id FROM sys.sys_organization_units o
        JOIN sys.sys_users us ON us.user_tenant_id = o.organization_unit_tenant_id
       WHERE us.user_email = 'federica.marchetti@rtl-bank.org' LIMIT 1`,
    );
    const row = u.rows[0];
    if (!row) throw new Error("nessuna unità organizzativa nel tenant di prova");
    unitId = row.id;
  });

  afterAll(async () => {
    for (const id of created) {
      try { await pool.query(`DELETE FROM sys.sys_organization_unit_history WHERE organization_unit_history_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("LIST: la storia organizzativa è leggibile dall'API, e ciò che c'è è coerente", async () => {
    // Il database della CI è un clone di produzione CONGELATO al provisioning
    // (D-08): non contiene la storia scritta dopo. Un test che pretendesse gli
    // eventi del marzo 2025 sarebbe verde qui e rosso lì — e sarebbe il test a
    // sbagliare, non il prodotto. Quindi: il CONTRATTO dell'API si verifica
    // sempre, le proprietà del dato solo dove il dato esiste. Che gli eventi
    // ci siano è già sorvegliato dalla batteria SQL, che gira sul database vero.
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/organization-unit-history?effectiveFrom=2025-03-01&effectiveTo=2025-03-01",
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      items: Array<{ changeType: string; oldValue: Record<string, unknown>; newValue: Record<string, unknown> }>;
      total: number;
    };
    // la risposta è coerente con sé stessa, con o senza storia in tabella
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeLessThanOrEqual(body.total);

    const presenti = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_organization_unit_history h
        JOIN sys.sys_users u ON u.user_tenant_id = h.organization_unit_history_tenant_id
       WHERE u.user_email = 'federica.marchetti@rtl-bank.org'
         AND h.organization_unit_history_effective_at::date = DATE '2025-03-01'`,
    );
    expect(body.total).toBe(Number(presenti.rows[0]!.n));

    // dove ci sono eventi, ognuno cambia davvero qualcosa
    for (const e of body.items) {
      expect(JSON.stringify(e.oldValue)).not.toBe(JSON.stringify(e.newValue));
    }
    // e la nascita di un'unità dichiara che prima non esisteva
    const nate = body.items.filter((e) => e.changeType === "CREATED");
    for (const n of nate) expect(n.oldValue).toEqual({ exists: false });
  });

  it("CREATE / GET: si registra un evento e lo si rilegge", async () => {
    const c = await suite.app.inject({
      method: "POST", url: "/v1/organization-unit-history",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: {
        unitId, changeType: "RENAMED",
        oldValue: { name: "Nome precedente di prova" },
        newValue: { name: "Nome successivo di prova" },
        notes: "Evento di prova dell'integrazione.",
      },
    });
    expect(c.statusCode).toBe(201);
    const h = c.json() as { organizationUnitHistoryId: string; actorUserId: string | null };
    created.push(h.organizationUnitHistoryId);
    // l'autore è chi ha registrato l'evento
    expect(h.actorUserId).toBe(tenantS.userId);

    const got = await suite.app.inject({
      method: "GET", url: `/v1/organization-unit-history/${h.organizationUnitHistoryId}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(got.statusCode).toBe(200);
  });

  it("Un cambiamento che non cambia nulla è respinto → 400 EMPTY_CHANGE", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/organization-unit-history",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: {
        unitId, changeType: "RENAMED",
        oldValue: { name: "Identico" }, newValue: { name: "Identico" },
      },
    });
    expect(r.statusCode).toBe(400);
    const err = (r.json() as { error: { code: string; details?: { reason?: string } } }).error;
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.details?.reason).toBe("EMPTY_CHANGE");
  });

  it("Unità inesistente → 404; tipo di evento fuori vocabolario → 400", async () => {
    const r1 = await suite.app.inject({
      method: "POST", url: "/v1/organization-unit-history",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { unitId: randomUUID(), changeType: "MOVED", oldValue: { a: 1 }, newValue: { a: 2 } },
    });
    expect(r1.statusCode).toBe(404);

    const r2 = await suite.app.inject({
      method: "POST", url: "/v1/organization-unit-history",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { unitId, changeType: "RIORGANIZZATA", oldValue: { a: 1 }, newValue: { a: 2 } },
    });
    expect(r2.statusCode).toBe(400);
  });

  it("Il registro non si riscrive: PATCH e DELETE non esistono", async () => {
    const id = created[0] ?? randomUUID();
    const p = await suite.app.inject({
      method: "PATCH", url: `/v1/organization-unit-history/${id}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { notes: "riscrittura" },
    });
    expect(p.statusCode).toBe(404);

    const d = await suite.app.inject({
      method: "DELETE", url: `/v1/organization-unit-history/${id}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
    });
    expect(d.statusCode).toBe(404);
  });
});
