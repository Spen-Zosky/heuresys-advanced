# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-07-01 (S1013 — Batch F3+I21+F5+F6 [ADR-0027]: **D-50 🔴 RISOLTO**; F4 → HOLD, sessione dedicata).

> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti. Menu generato da `docs/kb/tools/build_menu.py`.

## Last session brief (S1013)

Batch autorizzazione bi-assiale (ADR-0027) chiuso end-to-end. **D-50 🔴 RISOLTO**: **F3** org-axis enforcement sui moduli sensibili (list filtrata da `resolveOrgReadScope.userIdAllowList`, per-target da `canReadOrgTarget`) — dimostrato red→green su personas reali (`paolo→tommaso` ok / `paolo→antonio` 404 / USER 403 / HR-mandated tenant-wide). **I21**: HRMS_MANAGER plenipotenziario dati (mig 000169, permessi business, tecnologici esclusi; live E2E). **F5**: peer-isolation I19 bidirezionale (paolo⊥claudia, sub-tree disgiunti). **F6**: scope-access audit centralizzato nel resolver. Regressione chiusa dentro il lavoro: semantic-matching per-target ora org-gated (frontend usa solo `/me/*` → invisibile) + test `matching:admin` de-hardcodato (regola S1012). Suite API verde, typecheck verde, commit atomici per modulo. Enzo: `matching:admin`/`capability:admin` tenuti in HRMS (confermato). Dettaglio + counts → SOT_STATE Delta S1013.

## Top priorities (next session)

1. **pricing page** GTM (#4, ACTIVE — autorità *cosa* = Enzo: servono numeri prezzi/tier).
2. **#8 EMAIL** dormiente (WAIT-INPUT: app-password Outlook) → attiva EMAIL_OTP + digest in una mossa.

## Open questions (autorità *cosa* = Enzo)

- **F4 activity entities**: task model generico vs riuso goals/approvals (sblocca F4).
- **pricing**: numeri prezzi/tier per la pricing page GTM.

## Verification (next session)

```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline          # 0 dopo handoff push
cd apps/api && pnpm exec vitest run test/scope-peer-isolation.integration.test.ts test/scope-audit.integration.test.ts test/hrms-plenipotentiary.integration.test.ts   # F5/F6/I21 verdi
python docs/kb/tools/handoff_lint.py                                 # OK
```
