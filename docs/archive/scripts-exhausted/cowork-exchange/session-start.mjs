#!/usr/bin/env node
/**
 * scripts/cowork-exchange/session-start.mjs
 *
 * Session-start wrapper per cowork_code_exchange/README.md v2.2 §-0 R8.
 * Both Cowork and CLI should run this at the start of every session.
 *
 * Output: combined STATE + inbox + lock state, exit code reflects chain status.
 *
 *   exit 0  -- there is work to do, output describes what + for whom
 *   exit 10 -- no open chains (all goals CLOSED or next_actor=null, both inboxes empty)
 *   exit 1  -- crash
 *
 * Usage:
 *   node scripts/cowork-exchange/session-start.mjs [--party <cowork|cli>] [--json]
 *
 * Examples:
 *   pnpm cowork:session-start                # generic
 *   pnpm cowork:session-start --party cli    # CLI-focused (lists CLI inbox in detail)
 */

import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..", "..");
const EXCHANGE_DIR = join(REPO_ROOT, "cowork_code_exchange");
const INBOX_DIR = join(EXCHANGE_DIR, ".inbox");

const args = process.argv.slice(2);
const PARTY = (args.includes("--party") ? args[args.indexOf("--party") + 1] : null);
const JSON_OUT = args.includes("--json");

function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]+?)\n---/);
  if (!m) return null;
  const obj = {};
  for (const line of m[1].split("\n")) {
    const mm = line.match(/^(\w+):\s*(.*)$/);
    if (mm) obj[mm[1]] = mm[2].trim().replace(/^["']|["']$/g, "");
  }
  return obj;
}

async function listGoals() {
  if (!existsSync(EXCHANGE_DIR)) return [];
  const entries = await readdir(EXCHANGE_DIR);
  const goals = [];
  for (const e of entries) {
    const m = e.match(/^_00_STATE_(\d{3})\.md$/);
    if (!m) continue;
    const text = await readFile(join(EXCHANGE_DIR, e), "utf8");
    const fm = parseFrontmatter(text) || {};
    goals.push({
      nnn: m[1],
      slug: fm.slug || "?",
      current_phase: fm.current_phase || "?",
      next_actor: fm.next_actor || "?",
      plan_version: fm.plan_version || "-",
      turn_consumed: fm.turn_consumed || "0",
      turn_budget: fm.turn_budget || "-",
      last_event_summary: fm.last_event_summary || "",
    });
  }
  goals.sort((a, b) => a.nnn.localeCompare(b.nnn));
  return goals;
}

async function listInboxPending(party) {
  const dir = join(INBOX_DIR, party, "pending");
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir);
  const out = [];
  for (const e of entries) {
    if (!e.endsWith(".md") || e.startsWith(".")) continue;
    const text = await readFile(join(dir, e), "utf8");
    const fm = parseFrontmatter(text) || {};
    out.push({
      filename: e,
      kind: fm.kind || "?",
      goal: fm.goal_id || "?",
      from: fm.from || "?",
      created: fm.created_at || "?",
      expected: fm.expected_response_kind || "null",
    });
  }
  out.sort((a, b) => a.created.localeCompare(b.created));
  return out;
}

async function lockState(party) {
  const path = join(EXCHANGE_DIR, `.${party}-active.lock`);
  if (!existsSync(path)) return { state: "INACTIVE" };
  const text = await readFile(path, "utf8");
  const fm = parseFrontmatter(text) || {};
  const exp = fm.expected_idle_at ? new Date(fm.expected_idle_at).getTime() : 0;
  const now = Date.now();
  if (!exp) return { state: "INVALID_LOCK_FORMAT", raw: fm };
  if (exp > now) return { state: "ACTIVE", min_remaining: Math.round((exp - now) / 60000), pid: fm.pid, host: fm.host };
  const minAgo = Math.round((now - exp) / 60000);
  if (minAgo < 15) return { state: "STALE_GRACE", min_ago: minAgo };
  return { state: "ORPHAN_PRUNE_CANDIDATE", min_ago: minAgo };
}

