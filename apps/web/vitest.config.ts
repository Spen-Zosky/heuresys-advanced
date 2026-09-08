/**
 * apps/web/vitest.config.ts — la prima suite unitaria del frontend (#159 F2, S1092).
 *
 * NASCE PER CHIUDERE UN BUCO DICHIARATO. S1091 ha estratto il canale dell'agente dalla
 * pagina e lo ha lasciato verificato dai soli cancelli **statici** (`typecheck`, `lint`),
 * dicendolo per iscritto: *«due cancelli statici verdi non sono una prova che il canale si
 * comporti come prima, e chiamarli tali sarebbe il falso verde di questa fase»*. Questa
 * config è il minimo che rende quella frase falsa per la parte che si può provare senza
 * infrastruttura React.
 *
 * ⚠ **Deliberatamente minima, e il perimetro è dichiarato.** `environment: "node"`, nessuna
 * `@testing-library`, nessun DOM: qui si provano le **funzioni pure** del frontend — quelle
 * che non hanno bisogno di essere montate. Provare un hook React pretende un renderer e
 * quindi dipendenze nuove: è infrastruttura ulteriore, e resta fuori finché non serve a
 * qualcosa di preciso. Un ambiente che si allarga «per ogni evenienza» è superficie che
 * nessuno usa e tutti mantengono.
 *
 * ⚠ E NON tocca Playwright: gli E2E hanno il proprio runner e i propri file
 * (`tests/e2e/**`), esclusi qui sotto perché vitest, trovandoli, tenterebbe di eseguirli.
 * `vitest` era già fra le devDependencies di questo pacchetto — nessuna dipendenza nuova.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules/**", "tests/e2e/**", ".next/**"],
  },
});
