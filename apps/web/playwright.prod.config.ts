/**
 * apps/web/playwright.prod.config.ts — D-24 full-suite config (prod build).
 *
 * The dev-mode config (playwright.config.ts) is for per-spec iteration only:
 * auth.setup storageState sessions are only safe for ~15 minutes (hrx_access
 * cookie TTL). Post-D-26 the silent refresh DOES work in the app, but it
 * cannot save a long suite run: every test context re-loads the SAME
 * tests/.auth/*.json, so after the first context rotates the single-use
 * refresh token, any other context that 401s presents the OLD token →
 * REFRESH_REPLAY_DETECTED → the whole family is revoked (worse than the old
 * redirect cascade). The 15-min ceiling + mid-suite re-login below remain
 * the doctrine. This config is the canonical FULL-SUITE entrypoint
 * (`pnpm test:e2e:prod`, which runs `next build` first):
 *
 *  - webServer = `next start` on the build emitted by the npm script
 *    (S984 proof: prod-mode rerun of ~100 tests in 7min, green; doctrine
 *    "verify E2E in PROD build not dev"). reuseExistingServer:false fails
 *    fast if a stale dev server still holds the port (known trap — see
 *    memory reference_playwright_stale_dev_servers).
 *  - project chain (S1068, #211 ①): setup → mobile-a11y + a11y-desktop (the long
 *    audit block, ~70 axe scans) → setup-refresh → chromium → setup-refresh-2 →
 *    chromium-2 → setup-refresh-3 → chromium-3. Ogni blocco di spec e' preceduto
 *    da un re-login, e nessun blocco dura piu' dei 15 minuti della sessione.
 *    ⚠ La riga precedente diceva «→ chromium (rest of the suite on FRESH 15-min
 *    cookies) → keeps the suite below the session ceiling even as it grows»: era
 *    vera quando fu scritta e **ha smesso di esserlo crescendo la suite**. UN solo
 *    re-login prima di un blocco che dura piu' di 15 minuti non tiene niente sotto
 *    il tetto — e' la causa della famiglia piu' numerosa dei 35 rossi di #211.
 *    Il numero di blocchi e la loro composizione si DERIVANO (vedi sotto): la frase
 *    «anche mentre cresce» ora e' vera per costruzione, non per augurio.
 *    The chain lives HERE and not in the dev config so that running a single
 *    spec in dev does not drag the whole a11y block in as a dependency.
 *  - desktop a11y audits land in test-results/a11y-audit/a11y-desktop/
 *    (project-namespaced, same convention as mobile-a11y).
 *  - showcase coverage is conditional on NEXT_PUBLIC_ENABLE_SHOWCASE=1:
 *    in a production build the /showcase routes 404 unless the flag was
 *    baked at build time (src/app/showcase/layout.tsx gate), and the
 *    showcase specs assert status<400 rather than self-skipping. PROD has
 *    showcase off by design; the showcase census stays covered by dev-mode
 *    runs/CI. To include it here: set the flag for BOTH build and run.
 *
 * Rate-limit note: one auth.setup pass = **6** login POSTs — sei personas, contate
 * in `auth.setup.ts`, non cinque come diceva questa riga (corretto S1068) — contro un
 * tetto di 10 ogni 5 minuti per IP. Con QUATTRO passaggi di setup (uno iniziale piu'
 * tre re-login) il vincolo diventa: **due setup consecutivi non devono cadere dentro
 * la stessa finestra di 5 minuti**. Regge perche' ogni blocco dura molti minuti; se un
 * blocco diventasse rapidissimo il setto successivo prenderebbe un **429**, e il
 * sintomo sarebbe RUMOROSO (il progetto di setup fallisce, la suite si ferma) — non un
 * falso verde. Escape hatch se serve: AUTH_LOGIN_RATELIMIT_MAX=50 nel .env dell'API
 * locale (gia' presente, apps/api/src/modules/auth/routes.ts).
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";
import baseConfig, { WEB_BASE_URL, WEB_PORT } from "./playwright.config";

const SHOWCASE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_SHOWCASE === "1";

/* ═══════════════════════════════════════════════════════════════════════════════
 * #211 ① — IL BLOCCO LUNGO SPEZZATO, PERCHE' LA SESSIONE DURA 15 MINUTI E LUI NO.
 *
 * Il difetto, misurato in S1067: la famiglia più numerosa dei 35 rossi non è un
 * guasto del prodotto — è la suite che si scade addosso. L'access token vive
 * `ACCESS_JWT_TTL_SECONDS` = 15 minuti; il blocco `chromium` ne durava molti di più.
 * I casi che chiamano l'API con `page.request` prendono un **401**, quelli che
 * navigano prendono il **redirect al login** — e il messaggio d'errore parla di
 * elementi non trovati, cioè accusa il prodotto.
 *
 * PERCHE' NON SI RINNOVA DENTRO LA CORSA. È già stato escluso, ed è scritto sopra:
 * ogni context ri-carica lo STESSO `tests/.auth/*.json`, quindi appena il primo
 * ruota il refresh token — che è **single-use** — qualunque altro context presenta
 * quello vecchio e fa scattare `REFRESH_REPLAY_DETECTED`, che revoca l'intera
 * famiglia. Sarebbe peggio del problema.
 *
 * PERCHE' NON SI ALLUNGA IL TTL PER LA CORSA. Sarebbe una riga, e altererebbe il
 * sistema sotto test: la sessione di 15 minuti è una scelta di prodotto, e una suite
 * che gira su un TTL che nessun utente ha non prova più il prodotto che esiste.
 *
 * QUINDI: il blocco si spezza, con un re-login fra un pezzo e l'altro. La divisione
 * è **derivata dal filesystem**, non un elenco scritto a mano: un elenco a mano
 * lascerebbe fuori la prossima spec che nasce, che non girerebbe **in silenzio** —
 * cioè esattamente il difetto che #211 racconta (35 casi rossi che nessuno vedeva
 * perché la CI ne eseguiva uno). Il controllo di copertura qui sotto lo rende
 * impossibile: se l'unione dei gruppi non è l'insieme completo, la config **non
 * parte**.
 * ═══════════════════════════════════════════════════════════════════════════════ */

