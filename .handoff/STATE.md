# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-06 (S970).

> **Vista rapida** dello stato di lavoro (priorità · open questions). Lo **snapshot granulare** (versioni, DB/API/web/CI counts, architettura, migration) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero duplicato qui.

## Last session brief (S970 — ultracode)

Aggregato 7-item affrontato **un-punto-alla-volta**. Chiusi e pushati **4 sviluppi** + il reconciliation umbrella a stato terminale: **#1** bridge job→position (leva KPI via legacy `tenant_job_kpis`, employee-mediated I14; leva successione **deferita** — copertura magra, gap-esplicito); **#4** LOOKUP_FK `sys_process_kpi_templates` chiuso **out-of-scope** (B-42 — tassonomia v5-native vs legacy multi-industria, card+registry → EXCLUDE); **#5** skill-category (+7ª categoria *Technical/Domain Expertise* + 31 skill mappate → sblocca heatmap **#8b**); **#2·m1 SDBI Mentorship** — schema 4 tabelle + modulo API **full-CRUD** (/v1/mentorship/*) + import RTL, **prima delle 3 milestone B-10b**. Discovery+design evidence-based via workflow (adversarial-verified). Mac+VM allineati a `origin/main`, **vm-deploy eseguito** (modulo mentorship live; DB già migrato+seedato via tunnel). Granulare → `SOT_STATE.md`.

## Top priorities (next session)

1. **#2·m2 Surveys + #2·m3 PredictionsML** — le 2 milestone B-10b residue, stesso ciclo `design→spec→OK→implementa` di m1 (Surveys ~7-9h; PredictionsML ~8-10h, MED-HIGH: serve regola di derivazione human-authored). Dettaglio `SOT_BACKLOG.md` B-10b.
2. **② AI P1 backfill** — ⛔ gated su `VOYAGE_API_KEY` nel `.env` VM (azione Enzo). voyage-3.5 person→occupation + skill→skill. ~3-4h.
3. **#7 MVP-4** (Wave2 · MFA multi-kind · Mobile+WCAG) · **#8 cap ③④⑤** (data-mining/CMS/scraping, design da zero) — roadmap, decisione Enzo.

## Open questions

- `VOYAGE_API_KEY` nel `.env` VM → sblocca ② AI P1 (azione Enzo).
- B-10b: confermare la sequenza Mentorship→**Surveys**→PredictionsML, o riprioritizzare le 2 residue?

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
gh run list --limit 6                                         # main CI verde
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT resolved_status,count(*) FROM sys.v_reconciliation_status GROUP BY 1"
```
