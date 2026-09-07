/**
 * apps/api/test/interview-feedback.integration.test.ts
 *
 * Test di integrazione per /v1/interview-feedback/* (sys.sys_interview_feedback).
 * #54 F3, sesta fetta — la valutazione di chi ha condotto un colloquio.
 *
 * ⚠ Qui i casi che nessun vincolo del database coglierebbe sono DUE, non uno, ed è la
 * differenza di questa fetta rispetto alle cinque precedenti:
 *   · il colloquio di un altro tenant — la FK guarda l'esistenza, non l'appartenenza;
 *   · l'**intervistatore** di un altro tenant — `sys_users` è una tabella sola per tutte le
 *     aziende, quindi la firma di un dipendente altrui è una riga valida per PostgreSQL.
 * Se sparisse uno dei due controlli, ogni altro test resterebbe verde.
 *
 * ⚠ E un caso che nessuno dei due presidia: valutare un colloquio ANNULLATO. Lo stato del
 * colloquio non è nel corpo della richiesta, quindi solo il service — che legge la riga —
 * può accorgersene.
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
const PREFISSO = `it-fdbk-${randomUUID().slice(0, 8)}`;

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
let colloquioRtl: string;
let colloquioAltro: string;
let colloquioAnnullato: string;
let intervistatoreRtl: string;
let intervistatoreAltro: string;

const creati = {
  valutazioni: [] as string[],
  colloqui: [] as string[],
  candidature: [] as string[],
  annunci: [] as string[],
  requisizioni: [] as string[],
  candidati: [] as string[],
};

async function crea(sessione: S, payload: Record<string, unknown>) {
  return suite.app.inject({
    method: "POST",
    url: "/v1/interview-feedback",
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
    url: `/v1/interview-feedback/${id}`,
    headers: {
      cookie: ch(sessione.cookies),
      "x-csrf-token": sessione.csrfToken,
      "content-type": "application/json",
    },
    payload,
  });
}

/**
 * Un colloquio di servizio dentro un tenant, con tutta la catena che pretende:
 * candidato -> requisizione (su una posizione vera) -> annuncio -> candidatura -> colloquio.
 * Le colonne obbligatorie e i vocabolari sono stati LETTI dal modello, non ricordati.
 */
async function seminaColloquio(
  tenantId: string,
  etichetta: string,
): Promise<{ interviewId: string; applicationId: string }> {
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
    [
      tenantId,
      req.rows[0]!.requisition_id,
      `${PREFISSO}-POST-${etichetta}`,
      `${PREFISSO} ${etichetta}`,
    ],
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

  const applicationId = app.rows[0]!.application_id;
  return {
    interviewId: await colloquioSu(tenantId, applicationId, "SCHEDULED"),
    applicationId,
  };
}

/**
 * Un altro colloquio sulla candidatura che c'è già: nel dominio è la stessa cosa — una
 * selezione ha più colloqui — e costa quattro insert in meno di una catena nuova. Non è
 * un'ottimizzazione gratuita: il `beforeAll` gira via tunnel, e con tre catene intere
 * superava i 30 secondi di hookTimeout **prima** di arrivare al primo test.
 */
async function colloquioSu(
  tenantId: string,
  applicationId: string,
  stato: string,
): Promise<string> {
  const intw = await pool.query<{ interview_id: string }>(
    `INSERT INTO sys.sys_interviews
       (interview_tenant_id, interview_application_id, interview_kind, interview_status,
        interview_scheduled_at)
     VALUES ($1, $2, 'TECHNICAL', $3, now())
     RETURNING interview_id`,
    [tenantId, applicationId, stato],
  );
  creati.colloqui.push(intw.rows[0]!.interview_id);
  return intw.rows[0]!.interview_id;
}

