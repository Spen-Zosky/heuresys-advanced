// PACCHETTO DI PROVA v0.3 — NON e' il pacchetto del caso banca. Lo costruisce questo script, solo per provare il caricatore (O2-02).
//
// Il pacchetto v0.3 del caso banca (PE-5) lo deposita il datastore; finche' non c'e', la prova gira su questo: parte da un pacchetto v0.2 vero del datastore
// (cosi' il contenuto vecchio e' reale), lo converte come fa il convertitore del datastore (marca dello schema, `meta.origine`, `meta.completezza`) e
// aggiunge le sezioni e i campi della v0.3 in due modi:
//   pieno  = ogni sezione e ogni campo nuovo dello schema e' presente almeno una volta, con le varianti che le colonne non distinguono da sole
//            (campo assente, campo null esplicito, lista presente ma vuota, legame detto da due lati, traduzione inglese con la sua origine);
//   perimetro-senza-voci = come pieno, ma il perimetro e' un fascicolo senza voci (ADR-0046 §1: lo stato resta NON_RILASCIATO);
//   vuoto  = come la conversione della banca (PE-5): le otto sezioni nuove dichiarate vuote (null o []) e dichiarate in `vuoti`, nessun campo nuovo.
// Il contenuto aggiunto e' inventato per la prova: i suoi codici si ricavano dai codici veri del pacchetto di partenza, il testo e' di prova.
// Il risultato passa la convalida (schema v0.3 + limiti del database) o lo script si ferma.
//
// Uso:  node db/scripts/pacchetto/costruisci-pacchetto-prova-v03.mjs <pacchetto_v02.json> <uscita.json> <pieno|vuoto|perimetro-senza-voci>
import fs from "node:fs";
import crypto from "node:crypto";
import { convalida } from "./convalida-pacchetto.mjs";

const [IN, OUT, MODO] = process.argv.slice(2);
if (!IN || !OUT || !["pieno", "vuoto", "perimetro-senza-voci"].includes(MODO)) throw new Error("uso: <pacchetto_v02.json> <uscita.json> <pieno|vuoto|perimetro-senza-voci>");
const grezzo = fs.readFileSync(IN);
const P = JSON.parse(grezzo.toString("utf8"));
if (P.meta.schema !== "heuresys.prototipo.pacchetto/0.2") throw new Error("serve un pacchetto v0.2");

const T = (it, en, enOrigine = "LLM") => (en ? { it, en, enOrigine } : { it });
const PR = (n) => ({ fonti: [P.prove[n % P.prove.length].id] });
const SENZA = { fonti: [], senzaRiscontro: true };

// ---- la conversione (come converti_v03.ts del datastore: non inventa niente, marca e dichiara)
const D = structuredClone(P);
D.meta.schema = "heuresys.prototipo.pacchetto/0.3";
D.meta.origine = { schema: "heuresys.prototipo.pacchetto/0.2", convertitoIl: "2026-10-17T12:00:00.000Z", convertitore: "prova-o2-02/costruisci-pacchetto-prova-v03", impronta: crypto.createHash("sha256").update(grezzo).digest("hex") };
D.meta.completezza = { completo: false, passiAccettati: 20, passiCascata: 21, nota: T("Pacchetto di prova per il caricatore: non e' un caso completo.", "Test package for the loader: not a complete case.") };

