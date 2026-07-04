/**
 * Live M-2 WRITE-gate acceptance for #9 (DoD: live E2E on real data, no mock).
 *
 * Proves the human-in-the-loop write gate END-TO-END against the live platform,
 * as a real RTL_BANK tenant admin (federica.marchetti@rtl-bank.org → TENANT_ADMIN,
 * tenant 86ba7a65) so EVERY write lands on the RTL_BANK test tenant only (safety
 * §0.5: never HEURESYS). Two runs through the gateway /agent SSE stream:
 *
 *   1. ALLOW — the agent proposes a KPI-definition create; the gateway emits
 *      `approval_required`; this script POSTs /agent/approve {decision:'allow'};
 *      the write reaches POST /v1/kpi-definitions and creates a real row. Verified
 *      by a re-fetch (GET /v1/kpi-definitions?search=<code>) → row present, on RTL_BANK.
 *   2. DENY — same shape, but approve with {decision:'deny'} → canUseTool fails CLOSED
 *      (DENY_NOT_APPROVED), the write NEVER reaches /v1. Verified by re-fetch → absent.
 *
 * Then ROLLBACK: DELETE /v1/kpi-definitions/<id> of the ALLOW row (CSRF double-submit)
 * → re-fetch → gone. The FileAuditSink records every gate decision (M-4).
 *
 * Run (from apps/agent-gateway):
 *   ACC_EMAIL=federica.marchetti@rtl-bank.org ACC_PASSWORD='<password>' \
 *   pnpm exec tsx scripts/live-write-acceptance.ts
 *
 * TOTP computed inline (RFC 6238). Fixture secrets are repo test fixtures (no real
 * production secret).
 */
import { createHmac } from "node:crypto";
import { FIXTURE_TOTP_SECRETS } from "../../api/test/helpers/mfa-fixture-secrets.js";

const API = (process.env.HEURESYS_API ?? "http://localhost:3001").replace(/\/$/, "");
const GATEWAY = (process.env.AGENT_GATEWAY ?? "http://localhost:8790").replace(/\/$/, "");
const EMAIL = process.env.ACC_EMAIL ?? "federica.marchetti@rtl-bank.org";
const PASSWORD = process.env.ACC_PASSWORD ?? process.env.TEST_ADMIN_PASSWORD ?? "";

function base32Decode(s: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of s.replace(/=+$/, "").toUpperCase()) {
    const v = alphabet.indexOf(ch);
    if (v < 0) continue;
    bits += v.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function totp(secretBase32: string): string {
  const key = base32Decode(secretBase32);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return (code % 1_000_000).toString().padStart(6, "0");
}

function setCookies(res: Response): string[] {
  return res.headers.getSetCookie?.() ?? [];
}
function cookieHeader(raw: string[]): string {
  return raw.map((c) => c.split(";")[0]).join("; ");
}
function valueOf(cookieHdr: string, name: string): string {
  for (const part of cookieHdr.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return "";
}

interface Sess {
  cookies: string; // hrx_access=..; hrx_refresh=..; hrx_csrf=..
  csrf: string; // value of hrx_csrf (double-submit)
}

async function login(): Promise<Sess> {
  const r1 = await fetch(`${API}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const j1 = (await r1.json()) as { status: string; challengeToken?: string };
  console.log(`[login] step1 → ${r1.status} status=${j1.status}`);
  let raw = setCookies(r1);
  if (j1.status === "mfa_required") {
    if (!j1.challengeToken) throw new Error("mfa_required without challengeToken");
    const secret = FIXTURE_TOTP_SECRETS[EMAIL];
    if (!secret) throw new Error(`no fixture TOTP secret for ${EMAIL}`);
    const r2 = await fetch(`${API}/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, challengeToken: j1.challengeToken, mfaCode: totp(secret) }),
    });
    const j2 = (await r2.json()) as { status: string };
    console.log(`[login] step2 (TOTP) → ${r2.status} status=${j2.status}`);
    if (j2.status !== "success") throw new Error(`MFA step failed: ${JSON.stringify(j2)}`);
    raw = setCookies(r2);
  } else if (j1.status !== "success") {
    throw new Error(`unexpected login state: ${JSON.stringify(j1)}`);
  }
  const cookies = cookieHeader(raw);
  const csrf = valueOf(cookies, "hrx_csrf");
  console.log(`[login] cookies: ${cookies.split(";").map((c) => c.split("=")[0]?.trim()).join(", ")} csrf=${csrf ? "set" : "MISSING"}`);
  return { cookies, csrf };
}

