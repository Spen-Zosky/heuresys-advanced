/**
 * apps/api/test/me-surveys-review.integration.test.ts
 * Il diritto di rivedere le PROPRIE risposte — /v1/me/surveys e /v1/me/surveys/:id
 * sul ramo di LETTURA storica (il ramo di scrittura sta in `me-surveys`).
 *
 * IL DIFETTO CHE QUESTI TEST PRESIDIANO (misurato sul database di produzione,
 * 2026-08-13): delle **8.288 risposte, 0 erano raggiungibili** dalla persona che le
 * aveva scritte. Due cause indipendenti, ciascuna sufficiente da sola:
 *   · l'elenco richiedeva `survey_status = 'active'`, e 786 assegnazioni su 948
 *     puntano a un sondaggio ormai `closed` — si risponde, il ciclo chiude, e con
 *     esso l'unica porta alle proprie parole;
 *   · la guardia del dettaglio richiedeva una riga di assegnazione, e 398 delle 961
 *     coppie persona/sondaggio che HANNO risposte non ce l'hanno affatto.
 *
 * Decisione di Enzo, 2026-08-13: «la persona può rivedere le proprie risposte».
 *
 * NIENTE E' SCRITTO A MANO: la persona, il sondaggio e il numero di risposte attese
 * si ricavano dal database vivo. Un atteso cablato qui duplicherebbe una fonte di
 * verità e mentirebbe al primo cambio di dati.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { passwordFor } from "./helpers/personas.js";
import * as repo from "../src/modules/me/repository.js";

interface Sess { cookies: Map<string, string>; csrfToken: string; userId: string }
function ch(c: Map<string, string>) {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string): Promise<Sess> {
  const r = await loginRaw(t.app, email, passwordFor(email));
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const b = r.json() as { csrfToken: string; user: { userId: string } };
  return { cookies, csrfToken: b.csrfToken, userId: b.user.userId };
}

let suite: TestApp;
/** Una coppia REALE (persona, sondaggio chiuso) con risposte proprie e senza assegnazione. */
let email = "";
let userId = "";
let tenantId = "";
let surveyId = "";
let surveyTitle = "";
let risposteAttese = 0;

