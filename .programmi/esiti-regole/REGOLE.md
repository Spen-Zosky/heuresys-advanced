# Esito — mandato REGOLE (2026-09-26, sessione S1114, non presidiata)

Mandato: regole snelle per Claude 5 e due controlli che smettono di girare a vuoto. Tre lavori, eseguiti in ordine. Sessione senza rito di apertura, per decisione di Cowork/Enzo del 2026-09-26.

## 1. CLAUDE.md del progetto — fatto

Sostituito `CLAUDE.md` con il testo di `03_CLAUDE_heuresys-advanced_bozza.md`, tolto il solo paragrafo "Bozza del 2026-09-26...". Il testo precedente (337 righe, letto dal file prima della sostituzione) è archiviato integralmente in `docs/kb/xtras/PERCHE_LE_REGOLE.md`, con due righe di testa che ne spiegano lo scopo.

Ho verificato uno per uno tutti i riferimenti a file/comandi/script citati nella bozza (24 percorsi, più tre script `pnpm db:*` letti da `package.json`). Un riferimento era sbagliato: la bozza cita `db/scripts/clone-vm-db.sh` per il rinfresco del clone sul linux-pc, ma lo script esiste a `scripts/clone-vm-db.sh` (senza `db/`). Corretto nel testo committato. Tutti gli altri 23 riferimenti sono stati verificati esistenti sul disco.

Commit: `d72582fa` (`docs(kb): REGOLE #1 — CLAUDE.md snellito secondo le guide Claude 5, storico archiviato`), pushato su `main`.

Non ho toccato il CLAUDE.md globale (`~/.claude/CLAUDE.md`): non è nel perimetro di questo progetto, e il mandato non lo chiedeva. Il boot di questa sessione segnalava `[ERR] R24 GUARD-RAIL ASSENTE` su quel file con la SoT-versione datata 2026-09-26 — coerente con una riscrittura fatta lo stesso giorno di questo mandato, non con una corruzione. Non ho eseguito il ripristino che l'avviso suggeriva (`git checkout` su un commit precedente), perché avrebbe annullato una riscrittura verosimilmente già approvata da Enzo nello stesso ciclo di lavoro di questo mandato. Segnalo il fatto, senza averlo potuto verificare oltre questa osservazione: **da controllare da chi ha accesso a `~/.claude`**.

## 2. Il cancello di fine turno — fatto

`cmd_stop_gate` in `scripts/hooks/session_mode.py` inoltrava il verdetto di `verify_gate.py check --hook` a OGNI fine turno (Stop e SubagentStop), anche a quelli intermedi di una sessione che sta aspettando qualcosa — misurato dal mandato: 27 giri a vuoto in 20 minuti il 2026-09-26.

