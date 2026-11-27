/**
 * apps/api/src/modules/faldone/inglese.ts — il Faldone detto in inglese.
 *
 * Classe K01 del controllo forense del 23/11/2026: in una pagina inglese il faldone mostrava in
 * italiano i capitoli, i titoli delle sezioni e i motivi dell'{omissis}, perché il servizio li
 * scriveva solo in italiano. Qui sta la loro forma inglese, chiave per chiave: il titolo italiano
 * di `classi.ts` resta la fonte, e la prova `faldone-inglese.unit.test.ts` fallisce se un titolo,
 * un capitolo, un ruolo o un motivo nuovo resta senza traduzione.
 *
 * Il servizio sceglie la lingua dalla richiesta (`?lingua=en`), come fa il quadro degli insight
 * (`modules/quadro/lenti.ts`); senza parametro risponde in italiano, come prima.
 */
import type { FaldoneLingua } from "@heuresys/shared";
import type { Capitolo } from "./classi.js";

export const CAPITOLI_EN: Readonly<Record<Capitolo, string>> = {
  "Anagrafica": "Personal details",
  "Rapporto di lavoro": "Employment",
  "Retribuzione": "Pay",
  "Posizione e organizzazione": "Position and organisation",
  "Presenze e assenze": "Attendance and absence",
  "Competenze": "Skills",
  "Formazione": "Learning",
  "Obiettivi e indicatori": "Goals and indicators",
  "Valutazioni": "Reviews",
  "Talento e successione": "Talent and succession",
  "Carriera": "Career",
  "Clima e coinvolgimento": "Climate and engagement",
  "Lavoro e collaborazione": "Work and collaboration",
  "Selezione": "Recruitment",
  "Accesso e sicurezza": "Access and security",
  "Privacy e consensi": "Privacy and consents",
  "Assistente e agenti": "Assistant and agents",
  "Modelli e configurazione": "Templates and configuration",
  "Archivi e registri tecnici": "Archives and technical logs",
};

