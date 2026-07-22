# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-07-22 (S1026 — batch P1: 8 item chiusi + fix coerenza #70 + E2E prod verde).

> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`.

## Last session brief (S1026)

Batch autonomo P1 end-to-end (mandato Enzo "P1→P2→P3+debiti, commit per fase"): **8 item P1 CHIUSI** — #61 RBAC hygiene · #68 Fase-4 P2 (label-layer enum ~55 domini + fix codici tecnici + purge residui test) · #24 ADR-0027 F4 (asse funzionale completo, matrice cross-tree) · #34 B3 (primo flusso approvativo business: richiesta ferie ESS end-to-end con effect handler + pagina `/me/time-off`) · #46 D1 (import legacy possession ESEGUITO + `/me/skills` sulla possession) · #55 F1 (UI Capability essenziali su `/org-director`) · #51 E1 (whistleblowing: custode reale designato + canale pubblico + console) · #42 C4 (retrofit paginazione + shared-types, 4 gap di contratto registrati). Più: fix coerenza #70 (mig 000204 — utenti riattivati col mandato, stop rincorsa con 000188). E2E prod: 10 rossi triagiati tutti a causa radice → **tutta verde + 1 skip motivato (#8)**. Il pattern trasversale della sessione: register/doc STALE vs codice (backend spesso già pronti, il collo era il consumo frontend) — attese ora derivate dal reale. **Nota macchina locale**: `MFA_ENFORCEMENT_ENABLED` riportato a `true` nell'`.env` (il seam S989 spento accecava le spec MFA E2E). Spostamento manuale di 18 doc storici in `docs/kb/xtras/` (azione Enzo) committato fedelmente in chiusura.

## ⚠ Top priorities (next session)

1. **Proposte Cowork in inbox** — 2 proposte PENDING in `docs/kb/COWORK_INBOX.md` (asse professione ISCO-08/CP2021 · gate copertura traduzioni EN): **Enzo istruirà come procedere** (sua indicazione esplicita S1026 — NON processarle d'iniziativa).
2. **#47 D2 — engagement history import** (~1 sessione, P1, unico P1 residuo) — residuo MISURATO nel register: import storico legacy multi-dominio sul modello `import-d1-user-skills.sh` + registrazione wave-2; il fix dual-shape e il flight-risk multi-fonte sono GIÀ live.
3. **#72 Audit per-user — dimensioni residue** (~1 sessione, P1) — metodo in `docs/kb/db-forensics/USER_ROLE_COHERENCE_2026-07-22.md` §4.

## Open questions (autorità *cosa* = Enzo)

- **Proposte Cowork** (sopra) — in attesa delle istruzioni di Enzo nella fresh session.
- **Wave-3 (#17)** — sblocca il Blocco E Fase 3. In HOLD.
- WAIT-INPUT invariati: **#4** pricing · **#8** app-password Outlook (l'E2E EMAIL_OTP resta skip finché non arriva) · **#16** SuccessFactors · **#52** SSO IdP.

## Verification (next session)

```bash
git log origin/main..HEAD --oneline               # 0 dopo il push handoff
python docs/kb/tools/handoff_lint.py              # OK atteso
ls db/migrations/*.sql | tail -1                  # 000205
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT count(*) FROM sys.sys_user_skills"  # 1355 (import D1)
python docs/kb/tools/session_start.py             # menu + salute
```
