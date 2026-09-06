# 219 — Gli otto guasti dietro i rossi della suite E2E integrale

> **item**: #219 · **priorità**: P2 · **stima**: ~1-2 sessioni
> **stato**: IN CORSO
> **avanzamento**: 4/5 fasi (F1-F4 chiuse; F5 in corso — F5a/F5b/F5c fatte S1081, resta il
> triage dei 10 falliti, fermo su una causa esterna misurata: `aide` satura la VM di notte)
> **fonti**: `#211` F4 (S1072, 2026-08-19) — il triage completo, con la firma misurata di
> ognuno, vive in `.programmi/211-suite-e2e-completa.md` §F4 e **non si ricopia qui**

## Perché esiste

`#211` ha dichiarato il criterio di verde della suite completa, e quel criterio dice che la
corsa entra in CI **quando i falliti sono zero**. Questa voce è il posto dove quei falliti sono
tracciati: senza, «rosso noto e accettato» scivola in «rosso ignorato», che è esattamente il
difetto per cui 35 rossi sono vissuti invisibili prima di `#211`.

## ⚠ Sono FIRME, non cause

Il triage di `#211` F4 ha raggruppato **12 casi in 8 firme d'errore misurate**. Due firme
diverse possono avere la stessa causa, e una firma può nasconderne due — è successo in `#211`
F3, dove il triage dichiarava «nessuna delle sei è un guasto del prodotto» e **su una si
sbagliava**, ed era l'unica vera. Perciò ogni fase qui sotto **comincia riproducendo il caso**,
non correggendolo.

## Fasi

- [x] **F1 Le due firme che potrebbero non essere guasti** — **FATTO 2026-08-21 (S1077)** · entrambe chiuse, **3 casi su 12** tolti · nessuna delle due era un guasto del prodotto, e in tutti e due i casi la prova era debole per una ragione diversa
      ✅ **`A` — l'ipotesi del triage REGGE, e i due casi sono resi condizionali.** Misurato sulla
      macchina di produzione il 2026-08-21: `MFA_ENFORCEMENT_ENABLED` **è presente e vale
      `false`** — il gate al login è **spento**, per la decisione di Enzo che `SOT_STATE` registra
      dal 2026-08-06 (S1029). I due casi non rilevavano un guasto: **provavano un mondo diverso da
      quello configurato**. Resi condizionali **osservando il comportamento** (la sfida compare? il
      pannello di arruolamento compare?) e non leggendo una variabile — così, se Enzo riaccende il
      gate, tornano a girare da soli senza che nessuno debba ricordarsene. Il verde arriva **senza**
      toccare la configurazione, che era la condizione dichiarata. Typecheck web e api verdi.
      🔬 **E la misura ha trovato dell'altro: un commento che diceva il falso su un interruttore
      di sicurezza.** `apps/api/src/config/env.ts` affermava «PROD/VM/linuxpc leave it UNSET →
      true → zero security regression (mandatory-MFA stays live)». È falso, e la produzione dice
      il contrario. Il commento descriveva l'**intenzione** del progetto e chi lo leggeva ne
      deduceva la **configurazione**: ci sono cascato in questa stessa sessione, arrivando prima
      alla conclusione opposta — «il gate è acceso, l'ipotesi del triage è falsa» — e correggendola
      solo perché `SOT_STATE` la contraddiceva e sono andato a misurare sulla macchina.
      Corretto, con la misura e la data accanto. *(Il default `true` resta giusto: protegge
      chiunque non dichiari nulla. Ciò che PROD fa oggi si misura sulla macchina, non si legge qui.)*
      ⚠ Nota di metodo: i 158 fattori TOTP verificati nel sistema — e quello permanente della
      persona del caso, dal 2026-07-26 — **non** provano che l'enforcement sia attivo. Provano che
      i fattori esistono. Li avevo usati come indizio a sostegno della conclusione sbagliata.
      ✅ **`E` — corretta** (`tenants-editing.spec.ts`). Il caso mandava `tenantCode` +
      `tenantName` e riceveva 400 perché lo schema pretende anche `tenantIndustryCode`
      (obbligatorio dalla `000305`, D-83): la validazione scattava **prima** del controllo di
      permesso. Corretto con body completo — **e con il token CSRF**, che il triage non aveva
      notato: senza, a rispondere sarebbe stato il presidio anti-CSRF, cioè di nuovo la risposta
      giusta per il motivo sbagliato. Aggiunta un'asserzione che rende il caso **rosso su 400**,
      così non può tornare a misurare la validazione senza che si veda. Typecheck verde.
      ⏳ La verifica live di `E` cade nella corsa integrale di **F5**: non è stata eseguita qui.
      **A** (MFA, 2 casi) e **E** (il test che riceve 400). Vanno per prime perché, se
      l'ipotesi regge, si chiudono senza toccare il prodotto — e tolgono **3 casi su 12**.
      · **A**: verificare se `MFA_ENFORCEMENT_ENABLED` è spento in produzione per decisione di
        Enzo (SOT_STATE lo dichiara). Se sì, i due casi provano un mondo diverso da quello
        configurato: vanno resi condizionali alla configurazione, non cancellati.
      · **E**: il caso manda un body **incompleto**, quindi la validazione dello schema scatta
        prima del controllo di permesso e il 400 arriva per la ragione sbagliata. Correzione:
        body **valido** + attesa 401/403, così il caso prova davvero ciò che dichiara.
- [x] **F2 Le due firme con una causa sola e due sintomi** — **FATTO 2026-08-23 (S1078)**, e le cause erano **quattro, non due**. Riprodurre prima di correggere ha pagato tre volte.
      **B** (spiegabilità per-feature, 2 casi) · **C** (l'editor dell'organigramma, 2 casi).

      **B — la firma nascondeva DUE cose, e la seconda è un guasto vero del prodotto.**
      ① *Il test era stantio.* `features` è **mascherato** a chi legge sotto il solo mandato
      di piattaforma (ADR-0032 / #124 D4: il modello è deterministico e i pesi pubblici,
      quindi da `features` il punteggio si ricalcola; e `features[].raw` porta `compBandPct`,
      cioè la spiegazione di un punteggio EVALUATION farebbe passare dati COMPENSATION dalla
      porta di servizio). Entrambi gli spec usavano `storageStateFor("platformAdmin")`:
      **provavano un mondo che l'architettura vieta**, come i due casi MFA di F1/A.
      Misurato con `apps/api/scripts/prova-219-b-spiegabilita.mts`, due attori sugli stessi
      punteggi: piattaforma → **0** con features (156 e 468 dichiarate `masked`); mandato HR →
      **tutte** con features (2 e 3 fattori sul primo). I casi sono stati **rovesciati** —
      ora presidiano il mask — e ne sono nati due nuovi con `tenantAdmin` (mandato HR, I20),
      perché rovesciarli senza aggiungerli avrebbe lasciato «non rende» indistinguibile da
      «rende solo a chi deve». ✅ I due nuovi **verdi live**.
      ② *E la pagina si ROMPEVA.* `selected.value!.toFixed(1)` — un'asserzione di TypeScript
      che a runtime non protegge niente: con `value` mascherato, `undefined.toFixed(1)`
      lanciava e l'**error boundary** sostituiva l'intera sezione con «si è verificato un
      errore imprevisto». Cioè: **per un `PLATFORM_ADMIN`, aprire la spiegazione rompeva la
      pagina**, su entrambe. La tabella il mask lo gestiva già (`MaskedCell` è importato da
      sempre in quei file) — il pannello se n'era scordato. Corretto con `isMasked` +
      `MaskedCell`, gli strumenti che c'erano.
      ⚠ Questo guasto era **invisibile** finché il test moriva prima di arrivarci (sotto).

      **C — la firma registrata dal triage era SBAGLIATA.** Diceva «`orgunit-editor` non
      visibile (30 s)», cioè: l'editor non si apre. Riprodotto, l'errore vero cade prima —
      `locator.click: waiting for getByTestId('organization-edit-E2E-OU-…')`: **il pulsante
      non c'è**, l'unità appena creata non è nel DOM. L'editor non c'entra, non ci si arriva.
      Causa, con un numero: `page.tsx` porta `C4 (#42): server-side pagination (was
      ?limit=200)` — la tabella carica **25 righe** (`initialPageSize`), l'API ordina per
      codice, e con **43** unità un `E2E-OU-…` finisce in pagina 2. Il caso era stantio
      rispetto a un cambiamento di prodotto successivo, come B lo era rispetto ad ADR-0032.
      Rimedio: **si sfoglia** (alzare il limite lo renderebbe verde e cieco al giorno in cui
      le unità superano il nuovo numero). ✅ **Verificato live: 7 passed, 0 failed.**
      🔬 E il primo helper era **verde in teoria e rosso nei fatti**: aspettava che la barra
      di paginazione fosse *visibile* — cosa che è sempre — invece che l'intervallo
      *cambiasse*. Con due sole pagine usciva prima che le righe nuove fossero nel DOM.

      **Il difetto trasversale, trovato mentre si guardava altro.** I quattro casi di
      `insights-*` morivano con «Test timeout of 30000ms exceeded» — un errore che **non
      nomina l'elemento che manca**, quindi non dice niente. La config non impostava
      `timeout`, quindi valeva il default di Playwright (30 s), mentre **47 spec su 100**
      (misurati) dichiarano attese da 45 s o 60 s: un `toBeVisible({ timeout: 45_000 })` in
      un test che muore a 30 s è una promessa che non può essere mantenuta. Portato a 90 s —
      e i guasti veri restano presidiati dai timeout per-azione (10 s / 30 s), che non
      cambiano. È **questo** che teneva nascosto il guasto ②: il test moriva prima di
      arrivare al click.

      ⏳ **Cosa NON è stato verificato live**, e va detto: i due casi *rovesciati* su
      `platformAdmin`. L'ambiente sotto carico (API dev + gateway + `next dev` + tunnel) ha
      cominciato a far cadere i **setup di autenticazione** — non i casi — e insistere non
      aggiungeva evidenza. Cadono nella corsa integrale di **F5**, come già `E` di F1.
      Typecheck e lint del web verdi.
