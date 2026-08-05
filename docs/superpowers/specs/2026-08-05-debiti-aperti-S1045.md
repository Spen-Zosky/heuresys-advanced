# Ciclo S1045 — chiusura dei debiti aperti

**Aperto**: 2026-08-05 · **Scelta di Enzo**: «prima risolviamo i debiti aperti»
**Fonte dello stato**: `docs/kb/DEBT_REGISTER.md` (5 aperti al boot: D-72, D-56, D-79, D-80, D-78)

## Confine di sessione (R24.4)

Sei voci. **T1-T4 e T6 sono completabili in questa sessione.** **T5 è un'indagine**: il suo
esito ammesso è «causa trovata con prova» oppure «non riproducibile, ecco cosa ho misurato» —
non necessariamente un fix. Nessuna voce richiede un input di Enzo.

## Tabella dei deliverable

| id | cosa | chi | cosa significa fatto | stato |
|---|---|---|---|---|
| **T1** | **D-80** — il tetto di 5 minuti sul controllo traduzioni | Claude | la riga del registro dice RISOLTO citando il commit reale che l'ha chiuso, e la prova che il tetto in HEAD è 10 | ✅ **FATTO** — era già chiuso in codice da `29cc8aca` (5→10), verificato antenato di HEAD; mancava solo la scrittura nel registro |
| **T2** | **Numero D-72 usato due volte** (riga 137 aperto, riga 174 risolto) | Claude | zero identificativi duplicati nel registro, verificato contando le occorrenze | ✅ **FATTO** — la riga aperta rinumerata in **D-81**; `uniq -d` sugli identificativi non trova più duplicati |
| **T3** | **D-79** — `CI_GATE_WAIT` non attraversa l'SSH | Claude | la variabile impostata dal chiamante arriva al gate remoto, provato osservando il valore sull'host remoto; fixture nel gate shell-test | ✅ **FATTO** — prova live sulla VM: `2100` stampato dall'host remoto, controllo negativo esce 1; 5 fixture nuove, **103 ok / 0 failed** |
| **T4** | **D-81** (ex D-72) — la maturità normalizzata su 5 su una scala che arriva a 6 | Claude | un solo denominatore in tutto il modulo, delta sugli output misurato LIVE prima/dopo e dichiarato, test di regressione | ✅ **FATTO** — delta live dichiarato (51 skill su 62 cambiano posto, max 16 posizioni, 0 fuori dal rapporto 5/6); il test è **provato capace di fallire** |
| **T5** | **D-78** — il controllo del clone dichiara FATAL su un clone integro | Claude | causa individuata con una prova che poteva smentirmi, oppure misura che dice perché non è riproducibile | ✅ **FATTO** — causa: `Environment=` non quotato spezzava `PGOPTIONS`; fix su unit sorgente **e** installata, `[clone-vm-db] done` live |
| **T6** | **D-56** — claude-mem disabilitato per un bug upstream | Claude | versione upstream corrente verificata sul campo: o ripristino, o la riga dichiara la data della verifica | ✅ **FATTO** — la 13.13.1 fa boot pulito (log INFO), il crash riguardava la 13.10.2. **Non riabilitato**: è l'ambiente di Enzo, serve il suo sì |

### Fuori piano — emerso durante il lavoro e corretto nello stesso ciclo

