/**
 * apps/api/src/modules/job-postings/service.ts
 * Autorizzazione di scope per gli annunci (#54 F3, seconda fetta).
 *
 * Stesso modello della richiesta — SOLO-TENANT, `PLATFORM_ADMIN` cross-tenant — con una
 * differenza che conta: **il tenant non si passa, si eredita dalla richiesta**. E' l'unica
 * fonte possibile, e riceverlo da fuori aprirebbe la strada a un annuncio in un tenant con
 * la sua richiesta in un altro: una riga che il database accetta e che non significa niente.
 *
 * Riusa i permessi `job-requisition:read` / `:manage` (mig 000374) invece di crearne di
 * propri. Un annuncio non e' un oggetto autonomo: e' la faccia pubblicabile di una
 * richiesta, e chi puo' aprire la richiesta puo' pubblicarne l'annuncio. Superficie RBAC
 * minima, come la 000212 prescrive; se un giorno servira' separarli, l'estensione e'
 * additiva — il contrario non lo e'.
 */

import { pool } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";
import { isPlatform } from "../../lib/actor.js";

export type { ActorContext };
import { ConflictError, ForbiddenError, NotFoundError } from "../../errors/index.js";
import type {
  JobPosting,
  JobPostingCreateBody,
  JobPostingListQuery,
  JobPostingUpdateBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

/** Un annuncio di un altro tenant non si distingue da uno che non esiste: 404, non 403. */
function visibile(actor: ActorContext, p: JobPosting): boolean {
  return isPlatform(actor) || p.tenantId === actor.tenantId;
}

export const jobPostingsService = {
  async list(actor: ActorContext, query: JobPostingListQuery) {
    const args = isPlatform(actor)
      ? { ...query }
      : { ...query, tenantId: actor.tenantId ?? undefined };
    return repo.listPostings(pool, args);
  },

  async getById(actor: ActorContext, id: string): Promise<JobPosting> {
    const target = await repo.findPostingById(pool, id);
    if (!target || !visibile(actor, target)) throw new NotFoundError("JobPosting");
    return target;
  },

  async create(actor: ActorContext, body: JobPostingCreateBody): Promise<JobPosting> {
    const tenantId = await repo.tenantOfRequisition(pool, body.requisitionId);
    // Una richiesta che non esiste e una di un altro tenant danno la stessa risposta, e
    // deve essere cosi': un 403 confermerebbe che quella richiesta esiste altrove.
    if (!tenantId) throw new NotFoundError("JobRequisition");
    if (!isPlatform(actor) && tenantId !== actor.tenantId) {
      throw new NotFoundError("JobRequisition");
    }
    if (isPlatform(actor) && !tenantId) {
      throw new ForbiddenError("Richiesta senza tenant", "PERMISSION_DENIED");
    }

    const doppione = await repo.findPostingByCode(pool, tenantId, body.code);
    if (doppione) {
      throw new ConflictError(
        `Il codice annuncio '${body.code}' esiste gia' in questo tenant`,
        "JOB_POSTING_CODE_CONFLICT",
      );
    }
    return repo.insertPosting(pool, tenantId, body, actor.userId);
  },

  async update(
    actor: ActorContext,
    id: string,
    patch: JobPostingUpdateBody,
  ): Promise<JobPosting> {
    const target = await repo.findPostingById(pool, id);
    if (!target || !visibile(actor, target)) throw new NotFoundError("JobPosting");

    // Anticipa il CHECK `dates_check`, per rispondere 409 invece di un 500 con dentro un
    // messaggio di PostgreSQL.
    const pubblicato = patch.publishedOn !== undefined ? patch.publishedOn : target.publishedOn;
    const scade = patch.expiresOn !== undefined ? patch.expiresOn : target.expiresOn;
    if (pubblicato && scade && scade < pubblicato) {
      throw new ConflictError(
        "La scadenza non puo' precedere la pubblicazione",
        "JOB_POSTING_DATES_INVALID",
      );
    }

    const aggiornato = await repo.updatePostingPartial(pool, id, patch, actor.userId);
    if (!aggiornato) throw new NotFoundError("JobPosting");
    return aggiornato;
  },
};
