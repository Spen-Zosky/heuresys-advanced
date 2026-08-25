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
- [ ] **S0 `marciume` — il cancello della chiusura è rosso da 3 corse** (nuovo, S1081)
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
- [ ] **S3 `#169` F2 — la via d'ingresso per le prove** — il progetto è nel piano `#169`: tre
  identità `SERVICE` su dominio `.invalid`, mandati veri (PLATFORM_ADMIN · TENANT_ADMIN · USER),
  chiave separata `.secrets/collaudo-access.key`, esenzione MFA col meccanismo di `000118`.
  Prima: chiarire cosa ha rimosso `admin@heuresys.com` dopo la `000287`.
  ⛔ il vincolo «non mentre la suite gira» oggi NON morde: nessuna suite in volo.
  **fatto =** un accesso reale riuscito con un'utenza di collaudo, la via vecchia ancora al suo posto
- [ ] **S1 `#219` F5 — la corsa integrale E2E, 0 falliti** — DOPO S3: capire il guasto esatto dei
  sei setup di autenticazione, instradarli sulla via nuova dove idoneo (il confine di #169 vale:
  i profili di *autorizzazione* restano persone reali), poi `cd apps/web &&
  pnpm test:e2e:prod:node22` in background (fase 1 misurata 43,8 min; 4 fasi). Mentre gira:
  **nessuna scrittura DB che alteri ciò che misura**
- [ ] **S5 `#227` F1 — censire le 4.464 competenze isolate, per specie** — read-only, gira bene
  mentre la suite è in volo
- [ ] **S6 `#132` F7 — registrare l'approvazione + le due prove** — dopo o durante la coda della
  suite (le fonti non sono materia che la suite misura; verifica al momento)
- [ ] **S4 `#214` F6 — un perimetro dell'agente** — dopo la suite (la prova live fa login reali).
  L'ordine si ri-deriva con `check_concetti_agente.py`, mai dal piano
- [ ] **S7 `#219` F5 — triage della corsa e chiusura** — letti i casi, non le fasi; se 0 falliti →
  ingresso in CI (il `chiuso-quando` della voce)

## Confine di sessione, dichiarato adesso

Il guardiano decide il taglio (75% contesto / 80% 5h — al boot: 45,7% · 8%). Le fasi si eseguono
nell'ordine sopra e ciò che non entra resta nel register, che è già la sua casa. **Non entrano
comunque**: `#143` · `#159` · `#54` · `#50` F2 · `#227` F2-F5 · `#198` T9b · `#169` F3-F4 (F3
cambia i segreti delle 158 utenze: non si apre a suite in volo né a ridosso del confine di
sessione). `#86` resta WAIT-INPUT: `claude login` sul linux-pc lo può fare solo Enzo (~5 min).
