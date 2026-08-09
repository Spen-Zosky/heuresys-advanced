# Modalità «gov» — il loop zero-pendenze con più lavoratori

**Item**: `#173` (`SOT_BACKLOG.md`, era `WAIT-INPUT`) · **Piano scritto**: S1052, 2026-08-09
**Origine**: consegna Cowork del 2026-08-08 in `docs/kb/COWORK_INBOX.md` (§ "Sessione gov")
**Stato del piano**: **G1-G6 fatti** (2026-08-09). Resta **solo G7**, che ha bisogno di una parola di Enzo — §10.

> **Cinque cose che si sono viste solo montando i pezzi** (S1052). Nessuna era nel piano.
> (1) Il **lucchetto della suite** era calcolato dalla cartella del sorgente: in due alberi
> sarebbero diventati due lucchetti, cioè nessuna protezione. Ora si impone con
> `SUITE_LOCK_FILE` — protegge un *database*, non una cartella.
> (2) La **skill non sapeva ricevere un cluster assegnato**: con N lavoratori avrebbero
> scelto tutti lo stesso, perché quella selezione è deterministica.
> (3) Il **«modo iniziale»** guardava l'ultimo esito nel repo principale, che in parallelo
> non si aggiorna più: dopo un giorno il driver sarebbe rientrato da bootstrap a ogni corsa.
> Ora guarda il giornale.
> (4) Ci si fermava appena **uno** dei lavoratori diceva di aver finito, lasciando gli altri
> a metà. Ora serve che lo dicano tutti.
> (5) L'**installazione delle dipendenze** di un albero è cara: è un comando a sé
> (`--prepara-alberi N`), non un effetto collaterale di una corsa.

> **Emendamento a G1, deciso eseguendo** (S1052). Il piano diceva che `gov` sarebbe stata
> «un'etichetta, non un permesso», e questo resta vero per il cancello di verifica. Ma la
> decisione 6 di Enzo — *gov non tocca mai codice* — sarebbe rimasta **prosa**: e questo
> progetto ha già scritto, nel commento in testa a `session_mode.py`, che «la modalità non
> è una promessa del modello, è uno stato su disco». Quindi `gov` ha una guardia propria e
> vieta **una cosa sola**: scrivere in `apps/`, `packages/`, `db/`. Divieto minimo e non
> lista di permessi — `#121` ha misurato che una guardia larga rifiuta lavoro legittimo,
> in silenzio.

---

## 1. Cos'è, in una frase

`gov` non è una funzionalità nuova: è **`zero-pending-loop` con 2-3 lavoratori invece di uno**.
Stesso cervello (piano, cluster, classi A-D, corsie, freno `meta.autorizzato_non_presidiato`),
motore diverso. `gov` orchestra e non tocca mai codice.

## 2. Confine di questa sessione — dichiarato prima di iniziare

- **Questa sessione produce il piano**, non l'implementazione. È ciò che `#173` chiedeva
  (`input-richiesto: il via a scrivere il piano`) ed è ciò che Cowork chiedeva esplicitamente
  (`Non implementare direttamente: produrre prima un PLAN`).
- **L'esecuzione è 2-3 sessioni separate** (§7 la scompone). La voce G1 da sola è ~2h;
  G3+G4 insieme sono il pezzo grosso.
- **La modalità `gov` NON esiste ancora**: `avvia sessione gov` oggi apre una sessione
  `canonical`. Verificato in questa sessione, non ricordato:
  `sh scripts/hooks/hook.sh mode <session_id>` → `canonical`.

## 3. Le sette decisioni di Enzo — riportate, NON da ri-chiedere

Sono già prese (consegna del 2026-08-08). Il piano le rispetta; nessuna voce le rimette in gioco.

