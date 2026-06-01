# heuresys-advanced — STATE

**Updated**: 2026-06-01 (S955). **Branch**: `main`. S955 commit `f7799ed..b5cde3f` (B-51 + brand F5/F6 + R2) **PUSHATI, CI verde**. **+ U1 commit nuovo locale** (ui-interfaces registry `000050`) — push in attesa ok. **db:migrate ×2 verde** (50 migration), **API auth/rbac 28/28 + me-interfaces 5/5**, **web E2E PROD 108 verde**.

## Last session brief (S955 — 3 stream eseguiti in autonomia)

- **🟢 B-51 DONE** (`9b06629`, migration `000048`). Re-derivati 162 `position_title` dalla professione reale legacy (`employees.job_title`, join `position_metadata->>'legacy_employee_id'` 162/162 esatto), creati 25 job_roles `RTL-ROLE-*` (global, family/seniority NULL), wired `position_job_role_id` 162/162. Mappa baked come VALUES (CI-reproducibile, no `\copy`); generatore `db/seeds/rtl-rebuild/11_rederive_b51_titles_roles.py`. Idempotente (2° run 0 mutazioni), backup `pg_dump_snapshots/pre-b51-s955_*`. **Sblocca R2.**
- **🟢 Brand-fidelity F5 + F6 DONE** (`ee062ed` + `fa4f631`, 14 pagine). F6 = admin/roles (token-table, RbacMatrix unfit) + enterprise-typing (brand-shell, FormWizard unfit). F5 = 12 ESS pages (DataTablePanel/EntityTable per le list, PageHeader+token per le form, me/ landing StatsCard static-value, inbox→AuditFeed, profile FieldGrid). Re-skin only (dati/testid intatti); zero `dark:`, token `text-danger/success` (no `text-destructive` raw). Verificato: typecheck + next build + Playwright **108 green** su build PROD.
- **🟡 B-50 parziale**: eseguita la parte safe (docs/housekeeping). **(c)** 2 orphan run = terminali, 0 ref downstream → leave-as-is. **(b) riclassificato + root-cause pinpointed**: 3 silent-skip veri + 2 REFERENCE_ONLY by-design; root-cause = fallimento natural-key nel transform LOOKUP_FK (CW-B60-A/B61), NON sorgente/target vuoti. Fix = engine-internal, gated, MED-HIGH risk, zero test → **NON eseguito** (sessione dedicata). Dettaglio in `SOT_BACKLOG.md` B-50 §S955.
- **⛔ F7 deferito**: NON è una migration — `apps/web/showcase` è il sorgente canonico già on-brand; spostarlo in `apps/showcase` è un refactor che rischia il Pages deploy → serve decisione architetturale.

## Top priorities (next session)

1. **R2 ✅ + U1 ✅ DONE (S955)**. R2: 4 ruoli holderless assegnati per funzione + login (auth/rbac 28/28). U1: `sys_ui_interfaces` (mig 000050, 23 interfacce) + `GET /v1/me/interfaces` registry sidebar DB-driven con hybrid gate (test 5/5, no-leak verificato). **NEXT = U2** (sidebar live che consuma `GET /v1/me/interfaces` + perspective switcher PET → sostituisce l'array nav hardcoded in `(authenticated)/layout.tsx`, swap behaviour-preserving), poi P1/V. Vedi `RBAC_UIX_PERSPECTIVES_PLAN.md`.
2. **B-50(b) — silent-skip trio fix** (gated, ~40-60k, MED-HIGH risk): root-cause già pinpointed (LOOKUP_FK natural-key, vedi backlog). Leggere resolver `brownfield-wave-executor/{transform-compiler,transforms}.ts` + `validate_lookup_fk_dispatch()`, campionare mismatch, re-import gated dei 3 contro VM legacy, validare.
3. **B-10 SDBI Phase 2 / B-50(a)** (multi-sessione, 75-125h, mapping-card design umano); **F7** showcase refactor (decisione Enzo).

## Stack snapshot

- DB: 161 utenti / 2 tenant ACTIVE (RTL_BANK 158 + HEURESYS 3); **47 migration** `000001..000048`; **162 positions** titolate+wired; **job_roles 227** (+25 RTL-ROLE). 719 MB.
- Brand: 14/14 F5+F6 pagine migrate (ESS 12 + admin 2). F7 = no-op (già on-brand).
- Server lasciati: nessuno (API :3001 + web prod :3000 killati a fine sessione).

## Verification (next session)
```bash
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "select count(position_job_role_id) from sys.sys_positions"  # 162
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # 4 commit non pushati (S955)
gh run list --limit 6                                         # CI (dopo push)
```
