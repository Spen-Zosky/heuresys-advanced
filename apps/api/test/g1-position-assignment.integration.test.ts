/**
 * apps/api/test/g1-position-assignment.integration.test.ts — mandato K, G-1 (D4=B, F6, passo 67).
 *
 * Il gesto assegna/termina/trasferisci nasce come PROPOSTA sotto il modulo approvazioni:
 * PEOPLE_MANAGER propone, un approvatore (titolare di `user_position_assignment:update`, mai il
 * proponente) approva e applica, e SOLO allora l'effetto scrive — mai la rotta diretta (D4=B).
 * I1: terminare/trasferire chiude un intervallo (`end_date`), non cancella mai la riga.
 *
 * Tutto su persone e posizioni REALI di RTL_BANK; tutto rollbackato dall'isolamento per file
 * (D-52) — sicuro spostare una persona vera, la transazione del file non lascia residuo.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { closePool, pool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { readCollaudoKey, deriveCollaudoPassword } from "../scripts/collaudo-access.mjs";
import { senzaCacheDiSessione } from "./helpers/session-cache.js";
import { guasti } from "../src/modules/approvals/effects/position-assignment.js";

senzaCacheDiSessione();

const PEOPLE_MANAGER_EMAIL = "people-manager@collaudo.invalid";
// Approvatore: titolare reale di user_position_assignment:update su RTL_BANK (HRMS_MANAGER,
// plenipotenziario, I22) — diverso dal proponente, come "un approvatore approva" presuppone.
const HRMS_MANAGER_EMAIL = "maria.colombo@rtl-bank.org";
// TEAM_LEADER "puro" (nessun ruolo plenipotenziario in aggiunta — misurato: molte persone RTL
// portano piu' ruoli insieme, es. valentina.conti ha ANCHE HRMS_MANAGER).
const TEAM_LEADER_EMAIL = "marco.rinaldi@rtl-bank.org"; // nessun permesso user_position_assignment:*

interface S { cookies: Map<string, string>; csrfToken: string; userId: string }
const ch = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
const headers = (s: S) => ({ cookie: ch(s.cookies), "x-csrf-token": s.csrfToken });

async function login(t: TestApp, email: string, password: string): Promise<S> {
  const r = await loginRaw(t.app, email, password);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const b = r.json() as { csrfToken: string; user: { userId: string } };
  return { cookies, csrfToken: b.csrfToken, userId: b.user.userId };
}

let suite: TestApp;
let peopleManager: S;
let hrmsManager: S;
let teamLeader: S;

const RTL_BANK = "86ba7a65-217f-48ba-8ce5-5c09b40a66b0";
const HEURESYS_POSITION_OUT_OF_TENANT = "2e535a31-2f47-4a1b-8fca-f9fba45a79d7"; // CEO & Founder, HEURESYS

/** Conteggio TOTALE delle righe (ogni stato, ogni kind) — il mandato lo chiama "il conteggio
 *  totale": I1 non cancella mai, quindi sale di 1 a ogni scrittura reale (assegna/trasferisci)
 *  e MAI scende. Diverso, apposta, da "quanti PRIMARY ACTIVE ci sono ORA": un TRASFERIMENTO
 *  chiude una riga e ne apre un'altra, quindi quel sotto-conteggio resta invariato per
 *  costruzione — misurato qui, non presunto, dopo un primo giro che lo confondeva col totale. */
