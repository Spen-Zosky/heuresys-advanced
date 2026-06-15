/**
 * Unit tests for approval-bridge.ts (#9 WI-B, M-2 §3 HITL registry).
 * SDK-free + framework-free. Clock + id-generator injected so timeout is deterministic.
 * Covers: approve→allow, deny→deny, timeout→deny, unknown id→deny/no-op,
 * already-resolved id→no-op, idempotent double-resolve.
 */
import { describe, it, expect, vi } from "vitest";
import { ApprovalRegistry } from "../src/approval-bridge.js";

describe("ApprovalRegistry", () => {
  it("resolves true when the human allows", async () => {
    const reg = new ApprovalRegistry({ genId: () => "id-1" });
    const { approvalId, decided } = reg.create();
    expect(approvalId).toBe("id-1");
    expect(reg.size).toBe(1);
    expect(reg.resolve("id-1", "allow")).toBe(true);
    await expect(decided).resolves.toBe(true);
    expect(reg.size).toBe(0);
  });

  it("resolves false when the human denies", async () => {
    const reg = new ApprovalRegistry({ genId: () => "id-2" });
    const { decided } = reg.create();
    expect(reg.resolve("id-2", "deny")).toBe(true);
    await expect(decided).resolves.toBe(false);
  });

  it("auto-denies (resolve false) on timeout", async () => {
    vi.useFakeTimers();
    try {
      const reg = new ApprovalRegistry({ approvalTimeoutMs: 50, genId: () => "id-3" });
      const { decided } = reg.create();
      vi.advanceTimersByTime(51);
      await expect(decided).resolves.toBe(false);
      expect(reg.size).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns false (no-op) for an unknown approvalId", () => {
    const reg = new ApprovalRegistry();
    expect(reg.resolve("does-not-exist", "allow")).toBe(false);
  });

  it("returns false (no-op) for an already-resolved id, leaving the first decision intact", async () => {
    const reg = new ApprovalRegistry({ genId: () => "id-4" });
    const { decided } = reg.create();
    expect(reg.resolve("id-4", "allow")).toBe(true);
    await expect(decided).resolves.toBe(true);
    // second resolve (e.g. a replayed approve request) is a no-op — cannot flip the decision.
    expect(reg.resolve("id-4", "deny")).toBe(false);
  });

  it("returns false (no-op) for an expired (timed-out) id", async () => {
    vi.useFakeTimers();
    try {
      const reg = new ApprovalRegistry({ approvalTimeoutMs: 30, genId: () => "id-5" });
      const { decided } = reg.create();
      vi.advanceTimersByTime(31);
      await expect(decided).resolves.toBe(false);
      // a late human click on an already-expired approval is a no-op.
      expect(reg.resolve("id-5", "allow")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("generates a unique id per create() with the default generator", () => {
    const reg = new ApprovalRegistry();
    const a = reg.create();
    const b = reg.create();
    expect(a.approvalId).not.toBe(b.approvalId);
    expect(reg.size).toBe(2);
    reg.resolve(a.approvalId, "deny");
    reg.resolve(b.approvalId, "deny");
  });
});
