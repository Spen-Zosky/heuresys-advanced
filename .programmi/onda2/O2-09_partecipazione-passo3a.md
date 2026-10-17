# Mandato O2-09 — partecipazione ai processi, passo 3a: le letture usano la posizione

Modello: `claude-sonnet-5-5`. Tetto di spesa: 8 USD. Onda 2, sessione 9 di 10 (`.programmi/onda2/README.md`, regole comuni 1-11).

## Precondizioni (sezione 1 del piano del passo 3)

P1 `000457` in produzione; P2 passo 2 di PE-4 eseguito in produzione; P3 risposte dell'Amministratore di Sistema a D-P3-1, D-P3-2, D-P3-3. Se una manca: stato `WAIT-INPUT: <quale>`, e la sessione si ferma dopo averlo misurato (P1 e P2 si misurano in sola lettura via tunnel: `verifica-deploy.sh` e la query del piano).

## Leggi

`CLAUDE.md`, memoria, `.claude/rules/security-auth.md`, `.claude/rules/tests.md`; ADR-0044, ADR-0036; `.programmi/onda2/PIANO_passo3-partecipazione.md` per intero; `.programmi/esiti-onda0/PE-4.md`; `apps/api/src/lib/scope/functional.ts`, `domains.ts`, `apps/api/src/modules/me/repository.ts` (`GET /v1/me/processes`), `packages/shared/src/schemas/me.ts`; l'helper `apps/api/test/helpers/org-actors.ts` e i sei test di integrazione elencati nel piano.

## Consegna

1. Il frammento di lettura unico (sezione 3 del piano) in `functional.ts`, riusato dalle tre letture; il ramo di ripiego dichiarato con la data di fine.
2. Lo schema condiviso di «i miei processi» con `position_id` e `position_title` (aggiunte).
3. Helper e sei test aggiornati; il test nuovo del cambio di posto.
4. Se D-P3-1 o D-P3-3 sono sì: `db/scripts/pe4-passo3-regole.sql` e la sua inversa, fuori catena, sul modello di `pe4-passo2-riempi.sql`, mai con `metadata.storia36`.

## Prova di chiusura

- Il file `.programmi/onda2/esiti/O2-09_confronto-attori.txt`: per ogni attore di RTL Bank, `functionalScopeUserIds` e `process_owner` prima e dopo, su copia usa-e-getta con `000457`, passo 2 ed eventualmente lo script delle regole; ogni differenza spiegata.
- Il test del cambio di posto rosso sul codice di prima e verde dopo; mutazione (frammento senza la data di fine dell'assegnazione) rossa.
- Lo script delle regole, se c'è: andata e ritorno con impronta identica, seconda passata senza cambiamenti.
- `pnpm test:api:vm` verde; `pnpm typecheck:test` verde.

## Non fare

Nessuna corsa in produzione dello script delle regole; nessun vincolo o sentinella nuovi (sono del passo 3b, O2-10).
