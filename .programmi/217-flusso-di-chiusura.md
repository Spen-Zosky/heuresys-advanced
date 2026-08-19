# 217 — Il flusso di chiusura: da rito completo a percorso scelto

> **item**: #217
> **stato**: CHIUSO
> **chiuso**: 2026-08-18 (S1070) — 8/8 fasi

Enzo, 2026-08-18: *«è instabile, va spesso in errore, deve rifare più volte le stesse azioni,
richiede tempi lunghi, intercetta errori di GitHub che andrebbero risolti definitivamente e non
adotta strategie sufficientemente smart per selezionare le azioni strettamente necessarie in
ragione delle modifiche generate dalla sessione»*.

Il piano per esteso — diagnosi, tabella del flusso, interventi, verifica end-to-end — vive in
`~/.claude/plans/woolly-napping-ripple.md`. Qui c'è ciò che serve per riprendere.

## La misura che ha fatto nascere la voce

`.handoff/close-log.ndjson`, 269 record su 4 sessioni: **~67 record per sessione** · in S1064 da
sola **13 `propaga`, 19 `deploy`, 16 `arma`** · `deploy` **10 eseguiti su 52** · **12 `clone-db
ignoto` + 6 `arma ignoto`** · **5 `verifica-deploy fallito`**.

## Decisioni di Enzo (non si ri-chiedono)

1. **La chiusura arma e finisce.** Non aspetta la produzione.
2. **Soli documenti → commit e push, basta.**
3. **Il linux-pc resta allineato sempre**: non si salta, si adatta il costo.

## Il fatto verificato su cui poggia tutto

`deploy-watch.sh` fa già la cosa giusta e **i timer sono attivi su entrambe le macchine**. Il
journal del gemello, testuale: *«armato 77a6011e, in produzione 5d3028ca — verifico la CI»* →
*«CI ancora in volo — riprovo al prossimo tick»*. Dentro `vm-deploy` la **stessa** situazione
produce `TIMEOUT dopo 900s → deploy FAILED`: stesso gate, stessa CI, due comportamenti opposti.

## Fasi

- [x] **I1 Una sola definizione dei path di deploy** — FATTO 2026-08-18 · `77a6011e` · `scripts/lib/deploy-paths.sh`; quattro copie byte-identiche più una quinta sparsa in una condizione · due test riscritti dal criterio «le due righe coincidono» a «esiste una sola fonte» · `run-shell-tests` 165 ok / 0 failed
- [x] **I2 Il marcatore di sessione non si consuma più** — FATTO 2026-08-18 · `77a6011e` · era la causa diretta dei 12+6 IGNOTO · la prova è nata **falsa due volte** ed è stata sabotata fino a vederla rossa
- [x] **I3 La chiusura non aspetta mai la CI** — FATTO 2026-08-18 · il default di `vm-deploy.sh`
      è ora NON bloccante: CI in volo → dichiara «armato, non ho toccato niente» ed esce **0**;
      il rosso resta 1. `--deploy-now` esporta `CI_GATE_NONBLOCKING=0` e riottiene il polling,
      e il piano di chiusura lo **dichiara** (`PLAN ci-gate-nonblocking=`). Trovato strada
      facendo che `vm-deploy-remote.sh` inoltrava al remoto quattro manopole del gate su
      cinque: **`CI_GATE_NONBLOCKING` era l'unica esclusa**, cioè D-79 ancora aperto su una
      variabile — chiedere il sincrono non sarebbe mai arrivato al gate che decide.
      8 test nuovi, **provati capaci di fallire due volte**: col default rimesso bloccante cade
      il caso «in volo»; traducendo in «rimanda» anche il rosso ne cadono due, incluso il rosso.
      Il primo sabotaggio ha scoperto un difetto **del test**: senza `CI_GATE_WAIT=0` non
      falliva, **dormiva** 900s — e un test che si blocca nasconde il difetto invece di mostrarlo.
- [x] **I4 L'armamento non dipende da quale script hai lanciato** — FATTO 2026-08-18 · `55108a4b` ·
      `scripts/arma-deploy.sh` porta l'ATTO; la DECISIONE resta ai chiamanti, che hanno finestre
      diverse (close-propagate misura `origin/prod..HEAD`, align-clones sa di stare deployando):
      così non si duplica un predicato. Nella chiusura i due casi sono **disgiunti per
      costruzione** — quando close-propagate arma passa `--no-deploy` di là, e quando passa
      `--deploy` (cioè `--deploy-now`) non arma — e l'atto è comunque idempotente.
      7 test, **sabotati quattro volte**. Due sabotaggi hanno colto difetti dei test, non del
      codice: uno cercava la parola `arm_logged` e restava VERDE anche rinominando
      l'assegnazione (cieco come il grep di `#194`) — ora prende il nome **dalla guardia** e
      pretende che qualcuno lo assegni davvero; e il conteggio delle righe di diario ora si
      **conta** su un diario vero deviato con `HEURESYS_CLOSE_LOG`, invece di dedursi.
