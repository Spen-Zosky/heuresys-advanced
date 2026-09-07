/**
 * apps/api/test/interviews.integration.test.ts
 *
 * Test di integrazione per /v1/interviews/* (sys.sys_interviews).
 * #54 F3, quinta fetta — il colloquio si appende a una CANDIDATURA, non a una persona.
 *
 * ⚠ I due casi che contano sono quelli che nessun vincolo del database coglierebbe:
 *   · un colloquio che scavalca il tenant — la chiave esterna guarda l'esistenza della
 *     candidatura, non la sua appartenenza. Se il controllo del service sparisse, ogni
 *     altro test resterebbe verde;
 *   · un colloquio COMPLETED senza data, quando la data manca gia' sulla riga: lo schema
 *     guarda il corpo e non puo' vederlo. E' la lezione della quarta fetta, dove un
 *     `refine` messo nel posto sbagliato respingeva un caso legittimo.
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
const PREFISSO = `it-intw-${randomUUID().slice(0, 8)}`;

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

let tenantRtl: string;
let tenantAltro: string;
let candidaturaRtl: string;
let candidaturaAltro: string;

const creati = {
  colloqui: [] as string[],
  candidature: [] as string[],
  annunci: [] as string[],
  requisizioni: [] as string[],
  candidati: [] as string[],
};

async function crea(sessione: S, payload: Record<string, unknown>) {
  return suite.app.inject({
    method: "POST",
    url: "/v1/interviews",
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
    url: `/v1/interviews/${id}`,
    headers: {
      cookie: ch(sessione.cookies),
      "x-csrf-token": sessione.csrfToken,
      "content-type": "application/json",
    },
    payload,
  });
}

/**
 * Una candidatura di servizio dentro un tenant, con tutta la catena che pretende:
 * candidato -> requisizione (su una posizione vera) -> annuncio -> candidatura.
 * Le colonne obbligatorie e i vocabolari sono stati LETTI dal modello, non ricordati.
 */
async function seminaCandidatura(tenantId: string, etichetta: string): Promise<string> {
  const cand = await pool.query<{ candidate_id: string }>(
    `INSERT INTO sys.sys_candidates
       (candidate_tenant_id, candidate_first_name, candidate_last_name,
        candidate_email, candidate_source, candidate_status)
     VALUES ($1, 'Prova', $2, $3, 'DIRECT', 'ACTIVE')
     RETURNING candidate_id`,
    [tenantId, etichetta, `${PREFISSO}-${etichetta}@example.invalid`],
  );
  creati.candidati.push(cand.rows[0]!.candidate_id);

  const pos = await pool.query<{ position_id: string }>(
    `SELECT position_id FROM sys.sys_positions
      WHERE position_tenant_id = $1 ORDER BY position_id LIMIT 1`,
    [tenantId],
  );
  if (!pos.rows[0]) throw new Error(`nessuna posizione nel tenant ${etichetta}: verifica cieca`);

  const req = await pool.query<{ requisition_id: string }>(
    `INSERT INTO sys.sys_job_requisitions
       (requisition_tenant_id, requisition_code, requisition_position_id,
        requisition_headcount, requisition_status)
     VALUES ($1, $2, $3, 1, 'OPEN')
     RETURNING requisition_id`,
    [tenantId, `${PREFISSO}-REQ-${etichetta}`, pos.rows[0].position_id],
  );
  creati.requisizioni.push(req.rows[0]!.requisition_id);

  const post = await pool.query<{ posting_id: string }>(
    `INSERT INTO sys.sys_job_postings
       (posting_tenant_id, posting_requisition_id, posting_code, posting_title,
        posting_visibility, posting_status)
     VALUES ($1, $2, $3, $4, 'INTERNAL', 'DRAFT')
     RETURNING posting_id`,
    [tenantId, req.rows[0]!.requisition_id, `${PREFISSO}-POST-${etichetta}`, `${PREFISSO} ${etichetta}`],
  );
  creati.annunci.push(post.rows[0]!.posting_id);

  const app = await pool.query<{ application_id: string }>(
    `INSERT INTO sys.sys_candidate_applications
       (application_tenant_id, application_candidate_id, application_posting_id,
        application_stage, application_applied_on)
     VALUES ($1, $2, $3, 'APPLIED', current_date)
     RETURNING application_id`,
    [tenantId, cand.rows[0]!.candidate_id, post.rows[0]!.posting_id],
  );
  creati.candidature.push(app.rows[0]!.application_id);
  return app.rows[0]!.application_id;
}