/** Il titolo inglese di ogni titolo italiano di `classi.ts`. */
export const TITOLI_EN: Readonly<Record<string, string>> = {
  // Anagrafica
  "Persona": "Person",
  "Profilo": "Profile",
  "Indirizzi": "Addresses",
  "Coordinate bancarie": "Bank details",
  "Dati anagrafici e demografici": "Personal and demographic data",
  "Documenti": "Documents",
  "Documenti di identità": "Identity documents",
  "Istruzione": "Education",
  "Familiari": "Family members",
  "Preferenze": "Preferences",
  "Esperienze professionali": "Professional experience",
  "Cronologia": "Timeline",
  // Rapporto di lavoro
  "Rapporto di lavoro": "Employment",
  "Contratti": "Contracts",
  "Atti di mandato": "Mandate acts",
  "Registro degli atti di mandato": "Mandate act log",
  "Deleghe": "Delegations",
  // Retribuzione
  "Buste paga": "Pay slips",
  "Proposte retributive": "Pay recommendations",
  "Retribuzione variabile": "Variable pay",
  "Cancelli del premio": "Bonus gates",
  "Esiti dei cancelli del premio": "Bonus gate results",
  "Profili retributivi delle posizioni": "Position pay profiles",
  // Posizione e organizzazione
  "Posizioni ricoperte": "Positions held",
  "Posizioni": "Positions",
  "Unità organizzative": "Organisational units",
  "Storia delle unità organizzative": "Organisational unit history",
  "Modelli di unità organizzativa": "Organisational unit templates",
  "Filiali": "Branches",
  "Team": "Teams",
  "Appartenenza ai team": "Team membership",
  "Mansioni": "Job roles",
  "Posizioni critiche": "Critical positions",
  "Rilevanza per la successione": "Succession relevance",
  "Percorsi di carriera delle posizioni": "Position career paths",
  "Indicatori richiesti dalle posizioni": "Indicators required by positions",
  "Formazione richiesta dalle posizioni": "Learning required by positions",
  "Competenze richieste dalle posizioni": "Skills required by positions",
  "Storia delle competenze richieste": "Required skill history",
  "Assegnazioni ai clienti": "Client assignments",
  // Presenze e assenze
  "Presenze": "Attendance",
  "Straordinari": "Overtime",
  "Saldi di ferie e permessi": "Leave balances",
  "Richieste di ferie e permessi": "Leave requests",
  "Movimenti dei saldi": "Balance movements",
  "Regole di maturazione": "Accrual rules",
  // Competenze
  "Competenze possedute": "Skills held",
  "Evidenze delle competenze": "Skill evidence",
  "Evidenze registrate": "Recorded evidence",
  "Lacune di competenza": "Skill gaps",
  "Analisi delle lacune": "Gap analysis",
  "Piani di chiusura delle lacune": "Gap closure plans",
  "Azioni di chiusura delle lacune": "Gap closure actions",
  "Punteggi di lacuna": "Gap scores",
  "Impronta semantica del profilo": "Semantic profile fingerprint",
  "Competenze del catalogo": "Catalogue skills",
  "Abbinamenti di mentoring": "Mentoring matches",
  // Formazione
  "Formazione assegnata": "Assigned learning",
  "Formazione frequentata": "Learning attended",
  "Certificazioni": "Certifications",
  "Iniziative formative": "Training initiatives",
  "Moduli formativi": "Learning modules",
  "Percorsi formativi": "Learning paths",
  "Mentoring": "Mentoring",
  "Incontri di mentoring": "Mentoring sessions",
  // Obiettivi e indicatori
  "Obiettivi": "Goals",
  "Aggiornamenti periodici degli obiettivi": "Goal check-ins",
  "Commenti agli obiettivi": "Goal comments",
  "Tappe degli obiettivi": "Goal milestones",
  "Avanzamenti degli obiettivi": "Goal progress updates",
  "Modelli di obiettivo": "Goal templates",
  "Allineamenti fra obiettivi": "Goal alignments",
  "Obiettivi e risultati chiave": "Objectives and key results",
  "Risultati chiave": "Key results",
  "Aggiornamenti dei risultati chiave": "Key result check-ins",
  "Bersagli degli indicatori": "Indicator targets",
  "Misure degli indicatori": "Indicator measurements",
  "Esiti degli indicatori": "Indicator results",
  "Evidenze degli indicatori": "Indicator evidence",
  "Indicatori del catalogo": "Catalogue indicators",
  // Valutazioni
  "Valutazioni della prestazione": "Performance reviews",
  "Giudizi sulle competenze": "Competency ratings",
  "Eccezioni alla condivisione della valutazione": "Review sharing exceptions",
  "Feedback a 360 gradi": "360-degree feedback",
  "Feedback continuo": "Continuous feedback",
  "Discussioni di calibrazione": "Calibration discussions",
  "Partecipazioni alla calibrazione": "Calibration participation",
  "Sessioni di calibrazione": "Calibration sessions",
  "Cicli di valutazione": "Review cycles",
  "Assessment": "Assessments",
  "Esiti degli assessment": "Assessment results",
  "Evidenze degli assessment": "Assessment evidence",
  "Valutazioni comportamentali": "Behavioural assessments",
  "Aderenza alle posizioni": "Position fit",
  // Talento e successione
  "Punteggi di talento": "Talent scores",
  "Rischio di uscita": "Flight risk",
  "Previsioni dei modelli": "Model predictions",
  "Unità negli scenari what-if": "Units in what-if scenarios",
  "Presenza negli scenari what-if": "Presence in what-if scenarios",
  "Prontezza": "Readiness",
  "Punteggi di successione": "Succession scores",
  "Prontezza alla successione": "Succession readiness",
  "Bacini di successione": "Succession pools",
  "Candidature alla successione": "Succession candidates",
  "Prontezza del successore": "Successor readiness",
  "Suggerimenti del consigliere": "Advisor suggestions",
  "Punteggi di capacità": "Capability scores",
  // Carriera
  "Piani di carriera": "Career plans",
  "Posizioni obiettivo": "Target positions",
  "Percorsi di carriera": "Career paths",
  // Clima e coinvolgimento
  "Risposte ai questionari di clima": "Climate survey responses",
  "Risposte ai sondaggi": "Survey responses",
  "Sondaggi assegnati": "Assigned surveys",
  "Rilevazioni lampo": "Pulse checks",
  "Segnalazioni di clima": "Climate feedback",
  "Questionari di clima": "Climate surveys",
  "Modelli di questionario": "Survey templates",
  "Piani d'azione sul clima": "Climate action plans",
  // Lavoro e collaborazione
  "Richieste di approvazione": "Approval requests",
  "Passi di approvazione": "Approval steps",
  "Partecipazione ai processi": "Process participation",
  "Partecipazione ai progetti": "Project participation",
  "Fasi dei progetti che porta": "Project phases they lead",
  "Notifiche": "Notifications",
  "Preferenze di notifica": "Notification preferences",
  "Documenti editoriali": "Editorial documents",
  "Versioni dei documenti": "Document versions",
  "Allegati dei documenti": "Document attachments",
  "Collegamenti dei contenuti": "Content links",
  "Grafici salvati": "Saved charts",
  "Azioni nel portale personale": "Self-service portal actions",
  "Eventi di valore": "Value events",
  "Registro delle scritture": "Write log",
  // Selezione
  "Candidatura": "Candidacy",
  "Domande di assunzione": "Job applications",
  "Esiti dei colloqui": "Interview feedback",
  // Accesso e sicurezza
  "Ruoli assegnati": "Assigned roles",
  "Identità di accesso": "Sign-in identities",
  "Credenziali": "Credentials",
  "Accessi": "Sign-ins",
  "Sessioni": "Sessions",
  "Rinnovi di sessione": "Session renewals",
  "Richieste di nuova password": "Password reset requests",
  "Fattori di autenticazione": "Authentication factors",
  "Codici monouso inviati": "One-time codes sent",
  "Codici di recupero": "Recovery codes",
  "Chiavi di sicurezza": "Security keys",
  "Esenzioni dal secondo fattore": "Second-factor exemptions",
  "Registro delle esenzioni": "Exemption log",
  "Idoneità all'esenzione": "Exemption eligibility",
  "Richieste ripetibili": "Repeatable requests",
  // Privacy e consensi
  "Consensi": "Consents",
  "Richieste sulla privacy": "Privacy requests",
  // Assistente e agenti
  "Conversazioni con l'assistente": "Assistant conversations",
  "Attività dell'assistente": "Assistant activity",
  "Capacità degli agenti": "Agent capabilities",
  "Attivazioni delle capacità": "Capability activations",
  "Richieste dell'agente": "Agent requests",
  "Costo e durata delle chiamate dell'agente": "Agent call cost and duration",
  "Scenari what-if": "What-if scenarios",
  "Versioni degli scenari": "Scenario versions",
  "Segnalazioni ricevute dagli agenti": "Signals received from agents",
  // Modelli e configurazione
  "Attivazioni dei modelli": "Blueprint activations",
  "Personalizzazioni dei modelli": "Blueprint overrides",
  "Corse dei modelli": "Blueprint runs",
  "Profili d'impresa": "Enterprise profiles",
  "Origini dei dati generati": "Generated data origins",
  "Equivalenze di vocabolario": "Vocabulary equivalences",
  "Registro delle riconciliazioni": "Reconciliation log",
  "Fonti di ricerca": "Research sources",
  "Corse di acquisizione": "Acquisition runs",
  "Decisioni di acquisizione": "Acquisition decisions",
  "Decisioni sui processi del modello": "Blueprint process decisions",
  "Istantanee del modello": "Blueprint snapshots",
  "Versioni del modello": "Blueprint versions",
  "Modelli del cliente": "Client blueprints",
  "Decisioni di consolidamento": "Consolidation decisions",
  "Consolidamenti": "Consolidations",
  "Decisioni di allineamento al modello": "Blueprint alignment decisions",
  "Importazioni di riferimento": "Reference imports",
  // Archivi e registri tecnici
  "Archivio degli straordinari esenti": "Exempt overtime archive",
  "Archivio delle iniziative formative": "Training initiative archive",
  "Giornale della sospensione del collaudo": "Test suspension journal",
  "Giornale di correzione del rapporto di lavoro": "Employment correction journal",
  "Giornale di correzione dei dirigenti": "Executive correction journal",
  "Giornale di correzione delle buste paga": "Pay slip correction journal",
  "Giornale del modello dei ruoli": "Role model journal",
  "Giornale degli eventi di valore": "Value event journal",
  "Giornale dell'allineamento dei livelli": "Level alignment journal",
  "Giornale dei ruoli senza cliente": "Roles without client journal",
  "Persone importate": "Imported people",
};