- [x] **I5 Profili di chiusura** — FATTO 2026-08-18 · `scripts/profilo-chiusura.sh` +
      `docs/kb/tools/atlante_fresco.py`, e la skill `handoff` con uno **Step 0** che li usa.
      **Il piano diceva «riusando il router di `verify_gate`»: la misura lo ha smentito** —
      `lib/deploy-paths.sh` dichiara che i due non vanno fusi («quali PROVE rifare» contro «cosa
      PROPAGARE», universi diversi), quindi il profilo si costruisce sulle sue regex, importate.
      **La propagazione NON è un passo del profilo**: il linux-pc resta allineato sempre.
      🔬 **La prima esecuzione ha smentito la prima stesura**: l'atlante veniva dedotto dai path
      di deploy, e una finestra che toccava solo `scripts/` stampava «esegui — la finestra tocca
      sorgenti che l'atlante descrive», che è **falso**. Ora si chiede ad `atlas_freshness()`,
      la misura canonica del boot. 8 test, sabotati tre volte (propagazione saltata · «non
      misurabile» tradotto in «salta» · profilo db che non rinfresca il clone): tutti rossi.
- [x] **I6 I generatori entrano nel ciclo** — FATTO 2026-08-18 · `build_derivati.py` (rigenera
      + `--controlla`) chiamato dalla skill **dopo** `build_atlas`, e una riga «derivati» nello
      STALENESS SELF-CHECK del boot.
      **Sono TRE, non cinque, e la misura lo impone**: `build_linked_manifest` e `build_graph_hub`
      scrivono in `wiki-space/`, che esiste **solo sulla macchina Windows** — in chiusura
      fallirebbero su VM e linux-pc, dove la chiusura gira davvero. Restano a `sync.sh`, e un
      test impedisce che rientrino di nascosto.
      **Due dei tre derivano dall'atlante, non dal codice**: è una cascata, e l'ordine è la
      sostanza. Il difetto era reale e già in atto — `concepts-corpus.jsonl` non aveva **6**
      concetti esistenti e ne portava **4** dello schema `brownfield-*`, ritirato settimane prima.
      🔬 Due difetti miei colti eseguendo: la radice del repo risaliva **tre** livelli invece di
      quattro, e la rigenerazione usciva **0** senza aver eseguito niente — un verde a vuoto.
      5 test, due sabotaggi, entrambi rossi.
- [x] **I7 Il 429 di GitHub** — FATTO 2026-08-18 · **misurato prima**: episodio reale ma
      **unico** (2026-08-17, cinque workflow) su 40 corse, e il runner ritenta già tre volte
      da sé. Quindi **il 429 non si cura** — causa esterna, retry già presente, action pinnate
      per sicurezza. Si cura il costo vero: `scripts/ci-rosso-di-chi.sh` dice se un rosso è
      **PROGETTO · INFRASTRUTTURA · NON-VERIFICATO**, senza ammorbidire `ci-gate`. Provato su
      corse **vere** (il 429 del 17 → INFRASTRUTTURA; vitest fallito del 16 → PROGETTO).
      🔬 La firma del 429 era **cieca**: in regex estesa le parentesi sono un gruppo, e il caso
      reale era stato riconosciuto solo grazie alle altre firme. E il primo sabotaggio non
      sabotava — il grep di controllo trovava il proprio commento (`#194`, di nuovo).
- [x] **I8 Il rendiconto viene letto dal boot** — FATTO 2026-08-18 · `e4df9012` ·
      `docs/kb/tools/rendiconto_chiusure.py` (`--boot`) + una riga in GIT & SYNC: quanti passi
      ha richiesto l'ultima chiusura e **quali** sono rimasti non sereni, nominati.
      **Mostra, non decide** — il vincolo della skill («rendiconto, non stato») è rispettato:
      nessun exit code blocca niente, e un diario assente dà `UNK`, mai un verde dal buio.
      Le corse da un passo solo non contano come chiusure, o falserebbero proprio il numero
      che questa voce vuole veder scendere. 5 test, due sabotaggi rossi.
      🔬 Terzo errore identico in un giorno: `REPO` risaliva **tre** livelli invece di quattro,
      e qui produceva «nessuna chiusura registrata» su un diario che ne aveva 269 — un silenzio,
      cioè il modo peggiore di sbagliare.

## Chiuso quando

Una chiusura di soli documenti finisce sotto i 5 minuti senza toccare build e deploy; una di
codice arma e finisce senza aspettare la CI; e il rendiconto mostra **un solo** record per
passo, contro i 13 `propaga` e i 19 `deploy` di S1064.

## Prova che deve poter fallire

Tre chiusure reali, una per profilo, misurate **dal rendiconto** e non a occhio. Se il conteggio
dei record per passo non scende, la riprogettazione non ha funzionato — per quanto il flusso
possa sembrare più ordinato.
