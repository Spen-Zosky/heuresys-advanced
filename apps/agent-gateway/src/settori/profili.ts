/**
 * apps/agent-gateway/src/settori/profili.ts — le competenze di settore del giudice del consolidamento.
 *
 * L'agente di consolidamento è uno solo (specifica, §3); cambia ciò che sa del settore del tenant.
 * Un profilo dice al giudice, in italiano semplice, che cosa un esperto di quel settore sa e un
 * esperto HR generico no: quali funzioni la vigilanza vuole separate, quali processi una banca deve
 * avere per legge, con quale criterio si riducono le voci di ciascun dominio.
 *
 * Le separazioni non sono solo parole nel prompt: ogni voce può portare delle etichette (`tags`), e
 * un accorpamento che unisce due etichette vietate insieme si scarta qui, prima di arrivare all'API,
 * qualunque cosa il modello abbia scritto. Il modello propone, la regola tiene.
 *
 * Il profilo si sceglie dalla famiglia del prototipo (`FIN_BANKING` per le banche, ATECO 64.19):
 * per un settore che non ha ancora un profilo il giudice lavora con il solo profilo generico.
 * Nato dal thread «agente esperto bancario per le non corrispondenze» del 2026-11-10, con il
 * catalogo dei 21 processi approvato da Enzo lo stesso giorno
 * (`docs/piani/PIANO_agente-non-corrispondenze_20261110.md`).
 */

/** I 22 domini del confronto fra un prototipo (o una corsa) e un tenant, nell'ordine della console. */
export const DOMINI = [
  "ATECO",
  "CLASSE_SEDI",
  "CCNL_ISTITUTI",
  "PROCESSI",
  "UNITA",
  "ORGANIGRAMMA",
  "OBBLIGHI",
  "RUOLI",
  "COPERTURA_OBBLIGHI",
  "LIVELLO_CCNL",
  "FASI",
  "SKILL",
  "OBIETTIVI",
  "METRICHE",
  "CAMPI_DERIVATI",
  "BERSAGLI",
  "FORMAZIONE",
  "CARRIERE",
  "INCENTIVI_WELFARE",
  "FLUSSI_COMMESSA",
  "CRITICITA_RUOLI",
  "CONDIZIONI_CCNL",
] as const;
export type Dominio = (typeof DOMINI)[number];

export interface Criterio {
  /** Che cosa decide se due voci sono la stessa cosa. */
  chiave: string;
  /** Come si riducono le voci senza perdere niente. */
  riduzione: string;
  /** Ciò che la riduzione non può rompere. */
  vincolo: string;
}

export interface ProfiloSettore {
  famiglia: string;
  nome: string;
  /** Ciò che l'esperto sa, in frasi brevi che il giudice legge. */
  competenze: readonly string[];
  /** Coppie di etichette che non si accorpano mai, con il motivo. */
  separazioni: ReadonlyArray<{ a: string; b: string; motivo: string }>;
  /** Processi che il settore deve avere: se mancano a un lato, si propone di aggiungerli, mai di toglierli all'altro. */
  obbligatori: ReadonlyArray<{ tag: string; motivo: string }>;
  criteri: Readonly<Record<Dominio, Criterio>>;
}

const c = (chiave: string, riduzione: string, vincolo: string): Criterio => ({ chiave, riduzione, vincolo });

