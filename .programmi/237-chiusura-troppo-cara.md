# 237 — La chiusura costa un quarto di finestra, e non si sa perché

> **item**: #237 · **priorità**: P1 · **stima**: ~1 sessione (F1 sola: ~40k)
> **stato**: IN CORSO — **F1 FATTA il 2026-08-29 (S1084)**, e ha smentito la premessa
> **nasce-da**: Enzo, 2026-08-29, a fine S1083: *«l'handoff è un collo di bottiglia che non abbiamo
> mai risolto adeguatamente. Una chiusura sessione non può e non deve consumare il 25% di una
> finestra di contesto. È urgente trovare soluzioni adeguate, ma non per tentativi ed errori.»*

## Il vincolo di metodo, che viene prima di ogni proposta

**Non per tentativi.** Quindi la prima fase non tocca niente: misura dove va il costo. Ogni cura
proposta prima di quella misura è una scommessa, e questo file ne conterrebbe la cronaca invece
della soluzione — che è precisamente ciò che Enzo non vuole.

## Quello che è già misurato (2026-08-29, fine S1083)

| file riscritto dalla chiusura | byte | ≈ token | quota di 1M |
|---|---:|---:|---:|
| `docs/kb/SOT_BACKLOG.md` | 926.928 | ~232.000 | **23%** |
| `docs/kb/SOT_STATE.md` | 432.938 | ~108.000 | **11%** |
| `docs/kb/DEBT_REGISTER.md` | 136.170 | ~34.000 | 3% |
| `.handoff/STATE.md` | 5.951 | ~1.500 | 0,1% |

- I tre grandi valgono **~37% della finestra** se letti per intero. Non lo si fa — il boot li
  distilla con `session_start.py`, la chiusura fa edit mirati — ma è la misura del peso.
- `SOT_BACKLOG`: **333 byte di riga media**, +5 righe a sessione, **non cala mai**. Append-only
  di fatto: 2.730 → 2.785 righe in dieci chiusure.
- Delta misurato dal guardiano fra l'invocazione della skill `handoff` e la fine di S1083:
  **192.430 token (19,2%)** — ⚠ ma include `#236` F1 e la correzione CI, che sono lavoro vero.
  **La quota della chiusura pura NON è misurata.** È il primo buco da chiudere.
  → ✅ **CHIUSO da F1 il 2026-08-29**: isolata, quella stessa chiusura costa **37.855 token
  (3,8%)**. I restanti ~154.000 erano lavoro. Questa riga resta come cronaca di com'era
  formulata la domanda, non come misura: la misura sta nella scheda di F1 più sotto.

## Le tre ipotesi, da falsificare non da assumere

1. **Il peso dello stato** — edit mirati su file enormi costano comunque, e la crescita è
   illimitata. Nessuno ha mai *tolto* da `SOT_BACKLOG`: 219 item, di cui molti terminali.
2. **La ripetizione** — la chiusura riscrive quattro file, rigenera tre artefatti, gira il lint
   almeno due volte, propaga, verifica. Quante di queste sono necessarie *a ogni* chiusura?
   Il profilo (`profilo-chiusura.sh`) già ne salta alcune; nessuno ha misurato quanto risparmia.
3. **⚠ Il mio stile di scrittura** — commenti nelle migrazioni da 60 righe, programmi con la
   cronaca di ogni decisione, messaggi di commit da 40 righe. Hanno un valore reale (impediscono
   di ri-sbagliare, e in S1083 hanno impedito almeno tre volte di ricominciare un'indagine già
   fatta), ma **nessuno ha mai misurato il costo contro quel valore**. Questa ipotesi è la più
   scomoda e la più facile da saltare: va misurata per prima proprio per questo.

## Fasi

