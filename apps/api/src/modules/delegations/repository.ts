/**
 * apps/api/src/modules/delegations/repository.ts — #99 F6b.
 *
 * SQL parametrizzato grezzo su `sys.sys_user_delegations` (mig `000314`).
 *
 * `isInForce` è **derivato in SQL, non memorizzato**: una colonna «in vigore» sarebbe vera
 * il giorno che la scrivi e falsa il giorno dopo, e nessuno se ne accorgerebbe. La regola è
 * una sola e sta qui: stato `ACTIVE`, decorrenza non futura, scadenza assente o non passata.
 */
import type { Pool, PoolClient } from "pg";
import type { Delegation, DelegationListQuery } from "@heuresys/shared";
import { delegationKindOf } from "@heuresys/shared";
import { toDateOnly } from "../../lib/date-only.js";

export type DbConnector = Pool | PoolClient;

interface Riga {
  user_delegation_id: string;
  user_delegation_tenant_id: string;
  user_delegation_delegator_id: string;
  delegator_name: string | null;
  user_delegation_delegate_id: string;
  delegate_name: string | null;
  user_delegation_scope: string;
  user_delegation_groups: string[] | null;
  user_delegation_request_type: string | null;
  user_delegation_tenant_process_step_id: string | null;
  step_name: string | null;
  user_delegation_starts_on: Date;
  user_delegation_ends_on: Date | null;
  user_delegation_status: string;
  user_delegation_reason: string | null;
  is_in_force: boolean;
  created_at: Date;
  updated_at: Date;
}

const SELEZIONE = `
  d.user_delegation_id, d.user_delegation_tenant_id,
  d.user_delegation_delegator_id, d.user_delegation_delegate_id,
  d.user_delegation_scope, d.user_delegation_groups, d.user_delegation_starts_on, d.user_delegation_ends_on,
  d.user_delegation_request_type, d.user_delegation_tenant_process_step_id, st.tenant_process_step_name AS step_name,
  d.user_delegation_status, d.user_delegation_reason, d.created_at, d.updated_at,
  nullif(trim(coalesce(ud.user_first_name,'') || ' ' || coalesce(ud.user_last_name,'')), '') AS delegator_name,
  nullif(trim(coalesce(ue.user_first_name,'') || ' ' || coalesce(ue.user_last_name,'')), '') AS delegate_name,
  (d.user_delegation_status = 'ACTIVE'
   AND d.user_delegation_starts_on <= current_date
   AND (d.user_delegation_ends_on IS NULL OR d.user_delegation_ends_on >= current_date)) AS is_in_force`;

const DA = `
  FROM sys.sys_user_delegations d
  LEFT JOIN sys.sys_users ud ON ud.user_id = d.user_delegation_delegator_id
  LEFT JOIN sys.sys_users ue ON ue.user_id = d.user_delegation_delegate_id
  LEFT JOIN sys.sys_tenant_process_steps st ON st.tenant_process_step_id = d.user_delegation_tenant_process_step_id`;

