# Dump archival runbook (QW-K3)

Off-machine archival of the pre-op `pg_dump` snapshots to the OCI VM, so a local
disk failure does not lose every restore-point.

## Why this exists

`pg_dump_snapshots/` (~3.7G / ~27 files) lives **only on the local Windows disk**:

- It is **gitignored** (`.gitignore`) → `git pull` never carries it.
- It is **excluded from the Mac/VM clones**: `scripts/align-clones.sh` `LEAN_EXCLUDE`
  drops `pg_dump_snapshots/`, and `scripts/sync-gitignored-to-vm.sh` mirrors gitignored
  data but `align-clones.sh` passes it as an extra exclude.

So before QW-K3 there was **no off-machine copy** of any restore-point — a single
disk failure would lose every pre-op snapshot. `scripts/archive-dumps.sh` fixes that
by mirroring the pre-op snapshots to the VM.

## Where the dumps live

| Location | Path | Role |
|---|---|---|
| Local (Windows) | `D:\heuresys-advanced\pg_dump_snapshots\` | Primary, working copy (gitignored, disk-only) |
| VM (OCI) | `oracle-vm-default:/home/ubuntu/dump_archive/` | Off-machine archive (disaster copy) |

The `pg_dump_snapshots/scheduled/` subdir (when present) is a **separate scheduled-backup
DR lane** with its own rotation — it is **NOT** archived by `archive-dumps.sh` (mixing the
two lanes would conflate their retention). `archive-dumps.sh` only archives the **ad-hoc
pre-op snapshots** (the top-level `*.dump`, `*.dump.gz`, `*.sql`, `*.provenance.txt`).

## How to run

```bash
# From repo root, on the Windows PC (Git Bash):
bash scripts/archive-dumps.sh
```

- **Idempotent / re-runnable**: rsync is not available in Git Bash, so the script emulates
  `rsync -av --ignore-existing` over `scp` — it lists what is already on the VM (name + byte
  size) and transfers **only** files that are missing or size-mismatched. Already-archived
  dumps of matching size are **skipped**, never re-sent.
- **Never deletes** anything (local or remote). No cron, no auto-purge.
- Prints a summary: local count, files transferred this run (+size), files skipped, and the
  remote total (`du -sh` + file count) after the run.

You can also see the off-disk archive status without transferring, via the clean dry-run
(it now reports both local and archived state):

```bash
pnpm clean:dumps        # -> bash scripts/clean.sh --dumps-dry-run
```

Overridable env (defaults shown): `SSH_HOST=oracle-vm-default`,
`REMOTE_DIR=/home/ubuntu/dump_archive`, `LOCAL_DIR=<repo>/pg_dump_snapshots`.

## Retention POLICY (manual only — never automated)

Consistent with the restore-point doctrine (`scripts/clean.sh` only ever **lists** dumps,
never deletes — a restore-point is NEVER auto-deleted):

- **Keep the last N pre-op snapshots** (recommended `N = 10`) — the most recent restore-points
  cover the active work window.
- **Plus 1 snapshot per calendar month** beyond N (a coarse long-tail history), so older
  milestones (`pre-rtl-rebuild`, `pre-v1.0.0-consolidation`, …) stay recoverable.
- **Purge is ONLY manual.** No script, cron, or hook deletes a dump. When the VM `/home/ubuntu`
  free space gets tight (24G free at setup), an operator reviews `ls -la` + `du`, decides which
  old snapshots are beyond the policy, and removes them **by hand** with an explicit `rm`,
  on the VM, after confirming a newer restore-point exists.

There is intentionally **no auto-prune** in `archive-dumps.sh` — adding one would violate the
doctrine and risk deleting the only off-machine copy of a restore-point.

## Restore from an archived dump (on the VM)

The archived files are plain `pg_dump` outputs. To restore one on the VM:

```bash
# 1) SSH to the VM
ssh oracle-vm-default

# 2) Inspect the archive, pick a restore-point (read its .provenance.txt if present)
ls -la /home/ubuntu/dump_archive
cat   /home/ubuntu/dump_archive/<name>.provenance.txt    # if a sidecar exists

# 3a) Custom-format dumps (*.dump) -> pg_restore. Restore into a SCRATCH db first
#     (never overwrite a live DB blindly); the VM DB is native PostgreSQL 16 on
#     localhost:5432 (NO Docker, I13).
sudo -u postgres createdb heuresys_restore_check
sudo -u postgres pg_restore --no-owner --no-acl \
     -d heuresys_restore_check /home/ubuntu/dump_archive/<name>.dump

# 3b) Gzipped custom-format (*.dump.gz) -> gunzip via stdin into pg_restore
gunzip -c /home/ubuntu/dump_archive/<name>.dump.gz \
  | sudo -u postgres pg_restore --no-owner --no-acl -d heuresys_restore_check

# 3c) Plain-SQL dumps (*.sql) -> psql
sudo -u postgres psql -d heuresys_restore_check \
     -f /home/ubuntu/dump_archive/<name>.sql

# 4) Validate the scratch restore, THEN promote deliberately (rename / re-point /
#    re-run db:migrate). Drop the scratch db when done.
sudo -u postgres dropdb heuresys_restore_check
```

Restoring on the Windows PC instead: copy the file back with
`MSYS_NO_PATHCONV=1 scp oracle-vm-default:/home/ubuntu/dump_archive/<name> ./pg_dump_snapshots/`
and use the local `pg_restore`/`psql` (via the SSH tunnel on `localhost:5433` to the VM DB, or
a local scratch DB) following the same custom-vs-plain split above.

> Restore is a **destructive** operation against a DB. Always restore into a scratch DB first,
> validate, and only then promote — never `pg_restore` over a live tenant DB without a fresh
> pre-op snapshot taken immediately before.
