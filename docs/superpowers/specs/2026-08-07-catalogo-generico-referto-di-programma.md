# Dal substrato semantico al catalogo generico — referto di programma

**Periodo**: 2026-08-06 → 2026-08-07 · **Root**: `D:/heuresys-advanced`
**Commit**: 8, tutti **locali** (`5b557d7a` → `804e57b4`), nessun push
**Portata**: 21 file, +12.632 / −553 righe

---

## In una pagina

Si partiva da un sospetto: che il substrato semantico fosse a posto e che il catalogo di
strumenti dell'agente fosse troppo stretto. Entrambe le cose sono state **misurate**, non
assunte, e il quadro che ne esce è più preciso di come era stato descritto.

Il substrato **è** sano — quattro corpus al 100%, modello unico, ricerca sensata in
400-640 ms — ma ci sono voluti due difetti corretti per poterlo dire: un salto-per-hash
che ignorava il modello di embedding, e 39 vettori mancanti. Il catalogo **è** troppo
stretto, e la strada per allargarlo è stata progettata, misurata e messa in sicurezza,
ma **non è stata percorsa**: l'ADR-0033 resta `PROPOSED` perché l'ultima decisione non è
tecnica.

Il risultato più utile del periodo non è un numero verde. È **il confine** che la misura
ha trovato: la ricerca sui metadati sa dire *dove guardare*, non *quanto fa*. Saperlo
oggi vale più di scoprirlo dopo aver costruito.

---

## §1 — Ciclo A (2026-08-06): il substrato semantico

### §1.1 — Cosa è stato verificato

**L'API risponde e la ricerca ha senso.** Tre interrogazioni su competenze reali, via
percorso HTTP autentico con login reale, su vettori precalcolati:

| Domanda | Tempo | Primo risultato |
|---|---|---|
| Antiriciclaggio | 1007 ms | Rilevamento e prevenzione delle frodi **0.8693** |
| Modelli di credit scoring | 641 ms | Erogazione prestiti **0.7752** |
| gestione del personale | 398 ms | gestire le risorse umane **0.8749** |

Il primo tempo include il riscaldamento; a regime **400-640 ms**. I risultati sono
semanticamente pertinenti: l'antiriciclaggio tira frodi e crimine finanziario, il credit
scoring tira prestiti e NPL.

**Due scoperte non previste**: il login è **a due passi** (lo step 1 risponde
`mfa_required` e non rilascia cookie), e il secondo fattore serve anche con l'enforcement
spento, perché la persona *possiede* un fattore verificato.

### §1.2 — Due difetti corretti

**Il salto-per-hash ignorava il modello.** `backfillCorpus` saltava un elemento se
coincideva il testo, mai il `model_id`. Conseguenza: al cambio di modello **ogni riga
sarebbe stata saltata** e il corpus sarebbe rimasto misto — vettori di spazi diversi
mescolati, somiglianze sbagliate, **in silenzio**. Corretto: si salta solo se coincidono
testo **e** modello; un modello ignoto non conta come uguale.

**39 vettori mancanti**, tutti in `job_roles`. Colmati su autorizzazione esplicita, con
una sola richiesta.

### §1.3 — Uno strumento nuovo: `check_embedding_coverage.py`

Riporta la copertura per corpus **con due denominatori**, e la ragione non è pedanteria:
contare le righe grezze dà una percentuale falsa. Sulle occupazioni il denominatore
grezzo direbbe «60% scoperto» (7714 righe) mentre gli eleggibili sono **3045**, coperti al
100%.

### §1.4 — Il presidio del tunnel

Emerso fuori mandato. Il keepalive rialza il tunnel — il suo registro lo prova — ma
**nulla rialzava il keepalive**: trigger solo all'accesso, nessuna ripetizione,
`RestartCount` 0. Morto quello, il presidio restava giù **fino al logon successivo**.
Corretto con ripetizione ogni 15 minuti e 3 riavvii su fallimento, verificando che la
ripetizione **non moltiplichi** i processi.

---

## §2 — Ciclo B (2026-08-07): il catalogo generico

### §2.1 — L'atlante era vecchio di un mese

