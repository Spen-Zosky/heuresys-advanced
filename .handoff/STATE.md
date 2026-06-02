# heuresys-advanced — STATE

**Updated**: 2026-06-02 (S957). **🎉 v1.0.0 GA RELEASED.** `release/v1.0.0` (PR #24) auto-merged to `main` on CI 7/7 green; annotated tag **`v1.0.0`** + public GitHub Release. Working tree pulito. **55 migration** (`000001..000055`, gap 000035 cosmetico), db:migrate ×2 verde + **db:validate 7/7**. Full API suite **576 passed**; CI playwright-smoke 21 passed. Record autoritativo consolidato: **`NEXT_GENERATION_ENTRY_POINT.md`**.

## Last session brief (S957 — v1.0.0 consolidation: WS-4 R1b/V + WS-2 + WS-7)

- **WS-4 R1b** (`e16d7f2`, mig `000054`+`000055`): `sys_teams`/`sys_team_members` + TEAM_LEADER/TEAM_MEMBER + team:* perms + **"my team" 3rd scope axis** in `teams/service.ts` (FK+middleware, NEVER RLS). 24 team / 176 membership derivati dal vero org (`sys_organization_units`+position→OU; seed `13_teams_from_org.sql`, no fixtures). `/v1/teams` + `/v1/me/team` + pagina `/me/team` + sidebar me-team + `pnpm db:seed-r1b`. Integration 11/11. `ROLE_CODES` += 2 ruoli (cache 11 ruoli / 461 map).
- **WS-4 V** (`19be083`): `rbac-route-matrix.spec.ts` (5 ruoli × 3 route incl. /me/team) + `me-team.spec.ts` live; helper `gotoAuthenticated` (robust next-dev nav, no networkidle/load-on-route); auth.setup hydration hardened. CI playwright-smoke 21 passed.
- **WS-2** (`9fdd986`): wave-executor reso wave-agnostic (getWaveMappings/stagingTableFor/truncateAllWaveStaging/ensureLegacyMirrorDDL/analyzeWaveStaging parametrizzati; guard `wave!=1` rimosso; wave=2 = no-op vuoto 201/COMPLETE). **Data import Wave-2 deferito** (source-discovery-gated).
- **WS-7**: viz-graph rigenerato (org_chart seed tenant lookup `.test`→`tenant_code='RTL_BANK'`; RTL_ORG_CHART `325ecb42` 158 nodi/157 edge; orfani 161→0); ledger 000051-000055 registrato; bump 1.0.0 (root+4 workspace); CI 7/7 → merge → tag + release.

## Top priorities (next session — post v1.0.0)

1. **Wave-2/3 data import** (source-discovery-gated): l'executor è pronto (WS-2 code); serve caricare una sorgente Wave-2 + authoring mapping-card (mapping-card rule: no speculazione). Sblocca anche `sys_kpi_definitions` → `process_kpi_templates`/`sys_user_kpi_evidence`.
2. **WS-3 blocker** `sys_activity_classification_mappings` — redesign FK-vs-mapping (tocca mig 000007 shipped; ADR-0025 §5.3) → `DEBT_REGISTER`.
3. **SuccessFactors connector** (escluso da v1.0.0 — D-ROAD; design `docs/integrations/`, PII risolto ADR-0023); **WS-6 deferred**: MFA multi-kind, mobile-matrix a11y, observability-depth, markers; **F7** showcase refactor (decisione architetturale Enzo).

## Open questions

- SuccessFactors connector: adozione + naming `staging.sf_*` (I3/I4). Design committato, PII risolto (ADR-0023).

## Stack snapshot

- DB: 161 utenti / 2 tenant ACTIVE; **24 team / 176 membership** (org-derived); **55 migration** `000001..000055`; 162 positions titolate+wired; job_roles 227; ui_interfaces 24; RBAC **11 ruoli / 461 mapping**; viz-graph RTL_ORG_CHART 158 nodi/157 edge (0 orfani).
- RBAC epic: D1·D2·D3·A·R1a·R2·U1·U2·P1·**R1b**·**V** ✅ COMPLETE. WS-0..WS-7 ✅ → v1.0.0 GA.

## Verification (next session)
```bash
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "select count(*) from sys.sys_teams"  # 24
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
git -C /d/heuresys-advanced tag -l v1.0.0                      # v1.0.0
gh run list --limit 7                                         # CI 7/7
```
