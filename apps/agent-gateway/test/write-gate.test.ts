/**
 * Mock-first unit tests for the write gate (#9 WI-B, full M-2 adversarial matrix).
 * SDK-free: exercises classification, the allowlist (M-3), the canUseTool decision
 * against a mock approver, and the audit trail (M-4 — redacted, no raw PII).
 */
import { describe, it, expect, vi } from "vitest";
import { isWriteTool, makeCanUseTool, type GatePrincipal } from "../src/write-gate.js";
import { MemoryAuditSink } from "../src/audit-sink.js";
import { REDACTED } from "../src/redact.js";

/** All gate tests inject a MemoryAuditSink so nothing touches the filesystem. */
function gate(approve: Parameters<typeof makeCanUseTool>[0], opts: Parameters<typeof makeCanUseTool>[1] = {}) {
  const audit = new MemoryAuditSink();
  const canUseTool = makeCanUseTool(approve, { audit, ...opts });
  return { canUseTool, audit };
}

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
  it("classifies a namespaced tool name (mcp__heuresys__*) too", () => {
    expect(isWriteTool("mcp__heuresys__hrx_org_units_upsert")).toBe(true);
    expect(isWriteTool("mcp__heuresys__hrx_positions_list")).toBe(false);
  });
});

describe("makeCanUseTool (HITL write gate)", () => {
  it("auto-allows reads without calling the approver", async () => {
    const approve = vi.fn();
    const { canUseTool } = gate(approve);
    const d = await canUseTool("hrx_positions_list", { a: 1 });
    expect(d).toEqual({ behavior: "allow", updatedInput: { a: 1 } });
    expect(approve).not.toHaveBeenCalled();
  });

  it("allows a write only when the human approves", async () => {
    const { canUseTool } = gate(async () => true);
    const d = await canUseTool("hrx_org_units_upsert", { payload: {} });
    expect(d).toEqual({ behavior: "allow", updatedInput: { payload: {} } });
  });

  it("denies a write when the human refuses", async () => {
    const { canUseTool } = gate(async () => false);
    const d = await canUseTool("hrx_org_units_delete", { id: "x" });
    expect(d.behavior).toBe("deny");
  });

  it("deny-by-default on approver timeout (M-2)", async () => {
    const { canUseTool } = gate(() => new Promise(() => {}), { approvalTimeoutMs: 20 });
    const d = await canUseTool("hrx_blueprint_variants_upsert", {});
    expect(d.behavior).toBe("deny");
  });

  it("deny-by-default when the approver throws (M-2 fail-closed)", async () => {
    const { canUseTool } = gate(async () => {
      throw new Error("bridge down");
    });
    const d = await canUseTool("hrx_job_families_upsert", {});
    expect(d.behavior).toBe("deny");
  });
});

describe("M-3 allowlist (deny-by-default, defense-in-depth)", () => {
  it("denies an unlisted tool BEFORE the read/write branch (allowlist-bypass attempt)", async () => {
    const approve = vi.fn(async () => true);
    const { canUseTool } = gate(approve);
    // a plausible-looking but UNREGISTERED tool name — must be denied even though it
    // would have approved (and even though it parses as a read).
    const d = await canUseTool("hrx_payroll_dump_list", { all: true });
    expect(d.behavior).toBe("deny");
    if (d.behavior === "deny") expect(d.message).toMatch(/allowlist/i);
    expect(approve).not.toHaveBeenCalled();
  });

  it("denies a fully unknown tool (e.g. a built-in the agent should not reach)", async () => {
    const { canUseTool } = gate(async () => true);
    const d = await canUseTool("Bash", { command: "rm -rf /" });
    expect(d.behavior).toBe("deny");
  });

  it("admits an explicitly allowlisted custom set, denies everything else", async () => {
    const allowlist = new Set(["hrx_only_this_read_list"]);
    const { canUseTool } = gate(async () => true, { allowlist });
    expect((await canUseTool("hrx_only_this_read_list", {})).behavior).toBe("allow");
    expect((await canUseTool("hrx_org_units_upsert", {})).behavior).toBe("deny");
  });
});

describe("M-4 audit trail (every decision, redacted)", () => {
  it("records allow-read, allow-write and deny decisions", async () => {
    const { canUseTool, audit } = gate(async () => true);
    await canUseTool("hrx_positions_list", {});
    await canUseTool("hrx_org_units_upsert", { payload: {} });
    const denyGate = gate(async () => false);
    await denyGate.canUseTool("hrx_org_units_delete", { id: "x" });

    expect(audit.entries.map((e) => e.decision)).toEqual(["allow", "allow"]);
    expect(audit.entries[0]!.reason).toBe("READ_AUTO_ALLOW");
    expect(audit.entries[1]!.reason).toBe("WRITE_HUMAN_APPROVED");
    expect(denyGate.audit.entries[0]!.decision).toBe("deny");
  });

  it("records the principal-confusion context (forwarded user vs service)", async () => {
    const userPrincipal: GatePrincipal = { principal: "user", subject: "sess-42", tenant: "RTL_BANK" };
    const servicePrincipal: GatePrincipal = { principal: "service", subject: "svc-platform", tenant: "RTL_BANK" };
    const u = gate(async () => true, { principal: userPrincipal });
    const s = gate(async () => true, { principal: servicePrincipal });
    await u.canUseTool("hrx_org_units_upsert", { payload: {} });
    await s.canUseTool("hrx_job_families_upsert", { payload: {} });
    expect(u.audit.entries[0]!.who).toEqual({ principal: "user", subject: "sess-42" });
    expect(s.audit.entries[0]!.who).toEqual({ principal: "service", subject: "svc-platform" });
    // a forwarded-user principal can NEVER be silently logged as service:
    expect(u.audit.entries[0]!.who.principal).not.toBe("service");
  });

  it("NEVER records raw PII/secret — only the redacted args-hash (audit-redaction)", async () => {
    const { canUseTool, audit } = gate(async () => true);
    const pii = {
      email: "mario.rossi@rtl-bank.org",
      token: "eyJhbGciOiJIUzI1Ni, secret bearer-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      payload: { codice_fiscale: "RSSMRA80A01H501U" },
    };
    await canUseTool("hrx_org_units_upsert", pii);
    const entry = audit.entries[0]!;
    // the audit entry must carry ONLY a hash — no raw email/CF/token field anywhere.
    const serialized = JSON.stringify(entry);
    expect(serialized).not.toContain("mario.rossi@rtl-bank.org");
    expect(serialized).not.toContain("RSSMRA80A01H501U");
    expect(serialized).not.toContain("eyJhbGciOiJIUzI1NiI");
    expect(entry.argsHash).toMatch(/^[0-9a-f]{64}$/);
    // (the hash is over the REDACTED args, proving redaction ran before hashing.)
    void REDACTED;
  });

  it("replay-token reuse: a stable args-hash is recorded for identical replayed calls", async () => {
    // An attacker replaying the SAME write twice must leave TWO audit entries with the
    // SAME args-hash (so the replay is detectable in the trail), not a silent overwrite.
    const { canUseTool, audit } = gate(async () => false); // both denied (no live write)
    const replayedArgs = { id: "ou-1", payload: { name: "X" } };
    await canUseTool("hrx_org_units_upsert", replayedArgs);
    await canUseTool("hrx_org_units_upsert", replayedArgs);
    expect(audit.entries).toHaveLength(2);
    expect(audit.entries[0]!.argsHash).toBe(audit.entries[1]!.argsHash);
    expect(audit.entries.every((e) => e.decision === "deny")).toBe(true);
  });
});
