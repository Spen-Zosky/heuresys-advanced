# Mandato S1067 — eseguire il maggior numero di azioni di P1, P2 e P3

> **mandato di ciclo**, non programma di voce → vive in `.programmi/mandati/`, fuori dal radar di
> `programmi.py` (vedi il README della cartella). **stato**: IN CORSO
> **aperto**: 2026-08-17, sessione canonica S1067
> **mandato di Enzo**: «esegui il maggior numero di azioni di P1, P2 e P3 secondo l'ordine che
> ritieni più indicato. Procedi in autonomia»

**Regola che vale su tutto**: `#149` — niente di ciò che il lab ha consegnato è verificato, e
⭐ **PUNTO FISSO** — ogni numero variabile si ri-misura in questa sessione, incluse le affermazioni
positive («è già fatto», «il file esiste»).

---

## Scoperta di apertura, che cambia l'ordine

Il **register era disallineato dalla realtà**: S1066 ha eseguito e committato il lavoro di
`#202` `#203` `#204` `#207` `#208` (commit `7911dde8`, `82d80582`) ma le cinque voci sono rimaste
`ACTIVE`, e il menu me le ha riproposte come lavoro da fare. Verificato sul vivo, non sul messaggio
di commit — vedi F1. Perciò la prima fase non è lavoro nuovo: è **riconciliazione**.

---

## Confine di sessione, dichiarato all'inizio (R24 §4)

- **F1→F6 sono completabili** in questa sessione.
- **F7** (`#211`, triage di 35 casi E2E rossi) e **F8** (`#156`) sono dichiarate ~1 sessione
  ciascuna: si aprono solo se il guardiano lo consente, e possono restare a metà con `resume-from`.
- **F9** (`#198` da T4) il lab stesso la dà a **~2 sessioni** con 5 task su 9 residui:
  **non si chiude qui**, per nessun motivo. Si avanza fin dove il guardiano consente.
- Chiusura anticipata obbligatoria: contesto ≥ 75% **oppure** finestra 5h ≥ 80% (`guardiano.py`).

---

## Fasi

- [x] **F1 riconciliazione register↔realtà** — 2026-08-17 · cinque voci chiuse dopo averle
  ri-verificate **sul vivo**, non sul messaggio di commit: guardiano `--sorveglia > file` exit **0**
  + selftest **32/32** + due copie `diff -q` identiche · rubinetto exit **0** + selftest **9/9** ·
  canale **14 controlli, 0 difetti, 0 ciechi** · 4 righe «PRIMA DI ESEGUIRE» in testa alle 4 voci ·
  `#196` contata con uno script: 22 righe, **nessun** campo duplicato · `handoff_lint` 0 fail
- [x] **F2 atlante superato** — 2026-08-17 · `build_atlas.py` rigenerato: 96 moduli API · 594 route
  · 117 pagine web · 106 schemi shared · 273 tabelle DB. Lo STALENESS SELF-CHECK torna verde
- [x] **F3 igiene degli strumenti** — 2026-08-17 · (a) `programmi.py --verifica` **0 difetti** su 7
  programmi, `--selftest` **16/16**: le fasi mancanti mascheravano altri 2 controlli per file, e i
  due *mandati di ciclo* non erano programmi di voce → cartella `mandati/` + README; (b) il «gap
  i18n» **non era un gap**: era una riga di collaudo E2E residua in produzione
  (`E2E-SF-1786930052128`, creata `2026-08-17 01:27:34 UTC` dalla corsa che ha prodotto i 35 rossi
  di `#211`). Ritirata con guardia + post-condizione + ripristino dichiarato → **0 gap · 0 anomalie
  · 0 orfani**