/** I criteri che valgono per ogni settore; un profilo li sostituisce dove ne sa di più. */
const CRITERI_GENERICI: Readonly<Record<Dominio, Criterio>> = {
  ATECO: c("codice ATECO 2025", "un codice primario; i secondari solo se c'è un'attività vera", "il codice registrato del tenant"),
  CLASSE_SEDI: c("addetti reali; sede per città e indirizzo", "una sede fisica, una voce", "le sedi sono quelle reali del tenant, anche se in numero diverso dal prototipo; il modello di sede si applica a ciascuna"),
  CCNL_ISTITUTI: c("contratto e articolo", "un istituto per articolo, non per nome", "il contratto applicato davvero"),
  PROCESSI: c("famiglia del processo (APQC), responsabile, continuità del flusso", "si accorpano i fratelli della stessa famiglia con lo stesso responsabile; un processo accorpato diventa un blocco di fasi", "le separazioni del settore"),
  UNITA: c("funzione, unità madre, sede", "si fondono unità con stessa funzione, stessa madre e stessa sede", "le funzioni che la norma vuole distinte"),
  ORGANIGRAMMA: c("catena di dipendenza", "profondità proporzionata agli addetti; un'unità con un solo addetto confluisce nella madre", "un solo capo per unità e sede; il capo sta nella stessa unità o in una madre"),
  OBBLIGHI: c("fonte normativa e articolo", "un obbligo per articolo", "ogni obbligo ha una funzione responsabile"),
  RUOLI: c("titolo, unità, livello", "stesso ruolo in sedi diverse = una voce con più posizioni; sinonimi e lingue diverse = una voce", "due capi della stessa unità nella stessa sede sono un difetto"),
  COPERTURA_OBBLIGHI: c("obbligo per ruolo", "si ricalcola sui ruoli consolidati", "nessun obbligo senza un ruolo che lo copre"),
  LIVELLO_CCNL: c("ruolo di catalogo", "un livello, o una forchetta, per ruolo", "il livello del prototipo è un minimo: chi sta sopra non scende (art. 2103 c.c.); una salita costa e la decide una persona"),
  FASI: c("codice della fase", "le fasi seguono il loro processo dopo l'accorpamento; doppioni per codice fusi", "via le fasi che nel settore non esistono"),
  SKILL: c("indirizzo ESCO", "sinonimi fusi; da 5 a 12 skill centrali per ruolo", "le skill che la norma richiede restano"),
  OBIETTIVI: c("indicatore e ruolo che risponde", "un obiettivo per indicatore per ruolo", "le valutazioni già chiuse non si toccano"),
  METRICHE: c("formula", "stessa formula con nomi diversi = una metrica", "ogni metrica appartiene a un processo"),
  CAMPI_DERIVATI: c("regola di calcolo", "non si consolidano: si ricalcolano dopo", "nessuno"),
  BERSAGLI: c("metrica, unità, periodo", "un bersaglio per metrica, unità e periodo", "i bersagli di sede si sommano a quelli di rete"),
  FORMAZIONE: c("contenuto normativo", "corsi con lo stesso obbligo fusi", "le ore minime di legge"),
  CARRIERE: c("ruoli di catalogo", "percorsi che differiscono solo per sede fusi", "i requisiti di accesso ai ruoli"),
  INCENTIVI_WELFARE: c("popolazione e piano", "un piano per popolazione", "tocca la retribuzione: si segnala, non si cambia da sé"),
  FLUSSI_COMMESSA: c("processo e prodotto", "diventano istanze dei processi unici, o si tolgono se il settore non lavora a commessa", "nessuno"),
  CRITICITA_RUOLI: c("ruolo di catalogo", "si ricalcola sui ruoli consolidati", "i ruoli designati dalla norma sono critici"),
  CONDIZIONI_CCNL: c("istituto e contratto", "una condizione per istituto", "i valori applicati dal tenant"),
};

export const PROFILO_GENERICO: ProfiloSettore = {
  famiglia: "GENERICO",
  nome: "qualunque settore",
  competenze: [
    "Conosci l'organizzazione aziendale e la gestione delle persone, non un settore in particolare.",
  ],
  separazioni: [],
  obbligatori: [],
  criteri: CRITERI_GENERICI,
};