| # | Decisione |
|---|---|
| 1 | Consolidamento **manuale** con un comando `stato gov`. Nessuna sessione che si riapre da sola. |
| 2 | Il perimetro di un cluster si **dichiara**, non si deduce. |
| 3 | Perimetro assente o ambiguo ⇒ quel cluster torna **sequenziale**, senza bloccare gli altri. |
| 4 | **2 lavoratori di default, 3 come tetto**, configurabili. |
| 5 | **Nessuna** classificazione di rischio parallela: si riusano le classi A-D esistenti. |
| 6 | `gov` è **solo dispatcher**: assegna, verifica, lancia, consolida. Mai codice. |
| 7 | Lavoratori morti/bloccati: si riusa il pattern del driver esistente, non se ne inventa un altro. |

## 4. Cosa ho misurato — e cosa la misura ha smentito

Ogni riga qui sotto ha un comando dietro, eseguito il 2026-08-09. Il codice è la verità;
la consegna era un'ipotesi.

| Affermazione | Esito della misura |
|---|---|
| `get_mode()` collassa su `canonical` tutto ciò che non è `lab` | **CONFERMATA** — `session_mode.py:104` (`return LAB if mode == LAB else CANONICAL`). Il parser `_CMD_RE:177` non conosce alcun terzo comando. |
| Il driver ha un lock globale che vieta due istanze | **CONFERMATA** — `zero-pending-driver.sh:173-186`, acquisizione atomica via `set -o noclobber`, recupero degli orfani via `kill -0`. |
| Nessun sistema «Agent Teams / 40 agenti» nel repo | **CONFERMATA** — nessun `.claude/agents/`. Il pattern reale è `claude -p ... &` + `wait` (`driver:291-297`). |
| «Il lock della suite non è mai stato implementato: zero occorrenze di `suite.lock` nel repo» | **SMENTITA.** Esiste da **`9e3e28b6`, 2026-08-05 21:15** — `apps/api/test/helpers/suite-lock.ts`, agganciato come `globalSetup` in `apps/api/vitest.config.ts:79`. PID + orario, lock stantio ignorato, via di fuga `SUITE_LOCK=0`. **L'addendum B della consegna è superato**: il rimedio esiste, e va *verificato con N lavoratori*, non costruito. |
| Il perimetro va dichiarato «nel piano» | **PRECISATA.** La classe di rischio **non** vive nel piano markdown: `carica_piano()` la legge da `zp.config.yaml → clusters:` (`zp_state.py:136,147`). Il perimetro segue lo stesso posto — che è esattamente ciò che la decisione 2 chiede («stesso principio già in uso per la classificazione»). |

### 4b. La scoperta che cambia l'architettura, e che la consegna non nomina

**Il perimetro sui file non basta: tre guardie esistenti ragionano sull'INTERO working tree.**

| Guardia | Dove | Cosa fa con due lavoratori nello stesso tree |
|---|---|---|
| «non parto su repo sporco» | `zero-pending-driver.sh:154-159` | Permanentemente violata: il tree è sporco per costruzione mentre un lavoratore lavora. |
| impronta del verdetto di verifica | `verify_gate.py:149` (`h.update(git status --porcelain)`) | Il verdetto di A si invalida per i file di B. Verde e rosso diventano casuali. |
| controlli dovuti per file toccato | `zp_gate.py:95-105` | A si vede chiedere le prove dei file di B. |

Due cluster con perimetri di file perfettamente disgiunti **si rompono comunque a vicenda** su
queste tre. Conseguenza: l'isolamento non può essere «lock sui file», deve essere
**un working tree per lavoratore** (`git worktree`) — vedi G3.

**Secondo effetto, da dire prima e non dopo**: la chiusura di quasi ogni cluster fa girare la
suite di integrazione, e la suite è **serializzata** dal lock già esistente (un solo PostgreSQL,
lo stesso tunnel). Due lavoratori **non** danno 2× di velocità: danno parallelismo pieno sulla
parte di ragionamento/scrittura e coda sulla parte di verifica. Il guadagno atteso è
**~1.4-1.6×**, e va **misurato** (G7), non promesso.

---

## 5. La tabella dei deliverable

Una riga per deliverable. Lo stato si legge da qui, non dalla memoria.

