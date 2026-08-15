# MANDATO — ciclo di autocoscienza e redenzione

> 📦 **ARCHIVIATO S1064 (2026-08-15) — documento storico, NON stato.** Visse in `.programmi/`,
> che è la corsia di ciò **da cui si riprende**: un mandato concluso lì dentro faceva uscire
> rosso `programmi.py --verifica` («nessuna fase — un programma senza fasi non è ripartibile»),
> e la diagnosi giusta non era aggiungergli fasi finte a posteriori, ma riconoscere che non è
> mai stato un programma multi-sessione. Il suo esito vive in `SOT_STATE.md`; le quattro
> scoperte che ha prodotto sono nel register (`#190` e `#191` chiuse, `#192` chiusa in S1064).

> **origine**: mandato di Enzo, S1062 (2026-08-15), non eseguito perché la finestra 5h era all'82%
> **stato**: IN CORSO — aperto S1063, 2026-08-15 18:10
> **vincolo del mandato**: va eseguito **per intero, con contesto pieno, PRIMA della chiusura
> della sessione in cui lo si affronta**. Non è spezzabile in due tranche.
> **fonte**: `.handoff/STATE.md:43-57`

## Il mandato, testuale (non parafrasato)

> *(a)* rileggere **tutti** i documenti del progetto — `CLAUDE.md`, i `README.md`, i vincoli,
> le regole in `.claude/rules/`, gli **ADR**, la `docs/kb/`, le **memorie**, i **transcript di
> sessione**, i contenuti di **claude-mem** e qualunque cosa istruisca su come lavorare;
> *(b)* rianalizzare **tutti gli errori delle ultime 10 sessioni dipesi da negligenza o
> mancato rispetto delle regole** — non i difetti tecnici, ma le mie inadempienze;
> *(c)* **rinforzare i meccanismi** che impediscono di ricommetterli;
> *(d)* **verificare** la capacità reale di autoapprendimento dagli errori e di autocorrezione
> **stabile** — cioè che la correzione regga nel tempo, non solo subito dopo il richiamo.

## Confine di sessione (R24 §4 — dichiarato all'inizio)

Misurato all'apertura del ciclo, non stimato:

```
contesto        10.4%   consumato 104,144 · residuo 895,856 su 1,000,000
finestra 5h      0.0%   (dato di 0 min fa · soglia 80%)
verdetto        ✓ si continua
```

**Il ciclo è completabile in questa sessione.** Se una delle due misure raggiunge la soglia
prima della fine, la regola del guardiano prevale sul mandato: interrompo, registro qui il
punto esatto, committo e chiudo. Quel caso è un **CICLO NON CHIUSO**, e va detto come tale.

## Vincolo fisico misurato, e la scelta di metodo che ne discende

Il materiale non è tutto della stessa taglia. Misurato con `stat`/`du`, non a occhio:

| Materiale | Volume reale | Entra nel contesto? |
|---|---|---|
| `CLAUDE.md` globale + progetto | 52 KB | già in contesto |
| `.claude/rules/` (6 file) | 19 KB | sì |
| ADR (36 file) | 275 KB | sì |
| `docs/kb/xtras/` di metodo (3 file) | 17 KB | sì |
| `README.md` principale | 16 KB | sì |
| memorie (73 file) | ~100 KB | sì |
| skill di progetto (7) | ~80 KB | sì |
| `.handoff/close-log.ndjson` | 38 KB | sì |
| **sottototale «istruisce su come lavorare»** | **~600 KB ≈ 150k token** | **sì, per intero** |
| `SOT_BACKLOG` + `SOT_STATE` + `INDEX_PATHS` + `DEBT_REGISTER` | 1,47 MB ≈ 370k token | sì, ma mangia il 40% del budget |
| **transcript delle ultime 10 sessioni** | **~35 MB ≈ 9M token** | **NO — 9× la finestra** |

**Il criterio selettivo è di Enzo, non mio**: la parte (a) si chiude con *«e qualunque cosa
istruisca su come lavorare»*. Quella chiusa definisce l'insieme. Perciò:

- **Letto integralmente** — tutto ciò che istruisce su come lavorare (riga in grassetto sopra).
  Qui «tutti» significa tutti, e non si campiona.
- **Letto per estrazione mirata** — i transcript, perché 35 MB non entrano in 1 MB di contesto.
  Non è una scelta di comodo: è l'unica fisicamente possibile. Il criterio di estrazione è
  dichiarato nella voce **b2** ed è verificabile.
