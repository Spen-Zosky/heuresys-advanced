# ADR-0045 — I dati contrattuali del personale restano «importati»: Heuresys avvisa e rinvia al sistema esterno

- **Status**: ACCETTATO il 2026-10-12 da Enzo Spenuso (decisione data in chat alle 03:09, ora di Roma)
- **Date**: 2026-10-12
- **Decided by**: Enzo Spenuso
- **Redatto da**: Claude (governo dell'onda 0 del piano di adesione completa)
- **Relates to**: X-1 (classificazione della direzione del dato, migrazione 000429), invariante I23, programma 265 (F4)

> **In parole semplici, per Enzo.**
> 1. I dati amministrativi e contrattuali del personale nascono nei sistemi esterni (Zucchetti, SAP) e si cambiano lì, non in Heuresys.
> 2. Per questo `sys_user_contracts` resta «importato»: nessuna schermata o rotta di Heuresys la modifica a mano. Non si riclassifica «ibrido» e non si aggiunge una rotta di scrittura.
> 3. Cambiare il livello contrattuale in Heuresys non scrive nulla: mostra un avviso che chiede di fare la variazione nel sistema esterno. Poi Heuresys si aggiorna con le importazioni periodiche e/o su richiesta.
> 4. Questa collaborazione fra sistemi esterni e Heuresys non è ancora progettata né realizzata: è oggetto del progetto di integrazione con Zucchetti e SAP, che Enzo sta già seguendo.

## Decisione

- `sys_user_contracts` resta classificata «importato». La prova DIF-4 di `data-steward.integration.test.ts` continua a vietare rotte di scrittura sulle tabelle importate.
- F4 del programma 265 è ridefinita: non è più «cambio di livello con avviso» ma «avviso di rinvio al sistema esterno».
- Il lavoro sospeso (ramo `f4-livello-contrattuale`, rotta `PATCH /v1/users/:id/contract-level`, migrazione 000456 di riclassificazione) non va usato così com'è.

## Conseguenze

- Nessuna migrazione di riclassificazione; la bozza `proposta-000456-riclassifica-user-contracts-ibrido.sql` è scartata.
- Il meccanismo di aggiornamento (importazioni periodiche e su richiesta) dipende dal progetto di integrazione Zucchetti/SAP, ancora da progettare.