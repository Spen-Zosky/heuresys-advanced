# 263 — La giunzione con il pacchetto del datastore

> **item**: #263 · **priorità**: P1 · **stima**: ~0,25 sessione (portare le tre date a tipo vero)
> **stato**: IN CORSO
> **nasce-da**: decisioni di Enzo dell'11 ottobre 2026 (forme A1-A11 confermate, caricatore nel repository). Esito del mandato W0-A1: `.programmi/esiti-onda0/W0-A1.md`.

## Fasi

- [x] **F1 — Classificazione della direzione del dato delle 29 tabelle dentro la `000454`, con le due colonne del datastore** — FATTO 2026-10-11 · `ci-rehearsal.sh` e `prova-idempotenza.sh` verdi sul gemello (427 migrazioni, sentinelle 53/53 a zero), commit `8307debe`
- [x] **F2 — Caricatore del pacchetto nel repository (`db/scripts/pacchetto/`)** — FATTO 2026-10-11 · carica e rilegge 257 percorsi su 257 senza differenze su una copia usa-e-getta (`.programmi/esiti-onda0/prova-giunzione/rileggi.json`)
- [x] **F3 — Applicare la `000454` e la `000455` alla produzione** — FATTO 2026-10-25 con il rilascio `bb97ea3` (DEPLOYATO, `.handoff/STATE.md`) · misura del 2026-10-30: `git merge-base --is-ancestor 1a6231b origin/prod` vero, con `origin/prod` = `0c3088c3`; il commit `1a6231b` porta `000454`, `000455` e `000456`
- [x] **F4 — Portare a `date` e `timestamptz` le tre colonne della `000454` tenute come testo (RD-09: `decorrenza`, `validoDal`, `creatoIl`), con il caricatore aggiornato** — FATTO 2026-10-17 (PE-3) · migrazione `000456`, inversa `db/scripts/pacchetto/inversa-000456.sql`, prova `db/scripts/pacchetto/prova-000456.sh`; in produzione dal 2026-10-25 con `bb97ea3` (stessa misura di F3)
- [ ] **F5 — Provare la giunzione con il pacchetto v0.3 vero della banca** — attende il datastore, che non ha ancora depositato il pacchetto con M2, M3, M4 e M6 (`docs/kb/SOT_BACKLOG.md`, voce #263, nota del 2026-10-29)
