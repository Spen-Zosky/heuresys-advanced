/**
 * apps/api/src/modules/tenant-materialization/blueprints.ts
 * #4 WI-C — deterministic archetype catalog. An archetype is a tenant-agnostic org
 * structure (org-units + positions) that the generator materializes into a target tenant.
 * Codes use the archetype's own namespace (e.g. RBR-*) so they never collide with a
 * tenant's pre-existing data — applying to a populated tenant only adds the archetype's
 * rows (ON CONFLICT skips the rest). 3 confirmed design facts (PLAN §9): the catalog is the
 * source of structure (no recommender), variants are thin headers, activation is a link row.
 * Slice-1 = org-units + positions; slice-2a adds one GENERATED_INCUMBENT placeholder incumbent per
 * position + a PRIMARY ACTIVE assignment (skills/ranked-KPI = slice-2b residuo).
 */

// I domini categorici vivono in `build-plan.ts` (#198 T4): sono i CHECK delle colonne, non
// una proprieta' di questo archetipo, e il modulo neutro non puo' dipendere da una sorgente.
import type { Criticality, KpiPolarity, OrgUnitType, SkillKind } from "./build-plan.js";

export interface ArchetypeOrgUnit {
  code: string;
  name: string;
  type: OrgUnitType;
  /** parent org-unit code (must appear earlier in the list — parents first). */
  parentCode: string | null;
}
export interface ArchetypePosition {
  code: string;
  title: string;
  orgUnitCode: string;
  criticality: Criticality;
  economicWeight: number;
}
export interface ArchetypeSkill {
  code: string;
  name: string;
  kind: SkillKind;
}
export interface ArchetypeKpi {
  code: string;
  name: string;
  polarity: KpiPolarity;
  unit: string;
}
/** sys_organization_unit_processes.org_unit_process_role — dominio del CHECK. */
export type ProcessRole = "OWNER" | "CONTRIBUTOR" | "CONSULTED" | "INFORMED";

/**
 * Chi presidia quale processo (#198 P3/T2).
 *
 * Senza questa dichiarazione, applicare un fascicolo non produce NULLA per lo
 * strato dei processi — cioe' meta' del fascicolo (spec P3 §11.1): il modello dice
 * quali processi l'azienda ha, e nessuno dice chi li tiene.
 *
 * `processCode` e' il codice del registro (`sys_blueprint_process_registry`), NON
 * un'invenzione: i 23 codici sono stati letti dal database, e il test
 * `tenant-materialization-processes` li ri-verifica li' a ogni corsa. Se qualcuno
 * cambia il registro, il test diventa rosso invece di lasciare l'archetipo a
 * puntare nel vuoto.
 */
export interface ArchetypeProcessOwnership {
  processCode: string;
  orgUnitCode: string;
  role: ProcessRole;
}
export interface Archetype {
  key: string;
  label: string;
  orgUnits: ArchetypeOrgUnit[];
  positions: ArchetypePosition[];
  skills: ArchetypeSkill[];
  kpis: ArchetypeKpi[];
  processOwnership: ArchetypeProcessOwnership[];
}

