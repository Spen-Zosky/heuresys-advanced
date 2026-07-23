#!/usr/bin/env node
/**
 * scripts/cowork-exchange/inbox.mjs
 *
 * Inbox reader / mark-as-read primitive per cowork_code_exchange/README.md v2.2 §-0 R8.
 *
 * Usage:
 *   node scripts/cowork-exchange/inbox.mjs                # list pending for both parties
 *   node scripts/cowork-exchange/inbox.mjs cowork         # list pending for Cowork only
 *   node scripts/cowork-exchange/inbox.mjs cli            # list pending for CLI only
 *   node scripts/cowork-exchange/inbox.mjs --read <file>  # mark as read (mv pending -> read)
 *   node scripts/cowork-exchange/inbox.mjs --rebuild-index  # regenerate INDEX.md
 *
 * Examples:
 *   pnpm cowork:inbox
 *   pnpm cowork:inbox cli
 *   pnpm cowork:inbox --read 2026-05-19T00-50Z__002__prompt_ready.md
 */

import { readFile, readdir, rename, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..", "..");
const EXCHANGE_DIR = join(REPO_ROOT, "cowork_code_exchange");
const INBOX_DIR = join(EXCHANGE_DIR, ".inbox");

const args = process.argv.slice(2);

function usage(exit = 1) {
  console.log(`
inbox.mjs — list / mark-as-read inbox messages (cowork_code_exchange v2.2 R8)

Usage:
  node scripts/cowork-exchange/inbox.mjs                          # list both parties
  node scripts/cowork-exchange/inbox.mjs <cowork|cli>             # list one party
  node scripts/cowork-exchange/inbox.mjs --read <filename>        # mv pending -> read
  node scripts/cowork-exchange/inbox.mjs --read-by <party> <file> # explicit party + filename
  node scripts/cowork-exchange/inbox.mjs --rebuild-index          # regenerate INDEX.md
  node scripts/cowork-exchange/inbox.mjs --json                   # machine-readable
`);
  process.exit(exit);
}

function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]+?)\n---/);
  if (!m) return null;
  const obj = {};
  let inArray = null;
  for (const line of m[1].split("\n")) {
    if (inArray && /^\s+-\s+/.test(line)) {
      obj[inArray].push(line.replace(/^\s+-\s+/, "").trim());
      continue;
    } else {
      inArray = null;
    }
    const mm = line.match(/^(\w+):\s*(.*)$/);
    if (mm) {
      const k = mm[1];
      const v = mm[2].trim();
      if (v === "" || v === "[]") { obj[k] = []; inArray = k; }
      else obj[k] = v.replace(/^["']|["']$/g, "");
    }
  }
  return obj;
}

async function listPending(party) {
  const dir = join(INBOX_DIR, party, "pending");
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir);
  const out = [];
  for (const e of entries) {
    if (e === ".gitkeep" || e.startsWith(".")) continue;
    if (!e.endsWith(".md")) continue;
    const text = await readFile(join(dir, e), "utf8");
    const fm = parseFrontmatter(text) || {};
    const subjectMatch = text.match(/^#\s+(.+)$/m);
    out.push({
      filename: e,
      path: join(dir, e),
      from: fm.from || "?",
      goal: fm.goal_id || "?",
      kind: fm.kind || "?",
      created: fm.created_at || "?",
      subject: subjectMatch ? subjectMatch[1].trim() : "(no subject)",
      expected: fm.expected_response_kind || "null",
    });
  }
  out.sort((a, b) => a.created.localeCompare(b.created));
  return out;
}

async function listRead(party) {
  const dir = join(INBOX_DIR, party, "read");
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir);
  return entries.filter((e) => e.endsWith(".md")).length;
}

async function showInbox(filterParty) {
  const parties = filterParty ? [filterParty] : ["cowork", "cli"];
  console.log("");
  console.log("Inbox state (cowork_code_exchange v2.2 R8):");
  for (const p of parties) {
    const pending = await listPending(p);
    const readCount = await listRead(p);
    console.log("");
    console.log(`  ${p}/  pending: ${pending.length}  | read-archive: ${readCount}`);
    if (pending.length === 0) {
      console.log(`    (no pending messages)`);
      continue;
    }
    for (const m of pending) {
      console.log(`    [${m.kind}] goal=${m.goal} from=${m.from}  ${m.created}`);
      console.log(`      subj: ${m.subject}`);
      console.log(`      file: ${m.filename}`);
      console.log(`      next-expected: ${m.expected}`);
    }
  }
  console.log("");
}

