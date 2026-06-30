/**
 * apps/api/src/lib/scope/org.ts — F0 of the two-axis authorization model (ADR-0027).
 *
 * The ORGANIZATIONAL axis: the org-chart reports-to chain, traversed TRANSITIVELY
 * (the old `getManagerTeamUserIds` walked it one hop only). This is the axis that
 * gates SENSITIVE personal data (I18/I20): a user may see another user's
 * PERSONAL/COMPENSATION/SKILL/EVALUATION data only if that user is in their
 * organizational sub-tree.
 *
 * Chain source: sys_positions.position_reports_to_position_id (self-FK), mapped to
 * users via ACTIVE sys_user_position_assignments. We use `UNION` (not UNION ALL) so a
 * malformed reports-to cycle dedups and the recursion terminates instead of looping.
 *
 * F0 is foundation only — these helpers add NO behaviour change; the scope resolver
 * (F1) and the sensitive-module enforcement (F3) consume them.
 */

import type { Pool, PoolClient } from "pg";

export type DbConnector = Pool | PoolClient;

/**
 * User ids in the actor's organizational sub-tree — their transitive reports — INCLUDING self.
 * This is the allow-list for reading another user's SENSITIVE data (the cardinal rule, I18/I20):
 * `target ∈ orgSubtreeUserIds(actor)` ⟺ actor may see target's sensitive data via the org axis.
 * Self is always present even when the actor holds no position.
 */
export async function orgSubtreeUserIds(q: DbConnector, actorUserId: string): Promise<string[]> {
  const res = await q.query<{ user_id: string }>(
    `WITH RECURSIVE my_pos AS (
       SELECT upa.user_position_assignment_position_id AS pid
         FROM sys.sys_user_position_assignments upa
        WHERE upa.user_position_assignment_user_id = $1
          AND upa.user_position_assignment_status = 'ACTIVE'
     ),
     subtree AS (
       SELECT pid FROM my_pos
       UNION
       SELECT p.position_id
         FROM sys.sys_positions p
         JOIN subtree s ON p.position_reports_to_position_id = s.pid
     )
     SELECT DISTINCT upa.user_position_assignment_user_id AS user_id
       FROM sys.sys_user_position_assignments upa
       JOIN subtree s ON s.pid = upa.user_position_assignment_position_id
      WHERE upa.user_position_assignment_status = 'ACTIVE'
     UNION
     SELECT $1::uuid`,
    [actorUserId],
  );
  return res.rows.map((r) => r.user_id);
}

/**
 * User ids ABOVE the given user in the org chart — their transitive managers (NOT including self).
 * The mirror of {@link orgSubtreeUserIds}; useful for "who may see MY sensitive data".
 */
export async function orgAncestorUserIds(q: DbConnector, userId: string): Promise<string[]> {
  const res = await q.query<{ user_id: string }>(
    `WITH RECURSIVE my_pos AS (
       SELECT upa.user_position_assignment_position_id AS pid
         FROM sys.sys_user_position_assignments upa
        WHERE upa.user_position_assignment_user_id = $1
          AND upa.user_position_assignment_status = 'ACTIVE'
     ),
     ancestors AS (
       SELECT p.position_reports_to_position_id AS pid
         FROM sys.sys_positions p
         JOIN my_pos m ON p.position_id = m.pid
        WHERE p.position_reports_to_position_id IS NOT NULL
       UNION
       SELECT p.position_reports_to_position_id
         FROM sys.sys_positions p
         JOIN ancestors a ON p.position_id = a.pid
        WHERE p.position_reports_to_position_id IS NOT NULL
     )
     SELECT DISTINCT upa.user_position_assignment_user_id AS user_id
       FROM sys.sys_user_position_assignments upa
       JOIN ancestors a ON a.pid = upa.user_position_assignment_position_id
      WHERE upa.user_position_assignment_status = 'ACTIVE'`,
    [userId],
  );
  return res.rows.map((r) => r.user_id);
}

/**
 * True iff the user is the explicit manager of at least one organization unit
 * (`organization_unit_manager_user_id`) — i.e. responsabile di Divisione / Direzione / centro
 * di costo / unità organizzativa. One of the two signals of an explicit managerial role that
 * Enzo's F1 constraint requires before the organizational sub-tree scope applies (the other is
 * an RBAC managerial role; see resolver.ts MANAGERIAL_ROLES).
 */
export async function isOrgUnitManager(q: DbConnector, userId: string): Promise<boolean> {
  const res = await q.query<{ hit: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM sys.sys_organization_units
        WHERE organization_unit_manager_user_id = $1
     ) AS hit`,
    [userId],
  );
  return res.rows[0]?.hit ?? false;
}

/**
 * True iff `targetUserId` is in `actorUserId`'s organizational sub-tree (self counts).
 * The boolean form of the cardinal-rule check used by the sensitive-data gate in F3.
 */
export async function isInOrgSubtree(
  q: DbConnector,
  actorUserId: string,
  targetUserId: string,
): Promise<boolean> {
  if (actorUserId === targetUserId) return true;
  const res = await q.query<{ hit: boolean }>(
    `WITH RECURSIVE my_pos AS (
       SELECT upa.user_position_assignment_position_id AS pid
         FROM sys.sys_user_position_assignments upa
        WHERE upa.user_position_assignment_user_id = $1
          AND upa.user_position_assignment_status = 'ACTIVE'
     ),
     subtree AS (
       SELECT pid FROM my_pos
       UNION
       SELECT p.position_id
         FROM sys.sys_positions p
         JOIN subtree s ON p.position_reports_to_position_id = s.pid
     )
     SELECT EXISTS (
       SELECT 1
         FROM sys.sys_user_position_assignments upa
         JOIN subtree s ON s.pid = upa.user_position_assignment_position_id
        WHERE upa.user_position_assignment_user_id = $2
          AND upa.user_position_assignment_status = 'ACTIVE'
     ) AS hit`,
    [actorUserId, targetUserId],
  );
  return res.rows[0]?.hit ?? false;
}
