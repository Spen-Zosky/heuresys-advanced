/**
 * apps/api/src/modules/agent-conversations/service.ts — ADR-0056 D4, piano T6a.
 *
 * DI CHI È UNA CONVERSAZIONE. Della persona che l'ha aperta, nel suo tenant. Il proprietario si
 * prende sempre dall'attore della richiesta (`userId`, `tenantId`), mai dal corpo: la persona con i
 * suoi cookie e l'assistente con il gettone d'agente emesso per lei sono lo stesso proprietario.
 * Nessun ruolo, nemmeno un mandato HR, vede la conversazione di un'altra persona: per chi non la
 * possiede non esiste (404), com'è chiesto da ADR-0056 §4.
 *
 * CHI DECIDE UNA PROPOSTA. Solo la persona. Un gettone d'agente che prova a decidere riceve
 * AGENT_CANNOT_DECIDE: l'assistente non approva le proprie proposte. Scartare chiede un motivo.
 */
import { pool, withTransaction } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableEntityError,
} from "../../errors/index.js";
import {
  AGENT_CONVERSATION_ERRORS as E,
  type AgentActivity,
  type AgentActivityEventsResponse,
  type AgentConversation,
  type AgentConversationSummary,
  type AgentProposal,
  type AppendAgentActivityEventsBody,
  type CreateAgentActivityBody,
  type CreateAgentConversationBody,
  type CreateAgentProposalBody,
  type DecideAgentProposalBody,
  type UpdateAgentActivityBody,
  type UpdateAgentConversationBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

const APERTA: ReadonlySet<AgentActivity["status"]> = new Set(["IN_CORSO", "IN_ATTESA"]);

function proprietario(actor: ActorContext): repo.Proprietario {
  if (!actor.tenantId) {
    throw new ForbiddenError("A conversation belongs to a person in a tenant", E.NO_TENANT);
  }
  return { userId: actor.userId, tenantId: actor.tenantId };
}

/** Traduce un rifiuto del database (CHECK della 000483) in un errore del contratto. */
function dalDatabase(e: unknown): never {
  const code = (e as { code?: string } | null)?.code;
  const msg = (e as { message?: string } | null)?.message ?? "rejected by the database";
  if (code === "23514" || code === "22P02") throw new UnprocessableEntityError(null, msg, E.RULE);
  if (code === "23505") throw new ConflictError("The row already exists", E.RULE);
  throw e;
}

async function conversazione(chi: repo.Proprietario, id: string): Promise<AgentConversation> {
  const c = await repo.get(pool, chi, id);
  if (!c) throw new NotFoundError("Agent conversation");
  return c;
}

export const agentConversationsService = {
  async list(actor: ActorContext): Promise<AgentConversationSummary[]> {
    return repo.list(pool, proprietario(actor));
  },

  async create(actor: ActorContext, body: CreateAgentConversationBody): Promise<AgentConversation> {
    const chi = proprietario(actor);
    let id: string;
    try {
      id = await repo.create(pool, chi, body.agentCode, body.title);
    } catch (e) {
      dalDatabase(e);
    }
    return conversazione(chi, id);
  },

  async get(actor: ActorContext, id: string): Promise<AgentConversation> {
    return conversazione(proprietario(actor), id);
  },

  async update(actor: ActorContext, id: string, body: UpdateAgentConversationBody): Promise<AgentConversation> {
    const chi = proprietario(actor);
    let trovata: boolean;
    try {
      trovata = await repo.update(pool, chi, id, body.sdkSessionRef, body.personsSeen);
    } catch (e) {
      dalDatabase(e);
    }
    if (!trovata) throw new NotFoundError("Agent conversation");
    return conversazione(chi, id);
  },

  async createActivity(actor: ActorContext, conversationId: string, body: CreateAgentActivityBody): Promise<AgentActivity> {
    const chi = proprietario(actor);
    let id: string | undefined;
    try {
      id = await repo.createActivity(pool, chi, conversationId, body.prompt);
    } catch (e) {
      dalDatabase(e);
    }
    if (!id) throw new NotFoundError("Agent conversation");
    const a = await repo.getActivity(pool, chi, id);
    return a as AgentActivity;
  },

  /** Cambia lo stato di un'attività aperta; una chiusa (o letta come interrotta) non cambia più. */
  async updateActivity(actor: ActorContext, activityId: string, body: UpdateAgentActivityBody): Promise<AgentActivity> {
    const chi = proprietario(actor);
    return withTransaction(async (db) => {
      const a = await repo.getActivity(db, chi, activityId, true);
      if (!a) throw new NotFoundError("Agent activity");
      if (!APERTA.has(a.status)) throw new ConflictError("The activity is closed", E.ACTIVITY_CLOSED);
      try {
        await repo.updateActivity(db, activityId, body);
      } catch (e) {
        dalDatabase(e);
      }
      return (await repo.getActivity(db, chi, activityId)) as AgentActivity;
    });
  },

  async appendEvents(actor: ActorContext, activityId: string, body: AppendAgentActivityEventsBody): Promise<{ lastSeq: number }> {
    const chi = proprietario(actor);
    return withTransaction(async (db) => {
      const a = await repo.getActivity(db, chi, activityId, true);
      if (!a) throw new NotFoundError("Agent activity");
      if (!APERTA.has(a.status)) throw new ConflictError("The activity is closed", E.ACTIVITY_CLOSED);
      try {
        return { lastSeq: await repo.appendEvents(db, activityId, body.events) };
      } catch (e) {
        dalDatabase(e);
      }
    });
  },

  async events(actor: ActorContext, activityId: string, after: number): Promise<AgentActivityEventsResponse> {
    const chi = proprietario(actor);
    const activity = await repo.getActivity(pool, chi, activityId);
    if (!activity) throw new NotFoundError("Agent activity");
    const [events, proposals] = await Promise.all([
      repo.listEvents(pool, activityId, after),
      repo.listProposals(pool, activityId),
    ]);
    return { activity, events, proposals };
  },

  async createProposal(actor: ActorContext, activityId: string, body: CreateAgentProposalBody): Promise<AgentProposal> {
    const chi = proprietario(actor);
    return withTransaction(async (db) => {
      const a = await repo.getActivity(db, chi, activityId, true);
      if (!a) throw new NotFoundError("Agent activity");
      if (!APERTA.has(a.status)) throw new ConflictError("The activity is closed", E.ACTIVITY_CLOSED);
      try {
        await repo.createProposal(db, activityId, body);
      } catch (e) {
        dalDatabase(e);
      }
      const p = (await repo.listProposals(db, activityId)).find((x) => x.id === body.proposalId);
      return p as AgentProposal;
    });
  },

  async decide(actor: ActorContext, proposalId: string, body: DecideAgentProposalBody): Promise<AgentProposal> {
    if (actor.agente) {
      throw new ForbiddenError("An agent token cannot decide the agent's proposals", E.AGENT_CANNOT_DECIDE);
    }
    const reason = body.reason?.trim() || null;
    if (body.decision === "SCARTATA" && !reason) {
      throw new UnprocessableEntityError(null, "Rejecting a proposal needs a reason", E.REJECT_REASON_REQUIRED);
    }
    const chi = proprietario(actor);
    return withTransaction(async (db) => {
      const p = await repo.getProposalForUpdate(db, chi, proposalId);
      if (!p) throw new NotFoundError("Agent proposal");
      if (p.status === "SCADUTA") throw new ConflictError("The proposal has expired", E.PROPOSAL_EXPIRED);
      if (p.status !== "IN_ATTESA") throw new ConflictError("The proposal is already decided", E.PROPOSAL_NOT_PENDING);
      return repo.decideProposal(db, proposalId, body.decision, body.decision === "SCARTATA" ? reason : null);
    });
  },
};
