/**
 * apps/api/vitest.config.ts
 * Single config for both unit and integration tests. Integration tests rely
 * on the live OCI VM database via tunnel :5433 — the same .env that `pnpm dev`
 * uses. To run only fast unit tests, filter by name pattern.
 */

import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// @heuresys/shared è "source-first": il bundle di produzione (tsup) lo compila dai
// sorgenti tramite la condition custom "heuresys-source" (D-76), quindi anche i test
// devono esercitare i SORGENTI — non un ./dist/*.js che potrebbe essere stantio.
// Si usa un alias esplicito e NON le export conditions: `resolve.conditions` non basta
// (i pacchetti esterni li risolve il layer ssr) e sovrascrivere `ssr.resolve.conditions`
// rompe la risoluzione delle dipendenze esterne — misurato: @opentelemetry/api finiva
// sulla propria build ESM con import senza estensione e 175 file di test andavano rossi.
const sharedSrc = fileURLToPath(new URL("../../packages/shared/src/", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@heuresys\/shared$/, replacement: `${sharedSrc}index.ts` },
      { find: /^@heuresys\/shared\/(.*)$/, replacement: `${sharedSrc}$1.ts` },
    ],
  },
  test: {
    include: ["test/**/*.test.ts"],
    // D-64: gli unit test (test/unit/*.unit.test.ts) hanno la loro config
    // (vitest.unit.config.ts, no DB/setup) — esclusi qui per non girare due volte.
    exclude: ["test/unit/**", "**/node_modules/**"],
    environment: "node",
    // [S1045] Alzati da 20s/30s dopo due run interi della suite che hanno prodotto
    // rossi DIVERSI per la stessa ragione: `gdpr` oltre i 20s di test nel primo,
    // `user-career-plans-scope` oltre i 30s di hook nel secondo. Entrambi passano da
    // soli (user-career-plans: 7/7 in 37s) — a cadere non era la logica ma il tempo.
    //
    // Perche' non e' un cerotto: la suite gira SERIALE contro il PostgreSQL della VM
    // via tunnel SSH e dura ~37 minuti; un `beforeAll` che fa cinque login reali
    // (Argon2id, lento per costruzione) e' legittimamente lento quando il DB e' sotto
    // il carico degli altri 231 file. Un limite tarato sull'esecuzione isolata
    // trasforma la lentezza in rossi intermittenti — e un rosso che non indica un
    // difetto e' peggio di nessun rosso, perche' insegna a non guardarlo.
    testTimeout: 40_000,
    // [S1045] SECONDA taratura della stessa giornata, e va detto: 30s -> 60s non e'
    // bastato. Con `assessments` il conto e' esplicito — da solo: 5 test verdi in
    // 19s totali, di cui 7s di test veri e un `beforeAll` con TRE login. In suite
    // intera lo stesso hook supera i 60s: oltre OTTO VOLTE piu' lento.
    //
    // Non e' il file a essere lento, e' il PostgreSQL remoto sotto il carico degli
    // altri 231 file (la suite dura ~40 minuti, di cui 549s solo di import). 120s
    // copre il degrado misurato con margine.
    //
    // Perche' non maschera un difetto: un hook che si blocca davvero non finisce
    // nemmeno in due minuti, quindi il limite continua a intercettarlo. Cio' che
    // smette di intercettare e' la lentezza — che non e' mai stata un difetto e
    // produceva rossi su un file DIVERSO a ogni esecuzione (gdpr, poi
    // user-career-plans, poi assessments): la firma inconfondibile del tempo, non
    // della logica.
    //
    // La causa strutturale resta aperta: ogni file rifa' i login da zero e Argon2id
    // e' lento per costruzione. Condividere le sessioni fra file e' il lavoro che
    // toglierebbe la necessita' di questi limiti, e non e' una taratura.
    hookTimeout: 120_000,
    // Integration tests share a single DB pool — serial avoids
    // refresh-rotation race conditions across tests.
    // Vitest 4 migration (2026-05-26): poolOptions removed; use top-level
    // fileParallelism + single worker to keep single-thread semantics.
    pool: "threads",
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    setupFiles: ["./test/helpers/setup.ts"],
    // Un lucchetto per RUN (globalSetup gira una volta, non per file): due suite
    // sullo stesso PostgreSQL si contendono lock e connessioni e producono rossi che
    // non sono difetti — misurato il 2026-08-05, 14 file falliti in concorrenza
    // contro 4 su database libero, con ZERO test falliti in entrambi i casi.
    // I teardown di globalSetup girano in ordine INVERSO all'array: `drift-check` sta
    // dopo il lucchetto proprio per questo — il censimento finale avviene mentre la
    // suite tiene ancora il lucchetto (Z-112).
    //
    // Cosa protegge davvero, detto con precisione: il lucchetto e' preso da QUESTA
    // suite (`vitest` di apps/api) e da nessun altro. Impedisce quindi che una SECONDA
    // corsa di questa suite scriva righe che verrebbero attribuite alla prima. NON
    // impedisce niente agli E2E Playwright di apps/web, che hanno la loro config e non
    // prendono questo lucchetto: se girano in parallelo, le righe che lasciano possono
    // finire nel drift di questa corsa. E' un limite noto, non una svista — dirlo qui
    // vale piu' che lasciar credere una protezione che non c'e'.
    globalSetup: ["./test/helpers/suite-lock.ts", "./test/helpers/drift-check.ts"],
  },
});
