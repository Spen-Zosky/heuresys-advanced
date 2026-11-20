/**
 * apps/api/src/modules/organigramma/service.ts — quale cliente disegnare.
 *
 * Il cliente dell'attore, oppure quello chiesto con `?tenantId=` se è nel suo perimetro
 * (`puoVedereCliente`). Un mandato di piattaforma senza cliente proprio deve dirlo: un
 * organigramma è di un cliente solo, non si mescolano gli alberi di due clienti.
 */
import type { OrganigrammaQuery, OrganigrammaResponse } from "@heuresys/shared";
import { perimetroClienti, puoVedereCliente, type ActorContext } from "../../lib/actor.js";
import { NotFoundError, ValidationError } from "../../errors/index.js";
import { leggiOrganigramma, nomeCliente } from "./repository.js";

export async function organigrammaDi(actor: ActorContext, query: OrganigrammaQuery): Promise<OrganigrammaResponse> {
  // D9=B: un mandato di piattaforma «assegnato» senza clienti ha il perimetro VUOTO per scelta. Se non chiede un cliente preciso non e' un errore:
  // risponde 200 con un organigramma vuoto e `senzaCliente: true`, come la rubrica. Un cliente chiesto per nome e fuori perimetro resta 404.
  const perimetro = perimetroClienti(actor);
  if (!query.tenantId && perimetro !== undefined && perimetro.size === 0) {
    return {
      tenantId: actor.tenantId ?? "00000000-0000-0000-0000-000000000000", cliente: "", calcolatoIl: new Date().toISOString(),
      unita: [], posizioni: [], senzaCliente: true,
      avvisi: { posizioniSenzaRiporto: 0, riportiFuoriCliente: 0, unitaSenzaResponsabile: 0 },
    };
  }
  const tenantId = query.tenantId ?? actor.tenantId ?? actor.assignedTenantIds?.[0];
  if (!tenantId) throw new ValidationError({ tenantId: "required" }, "Indicare il cliente (tenantId)");
  // Fuori dal perimetro risponde come un cliente che non esiste: non lo rende osservabile.
  if (!puoVedereCliente(actor, tenantId)) throw new NotFoundError("Tenant");
  const cliente = await nomeCliente(tenantId);
  if (!cliente) throw new NotFoundError("Tenant");
  return leggiOrganigramma(tenantId, cliente);
}
