#!/usr/bin/env node
/**
 * apps/web/scripts/e2e-blocchi.mjs — #211 ①, S1068.
 *
 * ESEGUE LA SUITE COMPLETA IN FASI SEPARATE, E CONTA CIO' CHE HA ESEGUITO.
 *
 * IL DIFETTO CHE QUESTO SCRIPT ESISTE PER NON RIPETERE. La sessione dura 15 minuti e il
 * blocco `chromium` durava di piu': i test che chiamano l'API con `page.request` si
 * prendevano un 401 e quelli che navigano il redirect al login — la famiglia piu'
 * numerosa dei 35 rossi di #211, e nessuno di quei rossi era un guasto del prodotto.
 * La prima cura spezzava il blocco in tre mettendo ogni re-login a DIPENDERE dal blocco
 * precedente. Misurato sulla corsa di prova:
 *
 *     3 failed · 164 passed · 263 DID NOT RUN
 *
 * perche' in Playwright un progetto la cui dipendenza fallisce viene **saltato**: tre
 * rossi nel primo blocco — di famiglie che quella cura non toccava — hanno impedito a
 * due terzi della suite di girare. In silenzio, con un'uscita che sembrava piu' verde
 * del vero. Cioe' la cura aveva reintrodotto il difetto che #211 racconta.
 *
 * LA CURA DELLA CURA: le fasi diventano INVOCAZIONI SEPARATE di Playwright. Processi
 * separati non hanno dipendenze fra loro, quindi un rosso non puo' impedire niente a
 * valle. E lo script fa la cosa che mancava: **conta**. Somma i test eseguiti da tutte
 * le fasi e li confronta col totale che `--list` dichiara. Se non torna, esce ROSSO
 * anche se ogni singola fase fosse verde — perche' «non ho eseguito» non e' «passato».
 *
 * Uso (dalla radice di apps/web):
 *   node scripts/e2e-blocchi.mjs                       # tutte le fasi
 *   node scripts/e2e-blocchi.mjs --fase 2              # solo la fase 2 (iterazione)
 *   E2E_BLOCCHI_NODE22=0 node scripts/e2e-blocchi.mjs  # senza il wrapper Node 22
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = resolve(HERE, "..");
const CONFIG = "playwright.prod.config.ts";

/**
 * Le fasi si LEGGONO dalla config — una sola fonte, o le due divergono in silenzio e la
 * fase mancante non gira.
 *
 * Si passa da `tsx` e non da un `import()` diretto: la config e' TypeScript e importa
 * `./playwright.config` senza estensione, che Node da solo non risolve (misurato:
 * «Cannot find module …/playwright.config»). Un `import()` in un try/catch avrebbe
 * funzionato per caso o non funzionato per caso — questa via e' l'unica, quindi e'
 * prevedibile.
 */
const FASI = (() => {
  const r = spawnSync(
    process.execPath,
    [
      join(WEB_DIR, "node_modules", "tsx", "dist", "cli.mjs"),
      "--eval",
      `import {FASI} from "./${CONFIG}"; console.log("__FASI__" + JSON.stringify(FASI));`,
    ],
    { cwd: WEB_DIR, encoding: "utf8" },
  );
  const riga = `${r.stdout ?? ""}`.split("\n").find((l) => l.includes("__FASI__"));
  if (r.status !== 0 || !riga) {
    console.error(
      "e2e-blocchi: non riesco a leggere FASI dalla config — mi fermo invece di indovinare.\n" +
        `${r.stderr ?? ""}`.slice(0, 600),
    );
    process.exit(2);
  }
  return JSON.parse(riga.slice(riga.indexOf("__FASI__") + 8));
})();

if (!Array.isArray(FASI) || FASI.length === 0) {
  console.error("e2e-blocchi: FASI vuoto — una suite senza fasi e' un falso verde");
  process.exit(2);
}

