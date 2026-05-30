# heuresys-advanced — STATE

**Updated**: 2026-05-30 (S948 — brand-fidelity F4 charts **completo** + cleanup VM/swap).
**Branch**: `main` — HEAD `804c3d0` = origin (pushed). **Last tag**: `v0.4.1-housekeeping-closed`.
**CI**: `e09643b` + `804c3d0` **tutti verdi (5/5 workflow ciascuno, Playwright incluso, 4m39s)** → swap 8G ha risolto l'OOM alla radice. F4 chiuso e validato in CI.

## Last session brief

- **Brand-fidelity F4 (charts) COMPLETO** — 4 fasi, API-first, EChartsCard via boundary `(authenticated)/_charts-client.tsx` (`dynamic ssr:false`, gate CW-B59 superato in prod build). 4 commit `f13f472`→`804c3d0`:
  - **F4.1** compensation: donut distribuzione status reward-gate. `GET /v1/compensation/distribution`.
  - **F4.2** career-succession: bar readiness pipeline. `GET /v1/successor-candidates/readiness-distribution`.
  - **F4.3** visualizations: pie distribuzione type + **bugfix R3** (interfacce stale `visualizationGraphId/graphKind/status`→reali `graphId/type/isActive`; il Mermaid detail perdeva TUTTI gli edge per `nodeMap.has(undefined)`). `GET /v1/visualization-graphs/summary`.
  - **F4.4** org-chart: renderer **echarts force graph** (no React Flow). `GET /v1/visualization-graphs/:id/render` (composite). Seed `db/seeds/org_chart_rtl_demo.sql` (idempotente, 161 nodi/1 edge dai positions). Fix query `?graphKind=`→`?type=` (era ignorata → ritornava tutti i grafi).
- Ogni fase: schema+repo+service+route+integration test verde, typecheck+`next build` prod verdi, Playwright E2E in prod build verde, commit atomico. Test API aggiunti: compensation 9/9, successor-candidates 5/5, visualizations 6/6.
- **Cleanup VM OCI** (inizio sessione): liberati ~6G (Playwright 1217 orfano, Claude CLI vecchie, apt/log/journal, DB dumps pre-migration + audit aprile + .claude.backup 12-mag). **Swap 4→8G** (`/swapfile2`, fstab) → mitiga l'OOM CI (validato da Playwright verde su e09643b).
- **CI infra OOM S947 RISOLTO**: era runner ARM saturato da Chromium; re-run su VM risanata + swap 8G → verde.

## Top priorities (next session)

1. **🔴 RTL TENANT REBUILD da dati legacy reali — PRIORITÀ #1.** SPEC completo: `docs/superpowers/specs/2026-05-30-rtl-tenant-rebuild.md`. Collassare il DB a **2 tenant** (`rtl-bank.org` reale + `heuresys.com`), agganciando gli user REALI a posizioni/org/assignment **importati dal legacy** (NON mapping sintetico), poi sanitizzare gli schemi. **Fonti scoperte** (workflow `wf_4445cc37-d22`): dump PostgreSQL freschi (mar-mag 2026) con FK chain intatta — il più ricco è **VM `/home/ubuntu/heuresys-evo/backups/local/heuresys_platform_20260507T030001Z.dump` (367MB) + DB Docker live `heuresys_evo_platform_db`** (270 empl/4 tenant, RTL 158); il più pulito **VM `/home/ubuntu/heuresys.com.evo` → `/home/ubuntu/backups/heuresys_platform_pre_esco_import_20260326…sql.gz`** (267 empl·47 org·20 jobs·100 assignments). Mapping legacy→v5 già pronto in `db/seeds/brownfield/wave1/04_column_mappings.sql`. **Phase 0 = pg_dump backup (rollback).** Vincoli/note: **personas E2E RICABLATE su utenti reali per ruolo** (TENANT_OWNER→tenantAdmin, DEPT_HEAD→manager, EMPLOYEE→employee, heuresys.com→platformAdmin) — `rtl-bank.test` SPARISCE, invariante = CI verde (aggiornare fixtures+password, non preservare `*.test`); **portare la logica RBAC→accesso-UI dal legacy** (`rbp_roles`/`role_permissions`) sostituendo le route legacy con quelle attuali; DB condiviso; ~20 tabelle sensibili legacy senza tenant_id/RLS → filtro esplicito.
2. **Brand-fidelity F5 ESS `/me/*`** (~10-14 pagine): pattern ESS branded. (Dopo il rebuild — i dati ESS saranno reali.)
3. **F6 admin** (`/admin/roles`→RbacMatrix già verde, verificare fedeltà) + **F7-refactor showcase** (ok Enzo).

## Open questions

- org-chart degenere: 161 positions ma **1 solo `reports_to`** nel seed → il force graph mostra nodi quasi isolati. Se serve gerarchia ricca, popolare `reports_to` (fuori scope F4).
- Seed org-chart nel DB condiviso (VM): il grafo `RTL_ORG_CHART` è persistente; il file `db/seeds/org_chart_rtl_demo.sql` lo ri-genera se il DB viene resettato. La CI non lo ri-esegue (DB già popolato).
- B-10 SDBI Phase 2 (~6-10h, backend) ancora aperto — priorità vs F5/F6.

## Stack snapshot

- HEAD `804c3d0` = origin. `@heuresys/ui` ^0.1.1 (npm, EChartsCard usato via `(authenticated)/_charts-client.tsx`). next 15.5.18 · zod 4.4.3 · Node 22 (VM).
- **EChartsCard pattern**: import SOLO da `_charts-client` (mai da `@heuresys/ui` diretto nelle pagine chart) — `dynamic(()=>import("@heuresys/ui").then(m=>({default:m.EChartsCard})),{ssr:false})`. I componenti SVG-puri (gauge/sparkline) restano import diretto.
- **Web dev locale prod-verify**: `pnpm --filter @heuresys/web build` + `next start -p 3000` (env `NEXT_PUBLIC_API_PROXY_BASE_URL=http://localhost:3001`), API `pnpm --filter @heuresys/api dev` :3001. E2E SEMPRE in prod build. Riavvio :3000 su Windows: `Stop-Process` su PID porta (non TaskStop).
- **Tunnel DB** :5433 hands-off (ADR-0021). **VM swap ora 8G**. **SoT viva**: `docs/kb/` + memoria `project-brand-fidelity-migration`.

## Verification (next session)
```bash
nc -z localhost 5433                                # tunnel (o Test-NetConnection)
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
gh run list --limit 8                               # CI 804c3d0 verde?
```
