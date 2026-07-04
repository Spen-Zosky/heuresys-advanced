/**
 * Live 3-SKILL acceptance for #9 WI-B.3 (DoD: live E2E on real data, no mock).
 *
 * Mirrors scripts/live-read-acceptance.ts (login + SSE-consume pattern). For each of
 * the 3 pinned human-resources-plus skills it POSTs the gateway /agent with a prompt
 * that should drive that skill, consumes the SSE stream, and asserts that BOTH:
 *   (a) the SDK invoked the `Skill` tool for that skill, AND
 *   (b) at least one heuresys MCP tool (`mcp__heuresys__*` / bare `hrx_*`) fired
 *       (the skill calls live /v1 through the MCP tool catalogue).
 *
 * Pinned skills (REAL registered skill names — note: the `/hr <sub>` form in the spec
 * maps to the `hr-`-prefixed SKILL.md `name:` that the SDK `Skill` tool invokes;
 * verified against the plugin marketplace skills/ dir):
 *   - hr-skills-taxonomy   (/hr skills-taxonomy)  → drives skills catalogue reads (hrx_skills_list)
 *   - hr-skill-gap         (/hr skill-gap)        → drives insights skill-gap reads
 *   - hr-people-analytics  (/hr people-analytics) → drives analytics/dashboard reads
 * The MCP tools are reachable per apps/agent-gateway/src/sdk-agent.ts
 * (allowedTools:["Skill","mcp__heuresys__*"]) + the catalogue in src/mcp-tool-names.ts.
 *
 * FAIL-LOUD on credential block: if the agent errors with auth/credits
 * (out_of_credits / 401 invalid key / no API key), this exits non-zero with a clear
 * "BLOCKED: agent credential required" message — it MUST NOT fake-pass.
 *
 * Run (from repo root) — DO NOT run live until a credential is provisioned (Enzo):
 *   ACC_EMAIL=admin@heuresys.com ACC_PASSWORD='<password>' \
 *   pnpm --filter @heuresys/agent-gateway exec tsx scripts/live-skills-acceptance.ts
 *
 * TOTP is computed inline (RFC 6238, node:crypto) — no extra dep. Fixture secrets
 * are repo test fixtures (no real production secret; R10/R11 unaffected).
 */
import { createHmac } from "node:crypto";
import { FIXTURE_TOTP_SECRETS } from "../../api/test/helpers/mfa-fixture-secrets.js";

const API = (process.env.HEURESYS_API ?? "http://localhost:3001").replace(/\/$/, "");
const GATEWAY = (process.env.AGENT_GATEWAY ?? "http://localhost:8790").replace(/\/$/, "");
const EMAIL = process.env.ACC_EMAIL ?? "admin@heuresys.com";
const PASSWORD = process.env.ACC_PASSWORD ?? process.env.TEST_ADMIN_PASSWORD ?? "";

/** The 3 pinned skills + a prompt designed to route the model into each skill. */
interface SkillCase {
  /** Real registered SKILL.md `name:` the SDK `Skill` tool invokes. */
  skill: string;
  /** The `/hr <sub>` command form (spec wording). */
  command: string;
  prompt: string;
}

const SKILL_CASES: readonly SkillCase[] = [
  {
    skill: "hr-skills-taxonomy",
    command: "skills-taxonomy",
    prompt:
      "Use the skills-taxonomy workflow: list my tenant's skill catalog (competency framework) and report how many skills exist.",
  },
  {
    skill: "hr-skill-gap",
    command: "skill-gap",
    prompt:
      "Use the skill-gap workflow: run a capability gap analysis for my tenant and summarise the largest skill shortages.",
  },
  {
    skill: "hr-people-analytics",
    command: "people-analytics",
    prompt:
      "Use the people-analytics workflow: give me a workforce headcount and KPI readout for my tenant from the analytics surfaces.",
  },
] as const;

/**
 * SSE markers that mean the agent could not run for credential/credit reasons.
 * Specific by design: a bare `401`/`unauthor` matched business data inside a
 * tool_result (e.g. an id/code containing "401") and false-aborted a live run.
 * These markers only appear in an SDK auth/credit failure, never in /v1 data;
 * the caller additionally scopes the check to `result(is_error)` / `error` events.
 */
const CREDENTIAL_BLOCK =
  /out_of_credits|insufficient[_\s-]?credit|invalid[_\s-]?(api[_\s-]?)?key|no api key|authentication[_\s-]?error|api_error_status"?\s*:\s*(401|403)|overageStatus"?\s*:\s*"?out_of_credits/i;

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

interface SkillRunResult {
  skillFired: boolean;
  mcpToolFired: boolean;
  credentialBlocked: boolean;
  blockDetail: string;
  events: number;
}

