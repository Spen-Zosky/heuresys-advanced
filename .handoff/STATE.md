# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-07-23 (S1027 — proposta Cowork asse professione IMPLEMENTATA + bilinguismo dati 100% + batch debiti P1-P3).

> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`.

## Last session brief (S1027)

Mandato Enzo "leggi cli-prompt.md e agisci di conseguenza, poi debiti P1/P2/P3". **Proposta Cowork asse professione VALUTATA e IMPLEMENTATA** con deviazioni deliberate (numerazione reale 000206-208, CHECK strict, VIEW no-FK, seed CSV committati al posto dei connettori HTTP): catalogo ISCO-08+CP2021 bilingue completo + modulo API `/v1/occupation-classifications` + gate copertura i18n (000207). **Bilinguismo DATI al 100% registry-wide** (healing 772 EN + 477 IT + 16 permessi conformati via 000209; gate: 25 campi, 0 gap/0 anomalie/0 orfani — ora nel dashboard di boot). **Debiti**: D-57 (allowlist deny-by-default TENANT_ADMIN, 000210+guardia) · D-63 (retention GDPR operativa, prova live + timer 03:00) · D-60 (canale rotazione secret) · D-64 (unit layer fondato) · D-65, D-66, D-67 e D-68 chiusi o gestiti · D-55 istruito (x-request-id) · D-70 e D-71 smistati (#74, #75). **Register riparato**: blocco orfano #67 mascherava lo stato P1 di #72 nel menu. Le 4 entry COWORK_INBOX 2026-07-22 → `[RICONCILIATA]`. Landing D-68 invertita (custodian → /dashboard, fixture E2E allineata). Suite complete verdi in chiusura.

## ⚠ Top priorities (next session)

1. **#47 D2 — engagement history import** (~1 sessione, P1) — residuo MISURATO nel register: import storico legacy sul modello `import-d1-user-skills.sh` + registrazione wave-2; fix dual-shape e flight-risk multi-fonte GIÀ live.
2. **#72 Audit per-user — dimensioni residue** (~1 sessione, P1) — metodo in `docs/kb/db-forensics/USER_ROLE_COHERENCE_2026-07-22.md` §4.
3. **#73 NACE legacy — verifica currency vs Rev 2.1** (~0.5 sessione, P3, nuovo — collaterale asse professione): verifica autonoma via fonti Eurostat/RAMON; l'eventuale deprecazione scheme base è decisione prodotto.

## Open questions (autorità *cosa* = Enzo)

- **Wave-3 (#17)** — sblocca il Blocco E Fase 3 (#69). In HOLD.
- **Crosswalk ISCO↔CP2021** — la tabella `sys_occupation_classification_mappings` è pronta ma vuota: serve la corrispondenza ufficiale Istat (procurabile; decidere se/quando).
- WAIT-INPUT invariati: **#4** pricing · **#8** app-password Outlook (EMAIL_OTP resta skip) · **#16** SuccessFactors · **#52** SSO IdP.

## Verification (next session)

```bash
git log origin/main..HEAD --oneline               # 0 dopo il push handoff
python docs/kb/tools/handoff_lint.py              # OK atteso
ls db/migrations/*.sql | tail -1                  # 000210
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT count(*) FROM sys.sys_occupation_classifications"  # 2121 (asse professione)
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT count(*) FROM sys.v_reference_translation_coverage WHERE missing <> 0"  # 0 (bilinguismo dati)
python docs/kb/tools/session_start.py             # menu + salute
```