| id | cosa | chi | cosa significa fatto | stato |
|---|---|---|---|---|
| **G1** | Terzo e quarto modo di sessione (`gov`, `worker`) in `session_mode.py` | Claude | `avvia sessione gov` → `hook.sh mode <sid>` stampa `gov`; il selftest cresce di 8 casi e **fallisce** se il collasso binario torna | ✅ **FATTO** `53979bbb` |
| **G2** | Campo `perimetro:` in `zp.config.yaml` + controllo di non sovrapposizione | Claude | `zp_state.py perimetri --corsia safe` elenca i gruppi parallelizzabili; due cluster che condividono un path non finiscono mai nello stesso gruppo; cluster senza perimetro → gruppo sequenziale | ✅ **FATTO** `6fb00aee` |
| **G3** | Isolamento per worktree + lock per-cluster al posto del lock globale | Claude | 2 lavoratori girano insieme su due worktree; il driver singolo continua a funzionare **identico** quando `--lavoratori 1` | ✅ **FATTO** `6c64c729` + `806c3b9f` |
| **G4** | Stato separato per lavoratore | Claude | ogni lavoratore ha il suo stato; il giornale di spesa resta unico e cumulativo | ✅ **FATTO** `806c3b9f` — **risolta diversamente**: non `.zp/w1/`, ma `<albero>/.zp/`. Con un albero per lavoratore il nome dei file non serve cambiarlo: due lavoratori non si vedono perché hanno due alberi. Zero modifiche a `verify_gate`, `zp_gate`, `zp_selftest` |
| **G5** | Comando `stato gov` (consolidamento manuale, decisione 1) | Claude | un comando stampa: chi sta girando, su che cluster, da quanto, spesa per lavoratore e totale, esiti raccolti | ✅ **FATTO** `497bfa13` — `zp_state.py stato-gov` |
| **G6** | Lock condiviso su `zp.config.yaml` (censimento ↔ lavoratori) | Claude | un censimento lanciato mentre 2 lavoratori girano **si ferma dicendo chi**; e viceversa | ✅ **FATTO** `497bfa13` |
| **G7** | Prima corsa presidiata a 2 lavoratori, con misura del guadagno reale | Claude + **Enzo** | due cluster chiusi in parallelo con evidenza live; tempo a 1 lavoratore vs 2 lavoratori misurato e scritto | ⏳ **WAIT-INPUT** — vedi §10 |

**Fuori dal piano, dichiarato**: il freno `meta.autorizzato_non_presidiato: false` **resta
inserito**. `gov` non lo tocca e non lo aggira: è una decisione di Enzo, separata da questa.
G7 gira **presidiata**, cioè con il freno ancora giù e l'autorizzazione data a mano per quella corsa.

---

## 6. Simulazione — le cinque domande, per ogni voce, prima di eseguire

### G1 · I due modi nuovi

- **Precondizioni** — `scripts/hooks/hook.sh` è già registrato su `UserPromptSubmit`,
  `PreToolUse` e `Stop` in `.claude/settings.local.json:34,46,57,68`. Nessun nuovo aggancio.
- **Meccanismo** — `_CMD_RE` (riga 177) diventa `avvia\s+sessione(?:\s+(lab|gov))?`;
  `get_mode()` (riga 104) passa da ternario a mappa esplicita sui valori **riconosciuti**,
  con `canonical` come esito di ogni altro valore. `set_mode()` accetta un `ruolo` e un
  `cluster` opzionali, per i lavoratori.
  **Il fail-safe si estende, non si allenta**: `lab` resta l'unico modo che *allenta* una
  guardia. `gov` e `worker` passano dal cancello di verifica **esattamente come `canonical`**
  (`cmd_stop_gate:577` continua a lasciar passare **solo** `lab`), e `cmd_lab_guard:604`
  continua a filtrare **solo** `lab`. `gov` è un'etichetta, non un permesso.
- **Propagazione** — `session_mode.py` è versionato: arriva su VM e linux-pc con
  `align-clones`. Il registro `<padre del repo>/.heuresys-session-mode/` è stato di macchina
  e **non** si propaga, per costruzione (commento riga 13-14). Nulla da portare a mano.
