# db/seeds/storia36 — seed del programma "36 mesi di storia RTL"

Piano: `docs/superpowers/plans/2026-07-27-rtl-storia-36-mesi.md` · stato vivo: `.storia36/PROGRESS.md` · entrypoint: `bash db/scripts/storia36.sh {costruzione|custodia|avanzamento}`.

## Contratto di ogni seed

- **Idempotente** (twice-run → delta 0): `ON CONFLICT DO NOTHING` / guardie sui valori; la doppia
  esecuzione è provata e registrata in `staging.storia36_runs` (`twice_run_delta` = 0 alla seconda corsa).
- **Id deterministici**: `uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'STORIA36::<cluster>::<chiave-naturale>')` — MAI `md5()::uuid`.
- **Post-condizioni fail-loud in coda** (DO block con `RAISE EXCEPTION`), asserzioni di proprietà, mai fotografie.
- **Ordine lessicale = ordine di esecuzione** (`storia36.sh costruzione` li esegue in sequenza).

## File

| File | Cluster | Cosa |
|---|---|---|
| `00_foundation.sql` | C0 | registro provenance `staging.storia36_runs` + calendario lavorativo IT `staging.storia36_calendar` (2023-08-01..2026-07-31, patrono Sant'Ambrogio — sede Milano dal dato) |
| `00_repair_g4_contracts.sql` | C0 | riparazione puntuale (triage esito c) di 3 contratti con `end < start`; valori derivati dalle righe sane |
| `01_attendance_timeoff.sql` | C1 | presenze/assenze/ferie su 36 mesi (112.969 righe attendance, 2.009 richieste con timeline storica, balances 2023-25 con entitlement CCNL, buste 2026-07); estate a 5 turni, malattia stagionale, cap PERSONAL; riallinea SOLO le proprie righe |

## repair/ — one-shot FUORI dal glob custodia

`repair/*.sql` NON viene eseguito da `storia36.sh` (né costruzione né custodia):
sono riparazioni **one-shot sul dato legacy** decise da un triage (esito c),
lanciate A MANO dal cluster che le decide — il principio «mai riparazione
automatica di righe organiche/modificate» resta intatto. Ogni file è comunque
guardato e registrato in `staging.storia36_runs` (G6 li esclude dalla proprietà
twice-run: un reset ri-eseguito dopo la ri-semina cancellerebbe il lavoro).

I cluster C2..C11 aggiungono qui i loro seed (`02_performance.sql`, …
secondo il piano). Le batterie di verifica vivono in `db/scripts/verify-storia36*.sql`.
