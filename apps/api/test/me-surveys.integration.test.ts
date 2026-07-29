/**
 * apps/api/test/me-surveys.integration.test.ts
 * ESS self-response write-path (Surveys-M2) — /v1/me/surveys{,/:id,/:id/responses}.
 *
 * Exercises the live DB through the SSH tunnel (no mocks): a real USER persona
 * (tommaso.fiore@rtl-bank.org) lists the surveys assigned to them, opens one,
 * submits answers, and gets the duplicate-submit / not-assigned / type-mismatch
 * guards. The afterAll cleanup is CRITICAL: it deletes the inserted responses and
 * resets the assignment's completed_at so the later web E2E (tommaso answers the
 * Q4 Pulse survey) starts from a clean, un-completed state.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;

// La rilevazione su cui gira questo test si RICAVA dal database: è quella
// aperta e assegnata alla persona. Prima era un UUID scritto a mano — quello
// della "Q4 2025 Pulse Survey", che però risultava «attiva» con la finestra di
// risposta chiusa da otto mesi. Quando la storia C8 ha chiuso i cicli scaduti,
// il test è caduto: non perché il prodotto fosse rotto, ma perché si appoggiava
// a uno stato incoerente. Derivarla dalla fonte lo rende indipendente da quale
// rilevazione sia aperta oggi.
let ACTIVE_SURVEY_ID = "";
let ACTIVE_SURVEY_QUESTIONS = 0;

interface S { cookies: Map<string, string>; csrfToken: string; userId: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { csrfToken: string; user: { userId: string } };
  return { cookies, csrfToken: body.csrfToken, userId: body.user.userId };
}

let suite: TestApp;
let employeeS: S;

describe("/v1/me/surveys ESS self-response (Surveys-M2)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    employeeS = await login(suite, "tommaso.fiore@rtl-bank.org");
    const { rows } = await pool.query<{ id: string }>(
      `SELECT s.survey_id AS id
         FROM sys.sys_surveys s
         JOIN sys.sys_survey_assignments a ON a.survey_assignment_survey_id = s.survey_id
         JOIN sys.sys_survey_questions q ON q.survey_question_survey_id = s.survey_id
        WHERE a.survey_assignment_user_id = $1
          AND s.survey_status = 'active'
          AND q.survey_question_type IN ('rating', 'nps')
        GROUP BY s.survey_id
        ORDER BY min(s.survey_start_date) DESC
        LIMIT 1`,
      [employeeS.userId],
    );
    const row = rows[0];
    if (!row) throw new Error("nessuna rilevazione aperta e assegnata alla persona di prova");
    ACTIVE_SURVEY_ID = row.id;
    const qc = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_survey_questions
        WHERE survey_question_survey_id = $1`,
      [ACTIVE_SURVEY_ID],
    );
    ACTIVE_SURVEY_QUESTIONS = Number(qc.rows[0]?.n ?? 0);
  });

  afterAll(async () => {
    // CRITICAL — undo the live writes so the web E2E (tommaso answers Q4) is repeatable.
    try {
      await pool.query(
        `DELETE FROM sys.sys_survey_responses
          WHERE survey_response_subject_user_id = $1
            AND survey_response_natural_key LIKE 'ESS::' || $2 || '::%'`,
        [employeeS.userId, ACTIVE_SURVEY_ID],
      );
    } catch { /* ignore */ }
    try {
      await pool.query(
        `UPDATE sys.sys_survey_assignments
            SET survey_assignment_completed_at = NULL
          WHERE survey_assignment_user_id = $1
            AND survey_assignment_survey_id = $2`,
        [employeeS.userId, ACTIVE_SURVEY_ID],
      );
    } catch { /* ignore */ }
    await suite.app.close();
    await closePool();
  });

  it("GET /v1/me/surveys elenca le rilevazioni aperte assegnate alla persona", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/me/surveys",
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      items: Array<{ surveyId: string; status: string; questionCount: number; completedAt: string | null }>;
      total: number;
    };
    expect(body.total).toBeGreaterThanOrEqual(1);
    const q4 = body.items.find((s) => s.surveyId === ACTIVE_SURVEY_ID);
    expect(q4).toBeDefined();
    expect(q4!.status).toBe("active");
    expect(q4!.questionCount).toBe(ACTIVE_SURVEY_QUESTIONS);
    expect(q4!.completedAt).toBeNull();
  });

  it("GET /v1/me/surveys/:id restituisce le domande della rilevazione e nessuna risposta propria", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/me/surveys/${ACTIVE_SURVEY_ID}`,
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      surveyId: string;
      questions: Array<{ questionId: string; type: string; displayOrder: number | null }>;
      myAnswers: Array<unknown>;
    };
    expect(body.surveyId).toBe(ACTIVE_SURVEY_ID);
    expect(body.questions).toHaveLength(ACTIVE_SURVEY_QUESTIONS);
    // ordered by display_order
    // gli ordini sono una sequenza consecutiva da 1, quante che siano le domande
    expect(body.questions.map((q) => q.displayOrder))
      .toEqual(Array.from({ length: ACTIVE_SURVEY_QUESTIONS }, (_, i) => i + 1));
    expect(body.myAnswers).toHaveLength(0);
  });

  it("type mismatch (textValue for a rating/nps question) → 422 SURVEY_ANSWER_TYPE_MISMATCH", async () => {
    // Run BEFORE the successful submit so Q4 is still uncompleted: a 422 is thrown by the type
    // guard (which runs AFTER the already-answered guard), and it persists nothing / leaves the
    // assignment un-completed (it throws before the transaction). Q4 has nps+rating questions.
    const detail = await suite.app.inject({
      method: "GET", url: `/v1/me/surveys/${ACTIVE_SURVEY_ID}`,
      headers: { cookie: ch(employeeS.cookies) },
    });
    const questions = (detail.json() as {
      questions: Array<{ questionId: string; type: string }>;
    }).questions;
    const ratingQ = questions.find((q) => q.type === "rating" || q.type === "nps");
    expect(ratingQ).toBeDefined();

    const post = await suite.app.inject({
      method: "POST", url: `/v1/me/surveys/${ACTIVE_SURVEY_ID}/responses`,
      headers: {
        cookie: ch(employeeS.cookies), "x-csrf-token": employeeS.csrfToken,
        "content-type": "application/json",
      },
      // textValue for a rating/nps question is a type mismatch.
      payload: { answers: [{ questionId: ratingQ!.questionId, textValue: "should be a number" }] },
    });
    expect(post.statusCode).toBe(422);
    expect((post.json() as { error: { code: string } }).error.code).toBe("SURVEY_ANSWER_TYPE_MISMATCH");

    // The failed submit must NOT have persisted anything nor completed the assignment.
    const dbRows = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_survey_responses
        WHERE survey_response_subject_user_id = $1 AND survey_response_survey_id = $2`,
      [employeeS.userId, ACTIVE_SURVEY_ID],
    );
    expect(Number(dbRows.rows[0]!.n)).toBe(0);
  });

  it("POST /v1/me/surveys/:id/responses invia una risposta per ogni domanda → 201 + persiste", async () => {
    // Read the real question ids/types from the detail (no hard-coded question ids beyond the survey).
    const detail = await suite.app.inject({
      method: "GET", url: `/v1/me/surveys/${ACTIVE_SURVEY_ID}`,
      headers: { cookie: ch(employeeS.cookies) },
    });
    const questions = (detail.json() as {
      questions: Array<{ questionId: string; type: string }>;
    }).questions;
    // tutte le domande sono nps/rating e prendono un voto. Il voto resta nella
    // scala 1-10 qualunque sia il numero di domande: prima era `7 + indice`, che
    // con otto domande arrivava a 14 e faceva rifiutare la richiesta.
    const answers = questions.map((q, i) => ({ questionId: q.questionId, ratingValue: 6 + (i % 4) }));

    const post = await suite.app.inject({
      method: "POST", url: `/v1/me/surveys/${ACTIVE_SURVEY_ID}/responses`,
      headers: {
        cookie: ch(employeeS.cookies), "x-csrf-token": employeeS.csrfToken,
        "content-type": "application/json",
      },
      payload: { answers },
    });
    expect(post.statusCode).toBe(201);
    const result = post.json() as { submitted: number; completedAt: string };
    expect(result.submitted).toBe(ACTIVE_SURVEY_QUESTIONS);
    expect(result.completedAt).toBeTruthy();

    // Prove persistence directly against the DB.
    const dbRows = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_survey_responses
        WHERE survey_response_subject_user_id = $1 AND survey_response_survey_id = $2`,
      [employeeS.userId, ACTIVE_SURVEY_ID],
    );
    expect(Number(dbRows.rows[0]!.n)).toBe(ACTIVE_SURVEY_QUESTIONS);

    // And via the detail endpoint: myAnswers now populated + completedAt set.
    const after = await suite.app.inject({
      method: "GET", url: `/v1/me/surveys/${ACTIVE_SURVEY_ID}`,
      headers: { cookie: ch(employeeS.cookies) },
    });
    const afterBody = after.json() as {
      completedAt: string | null;
      myAnswers: Array<{ questionId: string; ratingValue: number | null }>;
    };
    expect(afterBody.completedAt).not.toBeNull();
    expect(afterBody.myAnswers).toHaveLength(ACTIVE_SURVEY_QUESTIONS);
    expect(afterBody.myAnswers.every((a) => a.ratingValue !== null)).toBe(true);
  });

  it("re-submitting the same survey → 409 SURVEY_ALREADY_ANSWERED", async () => {
    const detail = await suite.app.inject({
      method: "GET", url: `/v1/me/surveys/${ACTIVE_SURVEY_ID}`,
      headers: { cookie: ch(employeeS.cookies) },
    });
    const questions = (detail.json() as { questions: Array<{ questionId: string }> }).questions;
    const answers = questions.map((q) => ({ questionId: q.questionId, ratingValue: 5 }));

    const post = await suite.app.inject({
      method: "POST", url: `/v1/me/surveys/${ACTIVE_SURVEY_ID}/responses`,
      headers: {
        cookie: ch(employeeS.cookies), "x-csrf-token": employeeS.csrfToken,
        "content-type": "application/json",
      },
      payload: { answers },
    });
    expect(post.statusCode).toBe(409);
    expect((post.json() as { error: { code: string } }).error.code).toBe("SURVEY_ALREADY_ANSWERED");
  });

  it("a non-assigned / cross-tenant survey id → 404 (no leak)", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/me/surveys/${randomUUID()}`,
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(404);
  });
});
