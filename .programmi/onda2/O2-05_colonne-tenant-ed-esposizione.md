# Mandato O2-05 — le colonne nuove sulle tabelle del tenant, i profili degli indicatori, l'esposizione

Modello: `claude-sonnet-5-5`. Tetto di spesa: 8 USD. Onda 2, sessione 5 di 10 (`.programmi/onda2/README.md`, regole comuni 1-11).

## Contesto

Il disegno è nella sezione 4 di `.programmi/onda2/DISEGNO_tabelle-onda2.md`: obiettivi con livello e legami, attributi di definizione degli indicatori, profilo dell'indicatore per tenant (`sys_kpi_tenant_profiles`), target su processo e unità, mandato e budget dell'unità, quota di capacità sui membri, contesto e riverifica delle competenze di persona, disponibilità residua calcolata. Un dato che nessuna API espone non è nel prodotto (`check_exposure.py`).

## Leggi

`CLAUDE.md`, memoria, `.claude/rules/db-migrations.md`, `.claude/rules/api-module-pattern.md`, `.claude/rules/tests.md`; `DISEGNO_tabelle-onda2.md` sezioni 0 e 4; le migrazioni `000037`, `000015`, `000009`, `000054`, `000363`, `000180`; gli schemi condivisi in `packages/shared/src/schemas/` delle risorse toccate; `chi_sorveglia.py` su ogni tabella toccata.

## Consegna

1. Prima di scrivere, la misura su copia del gemello: `select count(*) from sys.sys_kpi_targets where num_nonnulls(kpi_target_position_id, kpi_target_user_id) > 1`, e il `\d` di ogni tabella toccata. Il CHECK dei target si valida solo se la misura dà zero.
2. Una migrazione con le colonne e la tabella della sezione 4, indici, vincoli, direzione, registrazione in `000062`; l'inversa fuori catena.
3. Schemi Zod condivisi e risposte delle rotte che leggono già quelle tabelle: ogni colonna nuova esce nella risposta (aggiunte, nessun campo tolto). La disponibilità residua è un campo calcolato nel repository dove la persona è già esposta.
4. Test di integrazione che leggono i campi nuovi.

## Prova di chiusura

- Migrazione: due applicazioni, `ci-rehearsal.sh` verde, andata e ritorno.
- Il CHECK di coerenza degli obiettivi rifiuta un obiettivo `PROCESSO` senza processo; accetta gli obiettivi esistenti con livello nullo (conteggio prima e dopo uguale).
- `python docs/kb/tools/check_exposure.py`: nessuna colonna nuova risulta non esposta (rosso prima della parte 3, verde dopo).
- `pnpm test:api:vm` verde; `cd apps/api && pnpm typecheck:test` verde.

## Non fare

Nessun riempimento delle colonne nuove sui dati esistenti; nessuna rotta di scrittura nuova; nessuna modifica alle pagine web oltre a ciò che serve perché il typecheck resti verde.
