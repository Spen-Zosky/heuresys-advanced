/**
 * apps/api/src/modules/agent-conversations/repository.ts — ADR-0056 D4, piano T6a.
 *
 * SQL sulle conversazioni dell'assistente (migrazione 000483). Ogni lettura e ogni scrittura passa
 * dalla persona proprietaria: la conversazione si cerca per identificativo E per tenant e persona,
 * così una riga di un altro non esiste per chi chiama (I5, ADR-0056 §4). Le regole di forma (motivo
 * dello scarto, fine dell'attività, misura degli eventi, scadenza) le tiene il database.
 *
 * Due stati si calcolano qui e non si scrivono: `SCADUTA` per una proposta in attesa oltre la
 * scadenza, `INTERROTTA` per un'attività aperta più vecchia di `AGENT_ACTIVITY_STALE_MINUTES`.
 */
import type { PoolClient } from "pg";
import {
  AGENT_ACTIVITY_STALE_MINUTES,
  type AgentActivity,
  type AgentActivityEvent,
  type AgentConversation,
  type AgentConversationSummary,
  type AgentProposal,
  type AppendAgentActivityEventBody,
  type CreateAgentProposalBody,
  type UpdateAgentActivityBody,
} from "@heuresys/shared";

type Q = Pick<PoolClient, "query">;

/** Di chi è la riga: la persona e il suo tenant. */
export interface Proprietario {
  userId: string;
  tenantId: string;
}

const iso = (v: unknown): string | null => (v == null ? null : new Date(v as string).toISOString());

// Lo stato come si legge: un'attività aperta troppo vecchia è interrotta, anche se nessuno l'ha chiusa.
const STATO_ATTIVITA = `CASE
    WHEN a.agent_activity_status IN ('IN_CORSO', 'IN_ATTESA')
     AND a.agent_activity_started_at < now() - interval '${AGENT_ACTIVITY_STALE_MINUTES} minutes'
    THEN 'INTERROTTA' ELSE a.agent_activity_status END`;
const STATO_PROPOSTA = `CASE
    WHEN p.agent_proposal_status = 'IN_ATTESA' AND p.agent_proposal_expires_at <= now()
    THEN 'SCADUTA' ELSE p.agent_proposal_status END`;
const IN_ATTESA_VIVE = `(SELECT count(*) FROM sys.sys_agent_proposals p
    WHERE p.agent_proposal_activity_id = a.agent_activity_id
      AND p.agent_proposal_status = 'IN_ATTESA' AND p.agent_proposal_expires_at > now())`;

function attivita(r: Record<string, unknown>): AgentActivity {
  return {
    id: r.agent_activity_id as string,
    conversationId: r.agent_activity_conversation_id as string,
    prompt: r.agent_activity_prompt as string,
    status: r.stato as AgentActivity["status"],
    stopReason: (r.agent_activity_stop_reason as AgentActivity["stopReason"]) ?? null,
    result: (r.agent_activity_result as string | null) ?? null,
    startedAt: iso(r.agent_activity_started_at) as string,
    endedAt: iso(r.agent_activity_ended_at),
    pendingProposals: Number(r.in_attesa ?? 0),
  };
}

function sommario(r: Record<string, unknown>): AgentConversationSummary {
  return {
    id: r.agent_conversation_id as string,
    agentCode: r.agent_conversation_agent_code as string,
    title: r.agent_conversation_title as string,
    createdAt: iso(r.agent_conversation_created_at) as string,
    updatedAt: iso(r.agent_conversation_updated_at) as string,
    lastActivityStatus: (r.ultimo_stato as AgentConversationSummary["lastActivityStatus"]) ?? null,
  };
}

function proposta(r: Record<string, unknown>): AgentProposal {
  return {
    id: r.agent_proposal_id as string,
    activityId: r.agent_proposal_activity_id as string,
    kind: r.agent_proposal_kind as AgentProposal["kind"],
    tool: r.agent_proposal_tool as string,
    input: r.agent_proposal_input,
    actionClass: (r.agent_proposal_action_class as AgentProposal["actionClass"]) ?? null,
    personsCount: r.agent_proposal_persons_count == null ? null : Number(r.agent_proposal_persons_count),
    status: r.stato as AgentProposal["status"],
    rejectReason: (r.agent_proposal_reject_reason as string | null) ?? null,
    createdAt: iso(r.agent_proposal_created_at) as string,
    expiresAt: iso(r.agent_proposal_expires_at) as string,
    decidedAt: iso(r.agent_proposal_decided_at),
  };
}

const ULTIMO_STATO = `(SELECT ${STATO_ATTIVITA} FROM sys.sys_agent_activities a
    WHERE a.agent_activity_conversation_id = c.agent_conversation_id
    ORDER BY a.agent_activity_started_at DESC LIMIT 1)`;

