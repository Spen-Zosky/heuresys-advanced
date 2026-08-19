/**
 * apps/api/src/modules/tenant-materialization/service.ts
 * COSTRUISCI UN'AZIENDA DA UN MODELLO (#4 WI-C, riscritto da #132 F3 — E29).
 *
 * Riservato a `PLATFORM_ADMIN` (cancello nel servizio, come per le famiglie professionali —
 * l'utente di servizio che guida questa operazione è un `PLATFORM_ADMIN` senza azienda).
 * Isolamento M-1: l'azienda di destinazione arriva dall'INPUT e non dal token, quindi va
 * verificata esistente e `ACTIVE`, e ogni scrittura porta il suo `tenant_id` (I5, imposto nel
 * repository).
 *
 * ⚠ NON C'È PIÙ UN ARCHETIPO, ed è la decisione E29 di Enzo (2026-08-17): *«il fascicolo non
 * può avere un archetipo aprioristico, altrimenti genera sempre una banca come RTL. I dati
 * hardcoded del file di codice scritto a mano devono scomparire — non deve rimanere traccia —
 * e l'archetipo deve essere generato dalla ricerca.»* Questo modulo nasceva su
 * un archetipo cablato, 296 righe di TypeScript che descrivevano una banca al dettaglio:
 * qualunque azienda si costruisse, nasceva quella banca. Ora il contenuto si legge dal
 * database, dalla versione di modello indicata (`BlueprintBuildSource`, `#132` F2).
 *
 * I CONTEGGI NON SI CALCOLANO PIÙ A PARTE. La versione precedente derivava i totali
 * dall'archetipo (`userCount * archetype.skills.length`, e così via) e li confrontava con ciò
 * che il motore aveva creato. Erano **due conti della stessa cosa**, tenuti allineati a mano:
 * il totale ora si legge dal piano, che è l'unica dichiarazione di cosa dovrebbe nascere.
 */
import { pool, withTransaction } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { ForbiddenError, NotFoundError } from "../../errors/index.js";
import type {
  BuildSourceListResponse,
  MaterializeRequestBody,
  MaterializeResult,
} from "@heuresys/shared";
import { BlueprintBuildSource, listBuildSources } from "./blueprint-build-source.js";
import * as repo from "./repository.js";

function ensurePlatformAdmin(actor: ActorContext): void {
  if (!actor.roles.includes("PLATFORM_ADMIN")) {
    throw new ForbiddenError("Only PLATFORM_ADMIN may materialize tenants", "TENANT_MATERIALIZE_ADMIN_ONLY");
  }
}

export const tenantMaterializationService = {
  async listSources(_actor: ActorContext): Promise<BuildSourceListResponse> {
    return { items: await listBuildSources(pool) };
  },

  async materialize(actor: ActorContext, body: MaterializeRequestBody): Promise<MaterializeResult> {
    ensurePlatformAdmin(actor);

    // Il piano si costruisce PRIMA di toccare l'azienda: un modello vuoto o incoerente fa
    // fallire qui, senza aver aperto nessuna transazione di scrittura.
    const piano = await new BlueprintBuildSource(pool, body.variantVersionId).plan();

    // M-1: l'azienda di destinazione deve esistere ed essere ACTIVE (arriva dall'input, non
    // dal token).
    const status = await repo.findTenantStatus(pool, body.tenantId);
    if (status === null) throw new NotFoundError("Tenant");
    if (status !== "ACTIVE") {
      throw new ForbiddenError(`Tenant is not ACTIVE (status=${status})`, "TENANT_NOT_ACTIVE");
    }

    const total = {
      orgUnits: piano.orgUnits.length,
      positions: piano.positions.length,
      users: piano.incumbents.length,
      assignments: piano.incumbents.length,
      skills: piano.skills.length,
      kpis: piano.kpis.length,
      skillEvidence: piano.incumbents.reduce((n, i) => n + i.skillEvidence.length, 0),
      kpiEvidence: piano.incumbents.reduce((n, i) => n + i.kpiEvidence.length, 0),
    };
    const created = await withTransaction((client) => repo.materialize(client, body.tenantId, piano, body.mode));
    const skipped = {
      orgUnits: total.orgUnits - created.orgUnits,
      positions: total.positions - created.positions,
      users: total.users - created.users,
      assignments: total.assignments - created.assignments,
      skills: total.skills - created.skills,
      kpis: total.kpis - created.kpis,
      skillEvidence: total.skillEvidence - created.skillEvidence,
      kpiEvidence: total.kpiEvidence - created.kpiEvidence,
    };
    return {
      tenantId: body.tenantId,
      variantVersionId: body.variantVersionId,
      sourceLabel: piano.label,
      mode: body.mode,
      created,
      skipped,
      total,
    };
  },
};
