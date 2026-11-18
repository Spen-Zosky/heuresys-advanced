/**
 * apps/api/src/modules/agent-requests/repository.ts — tappa T2, migrazione 000499.
 *
 * SQL sulle richieste dell'agente e sul registro delle sue chiamate. Il cancello vero (previsione
 * dentro il tetto, motivo del rifiuto, decisione coerente con lo stato) lo tiene il database con i
 * CHECK della 000499; il servizio ne dà un errore leggibile prima.
 */
import type { PoolClient } from "pg";
import type { AgentCall, AgentRequest, AgentRequestStatus } from "@heuresys/shared";

type Q = Pick<PoolClient, "query">;

const iso = (v: unknown): string | null => (v == null ? null : new Date(v as string).toISOString());

const COLONNE_RICHIESTA = `r.agent_request_id, r.agent_request_tenant_id, r.agent_request_requester_id,
  nullif(concat_ws(', ', nullif(trim(u.user_last_name), ''), nullif(trim(u.user_first_name), '')), '') AS requester_name,
  r.agent_request_agent_code, r.agent_request_title, r.agent_request_body, r.agent_request_perimeter,
  r.agent_request_estimate_usd, r.agent_request_cap_usd, r.agent_request_status,
  r.agent_request_reject_reason, r.agent_request_decided_at, r.agent_request_created_at`;
const DA_RICHIESTA = `sys.sys_agent_requests r
  LEFT JOIN sys.sys_users u ON u.user_id = r.agent_request_requester_id`;

function richiesta(r: Record<string, unknown>): AgentRequest {
  return {
    id: r.agent_request_id as string,
    tenantId: r.agent_request_tenant_id as string,
    requesterId: (r.agent_request_requester_id as string | null) ?? null,
    requesterName: (r.requester_name as string | null) ?? null,
    agentCode: r.agent_request_agent_code as string,
    title: r.agent_request_title as string,
    body: r.agent_request_body as string,
    perimeter: r.agent_request_perimeter as string,
    estimateUsd: Number(r.agent_request_estimate_usd),
    capUsd: Number(r.agent_request_cap_usd),
    status: r.agent_request_status as AgentRequestStatus,
    rejectReason: (r.agent_request_reject_reason as string | null) ?? null,
    decidedAt: iso(r.agent_request_decided_at),
    createdAt: iso(r.agent_request_created_at) as string,
  };
}

export async function createRequest(
  q: Q,
  chi: { userId: string; tenantId: string },
  b: { agentCode: string; title: string; body: string; perimeter: string; estimateUsd: number; capUsd: number },
): Promise<string> {
  const { rows } = await q.query(
    `INSERT INTO sys.sys_agent_requests
       (agent_request_tenant_id, agent_request_requester_id, agent_request_agent_code, agent_request_title,
        agent_request_body, agent_request_perimeter, agent_request_estimate_usd, agent_request_cap_usd)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING agent_request_id`,
    [chi.tenantId, chi.userId, b.agentCode, b.title, b.body, b.perimeter, b.estimateUsd, b.capUsd],
  );
  return rows[0].agent_request_id as string;
}

export async function getRequest(q: Q, id: string): Promise<AgentRequest | null> {
  const { rows } = await q.query(
    `SELECT ${COLONNE_RICHIESTA} FROM ${DA_RICHIESTA} WHERE r.agent_request_id = $1`, [id]);
  return rows[0] ? richiesta(rows[0]) : null;
}

/** Le richieste di una persona nel suo tenant, oppure (`tutte`) la coda di tutti i tenant. */
export async function listRequests(
  q: Q,
  filtro: { userId: string; tenantId: string | null; tutte: boolean; status?: AgentRequestStatus },
): Promise<AgentRequest[]> {
  const { rows } = await q.query(
    `SELECT ${COLONNE_RICHIESTA} FROM ${DA_RICHIESTA}
      WHERE ($1::boolean OR (r.agent_request_requester_id = $2 AND r.agent_request_tenant_id = $3))
        AND ($4::text IS NULL OR r.agent_request_status = $4)
      ORDER BY (r.agent_request_status = 'IN_ATTESA') DESC, r.agent_request_created_at DESC
      LIMIT 500`,
    [filtro.tutte, filtro.userId, filtro.tenantId, filtro.status ?? null],
  );
  return rows.map(richiesta);
}

/** Decide solo una richiesta ancora in attesa: la guardia sta nella condizione, non in una lettura prima. */
export async function decideRequest(
  q: Q,
  id: string,
  deciso: { by: string; accepted: boolean; reason: string | null },
): Promise<boolean> {
  const { rowCount } = await q.query(
    `UPDATE sys.sys_agent_requests
        SET agent_request_status = $2, agent_request_reject_reason = $3,
            agent_request_decided_by = $4, agent_request_decided_at = now()
      WHERE agent_request_id = $1 AND agent_request_status = 'IN_ATTESA'`,
    [id, deciso.accepted ? "ACCETTATA" : "RIFIUTATA", deciso.accepted ? null : deciso.reason, deciso.by],
  );
  return (rowCount ?? 0) === 1;
}

export async function createCall(
  q: Q,
  chi: { userId: string; tenantId: string },
  b: {
    agentCode: string; model: string; outcome: string; durationMs: number;
    inputTokens: number; outputTokens: number; costUsd: number; requestId?: string | undefined;
  },
): Promise<AgentCall> {
  const { rows } = await q.query(
    `INSERT INTO sys.sys_agent_call_log
       (agent_call_tenant_id, agent_call_user_id, agent_call_request_id, agent_call_agent_code, agent_call_model,
        agent_call_outcome, agent_call_duration_ms, agent_call_input_tokens, agent_call_output_tokens, agent_call_cost_usd)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [chi.tenantId, chi.userId, b.requestId ?? null, b.agentCode, b.model, b.outcome, b.durationMs,
     b.inputTokens, b.outputTokens, b.costUsd],
  );
  return chiamata(rows[0]);
}

export async function listCalls(q: Q, limit: number): Promise<AgentCall[]> {
  const { rows } = await q.query(
    `SELECT * FROM sys.sys_agent_call_log ORDER BY agent_call_created_at DESC LIMIT $1`, [limit]);
  return rows.map(chiamata);
}

/** Vero se la richiesta esiste ed è del tenant dato: il registro non si lega a una richiesta altrui. */
export async function requestInTenant(q: Q, id: string, tenantId: string): Promise<boolean> {
  const { rows } = await q.query(
    `SELECT 1 FROM sys.sys_agent_requests WHERE agent_request_id = $1 AND agent_request_tenant_id = $2`,
    [id, tenantId]);
  return rows.length === 1;
}

function chiamata(r: Record<string, unknown>): AgentCall {
  return {
    id: r.agent_call_id as string,
    tenantId: r.agent_call_tenant_id as string,
    agentCode: r.agent_call_agent_code as string,
    model: r.agent_call_model as string,
    outcome: r.agent_call_outcome as AgentCall["outcome"],
    durationMs: Number(r.agent_call_duration_ms),
    inputTokens: Number(r.agent_call_input_tokens),
    outputTokens: Number(r.agent_call_output_tokens),
    costUsd: Number(r.agent_call_cost_usd),
    requestId: (r.agent_call_request_id as string | null) ?? null,
    createdAt: iso(r.agent_call_created_at) as string,
  };
}
