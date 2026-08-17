/**
 * apps/api/src/modules/generated-origins/service.ts — #198 T6.
 *
 * Ambito, identico a quello di `provenance` e per la stessa ragione: `PLATFORM_ADMIN` vede
 * tutto, `TENANT_ADMIN` la propria azienda. Il permesso `provenance:read` è già ristretto a
 * quei due ruoli (mig `000171`), ma il filtro di tenant si applica **qui** e non si delega
 * al permesso: un permesso dice *se* puoi leggere, non *quali righe* (I5 — l'isolamento è
 * FK più filtro nel servizio, mai RLS).
 *
 * Nessun asse organizzativo: una riga di registro è metadato di provenienza (tabella, id,
 * versione, ragione), non contenuto di persona — la stessa decisione D-51 presa per il
 * Trust Ledger.
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";
import { ForbiddenError } from "../../errors/index.js";
import type { GeneratedOriginListQuery } from "@heuresys/shared";
import * as repo from "./repository.js";

function tenantFilter(a: ActorContext): string | undefined {
  if (isPlatform(a)) return undefined;
  if (!a.tenantId) throw new ForbiddenError("Tenant context required", "TENANT_REQUIRED");
  return a.tenantId;
}

export const generatedOriginsService = {
  async list(a: ActorContext, query: GeneratedOriginListQuery) {
    return repo.listOrigins(pool, tenantFilter(a), query);
  },
  async summary(a: ActorContext, tenantId?: string, blueprintVersionId?: string) {
    return repo.summarize(pool, tenantFilter(a), tenantId, blueprintVersionId);
  },
};
