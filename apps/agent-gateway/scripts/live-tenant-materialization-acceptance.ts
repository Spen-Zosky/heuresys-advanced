/**
 * Live WI-C acceptance for #9 — the agent orchestrates the tenant-materialization
 * generator END-TO-END on real data (DoD: live, no mock).
 *
 * As admin@heuresys.com (PLATFORM_ADMIN) through the gateway /agent SSE stream, the
 * agent is asked to call the heuresys MCP tool `hrx_tenant_materialize` in PLAN mode
 * (mode:"plan" → READ-ONLY: computes would-create/skipped/total counts, NO DB
 * mutation) for the RTL_BANK tenant + the RETAIL_BANK_REFERENCE archetype. The
 * gateway emits `approval_required` (deny-by-default write gate); this script POSTs
 * /agent/approve {decision:'allow'}; the tool reaches POST /v1/tenant-materialization
 * and returns the MaterializeResult. Verified by the result carrying the archetype
 * key + created/skipped/total count groups. Plan-mode → nothing written → no cleanup.
 *
 * Run (from apps/agent-gateway, key UNSET → MAX subscription):
 *   ACC_EMAIL=admin@heuresys.com pnpm exec tsx scripts/live-tenant-materialization-acceptance.ts
 */
import { createHmac } from "node:crypto";
import { FIXTURE_TOTP_SECRETS } from "../../api/test/helpers/mfa-fixture-secrets.js";

const API = (process.env.HEURESYS_API ?? "http://localhost:3001").replace(/\/$/, "");
const GATEWAY = (process.env.AGENT_GATEWAY ?? "http://localhost:8790").replace(/\/$/, "");
const EMAIL = process.env.ACC_EMAIL ?? "admin@heuresys.com";
const PASSWORD = process.env.ACC_PASSWORD ?? "Admin#PassW0rd!";
const RTL_TENANT = "86ba7a65-217f-48ba-8ce5-5c09b40a66b0";
const ARCHETYPE = "RETAIL_BANK_REFERENCE";

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
  const code = ((hmac[offset]! & 0x7f) << 24) | ((hmac[offset + 1]! & 0xff) << 16) | ((hmac[offset + 2]! & 0xff) << 8) | (hmac[offset + 3]! & 0xff);
  return (code % 1_000_000).toString().padStart(6, "0");
}
function setCookies(res: Response): string[] { return res.headers.getSetCookie?.() ?? []; }
function cookieHeader(raw: string[]): string { return raw.map((c) => c.split(";")[0]).join("; "); }

async function login(): Promise<string> {
  const r1 = await fetch(`${API}/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
  const j1 = (await r1.json()) as { status: string; challengeToken?: string };
  console.log(`[login] step1 → ${r1.status} status=${j1.status}`);
  let raw = setCookies(r1);
  if (j1.status === "mfa_required") {
    const secret = FIXTURE_TOTP_SECRETS[EMAIL];
    if (!secret) throw new Error(`no fixture TOTP secret for ${EMAIL}`);
    const r2 = await fetch(`${API}/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: PASSWORD, challengeToken: j1.challengeToken, mfaCode: totp(secret) }) });
    const j2 = (await r2.json()) as { status: string };
    console.log(`[login] step2 (TOTP) → ${r2.status} status=${j2.status}`);
    if (j2.status !== "success") throw new Error(`MFA step failed: ${JSON.stringify(j2)}`);
    raw = setCookies(r2);
  } else if (j1.status !== "success") {
    throw new Error(`unexpected login state: ${JSON.stringify(j1)}`);
  }
  return cookieHeader(raw);
}

interface RunResult { approvalSeen: boolean; planReturned: boolean; orgUnits: number | null; positions: number | null; isError: boolean; events: number }

