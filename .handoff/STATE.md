# heuresys-advanced — STATE

**Updated**: 2026-05-28 (S941 — debiti + quick-win backlog chiusi; zod4 piano+spike).
**Branch**: `main` — HEAD `7050fb8` synced origin (0/0). CI verde. **0 alert Dependabot**.
**Last tag**: `v0.4.1-housekeeping-closed` (@ `01340ae`).

## Last session brief

Risoluzione debiti + backlog a basso rischio + setup zod4:
- **Debiti chiusi** (`DEBT_REGISTER` ora 0 aperti azionabili): **D-01** doc-drift (CLAUDE.md→MVP-4 + README), **D-04** root cleanup (5 doc → `docs/archive/`), **D-09/B-25** CI skip su PR `defer-major` (validato dal vivo: PR defer-major → CI skipped).
- **Quick-win backlog**: **B-22** react-i18next 15→17 + i18next 23→26, **B-24** gh-pages@v3→v4 (deploy verde), **B-43** xos_lib file-based (COPY sync Git Bash), **B-02** verificato (repo wiki GitHub assente, tool locali ok). PR Dependabot #6/#16 superseded.
- **B-20/B-21 zod4+ftpz6**: piano + spike fatti (vedi sotto). NON ancora eseguito.

## Top priorities (next session)

1. **Eseguire B-20/B-21 zod4+ftpz6** (~2-4h). Piano `docs/superpowers/plans/2026-05-28-zod4-ftpz6-migration.md`. Spike misurato: **302 tc error = 1 causa-radice** (ftpz6 non infersce `req.body/params/query`) + 1 fix (`ZodError.errors`→`.issues`). Ripartire dal worktree `../heuresys-advanced-zod4` (branch `feat/zod4-ftpz6` @ `a6a2969`, deps già bumpate). Fase 1 = risolvere wiring ftpz6/zod4.
2. **B-10 SDBI Phase 2** (~6-10h, sbloccato da zod4). Dati nel dump `heuresys_platform_0507` su VM. Scope per-area da decidere.
3. **B-31** ADR ssh-agent persistence (decisione security). B-40/41/42 deferiti.

## Open questions

- zod4: il wiring ftpz6 corretto è centrale (`app.ts`/typing del plugin) o serve toccare le 61 route? (lo spike indica centrale, da confermare in Fase 1).
- B-10 SDBI: una macro-area è "fatta" solo con stack completo (Zod+repo+service+routes+test) — definire scope per-area prima di partire.

## Stack snapshot

- HEAD `7050fb8` = origin (0/0). CI 6 workflow verdi + showcase deploy `gh-pages@v4`.
- Versioni: zod 3.25.76 (4.4.3 in worktree spike) · ftpz 4.0.2 (6.1.0 in worktree) · **react-i18next 17.0.8 · i18next 26.3.0** · next 15.5.18 · migrate.sh idempotent (43 mig).
- **SoT viva**: `docs/kb/` (SOT_STATE/SOT_BACKLOG/DEBT_REGISTER). CLAUDE.md/README ora allineati a MVP-4 (D-01 chiuso).
- **Worktree attivo**: `../heuresys-advanced-zod4` (`feat/zod4-ftpz6`) — spike zod4, non pushato.

## Verification (next session)

```bash
ssh -o BatchMode=yes oracle-vm-default 'echo OK'
nc -z localhost 5433 || ssh -fN -L 5433:localhost:5432 oracle-vm-default
git log origin/main..HEAD --oneline   # empty = synced
git worktree list                     # heuresys-advanced-zod4 = spike branch
gh run list --limit 4                 # CI green
```