interface WriteRunResult {
  approvalSeen: boolean;
  approvedDecision: "allow" | "deny" | "none";
  writeReached: boolean; // a kpi-definition row JSON came back from the tool
  writeDenied: boolean; // the deny message surfaced in a tool_result
  createdId: string | null;
  errorIsError: boolean;
  events: number;
}

/** Drives one gated write through the gateway SSE, resolving the HITL with `decision`. */
async function runWrite(prompt: string, decision: "allow" | "deny", cookies: string): Promise<WriteRunResult> {
  const res = await fetch(`${GATEWAY}/agent`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookies },
    body: JSON.stringify({ prompt }),
  });
  console.log(`\n[write:${decision}] POST /agent → HTTP ${res.status} (SSE)`);
  if (!res.ok || !res.body) throw new Error(`gateway /agent failed: HTTP ${res.status} ${await res.text().catch(() => "")}`);

  const out: WriteRunResult = {
    approvalSeen: false,
    approvedDecision: "none",
    writeReached: false,
    writeDenied: false,
    createdId: null,
    errorIsError: false,
    events: 0,
  };

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";

  const handleBlock = async (block: string): Promise<void> => {
    if (!block.trim()) return;
    out.events++;
    // Reassemble the SSE `data:` payload of this frame, independent of the `event:`
    // name line. An approval frame is the one carrying an approvalId (server.ts).
    const dataStr = block
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .join("");
    if (!dataStr) return;
    let obj: Record<string, unknown> | null = null;
    try {
      obj = JSON.parse(dataStr) as Record<string, unknown>;
    } catch {
      obj = null;
    }

    // HITL: resolve the pending write via POST /agent/approve.
    if (obj && typeof obj["approvalId"] === "string") {
      out.approvalSeen = true;
      const approvalId = obj["approvalId"];
      console.log(`[write:${decision}] approval_required tool=${String(obj["tool"])} id=${approvalId.slice(0, 8)}… → resolving '${decision}'`);
      try {
        const ar = await fetch(`${GATEWAY}/agent/approve`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ approvalId, decision }),
        });
        const aj = (await ar.json()) as { resolved?: boolean };
        out.approvedDecision = decision;
        console.log(`[write:${decision}] /agent/approve → ${ar.status} resolved=${aj.resolved}`);
      } catch (e) {
        console.log(`[write:${decision}] approve POST failed: ${String(e)}`);
      }
      return;
    }

    // Otherwise an SDK event — scan the raw (JSON-escaped) payload.
    // The write tool_result embeds the created row as an escaped JSON string,
    // so kpiDefinitionId appears as \"kpiDefinitionId\":\"<uuid>\".
    const idMatch = dataStr.match(/kpiDefinitionId\\?"\s*:\s*\\?"([0-9a-f-]{36})/);
    if (idMatch) {
      out.writeReached = true;
      out.createdId = idMatch[1]!;
    }
    // deny surfaced (canUseTool fail-closed): the SDK reports a tool denial.
    if (decision === "deny" && /not approved \(compliance gate\)|tool not in allowlist|tool_use_is_error/i.test(dataStr)) {
      out.writeDenied = true;
    }
    if (/"type"\s*:\s*"result"/.test(dataStr) && /"is_error"\s*:\s*true/.test(dataStr)) out.errorIsError = true;
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const blocks = buf.split("\n\n");
    buf = blocks.pop() ?? "";
    for (const b of blocks) await handleBlock(b);
    if (out.events > 200) break;
  }
  if (buf.trim()) await handleBlock(buf);
  return out;
}

interface KpiItem {
  kpiDefinitionId: string;
  tenantId: string | null;
  code: string;
  name: string;
}

async function searchKpi(code: string, cookies: string): Promise<KpiItem[]> {
  // Retry transient socket resets (undici keep-alive can drop a recycled socket).
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(`${API}/v1/kpi-definitions?search=${encodeURIComponent(code)}&limit=50`, {
        method: "GET",
        headers: { cookie: cookies },
      });
      if (!r.ok) throw new Error(`GET /kpi-definitions?search=${code} → ${r.status}`);
      const j = (await r.json()) as { items: KpiItem[] };
      return j.items.filter((k) => k.code === code);
    } catch (e) {
      lastErr = e;
      await new Promise((res) => setTimeout(res, 600));
    }
  }
  throw lastErr;
}