- [x] **F1 — DOVE VA IL COSTO, misurato dal transcript e non stimato** — **FATTA 2026-08-29
      (S1084)**. Strumento: `python docs/kb/tools/costo_chiusura.py` (`--dettaglio`, `--csv`,
      `--selftest` = **15 casi verdi**). Misurato su **14 chiusure** distinte, dal 17 al 29 agosto.

  ### ⭐ LA RISPOSTA — e la premessa della voce era falsa

  **La chiusura pura costa 28.352 token in media: il 2,8% di una finestra da 1M.** Non il 25%.
  La peggiore delle quattordici si ferma a **69.326 (6,9%)**, la più leggera a 11.102 (1,1%).

  Da dove veniva il 25%. Dal delta che il piano stesso riportava — «192.430 token fra
  l'invocazione della skill e la fine di S1083» — con accanto l'avvertenza, già scritta, che
  includeva `#236` F1 e la correzione CI. **Quella misura non isolava la chiusura**: sommava tutto
  ciò che era accaduto dopo che la skill era stata invocata. La stessa chiusura di S1083, isolata,
  costa **37.855 token — 3,8%**. Il resto era lavoro vero.

  Non serviva indovinare dove comincia una chiusura: Claude Code **marca alla sorgente** ogni
  turno prodotto sotto una skill (`attributionSkill` sul record `assistant`). I turni marcati
  `handoff` sono la chiusura, anche quando altro lavoro la interrompe a metà — che è esattamente
  il caso che falsava il numero.

  ### La ripartizione — 14 chiusure, 396.931 token

  | categoria | token | % | turni |
  |---|---:|---:|---:|
  | **lettura di stato** | 100.064 | **25,2%** | 52 |
  | **scrittura di stato** | 91.134 | **23,0%** | 44 |
  | altri comandi | 55.017 | 13,9% | 89 |
  | cancelli e lint | 46.462 | 11,7% | 53 |
  | commit e push | 27.572 | 6,9% | 51 |
  | propagazione | 23.341 | 5,9% | 30 |
  | deliberazione (solo testo) | 17.312 | 4,4% | 16 |
  | scrittura (altri file) | 12.939 | 3,3% | 6 |
  | altro (non classificato) | 12.710 | 3,2% | 7 |
  | rigenerazione derivati | 7.502 | 1,9% | 15 |
  | stato via shell (misto) | 2.584 | 0,7% | 1 |
  | lettura (altri file) | 294 | 0,1% | 1 |

  **Lo stato è il 48,2% del costo** — e la sorpresa è che **leggerlo costa più che scriverlo**
  (25,2% contro 23,0%). Le tre ipotesi del piano vanno riordinate di conseguenza: l'ipotesi 1
  (il peso dello stato) è confermata e vale quasi metà; l'ipotesi 2 (la ripetizione: cancelli,
  propagazione, derivati) vale il 19,5%; l'ipotesi 3 (il mio stile di scrittura — i turni di sola
  deliberazione) vale il **4,4%**, cioè è la più piccola delle tre. Era la più scomoda, ed è
  quella che il piano voleva misurare per prima proprio per questo: misurata, non è il problema.

  ### Tre difetti trovati perché la prova poteva fallire

  La prova di falsificabilità non è decorativa: ha **rotto tre volte la misura**, e ogni volta
  il difetto era invisibile nel numero e visibile nel confronto fra le due misure indipendenti.

  ① **Un messaggio non è un record.** Claude Code scrive più record `assistant` per lo stesso
  messaggio — uno per blocco (ragionamento, testo, ogni `tool_use`) — **tutti con lo stesso
  `usage`**. Misurato: 1.049 record per 525 messaggi, fino a 6 per messaggio. Contati come turni
  distinti, la crescita fra due blocchi dello stesso messaggio è zero: il blocco di testo prendeva
  0 token e l'intero costo finiva sull'ultimo `tool_use`. Il sintomo era «deliberazione» al 41,9%
  dei byte e 3,6% dei token. Curato fondendo per `message.id`.

  ② **Una categoria residua che divora il 43%.** «altri comandi» era la voce più grande della
  prima tabella — cioè la risposta alla domanda di `#237` era un'etichetta vuota. Guardandoci
  dentro: `cat .handoff/STATE.md`, `head SOT_STATE.md`, `sed -n '971,985p' SOT_BACKLOG.md`. Era
  **lettura dello stato fatta via shell**, che il classificatore riconosceva solo dal nome del
  tool. Curato — e con un terzo esito onesto, `stato via shell (misto)`, per gli heredoc che
  possono leggere o scrivere: fingere di saperlo sarebbe stato peggio.

  ③ **La stessa chiusura contata due volte.** Due coppie di transcript davano numeri identici al
  singolo token. I file non sono identici (2.422 righe contro 3.157): sono il **fork o la
  ripresa** della stessa sessione, che si porta dietro la medesima coda di chiusura. Escluse, e
  lo strumento dichiara quante ne ha fuse.

  Resta una divergenza dichiarata e **attesa** su `scrittura di stato` (23,0% dei token, 43,9%
  dei byte): il transcript salva per ogni `Edit` anche `oldString`/`newString`/`structuredPatch`,
  che pesano in byte ma in contesto non entrano.

  ### Cosa cambia per F2

  La voce più cara **non è quella che il piano si aspettava**. Non è la scrittura dei tre
  documenti: è la loro **lettura**, 100.064 token su 52 turni — ~1.900 token per turno, quasi
  tutti `cat`/`head`/`sed` su `SOT_*` e `.handoff/STATE.md` per ritrovare il punto da emendare.
  È anche la più curabile, perché una lettura non produce niente che resti.