/** Il ruolo di una colonna di relazione (`ruoloDiRelazione`), in inglese. */
export const RUOLI_EN: Readonly<Record<string, string>> = {
  "inseriti": "entered",
  "modificati": "edited",
  "come valutatore": "as reviewer",
  "come approvatore": "as approver",
  "come decisore": "as decision maker",
  "come responsabile": "as owner",
  "come autore": "as author",
  "come facilitatore": "as facilitator",
  "come intervistatore": "as interviewer",
  "come incaricato": "as assignee",
  "come richiedente o esecutore": "as requester or performer",
  "dati ad altri": "given to others",
  "come autore della modifica": "as author of the change",
  "come assunto": "as hire",
  "collegati": "linked",
};

/** I motivi dell'{omissis} (`service.ts`), in inglese. */
export const MOTIVI_EN: Readonly<Record<string, string>> = {
  "anonimo per costruzione: chi compare oltre alla persona non esce per nessuno":
    "anonymous by design: anyone else in the row is shown to no one",
  "persone terze: chi altro compare nella riga lo legge solo il mandato HR":
    "third parties: only the HR mandate reads who else appears in the row",
  "dato riservato di un altro oggetto": "restricted data of another record",
  "la persona vi compare per ciò che ha fatto: il contenuto si apre dalla pagina di quell'oggetto, con i suoi permessi":
    "the person appears here for what they did: the content opens from that record's page, with its permissions",
  "lo legge solo la persona stessa": "only the person themselves can read it",
  "dato di talento riservato: non si comunica alla persona": "restricted talent data: not disclosed to the person",
  "anonimo per costruzione: alla persona arriva aggregato dal suo modulo":
    "anonymous by design: the person sees it aggregated in its own module",
  "categoria particolare: la legge solo la persona stessa": "special category: only the person themselves can read it",
  "credenziali: le legge solo la persona o il mandato tecnico": "credentials: only the person or the technical mandate can read them",
  "sfera privata: non rientra nel tuo profilo": "private sphere: not within your profile",
  "retribuzione: serve la conferma del secondo fattore": "pay: second-factor confirmation required",
  "retribuzione: non rientra nel tuo profilo": "pay: not within your profile",
  "valutazioni: serve la conferma del secondo fattore": "reviews: second-factor confirmation required",
  "valutazioni: non rientrano nel tuo profilo": "reviews: not within your profile",
  "segreti di accesso: non escono per nessuno": "access secrets: shown to no one",
};

