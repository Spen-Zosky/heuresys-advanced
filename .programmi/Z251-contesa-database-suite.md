# Z-251 — La suite non regge la contesa sul database: un file diverso cade a ogni giro

> **item**: Z-251
> **stato**: IN CORSO

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

- [x] **F1 Riprodurre la contesa a comando** — FATTO 2026-08-19 · **NON SI RIPRODUCE con il carico
      di connessioni, e la misura ha trovato un fattore che questa voce non nominava.**
      Strumento: `apps/api/scripts/contesa-tunnel.mjs` (N connessioni concorrenti, tempi misurati).
      **Carico crescente, zero fallimenti**: N=5 → max 418 ms · N=20 → 471 ms · N=50 → 1044 ms ·
      N=70 → 1165 ms. Il tempo cresce col carico ma resta lontanissimo dai `connectionTimeoutMillis:
      5_000` che producono il messaggio misurato in S1052. Il database non è il collo: **6
      connessioni attive su 100**. E `fileParallelism: false` — i file girano in **sequenza**,
      quindi la suite da sola non produce nemmeno quelle raffiche.
      ⭐ **IL REPERTO, che cambia la lettura della voce**: separando l'apertura dal traffico —
      apertura di una connessione **262 ms**, poi **86,5 ms per singola query** su quella già
      aperta. Non è l'handshake: è il **round-trip**. Su un database locale una query vale ~1 ms:
      qui ne vale ~86, perché il percorso è un tunnel SSH verso una VM in cloud. **Fattore ~80×.**
      Conseguenze, tutte verificabili: (a) i 1834 s della corsa integrale sono dominati dalla
      **latenza**, non da Argon2id; (b) «un file diverso cade ogni volta» è il comportamento atteso
      di una soglia superata per caso, non di una contesa; (c) in CI la suite è verde perché gira
      su `heuresys_ci` **locale al runner** (`test-integration.yml:57`), senza tunnel; (d) i limiti
      alzati due volte compensavano la **latenza**, e per questo alzarli «funzionava».
      ⚠ **Questo mette in discussione la decisione vincolante di questa voce**: condividere le
      sessioni fra file (F2) toglie i login ripetuti, ma **non toglie gli 86 ms per query** — e la
      suite ne fa migliaia. La cura che li toglie è eseguire la suite **dove il database è locale**,
      che è ciò che la CI già fa. Non è una decisione che prendo io: è una misura che va portata a
      Enzo prima di aprire F2, perché ne cambia il senso.
- [ ] **F2 Le sessioni condivise fra file di test** — budget ~80k
      Il lavoro vero: togliere i login ripetuti invece di allargare i limiti. Perimetro
      `apps/api/test/**` + `apps/api/vitest.config.ts`.
- [ ] **F3 Riabbassare i limiti alzati due volte** — budget ~20k
      È la prova che la causa è andata via: se i limiti devono restare alti, la cura non ha
      funzionato e va detto.

## ⚠ Da decidere prima di F2 (misura di F1, 2026-08-19)

La decisione vincolante scritta sopra — «condividere le sessioni fra file è il lavoro che
toglierebbe la necessità dei limiti» — è stata presa **senza conoscere la latenza del tunnel**.
Ora si sa: **86 ms per query**, ~80 volte un database locale. F2 costa ~80k e toglie i login
ripetuti; non tocca la latenza, che è ciò che domina i 1834 s.

Le due strade, con quello che si sa oggi:

1. **F2 come scritta** — sessioni condivise. Riduce gli Argon2id e le connessioni. Non riduce i
   round-trip: la suite continua a pagare 86 ms ogni volta che parla al database.
2. **Eseguire la suite dove il database è locale** — cioè sul gemello, come la CI già fa e come
   `#181` ha mostrato oggi (la suite API era **già verde in CI** mentre girava in locale per 30
   minuti). Non è un lavoro di test: è dove si esegue.

Le due non si escludono. Ma farle nell'ordine scritto significa spendere 80k su ciò che non
domina, e va detto prima, non dopo.

## Chiuso quando

La suite gira ripetutamente senza cadute da contesa **con i limiti riportati ai valori di prima
degli aggiramenti**, e il numero di corse su cui è stato verificato è scritto.
