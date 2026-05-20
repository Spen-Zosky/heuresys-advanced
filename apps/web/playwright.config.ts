import { defineConfig, devices } from "@playwright/test";

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
    baseURL: "http://localhost:3000",
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
      command: "pnpm dev",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