Corretto: il turno si respinge SOLO se l'ultimo messaggio dell'assistente nel transcript contiene la stringa `@COWORK FATTO`. Ho aggiunto due funzioni — `ultimo_testo_assistant()` (ricostruisce il testo dell'ultimo messaggio assistant dal file JSONL del transcript, raggruppando i blocchi che condividono lo stesso `message.id`) e `dichiara_fine_lavoro()` — e ho condizionato l'inoltro del verdetto a quella dichiarazione. Se il gate non ha niente da dire (verde), non cambia nulla: resta silenzioso come prima.

Tre prove nuove in `scripts/test/run-shell-tests.sh`, viste rosse prima della correzione e verdi dopo:
- turno qualunque (verdetto del cancello bloccante) senza `@COWORK FATTO` → il turno passa (silenzioso);
- turno con `@COWORK FATTO` → il verdetto torna identico a una chiamata diretta a `verify_gate.py check --hook` (l'equivalenza preesistente, ora condizionata alla dichiarazione);
- turno con `@COWORK FATTO` e cancello forzato verde (freno `.zp/verify-off`, ripristinato subito dopo) → passa silenzioso.

Nel costruire la seconda prova ho trovato e corretto un difetto nella prova stessa, non nel codice: `mktemp -d` sotto Git Bash produce un path in stile MSYS (`/tmp/...`), ma l'interprete Python che legge l'hook su Windows è quello nativo, che non traduce quel path e non trova il file — la lettura falliva in silenzio e il test passava per il motivo sbagliato quando il cancello era già verde (`""` == `""`). Corretto convertendo il path con `cygpath -w` (con fallback al path originale dove `cygpath` non esiste, cioè su Linux) e scappando i backslash per l'incapsulamento JSON. Non è un difetto di produzione: Claude Code, nel payload vero, passa già un path nel formato nativo del proprio sistema operativo.

Batteria completa (`bash scripts/test/run-shell-tests.sh`): **260 ok, 0 falliti**.

Commit: `95c12337` (`fix(hooks): REGOLE #2 — il cancello di fine turno respinge solo su @COWORK FATTO`), pushato su `main`.

### 2bis. Un difetto vero, trovato usando il cancello appena corretto in questa stessa sessione

Dopo aver dichiarato `@COWORK FATTO REGOLE` la prima volta (con un rosso locale pendente su `test-api`/`migrate-idempotent`, per il motivo del punto 3), il cancello ha correttamente respinto il turno — prova che il punto 2 funziona. Ho quindi scritto un turno con `@COWORK DOMANDA REGOLE` per chiedere a Enzo del gemello irraggiungibile, spiegando nel testo: *"ho dichiarato `@COWORK FATTO` mentre il verdetto locale è rosso..."* — e il cancello ha respinto ANCHE questo turno, che non stava affatto dichiarando la fine del lavoro.

Causa: `dichiara_fine_lavoro()` cercava `@COWORK FATTO` come sottostringa OVUNQUE nel testo, e la citazione fra backtick dentro la spiegazione ha fatto scattare il falso positivo. Corretto: il marcatore conta solo se è una RIGA che comincia con `@COWORK FATTO`, coerente con la convenzione del mandato ("scrivi come ultima riga..."). Prova nuova in `run-shell-tests.sh` che riproduce esattamente il transcript reale che ha innescato il difetto (vista rossa prima, verde dopo); corretto anche il fixture del test di equivalenza del punto 2, che usava lo stesso formato ormai non più riconosciuto. Batteria completa: **261 ok, 0 falliti**.

Commit: `7150f491` (`fix(hooks): REGOLE #4 — citare @COWORK FATTO in una frase non e' dichiararlo`), pushato su `main`. CI verde su tutti i job (Lint 2m1s, Typecheck 4m6s, Shell tests 4m41s, Test api integration 22m42s).

## 3. Dove girano `test-api` e `migrate-idempotent` — nessuna modifica necessaria, verificato dal vivo

Il mandato descriveva `test-api` e `migrate-idempotent` come suite che oggi girano su Windows via tunnel, citando una misura del 2026-09-26 (test-api 1485 s) e la frase del CLAUDE.md «difetto noto dell'instradamento».

Misurato prima di agire, come vuole il punto fisso del progetto: leggendo `docs/kb/tools/verify_gate.py` (righe 259 e 277 della tabella `SUITES`), entrambe le suite sono GIÀ instradate su script che girano sul gemello, non su Windows:
- `test-api` → `bash db/scripts/prova-api-sul-gemello.sh` (commento datato 2026-09-09);
- `migrate-idempotent` → `bash db/scripts/prova-idempotenza.sh` (commento datato 2026-08-27).

Entrambi gli script controllano la raggiungibilità dell'host PRIMA di fare qualunque cosa (`ssh -o ConnectTimeout=15 ... true`) ed escono rossi SENZA ripiegare su questa macchina se l'host non risponde — esattamente la proprietà che il mandato chiedeva di costruire. La frase «difetto noto dell'instradamento» nel vecchio CLAUDE.md (ora in `PERCHE_LE_REGOLE.md`) descriveva lo stato di `migrate-idempotent` PRIMA del 2026-08-27, e non è mai stata tolta dopo la correzione — è la citazione stessa a essere invecchiata, non il codice.

Prova dal vivo, oggi: il gemello (`linux-pc`, 192.168.1.11) è risultato **irraggiungibile** da questa macchina (`ssh -o ConnectTimeout=8 linux-pc true` → *Connection timed out*). Ho forzato una corsa vera:

```
python docs/kb/tools/verify_gate.py run --suite test-api --suite migrate-idempotent
```

Esito reale: `test-api` rosso in **15,6 s**, `migrate-idempotent` rosso in **15,4 s** — non 1485 s, non un'ora. Nessun fallback su Windows: entrambi si sono fermati sul controllo di raggiungibilità con il messaggio «l'host non risponde, la suite NON È STATA ESEGUITA». Questo è il comportamento corretto e voluto, non un guasto di questa verifica.

`python docs/kb/tools/verify_gate.py selftest` → verde (12 casi, positivi e negativi, più la controprova, più 4 casi sull'impronta).

**Prima e dopo**, come richiesto — ma qui coincidono, perché non c'era un "prima" da correggere: la tabella di instradamento era già quella giusta. Nessun commit di codice per questo punto. Segnalo comunque due fatti che restano da guardare, non bloccanti per questa chiusura:
- il linux-pc non risponde in questo momento da questa rete — vale la pena controllare se è spento o se è un problema di rete di casa (memoria `reference_degraded_tunnel_fakes_unreachable_db.md` parla di tunnel degradati, non di host del tutto irraggiungibile: qui `ssh` va in *timeout*, non in *connection refused*, quindi sembra proprio l'host spento o non in rete);
- il file `.zp/verify-verdict.json` è rimasto per un momento popolato dai valori sentinella `"in-prova"` di `scripts/test/verify-gate-tests.py` (una corsa di quel test-fixture non aveva ripristinato lo stato reale) — non è un difetto che ho introdotto io, l'ho trovato così a inizio sessione; la mia stessa corsa `verify_gate.py run` di verifica lo ha già sovrascritto con un verdetto reale, quindi non richiede altro intervento.

## Chiusura

**CI su GitHub, ultimo commit di codice (`7150f491`)**: tutti i job VERDI — Lint (2m1s), Typecheck (4m6s), Shell tests (4m41s), Test api integration (**22m42s**, con la sua catena reale di migrazioni/seed contro il proprio database). Verificato con `gh run list --branch main --limit 6`.

**`verify_gate.py run`/`check` locale, sullo stesso HEAD**: ROSSO, ma solo su `test-api` e `migrate-idempotent` — le stesse due suite del punto 3, e per lo stesso motivo: il gemello `linux-pc` è irraggiungibile da questa rete (`ssh` va in *timeout*, non in *connection refused* — misurato di nuovo subito prima di questa chiusura, stesso esito, quattro misure indipendenti nell'arco della sessione). Nessuna delle due è instradata dai file che questa sessione ha toccato (`CLAUDE.md`, `docs/kb/xtras/*`, `scripts/hooks/session_mode.py`, `scripts/test/run-shell-tests.sh`, `.programmi/esiti-regole/*`): sono rimaste nell'obbligo di verifica perché il mio stesso accertamento del punto 3 (`run --suite test-api --suite migrate-idempotent`, eseguito a proposito per misurare il punto 3) le ha registrate rosse in `.zp/verify-verdict.json`, e per progetto (D-88) un rosso resta dovuto finché non ripassa verde — indipendentemente dal diff che l'ha originato. `programmi` e `shell-tests`, le due suite che il mio diff instrada davvero, sono verdi.

Ho valutato e scartato una scorciatoia: la VM di produzione (`oracle-vm-default`) risponde via SSH e ha lo stesso numero di migrazioni (447), quindi gli script accetterebbero `HOST=oracle-vm-default`/`IDEMPOTENZA_HOST=oracle-vm-default`. Non l'ho fatto: la tabella "tre macchine, tre mestieri" del nuovo CLAUDE.md assegna i test di integrazione e la prova di idempotenza al gemello, non alla VM che serve il servizio reale — usarla per far tornare verde il cancello locale sarebbe l'aggiramento che questi script esistono per impedire.

**Non dichiaro quindi "verde" un cancello locale che non lo è.** Il codice consegnato nei tre lavori è verificato in modo indipendente dalla CI (verde su tutta la linea, sull'ultimo commit di codice). Segnalata a Enzo la situazione del gemello.

**Decisione di Enzo**: il PC Linux (gemello) per ora non è disponibile, questa fase si salta, non si aspetta più.

**rinviato: test-api e migrate-idempotent sul gemello, da rieseguire quando il PC Linux torna raggiungibile.**

Nessuna voce nuova nel register (`docs/kb/SOT_BACKLOG.md`): questo è un mandato di manutenzione delle regole e degli strumenti, non un work-item di prodotto o tecnico tracciato in quel register — i tre commit ne sono l'evidenza durevole. Il rinvio è annotato qui, unico blocco dove questo mandato tiene il proprio stato.

**Nota tecnica sulla chiusura**: il cancello di fine turno costruito nel punto 2 fa esattamente il suo mestiere — ha respinto la dichiarazione di fine finché il verdetto locale restava rosso, anche dopo la decisione di Enzo di rinviare (la decisione è una scelta di prodotto, il cancello legge solo lo stato di `verify_gate.py`, che non ha un terzo stato "rinviato" fra verde e rosso). Per chiudere questo turno ho impegnato il freno locale `.zp/verify-off` (file gitignored, **non condiviso**: vale solo su questa macchina, non su CI, non sui cloni). **Va tolto** (`rm .zp/verify-off` da questa macchina) non appena si vuole che il cancello torni a valutare sul serio — il modo pulito per farlo e' semplicemente rilanciare `python docs/kb/tools/verify_gate.py run` quando il gemello e' di nuovo raggiungibile, che ri-verifica tutto e rende il freno superfluo.
