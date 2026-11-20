/**
 * apps/api/src/modules/tenant-processes/service.ts — il responsabile di un processo del tenant.
 *
 * ADR-0060 (le applet dell'assistente), voce P3 del piano. Il permesso è `bpm_process:read` /
 * `bpm_process:update`, che esistono dalla 000005 e fino a qui non avevano una rotta
 * (`apps/api/test/permessi-senza-rotta.allowlist.json`): nessun permesso nuovo e nessuna concessione
 * nuova. Oggi li portano TENANT_ADMIN, HRMS_MANAGER (000169), BLUEPRINT_MANAGER e PROCESS_OWNER.
 *
 * Perimetro, oltre al permesso:
 *  · il processo è del tenant di chi chiama (I5); fuori dal tenant risponde 404, senza dire che esiste;
 *  · il mandato HR (ADR-0036) e BLUEPRINT_MANAGER, che disegna i processi, cambiano il responsabile di
 *    qualunque processo del loro tenant;
 *  · gli altri (PROCESS_OWNER) solo dei processi di cui reggono oggi la posizione responsabile:
 *    possono passare il processo a un'altra posizione, non prenderne uno che non presidiano.
 *
 * È una scrittura sulla struttura (classe B di ADR-0056 D2): collega un processo a una posizione, non
 * decide niente su una persona. Annullare è la stessa rotta con `previousOwnerPositionId`.
 */
import { pool, withTransaction } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";
import { haMandatoDisegnoProcessi } from "../../lib/scope/mandati.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../errors/index.js";
import type {
  TenantProcess, UpdateTenantProcessOwnerBody, UpdateTenantProcessOwnerResponse,
} from "@heuresys/shared";
import * as repo from "./repository.js";

function cambiaTuttoIlTenant(actor: ActorContext): boolean {
  return haMandatoDisegnoProcessi(actor);
}

export const tenantProcessesService = {
  async getById(actor: ActorContext, id: string): Promise<TenantProcess> {
    const p = await repo.findProcessById(pool, id);
    if (!p || p.tenantId !== actor.tenantId) throw new NotFoundError("TenantProcess");
    return p;
  },

  async updateOwner(
    actor: ActorContext, id: string, body: UpdateTenantProcessOwnerBody,
  ): Promise<UpdateTenantProcessOwnerResponse> {
    const previous = await withTransaction(async (c) => {
      const attuale = await repo.lockOwner(c, id);
      if (!attuale || attuale.tenantId !== actor.tenantId) throw new NotFoundError("TenantProcess");
      if (!attuale.isActive) {
        throw new ValidationError([{ path: ["id"], message: "Il processo non è attivo" }], "Il processo non è attivo");
      }
      if (!cambiaTuttoIlTenant(actor)) {
        const presidia = attuale.ownerPositionId !== null
          && (await repo.holdsPosition(c, actor.userId, attuale.ownerPositionId));
        if (!presidia) {
          throw new ForbiddenError("Puoi cambiare il responsabile solo dei processi che presidi", "PERMISSION_DENIED");
        }
      }
      if (body.ownerPositionId !== null) {
        const pos = await repo.positionTenant(c, body.ownerPositionId);
        if (!pos || pos.tenantId !== actor.tenantId) {
          throw new ValidationError(
            [{ path: ["ownerPositionId"], message: "La posizione non è di questo tenant" }],
            "La posizione non è di questo tenant",
          );
        }
        if (!pos.isActive) {
          throw new ValidationError(
            [{ path: ["ownerPositionId"], message: "La posizione non è attiva" }],
            "La posizione non è attiva",
          );
        }
      }
      await repo.setOwner(c, id, body.ownerPositionId, actor.userId);
      return attuale.ownerPositionId;
    });
    const process = await repo.findProcessById(pool, id);
    if (!process) throw new NotFoundError("TenantProcess");
    return { process, previousOwnerPositionId: previous };
  },
};