- [x] **F4 `#212`** — 2026-08-17 · `d9ab295e`. **Due difetti, non uno**: (a) la seconda corsa non
  armava perché il marcatore era consumato → finestra ri-derivata da `origin/prod..HEAD`;
  (b) il **gemello**, peggiore: il sorvegliante guardava lo sha armato mentre il rollout porta
  tutta la finestra `LAST_GOOD..ARMED` → ora pretende il verde su ogni commit intermedio che
  tocca path di deploy. **7 casi nuovi**, suite shell **162 ok / 0 failed**, ed entrambi i
  difetti **riprodotti sulle versioni pre-patch** (le prove misurano davvero)
- [x] **F5 `#210`** — 2026-08-17 · `1a70a014`. Ri-misurato prima di toccare: `learning_modules`
  92 = 77+15 (confermato) · `learning_paths` 72 = 5+67 — **il lab si sbagliava**, le 5 righe
  esistono da dicembre 2025 · `career_paths` 7 = 0+7. Due pagine corrette (non tre: la terza
  non mostra conteggi e ha uno «STOP» dichiarato sul tipo). Prova LIVE con **due attori**,
  E2E verde, **sabotata per vederla rossa**. Ha prodotto `#213`
- [x] **F6 `#197`** — 2026-08-17 · `5ec40cf3`. Ri-verificato sul file: 3 marcate / 5 no,
  i riferimenti reggono. Commento scritto. **La voce resta ACTIVE di proposito**: il suo
  `chiuso-quando` ha una seconda condizione (il controllo incrociato di P3 = T9 di `#198`)
  e chiuderla ora sarebbe usare il criterio più facile dei due
- [x] **F7 `#211`** — 2026-08-17 · suite completa rieseguita (~1h, poi **interrotta di proposito**
  a 371 esecuzioni / 51 fallimenti, quando tutte le famiglie erano isolate). **I rossi non sono
  guasti del prodotto: sono SEI famiglie** — ① sessione scaduta a metà corsa (la più numerosa:
  token da 15 min contro un blocco molto più lungo; le chiamate dirette `page.request` non passano
  dal rinnovo → 401, le navigazioni → redirect al login) · ② masking ADR-0032 su `PLATFORM_ADMIN`
  (5 casi; **non** «lista vuota»: gli endpoint danno 161·156·468·50·50·4 righe) · ③ test orfano di
  una pagina ritirata · ④ test più vecchio di `BRANCH_MANAGER` (mig 000272) · ⑤ dato cambiato ·
  ⑥ una causa **non isolata, e dichiarata tale**
- [x] **F8 `#156`** — 2026-08-17 · catalogo generico **collegato** (`concepts_search` →
  `concept_describe` → `entity_query`), stessa mappa a catalogo e gate, `bindPath` a difesa del
  percorso. Prova LIVE con login reale: 3 strumenti usati, **8 decisioni nel diario del gate**,
  nessuna scrittura. **Un ramo cieco trovato nella mia stessa prova** (diario letto dal percorso
  sbagliato → zero righe lette come «tutto bene»): ora è INATTENDIBILE, non verde. 14 casi nuovi,
  suite gateway 92/92, sabotaggio verificato. Adozione → `#214`
- [x] **F9 `#198` da T4** — 2026-08-17 · **avanzata di DUE task**, che è ciò che il criterio
  dichiarato all'apertura chiedeva («non completabile: si avanza fin dove il guardiano consente,
  `resume-from` scritto»). **T4** (`fc08f237`): il motore costruisce da un `BuildPlan` e non
  importa più l'archetipo — prova meccanica vuota, prova live coi numeri identici. **T5**
  (`4ddc4939`): l'atto `APPROVED → APPLIED`, cinque passi in una transazione, con la **prova di
  sabotaggio** che dimostra il rollback totale. `resume-from: T6`, restano T6/T7/T9

---

## Simulazione obbligatoria, prima di eseguire (R24 §3)

### F1 — riconciliazione
- **Precondizioni**: i criteri `chiuso-quando` delle cinque voci devono essere **verificati sul
  sistema vivo**, non sul messaggio di commit. Un commit che dice «fatto» è una dichiarazione.
