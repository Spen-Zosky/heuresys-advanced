# Piano S1054 — voce «F»: togliere il freno e rimettere il cancello di verifica in pari (R24)

Selezione di Enzo, 2026-08-11: **«F subito»** — il freno `.zp/verify-off` è inserito dal 2026-08-10 15:56 e
finché c'è il cancello dice verde sempre.

## Misura preliminare (fatta PRIMA di toccare — R24 §3, metodo di bonifica §1)

Tre affermazioni del registro smentite dalla misura sul vivo:

| Il registro dice | La misura dice | Dove |
|---|---|---|
| «`rm .zp/verify-off` poi `verify_gate.py run` (instrada su test-api ~31min)» | **A working tree pulito `route()` non instrada NIENTE** (i 4 file non tracciati sono `.agents/`, `.codex/`, `.codex-review/`, `AGENTS.md`: nessun prefisso di `ROUTES` li aggancia). `run` prenderebbe il ramo «nessuna modifica che richieda verifica» e scriverebbe `verdict: green` con `results: []` — **un verde scritto senza aver eseguito un test**, che per giunta cancella il rosso precedente | `verify_gate.py:462-471`; `route` live: «suite instradate: (nessuna)» |
| «Il rosso non era una regressione: 1509 test passati con UN file caduto» | Il verdetto su disco ha **50 file falliti** (elenco troncato dal limite `fuori[:50]`, quindi ≥50) e la corsa è durata **4711 s = 78 min** contro i ~31-37 normali. Non è la firma di Z-251 descritta nel freno; è compatibile con contesa severa **o** con un guasto infrastrutturale (DB/tunnel) che fa cadere ogni `beforeAll` | `.zp/verify-verdict.json` (`generated_at` 2026-08-10T12:37:10+0200) |
| — (non detto) | Il verdetto è su **`f02b34a8`**; HEAD è **`aba41ec5`**. Misura su un albero che non esiste più: 3 commit di S1053 (mask, tombstone, review-cycles) sono entrati DOPO | `git rev-parse HEAD` vs `verify-verdict.json:head` |

Stato del campo al momento del piano: `.zp/suite.lock` assente (nessuna suite in corso), tunnel :5433 su, DB raggiungibile.

**Conseguenza sul contenuto della voce F**: eseguirla alla lettera come la descrive `.handoff/STATE.md`
(`rm` + `run`) produrrebbe un **falso verde**, cioè esattamente il difetto che la voce vuole rimuovere.
La voce va eseguita per la sua sostanza: *la suite API è verde su HEAD, sì o no?*

## Confine di sessione (dichiarato ADESSO, R24 §4)

Questa sessione chiude **F1-F7**. È dichiarato **FUORI SESSIONE** fin d'ora:
- una eventuale bonifica ampia che l'esito di F5 dovesse rivelare (se i ≥50 rossi fossero regressioni vere e
  non contesa/infrastruttura, la correzione integrale non sta in una sessione: in quel caso F6 chiude con la
  **diagnosi provata + le correzioni che stanno**, e il residuo diventa un blocco nuovo nel register);
- **Z-251** (la contesa sul DB condiviso) come progetto a sé: qui la si *distingue*, non la si risolve.

## Tabella del ciclo (stato per riga — la chiusura si legge da qui)

