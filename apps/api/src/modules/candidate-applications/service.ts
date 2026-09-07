/**
 * apps/api/src/modules/candidate-applications/service.ts
 * Autorizzazione di scope e regole di stato delle candidature (#54 F3, quarta fetta).
 *
 * Modello SOLO-TENANT, come le tre fette precedenti. Ma questa è la **cerniera** del ciclo,
 * e da lì viene la sua responsabilità propria: una candidatura nomina DUE oggetti che
 * vivono ciascuno nel proprio tenant, e nessun vincolo del database impone che siano lo
 * stesso. Senza il controllo qui sotto si potrebbe candidare una persona di un'azienda a un
 * annuncio di un'altra — e sarebbe una falla di isolamento (I5) aperta da un dato coerente
 * per il database e incoerente per il dominio.
 *
 * Come nelle altre fette, il service anticipa i CHECK del database invece di lasciarli
 * salire come 500: un vincolo violato deve tornare come un 409 leggibile, o chi usa l'API
 * non sa cosa ha sbagliato e la regola resta invisibile.
 */

import { pool } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";
import { isPlatform } from "../../lib/actor.js";

export type { ActorContext };
import { ConflictError, ForbiddenError, NotFoundError } from "../../errors/index.js";
import type {
  CandidateApplication,
  CandidateApplicationCreateBody,
  CandidateApplicationListQuery,
  CandidateApplicationUpdateBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

function tenantDiLavoro(actor: ActorContext, richiesto?: string): string {
  if (isPlatform(actor)) {
    const t = richiesto ?? actor.tenantId;
    if (!t) {
      throw new ForbiddenError(
        "PLATFORM_ADMIN deve indicare il tenant in cui registrare la candidatura",
        "PERMISSION_DENIED",
      );
    }
    return t;
  }
  if (richiesto && richiesto !== actor.tenantId) {
    throw new ForbiddenError(
      "Non si registra una candidatura in un altro tenant",
      "PERMISSION_DENIED",
    );
  }
  if (!actor.tenantId) {
    throw new ForbiddenError("L'attore non appartiene a nessun tenant", "PERMISSION_DENIED");
  }
  return actor.tenantId;
}

/** Una candidatura di un altro tenant non si distingue da una che non esiste: 404, non 403. */
function visibile(actor: ActorContext, a: CandidateApplication): boolean {
  return isPlatform(actor) || a.tenantId === actor.tenantId;
}

/** `closed_on >= applied_on`: una candidatura non si chiude prima di essere arrivata. */
function controllaChiusura(arrivo: string, chiusura: string | null): void {
  if (chiusura && chiusura < arrivo) {
    throw new ConflictError(
      "Una candidatura non puo' chiudersi prima del giorno in cui e' arrivata",
      "APPLICATION_CLOSED_BEFORE_APPLIED",
    );
  }
}

export const candidateApplicationsService = {
  async list(actor: ActorContext, query: CandidateApplicationListQuery) {
    const args = isPlatform(actor)
      ? { ...query }
      : { ...query, tenantId: actor.tenantId ?? undefined };
    return repo.listApplications(pool, args);
  },

  async getById(actor: ActorContext, id: string): Promise<CandidateApplication> {
    const target = await repo.findApplicationById(pool, id);
    if (!target || !visibile(actor, target)) throw new NotFoundError("CandidateApplication");
    return target;
  },

  async create(
    actor: ActorContext,
    body: CandidateApplicationCreateBody,
  ): Promise<CandidateApplication> {
    const tenantId = tenantDiLavoro(actor, body.tenantId);

    // I due capi devono esistere: una FK li rifiuterebbe comunque, ma con un 500 che non
    // dice QUALE dei due manca.
    const tCandidato = await repo.candidateTenant(pool, body.candidateId);
    if (!tCandidato) throw new NotFoundError("Candidate");
    const tAnnuncio = await repo.postingTenant(pool, body.postingId);
    if (!tAnnuncio) throw new NotFoundError("JobPosting");

    // ⭐ E devono stare NELLO STESSO tenant di lavoro. Nessun vincolo del database lo
    // impone: le due FK guardano ciascuna la propria tabella e non si parlano. Senza
    // questo controllo si candiderebbe la persona di un'azienda all'annuncio di un'altra,
    // e la riga risultante sarebbe perfettamente valida per PostgreSQL.
    if (tCandidato !== tenantId || tAnnuncio !== tenantId) {
      throw new ForbiddenError(
        "Candidato e annuncio devono appartenere allo stesso tenant della candidatura",
        "PERMISSION_DENIED",
      );
    }

    const doppione = await repo.findApplicationByPair(pool, body.candidateId, body.postingId);
    if (doppione) {
      throw new ConflictError(
        "Questa persona si e' gia' candidata a questo annuncio",
        "APPLICATION_DUPLICATE",
      );
    }

    return repo.insertApplication(pool, tenantId, body, actor.userId);
  },

  async update(
    actor: ActorContext,
    id: string,
    patch: CandidateApplicationUpdateBody,
  ): Promise<CandidateApplication> {
    const target = await repo.findApplicationById(pool, id);
    if (!target || !visibile(actor, target)) throw new NotFoundError("CandidateApplication");

    controllaChiusura(
      target.appliedOn,
      patch.closedOn !== undefined ? patch.closedOn : target.closedOn,
    );

    // Il rifiuto PRETENDE il suo motivo: lo impone un CHECK. Lo schema lo respinge già
    // quando `stage` e `rejectReason` arrivano insieme, ma non può vedere il caso in cui
    // la fase diventa `REJECTED` mentre il motivo era già assente sulla riga — quello si
    // vede solo qui, dove lo stato di arrivo si conosce.
    const faseFinale = patch.stage ?? target.stage;
    const motivo = patch.rejectReason !== undefined ? patch.rejectReason : target.rejectReason;
    if (faseFinale === "REJECTED" && !(motivo ?? "").trim()) {
      throw new ConflictError(
        "Una candidatura rifiutata deve indicare il motivo del rifiuto",
        "APPLICATION_REJECTED_WITHOUT_REASON",
      );
    }

    const aggiornata = await repo.updateApplicationPartial(pool, id, patch, actor.userId);
    if (!aggiornata) throw new NotFoundError("CandidateApplication");
    return aggiornata;
  },
};
