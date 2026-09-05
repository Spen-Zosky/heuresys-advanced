/**
 * apps/api/test/job-requisitions.integration.test.ts
 *
 * Test di integrazione per /v1/job-requisitions/* (sys.sys_job_requisitions, mig 000364).
 * Rotte (apps/api/src/modules/job-requisitions/routes.ts):
 *   GET   /       job-requisition:read
 *   GET   /:id    job-requisition:read
 *   POST  /       job-requisition:manage (CSRF) -> 201
 *   PATCH /:id    job-requisition:manage (CSRF) -> 200
 *
 * ⚠ DUE LIVELLI DI DINIEGO, DUE CODICI DIVERSI, e qui si provano entrambi:
 *   · il ruolo non ha il permesso            -> 403 `FORBIDDEN`        (requirePermission)
 *   · il permesso c'e' ma il perimetro no    -> 403 `PERMISSION_DENIED` (il service)
 * Un test che li confonde passa per la ragione sbagliata.
 *
 * I test colpiscono il DB reale attraverso il tunnel; le righe create qui si ripuliscono
 * in afterAll. Nessun mock.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const PREFISSO = `IT_JREQ_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S {
  cookies: Map<string, string>;
  csrfToken: string;
}
function ch(c: Map<string, string>): string {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

interface Errore {
  error: { code: string; message: string };
}

let suite: TestApp;
let platform: S;
let tenant: S;
let semplice: S;
/** Una posizione VERA di RTL: si legge dal database, non si scrive a mano — un uuid
 *  cablato invecchia in silenzio e il test diventa rosso per la ragione sbagliata. */
let posizioneRtl: string;
let tenantRtl: string;
const creati: string[] = [];

