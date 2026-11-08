/**
 * apps/api/src/modules/agent-capabilities/service.ts — ADR-0053 A1/A3/D4, ADR-0056 D2, piano T3c.
 *
 * CHI DECIDE COSA.
 *   · Il catalogo (creare, dichiarare le operazioni, pubblicare, ritirare) è della piattaforma:
 *     permesso `agent_capability:manage`.
 *   · Il modo di una capacità per un tenant (permesso `agent_capability:activate`) lo decide il
 *     Direttore HR di quel tenant, sempre e solo per il tenant della sua sessione (I5).
 *   · La piattaforma può solo riportare una capacità a `CONFERMA`, per qualunque tenant: è
 *     l'interruttore di ADR-0053 D4. Non libera mai: liberare è una scelta del cliente.
 *   · Un agente non decide niente qui: un gettone d'agente è rifiutato su ogni scrittura, anche
 *     se la persona che l'ha emesso avrebbe il permesso (ADR-0053: l'agente non si promuove da sé).
 *
 * `LIBERA` OGGI È RIFIUTATA. ADR-0053 D2 chiede tre condizioni previe: l'informativa, il ritorno
 * provato e il registro «per conto di» (passo A2). Le prime due le controlla il database; il
 * registro nasce con la voce T5 del piano, e finché non c'è nessuna capacità si libera.
 */
import { pool, withTransaction } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";
import { haMandatoPiattaforma } from "../../lib/scope/mandati.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableEntityError,
} from "../../errors/index.js";
import {
  AGENT_CAPABILITY_ERRORS as E,
  type AddAgentCapabilityOperationBody,
  type AgentCapability,
  type CreateAgentCapabilityBody,
  type DecideAgentCapabilityModeBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

/**
 * Vero quando esiste il registro «per conto di» (ADR-0053 A2). Acceso con la voce T5: la migrazione
 * 000482 dà al diario del cancello capacità, versione, esito autonomo e «per conto di», e il cancello
 * (`apps/agent-gateway/src/write-gate.ts`) non esegue da solo una scrittura che non sa attribuire.
 * Le altre due condizioni di D2 (informativa e ritorno provato) le pretende il database (000480).
 */
export const REGISTRO_PER_CONTO_DI = true;

function nessunAgente(actor: ActorContext): void {
  if (actor.agente) {
    throw new ForbiddenError("An agent token cannot change the agent capability register", E.AGENT_CANNOT_DECIDE);
  }
}

/** Traduce un rifiuto del database (trigger e CHECK della 000480) in un errore del contratto. */
function dalDatabase(e: unknown): never {
  const code = (e as { code?: string } | null)?.code;
  const msg = (e as { message?: string } | null)?.message ?? "rejected by the register";
  if (code === "23505") throw new ConflictError("The capability or the operation already exists", E.CAPABILITY_DUPLICATE);
  if (code === "23514" || code === "42501") throw new UnprocessableEntityError(null, msg, E.CAPABILITY_RULE);
  throw e;
}

async function una(id: string, tenantId: string | null): Promise<AgentCapability> {
  const [c] = await repo.list(pool, tenantId, id);
  if (!c) throw new NotFoundError("Agent capability");
  return c;
}

export const agentCapabilitiesService = {
  async list(actor: ActorContext): Promise<AgentCapability[]> {
    return repo.list(pool, actor.tenantId ?? null);
  },

  async get(actor: ActorContext, id: string): Promise<AgentCapability> {
    return una(id, actor.tenantId ?? null);
  },

  async create(actor: ActorContext, body: CreateAgentCapabilityBody): Promise<AgentCapability> {
    nessunAgente(actor);
    let id: string;
    try {
      id = await repo.create(pool, body, actor.userId);
    } catch (e) {
      dalDatabase(e);
    }
    return una(id, actor.tenantId ?? null);
  },

  async addOperation(actor: ActorContext, id: string, body: AddAgentCapabilityOperationBody): Promise<AgentCapability> {
    nessunAgente(actor);
    if (!(await repo.statusOf(pool, id))) throw new NotFoundError("Agent capability");
    try {
      await repo.addOperation(pool, id, body);
    } catch (e) {
      dalDatabase(e);
    }
    return una(id, actor.tenantId ?? null);
  },

  async setStatus(actor: ActorContext, id: string, status: "PUBBLICATA" | "RITIRATA"): Promise<AgentCapability> {
    nessunAgente(actor);
    const ora = await repo.statusOf(pool, id);
    if (!ora) throw new NotFoundError("Agent capability");
    if (status === "PUBBLICATA" && (await una(id, null)).operations.length === 0) {
      throw new UnprocessableEntityError(null, "A capability without operations has nothing to publish", E.CAPABILITY_RULE);
    }
    let n = 0;
    try {
      n = await repo.setStatus(pool, id, status);
    } catch (e) {
      dalDatabase(e);
    }
    if (n === 0) throw new ConflictError(`The capability is ${ora}, it cannot become ${status}`, E.CAPABILITY_RULE);
    return una(id, actor.tenantId ?? null);
  },

  async decide(actor: ActorContext, id: string, body: DecideAgentCapabilityModeBody): Promise<AgentCapability> {
    nessunAgente(actor);
    const piattaforma = haMandatoPiattaforma(actor);

    // Per quale tenant. Il Direttore decide per il tenant della sua sessione e non ne nomina altri;
    // la piattaforma nomina il tenant, e può solo spegnere.
    let tenantId: string;
    if (piattaforma) {
      if (body.mode !== "CONFERMA") {
        throw new ForbiddenError("The platform can only bring a capability back to CONFERMA", E.PLATFORM_ONLY_CONFERMA);
      }
      tenantId = body.tenantId ?? actor.tenantId ?? "";
      if (!tenantId || !(await repo.tenantExists(pool, tenantId))) throw new NotFoundError("Tenant");
    } else {
      if (!actor.tenantId) throw new ForbiddenError("Tenant context required", "PERMISSION_DENIED");
      if (body.tenantId && body.tenantId !== actor.tenantId) {
        throw new ForbiddenError("A tenant decides only for itself", "PERMISSION_DENIED");
      }
      tenantId = actor.tenantId;
    }

    if (body.mode === "LIBERA" && !REGISTRO_PER_CONTO_DI) {
      throw new ConflictError(
        "LIBERA needs the on-behalf register (ADR-0053 D2, step A2), which does not exist yet",
        E.ONBEHALF_REGISTER_MISSING,
      );
    }

    const stato = await repo.statusOf(pool, id);
    if (!stato) throw new NotFoundError("Agent capability");
    if (stato === "BOZZA") {
      throw new ConflictError("A capability in BOZZA has no mode to decide yet", E.CAPABILITY_NOT_PUBLISHED);
    }

    try {
      await withTransaction((c) =>
        repo.decide(c, {
          tenantId,
          capabilityId: id,
          mode: body.mode,
          reason: body.reason,
          decidedBy: actor.userId,
          noticeRef: body.noticeRef?.trim() || null,
          rollbackProofRef: body.rollbackProofRef?.trim() || null,
        }),
      { retries: 0 });
    } catch (e) {
      dalDatabase(e);
    }
    return una(id, tenantId);
  },
};
