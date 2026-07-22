# Occupations dataset (ISCO-08 + CP2021, bilingue) — asse PROFESSIONE

**Provenienza** (deliverable Cowork 2026-07-22, pacchetto `cli-next.zip`; proposta in `docs/kb/COWORK_INBOX.md` entries 2026-07-22, recepita dal CLI in mig 000206-000208):

- **ISCO-08** (619 nodi, L1-4 = 10/43/130/436): struttura ILO; **titoli IT** harvestati dall'**ESCO API** (`ec.europa.eu/esco/api`, walk dell'albero ISCO in `language=it`, 619/619, 0 errori); **EN** da ILO/ESCO (`source=HARVEST`, autorevoli).
- **CP2021** (1502 nodi, L1-5 = 9/40/130/510/813, 813 unità professionali): classificazione professioni **Istat/INAIL** (richiesta INPS/Uniemens da 05/2025, abbinata ad ATECO 2025); IT canonico ufficiale; **EN generate via LLM** (`source=LLM` — CP2021 non ha EN ufficiale), validate 1502/1502 (0 mancanti/extra/vuoti/duplicati).

## File (VERSIONATI — a differenza del dump ESCO, non sono ri-scaricabili così come sono)

| File | Ruolo | Righe |
|---|---|---|
| `occupation_classifications_seed_it.csv` | BASE IT-canonico in-row (`scheme,code,parent_code,level,name`) | 2121 |
| `occupation_reference_translations_en.csv` | OVERLAY EN per `sys_reference_translations` (`entity_ref = <scheme>:<code>`) | 2121 |

## Load

```bash
# dalla root del repo (idempotente, transazionale, assert fail-loud)
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -f db/scripts/populate-occupation-classifications.sql
```

Ordine: mig `000206` (DDL) → questo loader (BASE → OVERLAY con resolve `entity_id` → watermark `ISCO_08`/`ISTAT_CP2021`) → gate `SELECT * FROM sys.v_reference_translation_coverage WHERE missing > 0` (mig 000207) vuoto per l'asse professione.

Validazione strutturale pre-commit (2026-07-22): 0 duplicati `(scheme,code)`, 0 orfani gerarchici (`parent_code` sempre risolto), radici 10 ISCO + 9 CP, match seed↔overlay 1:1 esatto.
