/**
 * apps/api/test/job-offers.integration.test.ts
 *
 * Test di integrazione per /v1/job-offers/* (sys.sys_job_offers).
 * #54 F3, settima e ultima fetta — l'offerta, e con essa il ciclo di recruiting si chiude.
 *
 * ⚠ Questa fetta ha un caso che nessuna delle sei precedenti aveva: una **retribuzione**.
 * La migrazione `000364` aveva lasciato scritto che le regole di mascheramento andavano
 * decise qui e non ereditate per analogia — quindi la decisione va PROVATA, non solo
 * dichiarata in un commento: `PLATFORM_ADMIN` vede la riga e non l'importo, e l'importo
 * mancante è **dichiarato** in `masked`.
 *
 * ⚠ E tre presidi che nessun vincolo del database coglierebbe:
 *   · una candidatura di un altro tenant — la FK guarda l'esistenza, non l'appartenenza;
 *   · due offerte aperte insieme sulla stessa candidatura — «aperta» dipende dallo stato,
 *     quindi nessun vincolo potrebbe dirlo;
 *   · il ritorno da uno stato terminale — il database guarda una riga per volta, non la
 *     sua storia.
 *
 * Le righe create qui si ripuliscono in afterAll. Nessun mock, DB reale.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD, passwordFor } from "./helpers/personas.js";

const PREFISSO = `it-offer-${randomUUID().slice(0, 8)}`;
const PLATFORM_EMAIL = "enzo.spenuso@heuresys.com";

interface S {
  cookies: Map<string, string>;
  csrfToken: string;
}
function ch(c: Map<string, string>): string {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string, pwd: string): Promise<S> {
  const r = await loginRaw(t.app, email, pwd);
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
let platform: S;

let tenantRtl: string;
let tenantAltro: string;
let candidaturaRtl: string;
let candidaturaBis: string;
let candidaturaAltro: string;

const creati = {
  offerte: [] as string[],
  candidature: [] as string[],
  annunci: [] as string[],
  requisizioni: [] as string[],
  candidati: [] as string[],
};

async function crea(sessione: S, payload: Record<string, unknown>) {
  return suite.app.inject({
    method: "POST",
    url: "/v1/job-offers",
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
    url: `/v1/job-offers/${id}`,
    headers: {
      cookie: ch(sessione.cookies),
      "x-csrf-token": sessione.csrfToken,
      "content-type": "application/json",
    },
    payload,
  });
}

/**
 * Una candidatura di servizio dentro un tenant, con tutta la catena che pretende.
 * Le colonne obbligatorie e i vocabolari sono stati LETTI dal modello, non ricordati.
 */
async function seminaCandidatura(
  tenantId: string,
  etichetta: string,
): Promise<{ applicationId: string; postingId: string }> {
  const candidateId = await nuovoCandidato(tenantId, etichetta);

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
  const postingId = post.rows[0]!.posting_id;
  creati.annunci.push(postingId);

  return {
    applicationId: await candidaturaSu(tenantId, candidateId, postingId),
    postingId,
  };
}

/** Una persona che si candida. Ne serve una nuova per ogni candidatura sullo stesso annuncio. */
async function nuovoCandidato(tenantId: string, etichetta: string): Promise<string> {
  const cand = await pool.query<{ candidate_id: string }>(
    `INSERT INTO sys.sys_candidates
       (candidate_tenant_id, candidate_first_name, candidate_last_name,
        candidate_email, candidate_source, candidate_status)
     VALUES ($1, 'Prova', $2, $3, 'DIRECT', 'ACTIVE')
     RETURNING candidate_id`,
    [tenantId, etichetta, `${PREFISSO}-${etichetta}@example.invalid`],
  );
  creati.candidati.push(cand.rows[0]!.candidate_id);
  return cand.rows[0]!.candidate_id;
}

/**
 * Un'altra candidatura sullo STESSO annuncio, ma di un'ALTRA persona: costa due insert
 * invece dei cinque di una catena nuova, e il `beforeAll` gira via tunnel, dove tre catene
 * intere superano l'hookTimeout prima di arrivare al primo test.
 *
 * ⚠ La persona dev'essere diversa: `sys_candidate_applications_unique` è su
 * (candidato, annuncio), e ha ragione — una persona si candida a un annuncio una volta
 * sola. Il primo tentativo riusava lo stesso candidato, e il vincolo l'ha fermato.
 */
