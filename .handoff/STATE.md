# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-20 (S1000 — infra: handoff-rigor design + 3 bugfix ecosystem + FASE 4 align completo).

> **Vista rapida** (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui.

## Last session brief (S1000 — infra pura: handoff-rigor + fix ecosystem)

Sessione di infrastruttura pura (nessun modulo prodotto). **Obiettivo**: implementare il design handoff-rigor (`docs/superpowers/specs/2026-06-20-handoff-rigor-and-hold-lane-design.md` §3-§5/§12-§13) + eseguire FASE 4 (propagare l'ecosistema Claude sui 3 remoti). **Deliverable infra**: (1) `close-propagate.sh` — orchestratore canonico two-channel close (commit `2af84c6`); (2) `handoff_lint.py` + design spec §4 (commit `fa9591d`); (3) status vocabulary + HOLD register nella skill `handoff` + CLAUDE.md §Session start (commit `6ac3869`); (4) `vm-deploy.sh` env-parametrico per linux-pc twin — D-39 RISOLTO (commit `0ec57e4`). **3 bug trovati durante FASE 4 e fixati**: Bug 1 — `backup_remote` zsh word-split: su Mac (zsh login shell), `$existing` non veniva word-splittato → `tar` falliva con "Cannot stat"; fix: array `to_tar=()` (commit `db3c237`); Bug 2 — `cleanup` trap exit-0: la funzione `cleanup()` restituiva 1 quando `$STAGE=""`, avvelenando il codice di uscita via `trap ... EXIT`; fix: `return 0` esplicito (commit `5f3e376`); Bug 3 — `MSYS_NO_PATHCONV=1` globale in `close-propagate.sh` rompeva i path `jq` in `align-claude-ecosystem.sh`; fix: rimosso il globale, mantenuto per-ssh-call (commit `936a690`). **Scoperta permanente**: claude CLI su Mac Ivy Bridge (2012) dà SIGILL (rc=132) — istruzione CPU non supportata; `--skip-smoke` obbligatorio per il Mac; config files (CLAUDE.md/skills/settings) arrivano comunque. **FASE 4 COMPLETO** (EXIT=0 verificato): Mac + VM + linux-pc ricevono lo stesso ecosistema Claude (CLAUDE.md, skills, commands, settings, SDK parity); VM + linux-pc 16 plugin installati; Mac file config pushati, plugin SIGILL-skipped. 8 commit totali pushati (S1000, `fa9591d→5f3e376`). Counts granulari invariati (infra-only) → `SOT_STATE.md §Delta S1000`.

## Top priorities (next session)

1. **Programma-faro → #4 GO-TO-MARKET** (autorità *cosa* = Enzo). Gap#1 ha reso il prodotto **dimostrabile** (3 prospettive → le 2 porte UI + i motori MLCE/Maturity sono live): è l'abilitatore del go-to-market. Suoi input: **#5-RACI di produzione** (mapping reale OU↔processo R/A/C/I, oggi 13 righe demo) · **#13 B-50 bridges** (location↔OU, job→position) · **#17 Wave-3** (multi-tenant-onboarding, fondazione WI-C pronta).
2. **Blocked-on-Enzo (input solo tuo)** — **#8 EMAIL**: app-password Outlook (`enzo.spenuso@outlook.com`) → attiva EMAIL_OTP + digest live in 1 mossa. (**#16 SuccessFactors de-prioritizzato** S999.)
3. **Gap#1 follow-up (CLASS-A, non bloccanti)** — D1-A: grant `ORG_DIRECTOR` a un utente reale quando nominato · Porta-1 RACI drill-down (`/v1/organization-unit-processes/by-process/:id`) · rubrica Maturity rivedibile (`rubric_version`) · arricchimento UI porte (radar/PIP drill-down).

## Open questions (autorità *cosa* = Enzo)

- **Go-to-market**: scope/forma ora che il prodotto è dimostrabile (Gap#1 live PROD).
- **RACI di produzione** + **holder reale ORG_DIRECTOR**: dati business che solo tu fornisci (engine/UI pronti).

## Verification (next session)

```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline    # 0 dopo handoff push S1000
ls db/migrations/*.sql | tail -1                               # 000149 (147 file, gap 000035+000139)
cd apps/api && pnpm exec vitest run test/capability-composition.integration.test.ts test/capability-maturity.integration.test.ts  # 20/20
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT count(*) FROM sys.sys_capability_scores"  # 317
```
