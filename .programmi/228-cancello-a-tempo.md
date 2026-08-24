# 228 — Il cancello a tempo: cosa è marcito mentre non guardavo

> **item**: #228
> **stato**: CHIUSO
> **chiuso**: S1079 (2026-08-24) — 6/6 fasi, la prova sul vivo alla terza corsa
> **deciso da Enzo**: 2026-08-24, S1079 — *«procedi con il cancello a tempo»*

## Il difetto che lo fa esistere

Il cancello attuale (`verify_gate.py`) guarda il **diff**: un controllo scatta se e solo se io
tocco un file che lo instrada. È un modello coerente, e **presume che le cose si guastino solo
quando le tocco io**.

I sette difetti bonificati in S1079 dicono che non è così. **Nessuno** nasceva da un diff:

| difetto | cos'era cambiato davvero |
|---|---|
| `#148` bloccata «fino al 2026-08-20», oggi il 24 | **il tempo** |
| `#169` ferma su `#147`, che è chiusa | **un'altra voce** |
| `#86` login: sulla VM ora funziona | **una macchina** |
| `F6-07` → 4.464 competenze orfane | **una voce chiusa** senza portarsi il residuo |
| `verifica_incrociata` rossa da chissà quando | **il database** |

Sono stati trovati perché Enzo ha chiesto di cercarli. **Non è una procedura.**

## Cosa fa

Risponde alla domanda che oggi non fa nessuno: ***«è marcito qualcosa mentre non guardavo?»***
Due parti.

**A — esegue gli strumenti che nessun diff instrada.** L'elenco **non si scrive a mano**: si
deriva leggendo `verify_gate.SUITES` (cosa è già instradato) e gli import di `session_start.py`
(cosa gira al boot). Tutto ciò che resta è scoperto, e **uno strumento nuovo entra da sé**.
Scriverlo a mano ripeterebbe esattamente il difetto che questa voce corregge.

**B — cinque controlli di stato che oggi non esistono**, uno per ciascuna forma trovata in S1079.

## Simulazione (R24 §3), fatta prima di scrivere

- **Precondizioni** — `verify_gate.py` e `session_start.py` esistono e sono leggibili (verificato: la derivazione produce 10 comandi instradati e 5 import di boot). Il register è parsabile: il codice esiste già in `programmi.py` e `handoff_lint.py`.
- **Meccanismo** — lettura del **codice reale** dei due file, non una lista ricopiata. Verificato sul vivo prima di scrivere una riga.
- **Propagazione** — lo strumento sta nel repo, quindi `align-clones` lo porta. L'aggancio va in `close-propagate.sh`, che è uno **script che gira davvero** a ogni chiusura: metterlo solo nella skill `handoff` lo farebbe dipendere dal fatto che me ne ricordi, che è il difetto da cui nasce la voce.
- **Chi** — io, per intero.
- **Guardia** — è in **sola lettura**: non scrive né sul repo né sul database. Il rischio non è il danno, è il **falso verde**: quindi ogni controllo nasce col suo selftest, e il selftest si sabota per vederlo rosso.

## Fasi