// RETAIL_BANK_REFERENCE — a compact, deterministic retail-bank skeleton: 1 HQ, 3 directorates,
// 3 branches; key leadership + per-branch manager/teller. Distilled from the RTL reference seed
// (db/scripts/seed-reference-bank.ts) but namespaced (RBR-) and slimmed for a generator slice.
const RETAIL_BANK_REFERENCE: Archetype = {
  key: "RETAIL_BANK_REFERENCE",
  label: "Retail Bank — reference org skeleton (HQ + directorates + 3 branches)",
  orgUnits: [
    { code: "RBR-HQ", name: "Headquarters", type: "HEADQUARTERS", parentCode: null },
    { code: "RBR-DIR-RETAIL", name: "Retail Banking Directorate", type: "DIVISION", parentCode: "RBR-HQ" },
    { code: "RBR-DIR-RISK", name: "Risk & Compliance Directorate", type: "DIVISION", parentCode: "RBR-HQ" },
    { code: "RBR-DIR-OPS", name: "Operations Directorate", type: "DIVISION", parentCode: "RBR-HQ" },
    { code: "RBR-BR-MILANO", name: "Milano Branch", type: "BRANCH", parentCode: "RBR-DIR-RETAIL" },
    { code: "RBR-BR-ROMA", name: "Roma Branch", type: "BRANCH", parentCode: "RBR-DIR-RETAIL" },
    { code: "RBR-BR-TORINO", name: "Torino Branch", type: "BRANCH", parentCode: "RBR-DIR-RETAIL" },
  ],
  positions: [
    { code: "RBR-CEO", title: "Chief Executive Officer", orgUnitCode: "RBR-HQ", criticality: "CRITICAL", economicWeight: 1.0 },
    { code: "RBR-CFO", title: "Chief Financial Officer", orgUnitCode: "RBR-HQ", criticality: "CRITICAL", economicWeight: 0.9 },
    { code: "RBR-DIR-RETAIL-HEAD", title: "Head of Retail Banking", orgUnitCode: "RBR-DIR-RETAIL", criticality: "HIGH", economicWeight: 0.7 },
    { code: "RBR-DIR-RISK-HEAD", title: "Head of Risk & Compliance", orgUnitCode: "RBR-DIR-RISK", criticality: "HIGH", economicWeight: 0.7 },
    { code: "RBR-DIR-OPS-HEAD", title: "Head of Operations", orgUnitCode: "RBR-DIR-OPS", criticality: "HIGH", economicWeight: 0.7 },
    { code: "RBR-BR-MILANO-MGR", title: "Branch Manager (Milano)", orgUnitCode: "RBR-BR-MILANO", criticality: "HIGH", economicWeight: 0.5 },
    { code: "RBR-BR-MILANO-TELLER", title: "Teller (Milano)", orgUnitCode: "RBR-BR-MILANO", criticality: "MEDIUM", economicWeight: 0.3 },
    { code: "RBR-BR-ROMA-MGR", title: "Branch Manager (Roma)", orgUnitCode: "RBR-BR-ROMA", criticality: "HIGH", economicWeight: 0.5 },
    { code: "RBR-BR-ROMA-TELLER", title: "Teller (Roma)", orgUnitCode: "RBR-BR-ROMA", criticality: "MEDIUM", economicWeight: 0.3 },
    { code: "RBR-BR-TORINO-MGR", title: "Branch Manager (Torino)", orgUnitCode: "RBR-BR-TORINO", criticality: "HIGH", economicWeight: 0.5 },
    { code: "RBR-BR-TORINO-TELLER", title: "Teller (Torino)", orgUnitCode: "RBR-BR-TORINO", criticality: "MEDIUM", economicWeight: 0.3 },
  ],
  // slice-2b: a compact synthetic skill set (kind from the ESCO domain) + ranked KPIs for the archetype.
  // Codes are RBR-namespaced (collision-safe). These materialize a tenant-scoped catalog + per-incumbent evidence.
  skills: [
    { code: "RBR-SK-CREDIT-RISK", name: "Credit Risk Analysis", kind: "KNOWLEDGE" },
    { code: "RBR-SK-AML", name: "AML & Compliance", kind: "KNOWLEDGE" },
    { code: "RBR-SK-ADVISORY", name: "Customer Advisory", kind: "SKILL" },
    { code: "RBR-SK-BRANCH-OPS", name: "Branch Operations", kind: "SKILL" },
    { code: "RBR-SK-FIN-REPORTING", name: "Financial Reporting", kind: "KNOWLEDGE" },
    { code: "RBR-SK-LEADERSHIP", name: "Leadership", kind: "COMPETENCE" },
    { code: "RBR-SK-DIGITAL", name: "Digital Banking", kind: "SKILL" },
    { code: "RBR-SK-CASH", name: "Cash Handling", kind: "SKILL" },
  ],
  kpis: [
    { code: "RBR-KPI-CSAT", name: "Customer Satisfaction", polarity: "HIGHER_IS_BETTER", unit: "score" },
    { code: "RBR-KPI-PORTFOLIO", name: "Loan Portfolio Quality", polarity: "HIGHER_IS_BETTER", unit: "%" },
    { code: "RBR-KPI-EFFICIENCY", name: "Operational Efficiency", polarity: "HIGHER_IS_BETTER", unit: "%" },
    { code: "RBR-KPI-SALES", name: "Sales Target Attainment", polarity: "HIGHER_IS_BETTER", unit: "%" },
  ],
  // P3/T2 — chi presidia quale processo. I 23 `processCode` sono quelli veri di
  // `sys_blueprint_process_registry` (letti dal database, non scritti a memoria), e
  // l'attribuzione ricalca come RTL Bank lo fa DAVVERO: 23 OWNER, uno per processo,
  // piu' i contributori dove il lavoro passa di li'.
  //
  // La traduzione non e' 1:1 perche' non puo' esserlo: RTL ha 43 unita' attive,
  // l'archetipo ne ha 7. Ogni processo va quindi alla direzione dell'archetipo che
  // copre la funzione della sua proprietaria in RTL — Antiriciclaggio e Compliance
  // confluiscono in RISK, Back Office e Pagamenti in OPS, Finanza e HR restano in
  // HQ perche' l'archetipo non ha una direzione per loro. Dove non c'e' un
  // corrispondente si sale, mai si inventa un'unita'.
  //
  // Le tre filiali NON possiedono processi (in RTL nemmeno): contribuiscono a
  // quelli che passano dallo sportello.
  processOwnership: [
    { processCode: "00", orgUnitCode: "RBR-HQ", role: "OWNER" },            // Strategia e governance
    { processCode: "01", orgUnitCode: "RBR-DIR-RETAIL", role: "OWNER" },    // Acquisizione e onboarding clienti
    { processCode: "02", orgUnitCode: "RBR-DIR-RISK", role: "OWNER" },      // KYC / AML
    { processCode: "03", orgUnitCode: "RBR-DIR-OPS", role: "OWNER" },       // Apertura e gestione conti
    { processCode: "04", orgUnitCode: "RBR-DIR-OPS", role: "OWNER" },       // Pagamenti e bonifici
    { processCode: "05", orgUnitCode: "RBR-DIR-RETAIL", role: "OWNER" },    // Erogazione del credito
    { processCode: "06", orgUnitCode: "RBR-DIR-RISK", role: "OWNER" },      // Monitoraggio e recupero crediti
    { processCode: "07", orgUnitCode: "RBR-DIR-RETAIL", role: "OWNER" },    // Consulenza patrimoniale
    { processCode: "08", orgUnitCode: "RBR-DIR-RETAIL", role: "OWNER" },    // Investimenti retail
    { processCode: "09", orgUnitCode: "RBR-HQ", role: "OWNER" },            // Tesoreria e ALM
    { processCode: "10", orgUnitCode: "RBR-DIR-RISK", role: "OWNER" },      // Gestione del rischio
    { processCode: "11", orgUnitCode: "RBR-DIR-RISK", role: "OWNER" },      // Compliance e reportistica
    { processCode: "12", orgUnitCode: "RBR-HQ", role: "OWNER" },            // Audit interno
    { processCode: "13", orgUnitCode: "RBR-DIR-OPS", role: "OWNER" },       // Operativita' di filiale
    { processCode: "14", orgUnitCode: "RBR-DIR-RETAIL", role: "OWNER" },    // Servizio clienti
    { processCode: "15", orgUnitCode: "RBR-HQ", role: "OWNER" },            // Marketing e comunicazione
    { processCode: "16", orgUnitCode: "RBR-DIR-OPS", role: "OWNER" },       // IT e cybersecurity
    { processCode: "17", orgUnitCode: "RBR-HQ", role: "OWNER" },            // Gestione del capitale umano
    { processCode: "18", orgUnitCode: "RBR-HQ", role: "OWNER" },            // Finanza e contabilita'
    { processCode: "19", orgUnitCode: "RBR-DIR-OPS", role: "OWNER" },       // Approvvigionamenti e fornitori
    { processCode: "20", orgUnitCode: "RBR-DIR-OPS", role: "OWNER" },       // Facility e immobili
    { processCode: "21", orgUnitCode: "RBR-DIR-RISK", role: "OWNER" },      // Legale
    { processCode: "22", orgUnitCode: "RBR-DIR-OPS", role: "OWNER" },       // Dati e analytics

    // I contributori: dove il processo si esegue davvero, oltre a dove si governa.
    { processCode: "01", orgUnitCode: "RBR-BR-MILANO", role: "CONTRIBUTOR" },
    { processCode: "01", orgUnitCode: "RBR-BR-ROMA", role: "CONTRIBUTOR" },
    { processCode: "01", orgUnitCode: "RBR-BR-TORINO", role: "CONTRIBUTOR" },
    { processCode: "03", orgUnitCode: "RBR-BR-MILANO", role: "CONTRIBUTOR" },
    { processCode: "03", orgUnitCode: "RBR-BR-ROMA", role: "CONTRIBUTOR" },
    { processCode: "03", orgUnitCode: "RBR-BR-TORINO", role: "CONTRIBUTOR" },
    { processCode: "04", orgUnitCode: "RBR-BR-MILANO", role: "CONTRIBUTOR" },
    { processCode: "04", orgUnitCode: "RBR-BR-ROMA", role: "CONTRIBUTOR" },
    { processCode: "04", orgUnitCode: "RBR-BR-TORINO", role: "CONTRIBUTOR" },
    { processCode: "13", orgUnitCode: "RBR-BR-MILANO", role: "CONTRIBUTOR" },
    { processCode: "13", orgUnitCode: "RBR-BR-ROMA", role: "CONTRIBUTOR" },
    { processCode: "13", orgUnitCode: "RBR-BR-TORINO", role: "CONTRIBUTOR" },
    { processCode: "14", orgUnitCode: "RBR-BR-MILANO", role: "CONTRIBUTOR" },
    { processCode: "14", orgUnitCode: "RBR-BR-ROMA", role: "CONTRIBUTOR" },
    { processCode: "14", orgUnitCode: "RBR-BR-TORINO", role: "CONTRIBUTOR" },
    // Il credito si eroga in filiale ma lo governa la direzione; il rischio e' consultato.
    { processCode: "05", orgUnitCode: "RBR-BR-MILANO", role: "CONTRIBUTOR" },
    { processCode: "05", orgUnitCode: "RBR-DIR-RISK", role: "CONSULTED" },
    { processCode: "02", orgUnitCode: "RBR-BR-MILANO", role: "CONTRIBUTOR" },
    { processCode: "10", orgUnitCode: "RBR-HQ", role: "INFORMED" },
    { processCode: "11", orgUnitCode: "RBR-HQ", role: "INFORMED" },
    { processCode: "12", orgUnitCode: "RBR-DIR-RISK", role: "CONSULTED" },
  ],
};

