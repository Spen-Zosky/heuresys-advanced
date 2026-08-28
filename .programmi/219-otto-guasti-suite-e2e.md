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
