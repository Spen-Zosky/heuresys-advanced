# 229 — L'eredità fra sessioni: rilevare ciò che è stato interrotto, e leggerlo all'avvio

> **item**: #229
> **stato**: CHIUSO
> **deciso da Enzo**: 2026-08-24, S1079 — *«la responsabilità di monitorare gli stati di
> avanzamento, misurandoli e registrandoli nei file opportuni che devono fungere da registri di
> sessione è completamente tua»*, con **due controlli chirurgici** richiesti per nome.

## I due controlli, con le parole del mandato

1. **Rilevare e registrare ogni tipo di azione e i relativi esiti eseguiti nella sessione —
   *anche quando li interrompi*** — usando tutti i controlli disponibili per definire lo stato
   effettivo che la sessione lascerà in eredità alla successiva.
2. **Che l'avvio di una sessione rilevi lo stato effettivo del repo** preso in eredità dalla
   precedente, **senza omettere alcuna lettura**.

## I difetti misurati, non supposti

**① Una corsa di chiusura uccisa era indistinguibile da una breve.** Il diario registrava solo i
passi *completati*. Misurato su me stesso il 2026-08-24: una `close-propagate` uccisa a 10 minuti
ha lasciato un solo passo (`deploy saltato`), e il rendiconto la mostrava come «1 passi» — cioè
come se fosse andata così.

**② Il numero di sessione era fermo da QUINDICI sessioni, e il boot taceva.**
`.handoff/session-id` conteneva `S1064` mentre l'ultimo handoff committato era `S1079`. Causa
misurata: il boot calcola il bash di Git come *due livelli sopra `git.exe` + `bin\bash.exe`*, ma
qui `git` risolve a `C:\Git\mingw64\bin\git.exe`, quindi cercava
`C:\Git\mingw64\bin\bash.exe` — **che non esiste** (il bash sta in `C:\Git\bin` e `C:\Git\usr\bin`).
E il ramo di fallimento **non stampava nulla**: `$sessionMsg` restava vuoto e la riga di stampa
lo saltava. Conseguenza: ogni passo di chiusura di quindici sessioni è finito nel diario sotto il
numero sbagliato, e nessuno poteva accorgersene.

## Le scelte, e perché

**Il segnale dell'interruzione è un'ASSENZA.** Si scrive `apertura` all'inizio della corsa e
`chiusura` alla fine: una corsa con l'apertura e senza la chiusura **è stata interrotta**. Non un
`trap`, di proposito — un trap può non scattare (SIGKILL) o scattare a sproposito (in S1049 uno
restituiva 1 su un verde). **Un'assenza non può essere registrata male.**

**La lettura sta nel hook che gira da sé**, non in `session_start.py`: quest'ultimo lo eseguo
seguendo un'istruzione, e un'istruzione si può omettere. Un'eredità che si scopre solo se qualcuno
si ricorda di guardarla non è un'eredità rilevata.

## Fasi

