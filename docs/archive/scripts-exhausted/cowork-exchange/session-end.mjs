#!/usr/bin/env node
/**
 * scripts/cowork-exchange/session-end.mjs
 *
 * Session-end procedure per cowork_code_exchange/README.md v2.2 §-0 R2 + R8.
 * Both Cowork and CLI run this at the end of every session (clean or mid-work).
 *
 * Sequence:
 *   1. Run validator (warn-only) — surface drift before exit
 *   2. Determine chain status (open vs idle)
 *   3. If chain open AND --handoff supplied (or party-side has pending work):
 *      emit session_handoff message in the appropriate inbox
 *   4. If --commit-state supplied (CLI only): commit STATE updates first
 *   5. Release activity lock for <party>
 *   6. Print final summary (suitable for log capture)
 *
 * Usage:
 *   node scripts/cowork-exchange/session-end.mjs <cowork|cli>
 *      [--handoff] [--reason "<text>"]
 *      [--commit-state] (CLI only; runs a single commit on STATE files modified)
 *      [--quiet]
 *
 * Exit codes:
 *   0   clean exit, no open chains
 *   1   clean exit, chains still open (handoff emitted or already pending)
 *   2   validator errors in --strict mode
 *   3   crash / invalid args
 *
 * Examples:
 *   pnpm cowork:session-end cowork
 *   pnpm cowork:session-end cli --handoff --reason "turn 38/40, escalating to Cowork"
 *   pnpm cowork:session-end cli --commit-state
 */

import { readFile, writeFile, readdir, unlink, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..", "..");
const EXCHANGE_DIR = join(REPO_ROOT, "cowork_code_exchange");
const INBOX_DIR = join(EXCHANGE_DIR, ".inbox");

const argv = process.argv.slice(2);
const party = argv[0];
const HANDOFF = argv.includes("--handoff");
const COMMIT_STATE = argv.includes("--commit-state");
const QUIET = argv.includes("--quiet");
const reasonIdx = argv.indexOf("--reason");
const REASON = reasonIdx >= 0 ? argv[reasonIdx + 1] : null;

function logInfo(m) { if (!QUIET) console.log(m); }
function logOk(m)   { if (!QUIET) console.log(`OK ${m}`); }
function logWarn(m) { console.log(`! ${m}`); }
function logErr(m)  { console.error(`X ${m}`); }

function usage(code = 3) {
  console.log(`
session-end.mjs — clean session-end procedure (cowork_code_exchange v2.2)

Usage:
  node scripts/cowork-exchange/session-end.mjs <cowork|cli> [options]

Options:
  --handoff             emit session_handoff message to the next session of same party
  --reason "<text>"     human-readable reason captured in STATE last_event + handoff
  --commit-state        (CLI only) commit STATE file changes in a single commit
  --quiet               suppress non-critical output

Exit codes:
  0  clean, no open chains
  1  clean, chains still open (handoff emitted if requested)
  2  validator strict-mode errors
  3  bad args / crash
`);
  process.exit(code);
}

if (party !== "cowork" && party !== "cli") usage();

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function tsForFilename() {
  return nowIso().replace(/:/g, "-");
}

function parseFm(text) {
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
  const out = [];
  for (const e of entries) {
    const m = e.match(/^_00_STATE_(\d{3})\.md$/);
    if (!m) continue;
    const text = await readFile(join(EXCHANGE_DIR, e), "utf8");
    const fm = parseFm(text) || {};
    out.push({ nnn: m[1], ...fm });
  }
  return out.sort((a, b) => a.nnn.localeCompare(b.nnn));
}

async function listInboxPending(p) {
  const dir = join(INBOX_DIR, p, "pending");
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir);
  return entries.filter((e) => e.endsWith(".md") && !e.startsWith("."));
}

