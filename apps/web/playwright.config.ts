import { defineConfig, devices } from "@playwright/test";

// Web server port is overridable so CI can avoid host port collisions. The OCI
// VM self-hosted runner already runs Grafana on :3000 (docker-proxy), so the
// playwright-smoke workflow sets PLAYWRIGHT_WEB_PORT=3100. Locally it defaults
// to 3000. baseURL follows the same override.
const WEB_PORT = process.env.PLAYWRIGHT_WEB_PORT ?? "3000";
const WEB_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  // Dev-mode runtime (compile-on-demand, Tailwind 4 JIT) introduces occasional
  // hydration-race jitter on cold first-hit, especially on the 4th/5th persona
  // setup. One retry per test absorbs that without masking real bugs.
  retries: 1,
  workers: 1,
  reporter: [["list"]],
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
