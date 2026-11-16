/**
 * apps/api/src/modules/tenant-consolidation/distanza.ts — la misura della distanza fra un tenant e un
 * modello (voce A2 del piano `docs/piani/PIANO_allineamento-consolidamento_20261116.md`, ADR-0059 D7).
 *
 * Sola lettura. Per un tenant e una versione di modello (`sys_blueprint_variant_versions`, per esempio
 * quella di una corsa del registro `sys_blueprint_runs`) conta, dominio per dominio, le voci uguali,
 * parziali, diverse, solo nel modello e solo nel tenant, e a parte la «ricchezza persa» (ADR-0059 D3):
 * gli attributi che il modello porta per una voce abbinata e che il tenant non ha.
 *
 * I domini sono i 24 del confronto dell'11/11 fra la corsa `p20261010010521tjb` e RTL Bank
 * (`confronto-corsa-rtl/dati_20261111/riepilogo.json`). Il lato del tenant si legge dalle stesse tabelle
 * che leggeva quel confronto (`heuresys-datastore/apps/api/src/rtl_lettura.ts` e `rtl_confronto_grezzi.ts`);
 * il lato del modello dal contenuto della versione (`sys_blueprint_content_*`, processi in
 * `sys_blueprint_process_registry`).
 *
 * Il riconoscimento è deterministico e scritto qui, non scelto a mano: nome uguale dopo la
 * normalizzazione (minuscole, senza accenti né punteggiatura), poi la somiglianza per parole del confronto
 * dell'11/11 (`costruisci.py`, `tok`/`sim`, soglia 0,35; 0,7 o più vale come nome uguale), abbinamento uno
 * a uno con i punteggi più alti per primi. Il confronto dell'11/11 aveva in più abbinamenti dei ruoli e
 * delle unità scritti a mano: le differenze di numeri che ne nascono si spiegano, non si nascondono.
 *
 * Esiti di una coppia: «uguale» se il nome coincide e gli attributi confrontati pure; «diverso» o
 * «parziale» (secondo il dominio) se il nome coincide e un attributo no; «parziale» se il nome è solo
 * simile. Nessuna query seleziona dati di persona oltre al conteggio degli incarichi.
 */
import type { DbConnector } from "./repository.js";

export const DOMINI_DISTANZA = [
  "ateco", "classe", "ccnl", "processi", "unita", "organigramma", "obblighi", "ruoli", "copertura",
  "inquadramento", "fasi", "skill", "obiettivi", "metriche", "derivati", "bersagli", "formazione",
  "carriere", "incentivi", "commesse", "criticita", "condizioni", "ruoli_funzionali", "utenti",
] as const;
export type DominioDistanza = (typeof DOMINI_DISTANZA)[number];

export type Esito = "uguale" | "parziale" | "diverso" | "solo_modello" | "solo_tenant";

export interface RigaDistanza {
  esito: Esito;
  modello: string | null;
  tenant: string | null;
  nota?: string;
}

export interface MisuraDominio {
  dominio: DominioDistanza;
  righe: number;
  uguali: number;
  parziali: number;
  diversi: number;
  solo_modello: number;
  solo_tenant: number;
  /** Attributi del modello portati dalle voci abbinate e assenti nel tenant (ADR-0059 D3). */
  ricchezza_persa: number;
  /** Che cosa confronta il dominio e che cosa manca a un lato, detto in una frase. */
  nota: string;
  dettaglio?: RigaDistanza[];
}

export interface MisuraDistanza {
  tenantId: string;
  variantVersionId: string;
  misurataIl: string;
  domini: MisuraDominio[];
  totale: Omit<MisuraDominio, "dominio" | "nota" | "dettaglio">;
}

// ---------------------------------------------------------------------------------------------------
// Riconoscimento

const STOP = new Set(
  "di del della dei delle degli e ed a al alla ai alle per in il lo la i gli le un una con da su tra fra o nel nella nei che non sui è".split(" "),
);
const GENERICI = new Set(["risolu", "client", "percen", "tasso", "tempo", "numero", "medio", "totale", "costo", "corso", "formaz", "gestio", "operat", "edizio", "aula"]);