- [x] **F3 Le tre firme rimaste, una per una** — **FATTO 2026-08-23 (S1078)**, tutte e tre riprodotte, corrette e **verificate live**. E in tutte e tre **la firma del triage era imprecisa o sbagliata**: è la terza volta in questa voce, e conferma la sua premessa — *«sono FIRME, non cause»*.
      · **D** (`tenants-editing:31` · `:48`) — la firma diceva «`tenant-notice` non compare dopo
        la creazione». Vero, ma la ragione era **un campo che il caso non sapeva di dover
        compilare**: `tenantIndustryCode`, obbligatorio dalla mig. `000305` (D-83), è un
        `<select required>` — senza, **il browser blocca l'invio**: nessuna chiamata parte e
        nessun avviso può comparire. È **lo stesso campo** che in F1/E faceva rispondere 400 al
        caso lato API: lì fu corretta la richiesta, qui era rimasto il form. Il valore si
        prende ora dal catalogo che la pagina carica, non da un codice cablato. ✅ **11 passed**
      · **F** (`me-team:22`) — la firma diceva «testid duplicato, violazione di strict mode».
        **Non lo era**: `me-team-name` sta dentro un `.map()`, uno per card, e il caso usa già
        `.first()`. La causa vera è un **atteso stantio**: il test pretendeva «Divisione CFO»,
        che è il nome dell'**unità organizzativa** da cui la squadra è derivata
        (`metadata.ou_code: DIV-CFO`) — la squadra si chiama «Squadra CFO», codice `TM-CFO`.
        Misurato con `apps/api/scripts/prova-219-f-mie-squadre.mts`: `GET /v1/me/team` risponde
        **200 con esattamente una squadra**, quindi il perimetro della pagina `/me/*` è
        corretto e non c'era nessun dato altrui. L'atteso ora si **deriva dalla stessa rotta
        che alimenta la pagina**. ✅ **9 passed**
        🔬 E la prima stesura della prova leggeva `items` invece di `teams`, riportando
        «0 squadre»: un difetto della MISURA travestito da guasto del prodotto, che sarebbe
        passato per tale senza la stampa del corpo grezzo messa lì apposta.
      · **G** (`performance-cycle:63`) — la firma diceva «1 ciclo esiste e la pagina ne mostra
        zero: guasto di visibilità o di scope». **Non era né l'uno né l'altro.** Misurato: il
        ciclo c'è (RTL_BANK, `DRAFT`), e il repository usa la **stessa clausola** per contare e
        per elencare, quindi `total` e `items` non possono divergere. Il difetto era nel caso:
        `expect(await locator.count())` è uno **scatto istantaneo che non ritenta**, e cadeva
        mentre la tabella stava ancora caricando — la sezione diventa visibile subito perché è
        l'involucro. Sostituito con `toHaveCount`, che ha l'auto-retry; corretta anche la riga
        gemella sulle sessioni di calibrazione, che oggi passava **per tempismo**. ✅ **10 passed**
- [x] **F4 L'accessibilità, che è l'unica del suo genere** — **FATTO 2026-08-23 (S1078)**, e non toccando il markup: **il caso era VERDE PER VUOTO**, e nessuno poteva saperlo.
      **H** doveva essere «violazioni critiche su `/admin/roles` in vista mobile». Eseguito, il
      caso **passava**. Un verde inatteso non si festeggia, si falsifica: **iniettata di
      proposito un'immagine senza testo alternativo** — che axe classifica `critical` — il caso
      è rimasto **verde**. Il controllo non stava guardando la pagina.
      🔬 Lo dicono due numeri che il referto prima non portava, e che ora porta:
      **17 nodi esaminati**. Lo screenshot del fallimento è uno sfondo vuoto con
      «Caricamento…» al centro: `networkidle` si risolve **mentre la pagina sta ancora
      caricando**, e axe fotografava lo scheletro. Non trovava violazioni perché non c'era
      niente su cui trovarne — e lo stesso valeva in vista **desktop**, quindi non era un
      difetto della vista mobile.
      ⚠ La guardia anti-vacuità che c'era (`audited === route`, nata dai «97 passaggi vacui»
      di S984) intercetta la **sessione morta** — si finiva su `/login`, che è pulito — ma non
      una pagina che risponde sulla rotta giusta **senza renderizzare**. Ne serviva una seconda.
      **Il rimedio, in tre pezzi**: ① si attende il **contenuto renderizzato** (`main *` sopra
      una soglia), non che la rete taccia; ② il referto registra `regoleSuperate` e
      `nodiEsaminati`, così «zero violazioni» si distingue da «non c'era niente da guardare»
      **leggendo il file**, senza rifare la corsa; ③ un'asserzione rende **rosso** il caso che
      esamina un guscio, col numero nel messaggio.
      ✅ **Esito misurato**: `/admin/roles` mobile passa da **17** a **14.023** nodi esaminati,
      e le violazioni sono **0 di ogni severità** — quindi H è davvero risolta, ma prima non lo
      si poteva affermare. Verificate anche `/dashboard` (615) · `/users` (593) ·
      `/organization` (877) · `/organization/org-chart` (547): **12 passed**, nessun rosso
      nuovo. Il rimedio vale per **tutte** le rotte del censimento, che avevano lo stesso
      falso verde in agguato. Typecheck e lint verdi.
