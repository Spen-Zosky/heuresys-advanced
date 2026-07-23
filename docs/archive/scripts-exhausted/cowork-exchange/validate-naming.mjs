#!/usr/bin/env node
/**
 * scripts/cowork-exchange/validate-naming.mjs
 *
 * Validates cowork_code_exchange/ artefacts against protocol v2.
 *
 * Usage:
 *   node scripts/cowork-exchange/validate-naming.mjs            warn-only (exits 0)
 *   node scripts/cowork-exchange/validate-naming.mjs --strict   strict (exits non-zero on errors)
 *   node scripts/cowork-exchange/validate-naming.mjs --json     machine-readable output
 *
 * Checks:
 *   - File naming matches canonical regex
 *   - For each goal NNN, phase sequence is valid
 *   - APPROVAL plan_sha256 matches at least one present PLAN file
 *   - STATE current_phase consistent with files present
 *
 * Env:
 *   COWORK_EXCHANGE_STRICT=1  same as --strict
 */

import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');
const EXCHANGE_DIR = join(REPO_ROOT, 'cowork_code_exchange');

const args = process.argv.slice(2);
const STRICT = args.includes('--strict') || process.env.COWORK_EXCHANGE_STRICT === '1';
const JSON_OUT = args.includes('--json');

const PATTERNS = [
  { re: /^_00_DISCOVERY_(\d{3})_([a-z0-9-]+)\.md$/, type: 'DISCOVERY' },
  { re: /^_00_STATE_(\d{3})\.md$/, type: 'STATE' },
  { re: /^_01_PROMPT_(\d{3})_([a-z0-9_-]+)\.md$/, type: 'PROMPT' },
  { re: /^_02_PLAN_(\d{3})_([a-z0-9_-]+)(_v[a-z0-9-]+)?\.md$/, type: 'PLAN' },
  { re: /^_02b_APPROVAL_(\d{3})(_v[a-z0-9-]+)?\.md$/, type: 'APPROVAL' },
  { re: /^_03_EXEC_(\d{3})([a-z]?)_([a-z0-9_-]+)\.md$/, type: 'EXEC' },
  { re: /^_03_EXEC_(\d{3})([a-z]?)\.events\.jsonl$/, type: 'EXEC.events' },
  // REPORT: <NNN>[<resume>]_<slug>(_interim|_partial)?
  { re: /^_04_REPORT_(\d{3})([a-z]?)_([a-z0-9_-]+?)(_interim|_partial)?\.md$/, type: 'REPORT' },
  // REVIEW: <NNN>[<resume>]_<slug>
  { re: /^_05_REVIEW_(\d{3})([a-z]?)_([a-z0-9_-]+)\.md$/, type: 'REVIEW' },
];

const KNOWN_AUX = new Set([
  'README.md',
  'RULE_UPDATES.md',
  'RISK_REGISTER.md',
  'GOAL_B_REPORT_2026-05-18.md',
  'MIGRATION_STATUS_2026-05-18.md',
  '_SKILL_UPDATE_MEMO.md',
]);
const KNOWN_AUX_PATTERNS = [
  /^_00_SESSION_HANDOFF_\d{4}-\d{2}-\d{2}\.md$/,
];
const KNOWN_DIRS = new Set(['_templates', 'baselines', '.inbox', '.cowork-pending-commits']);
const KNOWN_AUX_HIDDEN = new Set([
  '.cowork-active.lock',
  '.cli-active.lock',
  '.cowork-pending-commits.json',
  '.cowork-pending-state-update.json',
]);
const INBOX_MSG_RE = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z__\d{3}__[a-z_-]+\.md$/;

const results = { errors: [], warnings: [], infos: [], goals: {} };

function record(level, msg, ctx) {
  const bucket = level + 's';
  if (!results[bucket]) return;
  results[bucket].push(Object.assign({ msg }, ctx || {}));
}

async function sha256File(path) {
  const buf = await readFile(path);
  return createHash('sha256').update(buf).digest('hex');
}

function parseYamlFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]+?)\n---/);
  if (!m) return null;
  const obj = {};
  for (const line of m[1].split('\n')) {
    const mm = line.match(/^(\w+):\s*(.*)$/);
    if (mm) obj[mm[1]] = mm[2].trim().replace(/^["']|["']$/g, '');
  }
  return obj;
}

function classify(entry) {
  for (const p of PATTERNS) {
    const m = entry.match(p.re);
    if (m) {
      return {
        type: p.type,
        nnn: m[1],
        resume: p.type === 'EXEC' || p.type === 'EXEC.events' ? (m[2] || '') : null,
        slug: p.type === 'EXEC' ? m[3] : (m[2] || null),
        file: entry,
      };
    }
  }
  return null;
}

async function main() {
  if (!existsSync(EXCHANGE_DIR)) {
    record('warning', 'Directory not found: ' + EXCHANGE_DIR);
    return finish();
  }
  const entries = await readdir(EXCHANGE_DIR);
  for (const entry of entries) {
    if (KNOWN_DIRS.has(entry)) continue;
    if (KNOWN_AUX.has(entry)) continue;
    if (KNOWN_AUX_PATTERNS.some((re) => re.test(entry))) continue;
    if (KNOWN_AUX_HIDDEN.has(entry)) continue;
    if (entry.startsWith('.')) continue;
    const c = classify(entry);
    if (!c) {
      record('warning', 'Unrecognized file naming: ' + entry, { file: entry });
      continue;
    }
    if (!results.goals[c.nnn]) {
      results.goals[c.nnn] = { phases: new Set(), files: [], slug: null, state: null, plans: [], approvals: [] };
    }
    const g = results.goals[c.nnn];
    g.phases.add(c.type + (c.resume ? '_' + c.resume : ''));
    g.files.push(c);
    if (c.slug && !g.slug && c.type !== 'STATE' && c.type !== 'APPROVAL') g.slug = c.slug;
    if (c.type === 'STATE') g.state = entry;
    if (c.type === 'PLAN') g.plans.push(entry);
    if (c.type === 'APPROVAL') g.approvals.push(entry);
  }

  for (const [nnn, g] of Object.entries(results.goals)) {
    const phases = g.phases;
    const hasExec = [...phases].some((p) => p.startsWith('EXEC'));
    if (hasExec && !phases.has('APPROVAL')) {
      record('error', 'Goal ' + nnn + ': EXEC present but no _02b_APPROVAL_' + nnn + '.md (Gate G1 violation).', { goal: nnn });
    }
    if (phases.has('REPORT') && !hasExec) {
      record('error', 'Goal ' + nnn + ': REPORT present but no EXEC.', { goal: nnn });
    }
    if (phases.has('REVIEW') && !phases.has('REPORT')) {
      record('warning', 'Goal ' + nnn + ': REVIEW present but no REPORT.', { goal: nnn });
    }
    if (!phases.has('STATE')) {
      record('warning', 'Goal ' + nnn + ': no _00_STATE_' + nnn + '.md (recommended by v2).', { goal: nnn });
    }
    if (g.plans.length > 1) {
      const canonical = g.plans.find((p) => !/_v[a-z0-9-]+\.md$/.test(p));
      const archives = g.plans.filter((p) => /_v[a-z0-9-]+\.md$/.test(p));
      if (canonical && archives.length === g.plans.length - 1) {
        record('info', 'Goal ' + nnn + ': PLAN file-versioning (canonical + ' + archives.length + ' archive(s))', { goal: nnn });
      } else {
        record('warning', 'Goal ' + nnn + ': ' + g.plans.length + ' PLAN files but no single canonical detected. v2.1 expects 1 canonical + _v<N> archives.', { goal: nnn });
      }
    }
    if (g.approvals.length > 0 && g.plans.length >= 1) {
      // Compute sha of every PLAN file once
      const planShas = {};
      for (const planFile of g.plans) {
        planShas[planFile] = await sha256File(join(EXCHANGE_DIR, planFile));
      }
      // For each APPROVAL, find which PLAN it signs
      const coveredPlans = new Set();
      for (const apFile of g.approvals) {
        const apText = await readFile(join(EXCHANGE_DIR, apFile), 'utf8');
        const fm = parseYamlFrontmatter(apText);
        if (!fm || !fm.plan_sha256) continue;
        const matchEntry = Object.entries(planShas).find(([, s]) => s === fm.plan_sha256);
        if (matchEntry) {
          record('info', 'Goal ' + nnn + ': APPROVAL "' + apFile + '" signs PLAN "' + matchEntry[0] + '" ✓', { goal: nnn });
          coveredPlans.add(matchEntry[0]);
        } else {
          record('error', 'Goal ' + nnn + ': APPROVAL "' + apFile + '" plan_sha256 (' + fm.plan_sha256.slice(0, 12) + ') matches NONE of present PLAN files.', { goal: nnn });
        }
      }
      // Flag the canonical (unsuffixed) PLAN if not covered
      const canonicalPlan = g.plans.find((p) => !/_v[a-z0-9-]+\.md$/.test(p));
      if (canonicalPlan && !coveredPlans.has(canonicalPlan)) {
        const sha = planShas[canonicalPlan];
        record('warning', 'Goal ' + nnn + ': canonical PLAN "' + canonicalPlan + '" (sha ' + sha.slice(0, 12) + ') is NOT covered by any APPROVAL. Fresh APPROVAL needed before EXEC.', { goal: nnn });
      }
    }
    if (g.state) {
      const stateText = await readFile(join(EXCHANGE_DIR, g.state), 'utf8');
      const fm = parseYamlFrontmatter(stateText);
      if (fm && fm.current_phase) {
        const declared = fm.current_phase;
        const declaredType = declared.split('_')[0];
        const matchingTypes = [...phases].map((p) => p.split('_')[0]);
        if (!matchingTypes.includes(declaredType) && declared !== 'CLOSED' && declared !== 'APPROVED') {
          record('warning', 'Goal ' + nnn + ': STATE.current_phase=' + declared + ' but no file of type ' + declaredType + ' present.', { goal: nnn });
        }
      }
    }
  }

  // Inbox consistency check (R8)
  for (const party of ['cowork', 'cli']) {
    for (const sub of ['pending', 'read']) {
      const dir = join(EXCHANGE_DIR, '.inbox', party, sub);
      if (!existsSync(dir)) continue;
      let entries = [];
      try { entries = await readdir(dir); } catch { continue; }
      for (const e of entries) {
        if (e === '.gitkeep' || e.startsWith('.')) continue;
        if (!INBOX_MSG_RE.test(e)) {
          record('warning', 'Inbox message naming nonconformant: .inbox/' + party + '/' + sub + '/' + e, { inbox: true });
          continue;
        }
        // Optional: read frontmatter and validate from/to/kind
        try {
          const text = await readFile(join(dir, e), 'utf8');
          const fm = parseYamlFrontmatter(text);
          if (!fm) {
            record('warning', 'Inbox message missing YAML frontmatter: ' + e, { inbox: true });
            continue;
          }
          if (fm.to && fm.to !== party) {
            record('warning', 'Inbox message in ' + party + "/ has frontmatter to=" + fm.to + ' (mismatch): ' + e, { inbox: true });
          }
          if (sub === 'read' && (!fm.read_at || fm.read_at === 'null')) {
            record('warning', 'Inbox message in read/ but read_at is null: ' + e, { inbox: true });
          }
        } catch {}
      }
    }
  }

  finish();
}



function finish() {
  if (JSON_OUT) {
    const goalsClean = Object.fromEntries(
      Object.entries(results.goals).map(([k, v]) => [k, { phases: [...v.phases], slug: v.slug, file_count: v.files.length }])
    );
    console.log(JSON.stringify({ errors: results.errors, warnings: results.warnings, infos: results.infos, goals: goalsClean }, null, 2));
  } else {
    const goalCount = Object.keys(results.goals).length;
    console.log('');
    console.log('cowork_code_exchange/ validation report (v2.2)');
    console.log('Goals found: ' + goalCount);
    for (const [nnn, g] of Object.entries(results.goals)) {
      const phasesList = [...g.phases].sort().join(', ');
      console.log('  ' + nnn + ' (' + (g.slug || 'no-slug') + '): ' + phasesList);
    }
    console.log('');
    if (results.errors.length) {
      console.log('X ' + results.errors.length + ' error(s):');
      for (const e of results.errors) console.log('  - ' + e.msg);
    }
    if (results.warnings.length) {
      console.log('! ' + results.warnings.length + ' warning(s):');
      for (const w of results.warnings) console.log('  - ' + w.msg);
    }
    if (results.infos.length) {
      console.log('i ' + results.infos.length + ' info(s):');
      for (const i of results.infos) console.log('  - ' + i.msg);
    }
    if (!results.errors.length && !results.warnings.length) {
      console.log('OK All checks passed.');
    }
  }
  const failed = results.errors.length > 0;
  if (STRICT && failed) process.exit(1);
  if (failed && !STRICT) {
    console.log('');
    console.log('Note: errors above did not fail this run (warn-only mode). Use --strict to fail.');
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('Validator crashed:', e.message);
  process.exit(2);
});