| id | cosa | chi | fatto significa | stato |
|---|---|---|---|---|
| F1 | **Indagine**: cosa fa davvero il freno, cosa instrada il cancello col working tree di oggi, cosa dice il verdetto su disco | Claude | Le tre righe della tabella «Misura preliminare» compilate con file:riga e output reale | **FATTO** — vedi sopra (3 affermazioni del registro smentite) |
| F2 | **Togliere il freno** `rm .zp/verify-off` | Claude | `check` non risponde più «freno tirato»; il file non esiste | ✅ **FATTO** — `ls` conferma l'assenza; `check` risponde ora «VERDE — nessuna modifica che richieda verifica» (ramo diverso, `verify_gate.py:407`), non più «freno tirato». Motivazione di Enzo conservata in §Appendice prima della cancellazione |
| F3 | **Chiudere il buco del falso verde**: `run` deve poter eseguire una suite nominata anche quando il diff non la instrada (`--suite NOME`), e non deve mai scrivere `green` per «non misurato» | Claude | `run --suite test-api` esegue davvero; il verdetto «niente da eseguire» si distingue da un verde misurato; la modifica NON allarga il cancello (le suite instradate restano obbligatorie) | ✅ **FATTO** — `--suite` ripetibile, valida i nomi (`--suite inesistente` → exit 2 con l'elenco, provato), entra sempre in `to_run` ed esce da `keep`; il ramo «niente da eseguire» scrive `not-measured` invece di `green`. Nessun lettore esterno confronta il verdetto con `"green"` (verificato: `sessioni_panel.py:445` lo mostra testuale, il «freno» di `zp_panel` è quello del driver zero-pending, altra cosa) |
| F4 | **Prova di falsificabilità del cancello**: dimostrare che sa dire ROSSO e BLOCCO, non solo verde | Claude | Esito rosso osservato almeno una volta su un caso costruito, con rollback dello stato verificato per impronta | ✅ **FATTO** — **5/5 casi conformi**: A rosso→BLOCCO «ROSSA su test-api» · B impronta diversa→BLOCCO «da verificare» · C `not-measured`→BLOCCO (è il caso che F3 ha creato: prima diceva verde) · D verde+fresco→VERDE · E freno sopra un rosso→VERDE. Ripristino verificato per impronta (`f5422b226f225c55` prima e dopo), file di prova rimosso, freno assente |
| F5 | **Misura reale**: suite API completa su HEAD `aba41ec5`, verdetto scritto dallo strumento (log + falliti + scope) | Claude | `.zp/verify-verdict.json` rigenerato con `head=aba41ec5` e l'esito vero di `test-api`; log integrale su `.zp/verify-logs/test-api.log` | ✅ **FATTO** — `typecheck` 24.7s exit=0 · `lint` 118.1s exit=0 · `test-api` **1844.9s exit=0**; verdetto `green`. Contro-verifica del verde (un exit 0 non basta): riepilogo vitest **`Test Files 225 passed (225)` · `Tests 1544 passed (1544)`** più una seconda suite `10 passed / 67 test`; `grep -c "^ *FAIL"` sul log = **0**; e i **225 file eseguiti** sono esattamente i 225 `*.test.ts` presenti su disco — nessuna esclusione silenziosa |
| F6 | **Triage dell'esito**: ogni rosso o è corretto, o è provato falso rosso (rilancio del singolo file su DB libero), o è dichiarato con la ragione | Claude | Nessun rosso senza esito scritto: corretto / provato-contesa / dichiarato-fuori-sessione | ✅ **FATTO — nessun rosso da triagare**: 0 file falliti su 225. I **≥50 file** che il verdetto del 10/08 dava rossi passano oggi tutti quanti (stanno per costruzione dentro i 225/225). **Ciò che si può concludere**: su HEAD `aba41ec5` la suite è integralmente verde, e la corsa da 4711 s del 10/08 non era un difetto del codice. **Ciò che NON si può concludere**: quale delle due cause fosse (contesa severa o guasto infrastrutturale) — distinguerle richiederebbe di rieseguire su `f02b34a8`, 78 minuti per una domanda storica il cui esito non cambierebbe nulla. Dichiarato, non taciuto |
| F7 | **Allineare lo stato**: `.handoff/STATE.md` (punto 2 delle priorità), il blocco di register che descrive la voce, e la nota del freno | Claude | Nessun file di stato descrive più il freno come inserito né promette che `run` instradi test-api a tree pulito | DA FARE |

Chiusura binaria dal file: **CICLO CHIUSO = 7/7 FATTO**, altrimenti CICLO NON CHIUSO con la voce mancante nominata.

## Simulazione a 5 domande (R24 §3)

**F2** · *Precondizioni*: il file esiste (misurato, 1003 byte, 10/08 15:56); nessuna suite in corso.
· *Meccanismo*: `check()` legge `BRAKE.exists()` a `verify_gate.py:402-403` — è l'unico punto che consulta il
freno, `run` non lo consulta affatto (quindi il freno non ha mai impedito di misurare, solo di *bloccare*).
· *Propagazione*: `.zp/` è gitignored → il freno vive solo su questa macchina; VM e linux-pc non l'hanno mai avuto.
· *Chi*: Claude. · *Guardia*: è una cancellazione, quindi il contenuto del file (la motivazione scritta da Enzo)
va conservato **prima** — trascritto integralmente in questo piano, sotto §Appendice, così l'informazione non si perde.

**F3** · *Precondizioni*: `run` oggi ha due rami e il primo (`not needed and not with_e2e`) scrive un verdetto
`green` vuoto (`verify_gate.py:462-471`). · *Meccanismo*: aggiungere `--suite` che bypassa il router per suite
nominate esplicitamente; e cambiare il verdetto vuoto da `green` a uno stato che `check()` non accetta come verde.
· *Propagazione*: `verify_gate.py` è versionato → viaggia col commit su VM/linux-pc; l'hook Stop legge
`check --hook`, quindi il contratto JSON `{decision, reason}` **non va toccato**. · *Chi*: Claude.
· *Guardia*: il cambiamento deve poter solo **stringere**, mai allargare — la prova è F4, che deve vedere il
cancello dire BLOCCO su tutti e tre gli stati non-verdi. Rischio noto: se `check()` iniziasse a bloccare a
working tree pulito, ogni fine turno sarebbe bloccata → il ramo «nessuna modifica che richieda verifica»
(`verify_gate.py:407-408`) **resta intatto**, perché precede la lettura del verdetto.

**F4** · *Precondizioni*: esiste un verdetto reale su disco da non distruggere. · *Meccanismo*: copiare
`.zp/verify-verdict.json` fuori, costruire i casi (rosso / scaduto / non-misurato / verde-fresco), osservare
`check`, ripristinare l'originale e **confrontare l'impronta** — un ripristino non verificato non è un ripristino.
· *Propagazione*: nessuna, è stato locale. · *Chi*: Claude. · *Guardia*: `check()` legge un path fisso, quindi
le prove **devono** passare dal file vivo — non c'è un modo di isolarle senza cambiare lo strumento. La guardia
reale è dunque backup + ripristino + **confronto sha256** (memoria `seed_internal_commit_defeats_rollback`: una
prova che scrive davvero va trattata come una scrittura vera). Due post-condizioni che proteggono ciò che NON
doveva cambiare: il freno non deve esistere a fine prova, e il file di prova sotto `apps/api/` non deve restare.

**F5** · *Precondizioni*: tunnel :5433 su e DB raggiungibile (verificato al boot); `.zp/suite.lock` assente —
e il controllo va rifatto **al momento del lancio**, non ereditato dalla misura di dieci minuti prima
(metodo §4b); nessun'altra sessione o timer che tocchi il DB. · *Meccanismo*: `pnpm --filter @heuresys/api test`
lanciato **attraverso** il cancello (`run --suite test-api`) perché sia lo strumento a scrivere log, falliti e
scope — non io a mano. · *Propagazione*: il verdetto vive in `.zp/` (locale, gitignored) — non va sui cloni, e
non deve: ogni host misura il proprio. · *Chi*: Claude. · *Guardia*: la suite prende il lucchetto da sé
(`apps/api/test/helpers/suite-lock.ts`); durata attesa 31-80 min → gira in background, e nel frattempo **non
tocco `apps/api/`**, altrimenti lo scope registrato a fine corsa non corrisponde a ciò che è stato eseguito.

**F6** · *Precondizioni*: l'elenco dei falliti è già dentro il verdetto (non serve rieseguire per sapere dove
guardare — `estrai_falliti`). · *Meccanismo*: per ogni file rosso, rilancio isolato `vitest run <file>` su DB
libero; passa da solo ⇒ contesa (Z-251), cade da solo ⇒ difetto vero da correggere.
· *Propagazione*: le correzioni sono codice versionato. · *Chi*: Claude. · *Guardia*: «correggi ogni errore»
vale per intero (CLAUDE.md) — nessun rosso può restare senza esito scritto; se il volume eccede la sessione,
si dichiara nel register, non si tace.