- **Chi** — Claude, per intero.
- **Guardia** — il selftest (`cmd_selftest:701`) è la guardia, e oggi **non vedrebbe** la
  regressione: i suoi casi `parse` conoscono solo `lab`. Si aggiungono 8 casi, fra cui
  `("avvia sessione gov", GOV)`, `("avvia sessione govern", None)` e
  `marcatore con mode="gov" → stop-gate NON allenta`. **Prova che il test può fallire**:
  prima di correggere `get_mode`, i casi nuovi devono girare e fallire — se passano subito,
  misurano sé stessi (regola 5 del metodo di bonifica).

### G2 · Il perimetro dichiarato

- **Precondizioni** — `zp.config.yaml` ha già una voce per cluster
  (`Z-004: {classe: B, perche: "..."}`). Il file è YAML letto con `yaml.safe_load`
  (`zp_state.py:85`): un campo in più non rompe nulla di ciò che lo legge oggi.
- **Meccanismo** — la voce diventa
  `Z-004: {classe: B, perche: "...", perimetro: [apps/api/src/modules/x/**, packages/shared/src/y.ts]}`.
  Nuovo sottocomando `zp_state.py perimetri`: legge i candidati di corsia, scarta chi non
  ha `perimetro`, e raggruppa in insiemi **disgiunti** per prefisso di path normalizzato.
  Confronto per prefisso, non per glob-match a glob-match: `apps/api/**` e
  `apps/api/src/modules/x/**` **si sovrappongono** e devono risultare in conflitto.
- **Propagazione** — `zp.config.yaml` è versionato: nessun passo manuale.
- **Chi** — Claude. La compilazione dei `perimetro:` per i cluster reali è lavoro
  incrementale: si dichiara **solo per i cluster candidati al parallelo**, non per tutti e 262.
- **Guardia** — decisione 3 in codice: perimetro assente/vuoto/ambiguo ⇒ il cluster **non è
  parallelizzabile**, va in coda sequenziale, e **non blocca** gli altri. Il caso limite che
  la prova deve coprire: perimetro `["/"]` o `["**"]` — deve risultare in conflitto con
  chiunque, non in «nessuna sovrapposizione».

### G3 · Isolamento e lock

- **Precondizioni** — `git worktree list` oggi mostra il tree principale più uno
  **prunable** in `%TEMP%\ghp`: va ripulito con `git worktree prune` prima di aggiungerne.
  Un worktree nuovo richiede, verificato in passato su questo progetto: copia di `.env`,
  copia di `.secrets/`, e `pnpm install` + browser Playwright se il cluster fa E2E.
- **Meccanismo** — **si estende `zero-pending-driver.sh`, non se ne scrive un secondo**
  (la consegna lo dice e il codice lo conferma: il lock globale nasce da un difetto reale,
  S1030). Flag nuovo `--lavoratori N` (default **1**: comportamento di oggi, byte per byte,
  stesso percorso di codice). Con `N>1`: il lock globale resta e significa *un solo
  orchestratore per repo*; dentro, il driver crea/riusa `N` worktree, assegna un gruppo
  di `zp_state perimetri`, apre `N` figli `claude -p` e li attende tutti.
  Il pattern di recupero (pid vivo? orfano recuperato; TERM che uccide i figli) è già
  scritto alle righe 173-193 e si **riusa**, come da decisione 7 — con una correzione
  obbligata: `FIGLIO` diventa una **lista** di pid, e il `trap` li uccide tutti.
- **Propagazione** — il driver è versionato. I worktree sono locali di macchina e vivono
  fuori dal repo; vanno dichiarati in `.gitignore` solo se creati dentro.
- **Chi** — Claude.
- **Guardia** — la guardia «repo sporco» (riga 154) **si sposta nel worktree del
  lavoratore**, non si rimuove: ogni figlio la applica al proprio tree. Caso limite che la
  prova deve coprire: un lavoratore che muore lasciando il suo worktree sporco **non deve**
  impedire agli altri di finire, ma deve impedire il **riuso** di quel worktree.

### G4 · Lo stato per lavoratore

