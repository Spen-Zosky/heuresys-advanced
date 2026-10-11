# Esito W0-D — il cambio di livello contrattuale con avviso (#265, fase F4)

Sessione S1119, 2026-10-12. Mandato di Cowork, decisione di Enzo del 12 ottobre 2026: una funzione per modificare il livello contrattuale di una persona, con l'avviso (avviso, non blocco).

## Che cosa c'è

`PATCH /v1/users/:id/contract-level`, corpo `{ level, contractId? }`. Scrive `user_contract_ccnl_level` del contratto attivo più recente della persona (o di quello indicato) e risponde 200 con `livelloPrecedente`, `livello`, `scala` e `avvisi`.

- Avviso `FUORI_SCALA`: il livello scelto non rientra nella scala del contratto caricato; la motivazione è scritta in italiano (`motivazioneFuoriScala` in `hierarchy-levels/logic.ts`).
- Avviso `GERARCHIA`: la logica di F1 (`verifica`), applicata all'organigramma del tenant già col livello nuovo nella stessa transazione, tenendo solo i casi che riguardano la persona. Non c'è una seconda copia della regola.
- Dove il tenant non ha un contratto caricato (`scala.fonte` ASSENTE) non giudica: `avvisi` vuoto, nessun errore.
- Permessi: `user:update` come le altre modifiche del personale, più il mandato HR o di piattaforma (predicati `haMandatoHr`, `haMandatoPiattaforma`) perché il livello contrattuale è un campo privilegiato; la persona deve essere raggiungibile come in `PATCH /v1/users/:id`.
- Nessuna migrazione: la colonna c'è dalla `000165`. Produzione non toccata.

## Una differenza da dichiarare rispetto al mandato

Il mandato chiedeva «lo stesso giornale delle altre modifiche del personale». Letto il codice: `PATCH /v1/users/:id` non scrive in nessun giornale applicativo (aggiorna solo `updated_at`); `sys_user_timeline_events` è dichiarata dalla sua migrazione (000222) un registro consultivo in cui nessun modulo deve scrivere. Ho quindi fatto lo stesso che fa la modifica dell'utente: `updated_at` e, in più, `updated_by` (la colonna esiste sul contratto). Se si vuole un giornale vero per le variazioni contrattuali, è una scelta di prodotto a parte.

## Prove

- Unitaria: `motivazioneFuoriScala` (11 test unitari del modulo verdi).
- Integrazione `apps/api/test/users-contract-level.integration.test.ts`, 6 prove, sul gemello contro la copia migrata `heuresys_advanced_w0a1_prova1` (la `000454` non è nel clone): in scala senza avvisi; fuori scala con avviso e livello comunque scritto; tenant senza contratto caricato senza avviso; 403 senza mandato HR e livello invariato; 404 senza contratto attivo; senza sessione rifiutata. Verdi, insieme a `users.integration.test.ts` (24/24 sui due file).
- Mutazione: invertendo il confronto `rango(...) === null` in `avvisiDelCambioDiLivello`, 2 prove falliscono (in scala e fuori scala); ripristinato.
- Non coperto da una prova di integrazione: l'avviso `GERARCHIA` di questa rotta (serve un organigramma di prova); la regola è provata dai test di F1.

## CI

Il primo commit (`637b6a62`) è uscito rosso in due punti, entrambi miei: il ratchet dei controlli per nome (avevo scritto un controllo sul ruolo invece dei predicati di mandato) e l'atlante vecchio. Corretti con un commit nuovo.

## Che cosa non si chiude qui

F3 (avviso su modifiche di unità e assegnazioni) e F5 (rilascio): altre voci. Il rilascio di 000454/000455 non è stato armato da me.