- [ ] **F5 La corsa che chiude la voce, e il passaggio in CI** — ⚠ **la stima «~20k, in gran parte
      attesa» è SMENTITA**: una corsa integrale sono **4 fasi** e la sola fase 1 ne dura 5-44 minuti
      a seconda del carico. Una corsa integrale con **0 falliti**; solo allora il criterio di `#211`
      consente di portare la suite in CI, e la voce si chiude con quel passaggio.

  ### Avanzamento S1081 (2026-08-26) — **la suite TORNA A MISURARE**

  Stato prima: `0 passati · 6 falliti · 84 saltati`, e il register attribuiva la causa a
  `admin@heuresys.com`. **Smentito misurando**: i sei setup usano sei **persone reali**, tutte
  `ACTIVE` con identità e fattore MFA. La causa era l'ambiente, non i dati — vedi il preflight.

  Stato ora: **354 passati su 450** · 10 falliti (+3 instabili) · 83 non eseguiti (68 dietro
  `F4_SWEEP=1`, gli altri 15 con la ragione scritta). Fasi: 1 ROSSA · 2 VERDE · 3 ROSSA · 4 VERDE.

  - [x] **F5a Rimettere in piedi l'ambiente** — API accesa (nessuna config Playwright la avvia) +
        `:3000` liberata da un `next start` orfano. Esito: **6 setup verdi in 57,7 s**
  - [x] **F5b Il referto che sopravvive alla corsa** — il solo reporter `list` scriveva su stdout
        e il dettaglio dei 10 falliti si è perso col troncamento. Aggiunto il reporter **JSON su
        file** (`apps/web/esiti-e2e.json`, gitignored)
  - [x] **F5c Il preflight** — le tre cause di rossi-non-guasti (API spenta · `:3000` occupata ·
        VM carica) misurate **prima** di partire e dichiarate accanto all'esito. Provato nei
        quattro versi (si accende · vede la porta · dichiara NON MISURABILE · tace con
        `E2E_PREFLIGHT=0`)
  - [x] **F5d Il triage — FATTO 2026-08-26 a VM scarica: da 10 a 7, e i 3 spariti erano il
        CARICO.** Corsa ripetuta con `aide` finito (load da 3,79 a **0,63**): **360 passati**,
        7 falliti, **0 instabili** (erano 3). Le tre firme, lette dai referti per fase:
    - **a11y (fase 1, 2 pagine × retry)** — `/brownfield-adaptation` esaminata su **21 nodi**,
      `/privacy` su **40**: è la **guardia anti-vacuità di `F4` che funziona** — non dice «c'è
      una violazione», dice «questa pagina non ha renderizzato, quindi il verde sarebbe vuoto».
      Guasto vero, di rendering o di attesa, su due pagine pubbliche
    - **passkey (fase 3)** — `login-mfa-enrollment.spec.ts`, un locator non visibile nel giro
      WebAuthn. Da riprodurre
    - **✅ i due 403 (fase 4) — RISOLTI, e la causa non era quella che sembrava.**
      `performance-cycle.spec.ts` prova «il ciclo dal lato di chi lo conduce» con `tenantAdmin`
      e riceveva 403 su `/v1/performance-reviews` e `/v1/review-cycles`. **Non era un buco di
      disegno**: la `000270` concede quei permessi a `TENANT_ADMIN` da sempre, ed erano
      **spariti dal database**. Li aveva cancellati la `000210` — l'allowlist deny-by-default,
      che *cancella ogni grant fuori elenco* — rimasta applicata **senza le migrazioni
      successive** dopo che il deadlock fra le due sessioni aveva interrotto la catena a metà.
      Riparato riapplicando la `000270` (`INSERT 0 4`) e poi **l'intera catena in ordine**
    - ⚠⚠ **e in mezzo ho ripetuto io lo stesso errore**: per curare il 403 avevo emendato la
      `000210` aggiungendo il permesso all'allowlist, e l'avevo applicata **da sola** — il suo
      `DELETE` ha tolto altri 4 grant (`mappingsLoaded` da 980 a 968). L'emendamento è stato
      **ritirato** (la `000270` è già il posto giusto, con il suo marker dedicato) e lo stato
      ricostruito con la catena intera. Lezione in memoria: *una migrazione auto-riparante
      applicata fuori ordine distrugge ciò che le successive costruiscono*
    - 📌 **la cache RBAC si carica all'AVVIO**: dopo aver rimesso i permessi, l'API continuava a
      negare finché non è stata riavviata. Un 403 che sopravvive alla cura non è sempre un
      permesso mancante
    - ✅ **VERIFICATO, non dedotto (2026-08-26)**: catena riapplicata per intero — **333
      migrazioni, 0 errori** · mapping RBAC **da 968 a 980**, cioè il valore esatto del boot ·
      `mappingsLoaded: 980` all'avvio dell'API · `db_health` **«tutto nei limiti»**, zero
      violazioni dell'organigramma · e i due casi rieseguiti sono **verdi** (`performance-cycle`
      2/2, più i 6 setup). Il danno da catena interrotta è chiuso in tutti e tre i punti in cui
      si vedeva: dati, cache, prova
  - [ ] **F5d-bis I tre guasti veri che restano** (2 a11y + 1 passkey) — ⏸ **fermo su causa
        esterna nella corsa precedente**: `aide --update` (integrità dei file, notturno) satura la VM che ospita il DB
        → pool in timeout → `POST /v1/auth/login` **500** → Playwright vede solo un `waitForURL`
        che non arriva. Lo stesso setup passava in 5,5 s quaranta minuti prima. **Fra le 02:00 e
        la fine di `aide` nessuna misura E2E è attendibile**, e parte dei 10 potrebbe essere
        questa. *Come si riprende*: `ssh oracle-vm-default "cat /proc/loadavg"` (il preflight lo
        fa da sé), poi `cd apps/web && node scripts/e2e-blocchi.mjs`, poi si leggono i falliti
        **dal referto JSON**, uno per uno, con la loro firma
  ### ⭐⭐ S1083 (2026-08-28) — LA CAUSA COMUNE È IL TUNNEL, e non è un guasto del prodotto

  Corsa integrale lanciata **a VM scarica** (`/proc/loadavg` = `0.00 0.04 0.05`: `aide` non
  c'entrava). Esiti per fase, letti dal log e non parafrasati:

  | fase | esito |
  |---|---|
  | 1 — setup + mobile-a11y + a11y-desktop | `1 failed · 4 flaky · 83 passed (38.4m)` |
  | 2 — setup-refresh + chromium | **`4 failed · 89 did not run · 2 passed (15.6m)`** |

  I 4 falliti della fase 2 sono **tutti e quattro `auth.setup.ts`** — platformAdmin, manager,
  employee, outsider — e i setup che cadono trascinano **89 test che non hanno girato**. È
  precisamente il difetto che `e2e-blocchi.mjs` esiste per rendere visibile: «non ho eseguito» non
  è «passato».

  **La causa, misurata nell'API e non dedotta dai sintomi:**
  - il log dell'API porta **47 errori**, tutti della stessa specie:
    `Connection terminated due to connection timeout: Connection terminated unexpectedly` —
    è il **pool PostgreSQL** che non riesce ad aprire connessioni;
  - e il database **non è saturo**: misurato durante la corsa, `pg_stat_activity` dava
    **9 connessioni su `max_connections` = 100**, una sola attiva.

  Fra i due fatti c'è una sola spiegazione: **il collo di bottiglia è il tunnel SSH**.
  `.env` dichiara `POSTGRES_HOST=localhost` sulla porta `5433`, che è l'imbocco del tunnel verso
  la VM Oracle. Una suite E2E integrale apre e chiude connessioni a raffica su decine di test
  paralleli; il tunnel non le regge, l'API riceve timeout, il login risponde 500, e Playwright
  vede solo un `waitForURL` che non arriva.

  ⭐ **È la stessa dottrina già scritta nel CLAUDE.md per il database, mai estesa alla suite**:
  *«il lavoro sul DB si esegue dove il DB vive»* — 17 secondi sulla VM contro ~80 minuti da
  Windows, per la stessa catena. Nessuno l'aveva applicata all'E2E, e per questo ogni corsa da qui
  attribuiva i propri rossi a guasti del prodotto o al carico notturno di `aide`, cercando la
  causa dove non era. **I rossi di una corsa integrale lanciata da Windows sono rumore, non
  misura** — che è, alla lettera, ciò che il commit `ed80fa05` aveva già osservato senza saperne
  il perché.

  **La cura, ed è eseguibile oggi**: la corsa integrale si esegue sul **gemello**, dove il
  database è in casa. Verificato, non supposto: `linux-pc` ha Playwright installato, `.env` con
  `POSTGRES_HOST=localhost` **senza tunnel**, il web vivo su `:3013` (HTTP 200) e **Node 22.19.0
  come default nvm** — quindi nemmeno il wrapper Node 22 serve, perché quello esiste solo per
  Windows (D-36).

  ```bash
  ssh linux-pc 'cd ~/heuresys-advanced/apps/web && pnpm test:e2e:prod'
  ```

  ⚠ E finché non si esegue là, **F5e non è dimostrabile**: chiedere «0 falliti» a una corsa il cui
  ambiente produce da sé i propri rossi è chiedere una prova che non può riuscire.

  #### 🔬 La conferma è arrivata da sé, e vale più della misura che stavo cercando

  Volevo confrontare due raffiche di richieste — una all'API locale, una a quella del gemello — e
  la prima non è mai partita: **l'API locale era morta**, e il suo log dice perché.

  ```
  "msg":"API failed to start"
  Error: Connection terminated due to connection timeout
      at ... loadRolePermissionCache (modules/auth/cache-loader.ts:58)
  ```

  Non è caduta sotto carico: **non è riuscita ad avviarsi**. Il primo atto dell'avvio è caricare
  la cache dei permessi RBAC dal database, e quella singola lettura è andata in timeout
  attraverso il tunnel. Lo stesso era già accaduto all'avvio di questa sessione, dove i primi due
  tentativi erano falliti e il terzo era passato per fortuna (`attempt 1`, `attempt 2` nel log,
  poi `RBAC permission cache loaded`): il ritentativo con backoff è ciò che maschera il difetto
  nell'uso normale, e non basta più quando la macchina è occupata.

  Il gemello, nello stesso momento e sulla stessa rotta (`/v1/public/platform-stats`, che tocca
  il database), risponde: **p50 31 ms**, e sotto una raffica di 40 richieste concorrenti nega
  con un ordinato **429 di rate-limit** — cioè si difende, non si rompe.

  **Questo è il fatto, e la sua conseguenza va oltre la suite E2E**: il tunnel non regge nemmeno
  **l'avvio dell'API**. Ogni corsa lanciata da qui parte da un ambiente che può morire da solo, e
  i suoi rossi non dicono nulla sul prodotto. Spiega anche i `socket hang up` che Next.js
  registrava mentre proxava verso `:3001`: non era un errore di rete, era un'API che non c'era.

  - [ ] **F5e La corsa che chiude** — 0 falliti, poi il passaggio in CI. ⚠ **Da eseguire SUL
        GEMELLO** (vedi il riquadro qui sopra): da Windows il tunnel produce rossi propri, e il
        criterio «0 falliti» diventa irraggiungibile per una ragione che non riguarda il prodotto

## Le prove che devono poter fallire

- **F1/A** — se i due casi MFA diventassero verdi *accendendo* l'enforcement, la correzione
  sarebbe sbagliata: proverebbero una configurazione che la produzione non ha (decisione di
  Enzo). Il verde deve arrivare **senza** cambiare la configurazione.
- **F1/E** — il caso corretto deve diventare **rosso** se si toglie il controllo di permesso
  dalla rotta. Se resta verde, sta ancora misurando la validazione dello schema.
- **F3/F** — il testid duplicato si dimostra contando gli elementi, non leggendo il codice: se
  dopo la correzione il locator ne trova ancora più di uno, la causa era un'altra.

## Chiuso quando

Una corsa integrale della suite E2E riporta **0 falliti**, e la suite entra in CI secondo il
criterio dichiarato in `#211` F4.

  ### S1085 (2026-08-30) — LA PRIMA CORSA CHE ARRIVA IN FONDO A TUTTE E QUATTRO LE FASI

  Eseguita **sul gemello**, come S1083 aveva stabilito. Esito della prima corsa:
  **326 passati · 43 falliti · 78 non eseguiti** su 447 — `fasi eseguite: 4/4, tutte`.
  E' la prima volta: in S1081 le fasi 3 e 4 non venivano nemmeno raggiunte.

  ⚠⚠ **Ma i 43 falliti sono in larga parte rumore che ho causato io, e va detto prima dei
  numeri.** Le firme, lette dai referti JSON e raggruppate, puntano a una causa dominante:
  la connessione rifiutata verso l'API su `127.0.0.1:3001`, piu' una nuvola di «creazione
  non accettata dall'API», «salvataggio non accettato», «assegnazione non accettata» —
  tutte scritture verso quella porta. **Avevo acceso l'API su :3001 per la prova live di
  `#235` e l'ho spenta mentre la corsa girava.** Il preflight lo aveva scritto a chiare
  lettere («API NON raggiungibile su localhost:3001») e l'ho classificato come rumore: e'
  esattamente l'errore che questa voce esiste per non ripetere. Corsa **rifatta** con
  l'API viva per tutta la durata.

  #### Tre difetti d'ambiente veri, trovati eseguendo (questi restano)

  1. **I teardown E2E non avevano credenziali.** `fe_sendauth: no password supplied` su ogni
     `psql` di pulizia: sul gemello l'utente non aveva `~/.pgpass`. Conseguenza: i dati di
     prova restano nel clone. Curato scrivendo `~/.pgpass` (600) dal `.env` della macchina.
  2. **E quei residui rompono la catena delle migrazioni.** Le 4 `E2E-SKILL-%` rimaste hanno
     fatto fallire il clone su «Copertura EN: restano 4 traduzioni mancanti» — una skill di
     prova senza traduzione inglese blocca `db/scripts/migrate.sh`. Ripulite, catena
     riapplicata (341 migrazioni).
  3. **Il build del gemello aveva l'API di PRODUZIONE inlinata** (l'indirizzo della VM): una
     corsa lanciata su quel build avrebbe fatto scrivere alla suite nel database di
     produzione. Le `NEXT_PUBLIC_*` sono inline al build, non a runtime, quindi la corsa va
     preceduta da un `next build` con le variabili giuste.
     ⚠ La prima stesura della guardia cercava il solo indirizzo IP e ha fermato una corsa
     **sana**: quell'indirizzo compare anche come testo dimostrativo in
     `SystemHealthDashboard.tsx`. Si cerca l'URL completo.

  #### ⚠⚠ LA SECONDA CORSA HA SMENTITO LA MIA SPIEGAZIONE, e la smentita vale piu' del numero

  Avevo scritto qui sopra che i 43 falliti erano «in larga parte rumore che ho causato io»
  spegnendo l'API su :3001 a meta' corsa. **Rifatta con l'API viva per tutta la durata:
  327 passati · 42 falliti · 78 non eseguiti** — contro 326 · 43 · 78. Praticamente identica.
  **L'ipotesi era sbagliata**: l'API spenta spiegava le firme che avevo guardato per prime
  (`ECONNREFUSED`), non i falliti. Una misura vera puo' suggerire una conclusione falsa, e la
  correzione resta scritta accanto all'errore invece di sostituirlo.

  **La causa dominante, letta dalle firme della corsa pulita**: sono **403**, cioe' permesso
  negato — `Expected 200/201, Received 403` su **22 occorrenze delle 42**, quasi tutte su
  *scritture* (creazione famiglia, definizione indicatore, inserimento modulo, salvataggio).
  Il resto sono locator non trovati, che possono benissimo esserne la conseguenza a valle.

  **Cosa e' gia' escluso, misurato e non supposto:**
  - i permessi nel database **ci sono**: `sys_auth_role_permissions` = **980** sul clone del
    gemello **e** in produzione, cioe' il valore che il boot dichiara corretto. Non e' la
    `000210` che ha tolto grant (il difetto di S1081);
  - i 403 **non escono dall'API dev su :3001**: il suo log ne porta **2** in tutta la corsa,
    contro le 22 viste dai test. Vengono dall'altra API — quella di produzione del gemello
    su :8013, dove il `next start` di Playwright manda le richieste attraverso il proxy.

  **Da dove riprende F5d-bis**, con una domanda precisa invece che con 42 casi: *perche' l'API
  su :8013 nega una scrittura che il ruolo ha il permesso di fare?* Le tre piste, in ordine di
  costo: ① il **CSRF** — i test prendono il token da un'API e scrivono verso l'altra, e un
  token non riconosciuto risponde **403** esattamente come un permesso mancante; ② la **cache
  RBAC**, che si carica all'avvio e non si accorge di una catena riapplicata sotto
  (memoria `selfhealing_migration_out_of_order_destroys`); ③ un permesso davvero mancante per
  quegli attori, che il conteggio a 980 non esclude riga per riga.
  ⚠ La prima pista e' anche un **difetto dell'impianto di prova**, non del prodotto: la corsa
  gira con `NEXT_PUBLIC_API_PROXY_BASE_URL=:8013` mentre i test chiamano `:3001`. **Due API in
  gioco nella stessa corsa**: finche' e' cosi', nessun 403 e' interpretabile.


