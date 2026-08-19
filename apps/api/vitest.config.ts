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
    // [Z-251 F3, 2026-08-19] RIPORTATO a 20s, il valore di prima degli aggiramenti.
    //
    // Storia, perche' il numero non torni a salire per abitudine: era 20s; S1045 lo porto'
    // a 40s dopo due corse intere con rossi DIVERSI per la stessa ragione (`gdpr` oltre i
    // 20s di test, `user-career-plans-scope` oltre i 30s di hook), entrambi verdi da soli.
    // La causa non era la logica, era il tempo — e il tempo veniva dai login ripetuti.
    //
    // F2 ha tolto la causa: le sessioni sono condivise fra file (`helpers/session-cache.ts`),
    // e su un campione di 12 file i login veri passano da 79 a 11, la corsa da 233,62 s a
    // 177,67 s. Questo abbassamento E' LA PROVA di quel lavoro: se la suite integrale torna
    // a cadere sul tempo, la cura non e' bastata e va detto, non aggirato una terza volta.
    testTimeout: 20_000,
    // [Z-251 F3, 2026-08-19] RIPORTATO a 30s. Era stato alzato DUE volte nella stessa
    // giornata (S1045: 30s -> 60s, non basto', -> 120s) e la seconda volta il commento
    // chiudeva cosi': «la causa strutturale resta aperta: ogni file rifa' i login da zero
    // e Argon2id e' lento per costruzione. Condividere le sessioni fra file e' il lavoro
    // che toglierebbe la necessita' di questi limiti, e non e' una taratura».
    //
    // Quel lavoro e' stato fatto (Z-251 F2). Il caso peggiore che il limite deve coprire
    // e' cambiato: non piu' un `beforeAll` con cinque login veri (5 x 753 ms misurati, piu'
    // il degrado sotto carico), ma il PRIMO file che incontra un attore mai visto nella
    // corsa — uno o due login, non cinque. 30s copre quel caso; se non lo coprisse, il
    // rosso e' un'informazione, non un fastidio da tarare.
    hookTimeout: 30_000,
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
    // Z-251 F2: `session-cache-reset` sta PRIMO — deve azzerare la cache delle sessioni
    // prima che qualunque file possa leggerla, e non ha teardown, quindi la sua posizione
    // non altera l'ordine inverso che lega `drift-check` al lucchetto.
    globalSetup: [
      "./test/helpers/session-cache-reset.ts",
      "./test/helpers/suite-lock.ts",
      "./test/helpers/drift-check.ts",
    ],
  },
});
