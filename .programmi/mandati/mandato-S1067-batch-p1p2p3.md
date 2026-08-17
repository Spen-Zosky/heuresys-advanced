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
- [ ] **F7 `#211`** — triage: quanti guasti distinti sono i 35 casi E2E rossi, e da quando
- [x] **F8 `#156`** — 2026-08-17 · catalogo generico **collegato** (`concepts_search` →
  `concept_describe` → `entity_query`), stessa mappa a catalogo e gate, `bindPath` a difesa del
  percorso. Prova LIVE con login reale: 3 strumenti usati, **8 decisioni nel diario del gate**,
  nessuna scrittura. **Un ramo cieco trovato nella mia stessa prova** (diario letto dal percorso
  sbagliato → zero righe lette come «tutto bene»): ora è INATTENDIBILE, non verde. 14 casi nuovi,
  suite gateway 92/92, sabotaggio verificato. Adozione → `#214`
- [ ] **F9 `#198` da T4** — Tenant Builder P3. **Non completabile in questa sessione** per
  dichiarazione del lab: si avanza fin dove il guardiano consente e si scrive `resume-from`

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

## Registro delle scoperte — fuori da questo ciclo (R24 §5)

*Si presentano una volta sola, a fine ciclo, come «lo vuoi nel prossimo?». Non entrano in «cosa
resta», non bloccano la chiusura.*

- (nessuna, per ora)