export const PROFILO_BANCARIO: ProfiloSettore = {
  famiglia: "FIN_BANKING",
  nome: "banca commerciale retail italiana",
  competenze: [
    "Conosci l'organizzazione di una banca italiana: Circolare 285 della Banca d'Italia, D.Lgs. 231/2007 (antiriciclaggio), MiFID II, linee guida BCE ed EBA sul credito e sui crediti deteriorati, CCNL del credito ABI.",
    "Il sistema dei controlli ha tre linee: la linea di business; compliance, gestione dei rischi e antiriciclaggio; la revisione interna. Le funzioni di controllo riportano al vertice, mai a una divisione di business.",
    "In una banca piccola (fino a qualche centinaio di addetti) la proporzionalità permette unità condivise, ma i processi e i loro responsabili di legge restano distinti.",
    "La rete è fatta di filiali raggruppate in aree; chi lavora in filiale risponde al direttore della filiale, il direttore al responsabile di area, l'area alla divisione retail.",
    "Il catalogo APQC generico porta voci che in banca non esistono (ordini, back order, resi, richiami, garanzie di prodotto, rischio assicurativo per una banca non assicurativa) e voci da banca all'ingrosso (sindacazioni, cartolarizzazioni, conti di terzi) che una banca retail piccola non fa: si propongono da togliere.",
    "Un nome non basta: guarda le fasi. Un processo chiamato «credito» con fasi di gestione della liquidità è tesoreria.",
  ],
  separazioni: [
    { a: "CREDITO_CONCESSIONE", b: "CREDITO_RECUPERO", motivo: "le linee guida BCE sui crediti deteriorati vogliono chi recupera separato da chi concede" },
    { a: "TESORERIA", b: "CONTROLLO_RISCHI", motivo: "il risk management è funzione di controllo, indipendente da chi assume il rischio (Circolare 285)" },
    { a: "COMPLIANCE", b: "AUDIT", motivo: "seconda e terza linea di controllo restano separate" },
    { a: "ANTIRICICLAGGIO", b: "CONTROLLO_RISCHI", motivo: "la funzione antiriciclaggio ha un responsabile di legge (D.Lgs. 231/2007)" },
    { a: "CONTROLLO_RISCHI", b: "FINANZA", motivo: "il controllo dei rischi non dipende dalla finanza" },
  ],
  obbligatori: [
    { tag: "ANTIRICICLAGGIO", motivo: "adeguata verifica e segnalazioni sospette per legge (D.Lgs. 231/2007)" },
    { tag: "CREDITO_RECUPERO", motivo: "gestione dei crediti deteriorati richiesta dalla vigilanza" },
    { tag: "COMPLIANCE", motivo: "funzione di conformità (Circolare 285)" },
    { tag: "AUDIT", motivo: "revisione interna (Circolare 285)" },
    { tag: "CONTROLLO_RISCHI", motivo: "funzione di gestione dei rischi (Circolare 285)" },
    { tag: "SERVIZI_INVESTIMENTO", motivo: "una banca retail colloca prodotti d'investimento con la profilatura MiFID II" },
  ],
  criteri: {
    ...CRITERI_GENERICI,
    CCNL_ISTITUTI: c("contratto e articolo", "un CCNL ABI per aree professionali e quadri direttivi, uno per i dirigenti", "un istituto per articolo, non per nome"),
    UNITA: c("funzione, unità madre, sede", "si fondono unità con stessa funzione, stessa madre e stessa sede", "compliance, gestione dei rischi, antiriciclaggio e revisione interna restano unità a sé, sotto il vertice"),
    LIVELLO_CCNL: c("ruolo di catalogo", "un livello o una forchetta per ruolo, nelle aree e nei quadri del CCNL ABI", "il livello del prototipo è un minimo: chi sta sopra non scende (art. 2103 c.c.); un direttore di filiale è almeno quadro direttivo"),
    SKILL: c("indirizzo ESCO", "sinonimi fusi; da 5 a 12 skill centrali per ruolo", "restano le competenze richieste da IVASS e MiFID II per chi colloca prodotti"),
    OBIETTIVI: c("indicatore e ruolo che risponde", "un obiettivo per indicatore per ruolo", "gli obiettivi delle funzioni di controllo non si legano ai ricavi; le valutazioni chiuse non si toccano"),
    FORMAZIONE: c("contenuto normativo (antiriciclaggio, MiFID II, IVASS, sicurezza sul lavoro)", "corsi con lo stesso obbligo fusi", "le ore minime di legge"),
    CARRIERE: c("ruoli di catalogo", "percorsi che differiscono solo per filiale fusi", "i requisiti di professionalità e onorabilità degli esponenti"),
    INCENTIVI_WELFARE: c("popolazione e piano", "un piano per popolazione", "regole di remunerazione della Circolare 285 (malus, claw-back, funzioni di controllo non legate ai risultati); si segnala, non si cambia da sé"),
    FLUSSI_COMMESSA: c("processo e prodotto", "in banca diventano istanze dei processi unici, o si tolgono", "nessuno"),
    CRITICITA_RUOLI: c("ruolo di catalogo", "si ricalcola sui ruoli consolidati", "esponenti e responsabili delle funzioni di controllo sono sempre critici"),
  },
};

const PROFILI: Readonly<Record<string, ProfiloSettore>> = { FIN_BANKING: PROFILO_BANCARIO };

/** Il profilo della famiglia, o quello generico se il settore non ne ha ancora uno. */
export function profiloDi(famiglia: string | null | undefined): ProfiloSettore {
  return (famiglia && PROFILI[famiglia]) || PROFILO_GENERICO;
}

/** La separazione violata da un insieme di etichette, se ce n'è una. */
export function separazioneViolata(
  profilo: ProfiloSettore,
  etichette: ReadonlySet<string>,
): { a: string; b: string; motivo: string } | null {
  return profilo.separazioni.find((s) => etichette.has(s.a) && etichette.has(s.b)) ?? null;
}
