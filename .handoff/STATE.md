# heuresys-advanced — STATE

**Updated**: 2026-05-28 (S940 — DB-chain hardening + backlog verification).
**Branch**: `main` — HEAD synced origin. CI verde. **0 alert Dependabot**.
**Last tag**: `v0.4.1-housekeeping-closed` (@ `01340ae`).

## Last session brief

Sessione di hardening + accertamento (no nuovo sviluppo applicativo):
- **`migrate.sh` reso ri-eseguibile end-to-end + idempotent** (commit `9e67d42`, vedi `DEBT_REGISTER.md` D-12): fix di 3 rotture pre-esistenti della chain — 000007 guard CHECK, 000033 ownership→heuresys, 000044 colonna `table_mapping_classification` (la migration ora esegue ADR-0020: 12 righe IMPORT→REFERENCE_ONLY). Verificato OK end-to-end ×2 (43 mig, 0 errori).
- **Verifica evidence-based di tutto il backlog/debiti** (commit `5dce407`): digest reale in `docs/kb/SOT_BACKLOG.md` §"Verifica stato 2026-05-27" — ogni item con stato verificato + scope residuo.

## Top priorities (next session — FRESH)

1. **Risolvere/chiudere il backlog aperto** seguendo il digest verificato (`docs/kb/SOT_BACKLOG.md` §Verifica). Realmente da fare: **B-01** doc-drift CLAUDE/README → MVP-4 (P0, ~30-45min); **B-10** SDBI Phase 2 (intatto; dati nel dump `heuresys_platform_0507` sulla VM, NON in legacy_mirror); **B-20+B-21** zod 3→4 + ftpz 4→6 (accoppiati, alto rischio); **B-22** react-i18next; **B-24** → solo PR #16 gh-pages; **B-25** skip defer-major; **B-31/B-43** infra/lib; **D-04** root cleanup.
2. Depennare gli stale: **B-23** (next, nessuna PR aperta, `next@15.5.18`), **B-03/D-08** (fatto), **B-26/D-12** (risolti).

## Open questions

- zod4 (B-20/B-21): mini-milestone dedicato prima di B-10 o dentro? (~101 file, alto rischio; test coprono).
- B-10 SDBI: una macro-area è "fatta" SOLO con stack completo (Zod+repo+service+routes+test), non con sole tabelle — regola progetto, definire scope per-area prima di partire.

## Stack snapshot

- HEAD = commit di handoff (pre-handoff `9e67d42`). CI verde su v6 actions. zod 3.25.76 · ftpz 4.0.2 · react-i18next 15.4.0 · next 15.5.18 · tmp 0.2.7.
- **migrate.sh**: ri-eseguibile + idempotent (43 mig, OK×2).
- **SoT viva**: `docs/kb/` (CLI-owned; SOT_STATE/SOT_BACKLOG/DEBT_REGISTER/COWORK_*). CLAUDE.md/README stale a MVP-1 (D-01/B-01).
- **KB**: wiki `heuresys-advanced-wiki` + graph hub in `wiki-space`. Re-sync `docs/kb/tools/sync.sh`.

## Verification (next session)

```bash
ssh -o BatchMode=yes oracle-vm-default 'echo OK'
nc -z localhost 5433 || ssh -fN -L 5433:localhost:5432 oracle-vm-default
git log origin/main..HEAD --oneline   # empty = synced
bash db/scripts/migrate.sh            # OK: 43 migrations applied (idempotent)
gh run list --limit 4                 # CI green · 0 dependabot alerts
```
