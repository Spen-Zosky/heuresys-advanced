/**
 * apps/api/src/lib/scope/data-classes.ts — F2 of the two-axis authorization model (ADR-0027).
 *
 * The DATA-CLASS taxonomy: every resource that carries person-level data is tagged with exactly
 * one class, and the class selects which axis gates it (ADR-0027 §2.4):
 *   PERSONAL / COMPENSATION / SKILL / EVALUATION  → SENSITIVE → ORGANIZATIONAL axis (reports-to)
 *   ACTIVITY                                       → FUNCTIONAL axis (team/process membership)
 *
 * F2 classifies AND (since D-51) prescribes: `lib/scope/gate.ts` refuses to boot the app if a
 * read route on a resource classified sensitive here lacks a `config.orgGate` declaration, so a
 * new sensitive module can no longer omit the org gate silently. F3 enforces at the data level
 * (a manager may read a report's COMPENSATION only if the report is in their org sub-tree). A
 * resource NOT in the map carries no person-level sensitive data and stays RBAC+tenant-gated
 * (blueprints, processes, tenants, roles, org structure, …).
 *
 * Keys are the RBAC `auth_permission_resource` values (verified to exist — see the drift test).
 */

/**
 * The closed set of data classes — le **sette** di M1 (ADR-0036 §7), non più cinque.
 *
 * ⚠ I NOMI. Il documento dei domini le chiama `IDENTITY`, `CONTRACT_PAY`, `COMPETENCE`,
 * `EVALUATION`, `ACTIVITY`, `CREDENTIAL`, `SPECIAL_CATEGORY`. Qui restano i nomi di questo
 * file, ed è una scelta: le prime cinque sono già usate da 18 moduli, da `mask.ts` e dal
 * cancello di boot `gate.ts`. Rinominarle sarebbe un refactor cosmetico su codice di
 * sicurezza — costo alto, beneficio nominale. L'equivalenza è dichiarata **qui e solo qui**:
 *
 *   IDENTITY → PERSONAL · CONTRACT_PAY → COMPENSATION · COMPETENCE → SKILL
 *   EVALUATION · ACTIVITY · CREDENTIAL · SPECIAL_CATEGORY (invariate)
 *
 * Le ultime due sono arrivate con **#99 F7**: esistevano in M1 e non nel codice, quindi due
 * righe della matrice non erano rappresentabili — `platform_mandate` non poteva dichiarare il
 * suo `edit` sulle credenziali, e `SPECIAL_CATEGORY` non poteva essere la classe *vuota e
 * presidiata* che ADR-0036 §5 pretende, perché non esisteva affatto.
 */
export type DataClass =
  | "PERSONAL"
  | "COMPENSATION"
  | "SKILL"
  | "EVALUATION"
  | "ACTIVITY"
  | "CREDENTIAL"
  | "SPECIAL_CATEGORY";

/**
 * Classes gated by the ORGANIZATIONAL axis (sensitive personal data — I18/I20).
 *
 * ⚠ `CREDENTIAL` e `SPECIAL_CATEGORY` **non entrano qui**, e non è una svista:
 *  - le credenziali non si leggono per catena gerarchica — un capo non amministra le password
 *    dei suoi riporti (M1: `line_management`/CREDENTIAL = `none`). Le governa il mandato
 *    tecnico e il `self`, cioè M1, non l'asse organizzativo;
 *  - `SPECIAL_CATEGORY` è `none` per **ogni** dominio tranne `self` (ADR-0036 §5): una classe
 *    che nessun perimetro apre non ha bisogno di un perimetro che la filtri.
 * Conseguenza pratica: aggiungerle non cambia una riga del comportamento di `gate.ts`.
 */
export const SENSITIVE_DATA_CLASSES: ReadonlySet<DataClass> = new Set<DataClass>([
  "PERSONAL",
  "COMPENSATION",
  "SKILL",
  "EVALUATION",
]);

/**
 * resource (auth_permission_resource) → data class. Only person-level resources appear here.
 *
 * Classification (Enzo's four sensitive categories):
 *  - PERSONAL     personal identity / contacts / documents / career aspirations
 *  - COMPENSATION pay, variable pay, comp recommendations
 *  - SKILL        competency evidence + gaps
 *  - EVALUATION   assessments, performance KPIs/goals/OKRs, succession & talent predictions
 *  - ACTIVITY     team/process work items — gated by the FUNCTIONAL axis (F4)
 *
 * Borderline resources resolved by Enzo (2026-07-01): `learning` + `training_initiative`
 * (formazione), `matching` + `capability` (matching/capacità, derived from competencies) → SKILL;
 * `mentorship` → PERSONAL — all RISERVATI. `engagement_feedback` + `surveys` (feedback/clima) stay
 * UNMAPPED → NORMAL (Enzo: often anonymous/aggregated by policy, not org-gated).
 */