describe("/v1/me/surveys — rivedere le proprie risposte (Enzo, 2026-08-13)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    // La coppia si CERCA nel dato: chiusa, con risposte, senza riga di assegnazione,
    // e su una persona impersonabile (le persone fisiche non sono derivabili).
    const { rows } = await pool.query<{
      email: string; user_id: string; tenant_id: string;
      survey_id: string; title: string; n: string;
    }>(
      `SELECT u.user_email AS email, u.user_id, u.user_tenant_id AS tenant_id,
              s.survey_id, s.survey_title AS title, count(*)::text AS n
         FROM sys.sys_survey_responses r
         JOIN sys.sys_surveys s ON s.survey_id = r.survey_response_survey_id
         JOIN sys.sys_users u ON u.user_id = r.survey_response_subject_user_id
        WHERE s.survey_status <> 'active'
          AND NOT EXISTS (SELECT 1 FROM sys.sys_survey_assignments a
                           WHERE a.survey_assignment_survey_id = s.survey_id
                             AND a.survey_assignment_user_id = u.user_id)
        GROUP BY 1,2,3,4,5
        ORDER BY count(*) DESC, u.user_email
        LIMIT 1`,
    );
    const row = rows[0];
    if (!row) {
      throw new Error(
        "nessuna coppia persona/sondaggio-chiuso con risposte e senza assegnazione: " +
          "il difetto che questo file presidia non e' piu' riproducibile sul dato reale",
      );
    }
    email = row.email; userId = row.user_id; tenantId = row.tenant_id;
    surveyId = row.survey_id; surveyTitle = row.title; risposteAttese = Number(row.n);
  });

  afterAll(async () => { await suite?.app.close(); await closePool(); });

  it("l'universo di prova non e' degenere", () => {
    // Guardia sulla guardia: con 0 risposte attese ogni asserzione sotto passerebbe
    // per vuoto, ed e' esattamente il falso verde da cui difendersi.
    expect(risposteAttese).toBeGreaterThan(0);
    expect(surveyId).not.toBe("");
  });

  it("il sondaggio CHIUSO a cui ho risposto compare fra i miei, con il conto delle mie risposte", async () => {
    const s = await login(suite, email);
    const res = await suite.app.inject({
      method: "GET", url: "/v1/me/surveys", headers: { cookie: ch(s.cookies) },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      items: { surveyId: string; status: string; answerCount: number; assignedAt: string | null }[];
    };
    const mio = body.items.find((i) => i.surveyId === surveyId);
    expect(mio, `«${surveyTitle}» deve comparire fra i sondaggi di ${email}`).toBeDefined();
    expect(mio?.status).not.toBe("active");           // e' proprio uno chiuso
    expect(mio?.answerCount).toBe(risposteAttese);    // il conto viene dal DB, non da qui
    expect(mio?.assignedAt).toBeNull();               // raggiunto solo tramite le risposte
  });

  it("il dettaglio si apre e restituisce le MIE risposte, quante ne dice il database", async () => {
    const s = await login(suite, email);
    const res = await suite.app.inject({
      method: "GET", url: `/v1/me/surveys/${surveyId}`, headers: { cookie: ch(s.cookies) },
    });
    expect(res.statusCode).toBe(200);
    const d = res.json() as { title: string; myAnswers: unknown[] };
    expect(d.title).toBe(surveyTitle);
    expect(d.myAnswers.length).toBe(risposteAttese);
  });

  it("leggere si e', SCRIVERE no: senza assegnazione il POST resta 404", async () => {
    const s = await login(suite, email);
    // Il payload dev'essere BEN FORMATO, altrimenti si ferma a 400 sulla validazione e
    // la guardia che si vuole provare non viene nemmeno raggiunta: un test che passa
    // per il motivo sbagliato. La domanda si prende dal sondaggio vero.
    const { rows } = await pool.query<{ id: string; tipo: string }>(
      `SELECT survey_question_id AS id, survey_question_type AS tipo
         FROM sys.sys_survey_questions
        WHERE survey_question_survey_id = $1
        ORDER BY survey_question_display_order NULLS LAST
        LIMIT 1`,
      [surveyId],
    );
    const q = rows[0];
    expect(q, "il sondaggio deve avere almeno una domanda").toBeDefined();
    const answer = q!.tipo === "text"
      ? { questionId: q!.id, textValue: "prova" }
      : { questionId: q!.id, ratingValue: 3 };
    const res = await suite.app.inject({
      method: "POST", url: `/v1/me/surveys/${surveyId}/responses`,
      headers: { cookie: ch(s.cookies), "x-csrf-token": s.csrfToken },
      payload: { answers: [answer] },
    });
    // La lettura si e' allargata; la scrittura no. Se un giorno questo diventasse 201,
    // vorrebbe dire che aver risposto una volta autorizza a riscrivere un ciclo chiuso.
    expect(res.statusCode).toBe(404);
  });

  it("il repository dichiara che il diritto viene dalle risposte, non da un'assegnazione", async () => {
    const claim = await repo.findMySurveyAssignment(pool, userId, tenantId, surveyId);
    expect(claim).not.toBeNull();
    expect(claim?.hasAssignment).toBe(false);
  });

  it("le risposte di un ALTRO restano invisibili", async () => {
    // Una persona che non ha né assegnazione né risposte su quel sondaggio: 404 secco,
    // indistinguibile da un sondaggio inesistente (no-leak).
    const { rows } = await pool.query<{ email: string }>(
      `SELECT u.user_email AS email
         FROM sys.sys_users u
        WHERE u.user_tenant_id = $2
          AND u.user_status = 'ACTIVE'
          AND NOT EXISTS (SELECT 1 FROM sys.sys_survey_responses r
                           WHERE r.survey_response_survey_id = $1
                             AND r.survey_response_subject_user_id = u.user_id)
          AND NOT EXISTS (SELECT 1 FROM sys.sys_survey_assignments a
                           WHERE a.survey_assignment_survey_id = $1
                             AND a.survey_assignment_user_id = u.user_id)
        ORDER BY u.user_email
        LIMIT 1`,
      [surveyId, tenantId],
    );
    const estraneo = rows[0]?.email;
    expect(estraneo, "serve una persona estranea al sondaggio per provare il no-leak").toBeDefined();
    const s = await login(suite, estraneo as string);
    const res = await suite.app.inject({
      method: "GET", url: `/v1/me/surveys/${surveyId}`, headers: { cookie: ch(s.cookies) },
    });
    expect(res.statusCode).toBe(404);
  });
});
