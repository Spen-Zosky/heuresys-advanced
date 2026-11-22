/**
 * apps/api/src/modules/blueprint-processes/pubblicabilita.ts — il controllo di pubblicazione dei
 * processi del modello (ADR-0061 D10, passo 3 del piano di attuazione). Sola lettura.
 *
 * Per ogni processo di una versione del modello si misurano gli otto criteri di D10 su ciò che il
 * database porta oggi. Ciò che il modello non sa ancora rappresentare (valori configurabili o derivati,
 * decisioni, eccezioni, controlli, dipendenze, varianti compatibili, approvazioni e storia, istanze
 * ricostruibili) è una MANCANZA del criterio, non un criterio saltato: il rapporto dice dove il
 * metamodel è ancora vuoto, ed è la lista di lavoro dei passi 4-9. Le mancanze sono codici stabili;
 * la pagina li traduce. Un criterio è soddisfatto solo senza mancanze.
 */
import type { Pool, PoolClient } from "pg";
import type { ProcessPublishability, PublishabilityResponse } from "@heuresys/shared";

type Db = Pool | PoolClient;

interface Riga {
  id: string;
  code: string;
  name: string;
  description: string | null;
  version_id: string | null;
  metadata: Record<string, unknown> | null;
  steps: number;
  steps_with_output: number;
  steps_without_executor: number;
  steps_with_origin: number;
  kpis: number;
  kpis_without_formula: number;
  kpis_without_unit: number;
}

const vuoto = (s: string | null | undefined) => !s || s.trim().length === 0;

/** Gli otto criteri di D10 per un processo, con le mancanze in codici stabili. */
export function valuta(r: Riga): ProcessPublishability {
  const m: string[][] = [[], [], [], [], [], [], [], []];
  // 1 — identità e versione stabili, confini e risultati verificabili
  if (vuoto(r.code)) m[0]!.push("codice");
  if (!r.version_id) m[0]!.push("versione");
  if (vuoto(r.description)) m[0]!.push("descrizione");
  if (r.steps_with_output === 0) m[0]!.push("risultato");
  m[0]!.push("confini");
  // 2 — valori obbligatori, configurabili, derivati e non applicabili distinti
  m[1]!.push("valori_non_distinti");
  // 3 — responsabilità, decisioni, eccezioni e controlli
  if (r.steps === 0) m[2]!.push("attivita");
  else if (r.steps_without_executor > 0) m[2]!.push("esecutore");
  m[2]!.push("decisioni", "eccezioni", "controlli");
  // 4 — KPI con formula, unità, fonte, finestra temporale, dati mancanti
  if (r.kpis === 0) m[3]!.push("kpi");
  else {
    if (r.kpis_without_formula > 0) m[3]!.push("formula");
    if (r.kpis_without_unit > 0) m[3]!.push("unita");
    m[3]!.push("fonte", "finestra", "dati_mancanti");
  }
  // 5 — dipendenze, varianti compatibili, vincoli di configurazione
  m[4]!.push("dipendenze", "varianti", "vincoli");
  // 6 — provenienza, approvazioni, storia delle modifiche
  if (r.steps === 0 || r.steps_with_origin < r.steps) m[5]!.push("provenienza");
  m[5]!.push("approvazioni", "storia");
  // 7 — versione e configurazione di ogni esecuzione ricostruibili
  m[6]!.push("esecuzioni");
  // 8 — identificativi canonici, codici leggibili, denominazioni traducibili
  if (vuoto(r.code)) m[7]!.push("codice");
  if (vuoto(r.name)) m[7]!.push("denominazione");
  const md = r.metadata ?? {};
  if (typeof md["name_en"] !== "string" && typeof md["nameEn"] !== "string") m[7]!.push("traduzione");

  const criteri = m.map((x, i) => ({ numero: i + 1, soddisfatto: x.length === 0, mancanze: x }));
  const soddisfatti = criteri.filter((c) => c.soddisfatto).length;
  return { processId: r.id, code: r.code, name: r.name, soddisfatti, pubblicabile: soddisfatti === 8, criteri };
}

export async function pubblicabilita(db: Db, versionId: string): Promise<PublishabilityResponse> {
  const r = await db.query<Riga>(
    `SELECT bp.blueprint_process_id AS id, bp.blueprint_process_code AS code, bp.blueprint_process_name AS name,
            bp.blueprint_process_description AS description, bp.blueprint_process_variant_version_id AS version_id,
            bp.blueprint_process_metadata AS metadata,
            count(DISTINCT st.blueprint_content_process_step_id)::int AS steps,
            count(DISTINCT st.blueprint_content_process_step_id) FILTER (WHERE nullif(trim(st.blueprint_content_process_step_output), '') IS NOT NULL)::int AS steps_with_output,
            count(DISTINCT st.blueprint_content_process_step_id) FILTER (WHERE st.blueprint_content_process_step_executor_kind IS NULL)::int AS steps_without_executor,
            count(DISTINCT st.blueprint_content_process_step_id) FILTER (WHERE nullif(st.origine_dato, '') IS NOT NULL)::int AS steps_with_origin,
            count(DISTINCT k.kpi_definition_id)::int AS kpis,
            count(DISTINCT k.kpi_definition_id) FILTER (WHERE nullif(trim(k.kpi_definition_formula), '') IS NULL)::int AS kpis_without_formula,
            count(DISTINCT k.kpi_definition_id) FILTER (WHERE nullif(trim(k.kpi_definition_unit), '') IS NULL)::int AS kpis_without_unit
       FROM sys.sys_blueprint_process_registry bp
       LEFT JOIN sys.sys_blueprint_content_process_steps st
              ON st.blueprint_content_process_step_version_id = bp.blueprint_process_variant_version_id
             AND st.blueprint_content_process_step_process_code = bp.blueprint_process_code
       LEFT JOIN sys.sys_process_kpi_templates t ON t.process_kpi_template_process_id = bp.blueprint_process_id
       LEFT JOIN sys.sys_kpi_definitions k ON k.kpi_definition_id = t.process_kpi_template_kpi_id
      WHERE bp.blueprint_process_variant_version_id = $1
      GROUP BY bp.blueprint_process_id
      ORDER BY bp.blueprint_process_ordinal, bp.blueprint_process_code`,
    [versionId],
  );
  const items = r.rows.map(valuta);
  return { variantVersionId: versionId, total: items.length, pubblicabili: items.filter((x) => x.pubblicabile).length, items };
}
