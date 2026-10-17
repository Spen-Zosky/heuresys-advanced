# 263 — La giunzione con il pacchetto del datastore

> **item**: #263 · **priorità**: P1 · **stima**: ~0,25 sessione (portare le tre date a tipo vero)
> **stato**: IN CORSO
> **nasce-da**: decisioni di Enzo dell'11 ottobre 2026 (forme A1-A11 confermate, caricatore nel repository). Esito del mandato W0-A1: `.programmi/esiti-onda0/W0-A1.md`.

## Fasi

- [x] **F1 — Classificazione della direzione del dato delle 29 tabelle dentro la `000454`, con le due colonne del datastore** — FATTO 2026-10-11 · `ci-rehearsal.sh` e `prova-idempotenza.sh` verdi sul gemello (427 migrazioni, sentinelle 53/53 a zero), commit `8307debe`
- [x] **F2 — Caricatore del pacchetto nel repository (`db/scripts/pacchetto/`)** — FATTO 2026-10-11 · carica e rilegge 257 percorsi su 257 senza differenze su una copia usa-e-getta (`.programmi/esiti-onda0/prova-giunzione/rileggi.json`)
- [ ] **F3 — Applicare la `000454` e la `000455` alla produzione** — di Enzo (rilascio): `pnpm db:migrate:vm` dal deploy armato, poi `scripts/verifica-deploy.sh`
- [x] **F4 — FATTO 2026-10-17 (PE-3, migrazione 000456, inversa in `db/scripts/pacchetto/inversa-000456.sql`, prova `prova-000456.sh`) — Portare a `date` e `timestamptz` le tre colonne della `000454` tenute come testo (RD-09: `decorrenza`, `validoDal`, `creatoIl`), con il caricatore aggiornato** — da fare, non in questo ciclo
