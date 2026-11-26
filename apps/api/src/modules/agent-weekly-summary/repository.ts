/**
 * apps/api/src/modules/agent-weekly-summary/repository.ts — ADR-0063 D3, piano voce F0c.
 *
 * Le scritture fatte con l'assistente, lette dal diario del cancello (`audit.agent_gateway_decisions`).
 * Si riconoscono dalla ragione che il cancello scrive (`apps/agent-gateway/src/write-gate.ts`), che
 * c'è su tutte le righe, anche su quelle di prima di 000482 che non hanno `outcome`:
 *   · `WRITE_HUMAN_APPROVED…`    la persona ha confermato  → CONFERMATA
 *   · `WRITE_DENIED_OR_TIMEOUT…` la persona ha negato o non ha risposto → NEGATA
 *   · `WRITE_CAPABILITY_LIBERA…` eseguita da sola (modo LIBERA, spento da ADR-0063 D4) → AUTONOMA
 * La settimana è dal lunedì alle 00:00 al lunedì dopo, ora di Roma.
 */
import type { Pool, PoolClient } from "pg";

type Db = Pool | PoolClient;

/** Il filtro della ragione, una volta sola: le tre famiglie di scrittura del cancello. */
const ESITO_SQL = `CASE
    WHEN d.reason LIKE 'WRITE_HUMAN_APPROVED%' THEN 'CONFERMATA'
    WHEN d.reason LIKE 'WRITE_DENIED_OR_TIMEOUT%' THEN 'NEGATA'
    WHEN d.reason LIKE 'WRITE_CAPABILITY_LIBERA%' THEN 'AUTONOMA'
  END`;

const NOME_SQL = `COALESCE(NULLIF(concat_ws(', ', NULLIF(trim(u.user_last_name), ''), NULLIF(trim(u.user_first_name), '')), ''), u.user_display_name)`;

/** I confini della settimana che contiene `giorno` (o dell'ultima conclusa), come date di Roma. */
export async function settimana(db: Db, giorno: string | null): Promise<{ start: string; end: string }> {
  const r = await db.query<{ start: string; end: string }>(
    `WITH g AS (
       SELECT COALESCE($1::date, ((now() AT TIME ZONE 'Europe/Rome')::date - 7)) AS d
     )
     SELECT to_char(date_trunc('week', g.d::timestamp)::date, 'YYYY-MM-DD') AS start,
            to_char(date_trunc('week', g.d::timestamp)::date + 6, 'YYYY-MM-DD') AS end
       FROM g`,
    [giorno],
  );
  return r.rows[0]!;
}

export interface RigaScrittura {
  id: string;
  at: string;
  user_id: string | null;
  person_name: string | null;
  tenant_code: string;
  tenant_name: string | null;
  concept: string | null;
  operation: string | null;
  conversation_id: string | null;
  outcome: "CONFERMATA" | "NEGATA" | "AUTONOMA";
}

/**
 * Le scritture della settimana, dalla più recente. `tenantCode` null = tutti i tenant (piattaforma).
 * `limite` tiene la risposta sotto controllo; il totale vero arriva da `contaScritture`.
 */
export async function scritture(
  db: Db, start: string, tenantCode: string | null, limite: number,
): Promise<RigaScrittura[]> {
  const r = await db.query<RigaScrittura>(
    `SELECT d.decision_id::text AS id,
            to_char(d.ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS at,
            u.user_id::text AS user_id,
            ${NOME_SQL} AS person_name,
            d.tenant AS tenant_code,
            t.tenant_name AS tenant_name,
            d.concept, d.operation,
            d.conversation_id::text AS conversation_id,
            ${ESITO_SQL} AS outcome
       FROM audit.agent_gateway_decisions d
       LEFT JOIN sys.sys_users u ON u.user_id::text = d.principal_subject
       LEFT JOIN sys.sys_tenancies t ON t.tenant_code = d.tenant
      WHERE d.ts >= ($1::date)::timestamp AT TIME ZONE 'Europe/Rome'
        AND d.ts <  ($1::date + 7)::timestamp AT TIME ZONE 'Europe/Rome'
        AND ($2::text IS NULL OR d.tenant = $2)
        AND (${ESITO_SQL}) IS NOT NULL
      ORDER BY d.ts DESC, d.decision_id DESC
      LIMIT $3`,
    [start, tenantCode, limite],
  );
  return r.rows;
}

export interface Totali {
  confirmed: number;
  denied: number;
  autonomous: number;
  people: number;
  conversations: number;
  total: number;
}

