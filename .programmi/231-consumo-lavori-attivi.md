# 231 — Consumare i lavori attivi: la sequenza, e le tre voci che non erano eseguibili

> **item**: #231 (ciclo di esecuzione — mandato di Enzo S1080, rinnovato S1081)
> **stato**: IN CORSO
> **aperto**: S1080 (2026-08-25) · **ripreso**: S1081 (2026-08-25, «Canonical Session 02»)

## Il mandato

Enzo, S1080: *«consumiamo i lavori attivi nell'elenco: decidi tu priorità e sequenze»*. Rinnovato
S1081: *«procedi con tutte, decidi tu priorità e sequenza»*. Batch delegato: decido ordine, eseguo
end-to-end, committo a ogni voce chiusa, non chiedo fra una e l'altra.

**Esclusione dichiarata da Enzo (S1081)**: i programmi e le attività legate alla skill
`project-dream` sono della sessione parallela «Dreaming Session 02» — questa sessione non li tocca;
scambio solo messaggi informativi.

## Prima di decidere la sequenza: cosa è davvero eseguibile

### ✅ La fila di tre voci NON è più ferma: la fonte è APPROVATA (S1081)

- **`#132` F7** — ~~blocked-on-Enzo~~ → **Enzo ha APPROVATO `bancaditalia.it`** come prima fonte
  del registro (S1081, 2026-08-25; motivazione: fonte istituzionale della banca centrale,
  autorevole per il dominio bancario di RTL). F7 («le due prove») è **eseguibile in questa
  sessione**: registrare l'approvazione con approvatore+data+motivazione, poi le due prove.
- **`#198` T9b** — resta dopo `#132` completa: le quattro tabelle del contenuto sono vuote
  (misurato S1080: `sys_blueprint_content_{units,positions,skills,kpis}` → 0 righe), la
  costruzione si rifiuta con `BLUEPRINT_CONTENT_EMPTY`. L'approvazione della fonte apre la strada
  ma il modello va **generato dalla ricerca** (P2a): non in questa sessione.
- **`#205`** — `GATED` su `#132`, invariato finché #132 non chiude tutta.

### Due voci non sono lavoro: sono regole permanenti

- **`#79`** `F3` — *«il prossimo lavoro che popola tabelle»* · **`#149`** `F4` — *«la prossima
  consegna che arriva»*. Cancelli che scattano dentro altro lavoro; si consumano da sé.

## Fasi — la sequenza decisa (S1081)

