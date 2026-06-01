# heuresys-advanced — STATE

**Updated**: 2026-06-01 (S955). **Branch**: `main` HEAD `8db67b4` = synced origin, **CI verde** (7 commit S955). Working tree pulito. **50 migration** (`000001..000050`), db:migrate ×2 verde. Win + Mac + VM allineati a `8db67b4` (gitignored sincronizzati, esclusi i backup locali); **VM deployata + live** (dev-mode, API :8013 + web :3013, smoke-test verde incl. endpoint U1).

## Last session brief (S955 — 5 stream shipped, tutto pushato + CI verde)

- **B-51** (`9b06629`, mig `000048`): 162 `position_title` re-derivati dalla professione reale legacy + 25 job_roles `RTL-ROLE-*` + `position_job_role_id` wired 162/162. Generatore `db/seeds/rtl-rebuild/11_rederive_b51_titles_roles.py`.
- **Brand F5+F6** (`ee062ed`+`fa4f631`, 14 pagine): ESS 12 + admin 2 re-skinned (DataTablePanel/PageHeader/AuditFeed/StatsCard-static). Playwright 108 PROD.
- **R2** (`b5cde3f`, mig `000049` + `pnpm db:seed-r2`): 4 ruoli holderless (PROCESS_OWNER/BLUEPRINT_MANAGER/READ_ONLY/CEO) assegnati a veri utenti RTL per funzione + login. auth/rbac 28/28.
- **U1** (`d282141`, mig `000050`): `sys_ui_interfaces` registry (23) + `GET /v1/me/interfaces` (hybrid gate). test 5/5.
- **U2** (`8db67b4`): `(authenticated)/layout.tsx` sidebar DB-driven (hook `useMyInterfaces`, gating → server-side) + filtro perspective PET. E2E 76/76 PROD.

## Top priorities (next session)

1. **P1 — RBAC epic** (`RBAC_UIX_PERSPECTIVES_PLAN.md`): `sys_user_preferences` + `GET/PATCH /v1/me/preferences` + load/apply/persist theme+palette per `user_id` (locked decision 3c). Poi **V** (matrice esaustiva 8-ruoli×route×2-temi). ~3-5h.
2. **B-50(b) — silent-skip trio fix** (gated, ~40-60k, MED-HIGH risk): root-cause pinpointed (LOOKUP_FK natural-key, CW-B60-A/B61). Resolver `brownfield-wave-executor/{transform-compiler,transforms}.ts` + `validate_lookup_fk_dispatch()`, campionare mismatch, re-import gated dei 3 vs VM legacy. Vedi `SOT_BACKLOG.md` B-50 §S955.
3. **B-10 SDBI Phase 2 / B-50(a)** (75-125h, multi-sessione, mapping-card design umano); **F7** showcase refactor (decisione architetturale Enzo); **R1b** teams.

## Open questions

- SuccessFactors connector: adozione come item MVP-4 + naming `staging.sf_*` (I3/I4). Design committato, PII risolto (ADR-0023).

## Stack snapshot

- DB: 161 utenti / 2 tenant ACTIVE; **50 migration** `000001..000050`; 162 positions titolate+wired; job_roles 227; ui_interfaces 23. 719 MB.
- RBAC epic: D1·D2·D3·A·R1a·R2·U1·U2 ✅ → next P1. Brand F5+F6 ✅ (F7 deferito).

## Verification (next session)
```bash
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "select count(*) from sys.sys_ui_interfaces"  # 23
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
gh run list --limit 6                                         # CI
```