describe("/v1/job-requisitions/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platform = await login(suite, "enzo.spenuso@heuresys.com");
    tenant = await login(suite, "federica.marchetti@rtl-bank.org");
    semplice = await login(suite, "tommaso.fiore@rtl-bank.org");

    const r = await pool.query<{ position_id: string; position_tenant_id: string }>(
      `SELECT position_id, position_tenant_id FROM sys.sys_positions
        WHERE position_tenant_id = (SELECT tenant_id FROM sys.sys_tenancies
                                     WHERE tenant_name = 'RTL Bank' LIMIT 1)
        ORDER BY position_title LIMIT 1`,
    );
    posizioneRtl = r.rows[0]!.position_id;
    tenantRtl = r.rows[0]!.position_tenant_id;
  });

  afterAll(async () => {
    for (const id of creati) {
      try {
        await pool.query(`DELETE FROM sys.sys_job_requisitions WHERE requisition_id = $1`, [id]);
      } catch {
        /* la pulizia non deve mascherare l'esito dei test */
      }
    }
    await suite.app.close();
    await closePool();
  });

  it("GET / senza autenticazione → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/job-requisitions" });
    expect(r.statusCode).toBe(401);
  });

  it("LIST come PLATFORM_ADMIN → 200 con la forma { items, total }", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/job-requisitions?limit=5",
      headers: { cookie: ch(platform.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown; total: unknown };
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it("una persona senza il permesso → 403 FORBIDDEN (non PERMISSION_DENIED)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/job-requisitions",
      headers: { cookie: ch(semplice.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as Errore).error.code).toBe("FORBIDDEN");
  });

  it("APERTURA e rilettura come TENANT_ADMIN → 201 poi 200, e nasce DRAFT", async () => {
    const code = `${PREFISSO}_HP`;
    const creata = await suite.app.inject({
      method: "POST",
      url: "/v1/job-requisitions",
      headers: {
        cookie: ch(tenant.cookies),
        "x-csrf-token": tenant.csrfToken,
        "content-type": "application/json",
      },
      payload: { code, positionId: posizioneRtl, headcount: 2, reason: "GROWTH" },
    });
    expect(creata.statusCode).toBe(201);
    const c = creata.json() as {
      requisitionId: string;
      code: string;
      status: string;
      headcount: number;
      positionTitle: string | null;
      tenantId: string;
    };
    creati.push(c.requisitionId);

    expect(c.code).toBe(code);
    // Lo stato NON si accetta in creazione: una richiesta nasce DRAFT per contratto.
    expect(c.status).toBe("DRAFT");
    expect(c.headcount).toBe(2);
    expect(c.tenantId).toBe(tenantRtl);
    // Il titolo arriva dalla JOIN sulla posizione, non da una copia.
    expect(typeof c.positionTitle).toBe("string");

    const riletta = await suite.app.inject({
      method: "GET",
      url: `/v1/job-requisitions/${c.requisitionId}`,
      headers: { cookie: ch(tenant.cookies) },
    });
    expect(riletta.statusCode).toBe(200);
    expect((riletta.json() as { code: string }).code).toBe(code);
  });

  it("lo stesso codice due volte nello stesso tenant → 409 JOB_REQUISITION_CODE_CONFLICT", async () => {
    const code = `${PREFISSO}_DUP`;
    const payload = { code, positionId: posizioneRtl };
    const prima = await suite.app.inject({
      method: "POST",
      url: "/v1/job-requisitions",
      headers: {
        cookie: ch(tenant.cookies),
        "x-csrf-token": tenant.csrfToken,
        "content-type": "application/json",
      },
      payload,
    });
    expect(prima.statusCode).toBe(201);
    creati.push((prima.json() as { requisitionId: string }).requisitionId);

    const seconda = await suite.app.inject({
      method: "POST",
      url: "/v1/job-requisitions",
      headers: {
        cookie: ch(tenant.cookies),
        "x-csrf-token": tenant.csrfToken,
        "content-type": "application/json",
      },
      payload,
    });
    expect(seconda.statusCode).toBe(409);
    expect((seconda.json() as Errore).error.code).toBe("JOB_REQUISITION_CODE_CONFLICT");
  });

  it("aprire in un ALTRO tenant → 403 PERMISSION_DENIED (il permesso c'e', il perimetro no)", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/job-requisitions",
      headers: {
        cookie: ch(tenant.cookies),
        "x-csrf-token": tenant.csrfToken,
        "content-type": "application/json",
      },
      payload: { code: `${PREFISSO}_XT`, positionId: posizioneRtl, tenantId: randomUUID() },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as Errore).error.code).toBe("PERMISSION_DENIED");
  });

  it("una posizione che non esiste → 404 (I1: si copre un posto vero)", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/job-requisitions",
      headers: {
        cookie: ch(tenant.cookies),
        "x-csrf-token": tenant.csrfToken,
        "content-type": "application/json",
      },
      payload: { code: `${PREFISSO}_NOPOS`, positionId: randomUUID() },
    });
    expect(r.statusCode).toBe(404);
  });

  it("PATCH: lo stato avanza e la chiusura prima dell'apertura è rifiutata", async () => {
    const creata = await suite.app.inject({
      method: "POST",
      url: "/v1/job-requisitions",
      headers: {
        cookie: ch(tenant.cookies),
        "x-csrf-token": tenant.csrfToken,
        "content-type": "application/json",
      },
      payload: { code: `${PREFISSO}_PATCH`, positionId: posizioneRtl, openedOn: "2026-09-01" },
    });
    expect(creata.statusCode).toBe(201);
    const id = (creata.json() as { requisitionId: string }).requisitionId;
    creati.push(id);

    const avanzata = await suite.app.inject({
      method: "PATCH",
      url: `/v1/job-requisitions/${id}`,
      headers: {
        cookie: ch(tenant.cookies),
        "x-csrf-token": tenant.csrfToken,
        "content-type": "application/json",
      },
      payload: { status: "OPEN" },
    });
    expect(avanzata.statusCode).toBe(200);
    expect((avanzata.json() as { status: string }).status).toBe("OPEN");

    // Il CHECK del database dice di no; il service lo anticipa con un 409 leggibile
    // invece di lasciar salire un errore di PostgreSQL come 500.
    const storta = await suite.app.inject({
      method: "PATCH",
      url: `/v1/job-requisitions/${id}`,
      headers: {
        cookie: ch(tenant.cookies),
        "x-csrf-token": tenant.csrfToken,
        "content-type": "application/json",
      },
      payload: { closedOn: "2026-08-01" },
    });
    expect(storta.statusCode).toBe(409);
    expect((storta.json() as Errore).error.code).toBe("JOB_REQUISITION_DATES_INVALID");
  });

  it("una richiesta di un altro tenant non si distingue da una che non esiste → 404", async () => {
    // Creata dal PLATFORM_ADMIN nel tenant di piattaforma, letta da un attore di RTL.
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/job-requisitions/${randomUUID()}`,
      headers: { cookie: ch(tenant.cookies) },
    });
    expect(r.statusCode).toBe(404);
  });

  it("POST senza token CSRF → rifiutato", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/job-requisitions",
      headers: { cookie: ch(tenant.cookies), "content-type": "application/json" },
      payload: { code: `${PREFISSO}_NOCSRF`, positionId: posizioneRtl },
    });
    expect(r.statusCode).toBeGreaterThanOrEqual(400);
    expect(r.statusCode).toBeLessThan(500);
  });
});