const ARCHETYPES: Record<string, Archetype> = {
  [RETAIL_BANK_REFERENCE.key]: RETAIL_BANK_REFERENCE,
};

export function getArchetype(key: string): Archetype | null {
  return ARCHETYPES[key] ?? null;
}
export function listArchetypes(): Archetype[] {
  return Object.values(ARCHETYPES);
}

/* --- slice-2a: incumbent segnaposto ----------------------------------------- */
// E17 (#198 P3/T3) — i segnaposto PARLANO: dicono il posto che occupano, non un
// nome di fantasia.
//
// Le due liste di nomi propri italiani che stavano qui (SYN_FIRST/SYN_LAST) sono
// state RIMOSSE. Producevano «Marco Rossi», «Giulia Bianchi»: identita' che in un
// elenco di persone non si distinguono da quelle vere, e che nessun filtro riesce a
// separare a occhio. Il nome era anche l'unica cosa che quelle righe NON potevano
// dire di utile, visto che l'informazione vera — quale casella e' scoperta — c'era
// gia' e veniva buttata.
//
// Adesso: nome = il ruolo (dal titolo della posizione), cognome = l'unita' che la
// contiene. «Teller (Milano)» diventa `Teller · Milano Branch`. Restano invariati
// `user_type = 'GENERATED_INCUMBENT'`, `user_external_code = 'SYN_' || codice`, e
// l'email sul dominio `.synthetic.example`.

