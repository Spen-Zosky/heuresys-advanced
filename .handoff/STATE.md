# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-20 (S999 — Gap#1 programma-faro CHIUSO end-to-end + deployato PROD; goals/okrs shippati stesso giorno).

> **Vista rapida** (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui.

## Last session brief (S999 — Gap#1 "rendi il prodotto dimostrabile" chiuso in una sessione)

Enzo: "parti autonomamente e porti tutto a conclusione" (fase ferma da decine di sessioni). **Diagnosi onesta**: i "blocchi" erano in gran parte miei (decisioni *tecniche* trattate come Enzo-gated; WI-C creduto bloccato). **Unica vera decisione di prodotto** = rubrica Maturity L0-L5 → Enzo ha scelto **v1-full** (bande + gate). Poi Gap#1 costruito **end-to-end, live su RTL_BANK**: **Step 1 RBAC** (ORG_DIRECTOR + 4 perms, mig 000145) · **Step 3 MLCE** engine capability-composition (mig 000146, 317 score a 4 livelli employee→position→org-unit→org, determinismo+D-18, 11/11) · **Step 4 Maturity** L0-L5 v1-full (mig 000147, 20 OU→L2/L3/L5 con gate che declassano, 9/9) · **Step 2+5** console `/process-owner` + `/org-director` (mig 000148/149, E2E 7/7 live) · **WI-C demo agente** PASS (agente MAX → HITL → `hrx_tenant_materialize` plan → 7 OU/11 pos, read-only). Fix latente trovato dal server PROD: ORG_DIRECTOR mancava da `RoleCode` union → cache skippava i mapping (corretto). **Close**: 6 commit (`787621f→f133b04`) pushati · **VM PROD deployata+verificata** (`/v1/capability/*` 401-live, `www.heuresys.com/login` 200) · Mac allineato. Stesso giorno (pre-Gap#1): moduli **goals** + **okrs** (read-only, mig 000142-144). Counts granulari → `SOT_STATE.md §Delta S999`.

## Top priorities (next session)

1. **Programma-faro → #4 GO-TO-MARKET** (autorità *cosa* = Enzo). Gap#1 ha reso il prodotto **dimostrabile** (3 prospettive → ora le 2 porte UI + i motori MLCE/Maturity sono live): è l'abilitatore del go-to-market. Suoi input: **#5-RACI di produzione** (mapping reale OU↔processo R/A/C/I, oggi 13 righe demo) · **#13 B-50 bridges** (location↔OU, job→position) · **#17 Wave-3** (multi-tenant-onboarding, fondazione WI-C pronta).
2. **Blocked-on-Enzo (input solo tuo)** — **#8 EMAIL**: app-password Outlook (`enzo.spenuso@outlook.com`) → attiva EMAIL_OTP + digest live in 1 mossa. (**#16 SuccessFactors de-prioritizzato** da Enzo S999.)
3. **Gap#1 follow-up (non bloccanti, CLASS-A)** — D1-A: grant `ORG_DIRECTOR` a un utente reale quando nominato (000049-style) · Porta-1 RACI drill-down (`/v1/organization-unit-processes/by-process/:id`, layer successivo) · rubrica Maturity v1-full rivedibile (`rubric_version`, no data-loss) · richezza UI porte (radar/PIP drill-down).

## Open questions (autorità *cosa* = Enzo)

- **Go-to-market**: scope/forma (il *cosa*) ora che il prodotto è dimostrabile.
- **RACI di produzione** + **holder reale ORG_DIRECTOR**: dati business che solo tu fornisci (engine/UI pronti, si accendono da soli).

## Verification (next session)

```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline    # 0 dopo handoff push S999
ls db/migrations/*.sql | tail -1                               # 000149 (147 file, gap 000035+000139)
cd apps/api && pnpm exec vitest run test/capability-composition.integration.test.ts test/capability-maturity.integration.test.ts  # 20/20
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT count(*) FROM sys.sys_capability_scores"  # 317 (post-recompute)
```
