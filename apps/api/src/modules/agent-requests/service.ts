/**
 * apps/api/src/modules/agent-requests/service.ts — tappa T2, migrazione 000499.
 *
 * IL CANCELLO. Una richiesta dell'agente nasce solo con una previsione di spesa positiva dentro un
 * tetto positivo, e il tetto dentro il massimo del servizio (`AGENT_REQUEST_MAX_CAP_USD`, con
 * l'ambiente che può solo abbassarlo). Poi aspetta: la decide chi ha `agent_request:decide`, mai un
 * gettone d'agente (l'agente non approva le proprie richieste), e rifiutare chiede un motivo.
 *
 * CHI VEDE COSA. Ogni persona vede le proprie richieste; la coda di tutti i tenant e il registro
 * di costo e durata li vede solo chi ha `agent_request:read:all`.
 */
import { pool } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";
import { userHasPermission } from "../../middleware/rbac.js";
import { ConflictError, ForbiddenError, NotFoundError, UnprocessableEntityError } from "../../errors/index.js";
import {
  AGENT_REQUEST_ERRORS as E,
  AGENT_REQUEST_MAX_CAP_USD,
  type AgentCall,
  type AgentCallListResponse,
  type AgentRequest,
  type AgentRequestListQuery,
  type AgentRequestListResponse,
  type CreateAgentCallBody,
  type CreateAgentRequestBody,
  type DecideAgentRequestBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

/** Il massimo del servizio: la costante, abbassata (mai alzata) dall'ambiente. */
export function maxCapUsd(): number {
  const dallAmbiente = Number(process.env.AGENT_REQUEST_MAX_CAP_USD);
  return Number.isFinite(dallAmbiente) && dallAmbiente > 0
    ? Math.min(dallAmbiente, AGENT_REQUEST_MAX_CAP_USD)
    : AGENT_REQUEST_MAX_CAP_USD;
}

function chi(actor: ActorContext): { userId: string; tenantId: string } {
  if (!actor.tenantId) throw new ForbiddenError("A request belongs to a person in a tenant", E.NO_TENANT);
  return { userId: actor.userId, tenantId: actor.tenantId };
}

const vedeTutto = (actor: ActorContext): boolean => userHasPermission(actor, "agent_request:read:all");

export const agentRequestsService = {
  async create(actor: ActorContext, body: CreateAgentRequestBody): Promise<AgentRequest> {
    const proprietario = chi(actor);
    const max = maxCapUsd();
    if (body.capUsd > max) {
      throw new UnprocessableEntityError(null, `The cap cannot exceed ${max} USD`, E.CAP_OVER_MAX);
    }
    if (body.estimateUsd > body.capUsd) {
      throw new UnprocessableEntityError(null, "The estimate exceeds the cap: the request is not created", E.ESTIMATE_OVER_CAP);
    }
    const id = await repo.createRequest(pool, proprietario, body);
    const r = await repo.getRequest(pool, id);
    if (!r) throw new NotFoundError("Agent request");
    return r;
  },

  async list(actor: ActorContext, q: AgentRequestListQuery): Promise<AgentRequestListResponse> {
    const tutte = q.scope === "all";
    if (tutte && !vedeTutto(actor)) {
      throw new ForbiddenError("Reading every tenant's requests needs agent_request:read:all");
    }
    const items = await repo.listRequests(pool, {
      userId: actor.userId, tenantId: actor.tenantId, tutte,
      ...(q.status ? { status: q.status } : {}),
    });
    return { items, maxCapUsd: maxCapUsd() };
  },

  async decide(actor: ActorContext, id: string, body: DecideAgentRequestBody): Promise<AgentRequest> {
    if (actor.agente) {
      throw new ForbiddenError("An agent token cannot decide the agent's requests", E.AGENT_CANNOT_DECIDE);
    }
    const r = await repo.getRequest(pool, id);
    if (!r) throw new NotFoundError("Agent request");
    const accepted = body.decision === "ACCETTA";
    const reason = body.decision === "RIFIUTA" ? body.reason : null;
    if (!(await repo.decideRequest(pool, id, { by: actor.userId, accepted, reason }))) {
      throw new ConflictError("The request has already been decided", E.NOT_PENDING);
    }
    const dopo = await repo.getRequest(pool, id);
    if (!dopo) throw new NotFoundError("Agent request");
    return dopo;
  },

  async recordCall(actor: ActorContext, body: CreateAgentCallBody): Promise<AgentCall> {
    const proprietario = chi(actor);
    if (body.requestId && !(await repo.requestInTenant(pool, body.requestId, proprietario.tenantId))) {
      throw new NotFoundError("Agent request");
    }
    return repo.createCall(pool, proprietario, body);
  },

  async listCalls(limit: number): Promise<AgentCallListResponse> {
    const items = await repo.listCalls(pool, limit);
    return {
      items,
      totals: {
        calls: items.length,
        costUsd: Math.round(items.reduce((s, c) => s + c.costUsd, 0) * 10000) / 10000,
        durationMs: items.reduce((s, c) => s + c.durationMs, 0),
      },
    };
  },
};
