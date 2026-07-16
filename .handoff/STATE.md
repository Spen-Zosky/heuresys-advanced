# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-07-16 (S1018 — batch autonomo full-scope, **congelato per fresh session**).

> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md` (Delta S1018). Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. **Ripartenza batch → `docs/kb/RESUME_S1018_BATCH.md`** (autoritativo) + piano `~/.claude/plans/usa-superpowers-skills-tools-compressed-ocean.md`.

## Last session brief (S1018)

**Batch autonomo full-scope** (Enzo: "esegui tutte le attività pending, debiti, dossier; autonomo, senza presidio"). Piano W0-W13 (13 wave). **Congelato su richiesta di Enzo** per continuare in fresh session — ripartenza senza ripetizioni via `RESUME_S1018_BATCH.md`. **Nessun deploy** (scelta Enzo: deploy solo a W13) → PROD www gira ancora la versione pre-batch; tutto è pushato su `main` (HEAD `ee3b0558`), durevole.

**FATTO**: **W0** (register serie C-G→#42-#63; D-08 probe-gate+rollback; C4-mini paginazione; fix test-harness). **W1 Serie-A P1 completa**: #40 free-text search · D-54 inbox-orphans (**RISOLTO**, mig 000170) · #26 goal/OKR life · #27 evidence-layer ⭐ (mig 000172) · #28 trust-ledger ⭐ (mig 000171) · #30 gap-closure · #31 KPI-metrology — tutti API+web+E2E verdi. **RESIDUO**: #29/#32/#33 (Serie-A P2/P3) NON fatti + W3-W13.

## Top priorities (next session)

1. **Serie-A P2/P3 residua** — #29 talent-review (9-box), #32 comp-read, #33 time-off (ancora ACTIVE, blueprint nel piano W2).
2. **W3 Serie B** — #34 approval-handlers, #37 reward-gate-engine, #36 viz-versioning, #38 inbox-SSE, #35 observability.
3. Poi W4-W13 in ordine (RESUME doc). Deploy PROD SOLO a W13 (`vm-deploy.sh` ora protetto da D-08).

## Open questions (autorità *cosa* = Enzo)

- **Pricing page** (#4): numeri prezzi/tier — non forniti (pagina resta in attesa).
- **#8 app-password Outlook** → sblocca #39 EMAIL (WAIT-INPUT). **#52 E2 SSO**: serve client-id/secret IdP.
- **#16 SuccessFactors**: sandbox esterno (WAIT-INPUT).

## Verification (next session)

```bash
git log origin/main..HEAD --oneline                                   # 0 (tutto pushato)
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22
python docs/kb/tools/handoff_lint.py                                  # OK atteso
ls db/migrations/*.sql | tail -1                                      # 000172 (DB già migrato)
cd apps/api && pnpm exec vitest run test/goals-life test/evidence test/provenance test/gap-closure test/kpi-metrology test/inbox-consistency  # verdi (S1018)
```
