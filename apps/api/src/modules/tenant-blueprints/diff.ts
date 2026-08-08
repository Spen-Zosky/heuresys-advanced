/**
 * apps/api/src/modules/tenant-blueprints/diff.ts
 * #131 Tenant Builder P1, T5 — il confronto, in tre sezioni distinte:
 *
 *   model     cos'e' cambiato nel MODELLO di settore sotto i piedi del fascicolo
 *   decisions cosa ho cambiato IO
 *   impact    cosa succederebbe all'azienda gia' costruita
 *
 * La terza in P1 e' `computable: false`, e resta dichiarata tale finche' non
 * esistono lo strato struttura (P2) e il motore di applicazione (P3). **Mai uno
 * zero al posto di uno sconosciuto**: uno zero si legge «nessuna conseguenza»,
 * che e' il contrario della verita'.
 */
import type { Db } from "./repository.js";
import { listProcessesWithDecisions } from "./repository.js";
import type {
  BlueprintDiffResponse,
  BlueprintIdentity,
  ProcessDecision,
  TenantBlueprintVersion,
  ProcessInclusion,
} from "@heuresys/shared";

const IMPACT_NON_CALCOLABILE = {
  computable: false as const,
  reason:
    "In questa parte l'impatto sull'azienda gia' costruita non e' calcolabile: " +
    "mancano lo strato della struttura e il motore che applica il fascicolo. " +
    "Dichiararlo zero sarebbe un'informazione falsa.",
};

interface ProcessoModello {
  code: string;
  name: string;
}

async function processiDelModello(db: Db, variantVersionId: string): Promise<ProcessoModello[]> {
  const r = await db.query<{ code: string; name: string }>(
    `SELECT blueprint_process_code AS code, blueprint_process_name AS name
       FROM sys.sys_blueprint_process_registry
      WHERE blueprint_process_variant_version_id = $1
      ORDER BY blueprint_process_ordinal`,
    [variantVersionId],
  );
  return r.rows;
}

/** L'ultima versione pubblicata dello STESSO modello a cui la versione e' ancorata. */
async function ultimaVersioneDelModello(
  db: Db,
  variantVersionId: string,
): Promise<{ id: string; number: number } | null> {
  const r = await db.query<{ id: string; n: number }>(
    `SELECT ultima.blueprint_variant_version_id AS id,
            ultima.blueprint_variant_version_number AS n
       FROM sys.sys_blueprint_variant_versions ancorata
       JOIN sys.sys_blueprint_variant_versions ultima
         ON ultima.blueprint_variant_version_variant_id
          = ancorata.blueprint_variant_version_variant_id
        AND ultima.blueprint_variant_version_status = 'PUBLISHED'
      WHERE ancorata.blueprint_variant_version_id = $1
      ORDER BY ultima.blueprint_variant_version_number DESC
      LIMIT 1`,
    [variantVersionId],
  );
  const row = r.rows[0];
  return row ? { id: row.id, number: row.n } : null;
}

function confrontaProcessi(
  da: ProcessoModello[],
  a: ProcessoModello[],
): Pick<
  BlueprintDiffResponse["model"],
  "processesAdded" | "processesRemoved" | "processesRenamed"
> {
  const mappaDa = new Map(da.map((p) => [p.code, p.name]));
  const mappaA = new Map(a.map((p) => [p.code, p.name]));
  const processesAdded = a.filter((p) => !mappaDa.has(p.code)).map((p) => p.code);
  const processesRemoved = da.filter((p) => !mappaA.has(p.code)).map((p) => p.code);
  const processesRenamed: Array<{ code: string; from: string; to: string }> = [];
  for (const [code, nomeDa] of mappaDa) {
    const nomeA = mappaA.get(code);
    if (nomeA !== undefined && nomeA !== nomeDa) {
      processesRenamed.push({ code, from: nomeDa, to: nomeA });
    }
  }
  return { processesAdded, processesRemoved, processesRenamed };
}

const ETICHETTE_IDENTITA: Record<keyof BlueprintIdentity, string> = {
  industryClassId: "settore di attivita'",
  sizeBandId: "fascia dimensionale",
  operatingModelId: "modello operativo",
  regulatoryIntensity: "intensita' di vigilanza",
  countryCode: "paese",
  employeeCount: "numero di dipendenti",
  revenueEur: "ricavi",
};

function confrontaIdentita(
  da: BlueprintIdentity,
  a: BlueprintIdentity,
): Array<{ field: string; from: string | null; to: string | null }> {
  const out: Array<{ field: string; from: string | null; to: string | null }> = [];
  for (const campo of Object.keys(ETICHETTE_IDENTITA) as Array<keyof BlueprintIdentity>) {
    const prima = da[campo];
    const dopo = a[campo];
    if (prima === dopo) continue;
    out.push({
      field: ETICHETTE_IDENTITA[campo],
      from: prima === null || prima === undefined ? null : String(prima),
      to: dopo === null || dopo === undefined ? null : String(dopo),
    });
  }
  return out;
}

