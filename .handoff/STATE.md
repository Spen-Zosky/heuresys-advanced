# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-21 (S1002 — Gap#1 follow-up CLASS-A: sotto-task eseguibili chiusi live).

> **Vista rapida** (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui. Menu generato da `docs/kb/tools/build_menu.py` (P2).

## Last session brief (S1002 — Gap#1 follow-up CLASS-A)

Sessione di prodotto leggera sull'unico item ACTIVE del menu (Gap#1 follow-up). **Tre dei quattro sotto-task chiusi live su dati reali** (il quarto in HOLD), tre commit atomici: **(b)** Porta-1 RACI drill-down nella console process-owner (endpoint `by-process` già esistente → wiring UI con badge RACI OWNER·A/CONTRIBUTOR·R/CONSULTED·C/INFORMED·I); **(a)** grant `ORG_DIRECTOR` holder-of-record = **Valentina Conti** (HR Director, manager Divisione HR — best-fit sulla struttura org reale; grant **semantico**, non access-change: vedeva già la Porta-2 via HRMS_MANAGER), mig `000150` idempotente + chain `migrate.sh` verde; **(d)** radar maturità nella console org-director (`CapabilityRadar` @heuresys/ui, 5 dimensioni dai `criteria[]` live, no nuovo endpoint). Gate: **E2E `gap1-consoles` tutto verde** (Node22 wrapper), typecheck web + eslint puliti, i18n parity verde. **Residuo (c)** rubrica `rubric_version` rivedibile = **HOLD** (basso valore, scope-decisione; la v1-full l'hai già scelta tu). **Post-handoff**: sbloccato il HOLD **#5/#11 RACI di produzione** — Claude ha proposto il mapping OU↔processo, Enzo ha approvato → seed riscritto come SoT dichiarativa con **105 assegnazioni reali** (23 processi, 1 OWNER ciascuno), fix test D-23, live sul DB VM (PROD già aggiornata), integration + E2E verdi (`9ce9a92`). La Porta-1 RACI drill-down ora rende la mappa reale completa. Granulare → `SOT_STATE.md §Delta S1002`.

## Top priorities (next session)

1. **#4 go-to-market** — Gap#1 ora più dimostrabile (console arricchite live in PROD); scope/forma del go-to-market è autorità *cosa* = Enzo.
2. **Blocked-on-Enzo** — **#8 EMAIL** (WAIT-INPUT): app-password Outlook → attiva EMAIL_OTP + digest live. (#16 SuccessFactors WAIT-INPUT, de-prioritizzato.)

> Il backlog ACTIVE autonomo è **esaurito**: l'unico item ACTIVE (Gap#1 follow-up) è chiuso al 75%, il residuo (c) è in HOLD. Tutto il resto è HOLD/WAIT-INPUT → si sblocca con una tua decisione di prodotto o un tuo input.

## Open questions (autorità *cosa* = Enzo)

- **Go-to-market**: scope/forma ora che il prodotto è dimostrabile (Gap#1 live PROD).
- **RACI di produzione** + **holder reale `ORG_DIRECTOR`**: il grant S1002 nomina Valentina come holder-of-record (best-fit su dati); se l'org-director reale è un'altra persona, fornisci il nome.

## Verification (next session)

```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline    # 0 dopo handoff push S1002
python docs/kb/tools/handoff_lint.py                           # handoff-lint OK (0 fail)
python docs/kb/tools/build_menu.py --no-db                     # menu generato dal register
cd apps/web && pnpm exec eslint "src/app/(authenticated)/org-director/page.tsx"   # clean
```