export interface ArchetypeUser {
  externalCode: string; // SYN_<positionCode> — NEVER LEGACY_EMP:: (the brownfield real-person key, I14/ADR-0024)
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  positionCode: string; // the position this synthetic user is the PRIMARY ACTIVE incumbent of
}

/** One GENERATED_INCUMBENT placeholder incumbent per archetype position (slice-2a). Deterministic:
 *  name from the fixed pools by position index; email keyed on the unique position code (→ unique
 *  per tenant via sys_users_tenant_email_uq); a clearly-synthetic reserved .example domain. */
/**
 * Il ruolo, ripulito dalla qualificazione di sede: «Teller (Milano)» → «Teller».
 * La sede la dice gia' il cognome, che e' l'unita': ripeterla darebbe
 * «Teller (Milano) · Milano Branch».
 */
function ruoloDa(titolo: string): string {
  return titolo.replace(/\s*\([^)]*\)\s*$/, "").trim() || titolo.trim();
}

/**
 * I segnaposto di un archetipo, uno per posizione (E17 + E23).
 *
 * **La disambiguazione e' il percorso NORMALE, non un ramo raro.** E23 dice che la
 * numerosita' si esprime moltiplicando le posizioni: una filiale con tre casse ha
 * tre posizioni di cassiere, quindi tre segnaposto che produrrebbero la stessa
 * coppia ruolo+unita'. E' come RTL e' fatto davvero (158 persone · 158 posizioni ·
 * 158 occupate, uno a uno).
 *
 * Quando la coppia si ripete, l'ordinale va su **TUTTI** i gemelli, mai solo dal
 * secondo in poi: «Teller · Milano Branch» accanto a «Teller 2 · Milano Branch»
 * suggerirebbe che il primo sia piu' importante, e non lo e'. O sono tutti
 * numerati, o nessuno.
 */
