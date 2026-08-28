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
export interface ResourceMulticlasse {
  /** Le classi che questa resource espone, ENUMERATE — misurate, non descritte. */
  readonly classi: readonly DataClass[];
  /** Perché una sola classe non basta a rappresentarla. */
  readonly perche: string;
}

/**
 * ⚠ ERANO PROSA, E LA PROSA NON SI PUÒ INTERROGARE (#214 F5, 2026-08-19).
 *
 * Fino a oggi il valore era una frase: «cinque pagine, quattro classi diverse (organico,
 * presenze, competenze, retribuzioni, KPI)». Leggibile da un umano, muta per uno strumento —
 * e `check_concetti_agente.py` doveva dichiarare `analytics` e `dashboard` **NON MISURABILI**
 * proprio per questo, cioè lasciare fuori dalla coda ordinabile le due resource più ampie.
 *
 * Le classi qui sotto sono state MISURATE sul database il 2026-08-19, non trascritte dalla
 * frase — e la misura ha già smentito la frase su un punto: la prosa di `analytics` nominava
 * le «presenze», ma nessuna delle sue cinque voci dichiara `ACTIVITY`. Una descrizione che
 * nessuno può contraddire invecchia senza che nessuno se ne accorga.
 *
 *   SELECT i.ui_interface_required_resource, string_agg(DISTINCT dc.data_class, ',')
 *     FROM sys.sys_ui_interfaces i
 *     LEFT JOIN sys.sys_ui_interface_data_classes dc ON dc.ui_interface_id = i.ui_interface_id
 *    WHERE i.ui_interface_is_active GROUP BY 1;
 *
 * Le sette resource `dashboard_*` sono le famiglie di cruscotto di `#142` (mig. `000326`):
 * ognuna eredita dalle proprie viste l'unione delle classi, e senza una riga qui il cancello
 * «NESSUNA resource passa in silenzio» le nominerebbe — correttamente.
 */
export const RESOURCE_MULTICLASSE: Readonly<Record<string, ResourceMulticlasse>> = {
  analytics: {
    classi: ["COMPENSATION", "EVALUATION", "PERSONAL", "SKILL"],
    perche: "cinque pagine sotto una sola resource, ognuna con il proprio contenuto",
  },
  dashboard: {
    classi: ["ACTIVITY", "PERSONAL", "SKILL"],
    perche: "il cruscotto aggrega organico, formazione e attività in una pagina",
  },
  process_owner: {
    classi: ["ACTIVITY"],
    perche: "la console dei processi mostra lavoro, non persone — ma lo dichiara lei",
  },
  // #142 — le otto famiglie. `self` non compare: la sua route è `/me`, che ha già la
  // propria voce e la propria classificazione.
  dashboard_company: {
    classi: ["EVALUATION", "PERSONAL", "SKILL"],
    perche: "quattro viste d'azienda: organico, andamento, competenze, valutazioni",
  },
  dashboard_process: {
    classi: ["ACTIVITY"],
    perche: "processi, attività e approvazioni: lavoro, non persone",
  },
  dashboard_org: {
    classi: ["PERSONAL"],
    perche: "struttura, posizioni scoperte e catena di riporto",
  },
  dashboard_branch: {
    classi: ["ACTIVITY", "PERSONAL", "SKILL"],
    perche: "l'azienda vista da una filiale: organico, attività, competenze",
  },
  dashboard_hr: {
    classi: ["COMPENSATION", "EVALUATION", "PERSONAL", "SKILL"],
    perche: "cinque viste HR, e la retribuzione è una di esse (ADR-0032 la maschera al mandato tecnico)",
  },
  dashboard_platform: {
    classi: ["ACTIVITY", "CREDENTIAL"],
    perche: "salute del sistema, credenziali e corse pianificate",
  },
  dashboard_tenant: {
    classi: ["PERSONAL"],
    perche: "configurazione del tenant, blueprint adottati e utenti",
  },
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
  // ⛔ `surveys` ERA QUI, ed è stata tolta il 2026-08-28 (S1083, #214 F6). La riga diceva:
  // «risolta da Enzo (2026-07-01): feedback e clima restano NON mappati perché spesso anonimi
  // o aggregati per politica, quindi non org-gated». Era una dichiarazione di POLITICA, e i
  // dati la smentiscono senza margine — misurati, non supposti:
  //     sys_survey_assignments          948 righe · 948 con `survey_assignment_user_id`
  //     sys_engagement_survey_responses 862 righe · 862 con `response_subject_user_id`
  // Nessuna risposta anonima. Non una. Il commento di questo elenco dice che una riga qui è
  // un'AFFERMAZIONE e che «se un domani quella pagina cominciasse a mostrarle, la riga
  // diventerebbe una bugia scritta col proprio nome»: qui non è diventata una bugia col
  // tempo, lo era già quando è stata scritta, perché nessuno aveva guardato i dati.
  // `surveys` ed `engagement` stanno ora in `RESOURCE_DATA_CLASS` come `PERSONAL`.
  //
  // ⭐ MA LA STESSA MISURA HA CONFERMATO L'ALTRA META DELLA FRASE DEL 2026-07-01, e la
  // distinzione è fine abbastanza da meritare di essere scritta: `sys_engagement_feedback`
  // **non ha un autore**. Le sue colonne sono `feedback_natural_key`, `feedback_category`,
  // `feedback_message`, `feedback_status`, `feedback_reviewed_by_user_id` — e nessuna
  // identifica chi lo ha scritto. È anonimo **per costruzione**, non per politica. La sola
  // FK verso una persona è quella del REVISORE, cioè esattamente la specie di colonna che la
  // guardia GDPR della `000304` esclude per regex.
  // Quindi la frase di Enzo era **giusta per il feedback e sbagliata per i sondaggi**: le due
  // cose erano state trattate insieme, e solo una delle due reggeva. Qui non si corregge una
  // dichiarazione sbagliata — si trasforma un silenzio in un'affermazione misurata.
  engagement_feedback:
    "segnalazioni di clima ANONIME PER COSTRUZIONE (misurato 2026-08-28, #214 F6): " +
    "`sys_engagement_feedback` non ha alcuna colonna che identifichi l'autore — solo " +
    "`feedback_reviewed_by_user_id`, che è chi la esamina. Da non confondere con " +
    "`sys_engagement_survey_responses`, dove 862 risposte su 862 portano l'identità di chi " +
    "ha risposto: quelle sono `engagement`, ed è PERSONAL",
  position: "una posizione è un POSTO nell'organigramma; chi lo occupa si legge da `user`, che è PERSONAL",
  org_director: "console, salute e consigliere organizzativi: aggregati di struttura",
  // #214 F4, S1078 — le tre resource che tenevano CINQUE moduli fra i NON MISURABILI.
  // La classe non è stimata: è misurata sul database, e la misura ha corretto due volte
  // ciò che il nome suggeriva.
  enterprise_typing:
    "tipizzazione d'impresa: bande dimensionali e profili di settore. Le colonne che " +
    "nominano i dipendenti (`enterprise_size_band_min/max_employees`, " +
    "`enterprise_typing_employee_count`) sono SOGLIE e CONTEGGI, non riferimenti a " +
    "persone — misurato: le sole chiavi esterne verso `sys_users` sono `created_by` e " +
    "`updated_by`, cioè gli attori di audit, che se contassero renderebbero «dati di " +
    "persona» qualunque tabella del database",
  operating_model:
    "catalogo dei modelli operativi: 7 colonne, nessuna chiave esterna verso le persone",
  organization_unit_processes:
    "quale processo presidia quale unità: struttura, non persone. Il modulo LEGGE anche " +
    "`sys_organization_units` — che è PERSONAL perché porta il capo dell'unità " +
    "(`organization_unit_manager_user_id`) — ma non lo ESPONE: lo schema di risposta " +
    "(`OrgUnitProcessForOuSchema`) porta identificatori e nome/codice/ordinale del " +
    "processo, e nessun campo di persona. Leggere una tabella non è mostrarla",
};