export async function list(db: Q, chi: Proprietario): Promise<AgentConversationSummary[]> {
  const r = await db.query(
    `SELECT c.*, ${ULTIMO_STATO} AS ultimo_stato
       FROM sys.sys_agent_conversations c
      WHERE c.agent_conversation_tenant_id = $1 AND c.agent_conversation_user_id = $2
      ORDER BY c.agent_conversation_updated_at DESC
      LIMIT 200`,
    [chi.tenantId, chi.userId],
  );
  return r.rows.map(sommario);
}

export async function create(db: Q, chi: Proprietario, agentCode: string, title: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO sys.sys_agent_conversations
       (agent_conversation_tenant_id, agent_conversation_user_id, agent_conversation_agent_code, agent_conversation_title)
     VALUES ($1, $2, $3, $4) RETURNING agent_conversation_id AS id`,
    [chi.tenantId, chi.userId, agentCode, title],
  );
  return r.rows[0]!.id;
}

/** La conversazione della persona, o `undefined` se non esiste o è di un altro. */
export async function get(db: Q, chi: Proprietario, id: string): Promise<AgentConversation | undefined> {
  const c = await db.query(
    `SELECT c.*, ${ULTIMO_STATO} AS ultimo_stato
       FROM sys.sys_agent_conversations c
      WHERE c.agent_conversation_id = $1
        AND c.agent_conversation_tenant_id = $2 AND c.agent_conversation_user_id = $3`,
    [id, chi.tenantId, chi.userId],
  );
  const row = c.rows[0] as Record<string, unknown> | undefined;
  if (!row) return undefined;
  const a = await db.query(
    `SELECT a.*, ${STATO_ATTIVITA} AS stato, ${IN_ATTESA_VIVE} AS in_attesa
       FROM sys.sys_agent_activities a
      WHERE a.agent_activity_conversation_id = $1
      ORDER BY a.agent_activity_started_at`,
    [id],
  );
  return {
    ...sommario(row),
    sdkSessionRef: (row.agent_conversation_sdk_session_ref as string | null) ?? null,
    personsSeen: (row.agent_conversation_persons_seen as string[]) ?? [],
    activities: a.rows.map(attivita),
  };
}

/** Aggiorna la sessione da riprendere e aggiunge impronte di persone (l'insieme non si accorcia). */
export async function update(
  db: Q,
  chi: Proprietario,
  id: string,
  sdkSessionRef: string | undefined,
  personsSeen: readonly string[] | undefined,
): Promise<boolean> {
  const r = await db.query(
    `UPDATE sys.sys_agent_conversations c
        SET agent_conversation_sdk_session_ref = COALESCE($4, c.agent_conversation_sdk_session_ref),
            agent_conversation_persons_seen = ARRAY(
              SELECT DISTINCT x FROM unnest(c.agent_conversation_persons_seen || COALESCE($5::text[], '{}')) AS x
               ORDER BY x),
            agent_conversation_updated_at = now()
      WHERE c.agent_conversation_id = $1
        AND c.agent_conversation_tenant_id = $2 AND c.agent_conversation_user_id = $3`,
    [id, chi.tenantId, chi.userId, sdkSessionRef ?? null, personsSeen ?? null],
  );
  return (r.rowCount ?? 0) > 0;
}

/** Apre un'attività nella conversazione della persona; `undefined` se la conversazione non è sua. */
export async function createActivity(db: Q, chi: Proprietario, conversationId: string, prompt: string): Promise<string | undefined> {
  const r = await db.query<{ id: string }>(
    `WITH c AS (
       UPDATE sys.sys_agent_conversations SET agent_conversation_updated_at = now()
        WHERE agent_conversation_id = $1
          AND agent_conversation_tenant_id = $2 AND agent_conversation_user_id = $3
        RETURNING agent_conversation_id)
     INSERT INTO sys.sys_agent_activities (agent_activity_conversation_id, agent_activity_prompt)
     SELECT agent_conversation_id, $4 FROM c
     RETURNING agent_activity_id AS id`,
    [conversationId, chi.tenantId, chi.userId, prompt],
  );
  return r.rows[0]?.id;
}

/**
 * L'attività della persona, con lo stato come si legge. `forUpdate` blocca la riga, perché chi
 * aggiunge un evento o una proposta lo faccia su un'attività che nel frattempo non si è chiusa.
 */
export async function getActivity(db: Q, chi: Proprietario, activityId: string, forUpdate = false): Promise<AgentActivity | undefined> {
  const r = await db.query(
    `SELECT a.*, ${STATO_ATTIVITA} AS stato, ${IN_ATTESA_VIVE} AS in_attesa
       FROM sys.sys_agent_activities a
       JOIN sys.sys_agent_conversations c ON c.agent_conversation_id = a.agent_activity_conversation_id
      WHERE a.agent_activity_id = $1
        AND c.agent_conversation_tenant_id = $2 AND c.agent_conversation_user_id = $3
      ${forUpdate ? "FOR UPDATE OF a" : ""}`,
    [activityId, chi.tenantId, chi.userId],
  );
  const row = r.rows[0] as Record<string, unknown> | undefined;
  return row ? attivita(row) : undefined;
}

export async function updateActivity(db: Q, activityId: string, body: UpdateAgentActivityBody): Promise<void> {
  const chiusa = body.status !== "IN_CORSO" && body.status !== "IN_ATTESA";
  await db.query(
    `UPDATE sys.sys_agent_activities
        SET agent_activity_status = $2,
            agent_activity_stop_reason = COALESCE($3, agent_activity_stop_reason),
            agent_activity_result = COALESCE($4, agent_activity_result),
            agent_activity_ended_at = CASE WHEN $5 THEN now() ELSE NULL END
      WHERE agent_activity_id = $1`,
    [activityId, body.status, body.stopReason ?? null, body.result ?? null, chiusa],
  );
}

/** Aggiunge un evento con il numero successivo; la riga dell'attività è già bloccata da chi chiama. */
export async function appendEvent(db: Q, activityId: string, body: AppendAgentActivityEventBody): Promise<number> {
  const r = await db.query<{ seq: number }>(
    `INSERT INTO sys.sys_agent_activity_events
       (agent_activity_event_activity_id, agent_activity_event_seq, agent_activity_event_kind, agent_activity_event_payload)
     SELECT $1, COALESCE(max(agent_activity_event_seq), 0) + 1, $2, $3::jsonb
       FROM sys.sys_agent_activity_events WHERE agent_activity_event_activity_id = $1
     RETURNING agent_activity_event_seq AS seq`,
    [activityId, body.kind, JSON.stringify(body.payload)],
  );
  return Number(r.rows[0]!.seq);
}

export async function listEvents(db: Q, activityId: string, after: number): Promise<AgentActivityEvent[]> {
  const r = await db.query(
    `SELECT * FROM sys.sys_agent_activity_events
      WHERE agent_activity_event_activity_id = $1 AND agent_activity_event_seq > $2
      ORDER BY agent_activity_event_seq LIMIT 1000`,
    [activityId, after],
  );
  return r.rows.map((x: Record<string, unknown>) => ({
    seq: Number(x.agent_activity_event_seq),
    kind: x.agent_activity_event_kind as AgentActivityEvent["kind"],
    payload: x.agent_activity_event_payload as Record<string, unknown>,
    createdAt: iso(x.agent_activity_event_created_at) as string,
  }));
}

export async function listProposals(db: Q, activityId: string): Promise<AgentProposal[]> {
  const r = await db.query(
    `SELECT p.*, ${STATO_PROPOSTA} AS stato FROM sys.sys_agent_proposals p
      WHERE p.agent_proposal_activity_id = $1 ORDER BY p.agent_proposal_created_at`,
    [activityId],
  );
  return r.rows.map(proposta);
}

export async function createProposal(db: Q, activityId: string, body: CreateAgentProposalBody): Promise<void> {
  await db.query(
    `INSERT INTO sys.sys_agent_proposals
       (agent_proposal_id, agent_proposal_activity_id, agent_proposal_kind, agent_proposal_tool, agent_proposal_input,
        agent_proposal_action_class, agent_proposal_persons_count, agent_proposal_expires_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
    [
      body.proposalId,
      activityId,
      body.kind,
      body.tool,
      JSON.stringify(body.input ?? null),
      body.actionClass ?? null,
      body.personsCount ?? null,
      body.expiresAt,
    ],
  );
}

