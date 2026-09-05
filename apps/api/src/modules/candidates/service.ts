/**
 * apps/api/src/modules/candidates/service.ts
 * Autorizzazione di scope e regole di stato per i candidati (#54 F3, terza fetta).
 *
 * Modello SOLO-TENANT, come le altre due fette. Ma qui c'e' una responsabilita' in piu':
 * questi sono **dati personali di persone che non hanno un account**, e nessun altro
 * presidio del sistema li copre — il registro GDPR guarda le FK verso `sys_users`, e
 * `sys_candidates` non ne ha una per la persona di cui parla.
 *
 * Percio' il service anticipa i tre CHECK del database invece di lasciarli salire come 500:
 * un vincolo violato deve tornare come un 409 leggibile, o chi usa l'API non sa cosa ha
 * sbagliato e la regola resta invisibile.
 */

import { pool } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";
import { isPlatform } from "../../lib/actor.js";

export type { ActorContext };
import { ConflictError, ForbiddenError, NotFoundError } from "../../errors/index.js";
import type {
  Candidate,
  CandidateCreateBody,
  CandidateListQuery,
  CandidateUpdateBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

function tenantDiLavoro(actor: ActorContext, richiesto?: string): string {
  if (isPlatform(actor)) {
    const t = richiesto ?? actor.tenantId;
    if (!t) {
      throw new ForbiddenError(
        "PLATFORM_ADMIN deve indicare il tenant in cui registrare il candidato",
        "PERMISSION_DENIED",
      );
    }
    return t;
  }
  if (richiesto && richiesto !== actor.tenantId) {
    throw new ForbiddenError(
      "Non si registra un candidato in un altro tenant",
      "PERMISSION_DENIED",
    );
  }
  if (!actor.tenantId) {
    throw new ForbiddenError("L'attore non appartiene a nessun tenant", "PERMISSION_DENIED");
  }
  return actor.tenantId;
}

/** Un candidato di un altro tenant non si distingue da uno che non esiste: 404, non 403. */
function visibile(actor: ActorContext, c: Candidate): boolean {
  return isPlatform(actor) || c.tenantId === actor.tenantId;
}

/** `retention_until >= consent_given_on`: non si conserva un dato da prima del permesso. */
function controllaConservazione(consenso: string | null, fino: string | null): void {
  if (consenso && fino && fino < consenso) {
    throw new ConflictError(
      "La conservazione non puo' finire prima del giorno in cui il consenso e' stato dato",
      "CANDIDATE_RETENTION_INVALID",
    );
  }
}

export const candidatesService = {
  async list(actor: ActorContext, query: CandidateListQuery) {
    const args = isPlatform(actor)
      ? { ...query }
      : { ...query, tenantId: actor.tenantId ?? undefined };
    return repo.listCandidates(pool, args);
  },

  async getById(actor: ActorContext, id: string): Promise<Candidate> {
    const target = await repo.findCandidateById(pool, id);
    if (!target || !visibile(actor, target)) throw new NotFoundError("Candidate");
    return target;
  },

  async create(actor: ActorContext, body: CandidateCreateBody): Promise<Candidate> {
    const tenantId = tenantDiLavoro(actor, body.tenantId);
    controllaConservazione(body.consentGivenOn ?? null, body.retentionUntil ?? null);

    const doppione = await repo.findCandidateByEmail(pool, tenantId, body.email);
    if (doppione) {
      throw new ConflictError(
        `Un candidato con l'indirizzo '${body.email}' esiste gia' in questo tenant`,
        "CANDIDATE_EMAIL_CONFLICT",
      );
    }
    return repo.insertCandidate(pool, tenantId, body, actor.userId);
  },

  async update(
    actor: ActorContext,
    id: string,
    patch: CandidateUpdateBody,
  ): Promise<Candidate> {
    const target = await repo.findCandidateById(pool, id);
    if (!target || !visibile(actor, target)) throw new NotFoundError("Candidate");

    controllaConservazione(
      patch.consentGivenOn !== undefined ? patch.consentGivenOn : target.consentGivenOn,
      patch.retentionUntil !== undefined ? patch.retentionUntil : target.retentionUntil,
    );

    // `HIRED` PRETENDE l'utente nato dall'assunzione: lo impone un CHECK, e senza questo
    // controllo l'API risponderebbe 500 con dentro un messaggio di PostgreSQL.
    const statoFinale = patch.status ?? target.status;
    const assunto = patch.hiredUserId !== undefined ? patch.hiredUserId : target.hiredUserId;
    if (statoFinale === "HIRED") {
      if (!assunto) {
        throw new ConflictError(
          "Un candidato assunto deve indicare l'utente nato dall'assunzione (hiredUserId)",
          "CANDIDATE_HIRED_WITHOUT_USER",
        );
      }
      // E quell'utente dev'essere dello STESSO tenant: la colonna non ha un vincolo che
      // lo imponga, quindi senza questo controllo si potrebbe assumere una persona
      // dichiarando un utente di un'altra azienda.
      if (!(await repo.userBelongsToTenant(pool, assunto, target.tenantId))) {
        throw new NotFoundError("User");
      }
    }

    const aggiornato = await repo.updateCandidatePartial(pool, id, patch, actor.userId);
    if (!aggiornato) throw new NotFoundError("Candidate");
    return aggiornato;
  },
};
