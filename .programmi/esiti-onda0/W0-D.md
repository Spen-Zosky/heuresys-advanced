# Esito W0-D — il cambio di livello contrattuale con avviso (#265, fase F4): SOSPESA

Sessione S1119, 2026-10-12. Mandato di Cowork, decisione di Enzo del 12 ottobre 2026. Esito: la funzione è costruita e provata ma NON è su `main`; serve una scelta di Enzo.

## Perché non è su main

`PATCH /v1/users/:id/contract-level` scrive `sys.sys_user_contracts`. Quella tabella è classificata «importato» (X-1, ratificata 2026-09-19, mig. 000429) e la prova `data-steward.integration.test.ts` (b, DIF-4) esige che nessuna rotta di scrittura tocchi una tabella importata. La CI su `e678fa27` è uscita rossa per questo (oltre che per un atlante vecchio, corretto). Non ho toccato il test, non ho riclassificato la tabella, non ho messo eccezioni: l'ho revertita da `main` (commit di revert, nessun amend) e il lavoro è sul ramo `f4-livello-contrattuale`.

## La scelta di Enzo

- A) Riclassificare `sys_user_contracts` in «ibrido» (due scrittori reali: importazione e gesto nativo del mandato HR), come fece la 000448 per `sys_user_position_assignments`. La bozza è `claude_service_workspace\[Plans]\proposta-000456-riclassifica-user-contracts-ibrido.sql`; sul gemello `ci-rehearsal.sh` è VERDE (catena due volte, 53/53 sentinelle a zero) e la catena si applica a una copia usa-e-getta. Nota: la sentinella della direzione non guarda questa tabella (non ha `origine_dato`). Se Enzo sceglie A, si porta la bozza in `db/migrations` e si fonde il ramo.
- B) Tenere il livello contrattuale solo da importazione: il ramo si archivia.

## Che cosa c'è sul ramo

La rotta (`users/routes.ts`, `users/service.ts`, `users/repository.ts`), `avvisiDelCambioDiLivello` e `motivazioneFuoriScala` nel modulo `hierarchy-levels` (riusano `verifica` di F1, nessuna regola duplicata), gli schemi condivisi, 6 prove di integrazione (in scala senza avviso; fuori scala con avviso e livello scritto; tenant senza contratto caricato senza avviso; 403 senza mandato HR; 404 senza contratto attivo; senza sessione rifiutata) verdi sul gemello contro la copia migrata, e una mutazione della regola che ne fa fallire 2. Scritto con `updated_at` e `updated_by`: la modifica utente non ha un giornale applicativo e `sys_user_timeline_events` è dichiarato consultivo, non scrivibile.

## Residui sul gemello (non cancellati)

La copia `heuresys_advanced_w0d_prova1` (catena applicata più la bozza) e `heuresys_advanced_w0a1_prova1`; sul clone `~/heuresys-advanced` il file `db/migrations/000456_...sql` non tracciato che ho copiato per la prova generale e il codice della prova propagato da `prova-api-sul-gemello.sh`. Il prossimo allineamento dei cloni li riassorbe; dimmi se li tolgo prima.

## Produzione

Invariata: nessuna migrazione applicata, nessun deploy armato, `refs/heads/prod` non mosso.
