/**
 * apps/api/src/modules/job-requisitions/service.ts
 * Autorizzazione di scope per le richieste di personale (#54 F3).
 *
 * Modello di visibilita': SOLO-TENANT. `PLATFORM_ADMIN` vede e scrive cross-tenant (mandato
 * tecnico); chiunque altro e' confinato al proprio tenant da un filtro esplicito — I5, che
 * l'isolamento lo fa con FK + filtro nel middleware e MAI con la RLS.
 *
 * ⚠ Il diniego di SCOPE e' `PERMISSION_DENIED`, non `FORBIDDEN`: il permesso c'e', e' il
 * perimetro che non copre. `FORBIDDEN` lo produce `requirePermission` quando il ruolo non ha
 * proprio quel permesso, e confondere i due rende un test verde per la ragione sbagliata.
 */

import { pool } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";
import { isPlatform } from "../../lib/actor.js";

export type { ActorContext };
import { ConflictError, ForbiddenError, NotFoundError } from "../../errors/index.js";
import type {
  JobRequisition,
  JobRequisitionCreateBody,
  JobRequisitionListQuery,
  JobRequisitionUpdateBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

/** Il tenant su cui l'attore puo' operare, o l'errore che dice perche' no. */
function tenantDiLavoro(actor: ActorContext, richiesto?: string): string {
  if (isPlatform(actor)) {
    const t = richiesto ?? actor.tenantId;
    if (!t) {
      throw new ForbiddenError(
        "PLATFORM_ADMIN deve indicare il tenant su cui aprire la richiesta",
        "PERMISSION_DENIED",
      );
    }
    return t;
  }
  if (richiesto && richiesto !== actor.tenantId) {
    throw new ForbiddenError(
      "Non si apre una richiesta di personale in un altro tenant",
      "PERMISSION_DENIED",
    );
  }
  if (!actor.tenantId) {
    throw new ForbiddenError("L'attore non appartiene a nessun tenant", "PERMISSION_DENIED");
  }
  return actor.tenantId;
}

/** Una richiesta di un altro tenant non si distingue da una che non esiste: 404, non 403.
 *  Un 403 confermerebbe che quel codice esiste altrove, che e' gia' una perdita. */
function visibile(actor: ActorContext, r: JobRequisition): boolean {
  return isPlatform(actor) || r.tenantId === actor.tenantId;
}

export const jobRequisitionsService = {
  async list(actor: ActorContext, query: JobRequisitionListQuery) {
    const args = isPlatform(actor)
      ? { ...query }
      : { ...query, tenantId: actor.tenantId ?? undefined };
    return repo.listRequisitions(pool, args);
  },

  async getById(actor: ActorContext, id: string): Promise<JobRequisition> {
    const target = await repo.findRequisitionById(pool, id);
    if (!target || !visibile(actor, target)) throw new NotFoundError("JobRequisition");
    return target;
  },

  async create(actor: ActorContext, body: JobRequisitionCreateBody): Promise<JobRequisition> {
    const tenantId = tenantDiLavoro(actor, body.tenantId);

    // I1: si copre un POSTO, e il posto dev'essere di questo tenant. La FK da sola non
    // basterebbe — accetterebbe una posizione di un'altra azienda.
    if (!(await repo.positionBelongsToTenant(pool, body.positionId, tenantId))) {
      throw new NotFoundError("Position");
    }
    const doppione = await repo.findRequisitionByCode(pool, tenantId, body.code);
    if (doppione) {
      throw new ConflictError(
        `Il codice richiesta '${body.code}' esiste gia' in questo tenant`,
        "JOB_REQUISITION_CODE_CONFLICT",
      );
    }
    return repo.insertRequisition(pool, tenantId, body, actor.userId);
  },

  async update(
    actor: ActorContext,
    id: string,
    patch: JobRequisitionUpdateBody,
  ): Promise<JobRequisition> {
    const target = await repo.findRequisitionById(pool, id);
    if (!target || !visibile(actor, target)) throw new NotFoundError("JobRequisition");

    // Il CHECK `dates_check` vive nel database ed e' la verita'; qui si anticipa il suo
    // verdetto per rispondere 409 invece di un 500 con dentro un messaggio di PostgreSQL.
    const aperta = patch.openedOn !== undefined ? patch.openedOn : target.openedOn;
    const chiusa = patch.closedOn !== undefined ? patch.closedOn : target.closedOn;
    if (aperta && chiusa && chiusa < aperta) {
      throw new ConflictError(
        "La data di chiusura non puo' precedere quella di apertura",
        "JOB_REQUISITION_DATES_INVALID",
      );
    }

    const aggiornata = await repo.updateRequisitionPartial(pool, id, patch, actor.userId);
    if (!aggiornata) throw new NotFoundError("JobRequisition");
    return aggiornata;
  },
};