async function markRead(filename, explicitParty) {
  let party = explicitParty;
  let foundPath = null;
  if (!party) {
    for (const p of ["cowork", "cli"]) {
      const candidate = join(INBOX_DIR, p, "pending", filename);
      if (existsSync(candidate)) { party = p; foundPath = candidate; break; }
    }
    if (!party) {
      console.error(`file not found in any pending/: ${filename}`);
      process.exit(3);
    }
  } else {
    foundPath = join(INBOX_DIR, party, "pending", filename);
    if (!existsSync(foundPath)) {
      console.error(`file not found in ${party}/pending/: ${filename}`);
      process.exit(3);
    }
  }

  const readDir = join(INBOX_DIR, party, "read");
  await mkdir(readDir, { recursive: true });
  const destPath = join(readDir, filename);
  await rename(foundPath, destPath);

  // Update frontmatter read_at + acknowledged_by
  const text = await readFile(destPath, "utf8");
  const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const updated = text
    .replace(/^read_at:\s*null\s*$/m, `read_at: ${nowIso}`)
    .replace(/^acknowledged_by:\s*null\s*$/m, `acknowledged_by: ${party}`);
  await writeFile(destPath, updated, "utf8");

  console.log(`OK Marked as read: ${party}/read/${filename}`);
}

async function rebuildIndex() {
  const corkPending = await listPending("cowork");
  const cliPending = await listPending("cli");
  const corkRead = await listRead("cowork");
  const cliRead = await listRead("cli");
  const ts = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  const lines = [
    `# Inbox INDEX`,
    ``,
    `> Auto-generated by \`scripts/cowork-exchange/inbox.mjs --rebuild-index\`.`,
    `> Last refresh: ${ts}`,
    ``,
    `## Cowork inbox (messages FOR Cowork, FROM CLI)`,
    ``,
    `pending: ${corkPending.length} | read-archive: ${corkRead}`,
    ``,
  ];
  if (corkPending.length > 0) {
    lines.push(`| Created | Kind | Goal | Subject | Expected response |`);
    lines.push(`|---|---|---|---|---|`);
    for (const m of corkPending) {
      lines.push(`| ${m.created} | ${m.kind} | ${m.goal} | ${m.subject} | ${m.expected} |`);
    }
  } else {
    lines.push(`_(no pending)_`);
  }
  lines.push("", `## CLI inbox (messages FOR CLI, FROM Cowork)`, "");
  lines.push(`pending: ${cliPending.length} | read-archive: ${cliRead}`, "");
  if (cliPending.length > 0) {
    lines.push(`| Created | Kind | Goal | Subject | Expected response |`);
    lines.push(`|---|---|---|---|---|`);
    for (const m of cliPending) {
      lines.push(`| ${m.created} | ${m.kind} | ${m.goal} | ${m.subject} | ${m.expected} |`);
    }
  } else {
    lines.push(`_(no pending)_`);
  }
  lines.push("", `---`, ``, `*Inbox INDEX is regenerated on every \`pnpm cowork:inbox --rebuild-index\` call.*`, ``);

  const indexPath = join(INBOX_DIR, "INDEX.md");
  await writeFile(indexPath, lines.join("\n"), "utf8");
  console.log(`OK INDEX rebuilt: cowork_code_exchange/.inbox/INDEX.md`);
}

async function main() {
  if (args.includes("--help") || args.includes("-h")) usage(0);
  if (!existsSync(EXCHANGE_DIR)) { console.error(`exchange dir not found`); process.exit(2); }
  await mkdir(INBOX_DIR, { recursive: true });

  if (args.includes("--rebuild-index")) {
    await rebuildIndex();
    return;
  }

  const readByIdx = args.indexOf("--read-by");
  if (readByIdx >= 0) {
    const party = args[readByIdx + 1];
    const file = args[readByIdx + 2];
    if (!party || !file) usage(2);
    await markRead(file, party);
    return;
  }

  const readIdx = args.indexOf("--read");
  if (readIdx >= 0) {
    const file = args[readIdx + 1];
    if (!file) usage(2);
    await markRead(file);
    return;
  }

  const partyArg = args.find((a) => a === "cowork" || a === "cli");
  await showInbox(partyArg);
}

main().catch((e) => {
  console.error("inbox.mjs crashed:", e.message);
  process.exit(1);
});
