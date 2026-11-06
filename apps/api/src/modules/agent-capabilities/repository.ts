/**
 * apps/api/src/modules/agent-capabilities/repository.ts — ADR-0053 A1/A3/D4, piano T3c.
 *
 * SQL sul registro delle capacità degli agenti (migrazione 000480). Le regole che contano (bozza
 * chiusa dopo la pubblicazione, GET = A, DELETE = C, `LIBERA` solo su B senza C, solo aggiunte
 * nelle attivazioni) le tiene il database; qui si legge e si scrive.
 */
import type { PoolClient } from "pg";
import type {
  AgentCapability,
  AgentCapabilityActivation,
  AgentCapabilityOperation,
  AddAgentCapabilityOperationBody,
  CreateAgentCapabilityBody,
  AgentCapabilityMode,
} from "@heuresys/shared";

type Q = Pick<PoolClient, "query">;

const iso = (v: unknown): string | null => (v == null ? null : new Date(v as string).toISOString());

function capacita(r: Record<string, unknown>, operations: AgentCapabilityOperation[], activation: AgentCapabilityActivation | null): AgentCapability {
  return {
    id: r.agent_capability_id as string,
    code: r.agent_capability_code as string,
    version: Number(r.agent_capability_version),
    agentCode: r.agent_capability_agent_code as string,
    description: r.agent_capability_description as string,
    dataGroups: (r.agent_capability_data_groups as string[]) ?? [],
    excludedGroups: (r.agent_capability_excluded_groups as string[]) ?? [],
    undoMechanism: r.agent_capability_undo_mechanism as AgentCapability["undoMechanism"],
    undoRef: r.agent_capability_undo_ref as string,
    volumeCap: Number(r.agent_capability_volume_cap),
    status: r.agent_capability_status as AgentCapability["status"],
    publishedAt: iso(r.agent_capability_published_at),
    operations,
    activation,
  };
}

function operazione(r: Record<string, unknown>): AgentCapabilityOperation {
  return {
    id: r.agent_capability_operation_id as string,
    conceptId: r.agent_capability_operation_concept_id as string,
    operationId: r.agent_capability_operation_operation_id as string,
    httpMethod: r.agent_capability_operation_http_method as AgentCapabilityOperation["httpMethod"],
    actionClass: r.agent_capability_operation_action_class as AgentCapabilityOperation["actionClass"],
  };
}

function attivazione(r: Record<string, unknown>): AgentCapabilityActivation {
  return {
    id: r.agent_capability_activation_id as string,
    tenantId: r.agent_capability_activation_tenant_id as string,
    mode: r.agent_capability_activation_mode as AgentCapabilityMode,
    source: r.agent_capability_activation_source as AgentCapabilityActivation["source"],
    reason: r.agent_capability_activation_reason as string,
    decidedBy: (r.agent_capability_activation_decided_by as string | null) ?? null,
    decidedAt: iso(r.agent_capability_activation_decided_at) as string,
  };
}

/** Le capacità, ciascuna con le sue operazioni e con il modo in vigore per `tenantId`. */
export async function list(db: Q, tenantId: string | null, id?: string): Promise<AgentCapability[]> {
  const caps = await db.query(
    `SELECT * FROM sys.sys_agent_capabilities
      WHERE ($1::uuid IS NULL OR agent_capability_id = $1)
      ORDER BY agent_capability_code, agent_capability_version`,
    [id ?? null],
  );
  if (caps.rows.length === 0) return [];
  const ids = caps.rows.map((r) => r.agent_capability_id as string);
  const ops = await db.query(
    `SELECT * FROM sys.sys_agent_capability_operations
      WHERE agent_capability_operation_capability_id = ANY($1::uuid[])
      ORDER BY agent_capability_operation_concept_id, agent_capability_operation_operation_id`,
    [ids],
  );
  const acts = tenantId
    ? await db.query(
        `SELECT a.* FROM sys.v_agent_capability_activations_current v
           JOIN sys.sys_agent_capability_activations a
             ON a.agent_capability_activation_id = v.agent_capability_activation_id
          WHERE v.agent_capability_activation_tenant_id = $1::uuid
            AND v.agent_capability_activation_capability_id = ANY($2::uuid[])`,
        [tenantId, ids],
      )
    : { rows: [] as Record<string, unknown>[] };
  return caps.rows.map((c) => {
    const cid = c.agent_capability_id as string;
    const a = acts.rows.find((x) => x.agent_capability_activation_capability_id === cid);
    return capacita(
      c,
      ops.rows.filter((o) => o.agent_capability_operation_capability_id === cid).map(operazione),
      a ? attivazione(a) : null,
    );
  });
}

