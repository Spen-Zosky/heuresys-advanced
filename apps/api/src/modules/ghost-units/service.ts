/**
 * apps/api/src/modules/ghost-units/service.ts
 *
 * Tenant-scoped. L'organizzazione ghost (ADR-0063 D2) ricalca i ruoli apicali dell'organigramma
 * reale: chi può leggere l'organigramma può leggere la sua forma ghost, e chi può aggiornarlo può
 * chiederne la riforma. Le unità ghost non sono dati personali: il nome del responsabile è lo
 * stesso che l'organigramma già mostra. Il perimetro dei Capi ghost sui dati (G5) è un'altra cosa:
 * un Capo legge sempre con il perimetro della persona che serve, e qui non legge niente.
 */

import { pool } from "../../db/client.js";
import { puoVedereCliente, type ActorContext } from "../../lib/actor.js";
import { ForbiddenError, NotFoundError } from "../../errors/index.js";
import type {
  GhostRiformaResponse,
  GhostUnitsHistoryResponse,
  GhostUnitsResponse,
} from "@heuresys/shared";
import * as repo from "./repository.js";

// Il tenant si sceglie per perimetro di clienti (lib/actor.ts), non per nome di ruolo: chi ha il
// mandato di piattaforma ne nomina uno, gli altri leggono il proprio (o quelli assegnati).
async function resolveTenant(actor: ActorContext, requested?: string): Promise<string> {
  const t = requested ?? actor.tenantId;
  if (!t) throw new ForbiddenError("A tenantId is required", "TENANT_ID_REQUIRED");
  if (!puoVedereCliente(actor, t)) {
    throw new ForbiddenError("Ghost units of another tenant are not visible", "PERMISSION_DENIED");
  }
  if (!(await repo.tenantExists(pool, t))) throw new NotFoundError("Tenant");
  return t;
}

export const ghostUnitsService = {
  async list(actor: ActorContext, tenantId?: string): Promise<GhostUnitsResponse> {
    const t = await resolveTenant(actor, tenantId);
    const [items, drift] = await Promise.all([repo.listActive(pool, t), repo.countDrift(pool, t)]);
    return { items, total: items.length, allineata: drift === 0 };
  },

  async history(actor: ActorContext, tenantId?: string): Promise<GhostUnitsHistoryResponse> {
    const t = await resolveTenant(actor, tenantId);
    const items = await repo.listHistory(pool, t);
    return { items, total: items.length };
  },

  async riforma(actor: ActorContext, tenantId?: string): Promise<GhostRiformaResponse> {
    const t = await resolveTenant(actor, tenantId);
    return repo.riforma(pool, t);
  },
};
