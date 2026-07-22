/**
 * apps/api/test/b3-time-off-approval.integration.test.ts — #34 B/B3.
 *
 * The FIRST BUSINESS approval flow, end-to-end on real RTL personas:
 *
 *   tommaso (USER, paolo's org report) submits a VACATION request from the ESS
 *   → an approval request (TIME_OFF_REQUEST) opens with paolo as approver and
 *     an APPROVAL_REQUEST notification in paolo's inbox
 *   → paolo approves his step, then applies the request
 *   → the apply-effect writes the APPROVED sys_time_off_requests row, moves the
 *     balance (used += days) and records the USAGE ledger transaction — all in
 *     the apply transaction.
 *
 * Design contract pinned here: the SUBMISSION writes NOTHING in the leave
 * tables (the pending state lives in the approvals runtime), so a rejection
 * needs no compensation. Everything rolls back with the file tx (D-52).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

interface S { cookies: Map<string, string>; csrfToken: string; userId: string }
const ch = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");

let suite: TestApp;
let tommaso: S;
let paolo: S;

async function login(email: string): Promise<S> {
  const r = await loginRaw(suite.app, email, TEST_PERSONA_PASSWORD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { csrfToken: string; user: { userId: string } };
  return { cookies, csrfToken: body.csrfToken, userId: body.user.userId };
}

function headers(s: S): Record<string, string> {
  return { cookie: ch(s.cookies), "x-csrf-token": s.csrfToken };
}

/** Next Monday..Tuesday at least 30 days out — 2 working days, same calendar year (frozen tx now()). */
function pickRange(): { start: string; end: string } {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 30);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  // A late-December Monday could cross the year with its Tuesday — step back a week.
  const tue = new Date(d);
  tue.setUTCDate(tue.getUTCDate() + 1);
  if (tue.getUTCFullYear() !== d.getUTCFullYear()) d.setUTCDate(d.getUTCDate() - 7);
  const start = d.toISOString().slice(0, 10);
  const e = new Date(d);
  e.setUTCDate(e.getUTCDate() + 1);
  return { start, end: e.toISOString().slice(0, 10) };
}

async function vacationBalance(userId: string, year: number) {
  const r = await pool.query<{ balance_id: string; used: string; available: string }>(
    `SELECT balance_id, balance_used_days::text AS used,
            (balance_total_days + balance_carryover_days + balance_adjustment_days - balance_used_days)::text AS available
       FROM sys.sys_time_off_balances
      WHERE balance_subject_user_id = $1 AND balance_leave_type = 'VACATION' AND balance_year = $2`,
    [userId, year],
  );
  return r.rows[0] ?? null;
}

