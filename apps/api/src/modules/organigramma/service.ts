/**
 * apps/api/src/modules/organigramma/service.ts — quale cliente disegnare.
 *
 * Il cliente dell'attore, oppure quello chiesto con `?tenantId=` se è nel suo perimetro
 * (`puoVedereCliente`). Un mandato di piattaforma senza cliente proprio deve dirlo: un
 * organigramma è di un cliente solo, non si mescolano gli alberi di due clienti.
 */
import type { OrganigrammaQuery, OrganigrammaResponse } from "@heuresys/shared";
import { puoVedereCliente, type ActorContext } from "../../lib/actor.js";
import { NotFoundError, ValidationError } from "../../errors/index.js";
import { leggiOrganigramma, nomeCliente } from "./repository.js";

export async function organigrammaDi(actor: ActorContext, query: OrganigrammaQuery): Promise<OrganigrammaResponse> {
  const tenantId = query.tenantId ?? actor.tenantId ?? actor.assignedTenantIds?.[0];
  if (!tenantId) throw new ValidationError({ tenantId: "required" }, "Indicare il cliente (tenantId)");
  // Fuori dal perimetro risponde come un cliente che non esiste: non lo rende osservabile.
  if (!puoVedereCliente(actor, tenantId)) throw new NotFoundError("Tenant");
  const cliente = await nomeCliente(tenantId);
  if (!cliente) throw new NotFoundError("Tenant");
  return leggiOrganigramma(tenantId, cliente);
}