- [x] **F2 — La cura della voce più cara, una sola** — **FATTA 2026-08-29 (S1084)**, dopo che
      Enzo ha chiesto di procedere anche con le fasi successive.

  ### Cosa si è misurato prima di toccare

  La voce più cara è la **lettura dello stato** (25,2%, 100.064 token su 52 turni). Guardando
  *cosa* si legge: `cat .handoff/STATE.md` ~29.500 token in 9 letture su 14 chiusure ·
  `SOT_STATE.md` ~56.000 · `SOT_BACKLOG.md` ~21.600 fra `sed -n 'N,Mp'`, `grep -n '^### #…'`
  e letture dirette. È il girare intorno a un documento grande per ritrovare il punto da
  emendare.

  E il register è grande per una ragione precisa:

  | | item | byte | quota |
  |---|---:|---:|---:|
  | DONE | 185 | 592.211 | 76% |
  | FATTO | 3 | 18.432 | 2% |
  | WON'T-DO | 5 | 14.185 | 1% |
  | **terminali** | **193** | **624.828** | **80%** |
  | vivi (ACTIVE/HOLD/GATED/WAIT-INPUT) | 30 | 148.220 | 20% |

  **Quattro quinti del register sono cronaca di lavoro già chiuso**, e ogni `grep` la
  attraversa.

  ### La cura: compattare, non cancellare

  `python docs/kb/tools/compatta_register.py` (`--esegui`, `--selftest` = **11 casi verdi**).
  Ogni blocco terminale va per intero in `docs/archive/SOT_BACKLOG_CHIUSI.md`; al suo posto
  resta **la sua prima riga** — id, titolo, status — più il puntatore. Nulla si perde,
  `docs/archive/` è il posto che il CLAUDE.md indica per i record storici, e `handoff_lint`
  continua a trovare ciò che cerca (il controllo A2 chiede che un id chiuso in STATE sia
  *terminale nel backlog*: la riga-indice porta ancora `· status: DONE`).

  **Misurato: `SOT_BACKLOG.md` 911.609 → 321.121 byte, −65%.** Da ~227.900 a ~80.300 token.

  ### Le quattro cose che una scrittura di massa deve portare

  (a) la misura **prima**, stampata a ogni corsa · (b) una **guardia** che rilegge lo status
  al momento dell'esecuzione, mai ereditato · (c) **cinque post-condizioni**, e la più
  importante protegge ciò che *non* doveva cambiare: i 30 item vivi devono restare identici
  **byte per byte** · (d) **rollback dichiarato**: `git checkout --` sui due file, che qui
  basta perché git *è* il giornale.

  🔬 **E la post-condizione ha fatto il suo mestiere alla prima corsa vera**: ha **bloccato la
  scrittura** perché 1 item su 193 (`#224`) non si ritrovava nell'archivio. Non era perso —
  è l'ultimo blocco terminale prima della fine del register, e si porta dietro una riga vuota
  che l'archivio toglie. Il confronto misurava la spaziatura, non la perdita di dati. Curato
  con un `.rstrip()`, e con **due** casi nuovi nel selftest: uno che prova che una riga vuota
  non fa scattare l'allarme, e uno che prova che un archivio **mutilato** lo fa ancora.

  🔬 **Dopo la scrittura**: `handoff_lint` **0 fail / 2 warn** (gli stessi di prima),
  `build_menu` produce un menu **identico** (19 voci), il boot dà `ACTIVE 17 · GATED 1 ·
  WAIT-INPUT 1 · HOLD 8` come prima e `derivati 3/3 freschi`.

  ### ⚠ Quello che questa cura NON fa, dichiarato

  La lettura di stato è ripartita fra **tre** file, e questa cura ne tocca uno: `SOT_BACKLOG`
  valeva ~21.600 dei 100.064 token. Restano `SOT_STATE.md` (432.938 byte) e le riletture
  ripetute di `.handoff/STATE.md`. E soprattutto: **il numero vero si misura sulla chiusura
  successiva**, con `costo_chiusura.py`, come il piano prescrive. Finché quella misura non
  c'è, questa fase ha ridotto il *peso* — non ha ancora dimostrato di aver ridotto il *costo*.

  _(testo originale della fase, per storia)_ Si affronta la prima della tabella di F1,
      non tutte insieme: una cura per volta, con la misura prima e dopo. Se la voce più cara è il
      peso di `SOT_BACKLOG`, la cura è l'archiviazione degli item terminali (219 item, quanti
      terminali? si misura); se è la ripetizione, è il profilo; se sono io, è una regola di
      scrittura. **fatto =** la stessa misura di F1 rifatta, e il numero è sceso · budget ~60k
- [ ] **F3 — Il presidio, perché non ricresca** — qualunque sia la cura, senza un cancello il
      problema torna: `SOT_BACKLOG` è cresciuto per due anni senza che nessuno se ne accorgesse.
      Un controllo al boot che dichiara il peso dello stato e arrossisce oltre una soglia
      **motivata dalla misura di F1**, non scelta a caso. **fatto =** il cancello esiste, ed è
      stato visto rosso · budget ~40k

## Le prove che devono poter fallire

- **F1** — la ripartizione dev'essere **falsificabile**: se sommando le categorie non si ottiene
  il totale che il guardiano misura, la misura è sbagliata e va rifatta. Un'analisi che «torna»
  per costruzione non dimostra niente.
- **F2** — la cura si misura con lo stesso metro di F1, **sulla chiusura successiva**. Se il
  numero non scende, la cura non ha funzionato: si dichiara e si passa alla seconda voce, non si
  cerca una spiegazione al perché avrebbe dovuto funzionare.
- **F3** — la soglia va vista **rossa** almeno una volta, altrimenti è un numero scritto.

## Chiuso quando

Si sa dove va il costo della chiusura, la voce più cara è scesa in modo misurato, e un cancello
impedisce che risalga in silenzio.
