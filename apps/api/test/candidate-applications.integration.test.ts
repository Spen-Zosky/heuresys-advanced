/**
 * apps/api/test/candidate-applications.integration.test.ts
 *
 * Test di integrazione per /v1/candidate-applications/* (sys.sys_candidate_applications).
 * #54 F3, quarta fetta — la CERNIERA del ciclo: lega una persona a un annuncio.
 *
 * ⚠ I casi che contano davvero sono i due che possono FALLIRE per una ragione che nessun
 * vincolo del database coglierebbe:
 *   · una candidatura che scavalca il tenant — le due FK guardano ciascuna la propria
 *     tabella e non si parlano, quindi per PostgreSQL «persona dell'azienda A candidata
 *     all'annuncio dell'azienda B» e' una riga perfettamente valida. Se il service
 *     smettesse di controllarlo, ogni altro test resterebbe verde;
 *   · un rifiuto senza motivo quando la fase diventa REJECTED e il motivo era gia' assente
 *     sulla riga: lo schema non puo' vederlo (guarda il corpo, non lo stato di arrivo), e
 *     il CHECK del database risponderebbe 500 su un errore che e' del chiamante.
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
const PREFISSO = `it-appl-${randomUUID().slice(0, 8)}`;

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
let candidatoRtl: string;
let annuncioRtl: string;
let candidatoAltro: string;
let requisizioneRtl: string;

const candidatiCreati: string[] = [];
const annunciCreati: string[] = [];
const requisizioniCreate: string[] = [];
const candidatureCreate: string[] = [];
/**
 * ⚠ La data di arrivo si prende DAL DATABASE, non da `new Date()`.
 * `new Date().toISOString().slice(0,10)` è UTC; `current_date` di PostgreSQL è il fuso del
 * server. Fra mezzanotte e l'alba le due dicono giorni DIVERSI, e una chiusura datata «oggi
 * UTC» risulta precedente a un arrivo datato «oggi locale» — 409 invece di 200. Non è
 * teorico: questo test è passato tutto il giorno ed è diventato rosso alle 00:30, nella
 * corsa integrale della stessa sessione che lo aveva scritto.
 */
let arrivoDellaPrima = "";

async function crea(sessione: S, payload: Record<string, unknown>) {
  return suite.app.inject({
    method: "POST",
    url: "/v1/candidate-applications",
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
    url: `/v1/candidate-applications/${id}`,
    headers: {
      cookie: ch(sessione.cookies),
      "x-csrf-token": sessione.csrfToken,
      "content-type": "application/json",
    },
    payload,
  });
}

/** Un candidato di servizio, scritto direttamente: la fetta in prova e' un'altra. */
async function seminaCandidato(tenantId: string, etichetta: string): Promise<string> {
  const r = await pool.query<{ candidate_id: string }>(
    `INSERT INTO sys.sys_candidates
       (candidate_tenant_id, candidate_first_name, candidate_last_name,
        candidate_email, candidate_source, candidate_status)
     VALUES ($1, 'Prova', $2, $3, 'DIRECT', 'ACTIVE')
     RETURNING candidate_id`,
    [tenantId, etichetta, `${PREFISSO}-${etichetta}@example.invalid`],
  );
  const id = r.rows[0]!.candidate_id;
  candidatiCreati.push(id);
  return id;
}

