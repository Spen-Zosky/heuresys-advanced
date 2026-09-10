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
import { RISORSE_DI_CATALOGO } from "../src/lib/scope/gate.js";

// Una risorsa di CATALOGO presa dall'elenco vivo, mai una costante che invecchia (ADR-0039).
const risorsaDiCatalogo = [...RISORSE_DI_CATALOGO.keys()][0];
if (!risorsaDiCatalogo) throw new Error("nessuna risorsa di catalogo dichiarata — ADR-0039 rotto");
// Una risorsa che non e' ne' sensibile ne' un catalogo: l'unica davvero esente.
const risorsaEsente = "leads";

// Any sensitive resource from the live taxonomy (never a literal that can drift).
const sensitiveResource = Object.keys(RESOURCE_DATA_CLASS).find((r) => isSensitiveResource(r));
if (!sensitiveResource) throw new Error("taxonomy has no sensitive resource — F2 broken");

describe("scope/gate — org-gate boot assertion (D-51, ADR-0027 F2 prescriptive)", () => {
  it("the real app boots with EVERY sensitive read route declared (no violations)", async () => {
    const { app } = await buildTestApp();
    await app.ready();
    const stats = app.orgGateStats;
    expect(stats.violations).toEqual([]);
    expect(stats.tenantViolations).toEqual([]); // B23
    expect(stats.catalogViolations).toEqual([]); // ADR-0039
    // The surface was actually collected (the assertion is live, not vacuously green).
    expect(stats.sensitiveReadRoutes.length).toBeGreaterThan(0);
    for (const r of stats.sensitiveReadRoutes) {
      expect(["service", "catalog", "aggregate"], `${r.method} ${r.url}`).toContain(r.orgGate);
      expect(["service", "platform"], `${r.method} ${r.url}`).toContain(r.tenantGate);
    }
    // ADR-0039: anche la popolazione dei cataloghi e' stata raccolta davvero, e ogni rotta
    // porta una delle quattro dichiarazioni. Senza questo, un verde nascerebbe dal vuoto.
    expect(stats.catalogReadRoutes.length).toBeGreaterThan(0);
    for (const r of stats.catalogReadRoutes) {
      expect(["profile", "platform", "open", "tenant"], `${r.method} ${r.url}`)
        .toContain(r.catalogGate);
    }
    await app.close();
  });

  it("a sensitive read route WITHOUT config.orgGate refuses to boot (ORG_GATE_MISSING)", async () => {
    const app = Fastify();
    registerOrgGateAssertion(app);
    app.get(
      "/naked",
      {
        config: { tenantGate: "service" },
        preHandler: [requirePermission(`${sensitiveResource}:read`)],
      },
      async () => ({}),
    );
    await expect(app.ready()).rejects.toThrow(/ORG_GATE_MISSING[\s\S]*\/naked/);
    await app.close();
  });

  it("a sensitive read route WITHOUT config.tenantGate refuses to boot (TENANT_GATE_MISSING, B23)", async () => {
    const app = Fastify();
    registerOrgGateAssertion(app);
    app.get(
      "/naked-tenant",
      {
        config: { orgGate: "service" },
        preHandler: [requirePermission(`${sensitiveResource}:read`)],
      },
      async () => ({}),
    );
    await expect(app.ready()).rejects.toThrow(/TENANT_GATE_MISSING[\s\S]*\/naked-tenant/);
    await app.close();
  });

  it("the same route WITH both declarations boots", async () => {
    const app = Fastify();
    registerOrgGateAssertion(app);
    app.get(
      "/declared",
      {
        config: { orgGate: "service", tenantGate: "service" },
        preHandler: [requirePermission(`${sensitiveResource}:read`)],
      },
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
      // ⚠ Era `blueprint:read`, e dal 2026-09-10 non e' piu' esente: `blueprint` e' entrata
      // in RISORSE_DI_CATALOGO (ADR-0039), quindi quella rotta sarebbe una violazione del
      // terzo asse. Serve una risorsa che non sia ne' sensibile ne' un catalogo.
      { preHandler: [requirePermission(`${risorsaEsente}:read`)] },
      async () => ({}),
    );
    await expect(app.ready()).resolves.toBeDefined();
    expect(stats.sensitiveReadRoutes).toEqual([]);
    expect(stats.catalogReadRoutes).toEqual([]);
    await app.close();
  });

  // ── ADR-0039, il terzo asse: il catalogo ────────────────────────────────────────────
  it("una rotta di lettura su un CATALOGO senza config.catalogGate non avvia (CATALOG_GATE_MISSING)", async () => {
    const app = Fastify();
    registerOrgGateAssertion(app);
    app.get(
      "/catalogo-muto",
      { preHandler: [requirePermission(`${risorsaDiCatalogo}:read`)] },
      async () => ({}),
    );
    await expect(app.ready()).rejects.toThrow(/CATALOG_GATE_MISSING[\s\S]*\/catalogo-muto/);
    await app.close();
  });

  it("la stessa rotta, dichiarata, avvia — e un valore fuori dall'insieme chiuso no", async () => {
    const buona = Fastify();
    registerOrgGateAssertion(buona);
    buona.get(
      "/catalogo-dichiarato",
      { config: { catalogGate: "profile" }, preHandler: [requirePermission(`${risorsaDiCatalogo}:read`)] },
      async () => ({}),
    );
    await expect(buona.ready()).resolves.toBeDefined();
    await buona.close();

    const cattiva = Fastify();
    registerOrgGateAssertion(cattiva);
    cattiva.get(
      "/catalogo-inventato",
      {
        // Un valore che l'insieme chiuso non contiene: deve valere quanto non dichiarare.
        config: { catalogGate: "quello_che_mi_pare" as never },
        preHandler: [requirePermission(`${risorsaDiCatalogo}:read`)],
      },
      async () => ({}),
    );
    await expect(cattiva.ready()).rejects.toThrow(/CATALOG_GATE_MISSING/);
    await cattiva.close();
  });

  it("su un catalogo il verbo di SCRITTURA e lo self-scope restano esenti", async () => {
    const app = Fastify();
    const stats = registerOrgGateAssertion(app);
    app.get("/cat-write", { preHandler: [requirePermission(`${risorsaDiCatalogo}:create`)] }, async () => ({}));
    app.get("/cat-self", { preHandler: [requirePermission(`${risorsaDiCatalogo}:read:self`)] }, async () => ({}));
    await expect(app.ready()).resolves.toBeDefined();
    expect(stats.catalogReadRoutes).toEqual([]);
    await app.close();
  });
});
