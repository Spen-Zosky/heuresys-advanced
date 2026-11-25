# Analisi dei cluster della storia RTL a 36 mesi

Le analisi di luglio 2026 da cui nascono le regole dei seed `db/seeds/storia36/` e dei controlli `db/scripts/verify-storia36.sql`. Stavano in `.storia36/analysis/` e sono state accorpate qui il 2026-11-25 con il riordino della documentazione, senza cambiarne il testo; i commenti dei seed e dei controlli puntano qui.

- `conventions.md`: convenzioni del repo per i deliverable della storia.
- `date-columns.md`: inventario e classificazione delle 513 colonne data (fonte dei controlli G1).
- `shapes-g2-g4.md`: forme esatte e intervalli dei dati per i controlli G2-G4.
- `c2-misura.md`, `c2-macchina-stati.md`: ciclo della performance.
- `c3-misura.md`: premio variabile.
- `c4-misura.md`, `c4-codice.md`: formazione.

Sono misure datate: i numeri si rimisurano con `bash db/scripts/storia36.sh custodia`. Lo stato del programma è in `.storia36/PROGRESS.md`.
