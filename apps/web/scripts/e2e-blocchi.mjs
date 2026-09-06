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
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = resolve(HERE, "..");
const CONFIG = "playwright.prod.config.ts";

/**
 * Il `.env` del repo, letto come lo legge `playwright.config.ts`.
 *
 * Senza questo il preflight non vedeva NIENTE del `.env` e ripiegava su valori cablati.
 * Misurato il 2026-09-05 sul gemello: dichiarava «API NON raggiungibile su
 * http://localhost:3001» mentre l'API rispondeva sulla 8013 — la porta che il `.env` dice
 * (`PORT=8013`) e che l'unit systemd del web passa al processo, ma che una shell qualunque
 * non ha. La 3001 non e' l'API di nessuno: e' solo il ripiego scritto qui dentro, ed e' la
 * stessa 3001 su cui `.handoff/STATE.md` teneva aperta la domanda «di chi e' questa porta?».
 * Risposta: di nessuno.
 *
 * Un preflight che ripiega su un valore inventato non avvisa, DEPISTA — e questa e' la
 * seconda volta che questo stesso preflight produce un falso allarme (la prima in S1081,
 * `process.exit()` dentro un fetch). Un allarme che suona senza motivo insegna a non
 * guardarlo, che e' esattamente il difetto di `#194`.
 */
