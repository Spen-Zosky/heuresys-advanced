# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-07-21 (S1023 — epiche GO-BRANCH COMPLETATE e LIVE in PROD).

> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Kickoff prossima sessione → `docs/kb/NEXT_SESSION_DB_FRONTEND_FORENSICS_KICKOFF.md`.

## Last session brief (S1023)

Mandato epiche eseguito integralmente, merged e **dimostrato live su PROD**: D-08 F2-F5 (runner off-prod su linux-pc, deploy-gate `ci-gate.sh` ADR-0028 — primo esercizio reale riuscito al deploy, resource-slice su entrambi i runner), D-14 F2-F4 (provision completeness + GDPR tooling mig 000186: export Art. 15/20 provato con login reale federica→export tommaso 54 tabelle/37 con dati + accountability log; erasure legal-hold; consent ledger; retention che risolve D-59), D-09 F5 (Prometheus live su VM :9091 — la :9090 è dello stack legacy pre-esistente, non toccato). Coda: #65 NACE (mig 000187 FK NOT VALID), D-11 freeze brownfield (404 in PROD), 4 Dependabot HIGH, invariante twice-run migration riparato (000009 amendment + 000185 v2), regressione `pnpm dev` (tsx flag) fixata, test hardcoded me-career-tabs portato a derivazione-DB.

## Top priorities (next session)

1. **Mandato S1023 (Enzo)** — forense in 4 fasi SEQUENZIALI: debiti reali → DB capillare (incl. **bilinguismo IT/EN** da progettare) → coerenza semantica dati + seeding + **chiusura definitiva brownfield** → frontend per-superficie. **Leggere PRIMA**: `docs/kb/NEXT_SESSION_DB_FRONTEND_FORENSICS_KICKOFF.md` (standard operativo + regola "nessuna distinzione errori pre-esistenti/nuovi").
2. Code amministrative: PR Dependabot (run CI cancellate per priorità in S1023 — `gh run rerun` o rebase) · refresh dati twin linux-pc (`clone-vm-db.sh`, clone di giugno — causa del falso-rosso me-career-tabs).

## Open questions (autorità *cosa* = Enzo)

- **Doc-tank**: sostituzione `docs/` col clone SOLO su richiesta diretta (regola S1023); tank sincronizzato a ogni sessione (delta S1023 propagato).
- **NACE 920 orfani**: RISOLTO tecnicamente (FK prospettico + eccezione documentata, mig 000187) — se vorrai il backfill livelli 1-4 dello scheme ATECO legacy è un task dati separato.
- WAIT-INPUT invariati: **#4** pricing · **#8** app-password Outlook · **#16** SuccessFactors · **#52** SSO IdP.

## Verification (next session)

```bash
git log origin/main..HEAD --oneline               # 0 dopo il push handoff
python docs/kb/tools/handoff_lint.py              # OK atteso
ls db/migrations/*.sql | tail -1                  # 000187
curl -s -o /dev/null -w "%{http_code}" https://www.heuresys.com/login   # 200
python docs/kb/tools/session_start.py             # menu + salute
```
