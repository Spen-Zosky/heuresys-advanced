# 217 — Il flusso di chiusura: da rito completo a percorso scelto

> **item**: #217
> **stato**: IN CORSO

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
- [x] **I4 L'armamento non dipende da quale script hai lanciato** — FATTO 2026-08-18 ·
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
- [ ] **I5 Profili di chiusura** — budget ~100k · **il cuore**
      `documenti` / `codice` / `codice+db`, riusando `verify_gate.route()` sulla finestra di
      sessione. La skill salta i passi che non appartengono al profilo, **dichiarando quali**.
- [ ] **I6 I cinque generatori entrano nel ciclo** — budget ~40k
      `build_agent_operations`, `build_concepts`, `build_linked_manifest`, `build_adr_index`,
      `build_graph_hub` non sono in chiusura né richiamati a cascata. Più un controllo di
      freschezza al boot sul modello di `atlas_freshness()`.
- [ ] **I7 Il 429 di GitHub** — budget ~40k · ⚠ **prima misurare se accade ancora**
      Se non si riproduce, l'intervento **non si fa** e si scrive perché.
- [ ] **I8 Il rendiconto viene letto dal boot** — budget ~20k
      269 record e nessuna decisione li legge.

## Chiuso quando

Una chiusura di soli documenti finisce sotto i 5 minuti senza toccare build e deploy; una di
codice arma e finisce senza aspettare la CI; e il rendiconto mostra **un solo** record per
passo, contro i 13 `propaga` e i 19 `deploy` di S1064.

## Prova che deve poter fallire

Tre chiusure reali, una per profilo, misurate **dal rendiconto** e non a occhio. Se il conteggio
dei record per passo non scende, la riprogettazione non ha funzionato — per quanto il flusso
possa sembrare più ordinato.
