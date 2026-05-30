# heuresys-advanced — STATE

**Updated**: 2026-05-30 (S950). **Branch**: `main` HEAD `2b898d2` = synced with origin. **CI 5/5 GREEN** on `bad989f` (test-integration + playwright-smoke, entrambi rossi a S949, ora verdi). Working tree: solo la proposta SuccessFactors uncommitted (vedi Open questions).

## Last session brief

- **🟢 RTL TENANT REBUILD ESEGUITO + validato + pushato.** DB collassato a **161 utenti / 2 tenant** (RTL_BANK ex-`86ba7a65` + nuovo HEURESYS), org reale wired da legacy: 162 posizioni (157 owned-by-manager I1), 160 assignment, 26 OU, 3180 attendance IMPORT, comp/skills/certs/RBAC. Seed `db/seeds/rtl-rebuild/00..10` (corretti: 8 difetti B1-B8). **D6 corretto**: le righe SYSTEM attendance erano dati legacy REALI → rietichettate, non cancellate. `09` distruttivo eseguito single-tx (assert 161/272 ✓). Backup `…pre-09-collapse_a892b81…` + Phase-0.
- **D3 persone → utenti reali**: tenantAdmin=federica.marchetti, manager=paolo.caputo, employee=tommaso.fiore (report di paolo), outsider=antonio.parisi; admin@heuresys.com invariato. `seed-test-admin.ts` refactored (auth persone reali). **40 file test API** + fixtures + CI playwright-smoke migrati. API **354/0**, prod E2E **138/0**.
- **2 fix pre-esistenti** emersi dalla validazione: **D4 gate-semantics** risolto (hybrid gate `hasAdminRole` in `layout.tsx`, `b62b441`); **login rate-limit** env-tunable `AUTH_LOGIN_RATELIMIT_MAX` (default prod 10, `bad989f`). 7 commit pushati `3df1f6a..2b898d2`.

## Top priorities (next session)

1. **Brand-fidelity F5 ESS / F6 admin / F7 showcase** (~6-8h) — ora sbloccato: l'ESS ha dati reali post-rebuild. Vedi `memory/project_brand_fidelity_migration.md`.
2. **Decidere proposta SuccessFactors** (working tree, vedi Open questions) — adottare design + aprire item `SOT_BACKLOG.md`?
3. **(opz.) Refinement posizioni**: job_role/ESCO sulle 162 posizioni reali + cycle-detection su reports_to + 2 posizioni con OU NULL (employee su OU legacy esclusi). 03 li ha deferiti.

## Open questions

- **SuccessFactors connector** (uncommitted: `docs/integrations/successfactors_…md` + `docs/kb/COWORK_INBOX.md`): design riconciliato (pattern β brownfield-new-source + γ SDBI). 2 flag invariante da decidere: 🔴 I12 (PII reale vs brownfield no-PII) + ⚠️ I3/I4 (`staging.sf_*`). Adottare nel repo + backlog item?

## Stack snapshot

- DB: 161 utenti / 2 tenant ACTIVE (RTL_BANK + HEURESYS), org reale wired. origin/main `2b898d2`, CI verde.
- Full local E2E: serve `AUTH_LOGIN_RATELIMIT_MAX=<alto>` (la suite supera il cap 10/5min). Prod-build E2E via `next build`+`next start` (dev-mode flaky su Windows first-compile). Tunnel :5433 hands-off (ADR-0021).

## Verification (next session)
```bash
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "select count(*) from sys.sys_users"  # 161
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
gh run list --limit 6                                         # CI verde
```