---

## ⭐⭐ S1087 (2026-09-05) — LA CAUSA COMUNE NON ERA IL TUNNEL: ERA LA 3001

S1083 aveva concluso «il collo di bottiglia e' il tunnel SSH» e prescritto la corsa sul gemello.
La cura era **giusta come pratica** e la diagnosi **sbagliata come causa**, e si e' visto solo
eseguendola davvero.

**La misura.** Corsa integrale sul gemello — dove il DB e' in casa e **il tunnel non c'e'** —
con l'API viva e sana: `journalctl` dell'API riporta **zero** «Connection terminated», **zero**
timeout di pool, **zero** errori. Esito:

```
[WebServer] Failed to proxy http://localhost:3001/v1/auth/login
            Error: connect ECONNREFUSED 127.0.0.1:3001
4 failed (i quattro auth.setup) · 1 flaky · 82 did not run · 1 passed (14.2m)
```

Gli **stessi** quattro setup e gli **stessi** 82 test non eseguiti di S1083. Il tunnel non c'era,
il guasto era identico: **il tunnel aveva preso la colpa di questo**.

**La causa vera, ed e' due volte lo stesso ripiego cablato:**

| file | riga | ripiego |
|---|---|---|
| `apps/web/next.config.js` | 17 | `... \|\| "http://localhost:3001"` |
| `apps/web/scripts/e2e-blocchi.mjs` | 107 | `... \|\| "http://localhost:3001"` |