- **Precondizioni** — chi scrive in `.zp/` oggi, censito: il driver
  (`cursor.json`, `last-outcome.json`, `last-response.json`, `last-stderr.log`,
  `runs.ndjson`, `zero-check.json`), `zp_state` (`todo.json`, `PROGRESS.md`),
  `verify_gate` (`verify-verdict.json`, `verify-logs/`), `suite-lock.ts` (`suite.lock`),
  `zp_selftest` (`selftest/`), la plancia (`zp-panel-chiave.txt`).
- **Meccanismo** — si separa ciò che è **per corsa** da ciò che è **condiviso**.
  Per lavoratore → `.zp/w<N>/`: `cursor.json`, `last-outcome.json`, `last-response.json`,
  `last-stderr.log`, `verify-verdict.json`. Condivisi, e devono restarlo →
  `runs.ndjson` (append-only: il tetto di spesa è **cumulativo su tutti i lavoratori**),
  `STOP` (il freno vale per tutti), `suite.lock` (serializza per costruzione),
  `PROGRESS.md` (lo riscrive `stato gov`, non i lavoratori).
- **Propagazione** — `.zp/` è gitignorato: nessuna.
- **Chi** — Claude.
- **Guardia** — il tetto di spesa è il punto che si può rompere in silenzio: `spesa_totale()`
  (riga 234) somma `runs.ndjson`. Se ogni lavoratore tenesse il proprio, il tetto si
  moltiplicherebbe per N senza che nessuno lo veda. **Post-condizione che protegge ciò che
  NON deve cambiare**: con `--lavoratori 2` e tetto \$120, la somma delle spese dei due
  figli deve essere confrontata con \$120, **non** \$120 ciascuno — e la prova si costruisce
  iniettando due righe finte in `runs.ndjson` e verificando che il driver si fermi.

### G5 · `stato gov`

