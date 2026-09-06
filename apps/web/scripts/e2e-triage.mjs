#!/usr/bin/env node
/**
 * apps/web/scripts/e2e-triage.mjs — #219 F5, S1088.
 *
 * LEGGE I REFERTI DI UNA CORSA INTEGRALE E RAGGRUPPA I FALLITI PER **FIRMA**.
 *
 * Perche' esiste. Il triage della corsa di `#219` e' stato rifatto a mano tre volte
 * (S1081, S1085, S1087), ogni volta con lo stesso ragionamento e ogni volta senza
 * lasciare uno strumento. Un'operazione che si ripete a mano piu' di due volte e' uno
 * strumento che manca — e qui il costo non e' solo il tempo: un triage a mano
 * **campiona**, e la voce `#219` nasce esattamente dal difetto opposto («sono FIRME,
 * non cause»: due test con la stessa firma hanno probabilmente la stessa causa, e per
 * vederlo bisogna averli contati tutti).
 *
 * ⚠ QUESTO STRUMENTO NON DIAGNOSTICA. Raggruppa e conta. L'ipotesi di causa la scrive
 * una persona leggendo il gruppo — e la dottrina di `#219` dice che va **riprodotta**
 * prima di essere creduta: la firma registrata dal triage si e' rivelata imprecisa o
 * sbagliata in F2, F3 e F4, cioe' tre volte su tre.
 *
 * Uso (dalla radice di apps/web, dopo `node scripts/e2e-blocchi.mjs`):
 *   node scripts/e2e-triage.mjs                     # sul terminale
 *   node scripts/e2e-triage.mjs --out ../../.programmi/219-triage-<data>.txt
 *   node scripts/e2e-triage.mjs --fasi 2,3,4        # solo alcune fasi
 *
 * Codici d'uscita — l'esito e' un VERDETTO, non un dettaglio:
 *   0  nessun fallito in nessuna fase letta
 *   1  almeno un fallito  (oppure: test non eseguiti, che non e' «passato»)
 *   2  nessun referto leggibile — NON MISURABILE, che non e' «va bene»
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = resolve(HERE, "..");

const argv = process.argv.slice(2);
const arg = (nome) => {
  const i = argv.indexOf(nome);
  return i >= 0 ? argv[i + 1] : undefined;
};
const FASI = (arg("--fasi") ?? "1,2,3,4").split(",").map((s) => Number(s.trim()));
const OUT = arg("--out");
/**
 * `--dettaglio N`: sotto ogni firma, il messaggio INTERO dei primi N casi.
 *
 * Serve a distinguere cose che la firma da sola confonde. Misurato in S1088: la firma
 * «expect(received).toBe(expected)» copre da sola 11 casi, e senza il corpo del
 * messaggio non si vede se dietro c'e' un 403 (permesso), un 400 (validazione) o un
 * 500 — che sono tre cause diverse con tre cure diverse. Un triage che non lo
 * distingue e' un triage che sembra fatto.
 */
const DETTAGLIO = Number(arg("--dettaglio") ?? 0);

/** Ogni `spec` di Playwright porta i suoi `tests`, e ogni test i suoi `results`. */
function* percorriSpec(nodo) {
  if (!nodo || typeof nodo !== "object") return;
  for (const s of nodo.suites ?? []) yield* percorriSpec(s);
  for (const spec of nodo.specs ?? []) yield spec;
}

/**
 * La FIRMA e' la prima riga significativa del messaggio d'errore, **ripulita dai
 * dettagli che cambiano fra un caso e l'altro** — se non si ripulisce, ogni test ha una
 * firma propria e il raggruppamento non raggruppa niente, cioe' lo strumento sembra
 * funzionare e non serve a nulla.
 *
 * Cosa si toglie, e perche':
 *  · i codici ANSI, che Playwright inserisce anche nel JSON;
 *  · il **testo del locator**, che nomina l'elemento specifico del caso;
 *  · i numeri di riga e i millisecondi, che variano per definizione.
 * Cosa NON si tocca: il tipo di errore e il verbo. Sono cio' che distingue una causa
 * dall'altra, ed e' l'unica parte su cui il raggruppamento deve poter sbagliare in modo
 * visibile.
 */
const senzaAnsi = (t) => String(t ?? "").replace(/\u001b\[[0-9;]*m/g, "");

function firma(messaggio) {
  const pulito = senzaAnsi(messaggio)
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean);
  const prima = pulito.find((r) => r && !r.startsWith("at ")) ?? "(errore senza messaggio)";
  return prima
    .replace(/getBy\w+\([^)]*\)/g, "getBy…()")
    .replace(/locator\([^)]*\)/g, "locator(…)")
    .replace(/\b\d+(\.\d+)?m?s\b/g, "<tempo>")
    .replace(/:\d+:\d+/g, ":<riga>")
    .slice(0, 160);
}

