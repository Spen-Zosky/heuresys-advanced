/**
 * apps/api/src/modules/job-offers/service.ts
 * Autorizzazione di scope, mascheramento e ciclo di vita dell'offerta (#54 F3, settima fetta).
 *
 * ⭐ QUI SI SCIOGLIE LA DOMANDA CHE LA MIGRAZIONE `000364` AVEVA LASCIATO APERTA.
 * Il commento di quella tabella diceva: *«la retribuzione qui è COMPENSATION per natura, ma
 * il soggetto è un candidato esterno e non un dipendente: le regole di mascheramento di
 * ADR-0036 vanno decise su questa superficie in F3, non ereditate»*. Decise, e questa è la
 * decisione con la sua ragione.
 *
 * **La retribuzione di un'offerta si maschera come quella di un dipendente.** Non per
 * analogia — l'analogia è proprio ciò che la migrazione vietava — ma perché la ragione del
 * mascheramento di ADR-0032 **si applica identica**: `PLATFORM_ADMIN` è un mandato
 * *tecnico*, non HR, e chi diagnostica un sistema non ha ragione di conoscere le proposte
 * economiche fatte alle persone. Che la persona sia dentro o fuori l'organizzazione cambia
 * il soggetto, non il mandato di chi guarda.
 *
 * Due conseguenze che vale la pena non ri-dedurre:
 *   · la riga resta INTERA — stato, date, tipo di contratto, candidatura. Sparisce il solo
 *     importo, e sparisce **dichiarandosi** in `masked`: è la quarta modalità di ADR-0036,
 *     e il meccanismo è quello di `lib/scope/mask.ts`, riusato e non riscritto;
 *   · `subjectUserId` è **null**, perché un candidato non è un utente. Questo spegne da sé
 *     l'eccezione I17 (il pavimento self-scope), che non ha senso qui: nessuno può essere il
 *     soggetto di una candidatura esterna, quindi nessuno se la sblocca da solo.
 */

import { pool } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";
import { isPlatform } from "../../lib/actor.js";