async function deleteKpi(id: string, sess: Sess): Promise<number> {
  const r = await fetch(`${API}/v1/kpi-definitions/${id}`, {
    method: "DELETE",
    headers: { cookie: sess.cookies, "x-csrf-token": sess.csrf },
  });
  return r.status;
}

const RTL_TENANT = "86ba7a65-217f-48ba-8ce5-5c09b40a66b0";

async function main(): Promise<void> {
  console.log(`=== M-2 WRITE-gate live acceptance — ${EMAIL} @ ${API} / gateway ${GATEWAY} ===`);
  const sess = await login();

  const ts = Date.now();
  const allowCode = `M2-DEMO-${ts}`;
  const denyCode = `M2-DENY-${ts}`;
  const failures: string[] = [];

  // ---- 1. ALLOW: gated create reaches /v1 ----
  const allowPrompt =
    `Create a new KPI definition for my tenant. Use the heuresys MCP tool ` +
    `hrx_kpi_defs_upsert with this exact payload and nothing else: ` +
    `{"code":"${allowCode}","name":"M2 Demo KPI (gated write acceptance)"}. ` +
    `Do not read anything first; just call that one write tool with that payload.`;
  const allow = await runWrite(allowPrompt, "allow", sess.cookies);
  console.log(`[ALLOW] approvalSeen=${allow.approvalSeen} decision=${allow.approvedDecision} writeReached=${allow.writeReached} id=${allow.createdId?.slice(0, 8) ?? "-"}`);
  if (!allow.approvalSeen) failures.push("ALLOW: no approval_required emitted (gate not engaged)");
  if (!allow.writeReached || !allow.createdId) failures.push("ALLOW: write did not reach /v1 (no kpiDefinitionId returned)");

  const allowRows = await searchKpi(allowCode, sess.cookies);
  const allowRow = allowRows[0];
  console.log(`[ALLOW] re-fetch GET /v1/kpi-definitions?search=${allowCode} → ${allowRows.length} row(s); tenant=${allowRow?.tenantId ?? "-"}`);
  if (!allowRow) failures.push("ALLOW: re-fetch found no row (write not persisted)");
  if (allowRow && allowRow.tenantId !== RTL_TENANT) failures.push(`ALLOW: row tenant ${allowRow.tenantId} != RTL_BANK (safety §0.5 violated)`);

  // ---- 2. DENY: gate fails closed, write never reaches /v1 ----
  const denyPrompt =
    `Create a new KPI definition for my tenant. Use the heuresys MCP tool ` +
    `hrx_kpi_defs_upsert with this exact payload and nothing else: ` +
    `{"code":"${denyCode}","name":"M2 Deny KPI (should be blocked)"}. ` +
    `Do not read anything first; just call that one write tool with that payload.`;
  const deny = await runWrite(denyPrompt, "deny", sess.cookies);
  console.log(`[DENY] approvalSeen=${deny.approvalSeen} decision=${deny.approvedDecision} writeReached=${deny.writeReached}`);
  if (!deny.approvalSeen) failures.push("DENY: no approval_required emitted (gate not engaged)");
  if (deny.writeReached) failures.push("DENY: write reached /v1 despite deny (fail-closed broken)");

  const denyRows = await searchKpi(denyCode, sess.cookies);
  console.log(`[DENY] re-fetch GET /v1/kpi-definitions?search=${denyCode} → ${denyRows.length} row(s) (expect 0)`);
  if (denyRows.length > 0) failures.push(`DENY: row persisted despite deny (${denyRows.length} found)`);

  // ---- 3. ROLLBACK: delete the ALLOW row ----
  if (allowRow) {
    const st = await deleteKpi(allowRow.kpiDefinitionId, sess);
    console.log(`[ROLLBACK] DELETE /v1/kpi-definitions/${allowRow.kpiDefinitionId.slice(0, 8)}… → ${st}`);
    const after = await searchKpi(allowCode, sess.cookies);
    console.log(`[ROLLBACK] re-fetch → ${after.length} row(s) (expect 0)`);
    if (after.length > 0) failures.push("ROLLBACK: row still present after delete");
  }

  if (failures.length > 0) {
    throw new Error(`M-2 WRITE ACCEPTANCE FAILED:\n  - ${failures.join("\n  - ")}`);
  }
  console.log(`\n=== M-2 PASS: ALLOW→write persisted on RTL_BANK · DENY→fail-closed (no write) · ROLLBACK→clean ===`);
}

main().catch((e: unknown) => {
  console.error("\nM-2 ACCEPTANCE FAILED:", e);
  process.exit(1);
});