async function candidaturaSu(
  tenantId: string,
  candidateId: string,
  postingId: string,
): Promise<string> {
  const app = await pool.query<{ application_id: string }>(
    `INSERT INTO sys.sys_candidate_applications
       (application_tenant_id, application_candidate_id, application_posting_id,
        application_stage, application_applied_on)
     VALUES ($1, $2, $3, 'APPLIED', current_date)
     RETURNING application_id`,
    [tenantId, candidateId, postingId],
  );
  creati.candidature.push(app.rows[0]!.application_id);
  return app.rows[0]!.application_id;
}

describe("/v1/job-offers/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    tenant = await login(suite, "federica.marchetti@rtl-bank.org", TEST_PERSONA_PASSWORD);
    semplice = await login(suite, "tommaso.fiore@rtl-bank.org", TEST_PERSONA_PASSWORD);
    platform = await login(suite, PLATFORM_EMAIL, passwordFor(PLATFORM_EMAIL));

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

    const rtlSemina = await seminaCandidatura(tenantRtl, "rtl");
    candidaturaRtl = rtlSemina.applicationId;
    // Una seconda persona sullo stesso annuncio: serve a provare che l'unicità
    // dell'offerta è PER CANDIDATURA, non per tenant né per annuncio.
    candidaturaBis = await candidaturaSu(
      tenantRtl,
      await nuovoCandidato(tenantRtl, "rtl-bis"),
      rtlSemina.postingId,
    );
    candidaturaAltro = (await seminaCandidatura(tenantAltro, "altro")).applicationId;
  }, 60_000);

  afterAll(async () => {
    const pulizie: Array<[string[], string, string]> = [
      [creati.offerte, "sys.sys_job_offers", "offer_id"],
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

  it("prepara un'offerta, e nasce DRAFT senza data di invio", async () => {
    const r = await crea(tenant, {
      applicationId: candidaturaRtl,
      grossAnnualSalary: 42000,
      contractType: "PERMANENT",
    });
    expect(r.statusCode).toBe(201);
    const b = r.json() as {
      offerId: string;
      status: string;
      grossAnnualSalary: number;
      sentOn: string | null;
    };
    creati.offerte.push(b.offerId);
    expect(b.status).toBe("DRAFT");
    // `numeric` torna come stringa dal driver: se la conversione mancasse questo
    // sarebbe "42000.00" e il contratto respingerebbe la propria stessa risposta.
    expect(b.grossAnnualSalary).toBe(42000);
    expect(b.sentOn).toBeNull();
  });

  it("⭐ RIFIUTA una risposta a un'offerta mai spedita", async () => {
    // Il `flow_check` del database lo impedirebbe con una violazione grezza: qui e' un 409
    // che dice cosa manca. Il controllo sta nel service perche' lo schema guarda il corpo e
    // non sa se `sentOn` e' gia' sulla riga.
    const r = await patch(tenant, creati.offerte[0]!, { status: "ACCEPTED" });
    expect(r.statusCode).toBe(409);
    expect((r.json() as Errore).error.code).toBe("OFFER_NOT_SENT");
  });

  it("passando a SENT la data la mette il database, non JavaScript", async () => {
    const r = await patch(tenant, creati.offerte[0]!, { status: "SENT" });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { status: string; sentOn: string | null };
    expect(b.status).toBe("SENT");
    // Verifico la FORMA, non il valore: `toISOString()` e' UTC e `current_date` e' il fuso
    // del server, e dopo mezzanotte locale dicono giorni diversi.
    expect(b.sentOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("⭐ una candidatura ha UNA offerta aperta per volta", async () => {
    // «Aperta» dipende dallo stato, quindi nessun vincolo del database potrebbe dirlo. Due
    // proposte economiche aperte insieme non sono un dato: sono due promesse in conflitto.
    const r = await crea(tenant, { applicationId: candidaturaRtl, grossAnnualSalary: 50000 });
    expect(r.statusCode).toBe(409);
    expect((r.json() as Errore).error.code).toBe("OFFER_ALREADY_OPEN");
  });

  it("ma l'unicita' e' PER CANDIDATURA, non per tenant", async () => {
    const r = await crea(tenant, { applicationId: candidaturaBis, grossAnnualSalary: 39000 });
    expect(r.statusCode).toBe(201);
    creati.offerte.push((r.json() as { offerId: string }).offerId);
  });

  it("⭐ RIFIUTA un'offerta su una candidatura di un altro tenant", async () => {
    const r = await crea(tenant, { applicationId: candidaturaAltro, grossAnnualSalary: 30000 });
    expect(r.statusCode).toBe(403);
    expect((r.json() as Errore).error.code).toBe("PERMISSION_DENIED");
  });

  it("l'accettazione data la risposta, e da li' non si torna indietro", async () => {
    const accettata = await patch(tenant, creati.offerte[0]!, { status: "ACCEPTED" });
    expect(accettata.statusCode).toBe(200);
    const b = accettata.json() as { status: string; respondedOn: string | null };
    expect(b.status).toBe("ACCEPTED");
    expect(b.respondedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Il database guarda una riga per volta, non la sua storia: senza il controllo del
    // service un'offerta accettata potrebbe tornare «spedita».
    const indietro = await patch(tenant, creati.offerte[0]!, { status: "SENT" });
    expect(indietro.statusCode).toBe(409);
    expect((indietro.json() as Errore).error.code).toBe("OFFER_ALREADY_CLOSED");
  });

  it("⭐ PLATFORM_ADMIN vede la riga e NON l'importo, e l'assenza e' dichiarata", async () => {
    // La decisione che la migrazione 000364 aveva lasciato aperta: la retribuzione di un
    // candidato esterno si maschera come quella di un dipendente, perche' la ragione di
    // ADR-0032 e' identica — PLATFORM_ADMIN e' un mandato TECNICO, non HR.
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/job-offers/${creati.offerte[0]!}`,
      headers: { cookie: ch(platform.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const b = r.json() as Record<string, unknown> & { masked?: string[] };

    // Il campo e' ASSENTE, non `null` e non `0`: un importo sostituito sarebbe una bugia.
    expect(Object.prototype.hasOwnProperty.call(b, "grossAnnualSalary")).toBe(false);
    // E l'assenza si DICHIARA, o il chiamante non distinguerebbe «non ti e' consentito»
    // da «non c'e'».
    expect(b.masked).toContain("grossAnnualSalary");
    // La riga sopravvive intera: stato, date e candidatura restano visibili.
    expect(b.status).toBe("ACCEPTED");
    expect(b.applicationId).toBe(candidaturaRtl);
  });

  it("⭐ chi ha il mandato HR l'importo lo vede", async () => {
    // Il contro-caso, senza il quale il test precedente proverebbe solo che qualcosa
    // manca — non che manca per la ragione giusta (I20).
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/job-offers/${creati.offerte[0]!}`,
      headers: { cookie: ch(tenant.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { grossAnnualSalary: number; masked?: string[] };
    expect(b.grossAnnualSalary).toBe(42000);
    expect(b.masked).toBeUndefined();
  });

  it("rifiuta una retribuzione non positiva, e la lista filtra per stato", async () => {
    const negativa = await crea(tenant, {
      applicationId: candidaturaBis,
      grossAnnualSalary: -1,
    });
    expect(negativa.statusCode).toBe(400);

    const lista = await suite.app.inject({
      method: "GET",
      url: `/v1/job-offers?applicationId=${candidaturaRtl}&status=ACCEPTED&limit=200`,
      headers: { cookie: ch(tenant.cookies) },
    });
    expect(lista.statusCode).toBe(200);
    const l = lista.json() as { items: Array<{ offerId: string; status: string }> };
    expect(l.items.some((o) => o.offerId === creati.offerte[0]!)).toBe(true);
    expect(l.items.every((o) => o.status === "ACCEPTED")).toBe(true);
  });

  it("chi non ha il permesso non legge e non scrive", async () => {
    const lettura = await suite.app.inject({
      method: "GET",
      url: "/v1/job-offers",
      headers: { cookie: ch(semplice.cookies) },
    });
    expect(lettura.statusCode).toBe(403);

    const scrittura = await crea(semplice, { applicationId: candidaturaRtl });
    expect(scrittura.statusCode).toBe(403);
  });
});