export function archetypeUsers(a: Archetype): ArchetypeUser[] {
  const slug = a.key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const nomeUnita = new Map(a.orgUnits.map((u) => [u.code, u.name]));

  // Prima passata: quante posizioni producono la stessa coppia ruolo+unita'?
  const quante = new Map<string, number>();
  for (const p of a.positions) {
    const k = `${ruoloDa(p.title)}·${p.orgUnitCode}`;
    quante.set(k, (quante.get(k) ?? 0) + 1);
  }

  const progressivo = new Map<string, number>();
  return a.positions.map((p) => {
    const ruolo = ruoloDa(p.title);
    const unita = nomeUnita.get(p.orgUnitCode) ?? p.orgUnitCode;
    const k = `${ruolo}·${p.orgUnitCode}`;
    const n = (progressivo.get(k) ?? 0) + 1;
    progressivo.set(k, n);
    // Se i gemelli sono piu' di uno, l'ordinale lo portano tutti — anche il primo.
    const firstName = (quante.get(k) ?? 1) > 1 ? `${ruolo} ${n}` : ruolo;
    return {
      externalCode: `SYN_${p.code}`,
      email: `syn.${p.code.toLowerCase()}@${slug}.synthetic.example`,
      firstName,
      lastName: unita,
      displayName: `${firstName} · ${unita}`,
      positionCode: p.code,
    };
  });
}

/* --- slice-2b: deterministic synthetic skill/KPI evidence (no PII) --------- */
const PROFICIENCY_SCALE = ["NOVICE", "BASIC", "COMPETENT", "PROFICIENT", "EXPERT", "MASTER"] as const;
/** Deterministic declared-proficiency for incumbent #userIdx on archetype skill #skillIdx (cycles the scale). */
export function synProficiency(userIdx: number, skillIdx: number): string {
  return PROFICIENCY_SCALE[(userIdx + skillIdx) % PROFICIENCY_SCALE.length]!;
}
/** Deterministic KPI measured value (60..99) — gives a stable cross-incumbent ranking per KPI. */
export function synKpiValue(userIdx: number, kpiIdx: number): number {
  return 60 + ((userIdx * 7 + kpiIdx * 13) % 40);
}