Il web che Playwright avvia e' **un altro processo** e non eredita
`NEXT_PUBLIC_API_PROXY_BASE_URL` da nessuna parte: l'unit systemd ce l'ha, quel web no. Quindi
ripiegava sulla 3001 e ogni login moriva in `ECONNREFUSED`, i quattro setup andavano in
`waitForURL` timeout, e 82 test non giravano.

⭐ **Ed e' anche la risposta a una domanda aperta da S1086** — «di chi e' la 3001?». Di
**nessuno**: `mappa_porte.py --intrusi` conferma che non e' occupata. Non era del datastore, non
era della CI: era solo questo ripiego, scritto in due file.

**La correzione**: la base dell'API si deriva una volta sola e si **passa** al processo
Playwright; `next.config.js` deriva da `PORT` e, se finisce sul ripiego, lo **dice** con un
warning che nomina la riga colpevole.

### ⚠ Un secondo fatto strutturale, misurato nello stesso giro

Il gemello fa **tre mestieri insieme**: clone di produzione, **runner della CI** e desktop.
Misurato durante la corsa: `git` al 124%, `Runner.Worker` al 58%, `gnome-software` all'86%,
load 3.12. Il preflight lo dichiara (e ora nomina la macchina giusta, non «la VM»).

**Conseguenza operativa per F5e**: la corsa che chiude la voce va lanciata **quando la CI non
gira**, altrimenti la macchina e' carica per costruzione e i rossi tornano non attribuibili —
che e' la stessa trappola di `aide` sulla VM, su un'altra macchina e per un'altra ragione.


### La prova: fase 1 da `4 failed` + 82 non eseguiti a **88 passed**

```
prima (manifest verso :3001)   4 failed · 1 flaky · 82 did not run ·  1 passed (14.2m)
dopo  (manifest verso :8013)   0 failed · 0 flaky ·  0 did not run · 88 passed (19.3m)
                               fase 1  VERDE
```

Prova pulita: **stessa macchina, stesso carico, stessa suite** — e' cambiata solo la
destinazione compilata del proxy.

### E la 3001 era scritta in un TERZO posto: nel `.env` stesso

La corsa verde ha lasciato un residuo che **non fa fallire nulla e degrada in silenzio**:

```
[auth.setup] locale baseline restore skipped for platformAdmin:
             Error: apiRequestContext.patch: connect ECONNREFUSED 127.0.0.1:3001
             (idem per tenantAdmin, manager, employee, outsider, custodian)
```

I fixture E2E leggono `NEXT_PUBLIC_API_BASE_URL`, che la config di Playwright idrata dal `.env`
del repo — e il `.env` **del gemello** dichiarava quella variabile sulla porta 3001. Non era il
ripiego del codice a scattare: la porta sbagliata era scritta nel `.env`, un valore stantio che
in produzione l'unit systemd sovrascrive e che quindi nessuno vedeva, ma che i test raccolgono.

Corretto sul gemello alla porta 8013, con backup del file.

**Tre posti, la stessa porta, tre modi diversi di nasconderla**: un ripiego cablato nel config
del web, uno nello script della suite, e una dichiarazione stantia in un file gitignored. E' il
ritratto di come un valore sbagliato sopravvive a tre sessioni di caccia.


---

## ✅ F5d — IL TRIAGE, FATTO SUL VIVO (2026-09-05, S1087)

Corsa integrale a quattro fasi sul gemello, con l'ambiente riparato. Triage completo,
raggruppato per FIRMA e non per file, in `.programmi/219-triage-2026-09-05.txt`.

| fase | attesi | non riusciti | saltati |
|---|---|---|---|
| 1 — setup + mobile-a11y + a11y-desktop | 88 | **0** | 0 |
| 2 — setup-refresh + chromium | 83 | 9 | 3 |
| 3 — setup-refresh-2 + chromium-2 | 69 | 17 | 68 |
| 4 — setup-refresh-3 + chromium-3 | 85 | 18 | 7 |

**ROSSO: 44 falliti, 78 non eseguiti** — e la fase 1 e' **verde piena**, dove prima della
correzione di oggi dava `4 failed · 82 did not run · 1 passed`.

### La firma dominante, isolata: `403` sulle SCRITTURE

Le due famiglie piu' numerose sono in realta' **la stessa cosa detta in due modi**:

```
[6x] expect(received).toBe(expected)   ->  Expected: 200 · Received: 403
[9x] «creazione non accettata» / «assegnazione non accettata» /
     «definizione indicatore non accettata» / «inserimento modulo non accettato» / …
```