function confrontaDecisioni(
  da: ProcessDecision[],
  a: ProcessDecision[],
): BlueprintDiffResponse["decisions"] {
  const decise = (l: ProcessDecision[]): Map<string, ProcessDecision> =>
    new Map(l.filter((p) => p.inclusion !== null).map((p) => [p.processCode, p]));
  const mappaDa = decise(da);
  const mappaA = decise(a);

  const added = [...mappaA.values()].filter((p) => !mappaDa.has(p.processCode));
  const removed = [...mappaDa.values()].filter((p) => !mappaA.has(p.processCode));
  const changed: BlueprintDiffResponse["decisions"]["changed"] = [];
  for (const [code, prima] of mappaDa) {
    const dopo = mappaA.get(code);
    if (!dopo) continue;
    if (prima.inclusion === dopo.inclusion && prima.rationale === dopo.rationale) continue;
    changed.push({
      processCode: code,
      fromInclusion: prima.inclusion as ProcessInclusion,
      toInclusion: dopo.inclusion as ProcessInclusion,
      fromRationale: prima.rationale ?? "",
      toRationale: dopo.rationale ?? "",
    });
  }
  return { added, removed, changed, identityChanged: [] };
}

/** Confronto fra due versioni DELLO STESSO fascicolo. */
export async function diffVersions(
  db: Db,
  corrente: TenantBlueprintVersion,
  altra: TenantBlueprintVersion,
): Promise<BlueprintDiffResponse> {
  const decisioniAltra = await listProcessesWithDecisions(db, altra.tenantBlueprintVersionId);
  const decisioniCorrente = await listProcessesWithDecisions(
    db,
    corrente.tenantBlueprintVersionId,
  );

  const modelloCambiato = altra.variantVersionId !== corrente.variantVersionId;
  const processiAltra = altra.variantVersionId
    ? await processiDelModello(db, altra.variantVersionId)
    : [];
  const processiCorrente = corrente.variantVersionId
    ? await processiDelModello(db, corrente.variantVersionId)
    : [];

  const decisions = confrontaDecisioni(decisioniAltra, decisioniCorrente);
  decisions.identityChanged = confrontaIdentita(altra.identity, corrente.identity);

  return {
    model: {
      changed: modelloCambiato,
      fromVersionNumber: altra.number,
      toVersionNumber: corrente.number,
      ...confrontaProcessi(processiAltra, processiCorrente),
    },
    decisions,
    impact: IMPACT_NON_CALCOLABILE,
  };
}

/**
 * Confronto fra il modello ANCORATO e l'ultima versione pubblicata dello stesso
 * modello: e' la domanda «il catalogo si e' mosso sotto di me?».
 */
export async function diffAgainstModelLatest(
  db: Db,
  corrente: TenantBlueprintVersion,
): Promise<BlueprintDiffResponse> {
  const decisioni = await listProcessesWithDecisions(db, corrente.tenantBlueprintVersionId);
  const vuoto: BlueprintDiffResponse["decisions"] = {
    added: [],
    removed: [],
    changed: [],
    identityChanged: [],
  };

  if (!corrente.variantVersionId) {
    return {
      model: {
        changed: false,
        fromVersionNumber: null,
        toVersionNumber: null,
        processesAdded: [],
        processesRemoved: [],
        processesRenamed: [],
      },
      decisions: vuoto,
      impact: IMPACT_NON_CALCOLABILE,
    };
  }

  const ultima = await ultimaVersioneDelModello(db, corrente.variantVersionId);
  const ancorata = await processiDelModello(db, corrente.variantVersionId);
  const piuRecente = ultima ? await processiDelModello(db, ultima.id) : ancorata;

  const numeroAncorato = await db.query<{ n: number }>(
    `SELECT blueprint_variant_version_number AS n FROM sys.sys_blueprint_variant_versions
      WHERE blueprint_variant_version_id = $1`,
    [corrente.variantVersionId],
  );

  return {
    model: {
      changed: ultima !== null && ultima.id !== corrente.variantVersionId,
      fromVersionNumber: numeroAncorato.rows[0]?.n ?? null,
      toVersionNumber: ultima?.number ?? null,
      ...confrontaProcessi(ancorata, piuRecente),
    },
    // Le decisioni non si confrontano con niente qui: sono le mie, e restano.
    // Si dichiarano quelle prese, cosi' chi legge vede su cosa il movimento del
    // modello andrebbe a incidere.
    decisions: { ...vuoto, added: decisioni.filter((d) => d.inclusion !== null) },
    impact: IMPACT_NON_CALCOLABILE,
  };
}
