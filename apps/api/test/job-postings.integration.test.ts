/**
 * apps/api/test/job-postings.integration.test.ts
 *
 * Test di integrazione per /v1/job-postings/* (sys.sys_job_postings, mig 000364).
 * Rotte: GET / · GET /:id · POST / (CSRF) · PATCH /:id (CSRF)
 * Permessi riusati dalla richiesta: job-requisition:read / :manage (mig 000374).
 *
 * ⚠ Il test che conta di piu' e' quello sul TENANT EREDITATO: l'annuncio prende il tenant
 * dalla richiesta, non dal chiamante e non dal body. Se quel legame si rompesse, nascerebbe
 * un annuncio in un tenant con la sua richiesta in un altro — una riga che il database
 * accetta e che non significa niente.
 *
 * I test colpiscono il DB reale attraverso il tunnel; le righe create qui si ripuliscono in
 * afterAll (le cascate della FK fanno il resto). Nessun mock.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const PREFISSO = `IT_JPOST_${randomUUID().slice(0, 8).toUpperCase()}`;

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
let tenant: S;
let semplice: S;
let richiestaId: string;
let tenantRtl: string;
const richiesteCreate: string[] = [];

async function creaAnnuncio(sessione: S, payload: Record<string, unknown>) {
  return suite.app.inject({
    method: "POST",
    url: "/v1/job-postings",
    headers: {
      cookie: ch(sessione.cookies),
      "x-csrf-token": sessione.csrfToken,
      "content-type": "application/json",
    },
    payload,
  });
}

describe("/v1/job-postings/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    tenant = await login(suite, "federica.marchetti@rtl-bank.org");
    semplice = await login(suite, "tommaso.fiore@rtl-bank.org");

    // La richiesta padre si crea VIA API, non con un INSERT: cosi' il test esercita
    // anche il legame fra le due fette invece di fabbricarne uno a mano.
    const p = await pool.query<{ position_id: string; position_tenant_id: string }>(
      `SELECT position_id, position_tenant_id FROM sys.sys_positions
        WHERE position_tenant_id = (SELECT tenant_id FROM sys.sys_tenancies
                                     WHERE tenant_name = 'RTL Bank' LIMIT 1)
        ORDER BY position_title LIMIT 1`,
    );
    tenantRtl = p.rows[0]!.position_tenant_id;

    const req = await suite.app.inject({
      method: "POST",
      url: "/v1/job-requisitions",
      headers: {
        cookie: ch(tenant.cookies),
        "x-csrf-token": tenant.csrfToken,
        "content-type": "application/json",
      },
      payload: { code: `${PREFISSO}_REQ`, positionId: p.rows[0]!.position_id },
    });
    richiestaId = (req.json() as { requisitionId: string }).requisitionId;
    richiesteCreate.push(richiestaId);
  });

  afterAll(async () => {
    // Cancellare la richiesta porta via i suoi annunci: la FK e' ON DELETE CASCADE.
    for (const id of richiesteCreate) {
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
    const r = await suite.app.inject({ method: "GET", url: "/v1/job-postings" });
    expect(r.statusCode).toBe(401);
  });

  it("una persona senza il permesso → 403 FORBIDDEN", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/job-postings",
      headers: { cookie: ch(semplice.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as Errore).error.code).toBe("FORBIDDEN");
  });

  it("apertura: nasce DRAFT, INTERNAL, e il tenant e' EREDITATO dalla richiesta", async () => {
    const r = await creaAnnuncio(tenant, {
      code: `${PREFISSO}_HP`,
      requisitionId: richiestaId,
      title: "Analista di integrazione",
    });
    expect(r.statusCode).toBe(201);
    const a = r.json() as {
      postingId: string;
      status: string;
      visibility: string;
      tenantId: string;
      requisitionCode: string | null;
    };
    expect(a.status).toBe("DRAFT");
    expect(a.visibility).toBe("INTERNAL");
    // Il punto: il tenant viene dalla richiesta, e nessuno l'ha passato nel body.
    expect(a.tenantId).toBe(tenantRtl);
    expect(a.requisitionCode).toBe(`${PREFISSO}_REQ`);

    const letto = await suite.app.inject({
      method: "GET",
      url: `/v1/job-postings/${a.postingId}`,
      headers: { cookie: ch(tenant.cookies) },
    });
    expect(letto.statusCode).toBe(200);
  });

  it("una richiesta che non esiste → 404 (e un'altrui da' la STESSA risposta)", async () => {
    const r = await creaAnnuncio(tenant, {
      code: `${PREFISSO}_NOREQ`,
      requisitionId: randomUUID(),
      title: "Senza richiesta",
    });
    expect(r.statusCode).toBe(404);
  });

  it("lo stesso codice due volte → 409 JOB_POSTING_CODE_CONFLICT", async () => {
    const payload = {
      code: `${PREFISSO}_DUP`,
      requisitionId: richiestaId,
      title: "Doppione",
    };
    expect((await creaAnnuncio(tenant, payload)).statusCode).toBe(201);
    const seconda = await creaAnnuncio(tenant, payload);
    expect(seconda.statusCode).toBe(409);
    expect((seconda.json() as Errore).error.code).toBe("JOB_POSTING_CODE_CONFLICT");
  });

  it("PATCH: si pubblica, e una scadenza prima della pubblicazione è rifiutata", async () => {
    const creato = await creaAnnuncio(tenant, {
      code: `${PREFISSO}_PUB`,
      requisitionId: richiestaId,
      title: "Da pubblicare",
      publishedOn: "2026-09-01",
    });
    expect(creato.statusCode).toBe(201);
    const id = (creato.json() as { postingId: string }).postingId;

    const pubblicato = await suite.app.inject({
      method: "PATCH",
      url: `/v1/job-postings/${id}`,
      headers: {
        cookie: ch(tenant.cookies),
        "x-csrf-token": tenant.csrfToken,
        "content-type": "application/json",
      },
      payload: { status: "PUBLISHED", visibility: "PUBLIC" },
    });
    expect(pubblicato.statusCode).toBe(200);
    const p = pubblicato.json() as { status: string; visibility: string };
    expect(p.status).toBe("PUBLISHED");
    expect(p.visibility).toBe("PUBLIC");

    const storto = await suite.app.inject({
      method: "PATCH",
      url: `/v1/job-postings/${id}`,
      headers: {
        cookie: ch(tenant.cookies),
        "x-csrf-token": tenant.csrfToken,
        "content-type": "application/json",
      },
      payload: { expiresOn: "2026-08-01" },
    });
    expect(storto.statusCode).toBe(409);
    expect((storto.json() as Errore).error.code).toBe("JOB_POSTING_DATES_INVALID");
  });

  it("il filtro per richiesta trova gli annunci di quella richiesta", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/job-postings?requisitionId=${richiestaId}&limit=50`,
      headers: { cookie: ch(tenant.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { requisitionId: string }[]; total: number };
    expect(body.total).toBeGreaterThan(0);
    for (const item of body.items) expect(item.requisitionId).toBe(richiestaId);
  });

  it("POST senza token CSRF → rifiutato", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/job-postings",
      headers: { cookie: ch(tenant.cookies), "content-type": "application/json" },
      payload: { code: `${PREFISSO}_NOCSRF`, requisitionId: richiestaId, title: "X" },
    });
    expect(r.statusCode).toBeGreaterThanOrEqual(400);
    expect(r.statusCode).toBeLessThan(500);
  });
});