describe("/v1/interviews/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    tenant = await login(suite, "federica.marchetti@rtl-bank.org");
    semplice = await login(suite, "tommaso.fiore@rtl-bank.org");

    const t = await pool.query<{ tenant_id: string; tenant_name: string }>(
      `SELECT tenant_id, tenant_name FROM sys.sys_tenancies
        WHERE tenant_status = 'ACTIVE' ORDER BY tenant_name`,
    );
    const rtl = t.rows.find((r) => r.tenant_name === "RTL Bank");
    const altro = t.rows.find((r) => r.tenant_name !== "RTL Bank");
    if (!rtl || !altro) {
      throw new Error("servono due tenant ACTIVE per provare lo scavalco: verifica cieca");
    }
    tenantRtl = rtl.tenant_id;
    tenantAltro = altro.tenant_id;

    candidaturaRtl = await seminaCandidatura(tenantRtl, "rtl");
    candidaturaAltro = await seminaCandidatura(tenantAltro, "altro");
  });

  afterAll(async () => {
    const pulizie: Array<[string[], string, string]> = [
      [creati.colloqui, "sys.sys_interviews", "interview_id"],
      [creati.candidature, "sys.sys_candidate_applications", "application_id"],
      [creati.annunci, "sys.sys_job_postings", "posting_id"],
      [creati.requisizioni, "sys.sys_job_requisitions", "requisition_id"],
      [creati.candidati, "sys.sys_candidates", "candidate_id"],
    ];
    for (const [ids, tabella, colonna] of pulizie) {
      for (const id of ids) {
        try {
          await pool.query(`DELETE FROM ${tabella} WHERE ${colonna} = $1`, [id]);
        } catch {
          /* la pulizia non deve mascherare l'esito dei test */
        }
      }
    }
    await suite.app.close();
    await closePool();
  });

  it("fissa un colloquio, e nasce SCHEDULED", async () => {
    const r = await crea(tenant, {
      applicationId: candidaturaRtl,
      kind: "TECHNICAL",
      scheduledAt: new Date().toISOString(),
      durationMin: 60,
    });
    expect(r.statusCode).toBe(201);
    const b = r.json() as { interviewId: string; status: string; durationMin: number };
    creati.colloqui.push(b.interviewId);
    expect(b.status).toBe("SCHEDULED");
    expect(b.durationMin).toBe(60);
  });

  it("ammette un colloquio SENZA data — «da fissare» e' uno stato legittimo", async () => {
    const r = await crea(tenant, { applicationId: candidaturaRtl, kind: "SCREENING" });
    expect(r.statusCode).toBe(201);
    const b = r.json() as { interviewId: string; scheduledAt: string | null };
    creati.colloqui.push(b.interviewId);
    expect(b.scheduledAt).toBeNull();
  });

  it("⭐ RIFIUTA un colloquio che scavalca il tenant", async () => {
    // La chiave esterna guarda l'ESISTENZA della candidatura, non la sua appartenenza:
    // senza il controllo del service questa riga entrerebbe, valida per PostgreSQL.
    const r = await crea(tenant, { applicationId: candidaturaAltro, kind: "PANEL" });
    expect(r.statusCode).toBe(403);
    expect((r.json() as Errore).error.code).toBe("PERMISSION_DENIED");
  });

  it("una candidatura inesistente da' 404", async () => {
    const r = await crea(tenant, { applicationId: randomUUID(), kind: "FINAL" });
    expect(r.statusCode).toBe(404);
  });

  it("rifiuta una durata non positiva", async () => {
    const r = await crea(tenant, {
      applicationId: candidaturaRtl,
      kind: "BEHAVIORAL",
      durationMin: 0,
    });
    expect(r.statusCode).toBe(400);
  });

  it("⭐ RIFIUTA COMPLETED su un colloquio che non ha una data", async () => {
    // Il secondo colloquio e' nato senza data: portarlo a COMPLETED direbbe che si e'
    // svolto senza dire quando. Lo vede solo il service, che legge la riga.
    const senzaData = creati.colloqui[1]!;
    const r = await patch(tenant, senzaData, { status: "COMPLETED" });
    expect(r.statusCode).toBe(409);
    expect((r.json() as Errore).error.code).toBe("INTERVIEW_COMPLETED_WITHOUT_DATE");
  });

  it("accetta COMPLETED quando la data arriva nello stesso atto", async () => {
    const senzaData = creati.colloqui[1]!;
    const r = await patch(tenant, senzaData, {
      status: "COMPLETED",
      scheduledAt: new Date().toISOString(),
    });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { status: string; scheduledAt: string | null };
    expect(b.status).toBe("COMPLETED");
    expect(b.scheduledAt).not.toBeNull();
  });

  it("annulla senza cancellare, e la lista filtra per stato e candidatura", async () => {
    const primo = creati.colloqui[0]!;
    const r = await patch(tenant, primo, { status: "CANCELLED" });
    expect(r.statusCode).toBe(200);

    const lista = await suite.app.inject({
      method: "GET",
      url: `/v1/interviews?applicationId=${candidaturaRtl}&status=CANCELLED&limit=200`,
      headers: { cookie: ch(tenant.cookies) },
    });
    expect(lista.statusCode).toBe(200);
    const b = lista.json() as { items: Array<{ interviewId: string; status: string }> };
    expect(b.items.some((i) => i.interviewId === primo)).toBe(true);
    expect(b.items.every((i) => i.status === "CANCELLED")).toBe(true);
  });

  it("chi non ha il permesso non legge e non scrive", async () => {
    const lettura = await suite.app.inject({
      method: "GET",
      url: "/v1/interviews",
      headers: { cookie: ch(semplice.cookies) },
    });
    expect(lettura.statusCode).toBe(403);

    const scrittura = await crea(semplice, { applicationId: candidaturaRtl, kind: "SCREENING" });
    expect(scrittura.statusCode).toBe(403);
  });
});