const righe = [];
const dice = (s = "") => righe.push(s);

let fasiLette = 0;
let totFalliti = 0;
let totNonEseguiti = 0;
let totAttesi = 0;
const firmeGlobali = new Map();

dice(`TRIAGE DELLA CORSA INTEGRALE — ${new Date().toISOString().slice(0, 10)}`);
dice("=".repeat(80));
dice("Prodotto da: node scripts/e2e-triage.mjs  (legge apps/web/.e2e-fase-N.json)");
dice("Raggruppa i NON RIUSCITI per FIRMA d'errore, non per file — due test con la");
dice("stessa firma hanno PROBABILMENTE la stessa causa. La dottrina di #219 dice che");
dice("l'ipotesi va riprodotta prima di essere creduta: la firma registrata dal triage");
dice("si e' rivelata sbagliata tre volte su tre (F2, F3, F4).");
dice("");

for (const n of FASI) {
  const p = join(WEB_DIR, `.e2e-fase-${n}.json`);
  if (!existsSync(p)) {
    dice(`### .e2e-fase-${n}.json — ASSENTE: questa fase non e' stata letta (NON MISURABILE)`);
    dice("");
    continue;
  }
  let doc;
  try {
    doc = JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    dice(`### .e2e-fase-${n}.json — ILLEGGIBILE (${e.constructor.name}): non si conta come verde`);
    dice("");
    continue;
  }
  fasiLette += 1;

  const gruppi = new Map();
  let attesi = 0;
  let falliti = 0;
  let instabili = 0;
  let saltati = 0;

  for (const spec of percorriSpec(doc)) {
    for (const t of spec.tests ?? []) {
      const stato = t.status; // expected · unexpected · flaky · skipped
      if (stato === "expected") attesi += 1;
      else if (stato === "flaky") instabili += 1;
      else if (stato === "skipped") saltati += 1;
      else if (stato === "unexpected") {
        falliti += 1;
        const err = (t.results ?? []).flatMap((r) => r.errors ?? [])[0];
        const f = firma(err?.message ?? (t.results ?? [])[0]?.error?.message);
        const titolo = `${spec.file} › ${spec.title}`.slice(0, 110);
        if (!gruppi.has(f)) gruppi.set(f, []);
        gruppi.get(f).push({ titolo, corpo: String(err?.message ?? "") });
        if (!firmeGlobali.has(f)) firmeGlobali.set(f, 0);
        firmeGlobali.set(f, firmeGlobali.get(f) + 1);
      }
    }
  }

  totAttesi += attesi;
  totFalliti += falliti;
  totNonEseguiti += saltati;

  dice(`### .e2e-fase-${n}.json  —  attesi ${attesi} · non riusciti ${falliti} · ` +
       `instabili ${instabili} · saltati ${saltati}`);
  if (gruppi.size === 0) dice("  (nessun test non riuscito)");
  for (const [f, casi] of [...gruppi.entries()].sort((a, b) => b[1].length - a[1].length)) {
    dice("");
    dice(`  [${casi.length}x] ${f}`);
    for (const c of casi) dice(`        · ${c.titolo}`);
    for (const c of casi.slice(0, DETTAGLIO)) {
      dice("");
      dice(`        ┌─ ${c.titolo}`);
      for (const r of senzaAnsi(c.corpo).split("\n").slice(0, 22)) {
        dice(`        │ ${r}`);
      }
      dice("        └─");
    }
  }
  dice("");
}

dice("=".repeat(80));
if (fasiLette === 0) {
  dice("NESSUN REFERTO LETTO — l'esito e' NON MISURABILE, che non e' «va bene».");
} else {
  dice(`ESITO COMPLESSIVO: ${totFalliti === 0 && totNonEseguiti === 0 ? "VERDE" : "ROSSO"} — ` +
       `${totAttesi} attesi · ${totFalliti} falliti · ${totNonEseguiti} non eseguiti ` +
       `(su ${fasiLette} fasi lette)`);
  if (totNonEseguiti > 0) {
    dice("⚠ «non eseguito» NON e' «passato»: un test saltato non ha misurato niente.");
  }
  if (firmeGlobali.size > 0) {
    dice("");
    dice("LE FIRME, sommate su tutte le fasi — la piu' numerosa e' la prima da riprodurre:");
    for (const [f, n] of [...firmeGlobali.entries()].sort((a, b) => b[1] - a[1])) {
      dice(`  [${String(n).padStart(3)}x] ${f}`);
    }
  }
}

const testo = righe.join("\n") + "\n";
if (OUT) {
  writeFileSync(resolve(WEB_DIR, OUT), testo, "utf8");
  console.log(`triage scritto in ${resolve(WEB_DIR, OUT)}`);
} else {
  process.stdout.write(testo);
}

process.exitCode = fasiLette === 0 ? 2 : (totFalliti > 0 || totNonEseguiti > 0 ? 1 : 0);
