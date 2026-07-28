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
| `02_performance.sql` | C2 | tre cicli performance + 2026 in corso (1.563 goals MBO pesati per famiglia di ruolo, 6.567 check-in su 3 passi snappati a workday-non-assente, 391 review forma-import con rating ANCORATI al ciclo legacy 2024, 1.173 competency KSABA, 386 risposte 360 H2-2024 agganciate alle review) |
| `03_compensation.sql` | C3 | motore variabile su 3 esercizi (3 curve, 3.283 gates + results, 96 variable-pay da curva×rating C2) + 5.014 buste con adeguamenti CCNL a tranches, tredicesima e VAP nel giugno N+1 + 36 payroll handoff (parametri sorgentati in `docs/kb/storia36/DOMINIO_PREMIO_VARIABILE.md`) |
| `04_learning.sql` | C4 | formazione su 36 mesi: 15 moduli d'aula `BANK-CL-*` (INSTRUCTOR_LED, gemelli dei self-paced) + **62 edizioni mensili** `RTL-<AAAAMM>-<lettera>` calendarizzate sui giorni TRAINING del C1, con capienza dichiarata di 25 posti e **aule parallele** quando la coorte non ci sta; 1.180 tracce d'aula che quadrano quelle giornate (erano 7 su 1.180), 1.071 iscrizioni con iniziativa e scadenza, 1.254 corsi a distanza che coprono gli **obblighi di contenuto** (AML per tutti ogni anno, MiFID per chi distribuisce) e chiudono il monte-ore fino alle 37 h CCNL, 77 rinnovi di abilitazioni **senza scoperture**, ciclo lacuna→azione chiuso sulle lacune mature. Corsi scelti per pertinenza al ruolo; orari scritti in `Europe/Rome`. Parametri sorgentati in `docs/kb/storia36/DOMINIO_FORMAZIONE_OBBLIGATORIA.md` |
| `04b_safety.sql` | C4 | sicurezza sul lavoro: la cornice del D.Lgs 81/08 completa — 362 abilitazioni su cinque figure con platee **derivate** (lavoratori 158 · preposti 32 = chi ha riporti diretti · dirigenti 9 = inquadramento · datore di lavoro 1 = vertice dell'organigramma · squadre di emergenza 2+2 per sede via `staging.storia36_sede_personale`). Cadenze fissate dalla NORMA e non dalla mediana del dato (`storia36_cert_validity_di_legge`): lavoratori 5 anni, preposti 2, antincendio 5, primo soccorso 3. Scrive l'abilitazione, non le ore (perimetro dichiarato in `DOMINIO_FORMAZIONE_OBBLIGATORIA.md` §5) |
| `05_career.sql` | C5 | carriera: il prima e il dopo — 289 **esperienze precedenti** con le date VINCOLATE da nascita, fine degli studi e assunzione (mai prima dei 19 anni, mai oltre l'ingresso in RTL; datori di fantasia dichiarati), 150 **obiettivi di carriera** su un percorso condiviso con la posizione attuale e più in alto, 24 **candidati** per le 8 posizioni critiche (scelti fra chi riporta alla posizione e chi fa lo stesso mestiere altrove), 144 **valutazioni di prontezza** la cui ultima concorda col livello dichiarato, 289 **variazioni di requisito** datate su scadenze regolamentari vere |

## repair/ — one-shot FUORI dal glob custodia

`repair/*.sql` NON viene eseguito da `storia36.sh` (né costruzione né custodia):
sono riparazioni **one-shot sul dato legacy** decise da un triage (esito c),
lanciate A MANO dal cluster che le decide — il principio «mai riparazione
automatica di righe organiche/modificate» resta intatto. Ogni file è comunque
guardato e registrato in `staging.storia36_runs` (G6 li esclude dalla proprietà
twice-run: un reset ri-eseguito dopo la ri-semina cancellerebbe il lavoro).

I cluster C2..C11 aggiungono qui i loro seed (`02_performance.sql`, …
secondo il piano). Le batterie di verifica vivono in `db/scripts/verify-storia36*.sql`.