- [x] **F1 La derivazione dell'elenco** — FATTO 2026-08-24 (S1079) · derivata leggendo `verify_gate.SUITES` e gli import di `session_start` (transitivi: `build_menu`/`status_dashboard` contano). **10 scoperti** su 24. 4 casi nel selftest, fra cui «uno strumento instradato NON compare» e «questo file non misura se stesso»; sabotato spegnendo la lettura di cosa e' instradato → rosso. Evidenza: — leggere `verify_gate` e `session_start`, produrre l'elenco degli strumenti scoperti. **fatto =** `--elenco` stampa cosa eseguirebbe e perché, e un selftest verifica che uno strumento **già instradato** NON compaia (altrimenti la derivazione è finta)
- [x] **F2 L'esecuzione, con l'esito che non si perde** — FATTO 2026-08-24 · tetto 240s per strumento, `NON MISURABILE` su timeout e su errore di esecuzione — mai un verde. Corsa reale: 10 eseguiti, 9 verdi, **`verifica_incrociata` rossa**. Evidenza: — ogni strumento scoperto eseguito, exit code raccolto, un tetto di tempo per ciascuno. ⚠ Un timeout non è un verde: va dichiarato per quello che è. **fatto =** esito per strumento, e `NON MISURABILE` quando non si è potuto guardare
- [x] **F3 I cinque controlli di stato** — FATTO 2026-08-24 · M1..M5 scritti e provati sul register vero: **M3 4 casi · M5 5 casi** (di cui 4 *ciechi*: attese senza alcuna data). ⚠ **M4 ha prodotto 3 falsi rossi alla prima corsa** — trattava `FATTO` come stato vivo, mentre il vocabolario ne ha **tre** di terminali (`DONE`/`FATTO`/`WON'T-DO`). Corretto e difeso da un caso proprio. Evidenza: — `M1` dipendenza sciolta (GATED su voce DONE) · `M2` data di sblocco passata · `M3` residuo dichiarato in una voce chiusa senza destinazione · `M4` piano esaurito su voce viva · `M5` attesa di un input, stantia. **fatto =** i cinque girano sul register vero e ritrovano i casi di S1079 su un register-fixture che li contiene
- [x] **F4 Il selftest che sa fallire** — FATTO 2026-08-24 · **17/17 verdi**, e ogni controllo in due versi (uno che accende, uno che deve tacere). **Sei sabotaggi eseguiti**, ognuno ha acceso esattamente il caso suo: M1 (lettura dello stato), M2 (confronto con oggi), M3 (destinazione sempre trovata), M4 (confronto sulle fasi), M5 (soglia), derivazione (ignoro cosa e' instradato), piu' il settimo su `FATTO` fuori dai terminali. Evidenza: — un caso per controllo, e **ognuno sabotato** per vederlo rosso. ⚠ Regola ⑤ del metodo di bonifica: un controllo che non si è mai visto rosso non è una prova. **fatto =** selftest verde, e l'elenco dei sabotaggi eseguiti con l'esito
- [x] **F5 L'aggancio, e la prova che l'aggancio tiene** — FATTO 2026-08-24 · dentro `scripts/close-propagate.sh`, **non** nella skill `handoff`: la skill istruisce il modello, lo script gira. ⚠ **Il primo aggancio era rotto e in silenzio**: usava `$RADICE`, che li' non esiste — il test `-f` sarebbe fallito e il blocco saltato, sembrando agganciato. Corretto in `$ROOT` e **provato** che il file esiste al path che lo script usa. Codici d'uscita verificati: 1 coi rossi, 0 su `--elenco` e `--selftest`. Evidenza: — dentro `close-propagate.sh`. **fatto =** una chiusura reale lo esegue e ne riporta l'esito, verificato leggendo l'output della chiusura, non il codice
- [x] **F6 La prova sul vivo: una chiusura reale lo esegue senza che io lo lanci** — **FATTO 2026-08-24**: la corsa `20260824T200005-1485` porta `"step":"marciume","outcome":"fallito"` nel diario, e l'output della chiusura contiene la sezione del cancello col suo verdetto. ⚠ Ci sono voluti **tre** tentativi, e le prime due volte l'aggancio non girava restituendo **exit 0** — la ragione per cui il `chiuso-quando` chiedeva di leggere l'**output**, non il codice — il `chiuso-quando` non chiede che il codice funzioni (F1-F5 lo dimostrano): chiede che **giri da solo**. Un aggancio si prova eseguendo la cosa a cui e' agganciato e **leggendone l'output**, non rileggendo il codice — che e' proprio il modo in cui il primo aggancio, rotto, sembrava a posto. **fatto =** l'output di una `close-propagate.sh` reale contiene la sezione «marciume» e il suo verdetto, e il passo compare in `close-log.sh report`

## Chiuso quando

Una chiusura di sessione esegue il cancello **senza che io lo lanci**, il suo verdetto compare
nell'esito della chiusura, e i cinque controlli di stato hanno ciascuno un sabotaggio che li ha
visti rossi.
