/**
 * apps/web/src/lib/glossario.ts — il glossario delle interfacce (classe C13 del piano
 * docs/piani/PIANO_interfaccia-sistematica_20261111.md).
 *
 * Enzo, 2026-11-11: «nessun uso di icone di info che spieghino brevemente il significato di un
 * dato, di una sigla, di un indicatore». Una voce per concetto (R7: un termine per concetto),
 * scritta per chi guarda la pagina e non per chi l'ha costruita: che cosa misura, come si legge.
 * Le intestazioni di colonna e i titoli degli indicatori la trovano da sé (`spiegazioneDi`), e
 * le sigle trovate in un testo si spiegano al passaggio (`sigleIn`).
 */

export interface Voce {
  /** il nome per esteso, per una sigla */
  esteso?: string;
  /** una o due frasi */
  testo: string;
}

/** Sigle: chiave esatta, maiuscola. */
export const SIGLE: Record<string, Voce> = {
  KPI: { esteso: "Indicatore chiave di prestazione", testo: "Una misura scelta per dire se un obiettivo o un processo sta andando come deve, confrontata con un valore atteso." },
  OKR: { esteso: "Obiettivi e risultati chiave", testo: "Un obiettivo qualitativo accompagnato da pochi risultati misurabili che dicono quando è raggiunto." },
  ESCO: { esteso: "Classificazione europea di abilità, competenze e occupazioni", testo: "Il vocabolario della Commissione europea che dà un nome comune a mestieri e competenze." },
  ISCO: { esteso: "Classificazione internazionale delle professioni", testo: "La classificazione delle professioni dell'Organizzazione internazionale del lavoro (ISCO-08)." },
  RACI: { esteso: "Responsabile, Approvatore, Consultato, Informato", testo: "Chi esegue un'attività, chi ne risponde, chi va sentito prima e chi va avvisato dopo." },
  VRIO: { esteso: "Valore, Rarità, Inimitabilità, Organizzazione", testo: "Il modo di giudicare se una capacità è un vantaggio competitivo duraturo: deve essere di valore, rara, difficile da copiare e sostenuta dall'organizzazione." },
  CCNL: { esteso: "Contratto collettivo nazionale di lavoro", testo: "Il contratto del settore che fissa livelli, minimi retributivi, orari, ferie e permessi. Per una banca è il CCNL del Credito." },
  RAL: { esteso: "Retribuzione annua lorda", testo: "Quanto la persona guadagna in un anno prima di tasse e contributi, senza i premi variabili." },
  ROL: { esteso: "Riduzione dell'orario di lavoro", testo: "Ore di permesso retribuito che il contratto collettivo riconosce ogni anno, oltre alle ferie." },
  FTE: { esteso: "Equivalente a tempo pieno", testo: "Le persone contate in proporzione all'orario: due persone a metà tempo valgono 1 FTE." },
  HR: { esteso: "Risorse umane", testo: "La funzione che gestisce persone, organizzazione, retribuzioni e sviluppo." },
  GDPR: { esteso: "Regolamento generale sulla protezione dei dati", testo: "Il regolamento europeo 2016/679 sul trattamento dei dati personali." },
  DPO: { esteso: "Responsabile della protezione dei dati", testo: "La figura che sorveglia che i dati personali siano trattati secondo il GDPR; vede i dati sensibili in forma mascherata." },
  MFA: { esteso: "Autenticazione a più fattori", testo: "L'accesso chiede, oltre alla parola d'ordine, un secondo elemento: un codice dal telefono o da un'app." },
  TOTP: { esteso: "Codice temporaneo", testo: "Il codice di sei cifre che un'app di autenticazione genera e che cambia ogni 30 secondi." },
  RBAC: { esteso: "Accesso basato sui ruoli", testo: "Ciò che una persona può fare dipende dai ruoli che le sono assegnati." },
  OU: { esteso: "Unità organizzativa", testo: "Un nodo dell'organigramma: direzione, area, ufficio, filiale." },
  NACE: { esteso: "Classificazione europea delle attività economiche", testo: "Il codice del settore in cui opera un'azienda; in Italia la sua versione è ATECO." },
  ATECO: { esteso: "Classificazione italiana delle attività economiche", testo: "La versione italiana della NACE, usata da ISTAT e Camere di commercio." },
  ERP: { esteso: "Sistema gestionale integrato", testo: "Il gestionale che tiene contabilità, acquisti, paghe (per esempio SAP o Zucchetti)." },
  IA: { esteso: "Intelligenza artificiale", testo: "Gli agenti che leggono i dati, propongono e, dove permesso, eseguono." },
  AI: { esteso: "Intelligenza artificiale", testo: "Gli agenti che leggono i dati, propongono e, dove permesso, eseguono." },
  IBAN: { esteso: "Codice internazionale di conto bancario", testo: "Il codice del conto su cui si accredita lo stipendio." },
  PIP: { esteso: "Quadro delle informazioni della posizione", testo: "Tutto ciò che descrive una posizione: compiti, competenze attese, relazioni, dati retributivi." },
  SLA: { esteso: "Livello di servizio concordato", testo: "Il tempo entro cui una richiesta deve essere presa in carico o chiusa." },
};

