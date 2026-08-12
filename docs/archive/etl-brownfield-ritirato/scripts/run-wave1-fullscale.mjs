#!/usr/bin/env node
/**
 * scripts/run-wave1-fullscale.mjs
 *
 * Goal 002 PLAN §2.2 Item J — durable full-scale Wave 1 runner.
 * Triggers /v1/brownfield/wave-executor/runs with mode=EXECUTE and NO debug
 * cap. The brownfield.import_runs row + audit.* rows + sys.* writes PERSIST
 * (no afterAll cleanup) per PROMPT §2 Problem 6 acceptance.
 *
 * Dual-channel output (PLAN §2.10 #4 advisory):
 *   - JSON to stdout (machine-readable summary)
 *   - Human-readable progress + final report to stderr
 *
 * Exit codes:
 *   0 — COMPLETE state, wall-clock ≤ 10 min, no FAILED
 *   1 — wall-clock > 10 min (silent variance forbidden per R3 mitigation)
 *   2 — state != COMPLETE OR FAILED count > 0
 *   3 — login / HTTP transport failure
 *
 * Pre-flight gates (operator responsibility, NOT this script):
 *   - SSH tunnel localhost:5433 → oracle-vm-default:5432 active
 *   - apps/api dev server listening on :3001 (pnpm dev)
 *   - migration 000031 applied (verified in EXEC step 0)
 *   - pg_stat_statements 1.10 enabled (verified in EXEC step 0)
 *   - Fresh pg_dump backup ≤ 6h old (verified in EXEC step 0)
 *
 * Usage:
 *   node scripts/run-wave1-fullscale.mjs
 *   node scripts/run-wave1-fullscale.mjs > out.json 2> progress.log
 */

const API_BASE = process.env.API_BASE ?? "http://localhost:3001";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@heuresys.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? process.env.TEST_ADMIN_PASSWORD ?? "";
const HARD_TIMEOUT_MS = Number(process.env.HARD_TIMEOUT_MS ?? 11 * 60 * 1000); // 11 min per R3
const SOFT_TIMEOUT_MS = 10 * 60 * 1000; // 10 min per PROMPT A10 / R3 acceptance

function log(msg) {
  process.stderr.write(`[${new Date().toISOString()}] ${msg}\n`);
}

function parseCookies(setCookieHeader) {
  if (!setCookieHeader) return new Map();
  const arr = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  const cookies = new Map();
  for (const raw of arr) {
    const first = raw.split(";")[0];
    const eq = first.indexOf("=");
    if (eq < 0) continue;
    cookies.set(first.slice(0, eq).trim(), first.slice(eq + 1).trim());
  }
  return cookies;
}

function cookieHeader(cookies) {
  return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function login() {
  log(`POST ${API_BASE}/v1/auth/login as ${ADMIN_EMAIL}`);
  const r = await fetch(`${API_BASE}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (r.status !== 200) {
    throw new Error(`login failed: status=${r.status} body=${await r.text()}`);
  }
  const setCookie = r.headers.getSetCookie ? r.headers.getSetCookie() : r.headers.raw?.()["set-cookie"];
  const cookies = parseCookies(setCookie ?? r.headers.get("set-cookie"));
  const body = await r.json();
  log(`login OK userId=${body.user?.userId} csrf=${body.csrfToken?.slice(0, 10)}...`);
  return { cookies, csrfToken: body.csrfToken, userId: body.user?.userId };
}

async function triggerWave(session) {
  log(`POST ${API_BASE}/v1/brownfield/wave-executor/runs (wave=1, mode=EXECUTE, NO cap)`);
  const t0 = Date.now();
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), HARD_TIMEOUT_MS);
  try {
    const r = await fetch(`${API_BASE}/v1/brownfield/wave-executor/runs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(session.cookies),
        "x-csrf-token": session.csrfToken,
      },
      body: JSON.stringify({ wave: 1, mode: "EXECUTE" }),
      signal: controller.signal,
    });
    clearTimeout(timeoutHandle);
    const wallMs = Date.now() - t0;
    if (r.status !== 201) {
      throw new Error(`wave trigger failed: status=${r.status} body=${await r.text()}`);
    }
    const body = await r.json();
    return { body, wallMs };
  } catch (e) {
    clearTimeout(timeoutHandle);
    if (e.name === "AbortError") {
      const wallMs = Date.now() - t0;
      throw new Error(`HARD TIMEOUT after ${(wallMs / 1000).toFixed(1)}s (limit ${HARD_TIMEOUT_MS}ms)`);
    }
    throw e;
  }
}

async function fetchAcceptance(session, runId) {
  const r = await fetch(`${API_BASE}/v1/brownfield/wave-executor/runs/${runId}/acceptance`, {
    method: "GET",
    headers: { cookie: cookieHeader(session.cookies) },
  });
  if (r.status !== 200) return null;
  return r.json();
}

async function main() {
  const session = await login();
  const { body, wallMs } = await triggerWave(session);
  const wallSec = (wallMs / 1000).toFixed(1);
  log(`wave returned in ${wallSec}s — state=${body.state} totalStaged=${body.totalStaged} totalUpserted=${body.totalUpserted}`);

  const acceptance = await fetchAcceptance(session, body.runId);
  if (acceptance) {
    log(`acceptance: allPass=${acceptance.allPass} checks=${acceptance.checks.length}`);
    if (!acceptance.allPass) {
      for (const c of acceptance.checks.filter((x) => !x.pass)) {
        log(`  ✗ ${c.name}: ${c.detail ?? ""}`);
      }
    }
  }

  const summary = {
    runId: body.runId,
    state: body.state,
    totalStaged: body.totalStaged,
    totalUpserted: body.totalUpserted,
    wallClockMs: wallMs,
    wallClockSec: Number(wallSec),
    softTimeoutMs: SOFT_TIMEOUT_MS,
    hardTimeoutMs: HARD_TIMEOUT_MS,
    acceptance,
    timestamp: new Date().toISOString(),
  };
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");

  // Exit logic
  if (body.state !== "COMPLETE") {
    log(`EXIT 2: state=${body.state} (expected COMPLETE)`);
    process.exit(2);
  }
  if (wallMs > SOFT_TIMEOUT_MS) {
    log(`EXIT 1: wall-clock ${wallSec}s exceeded soft acceptance ${SOFT_TIMEOUT_MS / 1000}s (R3 — no silent variance)`);
    process.exit(1);
  }
  if (acceptance && !acceptance.allPass) {
    log(`EXIT 2: acceptance check failed`);
    process.exit(2);
  }
  log(`EXIT 0: COMPLETE, wall-clock ${wallSec}s ≤ ${SOFT_TIMEOUT_MS / 1000}s, all acceptance checks pass`);
  process.exit(0);
}

main().catch((e) => {
  log(`ERROR: ${e.message}`);
  process.stdout.write(JSON.stringify({ error: e.message, timestamp: new Date().toISOString() }) + "\n");
  process.exit(3);
});
