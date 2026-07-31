/**
 * apps/api/vitest.unit.config.ts — D-64: unit layer per la logica PURA.
 *
 * Nessun DB, nessun tunnel, nessun setup transazionale: questi test devono
 * girare ovunque (CI, macchina senza tunnel) in millisecondi. La suite
 * integration (vitest.config.ts) resta la verità end-to-end contro il DB
 * reale; qui vive la logica che non ha bisogno di I/O (parser di config,
 * normalizzazioni, tassonomie di scope, ecc.).
 *
 * Convenzione: test/unit/*.unit.test.ts — la config integration li ESCLUDE
 * (vitest.config.ts) così nessun file gira due volte.
 */

import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Stessa ragione (e stessa cautela) della config integration: alias esplicito ai
// sorgenti di @heuresys/shared, mai export conditions — vedi vitest.config.ts (D-76).
const sharedSrc = fileURLToPath(new URL("../../packages/shared/src/", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@heuresys\/shared$/, replacement: `${sharedSrc}index.ts` },
      { find: /^@heuresys\/shared\/(.*)$/, replacement: `${sharedSrc}$1.ts` },
    ],
  },
  test: {
    include: ["test/unit/**/*.unit.test.ts"],
    environment: "node",
    testTimeout: 5_000,
    // pura CPU: piena parallelizzazione (nessun pool DB condiviso da serializzare)
  },
});