/** Una capacità nuova in bozza, con la versione successiva a quelle dello stesso codice. */
export async function create(db: Q, body: CreateAgentCapabilityBody, createdBy: string): Promise<string> {
  const { rows } = await db.query(
    `INSERT INTO sys.sys_agent_capabilities
       (agent_capability_code, agent_capability_version, agent_capability_agent_code,
        agent_capability_description, agent_capability_data_groups, agent_capability_excluded_groups,
        agent_capability_undo_mechanism, agent_capability_undo_ref, agent_capability_volume_cap,
        agent_capability_created_by)
     SELECT $1::varchar, coalesce(max(agent_capability_version), 0) + 1, $2::varchar, $3::text,
            $4::text[], $5::text[], $6::varchar, $7::varchar, $8::integer, $9::uuid
       FROM sys.sys_agent_capabilities WHERE agent_capability_code = $1::varchar
     RETURNING agent_capability_id`,
    [body.code, body.agentCode, body.description, body.dataGroups, body.excludedGroups,
      body.undoMechanism, body.undoRef, body.volumeCap, createdBy],
  );
  return rows[0]!.agent_capability_id as string;
}

export async function addOperation(db: Q, capabilityId: string, b: AddAgentCapabilityOperationBody): Promise<void> {
  await db.query(
    `INSERT INTO sys.sys_agent_capability_operations
       (agent_capability_operation_capability_id, agent_capability_operation_concept_id,
        agent_capability_operation_operation_id, agent_capability_operation_http_method,
        agent_capability_operation_action_class)
     VALUES ($1, $2, $3, $4, $5)`,
    [capabilityId, b.conceptId, b.operationId, b.httpMethod, b.actionClass],
  );
}

/** Lo stato della capacità, o `undefined` se non esiste. */
export async function statusOf(db: Q, id: string): Promise<AgentCapability["status"] | undefined> {
  const { rows } = await db.query(
    `SELECT agent_capability_status FROM sys.sys_agent_capabilities WHERE agent_capability_id = $1`,
    [id],
  );
  return rows[0]?.agent_capability_status as AgentCapability["status"] | undefined;
}

export async function setStatus(db: Q, id: string, status: "PUBBLICATA" | "RITIRATA"): Promise<number> {
  const { rowCount } = await db.query(
    `UPDATE sys.sys_agent_capabilities
        SET agent_capability_status = $2,
            agent_capability_published_at = coalesce(agent_capability_published_at, now())
      WHERE agent_capability_id = $1
        AND agent_capability_status = CASE $2 WHEN 'PUBBLICATA' THEN 'BOZZA' ELSE 'PUBBLICATA' END`,
    [id, status],
  );
  return rowCount ?? 0;
}

export async function tenantExists(db: Q, tenantId: string): Promise<boolean> {
  const { rowCount } = await db.query(`SELECT 1 FROM sys.sys_tenancies WHERE tenant_id = $1`, [tenantId]);
  return (rowCount ?? 0) > 0;
}

/** Una decisione sul modo: una riga nuova che sostituisce quella in vigore (solo aggiunte). */
export async function decide(
  db: Q,
  a: {
    tenantId: string;
    capabilityId: string;
    mode: AgentCapabilityMode;
    reason: string;
    decidedBy: string;
    noticeRef: string | null;
    rollbackProofRef: string | null;
  },
): Promise<string> {
  const { rows } = await db.query(
    `INSERT INTO sys.sys_agent_capability_activations
       (agent_capability_activation_tenant_id, agent_capability_activation_capability_id,
        agent_capability_activation_mode, agent_capability_activation_source,
        agent_capability_activation_notice_ref, agent_capability_activation_rollback_proof_ref,
        agent_capability_activation_reason, agent_capability_activation_decided_by,
        agent_capability_activation_supersedes_id)
     SELECT $1::uuid, $2::uuid, $3::varchar, 'PERSONA', $4::varchar, $5::varchar, $6::text, $7::uuid,
            (SELECT v.agent_capability_activation_id FROM sys.v_agent_capability_activations_current v
              WHERE v.agent_capability_activation_tenant_id = $1::uuid
                AND v.agent_capability_activation_capability_id = $2::uuid)
     RETURNING agent_capability_activation_id`,
    [a.tenantId, a.capabilityId, a.mode, a.noticeRef, a.rollbackProofRef, a.reason, a.decidedBy],
  );
  return rows[0]!.agent_capability_activation_id as string;
}