async function totaleRighe(): Promise<number> {
  const r = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM sys.sys_user_position_assignments
      WHERE user_position_assignment_tenant_id = $1`,
    [RTL_BANK],
  );
  return Number(r.rows[0]!.n);
}

async function assignmentAttivo(userEmail: string): Promise<{ id: string; positionId: string }> {
  const r = await pool.query<{ id: string; position_id: string }>(
    `SELECT a.user_position_assignment_id AS id, a.user_position_assignment_position_id AS position_id
       FROM sys.sys_user_position_assignments a
       JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id
      WHERE u.user_email = $1 AND a.user_position_assignment_kind = 'PRIMARY' AND a.user_position_assignment_status = 'ACTIVE'`,
    [userEmail],
  );
  const row = r.rows[0];
  if (!row) throw new Error(`${userEmail} non ha un incarico PRIMARY ACTIVE — dataset RTL cambiato?`);
  return { id: row.id, positionId: row.position_id };
}

async function posizioneLibera(escludi: string[]): Promise<string> {
  const r = await pool.query<{ position_id: string }>(
    `SELECT p.position_id FROM sys.sys_positions p
      WHERE p.position_tenant_id = $1 AND NOT (p.position_id = ANY($2::uuid[]))
        AND NOT EXISTS (
          SELECT 1 FROM sys.sys_user_position_assignments a
           WHERE a.user_position_assignment_position_id = p.position_id
             AND a.user_position_assignment_kind = 'PRIMARY' AND a.user_position_assignment_status = 'ACTIVE')
      LIMIT 1`,
    [RTL_BANK, escludi],
  );
  const row = r.rows[0];
  if (!row) throw new Error("nessuna posizione libera in RTL_BANK — dataset cambiato?");
  return row.position_id;
}

function oggi(): string {
  return new Date().toISOString().slice(0, 10);
}

/** propone → approva (primo step) → applica. Ritorna il body dell'apply. */
async function proponiApprovaApplica(url: string, payload: Record<string, unknown>) {
  const submit = await suite.app.inject({ method: "POST", url, headers: headers(peopleManager), payload });
  expect(submit.statusCode).toBe(201);
  const { approvalRequestId } = submit.json() as { approvalRequestId: string };

  const detail = await suite.app.inject({
    method: "GET", url: `/v1/approvals/${approvalRequestId}`, headers: { cookie: ch(hrmsManager.cookies) },
  });
  expect(detail.statusCode).toBe(200);
  const step = (detail.json() as { steps: { approvalStepId: string; approverUserId: string }[] })
    .steps.find((s) => s.approverUserId === hrmsManager.userId);
  expect(step, "HRMS_MANAGER non e' fra gli approvatori risolti").toBeDefined();

  const decide = await suite.app.inject({
    method: "POST", url: `/v1/approvals/${approvalRequestId}/steps/${step!.approvalStepId}/decide`,
    headers: headers(hrmsManager), payload: { decision: "APPROVE" },
  });
  expect(decide.statusCode).toBe(200);

  const apply = await suite.app.inject({
    method: "POST", url: `/v1/approvals/${approvalRequestId}/apply`, headers: headers(hrmsManager),
  });
  return apply;
}

describe("mandato K, G-1 — assegna/termina/trasferisci via approvazioni (D4=B)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    const key = readCollaudoKey();
    peopleManager = await login(suite, PEOPLE_MANAGER_EMAIL, deriveCollaudoPassword(key, PEOPLE_MANAGER_EMAIL));
    hrmsManager = await login(suite, HRMS_MANAGER_EMAIL, TEST_PERSONA_PASSWORD);
    teamLeader = await login(suite, TEAM_LEADER_EMAIL, TEST_PERSONA_PASSWORD);
  }, 60_000);

  afterAll(async () => {
    guasti.transferNonApre = false;
    await suite.app.close();
    await closePool();
  });

  it("(a) PEOPLE_MANAGER propone il trasferimento, HRMS_MANAGER approva: riga vecchia chiusa, nuova aperta, totale +1", async () => {
    const persona = await assignmentAttivo("alberto.colombo@rtl-bank.org");
    const nuova = await posizioneLibera([persona.positionId]);
    const prima = await totaleRighe();

    const apply = await proponiApprovaApplica(
      `/v1/user-position-assignments/${persona.id}/transfer`,
      { newPositionId: nuova, startDate: oggi() },
    );
    expect(apply.statusCode).toBe(200);
    expect((apply.json() as { status: string }).status).toBe("APPLIED");

    const vecchia = await pool.query<{ status: string; end_date: string | null }>(
      `SELECT user_position_assignment_status AS status, user_position_assignment_end_date::text AS end_date
         FROM sys.sys_user_position_assignments WHERE user_position_assignment_id = $1`,
      [persona.id],
    );
    expect(vecchia.rows[0]!.status).toBe("ENDED");
    expect(vecchia.rows[0]!.end_date, "I1: l'intervallo si chiude con una data, la riga resta").not.toBeNull();

    const nuovaRiga = await pool.query<{ n: string; origine: string }>(
      `SELECT count(*)::text AS n, max(origine_dato) AS origine FROM sys.sys_user_position_assignments
        WHERE user_position_assignment_user_id = (SELECT user_id FROM sys.sys_users WHERE user_email = 'alberto.colombo@rtl-bank.org')
          AND user_position_assignment_position_id = $1 AND user_position_assignment_status = 'ACTIVE'`,
      [nuova],
    );
    expect(Number(nuovaRiga.rows[0]!.n)).toBe(1);
    expect(nuovaRiga.rows[0]!.origine).toBe("NATIVO");

    expect(await totaleRighe(), "DIF-4: totale ORA, non un letterale").toBe(prima + 1);
  }, 60_000);

  it("(b) TEAM_LEADER non ha il permesso: 403 (non 404, non un errore di route)", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/user-position-assignments", headers: headers(teamLeader),
      payload: { userId: peopleManager.userId, positionId: HEURESYS_POSITION_OUT_OF_TENANT, startDate: oggi() },
    });
    expect(r.statusCode).toBe(403);
  });

  it("(c) una posizione di un altro tenant: 404 (anti-enumerazione, non 403)", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/user-position-assignments", headers: headers(peopleManager),
      payload: { userId: peopleManager.userId, positionId: HEURESYS_POSITION_OUT_OF_TENANT, startDate: oggi() },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error?: { code?: string } }).error?.code).not.toBe("FORBIDDEN");
  });

  it("(d) una proposta non approvata non scrive nulla: totale +0", async () => {
    const persona = await assignmentAttivo("alberto.messina@rtl-bank.org");
    const nuova = await posizioneLibera([persona.positionId]);
    const prima = await totaleRighe();

    const submit = await suite.app.inject({
      method: "POST", url: `/v1/user-position-assignments/${persona.id}/transfer`,
      headers: headers(peopleManager), payload: { newPositionId: nuova, startDate: oggi() },
    });
    expect(submit.statusCode).toBe(201);
    // Nessuna decisione, nessun apply: la riga resta esattamente com'era.
    expect(await totaleRighe()).toBe(prima);
    const ancoraAttiva = await pool.query(
      `SELECT 1 FROM sys.sys_user_position_assignments
        WHERE user_position_assignment_id = $1 AND user_position_assignment_status = 'ACTIVE'`,
      [persona.id],
    );
    expect(ancoraAttiva.rowCount).toBe(1);
  }, 30_000);

  it("controprova — con l'effetto sabotato (chiude senza aprire) il totale NON sale: la prova sa fallire", async () => {
    const persona = await assignmentAttivo("alessandro.gatti@rtl-bank.org");
    const nuova = await posizioneLibera([persona.positionId]);
    const prima = await totaleRighe();

    guasti.transferNonApre = true;
    try {
      const apply = await proponiApprovaApplica(
        `/v1/user-position-assignments/${persona.id}/transfer`,
        { newPositionId: nuova, startDate: oggi() },
      );
      // L'effetto sabotato non lancia: applica "con successo" un trasferimento zoppo.
      expect(apply.statusCode).toBe(200);
    } finally {
      guasti.transferNonApre = false;
    }

    // Se l'effetto fosse quello vero (come nel test (a)), qui il totale sarebbe prima+1
    // (una riga NUOVA nasce, I1: mai una DELETE). Sabotato, la vecchia riga si chiude con un
    // UPDATE (non aggiunge una riga) e la nuova non nasce mai (INSERT saltato): il totale
    // resta esattamente prima — la persona e' rimasta SENZA incarico attivo (misurato sotto),
    // il difetto peggiore possibile, e la prova del conteggio lo avrebbe mancato se avesse
    // guardato solo "il totale non e' sceso": qui deve VEDERE che non e' salito.
    expect(await totaleRighe(), "controprova: il sabotaggio doveva lasciare il totale invariato (nessuna riga nuova nata)").toBe(prima);

    const ancoraAttiva = await pool.query(
      `SELECT 1 FROM sys.sys_user_position_assignments
        WHERE user_position_assignment_user_id = (SELECT user_id FROM sys.sys_users WHERE user_email = 'alessandro.gatti@rtl-bank.org')
          AND user_position_assignment_kind = 'PRIMARY' AND user_position_assignment_status = 'ACTIVE'`,
    );
    expect(ancoraAttiva.rowCount, "la persona e' rimasta senza alcun incarico attivo: e' questo il difetto che la controprova rivela").toBe(0);
  }, 60_000);
});