/**
 * Le resource che espongono PIÙ classi, e le cui pagine le dichiarano una per una (#99 F8, S1064).
 *
 * `RESOURCE_DATA_CLASS` associa **una** classe a una resource, e per la maggior parte basta.
 * Non basta quando la stessa resource regge pagine con contenuti diversi: le cinque
 * `analytics-*` condividono `analytics` ed espongono quattro classi diverse — è il caso che
 * la mig. `000315` cita come ragione per cui la classe **non si deriva dal permesso**.
 * Per queste l'obbligo non è «dichiara QUELLA classe» ma «dichiarane almeno una»: la scelta
 * sta sulla voce, dove il contenuto è noto.
 */
export const RESOURCE_MULTICLASSE: Readonly<Record<string, string>> = {
  analytics: "cinque pagine, quattro classi diverse (organico, presenze, competenze, retribuzioni, KPI)",
  dashboard: "il cruscotto aggrega organico, formazione e attività: tre classi in una pagina",
  process_owner: "la console dei processi mostra lavoro, non persone — ma lo dichiara lei",
};

/**
 * Le resource che NON espongono dati di persona, ognuna con la sua ragione (#99 F8, S1064).
 *
 * PERCHÉ ESISTE, ed è un buco misurato e non teorico. Il cancello di F7 saltava in silenzio
 * ogni resource assente da `RESOURCE_DATA_CLASS` (`if (attesa === undefined) continue`). Il
 * 2026-08-16 le resource di voci attive erano **32** e quelle non classificate **19**: il
 * cancello non guardava il **60%** della superficie, e nessuno poteva accorgersene. Una voce
 * nuova non «rischiava» di sfuggire — sfuggiva la maggioranza di quelle esistenti.
 *
 * Ora ogni resource deve stare in uno dei tre elenchi, o il cancello è rosso. Una riga qui è
 * un'AFFERMAZIONE («questa pagina non mostra persone»), non un'esenzione: se un domani quella
 * pagina cominciasse a mostrarle, la riga diventerebbe una bugia scritta col proprio nome.
 */
export const RESOURCE_SENZA_DATI_DI_PERSONA: Readonly<Record<string, string>> = {
  blueprint: "modelli organizzativi: struttura, non persone",
  tenant_blueprint: "il fascicolo di configurazione di un tenant",
  bpm_process: "definizioni di processo",
  job_role: "catalogo delle mansioni — la mansione è un posto, non chi lo occupa",
  role: "ruoli RBAC: il permesso, non il titolare",
  mfa_policy: "una politica di tenant è configurazione (misurato in 000315: dichiararla CREDENTIAL toglieva la pagina ai due TENANT_ADMIN reali)",
  tenant: "configurazione del tenant e salute di sistema",
  seed_acquisition: "corse tecniche di acquisizione",
  provenance: "tracciabilità dei dati: da dove vengono, non di chi sono",
  content: "contenuti editoriali",
  visualization: "grafici salvati",
  leads: "contatti commerciali esterni: non sono la forza lavoro del tenant, e la tassonomia delle classi descrive i dati DEI DIPENDENTI",
  surveys: "risolta da Enzo (2026-07-01): feedback e clima restano NON mappati perché spesso anonimi o aggregati per politica, quindi non org-gated",
  position: "una posizione è un POSTO nell'organigramma; chi lo occupa si legge da `user`, che è PERSONAL",
  org_director: "console, salute e consigliere organizzativi: aggregati di struttura",
};

/**
 * Le resource su cui la decisione è APERTA, ognuna legata alla voce che la deciderà.
 *
 * Non è un terzo modo per tacere: una resource qui è **dichiarata dubbia**, e il dubbio ha un
 * numero. Il cancello la lascia passare *e la nomina*, così non sparisce dalla vista come
 * faceva prima. Se questo elenco si riempisse, sarebbe il segnale che si sta rimandando invece
 * di decidere — ed è visibile proprio perché è scritto.
 */
export const RESOURCE_DA_DECIDERE: Readonly<Record<string, string>> = {
  organization_unit:
    "#193 — l'organigramma mostra nomi e collocazione, quindi PERSONAL; ma dichiararlo lo toglierebbe " +
    "a 117 utenti su 161 (misurato 2026-08-16). È una decisione di prodotto di Enzo, non una bonifica.",
};