- **Meccanismo**: `handoff_lint.py` regge la forma dei blocchi; lo stato si cambia a mano nel
  register (`status: ACTIVE` → `status: DONE` + riga `✅ FATTA S1066 (<sha>)`).
- **Propagazione**: `SOT_BACKLOG.md` è la SoT del backlog; il menu si rigenera da lì.
- **Chi**: io.
- **Guardia**: non distruttiva. Ma il rischio reale è **chiudere una voce non fatta**: perciò ogni
  chiusura porta accanto il comando che l'ha verificata, e le prove che possono fallire
  (`--selftest`) sono rilanciate adesso, non citate da ieri.

### F2 — atlante
- **Precondizioni**: nessuna, `build_atlas.py` legge il repo.
- **Meccanismo**: rigenera `docs/kb/atlas/`; lo STALENESS SELF-CHECK confronta i file di sorgente
  cambiati dopo il commit dell'atlante, non `commit == HEAD` (`#194`).
- **Propagazione**: file versionati, il commit li porta ovunque.
- **Chi**: io. · **Guardia**: non distruttiva (rigenerazione idempotente).

### F3 — igiene
- **Precondizioni**: capire cosa `programmi.py` riconosce come fase — letto: `## Fasi` + righe
  `- [x] **Fn ...** — ... data · evidenza` (`RE_FASE`, riga 55).
- **Meccanismo**: aggiungere la sezione al mandato S1066 **senza mentire**: F6 lì dentro dichiarava
  «non completabile in questa sessione, si avanza e si scrive resume-from», e quel criterio **è**
  soddisfatto → la fase è fatta *secondo il suo criterio*, non secondo il lavoro di `#198`.
- **Chi**: io. · **Guardia**: `--verifica` deve tornare 0 difetti **e** `--selftest` restare verde:
  se lo strumento smettesse di saper vedere un programma senza fasi, l'avrei addomesticato.

### F4 — `#212`
- **Precondizioni**: `close-propagate.sh` e il marcatore `.session-align.marker` esistono.
- **Meccanismo**: letto il codice di `arma`, capire perché il marcatore consumato produce «IGNOTO».
- **Propagazione**: è uno script del repo → arriva ai cloni col commit.
- **Chi**: io.
- **Guardia**: **non si arma un deploy per provare**. La prova si fa su una copia dello script con
  un marcatore finto, e deve mostrare il difetto **prima** della correzione.

### F5 — `#210`
- **Precondizioni**: il filtro `?isGlobal=false` deve funzionare davvero — vincolo caduto con `#209`
  (S1066), da **ri-verificare** sul vivo prima di appoggiarci il lavoro.
- **Meccanismo**: stesso schema di `#196` — seconda misura + messaggio i18n che dichiara le specie.
- **Propagazione**: codice web + i18n, commit.
- **Chi**: io. · **Guardia**: la prova è una pagina reale con login reale (DoD live E2E).

### F6 — `#197`
- **Precondizioni**: i numeri di riga di `repository.ts` vanno ri-letti: la consegna li dà per
  `:71 :153 :194` marcate e `:103 :223 :254 :304 :317` no, ma il file è cambiato dopo (T1-T4 di P3).
- **Meccanismo**: documentazione. **Vietato** estendere il marchio (LEGGIMI §7).
- **Chi**: io. · **Guardia**: nessuna scrittura di codice.

---

## Coda del ciclo — il mandato nuovo di Enzo (2026-08-17, dopo la chiusura del batch)

Chiuso il batch, Enzo ha dato una direzione nuova: **serve tutto il processo di creazione di
un'azienda tranne P4**, perché va sperimentato con **aziende usa e getta attraverso l'interfaccia
web**, *«senza compromettere la piattaforma»*. Piano approvato in
`~/.claude/plans/jaunty-percolating-storm.md`.