describe("/v1/candidate-applications/* integration", () => {
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

    candidatoRtl = await seminaCandidato(tenantRtl, "rtl");
    candidatoAltro = await seminaCandidato(tenantAltro, "altro");

    // Un annuncio di servizio. Le colonne obbligatorie e i vocabolari sono stati LETTI dal
    // modello (`information_schema` + i CHECK), non ricordati: un annuncio pretende una
    // requisizione, quindi ne nasce prima una, e la requisizione pretende a sua volta una
    // posizione vera del tenant.
    const pos = await pool.query<{ position_id: string }>(
      `SELECT position_id FROM sys.sys_positions
        WHERE position_tenant_id = $1 ORDER BY position_id LIMIT 1`,
      [tenantRtl],
    );
    if (!pos.rows[0]) throw new Error("nessuna posizione nel tenant RTL: verifica cieca");

    const req = await pool.query<{ requisition_id: string }>(
      `INSERT INTO sys.sys_job_requisitions
         (requisition_tenant_id, requisition_code, requisition_position_id,
          requisition_headcount, requisition_status)
       VALUES ($1, $2, $3, 1, 'OPEN')
       RETURNING requisition_id`,
      [tenantRtl, `${PREFISSO}-REQ`, pos.rows[0].position_id],
    );
    requisizioneRtl = req.rows[0]!.requisition_id;
    requisizioniCreate.push(requisizioneRtl);

    const p = await pool.query<{ posting_id: string }>(
      `INSERT INTO sys.sys_job_postings
         (posting_tenant_id, posting_requisition_id, posting_code, posting_title,
          posting_visibility, posting_status)
       VALUES ($1, $2, $3, $4, 'INTERNAL', 'DRAFT')
       RETURNING posting_id`,
      [tenantRtl, requisizioneRtl, `${PREFISSO}-POST`, `${PREFISSO} annuncio`],
    );
    annuncioRtl = p.rows[0]!.posting_id;
    annunciCreati.push(annuncioRtl);
  });

  afterAll(async () => {
    for (const id of candidatureCreate) {
      try {
        await pool.query(
          `DELETE FROM sys.sys_candidate_applications WHERE application_id = $1`,
          [id],
        );
      } catch {
        /* la pulizia non deve mascherare l'esito dei test */
      }
    }
    for (const id of annunciCreati) {
      try {
        await pool.query(`DELETE FROM sys.sys_job_postings WHERE posting_id = $1`, [id]);
      } catch {
        /* idem */
      }
    }
    for (const id of requisizioniCreate) {
      try {
        await pool.query(`DELETE FROM sys.sys_job_requisitions WHERE requisition_id = $1`, [id]);
      } catch {
        /* idem */
      }
    }
    for (const id of candidatiCreati) {
      try {
        await pool.query(`DELETE FROM sys.sys_candidates WHERE candidate_id = $1`, [id]);
      } catch {
        /* idem */
      }
    }
    await suite.app.close();
    await closePool();
  });

  it("registra una candidatura, e nasce APPLIED", async () => {
    const r = await crea(tenant, { candidateId: candidatoRtl, postingId: annuncioRtl });
    expect(r.statusCode).toBe(201);
    const b = r.json() as { applicationId: string; stage: string; appliedOn: string };
    candidatureCreate.push(b.applicationId);
    arrivoDellaPrima = b.appliedOn;
    expect(b.stage).toBe("APPLIED");
    expect(b.appliedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("⭐ RIFIUTA una candidatura che scavalca il tenant", async () => {
    // Il caso che nessun vincolo del database coglierebbe: le due FK sono valide, ma la
    // persona e' di un'altra azienda. Senza il controllo del service questa riga entrerebbe.
    const r = await crea(tenant, { candidateId: candidatoAltro, postingId: annuncioRtl });
    expect(r.statusCode).toBe(403);
    expect((r.json() as Errore).error.code).toBe("PERMISSION_DENIED");
  });

  it("rifiuta la stessa persona due volte sullo stesso annuncio", async () => {
    const r = await crea(tenant, { candidateId: candidatoRtl, postingId: annuncioRtl });
    expect(r.statusCode).toBe(409);
    expect((r.json() as Errore).error.code).toBe("APPLICATION_DUPLICATE");
  });

  it("un candidato o un annuncio inesistenti danno 404, e si distinguono", async () => {
    const senzaCandidato = await crea(tenant, {
      candidateId: randomUUID(),
      postingId: annuncioRtl,
    });
    expect(senzaCandidato.statusCode).toBe(404);
    const senzaAnnuncio = await crea(tenant, {
      candidateId: candidatoRtl,
      postingId: randomUUID(),
    });
    expect(senzaAnnuncio.statusCode).toBe(404);
  });

  it("avanza di fase, e la lista filtra per fase", async () => {
    const id = candidatureCreate[0]!;
    const r = await patch(tenant, id, { stage: "SCREENING" });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { stage: string }).stage).toBe("SCREENING");

    const lista = await suite.app.inject({
      method: "GET",
      url: "/v1/candidate-applications?stage=SCREENING&limit=200",
      headers: { cookie: ch(tenant.cookies) },
    });
    expect(lista.statusCode).toBe(200);
    const b = lista.json() as { items: Array<{ applicationId: string; stage: string }> };
    expect(b.items.some((i) => i.applicationId === id)).toBe(true);
    expect(b.items.every((i) => i.stage === "SCREENING")).toBe(true);
  });

  it("⭐ RIFIUTA un rifiuto senza motivo, anche quando il motivo manca gia' sulla riga", async () => {
    // ⚠ Questo caso ha CAMBIATO il codice invece di adattarsi a esso. La prima stesura
    // metteva il controllo anche nello schema, che rispondeva 400 — e il test lo ha
    // smentito: lo schema guarda il CORPO e non sa se il motivo e' gia' sulla riga, quindi
    // avrebbe respinto anche un `{stage:'REJECTED'}` legittimo. Il controllo vive dove
    // l'informazione c'e', nel service, e la risposta giusta e' 409.
    const id = candidatureCreate[0]!;
    const r = await patch(tenant, id, { stage: "REJECTED" });
    expect(r.statusCode).toBe(409);
    expect((r.json() as Errore).error.code).toBe("APPLICATION_REJECTED_WITHOUT_REASON");
  });

  it("accetta il rifiuto quando porta il suo motivo", async () => {
    const id = candidatureCreate[0]!;
    const r = await patch(tenant, id, {
      stage: "REJECTED",
      rejectReason: "profilo non allineato alla richiesta",
      // la stessa data che il database ha scritto in `appliedOn`: chiudere il giorno
      // dell'arrivo è legittimo (il CHECK è `>=`), e non dipende dal fuso di chi lo scrive
      closedOn: arrivoDellaPrima,
    });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { stage: string; rejectReason: string | null };
    expect(b.stage).toBe("REJECTED");
    expect(b.rejectReason).toContain("non allineato");
  });

  it("rifiuta una chiusura precedente all'arrivo", async () => {
    const nuovoCand = await seminaCandidato(tenantRtl, "chiusura");
    const c = await crea(tenant, {
      candidateId: nuovoCand,
      postingId: annuncioRtl,
      appliedOn: "2026-06-01",
    });
    expect(c.statusCode).toBe(201);
    const id = (c.json() as { applicationId: string }).applicationId;
    candidatureCreate.push(id);

    const r = await patch(tenant, id, { closedOn: "2026-05-01" });
    expect(r.statusCode).toBe(409);
    expect((r.json() as Errore).error.code).toBe("APPLICATION_CLOSED_BEFORE_APPLIED");
  });

  it("chi non ha il permesso non legge e non scrive", async () => {
    const lettura = await suite.app.inject({
      method: "GET",
      url: "/v1/candidate-applications",
      headers: { cookie: ch(semplice.cookies) },
    });
    expect(lettura.statusCode).toBe(403);

    const scrittura = await crea(semplice, {
      candidateId: candidatoRtl,
      postingId: annuncioRtl,
    });
    expect(scrittura.statusCode).toBe(403);
  });
});
