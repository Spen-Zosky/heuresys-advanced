# Migration skeletons — ARTEFATTO STORICO, non lavoro da fare

> **Questi file NON sono un backlog.** Sono la copia fedele degli scheletri contenuti nel
> *Bootstrap Pack v5*, il pacchetto da cui il progetto è partito nel maggio 2026. Il testo
> `-- TODO: Development Team must implement` che compare in ognuno è **del pacchetto
> originale**, non un debito di questo repository.

## Perché questa nota esiste

I 27 skeleton contengono complessivamente 29 marcatori `TODO`. Un censimento automatico
del codice li conta come lavoro aperto — è successo, e ha prodotto una voce di backlog
fantasma. Non lo sono: le migration reali del progetto vivono in **`db/migrations/`**
(oltre 210 file, numerati e idempotenti, applicati a produzione), e coprono da tempo tutto
ciò che qui è abbozzato.

## Cosa farne

- **Non implementarli.** Sono superati dal reale.
- **Non cancellarli.** Hanno valore documentale: mostrano da dove il progetto è partito e
  quanto se n'è discostato — utile quando si ricostruisce il perché di una scelta.
- **Non contarli** in metriche di TODO/debito: filtrare `docs/source_bundle/` è corretto.

Il confronto fra uno skeleton e la migration reale omonima (dove esiste) è il modo più
rapido per vedere quanto lo schema si sia evoluto rispetto al disegno iniziale.
