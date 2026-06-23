# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-23 (S1005 — cleanup doc is_synthetic + verifica users-page + Wave-3 L1 già-fatto).

> **Vista rapida** (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui. Menu generato da `docs/kb/tools/build_menu.py`.

## Last session brief (S1005 — batch #18/#19/#17 delegato da Enzo)

Sessione doc + verifica (nessuna migration nuova). (1) **#18 doc-cleanup `is_synthetic`** (`c3ac0cc`, **D-44 RISOLTO**): 8 doc design/plan allineati a ADR-0026/mig 000154 — colonna `user_is_synthetic` rimossa, `SYNTHETIC_REFERENCE`→`STANDARD` (import legacy = persone reali) / `GENERATED_INCUMBENT` (placeholder materializer), vista `v_synthetic_user_flag_consistency` tolta dalle liste live (DDL storico con nota di ritiro). Grep verde; marginali fuori-scope segnalati (wave_runners ×2, due-diligence/WS-T5). (2) **#19 users-page** verificata **LIVE**: login reale `admin@heuresys.com` → `GET /v1/users` 200, `type:STANDARD`, zero `is_synthetic`; DB census colonna assente + 162 STANDARD; codice zero-ref. Prod-E2E UI coperta da CI (non rieseguita, P3). (3) **#17 Wave-3 L1**: discovery → **già eseguito** in S987/S988 (mig 000110 remap + 000111 import chiara.spenuso); premessa menu stale (dossier pre-S987). Nessuna scrittura su prod (R14). Register #17 → residuo L2/L3 multi-industry, resta HOLD (decisione Enzo "solo aggiorna register"). 2 commit, register+SOT aggiornati.

## Top priorities (next session)

1. **#4 go-to-market — prossimo deliverable** (autorità *cosa* = Enzo): candidato **pricing page** (serve numeri prezzi/tier) o altro. Keystone del programma.
2. **TODO doc (minore)**: aggiornare `docs/kb/POST_V1_ROADMAP_DOSSIER.md §1.B` — è pre-S987 e descrive ancora il Wave-3 L1 (fix HS) come da-fare, ma è già stato eseguito (rischio: una sessione futura ripropone L1).
3. **#8 EMAIL dormiente** (WAIT-INPUT): app-password Outlook → EMAIL_OTP + digest live.

## Open questions (autorità *cosa* = Enzo)

- **Forma del prossimo deliverable GTM**: pricing page (serve i suoi numeri) vs altro.
- **Strategia multi-industry (#17 L2/L3)**: onboardare i tenant legacy non-banking SmartFood/EcoNova nella tassonomia banking-native (multi-industry) vs restare single-industry reference. Solo se/quando Enzo lo decide.

## Verification (next session)

```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline    # 0 dopo handoff push
python docs/kb/tools/handoff_lint.py                           # OK (0 fail)
# #18: zero residui non-storici nei doc allineati
grep -rl "user_is_synthetic\|SYNTHETIC_REFERENCE" docs/db docs/brownfield docs/security docs/MVP_4_ROADMAP.md docs/BOOTSTRAP_EXECUTION_PLAN.md  # solo menzioni-di-ritiro
# #17 L1 già fatto (mapping corretto + 4 utenti HEURESYS)
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT legacy_id, canonical_tenant_id FROM brownfield.tenant_id_mappings WHERE legacy_id LIKE 'd5855519%'"  # → HEURESYS 8bc5bc59
```
