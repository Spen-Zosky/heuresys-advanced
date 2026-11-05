/**
 * apps/api/src/modules/mandate-acts/repository.ts — ADR-0050 D4 e D7 (mig 000475).
 *
 * SQL grezzo e parametrizzato su sys.sys_mandate_acts e sys.sys_user_auth_roles. Le regole che
 * nessuno scrittore deve poter aggirare (forma dell'atto, tre persone distinte, approvatore con
 * un mandato, coerenza fra atto ed effetto, separazione dei compiti) vivono nei trigger della
 * 000475; qui si scrive, e il service decide chi può.
 */

import type { PoolClient } from "pg";
import type { MandateAct, MandateActKind, MandateActStatus } from "@heuresys/shared";
import type { DbConnector } from "../auth/repository.js";

interface RawActRow {
  mandate_act_id: string;
  mandate_act_kind: MandateActKind;
  mandate_act_status: MandateActStatus;
  mandate_act_user_id: string;
  user_display_name: string | null;
  role_code: string;
  mandate_act_tenant_id: string | null;
  mandate_act_grant_id: string | null;
  mandate_act_reason: string;
  review_by: string | null;
  mandate_act_position_id: string | null;
  mandate_act_proposed_by: string | null;
  proposed_by_display_name: string | null;
  mandate_act_proposed_at: Date;
  mandate_act_decided_by: string | null;
  mandate_act_decided_at: Date | null;
  mandate_act_decision_note: string | null;
}

const SELECT_ACT = `
  SELECT a.mandate_act_id, a.mandate_act_kind, a.mandate_act_status, a.mandate_act_user_id,
         tu.user_display_name, r.auth_role_code AS role_code, a.mandate_act_tenant_id,
         a.mandate_act_grant_id, a.mandate_act_reason,
         to_char(a.mandate_act_review_by, 'YYYY-MM-DD') AS review_by,
         a.mandate_act_position_id, a.mandate_act_proposed_by,
         pu.user_display_name AS proposed_by_display_name, a.mandate_act_proposed_at,
         a.mandate_act_decided_by, a.mandate_act_decided_at, a.mandate_act_decision_note
    FROM sys.sys_mandate_acts a
    JOIN sys.sys_auth_roles r ON r.auth_role_id = a.mandate_act_role_id
    JOIN sys.sys_users tu ON tu.user_id = a.mandate_act_user_id
    LEFT JOIN sys.sys_users pu ON pu.user_id = a.mandate_act_proposed_by`;

function rowToAct(r: RawActRow): MandateAct {
  return {
    actId: r.mandate_act_id,
    kind: r.mandate_act_kind,
    status: r.mandate_act_status,
    userId: r.mandate_act_user_id,
    userDisplayName: r.user_display_name,
    roleCode: r.role_code as MandateAct["roleCode"],
    tenantId: r.mandate_act_tenant_id,
    grantId: r.mandate_act_grant_id,
    reason: r.mandate_act_reason,
    reviewBy: r.review_by,
    positionId: r.mandate_act_position_id,
    proposedBy: r.mandate_act_proposed_by,
    proposedByDisplayName: r.proposed_by_display_name,
    proposedAt: r.mandate_act_proposed_at.toISOString(),
    decidedBy: r.mandate_act_decided_by,
    decidedAt: r.mandate_act_decided_at ? r.mandate_act_decided_at.toISOString() : null,
    decisionNote: r.mandate_act_decision_note,
  };
}

export async function findAct(q: DbConnector, actId: string, forUpdate = false): Promise<MandateAct | null> {
  const res = await q.query<RawActRow>(
    `${SELECT_ACT} WHERE a.mandate_act_id = $1${forUpdate ? " FOR UPDATE OF a" : ""}`,
    [actId],
  );
  return res.rows[0] ? rowToAct(res.rows[0]) : null;
}

/**
 * Gli atti visibili: `tenantIds === null` vuol dire tutti (piattaforma); altrimenti i soli atti
 * con quel tenant. Più recenti prima; al più 200 righe, che per atti di mandato di un tenant è
 * molto più di un anno di lavoro.
 */
export async function listActs(
  q: DbConnector,
  filter: { tenantId: string | null | "ALL"; status?: MandateActStatus; userId?: string },
): Promise<MandateAct[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId !== "ALL") {
    params.push(filter.tenantId);
    where.push(`a.mandate_act_tenant_id IS NOT DISTINCT FROM $${params.length}::uuid`);
  }
  if (filter.status) {
    params.push(filter.status);
    where.push(`a.mandate_act_status = $${params.length}`);
  }
  if (filter.userId) {
    params.push(filter.userId);
    where.push(`a.mandate_act_user_id = $${params.length}`);
  }
  const res = await q.query<RawActRow>(
    `${SELECT_ACT}${where.length ? ` WHERE ${where.join(" AND ")}` : ""}
      ORDER BY a.mandate_act_proposed_at DESC LIMIT 200`,
    params,
  );
  return res.rows.map(rowToAct);
}

export async function insertAct(
  q: DbConnector,
  p: {
    kind: MandateActKind;
    userId: string;
    roleId: string;
    tenantId: string | null;
    grantId: string | null;
    reason: string;
    reviewBy: string | null;
    positionId: string | null;
    proposedBy: string;
  },
): Promise<string> {
  const res = await q.query<{ id: string }>(
    `INSERT INTO sys.sys_mandate_acts
        (mandate_act_kind, mandate_act_user_id, mandate_act_role_id, mandate_act_tenant_id,
         mandate_act_grant_id, mandate_act_reason, mandate_act_review_by, mandate_act_position_id,
         mandate_act_proposed_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8, $9)
      RETURNING mandate_act_id AS id`,
    [p.kind, p.userId, p.roleId, p.tenantId, p.grantId, p.reason, p.reviewBy, p.positionId, p.proposedBy],
  );
  return res.rows[0]!.id;
}

