#!/usr/bin/env node
/**
 * scripts/cowork-exchange/new-goal.mjs
 *
 * Scaffold a new goal in cowork_code_exchange/ per protocol v2.
 *
 * Usage:
 *   node scripts/cowork-exchange/new-goal.mjs <slug>            # picks next free NNN
 *   node scripts/cowork-exchange/new-goal.mjs <slug> <NNN>      # explicit NNN
 *   node scripts/cowork-exchange/new-goal.mjs --help
 *
 * Creates (under cowork_code_exchange/):
 *   - _00_STATE_<NNN>.md          (from template, frontmatter populated)
 *   - _00_DISCOVERY_<NNN>_<slug>.md (from template, empty body)
 *
 * Does NOT create PROMPT/PLAN/etc — those follow protocol flow.
 *
 * Idempotent: refuses to overwrite existing files.
 */

import { readFile, writeFile, readdir, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');
const EXCHANGE_DIR = join(REPO_ROOT, 'cowork_code_exchange');
const TEMPLATES_DIR = join(EXCHANGE_DIR, '_templates');

function usage() {
  console.log(`
new-goal.mjs — scaffold a new goal in cowork_code_exchange/ (protocol v2)

Usage:
  node scripts/cowork-exchange/new-goal.mjs <slug>
  node scripts/cowork-exchange/new-goal.mjs <slug> <NNN>

Args:
  <slug>  kebab-case description (e.g. "wave-2-mapping-seed"). Required.
  <NNN>   optional explicit goal counter (3-digit). If omitted, picks next free.

Examples:
  node scripts/cowork-exchange/new-goal.mjs sql-side-upsert-refactor
  node scripts/cowork-exchange/new-goal.mjs mfa-totp-ui 003

Creates: _00_STATE_<NNN>.md + _00_DISCOVERY_<NNN>_<slug>.md
`);
}

function isValidSlug(s) {
  return /^[a-z][a-z0-9-]{2,60}$/.test(s);
}

function isValidNNN(s) {
  return /^\d{3}$/.test(s);
}

async function listExistingGoals() {
  const entries = await readdir(EXCHANGE_DIR);
  const goals = new Set();
  for (const e of entries) {
    const m = e.match(/^_\d{2}[a-z]?_[A-Z]+_(\d{3})/);
    if (m) goals.add(parseInt(m[1], 10));
  }
  return [...goals].sort((a, b) => a - b);
}

async function nextFreeNNN() {
  const existing = await listExistingGoals();
  let n = 1;
  while (existing.includes(n)) n++;
  return String(n).padStart(3, '0');
}

function isoNow() {
  // Local time with offset, e.g., 2026-05-18T17:48:00+02:00
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const tz = -d.getTimezoneOffset();
  const sign = tz >= 0 ? '+' : '-';
  const tzh = pad(Math.floor(Math.abs(tz) / 60));
  const tzm = pad(Math.abs(tz) % 60);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${tzh}:${tzm}`;
}

function isoUtcNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00');
}

async function loadTemplate(name) {
  const path = join(TEMPLATES_DIR, name);
  if (!existsSync(path)) {
    throw new Error(`Template not found: ${path}. Run from a project with cowork_code_exchange/_templates/ present.`);
  }
  return readFile(path, 'utf8');
}

function interpolate(template, vars) {
  return template
    .replaceAll('<NNN>', vars.NNN)
    .replaceAll('NNN', vars.NNN)
    .replaceAll('<slug>', vars.slug)
    .replaceAll('<kebab-case-slug>', vars.slug)
    .replaceAll('YYYY-MM-DDTHH:MM:SS+02:00', vars.localTs)
    .replaceAll('YYYY-MM-DDTHH:MM:SS+00:00', vars.utcTs)
    .replaceAll('YYYY-MM-DD', vars.dateOnly);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    usage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const slug = args[0];
  if (!isValidSlug(slug)) {
    console.error(`✗ Invalid slug: "${slug}". Must be kebab-case [a-z0-9-], 3-60 chars, lowercase, start with letter.`);
    process.exit(2);
  }

  let NNN;
  if (args[1]) {
    if (!isValidNNN(args[1])) {
      console.error(`✗ Invalid NNN: "${args[1]}". Must be 3 digits (e.g., 002).`);
      process.exit(2);
    }
    NNN = args[1];
    const existing = await listExistingGoals();
    if (existing.includes(parseInt(NNN, 10))) {
      console.error(`✗ Goal ${NNN} already exists. Existing: ${existing.map((n) => String(n).padStart(3, '0')).join(', ')}`);
      process.exit(3);
    }
  } else {
    NNN = await nextFreeNNN();
  }

  const localTs = isoNow();
  const utcTs = isoUtcNow();
  const dateOnly = localTs.slice(0, 10);
  const vars = { NNN, slug, localTs, utcTs, dateOnly };

  const stateTpl = await loadTemplate('_00_STATE.template.md');
  const discoveryTpl = await loadTemplate('_00_DISCOVERY.template.md');

  const stateContent = interpolate(stateTpl, vars);
  const discoveryContent = interpolate(discoveryTpl, vars);

  const stateFile = join(EXCHANGE_DIR, `_00_STATE_${NNN}.md`);
  const discoveryFile = join(EXCHANGE_DIR, `_00_DISCOVERY_${NNN}_${slug}.md`);

  for (const f of [stateFile, discoveryFile]) {
    if (existsSync(f)) {
      console.error(`✗ Refusing to overwrite existing file: ${f}`);
      process.exit(4);
    }
  }

  await writeFile(stateFile, stateContent, 'utf8');
  await writeFile(discoveryFile, discoveryContent, 'utf8');

  console.log(`✓ Goal ${NNN} scaffolded for slug "${slug}"`);
  console.log(`  STATE     : ${stateFile.replace(REPO_ROOT + '/', '')}`);
  console.log(`  DISCOVERY : ${discoveryFile.replace(REPO_ROOT + '/', '')}`);
  console.log(``);
  console.log(`Next steps (per cowork_code_exchange/README.md v2):`);
  console.log(`  1. Cowork fills DISCOVERY with facts (SSH queries, vocab enumeration, row counts)`);
  console.log(`  2. Cowork writes _01_PROMPT_${NNN}_${slug}.md citing DISCOVERY`);
  console.log(`  3. CLI produces _02_PLAN_${NNN}_${slug}.md`);
  console.log(`  4. Cowork writes _02b_APPROVAL_${NNN}.md with PLAN sha256`);
  console.log(`  5. CLI runs EXEC, then REPORT, then Cowork REVIEW`);
}

main().catch((e) => {
  console.error('✗ Error:', e.message);
  process.exit(1);
});