**F7** · *Precondizioni*: F5/F6 conclusi. · *Meccanismo*: modifica di `.handoff/STATE.md` e del blocco register.
· *Propagazione*: docs versionati, commit. · *Chi*: Claude. · *Guardia*: `handoff_lint.py` deve restare a 0 FAIL.

## Appendice — il contenuto del freno, conservato prima di cancellarlo

> Freno del cancello di verifica — inserito 2026-08-10, S1053, su richiesta di Enzo.
>
> **PERCHE'** — Il messaggio «l'ultima verifica e' ROSSA su: test-api» compariva a ogni chiusura di turno,
> decine di volte, senza che ci fosse niente da correggere: il verdetto su disco era fermo alle 12:37 e la corsa
> che doveva riscriverlo e' stata fermata insieme a tutto il resto, quando Enzo ha chiesto quiete assoluta.
>
> Il rosso non era una regressione. Tre misure indipendenti dello stesso giorno: 1509 test passati con UN file
> caduto, 1511 passati con UN file caduto (diverso), e una corsa interrotta dalla rete. Ogni file rieseguito da
> solo passa. E' la firma della contesa sul database condiviso, registrata come Z-251.
>
> **COSA COMPORTA, DETTO CHIARO** — Finche' questo file esiste il cancello e' verde SEMPRE — anche quando ci
> fosse un difetto vero. Non distingue piu' niente.
>
> **COME SI TOGLIE** — `rm .zp/verify-off`; poi, per rimettere il verdetto in pari:
> `python docs/kb/tools/verify_gate.py run`

