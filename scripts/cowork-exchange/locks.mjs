#!/usr/bin/env node
/**
 * scripts/cowork-exchange/locks.mjs
 *
 * Activity-lock helpers per cowork_code_exchange/README.md v2.2 §-0 R2.
 *
 * Usage:
 *   node scripts/cowork-exchange/locks.mjs acquire <cowork|cli> [--ttl-minutes 60]
 *   node scripts/cowork-exchange/locks.mjs release <cowork|cli>
 *   node scripts/cowork-exchange/locks.mjs check
 *   node scripts/cowork-exchange/locks.mjs renew <cowork|cli> [--ttl-minutes 60]
 *
 * Locks are informational (not hard gates). They tell the other party
 * "I'm active". TTL default = 60 min, max idle grace = 15 min beyond TTL
 * (after which pre-commit hook prunes as orphan).
 */

import { readFile, writeFile, unlink, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..", "..");
const EXCHANGE_DIR = join(REPO_ROOT, "cowork_code_exchange");

const args = process.argv.slice(2);
const cmd = args[0];
const party = args[1];

function usage(exit = 1) {
  console.log(`
locks.mjs — activity-lock helpers (cowork_code_exchange v2.2 R2)

Usage:
  node scripts/cowork-exchange/locks.mjs acquire <cowork|cli> [--ttl-minutes N]
  node scripts/cowork-exchange/locks.mjs release <cowork|cli>
  node scripts/cowork-exchange/locks.mjs renew   <cowork|cli> [--ttl-minutes N]
  node scripts/cowork-exchange/locks.mjs check

Examples:
  pnpm cowork:acquire-lock cowork       # at Cowork session-start
  pnpm cowork:release-lock cowork       # at Cowork session-end
  pnpm cowork:check-locks               # diagnostic
`);
  process.exit(exit);
}

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function ttlIso(minutes) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function lockPath(p) {
  if (p !== "cowork" && p !== "cli") throw new Error(`invalid party "${p}"`);
  return join(EXCHANGE_DIR, `.${p}-active.lock`);
}

function parseTtlMinutes() {
  const i = args.indexOf("--ttl-minutes");
  if (i >= 0 && args[i + 1]) {
    const n = parseInt(args[i + 1], 10);
    if (!isNaN(n) && n > 0 && n < 1440) return n;
  }
  return 60;
}

async function acquire() {
  if (!party) usage(2);
  const path = lockPath(party);
  if (existsSync(path)) {
    const text = await readFile(path, "utf8");
    const fm = parseYaml(text);
    if (fm.expected_idle_at) {
      const exp = new Date(fm.expected_idle_at).getTime();
      const now = Date.now();
      if (exp > now) {
        console.log(`! Lock already held by ${party} (pid=${fm.pid}, session=${fm.session_id}), expires ${fm.expected_idle_at} (${Math.round((exp - now) / 60000)}min remaining).`);
        console.log(`  Use 'renew' to extend, 'release' to clear.`);
        process.exit(3);
      } else {
        console.log(`(prior lock for ${party} found but expired ${Math.round((now - exp) / 60000)}min ago — overwriting)`);
      }
    }
  }
  const ttl = parseTtlMinutes();
  const content = [
    `# Activity lock — cowork_code_exchange/README.md v2.2 R2`,
    `# This file signals to the other party that ${party} is active.`,
    `# Informational, not a hard gate. Auto-prune if expected_idle_at < now-15min.`,
    `pid: ${process.pid}`,
    `session_id: ${nowIso()}`,
    `party: ${party}`,
    `started_at: ${nowIso()}`,
    `expected_idle_at: ${ttlIso(ttl)}`,
    `host: ${process.env.HOSTNAME || process.env.COMPUTERNAME || "unknown"}`,
    `ttl_minutes: ${ttl}`,
    ``,
  ].join("\n");
  await writeFile(path, content, "utf8");
  console.log(`OK Lock acquired: ${party} (TTL ${ttl}min, expires ${ttlIso(ttl)})`);
}

async function release() {
  if (!party) usage(2);
  const path = lockPath(party);
  if (!existsSync(path)) {
    console.log(`(no lock to release for ${party})`);
    return;
  }
  await unlink(path);
  console.log(`OK Lock released: ${party}`);
}

async function renew() {
  if (!party) usage(2);
  const path = lockPath(party);
  if (!existsSync(path)) {
    console.log(`(no lock for ${party} — use 'acquire' first)`);
    process.exit(4);
  }
  const text = await readFile(path, "utf8");
  const fm = parseYaml(text);
  const ttl = parseTtlMinutes();
  fm.expected_idle_at = ttlIso(ttl);
  fm.ttl_minutes = ttl;
  const lines = Object.entries(fm).map(([k, v]) => `${k}: ${v}`);
  const content = [
    `# Activity lock — renewed at ${nowIso()}`,
    ...lines,
    ``,
  ].join("\n");
  await writeFile(path, content, "utf8");
  console.log(`OK Lock renewed: ${party} (new expiry ${ttlIso(ttl)})`);
}

async function check() {
  const now = Date.now();
  console.log("");
  console.log("Activity locks (cowork_code_exchange v2.2 R2):");
  for (const p of ["cowork", "cli"]) {
    const path = lockPath(p);
    if (!existsSync(path)) {
      console.log(`  ${p}: -- (not active)`);
      continue;
    }
    const text = await readFile(path, "utf8");
    const fm = parseYaml(text);
    const exp = fm.expected_idle_at ? new Date(fm.expected_idle_at).getTime() : 0;
    const minLeft = exp > 0 ? Math.round((exp - now) / 60000) : null;
    let status;
    if (!exp) status = "INVALID";
    else if (minLeft >= 0) status = `ACTIVE (${minLeft}min left)`;
    else if (-minLeft < 15) status = `STALE (expired ${-minLeft}min ago, within grace)`;
    else status = `ORPHAN (expired ${-minLeft}min ago, prune candidate)`;
    console.log(`  ${p}: ${status}`);
    console.log(`         pid=${fm.pid} session=${fm.session_id || "-"} host=${fm.host || "-"}`);
  }
  console.log("");
}

function parseYaml(text) {
  const obj = {};
  for (const line of text.split("\n")) {
    if (!line || line.trim().startsWith("#")) continue;
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (m) obj[m[1]] = m[2].trim();
  }
  return obj;
}

async function main() {
  if (!cmd || cmd === "--help" || cmd === "-h") usage(0);
  if (!existsSync(EXCHANGE_DIR)) {
    console.error(`exchange dir not found: ${EXCHANGE_DIR}`);
    process.exit(2);
  }
  switch (cmd) {
    case "acquire": await acquire(); break;
    case "release": await release(); break;
    case "renew":   await renew(); break;
    case "check":   await check(); break;
    default: usage(2);
  }
}

main().catch((e) => {
  console.error("locks.mjs crashed:", e.message);
  process.exit(1);
});
