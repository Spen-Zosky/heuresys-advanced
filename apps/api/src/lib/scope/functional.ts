/**
 * apps/api/src/lib/scope/functional.ts — F4 of the two-axis model (ADR-0027).
 *
 * The FUNCTIONAL axis: team and process membership. This is the axis that gates
 * ACTIVITIES (work items), and it is the mirror image of the organizational axis
 * in `org.ts` — with one hard asymmetry that is the whole point of ADR-0027:
 *
 *   **Functional membership NEVER unlocks sensitive data (I18, absolute).**
 *
 * A team leader can manage what their members DO (activities) without being able
 * to see who they ARE (compensation, skills, evaluations, personal data). Only the
 * organizational chain grants that, and only within the sub-tree (I18/I20). Callers
 * must therefore route ACTIVITY through here and everything else through
 * `resolveOrgReadScope` — never the reverse. The data-class taxonomy
 * (`data-classes.ts`) is what makes that routing mechanical rather than a judgement
 * call at each call site.
 *
 * Two membership sources, each keeping its own domain's existing vocabulary:
 *   - teams:     `sys_teams.team_lead_user_id`, or `sys_team_members` role = 'LEAD'
 *   - processes: `sys_process_participants` role = 'OWNER' (mirrors the RACI of the
 *                org-unit-level `sys_organization_unit_processes`, mig 000179)
 * The two names (LEAD / OWNER) differ deliberately: each matches the vocabulary
 * already stored in its own table.
 */

import type { Pool, PoolClient } from "pg";

export type DbConnector = Pool | PoolClient;

/**
 * User ids whose ACTIVITIES the actor may see/manage — the members of every team
 * they lead and the participants of every process they own — INCLUDING self (I17).
 *
 * Inactive memberships (`is_active = false`) are excluded on both sides: a former
 * member's activities are no longer in a leader's functional scope.
 */
export async function functionalScopeUserIds(
  q: DbConnector,
  actorUserId: string,
): Promise<string[]> {
  const res = await q.query<{ user_id: string }>(
    `-- members of teams the actor leads (either as the team's lead, or via a LEAD membership row)
     SELECT DISTINCT tm.team_member_user_id AS user_id
       FROM sys.sys_teams t
       JOIN sys.sys_team_members tm
         ON tm.team_member_team_id = t.team_id
        AND tm.team_member_is_active
      WHERE t.team_is_active
        AND (
          t.team_lead_user_id = $1
          OR EXISTS (
            SELECT 1 FROM sys.sys_team_members lead
             WHERE lead.team_member_team_id = t.team_id
               AND lead.team_member_user_id = $1
               AND lead.team_member_role = 'LEAD'
               AND lead.team_member_is_active
          )
        )
     UNION
     -- participants of processes the actor owns
     SELECT DISTINCT pp.process_participant_user_id AS user_id
       FROM sys.sys_process_participants pp
      WHERE pp.process_participant_is_active
        AND pp.process_participant_org_unit_process_id IN (
          SELECT mine.process_participant_org_unit_process_id
            FROM sys.sys_process_participants mine
           WHERE mine.process_participant_user_id = $1
             AND mine.process_participant_role = 'OWNER'
             AND mine.process_participant_is_active
        )
     UNION
     SELECT $1::uuid`,
    [actorUserId],
  );
  return res.rows.map((r) => r.user_id);
}

/**
 * True iff the actor leads at least one team or owns at least one process — the
 * functional counterpart of `isOrgUnitManager`. Used to tell "has no functional
 * scope beyond self" apart from "leads things but they are empty".
 */
export async function isFunctionalLeader(q: DbConnector, actorUserId: string): Promise<boolean> {
  const res = await q.query<{ hit: boolean }>(
    `SELECT (
       EXISTS (
         SELECT 1 FROM sys.sys_teams t
          WHERE t.team_is_active AND t.team_lead_user_id = $1
       )
       OR EXISTS (
         SELECT 1 FROM sys.sys_team_members tm
          WHERE tm.team_member_user_id = $1
            AND tm.team_member_role = 'LEAD'
            AND tm.team_member_is_active
       )
       OR EXISTS (
         SELECT 1 FROM sys.sys_process_participants pp
          WHERE pp.process_participant_user_id = $1
            AND pp.process_participant_role = 'OWNER'
            AND pp.process_participant_is_active
       )
     ) AS hit`,
    [actorUserId],
  );
  return res.rows[0]?.hit ?? false;
}

/**
 * True iff `targetUserId`'s ACTIVITIES are within `actorUserId`'s functional scope.
 * Boolean form of {@link functionalScopeUserIds} for per-record gates.
 *
 * NOTE the deliberate absence of a sensitive-data variant: there is no
 * `isInFunctionalScopeForSensitive`, because that combination does not exist in the
 * model (I18). If a caller needs sensitive access, it must ask the org axis.
 */
export async function isInFunctionalScope(
  q: DbConnector,
  actorUserId: string,
  targetUserId: string,
): Promise<boolean> {
  if (actorUserId === targetUserId) return true; // self (I17)
  const scope = await functionalScopeUserIds(q, actorUserId);
  return scope.includes(targetUserId);
}
