# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-21 (S1001 — infra: design handoff-rigor implementato end-to-end + close-flow live).

> **Vista rapida** (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui. Menu generato da `docs/kb/tools/build_menu.py` (P2).

## Last session brief (S1001 — infra pura: handoff-rigor completo)

Sessione di infrastruttura (nessun modulo business). **Verifica** del design `docs/superpowers/specs/2026-06-20-handoff-rigor-and-hold-lane-design.md` → era un *subset pragmatico*; tutti i gap rilevati sono stati chiusi e gli enhancement §11 implementati. **Consegne**: `handoff_lint.py` portato a vocabolario-completo (D1-D4·S1-S2·H1-H2·A1-A2) e **bloccante di default**, con H2 esteso alle sezioni attive del backlog (section/block/terminal-aware); skill `handoff` → v5.1 (gate bloccante + push rebase-safe); **§11 P1-P9 tutti**: register canonico (`🗂 Action register`), `build_menu.py`, trigger valutabili, session-journal + `journal-append.sh`, CI `state-lint.yml`, boot reality-check, INTERRUPTED, age+stale-TTL; **§12** `vm-deploy` reso entrypoint unico (rende TUTTE le unit con `SERVICE_USER`, fix guard placeholder) + test close-propagate; **§13** `project_memory` parity nel verify. **Close-flow live** eseguito (exit 0): VM + linux-pc PROD ri-deployati e verde (`/readyz` + `/login 200`), skill v5.1 + memorie propagate. Primo tentativo fail-loud su un bug del guard (PROD intatta) → fixato e ri-eseguito. **Decisione Enzo**: `claude-mem` enabled = **false** (applicato su vm+linux-pc; mac alla prossima accensione). Design → `§14 IMPLEMENTED`. Granulare → `SOT_STATE.md §Delta S1001`.

## Top priorities (next session)

1. **Gap#1 follow-up (CLASS-A, non bloccanti)** — dal register `ACTIVE` P3: grant `ORG_DIRECTOR` reale · Porta-1 RACI drill-down · rubrica Maturity rivedibile · arricchimento UI porte (~2-4h, doc `SOT_STATE.md §Delta S999`).
2. **Blocked-on-Enzo** — **#8 EMAIL** (WAIT-INPUT): app-password Outlook → attiva EMAIL_OTP + digest live. (#16 SuccessFactors WAIT-INPUT, de-prioritizzato.)

> Igiene ecosistema ✅ chiusa S1001: D-40 (`enabledPlugins` di Windows ri-applicati post-reinstall → `claude-mem=false` durevole) + D-41 (`project_memory` verify resiliente con sentinel) RISOLTI; verify ecosystem **CLEAN** su vm+linux-pc+mac.

## Open questions (autorità *cosa* = Enzo)

- **Go-to-market**: scope/forma ora che il prodotto è dimostrabile (Gap#1 live PROD).
- **RACI di produzione** + **holder reale ORG_DIRECTOR**: dati business che solo tu fornisci (engine/UI pronti).

## Verification (next session)

```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline    # 0 dopo handoff push S1001
python docs/kb/tools/handoff_lint.py                           # handoff-lint OK (0 fail)
python docs/kb/tools/build_menu.py --no-db                     # menu generato dal register
bash scripts/test/run-shell-tests.sh                          # shell suite verde (incl. close-propagate)
```