/** La proposta della persona, bloccata per la decisione; `undefined` se non esiste o è di un altro. */
export async function getProposalForUpdate(db: Q, chi: Proprietario, proposalId: string): Promise<AgentProposal | undefined> {
  const r = await db.query(
    `SELECT p.*, ${STATO_PROPOSTA} AS stato
       FROM sys.sys_agent_proposals p
       JOIN sys.sys_agent_activities a ON a.agent_activity_id = p.agent_proposal_activity_id
       JOIN sys.sys_agent_conversations c ON c.agent_conversation_id = a.agent_activity_conversation_id
      WHERE p.agent_proposal_id = $1
        AND c.agent_conversation_tenant_id = $2 AND c.agent_conversation_user_id = $3
      FOR UPDATE OF p`,
    [proposalId, chi.tenantId, chi.userId],
  );
  const row = r.rows[0] as Record<string, unknown> | undefined;
  return row ? proposta(row) : undefined;
}

export async function decideProposal(
  db: Q,
  proposalId: string,
  decision: "APPROVATA" | "SCARTATA",
  reason: string | null,
): Promise<AgentProposal> {
  const r = await db.query(
    `UPDATE sys.sys_agent_proposals p
        SET agent_proposal_status = $2, agent_proposal_reject_reason = $3, agent_proposal_decided_at = now()
      WHERE p.agent_proposal_id = $1
      RETURNING p.*, p.agent_proposal_status AS stato`,
    [proposalId, decision, reason],
  );
  return proposta(r.rows[0] as Record<string, unknown>);
}
