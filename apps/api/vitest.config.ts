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
    hookTimeout: 60_000,
    // Integration tests share a single DB pool — serial avoids
    // refresh-rotation race conditions across tests.
    // Vitest 4 migration (2026-05-26): poolOptions removed; use top-level
    // fileParallelism + single worker to keep single-thread semantics.
    pool: "threads",
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    setupFiles: ["./test/helpers/setup.ts"],
  },
});
