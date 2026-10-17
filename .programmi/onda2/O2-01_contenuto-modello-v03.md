# Mandato O2-01 — il contenuto del modello v0.3 trova casa (lato piattaforma)

Modello: `claude-sonnet-5-5`. Tetto di spesa: 8 USD. Onda 2, sessione 1 di 10 (`.programmi/onda2/README.md`, regole comuni 1-11).

## Contesto

Il contratto dati v0.3 (approvato il 2026-10-17) aggiunge al pacchetto del datastore sezioni e campi che in advanced non hanno ancora una casa. Le case sono disegnate nella sezione 1 di `.programmi/onda2/DISEGNO_tabelle-onda2.md` (M1.1-M1.17): tabelle di piattaforma `sys_blueprint_content_*`, senza tenant, legate alla versione di variante, come in `000454`.

## Leggi

`CLAUDE.md`, memoria, `.claude/rules/db-migrations.md`; `DISEGNO_tabelle-onda2.md` sezioni 0 e 1; `db/migrations/000454_pacchetto_datastore_trova_casa.sql` e `000456_*` (la forma da imitare); `D:\heuresys-datastore\src\contratto\v0.3\vocabolari.json` e `prototipo-pacchetto.schema.json` (sola lettura: i valori dei CHECK e le forme dei campi che il disegno lascia aperte, `growth_ambition`, `ai_impact`, `criticality`, nomi dei `kind`).

## Consegna

1. Una migrazione (numero libero dopo l'ultima in `db/migrations/`) che crea M1.2-M1.16 e aggiunge le colonne di M1.1 e M1.17, con le regole C1-C10: idempotente, CHECK sui vocabolari, indici, `origine_dato`, righe in `sys.sys_classificazione_direzione_dato` (`importato`), registrazione delle tabelle nuove in `000062` (classe `D`, `EXCLUDE`, con la ragione).
2. L'inversa fuori catena `db/scripts/onda2/<numero>-inversa.sql` (C11), che si rifiuta se una tabella da togliere ha righe o una colonna ha valori.
3. Dove lo schema JSON contraddice il disegno (un valore, una forma), vince lo schema; lo scrivi nell'esito con la riga del disegno che correggi.

## Prova di chiusura

- Su copia usa-e-getta del gemello migrata all'HEAD: la migrazione si applica due volte senza errori; `\d` di ogni tabella nuova; `ci-rehearsal.sh` verde con le sentinelle a zero (catena due volte).
- Andata e ritorno: inversa su copia → lo schema torna identico a prima (confronto di `pg_dump --schema-only` filtrato sulle tabelle toccate); seconda applicazione verde.
- Mutazione: una riga di prova con un valore fuori vocabolario in un CHECK viene rifiutata; l'inversa con una riga dentro una tabella nuova si rifiuta.
- `python docs/kb/tools/verify_gate.py run` verde sul gemello.

## Non fare

Nessuna scrittura in produzione, nessun rilascio. Non toccare `definizione-pacchetto.mjs` (è O2-02) né le tabelle del tenant (O2-03 e seguenti).
