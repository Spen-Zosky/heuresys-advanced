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
import {
  GHOST_DRIFT_FIELD_VALUES,
  type GhostDriftItem,
  type GhostDriftResponse,
  type GhostRiformaResponse,
  type GhostTraits,
  type GhostUnitsHistoryResponse,
  type GhostUnitsResponse,
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

  /**
   * La deriva, voce per voce: la stessa differenza che `countDrift` conta, ma accoppiata per
   * unità reale, così chi guarda sa che cosa cambierebbe una riforma prima di chiederla.
   */
  async drift(actor: ActorContext, tenantId?: string): Promise<GhostDriftResponse> {
    const t = await resolveTenant(actor, tenantId);
    const [aperte, vive] = await Promise.all([repo.listOpenTraits(pool, t), repo.listLiveTraits(pool, t)]);
    const items = confrontaDeriva(aperte, vive);
    return { allineata: items.length === 0, items, total: items.length, calcolataIl: new Date().toISOString() };
  },

  async riforma(actor: ActorContext, tenantId?: string): Promise<GhostRiformaResponse> {
    const t = await resolveTenant(actor, tenantId);
    return repo.riforma(pool, t);
  },
};

type Tratti = GhostTraits & { sourceUnitId: string | null };

function soliTratti(x: Tratti): GhostTraits {
  return { sourceParentId: x.sourceParentId, level: x.level, kind: x.kind, code: x.code, name: x.name, sourceType: x.sourceType };
}

/** Pura: accoppia per unità reale le righe aperte e quelle vive e dice che cosa è cambiato. */
export function confrontaDeriva(aperte: Tratti[], vive: Tratti[]): GhostDriftItem[] {
  const viveDi = new Map(vive.filter((v) => v.sourceUnitId).map((v) => [v.sourceUnitId!, v]));
  const visti = new Set<string>();
  const out: GhostDriftItem[] = [];
  for (const g of aperte) {
    const v = g.sourceUnitId ? viveDi.get(g.sourceUnitId) : undefined;
    if (!v) {
      out.push({ change: "USCITA", sourceUnitId: g.sourceUnitId, ghost: soliTratti(g), live: null, changedFields: [] });
      continue;
    }
    visti.add(v.sourceUnitId!);
    const campi = GHOST_DRIFT_FIELD_VALUES.filter((c) => g[c] !== v[c]);
    if (campi.length) out.push({ change: "MODIFICATA", sourceUnitId: g.sourceUnitId, ghost: soliTratti(g), live: soliTratti(v), changedFields: campi });
  }
  for (const v of vive) {
    if (v.sourceUnitId && visti.has(v.sourceUnitId)) continue;
    out.push({ change: "NUOVA", sourceUnitId: v.sourceUnitId, ghost: null, live: soliTratti(v), changedFields: [] });
  }
  const ordine = (x: GhostDriftItem) => (x.live ?? x.ghost)!;
  return out.sort((a, b) => ordine(a).level - ordine(b).level || ordine(a).code.localeCompare(ordine(b).code));
}