| | 2026-07-05 | 2026-08-07 |
|---|---|---|
| Moduli API | 83 | **95** |
| Route | 468 | **569** |
| Pagine web | 101 | **113** |
| Tabelle DB | 276 | **269** (vuote: 67 → **44**) |

Dodici moduli nuovi, nessuno sparito. Le tabelle **calano** mentre le vuote calano molto
di più: le purghe hanno tolto righe morte e gli import hanno riempito il resto.

### §2.2 — La misura che decideva l'architettura

Corpus di **95 concetti**, uno per modulo API, derivato **meccanicamente** dall'atlante —
nessun glossario scritto a mano, perché un corpus aggiustato misurerebbe la mano.

Dieci domande da direttore del personale, con l'atteso dichiarato **prima**:

- **6/10 nei primi 3** col metro grezzo · **8/10** dopo aver corretto otto nomi di modulo
  che avevo dichiarato e che **non esistevano**. La correzione è avvenuta *dopo* aver
  visto i risultati, quindi entrambi i numeri restano agli atti.
- **Due volte il recupero ha battuto il mio atteso**: `successor-readiness` **0.4075** su
  «chi può sostituire il responsabile», `training-initiatives` **0.4322** su «quali corsi
  di formazione» — dove io avevo scritto un modulo `learning` inesistente.

**I due mancati veri contano più del punteggio**, perché hanno la stessa natura:
«quali competenze mancano di più» e «quante persone lavorano nella direzione crediti»
chiedono un **calcolo**, non un dominio.

### §2.3 — I due sbarramenti di sicurezza, entrambi chiusi

**§5.1 — l'atlante non conosceva i parametri.** Ora ogni route porta la forma di
`querystring`, `params` e `body`: campi, tipo, opzionalità, formato e **valori ammessi
degli enum**. Estratto **a runtime da Zod**, non con una regex: gli schemi compongono, e
una regex li leggerebbe male proprio nei casi che contano. **555 blocchi su 555 risolti**.

**§5.2 — il gate classificava per nome.** Il difetto era grave: `hrx_entity_query` non
contiene verbi di scrittura, quindi sarebbe stato **auto-approvato anche chiedendo una
`DELETE`**. Un solo strumento generico bastava a svuotare l'approvazione umana. Ora la
classificazione guarda il **metodo dell'operazione risolta**, il metodo **non si prende
dall'input**, e ciò che non si risolve **si nega**.

### §2.4 — Una cache che toglie una spesa ricorrente

`freeTextSearch` chiamava Voyage per ogni domanda, anche identica. Cache **in memoria**:
il dato è rigenerabile a costo noto, mentre una tabella aggiungerebbe una scrittura e un
giro di rete sul percorso caldo.

---

## §3 — Come è stato verificato

Ogni correzione porta test **visti fallire prima di essere visti passare**:

| Cosa | Prova che il difetto era reale |
|---|---|
| Salto-per-hash | rimesso il vecchio predicato → 2 test rossi |
| Cache di query | disattivata la memorizzazione → 4 test rossi |
| Gate parametrico | rimessa la vecchia classificazione → 4 rossi, il più eloquente: `expected "vi.fn()" to be called once, but got 0 times` — la `DELETE` passava **senza umano** |
| Cancello del corpus | corpus alterato → `exit 1`; rigenerato → `exit 0` |

Suite: agent-gateway **51 → 65** test, nessuna regressione. Atlante: idempotenza
**ri-provata** dopo la modifica (due esecuzioni consecutive = file identici).

---

## §4 — Cosa resta aperto

### §4.1 — Prima di collegare il catalogo generico

1. **Il `resolver` non esiste.** È solo un'interfaccia: l'ADR pretende che sia costruito
   **dall'atlante**, e quella costruzione non è scritta. Finché manca, il gate nega tutto
   — correttamente.
2. **`hrx_entity_query` non è in allowlist**, di proposito.
3. **La decisione su quale superficie aprire per prima è di Enzo.** I criteri misurano la
   fattibilità, non sostituiscono la scelta. È il motivo per cui l'ADR resta `PROPOSED`.

### §4.2 — Limiti di capacità dichiarati (non sbarramenti)

