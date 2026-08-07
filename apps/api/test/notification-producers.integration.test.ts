/**
 * apps/api/test/notification-producers.integration.test.ts
 * 3.4 Slice B — event-driven notification producers, against the live OCI DB.
 * Each producer is exercised through the real code path that triggers it, then
 * the emitted rows are asserted in sys_inbox_notifications.
 *
 * D-23 hygiene: producers use stable subject strings; afterAll deletes those
 * rows + every fixture this suite created (by returned id) so the seed is intact.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool, closePool } from "../src/db/client.js";
import { insightsService } from "../src/modules/insights/service.js";
import { assessmentsService } from "../src/modules/assessments/service.js";
import { assessmentResultsService } from "../src/modules/assessment-results/service.js";
import { meService } from "../src/modules/me/service.js";

const SUBJECTS = [
  "Gap di competenze da colmare", // GAP_CLOSURE_DUE
  "Nuova valutazione richiesta", // ASSESSMENT_REQUEST
  "Feedback di valutazione disponibile", // MANAGER_FEEDBACK_READY
  "Percorso formativo in agenda", // TRAINING_DEADLINE
  "Obiettivo di carriera registrato", // CAREER_TARGET_STATUS
];
const RTL_TENANT = "86ba7a65-217f-48ba-8ce5-5c09b40a66b0";
const ANTONIO = "6e815bb9-81f3-46b5-b234-0d807fdbe518"; // antonio.parisi@rtl-bank.org
const TOMMASO = "a5e1d8ab-192a-414d-9294-ccb69aeca7d3"; // tommaso.fiore@rtl-bank.org
// Il modulo si DERIVA dal catalogo a runtime, non si scrive qui. L'UUID fisso che
// stava in questa riga puntava a un modulo `OLDDB::course_modules::*` rimosso dalla
// bonifica 000235: il test moriva per un dato scritto a mano che duplicava il
// database, non per un difetto del produttore di notifiche che deve verificare.
let rtlModuleId: string;
const RTL_POSITION = "0e51c0bb-f0df-4752-b003-b75a8607ea88";

const ADMIN = (id: string) => ({ userId: id, tenantId: null, roles: ["PLATFORM_ADMIN" as const] });
const EMP = { userId: TOMMASO, tenantId: RTL_TENANT, roles: ["USER"] };

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
  let createdLearningId: string | null = null;
  let createdTargetId: string | null = null;

  beforeAll(async () => {
    const u = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM sys.sys_users WHERE user_email = $1`,
      ["enzo.spenuso@heuresys.com"],
    );
    adminId = u.rows[0]!.user_id;
  });

  afterAll(async () => {
    if (createdAssessmentId) {
      await pool.query(`DELETE FROM sys.sys_assessment_results WHERE assessment_result_assessment_id = $1`, [createdAssessmentId]);
      await pool.query(`DELETE FROM sys.sys_assessments WHERE assessment_id = $1`, [createdAssessmentId]);
    }
    if (createdLearningId) await pool.query(`DELETE FROM sys.sys_user_learning_assignments WHERE user_learning_assignment_id = $1`, [createdLearningId]);
    if (createdTargetId) await pool.query(`DELETE FROM sys.sys_user_target_positions WHERE user_target_position_id = $1`, [createdTargetId]);
    await pool.query(`DELETE FROM sys.sys_inbox_notifications WHERE notification_subject = ANY($1)`, [SUBJECTS]);
    await closePool();
  });

  it("insights recomputeSkillGap → GAP_CLOSURE_DUE (best-effort, dedupe)", async () => {
    await insightsService.recomputeSkillGap(ADMIN(adminId));
    const n1 = (await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.sys_inbox_notifications
        WHERE notification_type='GAP_CLOSURE_DUE' AND notification_subject='Gap di competenze da colmare'`,
    )).rows[0]!.n;
    expect(n1).toBeGreaterThan(0);
    await insightsService.recomputeSkillGap(ADMIN(adminId)); // dedupe
    const n2 = (await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.sys_inbox_notifications
        WHERE notification_type='GAP_CLOSURE_DUE' AND notification_subject='Gap di competenze da colmare'`,
    )).rows[0]!.n;
    expect(n2).toBe(n1);
  });

  it("assessments.create → ASSESSMENT_REQUEST for the subject", async () => {
    const a = await assessmentsService.create(ADMIN(adminId), {
      subjectUserId: ANTONIO, tenantId: RTL_TENANT, kind: "MANAGER", status: "OPEN", metadata: {},
    });
    createdAssessmentId = a.assessmentId;
    expect(await countFor("ASSESSMENT_REQUEST", "Nuova valutazione richiesta", ANTONIO)).toBeGreaterThan(0);
  });

  it("assessment-results.create → MANAGER_FEEDBACK_READY for the subject", async () => {
    expect(createdAssessmentId).not.toBeNull();
    await assessmentResultsService.create(ADMIN(adminId), {
      assessmentId: createdAssessmentId!, dimension: "overall", score: 80, metadata: {},
    });
    expect(await countFor("MANAGER_FEEDBACK_READY", "Feedback di valutazione disponibile", ANTONIO)).toBeGreaterThan(0);
  });

  it("me.enrollLearning → TRAINING_DEADLINE (self)", async () => {
    const m = await pool.query<{ id: string }>(
      `SELECT learning_module_id AS id FROM sys.sys_learning_modules
        WHERE learning_module_tenant_id IS NULL OR learning_module_tenant_id = $1
        ORDER BY learning_module_code LIMIT 1`,
      [RTL_TENANT],
    );
    rtlModuleId = m.rows[0]!.id;
    const created = await meService.enrollLearning(EMP, { moduleId: rtlModuleId });
    createdLearningId = created.userLearningAssignmentId;
    expect(await countFor("TRAINING_DEADLINE", "Percorso formativo in agenda", TOMMASO)).toBeGreaterThan(0);
  });

  it("me.addCareerTarget → CAREER_TARGET_STATUS (self)", async () => {
    const created = await meService.addCareerTarget(EMP, { positionId: RTL_POSITION });
    createdTargetId = created.userTargetPositionId;
    expect(await countFor("CAREER_TARGET_STATUS", "Obiettivo di carriera registrato", TOMMASO)).toBeGreaterThan(0);
  });
});