/** Quanti pezzi. Tre: la suite intera dura ~32 min, e tre blocchi stanno sotto i 15. */
const BLOCCHI = 3;

/** Le spec che il blocco `chromium` NON esegue (hanno il loro progetto o il flag). */
const FUORI_DAL_BLOCCO = SHOWCASE_ENABLED
  ? ["a11y.spec.ts", "showcase-a11y.spec.ts"]
  : ["a11y.spec.ts", "showcase-a11y.spec.ts", "showcase-smoke.spec.ts"];

const E2E_DIR = join(__dirname, "tests", "e2e");

/** Tutte le spec del blocco, in ordine stabile (alfabetico): l'ordine non dipende
 *  dall'ordine di lettura del filesystem, che cambia fra sistemi. */
const SPEC_DEL_BLOCCO = readdirSync(E2E_DIR)
  .filter((f) => f.endsWith(".spec.ts") && !FUORI_DAL_BLOCCO.includes(f))
  .sort();

/** Divide in `BLOCCHI` gruppi contigui. L'ultimo prende il resto della divisione. */
function gruppo(i: number): string[] {
  const perGruppo = Math.ceil(SPEC_DEL_BLOCCO.length / BLOCCHI);
  return SPEC_DEL_BLOCCO.slice(i * perGruppo, (i + 1) * perGruppo);
}

const GRUPPI = Array.from({ length: BLOCCHI }, (_, i) => gruppo(i)).filter((g) => g.length > 0);

/* IL CONTROLLO CHE RENDE LA DIVISIONE SICURA. Se una spec finisse fuori da ogni
 * gruppo, non verrebbe eseguita e nessun rosso lo direbbe: la suite sembrerebbe più
 * verde di quanto è. Percio' l'unione si conta, e una divergenza ferma la config. */
{
  const coperte = GRUPPI.flat();
  if (coperte.length !== SPEC_DEL_BLOCCO.length || new Set(coperte).size !== coperte.length) {
    throw new Error(
      `#211: la divisione in blocchi non copre le spec — ${SPEC_DEL_BLOCCO.length} da eseguire, ` +
        `${coperte.length} coperte (${new Set(coperte).size} distinte). ` +
        `Una spec fuori da ogni blocco non girerebbe e nessuno se ne accorgerebbe.`,
    );
  }
  if (SPEC_DEL_BLOCCO.length === 0) {
    throw new Error("#211: nessuna spec trovata in tests/e2e — un blocco vuoto è un falso verde");
  }
}

