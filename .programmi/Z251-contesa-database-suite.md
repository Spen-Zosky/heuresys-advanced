# Z-251 — La suite non regge la contesa sul database: un file diverso cade a ogni giro

> **item**: Z-251
> **stato**: NON AVVIATO

**Perché conta**: rende **rosso un cancello che dovrebbe essere verde**, e costringe ogni volta a
un lavoro manuale di discriminazione fra ambiente e difetto. Un rosso che non indica un difetto è
peggio di nessun rosso, perché insegna a non guardarlo — ed è già scritto nella config dei test,
che per questo ha alzato i limiti due volte.

## Le due misure, che dicono cose diverse

- **S1052, tre volte nello stesso giorno**: 1509 → 1511 test passati, **zero falliti**, e ogni
  volta **un solo file su 219 caduto** con `Connection terminated due to connection timeout` in
  `pool.connect()`. Ma un file **diverso** ogni volta — `seed-acquisition` alle 00:54, `webauthn`
  alle 11:13 — e ognuno rieseguito da solo passa.
- **S1054 (2026-08-11), corsa integrale su HEAD `aba41ec5` a database libero**: **225/225 file
  passati, 1544 test, zero falliti**, 1834 s. **La contesa non si è manifestata.**

## Conseguenze da tenere presenti prima di iniziare

1. **Il fenomeno non si riproduce a comando**: una correzione andrà provata su **molte** corse,
   non su una verde.
2. Una corsa verde **non è la prova** che sia risolto — è la prova che quella volta non è
   successo. È esattamente il modo in cui questa voce può essere chiusa per sbaglio.
3. **La causa strutturale è nota e dichiarata** in `apps/api/vitest.config.ts`: «ogni file rifà i
   login da zero e Argon2id è lento per costruzione».

## Decisione vincolante

**Condividere le sessioni fra file è il lavoro che toglierebbe la necessità dei limiti, e non è
una taratura.** Alzare ancora i timeout non è una cura: è la terza volta che si sposta la soglia
invece di togliere la causa.

## Fasi

- [ ] **F1 Riprodurre la contesa a comando, o dichiarare che non si può** — budget ~40k
      Senza un modo di farla comparire, nessuna correzione è verificabile. Le leve da provare
      sono il carico concorrente sul pool e la lentezza di Argon2id, che è la causa dichiarata.
      **Se non si riproduce, si scrive** — e F2 cambia forma: la prova diventa statistica (N corse
      con e senza la cura), non un singolo verde.
- [ ] **F2 Le sessioni condivise fra file di test** — budget ~80k
      Il lavoro vero: togliere i login ripetuti invece di allargare i limiti. Perimetro
      `apps/api/test/**` + `apps/api/vitest.config.ts`.
- [ ] **F3 Riabbassare i limiti alzati due volte** — budget ~20k
      È la prova che la causa è andata via: se i limiti devono restare alti, la cura non ha
      funzionato e va detto.

## Chiuso quando

La suite gira ripetutamente senza cadute da contesa **con i limiti riportati ai valori di prima
degli aggiramenti**, e il numero di corse su cui è stato verificato è scritto.
