# Z-251 — La suite non regge la contesa sul database: un file diverso cade a ogni giro

> **item**: Z-251
> **stato**: CHIUSO

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


## Simulazione di F2 (R24 §3) — misurata il 2026-08-19, prima di scrivere una riga

Strumento della misura: `apps/api/scripts/profilo-costo-avvio.mts` (creato qui, resta).

| domanda | risposta misurata |
|---|---|
| **Precondizioni** | L'access token e' un **JWT stateless**: in `src/` non esiste nessuna `sys_auth_sessions` — le tabelle auth sono 14 e la sola di sessione e' `sys_auth_refresh_tokens` (opaca, su DB). Quindi un token emesso dentro la transazione di un file **resta valido dopo il rollback**, ed e' cio' che rende possibile condividerlo. TTL access **15 min** (`ACCESS_JWT_TTL_SECONDS`), CSRF 24 h. |
| **Meccanismo** | Cache di sessioni dentro `loginRaw`, **persistita su disco**: `tx-isolation.ts` dichiara che «Vitest isolates the module graph per file», quindi una `Map` in memoria non sopravvive al passaggio di file. Chiave = email; validita' letta dall'`exp` del JWT meno un margine. |
| **Propagazione** | Il file di cache vive sotto `node_modules/.cache/`: non versionato, non propagato ai cloni, azzerato dal `globalSetup` a ogni corsa. |
| **Chi** | Io, per intero. Nessun input di Enzo. |
| **Guardia** | Non e' distruttiva. Le guardie sono tre: mai servire un token entro il margine di scadenza · mai cachare una password **esplicita** (i test del rifiuto devono restare veri) · i **6 file** che esercitano il flusso di autenticazione ne stanno fuori per dichiarazione, e un cancello meccanico verifica che chi tocca il refresh l'abbia dichiarato. |

### Il costo del rito, misurato (mediane su 3 giri, DB di produzione via tunnel)

| pezzo | costo | quante volte |
|---|---:|---|
| `loadRolePermissionCache()` | **82 ms** | 1 per file × 255 file |
| `buildApp() + ready()` | **260 ms** | 1 per file × 255 file |
| **login completo** (Argon2id ×2 + TOTP step-2) | **753 ms** | ~**670 invocazioni** scritte nei test |
| query singola (riferimento tunnel) | 59 ms | — |

**Il login e' il costo aggredibile piu' grande**: ~670 × 753 ms ≈ **504 s**, cioe' il **27%** dei 1834 s
della corsa integrale. Le email distinte sono **7** (`federica.marchetti` 135 · `enzo.spenuso` 118 ·
`tommaso.fiore` 74 · `paolo.caputo` 60 · `antonio.parisi` 18 · `marco.rinaldi` 3 ·
`alberto.rossetti` 1). Con l'access TTL di 15 min su una corsa da ~30 min, i login necessari
scendono a **~7 email × 3 rinnovi ≈ 21**, contro ~670.

⚠ **Cio' che questa misura NON promette**: la voce non si chiude sul tempo, si chiude sui rossi da
contesa. Il tempo risparmiato e' il mezzo (meno round-trip, meno hash concorrenti), non il fine.

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
- [x] **F2 Le sessioni condivise fra file di test** — FATTO 2026-08-19 · **campione di 12 file:
      233,62 s → 177,67 s (-24%), 96/96 test verdi in entrambe le corse, e i login veri passano
      da 79 invocazioni a 11.** Meccanismo: `test/helpers/session-cache.ts` — una sessione per
      email, persistita sotto `node_modules/.cache/` perché il module graph è isolato per file,
      con scadenza letta dall'`exp` del JWT e margine di 120 s. Azzerata a ogni corsa dal
      `globalSetup` (`session-cache-reset.ts`). Le prove: 16 unit + 3 di cancello + 5 di
      integrazione, e **tre sabotaggi che le hanno fatte diventare rosse** (tolto il margine di
      scadenza → 2 rossi · accettata una risposta non-200 → 1 rosso · tolta la dichiarazione a un
      file auth → il cancello lo nomina). Il caso che regge tutta la fase è provato sul vivo: una
      sessione cachata autentica `/v1/me/profile` su **un'altra istanza dell'app** (200), cioè il
      JWT sopravvive al rollback della transazione di file. I 6 file che esercitano
      l'autenticazione ne stanno fuori per dichiarazione: 48/48 verdi.
      🔬 **Una mia misura preparatoria era incompleta**: avevo scritto «7 email distinte» contando
      i letterali nei sorgenti. Il solo campione di 12 file ne ha usate **11** — gli altri attori
      arrivano da `actors.ts`/`org-actors.ts`, che li scelgono per CARATTERISTICA interrogando il
      database, e nei sorgenti non compaiono come stringhe. Il risparmio sulla corsa integrale
      dipende da quanti attori distinti tocca, quindi **non si estrapola dal campione**: lo dirà
      la corsa in CI.