/** Come si invoca Playwright: attraverso il wrapper Node 22 quando serve (D-36). */
const usaWrapper = process.env.E2E_BLOCCHI_NODE22 !== "0";
function playwright(args, ambiente) {
  const cmd = usaWrapper
    ? [join(HERE, "e2e-node22.mjs"), ...args]
    : [join(WEB_DIR, "node_modules", "@playwright", "test", "cli.js"), ...args];
  // L'uscita si CATTURA e si ri-stampa, invece di ereditarla: senza leggerla non si
  // possono contare i casi, e contare le FASI non basta — vedi `conta()`.
  const r = spawnSync(process.execPath, cmd,
    { cwd: WEB_DIR, encoding: "utf8", env: { ...process.env, ...(ambiente ?? {}) } });
  const testo = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  process.stdout.write(testo);
  return { status: r.status ?? 1, testo };
}

/**
 * I casi di una fase, letti dal riepilogo di Playwright.
 *
 * ⚠ PERCHE' ESISTE, e nasce da un difetto di questo stesso script. La prima stesura
 * stampava «test dichiarati da --list: 434 · fasi eseguite: 4/4 — tutte, quindi nessun
 * blocco e' rimasto fuori» e usciva. Sembrava un conteggio: **contava le fasi**. Nella
 * corsa del 2026-08-17 tutte e quattro le fasi erano girate, e dentro la terza
 * **71 casi su 152 non erano stati eseguiti** (70 `skipped` + 1 `did not run`) — cioe'
 * lo strumento affermava una cosa vera («le fasi hanno girato») che si legge come
 * un'altra falsa («la suite e' stata eseguita»). Ora la somma e' sui CASI.
 */
function conta(testo) {
  const n = (etichetta) => {
    let tot = 0;
    for (const m of testo.matchAll(new RegExp(`^\\s+(\\d+)\\s+${etichetta}`, "gm"))) {
      tot += Number(m[1]);
    }
    return tot;
  };
  return {
    passed: n("passed"),
    failed: n("failed"),
    flaky: n("flaky"),
    skipped: n("skipped"),
    nonEseguiti: n("did not run"),
  };
}

/**
 * I MOTIVI dei salti, letti dal reporter JSON — non un elenco scritto qui dentro.
 *
 * ⚠ PERCHE' ESISTE (#211 F2, misurato 2026-08-18). Il riepilogo diceva «80 casi non
 * eseguiti» e quel numero somma DUE SPECIE che non si sommano:
 *
 *   · **a comando** — 68 casi di censimento delle pagine (`F4_SWEEP=1`) e 6 di cattura
 *     dimostrativa (`STORIA36_DEMO=1`). Non girano perche' NON DEVONO girare in una corsa
 *     normale: sono strumenti, non prove del prodotto;
 *   · **ciechi sul posto** — il caso parte, guarda il dataset, non trova nulla da misurare
 *     e si dichiara tale. Questi vanno guardati UNO PER UNO: «nessuna fascia con importi»
 *     puo' essere la verita' del dataset, oppure un dato che doveva esserci e non c'e'.
 *
 * Sommarle da' un numero che sembra giusto ed e' il modo peggiore di essere sbagliato —
 * la stessa lezione di E22 sugli indicatori. I motivi si leggono dalle annotazioni che
 * Playwright scrive nel JSON: nessun elenco cablato qui, o il giorno che nasce un motivo
 * nuovo finirebbe in silenzio nella categoria sbagliata.
 */