Criterio: **(a)** prima ciò che mente alla chiusura (il rosso del cancello) · **(b)** poi la
catena che sblocca la suite (#169 → #219) · **(c)** il lavoro read-only mentre la suite gira ·
**(d)** costo e rischio crescenti. Ogni voce chiusa = commit.

- [x] **S2 `#148` — il rendiconto delle chiusure** — FATTO 2026-08-25 (S1080) · evidenza: voce CHIUSA 3/3, commit `3217b3ec`
- [x] **S0 `marciume` — il cancello della chiusura è rosso da 3 corse** — **FATTO 2026-08-28
  (S1083)** · `check_marciume.py` esce **0** e dichiara «niente è marcito»: le cinque forme di
  stato M1-M5 verdi, i dieci strumenti scoperti verdi, `verifica_incrociata` da 2 difetti a **0**.
  Le due sotto-voci S0a/S0b non avevano più bersaglio quando le ho misurate (M3 «residuo orfano in
  una voce chiusa» è [OK], e X9c non compare fra le firme con difetti): il rosso residuo era tutto
  in `verifica_incrociata`, cioè in S0-bis. Migrazioni `000361` e `000362`, commit del blocco A
  - **S0a** `X9c`: 1 persona con contratto `ACTIVE` e nessuna assegnazione di posizione attiva —
    identificarla, diagnosticare, curare (guardia + rollback) o dichiarare legittima con la ragione
  - **S0b** `M3`: 4 voci DONE con residuo orfano (`#215` 29 righe non-bande in
    `sys_compensation_bands` · `#200` `lab_inbox --ingest` duplica invece di fondere · `#196`
    censimento «indicatori senza specie» · `#163` da leggere: possibile falso positivo del check).
    Per ognuna: risolvere subito se piccola, altrimenti darle una casa nel register (HOLD), o
    correggere il check se legge male
  - *simulazione*: precondizioni = DB su tunnel OK, `check_marciume.py --selftest` verde prima e
    dopo; meccanismo = leggo `check_marciume.py` M3 per il criterio esatto di «raccolto»;
    propagazione = solo file di kb + eventuale migrazione (→ ci-rehearsal); chi = io; guardia = il
    selftest del cancello e, per X9c, misura-prima + rollback dichiarato
  - ⚠⚠ **la misura ha allargato il quadro (S1081)**: dietro X9c c'erano X8a, X7a e POI otto
    difetti che la batteria non mostrava, perché la sintesi era «l'ultima riga dello stdout» —
    l'ultimo allarme al posto del riepilogo. Curati: X9c (eccezione del vertice, decisa da Enzo),
    X8a (squadra cross-unità NULL è stato progettato, mig 000268), X7a e le cecità (exit 4 =
    cieco dichiarato, convenzione del guardiano, in entrambi gli strumenti), il display (riga
    ESITO), M3 (regex `\b`, righe `~~superate~~`, `raccolto-in: #NNN`). Gli **otto difetti dati**
    sono POSSEDUTI da `#234` (nuova, ACTIVE): non si spengono, si consumano lì
  - **fatto = (rivisto con onestà)**: M1-M5 a zero, selftest verdi, sonde di falsificabilità
    eseguite, e **ogni rosso residuo della batteria ha una voce che lo possiede** (`#234`). La
    chiusura continuerà a dire `marciume: fallito` con la riga «8 verifiche con difetti» finché
    #234 non li consuma — dichiarato, non nascosto
- [x] **S3 `#169` F2 — la via d'ingresso per le prove** — **FATTA 2026-08-25 (S1081)**, commit
  `71ca9e42` · evidenza: 3 utenze SERVICE provisionate (idempotente, guardie, `--undo`), login
  in un passo 200×3, password errata 401, **chiave madre 401** (il criterio di #169, misurato),
  via vecchia intatta (federica 200). Terza guardia `000284` scoperta eseguendo; `admin@` chiarito
- [x] **S0-bis (ereditato da S0)** — `#234` possiede gli otto rossi di `verifica_incrociata` —
  **FATTO 2026-08-28 (S1083)** · consumati gli ultimi due: `X5d` (migrazione `000361` — nessuna
  delle 29 posizioni del rischio dichiarava requisiti formativi, non solo la riga rossa) e `X3c`
  (migrazione `000362` — due contratti attivi del tenant di piattaforma senza busta recente).
  Curando `X5d` si è **acceso `X5a`**, che prima non poteva accendersi perché il controllo guarda
  solo le posizioni che dichiarano requisiti: emendato lo stesso file con la regola dell'osservato.
  Esito live: `0 verifiche con difetti, 7 misure informative, 27 pulite`
- [x] **S1 `#219` — la suite TORNA A MISURARE** — **FATTO 2026-08-26 (S1081)** · la diagnosi
  ereditata era **sbagliata**: le sei persone dei setup esistono tutte (`ACTIVE`, identità,
  fattore MFA) e non c'entrano con `admin@heuresys.com`. Causa vera: **l'API non era accesa**
  (nessuna config Playwright la avvia) + un `next start` orfano sulla :3000. Rimosse entrambe:
  **6 setup verdi in 57,7 s**, poi corsa integrale **4/4 fasi: 354 passati su 450**, 10 falliti,
  83 non eseguiti (68 dietro flag `F4_SWEEP`). Confronto con S1080: `0 passati · 84 saltati`
- [x] **S5 `#227` F1 — censire le 4.464 competenze isolate** — **FATTO 2026-08-26**, commit
  `ca47ec4e` · ribalta il piano: 4.332 derivabili a macchina, **30 righe** di curatela vera
- [x] **S6 `#132` F7 — l'approvazione della fonte** — **FATTO 2026-08-26**, commit `9818457c` ·
  registro fonti da 0 a 1, `bancaditalia.it APPROVED` con approvatore e data
- [x] **S4 `#214` F6 — il quinto perimetro** — **FATTO 2026-08-26**, commit `e4d42796` ·
  `visualization-graphs` aperto **con la guardia** (mig `000355`) perché la sua neutralità era
  vera oggi e non per costruzione; + `000356`, cura di un difetto **mio** (le utenze SERVICE
  contate come persone senza posizione: violazioni organigramma 3 → 0)
- [ ] **S7 `#219` F5d — triage dei 10 falliti** — ⏳ **in corso, a VM scarica**: `aide` è finito
  (load da 3,79 a **0,63**), API riaccesa, corsa integrale rilanciata col referto JSON. Il
  preflight tace, come deve ad ambiente sano — e alla sua prima corsa vera aveva dato un **falso
  allarme**, curato subito (`process.exit()` dentro un `fetch` aborta Node su Windows): un
  allarme che grida al lupo la prima volta viene disattivato la seconda
- [x] **S8 `#234` F1 — le riclassificazioni** — **FATTO 2026-08-26**, commit `0d04316e` e
  `0c6b9741` · da **8 difetti a 5**: `X3b` (boxplot di Tukey: i fuori-scala sono il suo scopo),
  `X4a` (**è lo skill gap**, la funzione centrale del prodotto) e `X6d` (una riga di riepilogo,
  non violazioni) riclassificate a `misura` con la ragione scritta. `X6b` **non toccata di
  proposito**: serve una decisione di prodotto. Indagate anche `X6a` (2 dei 5 OKR sono estranei
  al dominio bancario → contaminazione; gli altri 3 sono nomi disallineati, e la causa a monte è
  che `okr_department` è **testo libero**) e `X6c` (non 2 righe: **2 colonne** mai valorizzate,
  ma il codice le scrive — sono i seed storici)

## Confine di sessione, dichiarato adesso

Il guardiano decide il taglio (75% contesto / 80% 5h — al boot: 45,7% · 8%). Le fasi si eseguono
nell'ordine sopra e ciò che non entra resta nel register, che è già la sua casa. **Non entrano
comunque**: `#143` · `#159` · `#54` · `#50` F2 · `#227` F2-F5 · `#198` T9b · `#169` F3-F4 (F3
cambia i segreti delle 158 utenze: non si apre a suite in volo né a ridosso del confine di
sessione). `#86` resta WAIT-INPUT: `claude login` sul linux-pc lo può fare solo Enzo (~5 min).
