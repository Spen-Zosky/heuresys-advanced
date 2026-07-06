# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-07-06 (S1016 — atlas conoscenza + portafoglio dev-lines + #25 live).

> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti. Menu generato da `docs/kb/tools/build_menu.py`.

## Last session brief (S1016)

Nata l'**infrastruttura di conoscenza** per il brainstorming: atlas cross-layer interrogabile (`docs/kb/tools/build_atlas.py` → `docs/kb/atlas/{ATLAS.md,atlas.yaml}`, idempotente, ~7s; **SoT** — graphify/wiki-graph = viste parallele mai autoritative) + full-sweep 19 agenti distillato in `ATLAS_CURATED.md` (193 rilievi con evidenza; drift documentali censiti in §11, incl. CLAUDE.md "11 ruoli"→12 / `^0.1.1`→`^0.1.9` / PET ritirato, e Ledger pre-Gap#1: VRIO/OHI/Ranker in realtà SBLOCCATI). Grafo graphify rigenerato full-codebase (top-up semantico pendente → `graphify-out/PENDING_SEMANTIC_TOPUP.md`, register #41). Prodotto: **7 dossier** `docs/product/DEVELOPMENT_LINES_{A..G}` (41 linee, webapp mappate); Enzo ha selezionato **serie A+B** → register **#25-#40** (14 ACTIVE + 2 GATED). **#25 SHIPPED live**: ponte posizione→learning (endpoint sub-resource dedicati + pagina rinnovata su dati reali), integration + E2E + CI tutti verdi, deploy VM, endpoint verificati su www (numeri → SOT_STATE §Delta S1016). Fix: `build_menu.py` UTF-8, retry psql in atlas.

## Top priorities (next session)

1. **#27 evidence layer** (P1, ~8-12h, dossier A §L2) — rende dimostrabile il wedge explainability/AI-Act; si rafforza con #28 trust-ledger (~4h, accoppiabili).
2. **#26 vita dei goal** (~6-10h) e/o **#34 primo approval handler** (~2-4h) — P1 del register, componibili.
3. **pricing page GTM** (#4, ACTIVE — autorità *cosa* = Enzo: servono numeri prezzi/tier).

## Open questions (autorità *cosa* = Enzo)

- **Serie C-G** dei dossier development-lines: quali/quando convertire in register (solo A+B selezionate finora).
- **Sblocchi GATED**: #39 EMAIL (app-password Outlook = #8) · #40 free-text search (ok all'uso runtime della key Voyage).
- **F4 activity entities** (HOLD #24) · **pricing** numeri tier.

## Verification (next session)

```bash
git log origin/main..HEAD --oneline                                   # 0 (tutto pushato)
python docs/kb/tools/build_atlas.py                                   # atlas ~7s, idempotente
cd apps/api && pnpm exec vitest run test/positions-learning.integration.test.ts   # 5/5 (#25)
curl -s -o /dev/null -w "%{http_code}\n" "https://www.heuresys.com/api/v1/positions/00000000-0000-4000-8000-000000000000/learning-requirements"   # 401 = #25 live
python docs/kb/tools/handoff_lint.py                                  # OK
```