- **`§5.5` — le domande di aggregazione non hanno un concetto.** Il limite più serio.
- **`§5.4` — i punteggi assoluti sono bassi** (0.27-0.49): utili come **ordinamento**,
  mai come soglia. Chi implementerà un filtro «sotto X non rispondere» deve saperlo.

### §4.3 — Debiti che restano dai cicli precedenti

- **`deriveUserProfiles` riscrive sempre tutti i 156 profili**: l'unico corpus senza
  salto, quindi un backfill «a vuoto» a vuoto non è.
- **`ADR_INDEX.md` è fermo a 0020** mentre sul disco si arriva a 0033. Misurato il
  2026-08-07 con un filtro che cerca qualsiasi numero, non un formato: mancano **12** ADR
  (`0021`, `0023`-`0033`; `0019` e `0022` sono buchi di numerazione, non omissioni), e
  l'indice non è toccato **dal 26 maggio**. In più cita un **`ADR-0000` che sul disco non
  esiste**: non è solo indietro, è anche disallineato in avanti. Fra i mancanti ci sono
  `0026` (ambiente unico, due tenant), `0027` (autorizzazione bi-assiale) e `0032` (il
  mandato tecnico non apre stipendi e valutazioni) — decisioni che `CLAUDE.md` cita come
  invarianti, e che chi cercasse la mappa dall'indice non troverebbe.
- **8 commit non pushati** e **`#154`** (deploy su linux-pc) ancora sospeso dal
  disservizio GitHub.

### §4.4 — Aperto dalla sessione S1047, e più urgente di tutto quanto sopra

- **`#155` — i percorsi di carriera**: 207 su 252 puntano a posizioni non più attive, e
  **130 persone hanno un obiettivo di carriera che nessun percorso raggiunge**. È l'unica
  voce di questo elenco che una persona vera vede aprendo la propria pagina.
- **`#153` — la custodia della storia RTL**: due anelli chiusi, il terzo è `#155`.

---

## §5 — Come proseguire, in ordine

**1. Prima di tutto `#155`.** Non è parte di questo programma, ed è la ragione per cui
viene prima: tocca ciò che 130 persone vedono. Il resto di questo referto riguarda
capacità future; quello riguarda una promessa già fatta e non mantenuta.

**2. Poi decidere su `§5.5`, prima di costruire.** La domanda giusta non è «come faccio a
far rispondere l'agente alle domande di aggregazione», ma **se il catalogo generico debba
farlo affatto**. Tre strade, in ordine di onestà:
- restringere lo scopo: l'agente instrada, l'aggregazione la fanno gli endpoint analitici
  che **esistono già** (`analytics`, `org-health`, `insights`);
- arricchire i concetti con *quali domande sa rispondere* — ma è contenuto scritto a
  mano, e reintroduce la mano che il corpus derivato aveva tolto;
- accettare il limite e dichiararlo nell'interfaccia.
  **La prima è la più solida** e non richiede codice nuovo.

**3. Il `resolver`, e solo dopo l'allowlist.** Va costruito dall'atlante, con un test che
provi che un `operationId` non dichiarato **non si risolve**. Collegare lo strumento
prima che il resolver sia provato riaprirebbe `§5.2` dalla porta accanto.

**4. Una superficie sola, in lettura, per cominciare.** Non i 78 moduli scoperti: uno,
scelto perché serve davvero, e in sola lettura. Il generico costa tre giri contro uno; va
speso dove la coda lunga paga, non dove i 17 strumenti già bastano.

**5. Il push e il deploy**, quando GitHub Actions è tornato normale.

### Un avvertimento che vale più dei cinque punti

Questo programma ha trovato **tre difetti seri in codice che nessuno sospettava**: un
salto-per-hash cieco al modello, un gate che avrebbe auto-approvato le cancellazioni, un
presidio che moriva col logout. Nessuno dei tre produceva un errore. Tutti e tre sono
emersi **misurando qualcosa d'altro**.

La lezione operativa non è «fate più test». È che **le cose date per note vanno
ri-misurate quando ci si appoggia sopra** — ed è la stessa lezione della sessione S1047,
dove una voce di sicurezza in cima al menu era già risolta da dieci giorni e nessuno
l'aveva verificata.
