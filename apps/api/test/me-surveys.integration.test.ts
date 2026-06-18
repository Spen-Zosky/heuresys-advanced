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

const PWD = "Admin#PassW0rd!";

// Seeded fixture (verified live): "Q4 2025 Pulse Survey" assigned to tommaso, 3 questions
// (1 nps + 2 rating — all three take a ratingValue per the type↔column rule).
const Q4_SURVEY_ID = "78145194-fdae-409d-8b15-deba4b0146c6";

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
  });

  afterAll(async () => {
    // CRITICAL — undo the live writes so the web E2E (tommaso answers Q4) is repeatable.
    try {
      await pool.query(
        `DELETE FROM sys.sys_survey_responses
          WHERE survey_response_subject_user_id = $1
            AND survey_response_natural_key LIKE 'ESS::' || $2 || '::%'`,
        [employeeS.userId, Q4_SURVEY_ID],
      );
    } catch { /* ignore */ }
    try {
      await pool.query(
        `UPDATE sys.sys_survey_assignments
            SET survey_assignment_completed_at = NULL
          WHERE survey_assignment_user_id = $1
            AND survey_assignment_survey_id = $2`,
        [employeeS.userId, Q4_SURVEY_ID],
      );
    } catch { /* ignore */ }
    await suite.app.close();
    await closePool();
  });

  it("GET /v1/me/surveys lists the assigned active surveys incl. the Q4 Pulse one", async () => {
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
    const q4 = body.items.find((s) => s.surveyId === Q4_SURVEY_ID);
    expect(q4).toBeDefined();
    expect(q4!.status).toBe("active");
    expect(q4!.questionCount).toBe(3);
    expect(q4!.completedAt).toBeNull();
  });

  it("GET /v1/me/surveys/:id returns 3 questions and (initially) empty myAnswers", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/me/surveys/${Q4_SURVEY_ID}`,
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      surveyId: string;
      questions: Array<{ questionId: string; type: string; displayOrder: number | null }>;
      myAnswers: Array<unknown>;
    };
    expect(body.surveyId).toBe(Q4_SURVEY_ID);
    expect(body.questions).toHaveLength(3);
    // ordered by display_order
    expect(body.questions.map((q) => q.displayOrder)).toEqual([1, 2, 3]);
    expect(body.myAnswers).toHaveLength(0);
  });

  it("type mismatch (textValue for a rating/nps question) → 422 SURVEY_ANSWER_TYPE_MISMATCH", async () => {
    // Run BEFORE the successful submit so Q4 is still uncompleted: a 422 is thrown by the type
    // guard (which runs AFTER the already-answered guard), and it persists nothing / leaves the
    // assignment un-completed (it throws before the transaction). Q4 has nps+rating questions.
    const detail = await suite.app.inject({
      method: "GET", url: `/v1/me/surveys/${Q4_SURVEY_ID}`,
      headers: { cookie: ch(employeeS.cookies) },
    });
    const questions = (detail.json() as {
      questions: Array<{ questionId: string; type: string }>;
    }).questions;
    const ratingQ = questions.find((q) => q.type === "rating" || q.type === "nps");
    expect(ratingQ).toBeDefined();

    const post = await suite.app.inject({
      method: "POST", url: `/v1/me/surveys/${Q4_SURVEY_ID}/responses`,
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
      [employeeS.userId, Q4_SURVEY_ID],
    );
    expect(Number(dbRows.rows[0]!.n)).toBe(0);
  });

  it("POST /v1/me/surveys/:id/responses submits 3 rating answers → 201 + persists", async () => {
    // Read the real question ids/types from the detail (no hard-coded question ids beyond the survey).
    const detail = await suite.app.inject({
      method: "GET", url: `/v1/me/surveys/${Q4_SURVEY_ID}`,
      headers: { cookie: ch(employeeS.cookies) },
    });
    const questions = (detail.json() as {
      questions: Array<{ questionId: string; type: string }>;
    }).questions;
    // Q4's 3 questions are nps/rating — all take a ratingValue.
    const answers = questions.map((q, i) => ({ questionId: q.questionId, ratingValue: 7 + i }));

    const post = await suite.app.inject({
      method: "POST", url: `/v1/me/surveys/${Q4_SURVEY_ID}/responses`,
      headers: {
        cookie: ch(employeeS.cookies), "x-csrf-token": employeeS.csrfToken,
        "content-type": "application/json",
      },
      payload: { answers },
    });
    expect(post.statusCode).toBe(201);
    const result = post.json() as { submitted: number; completedAt: string };
    expect(result.submitted).toBe(3);
    expect(result.completedAt).toBeTruthy();

    // Prove persistence directly against the DB.
    const dbRows = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_survey_responses
        WHERE survey_response_subject_user_id = $1 AND survey_response_survey_id = $2`,
      [employeeS.userId, Q4_SURVEY_ID],
    );
    expect(Number(dbRows.rows[0]!.n)).toBe(3);

    // And via the detail endpoint: myAnswers now populated + completedAt set.
    const after = await suite.app.inject({
      method: "GET", url: `/v1/me/surveys/${Q4_SURVEY_ID}`,
      headers: { cookie: ch(employeeS.cookies) },
    });
    const afterBody = after.json() as {
      completedAt: string | null;
      myAnswers: Array<{ questionId: string; ratingValue: number | null }>;
    };
    expect(afterBody.completedAt).not.toBeNull();
    expect(afterBody.myAnswers).toHaveLength(3);
    expect(afterBody.myAnswers.every((a) => a.ratingValue !== null)).toBe(true);
  });

  it("re-submitting the same survey → 409 SURVEY_ALREADY_ANSWERED", async () => {
    const detail = await suite.app.inject({
      method: "GET", url: `/v1/me/surveys/${Q4_SURVEY_ID}`,
      headers: { cookie: ch(employeeS.cookies) },
    });
    const questions = (detail.json() as { questions: Array<{ questionId: string }> }).questions;
    const answers = questions.map((q) => ({ questionId: q.questionId, ratingValue: 5 }));

    const post = await suite.app.inject({
      method: "POST", url: `/v1/me/surveys/${Q4_SURVEY_ID}/responses`,
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