export async function totali(db: Db, start: string, tenantCode: string | null): Promise<Totali> {
  const r = await db.query<Totali>(
    `WITH s AS (
       SELECT d.principal_subject, d.tenant, d.conversation_id, ${ESITO_SQL} AS esito
         FROM audit.agent_gateway_decisions d
        WHERE d.ts >= ($1::date)::timestamp AT TIME ZONE 'Europe/Rome'
          AND d.ts <  ($1::date + 7)::timestamp AT TIME ZONE 'Europe/Rome'
          AND ($2::text IS NULL OR d.tenant = $2)
     )
     SELECT count(*) FILTER (WHERE esito = 'CONFERMATA')::int AS confirmed,
            count(*) FILTER (WHERE esito = 'NEGATA')::int AS denied,
            count(*) FILTER (WHERE esito = 'AUTONOMA')::int AS autonomous,
            count(DISTINCT (tenant, principal_subject)) FILTER (WHERE esito IS NOT NULL)::int AS people,
            count(DISTINCT conversation_id) FILTER (WHERE esito IS NOT NULL)::int AS conversations,
            count(*) FILTER (WHERE esito IS NOT NULL)::int AS total
       FROM s`,
    [start, tenantCode],
  );
  return r.rows[0]!;
}

export interface RigaPersona {
  user_id: string | null;
  person_name: string | null;
  tenant_code: string;
  tenant_name: string | null;
  confirmed: number;
  denied: number;
  autonomous: number;
  last_at: string;
}

/** Una riga per persona e tenant, in ordine di cognome (R1), le persone che non ci sono più in fondo. */
export async function persone(db: Db, start: string, tenantCode: string | null): Promise<RigaPersona[]> {
  const r = await db.query<RigaPersona>(
    `WITH s AS (
       SELECT d.principal_subject, d.tenant, d.ts, ${ESITO_SQL} AS esito
         FROM audit.agent_gateway_decisions d
        WHERE d.ts >= ($1::date)::timestamp AT TIME ZONE 'Europe/Rome'
          AND d.ts <  ($1::date + 7)::timestamp AT TIME ZONE 'Europe/Rome'
          AND ($2::text IS NULL OR d.tenant = $2)
     )
     SELECT u.user_id::text AS user_id,
            ${NOME_SQL} AS person_name,
            s.tenant AS tenant_code,
            t.tenant_name AS tenant_name,
            count(*) FILTER (WHERE s.esito = 'CONFERMATA')::int AS confirmed,
            count(*) FILTER (WHERE s.esito = 'NEGATA')::int AS denied,
            count(*) FILTER (WHERE s.esito = 'AUTONOMA')::int AS autonomous,
            to_char(max(s.ts) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_at
       FROM s
       LEFT JOIN sys.sys_users u ON u.user_id::text = s.principal_subject
       LEFT JOIN sys.sys_tenancies t ON t.tenant_code = s.tenant
      WHERE s.esito IS NOT NULL
      GROUP BY u.user_id, u.user_last_name, u.user_first_name, u.user_display_name, s.principal_subject, s.tenant, t.tenant_name
      ORDER BY (u.user_id IS NULL), lower(u.user_last_name) NULLS LAST, lower(u.user_first_name) NULLS LAST, s.tenant`,
    [start, tenantCode],
  );
  return r.rows;
}

/** Il codice del tenant di una sessione (il diario lo registra per codice). */
export async function codiceTenant(db: Db, tenantId: string): Promise<string | null> {
  const r = await db.query<{ tenant_code: string }>(
    `SELECT tenant_code FROM sys.sys_tenancies WHERE tenant_id = $1`,
    [tenantId],
  );
  return r.rows[0]?.tenant_code ?? null;
}

/** I nomi dei permessi in italiano e in inglese, per descrivere le operazioni senza codici (R4). */
export async function nomiPermessi(db: Db, codici: string[]): Promise<Map<string, { it: string; en: string }>> {
  if (codici.length === 0) return new Map();
  const r = await db.query<{ code: string; it: string; en: string | null }>(
    `SELECT p.auth_permission_code AS code, p.auth_permission_name AS it, tr.text AS en
       FROM sys.sys_auth_permissions p
       LEFT JOIN sys.sys_reference_translations tr
              ON tr.entity_table = 'sys_auth_permissions' AND tr.entity_id = p.auth_permission_id
             AND tr.field = 'name' AND tr.locale = 'en'
      WHERE p.auth_permission_code = ANY($1::text[])`,
    [codici],
  );
  return new Map(r.rows.map((x) => [x.code, { it: x.it, en: x.en ?? x.it }]));
}

/** Le persone a cui va il riepilogo: chi ha il mandato di piattaforma, attive (ADR-0063 D3, E5). */
export async function destinatari(db: Db): Promise<Array<{ user_id: string; tenant_id: string | null }>> {
  const r = await db.query<{ user_id: string; tenant_id: string | null }>(
    `SELECT DISTINCT u.user_id::text AS user_id, u.user_tenant_id::text AS tenant_id
       FROM sys.sys_users u
       JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id AND ur.user_auth_role_revoked_at IS NULL
       JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
      WHERE r.auth_role_code = 'PLATFORM_ADMIN' AND u.user_status = 'ACTIVE'
      ORDER BY 1`,
  );
  return r.rows;
}