/** `testMatch` per un gruppo: i nomi esatti, ancorati, con i punti protetti. */
const matchDi = (g: string[]): RegExp[] =>
  g.map((f) => new RegExp(`[\\\\/]${f.replace(/\./g, "\\.")}$`));

/**
 * LE FASI, in ordine, come elenchi di progetti — **una sola fonte**, letta da
 * `scripts/e2e-blocchi.mjs`, che le esegue in invocazioni separate.
 *
 * Se il wrapper le ricalcolasse per conto suo, il giorno in cui `BLOCCHI` cambia le due
 * liste direbbero cose diverse e la fase mancante non girerebbe — di nuovo in silenzio.
 * Il wrapper verifica anche che ogni progetto della config compaia in esattamente una fase.
 */
export const FASI: string[][] = [
  ["setup", "mobile-a11y", "a11y-desktop"],
  ...GRUPPI.map((_, i) =>
    i === 0 ? ["setup-refresh", "chromium"] : [`setup-refresh-${i + 1}`, `chromium-${i + 1}`],
  ),
];

export default defineConfig({
  ...baseConfig,
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-a11y",
      testMatch: /[\\/]a11y\.spec\.ts$/,
      use: { ...devices["Pixel 7"] },
      dependencies: ["setup"],
    },
    {
      name: "a11y-desktop",
      testMatch: /[\\/]a11y\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    /* ⚠ I RE-LOGIN NON DIPENDONO PIU' DAL BLOCCO CHE LI PRECEDE, e la ragione e' un
     * difetto MISURATO nella prima stesura di questa correzione (S1068).
     *
     * La prima stesura metteva `setup-refresh-2` a dipendere da `chromium`, per averli
     * in sequenza. In Playwright, un progetto la cui dipendenza **fallisce** viene
     * SALTATO: alla corsa di prova `chromium` ha avuto 3 rossi (famiglie ② e ③, che
     * questa cura non tocca) e il risultato e' stato
     *     3 failed · 164 passed · **263 did not run**
     * cioe' due terzi della suite non eseguiti IN SILENZIO — la stessa classe di
     * difetto che #211 racconta, reintrodotta dalla sua cura. Il controllo di copertura
     * qui sopra non l'aveva visto perche' misurava la cosa giusta ma insufficiente: che
     * ogni spec sia ASSEGNATA a un blocco, non che il blocco venga ESEGUITO.
     *
     * Percio' l'ordine fra le fasi NON e' piu' affidato alle dipendenze: lo impone
     * `scripts/e2e-blocchi.mjs`, che invoca Playwright **una volta per fase**. Fasi
     * separate = processi separati, e un rosso non puo' impedire nulla a valle. Dentro
     * la fase la dipendenza resta (il re-login deve precedere i suoi test), ed e' l'unico
     * posto dove serve.
     *
     * ⚠ Lanciare questa config in un colpo solo (`playwright test --config=…`) esegue
     * tutto ma NON garantisce che i re-login cadano al punto giusto: l'entrypoint
     * supportato e' `pnpm test:e2e:prod`, che passa dal wrapper. */
    {
      name: "setup-refresh",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    ...GRUPPI.flatMap((g, i) => {
      // Il PRIMO blocco si chiama `chromium` e non `chromium-1`: e' il nome che la CI,
      // gli artefatti e le abitudini conoscono, e rinominarlo avrebbe rotto cose per
      // una ragione estetica.
      const nome = i === 0 ? "chromium" : `chromium-${i + 1}`;
      const mioRelogin = i === 0 ? "setup-refresh" : `setup-refresh-${i + 1}`;
      const blocco = {
        name: nome,
        testMatch: matchDi(g),
        use: { ...devices["Desktop Chrome"] },
        dependencies: [mioRelogin],
      };
      if (i === 0) return [blocco];
      return [
        {
          name: mioRelogin,
          testMatch: /auth\.setup\.ts/,
          use: { ...devices["Desktop Chrome"] },
        },
        blocco,
      ];
    }),
    ...(SHOWCASE_ENABLED
      ? [
          {
            name: "chromium-anonymous",
            testMatch: /showcase-a11y\.spec\.ts/,
            use: { ...devices["Desktop Chrome"] },
          },
        ]
      : []),
  ],
  webServer: [
    {
      command: `pnpm exec next start -p ${WEB_PORT}`,
      url: WEB_BASE_URL,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
