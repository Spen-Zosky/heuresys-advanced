/**
 * apps/api/test/org-gate.integration.test.ts — D-51: the data-class taxonomy is PRESCRIPTIVE.
 *
 * Verifies the boot-time org-gate assertion (lib/scope/gate.ts): the real route surface boots
 * with every sensitive read route consciously declared, and a hypothetical new module that
 * forgets the declaration CANNOT boot. Expectations are derived from the taxonomy itself —
 * no hardcoded route/resource lists to rot.
 */

import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { buildTestApp } from "./helpers/build-test-app.js";
import { registerOrgGateAssertion } from "../src/lib/scope/gate.js";
import { requirePermission } from "../src/middleware/rbac.js";
import { RESOURCE_DATA_CLASS, isSensitiveResource } from "../src/lib/scope/data-classes.js";

// Any sensitive resource from the live taxonomy (never a literal that can drift).
const sensitiveResource = Object.keys(RESOURCE_DATA_CLASS).find((r) => isSensitiveResource(r));
if (!sensitiveResource) throw new Error("taxonomy has no sensitive resource — F2 broken");

describe("scope/gate — org-gate boot assertion (D-51, ADR-0027 F2 prescriptive)", () => {
  it("the real app boots with EVERY sensitive read route declared (no violations)", async () => {
    const { app } = await buildTestApp();
    await app.ready();
    const stats = app.orgGateStats;
    expect(stats.violations).toEqual([]);
    // The surface was actually collected (the assertion is live, not vacuously green).
    expect(stats.sensitiveReadRoutes.length).toBeGreaterThan(0);
    for (const r of stats.sensitiveReadRoutes) {
      expect(["service", "catalog", "aggregate"], `${r.method} ${r.url}`).toContain(r.orgGate);
    }
    await app.close();
  });

  it("a sensitive read route WITHOUT config.orgGate refuses to boot (ORG_GATE_MISSING)", async () => {
    const app = Fastify();
    registerOrgGateAssertion(app);
    app.get(
      "/naked",
      { preHandler: [requirePermission(`${sensitiveResource}:read`)] },
      async () => ({}),
    );
    await expect(app.ready()).rejects.toThrow(/ORG_GATE_MISSING[\s\S]*\/naked/);
    await app.close();
  });

  it("the same route WITH a declaration boots", async () => {
    const app = Fastify();
    registerOrgGateAssertion(app);
    app.get(
      "/declared",
      { config: { orgGate: "service" }, preHandler: [requirePermission(`${sensitiveResource}:read`)] },
      async () => ({}),
    );
    await expect(app.ready()).resolves.toBeDefined();
    await app.close();
  });

  it("self-scope, write-verb and unclassified permissions are exempt by design", async () => {
    const app = Fastify();
    const stats = registerOrgGateAssertion(app);
    app.get(
      "/self",
      { preHandler: [requirePermission(`${sensitiveResource}:read:self`)] },
      async () => ({}),
    );
    app.get(
      "/write-shaped",
      { preHandler: [requirePermission(`${sensitiveResource}:create`)] },
      async () => ({}),
    );
    app.get(
      "/unclassified",
      { preHandler: [requirePermission("blueprint:read")] }, // unclassified per the drift test
      async () => ({}),
    );
    await expect(app.ready()).resolves.toBeDefined();
    expect(stats.sensitiveReadRoutes).toEqual([]);
    await app.close();
  });
});
