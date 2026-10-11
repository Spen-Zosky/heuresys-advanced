/**
 * apps/api/src/modules/hierarchy-levels/service.ts
 * Il principio gerarchia-livelli (#265) come servizio di sola lettura. Avvisa, non blocca.
 * Senza un contratto collettivo caricato non c'è un ordine dei livelli da cui giudicare: lo dice (`scala.fonte = ASSENTE`) e non inventa.
 */
import { pool } from "../../db/client.js";
import { ForbiddenError, NotFoundError } from "../../errors/index.js";
import type { ActorContext } from "../../lib/actor.js";
import type { AvvisoLivello, HierarchyLevelsCheckQuery, HierarchyLevelsCheckResponse } from "@heuresys/shared";
import type { DbConnector } from "../tenant-materialization/build-source.js";
import { motivazioneFuoriScala, rango, verifica, type Avviso, type Scala, type Unita } from "./logic.js";
import * as repo from "./repository.js";

export type { ActorContext };

function esito(
  oggetto: "MODELLO" | "TENANT",
  fonte: "MODELLO" | "ATTIVAZIONI" | "ASSENTE",
  scala: Scala,
  unita: Unita[],
): HierarchyLevelsCheckResponse {
  if (scala.ordine.length === 0) {
    return { oggetto, scala: { fonte: "ASSENTE", livelli: [] }, unitaControllate: unita.length, avvisi: [], nonValutabili: [] };
  }
  const r = verifica(unita, scala);
  return { oggetto, scala: { fonte, livelli: [...scala.ordine] }, unitaControllate: unita.length, avvisi: r.avvisi, nonValutabili: r.nonValutabili };
}

/** Gli avvisi di un modello che si sta per attivare: l'ordine viene dal contratto caricato nel modello stesso. */
export async function avvisiDelModello(q: DbConnector, versionId: string): Promise<Avviso[]> {
  const scala = await repo.scalaDaVersioni(q, [versionId]);
  if (scala.ordine.length === 0) return [];
  return verifica(await repo.unitaDelModello(q, versionId), scala).avvisi;
}

/**
 * Gli avvisi di un cambio di livello contrattuale (F4): da chiamare DOPO la scrittura, nella stessa transazione, così l'organigramma
 * letto porta già il livello nuovo. Riusa `verifica` di F1 e tiene solo gli avvisi che riguardano la persona. Dove il tenant non ha
 * un contratto caricato non giudica: nessun avviso, nessun errore.
 */
export async function avvisiDelCambioDiLivello(
  q: DbConnector,
  tenantId: string,
  userId: string,
  livello: string,
): Promise<{ scala: { fonte: "ATTIVAZIONI" | "ASSENTE"; livelli: string[] }; avvisi: AvvisoLivello[] }> {
  const scala = await repo.scalaDaVersioni(q, await repo.versioniAttiveDelTenant(q, tenantId));
  if (scala.ordine.length === 0) return { scala: { fonte: "ASSENTE", livelli: [] }, avvisi: [] };
  const avvisi: AvvisoLivello[] = [];
  if (rango(livello, scala) === null) {
    avvisi.push({ tipo: "FUORI_SCALA", motivazione: motivazioneFuoriScala(livello, scala), dettaglio: null });
  }
  const r = verifica(await repo.unitaDelTenant(q, tenantId), scala);
  for (const a of r.avvisi) {
    if (a.responsabileId === userId || a.sottopostoId === userId) avvisi.push({ tipo: "GERARCHIA", motivazione: a.motivazione, dettaglio: a });
  }
  return { scala: { fonte: "ATTIVAZIONI", livelli: [...scala.ordine] }, avvisi };
}

export const hierarchyLevelsService = {
  async check(actor: ActorContext, query: HierarchyLevelsCheckQuery): Promise<HierarchyLevelsCheckResponse> {
    if (query.modelVersionId) {
      const esiste = await pool.query(
        `SELECT 1 FROM sys.sys_blueprint_variant_versions WHERE blueprint_variant_version_id = $1`,
        [query.modelVersionId],
      );
      if (esiste.rowCount === 0) throw new NotFoundError("Versione di modello non trovata");
      const scala = await repo.scalaDaVersioni(pool, [query.modelVersionId]);
      return esito("MODELLO", "MODELLO", scala, await repo.unitaDelModello(pool, query.modelVersionId));
    }
    if (!actor.tenantId) throw new ForbiddenError("Tenant context required", "TENANT_ID_REQUIRED");
    const versioni = await repo.versioniAttiveDelTenant(pool, actor.tenantId);
    const scala = await repo.scalaDaVersioni(pool, versioni);
    return esito("TENANT", "ATTIVAZIONI", scala, await repo.unitaDelTenant(pool, actor.tenantId));
  },
};