Le seconde sono messaggi propri degli spec che avvolgono lo stesso rifiuto. Sommate, sono
**oltre un terzo dei 44**, e riguardano tutte una **scrittura fatta dal browser**.

### Due ipotesi vive, e come si distinguono

Sono state **escluse** misurando, non per esclusione logica:

| ipotesi | verdetto | misura |
|---|---|---|
| cache RBAC stantia sull'API del gemello | ❌ **esclusa** | l'API gira dal 2026-09-04 con `mappingsLoaded: 980`, e il DB del gemello ne ha esattamente **980** |
| grant persi dalla `000210` fuori ordine | ❌ **esclusa** | gemello 980 · produzione 986, e la differenza sono **esattamente le 6 concessioni della `000374`** applicata oggi solo in produzione |
| `NEXT_PUBLIC_API_BASE_URL` che ho cambiato oggi | ❌ **esclusa** | quella variabile **non compare in `apps/web/src`**: il browser passa dal proxy same-origin `/api/*`, non da lei |
| **CSRF dopo il `setup-refresh`** | 🔎 **VIVA** | la fase 1 non fa scritture ed e' verde; le fasi 2-4 cominciano tutte con un **re-login**, e sono le sole che falliscono in scrittura |
| **permesso davvero mancante** per quelle persone sul clone | 🔎 **VIVA** | non ancora misurata |

**Come si distinguono, in una prova sola**: login via API come la persona del caso sul
gemello, poi la stessa POST **con** il token CSRF fresco. Se passa, e' il CSRF che il
re-login rigenera mentre lo `storageState` salvato porta ancora il vecchio; se da' 403
anche cosi', e' il permesso. ⚠ La password si **deriva per-email** (Z-262), non e' una
costante: e' il passo che rende la prova meno immediata di quanto sembri.

### Due falliti sono gia' corretti, e non da riparare

`handbook-media.spec.ts` e `mfa-policy-admin.spec.ts` cadono su
`apiRequestContext: connect ECONNREFUSED 127.0.0.1:3001` — sono **esattamente i due spec**
che il commit `89f26862` di oggi ha fatto importare `API_BASE` da `fixtures.ts` invece di
ri-derivarlo con il ripiego cablato. Il gemello aveva ancora il codice vecchio quando la
corsa e' partita. Alla prossima corsa spariscono da soli.

### Cosa resta per F5e

Sciogliere il 403 delle scritture (una causa, oltre un terzo dei falliti), poi rilanciare.
⚠ E lanciarla **quando la CI non gira**: il gemello e' anche il runner, e durante questa
corsa il carico era oltre 3 con `Runner.Worker` al 58%.


---

## ⭐⭐ LA CAUSA VERA DEI 44, e non era nessuna delle due ipotesi di F5d

Le due ipotesi che F5d aveva lasciato vive sono state **smentite misurando**, e restano
scritte perche' il modo in cui sono cadute vale piu' della conclusione:

```
POST /v1/approvals  SENZA token CSRF  ->  400 VALIDATION_ERROR
```

