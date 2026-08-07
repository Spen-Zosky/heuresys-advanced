/**
 * measure_concept_retrieval.mjs — misura il recupero per somiglianza sui metadati.
 *
 * Perche' esiste
 * --------------
 * ADR-0033 propone un catalogo di strumenti generici fondato sull'idea che una
 * ricerca semantica sui METADATI di dominio recuperi l'entita' giusta abbastanza
 * spesso. Questo script e' cio' che rende quell'idea falsificabile: vettorizza il
 * corpus dei concetti, pone dieci domande italiane vere, e conta quante volte il
 * concetto giusto e' fra i primi tre.
 *
 * ATTENZIONE — COSTA. Due chiamate Voyage per esecuzione (una per il corpus, una
 * per le domande). Non e' un test da CI: si esegue quando il corpus cambia in modo
 * sostanziale, o quando si vuole rimisurare dopo aver toccato l'atlante.
 *
 * NON SCRIVE NEL DATABASE. I vettori finiscono in `concepts-vectors.json`, che e'
 * gitignored perche' artefatto di misura e non stato. Il referto va in
 * `recupero-misura.json`, quello si' versionato: e' l'evidenza del verdetto.
 *
 * L'ATTESO E' DICHIARATO QUI, nel sorgente, PRIMA di eseguire. E' la regola che
 * rende onesto il punteggio: giudicare dopo aver visto i risultati significa
 * misurare la propria indulgenza. La misura del 2026-08-07 ha dato 6/10 col metro
 * grezzo e 8/10 dopo aver corretto otto nomi di modulo che avevo dichiarato e che
 * NON esistevano — entrambi i numeri restano nell'ADR, perche' la correzione e'
 * avvenuta dopo aver visto i risultati e va dichiarata.
 *
 * Uso:
 *   node docs/kb/tools/measure_concept_retrieval.mjs <repo-root>
 */
import { readFileSync, writeFileSync } from "node:fs";

const REPO = process.argv[2];
if (!REPO) {
  console.error("uso: node docs/kb/tools/measure_concept_retrieval.mjs <repo-root>");
  process.exit(2);
}

const KEY = readFileSync(`${REPO}/.env`, "utf8")
  .split("\n").find((l) => l.startsWith("VOYAGE_API_KEY="))
  ?.slice("VOYAGE_API_KEY=".length).trim();
if (!KEY) { console.error("VOYAGE_API_KEY assente da .env"); process.exit(2); }

const corpus = readFileSync(`${REPO}/docs/kb/atlas/concepts-corpus.jsonl`, "utf8")
  .trim().split("\n").map((l) => JSON.parse(l));

/**
 * Dieci domande che un direttore del personale fa davvero. Varie, e scritte
 * guardando il mestiere e NON il corpus: costruirle sui testi dei concetti
 * misurerebbe la somiglianza di un testo con se stesso.
 */
const DOMANDE = [
  { q: "chi può sostituire il responsabile della filiale di Brescia",
    atteso: ["successor-candidates", "successor-readiness", "succession-pools", "user-target-positions"] },
  { q: "quali competenze mancano di più in azienda",
    atteso: ["skills", "learning-gaps", "capability-maturity", "analytics"] },
  { q: "quali obiettivi sono in ritardo",
    atteso: ["goals", "okrs", "kpi-definitions", "analytics"] },
  { q: "quante ferie ha ancora da prendere Marco Rinaldi",
    atteso: ["time-off", "me"] },
  { q: "chi guadagna più della fascia prevista per il suo ruolo",
    atteso: ["compensation", "job-roles", "analytics"] },
  { q: "quali corsi di formazione deve fare chi lavora in filiale",
    atteso: ["training-initiatives", "content", "learning-paths"] },
  { q: "come è andata l'ultima valutazione dei quadri direttivi",
    atteso: ["assessment-results", "assessments", "talent-review"] },
  { q: "quante persone lavorano nella direzione crediti",
    atteso: ["organization-units", "positions", "users", "org-health"] },
  { q: "ci sono segnalazioni anonime aperte da gestire",
    atteso: ["whistleblowing", "approvals"] },
  { q: "chi è assente oggi nella rete commerciale",
    atteso: ["time-off", "organization-units"] },
];

const embed = async (texts, inputType) => {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ input: texts, model: "voyage-4-lite", input_type: inputType, output_dimension: 1024 }),
  });
  if (!res.ok) throw new Error(`Voyage HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return [...j.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
};

const cos = (a, b) => {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na) * Math.sqrt(nb));
};

console.log(`vettorizzo ${corpus.length} concetti + ${DOMANDE.length} domande (2 chiamate Voyage)…`);
const vecCorpus = await embed(corpus.map((c) => c.text), "document");
const vecDomande = await embed(DOMANDE.map((d) => d.q), "query");
writeFileSync(`${REPO}/docs/kb/atlas/concepts-vectors.json`,
  JSON.stringify({ model: "voyage-4-lite", ids: corpus.map((c) => c.id), vectors: vecCorpus }));

let nei3 = 0, nei5 = 0;
const referto = [];
DOMANDE.forEach((d, i) => {
  const top5 = corpus
    .map((c, j) => ({ id: c.id, s: cos(vecDomande[i], vecCorpus[j]) }))
    .sort((a, b) => b.s - a.s).slice(0, 5);
  const posizione = top5.findIndex((p) => d.atteso.includes(p.id));
  const ok3 = posizione >= 0 && posizione < 3;
  if (ok3) nei3++;
  if (posizione >= 0) nei5++;
  referto.push({ ...d, top5, posizione, ok3 });

  console.log(`\n${i + 1}. «${d.q}»`);
  top5.forEach((p, k) =>
    console.log(`   ${k + 1}. ${p.id.padEnd(34)} ${p.s.toFixed(4)}${d.atteso.includes(p.id) ? "  <== ATTESO" : ""}`));
  console.log(`   ${ok3 ? "SI — nei primi 3" : posizione >= 0 ? `NO — atteso in posizione ${posizione + 1}` : "NO — nessun atteso nei primi 5"}`);
});

console.log(`\n${"=".repeat(70)}\nnei primi 3 : ${nei3}/${DOMANDE.length}\nnei primi 5 : ${nei5}/${DOMANDE.length}`);
writeFileSync(`${REPO}/docs/kb/atlas/recupero-misura.json`, JSON.stringify(referto, null, 2));
