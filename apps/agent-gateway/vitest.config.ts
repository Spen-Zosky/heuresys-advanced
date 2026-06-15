import { defineConfig } from "vitest/config";

// Mock-first unit tests only (no DB, no live SDK, no live heuresys). The gate
// logic and the /v1 client are exercised against in-memory mocks.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