Un 400 di validazione dimostra **due cose insieme**: la chiamata era passata attraverso
RBAC (quindi **non e' il permesso**) e non era stata fermata dal double-submit (quindi
**non e' il CSRF**). Una misura sola, due ipotesi cadute.

**Quello che c'era davvero**, misurato subito dopo sul gemello:

```
apps/api/dist/server.js   costruito il 3 SETTEMBRE
repo                      a 0a5b8f83, di oggi
```

L'API gira da un **bundle**, non dai sorgenti: un `git pull` aggiorna i file e **non tocca
il bundle**. La corsa ha percio' provato un frontend ricostruito oggi contro un'API vecchia
di due giorni, e la gran parte dei 44 erano scritture rifiutate da un contratto che non era
piu' quello — fra cui un login che **non restituiva piu' `csrfToken`**, campo che ogni test
si aspetta di leggere dalla risposta.

### E' la TERZA volta oggi che la causa sta in un artefatto generato

| # | artefatto | cosa nascondeva |
|---|---|---|
| 1 | `.next/routes-manifest.json` | il proxy `/api/*` compilato verso la 3001 |
| 2 | `.next/` servito da un `next start` non riavviato | un build precedente al `git pull` |
| 3 | `apps/api/dist/server.js` | l'API costruita due giorni prima degli spec |

Nessuno dei tre si trova cercando nel codice: sono **gitignored per costruzione**, ed e' la
stessa specie di punto cieco gia' registrata in memoria per i rename. Il preflight ora ne
guarda due su tre (manifest e bundle); il terzo lo copre gia' il controllo sulla porta.

### Stato dell'ambiente alla fine di S1087

- gemello allineato a `f09720cd`, `pnpm install` + `shared build` + **`api build`** rifatti,
  API riavviata (bundle 1.92 MB, coi due moduli nuovi di `#54`);
- web ricostruito con la destinazione giusta del proxy;
- preflight **pulito su tutti i controlli tranne uno**.

### ⚠ Perche' la corsa di conferma NON e' stata lanciata

Il preflight dichiara la macchina carica (**load 4.08**), e la causa misurata non e' la CI:
e' **`gnome-software` all'86% di CPU**, un processo del desktop. Lanciare una corsa che il
preflight ha appena dichiarato non attribuibile sarebbe ignorare lo strumento costruito
poche ore prima per non farlo.

**La corsa di conferma e' il primo passo della prossima sessione**, e va lanciata a macchina
scarica — verificando `/proc/loadavg` e che `gnome-software` non stia macinando. Con
l'ambiente ora coerente, e' la misura che dice quanti dei 44 erano davvero guasti del
prodotto: la fase 1, gia' verde a 88/88, suggerisce che siano molti meno.

---

## ⭐⭐ S1088 (2026-09-06) — LA CORSA DI CONFERMA, E LA CAUSA DEI 403 È IL PRESIDIO CSRF

**Ambiente rimesso in coerenza prima di partire**, e il preflight ha trovato da sé un difetto
che avrebbe reso i rossi non attribuibili: il bundle dell'API sul gemello era delle **17:34**
e il commit `b3723129` (modulo `candidates` di `#54` F3) delle **17:56** — cioè la stessa
specie di guasto di S1087, un artefatto generato più vecchio del sorgente, intercettato
questa volta **prima** della corsa e non dopo. Rifatto (1.93 MB), API riavviata,
`mappingsLoaded: 986` (a fine S1087 il gemello ne aveva 980: ora combacia con la produzione).
Gemello allineato a `b28081d8`, `@heuresys/ui` 1.0.0 → 1.1.0, web ricostruito verso `:8013`.
Preflight `EXIT=0`, CI ferma, load `1.38`.

### La misura

```
fase 1  VERDE   88 passati ·  0 falliti ·  0 non eseguiti   (13.9m)
fase 2  ROSSA   83 passati ·  9 falliti ·  3 non eseguiti   ( 6.6m)
fase 3  ROSSA   70 passati · 16 falliti · 68 non eseguiti
fase 4  ROSSA   86 passati · 17 falliti ·  7 non eseguiti
                327 passati · 42 falliti · 78 non eseguiti  su 447 · fasi 4/4
```

Triage per firma in `.programmi/219-triage-2026-09-06.txt`, prodotto dal nuovo
`apps/web/scripts/e2e-triage.mjs` (il triage era stato rifatto a mano tre volte senza
lasciare uno strumento).

### ⚠ La ricostruzione del bundle NON ha spostato il numero: 42 contro i 44 di S1087

S1087 aveva concluso che i 44 falliti erano «scritture rifiutate da un'API vecchia di due
giorni». Il bundle è stato ricostruito, l'API riavviata, e i falliti sono **42**. È la
**quarta** ipotesi di questa voce che cade misurando — dopo `aide`, il tunnel e l'API spenta.
Resta scritta accanto alla correzione, perché il modo in cui cade vale più della conclusione.

### La causa vera, e questa volta non ammette alternative

**① Il 403 è la firma dominante, e la firma da sola non basta a nominarlo.** Misurato nel log
dell'API: **98 risposte 403** durante la corsa, di cui **77 su scritture**. Ma
`CsrfFailedError` e `ForbiddenError` rispondono **entrambe 403**
(`middleware/errorHandler.ts:41` e `:49`): dallo status non si distingue un permesso negato da
un token non combaciante. È il motivo per cui tre triage successivi hanno attribuito questi
rossi ai permessi.

**② Le ipotesi «permesso» e «concorrenza» sono ESCLUSE, misurando.**

| ipotesi | verdetto | misura |
|---|---|---|
| permesso mancante | ❌ esclusa | `TENANT_ADMIN` ha `approval:create` e i 5 permessi `content:*`; `federica.marchetti` legge senza problemi nello stesso file |
| grant persi / cache RBAC | ❌ esclusa | gemello **986** mapping = produzione, `mappingsLoaded: 986` all'avvio |
| concorrenza fra worker | ❌ esclusa | `playwright.config.ts`: `workers: 1`, `fullyParallel: false` — non c'è parallelismo |
| stato accumulato nella corsa lunga | ❌ esclusa | `approvals.spec.ts` **da solo**: `1 failed · 6 passed (38.4s)` — riproducibile, deterministico |
| origine non ammessa (`ORIGIN_MISMATCH`) | ❌ esclusa | **199 scritture riuscite** nella stessa corsa: se l'origine fosse rifiutata non ne passerebbe nessuna |

**③ La prova che chiude, ed è una rotta che non ha permessi da negare.**

```
POST /v1/auth/refresh   ->  403, quattro volte su quattro
apps/api/src/modules/auth/routes.ts:146   preHandler: [app.verifyCsrf]
```

Quella rotta **non ha `requirePermission`**, non ha org-gate, non ha scope: l'unico preHandler
è il presidio CSRF. Un suo 403 può venire da lì e **da nient'altro**. Non è più un'ipotesi da
riprodurre: è misurata su un caso in cui nessuna causa alternativa è disponibile.

**④ E il quadro torna in ogni punto:**
- la **fase 1 non fa scritture** e produce **zero** 403 (il primo compare alle 03:04, cioè
  appena finita); le fasi 2-4 cominciano tutte con un `setup-refresh`, e sono le sole rosse;
- la **stessa rotta** prende sia 200 sia 403 — `PATCH /v1/me/preferences` **26 ok e 4 negati**,
  `POST /v1/skills` 4 create e 2 negate: dipende dalla sessione, non dalla rotta né dal ruolo;
- i 403 colpiscono anche `/v1/me/*`, che per **I17** nessun permesso può negare: il CSRF gira
  **prima** di ogni scope.

### 🔬 Il difetto strutturale che tiene la sessione morta: il rinnovo è protetto da ciò che deve rinnovare

`POST /v1/auth/refresh` restituisce un **csrfToken nuovo** e riscrive i cookie — è la via con
cui una sessione disallineata tornerebbe allineata. Ma è **essa stessa dietro `verifyCsrf`**:
se il token è già disallineato, il rinnovo viene rifiutato per la stessa ragione che avrebbe
dovuto curare, e da lì in avanti ogni scrittura di quella sessione fallisce senza via d'uscita.
Non è un difetto dei test: è del disegno del presidio.

### Cosa resta per chiudere F5e

Riallineare cookie e header CSRF dopo il `setup-refresh` — e decidere se `/v1/auth/refresh`
debba restare dietro il presidio che rende irreversibile il disallineamento. Poi rilanciare la
corsa integrale a macchina scarica. ⚠ Il gemello è anche il runner della CI: si guarda
`/proc/loadavg` **e** che `gnome-software` non stia macinando.

### ✅ La correzione, e la corsa che la misura: da 42 falliti a 6

**La causa non era il token**, ed è il trace ad averlo detto: nel caso fallito header e
cookie CSRF **combaciavano** e la risposta era comunque 403. A rifiutare era il *secondo*
controllo di `verifyCsrf`, quello sull'origine — che nessuno guardava perché risponde con
lo stesso codice di un permesso negato.

Provato su `/v1/auth/refresh` (nessuno schema di body, nessun `requirePermission`: un suo
403 può venire solo dal presidio), tre chiamate identiche, sola differenza l'header:

```
Origin http://192.168.1.11:3013  (dichiarata)      ->  HTTP 200
Origin http://localhost:3000     (il browser E2E)  ->  HTTP 403 ORIGIN_MISMATCH
senza Origin                                       ->  HTTP 401 (il controllo si salta)
```

Ed è per questo che la stessa rotta mostrava sia 200 sia 403 (`PATCH /v1/me/preferences`:
26 ok, 4 negati): passavano le chiamate fatte da `page.request`, che non hanno `Origin`;
fallivano quelle fatte **dalla pagina**. E per questo la fase 1, che non scrive dal
browser, era verde piena.

`ADMIN_ORIGIN` accetta ora un **elenco** di origini (commit `955d1853`) — chiuso,
dichiarato, confrontato per uguaglianza esatta come prima. Il `.env` del gemello dichiara
le due che quella macchina serve davvero, API ricostruita e riavviata. Corsa integrale
rifatta subito dopo, stessa macchina, stesso carico:

```
                prima            dopo
fase 1   88 ·  0 ·  0      88 ·  0 ·  0     VERDE piena
fase 2   83 ·  9 ·  3      91 ·  1 ·  3
fase 3   70 · 16 · 68      83 ·  3 · 68
fase 4   86 · 17 ·  7     101 ·  2 ·  7
        327 · 42 · 78     363 ·  6 · 78     (passati · falliti · non eseguiti)
```

**I 78 non eseguiti non sono rossi**: ognuno porta la sua ragione dichiarata — 67 sono il
censimento dietro `F4_SWEEP=1`, gli altri sono catture on-demand o casi che su questo
dataset non hanno soggetto.

### I sei residui, e nessuno di loro è una scrittura negata

| caso | firma |
|---|---|
| `compensation-read` — il pannello del calcolo verso un mandato solo tecnico | locator non visibile |
| `matching-freetext` × 2 — indice semantico su competenze e occupazioni | locator non visibile |
| `landing-pages` — `/me` con ruolo, saluto e card | conteggio diverso dall'atteso |
| `serie-a-panels` — `#30` pannello gap-closure | locator non visibile |
| `session-refresh` — `D-26` rinnovo silenzioso senza logout | attesa scaduta |

La famiglia dei 403 sulle scritture — **oltre un terzo dei falliti in tre sessioni
consecutive** — è sparita per intero. I sei che restano sono guasti di natura diversa, da
riprodurre uno per uno secondo la dottrina di questa voce: sono firme, non cause.

⚠ `session-refresh` merita di essere guardato per primo: prova il rinnovo silenzioso della
sessione, cioè la stessa rotta al centro della diagnosi di oggi. Che fallisse anche prima
non lo assolve — significa solo che non era il 403 dell'origine.

### Il controllo che ora impedisce il ritorno del difetto

Il preflight interroga l'API — **non legge il `.env`**, perché il file dice cosa è scritto
e la risposta dice cosa quel processo sta applicando, e fra i due c'è un riavvio. ⚠ La
prima stesura di quella sonda usciva **VERDE su un ambiente rotto**: senza token la
richiesta moriva sul double-submit e non arrivava mai al controllo sull'origine — un
controllo che non poteva vedere il difetto per cui esisteva. Corretta mandando cookie e
header uguali fra loro, e provata nei due versi (rossa prima della correzione, verde dopo).

### I sei residui: due famiglie, misurate riproducendoli (S1088)

**Eseguiti in isolamento, ne fallisce UNO su sei.**

⚠⚠ **E QUESTA FRASE ERA FALSA QUANDO L'HO SCRITTA — l'errore è mio e lo lascio scritto
accanto alla correzione.** La riproduzione girava con `--project=chromium`, che contiene
**solo gli spec della fase 2**: i quattro casi delle fasi 3 e 4 non sono stati eseguiti
affatto, e Playwright non lo dice — li omette in silenzio. Il «9 passed» che leggevo erano
gli altri casi di `compensation-read`. Ho quindi classificato come «passano da soli»
quattro test **che nessuno aveva eseguito**.

È, alla lettera, il difetto per cui `#219` e `e2e-blocchi.mjs` esistono: **«non eseguito»
non è «passato»** — e ci sono cascato mentre stavo lavorando proprio a quello. Il progetto
giusto va nominato per fase (`chromium` = fase 2, `chromium-2` = fase 3, `chromium-3` =
fase 4), e un `--project` sbagliato produce un verde vuoto.

Ciò che resta vero dopo la ri-misura: la distinzione fra un caso che cade **sempre** e uno
che cade **solo nella sua fase** è utile, e le due famiglie qui sotto sono quelle
confermate eseguendo davvero.

| caso | da solo | nella sua fase | famiglia |
|---|---|---|---|
| `compensation-read` | ❌ **rosso** | rosso | guasto proprio |
| `matching-freetext` ×2 | *non eseguito* | ❌ rosso | **flag spenta sul gemello** |
| `landing-pages` | ✅ verde (`chromium-2`) | ❌ rosso → ✅ **corretto** | caso verde **per tempismo** |
| `serie-a-panels` | *non eseguito* | (fase 4) | da riprodurre |
| `session-refresh` | *non eseguito* | (fase 4) | da riprodurre |

#### ✅ `compensation-read` — CHIUSO, ed era un guasto vero del prodotto

Per un `PLATFORM_ADMIN`, aprire il pannello di valutazione **rompeva l'intera sezione**
(error boundary, misurato nell'`error-context`). ADR-0032 non mette `null` al posto di un
valore trattenuto: lo **toglie**. Il pannello controllava `finalFactor !== null`, ma il
campo arriva `undefined` — `undefined !== null` è vero — e `.toFixed(4)` lanciava.

⭐ **La causa a monte, che è la parte che conta**: il frontend ridichiarava **a mano**
`VariablePayEvaluationView` invece di usare il tipo condiviso. La copia diceva
`finalFactor: number | null` e non conosceva `masked`: affermava cioè che il campo c'è
sempre. Con un tipo che mente sul contratto, TypeScript non poteva segnalare niente.

🔬 **La prova vale più del verde**: rimesso il difetto a mano dopo aver sostituito il tipo,
**il build non compila più** — `TS18048: 'q.data.finalFactor' is possibly 'undefined'`.
Prima lo stesso codice passava e arrivava in produzione. Il guasto non è solo corretto: è
diventato impossibile da reintrodurre in silenzio.

E **il caso contraddiceva la decisione che dichiarava di presidiare**: pretendeva
`comp-evaluation-gates` a zero, mentre `#124` D3 dice che al mandato solo tecnico
**restano** il ragionamento dei cancelli e la curva, e spariscono i numeri. Misurato sulla
risposta reale: `masked` porta `attainment, curveExplanation, curveFactor, finalFactor,
recordedAmountEur`; i cancelli arrivano — 7 voci, `ALLOW`, spiegazione presente. Il caso
restava verde solo perché la pagina si rompeva prima di arrivarci. Riscritto con l'atteso
**derivato dalla risposta**. ✅ 10 passed.

#### ✅ `landing-pages` — il caso chiedeva alla PAGINA di essere un confine di sicurezza

Asseriva `provenance-page` a zero per chi non ha `provenance:read`. Ma questo progetto
dichiara il contrario, e per esteso, in `generated-origins/page.tsx`: *«l'isolamento NON è
qui: è nel servizio. Una pagina non è un confine di sicurezza»*. `/provenance` rende infatti
il proprio guscio a chiunque digiti l'URL — è l'**API** che nega con 403.

E passava **per tempismo**: `toHaveCount(0)` è verde nell'istante in cui l'elemento non è
*ancora* comparso. Da solo la pagina è più lenta e il caso passava; dentro la fase 3, a cache
calda, l'elemento faceva in tempo a comparire e diventava rosso. Un'assenza misurata così
prova un ritardo, non un'assenza — stessa specie del difetto già corretto in F3/G.
Riscritto su ciò che separa davvero: **il sommario risponde 403** e il guscio resta.

#### 🔎 `matching-freetext` ×2 — la causa è l'AMBIENTE, non il prodotto

`getByTestId('semantic-search-skill-row')` non compare in 20 s. Letto nel log dell'API
invece che dedotto dalla firma, il motivo è netto:

```
GET /v1/matching/search?q=gestione%20del%20rischio%20bancario  ->  404 in 1 ms
```

**404 in un millisecondo** non è una ricerca che non trova nulla: è una rotta che **non
esiste**. È dietro una flag, e la flag diverge fra le due macchine — `MATCHING_FREETEXT_ENABLED=true`
è dichiarata **in produzione** e **manca nel `.env` del gemello**. La suite prova quindi una
funzione che su quella macchina non è accesa.

⚠ Nota di costo, che è una decisione e non un dettaglio: ogni ricerca è una **chiamata a
pagamento** al fornitore di embedding. Accendere la flag sul gemello significa spendere due
chiamate per corsa integrale.

#### Un difetto d'ambiente trovato eseguendo

Alla fine di una fase resta un **`next-server` orfano sulla :3000** (misurato: pid vivo, il
servizio del gemello sta sulla :3013 ed era sano). La corsa successiva muore subito con «porta
già in uso» — è precisamente ciò che il preflight controlla, e che qui si è visto accadere.

#### ✅ `matching-freetext` ×2 — CHIUSI, e la causa era **una riga del `.env` senza a-capo**

La firma diceva «la ricerca semantica non restituisce righe». Letto il log dell'API invece
che dedotto, la catena è venuta fuori in tre misure, ognuna che smentiva la lettura
precedente:

1. **`404` in 1 millisecondo.** Non una ricerca che non trova nulla: una rotta che **non
   esiste**. È dietro `MATCHING_FREETEXT_ENABLED`, dichiarata `true` **in produzione** e
   **assente** dal `.env` del gemello.
2. Accesa la flag e riavviata l'API: **`500`**, e il log lo nomina —
   `Voyage embed failed: HTTP 401 — Provided API key is invalid`.
3. E la chiave *c'era*. Il difetto vero: nel `.env` del gemello **mancava un a-capo**, e il
   valore della chiave aveva **inglobato la variabile successiva**. Il file resta
   sintatticamente accettabile — nessun parser protesta — ma una variabile porta un valore
   sbagliato e l'altra **sparisce del tutto**. È così che la flag risultava mancante: non
   era mai stata tolta, era finita dentro un'altra riga.

Riparato con uno strumento che spezza le righe a doppia assegnazione e **non stampa mai un
valore** (`/tmp/ripara-env.py`; un rapporto che mostra i segreti è peggio del difetto che
descrive), rimosso il duplicato che ne è emerso, API riavviata. ✅ **8 passed**.

⚠ **Vale oltre questo caso**: un `.env` a cui manca un a-capo non dà errore da nessuna
parte. Si manifesta molto più tardi, come un servizio esterno che rifiuta le credenziali —
e la diagnosi parte naturalmente dal servizio, cioè dal posto sbagliato.

📌 Nota di costo, che è una decisione e non un dettaglio: ogni ricerca è una **chiamata a
pagamento**. La flag ora accesa sul gemello significa due chiamate per corsa integrale.