export async function decideAct(
  q: PoolClient,
  actId: string,
  status: Exclude<MandateActStatus, "PENDING">,
  decidedBy: string,
  note: string | null,
): Promise<void> {
  await q.query(
    `UPDATE sys.sys_mandate_acts
        SET mandate_act_status = $2, mandate_act_decided_by = $3,
            mandate_act_decided_at = now(), mandate_act_decision_note = $4
      WHERE mandate_act_id = $1 AND mandate_act_status = 'PENDING'`,
    [actId, status, decidedBy, note],
  );
}

export async function setActGrant(q: PoolClient, actId: string, grantId: string): Promise<void> {
  await q.query(`UPDATE sys.sys_mandate_acts SET mandate_act_grant_id = $2 WHERE mandate_act_id = $1`, [actId, grantId]);
}

export async function findRoleByCode(
  q: DbConnector,
  code: string,
): Promise<{ id: string; isPlatform: boolean } | null> {
  const res = await q.query<{ id: string; is_platform: boolean }>(
    `SELECT auth_role_id AS id, auth_role_is_platform AS is_platform
       FROM sys.sys_auth_roles WHERE auth_role_code = $1 AND retired_at IS NULL`,
    [code],
  );
  return res.rows[0] ? { id: res.rows[0].id, isPlatform: res.rows[0].is_platform } : null;
}

export async function findActiveGrantByRole(
  q: DbConnector,
  userId: string,
  roleId: string,
  tenantId: string | null,
): Promise<string | null> {
  const res = await q.query<{ id: string }>(
    `SELECT user_auth_role_id AS id FROM sys.sys_user_auth_roles
      WHERE user_auth_role_user_id = $1 AND user_auth_role_role_id = $2
        AND user_auth_role_tenant_id IS NOT DISTINCT FROM $3::uuid
        AND user_auth_role_revoked_at IS NULL`,
    [userId, roleId, tenantId],
  );
  return res.rows[0]?.id ?? null;
}

/** Il ruolo e lo stato di una concessione, per REVOKE e CONFIRM. */
export async function findGrant(
  q: DbConnector,
  grantId: string,
): Promise<{ userId: string; roleId: string; roleCode: string; tenantId: string | null; active: boolean } | null> {
  const res = await q.query<{
    user_id: string; role_id: string; role_code: string; tenant_id: string | null; active: boolean;
  }>(
    `SELECT g.user_auth_role_user_id AS user_id, g.user_auth_role_role_id AS role_id,
            r.auth_role_code AS role_code, g.user_auth_role_tenant_id AS tenant_id,
            g.user_auth_role_revoked_at IS NULL AS active
       FROM sys.sys_user_auth_roles g
       JOIN sys.sys_auth_roles r ON r.auth_role_id = g.user_auth_role_role_id
      WHERE g.user_auth_role_id = $1`,
    [grantId],
  );
  const r = res.rows[0];
  return r ? { userId: r.user_id, roleId: r.role_id, roleCode: r.role_code, tenantId: r.tenant_id, active: r.active } : null;
}

/** ADR-0050 D8: la posizione citata è una che la persona regge oggi (assegnazione ACTIVE, I1/I2). */
export async function positionHeldBy(q: DbConnector, positionId: string, userId: string): Promise<boolean> {
  const res = await q.query(
    `SELECT 1 FROM sys.sys_user_position_assignments a
      WHERE a.user_position_assignment_position_id = $1
        AND a.user_position_assignment_user_id = $2
        AND a.user_position_assignment_status = 'ACTIVE'`,
    [positionId, userId],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function insertMandateGrant(
  q: PoolClient,
  p: {
    userId: string; roleId: string; tenantId: string | null; grantedBy: string | null;
    actId: string; reason: string; reviewBy: string | null; approvedBy: string;
  },
): Promise<string> {
  const res = await q.query<{ id: string }>(
    `INSERT INTO sys.sys_user_auth_roles
        (user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id,
         user_auth_role_granted_by, user_auth_role_act_id, user_auth_role_reason,
         user_auth_role_review_by, user_auth_role_approved_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8)
      RETURNING user_auth_role_id AS id`,
    [p.userId, p.roleId, p.tenantId, p.grantedBy, p.actId, p.reason, p.reviewBy, p.approvedBy],
  );
  return res.rows[0]!.id;
}

export async function confirmMandateGrant(
  q: PoolClient,
  p: { grantId: string; actId: string; reason: string; reviewBy: string | null; approvedBy: string },
): Promise<number> {
  const res = await q.query(
    `UPDATE sys.sys_user_auth_roles
        SET user_auth_role_act_id = $2, user_auth_role_reason = $3,
            user_auth_role_review_by = $4::date, user_auth_role_approved_by = $5
      WHERE user_auth_role_id = $1 AND user_auth_role_revoked_at IS NULL`,
    [p.grantId, p.actId, p.reason, p.reviewBy, p.approvedBy],
  );
  return res.rowCount ?? 0;
}

export async function revokeMandateGrant(
  q: PoolClient,
  p: { grantId: string; actId: string; revokedBy: string },
): Promise<number> {
  const res = await q.query(
    `UPDATE sys.sys_user_auth_roles
        SET user_auth_role_revoked_at = now(), user_auth_role_revoke_act_id = $2,
            user_auth_role_revoked_by = $3
      WHERE user_auth_role_id = $1 AND user_auth_role_revoked_at IS NULL`,
    [p.grantId, p.actId, p.revokedBy],
  );
  return res.rowCount ?? 0;
}
