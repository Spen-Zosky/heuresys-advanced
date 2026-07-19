/**
 * apps/api/src/modules/whistleblowing/repository.ts — #51 E/E1.
 * Raw SQL for sys.sys_whistleblowing_reports. No reporter identity is ever stored
 * (anonymity is structural); the tracking code is the only handle a reporter keeps.
 */
import type { Pool, PoolClient } from "pg";
import type {
  WhistleblowingReport, WhistleblowingListItem, WhistleblowingStatusResponse, WhistleblowingUpdate,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  whistleblowing_report_id: string;
  whistleblowing_report_tracking_code: string;
  whistleblowing_report_status: string;
  whistleblowing_report_category: string;
  whistleblowing_report_subject: string;
  whistleblowing_report_body: string;
  whistleblowing_report_contact: string | null;
  whistleblowing_report_assignee_user_id: string | null;
  whistleblowing_report_public_message: string | null;
  whistleblowing_report_internal_notes: string | null;
  created_at: Date;
  updated_at: Date;
}

const toReport = (r: Row): WhistleblowingReport => ({
  reportId: r.whistleblowing_report_id,
  trackingCode: r.whistleblowing_report_tracking_code,
  status: r.whistleblowing_report_status as WhistleblowingReport["status"],
  category: r.whistleblowing_report_category as WhistleblowingReport["category"],
  subject: r.whistleblowing_report_subject,
  body: r.whistleblowing_report_body,
  contact: r.whistleblowing_report_contact,
  assigneeUserId: r.whistleblowing_report_assignee_user_id,
  publicMessage: r.whistleblowing_report_public_message,
  internalNotes: r.whistleblowing_report_internal_notes,
  submittedAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
});

export async function insertReport(
  q: DbConnector,
  input: { trackingCode: string; tenantId: string | null; category: string; subject: string; body: string; contact: string | null },
): Promise<void> {
  await q.query(
    `INSERT INTO sys.sys_whistleblowing_reports
       (whistleblowing_report_tracking_code, whistleblowing_report_tenant_id,
        whistleblowing_report_category, whistleblowing_report_subject,
        whistleblowing_report_body, whistleblowing_report_contact)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [input.trackingCode, input.tenantId, input.category, input.subject, input.body, input.contact],
  );
}

/** PUBLIC status lookup by code — exposes ONLY the public-safe fields (never body/notes/contact). */
export async function findStatusByCode(q: DbConnector, code: string): Promise<WhistleblowingStatusResponse | null> {
  const res = await q.query<{
    tracking_code: string; status: string; category: string;
    submitted_at: Date; last_update_at: Date; public_message: string | null;
  }>(
    `SELECT whistleblowing_report_tracking_code AS tracking_code,
            whistleblowing_report_status AS status,
            whistleblowing_report_category AS category,
            created_at AS submitted_at, updated_at AS last_update_at,
            whistleblowing_report_public_message AS public_message
       FROM sys.sys_whistleblowing_reports
      WHERE whistleblowing_report_tracking_code = $1`,
    [code],
  );
  const r = res.rows[0];
  if (!r) return null;
  return {
    trackingCode: r.tracking_code,
    status: r.status as WhistleblowingStatusResponse["status"],
    category: r.category as WhistleblowingStatusResponse["category"],
    submittedAt: r.submitted_at.toISOString(),
    lastUpdateAt: r.last_update_at.toISOString(),
    publicMessage: r.public_message,
  };
}

/** CUSTODIAN console — full rows (list view omits body/contact/notes at the schema layer). */
export async function listReports(q: DbConnector): Promise<WhistleblowingListItem[]> {
  const res = await q.query<Row>(
    `SELECT * FROM sys.sys_whistleblowing_reports ORDER BY created_at DESC`,
  );
  return res.rows.map((r) => {
    const full = toReport(r);
    // WhistleblowingListItem = report without body/contact/internalNotes.
    const { body: _b, contact: _c, internalNotes: _n, ...item } = full;
    return item;
  });
}

export async function findReportById(q: DbConnector, id: string): Promise<WhistleblowingReport | null> {
  const res = await q.query<Row>(`SELECT * FROM sys.sys_whistleblowing_reports WHERE whistleblowing_report_id = $1`, [id]);
  return res.rows[0] ? toReport(res.rows[0]) : null;
}

export async function updateReport(
  q: DbConnector,
  id: string,
  patch: WhistleblowingUpdate,
): Promise<WhistleblowingReport | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const add = (col: string, val: unknown) => { params.push(val); sets.push(`${col} = $${params.length}`); };
  if (patch.status !== undefined) add("whistleblowing_report_status", patch.status);
  if (patch.assigneeUserId !== undefined) add("whistleblowing_report_assignee_user_id", patch.assigneeUserId);
  if (patch.publicMessage !== undefined) add("whistleblowing_report_public_message", patch.publicMessage);
  if (patch.internalNotes !== undefined) add("whistleblowing_report_internal_notes", patch.internalNotes);
  if (sets.length === 0) return findReportById(q, id);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_whistleblowing_reports
        SET ${sets.join(", ")}, updated_at = now()
      WHERE whistleblowing_report_id = $${params.length}
      RETURNING *`,
    params,
  );
  return res.rows[0] ? toReport(res.rows[0]) : null;
}
