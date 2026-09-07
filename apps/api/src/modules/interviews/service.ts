/**
 * apps/api/src/modules/interviews/service.ts
 * Autorizzazione di scope e regole di stato dei colloqui (#54 F3, quinta fetta).
 *
 * Modello SOLO-TENANT, come le quattro fette precedenti. E la stessa responsabilità propria
 * della quarta: un colloquio nomina una **candidatura**, che vive nel proprio tenant, e la
 * chiave esterna non impone che sia quello del colloquio. Senza il controllo qui sotto si
 * fisserebbe un colloquio di un'azienda su una selezione di un'altra — una riga valida per
 * PostgreSQL e sbagliata per il dominio (I5).
 */

import { pool } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";
import { isPlatform } from "../../lib/actor.js";

export type { ActorContext };
import { ConflictError, ForbiddenError, NotFoundError } from "../../errors/index.js";
import type {
  Interview,
  InterviewCreateBody,
  InterviewListQuery,
  InterviewUpdateBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

function tenantDiLavoro(actor: ActorContext, richiesto?: string): string {
  if (isPlatform(actor)) {
    const t = richiesto ?? actor.tenantId;
    if (!t) {
      throw new ForbiddenError(
        "PLATFORM_ADMIN deve indicare il tenant in cui fissare il colloquio",
        "PERMISSION_DENIED",
      );
    }
    return t;
  }
  if (richiesto && richiesto !== actor.tenantId) {
    throw new ForbiddenError("Non si fissa un colloquio in un altro tenant", "PERMISSION_DENIED");
  }
  if (!actor.tenantId) {
    throw new ForbiddenError("L'attore non appartiene a nessun tenant", "PERMISSION_DENIED");
  }
  return actor.tenantId;
}

/** Un colloquio di un altro tenant non si distingue da uno che non esiste: 404, non 403. */
function visibile(actor: ActorContext, i: Interview): boolean {
  return isPlatform(actor) || i.tenantId === actor.tenantId;
}

export const interviewsService = {
  async list(actor: ActorContext, query: InterviewListQuery) {
    const args = isPlatform(actor)
      ? { ...query }
      : { ...query, tenantId: actor.tenantId ?? undefined };
    return repo.listInterviews(pool, args);
  },

  async getById(actor: ActorContext, id: string): Promise<Interview> {
    const target = await repo.findInterviewById(pool, id);
    if (!target || !visibile(actor, target)) throw new NotFoundError("Interview");
    return target;
  },

  async create(actor: ActorContext, body: InterviewCreateBody): Promise<Interview> {
    const tenantId = tenantDiLavoro(actor, body.tenantId);

    const tCandidatura = await repo.applicationTenant(pool, body.applicationId);
    if (!tCandidatura) throw new NotFoundError("CandidateApplication");

    // ⭐ La candidatura dev'essere NELLO STESSO tenant. La chiave esterna guarda solo
    // l'esistenza, non l'appartenenza: senza questo controllo la riga passerebbe.
    if (tCandidatura !== tenantId) {
      throw new ForbiddenError(
        "Il colloquio e la candidatura devono appartenere allo stesso tenant",
        "PERMISSION_DENIED",
      );
    }

    return repo.insertInterview(pool, tenantId, body, actor.userId);
  },

  async update(
    actor: ActorContext,
    id: string,
    patch: InterviewUpdateBody,
  ): Promise<Interview> {
    const target = await repo.findInterviewById(pool, id);
    if (!target || !visibile(actor, target)) throw new NotFoundError("Interview");

    // Un colloquio SVOLTO deve dire quando. Il controllo sta qui e non nello schema, che
    // guarda il corpo e non sa se la data è già sulla riga: è la lezione della quarta
    // fetta, dove un `refine` nel posto sbagliato respingeva un caso legittimo (cambiare
    // solo lo stato quando il resto c'era già).
    const statoFinale = patch.status ?? target.status;
    const quando = patch.scheduledAt !== undefined ? patch.scheduledAt : target.scheduledAt;
    if (statoFinale === "COMPLETED" && !quando) {
      throw new ConflictError(
        "Un colloquio svolto deve avere la data in cui si e' svolto",
        "INTERVIEW_COMPLETED_WITHOUT_DATE",
      );
    }

    const aggiornato = await repo.updateInterviewPartial(pool, id, patch, actor.userId);
    if (!aggiornato) throw new NotFoundError("Interview");
    return aggiornato;
  },
};
