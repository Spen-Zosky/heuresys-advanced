# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-07-01 (S1012 — 2 CI rosse risolte + D-49 + Playwright resilience + modello authz ADR-0027 F0-F2; F3 rimandato opzione A).

> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti. Menu generato da `docs/kb/tools/build_menu.py`.

## Last session brief (S1012)

Sessione lunga e densa. **(1)** Le 2 CI rosse su `main` risolte alla radice: `me-interfaces` test **de-hardcodato** (derivava una lista ESS hardcoded rotta da F5 → ora deriva dalla registry DB + invarianti; regola Enzo "mai hardcoding" → memoria) e `i18n` timeout 3→5min (setup sotto contesa single-runner). **(2)** **D-49 RISOLTO**: `scripts/vm-deploy-remote.sh` lancia il deploy **detached** (setsid+nohup + poll) — un timeout del client SSH non lo interrompe più a metà; provato live. **(3)** Lezione **path assoluti** (Enzo "errore grave") → hardening `REMOTE_REPO` obbligatorio + 2 memorie (no-path-assoluti, no-hardcoded-test-data). **(4)** **Playwright** reso resiliente al lock apt (rosso-fantasma su runner). **(5)** **Modello autorizzazione bi-assiale ADR-0027 approvato** (intervista Enzo): asse organizzativo (reports-to transitivo)→dati sensibili, asse funzionale (team/processo)→attività; invarianti I16-I21. **F0** (helper org ricorsivi), **F1** (motore unico `resolveOrgReadScope` + reports-to transitivo + **vincolo gestionale** Enzo: solo MANAGER/CEO o responsabile-OU vedono il sub-tree), **F2** (tassonomia data-class, 20 risorse riservate classificate con decisioni Enzo) — tutti shippati, CI-verdi in PROD. **I21**: HRMS_MANAGER plenipotenziario dati. **F3 rimandato** (opzione A Enzo): il buco D-50 è in **molti moduli** (non 4) — mappa 16-agenti pronta, F3 in sessione dedicata (no sicurezza affrettata di notte).

## Top priorities (next session)

1. **F3** (enforcement regola cardine → chiude **D-50**, P1): molti moduli sensibili, mappa pronta in `docs/superpowers/specs/2026-07-01-f3-sensitive-modules-map.md` (per-modulo: buco + integration point + pattern `users` da replicare + test personas reali). Un modulo alla volta, ciascuno testato.
2. **I21 follow-up** (P2): grant RBAC dei permessi CRUD non-self mancanti a HRMS_MANAGER (es. `compensation_intelligence:update`, `user:delete`).
3. **pricing page** GTM (#4, autorità *cosa* = Enzo: serve numeri prezzi/tier).

## Open questions (autorità *cosa* = Enzo)

- **pricing**: numeri prezzi/tier per la pricing page GTM.

## Verification (next session)

```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline          # 0 dopo handoff push
cd apps/api && pnpm exec vitest run test/scope-org.integration.test.ts test/scope-resolver.integration.test.ts test/scope-data-classes.integration.test.ts   # F0-F2 verdi
python docs/kb/tools/handoff_lint.py                                 # OK
```
