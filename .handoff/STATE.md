# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-07-18 (S1020 — Serie-A read-exposure residua CHIUSA: #33/#32/#29 shipped DoD-complete).

> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md` (Delta S1020). Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Piano batch → `docs/kb/PLAN_S1018_BATCH.md` · ripartenza wave → `docs/kb/RESUME_S1018_BATCH.md`.

## Last session brief (S1020)

**Serie-A read-exposure residua CHIUSA end-to-end**: i tre item ACTIVE che S1019 segnalava come ripresa #1 sono shipped DoD-complete (API + web + Playwright E2E su login persona reale + dati live): **#33** time-off/leave (+ESS, mig 000173), **#32** comp & reward read (estende il modulo compensation, riuso `compensation_intelligence:read` — nessuna migration), **#29** talent-review 9-box (mig 000174, 9-box derivata da `sys_talent_scores` — il fantasma `sys_nine_box_grid` non esiste). Commit atomici pushati; suite API completa verde (0 fail). Tutto org-gated (PERSONAL/COMPENSATION/EVALUATION via ADR-0027 F3). **Nessun deploy** (D-08: solo a W13) → PROD www ancora pre-batch. **claude-mem disabilitato** (worker crash al boot bloccava le Read; stub reversibile → D-56). Conteggi nel granulare (Delta S1020).

## Top priorities (next session)

1. **W3 Serie B** — #34 approval-handlers (primo flusso approvativo reale, ~2-4h/handler), #37 reward-gate-engine, #36 viz-versioning, #38 inbox-SSE, #35 observability.
2. **#24 F4** — asse funzionale/attività (ADR-0027, ~1-2 sessioni) per chiudere il modello bi-assiale.
3. Poi W4-W13 in ordine (RESUME doc). Deploy PROD SOLO a W13 (`vm-deploy.sh` protetto da D-08).

## Open questions (autorità *cosa* = Enzo)

- **Pricing page** (#4): numeri prezzi/tier — non forniti (pagina resta in attesa).
- **#8 app-password Outlook** → sblocca #39 EMAIL (WAIT-INPUT). **#52 E2 SSO**: serve client-id/secret IdP.
- **#16 SuccessFactors**: sandbox esterno (WAIT-INPUT).
- **claude-mem** (D-56): disabilitato — riattivare quando il plugin è aggiornato/riparato.

## Verification (next session)

```bash
git log origin/main..HEAD --oneline               # 0 (tutto pushato)
python docs/kb/tools/handoff_lint.py              # OK atteso
ls db/migrations/*.sql | tail -1                  # 000174 (DB già migrato)
python docs/kb/tools/session_start.py             # menu + salute (1 round)
```