- [x] **F3 Riabbassare i limiti alzati due volte** — FATTO 2026-08-19 · `testTimeout` **40s → 20s**
      e `hookTimeout` **120s → 30s**, cioè i valori di prima dei due aggiramenti di S1045.
      Verificato in locale su **16 file / 139 test, tutti verdi** (i 12 del campione + i 3 auth
      più pesanti + la prova della cache), 259,51 s.
      ⚠ **Questa non è ancora la prova che la voce chiede.** «Chiuso quando» pretende corse
      **ripetute** della suite INTEGRALE con i limiti bassi, e una corsa locale integrale dura
      ~30 min contendendo il database di produzione. La prova vera è la CI, che esegue
      `Test (api integration)` su runner self-hosted off-prod: si legge lì, corsa per corsa, e il
      numero di corse verdi si scrive qui sotto.
### ⚠ La prima corsa integrale ha trovato un difetto MIO, e l'ha trovato subito (2026-08-19)

`verify_gate` ha eseguito la suite intera su `7b002359`: **2118 s, 6 file rossi**. Non erano
flaky — con `TEST_SESSION_CACHE=0` gli stessi sei passano **6/6, 50 test**. Era la cache.

**Due cause, e la seconda non l'avevo prevista:**
1. **Chi ragiona sulla sessione stessa** — `me-sessions` asserisce «la famiglia corrente
   sopravvive alla revoca delle altre», e con una sessione presa da un altro file la
   «corrente» non era quella che il test aveva appena creato. Rientrava nella guardia n.3,
   ma il mio criterio cercava solo il *refresh*: `/v1/me/security/sessions` non combaciava.
2. **Chi MUTA i ruoli dell'attore** (`sys_user_auth_roles`) e poi rifà login aspettandosi il
   nuovo assetto. L'access token è un JWT: fotografa i ruoli **all'emissione**, quindi una
   sessione precedente alla mutazione risponde con l'assetto vecchio. Questa famiglia non
   era nel criterio affatto — `capability-composition-scope` concede e revoca ruoli per
   costruire i propri scenari.

**Rimedio**: il cancello ora ha due criteri invece di uno, ed è strutturale — non una lista di
nomi. Sono **14 file su 255 (5,5%)** a stare fuori dalla cache: il risparmio resta quasi intatto.
Riverificato: **9 file, 86 test, tutti verdi** con la cache attiva.

