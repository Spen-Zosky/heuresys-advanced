/**
 * apps/api/test/public-job-postings.integration.test.ts
 *
 * `#54` F4 — la vetrina PUBBLICA degli annunci (`/v1/public/job-postings`, percorso prospect
 * ADR-0026). Nessuna autenticazione: chiunque la legge.
 *
 * ⭐ IL TEST CHE CONTA e' quello NEGATIVO: un annuncio PUBBLICATO ma `INTERNAL` NON deve
 * comparire, e chiederlo per id deve dare 404 — non 403, perche' «c'e' ma non puoi» conferma
 * a un estraneo l'esistenza di un annuncio interno. Senza il caso negativo questo file
 * proverebbe solo che «qualcosa si vede», non che si vede SOLO cio' che e' pubblico.
 *
 * I dati nascono VIA API con un login reale (federica.marchetti, mandato HR su RTL Bank):
 * requisizione → annuncio → pubblicazione. Si ripuliscono in afterAll per cascata.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PREFISSO = `IT_PUBJP_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S {
  cookies: Map<string, string>;
  csrfToken: string;
}
function ch(c: Map<string, string>): string {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}

let suite: TestApp;
let hr: S;
let richiestaId: string;
let pubblicoId: string;
let internoId: string;
let scadutoId: string;

async function post(url: string, payload: Record<string, unknown>, method: "POST" | "PATCH" = "POST") {
  return suite.app.inject({
    method,
    url,
    headers: { cookie: ch(hr.cookies), "x-csrf-token": hr.csrfToken, "content-type": "application/json" },
    payload,
  });
}

describe("/v1/public/job-postings (pubblico)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    const r = await loginRaw(suite.app, "federica.marchetti@rtl-bank.org", TEST_PERSONA_PASSWORD);
    const cookies = new Map<string, string>();
    for (const c of r.cookies) cookies.set(c.name, c.value);
    hr = { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };

    const p = await pool.query<{ position_id: string }>(
      `SELECT position_id FROM sys.sys_positions
        WHERE position_tenant_id = (SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_name = 'RTL Bank' LIMIT 1)
        ORDER BY position_title LIMIT 1`,
    );
    const req = await post("/v1/job-requisitions", { code: `${PREFISSO}_REQ`, positionId: p.rows[0]!.position_id });
    expect(req.statusCode).toBe(201);
    richiestaId = (req.json() as { requisitionId: string }).requisitionId;

    const crea = async (suffisso: string, extra: Record<string, unknown>) => {
      const c = await post("/v1/job-postings", {
        code: `${PREFISSO}_${suffisso}`, requisitionId: richiestaId,
        title: `Annuncio di prova ${suffisso}`, ...extra,
      });
      expect(c.statusCode).toBe(201);
      return (c.json() as { postingId: string }).postingId;
    };
    pubblicoId = await crea("PUB", { visibility: "PUBLIC", location: "Milano" });
    internoId = await crea("INT", { visibility: "INTERNAL" });
    scadutoId = await crea("EXP", { visibility: "PUBLIC" });

    // pubblicazione: `status` cambia per PATCH, come impone il ciclo di vita del modulo
    for (const [id, extra] of [
      [pubblicoId, {}],
      [internoId, {}],
      // scaduto ieri, pubblicato prima: la scadenza non puo' precedere la pubblicazione (409)
      [scadutoId, { publishedOn: "2020-01-01", expiresOn: "2020-02-01" }],
    ] as const) {
      const u = await post(`/v1/job-postings/${id}`, { status: "PUBLISHED", publishedOn: "2026-09-01", ...extra }, "PATCH");
      if (u.statusCode !== 200) console.error(u.json());
      expect(u.statusCode).toBe(200);
    }
  });

  afterAll(async () => {
    try {
      await pool.query(`DELETE FROM sys.sys_job_requisitions WHERE requisition_id = $1`, [richiestaId]);
    } catch { /* la pulizia non deve mascherare l'esito */ }
    await suite.app.close();
    await closePool();
  });

  it("si legge SENZA autenticazione e mostra l'annuncio PUBLIC pubblicato, col nome dell'azienda", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/public/job-postings" });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { items: Array<Record<string, unknown>>; total: number };
    const mio = b.items.find((i) => i.postingId === pubblicoId);
    expect(mio).toBeDefined();
    expect(mio!.companyName).toBe("RTL Bank");
    expect(mio!.location).toBe("Milano");
    // niente che descriva il fascicolo interno
    expect(mio).not.toHaveProperty("tenantId");
    expect(mio).not.toHaveProperty("requisitionId");
    expect(mio).not.toHaveProperty("metadata");
  });

  it("⭐ un annuncio pubblicato ma INTERNAL NON compare, e per id da' 404", async () => {
    const lista = await suite.app.inject({ method: "GET", url: "/v1/public/job-postings" });
    const b = lista.json() as { items: Array<{ postingId: string }> };
    expect(b.items.some((i) => i.postingId === internoId)).toBe(false);

    const uno = await suite.app.inject({ method: "GET", url: `/v1/public/job-postings/${internoId}` });
    expect(uno.statusCode).toBe(404);
  });

  it("un annuncio PUBLIC ma scaduto NON compare", async () => {
    const lista = await suite.app.inject({ method: "GET", url: "/v1/public/job-postings" });
    const b = lista.json() as { items: Array<{ postingId: string }> };
    expect(b.items.some((i) => i.postingId === scadutoId)).toBe(false);
  });

  it("il dettaglio pubblico per id restituisce l'annuncio PUBLIC", async () => {
    const r = await suite.app.inject({ method: "GET", url: `/v1/public/job-postings/${pubblicoId}` });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { code: string }).code).toBe(`${PREFISSO}_PUB`);
  });
});
