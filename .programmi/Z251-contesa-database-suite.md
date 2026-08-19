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
      ⚠⚠ **DA QUEL NUMERO AVEVO TRATTO LA CONCLUSIONE SBAGLIATA, e la misura successiva l'ha
      smentita nella stessa ora.** Avevo scritto che i 1834 s erano dominati dalla latenza e che la
      cura fosse «eseguire la suite dove il database è locale». Poi ho misurato **quanto dura la
      suite proprio là**: in CI, su `heuresys_ci` locale al runner e **senza tunnel**, il job
      «Test (api integration)» dura **2065 s e 2187 s** (due corse riuscite) — cioè **più** dei
      1834 s in locale. Se togliere il tunnel non riduce il tempo, **la latenza non è ciò che
      domina**: la causa dichiarata nella config — «ogni file rifà i login da zero e Argon2id è
      lento per costruzione» — regge, ed è CPU, non rete.
      **Quindi la decisione vincolante di questa voce resta valida**, e `F2` va fatta come scritta:
      togliere i login ripetuti riduce il **numero** di round-trip e di hash, che è ciò su cui si
      può agire. Gli 86 ms restano un fatto misurato e utile — spiegano perché una soglia possa
      essere superata per caso su un file qualunque — ma non spiegano il totale.
- [ ] **F2 Le sessioni condivise fra file di test** — budget ~80k
      Il lavoro vero: togliere i login ripetuti invece di allargare i limiti. Perimetro
      `apps/api/test/**` + `apps/api/vitest.config.ts`.
- [ ] **F3 Riabbassare i limiti alzati due volte** — budget ~20k
      È la prova che la causa è andata via: se i limiti devono restare alti, la cura non ha
      funzionato e va detto.

## Il reperto di F1 che resta valido, e quello che non regge (2026-08-19)

**Resta**: ogni query costa **86,5 ms** attraverso il tunnel (apertura di una connessione 262 ms),
contro ~1 ms su un database locale. È il motivo per cui un file qualunque può superare una soglia
per caso — cioè spiega la **forma** del guasto («un file diverso ogni volta»), non la sua frequenza
né il tempo totale.

**Non regge** — ed è una conclusione mia, smentita da una misura fatta subito dopo: «la latenza
domina i 1834 s, quindi la cura è eseguire la suite dove il DB è locale». La suite **là** dura
**2065-2187 s**, cioè di più. Togliere il tunnel non accorcia la corsa.

Conseguenza per `F2`: si fa **come scritta**. La causa dichiarata nella config (login ripetuti +
Argon2id) non è stata smentita da niente, e condividere le sessioni riduce il numero di hash e di
round-trip — le due cose su cui si può davvero agire.

## Chiuso quando

La suite gira ripetutamente senza cadute da contesa **con i limiti riportati ai valori di prima
degli aggiramenti**, e il numero di corse su cui è stato verificato è scritto.