function classifyChain(goals, cowork_pending, cli_pending) {
  const openChains = [];
  for (const g of goals) {
    if (g.current_phase === "CLOSED") continue;
    if (g.next_actor && g.next_actor !== "null" && g.next_actor !== "-") {
      openChains.push({ goal: g.nnn, next_actor: g.next_actor, phase: g.current_phase });
    }
  }
  if (cowork_pending > 0) openChains.push({ goal: "?", next_actor: "Cowork", reason: `${cowork_pending} pending inbox messages` });
  if (cli_pending > 0) openChains.push({ goal: "?", next_actor: "CLI", reason: `${cli_pending} pending inbox messages` });

  return openChains;
}

async function main() {
  const goals = await listGoals();
  const corkPending = await listInboxPending("cowork");
  const cliPending = await listInboxPending("cli");
  const corkLock = await lockState("cowork");
  const cliLock = await lockState("cli");

  const chains = classifyChain(goals, corkPending.length, cliPending.length);

  if (JSON_OUT) {
    console.log(JSON.stringify({
      goals, corkPending, cliPending, corkLock, cliLock, chains,
    }, null, 2));
    process.exit(chains.length === 0 ? 10 : 0);
  }

  const sep = "=".repeat(70);
  console.log("");
  console.log(sep);
  console.log(`  Cowork exchange session-start  ${PARTY ? "(party=" + PARTY + ")" : ""}`);
  console.log(sep);

  console.log("");
  console.log("Goals:");
  if (goals.length === 0) {
    console.log("  (no goals tracked)");
  } else {
    console.log("  NNN | slug                              | phase           | turns   | next");
    console.log("  ----+----------------------------------+-----------------+---------+-----");
    for (const g of goals) {
      const slug = (g.slug || "").padEnd(34).slice(0, 34);
      const phase = g.current_phase.padEnd(15).slice(0, 15);
      const turns = `${g.turn_consumed}/${g.turn_budget}`.padEnd(7);
      const next = g.next_actor === "null" ? "-" : g.next_actor;
      console.log(`  ${g.nnn} | ${slug} | ${phase} | ${turns} | ${next}`);
    }
  }

  console.log("");
  console.log("Activity locks:");
  console.log(`  cowork: ${corkLock.state}${corkLock.min_remaining !== undefined ? " (" + corkLock.min_remaining + "min remaining)" : ""}`);
  console.log(`  cli:    ${cliLock.state}${cliLock.min_remaining !== undefined ? " (" + cliLock.min_remaining + "min remaining)" : ""}`);

  console.log("");
  console.log(`Inbox pending: cowork=${corkPending.length}, cli=${cliPending.length}`);

  if (PARTY === "cowork" && corkPending.length > 0) {
    console.log("");
    console.log("Cowork inbox detail:");
    for (const m of corkPending) {
      console.log(`  - [${m.kind}] goal=${m.goal} from=${m.from} ${m.created}`);
      console.log(`    ${m.filename}  (next-expected: ${m.expected})`);
    }
  }
  if (PARTY === "cli" && cliPending.length > 0) {
    console.log("");
    console.log("CLI inbox detail:");
    for (const m of cliPending) {
      console.log(`  - [${m.kind}] goal=${m.goal} from=${m.from} ${m.created}`);
      console.log(`    ${m.filename}  (next-expected: ${m.expected})`);
    }
  }
  if (!PARTY && (corkPending.length + cliPending.length) > 0) {
    console.log("");
    console.log("(use --party cowork or --party cli for detail)");
  }

  console.log("");
  if (chains.length === 0) {
    console.log("CHAIN STATUS: no open chains (all goals CLOSED or idle, both inboxes empty)");
    console.log("");
    console.log("  -> session may exit / sleep");
    process.exit(10);
  }

  console.log(`CHAIN STATUS: ${chains.length} open chain(s)`);
  for (const c of chains) {
    console.log(`  - goal ${c.goal} (phase=${c.phase || "?"})  next_actor: ${c.next_actor}${c.reason ? " — " + c.reason : ""}`);
  }
  console.log("");
  console.log(sep);
  process.exit(0);
}

main().catch((e) => {
  console.error("session-start.mjs crashed:", e.message);
  process.exit(1);
});
