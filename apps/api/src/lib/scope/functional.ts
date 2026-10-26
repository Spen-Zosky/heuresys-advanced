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
 * ADR-0044 passo 3a — CHI partecipa oggi a un processo: la persona si ricava dalla
 * POSIZIONE, non dalla riga. Una partecipazione appartiene a un posto; chi lo occupa oggi
 * (assegnazione ACTIVE, in corso alla data di oggi, su una posizione attiva) è la persona
 * che partecipa. Una posizione vacante partecipa ma non dà nessuna persona.
 *
 * È l'UNICO posto in cui questa clausola è scritta: lo usano `functionalScopeUserIds`,
 * `isFunctionalLeader`, il dominio `process_owner` (`domains.ts`) e «i miei processi»
 * (`me/repository.ts`). Si usa come tabella: `FROM ${PARTECIPANTI_OGGI_SQL} pp`, con le
 * colonne `participant_id, tenant_id, org_unit_process_id, role, is_active, position_id,
 * user_id`.
 *
 * RAMO DI RIPIEGO, con data di fine: una riga senza posizione usa ancora la persona
 * scritta sulla riga. Dopo il passo 2 di PE-4 le righe ATTIVE senza posizione sono zero;
 * il ramo resta come difesa e si toglie al rilascio del passo 3b (O2-10), quando il
 * vincolo `NOT is_active OR position_id IS NOT NULL` lo rende inutile.
 */
export const PARTECIPANTI_OGGI_SQL = `(
  SELECT pp.process_participant_id                  AS participant_id,
         pp.process_participant_tenant_id           AS tenant_id,
         pp.process_participant_org_unit_process_id AS org_unit_process_id,
         pp.process_participant_role                AS role,
         pp.process_participant_is_active           AS is_active,
         pp.process_participant_position_id         AS position_id,
         upa.user_position_assignment_user_id       AS user_id
    FROM sys.sys_process_participants pp
    JOIN sys.sys_positions pos
      ON pos.position_id = pp.process_participant_position_id
     AND pos.position_is_active
    JOIN sys.sys_user_position_assignments upa
      ON upa.user_position_assignment_position_id = pp.process_participant_position_id
     AND upa.user_position_assignment_tenant_id = pp.process_participant_tenant_id
     AND upa.user_position_assignment_status = 'ACTIVE'
     AND upa.user_position_assignment_start_date <= current_date
     AND (upa.user_position_assignment_end_date IS NULL
          OR upa.user_position_assignment_end_date >= current_date)
  UNION ALL
  -- ripiego fino al passo 3b (O2-10): la riga senza posizione usa la persona
  SELECT pp.process_participant_id, pp.process_participant_tenant_id,
         pp.process_participant_org_unit_process_id, pp.process_participant_role,
         pp.process_participant_is_active, NULL::uuid, pp.process_participant_user_id
    FROM sys.sys_process_participants pp
   WHERE pp.process_participant_position_id IS NULL
)`;

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
     -- participants of processes the actor owns (ADR-0044: through the positions held today)
     SELECT DISTINCT pp.user_id
       FROM ${PARTECIPANTI_OGGI_SQL} pp
      WHERE pp.is_active
        AND pp.org_unit_process_id IN (
          SELECT mine.org_unit_process_id
            FROM ${PARTECIPANTI_OGGI_SQL} mine
           WHERE mine.user_id = $1
             AND mine.role = 'OWNER'
             AND mine.is_active
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
         SELECT 1 FROM ${PARTECIPANTI_OGGI_SQL} pp
          WHERE pp.user_id = $1
            AND pp.role = 'OWNER'
            AND pp.is_active
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