/** L'identificativo stabile di un capitolo, uguale in ogni lingua: `Rapporto di lavoro` → `rapporto-di-lavoro`. */
export function idCapitolo(capitolo: string): string {
  return capitolo.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/** Gli strumenti con cui il servizio dice capitoli, titoli, ruoli e motivi nella lingua chiesta. */
export interface TestiFaldone {
  lingua: FaldoneLingua;
  capitolo(it: string): string;
  titolo(it: string): string;
  ruolo(it: string): string;
  /** Un motivo può unirne due con «; »: si traduce pezzo per pezzo. */
  motivo(it: string): string;
}

export function testiFaldone(lingua: FaldoneLingua = "it"): TestiFaldone {
  if (lingua !== "en") {
    return { lingua: "it", capitolo: (x) => x, titolo: (x) => x, ruolo: (x) => x, motivo: (x) => x };
  }
  const capitoli = CAPITOLI_EN as Readonly<Record<string, string>>;
  return {
    lingua: "en",
    capitolo: (x) => capitoli[x] ?? x,
    // Una tabella senza classificazione ha per titolo il suo nome tecnico: resta com'è.
    titolo: (x) => TITOLI_EN[x] ?? x,
    ruolo: (x) => RUOLI_EN[x] ?? x,
    motivo: (x) => x.split("; ").map((p) => MOTIVI_EN[p] ?? p).join("; "),
  };
}
