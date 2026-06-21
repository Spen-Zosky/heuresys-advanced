#!/usr/bin/env bash
#
# scripts/sync-gitignored-to-vm.sh — one-shot (re-runnable) mirror of this
# checkout's gitignored DATA/artifacts to the VM clone, EXCLUDING regenerable /
# platform-specific objects (node_modules, dist, .next, out, test-results,
# *.tsbuildinfo) and the environment-specific .env (the VM bootstrap owns .env;
# copying the PC's tunnel .env would clobber the VM's local-DB config).
#
# Rationale: `git clone` brings only tracked files; gitignored data (brownfield
# extracts/seeds, graphify-out, qa snapshots, logs, showcase src, .secrets, …)
# never reaches the VM otherwise. node_modules/dist/.next are intentionally NOT
# mirrored — they are regenerated per-platform by the bootstrap (Windows
# node_modules would be broken on the VM's ARM64/Linux).
#
# git enumerates what is gitignored; tar-over-ssh transfers it (rsync is not
# available in Git Bash on Windows). Additive overwrite — never deletes VM-side
# files. Runs from any source workstation with git + tar + ssh (incl. Git Bash).
#
# Overridable env: SSH_HOST DEST_DIR EXTRA_EXCLUDE_RE
set -euo pipefail

SSH_HOST="${SSH_HOST:-oracle-vm-default}"
DEST_DIR="${DEST_DIR:-/home/ubuntu/heuresys-advanced}"
# Optional caller-supplied extra excludes (e.g. align-clones.sh drops heavy regenerable
# DATA — pg_dump_snapshots, legacy extracts — that a runtime clone doesn't need).
EXTRA_EXCLUDE_RE="${EXTRA_EXCLUDE_RE:-}"

# Regenerable / platform-specific / environment-specific — never mirror these.
# `.superpowers/` is session scratch (SDD ledger/briefs/diffs); on Windows its files can
# present to tar as "hardlink pointing to itself" → a non-zero tar exit aborts the whole
# sync (set -e) and fails the close. It is local-only scratch → exclude like test-results.
EXCLUDE_RE='(^|/)node_modules/$|(^|/)dist/$|(^|/)\.next/$|(^|/)out/$|(^|/)test-results/$|(^|/)\.superpowers/$|\.tsbuildinfo$|^\.env$'

cd "$(git rev-parse --show-toplevel)"

list="$(git ls-files --others --ignored --exclude-standard --directory | grep -vE "$EXCLUDE_RE" || true)"
[ -n "$EXTRA_EXCLUDE_RE" ] && list="$(printf '%s\n' "$list" | grep -vE "$EXTRA_EXCLUDE_RE" || true)"
if [ -z "$list" ]; then
  echo "Nothing gitignored to sync (after exclusions)."
  exit 0
fi

echo "=== gitignored paths to mirror -> $SSH_HOST:$DEST_DIR ==="
printf '%s\n' "$list" | sed 's/^/  /'
n="$(printf '%s\n' "$list" | grep -c .)"

# Sanity: warn if the destination is not a git checkout (clone it first).
if ! ssh -o BatchMode=yes "$SSH_HOST" "[ -d '$DEST_DIR/.git' ]" 2>/dev/null; then
  echo "  WARNING: $SSH_HOST:$DEST_DIR is not a git checkout — run vm-bootstrap.sh there first." >&2
fi

echo "=== transferring ($n paths via tar over ssh; additive overwrite) ==="
printf '%s\n' "$list" \
  | tar czf - -T - \
  | ssh -o BatchMode=yes "$SSH_HOST" "mkdir -p '$DEST_DIR' && tar xzf - -C '$DEST_DIR'"

echo "Done. Mirrored $n gitignored path(s) to $SSH_HOST:$DEST_DIR"
echo "(excluded: node_modules, dist, .next, out, test-results, *.tsbuildinfo, .env)"
