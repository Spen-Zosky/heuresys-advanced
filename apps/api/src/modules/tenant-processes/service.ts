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
  StepApqcParam, ProcessFacet, ProcessFacetVocabularyResponse, PutStepApqcBody, PutStepApqcResponse, PutTenantProcessFacetBody, TenantProcess,
  TenantProcessFacetsResponse, UpdateTenantProcessOwnerBody, UpdateTenantProcessOwnerResponse,
} from "@heuresys/shared";
import { userHasPermission } from "../../middleware/rbac.js";
import * as repo from "./repository.js";

function cambiaTuttoIlTenant(actor: ActorContext): boolean {
  return haMandatoDisegnoProcessi(actor);
}

/** Il perimetro di scrittura sul processo: tutto il tenant per chi lo disegna, il proprio per chi lo presidia. */
async function nelPerimetro(c: repo.DbConnector, actor: ActorContext, ownerPositionId: string | null, messaggio: string): Promise<void> {
  if (cambiaTuttoIlTenant(actor)) return;
  const presidia = ownerPositionId !== null && (await repo.holdsPosition(c, actor.userId, ownerPositionId));
  if (!presidia) throw new ForbiddenError(messaggio, "PERMISSION_DENIED");
}

/**
 * Vero se chi chiama regge oggi la posizione responsabile del processo, nel proprio tenant.
 * Decisione di Enzo del 2026-11-22 (ADR-0061): il potere di classificare un processo viene
 * dall'esserne il responsabile in carica, anche senza PROCESS_OWNER, e segue i cambi di persona.
 */
export async function presidiaIlProcesso(actor: ActorContext, id: string): Promise<boolean> {
  const p = await repo.findProcessById(pool, id);
  if (!p || p.tenantId !== actor.tenantId || p.ownerPositionId === null) return false;
  return repo.holdsPosition(pool, actor.userId, p.ownerPositionId);
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

  // ADR-0061 D4, passo 2 (000507): le faccette. Leggere vuole `bpm_process:read` e il processo del
  // proprio tenant; scrivere vuole `bpm_process:update` e lo stesso perimetro del responsabile: il
  // mandato HR e chi disegna i processi su tutto il tenant, il responsabile solo sui processi che
  // presidia. Una scrittura della persona è una decisione (fonte PERSONA, stato APPROVATA).

  async facetVocabulary(): Promise<ProcessFacetVocabularyResponse> {
    return { items: await repo.facetVocabulary(pool) };
  },

  async facets(actor: ActorContext, id: string): Promise<TenantProcessFacetsResponse> {
    const p = await repo.findProcessById(pool, id);
    if (!p || p.tenantId !== actor.tenantId) throw new NotFoundError("TenantProcess");
    // Il mandato e chi disegna i processi su tutto il tenant (con il permesso); il responsabile in
    // carica sul proprio processo, con o senza PROCESS_OWNER (decisione di Enzo del 2026-11-22).
    const canEdit = (userHasPermission(actor, "bpm_process:update") && cambiaTuttoIlTenant(actor))
      || (p.ownerPositionId !== null && (await repo.holdsPosition(pool, actor.userId, p.ownerPositionId)));
    return { processId: id, canEdit, items: await repo.processFacets(pool, id) };
  },

  async putFacet(
    actor: ActorContext, id: string, facet: ProcessFacet, body: PutTenantProcessFacetBody,
  ): Promise<TenantProcessFacetsResponse> {
    const codes = [...new Set(body.codes)];
    await withTransaction(async (c) => {
      const attuale = await repo.lockOwner(c, id);
      if (!attuale || attuale.tenantId !== actor.tenantId) throw new NotFoundError("TenantProcess");
      if (!cambiaTuttoIlTenant(actor)) {
        const presidia = attuale.ownerPositionId !== null
          && (await repo.holdsPosition(c, actor.userId, attuale.ownerPositionId));
        if (!presidia) {
          throw new ForbiddenError("Puoi classificare solo i processi che presidi", "PERMISSION_DENIED");
        }
      }
      const noti = await repo.knownFacetCodes(c, facet, codes);
      const ignoti = codes.filter((x) => !noti.includes(x));
      if (ignoti.length > 0) {
        throw new ValidationError(
          [{ path: ["codes"], message: `Valori non previsti per questa faccetta: ${ignoti.join(", ")}` }],
          "Valori non previsti per questa faccetta",
        );
      }
      await repo.replaceFacet(c, attuale.tenantId, id, facet, codes, body.criterion);
    });
    return this.facets(actor, id);
  },

  // ADR-0061 D7, passo 4 (000509): il tipo di corrispondenza di un'attività con la voce APQC da cui
  // viene. Il codice non lo sceglie chi scrive: è quello dei metadati dell'attività (la provenienza).
  async putActivityMapping(
    actor: ActorContext, p: StepApqcParam, body: PutStepApqcBody,
  ): Promise<PutStepApqcResponse> {
    return withTransaction(async (c) => {
      const attuale = await repo.lockOwner(c, p.id);
      if (!attuale || attuale.tenantId !== actor.tenantId) throw new NotFoundError("TenantProcess");
      await nelPerimetro(c, actor, attuale.ownerPositionId, "Puoi dichiarare le corrispondenze solo dei processi che presidi");
      const step = await repo.stepOfProcess(c, p.id, p.stepId);
      if (!step || step.tenantId !== actor.tenantId) throw new NotFoundError("TenantProcessActivity");
      if (!step.apqcCode) {
        throw new ValidationError([{ path: ["stepId"], message: "L'attività non viene da una voce APQC" }], "L'attività non viene da una voce APQC");
      }
      await repo.upsertStepMapping(c, attuale.tenantId, p.stepId, step.apqcCode, body.kind, body.criterion);
      return {
        activityId: p.stepId,
        apqcCode: step.apqcCode,
        apqcMatch: { kind: body.kind, criterion: body.criterion, source: "PERSONA" as const, status: "APPROVATA" as const },
      };
    });
  },
};