export function normalizza(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parole(s: string): Set<string> {
  const out = new Set<string>();
  for (const w of (s ?? "").toLowerCase().match(/[a-zà-ù0-9]+/g) ?? []) {
    if (STOP.has(w) || w.length <= 2) continue;
    const t = w.slice(0, 6);
    if (!GENERICI.has(t)) out.add(t);
  }
  return out;
}

/** La somiglianza di `costruisci.py` (coefficiente di Dice sulle radici di sei lettere). */
export function somiglianza(a: string, b: string): number {
  if (normalizza(a) === normalizza(b) && normalizza(a) !== "") return 1;
  const ta = parole(a);
  const tb = parole(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let comuni = 0;
  for (const x of ta) if (tb.has(x)) comuni++;
  return (2 * comuni) / (ta.size + tb.size);
}

export const SOGLIA_PARZIALE = 0.35;
export const SOGLIA_NOME_UGUALE = 0.7;

export interface Voce {
  etichetta: string;
  /** Si abbina solo dentro lo stesso ambito (per esempio il tipo di voce del CCNL). */
  ambito?: string | null;
  /** Attributi confrontati: chiave → valore già normalizzato per il confronto. */
  attributi?: Record<string, string | null>;
  /** Attributi del modello che contano per la ricchezza (solo lato modello). */
  ricchezza?: Record<string, string | null>;
  /** Attributi del tenant corrispondenti alla ricchezza. */
  posseduti?: Record<string, string | null>;
  rif?: string;
}

export interface Coppia {
  m: Voce;
  t: Voce;
  punteggio: number;
}

export interface Abbinamento {
  coppie: Coppia[];
  soloModello: Voce[];
  soloTenant: Voce[];
}

/** Abbinamento uno a uno: prima i nomi uguali, poi i punteggi più alti, a parità l'ordine di lettura. */
export function abbina(modello: Voce[], tenant: Voce[], soglia = SOGLIA_PARZIALE): Abbinamento {
  const candidati: { i: number; j: number; p: number }[] = [];
  modello.forEach((m, i) => {
    tenant.forEach((t, j) => {
      if ((m.ambito ?? null) !== (t.ambito ?? null)) return;
      const p = somiglianza(m.etichetta, t.etichetta);
      if (p >= soglia) candidati.push({ i, j, p });
    });
  });
  candidati.sort((a, b) => b.p - a.p || a.i - b.i || a.j - b.j);
  const usatiM = new Set<number>();
  const usatiT = new Set<number>();
  const coppie: Coppia[] = [];
  for (const c of candidati) {
    if (usatiM.has(c.i) || usatiT.has(c.j)) continue;
    usatiM.add(c.i);
    usatiT.add(c.j);
    coppie.push({ m: modello[c.i]!, t: tenant[c.j]!, punteggio: c.p });
  }
  coppie.sort((a, b) => modello.indexOf(a.m) - modello.indexOf(b.m));
  return {
    coppie,
    soloModello: modello.filter((_, i) => !usatiM.has(i)),
    soloTenant: tenant.filter((_, j) => !usatiT.has(j)),
  };
}

const vuoto = (v: string | null | undefined) => v === null || v === undefined || String(v).trim() === "";

function ricchezzaPersa(c: Coppia): number {
  let n = 0;
  for (const [k, v] of Object.entries(c.m.ricchezza ?? {})) {
    if (!vuoto(v) && vuoto(c.t.posseduti?.[k])) n++;
  }
  return n;
}

function esitoCoppia(c: Coppia, seDiversa: "diverso" | "parziale"): { esito: Esito; nota?: string } {
  if (c.punteggio < SOGLIA_NOME_UGUALE) return { esito: "parziale", nota: `nome simile (${Math.round(c.punteggio * 100)}%)` };
  const diff: string[] = [];
  for (const [k, v] of Object.entries(c.m.attributi ?? {})) {
    const w = c.t.attributi?.[k] ?? null;
    if (normalizza(v) !== normalizza(w)) diff.push(`${k}: modello ${v ?? "—"}, tenant ${w ?? "—"}`);
  }
  return diff.length ? { esito: seDiversa, nota: diff.join("; ") } : { esito: "uguale" };
}

function righeDaAbbinamento(a: Abbinamento, seDiversa: "diverso" | "parziale"): { righe: RigaDistanza[]; ricchezza: number } {
  const righe: RigaDistanza[] = [];
  let ricchezza = 0;
  for (const c of a.coppie) {
    const e = esitoCoppia(c, seDiversa);
    ricchezza += ricchezzaPersa(c);
    righe.push({ esito: e.esito, modello: c.m.etichetta, tenant: c.t.etichetta, ...(e.nota ? { nota: e.nota } : {}) });
  }
  for (const m of a.soloModello) righe.push({ esito: "solo_modello", modello: m.etichetta, tenant: null });
  for (const t of a.soloTenant) righe.push({ esito: "solo_tenant", modello: null, tenant: t.etichetta });
  return { righe, ricchezza };
}

function conta(dominio: DominioDistanza, nota: string, righe: RigaDistanza[], ricchezza: number, conDettaglio: boolean): MisuraDominio {
  const n = (e: Esito) => righe.filter((r) => r.esito === e).length;
  return {
    dominio,
    righe: righe.length,
    uguali: n("uguale"),
    parziali: n("parziale"),
    diversi: n("diverso"),
    solo_modello: n("solo_modello"),
    solo_tenant: n("solo_tenant"),
    ricchezza_persa: ricchezza,
    nota,
    ...(conDettaglio ? { dettaglio: righe } : {}),
  };
}

/** Livello CCNL nella forma di RTL (3A3L, QD2, Dirigente), come `norm_liv` del confronto dell'11/11. */
export function livelloNormale(cod: string | null | undefined): string | null {
  const c = cod ?? "";
  if (c === "") return null;
  let m = /3AREA_L(\d)/.exec(c);
  if (m) return `3A${m[1]}L`;
  m = /QD(\d)/.exec(c);
  if (m) return `QD${m[1]}`;
  if (c.includes("DIRIGENT") || c.endsWith("Dirigente")) return "Dirigente";
  if (c.includes("AREAUNIFICATA")) return "Area unificata";
  return c.replace("CCNL Credito 2024 ", "");
}

const CRITICITA: Record<string, string> = { CRITICAL: "Critica", HIGH: "Alta", MEDIUM: "Media", LOW: "Bassa" };

// ---------------------------------------------------------------------------------------------------
// Letture. `$1` è la versione del modello o il tenant.

type R = Record<string, string | number | boolean | null | undefined>;
type Tupla<N extends number, A extends R[][] = []> = A["length"] extends N ? A : Tupla<N, [...A, R[]]>;

const M = {
  contesto: `SELECT blueprint_content_context_ateco_code AS ateco, blueprint_content_context_ateco_name AS ateco_nome,
                    blueprint_content_context_size_band_code AS fascia, blueprint_content_context_size_class AS classe
               FROM sys.sys_blueprint_content_context WHERE blueprint_content_context_version_id = $1`,
  sedi: `SELECT blueprint_content_site_code AS codice, blueprint_content_site_name AS nome, blueprint_content_site_kind AS tipo
           FROM sys.sys_blueprint_content_sites WHERE blueprint_content_site_version_id = $1 ORDER BY 1`,
  ccnl: `SELECT blueprint_content_ccnl_code AS codice, blueprint_content_ccnl_name AS nome
           FROM sys.sys_blueprint_content_ccnl WHERE blueprint_content_ccnl_version_id = $1 ORDER BY 1`,
  livelli: `SELECT blueprint_content_ccnl_level_code AS codice, blueprint_content_ccnl_level_name AS nome
              FROM sys.sys_blueprint_content_ccnl_levels WHERE blueprint_content_ccnl_level_version_id = $1 ORDER BY 1`,
  istituti: `SELECT blueprint_content_ccnl_institute_kind AS tipo, blueprint_content_ccnl_institute_description AS descrizione
               FROM sys.sys_blueprint_content_ccnl_institutes WHERE blueprint_content_ccnl_institute_version_id = $1
              ORDER BY blueprint_content_ccnl_institute_ccnl_code, blueprint_content_ccnl_institute_ordinal`,
  condizioni: `SELECT blueprint_content_ccnl_condition_description AS descrizione, blueprint_content_ccnl_condition_value AS valore
                 FROM sys.sys_blueprint_content_ccnl_conditions WHERE blueprint_content_ccnl_condition_version_id = $1
                ORDER BY blueprint_content_ccnl_condition_ccnl_code, blueprint_content_ccnl_condition_institute_ordinal, blueprint_content_ccnl_condition_ordinal`,
  processi: `SELECT blueprint_process_code AS codice, blueprint_process_name AS nome, blueprint_process_description AS descrizione
               FROM sys.sys_blueprint_process_registry WHERE blueprint_process_variant_version_id = $1
              ORDER BY blueprint_process_ordinal, blueprint_process_code`,
  fasi: `SELECT s.blueprint_content_process_step_name AS nome, s.blueprint_content_process_step_process_code AS processo
           FROM sys.sys_blueprint_content_process_steps s WHERE s.blueprint_content_process_step_version_id = $1
          ORDER BY s.blueprint_content_process_step_process_code, s.blueprint_content_process_step_ordinal`,
  unita: `SELECT u.blueprint_content_unit_code AS codice, u.blueprint_content_unit_name AS nome, p.blueprint_content_unit_name AS madre,
                 u.blueprint_content_unit_site_code AS sede, u.blueprint_content_unit_planned_headcount::text AS organico,
                 u.blueprint_content_unit_mandate AS mandato
            FROM sys.sys_blueprint_content_units u
            LEFT JOIN sys.sys_blueprint_content_units p
              ON p.blueprint_content_unit_version_id = u.blueprint_content_unit_version_id
             AND p.blueprint_content_unit_code = u.blueprint_content_unit_parent_code
           WHERE u.blueprint_content_unit_version_id = $1 ORDER BY u.blueprint_content_unit_code`,
  posizioni: `SELECT p.blueprint_content_position_code AS codice, p.blueprint_content_position_title AS titolo,
                     u.blueprint_content_unit_name AS unita, s.blueprint_content_position_title AS riporta_a,
                     p.blueprint_content_position_ccnl_level_code AS livello, p.blueprint_content_position_criticality AS criticita,
                     p.blueprint_content_position_planned_headcount AS organico
                FROM sys.sys_blueprint_content_positions p
                LEFT JOIN sys.sys_blueprint_content_units u
                  ON u.blueprint_content_unit_version_id = p.blueprint_content_position_version_id
                 AND u.blueprint_content_unit_code = p.blueprint_content_position_unit_code
                LEFT JOIN sys.sys_blueprint_content_positions s
                  ON s.blueprint_content_position_version_id = p.blueprint_content_position_version_id
                 AND s.blueprint_content_position_code = p.blueprint_content_position_reports_to_code
               WHERE p.blueprint_content_position_version_id = $1 ORDER BY p.blueprint_content_position_code`,
  requisiti: `SELECT r.blueprint_content_psr_position_code AS posizione,
                     coalesce(k.blueprint_content_skill_esco_uri, k.blueprint_content_skill_name) AS chiave
                FROM sys.sys_blueprint_content_position_skill_requirements r
                JOIN sys.sys_blueprint_content_skills k
                  ON k.blueprint_content_skill_version_id = r.blueprint_content_psr_version_id
                 AND k.blueprint_content_skill_code = r.blueprint_content_psr_skill_code
               WHERE r.blueprint_content_psr_version_id = $1`,
  obblighi: `SELECT o.blueprint_content_obligation_code AS codice, o.blueprint_content_obligation_subject AS nome,
                    (SELECT array_agg(x.blueprint_content_obligation_position_position_code)
                       FROM sys.sys_blueprint_content_obligation_positions x
                      WHERE x.blueprint_content_obligation_position_version_id = o.blueprint_content_obligation_version_id
                        AND x.blueprint_content_obligation_position_obligation_code = o.blueprint_content_obligation_code) AS posizioni
               FROM sys.sys_blueprint_content_obligations o WHERE o.blueprint_content_obligation_version_id = $1 ORDER BY 1`,
  obiettivi: `SELECT blueprint_content_goal_title AS nome FROM sys.sys_blueprint_content_goals
               WHERE blueprint_content_goal_version_id = $1 ORDER BY blueprint_content_goal_code`,
  metriche: `SELECT blueprint_content_kpi_name AS nome, blueprint_content_kpi_unit AS unita,
                    blueprint_content_kpi_target_value::text AS bersaglio, blueprint_content_kpi_formula AS formula,
                    blueprint_content_kpi_frequency AS frequenza
               FROM sys.sys_blueprint_content_kpis WHERE blueprint_content_kpi_version_id = $1 ORDER BY blueprint_content_kpi_code`,
  formazione: `SELECT blueprint_content_training_title AS nome, blueprint_content_training_delivery AS modalita,
                      blueprint_content_training_duration_minutes::text AS minuti
                 FROM sys.sys_blueprint_content_training WHERE blueprint_content_training_version_id = $1 ORDER BY blueprint_content_training_code`,
  carriere: `SELECT blueprint_content_career_name AS nome FROM sys.sys_blueprint_content_career_paths
              WHERE blueprint_content_career_version_id = $1 ORDER BY blueprint_content_career_code`,
  incentivi: `SELECT blueprint_content_incentive_name AS nome FROM sys.sys_blueprint_content_incentives
               WHERE blueprint_content_incentive_version_id = $1 ORDER BY blueprint_content_incentive_code`,
  commesse: `SELECT blueprint_content_engagement_name AS nome FROM sys.sys_blueprint_content_engagements
              WHERE blueprint_content_engagement_version_id = $1 ORDER BY blueprint_content_engagement_code`,
} as const;

const T = {
  profilo: `SELECT a.activity_classification_code AS ateco, a.activity_classification_name AS ateco_nome,
                   s.enterprise_size_band_code AS fascia
              FROM sys.sys_enterprise_typing_profiles e
              LEFT JOIN sys.sys_activity_classifications a ON a.activity_classification_id = e.enterprise_typing_industry_class_id
              LEFT JOIN sys.sys_enterprise_size_bands s ON s.enterprise_size_band_id = e.enterprise_typing_size_band_id
             WHERE e.enterprise_typing_tenant_id = $1
             ORDER BY e.enterprise_typing_assessed_at DESC NULLS LAST LIMIT 1`,
  sedi: `SELECT b.branch_code AS codice, u.organization_unit_name AS nome
           FROM sys.sys_branches b JOIN sys.sys_organization_units u ON u.organization_unit_id = b.branch_organization_unit_id
          WHERE b.branch_tenant_id = $1 ORDER BY b.branch_code`,
  contratti: `SELECT DISTINCT user_contract_ccnl_type AS ccnl, user_contract_ccnl_level AS livello
                FROM sys.sys_user_contracts WHERE user_contract_tenant_id = $1 AND user_contract_ccnl_type IS NOT NULL ORDER BY 1, 2`,
  maturazioni: `SELECT accrual_rule_name AS nome, accrual_rule_description AS descrizione, accrual_rule_amount::text AS valore
                  FROM sys.sys_leave_accrual_rules
                 WHERE accrual_rule_tenant_id = $1 AND accrual_rule_deleted_at IS NULL ORDER BY accrual_rule_ccnl_type, accrual_rule_leave_type, accrual_rule_name`,
  processi: `SELECT tenant_process_code AS codice, tenant_process_name AS nome, tenant_process_description AS descrizione
               FROM sys.sys_tenant_processes WHERE tenant_process_tenant_id = $1 AND tenant_process_is_active ORDER BY tenant_process_code`,
  fasi: `SELECT s.tenant_process_step_name AS nome, p.tenant_process_code AS processo
           FROM sys.sys_tenant_process_steps s JOIN sys.sys_tenant_processes p ON p.tenant_process_id = s.tenant_process_step_process_id
          WHERE p.tenant_process_tenant_id = $1 AND p.tenant_process_is_active ORDER BY p.tenant_process_code, s.tenant_process_step_ordinal`,
  unita: `SELECT u.organization_unit_code AS codice, u.organization_unit_name AS nome, p.organization_unit_name AS madre,
                 u.organization_unit_site_code AS sede, u.organization_unit_planned_headcount::text AS organico
            FROM sys.sys_organization_units u
            LEFT JOIN sys.sys_organization_units p ON p.organization_unit_id = u.organization_unit_parent_id
           WHERE u.organization_unit_tenant_id = $1 AND u.organization_unit_is_active ORDER BY u.organization_unit_code`,
  posizioni: `SELECT x.position_id::text AS id, x.position_code AS codice, x.position_title AS titolo, u.organization_unit_name AS unita,
                     s.position_title AS riporta_a, x.position_criticality AS criticita,
                     (SELECT string_agg(DISTINCT c.user_contract_ccnl_level, ',' ORDER BY c.user_contract_ccnl_level)
                        FROM sys.sys_user_position_assignments a
                        JOIN sys.sys_user_contracts c ON c.user_contract_user_id = a.user_position_assignment_user_id
                                                    AND c.user_contract_tenant_id = $1 AND c.user_contract_status = 'ACTIVE'
                       WHERE a.user_position_assignment_position_id = x.position_id
                         AND a.user_position_assignment_status = 'ACTIVE') AS livelli,
                     (SELECT count(*)::int FROM sys.sys_user_position_assignments a
                       WHERE a.user_position_assignment_position_id = x.position_id
                         AND a.user_position_assignment_status = 'ACTIVE') AS persone
                FROM sys.sys_positions x
                LEFT JOIN sys.sys_organization_units u ON u.organization_unit_id = x.position_organization_unit_id
                LEFT JOIN sys.sys_positions s ON s.position_id = x.position_reports_to_position_id
               WHERE x.position_tenant_id = $1 AND x.position_is_active ORDER BY x.position_code`,
  requisiti: `SELECT r.position_id::text AS posizione, coalesce(k.skill_esco_uri, k.skill_name) AS chiave
                FROM sys.sys_position_skill_requirements r
                JOIN sys.sys_positions x ON x.position_id = r.position_id
                JOIN sys.sys_skills k ON k.skill_id = r.skill_id
               WHERE r.position_skill_requirement_tenant_id = $1 AND x.position_is_active`,
  obiettivi: `SELECT template_name AS nome FROM sys.sys_goal_templates
               WHERE template_tenant_id = $1 AND template_is_active AND template_deleted_at IS NULL ORDER BY template_name, template_natural_key`,
  metriche: `SELECT k.kpi_definition_name AS nome, k.kpi_definition_unit AS unita, k.kpi_definition_formula AS formula
               FROM sys.sys_kpi_definitions k
              WHERE k.kpi_definition_id IN (SELECT kpi_definition_id FROM sys.sys_position_kpi_requirements WHERE position_kpi_requirement_tenant_id = $1
                                            UNION SELECT kpi_target_kpi_id FROM sys.sys_kpi_targets WHERE kpi_target_tenant_id = $1)
              ORDER BY k.kpi_definition_code`,
  bersagli: `SELECT k.kpi_definition_name AS nome,
                    string_agg(DISTINCT t.kpi_target_target_value::text, ',') AS valori, count(*)::int AS quanti
               FROM sys.sys_kpi_targets t JOIN sys.sys_kpi_definitions k ON k.kpi_definition_id = t.kpi_target_kpi_id
              WHERE t.kpi_target_tenant_id = $1 GROUP BY k.kpi_definition_name ORDER BY 1`,
  formazione: `SELECT replace(learning_module_title, ' — edizione in aula', '') AS nome, learning_module_delivery AS modalita,
                      learning_module_duration_minutes::text AS minuti
                 FROM sys.sys_learning_modules WHERE learning_module_tenant_id = $1 ORDER BY learning_module_code`,
  carriere: `SELECT career_path_name AS nome FROM sys.sys_career_paths WHERE career_path_tenant_id = $1 ORDER BY career_path_code`,
  incentivi: `SELECT objective_reward_rule_name AS nome FROM sys.sys_objective_reward_rules
               WHERE objective_reward_rule_tenant_id = $1 ORDER BY objective_reward_rule_code`,
  commesse: `SELECT project_name AS nome FROM sys.sys_projects WHERE project_tenant_id = $1 ORDER BY project_code`,
  ruoliFunzionali: `SELECT r.auth_role_code AS codice, r.auth_role_name AS nome, count(DISTINCT x.user_auth_role_user_id)::int AS titolari
                      FROM sys.sys_user_auth_roles x
                      JOIN sys.sys_auth_roles r ON r.auth_role_id = x.user_auth_role_role_id
                      JOIN sys.sys_users u ON u.user_id = x.user_auth_role_user_id AND u.user_tenant_id = $1
                     WHERE x.user_auth_role_revoked_at IS NULL GROUP BY 1, 2 ORDER BY 1`,
  incarichi: `SELECT a.user_position_assignment_position_id::text AS posizione
                FROM sys.sys_user_position_assignments a
                JOIN sys.sys_positions x ON x.position_id = a.user_position_assignment_position_id
               WHERE x.position_tenant_id = $1 AND a.user_position_assignment_status = 'ACTIVE'`,
} as const;

const s = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

/** Le letture una dopo l'altra: un solo client in una transazione di sola lettura non ne regge due insieme. */
async function inSequenza(fs: (() => Promise<R[]>)[]): Promise<R[][]> {
  const out: R[][] = [];
  for (const f of fs) out.push(await f());
  return out;
}

async function leggi(q: DbConnector, sql: string, param: string): Promise<R[]> {
  return (await q.query<R>(sql, [param])).rows;
}

/** Un dominio di sole voci per nome, con gli attributi indicati. */
function perNome(
  dominio: DominioDistanza,
  nota: string,
  rm: R[],
  rt: R[],
  conf: { attributi?: string[]; ricchezza?: string[]; seDiversa?: "diverso" | "parziale"; ambito?: string } = {},
  conDettaglio = false,
): { misura: MisuraDominio; abb: Abbinamento } {
  const voce = (r: R, lato: "m" | "t"): Voce => ({
    etichetta: s(r["nome"]) ?? "",
    ambito: conf.ambito ? s(r[conf.ambito]) : null,
    attributi: Object.fromEntries((conf.attributi ?? []).map((k) => [k, s(r[k])])),
    ...(lato === "m"
      ? { ricchezza: Object.fromEntries((conf.ricchezza ?? []).map((k) => [k, s(r[k])])) }
      : { posseduti: Object.fromEntries((conf.ricchezza ?? []).map((k) => [k, s(r[k])])) }),
    rif: s(r["codice"] ?? r["id"]) ?? undefined,
  } as Voce);
  const abb = abbina(rm.map((r) => voce(r, "m")), rt.map((r) => voce(r, "t")));
  const { righe, ricchezza } = righeDaAbbinamento(abb, conf.seDiversa ?? "diverso");
  return { misura: conta(dominio, nota, righe, ricchezza, conDettaglio), abb };
}

/**
 * Misura la distanza fra il tenant e la versione di modello. `conDettaglio` aggiunge a ogni dominio
 * l'elenco delle righe con l'esito, per spiegare un numero.
 */
export async function misuraDistanza(
  q: DbConnector,
  tenantId: string,
  variantVersionId: string,
  opts: { conDettaglio?: boolean; adesso?: Date } = {},
): Promise<MisuraDistanza> {
  const d = opts.conDettaglio ?? false;
  const V = variantVersionId;
  const TN = tenantId;
  const [
    mCtx, mSedi, mCcnl, mLiv, mIst, mCond, mProc, mFasi, mUni, mPos, mReq, mObb, mObi, mMet, mFor, mCar, mInc, mCom,
    tProf, tSedi, tContr, tMat, tProc, tFasi, tUni, tPos, tReq, tObi, tMet, tBer, tFor, tCar, tInc, tCom, tRuo, tInc2,
  ] = (await inSequenza([
    () => leggi(q, M.contesto, V), () => leggi(q, M.sedi, V), () => leggi(q, M.ccnl, V), () => leggi(q, M.livelli, V), () => leggi(q, M.istituti, V),
    () => leggi(q, M.condizioni, V), () => leggi(q, M.processi, V), () => leggi(q, M.fasi, V), () => leggi(q, M.unita, V), () => leggi(q, M.posizioni, V),
    () => leggi(q, M.requisiti, V), () => leggi(q, M.obblighi, V), () => leggi(q, M.obiettivi, V), () => leggi(q, M.metriche, V),
    () => leggi(q, M.formazione, V), () => leggi(q, M.carriere, V), () => leggi(q, M.incentivi, V), () => leggi(q, M.commesse, V),
    () => leggi(q, T.profilo, TN), () => leggi(q, T.sedi, TN), () => leggi(q, T.contratti, TN), () => leggi(q, T.maturazioni, TN),
    () => leggi(q, T.processi, TN), () => leggi(q, T.fasi, TN), () => leggi(q, T.unita, TN), () => leggi(q, T.posizioni, TN),
    () => leggi(q, T.requisiti, TN), () => leggi(q, T.obiettivi, TN), () => leggi(q, T.metriche, TN), () => leggi(q, T.bersagli, TN),
    () => leggi(q, T.formazione, TN), () => leggi(q, T.carriere, TN), () => leggi(q, T.incentivi, TN), () => leggi(q, T.commesse, TN),
    () => leggi(q, T.ruoliFunzionali, TN), () => leggi(q, T.incarichi, TN),
  ])) as Tupla<36>;

  const out: MisuraDominio[] = [];
  const push = (m: MisuraDominio) => out.push(m);

  // ateco: il codice dell'attività.
  push(perNome("ateco", "Codice ATECO del contesto del modello e del profilo del tenant.",
    mCtx.map((r) => ({ nome: r["ateco"] })), tProf.map((r) => ({ nome: r["ateco"] })), {}, d).misura);

  // classe: la fascia dimensionale e le sedi.
  {
    const rm = [...mCtx.map((r) => ({ nome: `Fascia ${s(r["fascia"]) ?? "—"}`, k: "fascia" })), ...mSedi.map((r) => ({ nome: r["nome"], k: "sede" }))];
    const rt = [...tProf.map((r) => ({ nome: `Fascia ${s(r["fascia"]) ?? "—"}`, k: "fascia" })), ...tSedi.map((r) => ({ nome: r["nome"], k: "sede" }))];
    push(perNome("classe", "Fascia dimensionale e sedi: siti del modello contro sedi (filiali) del tenant.", rm, rt, { ambito: "k" }, d).misura);
  }

  // ccnl: contratti, livelli e istituti (questi ultimi contro le regole di maturazione).
  {
    const rm = [
      ...mCcnl.map((r) => ({ nome: "CCNL Credito", k: "ccnl", c: r["nome"] })),
      ...mLiv.map((r) => ({ nome: livelloNormale(s(r["codice"])), k: "livello" })),
      ...mIst.map((r) => ({ nome: r["descrizione"], k: "istituto" })),
    ];
    const ccnlT = [...new Set(tContr.map((r) => s(r["ccnl"])).filter((x): x is string => !!x))];
    const livT = [...new Set(tContr.map((r) => livelloNormale(s(r["livello"]))).filter((x): x is string => !!x))];
    const rt = [
      ...ccnlT.map((c) => ({ nome: c.startsWith("CCNL Credito") ? "CCNL Credito" : c, k: "ccnl" })),
      ...livT.map((l) => ({ nome: l, k: "livello" })),
      ...tMat.map((r) => ({ nome: r["nome"], k: "istituto" })),
    ];
    push(perNome("ccnl", "Contratti, livelli (nella forma 3A3L, QD2, Dirigente) e istituti del modello contro contratti, livelli in uso e regole di maturazione del tenant.", rm, rt, { ambito: "k" }, d).misura);
  }

  // processi e fasi.
  push(perNome("processi", "Catalogo dei processi della versione contro i processi del tenant.", mProc, tProc, {}, d).misura);
  push(perNome("fasi", "Fasi dei processi della versione contro le fasi dei processi del tenant.", mFasi, tFasi, {}, d).misura);

  // unita e organigramma.
  const uni = perNome("unita", "Unità del modello contro unità attive del tenant, per nome; ricchezza: sede, organico, mandato.",
    mUni, tUni, { ricchezza: ["sede", "organico", "mandato"] }, d);
  push(uni.misura);
  {
    const righe: RigaDistanza[] = [];
    const coppiaDi = new Map(uni.abb.coppie.map((c) => [c.m.etichetta, c.t.etichetta]));
    const madreM = new Map(mUni.map((r) => [s(r["nome"]) ?? "", s(r["madre"])]));
    const madreT = new Map(tUni.map((r) => [s(r["nome"]) ?? "", s(r["madre"])]));
    for (const c of uni.abb.coppie) {
      const mm = madreM.get(c.m.etichetta) ?? null;
      const mt = madreT.get(c.t.etichetta) ?? null;
      const attesa = mm === null ? null : coppiaDi.get(mm) ?? null;
      const ok = (mm === null && mt === null) || (attesa !== null && attesa === mt);
      righe.push({ esito: ok ? "uguale" : "parziale", modello: c.m.etichetta, tenant: c.t.etichetta,
        ...(ok ? {} : { nota: `madre nel modello ${mm ?? "— (radice)"}, nel tenant ${mt ?? "— (radice)"}` }) });
    }
    for (const m of uni.abb.soloModello) righe.push({ esito: "solo_modello", modello: m.etichetta, tenant: null });
    for (const t of uni.abb.soloTenant) righe.push({ esito: "solo_tenant", modello: null, tenant: t.etichetta });
    push(conta("organigramma", "Legami di riporto delle unità abbinate: uguale se la madre del tenant è quella abbinata alla madre del modello.", righe, 0, d));
  }

  // ruoli: posizioni per titolo, nella stessa unità (abbinata) del modello.
  const vocePosM = (r: R): Voce => ({
    etichetta: s(r["titolo"]) ?? "", rif: s(r["codice"]) ?? undefined,
    attributi: { unita: s(r["unita"]) },
    ricchezza: { livello: s(r["livello"]), criticita: s(r["criticita"]), riporta_a: s(r["riporta_a"]) },
  });
  const unitaPari = new Map(uni.abb.coppie.map((c) => [c.m.etichetta, c.t.etichetta]));
  const vocePosT = (r: R): Voce => ({
    etichetta: s(r["titolo"]) ?? "", rif: s(r["id"]) ?? undefined,
    attributi: { unita: s(r["unita"]) },
    posseduti: { livello: s(r["livelli"]), criticita: s(r["criticita"]), riporta_a: s(r["riporta_a"]) },
  });
  const posM = mPos.map(vocePosM).map((v) => ({ ...v, attributi: { unita: unitaPari.get(v.attributi?.["unita"] ?? "") ?? v.attributi?.["unita"] ?? null } }));
  // Le posizioni del tenant con lo stesso titolo nella stessa unità sono un ruolo solo (come nel confronto
  // dell'11/11): tre «Consulente Clientela» della stessa filiale non sono tre differenze dal modello.
  const gruppoDi = new Map<string, string>();
  const gruppi = new Map<string, R>();
  for (const r of tPos) {
    const k = `${s(r["titolo"]) ?? ""}\u0000${s(r["unita"]) ?? ""}`;
    gruppoDi.set(s(r["id"]) ?? "", k);
    const g = gruppi.get(k);
    if (!g) { gruppi.set(k, { ...r, id: k }); continue; }
    const liv = new Set([...(s(g["livelli"]) ?? "").split(","), ...(s(r["livelli"]) ?? "").split(",")].filter(Boolean));
    g["livelli"] = [...liv].sort().join(",") || null;
    g["criticita"] = g["criticita"] ?? r["criticita"];
    g["riporta_a"] = g["riporta_a"] ?? r["riporta_a"];
    g["persone"] = Number(g["persone"] ?? 0) + Number(r["persone"] ?? 0);
  }
  const posT = [...gruppi.values()].map(vocePosT);
  const ruoli = abbina(posM, posT);
  // Un ruolo del tenant ripetuto in altre unità (le filiali che il modello non ha) con il titolo di un ruolo
  // del modello già abbinato è la stessa voce del modello in un posto in più: parziale, non estraneo.
  const ripetuti: Coppia[] = [];
  ruoli.soloTenant = ruoli.soloTenant.filter((t) => {
    const c = ruoli.coppie.find((x) => somiglianza(x.m.etichetta, t.etichetta) >= SOGLIA_NOME_UGUALE);
    if (!c) return true;
    ripetuti.push({ m: c.m, t, punteggio: 0 });
    return false;
  });
  {
    const { righe, ricchezza } = righeDaAbbinamento(ruoli, "parziale");
    for (const r of ripetuti) righe.push({ esito: "parziale", modello: r.m.etichetta, tenant: r.t.etichetta, nota: `ruolo del modello già abbinato, ripetuto in ${r.t.attributi?.["unita"] ?? "un'altra unità"}` });
    push(conta("ruoli", "Ruoli del modello contro ruoli del tenant (posizioni attive con lo stesso titolo nella stessa unità), per titolo; parziale se il titolo coincide ma l'unità non è quella abbinata, o se il ruolo è ripetuto in più unità.", righe, ricchezza, d));
  }
  const rM = new Map(mPos.map((r) => [s(r["codice"]) ?? "", r]));
  const rT = gruppi;

  // per posizione abbinata: inquadramento, skill, criticità, riporto (derivati).
  {
    const inq: RigaDistanza[] = [];
    const sk: RigaDistanza[] = [];
    const crt: RigaDistanza[] = [];
    const der: RigaDistanza[] = [];
    const reqM = new Map<string, Set<string>>();
    for (const r of mReq) { const k = s(r["posizione"]) ?? ""; if (!reqM.has(k)) reqM.set(k, new Set()); reqM.get(k)!.add(s(r["chiave"]) ?? ""); }
    const reqT = new Map<string, Set<string>>();
    for (const r of tReq) { const k = gruppoDi.get(s(r["posizione"]) ?? "") ?? ""; if (!reqT.has(k)) reqT.set(k, new Set()); reqT.get(k)!.add(s(r["chiave"]) ?? ""); }
    const pariPos = new Map(ruoli.coppie.map((c) => [s(rM.get(c.m.rif ?? "")?.["titolo"]) ?? "", c.t.etichetta]));
    for (const c of ruoli.coppie) {
      const m = rM.get(c.m.rif ?? "");
      const t = rT.get(c.t.rif ?? "");
      const lab = c.m.etichetta;
      const lm = livelloNormale(s(m?.["livello"]));
      const lt = (s(t?.["livelli"]) ?? "").split(",").filter(Boolean).map((x) => livelloNormale(x));
      inq.push({ esito: lm !== null && lt.includes(lm) ? "uguale" : "diverso", modello: `${lab} (${lm ?? "—"})`, tenant: `${c.t.etichetta} (${lt.join(", ") || "—"})` });
      const a = reqM.get(c.m.rif ?? "") ?? new Set<string>();
      const b = reqT.get(c.t.rif ?? "") ?? new Set<string>();
      let comuni = 0;
      for (const x of a) if (b.has(x)) comuni++;
      sk.push({ esito: comuni >= 3 ? "uguale" : comuni > 0 ? "parziale" : "diverso", modello: `${lab} (${a.size})`, tenant: `${c.t.etichetta} (${b.size})`, nota: `${comuni} in comune` });
      const cm = CRITICITA[s(m?.["criticita"]) ?? ""] ?? s(m?.["criticita"]);
      const ct = CRITICITA[s(t?.["criticita"]) ?? ""] ?? s(t?.["criticita"]);
      crt.push({ esito: ct === null ? "solo_modello" : cm === ct ? "uguale" : "diverso", modello: `${lab} (${cm ?? "—"})`, tenant: `${c.t.etichetta} (${ct ?? "non valutata"})` });
      const ra = s(m?.["riporta_a"]);
      const atteso = ra === null ? null : pariPos.get(ra) ?? null;
      const rt = s(t?.["riporta_a"]);
      der.push({ esito: ra === null || (atteso !== null && atteso === rt) ? "uguale" : "diverso", modello: `${lab} → ${ra ?? "— (vertice)"}`, tenant: `${c.t.etichetta} → ${rt ?? "—"}` });
    }
    for (const m of ruoli.soloModello) {
      for (const arr of [inq, sk, crt, der]) arr.push({ esito: "solo_modello", modello: m.etichetta, tenant: null });
    }
    push(conta("inquadramento", "Livello CCNL delle posizioni abbinate: il livello del modello fra i livelli dei titolari del tenant.", inq, 0, d));
    push(conta("skill", "Competenze richieste delle posizioni abbinate (indirizzo ESCO o nome): uguale con almeno 3 in comune, parziale con 1-2.", sk, 0, d));
    push(conta("criticita", "Criticità delle posizioni abbinate; solo nel modello se il tenant non l'ha valutata.", crt, 0, d));
    push(conta("derivati", "Riporto delle posizioni abbinate: la posizione a cui riporta nel tenant è quella abbinata al riporto del modello.", der, 0, d));
  }

  // obblighi e copertura: il tenant non ha una tabella degli obblighi; la copertura guarda le posizioni designate.
  {
    const obb: RigaDistanza[] = mObb.map((r) => ({ esito: "solo_modello" as const, modello: s(r["nome"]), tenant: null }));
    push(conta("obblighi", "Obblighi normativi del modello: advanced non ha una tabella degli obblighi del tenant.", obb, 0, d));
    const abbinate = new Set(ruoli.coppie.map((c) => c.m.rif ?? ""));
    const cop: RigaDistanza[] = mObb.map((r) => {
      const ps = (Array.isArray(r["posizioni"]) ? (r["posizioni"] as unknown as string[]) : []).filter(Boolean);
      const dentro = ps.filter((p) => abbinate.has(p)).length;
      return {
        esito: ps.length === 0 ? "solo_modello" : dentro === ps.length ? "uguale" : dentro > 0 ? "parziale" : "solo_modello",
        modello: s(r["nome"]), tenant: dentro > 0 ? `${dentro} posizioni su ${ps.length}` : null,
      } as RigaDistanza;
    });
    push(conta("copertura", "Per ogni obbligo, quante posizioni designate dal modello hanno una posizione abbinata nel tenant.", cop, 0, d));
  }

  push(perNome("obiettivi", "Obiettivi del modello contro modelli di obiettivo attivi del tenant.", mObi, tObi, {}, d).misura);
  const met = perNome("metriche", "Indicatori del modello contro indicatori usati dal tenant (requisiti o bersagli); ricchezza: formula, unità.",
    mMet, tMet, { ricchezza: ["formula", "unita"] }, d);
  push(met.misura);
  {
    const ber: RigaDistanza[] = [];
    const tb = new Map(tBer.map((r) => [s(r["nome"]) ?? "", r]));
    const pari = new Map(met.abb.coppie.map((c) => [c.m.etichetta, c.t.etichetta]));
    const usati = new Set<string>();
    for (const r of mMet) {
      const nome = s(r["nome"]) ?? "";
      const v = s(r["bersaglio"]);
      const t = pari.has(nome) ? tb.get(pari.get(nome)!) : undefined;
      if (t) {
        usati.add(s(t["nome"]) ?? "");
        const valori = (s(t["valori"]) ?? "").split(",").map((x) => Number(x));
        const ok = v !== null && valori.some((x) => Number.isFinite(x) && x === Number(v));
        ber.push({ esito: ok ? "uguale" : "parziale", modello: `${nome} (${v ?? "—"})`, tenant: `${s(t["nome"])} (${s(t["quanti"])} bersagli)` });
      } else if (v !== null) {
        ber.push({ esito: "solo_modello", modello: `${nome} (${v})`, tenant: null });
      }
    }
    for (const r of tBer) if (!usati.has(s(r["nome"]) ?? "")) ber.push({ esito: "solo_tenant", modello: null, tenant: s(r["nome"]) });
    push(conta("bersagli", "Valore obiettivo degli indicatori abbinati: uguale se uno dei bersagli del tenant ha il valore del modello.", ber, 0, d));
  }
  push(perNome("formazione", "Moduli formativi del modello contro moduli del tenant.", mFor, tFor, {}, d).misura);
  push(perNome("carriere", "Percorsi di carriera del modello contro quelli del tenant.", mCar, tCar, {}, d).misura);
  push(perNome("incentivi", "Incentivi del modello contro regole di ricompensa del tenant.", mInc, tInc, {}, d).misura);
  push(perNome("commesse", "Commesse del modello contro progetti del tenant.", mCom, tCom, {}, d).misura);
  push(perNome("condizioni", "Condizioni degli istituti del CCNL del modello contro le regole di maturazione del tenant (nome e descrizione).",
    mCond.map((r) => ({ nome: r["descrizione"] })), tMat.map((r) => ({ nome: `${s(r["nome"]) ?? ""} ${s(r["descrizione"]) ?? ""}`.trim() })), {}, d).misura);
  push(conta("ruoli_funzionali", "Ruoli di accesso assegnati nel tenant: il modello non porta ruoli funzionali (nessuna riga nei diritti di decisione).",
    tRuo.map((r) => ({ esito: "solo_tenant" as const, modello: null, tenant: `${s(r["nome"])} (${s(r["titolari"])})` })), 0, d));

  // utenti: ogni incarico attivo sta su una posizione abbinata o no; i posti previsti dal modello non occupati restano solo nel modello.
  {
    const righe: RigaDistanza[] = [];
    const esitoPos = new Map<string, { esito: Esito; m: string }>();
    for (const c of ruoli.coppie) esitoPos.set(c.t.rif ?? "", { esito: c.punteggio >= SOGLIA_NOME_UGUALE && normalizza(c.m.attributi?.["unita"]) === normalizza(c.t.attributi?.["unita"]) ? "uguale" : "parziale", m: c.m.rif ?? "" });
    for (const r of ripetuti) esitoPos.set(r.t.rif ?? "", { esito: "parziale", m: r.m.rif ?? "" });
    const occupati = new Map<string, number>();
    for (const r of tInc2) {
      const p = gruppoDi.get(s(r["posizione"]) ?? "") ?? "";
      const e = esitoPos.get(p);
      const titolo = s(rT.get(p)?.["titolo"]);
      if (e) {
        occupati.set(e.m, (occupati.get(e.m) ?? 0) + 1);
        righe.push({ esito: e.esito, modello: s(rM.get(e.m)?.["titolo"]), tenant: titolo });
      } else righe.push({ esito: "solo_tenant", modello: null, tenant: titolo });
    }
    for (const r of mPos) {
      const k = s(r["codice"]) ?? "";
      const posti = Math.max(1, Number(r["organico"] ?? 1) || 1);
      const liberi = Math.max(0, posti - (occupati.get(k) ?? 0));
      for (let i = 0; i < liberi; i++) righe.push({ esito: "solo_modello", modello: s(r["titolo"]), tenant: null });
    }
    push(conta("utenti", "Incarichi attivi delle persone sulle posizioni abbinate; i posti previsti dal modello e non occupati restano solo nel modello. Nessun dato di persona letto oltre all'incarico.", righe, 0, d));
  }

  const ordine = new Map(DOMINI_DISTANZA.map((x, i) => [x, i]));
  out.sort((a, b) => (ordine.get(a.dominio) ?? 0) - (ordine.get(b.dominio) ?? 0));
  const somma = (k: "righe" | "uguali" | "parziali" | "diversi" | "solo_modello" | "solo_tenant" | "ricchezza_persa") => out.reduce((n, x) => n + x[k], 0);
  return {
    tenantId,
    variantVersionId,
    misurataIl: (opts.adesso ?? new Date()).toISOString(),
    domini: out,
    totale: {
      righe: somma("righe"), uguali: somma("uguali"), parziali: somma("parziali"), diversi: somma("diversi"),
      solo_modello: somma("solo_modello"), solo_tenant: somma("solo_tenant"), ricchezza_persa: somma("ricchezza_persa"),
    },
  };
}
