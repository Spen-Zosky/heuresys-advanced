#!/usr/bin/env node
/**
 * scripts/cowork-exchange/install-hooks.mjs
 *
 * Installs a git pre-commit hook that runs validate-naming.mjs in warn-only mode
 * (default) or strict mode (env COWORK_EXCHANGE_STRICT=1).
 *
 * Idempotent: re-running this script overwrites the hook with the latest version.
 *
 * Hook source: scripts/cowork-exchange/hooks/pre-commit
 * Hook target: .git/hooks/pre-commit
 */

import { readFile, writeFile, chmod, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');
const SRC = join(__dirname, 'hooks', 'pre-commit');
const DST_DIR = join(REPO_ROOT, '.git', 'hooks');
const DST = join(DST_DIR, 'pre-commit');

async function main() {
  if (!existsSync(SRC)) {
    console.error(`✗ Source hook not found: ${SRC}`);
    process.exit(2);
  }
  if (!existsSync(join(REPO_ROOT, '.git'))) {
    console.error(`✗ Not a git repo: ${REPO_ROOT} (no .git/ dir)`);
    process.exit(2);
  }
  await mkdir(DST_DIR, { recursive: true });
  const src = await readFile(SRC, 'utf8');
  let existing = null;
  if (existsSync(DST)) {
    existing = await readFile(DST, 'utf8');
    if (!existing.includes('cowork-exchange/validate-naming')) {
      console.error(`✗ Existing .git/hooks/pre-commit doesn't reference cowork-exchange.`);
      console.error(`  Refusing to overwrite. Manually merge or remove the existing hook first.`);
      console.error(`  Existing hook path: ${DST}`);
      process.exit(3);
    }
  }
  await writeFile(DST, src, 'utf8');
  try {
    await chmod(DST, 0o755);
  } catch (e) {
    // On Windows chmod is a no-op; Git Bash honors x bit via filesystem ACL on NTFS+Cygwin. Best effort.
  }
  console.log(`✓ Installed pre-commit hook → ${DST.replace(REPO_ROOT + '/', '')}`);
  console.log(`  Mode: warn-only (default). To make it strict, edit hook or set COWORK_EXCHANGE_STRICT=1 in env.`);
  console.log(`  Test manually: bash .git/hooks/pre-commit`);
}

main().catch((e) => {
  console.error('✗ install-hooks failed:', e.message);
  process.exit(1);
});