/** Concetti: chiave in minuscolo, confrontata con l'intestazione intera o con il suo inizio. */
export const CONCETTI: Record<string, Voce> = {
  criticità: { testo: "Quanto pesa la posizione per l'organizzazione se restasse scoperta: alta vuol dire che senza titolare un processo importante si ferma." },
  copertura: { testo: "Quota di posizioni con un titolare attivo sul totale delle posizioni attive." },
  scoperta: { testo: "Una posizione attiva senza un titolare assegnato." },
  scoperte: { testo: "Posizioni attive senza un titolare assegnato." },
  titolare: { testo: "La persona che oggi occupa la posizione. È distinta dal proprietario, che risponde della posizione." },
  proprietario: { testo: "Chi risponde della posizione (di solito il responsabile dell'unità): la definisce e decide chi la occupa." },
  "riporta a": { testo: "La posizione sopra nella catena gerarchica." },
  successione: { testo: "Le persone pronte, o preparate, a prendere una posizione quando il titolare la lascia." },
  prontezza: { testo: "Fra quanto tempo un candidato alla successione potrebbe davvero prendere la posizione: ora, entro un anno, entro tre." },
  potenziale: { testo: "Quanto si prevede che la persona possa crescere, distinto da come lavora oggi (la prestazione)." },
  prestazione: { testo: "Come la persona ha lavorato nel periodo, secondo la valutazione." },
  "nine box": { testo: "La griglia tre per tre che incrocia prestazione e potenziale e suggerisce che cosa fare con ciascuna persona." },
  "9-box": { testo: "La griglia tre per tre che incrocia prestazione e potenziale e suggerisce che cosa fare con ciascuna persona." },
  gap: { testo: "La distanza fra il livello di competenza che la posizione chiede e quello che la persona ha." },
  divario: { testo: "La distanza fra il livello di competenza che la posizione chiede e quello che la persona ha." },
  livello: { testo: "Il livello d'inquadramento del contratto collettivo, che fissa il minimo retributivo." },
  "banda retributiva": { testo: "L'intervallo di retribuzione previsto per un livello o una famiglia di posizioni: minimo, punto medio, massimo." },
  "compa-ratio": { testo: "La retribuzione della persona divisa per il punto medio della sua banda: 100% è il centro, sotto 80% o sopra 120% merita uno sguardo." },
  turnover: { testo: "Le uscite del periodo in rapporto all'organico medio." },
  assenteismo: { testo: "Le ore di assenza non programmata in rapporto alle ore lavorabili." },
  maturazione: { testo: "I giorni o le ore di ferie e permessi che la persona acquisisce col passare dei mesi." },
  saldo: { testo: "Quanto resta da godere: maturato, più riporto, meno goduto." },
  riporto: { testo: "Ferie o permessi non goduti l'anno prima e portati in quello corrente." },
  perimetro: { testo: "L'insieme di unità e persone che il tuo ruolo ti lascia vedere." },
  mandato: { testo: "Il ruolo che dà accesso: dice che cosa puoi fare (leggere, modificare) e su quale perimetro." },
  tenant: { testo: "Un'azienda cliente della piattaforma, con i propri dati separati dagli altri." },
  provenienza: { testo: "Da dove viene il dato: creato qui (nativo), importato da un altro sistema, o importato e poi arricchito (ibrido)." },
  origine: { testo: "Da dove viene il dato: creato qui (nativo), importato da un altro sistema, o importato e poi arricchito (ibrido)." },
  organico: { testo: "Le persone con un rapporto di lavoro attivo." },
  anzianità: { testo: "Da quanto tempo la persona lavora in azienda." },
  "unità organizzativa": { testo: "Un nodo dell'organigramma: direzione, area, ufficio, filiale." },
  ferie: { testo: "I giorni di riposo retribuito che maturano ogni mese secondo il contratto collettivo." },
  permessi: { testo: "Ore di assenza retribuita (ROL, ex festività, permessi per legge) oltre alle ferie." },
  straordinario: { testo: "Le ore lavorate oltre l'orario contrattuale, pagate con una maggiorazione o recuperate." },
  straordinari: { testo: "Le ore lavorate oltre l'orario contrattuale, pagate con una maggiorazione o recuperate." },
  obiettivo: { testo: "Un risultato concordato per il periodo, con un peso e un modo per misurarlo." },
  obiettivi: { testo: "I risultati concordati per il periodo, ciascuno con un peso e un modo per misurarlo." },
  peso: { testo: "Quanto conta questa voce sul totale: i pesi di una persona sommano a 100%." },
  "risultato chiave": { testo: "Un numero che dice se l'obiettivo è raggiunto (il «key result» di un OKR)." },
  valutazione: { testo: "Il giudizio di periodo sulla prestazione, dato dal responsabile e, dove previsto, calibrato." },
  ciclo: { testo: "Il periodo di valutazione (di solito un anno) con le sue scadenze: obiettivi, verifica intermedia, valutazione finale." },
  competenza: { testo: "Una capacità professionale descritta in un catalogo (ESCO o aziendale), con un livello da 1 a 5." },
  competenze: { testo: "Le capacità professionali descritte in un catalogo (ESCO o aziendale), ciascuna con un livello da 1 a 5." },
  "livello atteso": { testo: "Il livello di competenza che la posizione chiede a chi la occupa." },
  certificazione: { testo: "Un attestato rilasciato da un ente, con una data di scadenza dopo la quale va rinnovato." },
  certificazioni: { testo: "Attestati rilasciati da un ente, ciascuno con una data di scadenza dopo la quale va rinnovato." },
  scadenza: { testo: "La data oltre la quale la voce non vale più e va rinnovata o chiusa." },
  "percorso formativo": { testo: "Una sequenza di corsi pensata per colmare un divario di competenza o preparare a un ruolo." },
  approvatore: { testo: "Chi deve decidere sulla richiesta: il responsabile, o chi ha ricevuto la delega." },
  delega: { testo: "Il potere di approvare passato temporaneamente a un'altra persona (per esempio durante un'assenza)." },
  punteggio: { testo: "Il valore numerico della valutazione, sulla scala indicata accanto." },
  "rischio di uscita": { testo: "La probabilità stimata che la persona lasci l'azienda nei prossimi mesi, da segnali come anzianità, valutazioni e mercato." },
  indice: { testo: "Un numero composto da più misure, su una scala da 0 a 100: più alto è meglio, salvo dove indicato." },
  fascia: { testo: "L'intervallo retributivo previsto per il livello: minimo, punto medio, massimo." },
  variabile: { testo: "La parte della retribuzione legata ai risultati, pagata se si superano le soglie concordate." },
  premio: { testo: "Un importo una tantum legato a un risultato o a un evento." },
  lordo: { testo: "L'importo prima di tasse e contributi." },
  netto: { testo: "L'importo che arriva sul conto, dopo tasse e contributi." },
  inquadramento: { testo: "Livello e qualifica del contratto collettivo che definiscono minimi e mansioni." },
  mansione: { testo: "Il lavoro che la persona svolge, come descritto nel contratto." },
  sede: { testo: "Il luogo di lavoro abituale della persona." },
  "ruolo professionale": { testo: "Il mestiere descritto nel catalogo (famiglia e ruolo), indipendente dalla singola posizione." },
  maturato: { testo: "Quanto si è acquisito finora nell'anno: giorni o ore che crescono ogni mese." },
  goduto: { testo: "Quanto si è già usato: giorni o ore di assenza fruiti." },
  residuo: { testo: "Quanto resta da usare: maturato più riporto, meno goduto." },
};

const norma = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[:.]$/, "");

/** La spiegazione di un'intestazione o di un titolo d'indicatore, se il glossario la conosce. */
export function spiegazioneDi(titolo: string): (Voce & { termine: string }) | undefined {
  const n = norma(titolo);
  if (!n) return undefined;
  const sigla = SIGLE[titolo.trim().toUpperCase()];
  if (sigla && /^[A-Za-z0-9-]{2,6}$/.test(titolo.trim())) return { ...sigla, termine: titolo.trim().toUpperCase() };
  const c = CONCETTI[n];
  if (c) return { ...c, termine: titolo.trim() };
  for (const [k, v] of Object.entries(CONCETTI)) if (n.startsWith(`${k} `) || n.endsWith(` ${k}`)) return { ...v, termine: k };
  for (const s of sigleIn(titolo)) return { ...SIGLE[s]!, termine: s };
  return undefined;
}

/** Le sigle note che compaiono in un testo, nell'ordine. */
export function sigleIn(testo: string): string[] {
  const visti: string[] = [];
  for (const m of testo.matchAll(/\b[A-Z][A-Z0-9]{1,5}\b/g)) if (SIGLE[m[0]] && !visti.includes(m[0])) visti.push(m[0]);
  return visti;
}
