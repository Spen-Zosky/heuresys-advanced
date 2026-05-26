#!/usr/bin/env node
/**
 * scripts/cowork-exchange/notify.mjs
 *
 * Inbox-emit primitive per cowork_code_exchange/README.md v2.2 §-0 R8.
 *
 * Usage:
 *   node scripts/cowork-exchange/notify.mjs <to> <kind> --goal NNN [options]
 *
 * Required:
 *   <to>     cowork | cli            (destination inbox)
 *   <kind>   chain-kind from R8 vocabulary
 *   --goal NNN
 *
 * Options:
 *   --slug <slug>              (default: derived from STATE_NNN)
 *   --subject <text>           (default: derived from kind)
 *   --ref <file> [--ref ...]   (referenced files; repeatable)
 *   --expected <kind>          (expected_response_kind in frontmatter)
 *   --body <text>              (optional inline body, else placeholder)
 *
 * Examples:
 *   node scripts/cowork-exchange/notify.mjs cli prompt_ready --goal 002 \
 *        --ref cowork_code_exchange/_01_PROMPT_002_json-extract-lineage-fullscale.md \
 *        --expected plan_ready
 */

import { writeFile, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..", "..");
const EXCHANGE_DIR = join(REPO_ROOT, "cowork_code_exchange");

const VALID_KINDS = new Set([
  "prompt_ready",
  "plan_ready",
  "plan_amendment_requested",
  "approval_ready",
  "exec_started",
  "exec_progress",
  "exec_halt",
  "report_ready",
  "report_rejected",
  "review_ready",
  "session_handoff",
  "question",
  "answer",
  "ack",
  "pending_applied",
]);

const VALID_PARTIES = new Set(["cowork", "cli"]);

function usage(exit = 1) {
  console.log(`
notify.mjs — emit inbox message (cowork_code_exchange v2.2 R8)

Usage:
  node scripts/cowork-exchange/notify.mjs <to> <kind> --goal NNN [options]

<to>: ${[...VALID_PARTIES].join(" | ")}
<kind>: ${[...VALID_KINDS].join(" | ")}

Options:
  --slug <slug>          override slug (default: read from STATE_NNN)
  --subject <text>       message subject line
  --ref <path>           reference file (repeatable)
  --expected <kind>      expected_response_kind
  --body <text>          inline body (use heredoc or short text)
  --from <party>         sender (default: opposite of <to>)
`);
  process.exit(exit);
}

function parseArgs(argv) {
  const out = { to: argv[0], kind: argv[1], refs: [] };
  let i = 2;
  while (i < argv.length) {
    const a = argv[i];
    if (a === "--goal") { out.goal = argv[++i]; }
    else if (a === "--slug") { out.slug = argv[++i]; }
    else if (a === "--subject") { out.subject = argv[++i]; }
    else if (a === "--ref") { out.refs.push(argv[++i]); }
    else if (a === "--expected") { out.expected = argv[++i]; }
    else if (a === "--body") { out.body = argv[++i]; }
    else if (a === "--from") { out.from = argv[++i]; }
    else if (a === "--help" || a === "-h") { usage(0); }
    else { console.error(`unknown option: ${a}`); usage(2); }
    i++;
  }
  return out;
}

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function tsForFilename() {
  // 2026-05-19T01-23-45Z (no colons; safe for cross-platform filenames)
  return nowIso().replace(/:/g, "-");
}

async function deriveSlugFromState(goal) {
  const statePath = join(EXCHANGE_DIR, `_00_STATE_${goal}.md`);
  if (!existsSync(statePath)) return null;
  const text = await readFile(statePath, "utf8");
  const m = text.match(/^slug:\s*(.+)$/m);
  return m ? m[1].trim() : null;
}

function deriveSubject(kind, goal, slug) {
  const map = {
    prompt_ready: `PROMPT ${goal} ready — ${slug || ""}`,
    plan_ready: `PLAN ${goal} ready for review — ${slug || ""}`,
    plan_amendment_requested: `PLAN ${goal} amendment requested`,
    approval_ready: `APPROVAL ${goal} signed — proceed with EXEC`,
    exec_started: `EXEC ${goal} started`,
    exec_progress: `EXEC ${goal} progress update`,
    exec_halt: `EXEC ${goal} HALTED — awaits Cowork`,
    report_ready: `REPORT ${goal} ready for review`,
    report_rejected: `REPORT ${goal} rejected — continue`,
    review_ready: `REVIEW ${goal} posted — goal CLOSED`,
    session_handoff: `Session handoff — read at next session-start`,
    question: `Question on goal ${goal}`,
    answer: `Answer on goal ${goal}`,
    ack: `Ack — goal ${goal}`,
    pending_applied: `Pending-commits manifest applied — goal ${goal}`,
  };
  return map[kind] || `Message — goal ${goal}, kind ${kind}`;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 2 || argv[0] === "--help" || argv[0] === "-h") usage(argv.length === 0 ? 1 : 0);

  const p = parseArgs(argv);

  if (!VALID_PARTIES.has(p.to)) { console.error(`invalid <to>: ${p.to}`); usage(2); }
  if (!VALID_KINDS.has(p.kind)) { console.error(`invalid <kind>: ${p.kind}`); usage(2); }
  if (!p.goal || !/^\d{3}$/.test(p.goal)) { console.error(`--goal NNN required (3 digits)`); usage(2); }

  if (!p.slug) p.slug = await deriveSlugFromState(p.goal) || "untitled";
  if (!p.subject) p.subject = deriveSubject(p.kind, p.goal, p.slug);
  if (!p.from) p.from = p.to === "cowork" ? "cli" : "cowork";

  const ts = tsForFilename();
  const dir = join(EXCHANGE_DIR, ".inbox", p.to, "pending");
  await mkdir(dir, { recursive: true });
  const filename = `${ts}__${p.goal}__${p.kind}.md`;
  const path = join(dir, filename);

  const refsBlock = p.refs.length > 0
    ? p.refs.map((r) => `  - ${r}`).join("\n")
    : "  []";

  const body = p.body || `(no body — see ref_files for detail)`;

  const content = `---
from: ${p.from}
to: ${p.to}
goal_id: ${p.goal}
slug: ${p.slug}
kind: ${p.kind}
ref_files:
${refsBlock}
created_at: ${nowIso()}
read_at: null
acknowledged_by: null
expected_response_kind: ${p.expected || "null"}
expected_response_by: null
---

# ${p.subject}

${body}
`;

  await writeFile(path, content, "utf8");
  console.log(`OK Message emitted: ${p.to}/pending/${filename}`);
  console.log(`   kind: ${p.kind} | goal: ${p.goal} | from: ${p.from} | to: ${p.to}`);
}

main().catch((e) => {
  console.error("notify.mjs crashed:", e.message);
  process.exit(1);
});
