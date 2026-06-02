# heuresys-advanced — STATE

**Updated**: 2026-06-02 (S957). **🎉 v1.0.0 GA RELEASED** (tag `v1.0.0` @ `c7c985a` + public GitHub Release) **+ VM fully PRODUCTION.** main HEAD `2d17928`, synced, working tree clean. **55 migration** (`000001..000055`), db:migrate ×2 + **db:validate 7/7**. Full API suite **576 passed**; CI playwright-smoke 21. Record autoritativo: **`NEXT_GENERATION_ENTRY_POINT.md`**.

## Last session brief (S957)

**v1.0.0 consolidation (WS-0→WS-7, merged + released):**
- **WS-4 R1b** (`e16d7f2`, mig 000054/055): `sys_teams`/`sys_team_members` + TEAM_LEADER/TEAM_MEMBER + **"my team" 3rd scope axis** (FK+middleware, never RLS); 24 team/176 membership dal vero org (seed 13, no fixtures); `/v1/teams` + `/v1/me/team` + pagina + sidebar. Integration 11/11.
- **WS-4 V** (`19be083`): matrice E2E campionata + me-team spec; helper `gotoAuthenticated`; auth.setup hardened. **WS-2** (`9fdd986`): wave-executor wave-agnostic (guard rimosso; data import Wave-2 deferito, source-gated). **WS-7**: viz-graph rigenerato (orfani 161→0), bump 1.0.0, PR #24 merged, post-merge showcase-fix.

**Post-release ops (VM = ambiente PROD, disciplina utente):**
- VM + Mac allineati a v1.0.0; **@heuresys/ui 0.1.1→0.1.2** (fix look). VM **convertita a PRODUZIONE durevole**: web `next start` (commit `ad08951`), **API tsup bundle `node dist/server.js`** (`2d17928`). Template systemd + `vm-bootstrap.sh` + **`scripts/vm-deploy.sh`** tutti prod. Verificato: login 200, /readyz db ok, RBAC 11 ruoli, web /login 0.1s. Deploy futuro: `ssh oracle-vm-default 'cd ~/heuresys-advanced && bash scripts/vm-deploy.sh'`.

## Top priorities (next session — post v1.0.0)

1. **Wave-2/3 data import** (source-discovery-gated): executor pronto (WS-2); serve sorgente Wave-2 + mapping-card (no speculazione). Sblocca `sys_kpi_definitions` → process_kpi/user_kpi_evidence.
2. **WS-3 blocker** `sys_activity_classification_mappings` — redesign FK-vs-mapping (tocca mig 000007; ADR-0025 §5.3) → DEBT_REGISTER.
3. **SuccessFactors connector** (escluso v1.0.0 — D-ROAD); **WS-6 deferred** (MFA multi-kind, mobile-matrix, observability-depth); **F7** showcase refactor.

## Open questions
- SuccessFactors connector: adozione + naming `staging.sf_*`. Design committato, PII risolto (ADR-0023).

## Stack snapshot
- DB: 161 utenti / 2 tenant; **24 team / 176 membership**; **55 migration**; RBAC **11 ruoli / 461 map**; ui_interfaces 24; viz-graph 158 nodi/157 edge (0 orfani).
- **VM PROD**: api `node dist/server.js` (tsup bundle) :8013 + web `next start` :3013, @heuresys/ui 0.1.2, Node 22 nvm. RBAC epic + WS-0..WS-7 ✅ → v1.0.0 GA.

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
git -C /d/heuresys-advanced tag -l v1.0.0                      # v1.0.0
ssh oracle-vm-default 'curl -s localhost:8013/readyz; systemctl is-active heuresys-advanced-{api,web}'
```