function motiviDeiSalti(percorsoJson) {
  const fuori = new Map();
  let dati;
  try {
    dati = JSON.parse(readFileSync(percorsoJson, "utf8"));
  } catch {
    return null;   // niente JSON: si dichiara, non si inventa
  }
  const visita = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const saltato = (t.results ?? []).some((r) => r.status === "skipped")
          || t.status === "skipped" || t.expectedStatus === "skipped";
        if (!saltato) continue;
        const ann = (t.annotations ?? []).find((a) => a.type === "skip" || a.type === "fixme");
        // Un salto SENZA annotazione non è una scelta di chi ha scritto il caso: in un blocco
        // `serial` Playwright salta tutto ciò che segue un fallimento. Non è una terza specie
        // di skip — è lavoro che non è stato provato **a causa di un altro rosso**, e chiamarlo
        // «senza motivo» lo farebbe sembrare un caso spento apposta.
        const motivo = ann?.description?.trim()
          || "travolto da un fallimento precedente nel suo blocco `serial` (non è una scelta)";
        fuori.set(motivo, (fuori.get(motivo) ?? 0) + 1);
      }
    }
    for (const s of suite.suites ?? []) visita(s);
  };
  for (const s of dati.suites ?? []) visita(s);
  return fuori;
}

/** Il totale che la config dichiara: il metro contro cui si conta l'eseguito. */
function totaleAtteso() {
  const r = spawnSync(
    process.execPath,
    usaWrapper
      ? [join(HERE, "e2e-node22.mjs"), "test", `--config=${CONFIG}`, "--list", "--reporter=list"]
      : [
          join(WEB_DIR, "node_modules", "@playwright", "test", "cli.js"),
          "test",
          `--config=${CONFIG}`,
          "--list",
          "--reporter=list",
        ],
    { cwd: WEB_DIR, encoding: "utf8" },
  );
  const m = /Total:\s+(\d+)\s+tests?/.exec(`${r.stdout ?? ""}${r.stderr ?? ""}`);
  return m ? Number(m[1]) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
const soloFase = (() => {
  const i = process.argv.indexOf("--fase");
  if (i < 0 || !process.argv[i + 1]) return null;
  const n = Number(process.argv[i + 1]);
  // Un numero di fase che non esiste NON deve uscire verde senza eseguire niente: e'
  // esattamente il silenzio che questo script esiste per togliere. Trovato provandolo
  // con `--fase 99`, che alla prima stesura rispondeva «(corsa parziale)» ed exit 0.
  if (!Number.isInteger(n) || n < 1 || n > FASI.length) {
    console.error(
      `e2e-blocchi: la fase ${process.argv[i + 1]} non esiste — ce ne sono ${FASI.length}.\n` +
        `  Uscire verde senza eseguire niente sarebbe la bugia peggiore.`,
    );
    process.exit(2);
  }
  return n;
})();

const atteso = soloFase === null ? totaleAtteso() : null;
if (soloFase === null && atteso === null) {
  console.error(
    "e2e-blocchi: non ho potuto leggere il totale atteso da `--list`.\n" +
      "  Senza quel numero non posso dire se ho eseguito tutto, e un conteggio cieco\n" +
      "  e' peggio di nessun conteggio: si fermerebbe qui invece di mentire.",
  );
  process.exit(2);
}

const esiti = [];
for (const [i, fase] of FASI.entries()) {
  const n = i + 1;
  if (soloFase !== null && soloFase !== n) continue;
  const jsonOut = join(WEB_DIR, `.e2e-fase-${n}.json`);
  const args = ["test", `--config=${CONFIG}`, ...fase.map((p) => `--project=${p}`),
                "--reporter=list,json"];
  console.log(`\n${"═".repeat(78)}\n FASE ${n}/${FASI.length} — ${fase.join(" + ")}\n${"═".repeat(78)}`);
  const r = playwright(args, { PLAYWRIGHT_JSON_OUTPUT_NAME: jsonOut });
  esiti.push({ fase: n, progetti: fase, exit: r.status, ...conta(r.testo),
               motivi: motiviDeiSalti(jsonOut) });
}

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${"═".repeat(78)}\n ESITO PER FASE\n${"═".repeat(78)}`);
for (const e of esiti) {
  const salti = e.skipped + e.nonEseguiti;
  console.log(
    `  fase ${e.fase}  ${e.exit === 0 ? "VERDE" : `ROSSA (exit ${e.exit})`}  — ${e.progetti.join(" + ")}\n` +
      `           ${e.passed} passati · ${e.failed} falliti · ${e.flaky} instabili · ` +
      `${salti} NON eseguiti${salti > 0 ? "  ⚠" : ""}`,
  );
}

const rosse = esiti.filter((e) => e.exit !== 0);
if (soloFase !== null) {
  console.log(`\n(corsa parziale: solo la fase ${soloFase} — il conteggio totale non si applica)`);
  process.exit(rosse.length === 0 ? 0 : 1);
}

const somma = (k) => esiti.reduce((a, e) => a + e[k], 0);
const passati = somma("passed");
const falliti = somma("failed");
const instabili = somma("flaky");
const nonEseguiti = somma("skipped") + somma("nonEseguiti");
const visti = passati + falliti + instabili + nonEseguiti;

console.log(`\n  test dichiarati da --list : ${atteso}`);
console.log(`  casi nel riepilogo        : ${visti}`);
console.log(`  passati                   : ${passati}`);
console.log(`  falliti                   : ${falliti}${instabili > 0 ? ` (+${instabili} instabili)` : ""}`);
console.log(`  NON ESEGUITI              : ${nonEseguiti}${nonEseguiti > 0 ? "  ⚠ «non eseguito» non e' «passato»" : ""}`);

// I motivi, raggruppati: un numero solo mescolerebbe gli strumenti a comando coi casi che
// si dichiarano ciechi, e sono due cose diverse — la prima e' voluta, la seconda va guardata.
const perMotivo = new Map();
let motiviIgnoti = false;
for (const e of esiti) {
  if (!e.motivi) { motiviIgnoti = true; continue; }
  for (const [m, q] of e.motivi) perMotivo.set(m, (perMotivo.get(m) ?? 0) + q);
}
if (perMotivo.size) {
  console.log("\n  perche' non sono stati eseguiti (letto dalle annotazioni, non da un elenco):");
  for (const [m, q] of [...perMotivo].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(q).padStart(4)}  ${m.slice(0, 88)}`);
  }
  const classificati = [...perMotivo.values()].reduce((a, b) => a + b, 0);
  if (classificati < nonEseguiti) {
    console.log(`    ${String(nonEseguiti - classificati).padStart(4)}  (senza annotazione nel JSON)`);
  }
}
if (motiviIgnoti) {
  console.log("  ⚠ almeno una fase non ha prodotto il JSON: i motivi di quei salti NON sono noti");
}
console.log(
  `  fasi eseguite             : ${esiti.length}/${FASI.length}` +
    (esiti.length === FASI.length ? " — tutte" : " — ⚠ NON tutte"),
);