| id | cosa | stato |
|---|---|---|
| **X1** | **Quattro item `ACTIVE` invisibili al menu** (`#140`-`#143`, fra cui la priorità #1 di `STATE.md`): erano scritti in coda a `SOT_BACKLOG.md`, fuori dalla sezione che `build_menu.py` legge | ✅ spostati nel registro (4 blocchi, nessuna riga persa) + nuovo controllo **bloccante S3** in `handoff_lint.py`, provato capace di fallire |
| **X2** | **Il gate di verifica confrontava sé stesso con codifiche diverse**: `session_mode.py` decodificava l'uscita di `verify_gate.py` in cp1252 su Windows, corrompendo ogni trattino lungo | ✅ il wrapper inoltra i byte senza ricodificarli — torna a essere trasparente |
| **X3** | **Tunnel SSH degradato**: un `select 1` impiegava 13,6 s e faceva scadere il pool dell'API | ✅ tunnel ricreato → 0,667 s. La VM era sana (carico 0,53 · disco 80% · 6 connessioni) |

---

## Simulazione (R24.3) — cinque domande per voce, risposte PRIMA di eseguire

### T1 — D-80, il tetto di 5 minuti

- **Precondizioni** — il file `.github/workflows/i18n-parity.yml` esiste e il valore in HEAD è noto.
  **Verificato**: riga 52 dice `timeout-minutes: 10`; `git log` mostra `29cc8aca` (2026-08-05 14:00)
  «il controllo delle traduzioni non muore piu' per sei secondi»; `git merge-base --is-ancestor`
  conferma che è antenato di HEAD.
- **Meccanismo** — nessun codice da toccare: **il fix esiste già**, manca la scrittura nel registro.
  Ho letto il file reale, non il titolo del debito.
- **Propagazione** — nessun artefatto nuovo. Il registro è già versionato.
- **Chi** — Claude.
- **Guardia** — non distruttiva. Il rischio è dichiarare risolto ciò che non lo è: mitigato citando
  il commit e il valore letto dal file, entrambi ricontrollabili.

### T2 — l'identificativo D-72 usato due volte

- **Precondizioni** — due righe portano lo stesso numero: 137 (aperta, scala maturità, S1041) e
  174 (risolta S1024, skill duplicate). **Verificato con grep.**
- **Meccanismo** — rinumerare la riga **aperta** (la più recente) in **D-81**, che è libero:
  il massimo esistente è D-80. Non tocco la riga storica già risolta e già citata altrove.
- **Propagazione** — il numero D-72 compare anche in `SOT_BACKLOG.md` (item #72) e in D-74:
  vanno controllati i riferimenti prima di riscrivere, per non spezzare rimandi veri.
- **Chi** — Claude.
- **Guardia** — la verifica non è «ho cambiato la riga» ma «quante righe portano ciascun numero»:
  un conteggio che può ancora fallire dopo la modifica.

### T3 — D-79, `CI_GATE_WAIT` non attraversa l'SSH

- **Precondizioni** — capire *dove* si perde. **Verificato**: `align-clones.sh:151` invoca
  `vm-deploy-remote.sh`, che a riga 74 compone il comando remoto come
  `env REPO_DIR=… $DEPLOY_ENV $DEPLOY_CMD`. `DEPLOY_ENV` è per-host (porte, utente), **non**
  per-invocazione. `ci-gate.sh:30` legge `CI_GATE_WAIT` con default 900. Nessuno dei due script
  di trasporto nomina mai quella variabile: **grep su tutto il repo lo conferma.**
- **Meccanismo** — inoltrare esplicitamente le variabili del gate nel comando remoto, generandole
  **solo se impostate dal chiamante** (altrimenti si scriverebbe `CI_GATE_WAIT=` vuoto, che
  sovrascriverebbe il default remoto con la stringa vuota — trappola da evitare).
  Le variabili del gate sono quattro, lette da `ci-gate.sh`: `CI_GATE_WAIT`, `CI_GATE_POLL`,
  `CI_GATE_KEY_WORKFLOWS`, `DEPLOY_REQUIRE_CI`.
- **Propagazione** — `vm-deploy-remote.sh` sta in `scripts/`, che `align-clones` porta su VM e
  linux-pc; ma **lo script gira dal lato client**, quindi il fix ha effetto già alla prossima
  chiamata locale.
- **Chi** — Claude.
- **Guardia** — non distruttiva. Il caso limite è la variabile **non** impostata: la prova deve
  coprire entrambi i rami (impostata → arriva; non impostata → il remoto usa il suo default,
  e nessuna assegnazione vuota compare nel comando).

### T4 — D-81 (ex D-72), il denominatore della maturità

- **Precondizioni** — sapere qual è la scala vera e quanto se ne usa. **Misurato sul database
  live**: `sys_skill_proficiency_levels` va da NOVICE=1 a MASTER=6; i possessi reali
  (`sys_user_skills`, 1.355 righe) si fermano a EXPERT=5 — 600 EXPERT, 350 PROFICIENT,
  288 COMPETENT, 107 BASIC, 10 NOVICE, **zero MASTER**; media 4,0502.
- **Meccanismo** — `repository.ts:427` calcola `Math.min(1, avgRank / 5)`; `service.ts:310`
  calcola la stessa grandezza come `avgHeldRank / VRIO_MAX_PROFICIENCY_RANK` (= 6).
  **Il difetto vero non è il clipping** (oggi impossibile: nessun MASTER) **ma le due formule
  divergenti sulla stessa grandezza.** Il fix è un solo denominatore, la costante condivisa.
  Il commento a riga 347 («/ 5, MASTER=6 unused by the data») documenta una scelta consapevole:
  va riscritto, non cancellato in silenzio.
- **Propagazione** — cambia gli output di un endpoint spedito (`/v1/composition/essential-ranking`).
  La maturità di ogni skill scende di un fattore 5/6, quindi `investmentPriority` **sale** per tutte:
  il registro chiede esplicitamente di «ri-verificare il ranking LIVE prima/dopo, dichiarando il delta».
  Va misurato l'ordine, non solo i valori.
- **Chi** — Claude.
- **Guardia** — la prova deve poter fallire: misuro il ranking **prima** della modifica e **dopo**,
  sull'endpoint reale con login reale, e confronto le due liste. Se l'ordine non cambiasse affatto
  su nessuna skill, dovrei sospettare di non aver misurato niente.

### T5 — D-78, il falso negativo sul clone

- **Precondizioni** — il gemello `linux-pc` (192.168.1.11) dev'essere raggiungibile per misurare;
  se non lo è, l'indagine si ferma e lo dichiara.
- **Meccanismo** — lo script legge `POSTGRES_PORT`/`POSTGRES_USER` **dal `.env` del repo**
  (righe 16-24) e confronta un `psql` locale su quella porta con un `psql` sulla VM eseguito come
  `postgres`. Le ipotesi da distinguere, in ordine di economia:
  (a) il `.env` del gemello punta a una porta che non è quella del DB clonato (il `.env` di sviluppo
  usa **5433**, che qui è il tunnel verso la VM, non il DB locale);
  (b) `--no-acl` scarta i GRANT e l'utente del confronto perde la lettura → ma allora tutte e tre
  le tabelle darebbero `?`, mentre due davano `0`;
  (c) il restore è arrivato davvero incompleto al momento del check e un giro successivo l'ha sanato
  — nel qual caso **il gate aveva ragione** e il debito è scritto male.
  Il pattern misto `?` su una tabella e `0` su due è il fatto che discrimina: va spiegato, non aggirato.
- **Propagazione** — un'eventuale correzione a `clone-vm-db.sh` va portata sul gemello, che è la
  macchina che esegue davvero il timer.
- **Chi** — Claude, se il gemello risponde.
- **Guardia** — il registro lo dice bene: **non abbassare il gate**. Un falso allarme è fastidioso,
  un falso via libera su un clone mutilato è il motivo per cui il gate esiste (S1030 Z-022).
  Qualunque modifica deve rendere il controllo **più** discriminante, non più permissivo.

### T6 — D-56, claude-mem

- **Precondizioni** — sapere quale versione è installata e quale esiste a monte.
- **Meccanismo** — il debito dice «ripristinare quando il plugin è aggiornato/riparato»:
  la condizione va **verificata**, non assunta. Se a monte non c'è nulla di nuovo, la riga resta
  aperta ma con la data della verifica, così il prossimo che la legge sa che non è stantia.
- **Propagazione** — è configurazione locale Windows (`~/.claude/`), fuori dal repo. Nessuna.
- **Chi** — Claude.
- **Guardia** — gli originali sono salvati (`bun-runner.js.orig-bak`, `settings.json.bak-…`).
  Non riabilito nulla senza prova che il crash all'avvio sia sparito: riabilitarlo a vuoto
  ribloccherebbe tutte le letture di file, che è esattamente l'incidente di S1020.

---

## Registro delle scoperte (R24.5 — fuori da questo ciclo)

Voci trovate durante il lavoro che **non** entrano in «cosa resta» e non bloccano la chiusura.
Si presentano a Enzo una volta sola, a fine ciclo.

- **Il commento in testa a `i18n-parity.yml` porta già il marcatore `[S1045]`** pur essendo stato
  scritto dal commit `29cc8aca` di oggi pomeriggio: la numerazione di sessione era già avanzata
  prima di questo avvio. Nessun impatto, ma spiega perché il registro dei debiti risultava indietro.
- **`sys_user_skills` non usa MASTER su nessuna delle 1.355 righe.** Non è un difetto in sé, ma
  significa che il livello più alto della scala non è mai stato assegnato in produzione: se è
  intenzionale va detto, se non lo è c'è un pezzo di valutazione che non arriva mai in cima.