if (MODO === "vuoto") {
  Object.assign(D, { strategia: null, capability: [], ruoli: [], decisioni: [], entita: [], agenti: [], principi: [], perimetro: null });
  D.vuoti = [...(D.vuoti ?? []), ...["strategia", "capability", "ruoli", "decisioni", "entita", "agenti", "principi", "perimetro"].map((dominio) => ({ dominio, motivo: T("Sezione nuova della v0.3, dichiarata vuota (prova).") }))];
} else {
  const pos = P.posizioni.filter((x) => x.processiCodici.length >= 2 && /^CCNL_CREDITO_(QD|3A)/.test(x.livelloCcnl));
  const [a, b, c, d] = pos; // quattro posizioni vere con almeno due processi e un livello del CCNL del credito (37 ore settimanali)
  const proc = P.processi.map((x) => x.codice);
  const sk = P.competenze.map((x) => x.codice);
  const ob = P.obiettivi.map((x) => x.codice);
  const kp = P.indicatori.map((x) => x.codice);
  const sedi = P.sedi.map((x) => x.codice);
  const ccnl = P.ccnl[0].codice;

  // -- campi nuovi sulle sezioni che c'erano
  P.unita.slice(0, 3).forEach((_, i) => { D.unita[i].mandato = T(`Mandato dell'unita' ${i} (prova)`, i === 0 ? `Mandate of unit ${i} (test)` : undefined); });
  D.unita[0].budget = { centro: "COSTO", voce: T("Spese di funzionamento", "Operating costs", "MANUAL") };
  D.unita[1].budget = { centro: "RICAVO" };
  D.posizioni.forEach((x) => { if (x.codice === a.codice) Object.assign(x, { ruoloCodice: "RUO_RESP", ccnlCodice: ccnl, tipiResponsabilita: ["GERARCHICA", "DI_PROCESSO"], oreProcessi: [{ processoCodice: a.processiCodici[0], oreSettimanali: 20 }, { processoCodice: a.processiCodici[1], oreSettimanali: 14.5 }] });
    if (x.codice === b.codice) Object.assign(x, { ruoloCodice: null, riportoFunzionale: null, tipiResponsabilita: [], oreProcessi: [] });
    if (x.codice === c.codice) Object.assign(x, { riportoFunzionale: a.codice, ruoloCodice: "RUO_ANALISTA", oreProcessi: [{ processoCodice: c.processiCodici[0], oreSettimanali: 30 }, { processoCodice: proc.find((p) => !c.processiCodici.includes(p)), oreSettimanali: 10 }] }); // 40 ore > 37: la regola delle ore marca
    if (x.codice === d.codice) Object.assign(x, { ccnlCodice: null }); });
  D.processi.forEach((x, i) => {
    if (i === 0) Object.assign(x, { capabilityCodici: ["CAP_CREDITO", "CAP_RISCHIO"], fasi: [
      { codice: "P01_F1", nome: T("Raccolta dei dati", "Data collection"), ordine: 0, ingresso: T("Richiesta interna"), uscita: T("Dati raccolti", "Collected data", "MANUAL"), esecutore: { tipo: "POSIZIONE", codice: a.codice }, naturaLavoro: "PERSONA", erogazione: "INTERNO", oreTipichePerCiclo: 2.5 },
      { codice: "P01_F2", nome: T("Controllo assistito"), ordine: 1, esecutore: { tipo: "RUOLO", codice: "RUO_ANALISTA" }, naturaLavoro: "ASSISTITO_AI", erogazione: "SERVIZIO_CONDIVISO", oreTipichePerCiclo: null },
      { codice: "P01_F3", nome: T("Esecuzione automatica"), ordine: 2, esecutore: { tipo: "AGENTE", codice: "AG_CONTROLLO" }, naturaLavoro: "AGENTE_SUPERVISIONATO", erogazione: "ESTERNO" }] });
    if (i === 1) Object.assign(x, { capabilityCodici: ["CAP_PAGAMENTI"], fasi: [] });
    if (i === 2) Object.assign(x, { capabilityCodici: [], fasi: [{ codice: "P03_F1", nome: T("Fase senza esecutore"), ordine: 0, esecutore: null }] });
  });
  D.indicatori.slice(0, 6).forEach((x, i) => {
    Object.assign(x, { perimetro: T(`Perimetro dell'indicatore ${i}`), famiglia: ["RISULTATO", "QUALITA", "RISCHIO", "CARICO", "RISULTATO", "QUALITA"][i], esclusioni: i === 0 ? T("Esclusi i conti dormienti", "Excluding dormant accounts") : undefined,
      baseline: { valore: i === 1 ? null : 10 + i, data: "2026-06-30", ...(i === 0 ? { nota: T("Misura al 30 giugno", "Measured at 30 June") } : {}) },
      responsabilePosizioneCodice: i === 0 ? a.codice : i === 1 ? null : undefined });
    x.bersaglio = { ...(x.bersaglio ?? {}), periodo: i === 0 ? { dal: "2026-07-01", al: "2026-12-31" } : i === 1 ? { dal: "2026-07-01", al: null } : { dal: "2026-07-01" } };
  });
  // obiettivi d'impresa (al piu' cinque) e livello/padre/capability sugli altri
  const g0 = P.obiettivi[0];
  const impresa = [1, 2, 3, 4, 5].map((n) => ({ ...structuredClone(g0), codice: `OIMP${n}`, titolo: T(`Obiettivo d'impresa ${n} (prova)`), processoCodice: null, unitaCodice: null, posizioneCodice: null, livello: "IMPRESA", ...PR(n) }));
  D.obiettivi.slice(0, 6).forEach((x, i) => { Object.assign(x, { livello: ["PROCESSO", "UNITA", "RUOLO", "PROCESSO", "UNITA", "RUOLO"][i], padre: i === 3 ? null : "OIMP1", capabilityCodice: i === 0 ? "CAP_CREDITO" : i === 1 ? null : undefined }); });
  D.obiettivi.push(...impresa);
  D.commesse[0].natura = "PROGETTO";
  D.commesse[0].composizione = [{ attore: { tipo: "POSIZIONE", codice: D.commesse[0].posizioniCodici[0] }, quotaCapacita: 0.5 }, { attore: { tipo: "RUOLO", codice: "RUO_RESP" }, quotaCapacita: 0.25 }, { attore: { tipo: "AGENTE", codice: "AG_CONTROLLO" }, quotaCapacita: 0.125 }, { attore: { tipo: "POSIZIONE", codice: a.codice }, quotaCapacita: 1 }];
  D.commesse[0].obiettiviCodici = [ob[0], ob[1]];
  D.commesse[1].natura = "TEAM_STABILE"; D.commesse[1].composizione = [];

  // -- le otto sezioni nuove
  D.strategia = {
    leva: { prevalente: "QUALITA", secondaria: null, motivazione: T("Competono sulla qualita' del servizio (prova)", "They compete on service quality (test)"), ...PR(1) },
    segmenti: [{ codice: "SEG_FAMIGLIE", nome: T("Famiglie", "Households"), descrizione: T("Clientela retail"), canale: "FISICO", ...PR(2) }, { codice: "SEG_PMI", nome: T("Piccole imprese"), canale: "MISTO", ...SENZA }],
    lineeOfferta: [{ codice: "LIN_CREDITO", nome: T("Credito"), condividonoCompetenze: true, condividonoImpianti: false, ...PR(3) }, { codice: "LIN_RACCOLTA", nome: T("Raccolta", "Deposits"), ...PR(4) }],
    ambizione: { crescita: "MODERATA", presenzaEstera: "NESSUNA", ...PR(5) },
    competenzeScarse: [],
    priorita: [0, 1, 2, 3, 4].map((n) => ({ codice: `PRI_${n}`, nome: T(`Priorita' ${n}`), ...(n === 0 ? { descrizione: T("La prima", "The first") } : {}), ...(n < 3 ? { obiettivoCodice: ob[n] } : n === 3 ? { obiettivoCodice: null } : {}), ...PR(n + 6) })),
  };
  D.capability = [
    { codice: "CAP_CREDITO", nome: T("Erogare credito", "Lend"), descrizione: T("Valutare e concedere credito"), natura: "DISTINTIVA", criticita: "CRITICAL", processiCodici: [proc[0], proc[1]], competenzeCodici: [sk[0], sk[1]], strumentiDati: [T("Sistema di scoring", "Scoring system"), T("Archivio crediti")], coordinamento: T("Comitato crediti", "Credit committee"), ...PR(11) },
    { codice: "CAP_RISCHIO", nome: T("Governare il rischio"), natura: "NECESSARIA", processiCodici: [proc[0], proc[4]], competenzeCodici: [], ...PR(12) },
    { codice: "CAP_PAGAMENTI", nome: T("Gestire i pagamenti"), natura: "DI_SUPPORTO", criticita: "LOW", processiCodici: [], ...SENZA },
  ];
  D.ruoli = [
    { codice: "RUO_RESP", nome: T("Responsabile di ufficio", "Office manager"), missione: T("Guida un ufficio e ne risponde", "Leads and answers for an office"), famigliaProfessionale: T("Direzione operativa", "Operations management"),
      occupazioneEsco: { uri: "http://data.europa.eu/esco/occupation/f5166c6b-3467-4fc4-9343-d12e870d9def", nome: T("responsabile del centro contatti", "contact centre manager", "ESCO") }, professioneCp2021: "1.2.1.1.0",
      attivita: [{ processoCodice: proc[0], faseCodice: "P01_F1" }, { processoCodice: proc[1], faseCodice: null }, { processoCodice: proc[2] }],
      competenze: [{ competenzaCodice: sk[0], livello: "BASE", processoCodice: proc[0] }, { competenzaCodice: sk[1], livello: "INTERMEDIO" }, { competenzaCodice: sk[2], livello: "AVANZATO", processoCodice: null }], impattoAi: "ALTO", ...PR(13) },
    { codice: "RUO_ANALISTA", nome: T("Analista"), missione: T("Analizza i dati"), professioneCp2021: null, attivita: [], impattoAi: null, ...SENZA },
    { codice: "RUO_SPORTELLO", nome: T("Addetto di sportello"), missione: T("Serve la clientela allo sportello", "Serves customers at the counter"), ...PR(14) },
  ];
  D.decisioni = [
    { codice: "DEC_FIDO", processoCodice: proc[0], descrizione: T("Concedere un fido", "Grant a credit line"), frequenza: "GIORNALIERA", diritti: [{ diritto: "PROPONE", attore: { tipo: "POSIZIONE", codice: b.codice } }, { diritto: "DECIDE", attore: { tipo: "POSIZIONE", codice: a.codice } }, { diritto: "ESEGUE", attore: { tipo: "RUOLO", codice: "RUO_SPORTELLO" } }],
      escalation: { soglia: T("Oltre 250.000 euro", "Above 250,000 euro"), saleA: { tipo: "POSIZIONE", codice: c.codice } }, ...PR(15) },
    { codice: "DEC_DUE_DECIDE", processoCodice: proc[1], descrizione: T("Decisione con due decisori (marcata)"), diritti: [{ diritto: "DECIDE", attore: { tipo: "POSIZIONE", codice: a.codice } }, { diritto: "DECIDE", attore: { tipo: "POSIZIONE", codice: b.codice } }], ...SENZA },
    { codice: "DEC_NESSUN_DECIDE", processoCodice: proc[2], descrizione: T("Decisione senza decisore (marcata)"), diritti: [{ diritto: "PROPONE", attore: { tipo: "AGENTE", codice: "AG_CONTROLLO" } }], ...PR(16) },
  ];
  D.entita = [
    { codice: "ENT_BANCA", nome: T("Banca S.p.A."), formaGiuridica: "S.p.A.", paese: "IT", sediCodici: sedi, ...PR(17) },
    { codice: "ENT_ESTERA", nome: T("Filiale estera", "Foreign branch"), paese: "CH", sediCodici: ["SEDE_NON_NEL_PACCHETTO"], ...SENZA },
  ];
  D.agenti = [
    { codice: "AG_CONTROLLO", nome: T("Agente di controllo", "Control agent"), descrizione: T("Controlla le pratiche"), tipo: "CONTROLLORE", attivita: [{ processoCodice: proc[0], faseCodice: "P01_F3" }, { processoCodice: proc[1] }], responsabile: { tipo: "RUOLO", codice: "RUO_ANALISTA" }, misure: [kp[0], kp[1]], ...PR(18) },
    { codice: "AG_ASSISTENTE", nome: T("Assistente"), attivita: [], responsabile: { tipo: "POSIZIONE", codice: a.codice }, ...SENZA },
  ];
  D.principi = [
    { codice: "PRN_AUTONOMIA", ambito: "AUTONOMIA", enunciato: T("Le filiali decidono entro soglia", "Branches decide within a threshold"), ...PR(19) },
    { codice: "PRN_COORD", ambito: "COORDINAMENTO", enunciato: T("Un solo coordinamento per processo"), ...SENZA },
    { codice: "PRN_ALTRO", ambito: "ALTRO", enunciato: T("Nessun altro vincolo"), ...PR(20) },
  ];
  D.perimetro = { fascicoloVersione: 2, estendeVersione: null, richiestaEstensione: T("Estendere alle professioni di filiale", "Extend to branch professions"), voci: {
    professioni: [{ schema: "CP2021", codice: "1.2.1.1.0", uri: "https://example.invalid/cp2021/1.2.1.1.0", nome: T("Dirigenti", "Managers"), usataDalModello: true }, { schema: "ESCO_OCCUPAZIONE", codice: "ESCO_OCC_1", usataDalModello: false }, { schema: "ISCO_08", codice: "1211", nome: T("Direttori finanziari") }],
    competenze: [{ schema: "ESCO_COMPETENZA", codice: "ESCO_SK_1", usataDalModello: true }],
    processi: [{ schema: "APQC_PCF", codice: "1.2", nome: T("Definire la strategia"), usataDalModello: true }],
    indicatori: [],
    attivitaEconomiche: [{ schema: "ATECO_2025", codice: "64.19", usataDalModello: true }, { schema: "NACE_2_1", codice: "K64.19" }],
  } };
  if (MODO === "perimetro-senza-voci") D.perimetro.voci = {};
}

const cv = convalida(D);
if (!cv.ok) { console.error("il pacchetto costruito non passa la convalida:\n  " + cv.errori.join("\n  ")); process.exit(1); }
fs.writeFileSync(OUT, JSON.stringify(D));
console.log(JSON.stringify({ uscita: OUT, modo: MODO, schema: cv.schema, convalida: "ok", byte: fs.statSync(OUT).size }));
