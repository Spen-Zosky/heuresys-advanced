import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Local convenience: hydrate TEST_ADMIN_PASSWORD (F-001: env-driven persona password, read by
// fixtures.ts from process.env) from the gitignored repo-root .env when Playwright is run from a
// dev shell. In CI the value comes from the runner env and the repo .env is absent → this is
// skipped. Parsed with fs (no dotenv dependency, no import.meta) so the Playwright config loader
// evaluates it in any module context. Never overrides an existing process.env value (CI wins).
try {
  const envPath = resolve(process.cwd(), "..", "..", ".env");
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!m || m[1] === undefined) continue;
    let val = (m[2] ?? "").trim();
    if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
      val = val.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
} catch {
  // .env absent (CI) — values come from the process environment.
}

// Web server port is overridable so CI can avoid host port collisions. The OCI
// VM self-hosted runner already runs Grafana on :3000 (docker-proxy), so the
// playwright-smoke workflow sets PLAYWRIGHT_WEB_PORT=3100. Locally it defaults
// to 3000. baseURL follows the same override.
//
// D-24 doctrine: this dev-mode config is for PER-SPEC iteration only. The
// storageState sessions from auth.setup are only safe for ~15 minutes
// (hrx_access TTL): past that, contexts sharing the same tests/.auth/*.json
// would silent-refresh the SAME single-use token (post-D-26 the refresh
// works) → replay detection revokes the family mid-suite. Run the FULL
// suite via `pnpm test:e2e:prod` (playwright.prod.config.ts: prod build +
// mid-suite re-login).
export const WEB_PORT = process.env.PLAYWRIGHT_WEB_PORT ?? "3000";
export const WEB_BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  // D-29: clean up the `E2E Test Cert <ts>` rows the ESS cert spec leaves behind
  // (create+list-only surface, no DELETE endpoint). Inherited by the prod config
  // via `...baseConfig`. Best-effort (never fails the run).
  // La coppia setup/teardown regge l'assert di drift: il setup misura la linea di
  // partenza, il teardown ri-misura dopo le pulizie e fallisce se la suite ha lasciato
  // righe. Senza il setup il conteggio finale non distinguerebbe i residui di questa
  // corsa da quelli di chiunque altro. `playwright.prod.config.ts` li eredita via
  // `...baseConfig`, quindi valgono anche nel run completo supportato.
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  fullyParallel: false,
  // Dev-mode runtime (compile-on-demand, Tailwind 4 JIT) introduces occasional
  // hydration-race jitter on cold first-hit, especially on the 4th/5th persona
  // setup. One retry per test absorbs that without masking real bugs.
  retries: 1,
  workers: 1,
  // #219 F2, S1078 — IL TEMPO CHE UN CASO HA A DISPOSIZIONE DEV'ESSERE ALMENO QUELLO CHE
  // I CASI SI CONCEDONO. Senza questa riga vale il default di Playwright, 30 s — mentre
  // **47 spec su 100** (misurati) dichiarano attese da 45 s o 60 s: un
  // `toBeVisible({ timeout: 45_000 })` dentro un test che muore a 30 s è una promessa che
  // non può essere mantenuta, e quando scade l'errore non nomina l'elemento che manca —
  // dice «Test timeout of 30000ms exceeded», cioè non dice niente. È così che quattro casi
  // di `insights-*` si presentavano come guasti dell'applicazione mentre erano la stessa
  // lentezza del modo dev (compile-on-demand) contro un tetto troppo basso.
  // 90 s copre l'attesa più lunga dichiarata (60 s) con margine, e non maschera i guasti
  // veri: quelli scadono sui timeout per-azione, che restano 10 s e 30 s.
  timeout: 90_000,
  // Il `list` scrive su stdout, e lo stdout si perde: una corsa integrale dura minuti,
  // chi la lancia la trotta con `| tail` e il dettaglio dei falliti sparisce — successo in
  // S1081, dove la corsa ha dato 10 rossi e per leggerli è stato necessario RIFARE le fasi.
  // Il JSON è il referto che sopravvive alla corsa: si legge dal FILE, come il referto a11y
  // di #219 F4. `outputFile` fuori da `test-results/`, che Playwright ripulisce a ogni corsa.
  reporter: [["list"], ["json", { outputFile: "esiti-e2e.json" }]],
  use: {
    baseURL: WEB_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    // Mobile-viewport a11y gate (§2.7): same authenticated a11y spec on a
    // Pixel 7 profile (chromium engine — CI installs only chromium; the
    // iPhone descriptors are webkit). Census S983: 0 violations of ANY
    // severity across all 35 unique routes → the gate is live/unconditional
    // (raised-once-stable, same pattern as the desktop serious gate, S982).
    // The testMatch requires a path separator before the filename so
    // showcase-a11y.spec.ts (anonymous, different gate) is not picked up.
    {
      name: "mobile-a11y",
      testMatch: /[\\/]a11y\.spec\.ts$/,
      use: { ...devices["Pixel 7"] },
      dependencies: ["setup"],
    },
    {
      name: "chromium",
      // Match all *.spec.ts EXCEPT showcase-a11y which runs anonymously
      // (showcase routes are gated by NEXT_PUBLIC_ENABLE_SHOWCASE=1, not auth).
      testMatch: /.*\.spec\.ts/,
      testIgnore: /showcase-a11y\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    {
      // Anonymous browser for showcase routes (no DB, no auth, no tunnel).
      // Used by Tier 7 a11y audit pass (axe-core WCAG 2.2 AA, zero-critical).
      name: "chromium-anonymous",
      testMatch: /showcase-a11y\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // On-demand guided-demo screenshot generator (#4). Not part of the default
      // suite (the .gen.ts name is outside the /.*\.spec\.ts/ testMatch). Depends
      // on setup to mint fresh persona storageState (post-MFA).
      name: "capture-demo",
      testMatch: /capture-demo\.gen\.ts/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  webServer: [
    {
      command: `pnpm exec next dev -p ${WEB_PORT}`,
      url: WEB_BASE_URL,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
