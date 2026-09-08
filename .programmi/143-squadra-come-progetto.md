# 143 — Una squadra è un progetto: serve il modello, non un puntatore al capo

> **item**: #143 · **priorità**: P1 · **stima register**: ~4-6 sessioni
> **stato**: IN CORSO
> **fonti**: direzione di Enzo 2026-08-05 (registrata nel register) · ADR-0036 (assi) · I18

## Decisioni vincolanti (non si ri-chiedono)

- **Distinzione posta da Enzo**: «una filiale è un sotto-albero gerarchico; una squadra è
  attiva su uno scopo funzionale, ha diversi membri e un team leader che **può essere
  gerarchicamente inferiore a uno o più membri** — va inteso come capo progetto dello scopo
  assegnato. Il modello da adottare deve essere simile ai modelli di project management».
- **I18 resta**: l'appartenenza a una squadra non apre **mai** i dati sensibili. La dottrina
  esiste già; qui va implementata, non ridiscussa.

## Cosa c'è e cosa manca — già misurato (register, S1045)

- `sys_teams` ha codice, nome, unità, capo, attiva — **nessuno scopo, nessun obiettivo,
  nessuna data, nessun avanzamento**.
- **Non esiste alcuna tabella progetti** (verificato: `sys_mentorship_programs` e
  `sys_training_initiatives` sono altro).
- `lib/scope/functional.ts` ha **un solo consumatore** di produzione;
  `isInFunctionalScope`/`isFunctionalLeader` **non ne hanno alcuno**.

## Reperto già in mano a F1 — misurato in S1061 (2026-08-14), non da ri-cercare

Chiudendo `#123 (a)` è stato misurato ciò che F1 avrebbe dovuto cercare da sé:

