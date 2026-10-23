# ADR-0048 — Le personalizzazioni del tenant all'arrivo di una versione nuova del modello

- **Status**: ACCETTATO il 2026-10-23 da Enzo Spenuso (approvazione data in chat alle 15:19 UTC, 17:19 ora di Roma, con le raccomandazioni del riepilogo del mattino)
- **Date**: 2026-10-23
- **Decided by**: Enzo Spenuso, 2026-10-23
- **Redatto da**: Claude Code, programma di consolidamento advanced ↔ datastore (`.programmi/consolidamento/`), Fase C
- **Dipende da**: ADR-0047 (versione fissata sull'attivazione)
- **Relates to**: ADR-0042 (la piattaforma genera, il cliente possiede), ADR-0041 (direzione del dato), invariante I23
- **Poggia su**: `.programmi/consolidamento/02_ARCHITETTURA.md` §3 riga 5; `apps/api/src/modules/tenant-blueprints/diff.ts` (confronto fra versioni)

> **In parole semplici.**
> 1. Quando arriva una versione nuova del modello, ciò che il tenant non ha mai toccato si aggiorna da sé.
> 2. Ciò che il tenant ha modificato resta com'è: il modello non lo sovrascrive mai.
> 3. Se il modello cambia proprio una voce che il tenant ha modificato, il sistema lo segnala e chiede, invece di scegliere.
> 4. Una voce che il modello toglie non sparisce dal tenant: resta, marcata «fuori modello».
> 5. Il passaggio a una versione nuova lo fa una persona, tenant per tenant, dopo aver visto l'elenco delle differenze.

---

## Contesto

Oggi il caricamento del contenuto di modello in advanced usa campi bloccanti e `ON CONFLICT DO NOTHING`: non c'è una politica per campo, e una versione nuova o non arriva o, con altri percorsi, sovrascrive. ADR-0042 dice che il cliente possiede ciò che ha. ADR-0047 fissa la versione sull'attivazione, quindi l'arrivo di una versione nuova non cambia più niente da solo: serve la regola per quando il tenant decide di passarci.

## Decisione proposta

Per ogni famiglia di dato che nasce dal modello (ruoli, competenze, processi, indicatori, cruscotti, perimetro):

| stato della voce nel tenant | il modello nuovo la cambia | il modello nuovo la toglie |
|---|---|---|
| **ereditata** (mai toccata dal tenant) | si aggiorna | resta, marcata «fuori modello» |
| **conservata** (modificata dal tenant) | non si tocca; la differenza si **segnala** | resta, marcata «fuori modello» |
| **propria** (creata dal tenant) | non applicabile | non applicabile |

- Il passaggio a una versione è un gesto per tenant di un mandato HR del tenant o di piattaforma, preceduto dall'anteprima calcolata da `diff.ts`, ed è registrato (chi, quando, da quale a quale versione).
- Nessuna voce si cancella al passaggio; il ritorno alla versione precedente riporta l'attivazione, non le righe.
- Per sapere se una voce è ereditata o conservata serve il riferimento alla versione da cui è nata e un'impronta del suo contenuto d'origine: è il lavoro dell'incremento C6.

## Domande, decise il 2026-10-23

1. **Chi può far passare un tenant a una versione nuova**: solo la piattaforma, oppure anche `HRMS_MANAGER` del tenant? Raccomandazione: entrambi, perché il tenant possiede i suoi dati (ADR-0042) e l'anteprima rende il gesto consapevole.
   - **Decisa il 2026-10-23 alle 15:19 UTC da Enzo Spenuso: entrambi.**
2. **Una voce segnalata blocca il passaggio?** Raccomandazione: no; il passaggio avviene, la segnalazione resta aperta finché qualcuno sceglie fra la propria versione e quella del modello.
   - **Decisa il 2026-10-23 alle 15:19 UTC da Enzo Spenuso: non blocca.**

## Conseguenze

- Migrazione additiva per l'origine delle voci (versione e impronta d'origine), da scrivere in C6 su una copia usa-e-getta.
- Le prove: un passaggio che aggiorna una voce ereditata, non tocca una conservata, segnala il conflitto e marca una voce tolta; ciascuna vista rossa prima.
