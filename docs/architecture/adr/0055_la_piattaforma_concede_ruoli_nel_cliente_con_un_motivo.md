# ADR-0055 — La piattaforma concede ruoli dentro un cliente solo con un motivo scritto

- **Status**: ACCETTATO il 2026-11-06 da Enzo Spenuso, alle 01:22 UTC (02:22 ora di Roma), nel thread «Decidere S-17, S-20, S-2, P-5, P-6 e privacy@», sulla scheda «Heuresys può assegnare ruoli dentro un'azienda cliente?», con la scelta «Sì, con limiti e motivo scritto».
- **Date**: 2026-11-06
- **Redatto da**: Claude Code, thread «Decidere S-17, S-20, S-2, P-5, P-6 e privacy@»
- **Builds on**: ADR-0026 (un ambiente, due tenant), ADR-0050 D4 (il mandato come atto, con motivo), migrazione 000386 (la sentinella del confine fra clienti su tutti i punti), regola di Enzo del 2026-10-31 sul ruolo che segue il lavoro, regola di Enzo del 2026-11-05 (ogni ruolo tenuto da utenze di prova va anche a una persona vera).
- **Non tocca**: I5 (isolamento dei tenant con FK e filtro nel middleware), ADR-0036 §5 (le eccezioni al mandato HR), ADR-0050 D2 (secondo fattore per chi porta un mandato).

> **In parole semplici.**
> 1. L'amministratore di piattaforma di Heuresys può assegnare un ruolo a una persona di un'azienda cliente.
> 2. Lo può fare solo lui, e solo scrivendo il motivo (per esempio «avvio del cliente» o «su richiesta della Direttrice HR»).
> 3. Ogni assegnazione resta registrata con chi l'ha fatta e perché.
> 4. Un controllo automatico segnala qualunque assegnazione fatta da fuori del cliente senza queste due condizioni.

---

## §1 — Contesto

La sentinella `sys.v_tenant_boundary_violations_full` (000386) controlla ogni legame fra una riga di un cliente e una riga di un altro cliente. Il 2026-11-06 segnalava 9 righe di `sys.sys_user_auth_roles` in cui il concedente (`user_auth_role_granted_by`) è Enzo, del tenant Heuresys System, e la concessione è nel tenant RTL Bank. Sette righe sono del 2026-10-31: la riassegnazione dei ruoli di RTL «il ruolo segue il lavoro», autorizzata per iscritto da Enzo. Due sono del 2026-11-05/06, voce P-6 del piano interfacce (`RECRUITER` a Beatrice Russo, `HIRING_MANAGER` a Valentina Conti), anch'esse autorizzate per iscritto da Enzo.

Non sono errori: è l'amministratore di piattaforma che lavora per il cliente, come già accade per le colonne d'autore (`created_by`, approvatori, `gap_closure_action_owner_user_id`) che la 000386 e la 000395 escludono per disegno. Una concessione di ruolo però dà poteri dentro l'azienda del cliente, e con un cliente vero il fornitore deve poterla giustificare. Per questo la colonna non si esclude e basta: si guarda con una regola sua.

## §2 — Decisione

**D1.** Una concessione di ruolo in un tenant cliente fatta da un utente di un altro tenant è legittima solo se il concedente porta un `PLATFORM_ADMIN` attivo **e** la concessione ha un motivo scritto di almeno 10 caratteri, in `user_auth_role_reason` o nell'atto di ADR-0050 D4 (`sys_mandate_acts.mandate_act_reason`).

**D2.** `user_auth_role_granted_by` entra in `sys.sys_tenant_boundary_author_columns`, quindi la sentinella generica non la conta più. Al suo posto la guarda una sentinella dedicata, `sys.v_concessioni_fuori_cliente_senza_motivo`, che pretende zero e segnala ogni riga che viola D1, dicendo quale delle due condizioni manca.

**D3.** Le nove concessioni esistenti ricevono il motivo che le ha generate, con riferimento all'autorizzazione scritta di Enzo. Lo fa la migrazione 000479, solo sulle righe senza motivo e solo nelle finestre di quelle due giornate.

**D4.** Un agente non concede ruoli in un cliente (ADR-0050 D6): la regola vale per persone di piattaforma.

## §3 — Conseguenze

- La sentinella generica torna a misurare i soli confini veri.
- Ogni concessione futura da parte della piattaforma deve portare un motivo, altrimenti la sentinella dedicata diventa rossa.
- Rischio: se un giorno un utente di piattaforma diverso da `PLATFORM_ADMIN` dovesse concedere ruoli, la sentinella lo segnalerà; si allarga la regola solo con un nuovo ADR.

## §4 — Attuazione

- Migrazione `db/migrations/000479_la_piattaforma_concede_con_un_motivo.sql`.
- Prova a esiti opposti in fondo al file (si esegue a mano, finisce in ROLLBACK).
