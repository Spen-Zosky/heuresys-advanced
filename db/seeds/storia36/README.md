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

I cluster C1..C11 aggiungono qui i loro seed (`01_attendance_timeoff.sql`, `02_performance.sql`, …
secondo il piano). Le batterie di verifica vivono in `db/scripts/verify-storia36*.sql`.