function mappa(r: Riga): Delegation {
  return {
    delegationId: r.user_delegation_id,
    tenantId: r.user_delegation_tenant_id,
    delegatorUserId: r.user_delegation_delegator_id,
    delegatorName: r.delegator_name,
    delegateUserId: r.user_delegation_delegate_id,
    delegateName: r.delegate_name,
    scope: r.user_delegation_scope as Delegation["scope"],
    groups: r.user_delegation_groups,
    kind: delegationKindOf(r.user_delegation_scope as Delegation["scope"]),
    requestType: r.user_delegation_request_type,
    tenantProcessStepId: r.user_delegation_tenant_process_step_id,
    tenantProcessStepName: r.step_name,
    // La catena la misura il servizio, a ogni lettura (ADR-0051 §2): il repository non la sa.
    inChain: null,
    startsOn: toDateOnly(r.user_delegation_starts_on) ?? "",
    endsOn: toDateOnly(r.user_delegation_ends_on),
    status: r.user_delegation_status as Delegation["status"],
    reason: r.user_delegation_reason,
    isInForce: r.is_in_force,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listDelegations(
  q: DbConnector,
  tenantId: string,
  filtro: DelegationListQuery,
): Promise<{ items: Delegation[]; total: number }> {
  const params: unknown[] = [tenantId];
  const where = ["d.user_delegation_tenant_id = $1"];

  if (filtro.delegateUserId) {
    params.push(filtro.delegateUserId);
    where.push(`d.user_delegation_delegate_id = $${params.length}`);
  }
  if (filtro.delegatorUserId) {
    params.push(filtro.delegatorUserId);
    where.push(`d.user_delegation_delegator_id = $${params.length}`);
  }
  if (filtro.status) {
    params.push(filtro.status);
    where.push(`d.user_delegation_status = $${params.length}`);
  }
  if (filtro.inForce === true) {
    where.push(`d.user_delegation_status = 'ACTIVE'
                AND d.user_delegation_starts_on <= current_date
                AND (d.user_delegation_ends_on IS NULL OR d.user_delegation_ends_on >= current_date)`);
  }
  const clausola = `WHERE ${where.join(" AND ")}`;

  const conteggio = await q.query<{ n: string }>(
    `SELECT count(*)::text AS n ${DA} ${clausola}`,
    params,
  );
  params.push(filtro.limit, filtro.offset);
  const res = await q.query<Riga>(
    `SELECT ${SELEZIONE} ${DA} ${clausola}
      ORDER BY d.user_delegation_starts_on DESC, d.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { items: res.rows.map(mappa), total: Number(conteggio.rows[0]?.n ?? 0) };
}

export async function getDelegation(
  q: DbConnector,
  tenantId: string,
  id: string,
): Promise<Delegation | null> {
  const res = await q.query<Riga>(
    `SELECT ${SELEZIONE} ${DA}
      WHERE d.user_delegation_id = $1 AND d.user_delegation_tenant_id = $2`,
    [id, tenantId],
  );
  const r = res.rows[0];
  return r ? mappa(r) : null;
}

export async function createDelegation(
  q: DbConnector,
  tenantId: string,
  dati: {
    delegatorUserId: string; delegateUserId: string; scope: string; groups: string[] | null;
    requestType?: string | null; tenantProcessStepId?: string | null;
    startsOn: string; endsOn: string | null; reason: string | null; actorId: string;
  },
): Promise<Delegation> {
  const ins = await q.query<{ id: string }>(
    `INSERT INTO sys.sys_user_delegations
       (user_delegation_tenant_id, user_delegation_delegator_id, user_delegation_delegate_id,
        user_delegation_scope, user_delegation_starts_on, user_delegation_ends_on,
        user_delegation_reason, created_by, updated_by, user_delegation_groups,
        user_delegation_request_type, user_delegation_tenant_process_step_id)
     VALUES ($1, $2, $3, $4, $5::date, $6::date, $7, $8, $8, $9::text[], $10, $11)
     RETURNING user_delegation_id AS id`,
    [tenantId, dati.delegatorUserId, dati.delegateUserId, dati.scope,
     dati.startsOn, dati.endsOn, dati.reason, dati.actorId, dati.groups,
     dati.requestType ?? null, dati.tenantProcessStepId ?? null],
  );
  const id = ins.rows[0]?.id;
  if (!id) throw new Error("delega creata ma senza identificativo");
  const creata = await getDelegation(q, tenantId, id);
  if (!creata) throw new Error("delega creata ma non rileggibile");
  return creata;
}

/**
 * Revoca. Lo stato di partenza è ri-verificato **nella WHERE**, non letto e poi scritto:
 * due revoche concorrenti non devono entrambe «riuscire».
 */
export async function revokeDelegation(
  q: DbConnector,
  tenantId: string,
  id: string,
  actorId: string,
  reason: string | null,
): Promise<{ revocata: boolean }> {
  const res = await q.query(
    `UPDATE sys.sys_user_delegations
        SET user_delegation_status = 'REVOKED',
            user_delegation_reason = coalesce($4, user_delegation_reason),
            updated_at = now(), updated_by = $3
      WHERE user_delegation_id = $1 AND user_delegation_tenant_id = $2
        AND user_delegation_status = 'ACTIVE'`,
    [id, tenantId, actorId, reason],
  );
  return { revocata: (res.rowCount ?? 0) > 0 };
}

/** Le deleghe che riguardano una persona, dai due lati (I17). */
export async function listMyDelegations(
  q: DbConnector,
  tenantId: string,
  userId: string,
): Promise<{ granted: Delegation[]; received: Delegation[] }> {
  const res = await q.query<Riga>(
    `SELECT ${SELEZIONE} ${DA}
      WHERE d.user_delegation_tenant_id = $1
        AND (d.user_delegation_delegator_id = $2 OR d.user_delegation_delegate_id = $2)
      ORDER BY d.user_delegation_starts_on DESC`,
    [tenantId, userId],
  );
  const tutte = res.rows.map(mappa);
  return {
    granted: tutte.filter((d) => d.delegatorUserId === userId),
    received: tutte.filter((d) => d.delegateUserId === userId),
  };
}

/* ── ADR-0051 — le letture della delega di catena ───────────────────────────────────── */

/** Le deleghe di CATENA in vigore oggi ricevute da una persona (APPROVALS, PROCESS_STEP). */
export async function chainDelegationsInForceReceived(
  q: DbConnector,
  tenantId: string,
  delegateUserId: string,
): Promise<Delegation[]> {
  const res = await q.query<Riga>(
    `SELECT ${SELEZIONE} ${DA}
      WHERE d.user_delegation_tenant_id = $1
        AND d.user_delegation_delegate_id = $2
        AND d.user_delegation_scope IN ('APPROVALS', 'PROCESS_STEP')
        AND d.user_delegation_status = 'ACTIVE'
        AND d.user_delegation_starts_on <= current_date
        AND (d.user_delegation_ends_on IS NULL OR d.user_delegation_ends_on >= current_date)
      ORDER BY d.created_at`,
    [tenantId, delegateUserId],
  );
  return res.rows.map(mappa);
}

/** Nome, posizione e unità delle persone indicate (la scheda di scelta del delegato). */
export async function describePeople(
  q: DbConnector,
  tenantId: string,
  userIds: string[],
): Promise<{ userId: string; name: string | null; positionTitle: string | null; organizationUnitName: string | null }[]> {
  if (userIds.length === 0) return [];
  const res = await q.query<{ user_id: string; name: string | null; position_title: string | null; unit_name: string | null }>(
    `SELECT u.user_id,
            nullif(trim(coalesce(u.user_first_name,'') || ' ' || coalesce(u.user_last_name,'')), '') AS name,
            pa.position_title, pa.unit_name
       FROM sys.sys_users u
       LEFT JOIN LATERAL (
         SELECT p.position_title, o.organization_unit_name AS unit_name
           FROM sys.sys_user_position_assignments upa
           JOIN sys.sys_positions p ON p.position_id = upa.user_position_assignment_position_id
           LEFT JOIN sys.sys_organization_units o ON o.organization_unit_id = p.position_organization_unit_id
          WHERE upa.user_position_assignment_user_id = u.user_id
            AND upa.user_position_assignment_status = 'ACTIVE'
          ORDER BY p.position_title
          LIMIT 1
       ) pa ON true
      WHERE u.user_id = ANY($2::uuid[]) AND u.user_tenant_id = $1 AND u.user_status = 'ACTIVE'
      ORDER BY name NULLS LAST`,
    [tenantId, userIds],
  );
  return res.rows.map((r) => ({
    userId: r.user_id, name: r.name, positionTitle: r.position_title, organizationUnitName: r.unit_name,
  }));
}

/** Le attività di processo eseguite dalle unità indicate (ADR-0049), delegabili con PROCESS_STEP. */
export async function processStepsOfUnits(
  q: DbConnector,
  tenantId: string,
  unitIds: string[],
): Promise<{ tenantProcessStepId: string; name: string; processName: string | null; organizationUnitName: string | null; unitId: string }[]> {
  if (unitIds.length === 0) return [];
  const res = await q.query<{ id: string; name: string; process_name: string | null; unit_name: string | null; unit_id: string }>(
    `SELECT st.tenant_process_step_id AS id, st.tenant_process_step_name AS name,
            tp.tenant_process_name AS process_name, o.organization_unit_name AS unit_name,
            st.tenant_process_step_org_unit_id::text AS unit_id
       FROM sys.sys_tenant_process_steps st
       LEFT JOIN sys.sys_tenant_processes tp ON tp.tenant_process_id = st.tenant_process_step_process_id
       LEFT JOIN sys.sys_organization_units o ON o.organization_unit_id = st.tenant_process_step_org_unit_id
      WHERE st.tenant_process_step_tenant_id = $1
        AND st.tenant_process_step_org_unit_id = ANY($2::uuid[])
      ORDER BY tp.tenant_process_name, st.tenant_process_step_ordinal`,
    [tenantId, unitIds],
  );
  return res.rows.map((r) => ({
    tenantProcessStepId: r.id, name: r.name, processName: r.process_name,
    organizationUnitName: r.unit_name, unitId: r.unit_id,
  }));
}

/** L'unità che esegue un'attività di processo del tenant; `undefined` se l'attività non c'è. */
export async function processStepUnit(
  q: DbConnector,
  tenantId: string,
  stepId: string,
): Promise<string | null | undefined> {
  const res = await q.query<{ unit_id: string | null }>(
    `SELECT tenant_process_step_org_unit_id::text AS unit_id
       FROM sys.sys_tenant_process_steps
      WHERE tenant_process_step_id = $1 AND tenant_process_step_tenant_id = $2`,
    [stepId, tenantId],
  );
  return res.rows[0] ? res.rows[0].unit_id : undefined;
}

/**
 * I passi di approvazione APERTI e ATTIVI assegnati a una persona, dei tipi indicati: la casella che
 * il delegato vede per conto del delegante. «Attivo» = il livello più basso ancora aperto della
 * richiesta, come nel servizio delle approvazioni.
 */
export async function openStepsAssignedTo(
  q: DbConnector,
  tenantId: string,
  approverUserId: string,
  resourceTypes: readonly string[],
): Promise<{
  approvalRequestId: string; approvalStepId: string; title: string; body: string | null;
  resourceType: string; priority: string; requesterName: string | null; createdAt: string;
  tenantProcessStepId: string | null;
}[]> {
  const res = await q.query<{
    request_id: string; step_id: string; title: string; body: string | null; resource_type: string;
    priority: string; requester_name: string | null; created_at: Date; step_tps: string | null;
  }>(
    `SELECT r.approval_request_id AS request_id, s.approval_step_id AS step_id,
            r.approval_request_title AS title, r.approval_request_body AS body,
            r.approval_request_resource_type AS resource_type, r.approval_request_priority AS priority,
            nullif(trim(coalesce(c.user_first_name,'') || ' ' || coalesce(c.user_last_name,'')), '') AS requester_name,
            r.created_at, r.approval_request_tenant_process_step_id::text AS step_tps
       FROM sys.sys_approval_steps s
       JOIN sys.sys_approval_requests r ON r.approval_request_id = s.approval_step_request_id
       LEFT JOIN sys.sys_users c ON c.user_id = r.created_by
      WHERE s.approval_step_approver_user_id = $2
        AND s.approval_step_tenant_id = $1
        AND s.approval_step_status = 'PENDING'
        AND r.approval_request_status = 'PENDING'
        AND r.approval_request_resource_type = ANY($3::text[])
        AND s.approval_step_ordinal = (
              SELECT min(s2.approval_step_ordinal) FROM sys.sys_approval_steps s2
               WHERE s2.approval_step_request_id = r.approval_request_id
                 AND s2.approval_step_status = 'PENDING')
      ORDER BY r.created_at`,
    [tenantId, approverUserId, [...resourceTypes]],
  );
  return res.rows.map((r) => ({
    approvalRequestId: r.request_id, approvalStepId: r.step_id, title: r.title, body: r.body,
    resourceType: r.resource_type, priority: r.priority, requesterName: r.requester_name,
    createdAt: r.created_at.toISOString(), tenantProcessStepId: r.step_tps,
  }));
}

/** Le mie assenze APPROVATE che non sono ancora finite, nei prossimi `giorni` giorni. */
export async function upcomingApprovedAbsences(
  q: DbConnector,
  tenantId: string,
  userId: string,
  giorni: number,
): Promise<{ startsOn: string; endsOn: string }[]> {
  const res = await q.query<{ s: string; e: string }>(
    `SELECT request_start_date::text AS s, request_end_date::text AS e
       FROM sys.sys_time_off_requests
      WHERE request_tenant_id = $1 AND request_subject_user_id = $2
        AND request_status = 'APPROVED'
        AND request_end_date >= current_date
        AND request_start_date <= current_date + $3::int
      ORDER BY request_start_date`,
    [tenantId, userId, giorni],
  );
  return res.rows.map((r) => ({ startsOn: r.s, endsOn: r.e }));
}

/** L'ultima persona a cui il delegante ha conferito una delega di catena: il suggerimento dell'agente. */
export async function lastChainDelegateOf(
  q: DbConnector,
  tenantId: string,
  delegatorUserId: string,
): Promise<string | null> {
  const res = await q.query<{ id: string }>(
    `SELECT user_delegation_delegate_id AS id FROM sys.sys_user_delegations
      WHERE user_delegation_tenant_id = $1 AND user_delegation_delegator_id = $2
        AND user_delegation_scope IN ('APPROVALS', 'PROCESS_STEP')
      ORDER BY created_at DESC LIMIT 1`,
    [tenantId, delegatorUserId],
  );
  return res.rows[0]?.id ?? null;
}

/**
 * ADR-0051 §3 — le richieste, fra quelle date, che riguardano la persona: le ha create lei, oppure
 * ne è il soggetto (le ferie e i permessi sono di chi li chiede). Su queste una delega non vale:
 * nessuno approva per conto d'altri una richiesta propria.
 */
export async function requestsConcerning(
  q: DbConnector,
  requestIds: readonly string[],
  userId: string,
): Promise<Set<string>> {
  if (requestIds.length === 0) return new Set();
  const res = await q.query<{ id: string }>(
    `SELECT r.approval_request_id::text AS id
       FROM sys.sys_approval_requests r
       LEFT JOIN sys.sys_time_off_requests t
              ON r.approval_request_resource_type = 'TIME_OFF_REQUEST'
             AND t.request_id = r.approval_request_resource_id
      WHERE r.approval_request_id = ANY($1::uuid[])
        AND (r.created_by = $2 OR t.request_subject_user_id = $2)`,
    [requestIds, userId],
  );
  return new Set(res.rows.map((r) => r.id));
}