/** Una persona vera di quel tenant: l'intervistatore è un dipendente, non un candidato. */
async function unUtenteDi(tenantId: string): Promise<string> {
  const r = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM sys.sys_users WHERE user_tenant_id = $1 ORDER BY user_id LIMIT 1`,
    [tenantId],
  );
  if (!r.rows[0]) throw new Error(`nessun utente nel tenant ${tenantId}: verifica cieca`);
  return r.rows[0].user_id;
}

describe("/v1/interview-feedback/* integration", () => {
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

    const rtlSemina = await seminaColloquio(tenantRtl, "rtl");
    colloquioRtl = rtlSemina.interviewId;
    colloquioAnnullato = await colloquioSu(tenantRtl, rtlSemina.applicationId, "CANCELLED");
    colloquioAltro = (await seminaColloquio(tenantAltro, "altro")).interviewId;
    intervistatoreRtl = await unUtenteDi(tenantRtl);
    intervistatoreAltro = await unUtenteDi(tenantAltro);
  }, 60_000);

  afterAll(async () => {
    const pulizie: Array<[string[], string, string]> = [
      [creati.valutazioni, "sys.sys_interview_feedback", "feedback_id"],
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

  it("registra una valutazione, e la data la mette il database", async () => {
    const r = await crea(tenant, {
      interviewId: colloquioRtl,
      interviewerUserId: intervistatoreRtl,
      recommendation: "YES",
      score: 7.5,
      notes: "solida sul tecnico",
    });
    expect(r.statusCode).toBe(201);
    const b = r.json() as {
      feedbackId: string;
      recommendation: string;
      score: number;
      submittedOn: string | null;
    };
    creati.valutazioni.push(b.feedbackId);
    expect(b.recommendation).toBe("YES");
    // `numeric` torna come stringa dal driver: se la conversione mancasse questo sarebbe "7.50".
    expect(b.score).toBe(7.5);
    // Non confronto con una data costruita in JavaScript: `toISOString()` e' UTC e
    // `current_date` e' il fuso del server. Verifico la FORMA, che e' cio' che il
    // contratto promette.
    expect(b.submittedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("la raccomandazione ha un default, il punteggio no", async () => {
    // Un intervistatore che dice «neutrale» senza saper mettere un numero ha comunque
    // espresso il giudizio che serve alla decisione.
    const altroIntervistatore = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM sys.sys_users WHERE user_tenant_id = $1 AND user_id <> $2
        ORDER BY user_id LIMIT 1`,
      [tenantRtl, intervistatoreRtl],
    );
    const chi = altroIntervistatore.rows[0]!.user_id;
    const r = await crea(tenant, { interviewId: colloquioRtl, interviewerUserId: chi });
    expect(r.statusCode).toBe(201);
    const b = r.json() as { feedbackId: string; recommendation: string; score: number | null };
    creati.valutazioni.push(b.feedbackId);
    expect(b.recommendation).toBe("NEUTRAL");
    expect(b.score).toBeNull();
  });

  it("⭐ RIFIUTA una valutazione su un colloquio di un altro tenant", async () => {
    const r = await crea(tenant, {
      interviewId: colloquioAltro,
      interviewerUserId: intervistatoreRtl,
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as Errore).error.code).toBe("PERMISSION_DENIED");
  });

  it("⭐ RIFIUTA un INTERVISTATORE di un altro tenant", async () => {
    // `sys_users` e' una tabella sola per tutte le aziende: la chiave esterna accetterebbe
    // volentieri la firma di un dipendente altrui su un colloquio nostro. E' il secondo
    // scavalco, e nessuna delle cinque fette precedenti lo aveva.
    const r = await crea(tenant, {
      interviewId: colloquioRtl,
      interviewerUserId: intervistatoreAltro,
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as Errore).error.code).toBe("PERMISSION_DENIED");
  });

  it("⭐ RIFIUTA di valutare un colloquio ANNULLATO", async () => {
    // Lo stato del colloquio non e' nel corpo: solo il service, che legge la riga, lo vede.
    const r = await crea(tenant, {
      interviewId: colloquioAnnullato,
      interviewerUserId: intervistatoreRtl,
    });
    expect(r.statusCode).toBe(409);
    expect((r.json() as Errore).error.code).toBe("INTERVIEW_NOT_HELD");
  });

  it("⭐ una persona valuta un colloquio UNA VOLTA SOLA — 409, non 500", async () => {
    // Il vincolo di unicita' c'e' nel database: senza l'intercettazione nel service questa
    // risposta sarebbe un 500 da violazione grezza, che non dice a nessuno cosa fare.
    const r = await crea(tenant, {
      interviewId: colloquioRtl,
      interviewerUserId: intervistatoreRtl,
    });
    expect(r.statusCode).toBe(409);
    expect((r.json() as Errore).error.code).toBe("FEEDBACK_ALREADY_GIVEN");
  });

  it("un colloquio inesistente da' 404, e un punteggio fuori scala 400", async () => {
    const inesistente = await crea(tenant, {
      interviewId: randomUUID(),
      interviewerUserId: intervistatoreRtl,
    });
    expect(inesistente.statusCode).toBe(404);

    const fuoriScala = await crea(tenant, {
      interviewId: colloquioRtl,
      interviewerUserId: intervistatoreRtl,
      score: 11,
    });
    expect(fuoriScala.statusCode).toBe(400);
  });

  it("si corregge con PATCH, e la lista filtra per colloquio e raccomandazione", async () => {
    const primo = creati.valutazioni[0]!;
    const r = await patch(tenant, primo, { recommendation: "STRONG_YES", score: 9 });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { recommendation: string; score: number };
    expect(b.recommendation).toBe("STRONG_YES");
    expect(b.score).toBe(9);

    const lista = await suite.app.inject({
      method: "GET",
      url: `/v1/interview-feedback?interviewId=${colloquioRtl}&recommendation=STRONG_YES&limit=200`,
      headers: { cookie: ch(tenant.cookies) },
    });
    expect(lista.statusCode).toBe(200);
    const l = lista.json() as {
      items: Array<{ feedbackId: string; recommendation: string }>;
    };
    expect(l.items.some((f) => f.feedbackId === primo)).toBe(true);
    expect(l.items.every((f) => f.recommendation === "STRONG_YES")).toBe(true);
  });

  it("chi non ha il permesso non legge e non scrive", async () => {
    const lettura = await suite.app.inject({
      method: "GET",
      url: "/v1/interview-feedback",
      headers: { cookie: ch(semplice.cookies) },
    });
    expect(lettura.statusCode).toBe(403);

    const scrittura = await crea(semplice, {
      interviewId: colloquioRtl,
      interviewerUserId: intervistatoreRtl,
    });
    expect(scrittura.statusCode).toBe(403);
  });
});
