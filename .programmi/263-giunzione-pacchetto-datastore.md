# #263 — La giunzione con il pacchetto del datastore (piano, W0-A1)

Origine: decisioni di Enzo dell'11 ottobre 2026 (forme A1-A11 confermate, caricatore nel repository). Esito del mandato W0-A1: `.programmi/esiti-onda0/W0-A1.md`.

| id | cosa | chi | fatta quando | stato |
|---|---|---|---|---|
| 263.1 | classificazione della direzione del dato delle 29 tabelle dentro la `000454`, con le due colonne del datastore | Claude | `ci-rehearsal.sh` e `prova-idempotenza.sh` verdi, sentinelle a zero | fatta (2026-10-11) |
| 263.2 | caricatore del pacchetto nel repository (`db/scripts/pacchetto/`) | Claude | carica + rilegge 257 percorsi su 257 senza differenze, su copia usa-e-getta | fatta (2026-10-11) |
| 263.3 | applicare la `000454` e la `000455` alla produzione | Enzo (rilascio) | `pnpm db:migrate:vm` dal deploy armato, poi `verifica-deploy.sh` | in attesa di Enzo |
| 263.4 | oggetti RD-09 della `000454`: `decorrenza`, `validoDal`, `creatoIl` sono testo | Claude | portati a `date` e `timestamptz` prima del rilascio, con il caricatore aggiornato | da fare, non in questo ciclo |