- [x] **F1 Il marcatore di apertura e chiusura** — FATTO 2026-08-24 (S1079) · in `close-propagate.sh`, prima riga e ultima riga scritte nel diario. Evidenza: la corsa reale delle 19:4x ha registrato `apertura` sul vivo
- [x] **F2 Il rendiconto le dichiara** — FATTO 2026-08-24 · `close-log.sh report` elenca le corse con apertura e senza chiusura, con l'ultimo passo e il quando. ⚠ Le corse **precedenti** a questa voce non hanno l'apertura e **non sono giudicabili**: si tacciono invece di dichiararle interrotte, perché un falso allarme retroattivo su decine di corse storiche è il modo più rapido per far ignorare la riga. Provato su un banco a tre casi (completa · uccisa · storica): segnala **solo** l'uccisa
- [x] **F3 Il numero di sessione, e il ramo che taceva** — FATTO 2026-08-24 · il bash si cerca in più candidati (`<root>\bin`, `<root>\usr\bin`, da due radici possibili) escludendo `System32` (WSL, trappola del 2026-08-15). E **i due rami di fallimento ora parlano**. Provato in entrambi i versi: col file a `S1064` il boot lo porta a `S1080` e lo dice; sabotando il candidato di bash, dice «NON DERIVABILE … resta com'era» e il file **non cambia**
- [x] **F4 L'avvio eredita** — FATTO 2026-08-24 · §5c di `session-boot.ps1` legge il rendiconto e annuncia le corse interrotte **con l'identificativo**, non solo il fatto che ce ne siano. Provato nei due versi: con una corsa iniettata dice quale, senza dice «nessuna in sospeso». ⚠ Un difetto mio, trovato provando: il backtick in PowerShell è l'**escape**, e `` `bash `` stampava «ash» — la stessa specie della trappola degli heredoc
- [x] **F5 La prova sul vivo, e il ciclo chiuso** — **FATTO 2026-08-24**, alla TERZA corsa: la corsa `20260824T200005-1485` porta `apertura` → deploy → arma → clone-db → propaga → **marciume `fallito`** (il cancello ha girato dentro la chiusura e ha trovato i rossi da se') → verifica-deploy → **`chiusura` eseguito**. ⚠ **PRIMO TENTATIVO FALLITO, 2026-08-24, ed e' il motivo per cui la prova esiste.** La corsa reale e' finita con **exit 0** ma nel diario **mancava la `chiusura`** e il cancello a tempo **non era stato eseguito**: lo script era morto a `bold: command not found` — una funzione che in `close-propagate.sh` **non esiste** (le sue sono `log`/`warn`/`die`, riga 106). L'avevo dedotta dall'**output**, che mostra `=== … ===` in grassetto, invece che dal **codice che lo produce** — l'errore che la memoria `read_the_file_that_creates_it` descrive. **Due lezioni, non una**: (a) un aggancio si prova **eseguendo**, mai rileggendo; (b) **il codice d'uscita mentiva** — era 0 su una corsa morta a meta', e solo l'output diceva la verita'. Corretto in `log`, e aggiunto agli shell-test un caso che coglie **ogni** funzione usata e mai definita (provato reintroducendo `bold`: lo nomina per file e per nome; suite **220 ok, 0 falliti**).
      ⚠ **SECONDO TENTATIVO FALLITO, causa diversa**: `align-clones` e' uscito con `die` perche' avevo commit non pushati — controllo legittimo — ma le righe finali stavano **dopo** quel punto, quindi una corsa **fallita** finiva registrata come **uccisa**. Ora `die` scrive `chiusura fallito` prima di uscire: l'uscita controllata si distingue dall'ammazzamento, dove nulla puo' essere eseguito e la sola `apertura` resta l'unico segnale possibile.
      ⚠ **TERZO reperto, dal boot**: annunciava **«58 chiusure interrotte»**. Non era l'awk: erano aperture VERE, scritte dai dry-run degli shell-test perche' avevo messo il marcatore **prima** dell'uscita del dry-run. Due correzioni: l'apertura si scrive **dopo** quel ramo, e una corsa con la **sola** apertura non e' interrotta — **non e' mai partita**. Ora ne segnala **2**, che sono le due corse davvero morte oggi. Banco a cinque casi (completa · uccisa · dry-run · fallita · storica): segnala **solo** l'uccisa — una `close-propagate` reale deve lasciare **apertura + chiusura**, e un boot successivo deve dire «nessuna in sospeso». **fatto =** le due righe nel diario della stessa corsa, e l'esito letto dall'output, non dal codice

## Il reperto che vale piu' delle correzioni (S1079)

**Quattro volte in una sera un aggancio e' sembrato fatto e non lo era**, e ogni volta la
verifica «rileggo il codice» l'avrebbe dichiarato a posto:

| tentativo | il difetto | come si e' manifestato |
|---|---|---|
| 1 | `bold`, funzione **inventata leggendo l'output** invece del codice | lo script muore sulla riga, **exit 0** |
| 2 | le righe finali stavano **dopo** un `die` legittimo | corsa fallita registrata come **uccisa** |
| 3 | il marcatore stava **prima** dell'uscita del dry-run | **59** aperture orfane, e il boot gridava «58 interrotte» |
| 4 | spostando il blocco mi sono portato via la definizione di `MARKER` | `unbound variable` alla prima riga utile |

**La regola che ne esce**, gia' nel `chiuso-quando` e ora dimostrata: un aggancio si prova
**eseguendo la cosa a cui e' agganciato e leggendone l'output**. Mai rileggendo il codice, e mai
fidandosi del codice d'uscita — che nei casi 1 e 4 diceva `0` su una corsa morta.

⚠ Il caso 4 ha un limite noto che si dichiara invece di lasciarlo credere: gli shell-test
esercitano `close-propagate.sh` in **dry-run**, che esce prima della riga dove `MARKER` viene
usato. Il difetto era quindi **fuori dalla portata** dei test esistenti, ed e' emerso solo alla
corsa vera. Un test che copra il tratto oltre il dry-run non esiste ancora.

## Chiuso quando

Una corsa reale lascia `apertura` **e** `chiusura`; una corsa uccisa lascia la sola `apertura` ed è
**annunciata dal boot successivo**; e il numero di sessione nel diario coincide con quello vero.
