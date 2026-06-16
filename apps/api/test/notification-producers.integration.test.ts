/**
 * apps/api/test/notification-producers.integration.test.ts
 * 3.4 Slice B — event-driven notification producers, against the live OCI DB.
 * Each producer is exercised through the real code path that triggers it, then
 * the emitted rows are asserted in sys_inbox_notifications.
 *
 * D-23 hygiene: producers use stable, recognisable subject strings; afterAll
 * deletes those rows + any assessment fixtures this suite created (best-effort)
 * so the seed is not polluted.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool, closePool } from "../src/db/client.js";
import { insightsService } from "../src/modules/insights/service.js";
import { assessmentsService } from "../src/modules/assessments/service.js";
import { assessmentResultsService } from "../src/modules/assessment-results/service.js";

const SUBJECTS = [
  "Gap di competenze da colmare", // GAP_CLOSURE_DUE
  "Nuova valutazione richiesta", // ASSESSMENT_REQUEST
  "Feedback di valutazione disponibile", // MANAGER_FEEDBACK_READY
];
const RTL_TENANT = "86ba7a65-217f-48ba-8ce5-5c09b40a66b0";
const ANTONIO = "6e815bb9-81f3-46b5-b234-0d807fdbe518"; // antonio.parisi@rtl-bank.org

const ADMIN = (id: string) => ({ userId: id, tenantId: null, roles: ["PLATFORM_ADMIN" as const] });

async function countFor(type: string, subject: string, userId: string): Promise<number> {
  const r = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM sys.sys_inbox_notifications
      WHERE notification_type = $1 AND notification_subject = $2 AND notification_user_id = $3`,
    [type, subject, userId],
  );
  return r.rows[0]!.n;
}

describe("3.4 notification producers (live)", () => {
  let adminId: string;
  let createdAssessmentId: string | null = null;

  beforeAll(async () => {
    const u = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM sys.sys_users WHERE user_email = $1`,
      ["admin@heuresys.com"],
    );
    adminId = u.rows[0]!.user_id;
  });

  afterAll(async () => {
    if (createdAssessmentId) {
      await pool.query(`DELETE FROM sys.sys_assessment_results WHERE assessment_result_assessment_id = $1`, [createdAssessmentId]);
      await pool.query(`DELETE FROM sys.sys_assessments WHERE assessment_id = $1`, [createdAssessmentId]);
    }
    await pool.query(`DELETE FROM sys.sys_inbox_notifications WHERE notification_subject = ANY($1)`, [SUBJECTS]);
    await closePool();
  });

  it("insights recomputeSkillGap → GAP_CLOSURE_DUE (best-effort, dedupe)", async () => {
    await insightsService.recomputeSkillGap(ADMIN(adminId));
    const r = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.sys_inbox_notifications
        WHERE notification_type = 'GAP_CLOSURE_DUE' AND notification_subject = 'Gap di competenze da colmare'`,
    );
    const n1 = r.rows[0]!.n;
    expect(n1).toBeGreaterThan(0);
    await insightsService.recomputeSkillGap(ADMIN(adminId)); // dedupe
    const r2 = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.sys_inbox_notifications
        WHERE notification_type = 'GAP_CLOSURE_DUE' AND notification_subject = 'Gap di competenze da colmare'`,
    );
    expect(r2.rows[0]!.n).toBe(n1);
  });

  it("assessments.create → ASSESSMENT_REQUEST for the subject", async () => {
    const a = await assessmentsService.create(ADMIN(adminId), {
      subjectUserId: ANTONIO,
      tenantId: RTL_TENANT,
      kind: "MANAGER",
      status: "OPEN",
      metadata: {},
    });
    createdAssessmentId = a.assessmentId;
    expect(await countFor("ASSESSMENT_REQUEST", "Nuova valutazione richiesta", ANTONIO)).toBeGreaterThan(0);
  });

  it("assessment-results.create → MANAGER_FEEDBACK_READY for the subject", async () => {
    expect(createdAssessmentId).not.toBeNull();
    await assessmentResultsService.create(ADMIN(adminId), {
      assessmentId: createdAssessmentId!,
      dimension: "overall",
      score: 80,
      metadata: {},
    });
    expect(await countFor("MANAGER_FEEDBACK_READY", "Feedback di valutazione disponibile", ANTONIO)).toBeGreaterThan(0);
  });
});