const problemi = [];
// (1) Una fase mai partita: la suite non e' stata eseguita, e non si sommano i verdi
//     delle altre come se lo fosse.
if (esiti.length !== FASI.length) {
  problemi.push(`${FASI.length - esiti.length} fasi non eseguite`);
}
// (2) Il riepilogo non copre il dichiarato: qualcosa e' sparito fra `--list` e la corsa,
//     e un totale che non torna e' un conteggio di cui non si puo' fidare.
if (visti !== atteso) {
  problemi.push(`il riepilogo copre ${visti} casi sui ${atteso} dichiarati`);
}
// (3) Casi non eseguiti: e' il difetto che questo script esiste per rendere visibile.
if (nonEseguiti > 0) {
  problemi.push(`${nonEseguiti} casi non eseguiti`);
}
if (falliti > 0) problemi.push(`${falliti} casi falliti`);

if (problemi.length > 0) {
  console.error(`\nROSSO: ${problemi.join(" · ")}.`);
  if (esiti.length === FASI.length && nonEseguiti === 0) {
    console.error("  Tutte le fasi hanno girato e nessun caso e' rimasto fuori: i rossi sono guasti da guardare.");
  }
  process.exit(1);
}
console.log("\nVERDE: tutte le fasi hanno girato, ogni caso dichiarato e' stato eseguito, nessun rosso.");
