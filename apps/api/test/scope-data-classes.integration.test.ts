/**
 * apps/api/test/scope-data-classes.integration.test.ts — F2 of ADR-0027 (data-class taxonomy).
 *
 * Guards the classification against drift (a typo or a renamed RBAC resource) and verifies the
 * sensitive/axis split. Derived from the live RBAC resources — no hardcoded resource list to rot.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { pool } from "../src/db/client.js";
import {
  RESOURCE_DATA_CLASS,
  SENSITIVE_DATA_CLASSES,
  dataClassOf,
  isSensitiveClass,
  isSensitiveResource,
} from "../src/lib/scope/data-classes.js";

describe("scope/data-classes — taxonomy (F2, ADR-0027)", () => {
  let dbResources: Set<string>;

  beforeAll(async () => {
    const r = await pool.query<{ resource: string }>(
      `SELECT DISTINCT auth_permission_resource AS resource FROM sys.sys_auth_permissions`,
    );
    dbResources = new Set(r.rows.map((x) => x.resource));
  });

  it("DRIFT: every classified resource is a real RBAC resource (no typo / stale entry)", () => {
    for (const resource of Object.keys(RESOURCE_DATA_CLASS)) {
      expect(dbResources.has(resource), `classified resource not present in DB: ${resource}`).toBe(true);
    }
  });

  it("the known-sensitive resources are classified as sensitive (each of the 4 categories)", () => {
    expect(isSensitiveResource("compensation_intelligence")).toBe(true); // COMPENSATION
    expect(isSensitiveResource("skill")).toBe(true); // SKILL
    expect(isSensitiveResource("assessment")).toBe(true); // EVALUATION
    expect(isSensitiveResource("user_profile")).toBe(true); // PERSONAL
  });

  it("classes map to the right axis (4 sensitive → org; ACTIVITY → functional)", () => {
    expect(isSensitiveClass("PERSONAL")).toBe(true);
    expect(isSensitiveClass("COMPENSATION")).toBe(true);
    expect(isSensitiveClass("SKILL")).toBe(true);
    expect(isSensitiveClass("EVALUATION")).toBe(true);
    expect(isSensitiveClass("ACTIVITY")).toBe(false); // functional axis, not sensitive
    expect(SENSITIVE_DATA_CLASSES.has("ACTIVITY")).toBe(false);
  });

  it("a non-person resource is unclassified → RBAC + tenant only", () => {
    expect(dataClassOf("blueprint")).toBeNull();
    expect(dataClassOf("tenant")).toBeNull();
    expect(isSensitiveResource("role")).toBe(false);
  });
});
