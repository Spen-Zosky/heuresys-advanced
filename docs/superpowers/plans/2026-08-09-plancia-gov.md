# La plancia diventa la console di volo di gov

**Istruzione**: Enzo, sessione `e3112922` riga 1898, 2026-08-09 14:16:55Z. Trascritta
integrale in `.zp/GOV-DA-FARE.md`. **Condizione posta da lui**: «quando avremo la
certezza che tutto regge». Sciolta dall'istruttoria di S1052 (vedi §0).

**Vincolo di sessione**: modalità gov. Si tocca `scripts/`, mai `apps/`, `packages/`,
`db/`. La plancia è una webapp di servizio: le regole UI del prodotto (`@heuresys/ui`)
non si applicano — è uno strumento, non il prodotto.

---

## 0. Da dove si parte — misurato, non ricordato

| | |
|---|---|
| file | `scripts/zp_panel.py`, **1.121 righe**, 59 KB, server stdlib |
| pagina | **una costante HTML unica** (riga 469) servita per qualunque indirizzo |
| sezioni | **12**, tutte in fila: stato macchina · piano in numeri · ondate · spesa · lancio · fermare · attività pianificate · vassoio Enzo · triage · censimento · storico · log |
| lettura | **un solo** endpoint `/api/stato`, che rilegge tutto insieme |
| ritmo | `setInterval(5000)` — e ogni giro esegue **due `schtasks` + un `git status`**: tre processi Windows ogni 5 secondi |
| gov | **7 riferimenti, tutte guardie, nessuna vista**: sa che i lavoratori esistono per non pestargli i piedi, non ne mostra uno |

**Ciò che si riusa invece di riscriverlo** (verificato leggendo i file):
`docs/kb/tools/gov_rientro.py` espone `lavoratori()`, `rami_con_lavoro()`,
`verdetti()`, `freno()` come funzioni Python. `scripts/gov-lib.sh` espone le primitive
(`gov_worktree_base`, `gov_fuori_perimetro`, `gov_lock_chi`, …). La plancia le importa,
come `plancia.py` già importa la funzione di lettura di `zp_panel`.

## 1. Le voci

| id | cosa | chi | fatto quando | stato |
|---|---|---|---|---|
| **P1** | Due ritmi separati: `/api/volo` leggero (2 s) e `/api/stato` pesante (20 s) | io | ~~criterio~~ **FATTO** — misurato: `/api/stato` 1,18 s · `/api/volo` 0,008 s (**150×**). Aggiornamento 2,5× più frequente con ~¼ del carico | **fatto** |
| **P2** | Navigazione a viste: 4 viste (Volo · Lavoratori · Piano · Storico) al posto della pagina unica | io | **FATTO** — provato in Chrome: le viste si aprono, la scelta persiste al reload, nessun errore console. Il caso limite (riga con schede di viste diverse) passa a colonna unica invece di lasciare mezzo schermo vuoto | **fatto** |
| **P3** | Vista **Lavoratori**: albero, ramo, cluster, azioni, commit, verdetti, rami in attesa | io | **FATTO** — dati reali a video: w1 (Z-230, 123 azioni, 1 commit) e w2 (Z-112, 106 azioni, `cluster-interrupted`), il verdetto ROSSO, i 3 rami non ancora su main. Riusa `gov_rientro.py`, non lo riscrive | **fatto** |
| **P0** | `--porta`: l'opzione che il messaggio d'errore suggeriva senza che esistesse | io | **FATTO** — `--porta 8479` avvia una seconda istanza; è ciò che ha permesso di provare il nuovo codice senza spegnere quello in esecuzione | **fatto** |
| **P4** | Finestra sull'attività: coda del diario del lavoratore, in diretta | io | il diario di w1 (123 azioni) scorre nella finestra e si aggiorna mentre un lavoratore gira | da fare |
| **P5** | Composizione dei cluster: quali file tocca ognuno | io | scelto un cluster, la plancia mostra il suo perimetro reale da `zp.config.yaml` | da fare |
| **P6** | Configurazione completa, **sempre verificata** | io | ogni campo della config è modificabile dalla plancia e ogni applicazione ripassa dalla verifica, che può dire di no | da fare |
| **P7** | Cockpit: interruttori e indicatori insieme, stato leggibile a colpo d'occhio | io | freno, STOP, lancio e gli indicatori vivi stanno nella stessa vista, e gli indicatori si muovono | da fare |

**Confine dichiarato adesso**: P1+P2+P3 sono il nucleo e stanno in questa sessione.
P4–P7 dipendono dal contesto residuo; se non ci stanno, restano scritti qui con stato
`da fare`, **non** annunciati come fatti.

## 2. Simulazione — le cinque domande, prima di eseguire

**P1 — due ritmi**
- *Precondizioni*: `stato()` è una funzione sola che fa tutto; va spezzata in due senza
  cambiare ciò che la pagina già mostra.
- *Meccanismo*: le tre chiamate care sono `schtasks /Query` ×2 e `git status --porcelain`
  (lette nel codice, righe 195-197). Vanno nel ramo lento. Freno, lock, STOP e ultimo
  esito sono letture di file: vanno nel ramo veloce.
- *Propagazione*: nessuna, la plancia è locale e si avvia a mano.
- *Chi*: io.
- *Guardia*: se `/api/volo` fallisce, la pagina non deve svuotarsi ma tenere l'ultimo
  valore buono e dirlo. Un cockpit che mostra zero quando non sa è peggio di uno fermo.

**P2 — viste**
- *Precondizioni*: le 12 sezioni esistenti devono continuare a funzionare identiche.
- *Meccanismo*: nessun framework, resta stdlib + JS a mano come oggi; le sezioni si
  nascondono/mostrano, la vista scelta si ricorda in `localStorage`.
- *Propagazione*: nessuna.
- *Chi*: io.
- *Guardia*: se il JS non riconosce la vista salvata, si apre la prima — mai pagina vuota.

**P3 — lavoratori**
- *Precondizioni*: gli alberi possono non esistere (nessuna corsa in volo).
- *Meccanismo*: `gov_rientro.lavoratori()` — già scritto, già provato, ritorna
  albero/ramo/cluster/esito/azioni/commit/non-committati.
- *Propagazione*: nessuna.
- *Chi*: io.
- *Guardia*: zero lavoratori è uno stato normale, non un errore: si dice «nessuno in
  volo», non si mostra una tabella vuota.

## 3. Ciò che la plancia NON farà, e perché

Le azioni che mutano lo stato restano dove sono oggi (`zp_panel`, :8477). Non si
duplicano nella plancia di sola lettura: due posti da cui mutare lo stesso stato è la
ragione per cui oggi esistono due strumenti separati, e non si torna indietro.

Il freno resta un interruttore che **chiede**, mai uno che decide: la regola d'ingaggio
di gov dice che lo toglie solo Enzo, una corsa alla volta.