async function runPlan(cookies: string): Promise<RunResult> {
  const prompt =
    `Call the heuresys MCP tool hrx_tenant_materialize exactly once with this exact JSON payload and nothing else: ` +
    `{"tenantId":"${RTL_TENANT}","archetypeKey":"${ARCHETYPE}","mode":"plan"}. ` +
    `Do not read anything first; just call that one tool with that payload and report the result.`;
  const res = await fetch(`${GATEWAY}/agent`, { method: "POST", headers: { "content-type": "application/json", cookie: cookies }, body: JSON.stringify({ prompt }) });
  console.log(`\n[plan] POST /agent → HTTP ${res.status} (SSE)`);
  if (!res.ok || !res.body) throw new Error(`gateway /agent failed: HTTP ${res.status} ${await res.text().catch(() => "")}`);

  const out: RunResult = { approvalSeen: false, planReturned: false, orgUnits: null, positions: null, isError: false, events: 0 };
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";

  const handleBlock = async (block: string): Promise<void> => {
    if (!block.trim()) return;
    out.events++;
    const dataStr = block.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
    if (!dataStr) return;
    let obj: Record<string, unknown> | null = null;
    try { obj = JSON.parse(dataStr) as Record<string, unknown>; } catch { obj = null; }
    if (obj && typeof obj["approvalId"] === "string") {
      out.approvalSeen = true;
      const approvalId = obj["approvalId"];
      console.log(`[plan] approval_required tool=${String(obj["tool"])} id=${approvalId.slice(0, 8)}… → allow`);
      const ar = await fetch(`${GATEWAY}/agent/approve`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ approvalId, decision: "allow" }) });
      const aj = (await ar.json()) as { resolved?: boolean };
      console.log(`[plan] /agent/approve → ${ar.status} resolved=${aj.resolved}`);
      return;
    }
    // The tool_result embeds the MaterializeResult (escaped JSON): created+skipped+total count groups.
    if (/created\\?"\s*:/.test(dataStr) && /skipped\\?"\s*:/.test(dataStr) && /total\\?"\s*:/.test(dataStr) && dataStr.includes(ARCHETYPE)) {
      out.planReturned = true;
      const totalMatch = dataStr.match(/total\\?"\s*:\s*\{[^}]*?orgUnits\\?"\s*:\s*(\d+)[^}]*?positions\\?"\s*:\s*(\d+)/);
      if (totalMatch) { out.orgUnits = Number(totalMatch[1]); out.positions = Number(totalMatch[2]); }
    }
    if (/"type"\s*:\s*"result"/.test(dataStr) && /"is_error"\s*:\s*true/.test(dataStr)) out.isError = true;
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

async function main(): Promise<void> {
  console.log(`=== WI-C live acceptance (agent plan) — ${EMAIL} @ gateway ${GATEWAY} → API ${API} ===`);
  const cookies = await login();
  const r = await runPlan(cookies);
  console.log(`[plan] approvalSeen=${r.approvalSeen} planReturned=${r.planReturned} total.orgUnits=${r.orgUnits ?? "-"} total.positions=${r.positions ?? "-"} events=${r.events}`);
  const failures: string[] = [];
  if (!r.approvalSeen) failures.push("no approval_required emitted (write gate not engaged for hrx_tenant_materialize)");
  if (!r.planReturned) failures.push("agent did not surface a MaterializeResult (created/skipped/total) for the archetype");
  if (r.planReturned && (r.orgUnits === null || r.orgUnits <= 0)) failures.push("plan total.orgUnits not > 0 (archetype empty?)");
  if (failures.length > 0) throw new Error(`WI-C ACCEPTANCE FAILED:\n  - ${failures.join("\n  - ")}`);
  console.log(`\n=== WI-C PASS: agent → HITL approve → hrx_tenant_materialize(plan) → MaterializeResult on RTL_BANK (read-only, ${r.orgUnits} org-units / ${r.positions} positions in the archetype) ===`);
}

main().catch((e: unknown) => { console.error("\nWI-C ACCEPTANCE FAILED:", e); process.exit(1); });