*Nota di F1*: l'ultima riga di questa motivazione è la promessa che la misura ha smentito — a working tree
pulito quel comando non esegue nulla. È il motivo per cui esiste F3.

## Registro scoperte — fuori da questo ciclo (presentate UNA volta, non bloccano la chiusura)

1. **`estrai_falliti` tronca a 50 senza dirlo** (`verify_gate.py:252`): il verdetto del 10/08 elenca esattamente
   50 file, quindi il numero vero potrebbe essere più alto e non lo sapremo mai da quel file. Un troncamento
   silenzioso in uno strumento di verdetto è lo stesso difetto che il metodo di bonifica vieta ai workflow
   («no silent caps»). Correzione: aggiungere il totale accanto alla lista. Lo vuoi nel prossimo ciclo?
2. **`.agents/skills` è comparso nel working tree** (creato 2026-07-27, mai tracciato né nominato dal
   `CLAUDE.md`, che documenta solo `.codex/`, `.codex-review/` e `AGENTS.md` come untracked legittimi): o è
   canale Codex e va nominato lì, o è residuo. Da decidere.
3. **La prova di F4 è una tantum e vive nello scratchpad**: il cancello è l'unico guardiano di fine turno e
   fino a oggi nessuno lo aveva mai visto dire rosso in modo controllato. Promuoverla a batteria permanente
   (`scripts/test/`, agganciata a `run-shell-tests.sh` — altrimenti nasce non presidiata come le tre batterie
   di gov, rilievo già a register) è ~1h. Fuori da questo ciclo: la vuoi nel prossimo?
