# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-06 (S969).

> **Vista rapida** dello stato di lavoro (priorità · open questions). Lo **snapshot granulare del sistema** (versioni, DB/API/web/CI counts, architettura, migration) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Entrambe le viste sono governate dalla skill `handoff` — **domini disgiunti, nessun numero duplicato qui**.

## Last session brief (S969 — ultracode)

Aggregato 7-item, aperto con una **discovery 7-agenti evidence-based** prima di toccare codice (i note del backlog erano in parte stale). **Shippati 3 sviluppi + 1 cleanup, tutti pushati su `origin/main`, CI 7/7 verde**: **B-20b** zod4 deprecation sweep completo (644 site, forme v3→canoniche, behavior-preserving su zod4); **BI ① P2-ext** vista `/analytics/overtime` full-stack (request/approval lifecycle, distinta dalle ore lavorate attendance); **B-23 next 16** (15.5.19→16.2.7 web+showcase, `middleware`→`proxy`, eslint flat-config migrato, 2 fix react-hooks) con prod-smoke + Playwright-smoke CI verdi; + prune del mirror showcase stale. **F7 split/extract** = verificato già-fatto/cosmetico (DashboardShell lib-owned; mock = fixture showcase intenzionale) → nessun codice. **4 item restano decisione-tua** (sotto): non autonomi, richiedono autorità semantica/prodotto. **Mac + VM allineati a `2e42c2a`; next 16 + vista overtime deployati in PROD** (`heuresys.com` verde).

## Top priorities (next session)

1. **WHAT-decisions (4 — decisione Enzo, sbloccano lavoro reale)** — dettaglio + raccomandazioni in `SOT_BACKLOG.md`:
   - **#9 bridge job→position** (sblocca 3 tabelle reconciliation in un colpo — massima leva)
   - **#5 SDBI B-10b** (3 milestone di modellazione: Mentorship→Surveys→PredictionsML, ~22-27h)
   - **#2 LOOKUP_FK `sys_process_kpi_templates`** (crosswalk semantica ~25 righe **o** chiudi out-of-scope)
   - **#8b category heatmap** (mini data-task: mappare le 31 skill referenziate→categoria, **o** defer)
2. **② AI P1 backfill** — gated su `VOYAGE_API_KEY` nel `.env` VM (azione Enzo); voyage-3.5 person→occupation + skill→skill. ~3-4h.

## Open questions

- `VOYAGE_API_KEY` nel `.env` VM → sblocca ② AI P1 (azione Enzo).
- Le 4 WHAT-decisions sopra: quale direzione aprire?

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
gh run list --limit 6                                        # main CI verde
cd apps/web && pnpm typecheck && pnpm lint                   # verde (next 16)
```
