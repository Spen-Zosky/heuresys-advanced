#!/usr/bin/env node
/**
 * scripts/cowork-exchange/status.mjs
 *
 * Reads cowork_code_exchange/_00_STATE_*.md files and emits a human-readable
 * summary of all active goals.
 *
 * Usage:
 *   node scripts/cowork-exchange/status.mjs              # summary of all goals
 *   node scripts/cowork-exchange/status.mjs <NNN>        # detail for one goal
 *   node scripts/cowork-exchange/status.mjs --json       # machine-readable
 */

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');
const EXCHANGE_DIR = join(REPO_ROOT, 'cowork_code_exchange');

const args = process.argv.slice(2);
const JSON_OUT = args.includes('--json');
const FILTER_NNN = args.find((a) => /^\d{3}$/.test(a));

function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]+?)\n---/);
  if (!m) return null;
  const obj = {};
  let arrayKey = null;
  let arrayBuf = [];
  let mapKey = null;
  let mapBuf = {};
  for (const line of m[1].split('\n')) {
    if (arrayKey) {
      const item = line.match(/^\s+- (.+)$/);
      if (item) {
        arrayBuf.push(item[1].replace(/^["']|["']$/g, ''));
        continue;
      } else {
        obj[arrayKey] = arrayBuf;
        arrayKey = null;
        arrayBuf = [];
      }
    }
    if (mapKey) {
      const item = line.match(/^\s+(\w+):\s*(.+)$/);
      if (item) {
        mapBuf[item[1]] = item[2].replace(/^["']|["']$/g, '');
        continue;
      } else {
        obj[mapKey] = mapBuf;
        mapKey = null;
        mapBuf = {};
      }
    }
    const mm = line.match(/^(\w+):\s*(.*)$/);
    if (mm) {
      const k = mm[1];
      const v = mm[2].trim();
      if (v === '' || v === '|') {
        // could be array or map ahead
        arrayKey = k;
        arrayBuf = [];
        mapKey = null; // tentative; toggle on first child
        continue;
      }
      obj[k] = v.replace(/^["']|["']$/g, '');
    }
  }
  if (arrayKey) obj[arrayKey] = arrayBuf;
  if (mapKey) obj[mapKey] = mapBuf;
  return obj;
}

async function readStates() {
  if (!existsSync(EXCHANGE_DIR)) return [];
  const entries = await readdir(EXCHANGE_DIR);
  const states = [];
  for (const e of entries) {
    const m = e.match(/^_00_STATE_(\d{3})\.md$/);
    if (!m) continue;
    if (FILTER_NNN && m[1] !== FILTER_NNN) continue;
    const text = await readFile(join(EXCHANGE_DIR, e), 'utf8');
    const fm = parseFrontmatter(text) || {};
    states.push({ file: e, nnn: m[1], ...fm });
  }
  return states.sort((a, b) => a.nnn.localeCompare(b.nnn));
}

function summaryLine(s) {
  const phase = s.current_phase || 'unknown';
  const turn = s.turn_consumed && s.turn_budget ? `${s.turn_consumed}/${s.turn_budget}` : '—';
  const halts = s.halt_count || '0';
  const next = s.next_actor || '?';
  return `  ${s.nnn} | ${s.slug || '?'} | phase=${phase} | turns=${turn} | halts=${halts} | next=${next}`;
}

function detail(s) {
  console.log(`\n━━━ Goal ${s.nnn} — ${s.slug || '?'} ━━━`);
  console.log(`Created     : ${s.created || '—'}`);
  console.log(`Phase       : ${s.current_phase || '—'}`);
  console.log(`PLAN ver/sha: ${s.plan_version || '—'} / ${(s.plan_sha256 || '—').slice(0, 16)}…`);
  console.log(`Turn budget : ${s.turn_consumed || 0} / ${s.turn_budget || '—'}`);
  console.log(`Last event  : ${s.last_event_ts || '—'} (${s.last_event_actor || '?'})`);
  console.log(`              ${s.last_event_summary || '—'}`);
  console.log(`Next actor  : ${s.next_actor || '?'}`);
  console.log(`Halts       : ${s.halt_count || 0}`);
  if (Array.isArray(s.halt_reasons) && s.halt_reasons.length) {
    for (const r of s.halt_reasons) console.log(`              - ${r}`);
  }
  if (s.backup_gate && typeof s.backup_gate === 'object') {
    console.log(`Backup gate : ${s.backup_gate.status || '—'} (${s.backup_gate.last_check || 'n/a'})`);
  }
}

async function main() {
  const states = await readStates();
  if (JSON_OUT) {
    console.log(JSON.stringify(states, null, 2));
    return;
  }
  if (!states.length) {
    console.log(FILTER_NNN ? `No state file for goal ${FILTER_NNN}.` : 'No active goals (no _00_STATE_*.md files).');
    return;
  }
  if (FILTER_NNN) {
    detail(states[0]);
    return;
  }
  console.log(`\nActive goals in cowork_code_exchange/ (${states.length}):`);
  console.log(`  NNN | slug | phase | turns | halts | next_actor`);
  console.log(`  ----+------+-------+-------+-------+-----------`);
  for (const s of states) console.log(summaryLine(s));
  console.log('');
}

main().catch((e) => {
  console.error('✗ status.mjs crashed:', e.message);
  process.exit(1);
});
