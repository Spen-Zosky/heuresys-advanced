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
  d.user_delegation_scope, d.user_delegation_starts_on, d.user_delegation_ends_on,
  d.user_delegation_status, d.user_delegation_reason, d.created_at, d.updated_at,
  nullif(trim(coalesce(ud.user_first_name,'') || ' ' || coalesce(ud.user_last_name,'')), '') AS delegator_name,
  nullif(trim(coalesce(ue.user_first_name,'') || ' ' || coalesce(ue.user_last_name,'')), '') AS delegate_name,
  (d.user_delegation_status = 'ACTIVE'
   AND d.user_delegation_starts_on <= current_date
   AND (d.user_delegation_ends_on IS NULL OR d.user_delegation_ends_on >= current_date)) AS is_in_force`;

const DA = `
  FROM sys.sys_user_delegations d
  LEFT JOIN sys.sys_users ud ON ud.user_id = d.user_delegation_delegator_id
  LEFT JOIN sys.sys_users ue ON ue.user_id = d.user_delegation_delegate_id`;

function mappa(r: Riga): Delegation {
  return {
    delegationId: r.user_delegation_id,
    tenantId: r.user_delegation_tenant_id,
    delegatorUserId: r.user_delegation_delegator_id,
    delegatorName: r.delegator_name,
    delegateUserId: r.user_delegation_delegate_id,
    delegateName: r.delegate_name,
    scope: r.user_delegation_scope as Delegation["scope"],
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
    delegatorUserId: string; delegateUserId: string; scope: string;
    startsOn: string; endsOn: string | null; reason: string | null; actorId: string;
  },
): Promise<Delegation> {
  const ins = await q.query<{ id: string }>(
    `INSERT INTO sys.sys_user_delegations
       (user_delegation_tenant_id, user_delegation_delegator_id, user_delegation_delegate_id,
        user_delegation_scope, user_delegation_starts_on, user_delegation_ends_on,
        user_delegation_reason, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5::date, $6::date, $7, $8, $8)
     RETURNING user_delegation_id AS id`,
    [tenantId, dati.delegatorUserId, dati.delegateUserId, dati.scope,
     dati.startsOn, dati.endsOn, dati.reason, dati.actorId],
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