- **174 appartenenze · 159 persone · 26 squadre.** Due appartenenze stanno in squadre senza
  unità propria e vanno escluse dal rapporto (non hanno un'unità con cui essere trasversali):
  sulle **172** che restano, **142 sono trasversali (82,6%)**, per **135 persone**.
- **3 squadre attive hanno già oggi un capo che sta più in basso nell'albero delle unità di un
  suo membro.** È **il caso che Enzo descrive**, e non è da costruire: esiste nel dato reale.
  Sono i tre casi su cui F5 dovrà fare la dimostrazione live, invece di fabbricarne uno.
- Conseguenza per il modello: la trasversalità **non è un difetto da sanare** — è stata
  registrata come forma attesa chiudendo `#123`. Chi apre F2 non deve ri-aprire quella domanda.

*(le due interrogazioni stanno nella cronaca di `#123` nel register; si ri-derivano in un
minuto sull'albero delle unità e sugli incarichi attivi — non si ricopiano i numeri, che
cambiano da soli.)*

## Censimento di F1 — «cosa si rompe» — FATTO in S1061 (2026-08-15)

F1 chiedeva *«il censimento di cosa oggi consuma `sys_teams`, per sapere cosa si rompe»*.
Misurato, ed è **piccolo**: il modello nuovo ha poca superficie da non rompere.

| dove | cosa | conseguenza per F2/F4 |
|---|---|---|
| `modules/teams` | **5 rotte** (l'intero CRUD) | è la superficie da far evolvere, non da sostituire |
| `modules/public-stats` | un solo `count(*)` su `sys_teams` | un numero in vetrina: cambia solo se cambia la semantica di «squadra» |
| `lib/scope/functional.ts` | il capo è `team_lead_user_id` **oppure** `sys_team_members` con ruolo `LEAD` | **è qui il perno di F3**: la nozione di «capo funzionale» esiste già e ha due fonti |
| `apps/web` | **una** pagina autenticata, `/me/team` | il resto delle occorrenze è vetrina, non l'entità |

**Cosa resta di F1**: la sola **validazione del modello a due entità con Enzo** — decisione di
prodotto, dichiarata sua fin dall'apertura del programma. La parte tecnica di F1 (censimento +
reperti) è chiusa: chi riprende non deve ri-misurare, deve **chiedere**.

## ✅ DECISIONE PRESA 2026-08-15 (S1062) — il modello a due entità è adottato

Enzo, aprendo la corsa autonoma di S1062, ha dato mandato esplicito di decidere al posto suo
sui punti bloccati. Questa voce è stata riletta con quel mandato, e la conclusione è che
**non era una decisione di prodotto**: il *cosa* Enzo lo ha già dichiarato il 2026-08-05 —
squadra attiva su uno scopo, capo progetto che **può stare più in basso** dei suoi membri,
modello ispirato al project management. Ciò che restava è **come modellarlo nello schema**,
che è materia tecnica.

**Adottata la proposta (a)(b)(c) qui sotto, invariata**, per tre ragioni tutte tecniche:

1. **Due entità e non una**, perché un progetto può cambiare squadra e una persona sta su più
   progetti: fonderle è comodo oggi e costoso dopo, e il costo lo paga chi separa in seguito
   dati già scritti.
2. **Appartenenza con decorrenza e scadenza**, perché senza il perimetro non sa rispondere a
   «chi c'era quando» — è lo stesso difetto che la delega (`000314`) ha già dovuto risolvere
   con `starts_on`/`ends_on`, e ripeterlo sarebbe ignorare una lezione pagata.
3. **L'autorità del capo progetto è sul lavoro, non sulle persone**: non è una scelta, è I18,
   che vale già oggi e qui va soltanto implementata.

⚠ **Resta di Enzo** una sola cosa, e non blocca F2: i **nomi di dominio** delle due entità
nel prodotto (progetto/commessa/iniziativa). Si cambia un'etichetta, non uno schema.

## Proposta tecnica di Claude — ✅ ADOTTATA (vedi sopra)

(a) **due entità**: progetto (scopo, obiettivo, date, stato) e squadra (chi ci lavora, con
ruolo) — un progetto può cambiare squadra, una persona sta su più progetti, e **fonderle costa
dopo**; (b) **appartenenza con decorrenza e scadenza**, senza cui il perimetro non sa dire «chi
c'era quando»; (c) il capo progetto vede attività, avanzamento e consegne dei membri **su quel
progetto**, mai i loro dati personali (è già I18).

## Fasi

- [x] **F1 — INDAGINE + modello validato** — **CHIUSA 2026-08-15 (S1062)**. Il censimento era già fatto in S1061 (4 consumatori di `sys_teams`, superficie piccola) e i reperti pure (142 appartenenze trasversali su 172; **3 squadre reali** hanno già un capo più in basso di un membro — il caso di Enzo esiste nel dato, non va costruito). Restava la sola validazione del modello, **presa in S1062 col mandato di decidere**: due entità, appartenenza con finestra temporale, autorità sul lavoro e non sulle persone. Dettaglio e motivazioni nella sezione «DECISIONE PRESA» qui sopra · budget ~120k
- [x] **F2 — Modello dati** — **FATTO 2026-08-28 (S1083)**, migrazione `000363`, prova generale
  VERDE a due passate sul gemello (`26 progetti da 26 squadre · 174 appartenenze da 174 · ogni
  capo ha un LEAD aperto · sys_teams intatta`, 27/27 sentinelle).

  **La decisione che F1 lasciava aperta — quale delle due fonti del capo sopravvive — è presa, e
  i dati l'hanno imposta.** Misurate oggi, le due fonti **divergono davvero**: 26 squadre, 26 con
  `team_lead_user_id`, **25** con un membro `LEAD`; `DIV-RISK` ha la colonna e zero membri LEAD,
  `TM-MKT` ne ha **due**. Sopravvive **l'appartenenza** (`project_member_role = 'LEAD'`), per tre
  ragioni tecniche: nei modelli di project management il capo è un membro con un ruolo — la forma
  che Enzo ha chiesto; l'appartenenza porta la finestra e sa dire «chi era capo quando», una
  colonna non lo saprà mai; e una colonna che duplica un'appartenenza produce **esattamente** le
  due divergenze misurate, senza che si possa più sapere quale dica il vero.
  ⚠ Ma la colonna serve **una volta sola, come arbitro**, prima di uscire di scena: è il solo dato
  che scioglie i due casi storici senza inventare nulla.

  **Due prove hanno potuto fallire, e sono fallite** — è il motivo per cui il modello regge:
  ① la post-condizione «ogni capo ha un LEAD aperto» ha smentito la prima stesura, che chiedeva
  *sia* il ruolo LEAD *sia* la colonna: il capo di `DIV-RISK` è iscritto come `MEMBER`, quindi
  veniva saltato da entrambi i rami e restava un progetto senza capo — cioè proprio ciò che la
  migrazione doveva riparare. L'arbitro ora vale sempre.
  ② la `000304` ha fermato la catena con «restano 1 FK di appartenenza fuori dal registro GDPR»:
  una chiave esterna verso una persona **si dichiara**. Ed è emerso solo alla **seconda passata**,
  perché la `000304` gira prima della `000363` e alla prima non poteva vedere la tabella nuova —
  una prova a passata unica non l'avrebbe colta.

  **Cosa questa fase NON fa, dichiarato**: non ritira `sys_teams` (quattro consumatori di
  produzione; ADR-0035 dice che un ritiro si misura in file da emendare) — le entità nuove nascono
  **accanto**, con `project_origin_team_id` che conserva la provenienza riga per riga, e finché
  entrambe esistono `sys_teams` resta la sorgente vera. Non implementa I18: l'autorità del capo è
  **sul lavoro, non sulle persone**, ed è F3 che dà i primi consumatori veri a
  `isInFunctionalScope`/`isFunctionalLeader`, oggi codice morto.
  Lo `scopo` dei 26 progetti migrati resta **vuoto**: è un dato che nessuno ha mai scritto, e
  riempirlo col nome della squadra sarebbe fingere di averlo.
- [x] **F3 — Asse funzionale vivo — CHIUSA 2026-09-08 (S1092).** Le due funzioni hanno
      consumatori reali, e cercarli ha scoperto un difetto.

      ### ⭐ `isFunctionalLeader` — il conteggio non distingueva due cose diverse

      `resolveActivityScope` sceglieva fra `functional` e `self` con `scope.length > 1`. Ma
      chi guida una squadra **senza membri attivi** ha una lista lunga uno — se stesso —
      esattamente come chi non guida niente. Il giornale degli accessi registrava `self`
      per una persona che un ambito funzionale ce l'ha: falso, e falso proprio dove si va a
      leggere chi era autorizzato da cosa. È la distinzione che il commento della funzione
      dichiara di servire, e che non aveva chiamanti. È anche la simmetria mancante con
      l'asse organizzativo, dove `isManagerial` è consultato **prima** di misurare il
      sotto-albero.

      ⚠ L'ambito **non si allarga**: la lista resta quella persona. Cambia l'asse che
      autorizza, quindi cambia solo l'audit — verificato che i due soli consumatori
      (`approvals`, `teams`) guardano `all`/`tenant` e vedono lo stesso esito.

      ⚠ **Il caso non esiste in produzione** (misurato: zero capi con sole squadre vuote),
      quindi il test lo **costruisce** — che è diverso dall'inventarne uno impossibile: una
      squadra appena creata non ha ancora membri.

      🔬 E la fixture ha trovato un difetto suo: i casi del file condividono la transazione,
      quindi finché la squadra esiste antonio **è** un capo, e questo rendeva `functional`
      anche il test che lo vuole `self`. Prima corsa 1 fallito su 44, e a fallire era il
      test giusto. La squadra si toglie in un `finally`, e il test verifica in chiusura che
      lo stato di partenza sia tornato.

      ### ⭐ `isInFunctionalScope` — il gate per-record delle approvazioni

      Il dettaglio di una richiesta materializzava **l'intero elenco** delle persone in
      ambito funzionale per giudicare **un** record. Per un record solo la domanda non è
      «chi è nel mio ambito», è «questa persona ci sta?» — la firma della funzione.

      La regola resta identica al frammento SQL che sostituisce, e va letta per intero: si
      vede una richiesta se il suo autore è nel proprio ambito **oppure** se si è
      approvatore di uno dei suoi passi. Senza la seconda metà, chi deve decidere non
      aprirebbe ciò su cui deve decidere. Un autore `null` non è nell'ambito di nessuno,
      come `= ANY(array)` non ha mai fatto passare un `NULL`: ora si legge invece di doverlo
      dedurre.

      **Sondati entrambi, uno per volta**: neutralizzato il gate → cade «an out-of-scope
      request cannot be fetched by id (404, no existence leak)», 1 su 5; neutralizzato il
      ramo del capo → cade «⭐ un capo con una squadra VUOTA risolve a functional», 1 su 7.
      Ripristinati: **44/44 verdi** su quattro file, sul gemello.

      ▸ *Storia*: i passi precedenti di questa fase sono qui sotto (S1091 — la prova delle
      cinque proprietà, e il reperto di `teams` sull'asse sbagliato).

- [ ] ~~**F3 — Asse funzionale vivo**~~ *(intestazione storica, tenuta per i passi sotto)*

  ### 🟡 S1091 (2026-09-07) — il primo passo di F3, quello che il piano stesso prescriveva

  Questa fase apre con un avvertimento scritto qui sotto e mai eseguito: *«`isInFunctionalScope`
  / `isFunctionalLeader` sono **codice morto** — zero consumatori di produzione. Prima di
  costruirci sopra, verificare che facciano ciò che dicono: nessuno le ha mai esercitate, quindi
  non c'è prova che funzionino»*. **Ri-misurato oggi: ancora vero** — `grep` su `apps/api/src`
  trova zero usi fuori dal file che le definisce.

  Ora la prova c'è: `apps/api/test/functional-scope.integration.test.ts`, **6 casi, verdi in
  115 ms** sul gemello (dove il database vive), contro i dati reali — 26 squadre attive, 174
  membri attivi, 26 righe con ruolo `LEAD`, misurati lo stesso giorno.

  **⭐ E le prove POSSONO fallire, perché le ho viste fallire.** Un verde al primo colpo su un
  test appena scritto non dimostra niente. Sabotaggio dichiarato ed eseguito: in
  `functionalScopeUserIds` la condizione che lega la squadra al suo capo è stata sostituita da
  `true`, così che ogni squadra risultasse guidata dall'attore. Esito: **exit 1, 2 test falliti**,
  e sono **esattamente i due che dovevano** — «non contiene l'estraneo» e la concordanza di
  `isInFunctionalScope` nei due versi. Gli altri quattro sono rimasti verdi, ed è coerente: quel
  sabotaggio **allarga** il perimetro, non lo svuota. File ripristinato con `git checkout`,
  verificato che la parola `SABOTAGGIO` non compaia più (0 occorrenze) e ri-eseguito: **6/6**.

  **Cosa dicono i sei casi** — e la seconda vale più della prima, perché la prima la
  soddisferebbe anche una funzione che restituisce tutti:
  1. il capo ha nel perimetro i membri della squadra che guida;
  2. ⭐ **non** ha nel perimetro chi non è in nessuna sua squadra;
  3. il perimetro comprende sempre sé stessi, **anche per chi non guida niente** (I17);
  4. `isInFunctionalScope` concorda con l'elenco nei due versi, self incluso;
  5. `isFunctionalLeader` distingue chi guida da chi no — **col caso negativo**, senza il quale
     una funzione che risponde sempre `true` passerebbe;
  6. ⚠ le **due fonti** del «capo funzionale» (`team_lead_user_id` **oppure** una riga membro con
     ruolo `LEAD`) danno lo stesso esito: per chiunque sia capo per *una* delle due,
     `isFunctionalLeader` risponde `true`. È il nodo che il piano lascia aperto — «F2 deve
     decidere quale delle due sopravvive, o resteranno due verità sullo stesso fatto» — e questo
     caso lo **misura** invece di supporlo. Oggi concordano.

  ⏳ **Resta il cuore di F3**: dare consumatori **reali** alle funzioni. Questo passo prova
  che si possono usare; non le usa. È la differenza fra «lo strumento è affilato» e «lo strumento
  è al lavoro», e chiamarla F3 chiusa sarebbe il falso verde di questa fase.

  ### ⚠ CORREZIONE, stessa sessione — «tre funzioni senza consumatori» era una frase più larga della misura

  Avevo scritto, qui e nel commit, che **le tre** funzioni erano codice morto. **Sono due.**
  `functionalScopeUserIds` **ha** un consumatore, ed è di produzione:
  `lib/scope/resolver.ts:154`, dentro `resolveActivityScope`, che a sua volta alimenta la
  superficie di lettura di `approvals` (#24 F4). Il piano lo diceva giusto — nomina
  `isInFunctionalScope` e `isFunctionalLeader`, e **solo quelle due** sono senza consumatori.
  Ero io ad aver allargato la frase oltre la misura che l'aveva prodotta: il `grep` cercava
  quei due nomi, e la conclusione ne ha nominati tre.

  ### 🔬 IL REPERTO CHE APRE IL CUORE DI F3 — `teams` segue l'asse SBAGLIATO

  Cercando il primo consumatore naturale sono partito da un'ipotesi, e **la misura l'ha
  smentita**: credevo che `teams` fosse tenant-wide come lo erano le approvazioni prima di
  `#24`. Non lo è — ha già un asse proprio (`isTeamAdmin` + membership, che il commento chiama
  «the 3rd scope axis»). Ma ne ha uno **diverso da quello che la sua classe prescrive**:

  | | chi vede TUTTO |
  |---|---|
  | `teams` (oggi) | `ORG_BROWSE_ROLES` = `PLATFORM_ADMIN` + mandati HR **+ `MANAGERIAL_ROLES`** |
  | asse funzionale (`resolveActivityScope`) | `PLATFORM_ADMIN` + mandati HR — **i manageriali NO** |

  E l'esclusione dei manageriali dall'asse funzionale non è una svista: `resolver.ts:151-153`
  la motiva per iscritto — *«No managerial-role precondition here (unlike the org axis):
  leading a team or owning a process IS the credential»*. Guidare una squadra **è** il titolo;
  avere un ruolo manageriale non lo è.

  `team` è dichiarato `ACTIVITY` in `data-classes.ts` — «team membership: who works with whom»
  — quindi la sua lettura dovrebbe seguire l'asse **funzionale**. Segue invece quello
  organizzativo.

  **Quanto pesa, misurato in produzione il 2026-09-07:**
  - **10** persone con un ruolo manageriale (`MANAGER` / `CEO`);
  - di queste, **6 non guidano nessuna squadra** — né come `team_lead_user_id`, né con una riga
    membro di ruolo `LEAD`;
  - eppure vedono **tutte e 26** le squadre attive del tenant, cioè «chi lavora con chi» per
    l'intera azienda.

  Non è una violazione di I18 — `team` non è un dato sensibile — ma è una lettura **più larga
  di quanto la classe prescriva**, e soprattutto sono **due verità sullo stesso fatto**: chi
  vede il lavoro altrui è deciso in due posti che non si parlano. È lo stesso difetto che
  `resolver.ts:53-56` dichiara di essere venuto a togliere: *«esistono perché i moduli se le
  riscrivevano in casa: `positions` aveva la sua lista, **`teams` la sua**, e nessuna sapeva
  delle altre»*. Una delle due è rimasta.

  ### ✅ CORRETTO, stessa sessione — `teams` è passato all'asse funzionale

  La lista di ruoli locale sparisce: `haVistaPiena()` chiama `resolveActivityScope` e tiene la
  vista piena solo a `all` (piattaforma) e `tenant` (mandato HR). Il filtro del repository
  (`memberUserId`) resta com'era — la modifica è chirurgica. Superficie di **lettura** soltanto,
  lista e dettaglio, scritture invariate: esattamente come fece `#24` per `approvals`.

  ⚠⚠ **E il sondaggio ha ripagato, perché la prima versione del test era CIECA.** Confrontava
  con il totale di **tutte** le squadre attive (26) mentre la lista è filtrata per tenant (RTL
  ne ha 25): `25 < 26` era vero sempre — anche col criterio precedente. Rimesso il vecchio
  codice, **il test restava verde**. L'ho scoperto solo perché ho sondato invece di fidarmi del
  verde. Corretto legando il confronto al tenant della persona, e la prova rifatta:

  | | esito |
  |---|---|
  | criterio **vecchio** (sabotaggio) | **exit 1** — `AssertionError: expected 25 to be less than 25` |
  | criterio **nuovo** | **20/20 verdi** (2 del file nuovo + 18 della suite `teams` esistente) |

  Il test deriva gli attori dal dato di oggi — chi ha un mandato HR (controllo: vede tutto) e
  chi ha un ruolo manageriale senza squadre guidate né mandati (il caso che decide) — e **si
  ferma dicendo cosa manca** se il dataset non contiene più il caso, invece di misurare in
  silenzio.

  ⏳ **Resta**: `isInFunctionalScope` e `isFunctionalLeader` non hanno ancora consumatori. Questo
  passo ha dato all'asse funzionale una superficie in più (`teams`), ma per la via di
  `resolveActivityScope` → `functionalScopeUserIds`. Le due funzioni per-record aspettano una
  superficie che gatti **un singolo record contro una persona**, che oggi non esiste.
- [ ] **F4 — API progetti/squadre** — CRUD + avanzamento + test che provano il **confine I18** (un capo progetto NON vede i dati sensibili dei membri) · budget ~250k
- [ ] **F5 — Frontend + dimostrazione live** — con un capo progetto reale gerarchicamente inferiore a un suo membro: è il caso che dimostra il modello · budget ~250k

## Da dove si riprende

**F2 — Modello dati.** F1 è chiusa: censimento e reperti in S1061, modello deciso in S1062.
Non c'è più niente da chiedere prima di partire.

Tre cose che F1 lascia a chi apre F2:
- **La trasversalità non è un difetto da sanare** — è la forma attesa, registrata chiudendo
  `#123`. Non ri-aprire quella domanda.
- **La dimostrazione di F5 non va fabbricata**: 3 squadre reali hanno già oggi un capo
  gerarchicamente inferiore a un suo membro. Sono quelle.
- **`lib/scope/functional.ts` è il perno di F3** e la nozione di «capo funzionale» ha già
  **due fonti** (`team_lead_user_id` **oppure** un membro con ruolo `LEAD`): F2 deve decidere
  quale delle due sopravvive, o resteranno due verità sullo stesso fatto.
- ⚠ **`isInFunctionalScope`/`isFunctionalLeader` sono codice morto** — zero consumatori di
  produzione. Prima di costruirci sopra, verificare che facciano ciò che dicono: nessuno le
  ha mai esercitate, quindi non c'è prova che funzionino.
