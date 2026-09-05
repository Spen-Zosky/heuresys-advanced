/**
 * apps/api/test/candidates.integration.test.ts
 *
 * Test di integrazione per /v1/candidates/* (sys.sys_candidates, mig 000364).
 *
 * ⚠ Questi sono DATI PERSONALI di persone che non hanno un account, e nessun altro presidio
 * del sistema li copre: il registro GDPR sorveglia le FK verso `sys_users`, e questa tabella
 * non ne ha una per la persona di cui parla. I casi qui sotto provano proprio i tre vincoli
 * che tengono in piedi quella responsabilita' — consenso, conservazione, assunzione — e che
 * il service anticipa per rispondere 409 invece di lasciar salire un 500 di PostgreSQL.
 *
 * Le righe create qui si ripuliscono in afterAll. Nessun mock, DB reale.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const PREFISSO = `it-cand-${randomUUID().slice(0, 8)}`;

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
let utenteRtl: string;
const creati: string[] = [];

async function crea(sessione: S, payload: Record<string, unknown>) {
  return suite.app.inject({
    method: "POST",
    url: "/v1/candidates",
    headers: {
      cookie: ch(sessione.cookies),
      "x-csrf-token": sessione.csrfToken,
      "content-type": "application/json",
    },
    payload,
  });
}
async function patch(sessione: S, id: string, payload: Record<string, unknown>) {
  return suite.app.inject({
    method: "PATCH",
    url: `/v1/candidates/${id}`,
    headers: {
      cookie: ch(sessione.cookies),
      "x-csrf-token": sessione.csrfToken,
      "content-type": "application/json",
    },
    payload,
  });
}

describe("/v1/candidates/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    tenant = await login(suite, "federica.marchetti@rtl-bank.org");
    semplice = await login(suite, "tommaso.fiore@rtl-bank.org");
    const u = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM sys.sys_users
        WHERE user_tenant_id = (SELECT tenant_id FROM sys.sys_tenancies
                                 WHERE tenant_name = 'RTL Bank' LIMIT 1)
          AND user_status = 'ACTIVE'
        ORDER BY user_email LIMIT 1`,
    );
    utenteRtl = u.rows[0]!.user_id;
  });

  afterAll(async () => {
    for (const id of creati) {
      try {
        await pool.query(`DELETE FROM sys.sys_candidates WHERE candidate_id = $1`, [id]);
      } catch {
        /* la pulizia non deve mascherare l'esito dei test */
      }
    }
    await suite.app.close();
    await closePool();
  });

  it("GET / senza autenticazione → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/candidates" });
    expect(r.statusCode).toBe(401);
  });

  it("una persona senza il permesso → 403 FORBIDDEN", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/candidates",
      headers: { cookie: ch(semplice.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as Errore).error.code).toBe("FORBIDDEN");
  });

  it("registrazione: nasce ACTIVE, senza utente di assunzione", async () => {
    const r = await crea(tenant, {
      firstName: "Prova",
      lastName: "Integrazione",
      email: `${PREFISSO}-hp@example.invalid`,
      source: "DIRECT",
      consentGivenOn: "2026-09-01",
      retentionUntil: "2027-09-01",
    });
    expect(r.statusCode).toBe(201);
    const c = r.json() as { candidateId: string; status: string; hiredUserId: string | null };
    creati.push(c.candidateId);
    // `HIRED` non si scrive in creazione: pretende un utente che a quel punto non esiste.
    expect(c.status).toBe("ACTIVE");
    expect(c.hiredUserId).toBeNull();
  });

  it("lo stesso indirizzo due volte → 409 CANDIDATE_EMAIL_CONFLICT", async () => {
    const email = `${PREFISSO}-dup@example.invalid`;
    const payload = { firstName: "A", lastName: "B", email, source: "REFERRAL" };
    const prima = await crea(tenant, payload);
    expect(prima.statusCode).toBe(201);
    creati.push((prima.json() as { candidateId: string }).candidateId);

    const seconda = await crea(tenant, payload);
    expect(seconda.statusCode).toBe(409);
    expect((seconda.json() as Errore).error.code).toBe("CANDIDATE_EMAIL_CONFLICT");
  });

  it("conservare da prima del consenso → 409 CANDIDATE_RETENTION_INVALID", async () => {
    const r = await crea(tenant, {
      firstName: "Prima",
      lastName: "DelConsenso",
      email: `${PREFISSO}-ret@example.invalid`,
      source: "AGENCY",
      consentGivenOn: "2026-09-01",
      retentionUntil: "2026-08-01",
    });
    expect(r.statusCode).toBe(409);
    expect((r.json() as Errore).error.code).toBe("CANDIDATE_RETENTION_INVALID");
  });

  it("assumere senza dire CHI → 409 CANDIDATE_HIRED_WITHOUT_USER", async () => {
    const creato = await crea(tenant, {
      firstName: "Da",
      lastName: "Assumere",
      email: `${PREFISSO}-hire@example.invalid`,
      source: "JOB_BOARD",
    });
    expect(creato.statusCode).toBe(201);
    const id = (creato.json() as { candidateId: string }).candidateId;
    creati.push(id);

    const senzaUtente = await patch(tenant, id, { status: "HIRED" });
    expect(senzaUtente.statusCode).toBe(409);
    expect((senzaUtente.json() as Errore).error.code).toBe("CANDIDATE_HIRED_WITHOUT_USER");

    // Con un utente vero dello stesso tenant, invece, l'assunzione passa.
    const conUtente = await patch(tenant, id, { status: "HIRED", hiredUserId: utenteRtl });
    expect(conUtente.statusCode).toBe(200);
    const c = conUtente.json() as { status: string; hiredUserId: string };
    expect(c.status).toBe("HIRED");
    expect(c.hiredUserId).toBe(utenteRtl);
  });

  it("assumere dichiarando un utente che non esiste → 404", async () => {
    const creato = await crea(tenant, {
      firstName: "Utente",
      lastName: "Inesistente",
      email: `${PREFISSO}-nouser@example.invalid`,
      source: "EVENT",
    });
    expect(creato.statusCode).toBe(201);
    const id = (creato.json() as { candidateId: string }).candidateId;
    creati.push(id);

    const r = await patch(tenant, id, { status: "HIRED", hiredUserId: randomUUID() });
    expect(r.statusCode).toBe(404);
  });

  it("registrare in un ALTRO tenant → 403 PERMISSION_DENIED", async () => {
    const r = await crea(tenant, {
      firstName: "Fuori",
      lastName: "Perimetro",
      email: `${PREFISSO}-xt@example.invalid`,
      source: "INTERNAL",
      tenantId: randomUUID(),
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as Errore).error.code).toBe("PERMISSION_DENIED");
  });

  it("POST senza token CSRF → rifiutato", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/candidates",
      headers: { cookie: ch(tenant.cookies), "content-type": "application/json" },
      payload: {
        firstName: "No",
        lastName: "Csrf",
        email: `${PREFISSO}-nocsrf@example.invalid`,
        source: "DIRECT",
      },
    });
    expect(r.statusCode).toBeGreaterThanOrEqual(400);
    expect(r.statusCode).toBeLessThan(500);
  });
});
