/**
 * apps/web/playwright.prod.config.ts — D-24 full-suite config (prod build).
 *
 * The dev-mode config (playwright.config.ts) is for per-spec iteration only:
 * auth.setup sessions live exactly 15 minutes (hrx_access cookie TTL; the
 * refresh cookie is path-scoped to /v1/auth and never traverses the /api
 * proxy), so a ~90min dev-mode full run dies mid-suite. This config is the
 * canonical FULL-SUITE entrypoint (`pnpm test:e2e:prod`, which runs
 * `next build` first):
 *
 *  - webServer = `next start` on the build emitted by the npm script
 *    (S984 proof: prod-mode rerun of ~100 tests in 7min, green; doctrine
 *    "verify E2E in PROD build not dev"). reuseExistingServer:false fails
 *    fast if a stale dev server still holds the port (known trap — see
 *    memory reference_playwright_stale_dev_servers).
 *  - project chain: setup → mobile-a11y + a11y-desktop (the long audit
 *    block, ~70 axe scans) → setup-refresh (re-login: rewrites the same
 *    tests/.auth/*.json) → chromium (rest of the suite on FRESH 15-min
 *    cookies) → keeps the suite below the session ceiling even as it grows.
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
 * Rate-limit note: one auth.setup pass = 5 login POSTs (cap 10/5min per IP).
 * setup + setup-refresh within the same 5-min window would exceed the cap if
 * the a11y block ever gets faster than 5min — belt-and-suspenders: set
 * AUTH_LOGIN_RATELIMIT_MAX=50 in the local API .env (escape hatch already
 * shipped, apps/api/src/modules/auth/routes.ts).
 */
import { defineConfig, devices } from "@playwright/test";
import baseConfig, { WEB_BASE_URL, WEB_PORT } from "./playwright.config";

const SHOWCASE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_SHOWCASE === "1";

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
    {
      // D-24 mid-suite re-login: re-runs auth.setup AFTER the long a11y block,
      // rewriting tests/.auth/*.json so every later context starts on fresh
      // 15-minute cookies.
      name: "setup-refresh",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["mobile-a11y", "a11y-desktop"],
    },
    {
      name: "chromium",
      testMatch: /.*\.spec\.ts/,
      testIgnore: SHOWCASE_ENABLED
        ? [/showcase-a11y\.spec\.ts/, /[\\/]a11y\.spec\.ts$/]
        : [
            /showcase-a11y\.spec\.ts/,
            /[\\/]a11y\.spec\.ts$/,
            // Prod build without the showcase flag → /showcase routes 404 and
            // showcase-smoke asserts status<400 (no self-skip).
            /showcase-smoke\.spec\.ts/,
          ],
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup-refresh"],
    },
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