/** Custom error so main() can distinguish a credential block from a real assertion fail. */
class CredentialBlockError extends Error {}

async function runSkill(c: SkillCase, cookies: string): Promise<SkillRunResult> {
  console.log(`\n[skill:${c.skill}] POST ${GATEWAY}/agent prompt="${c.prompt.slice(0, 80)}…"`);
  const res = await fetch(`${GATEWAY}/agent`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookies },
    body: JSON.stringify({ prompt: c.prompt }),
  });
  console.log(`[skill:${c.skill}] → HTTP ${res.status} (SSE)`);

  const result: SkillRunResult = {
    skillFired: false,
    mcpToolFired: false,
    credentialBlocked: false,
    blockDetail: "",
    events: 0,
  };

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    if (CREDENTIAL_BLOCK.test(`${res.status} ${text}`)) {
      result.credentialBlocked = true;
      result.blockDetail = `HTTP ${res.status} ${text}`.trim();
      return result;
    }
    throw new Error(`gateway POST /agent failed: HTTP ${res.status} ${text}`);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  const scan = (block: string): void => {
    if (!block.trim()) return;
    result.events++;
    const flat = block.replace(/\s+/g, " ");
    // (a) Skill tool invoked for this skill (the SDK emits a Skill tool-use event).
    if (/"?Skill"?/.test(flat) && flat.includes(c.skill)) result.skillFired = true;
    // Looser fallback: a Skill tool-use whose payload mentions the bare /hr command.
    if (/"?Skill"?/.test(flat) && flat.includes(c.command)) result.skillFired = true;
    // (b) a heuresys MCP tool fired (namespaced or bare catalogue name).
    if (/mcp__heuresys__[a-z_]+|hrx_[a-z_]+/.test(flat)) result.mcpToolFired = true;
    // credential / credit block surfaced as an `error` SSE event or a result event
    // with is_error — NEVER from tool_result business data (that false-aborted runs).
    const isErrorEvent = /event:\s*error/.test(flat) || /"type"\s*:\s*"error"/.test(flat);
    const isResultError = /"type"\s*:\s*"result"/.test(flat) && /"is_error"\s*:\s*true/.test(flat);
    if ((isErrorEvent || isResultError) && CREDENTIAL_BLOCK.test(flat)) {
      result.credentialBlocked = true;
      result.blockDetail = flat.slice(0, 300);
    }
    console.log(`[skill:${c.skill}][sse #${result.events}] ${flat.slice(0, 280)}`);
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const blocks = buf.split("\n\n");
    buf = blocks.pop() ?? "";
    for (const block of blocks) scan(block);
    if (result.events > 120) break; // cap runaway streams
  }
  if (buf.trim()) scan(buf);
  return result;
}

async function main(): Promise<void> {
  console.log(`=== WI-B.3 live 3-SKILL acceptance — ${EMAIL} @ ${API} / gateway ${GATEWAY} ===`);
  console.log(`pinned skills: ${SKILL_CASES.map((s) => s.skill).join(", ")}`);
  const cookies = await login();
  console.log(`[login] session cookies acquired: ${cookies.split(";").map((c) => c.split("=")[0]?.trim()).join(", ")}`);

  const failures: string[] = [];
  for (const c of SKILL_CASES) {
    const r = await runSkill(c, cookies);
    if (r.credentialBlocked) {
      // FAIL LOUD: code is ready; the live drive needs a real agent credential.
      throw new CredentialBlockError(
        `BLOCKED: agent credential required (out_of_credits / invalid key) — live skills acceptance cannot run; code is ready. detail="${r.blockDetail}"`,
      );
    }
    const ok = r.skillFired && r.mcpToolFired;
    console.log(
      `[skill:${c.skill}] result → skillFired=${r.skillFired} mcpToolFired=${r.mcpToolFired} events=${r.events} → ${ok ? "PASS" : "FAIL"}`,
    );
    if (!ok) {
      failures.push(
        `${c.skill}: skillFired=${r.skillFired} mcpToolFired=${r.mcpToolFired} (expected both true)`,
      );
    }
  }

  if (failures.length > 0) {
    throw new Error(`SKILL ACCEPTANCE FAILED:\n  - ${failures.join("\n  - ")}`);
  }
  console.log(`\n=== all ${SKILL_CASES.length} pinned skills PASSED (skill + MCP tool fired on live data) ===`);
}

main().catch((e: unknown) => {
  if (e instanceof CredentialBlockError) {
    console.error(`\n${e.message}`);
    process.exit(2); // distinct exit code for "blocked-on-credential" vs a real assertion failure
  }
  console.error("\nACCEPTANCE FAILED:", e);
  process.exit(1);
});