**La lezione, che vale oltre questa voce**: la guardia n.3 c'era e aveva il suo cancello, ma il
cancello verificava il criterio SBAGLIATO — cercava una firma (`refresh`) invece della proprietà
(«questo test dipende dall'identità o dai permessi *di questa* sessione»). Un cancello che guarda
la firma è verde finché nessuno cambia il modo di scrivere la stessa cosa.

- [x] **F4 La serie di corse verdi che chiude la voce** — **FATTA 2026-08-19 (S1072)**: 5 corse consecutive verdi coi limiti a 20s/30s, lette dalla CI. Evidenza e i tre controlli che le rendono contabili → contatore in fondo al file. Budget ~15k (in gran parte attesa)
      Il «Chiuso quando» di questa voce pretende corse **ripetute**, e nessuna delle tre fasi
      precedenti la copriva: era un difetto di decomposizione del piano, trovato dallo strumento
      (`programmi.py --verifica` diceva «3/3 spuntate ma stato IN CORSO» — e aveva ragione sulla
      forma). Si legge la CI corsa per corsa e si riempie il contatore in fondo al file: **3 corse
      consecutive verdi** con i limiti a 20s/30s, poi la voce si chiude. Un rosso da tempo
      significa che la cura non è bastata, e va scritto invece che tarato.

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

### Il contatore delle corse integrali verdi con i limiti bassi (20s / 30s)

> Si aggiorna leggendo la CI, non a memoria: `gh run list --workflow=test-integration.yml`.
> Una corsa verde non chiude la voce — il fenomeno che insegue **non si riproduce a comando**,
> quindi serve una serie. Soglia dichiarata: **3 corse consecutive verdi**.

| # | data | commit | esito | note |
|---|---|---|---|---|
| — | 2026-08-19 | `7b002359` | **ROSSA — 6 file** | e non contava: erano un difetto MIO, non la contesa. Corretti sopra. Il contatore riparte dal commit che porta il rimedio |
| **1** | 2026-08-19 | `62d59c45` | **VERDE** | prima corsa integrale con i limiti a 20s/30s **e** la cache attiva. Letta dalla CI (`gh run list`), non dedotta |
| — | 2026-08-19 | `95e7c2e8` · `049c1f31` | **ROSSE, e non contano** | **un solo caso**, e non è contesa: `dashboard-catalog` asseriva «nessuna famiglia è attiva finché la pagina non c'è» — la stessa fotografia del momento che avevo corretto nella mig. `000316` e **non avevo cercato nel test**. `#142` F4 le ha attivate, quindi l'asserzione è diventata falsa. Corretta: ora verifica il LEGAME (nessuna attiva senza pagina), che è vero prima e dopo |
| **1** | 2026-08-19 | `ab93af07` | **VERDE** · 1175 s | la corsa che porta il rimedio: **la serie riparte da qui**, perché due rosse l'avevano interrotta |
| **2** | 2026-08-19 | `99b71f9d` | **VERDE** · 1177 s | |
| **3** | 2026-08-19 | `89df7d77` | **VERDE** · 1168 s | **soglia raggiunta** |
| **4** | 2026-08-19 | `04e990c4` | **VERDE** · 1166 s | oltre la soglia |
| **5** | 2026-08-19 | `e9cb8a28` | **VERDE** · 1161 s | oltre la soglia |

✅ **F4 CHIUSA 2026-08-19 (S1072) — 5 corse consecutive verdi, soglia 3.** Lette dalla CI
(`gh run list --workflow=test-integration.yml`), non dedotte.

**Le tre cose verificate prima di contarle**, perché un verde può mentire in tre modi diversi:

1. **I limiti sono davvero quelli bassi**: `apps/api/vitest.config.ts` dichiara
   `testTimeout: 20_000` e `hookTimeout: 30_000`. Se fossero rimasti alzati, queste corse
   proverebbero soltanto che un limite largo copre la contesa — cioè l'aggiramento che questa
   voce esisteva per togliere.
2. **Le corse sono INTEGRALI, non ridotte**: durano **1161-1177 s**, in una fascia di 16
   secondi su cinque esecuzioni. Una corsa che saltasse dei file sarebbe **più corta**, e la
   costanza è ciò che lo esclude senza dover aprire cinque log. (Per confronto: prima delle
   cure di F2 la stessa suite ne impiegava ~1834.)
3. **«Consecutive» regge**: fra la prima e l'ultima ci sono due corse `cancelled`
   (`b655ec31`, `4beb0c54`), che **non sono rossi** — sono state interrotte da un push
   successivo, e una corsa mai finita non dice niente né a favore né contro.

⚠ **Cosa questa serie NON dimostra.** Che il fenomeno sia estinto: non si riproduceva a comando
nemmeno prima, e cinque corse sono una serie, non una prova di assenza. Dimostra che **con i
limiti riportati ai valori di prima degli aggiramenti la suite regge**, che è esattamente ciò che
il «Chiuso quando» chiede. Se tornasse un rosso da tempo, va scritto qui — non tarato via.
