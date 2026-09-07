/**
 * apps/api/src/modules/interview-feedback/service.ts
 * Autorizzazione di scope e regole di dominio delle valutazioni (#54 F3, sesta fetta).
 *
 * Modello SOLO-TENANT, come le cinque fette precedenti — ma qui le chiavi esterne da
 * presidiare sono **due**, non una:
 *   · il **colloquio**, che vive nel proprio tenant;
 *   · l'**intervistatore**, che è un utente e vive anche lui nel proprio.
 * Nessuna delle due FK impone l'appartenenza: per PostgreSQL «valutazione dell'azienda A su
 * un colloquio dell'azienda B, firmata da una persona dell'azienda C» è una riga
 * perfettamente valida. I due controlli qui sotto sono l'unico posto in cui quella riga
 * viene rifiutata (I5).
 */

import { pool } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";
import { isPlatform } from "../../lib/actor.js";

export type { ActorContext };
import { ConflictError, ForbiddenError, NotFoundError } from "../../errors/index.js";
import type {
  InterviewFeedback,
  InterviewFeedbackCreateBody,
  InterviewFeedbackListQuery,
  InterviewFeedbackUpdateBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

/** Un colloquio che non si è svolto non ha niente da valutare. */
const NON_SVOLTI = new Set(["CANCELLED", "NO_SHOW"]);

function tenantDiLavoro(actor: ActorContext, richiesto?: string): string {
  if (isPlatform(actor)) {
    const t = richiesto ?? actor.tenantId;
    if (!t) {
      throw new ForbiddenError(
        "PLATFORM_ADMIN deve indicare il tenant in cui registrare la valutazione",
        "PERMISSION_DENIED",
      );
    }
    return t;
  }
  if (richiesto && richiesto !== actor.tenantId) {
    throw new ForbiddenError(
      "Non si registra una valutazione in un altro tenant",
      "PERMISSION_DENIED",
    );
  }
  if (!actor.tenantId) {
    throw new ForbiddenError("L'attore non appartiene a nessun tenant", "PERMISSION_DENIED");
  }
  return actor.tenantId;
}

/** Una valutazione di un altro tenant non si distingue da una che non esiste: 404, non 403. */
function visibile(actor: ActorContext, f: InterviewFeedback): boolean {
  return isPlatform(actor) || f.tenantId === actor.tenantId;
}

export const interviewFeedbackService = {
  async list(actor: ActorContext, query: InterviewFeedbackListQuery) {
    const args = isPlatform(actor)
      ? { ...query }
      : { ...query, tenantId: actor.tenantId ?? undefined };
    return repo.listFeedback(pool, args);
  },

  async getById(actor: ActorContext, id: string): Promise<InterviewFeedback> {
    const target = await repo.findFeedbackById(pool, id);
    if (!target || !visibile(actor, target)) throw new NotFoundError("InterviewFeedback");
    return target;
  },

  async create(
    actor: ActorContext,
    body: InterviewFeedbackCreateBody,
  ): Promise<InterviewFeedback> {
    const tenantId = tenantDiLavoro(actor, body.tenantId);

    const colloquio = await repo.interviewInfo(pool, body.interviewId);
    if (!colloquio) throw new NotFoundError("Interview");

    // ⭐ Primo scavalco: il colloquio dev'essere di QUESTO tenant.
    if (colloquio.tenantId !== tenantId) {
      throw new ForbiddenError(
        "La valutazione e il colloquio devono appartenere allo stesso tenant",
        "PERMISSION_DENIED",
      );
    }

    // ⭐ Secondo scavalco, ed è quello che nessun'altra fetta ha: l'INTERVISTATORE.
    // `sys_users` è una tabella sola per tutte le aziende, quindi la FK accetterebbe
    // volentieri la firma di un dipendente di un'altra.
    const tIntervistatore = await repo.userTenant(pool, body.interviewerUserId);
    if (!tIntervistatore) throw new NotFoundError("User");
    if (tIntervistatore !== tenantId) {
      throw new ForbiddenError(
        "L'intervistatore dev'essere una persona dello stesso tenant del colloquio",
        "PERMISSION_DENIED",
      );
    }

    // Un colloquio annullato o disertato non si valuta: non c'è stato niente da valutare.
    // Il controllo sta qui e non nello schema, che guarda il corpo e non conosce lo stato
    // del colloquio — è la lezione della quarta fetta, dove un `refine` messo dove non
    // aveva i dati per giudicare produceva un rifiuto sbagliato.
    if (NON_SVOLTI.has(colloquio.status)) {
      throw new ConflictError(
        "Un colloquio annullato o disertato non ha nulla da valutare",
        "INTERVIEW_NOT_HELD",
      );
    }

    // Il database ha già il vincolo di unicità: qui si intercetta PRIMA, per rispondere 409
    // con un codice che dice cosa fare, invece del 500 di una violazione grezza.
    const gia = await repo.findFeedbackByPair(pool, body.interviewId, body.interviewerUserId);
    if (gia) {
      throw new ConflictError(
        "Quella persona ha gia' valutato questo colloquio: si corregge con PATCH",
        "FEEDBACK_ALREADY_GIVEN",
      );
    }

    return repo.insertFeedback(pool, tenantId, body, actor.userId);
  },

  async update(
    actor: ActorContext,
    id: string,
    patch: InterviewFeedbackUpdateBody,
  ): Promise<InterviewFeedback> {
    const target = await repo.findFeedbackById(pool, id);
    if (!target || !visibile(actor, target)) throw new NotFoundError("InterviewFeedback");

    const aggiornato = await repo.updateFeedbackPartial(pool, id, patch, actor.userId);
    if (!aggiornato) throw new NotFoundError("InterviewFeedback");
    return aggiornato;
  },
};
