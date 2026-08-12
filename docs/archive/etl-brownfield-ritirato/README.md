# ETL brownfield — ritirato, non cancellato

> **#170, S1055 (2026-08-12).** Qui dentro c'è l'attrezzatura dell'ingestione legacy
> *wave-1 / wave-2*, che scriveva nello schema **`brownfield`**. Quello schema **non esiste
> più**: `#164 F4` (migrazione `000297`) l'ha ritirato, traslocando in `reference_sync` le tre
> tabelle ancora vive — `source_exports`, `import_runs`, `source_watermarks`.

## Perché archiviare invece di cancellare

La decisione è **ritirare**, coerente con `#164 F3/F4`: questi file sono l'ingresso di una
funzionalità che non c'è più, e nessuno ha motivo di rilanciarli. Ma **archiviare non è
cancellare** — la differenza qui è concreta e non formale:

- il resoconto di *come* il dato legacy è entrato in `sys.*` resta leggibile, ed è la sola
  documentazione di provenienza di parecchie tabelle;
- il ritiro è **reversibile** con un `git mv` all'indietro, senza ricostruire nulla;
- cancellare file richiede la conferma esplicita di Enzo, e non serviva chiederla per
  ottenere il risultato che la voce voleva.

Il difetto che `#170` doveva chiudere era preciso: **file eseguibili che nominano uno schema
inesistente e fallirebbero se qualcuno li lanciasse**. Fuori dall'archivio quel numero è ora
**zero**, misurato — contro i **39** di partenza.

## Cosa c'è dentro

| Cartella | Contenuto | Perché è qui |
|---|---|---|
| `scripts/` | 8 eseguibili: `import-d2-engagement.sh`, `import-d5-timeline.sh`, `import-e4-salary-bands.sh`, `brownfield-wave-1-preflight.{sh,ps1}`, `generate_wave1_column_mappings.mjs`, `generate_wave1_seeds.mjs`, `run-wave1-fullscale.mjs` | scrivevano in `brownfield.source_exports` / `source_tables` / `table_mappings` |
| `seeds-brownfield-tree/` | l'albero `db/seeds/brownfield/` (wave1, wave2, sdbi) | 1.383 occorrenze dello schema ritirato |
| `seeds-sdbi-template-tree/` | il modello SDBI, prima in `db/seeds/sdbi/_template/` | **unico caso non storico**: era un modello *destinato a essere copiato*, quindi avrebbe prodotto file nuovi rotti |
| `SDBI_RUNBOOK.md` | prima `docs/sdbi/RUNBOOK.md` | procedura corrente che istruiva a copiare quel modello e citava tabelle traslocate: viveva fuori da `docs/archive/` pur descrivendo un impianto morto |
| `seeds-reconciliation/` | 6 seed su 56: `04_registry`, `05_career_paths`, `08_bonus_pools`, `29_objective_reward_rules`, `43_registry_process_kpi_templates_exclude`, `55_survey_templates` | contengono SQL **eseguibile** contro tabelle rimosse, non commenti. Verificato: nessuno script li invoca |

## Due cose che la misura ha smentito, e vanno sapute

**1. Il timer di scraping NON è qui, ed è giusto così.**
`deploy/systemd/heuresys-advanced-scraping.timer` nominava `brownfield.source_watermarks` e
sembrava materiale da ritirare. È invece **installato e abilitato** sulla VM (verificato con
`systemctl list-unit-files`): è la sonda settimanale della tassonomia ESCO, viva. Nominava lo
schema ritirato **solo in un commento**, che è stato riallineato a `reference_sync`. Spostarlo
avrebbe spento una funzione attiva.

**2. Lo scope della voce era sottostimato.**
Il register parlava di «`import-d2`, `import-d5`, `import-e4`» — **tre** file. Gli eseguibili
che nominano lo schema sono **otto**, e all'appello mancavano anche il template SDBI, il suo
runbook e sei seed di riconciliazione: **39 file** in tutto, contro i tre dichiarati.

## Se serve rimetterli in servizio

Non basta spostarli indietro: andrebbero **ripuntati** da `brownfield.*` a `reference_sync.*`
per le tre tabelle sopravvissute, e il resto dello schema non esiste più in nessuna forma.
Prima di farlo, leggere `db/migrations/000297_*` e ADR-0035 (ritirare emenda la fonte, non
cancella a valle).