/**
 * I moduli le cui LETTURE non passano da un permesso, perché sono cataloghi globali
 * (#214 F4, S1078). Ognuno con la misura che lo sostiene, mai un jolly.
 *
 * PERCHÉ SERVE UN QUARTO ELENCO, ed è una domanda giusta da farsi. Gli altri tre sono
 * indicizzati per RESOURCE, e la resource si ricava dal permesso (`resource:action`). Per
 * questi sei moduli il ponte si spezza a monte: le loro GET non dichiarano alcun permesso,
 * quindi non c'è resource da cui risalire, e restavano NON MISURABILI qualunque cosa si
 * scrivesse negli altri elenchi.
 *
 * NON È UN QUARTO MODO PER TACERE — ed è la ragione per cui porta con sé le due misure che
 * lo rendono smentibile:
 *   · MISURATO il 2026-08-23: nessuna di queste tabelle ha una chiave esterna verso
 *     `sys_users` che non sia `created_by`/`updated_by`, e nessuna (tranne `sys_skills`)
 *     ha una colonna di tenant: sono cataloghi GLOBALI, non dati di un'azienda.
 *   · MISURATO sul server, non dedotto: `GET /v1/<modulo>` senza credenziali risponde
 *     401 su tutti e sei. L'autenticazione c'è; manca l'autorizzazione FINE, ed è una
 *     assenza coerente con I21 (le tassonomie stanno aperte a ogni industry) e con I17
 *     (il pavimento ESS: chi compila il proprio profilo deve poter leggere le categorie
 *     e i livelli di padronanza).
 *
 * ⚠ SE UN MODULO DI QUESTO ELENCO ACQUISISCE UN PERMESSO DI LETTURA, la sua riga qui
 * diventa inutile e va tolta: `check_concetti_agente.py` lo dice, invece di lasciarla
 * a giustificare un ponte che nel frattempo si è ricostruito da sé.
 *
 * ⚠ NON è la sede per decidere se quei permessi vadano creati: lo sono i permessi di
 * scrittura (`skill_taxonomy:create/update/delete`, `job_family:create/update/delete`
 * esistono), mentre `skill_taxonomy:read` e `job_family:read` NON esistono — misurato in
 * `sys.sys_auth_permissions`. Crearli e assegnarli a tutti i ruoli sarebbe cerimonia, non
 * sicurezza: un permesso che nessuno può non avere non discrimina niente.
 */