export const RESOURCE_DATA_CLASS: Readonly<Record<string, DataClass>> = {
  // PERSONAL
  user: "PERSONAL",
  user_profile: "PERSONAL",
  document: "PERSONAL",
  certification: "PERSONAL",
  career: "PERSONAL",
  mentorship: "PERSONAL", // Enzo 2026-07-01: riservato (personal development relationship)
  leave: "PERSONAL", // A/L8 (#33): time-off requests + balance ledger — person-level, org-gated
  // COMPENSATION
  compensation_intelligence: "COMPENSATION",
  // SKILL (competency + development + competency-derived)
  skill: "SKILL",
  gap_analysis: "SKILL",
  learning: "SKILL", // Enzo 2026-07-01: formazione riservata
  training_initiative: "SKILL", // Enzo 2026-07-01: formazione riservata
  matching: "SKILL", // Enzo 2026-07-01: matching riservato (derived from competencies)
  capability: "SKILL", // Enzo 2026-07-01: capacità riservate (derived from competencies)
  // EVALUATION
  assessment: "EVALUATION",
  // #99 F7 — buco reale del cancello D-51, trovato misurando le voci di menu. Le 7 rotte
  // read di `performance-review` (performance-reviews, review-cycles, calibration-sessions)
  // dichiaravano GIA' `orgGate`, ma per diligenza di chi scrisse #92: la resource non era
  // classificata, quindi `gate.ts` non la pretendeva e toglierla non avrebbe rotto nulla.
  // Classificandola, cio' che era volontario diventa obbligatorio — a costo zero, perche'
  // nessuna rotta va in violazione (misurato prima di aggiungerla).
  "performance-review": "EVALUATION",
  kpi: "EVALUATION",
  goal: "EVALUATION",
  okr: "EVALUATION",
  career_succession: "EVALUATION",
  predictions: "EVALUATION",
  insights: "EVALUATION",
  evidence: "EVALUATION", // #27 (S1018): the explainability layer over EVALUATION/SKILL evidence
  talent: "EVALUATION", // A/L3 (#29): 9-box / fit / readiness / succession — person-level talent intelligence
  // ACTIVITY — F4 (#24), Enzo 2026-07-19. WORK, not the person: what someone is doing,
  // which a team/process leader coordinates. Deliberately NOT extended to goal/okr/kpi:
  // those stay EVALUATION (Enzo 2026-07-01) because they measure the PERSON, and moving
  // them here would let a leader read the records of the 34 RTL users who sit in their
  // functional scope but outside their org sub-tree — reopening D-50 from the other side
  // and breaking the cardinal rule (I18).
  approval: "ACTIVITY", // approval requests/steps: work assigned to and raised by people
  team: "ACTIVITY", // team membership: who works with whom
  // #99 F7 — una segnalazione e' un CASO DA ISTRUIRE, cioe' lavoro, non un dato della
  // persona. La classe non e' quello che la protegge: la proteggono il permesso, che un
  // ruolo solo detiene, e l'isolamento assoluto di ADR-0036 §5. Classificarla PERSONAL
  // sarebbe stato peggio che non classificarla — avrebbe suggerito che la catena
  // organizzativa possa arrivarci, che e' esattamente cio' che l'isolamento vieta.
  whistleblowing: "ACTIVITY",
  // ⚠ `mfa_policy` NON compare qui, ed e' stato misurato prima di deciderlo. Classificarlo
  // `CREDENTIAL` toglieva la pagina della politica MFA ai due `TENANT_ADMIN` reali — fra cui
  // il CEO di RTL — perche' M1 da' `hr_mandate`/CREDENTIAL = `none`. Ma quella cella dice
  // «HR non amministra le password delle persone», non «il tenant admin non configura la
  // sicurezza del proprio tenant»: una POLITICA e' configurazione dell'organizzazione, non un
  // dato di persona, e questa mappa contiene solo resource person-level (vedi l'intestazione).
  // Resta quindi senza classe, governata dal solo RBAC come `tenant` e `system-health`.
  // La classe `CREDENTIAL` esiste in M1 per le credenziali VERE, che vivono in `/me/security`
  // (self, I17) e nelle rotte auth — nessuna delle quali e' una resource person-level.
  // NB: `bpm_process` / `organization_unit_processes` stay UNMAPPED on purpose — they are
  // structural catalogues (process templates, OU↔process RACI), not person-level data.
  // The PERSON-level process axis lives in sys_process_participants (mig 000179), which
  // feeds functionalScopeUserIds directly.
};

/** The data class of a resource, or null when the resource carries no person-level data. */
export function dataClassOf(resource: string): DataClass | null {
  return RESOURCE_DATA_CLASS[resource] ?? null;
}

/** True iff the class is gated by the organizational axis (sensitive personal data). */
export function isSensitiveClass(dataClass: DataClass): boolean {
  return SENSITIVE_DATA_CLASSES.has(dataClass);
}

/** True iff the resource carries SENSITIVE person-level data (→ organizational axis at F3). */
export function isSensitiveResource(resource: string): boolean {
  const c = dataClassOf(resource);
  return c !== null && isSensitiveClass(c);
}