async function step1Validator() {
  logInfo("");
  logInfo("[1/6] running validator (warn-only)...");
  try {
    const out = execSync("node scripts/cowork-exchange/validate-naming.mjs", {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    const errMatch = out.match(/^X\s+(\d+)\s+error/m);
    const warnMatch = out.match(/^!\s+(\d+)\s+warning/m);
    const errors = errMatch ? parseInt(errMatch[1], 10) : 0;
    const warnings = warnMatch ? parseInt(warnMatch[1], 10) : 0;
    logInfo(`     validator: ${errors} error(s), ${warnings} warning(s)`);
    return { errors, warnings };
  } catch (e) {
    logErr(`validator crashed: ${e.message}`);
    return { errors: 1, warnings: 0 };
  }
}

async function step2ChainStatus() {
  logInfo("");
  logInfo("[2/6] computing chain status...");
  const goals = await listGoals();
  const corkPending = await listInboxPending("cowork");
  const cliPending = await listInboxPending("cli");
  const openChains = [];
  for (const g of goals) {
    if (g.current_phase === "CLOSED") continue;
    if (g.next_actor && g.next_actor !== "null" && g.next_actor !== "-") {
      openChains.push({ goal: g.nnn, next_actor: g.next_actor, phase: g.current_phase, slug: g.slug });
    }
  }
  if (corkPending.length > 0) openChains.push({ kind: "inbox", to: "cowork", count: corkPending.length });
  if (cliPending.length > 0) openChains.push({ kind: "inbox", to: "cli", count: cliPending.length });
  logInfo(`     goals open: ${openChains.filter((c) => c.goal).length}; inbox pending: cowork=${corkPending.length} cli=${cliPending.length}`);
  return { openChains, goals, corkPending, cliPending };
}

async function step3MaybeHandoff(chainStatus) {
  logInfo("");
  logInfo("[3/6] handoff decision...");
  if (!HANDOFF && chainStatus.openChains.length === 0) {
    logInfo("     no open chains; no handoff message emitted.");
    return null;
  }
  if (!HANDOFF) {
    logInfo(`     ${chainStatus.openChains.length} open chain(s) but --handoff not specified; skipping message emit.`);
    logInfo(`     (recommendation: re-run with --handoff to leave a written trail for the next ${party} session)`);
    return null;
  }
  // Emit a session_handoff message addressed to the OWN inbox for the next instance of same party
  const ts = tsForFilename();
  const filename = `${ts}__000__session_handoff.md`;
  const dir = join(INBOX_DIR, party, "pending");
  await mkdir(dir, { recursive: true });
  const summaryLines = [];
  for (const c of chainStatus.openChains) {
    if (c.goal) summaryLines.push(`  - goal ${c.goal} (${c.slug || "?"}) phase=${c.phase} next_actor=${c.next_actor}`);
    else summaryLines.push(`  - inbox ${c.to}: ${c.count} pending`);
  }
  const body = `---
from: ${party}
to: ${party}
goal_id: "000"
slug: session-handoff
kind: session_handoff
ref_files: []
created_at: ${nowIso()}
read_at: null
acknowledged_by: null
expected_response_kind: ack
expected_response_by: null
---

# Session handoff — ${party} session ending ${nowIso()}

${REASON ? `**Reason for handoff**: ${REASON}\n` : ""}

## Open chains at session-end

${summaryLines.join("\n") || "_(none)_"}

## Recommended next actions for the resuming ${party} session

1. Run \`pnpm cowork:session-start --party ${party}\`
2. Read the chain list above and identify the most-urgent open goal/inbox
3. Resume from the natural next step per protocol v2.2
4. Mark this message as read after acknowledging via \`pnpm cowork:inbox -- --read ${filename}\`

## Context from the closing session

- Validator state at session-end: see logs of \`pnpm cowork:session-end ${party}\`
- Activity lock: released by this script (R2)
- Inbox state at handoff: ${chainStatus.corkPending.length} cowork-pending, ${chainStatus.cliPending.length} cli-pending
`;
  await writeFile(join(dir, filename), body, "utf8");
  logOk(`session_handoff emitted: ${party}/pending/${filename}`);
  return { filename, party };
}

async function step4MaybeCommitState() {
  logInfo("");
  logInfo("[4/6] STATE commit (CLI only, opt-in)...");
  if (!COMMIT_STATE) {
    logInfo("     --commit-state not specified; skipping.");
    return;
  }
  if (party !== "cli") {
    logWarn("--commit-state ignored: only CLI may commit (R1/G12). Cowork must not invoke git.");
    return;
  }
  // Find modified STATE files
  let stagedAny = false;
  try {
    const status = execSync("git status --short", { cwd: REPO_ROOT, encoding: "utf8" });
    const statePaths = status
      .split("\n")
      .filter((l) => /^[ M?A]+\s+cowork_code_exchange\/_00_STATE_\d{3}\.md$/.test(l))
      .map((l) => l.replace(/^[ M?A]+\s+/, "").trim());
    if (statePaths.length === 0) {
      logInfo("     no STATE files modified; nothing to commit.");
      return;
    }
    for (const p of statePaths) {
      execSync(`git add -- "${p}"`, { cwd: REPO_ROOT });
      stagedAny = true;
    }
    if (stagedAny) {
      const msg = `chore(cowork): STATE updates at session-end\n\n${statePaths.map((p) => "- " + p).join("\n")}\n${REASON ? "\nReason: " + REASON + "\n" : ""}`;
      execSync(`git commit -m "${msg.replace(/"/g, '\\"')}"`, { cwd: REPO_ROOT });
      logOk(`STATE files committed: ${statePaths.length}`);
    }
  } catch (e) {
    logErr(`commit failed: ${e.message}`);
  }
}

async function step5ReleaseLock() {
  logInfo("");
  logInfo("[5/6] releasing activity lock...");
  const lockPath = join(EXCHANGE_DIR, `.${party}-active.lock`);
  if (!existsSync(lockPath)) {
    logInfo(`     no active lock for ${party}.`);
    return;
  }
  try {
    await unlink(lockPath);
    logOk(`lock released: .${party}-active.lock`);
  } catch (e) {
    logWarn(`could not remove lock: ${e.message}`);
  }
}

async function step6FinalSummary(chainStatus, valResult, handoffResult) {
  logInfo("");
  logInfo("[6/6] final summary");
  const sep = "=".repeat(70);
  console.log("");
  console.log(sep);
  console.log(`  ${party.toUpperCase()} session ended — ${nowIso()}`);
  console.log(sep);
  console.log(`  Validator: ${valResult.errors} error(s), ${valResult.warnings} warning(s)`);
  console.log(`  Open chains: ${chainStatus.openChains.length}`);
  for (const c of chainStatus.openChains) {
    if (c.goal) console.log(`    - goal ${c.goal} (${c.slug || "?"}) phase=${c.phase} next=${c.next_actor}`);
    else console.log(`    - inbox ${c.to}: ${c.count} pending`);
  }
  if (handoffResult) {
    console.log(`  Handoff: emitted at .inbox/${handoffResult.party}/pending/${handoffResult.filename}`);
  }
  if (REASON) console.log(`  Reason: ${REASON}`);
  console.log(sep);
  console.log("");
}

async function main() {
  const v = await step1Validator();
  const c = await step2ChainStatus();
  const h = await step3MaybeHandoff(c);
  await step4MaybeCommitState();
  await step5ReleaseLock();
  await step6FinalSummary(c, v, h);
  process.exit(c.openChains.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("session-end.mjs crashed:", e.message);
  process.exit(3);
});
