// Controlli automatici sui testi e sui nodi. Ogni controllo ha un codice stabile:
// il rapporto e il piano raggruppano per codice, e il profilo del progetto può
// dichiarare eccezioni per codice + testo (mai eccezioni generiche).
const EN = new Set('the and of to with for from your you this that are is was be been not no yes save cancel delete edit view details settings submit close next previous back search loading error errors success failed new add remove update create select all none open show hide more less filter filters sort clear apply reset download upload export import name status type total page pages of items item user users role roles team overview summary report reports help logout sign account profile home actions action required optional confirm warning info empty available unavailable active inactive pending approved rejected draft enabled disabled'.split(' '));
const IT = new Set('il lo la i gli le di da con per su tra fra un una uno e è non sì si salva annulla elimina modifica vedi dettagli impostazioni invia chiudi avanti indietro cerca caricamento errore errori successo nuovo nuova aggiungi rimuovi aggiorna crea seleziona tutti tutte nessuno nessuna apri mostra nascondi altro filtro filtri ordina pulisci applica scarica carica esporta importa nome stato data tipo totale pagina pagine elementi utente utenti ruolo ruoli squadra panoramica riepilogo rapporto aiuto esci accedi password profilo azioni obbligatorio facoltativo conferma attenzione vuoto disponibile attivo attiva in attesa approvato bozza del della dei delle al alla ai alle nel nella che come dove quando'.split(' '));

const RE = {
  uuid: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i,
  codice: /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/,
  chiave: /^[a-z][a-zA-Z0-9]*(?:[._][a-zA-Z0-9]+){2,}$/,
  tecnico: /(^|\s)(null|undefined|NaN|\[object Object\]|Invalid Date|true|false)(\s|$)/,
  dataIso: /\b\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?\b/,
  numEn: /\b\d{1,3}(,\d{3})+(\.\d+)?\b/,     // 1,234.56 : formato inglese
  numIt: /\b\d{1,3}(\.\d{3})+(,\d+)?\b/,     // 1.234,56 : formato italiano
  numNudo: /(^|[^\d.,/-])\d{5,}([^\d.,/-]|$)/, // 12345 senza separatori (non anni, non codici brevi)
  dataUs: /\b(0?[1-9]|1[0-2])\/(1[3-9]|2\d|3[01])\/\d{4}\b/, // 3/27/2026
};

export function lingua(testo) {
  const parole = testo.toLowerCase().match(/[a-zàèéìòù]+/g) || [];
  let en = 0, it = 0;
  for (const p of parole) { if (EN.has(p)) en++; if (IT.has(p)) it++; }
  return { en, it, parole: parole.length };
}

// restituisce un elenco di rilievi {codice, esito: FAIL|GIUDIZIO, dettaglio}
export function controllaTesto(t, contesto) {
  const out = [];
  const s = t.testo, lang = (contesto.linguaAttesa || 'it').slice(0, 2);
  const ecc = contesto.eccezioni || [];
  const salta = (cod) => ecc.some(e => e.codice === cod && (e.testo === s || (e.regex && new RegExp(e.regex).test(s))));
  const add = (codice, esito, dettaglio) => { if (!salta(codice)) out.push({ codice, esito, dettaglio }); };
  if (RE.uuid.test(s)) add('T-UUID', 'FAIL', 'identificativo tecnico mostrato a una persona: ' + s.match(RE.uuid)[0]);
  if (RE.codice.test(s)) add('T-CODICE', 'FAIL', 'codice al posto di una descrizione: ' + s.match(RE.codice)[0]);
  if (RE.chiave.test(s.trim()) && !/^https?:|@|\.(com|it|org|net|pdf|csv|xlsx)$/i.test(s)) add('T-CHIAVE', 'FAIL', 'chiave di traduzione o nome tecnico non risolto: ' + s.trim());
  const tec = s.match(RE.tecnico); if (tec) add('T-TECNICO', 'FAIL', 'valore tecnico in chiaro: «' + tec[2] + '»');
  const iso = s.match(RE.dataIso); if (iso) add('T-DATA-ISO', 'FAIL', 'data in formato macchina: ' + iso[0]);
  if (lang === 'it' && RE.numEn.test(s)) add('T-NUMERO-EN', 'FAIL', 'numero in formato inglese in pagina italiana: ' + s.match(RE.numEn)[0]);
  if (lang === 'en' && RE.numIt.test(s)) add('T-NUMERO-IT', 'FAIL', 'numero in formato italiano in pagina inglese: ' + s.match(RE.numIt)[0]);
  if (RE.numNudo.test(s) && !/\b(19|20)\d{2}\b/.test(s.match(RE.numNudo)[0])) add('T-NUMERO-NUDO', 'GIUDIZIO', 'numero lungo senza separatori: ' + s.match(RE.numNudo)[0].trim());
  if (lang === 'it' && RE.dataUs.test(s)) add('T-DATA-US', 'FAIL', 'data in formato americano: ' + s.match(RE.dataUs)[0]);
  const l = lingua(s.replace(new RegExp(RE.codice.source, 'g'), ' ').replace(RE.uuid, ' '));
  if (lang === 'it' && l.en > 0 && (l.en > l.it || (l.parole === 1 && l.en === 1)) && !(contesto.glossario || []).some(g => s.toLowerCase() === g.toLowerCase())) add('T-LINGUA', 'FAIL', 'testo in inglese in pagina italiana: «' + s.slice(0, 80) + '»');
  if (lang === 'en' && l.it > 0 && l.it > l.en) add('T-LINGUA', 'FAIL', 'testo in italiano in pagina inglese: «' + s.slice(0, 80) + '»');
  if (t.troncato) add('T-TRONCATO', t.haTitolo ? 'GIUDIZIO' : 'FAIL', t.haTitolo ? 'testo troncato, il testo intero è nel suggerimento' : 'testo troncato senza modo di leggerlo intero');
  if (t.fuori) add('T-FUORI', 'FAIL', 'testo che esce dalla finestra');
  if (t.corpo && parseFloat(t.corpo) < 11) add('T-CORPO', 'GIUDIZIO', 'corpo del testo ' + t.corpo + ': leggibile?');
  return out;
}

// stessa etichetta resa in modi diversi nello stesso giro (es. «Salva» e «Save», «Data inizio» e «Inizio»)
export function incoerenzeEtichette(etichette) {
  const perChiave = new Map();
  for (const e of etichette) { const k = e.toLowerCase().replace(/[^a-zàèéìòù]/g, ''); if (!perChiave.has(k)) perChiave.set(k, new Set()); perChiave.get(k).add(e); }
  return [...perChiave.values()].filter(s => s.size > 1).map(s => [...s]);
}
