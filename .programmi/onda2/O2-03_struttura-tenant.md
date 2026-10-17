# Mandato O2-03 — la struttura dell'azienda vera: processi, attività, capability, ore, responsabilità

Modello: `claude-sonnet-5-5`. Tetto di spesa: 8 USD. Onda 2, sessione 3 di 10 (`.programmi/onda2/README.md`, regole comuni 1-11).

## Contesto

Oggi il processo del tenant è un processo del modello agganciato a un'unità (`sys_organization_unit_processes`, `000121`): il tenant non ha un processo suo, né attività, né il legame con capability, ruoli e ore. Il disegno è nella sezione 2 di `.programmi/onda2/DISEGNO_tabelle-onda2.md` (T1-T8).

## Leggi

`CLAUDE.md`, memoria, `.claude/rules/db-migrations.md`; `DISEGNO_tabelle-onda2.md` sezioni 0 e 2; le migrazioni `000121`, `000011`, `000010`, `000180`; `db/scripts/pe4-passo2-riempi.sql` e `pe4-prova.sh` (la forma del riempimento con giornale); `chi_sorveglia.py` su `sys_organization_unit_processes` e `sys_positions`.

## Consegna

1. Una migrazione con T1-T8 (tabelle, colonna su `sys_organization_unit_processes`, colonna del riporto funzionale su `sys_positions`), indici di ogni FK, sentinelle `sys.v_*_cross_tenant` (C6), direzione `importato`, registrazione in `000062`.
2. L'inversa fuori catena (C11).
3. Lo script fuori catena `db/scripts/onda2/riempi-processi-tenant.sql` con misura, guardia nella transazione, post-condizione per impronta, giornale `staging.tenant_processes_undo`, registro `staging.tenant_processes_dubbi`, e la sua inversa (azzera la colonna, disattiva i processi creati dalla corsa, non cancella). Un owner si scrive solo se il codice si risolve in esattamente una posizione attiva del tenant.

## Prova di chiusura

- Migrazione: due applicazioni, `ci-rehearsal.sh` verde, sentinelle C6 a zero, andata e ritorno dell'inversa.
- Riempimento su copia usa-e-getta del gemello: le unità di processo di RTL Bank hanno tutte `org_unit_process_tenant_process_id`; numero di processi del tenant = numero di processi distinti del modello citati (misurato con una query scritta diversa dallo script); owner scritti + dubbi = processi; seconda passata senza cambiamenti; l'inversa riporta l'impronta delle unità di processo identica.
- Mutazioni: un owner risolto anche con due posizioni candidate deve far diventare rossa la prova; una FK verso un processo di un altro tenant deve accendere la sentinella C6.

## Non fare

Il riempimento non gira in produzione (lo lancia l'Amministratore di Sistema al rilascio). Nessuna rotta di scrittura sulle tabelle nuove: è l'onda 3.
