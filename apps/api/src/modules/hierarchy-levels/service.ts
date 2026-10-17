/**
 * apps/api/src/modules/hierarchy-levels/service.ts
 * Il principio gerarchia-livelli (#265) come servizio di sola lettura. Avvisa, non blocca.
 * Senza un contratto collettivo caricato non c'è un ordine dei livelli da cui giudicare: lo dice (`scala.fonte = ASSENTE`) e non inventa.
 */
import { pool } from "../../db/client.js";
import { ForbiddenError, NotFoundError } from "../../errors/index.js";
import type { ActorContext } from "../../lib/actor.js";
import type { HierarchyLevelsCheckQuery, HierarchyLevelsCheckResponse } from "@heuresys/shared";
import type { DbConnector } from "../tenant-materialization/build-source.js";
import { avvisiNuovi, conAssegnazione, verifica, type Avviso, type Scala, type Unita } from "./logic.js";
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

/** Gli avvisi dell'organigramma del tenant adesso. Vuoto se il tenant non ha un contratto collettivo da cui ricavare l'ordine. */
async function avvisiDelTenant(tenantId: string): Promise<{ avvisi: Avviso[]; scala: Scala; unita: Unita[] }> {
  const scala = await repo.scalaDaVersioni(pool, await repo.versioniAttiveDelTenant(pool, tenantId));
  if (scala.ordine.length === 0) return { avvisi: [], scala, unita: [] };
  const unita = await repo.unitaDelTenant(pool, tenantId);
  return { avvisi: verifica(unita, scala).avvisi, scala, unita };
}

/** L'avviso è accessorio: se non si riesce a calcolarlo la modifica non fallisce, e lo si dice nel log invece di tacere. */
async function senzaFermarsi<T>(quando: string, f: () => Promise<T>, perDefault: T): Promise<T> {
  try {
    return await f();
  } catch (e) {
    console.warn(`[hierarchy-levels] avviso non calcolato (${quando}):`, e instanceof Error ? e.message : e);
    return perDefault;
  }
}

/**
 * Applica una modifica all'organigramma e dice quali avvisi gerarchia-livelli introduce (#265, F3). Non blocca e non cambia l'esito:
 * la modifica si applica sempre; gli avvisi sono quelli del dopo che non c'erano nel prima.
 */
export async function conAvvisiDellaModifica<T>(tenantId: string, applica: () => Promise<T>): Promise<{ risultato: T; avvisi: Avviso[] }> {
  const prima = await senzaFermarsi("prima", async () => (await avvisiDelTenant(tenantId)).avvisi, null);
  const risultato = await applica();
  if (prima === null) return { risultato, avvisi: [] };
  const dopo = await senzaFermarsi("dopo", async () => (await avvisiDelTenant(tenantId)).avvisi, null);
  return { risultato, avvisi: dopo === null ? [] : avvisiNuovi(prima, dopo) };
}

/**
 * Gli avvisi che introdurrebbe un'assegnazione PROPOSTA (nulla è ancora scritto: la scrittura attende l'approvazione).
 * Con `trasferimento` la persona lascia prima il posto che occupa oggi.
 */
export async function avvisiDiUnaAssegnazione(
  tenantId: string,
  persona: { userId: string; positionId: string; trasferimento?: boolean },
): Promise<Avviso[]> {
  return senzaFermarsi("assegnazione", async () => {
    const { avvisi, scala, unita } = await avvisiDelTenant(tenantId);
    if (scala.ordine.length === 0) return [];
    const posto = await repo.postoPerAssegnazione(pool, tenantId, persona.userId, persona.positionId);
    if (!posto || posto.unitaId === null) return [];
    const dopo = conAssegnazione(unita, { id: persona.userId, posto: posto.posto, livello: posto.livello }, posto.unitaId, persona.trasferimento ? persona.userId : undefined);
    return avvisiNuovi(avvisi, verifica(dopo, scala).avvisi);
  }, []);
}
