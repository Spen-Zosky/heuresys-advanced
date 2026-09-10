/**
 * apps/api/src/modules/branches/service.ts
 * B14 (2026-09-10) — le filiali, in sola lettura, filtrate per cliente.
 *
 * IL MODELLO DI VISIBILITA', dichiarato: `sys.sys_branches` porta `branch_tenant_id`, quindi è
 * un dato di cliente e I5 vale in pieno — chi non amministra la piattaforma vede le filiali del
 * proprio cliente e nient'altro. Chi amministra la piattaforma le vede tutte, ed è la stessa
 * eccezione di ogni altro modulo tenant-scoped del progetto.
 *
 * ⚠ UN ATTORE SENZA CLIENTE che non amministra la piattaforma non è un caso legittimo qui:
 * riceve un elenco vuoto e 404 sul dettaglio, non il catalogo di tutti. È la stessa scelta
 * fail-closed di `lib/scope/profilo.ts`, e per la stessa ragione — l'alternativa aprirebbe il
 * dato proprio dove nessuno ha ancora configurato niente.
 */

import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";
import { NotFoundError } from "../../errors/index.js";
import type { Branch, BranchListQuery, BranchListResponse } from "@heuresys/shared";
import * as repo from "./repository.js";

export type { ActorContext };

/**
 * `null` = nessun filtro (solo chi amministra la piattaforma). Per chiunque altro il cliente è
 * quello dell'attore; se non ne ha, si usa un identificativo che nessuna riga porta — così il
 * caso «attore senza cliente» resta chiuso invece di diventare «nessun filtro».
 */
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
function perimetro(a: ActorContext): string | null {
  if (isPlatform(a)) return null;
  return a.tenantId ?? ZERO_UUID;
}

export const branchesService = {
  async list(actor: ActorContext, query: BranchListQuery): Promise<BranchListResponse> {
    return repo.listBranches(pool, perimetro(actor), query);
  },

  async getById(actor: ActorContext, id: string): Promise<Branch> {
    const found = await repo.findBranchById(pool, id, perimetro(actor));
    // 404 e non 403: una filiale di un altro cliente non deve risultare esistente. Un 403
    // sarebbe un oracolo — direbbe «esiste, ma non è tua».
    if (!found) throw new NotFoundError("Branch");
    return found;
  },
};