function leggiEnv() {
  const valori = {};
  for (const p of [resolve(WEB_DIR, "../../.env"), resolve(WEB_DIR, ".env")]) {
    let testo;
    try {
      testo = readFileSync(p, "utf8");
    } catch {
      continue; // il file puo' non esserci (CI): i valori arrivano dall'ambiente
    }
    for (const riga of testo.split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(riga);
      if (!m) continue;
      valori[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return valori;
}
const ENV_FILE = leggiEnv();
/** L'ambiente vince sul file: chi esporta una variabile sa quello che fa. */
const env = (nome) => process.env[nome] ?? ENV_FILE[nome];

/**
 * Dove sta l'API, DERIVATA in tre passi e mai inventata:
 *   ① la variabile che usa il web, se qualcuno l'ha esportata o messa nel `.env`;
 *   ② altrimenti la `PORT` che il `.env` dichiara per l'API — la stessa che l'unit systemd
 *      passa al processo, quindi la porta vera anche da una shell nuda;
 *   ③ altrimenti `null`, che vuol dire NON MISURABILE. Mai una porta cablata.
 *
 * Serve a DUE cose, e la seconda e' quella che chiude i quattro setup falliti di `#219`:
 * il preflight la interroga, e la corsa la PASSA al processo Playwright — perche' il web
 * che Playwright avvia e' un altro processo, e senza questa variabile `next.config.js`
 * ripiega sulla 3001 e ogni login muore in ECONNREFUSED.
 */
const API_BASE_URL = env("NEXT_PUBLIC_API_PROXY_BASE_URL")
  ?? (env("PORT") ? `http://localhost:${env("PORT")}` : null);

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

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PREFLIGHT — le tre cose che, se non stanno in piedi, producono ROSSI CHE NON
 * SONO GUASTI. Tutte e tre misurate in S1081 nella stessa giornata, e ognuna e'
 * costata una corsa (fino a 44 minuti) piu' il triage sbagliato che ne e' seguito:
 *
 *   1. L'API SPENTA. Ne' `playwright.config` ne' `playwright.prod.config` avviano
 *      apps/api: avviano solo il web. Senza API ogni login fallisce, i sei setup
 *      diventano rossi e TUTTO il resto risulta «skipped» — che e' esattamente il
 *      referto che il register aveva interpretato come «le utenze non esistono piu'».
 *   2. LA :3000 OCCUPATA da un `next start` orfano di una corsa uccisa. Con
 *      `reuseExistingServer: false` la corsa muore subito; e finche' vive, quel
 *      server serve una build VECCHIA — pagine nuove in 404 senza spiegazione.
 *   3. LA VM CARICA. Il DB sta sulla VM OCI: quando `aide --update` (integrita' dei
 *      file, notturno) la satura, il pool va in timeout, il login risponde 500 e
 *      Playwright mostra solo un `waitForURL` che non arriva. Lo stesso setup che
 *      quaranta minuti prima passava in 5,5 s.
 *
 * NON BLOCCA: dichiara. Un cancello che si rifiuta di correre sarebbe peggio del
 * male — ma un rosso che non indica un difetto insegna a non guardare la suite, ed
 * e' la ragione per cui #219 esiste. Qui il referto porta il contesto ACCANTO
 * all'esito, cosi' chi legge non attribuisce al prodotto cio' che e' dell'ambiente.
 * `E2E_PREFLIGHT=0` lo salta.
 * ─────────────────────────────────────────────────────────────────────────────
 */
function preflight() {
  if (process.env.E2E_PREFLIGHT === "0") return [];
  const avvisi = [];

  // 1. l'API risponde? La base si DERIVA, in quest'ordine, e non si inventa mai:
  //    ① la variabile che usa il web, se qualcuno l'ha esportata o messa nel `.env`;
  //    ② altrimenti la `PORT` che il `.env` dichiara per l'API — e' la stessa che l'unit
  //       systemd passa al processo, quindi e' la porta vera anche da una shell nuda;
  //    ③ se nemmeno quella c'e', si dichiara NON MISURABILE e ci si ferma li'. Il ripiego
  //       su una porta cablata (era `http://localhost:3001`) non avvisava: DEPISTAVA.
  const apiBase = API_BASE_URL;
  //    ⚠ e se manca, si prosegue con gli ALTRI due controlli invece di uscire: una batteria
  //      che si ferma al primo rosso nasconde tutti gli altri (regola di bonifica §6).
  if (!apiBase) {
    avvisi.push("porta dell'API NON MISURABILE: ne' NEXT_PUBLIC_API_PROXY_BASE_URL ne' PORT " +
                "sono dichiarate (ambiente o .env). Non tiro a indovinare una porta: senza " +
                "questo dato i rossi della corsa non sono attribuibili");
  }
  // ⚠ `process.exitCode`, MAI `process.exit()` dentro la promise di `fetch`: su Windows
  // chiuderebbe l'handle mentre undici lo sta ancora usando, e Node muore con
  // «Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)» — un codice d'uscita ≠ 0
  // che questo preflight leggerebbe come «API assente». Misurato in S1081: il primo
  // preflight scritto cosi' ha dato un FALSO ALLARME su un'API che rispondeva, ed e'
  // esattamente il difetto di #194 — un allarme che suona senza motivo insegna a non
  // guardarlo.
  if (apiBase) {
    const api = spawnSync(process.execPath,
      ["-e", `fetch(${JSON.stringify(apiBase + "/healthz")},{signal:AbortSignal.timeout(4000)})` +
             `.then(r=>{process.exitCode=r.ok?0:1}).catch(()=>{process.exitCode=1})`],
      { encoding: "utf8" });
    if (api.status !== 0) {
      avvisi.push(`API NON raggiungibile su ${apiBase} — nessuna config Playwright la avvia: ` +
                  `apri un terminale con \`cd apps/api && pnpm dev\`, o ogni login fallira'`);
    }
  }

  // 2. la :3000 e' libera? Un server sopravvissuto e' peggio di nessun server.
  // ⚠ `PLAYWRIGHT_WEB_PORT` per PRIMA, ed e' la variabile VERA: e' quella che
  // `playwright.config.ts` legge (`WEB_PORT = process.env.PLAYWRIGHT_WEB_PORT ?? "3000"`)
  // e che la CI imposta per non collidere con gli altri servizi della macchina.
  // Leggendo solo `WEB_PORT` questo preflight controllava la porta 3000 mentre il web
  // nasceva altrove: due controlli su tre — la porta occupata e l'origine ammessa —
  // guardavano il posto sbagliato e uscivano verdi per costruzione. Trovato in S1089
  // preparando il passaggio in CI, prima che costasse una corsa.
  const porta = Number(process.env.PLAYWRIGHT_WEB_PORT ?? process.env.WEB_PORT ?? 3000);
  const occ = spawnSync(process.execPath,
    ["-e", `const n=require("node:net");const s=n.createServer();` +
           `s.once("error",()=>{process.exitCode=1});s.once("listening",()=>s.close());` +
           `s.listen(${porta},"127.0.0.1")`],
    { encoding: "utf8" });
  if (occ.status !== 0) {
    avvisi.push(`porta ${porta} GIA' OCCUPATA — con reuseExistingServer:false la corsa muore subito, ` +
                `e se e' un next start orfano sta servendo una build vecchia`);
  }

  // 2-bis. ⭐ LA DESTINAZIONE DEL PROXY, LETTA DALL'ARTEFATTO COMPILATO.
  //
  // E' il controllo che mancava, ed e' costato tre sessioni di diagnosi sbagliata.
  // `next build` COMPILA i rewrites dentro `.next/routes-manifest.json`: la destinazione di
  // `/api/*` viene fissata al momento del build e `next start` non la ri-valuta. Quindi
  // esportare `NEXT_PUBLIC_API_PROXY_BASE_URL` prima della CORSA non serve a niente — va
  // esportata prima del BUILD, e se il build e' stato fatto senza, il proxy punta per sempre
  // al ripiego cablato.
  //
  // Misurato il 2026-09-05 sul gemello: manifest costruito alle 15:19 con `localhost:3001`,
  // API viva sulla 8013, e ogni login morto in ECONNREFUSED — con l'API sana e il tunnel
  // assente. Il valore stava in un artefatto GENERATO, cioe' gitignored: nessuna ricerca nel
  // codice poteva trovarlo, ed e' la stessa specie di punto cieco gia' registrata per i
  // rename. Per questo il controllo non guarda il sorgente: guarda il manifest.
  if (apiBase) {
    const manifest = join(WEB_DIR, ".next", "routes-manifest.json");
    let compilata = null;
    try {
      const m = /"destination"\s*:\s*"(https?:\/\/[^/"]+)/.exec(readFileSync(manifest, "utf8"));
      compilata = m?.[1] ?? null;
    } catch {
      // niente build: la corsa lo fara' da se', e allora il manifest nascera' giusto
    }
    if (compilata && compilata !== apiBase) {
      avvisi.push(`il proxy /api/* e' COMPILATO verso ${compilata}, ma l'API sta su ${apiBase} — ` +
                  `i rewrites si fissano al build e non all'avvio, quindi ogni login ` +
                  `fallira' in ECONNREFUSED. Rimedio: ricostruire con ` +
                  `NEXT_PUBLIC_API_PROXY_BASE_URL=${apiBase} pnpm build`);
    }
  }

  // 2-ter. ⭐ L'API CHE RISPONDE E' COSTRUITA DAL CODICE DI ADESSO?
  //
  // Stessa classe del controllo qui sopra, e trovato lo stesso giorno: un ARTEFATTO
  // GENERATO piu' vecchio del sorgente. In produzione l'API gira da un bundle
  // (`dist/server.js`), non dai sorgenti: un `git pull` aggiorna i file e NON tocca il
  // bundle, quindi la suite finisce per provare un frontend nuovo contro un'API vecchia.
  //
  // Misurato il 2026-09-05 sul gemello: bundle del **3 settembre**, repo a `0a5b8f83` di
  // oggi. La corsa integrale ha prodotto 44 falliti, e la gran parte erano scritture
  // rifiutate da un'API che non conosceva il contratto degli spec che la interrogavano —
  // fra cui un login che non restituiva piu' `csrfToken`, campo che ogni test si aspetta.
  //
  // Non e' un errore: e' un ambiente incoerente, e il preflight esiste per dirlo PRIMA.
  {
    const bundle = join(WEB_DIR, "..", "api", "dist", "server.js");
    try {
      const eta = statSync(bundle).mtimeMs;
      // Il metro e' il commit piu' recente che tocca l'API, non l'orologio: un bundle
      // costruito ieri va benissimo se da ieri nessuno ha toccato apps/api.
      const ultimo = spawnSync(
        "git",
        ["log", "-1", "--format=%ct", "--", "apps/api/src", "packages/shared/src"],
        { cwd: join(WEB_DIR, "..", ".."), encoding: "utf8" },
      );
      const commit = Number.parseInt(`${ultimo.stdout}`.trim(), 10) * 1000;
      if (ultimo.status === 0 && Number.isFinite(commit) && commit > eta) {
        const giorni = Math.round((commit - eta) / 86_400_000);
        avvisi.push(
          `il bundle dell'API (apps/api/dist/server.js) e' piu' VECCHIO dell'ultimo commit ` +
            `che tocca apps/api o packages/shared (di ~${giorni} giorno/i): la suite provera' ` +
            `un frontend nuovo contro un'API vecchia, e i suoi rossi non saranno attribuibili. ` +
            `Rimedio: cd apps/api && pnpm build && sudo systemctl restart heuresys-advanced-api`,
        );
      }
    } catch {
      // niente bundle: l'API gira dai sorgenti (sviluppo), e allora non c'e' niente da
      // confrontare. Il silenzio qui e' corretto, non e' un controllo saltato.
    }
  }

  // 3. la macchina che ospita il database e' scarica? Si misura, non si presume — e se
  //    non si puo' misurare si DICHIARA: «non lo so» non e' «a posto».
  //
  //    ⚠ QUALE macchina, pero', lo dice il `.env`, non una costante. Fino al 2026-09-05 qui
  //    c'era `oracle-vm-default` cablato, e la corsa sul GEMELLO — dove il database e' in
  //    casa e la VM non c'entra niente — misurava il carico della macchina sbagliata e ne
  //    riportava l'esito come proprio. E' la stessa dottrina gia' scritta per il database
  //    («il lavoro si esegue dove il DB vive»), applicata al suo controllo: se il `.env`
  //    dichiara il DB oltre il tunnel (`POSTGRES_PORT=5433`), la macchina che conta e' la
  //    VM; se lo dichiara in casa (il gemello ha `localhost:5432`), la macchina che conta
  //    e' QUESTA, e si misura senza uscire.
  const oltreIlTunnel = String(env("POSTGRES_PORT") ?? "5433") === "5433";
  const host = process.env.E2E_DB_HOST_SSH ?? (oltreIlTunnel ? "oracle-vm-default" : null);
  const vm = host
    ? spawnSync("ssh", ["-o", "ConnectTimeout=8", "-o", "BatchMode=yes", host,
                        "cat /proc/loadavg; pgrep -c aide || true"], { encoding: "utf8" })
    : spawnSync("sh", ["-c", "cat /proc/loadavg; pgrep -c aide || true"], { encoding: "utf8" });
  // Il messaggio NOMINA la macchina misurata: dire «la VM» avendo guardato questa macchina
  // e' la stessa specie di bugia del ripiego sulla 3001.
  const chi = host ?? "questa macchina (il DB e' in casa)";
  if (vm.status !== 0) {
    avvisi.push(`carico di ${chi} NON MISURABILE: l'esito di questa corsa ` +
                `non potra' distinguere un guasto da una macchina satura`);
  } else {
    const righe = `${vm.stdout}`.trim().split("\n");
    const load1 = Number.parseFloat(righe[0]?.split(/\s+/)[0] ?? "0");
    const aide = Number.parseInt(righe[1] ?? "0", 10) || 0;
    if (aide > 0 || load1 >= 2) {
      avvisi.push(`${chi} CARICA (load ${load1}${aide > 0 ? ", `aide` in esecuzione" : ""}) — il DB ` +
                  `risponde lento, il pool scade e i login vanno in 500: i rossi di questa corsa ` +
                  `NON sono attribuibili al prodotto finche' non si rimisura a macchina scarica`);
    }
  }

  // 4. ⭐ L'API AMMETTE L'ORIGINE DA CUI IL BROWSER LE PARLERA'?
  //
  // Il controllo che mancava, e che e' costato la corsa di S1087 e i suoi 42 rossi.
  // `verifyCsrf` fa due cose, e la seconda nessuno la guardava: dopo il double-submit
  // confronta l'header `Origin` con `ADMIN_ORIGIN`, e se non combacia risponde **403** —
  // lo stesso codice di un permesso negato. Tre triage successivi hanno percio'
  // attribuito ai permessi cio' che era una variabile d'ambiente.
  //
  // Misurato il 2026-09-06 sul gemello, stessa sessione e stesso token, sola differenza
  // l'header: `Origin: http://192.168.1.11:3013` -> **200**, `Origin: http://localhost:3000`
  // -> **403 ORIGIN_MISMATCH**. Il web che Playwright avvia parla da `localhost:3000`,
  // l'API del gemello ammetteva solo la 3013: **ogni scrittura fatta dal browser** era
  // rifiutata, mentre quelle fatte da `page.request` passavano (non hanno `Origin`, e il
  // controllo si salta) — ed e' per questo che la stessa rotta mostrava sia 200 sia 403.
  //
  // Si interroga l'API invece di leggere il `.env`: il `.env` dice cosa e' scritto, la
  // risposta dice cosa quel processo sta applicando — e fra i due c'e' un riavvio.
  //
  // ⚠ E LA SONDA DEVE PASSARE IL DOUBLE-SUBMIT PER ARRIVARE AL CONTROLLO SULL'ORIGINE.
  // La prima stesura mandava il solo header `Origin` e usciva VERDE su un ambiente che
  // era rotto: senza token la richiesta muore prima, con un 403 `CSRF_FAIL` che questo
  // controllo non riconosce. Era un controllo che non poteva vedere il difetto che
  // esiste per vedere. Si mandano quindi cookie e header CSRF **uguali fra loro** — il
  // presidio confronta solo l'uguaglianza, non la validita' — e cosi' si arriva al
  // secondo controllo, che e' quello da misurare.
  if (apiBase) {
    const origine = `http://localhost:${porta}`;
    const finto = "preflight-origine-non-e-un-token-vero";
    const r = spawnSync(process.execPath, ["-e",
      `fetch(${JSON.stringify(apiBase + "/v1/auth/refresh")},{method:"POST",` +
      `headers:{origin:${JSON.stringify(origine)},` +
      `cookie:${JSON.stringify(`hrx_csrf=${finto}`)},` +
      `"x-csrf-token":${JSON.stringify(finto)}},signal:AbortSignal.timeout(5000)})` +
      `.then(async r=>{const b=await r.text();` +
      // 403 ORIGIN_MISMATCH = l'origine e' rifiutata. Qualunque altra risposta (401, 403
      // CSRF_FAIL) significa che il controllo sull'origine e' stato SUPERATO: senza
      // credenziali la richiesta muore piu' avanti, ed e' esattamente cio' che vogliamo.
      `process.exitCode = (r.status===403 && b.includes("ORIGIN_MISMATCH"))?9:0})` +
      `.catch(()=>{process.exitCode=0})`],
      { encoding: "utf8" });
    if (r.status === 9) {
      avvisi.push(`l'API su ${apiBase} NON AMMETTE l'origine ${origine}, da cui il browser ` +
                  `della suite le parlera': ogni scrittura fatta dalla pagina ricevera' 403 ` +
                  `ORIGIN_MISMATCH — indistinguibile da un permesso negato. Rimedio: ` +
                  `dichiarare quell'origine in ADMIN_ORIGIN (accetta un elenco separato da ` +
                  `virgola) e riavviare l'API`);
    }
  }

  // 5. ⭐ IL BUDGET DEI LOGIN BASTA PER LA PREPARAZIONE?
  //
  // Il controllo che mancava al quinto giro in CI (34043971361), e che e' costato
  // 45 minuti per un difetto che qui si vede in mezzo secondo. `/v1/auth/login`
  // accetta `AUTH_LOGIN_RATELIMIT_MAX` tentativi per IP ogni 5 minuti; il default
  // e' la policy di produzione, **10**. In locale il `.env` lo alza, in CI quel
  // file non esiste — e la sola preparazione ne consuma di piu'.
  //
  // Come si e' manifestato: sempre il SESTO personaggio (`custodian`, l'ultimo
  // della fila) in timeout su `waitForURL`, in tutte e quattro le fasi. Sembrava
  // un guasto della custodia; era un posto in coda. E siccome quel caso apre un
  // blocco `serial`, si e' portato dietro 350 test «non eseguiti».
  // La pagina lo diceva, nello scatto del fallimento: «Troppi tentativi.»
  //
  // ⚠ Si INTERROGA l'API, non si legge una variabile: fra il `.env` e il processo
  // c'e' un riavvio, ed e' il processo che applica. `@fastify/rate-limit` scrive
  // il tetto in `x-ratelimit-limit` su OGNI risposta della rotta, anche un 401 —
  // quindi la sonda misura senza avere bisogno di credenziali.
  //
  // La soglia, con l'aritmetica in chiaro invece di un numero calato dall'alto:
  // sei personaggi x 2 ritentativi = 18 tentativi per fase, piu' la sonda; e una
  // finestra di 5 minuti puo' stare a cavallo di DUE fasi consecutive. Sotto 40
  // la preparazione non ha margine, e i suoi rossi non sono attribuibili.
  if (apiBase) {
    const sonda = spawnSync(process.execPath, ["-e",
      `fetch(${JSON.stringify(apiBase + "/v1/auth/login")},{method:"POST",` +
      `headers:{"content-type":"application/json"},` +
      // Un indirizzo che non puo' esistere (`.invalid` e' riservato da RFC 2606):
      // la sonda non deve poter contribuire al blocco di un'utenza vera.
      `body:JSON.stringify({email:"preflight-sonda@example.invalid",password:"x"}),` +
      `signal:AbortSignal.timeout(5000)})` +
      `.then(r=>{const v=r.headers.get("x-ratelimit-limit");` +
      `console.log(v??"");process.exitCode=0})` +
      `.catch(()=>{console.log("");process.exitCode=0})`],
      { encoding: "utf8" });
    const tetto = Number.parseInt(`${sonda.stdout}`.trim(), 10);
    if (!Number.isFinite(tetto)) {
      avvisi.push("budget dei login NON MISURABILE: l'API non ha restituito " +
                  "`x-ratelimit-limit` su /v1/auth/login. Non e' «va bene»: se il tetto " +
                  "fosse quello di produzione (10), la sola preparazione lo esaurirebbe e " +
                  "gli ultimi personaggi fallirebbero il login senza che il referto lo dica");
    } else if (tetto < 40) {
      avvisi.push(`budget dei login TROPPO BASSO: l'API ammette ${tetto} tentativi ogni 5 ` +
                  `minuti, ma la sola preparazione ne chiede fino a ~38 (sei personaggi con ` +
                  `i ritentativi, su due fasi che possono cadere nella stessa finestra). ` +
                  `Gli ULTIMI personaggi falliranno il login con «Troppi tentativi», e il ` +
                  `referto mostrera' un timeout su waitForURL — indistinguibile da un guasto ` +
                  `del prodotto. Rimedio: AUTH_LOGIN_RATELIMIT_MAX=200 nell'ambiente dell'API`);
    }
  }

  return avvisi;
}

const AVVISI_PREFLIGHT = preflight();
if (AVVISI_PREFLIGHT.length > 0) {
  console.error("\n" + "=".repeat(78));
  console.error(" PREFLIGHT — l'ambiente non e' quello che la suite presume");
  console.error("=".repeat(78));
  for (const a of AVVISI_PREFLIGHT) console.error(`  [!] ${a}`);
  console.error("=".repeat(78) + "\n");
}

// `--solo-preflight`: esce qui, con 0 se l'ambiente e' pulito e 1 se ha qualcosa da dire.
// Serve a rendere il preflight FALSIFICABILE senza pagare un'ora di corsa: e' cosi' che il
// 2026-09-05 si e' potuto provare che la porta dell'API non era piu' quella cablata.
if (process.argv.includes("--solo-preflight")) {
  console.error(AVVISI_PREFLIGHT.length === 0
    ? "preflight: nessun avviso — l'ambiente e' quello che la suite presume"
    : `preflight: ${AVVISI_PREFLIGHT.length} avviso/i (sopra)`);
  process.exitCode = AVVISI_PREFLIGHT.length === 0 ? 0 : 1;
  process.exit();
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
  // ⭐ LA VARIABILE SI PASSA AL FIGLIO, o il web che Playwright avvia non sa dov'e' l'API.
  //
  // `next.config.js:17` fa lo STESSO ripiego che il preflight faceva — `|| "http://localhost:3001"` —
  // e il web che la suite avvia non eredita la variabile da nessuna parte: l'unit systemd ce l'ha,
  // ma quel web e' un altro processo. Risultato misurato il 2026-09-05 sul gemello, con l'API viva
  // e sana (zero errori nel suo log, zero timeout di pool):
  //
  //   [WebServer] Failed to proxy http://localhost:3001/v1/auth/login  ECONNREFUSED 127.0.0.1:3001
  //   4 failed (i quattro auth.setup) · 1 flaky · 82 did not run · 1 passed
  //
  // Sono ESATTAMENTE i quattro setup che S1083 aveva attribuito al TUNNEL, e con essi gli 82 test
  // che non hanno girato. La diagnosi di allora era plausibile e sbagliata: la corsa girava da
  // Windows, dove il tunnel c'e' davvero, e il tunnel ha preso la colpa di questo. La prova che
  // non era lui: qui il tunnel non c'e' — il DB e' in casa — e il guasto e' identico.
  const r = playwright(args, {
    PLAYWRIGHT_JSON_OUTPUT_NAME: jsonOut,
    ...(API_BASE_URL ? { NEXT_PUBLIC_API_PROXY_BASE_URL: API_BASE_URL } : {}),
  });
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
  // DOVE si leggono i falliti. Senza questa riga il dettaglio sembra vivere solo nello
  // stdout — che chi lancia una corsa da minuti tronca quasi sempre — e per rileggerlo si
  // rifanno le fasi da capo. I referti per fase esistono da sempre: mancava chi lo dicesse.
  console.error(`  Il dettaglio di ogni caso e' nei referti per fase, gia' scritti su disco:`);
  console.error(`     ${esiti.map((e) => `apps/web/.e2e-fase-${e.fase}.json`).join(" · ")}`);
  // Il contesto va ACCANTO all'esito, non solo in cima: chi legge il referto ore dopo
  // (o lo trova in CI) vede i rossi, non lo scrollback di quando la corsa e' partita.
  if (AVVISI_PREFLIGHT.length > 0) {
    console.error("  ⚠ e il preflight aveva gia' detto che l'ambiente non regge:");
    for (const a of AVVISI_PREFLIGHT) console.error(`     · ${a}`);
    console.error("    Prima di attribuire questi rossi al prodotto, rimisura ad ambiente sano.");
  }
  if (esiti.length === FASI.length && nonEseguiti === 0) {
    console.error("  Tutte le fasi hanno girato e nessun caso e' rimasto fuori: i rossi sono guasti da guardare.");
  }
  process.exit(1);
}
console.log("\nVERDE: tutte le fasi hanno girato, ogni caso dichiarato e' stato eseguito, nessun rosso.");
