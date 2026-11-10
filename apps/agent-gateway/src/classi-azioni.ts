/**
 * apps/agent-gateway/src/classi-azioni.ts — ADR-0056 D2, piano dei principi agentici voce T2.
 *
 * LA CLASSE DI OGNI AZIONE DEL CATALOGO. È una proprietà fissa dell'operazione, scritta qui,
 * mai una scelta del modello né del mandato (principio P14, letto per Heuresys da ADR-0056 D2):
 *
 *   · A, legge: letture con i permessi della persona (ADR-0040);
 *   · B, interna e annullabile: scrittura dentro il tenant, sulla struttura e non su una singola
 *     persona, annullabile con un ritorno provato. È l'unica classe che una capacità `LIBERA`
 *     di ADR-0053 potrà eseguire senza conferma;
 *   · C, esce o impegna: raggiunge una persona fuori dalla piattaforma, produce un effetto su un
 *     singolo lavoratore, tocca le eccezioni di ADR-0036 §5, oppure cancella. Mai automatica;
 *   · X, non esiste: non sta in questo elenco, e quindi non sta nemmeno nel catalogo.
 *
 * COSA DECIDE LA CLASSE. Una scrittura senza classe è NEGATA (ADR-0056 D2, «un'operazione che non
 * si sa classificare è negata»). Una scrittura B può passare senza ponte di approvazione solo dentro
 * una capacità `LIBERA` del tenant e sotto il suo tetto (`capacita.ts`, passo A3 di ADR-0053); ogni
 * altra scrittura, e ogni C sempre, passa dal ponte di approvazione umana.
 *
 * LE CANCELLAZIONI SONO C, non B. ADR-0035 vuole che si ritiri marcando e non cancellando, e
 * P17 mette ogni cancellazione possibile in C o X. Non è verificato qui se l'API, dietro le
 * rotte DELETE di questo catalogo, ritiri o cancelli davvero: finché non lo è, la classe più
 * prudente fra le due ammesse.
 *
 * LO STRUMENTO GENERICO (`hrx_entity_query`) non ha una classe sua: la prende dall'operazione
 * risolta, come già fa il gate per la lettura e la scrittura (ADR-0033 §5.2). GET è A; ogni altra
 * è C, perché la mappa dell'atlante non dice se un'operazione tocca la struttura o una persona,
 * e chi non lo sa sceglie la classe che non diventa mai automatica.
 */
import { bareToolName, isParametricToolName } from "./mcp-tool-names.js";

export type ClasseAzione = "A" | "B" | "C";

/** Le classi degli strumenti con un nome proprio. Ogni nome del catalogo deve comparire qui. */
export const CLASSI_STRUMENTI: Readonly<Record<string, ClasseAzione>> = Object.freeze({
  // Catalogo generico: le due ricerche leggono lo schema, non i dati.
  hrx_concepts_search: "A",
  hrx_concept_describe: "A",

  // La vista della pagina aperta: cambia ciò che si vede, mai i dati.
  hrx_vista_comanda: "A",

  // Letture.
  hrx_org_units_list: "A",
  hrx_org_units_get: "A",
  hrx_positions_list: "A",
  hrx_positions_get: "A",
  hrx_job_roles_list: "A",
  hrx_job_families_list: "A",
  hrx_skills_list: "A",
  hrx_skill_prof_levels: "A",
  hrx_kpi_defs_list: "A",
  hrx_process_kpi_templates_list: "A",
  hrx_orgunit_kpi_templates_list: "A",
  hrx_typing_profiles_list: "A",
  hrx_blueprint_families_list: "A",
  hrx_blueprint_variants_list: "A",
  hrx_blueprint_processes_list: "A",
  hrx_blueprint_activations_list: "A",
  hrx_blueprint_overrides_list: "A",
  hrx_performance_reviews_list: "A",
  hrx_performance_reviews_get: "A",
  hrx_kpi_measurements_list: "A",
  hrx_predictions_list: "A",
  hrx_predictions_get: "A",
  hrx_org_unit_processes_list: "A",
  hrx_capability_composition: "A",
  hrx_capability_essential_ranking: "A",
  hrx_capability_vrio: "A",
  hrx_capability_maturity: "A",
  hrx_matching_my_positions: "A",
  hrx_matching_my_job_roles: "A",
  hrx_matching_my_occupations: "A",
  hrx_tenant_consolidations_list: "A",

  // Scritture sulla struttura del tenant: B.
  hrx_org_units_upsert: "B",
  hrx_positions_upsert: "B",
  hrx_job_roles_upsert: "B",
  hrx_skills_upsert: "B",
  hrx_kpi_defs_upsert: "B",
  hrx_process_kpi_template_upsert: "B",
  hrx_orgunit_kpi_template_upsert: "B",
  hrx_typing_profile_upsert: "B",
  hrx_blueprint_activation_upsert: "B",
  hrx_blueprint_override_upsert: "B",
  hrx_job_families_upsert: "B",
  hrx_blueprint_families_upsert: "B",
  hrx_blueprint_variants_upsert: "B",
  hrx_blueprint_processes_upsert: "B",
  hrx_tenant_materialize: "B",

  // Cancellazioni: C (vedi l'intestazione).
  hrx_org_units_delete: "C",
  hrx_positions_delete: "C",
  // hrx_kpi_defs_delete e hrx_job_families_delete tolti il 2026-11-08 (ADR-0056 D2, prova avversaria T7: l'API cancella fisicamente (DELETE FROM), cioè classe X, che non sta nel catalogo). Le due
  // cancellazioni rimaste sono logiche (is_active = false) e restano C.
});

/** Risolve il metodo HTTP di un'operazione dell'atlante (lo stesso contratto del gate). */
export interface RisolutoreMetodo {
  methodOf(conceptId: string, operationId: string): string | undefined;
}

/**
 * La classe di una chiamata, oppure `undefined` se non si sa dire: chi riceve `undefined` nega.
 * Per uno strumento con un nome proprio è la riga di `CLASSI_STRUMENTI`; per lo strumento
 * generico si guarda il metodo dell'operazione risolta.
 */
export function classeAzione(
  name: string, input: unknown, resolver?: RisolutoreMetodo,
): ClasseAzione | undefined {
  const nudo = bareToolName(name);
  if (!isParametricToolName(nudo)) return CLASSI_STRUMENTI[nudo];

  const a = (input ?? {}) as { conceptId?: unknown; operationId?: unknown };
  if (typeof a.conceptId !== "string" || typeof a.operationId !== "string" || !resolver) return undefined;
  const metodo = resolver.methodOf(a.conceptId, a.operationId)?.toUpperCase();
  if (!metodo) return undefined;
  return metodo === "GET" ? "A" : "C";
}
