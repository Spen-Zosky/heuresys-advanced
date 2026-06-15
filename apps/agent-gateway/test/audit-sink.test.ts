/**
 * Unit tests for audit-sink.ts (#9 WI-B, M-4).
 * SDK-free. MemoryAuditSink records a redacted args-hash (NOT raw PII); hashArgs is
 * deterministic + content-sensitive; toEntry has the right shape; FileAuditSink appends
 * a JSONL line to a temp path (real IO into an OS temp dir, cleaned up).
 */
import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FileAuditSink,
  MemoryAuditSink,
  hashArgs,
  toEntry,
  type AuditInput,
} from "../src/audit-sink.js";

const baseInput: AuditInput = {
  who: { principal: "user", subject: "sess-1" },
  tenant: "RTL_BANK",
  tool: "hrx_org_units_upsert",
  args: { id: "ou-1", payload: { name: "X" } },
  decision: "deny",
  reason: "WRITE_DENIED_OR_TIMEOUT",
};

describe("hashArgs", () => {
  it("is a deterministic 64-hex sha256", () => {
    const h1 = hashArgs({ a: 1, b: 2 });
    const h2 = hashArgs({ a: 1, b: 2 });
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });
  it("differs for different args", () => {
    expect(hashArgs({ a: 1 })).not.toBe(hashArgs({ a: 2 }));
  });
  it("hashes the REDACTED args (raw PII never enters the hash input)", () => {
    // identical except the email value → both redacted to «REDACTED» → SAME hash.
    const h1 = hashArgs({ email: "a@x.io" });
    const h2 = hashArgs({ email: "b@y.io" });
    expect(h1).toBe(h2);
  });
});

describe("toEntry", () => {
  it("produces the AuditEntry shape with a derived ts + argsHash and NO raw args", () => {
    const e = toEntry(baseInput);
    expect(e).toMatchObject({
      who: { principal: "user", subject: "sess-1" },
      tenant: "RTL_BANK",
      tool: "hrx_org_units_upsert",
      decision: "deny",
      reason: "WRITE_DENIED_OR_TIMEOUT",
    });
    expect(e.argsHash).toMatch(/^[0-9a-f]{64}$/);
    expect(new Date(e.ts).toISOString()).toBe(e.ts); // valid ISO-8601
    expect(e).not.toHaveProperty("args"); // raw args never present on the entry
  });
});

describe("MemoryAuditSink", () => {
  it("records the redacted args-hash, not raw PII", async () => {
    const sink = new MemoryAuditSink();
    await sink.record({
      ...baseInput,
      args: { email: "mario.rossi@rtl-bank.org", token: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
    });
    const entry = sink.entries[0]!;
    const serialized = JSON.stringify(entry);
    expect(serialized).not.toContain("mario.rossi@rtl-bank.org");
    expect(serialized).not.toContain("aaaaaaaaaaaaaaaaaaaa");
    expect(entry.argsHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("FileAuditSink", () => {
  let dir: string | undefined;
  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = undefined;
    }
  });

  it("appends a JSONL line to the configured temp path", async () => {
    dir = await mkdtemp(join(tmpdir(), "agw-audit-"));
    const path = join(dir, "nested", "audit.jsonl"); // also proves ensureDir(recursive)
    const sink = new FileAuditSink(path);
    await sink.record(baseInput);
    await sink.record({ ...baseInput, decision: "allow", reason: "WRITE_HUMAN_APPROVED" });

    const content = await readFile(path, "utf8");
    const lines = content.trimEnd().split("\n");
    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(first["tool"]).toBe("hrx_org_units_upsert");
    expect(first["decision"]).toBe("deny");
    expect(first["argsHash"]).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toHaveProperty("args"); // no raw args persisted
    const second = JSON.parse(lines[1]!) as Record<string, unknown>;
    expect(second["decision"]).toBe("allow");
  });
});
