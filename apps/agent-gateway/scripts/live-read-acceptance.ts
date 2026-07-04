/**
 * Live READ acceptance for #9 WI-B.2 (DoD: live E2E on real data, no mock).
 *
 * 1. Logs in a real E2E fixture persona via /v1/auth/login (full MFA TOTP step-up,
 *    secret from apps/api/test/helpers/mfa-fixture-secrets.ts) → real session cookies.
 * 2. READ-LIVE (deterministic): GET /v1/organization-units with the forwarded
 *    session → real tenant data (proves the gateway→/v1 path on live data).
 * 3. Agent path: POST the gateway /agent (SSE) with a real prompt → the Agent SDK
 *    runs, routes to a tool, calls /v1 live → streams real data back.
 *
 * Run (from repo root):
 *   ACC_EMAIL=admin@heuresys.com ACC_PASSWORD='<password>' \
 *   pnpm --filter @heuresys/agent-gateway exec tsx scripts/live-read-acceptance.ts
 *
 * TOTP is computed inline (RFC 6238, node:crypto) — no extra dep. Fixture secrets
 * are repo test fixtures (no real production secret; R11 unaffected).
 */
import { createHmac } from "node:crypto";
import { FIXTURE_TOTP_SECRETS } from "../../api/test/helpers/mfa-fixture-secrets.js";

const API = (process.env.HEURESYS_API ?? "http://localhost:3001").replace(/\/$/, "");
const GATEWAY = (process.env.AGENT_GATEWAY ?? "http://localhost:8790").replace(/\/$/, "");
const EMAIL = process.env.ACC_EMAIL ?? "admin@heuresys.com";
const PASSWORD = process.env.ACC_PASSWORD ?? process.env.TEST_ADMIN_PASSWORD ?? "";
const PROMPT = process.env.ACC_PROMPT ?? "List the organization units of my tenant and report how many there are.";

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

function cookiesFrom(res: Response): string {
  const raw = res.headers.getSetCookie?.() ?? [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

async function login(): Promise<string> {
  const r1 = await fetch(`${API}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const j1 = (await r1.json()) as { status: string; challengeToken?: string };
  console.log(`[login] step1 → ${r1.status} status=${j1.status}`);
  if (j1.status === "success") return cookiesFrom(r1);
  if (j1.status !== "mfa_required" || !j1.challengeToken) {
    throw new Error(`unexpected login state: ${JSON.stringify(j1)}`);
  }
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
  return cookiesFrom(r2);
}

async function readLive(cookies: string): Promise<void> {
  const r = await fetch(`${API}/v1/organization-units`, { headers: { cookie: cookies } });
  const j = (await r.json()) as { items?: unknown[] } | unknown[];
  const items = Array.isArray(j) ? j : (j.items ?? []);
  console.log(`[read-live] GET /v1/organization-units → ${r.status}, ${items.length} real rows`);
  console.log(`[read-live] sample: ${JSON.stringify(items.slice(0, 3))}`);
}

async function agentLive(cookies: string): Promise<void> {
  console.log(`[agent] POST ${GATEWAY}/agent prompt="${PROMPT}"`);
  const r = await fetch(`${GATEWAY}/agent`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookies },
    body: JSON.stringify({ prompt: PROMPT }),
  });
  console.log(`[agent] → HTTP ${r.status} (SSE)`);
  if (!r.ok || !r.body) {
    console.log(`[agent] body: ${await r.text()}`);
    return;
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let n = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n\n");
    buf = lines.pop() ?? "";
    for (const block of lines) {
      n++;
      console.log(`[agent][sse #${n}] ${block.replace(/\s+/g, " ").slice(0, 400)}`);
      if (n > 60) return; // cap the demo output
    }
  }
}

async function main() {
  console.log(`=== WI-B.2 live READ acceptance — ${EMAIL} @ ${API} / gateway ${GATEWAY} ===`);
  const cookies = await login();
  console.log(`[login] session cookies acquired: ${cookies.split(";").map((c) => c.split("=")[0]?.trim()).join(", ")}`);
  await readLive(cookies);
  await agentLive(cookies);
  console.log("=== done ===");
}

main().catch((e) => {
  console.error("ACCEPTANCE FAILED:", e);
  process.exit(1);
});