export type { ActorContext };
import { ConflictError, ForbiddenError, NotFoundError } from "../../errors/index.js";
import { masksUnderPlatformMandate, maskFields, type Masked } from "../../lib/scope/mask.js";
import type {
  JobOffer,
  JobOfferCreateBody,
  JobOfferListQuery,
  JobOfferUpdateBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

/** Gli stati che dichiarano una risposta del candidato: pretendono un'offerta spedita. */
const RISPOSTE = new Set(["ACCEPTED", "DECLINED"]);

/** Gli stati da cui non si torna indietro: la storia dell'offerta è finita lì. */
const TERMINALI = new Set(["ACCEPTED", "DECLINED", "EXPIRED", "WITHDRAWN"]);

function tenantDiLavoro(actor: ActorContext, richiesto?: string): string {
  if (isPlatform(actor)) {
    const t = richiesto ?? actor.tenantId;
    if (!t) {
      throw new ForbiddenError(
        "PLATFORM_ADMIN deve indicare il tenant in cui preparare l'offerta",
        "PERMISSION_DENIED",
      );
    }
    return t;
  }
  if (richiesto && richiesto !== actor.tenantId) {
    throw new ForbiddenError("Non si prepara un'offerta in un altro tenant", "PERMISSION_DENIED");
  }
  if (!actor.tenantId) {
    throw new ForbiddenError("L'attore non appartiene a nessun tenant", "PERMISSION_DENIED");
  }
  return actor.tenantId;
}

/** Un'offerta di un altro tenant non si distingue da una che non esiste: 404, non 403. */
function visibile(actor: ActorContext, o: JobOffer): boolean {
  return isPlatform(actor) || o.tenantId === actor.tenantId;
}

/**
 * L'importo se ne va, tutto il resto resta. `null` come soggetto: il candidato non è un
 * utente, quindi non esiste un «sé stesso» che possa sbloccarlo (I17 non si applica).
 */
function mascheraSeServe(actor: ActorContext, o: JobOffer): Masked<JobOffer> {
  if (!masksUnderPlatformMandate(actor, "COMPENSATION", null)) return o;
  return maskFields(o, ["grossAnnualSalary"]);
}

export const jobOffersService = {
  async list(
    actor: ActorContext,
    query: JobOfferListQuery,
  ): Promise<{ items: Masked<JobOffer>[]; total: number }> {
    const args = isPlatform(actor)
      ? { ...query }
      : { ...query, tenantId: actor.tenantId ?? undefined };
    const { items, total } = await repo.listOffers(pool, args);
    return { items: items.map((o) => mascheraSeServe(actor, o)), total };
  },

  async getById(actor: ActorContext, id: string): Promise<Masked<JobOffer>> {
    const target = await repo.findOfferById(pool, id);
    if (!target || !visibile(actor, target)) throw new NotFoundError("JobOffer");
    return mascheraSeServe(actor, target);
  },

  async create(actor: ActorContext, body: JobOfferCreateBody): Promise<Masked<JobOffer>> {
    const tenantId = tenantDiLavoro(actor, body.tenantId);

    const tCandidatura = await repo.applicationTenant(pool, body.applicationId);
    if (!tCandidatura) throw new NotFoundError("CandidateApplication");

    // ⭐ La candidatura dev'essere NELLO STESSO tenant. La chiave esterna guarda solo
    // l'esistenza, non l'appartenenza: senza questo controllo la riga passerebbe.
    if (tCandidatura !== tenantId) {
      throw new ForbiddenError(
        "L'offerta e la candidatura devono appartenere allo stesso tenant",
        "PERMISSION_DENIED",
      );
    }

    // ⭐ Una candidatura ha UNA offerta viva per volta. Nessun vincolo del database lo dice
    // — e non potrebbe, perché «viva» dipende dallo stato — ma due proposte economiche
    // aperte contemporaneamente alla stessa persona per lo stesso posto non sono un dato:
    // sono due promesse in conflitto, e la seconda non dice quale delle due vale.
    if ((await repo.offerteVive(pool, body.applicationId)) > 0) {
      throw new ConflictError(
        "Questa candidatura ha gia' un'offerta aperta: si ritira o si chiude quella prima",
        "OFFER_ALREADY_OPEN",
      );
    }

    const creato = await repo.insertOffer(pool, tenantId, body, actor.userId);
    return mascheraSeServe(actor, creato);
  },

  async update(
    actor: ActorContext,
    id: string,
    patch: JobOfferUpdateBody,
  ): Promise<Masked<JobOffer>> {
    const target = await repo.findOfferById(pool, id);
    if (!target || !visibile(actor, target)) throw new NotFoundError("JobOffer");

    const statoFinale = patch.status ?? target.status;

    // Da uno stato terminale non si riparte. Un'offerta rifiutata che torna «spedita»
    // riscriverebbe una storia che è già accaduta, e il database — che guarda una riga per
    // volta e non la sua storia — non se ne accorgerebbe.
    if (TERMINALI.has(target.status) && patch.status !== undefined && patch.status !== target.status) {
      throw new ConflictError(
        `Un'offerta ${target.status} e' chiusa: non torna a ${patch.status}`,
        "OFFER_ALREADY_CLOSED",
      );
    }

    // Una risposta pretende che l'offerta sia stata MANDATA. Il `flow_check` del database
    // lo impone già, ma risponderebbe con una violazione grezza: qui diventa un 409 che
    // dice cosa manca. E il controllo sta nel service perché lo schema guarda il corpo e
    // non sa se `sentOn` è già sulla riga — è la lezione della quarta fetta.
    const spedita = patch.sentOn !== undefined ? patch.sentOn : target.sentOn;
    if (RISPOSTE.has(statoFinale) && !spedita && patch.status !== undefined) {
      throw new ConflictError(
        "Un'offerta mai spedita non puo' essere accettata ne' rifiutata",
        "OFFER_NOT_SENT",
      );
    }

    // Le date le mette il DATABASE quando lo stato le implica e il chiamante non le ha
    // dichiarate: passare a `SENT` è spedirla oggi, rispondere è rispondere oggi.
    const date: { sentOn?: "oggi"; respondedOn?: "oggi" } = {};
    if (patch.status === "SENT" && !target.sentOn) date.sentOn = "oggi";
    if (patch.status !== undefined && RISPOSTE.has(patch.status) && !target.respondedOn) {
      date.respondedOn = "oggi";
    }

    const aggiornato = await repo.updateOfferPartial(pool, id, patch, date, actor.userId);
    if (!aggiornato) throw new NotFoundError("JobOffer");
    return mascheraSeServe(actor, aggiornato);
  },
};