- [x] **G1 decisioni registrate** — 2026-08-17 · `c5823fd6`. **E27** (si sperimenta prima sul
  gemello, poi in produzione — e la sicurezza viene dalla destinazione, non da dove sta la
  schermata) ed **E28** (a fine esperimento: archivia **oppure** disfa la costruzione leggendo dal
  registro). `#206` → **HOLD** coi quattro campi che il cancello pretende
- [x] **G2 = T6, la superficie API** — 2026-08-17 · `6ccde457`. Le quattro rotte, **nessun permesso
  nuovo**. `apply` **non costruisce** — sabotata per vederla rossa: «apply ha creato unità: expected
  7 to be +0». 18/18, unit 84/84, prova live verde
- [ ] **G3 = T7, le due pagine nel prodotto** — **NON aperta**, e i tre numeri della regola:
  residuo misurato **118.136** token prima della soglia · costo stimato ~100k+ (pagine + i18n in
  parità + E2E con due attori) · verdetto dello strumento **«si continua»**. Lo strumento consente,
  ma una pagina a metà con le traduzioni scoperte è peggio di una non iniziata — e T7 è l'ultimo
  pezzo prima della prova che chiude la parte
- [ ] **G4 il campo di prova** (procedura per il gemello + `scripts/banco_tenant.py` coi due
  pulsanti) · [ ] **G5 = T9** · [ ] **G6 = `#132`** · [ ] **G7 = `#205`**

**`resume-from`: T7.** `#198` è a **7 task su 9**.

---

## Esito del ciclo (R24 §6 — letto dalla tabella, non dalla memoria)

**CICLO CHIUSO — 9/9 voci fatte.** F1→F9 tutte spuntate con evidenza. F9 era dichiarata
all'apertura come «non completabile: si avanza fin dove il guardiano consente», e quel criterio
è soddisfatto — due task avanzati (T4, T5) con `resume-from: T6` scritto nel register.

**Voci del register chiuse in questa sessione**: `#202` `#203` `#204` `#207` `#208` (riconciliate:
erano fatte e mai marcate) · `#210` · `#212` · `#156`. **Avanzate**: `#197` (prima metà; la
seconda dipende dal T9 di `#198`) · `#198` (6 task su 9) · `#211` (triage completo).
**Aperte da questo lavoro**: `#213` `#214`.

---

## Registro delle scoperte — fuori da questo ciclo (R24 §5)

*Si presentano una volta sola, a fine ciclo, come «lo vuoi nel prossimo?». Non entrano in «cosa
resta», non bloccano la chiusura.*

| Scoperta | Misura | Stato |
|---|---|---|
| **Cinque percorsi formativi senza titolare e non globali** — uno stato che il modello non sa rappresentare: la lista filtra `(is_global OR tenant_id=$1)`, quindi nessuna azienda li vede e li vede solo il platform | 72 = 52 RTL + 15 Heuresys + **5 senza titolare**; 3 si chiamano `OLDDB::learning_paths::<uuid>` | **registrata `#213`** — serve una decisione di prodotto (a chi appartengono), quindi non l'ho presa io |
| **Il criterio della coda dell'agente ha un buco**: `piu' classi` non è fra le RISERVATE, quindi `analytics` passa fra i «neutri» pur toccando classi di persona | 1 aperto · 47 in coda (31 neutri) | **dichiarata dentro `#214`** |
| **La suite E2E completa non può essere verde finché dura più di 15 minuti** — è la famiglia ① di `#211`, e non è un difetto del prodotto | token 15 min · corsa > 50 min | dentro `#211`, con la cura da decidere |
| **`z.coerce.boolean()` NON è più un problema**: il registro di S1066 lo dava per «20 filtri non corretti», ma la misura di oggi trova **zero usi reali** — solo commenti-monito | `grep` su `apps`+`packages`: 13 occorrenze, tutte in commenti | **superata**, nessuna azione |