describe("#34 B3 — time-off request → manager approval → applied effect", () => {
  const range = pickRange();
  const year = Number(range.start.slice(0, 4));

  beforeAll(async () => {
    suite = await buildTestApp();
    tommaso = await login("tommaso.fiore@rtl-bank.org");
    paolo = await login("paolo.caputo@rtl-bank.org");
  }, 60_000);

  afterAll(async () => {
    await suite.app.close();
  });

  it("runs the full flow: submit → notify → approve → apply → balance + ledger moved", async () => {
    const before = await vacationBalance(tommaso.userId, year);
    expect(before, `tommaso senza balance VACATION ${year} — dataset RTL cambiato?`).not.toBeNull();

    // 1. ESS submission (2 working days).
    const submit = await suite.app.inject({
      method: "POST", url: "/v1/me/time-off/requests", headers: headers(tommaso),
      payload: { leaveType: "VACATION", startDate: range.start, endDate: range.end, reason: "family" },
    });
    expect(submit.statusCode).toBe(200);
    const submitted = submit.json() as {
      approvalRequestId: string; status: string; daysRequested: number; approverUserId: string;
    };
    expect(submitted.status).toBe("PENDING");
    expect(submitted.daysRequested).toBe(2);
    expect(submitted.approverUserId).toBe(paolo.userId); // direct org manager, resolved not supplied

    // 2. NOTHING exists in the leave tables yet — the pending state is the approval.
    const noRow = await pool.query(
      `SELECT 1 FROM sys.sys_time_off_requests
        WHERE request_natural_key = $1`,
      [`TOR::APPROVAL::${submitted.approvalRequestId}`],
    );
    expect(noRow.rowCount).toBe(0);

    // 3. The approver got the APPROVAL_REQUEST notification.
    const notif = await pool.query(
      `SELECT 1 FROM sys.sys_inbox_notifications
        WHERE notification_user_id = $1 AND notification_type = 'APPROVAL_REQUEST'
          AND notification_subject LIKE '%' || $2 || '%'`,
      [paolo.userId, range.start],
    );
    expect(notif.rowCount).toBeGreaterThan(0);

    // 4. paolo approves his step…
    const detail = await suite.app.inject({
      method: "GET", url: `/v1/approvals/${submitted.approvalRequestId}`, headers: { cookie: ch(paolo.cookies) },
    });
    expect(detail.statusCode).toBe(200);
    const steps = (detail.json() as { steps: { approvalStepId: string; approverUserId: string }[] }).steps;
    const myStep = steps.find((s) => s.approverUserId === paolo.userId);
    expect(myStep).toBeDefined();

    const decide = await suite.app.inject({
      method: "POST",
      url: `/v1/approvals/${submitted.approvalRequestId}/steps/${myStep!.approvalStepId}/decide`,
      headers: headers(paolo),
      payload: { decision: "APPROVE" },
    });
    expect(decide.statusCode).toBe(200);

    // 5. …and applies the request (MANAGER holds approval:create).
    const apply = await suite.app.inject({
      method: "POST", url: `/v1/approvals/${submitted.approvalRequestId}/apply`, headers: headers(paolo),
    });
    expect(apply.statusCode).toBe(200);
    expect((apply.json() as { status: string }).status).toBe("APPLIED");

    // 6. The effect materialized the whole chain, atomically:
    const tor = await pool.query<{ status: string; days: string; approver: string | null }>(
      `SELECT request_status AS status, request_days_requested::text AS days,
              request_approver_user_id AS approver
         FROM sys.sys_time_off_requests WHERE request_natural_key = $1`,
      [`TOR::APPROVAL::${submitted.approvalRequestId}`],
    );
    expect(tor.rowCount).toBe(1);
    expect(tor.rows[0]!.status).toBe("APPROVED");
    expect(Number(tor.rows[0]!.days)).toBe(2);
    expect(tor.rows[0]!.approver).toBe(paolo.userId);

    const after = await vacationBalance(tommaso.userId, year);
    expect(Number(after!.used)).toBeCloseTo(Number(before!.used) + 2, 2);

    const ledger = await pool.query<{ amount: string; type: string }>(
      `SELECT transaction_days_amount::text AS amount, transaction_type AS type
         FROM sys.sys_leave_balance_transactions
        WHERE transaction_natural_key = $1`,
      [`LBT::APPROVAL::${submitted.approvalRequestId}`],
    );
    expect(ledger.rowCount).toBe(1);
    expect(ledger.rows[0]!.type).toBe("USAGE");
    expect(Number(ledger.rows[0]!.amount)).toBe(2);

    // 7. The ESS self view now shows the approved request (I17).
    const own = await suite.app.inject({
      method: "GET", url: "/v1/me/time-off/requests?limit=50", headers: { cookie: ch(tommaso.cookies) },
    });
    expect(own.statusCode).toBe(200);
    const ownItems = (own.json() as { items: { status: string; startDate: string }[] }).items;
    expect(ownItems.some((i) => i.status === "APPROVED" && i.startDate === range.start)).toBe(true);
  });

  it("a rejection leaves NO trace in the leave tables (nothing to compensate)", async () => {
    const submit = await suite.app.inject({
      method: "POST", url: "/v1/me/time-off/requests", headers: headers(tommaso),
      payload: { leaveType: "PERSONAL", startDate: range.start, endDate: range.start },
    });
    expect(submit.statusCode).toBe(200);
    const { approvalRequestId } = submit.json() as { approvalRequestId: string };

    const detail = await suite.app.inject({
      method: "GET", url: `/v1/approvals/${approvalRequestId}`, headers: { cookie: ch(paolo.cookies) },
    });
    const step = (detail.json() as { steps: { approvalStepId: string }[] }).steps[0]!;
    const decide = await suite.app.inject({
      method: "POST",
      url: `/v1/approvals/${approvalRequestId}/steps/${step.approvalStepId}/decide`,
      headers: headers(paolo),
      payload: { decision: "REJECT", comment: "periodo non coperto" },
    });
    expect(decide.statusCode).toBe(200);

    const tor = await pool.query(
      `SELECT 1 FROM sys.sys_time_off_requests WHERE request_natural_key = $1`,
      [`TOR::APPROVAL::${approvalRequestId}`],
    );
    expect(tor.rowCount).toBe(0);
  });

  it("insufficient balance → 409 LEAVE_BALANCE_INSUFFICIENT at submission (advisory gate)", async () => {
    // A 400-working-day span cannot fit any real balance.
    const r = await suite.app.inject({
      method: "POST", url: "/v1/me/time-off/requests", headers: headers(tommaso),
      payload: { leaveType: "PERSONAL", startDate: `${year}-01-05`, endDate: `${year}-12-20` },
    });
    expect(r.statusCode).toBe(409);
    expect((r.json() as { error: { code: string } }).error.code).toBe("LEAVE_BALANCE_INSUFFICIENT");
  });

  it("invalid range (end before start) → 400", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/me/time-off/requests", headers: headers(tommaso),
      payload: { leaveType: "VACATION", startDate: range.end, endDate: range.start },
    });
    expect(r.statusCode).toBe(400);
  });

  it("a platform actor without tenant context cannot submit (403)", async () => {
    const admin = await login("admin@heuresys.com"); // PLATFORM_ADMIN JWT carries a null tenant
    const r = await suite.app.inject({
      method: "POST", url: "/v1/me/time-off/requests", headers: headers(admin),
      payload: { leaveType: "VACATION", startDate: range.start, endDate: range.end },
    });
    expect(r.statusCode).toBe(403);
  });
});