export const MODULO_CATALOGO_GLOBALE: Readonly<Record<string, string>> = {
  "skill-categories": "categorie del catalogo competenze (tassonomia)",
  "skill-families": "famiglie del catalogo competenze (tassonomia)",
  "skill-aliases": "sinonimi delle competenze (tassonomia)",
  "skill-taxonomy-edges": "archi fra i nodi della tassonomia delle competenze",
  "skill-proficiency-levels": "livelli di padronanza: la scala, non chi la raggiunge",
  "job-families": "famiglie professionali (tassonomia)",
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
  // VUOTO, e va letto come un esito: `organization_unit` era l'unica riga, ed è stata
  // DECISA il 2026-08-16 (#193) — non rimossa per far tacere il cancello. Ora dichiara
  // `PERSONAL` in `RESOURCE_DATA_CLASS` e sta in `RESOURCE_RUBRICA_AZIENDALE` con la
  // decisione di Enzo scritta accanto. Un elenco vuoto qui è la condizione sana: se
  // tornasse a riempirsi, direbbe che si sta rimandando invece di decidere.
};

export const RESOURCE_DATA_CLASS: Readonly<Record<string, DataClass>> = {
  // PERSONAL
  user: "PERSONAL",
  // #193 — l'organigramma mostra nomi e collocazione: dirlo è l'unica affermazione vera.
  // Sta ANCHE in `RESOURCE_RUBRICA_AZIENDALE`, che è ciò che lo tiene fuori dall'asse
  // organizzativo per decisione di Enzo (2026-08-16). Le due righe non si contraddicono:
  // la prima dice *cosa mostra*, la seconda *a chi è aperto*.
  organization_unit: "PERSONAL",
  user_profile: "PERSONAL",
  // #214 F6, S1083 — `engagement` e `surveys` erano NON MAPPATE, e il criterio
  // dei perimetri dell'agente trattava il non-mappato come «neutro». Ma il
  // non-mappato è un SILENZIO, non una dichiarazione di neutralità: misurando,
  // **862 risposte di clima su 862** e **948 assegnazioni di sondaggio su 948**
  // portano l'identità di chi ha risposto. Chi legge queste due resource legge
  // *chi ha detto cosa sul clima aziendale* — materia più delicata, non meno, di
  // una retribuzione. `PERSONAL`, quindi, e fuori dalla coda dei perimetri
  // apribili all'agente.
  engagement: "PERSONAL",
  surveys: "PERSONAL",
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

/**
 * Le resource che mostrano persone ma il cui dato e' **rubrica aziendale** (#193).
 *
 * Non sono un quarto modo per tacere, e non somigliano a `RESOURCE_SENZA_DATI_DI_PERSONA`:
 * quelle affermano «qui non ci sono persone», queste affermano l'opposto — *ci sono, e sono
 * aperte a chiunque lavori nel tenant*. La differenza e' l'unica che conta, perche' la prima
 * frase su un organigramma sarebbe falsa.
 *
 * Conseguenza tecnica, ed e' la ragione per cui l'elenco esiste separato: una resource qui
 * NON e' «sensibile» ai fini dell'asse organizzativo, quindi l'asserzione D-51 al boot non
 * pretende un `orgGate` sulle sue rotte di lettura. Sarebbe un cancello che filtra un dato
 * che una decisione di prodotto ha gia' aperto — e le rotte fallirebbero l'avvio.
 *
 * Ogni riga porta la decisione che la giustifica, con autore e data. Una riga senza non e'
 * un'esenzione: e' una dimenticanza travestita.
 */
export const RESOURCE_RUBRICA_AZIENDALE: Readonly<Record<string, string>> = {
  organization_unit:
    "#193 — Enzo, 2026-08-16: «l'organigramma aziendale deve restare visibile a chiunque " +
    "lavori in azienda». Mostra nomi e collocazione (PERSONAL, dichiarato), ma di livello " +
    "rubrica: non passa dall'asse organizzativo. Misurato lo stesso giorno: 117 utenti su " +
    "161 non hanno alcun dominio, e per loro e' l'unica voce non-personale del menu. " +
    "Il permesso `organization_unit:read` lo detengono tutti e 161 — qui si allinea la " +
    "dottrina a cio' che l'API gia' concede, non si apre nulla di nuovo.",
};

/** True iff the resource carries SENSITIVE person-level data (→ organizational axis at F3). */
export function isSensitiveResource(resource: string): boolean {
  // #193: la rubrica aziendale dichiara `PERSONAL` e resta fuori dall'asse organizzativo.
  // Il controllo sta PRIMA della classe, non dopo, perche' e' una decisione che sovrascrive
  // la classificazione — non un caso che la classificazione non ha previsto.
  if (RESOURCE_RUBRICA_AZIENDALE[resource] !== undefined) return false;
  const c = dataClassOf(resource);
  return c !== null && isSensitiveClass(c);
}