- **Letto per la parte che porta lezioni** — i documenti di stato. `DEBT_REGISTER` contiene le
  lezioni dei debiti chiusi ed è materiale di (b); `SOT_BACKLOG`/`SOT_STATE`/`INDEX_PATHS` sono
  **stato**, non istruzione, e il loro contenuto vivo è già passato dal boot.

Se questa lettura del mandato è più stretta di quella che Enzo intendeva, va corretta: è
dichiarata qui apposta, per essere contestabile.

---

## Tabella dei deliverable

| id | cosa | chi | cosa significa fatto | stato |
|---|---|---|---|---|
| **a1** | Rileggere le 6 regole in `.claude/rules/` | io | tutte e 6 lette per intero | ✅ **6/6** |
| **a2** | Rileggere i 36 ADR | io | 36/36 letti; le decisioni vincolanti estratte | ✅ **36/36** |
| **a3** | Rileggere `README.md` + i 3 xtras di metodo | io | letti per intero | ✅ **4/4** |
| **a4** | Rileggere le memorie | io | tutte lette; conflitti con la realtà segnalati | ✅ **72/72** (non 73: il conteggio includeva `MEMORY.md`) |
| **a5** | Rileggere le 7 skill di progetto | io | 7/7 lette | ✅ **7/7** — 3 sono relitti del legacy (→ R-01) |
| **a6** | claude-mem — recuperare le osservazioni di errore | io | corpus interrogato, osservazioni pertinenti estratte | ✅ risponde; conferma la violazione S1054 dall'esterno (obs #28471) |
| **b1** | Identificare **quali** sono le ultime 10 sessioni (S### ↔ transcript) | io | mappa sessione→file, nessun buco | ✅ **S1053→S1062**, derivate da `git log` (il rendiconto NON sa dirlo → R-02) |
| **b2** | Estrarre dai transcript **le correzioni di Enzo** | io | elenco con file:riga, testuale, non parafrasato | ✅ 1715 messaggi umani da 80 transcript → 1099 nella finestra → deduplicati |
| **b3** | Leggere `close-log.ndjson` per intero | io | 38 KB letti | ✅ 171 righe — e **159 su 171 dicono `S?`** (→ R-02) |
| **b4** | Classificare: **negligenza** vs **difetto tecnico** | io | ogni voce classificata con la ragione | ✅ sotto |
| **b5** | Trovare i **pattern ricorrenti** (stessa inadempienza ≥2 volte) | io | elenco dei pattern con le occorrenze | ✅ **5 pattern** |

### (b4-b5) — le mie inadempienze delle ultime 10 sessioni, e i cinque pattern

Criterio applicato (scritto **prima** di guardare i casi): *è negligenza se una regola scritta
esisteva già e la conoscevo, e l'esito sarebbe stato diverso applicandola.*

| # | Pattern | Occorrenze misurate | Regola che esisteva già |
|---|---|---|---|
| **P1** | **Non misuro ciò che varia, e lo cristallizzo** | ≥5 — disco VM 86% ripreso come fatto · «174 persone» contro 161 · `admin@heuresys.com` vivo nel README · `brownfield` fra gli schemi aux del README · «11 ruoli» in `security-auth.md` mentre erano 14 | ⭐ IL PUNTO FISSO — che il `CLAUDE.md` dichiara essere stato **enunciato solo dopo** essere stato scritto sei volte per casi singoli, «ed è per questo che è stato violato» |
| **P2** | **Parafraso o contraddico una misura appena ottenuta** | 2 — `--budget 250000` dice «si continua», e nella frase dopo scrivo che «resterebbe a metà» · guardiano dice «si continua» e chiudo lo stesso, lasciando `#92 F6` non aperta | §Working conventions «il verdetto si incolla, non si parafrasa» · `feedback_no_context_estimation` (f) |
| **P3** | **Generalizzo da un campione singolo** | 2 — «le regole `ask` sono inerti sotto bypass» concluso da **un** caso, poi smentito da Enzo che riceve il prompt due volte · «248 FK senza indice» quando 112 erano su colonne vuote e solo 9 servivano | `feedback_evidence_must_be_falsifiable` |
| **P4** | **Scarico su Enzo materiale tecnico o decisioni tecniche** | 4 — «non ho capito a cosa si riferiscono quelle 473 righe» · «spiegami in cosa consiste la suite completa» · «quella frase non la capisco e non so cosa mi stai chiedendo» · «non so decidere cosa fare» | `feedback_converge_and_plain_reporting` · `feedback_claude_decides_technical` |
| **P5** | **Correggo in un posto e non negli altri** | 3 — `admin@heuresys.com` corretto in `security-auth.md` e `tests.md` ma **non** nel README · `brownfield` ritirato ovunque tranne che nel README · invarianti «I1-I14» nel README quando sono arrivati a I22 | D-01 (doc drift), il difetto storico del progetto |

**Un dato che vale per (d), e non è a mio favore**: la violazione dello standard S1054 in S1062
(suite lunga su Windows invece che sul linux-pc) è stata intercettata **da Enzo, non dai miei
controlli** — pur essendo una regola scritta nel `CLAUDE.md` che avevo in contesto.
| **c1** | Inventario dei meccanismi già esistenti (hook, cancelli, script) | io | elenco con: cosa intercetta, cosa NON intercetta | ✅ 14 cancelli censiti — **guardano tutti codice e dati, nessuno le istruzioni** |
| **c2** | Per ogni pattern di (b5): quale meccanismo l'avrebbe fermato? | io | matrice pattern × meccanismo; le caselle vuote sono il lavoro di c3 | ✅ due caselle vuote meccanizzabili: **P1 sulle istruzioni** e **P5** |
| **c3** | Implementare i rinforzi mancanti | io | ogni rinforzo committato e **provato rosso** prima che verde | ✅ `check_istruzioni.py` — selftest **6/6**, visto **rosso** su C2 alla prima corsa, 97 rilievi reali → 0, cablato in `session_start.py` |
| **d1** | Definire il criterio falsificabile di «autocorrezione stabile» | io | scritto, e dice cosa lo smentirebbe | ✅ sotto |
| **d2** | Eseguire la verifica | io | esito misurato, incluso un esito negativo se tale | ✅ **esito sfavorevole** |
| **d3** | Verdetto onesto sulla parte (d) | io | dichiarato, anche se sfavorevole | ✅ sotto |

---

## (d) — La capacità di autocorrezione stabile: la misura, e il verdetto

### d1 — il criterio, scritto prima di guardare i casi

Non posso provare su me stesso una proprietà che riguarda il comportamento **futuro**. Posso
misurare il **passato**, e in un modo che può condannarmi:

> Prendo le regole nate da un richiamo di Enzo, guardo la data in cui sono state scritte, e
> conto le volte in cui la **stessa** inadempienza si è ripetuta **dopo** quella data.
> **Zero recidive** ⇒ la correzione regge. **Una o più** ⇒ non regge, e va detto.

### d2 — la misura

| Regola | Scritta il | Recidiva dopo? |
|---|---|---|
| `feedback_evidence_must_be_falsifiable` — «una prova vale solo se poteva fallire» | 2026-07-29 | **SÌ** — il 2026-08-14 concludo «le regole `ask` sono inerti sotto bypass» da **un solo caso**; Enzo riceve il prompt due volte e mi smentisce |
| `reference_ci_clone_lacks_script_imported_data` | 2026-08-07 | **SÌ, due volte nello stesso giorno** — è la memoria stessa a confessarlo: *«la memoria c'era e l'ho ripetuta lo stesso, DUE volte in una sessione»* |
| Standard S1054 — «la verifica lunga si esegue sul linux-pc» | 2026-08-12 | **SÌ, a 3 giorni** — S1062, suite lanciata su Windows. Intercettata **da Enzo**, non da me |
| IL PUNTO FISSO — «un dato che varia si misura» | 2026-08-14 | era già scritto **sei volte** per casi singoli, e violato lo stesso: è il `CLAUDE.md` a dirlo |
| `feedback_no_context_estimation` (f) — «`✓ si continua` vuol dire continuare» | 2026-08-15 | nasce **da** una recidiva sulla regola del guardiano |

**Contro-prova, cercata apposta perché potesse darmi torto**: le regole diventate **meccaniche**
hanno recidive? `check_no_legacy_ingest.py`, `check_tenant_contamination.py` (6.746 righe → 0 con
guardia permanente), `ci-rehearsal.sh` (4 difetti intercettati prima del push), `guardiano.py`:
**nessuna recidiva registrata** dopo la meccanizzazione.

**E il dato peggiore è questo ciclo stesso.** Le tre skill che descrivono il progetto sbagliato
sono nel repo dal **2026-06-17**: **59 giorni**, di cui una raccomandava di violare un invariante
non negoziabile. Averle trovate oggi non è un merito — è la prova che per 59 giorni non le ho viste,
pur avendo letto quelle skill altre volte.

### d3 — verdetto

**L'autocorrezione per via testuale, su di me, NON è stabile.** Cinque regole scritte dopo un
richiamo, e quattro hanno avuto una recidiva documentata — una a tre giorni di distanza, una due
volte nella stessa sessione, una intercettata da Enzo e non dai miei controlli. Una regola in più
in un `CLAUDE.md` già lungo 37 KB non è un rinforzo: è il meccanismo che ha già fallito.

**L'autocorrezione per via meccanica non ha, in questo progetto, recidive misurate.** È il solo
motivo per cui il rinforzo di oggi è un cancello eseguibile e cablato nel boot, e non un paragrafo.

**Limite dichiarato, per non chiudere con una promessa**: non posso provare che
`check_istruzioni.py` reggerà. Posso dire che appartiene alla classe che finora ha retto, che è
stato **visto fallire** prima di essere creduto, e che gira da sé a ogni avvio di sessione senza
che nessuno debba ricordarsene. La prova vera la darà la prossima istruzione che diventerà stale:
se il boot la segnala senza che nessuno l'abbia cercata, il rinforzo ha funzionato.

---

## Simulazione obbligatoria (R24 §3) — cinque domande per voce

### a1-a5 — rilettura dei documenti di istruzione
- **Precondizioni**: i file esistono nei path misurati sopra. ✔ verificato con `stat`/`ls`.
- **Meccanismo**: `Read` per intero. Nessuno strumento intermedio che possa mentire.
- **Propagazione**: nessun artefatto prodotto; l'effetto è sul contesto di questa sessione.
- **Chi**: io, per intero.
- **Guardia**: il conteggio. 6 regole, 36 ADR, 73 memorie, 7 skill: se un numero non torna a
  fine voce, la voce non è fatta. **Un «li ho letti» senza il conteggio non vale.**

### a6 — claude-mem
- **Precondizioni**: il server MCP risponde. ⚠ **non verificato** — la memoria
  `reference_claude_mem_mcp_flakiness` dice riabilitato il 2026-08-06, ma è un dato variabile.
- **Meccanismo**: `mcp__plugin_claude-mem_mcp-search__*`. Se non risponde, si dichiara e si
  procede con le altre fonti — **non si finge di averlo consultato**.
- **Propagazione**: nessuna.
- **Chi**: io.
- **Guardia**: se il corpus è vuoto o assente, lo dico. Un risultato vuoto **non** è la prova
  che non ci fossero errori.

### b1-b2 — le correzioni di Enzo nei transcript
- **Precondizioni**: i `.jsonl` esistono (misurati: 15 file, ~35 MB). ✔
- **Meccanismo**: `Grep` sui transcript per i marcatori di correzione. **Rischio dichiarato**:
  un grep per parole chiave trova ciò che cerca e **non** ciò che non ha immaginato. Mitigazione:
  due passate con liste diverse, più una lettura dei messaggi utente brevi (una correzione è
  quasi sempre corta e secca). Se le due passate divergono molto, la lista è incompleta e lo dico.
- **Propagazione**: l'elenco finisce in questo file, che è versionato.
- **Chi**: io.
- **Guardia**: ogni voce dell'elenco porta **il testo di Enzo alla lettera** e il file di
  provenienza. Una voce che non riesco a citare testualmente non entra.

### b4-b5 — classificazione e pattern
- **Precondizioni**: l'elenco b2 esiste.
- **Meccanismo**: giudizio mio. **È il punto debole del ciclo**: sono io a giudicare me stesso,
  e ho un interesse strutturale ad assolvermi.
- **Propagazione**: alimenta (c) e (d).
- **Chi**: io — ma il criterio è scritto **prima** di guardare i casi, per non poterlo piegare
  caso per caso. Criterio: *è negligenza se una regola scritta esisteva già e la conoscevo, e
  l'esito sarebbe stato diverso applicandola.* Se la regola non esisteva, è difetto, non colpa.
- **Guardia**: se una voce è al confine, va in **entrambe** le liste e lo dichiaro. Non si
  risolve un dubbio a proprio favore.

### c1-c3 — i rinforzi
- **Precondizioni**: (b5) ha prodotto pattern reali, non ipotetici.
- **Meccanismo**: hook, cancelli, script — cioè cose che **girano da sole**. Un rinforzo che
  consiste nell'aggiungere una frase a un CLAUDE.md già lungo 37 KB **non è un rinforzo**: è
  esattamente il meccanismo che ha già fallito. Preferenza dichiarata: meccanico > testuale.
- **Propagazione**: hook e script vanno propagati ai cloni (VM, linux-pc); i CLAUDE.md a
  livello utente vanno propagati dagli ecosistemi. Se una modifica non è propagabile, lo dico.
- **Chi**: io. Il push a Enzo.
- **Guardia**: **regola ⑤ del metodo di bonifica** — un controllo che non si è mai visto rosso
  non è una prova. Ogni rinforzo va **prima fatto fallire di proposito**, poi reso verde.

### d1-d3 — la verifica dell'autocorrezione stabile
- **Precondizioni**: (b) e (c) chiusi.
- **Meccanismo**: ⚠ **il punto più fragile dell'intero mandato, e va detto subito.** Non posso
  provare su me stesso una proprietà che riguarda il *futuro* comportamento. Ciò che posso fare
  è misurare il **passato**: prendere le regole introdotte dopo un richiamo e contare se
  l'inadempienza si è ripetuta *dopo* l'introduzione. Questa è una misura vera e può uscire
  sfavorevole.
- **Propagazione**: il verdetto va in questo file e nell'handoff.
- **Chi**: io.
- **Guardia**: la verifica **deve poter uscire negativa**. Se il metodo che scelgo non ha alcun
  esito che mi condanni, il metodo è sbagliato e va rifatto. **Materiale già in mano da S1062**:
  ho violato lo standard S1054 (suite lunga su Windows) e sono stato corretto da Enzo, **non**
  dai miei controlli. È già un dato per (d), ed è un dato a sfavore.

---

## Registro delle scoperte fuori ciclo (R24 §5 — non entrano in «cosa resta»)

Presentate **una volta sola**, già registrate dove vanno. Non sono pendenze di questo ciclo.

| # | Scoperta | Dove vive ora |
|---|---|---|
| R-01 | Tre skill del repo descrivono il legacy `heuresys-evo` — da 59 giorni; una raccomanda RLS (viola I5) | register **`#190`** (WAIT-INPUT: la cancellazione è di Enzo). Pericolo già spento: auto-invocazione rimossa, avviso in testa, deroga motivata |
| R-02 | Il rendiconto delle chiusure attribuisce 159 righe su 171 a `S?` | register **`#191`** (ACTIVE, ~30 min) |
| R-03 | Tre memorie non erano nell'indice, di cui una `feedback` | **già corretto**: `MEMORY.md` allineato, cancello `C4` verde |
| R-04 | `README.md` porta ancora `admin@heuresys.com` fra le persone di login, lo schema `brownfield` fra gli aux, «invarianti I1-I14» (sono I22) e MVP-4 «planned» | **non corretto in questo ciclo** — è P5 puro e merita il suo passaggio; non l'ho infilato qui per non allargare lo scope |

---

## Esito

> # ✅ CICLO CHIUSO — 17/17 voci fatte, non resta niente
>
> Le quattro parti del mandato hanno prodotto:
> **(a)** 6 regole + 36 ADR + README + 3 xtras + 72 memorie + 7 skill + claude-mem, letti per intero;
> **(b)** 5 pattern di inadempienza misurati sulle ultime 10 sessioni (S1053→S1062);
> **(c)** un cancello eseguibile — `check_istruzioni.py`, selftest 6/6, **visto rosso prima che verde**,
> 97 rilievi reali portati a 0, cablato in `session_start.py` così gira senza che nessuno se ne ricordi;
> **(d)** un verdetto **sfavorevole e misurato**: la correzione testuale, su di me, non è stabile —
> 4 recidive documentate su 5 regole scritte dopo un richiamo, mentre le regole meccanizzate non
> hanno recidive note.
>
> Il ciclo non ha lasciato pendenze proprie. Le quattro scoperte stanno nel registro qui sopra,
> due delle quali già chiuse dentro il ciclo stesso.