- **Precondizioni** — G4 fatto (senza namespacing non c'è niente da consolidare).
- **Meccanismo** — sottocomando di `zp_state.py` (non un file nuovo: è lettura di stato,
  che è già il suo mestiere). Legge `.zp/w*/`, i pid vivi, `runs.ndjson`, e stampa una
  tabella. **Sola lettura**, coerente con la decisione 1: non riapre nulla, non rilancia nulla.
- **Propagazione** — versionato.
- **Chi** — Claude.
- **Guardia** — un lavoratore morto deve apparire come **morto**, non come «in corso».
  Il criterio è il pid (`kill -0`), non la freschezza del file: la plancia ha già imparato
  questa lezione (un file `.jsonl` aperto non prova che una sessione sia viva).

### G6 · Il lock su `zp.config.yaml`

- **Precondizioni** — il modo `censimento` riscrive `zp.config.yaml` per intero
  (`bootstrap.md:105`: azzera `clusters:`, aggiorna `meta.plan`, rimette
  `clusters_classified: true`) e si invoca a mano (`zp censimento ok`), fuori dal driver:
  la plancia lo lancia con un `claude -p` diretto (`zp_panel.py:303`).
- **Meccanismo** — `.zp/config.lock` con pid + orario + chi, stesso schema di `suite.lock`
  (che è già collaudato in produzione: **si riusa la sua forma**, non se ne inventa una).
  Lo rispettano: il censimento prima di riscrivere, e il driver all'avvio di ogni giro.
- **Propagazione** — nessuna, `.zp/` è locale.
- **Chi** — Claude.
- **Guardia** — lock stantio (pid morto) ignorato e sovrascritto, come in `suite-lock.ts`:
  senza questa clausola il primo Ctrl-C trasforma il rimedio in un blocco permanente.

### G7 · La prima corsa vera

- **Precondizioni** — G1-G6 fatti; freno ancora inserito; Enzo davanti.
- **Meccanismo** — due cluster di **classe A o B** (mai C/D) con perimetri disgiunti,
  `--lavoratori 2 --max-iterations 1`, corsia `safe`, presidiati.
- **Propagazione** — se la corsa chiude cluster reali, la chiusura passa dal rito
  normale (`handoff`), che è già l'unico writer della SoT.
- **Chi** — Claude esegue, Enzo guarda.
- **Guardia** — `--dry-run` prima: deve stampare i due gruppi e **non aprire** sessioni.
  La misura del guadagno si fa contro un tempo a 1 lavoratore misurato **lo stesso giorno**,
  non contro un ricordo.

---

## 7. Come si spezza in sessioni

| sessione | voci | perché insieme |
|---|---|---|
| A ✅ | **G1 + G2** | Non toccano il driver. Chiudono da sole, con selftest verde. ~2-3h. **Chiusa il 2026-08-09** (S1052), commit `53979bbb` + `6fb00aee`. |
| B ✅ | **G3 + G4** | Sono lo stesso intervento visto da due lati (isolamento e stato). Separarle lascia il driver a metà. ~3-4h. **Chiusa il 2026-08-09** (S1052), commit `6c64c729` + `806c3b9f`. |
| C | **G5 + G6 + G7** | Consolidamento, lock del censimento, e la corsa vera che li prova tutti. ~2-3h + la corsa. |

## 8. Cosa questo piano NON fa — detto adesso, non alla fine

- **Non toglie il freno** `meta.autorizzato_non_presidiato`. Resta `false`.
- **Non tocca le classi di rischio** (decisione 5).
- **Non promette 2×**: §4b spiega perché il guadagno reale è ~1.4-1.6×, e G7 lo misura.
- **Non dichiara i `perimetro:` di tutti i cluster**: solo di quelli candidati al parallelo.
- **Non costruisce il lock della suite**: esiste già dal 2026-08-05, e va solo verificato
  sotto N lavoratori.

## 9. Registro delle scoperte — fuori da questo ciclo

Presentate **una volta sola**. Non entrano in «cosa resta», non bloccano nulla.

1. Un worktree `prunable` residuo in `%TEMP%\ghp` (`git worktree list`). Pulizia da 10 secondi.
2. La consegna di Cowork riportava «zero occorrenze di `suite.lock`» quando il file esisteva
   già da tre giorni. Vale come conferma della regola `#149`: **ogni consegna va verificata**,
   anche quando è precisa e circostanziata.


---

## 10. G7 — perché si ferma qui, e cosa serve

Tutto il resto è costruito e provato. G7 è **la corsa vera**: due lavoratori che aprono
due sessioni Claude e chiudono due cluster in parallelo. È l'unica voce che non posso
eseguire da solo, e la ragione è precisa.

**Il driver, col freno inserito, esce `3` e non apre nulla** — verificato oggi. Il freno è
`meta.autorizzato_non_presidiato: false`, e la sua riga di configurazione dice che *«non si
toglie da solo: è una decisione di Enzo, non tecnica»*. Non lo tocco, nemmeno per una prova.

**Il nodo è che il freno non distingue i due casi.** Nasce per vietare il lavoro *non
presidiato* — di notte, senza nessuno che guarda. Una corsa **presidiata**, con Enzo
davanti, `--max-iterations 1` e due cluster di classe A/B, è esattamente la «prima corsa
presidiata» che la configurazione stessa indica come passo mancante. Ma il driver non ha
modo di sapere che qualcuno sta guardando, quindi rifiuta comunque.

**Le due strade**, entrambe di Enzo:

1. **Togliere il freno per una corsa sola**, guardandola, e rimetterlo subito. È il percorso
   che la configurazione prevede già; la plancia ha un bottone che rifiuta se le condizioni
   non ci sono.
2. **Distinguere presidiato e non presidiato** nel driver — per esempio un flag che
   richiede una conferma battuta a mano, come già fa il censimento con la sua frase
   rituale. Costa poco, ma **aggiunge una via che aggira un freno di sicurezza**, e una
   scelta del genere non la prendo io.

**Prima della corsa serve comunque un passo pagato**: `--prepara-alberi 2` installa le
dipendenze in due cartelle di lavoro (qualche minuto, ~1 GB di disco l'una). Va fatto
guardando, ed è per questo che è un comando a sé.
