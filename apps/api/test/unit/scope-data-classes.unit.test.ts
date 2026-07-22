/**
 * apps/api/test/unit/scope-data-classes.unit.test.ts — D-64 unit layer.
 * Tassonomia data-class ADR-0027 (D-51: resa prescrittiva). Le proprietà sono
 * INVARIANTI comportamentali, non copie della mappa (regola S1012
 * no-hardcoded-test-data): coerenza tra dataClassOf / isSensitiveClass /
 * isSensitiveResource, e i pilastri I18 (sensitive = org-axis only).
 */

import { describe, it, expect } from "vitest";
import {
  SENSITIVE_DATA_CLASSES,
  RESOURCE_DATA_CLASS,
  dataClassOf,
  isSensitiveClass,
  isSensitiveResource,
} from "../../src/lib/scope/data-classes.js";

describe("scope data-classes (unit)", () => {
  it("coerenza: isSensitiveResource(r) ⟺ dataClassOf(r) ∈ SENSITIVE_DATA_CLASSES", () => {
    for (const resource of Object.keys(RESOURCE_DATA_CLASS)) {
      const cls = dataClassOf(resource);
      expect(cls, `dataClassOf(${resource})`).not.toBeNull();
      expect(isSensitiveResource(resource)).toBe(isSensitiveClass(cls!));
    }
  });

  it("risorsa ignota → dataClassOf null e MAI sensibile-per-caso", () => {
    expect(dataClassOf("resource_that_does_not_exist")).toBeNull();
    expect(isSensitiveResource("resource_that_does_not_exist")).toBe(false);
  });

  it("i pilastri I18 restano sensibili (PERSONAL/COMPENSATION/SKILL/EVALUATION)", () => {
    // I18: i dati personali altrui passano SOLO dalla catena organizzativa.
    for (const cls of ["PERSONAL", "COMPENSATION", "SKILL", "EVALUATION"] as const) {
      expect(SENSITIVE_DATA_CLASSES.has(cls), `${cls} deve restare sensitive`).toBe(true);
    }
  });

  it("ogni valore della mappa è una data-class che il predicato sa classificare", () => {
    for (const [resource, cls] of Object.entries(RESOURCE_DATA_CLASS)) {
      expect(typeof isSensitiveClass(cls), `class di ${resource}`).toBe("boolean");
    }
  });
});
