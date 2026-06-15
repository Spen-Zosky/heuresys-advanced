/**
 * Mock-first unit tests for the write gate (#9 WI-B, partial M-2 adversarial matrix).
 * SDK-free: exercises classification + the canUseTool decision against a mock approver.
 */
import { describe, it, expect, vi } from "vitest";
import { isWriteTool, makeCanUseTool } from "../src/write-gate.js";

describe("isWriteTool", () => {
  it("classifies read tools as non-write", () => {
    for (const n of [
      "hrx_org_units_list",
      "hrx_positions_get",
      "hrx_blueprint_variants_list",
      "hrx_skill_prof_levels",
    ]) {
      expect(isWriteTool(n)).toBe(false);
    }
  });
  it("classifies mutating tools as write", () => {
    for (const n of [
      "hrx_org_units_upsert",
      "hrx_kpi_defs_delete",
      "hrx_blueprint_activation_upsert",
      "hrx_tenant_materialize",
      "hrx_compensation_recommend",
    ]) {
      expect(isWriteTool(n)).toBe(true);
    }
  });
});

describe("makeCanUseTool (HITL write gate)", () => {
  it("auto-allows reads without calling the approver", async () => {
    const approve = vi.fn();
    const gate = makeCanUseTool(approve);
    const d = await gate("hrx_positions_list", { a: 1 });
    expect(d).toEqual({ behavior: "allow", updatedInput: { a: 1 } });
    expect(approve).not.toHaveBeenCalled();
  });

  it("allows a write only when the human approves", async () => {
    const gate = makeCanUseTool(async () => true);
    const d = await gate("hrx_org_units_upsert", { payload: {} });
    expect(d).toEqual({ behavior: "allow", updatedInput: { payload: {} } });
  });

  it("denies a write when the human refuses", async () => {
    const gate = makeCanUseTool(async () => false);
    const d = await gate("hrx_org_units_delete", { id: "x" });
    expect(d.behavior).toBe("deny");
  });

  it("deny-by-default on approver timeout (M-2)", async () => {
    const gate = makeCanUseTool(() => new Promise(() => {}), { approvalTimeoutMs: 20 });
    const d = await gate("hrx_blueprint_variants_upsert", {});
    expect(d.behavior).toBe("deny");
  });

  it("deny-by-default when the approver throws (M-2 fail-closed)", async () => {
    const gate = makeCanUseTool(async () => {
      throw new Error("bridge down");
    });
    const d = await gate("hrx_job_families_upsert", {});
    expect(d.behavior).toBe("deny");
  });
});
