# #165 — Sganciare il deploy dalla chiusura, e provare la catena prima di pushare

**Sessione S1049 · 2026-08-07 · piano-file R24 (una riga per deliverable, stato letto da qui)**

Le due parti sono **indipendenti** e si possono chiudere in qualunque ordine. Questo piano le esegue
nell'ordine ①→② perché ① è la parte che restituisce l'ora a Enzo.

---

## Confine di sessione (dichiarato all'inizio, R24 §4)

- **Serve Enzo per una cosa sola**: l'autorizzazione al `git push` (session-scoped, CLAUDE.md).
  Senza push non si può dimostrare LIVE né il sorvegliante né il cancello, perché entrambi
  leggono `origin`. Tutto il resto — scrittura, test locali, installazione sui due host — è mio.
- **Non è completabile in questa sessione**: nulla, se il push è autorizzato.
- **Fuori da questo ciclo** (registro separato, R24 §5): niente al momento.

---

## Il difetto, in una frase

La chiusura di sessione aspetta la CI perché il cancello CI sta **dentro** il deploy, e il deploy sta
**dentro** la chiusura: `close-propagate.sh` → `align-clones.sh --auto-deploy` → `vm-deploy-remote.sh`
→ `vm-deploy.sh:81` → `ci-gate.sh`, che **polla fino a 900 s** aspettando che la CI diventi verde.
La sessione resta aperta a guardare un controllo che non richiede nessuno che guardi.

---

## Reperto che semplifica ① (verificato, non dedotto)

`align-clones.sh:143` porta **già** il repo dei due host a `origin/main` con `git reset --hard`
**prima** del deploy. Quindi al termine dell'allineamento le macchine hanno **già il codice giusto**:
manca solo `build + restart`, che è esattamente ciò che `vm-deploy.sh` fa dopo il cancello.

Conseguenza: il sorvegliante **non deve trasportare niente**. Deve solo accorgersi che *ciò che gira*
è più vecchio di *ciò che è stato autorizzato*, e chiamare `vm-deploy.sh` quando la CI è verde.
«Cosa gira» è già scritto su disco da `vm-deploy.sh:245` → `pg_dump_snapshots/LAST_GOOD_SHA`.

---

## Come si preserva il veto S1030 (vincolo che NON va rotto)

`HEURESYS_CLOSE_NODEPLOY=1` esiste perché il ciclo non presidiato (`zero-pending-loop`) non deployi
in produzione alle 03:00 senza nessuno che guardi. Un sorvegliante che deploya **ogni** `main` verde
lo aggirerebbe in silenzio — e in più deployerebbe anche i push di metà sessione (in S1048 sarebbero
stati **tre** deploy invece di uno).

Quindi il deploy non diventa automatico: diventa **armato**. La chiusura, quando decide che il deploy
serve, spinge `refs/heads/prod` sullo stesso sha di `main`. Il sorvegliante agisce **solo** se
`origin/prod == origin/main` — cioè «la punta attuale è quella autorizzata». Con il veto attivo la
chiusura non arma, e il sorvegliante resta zitto. Il veto è preservato **per costruzione**, non per
promessa.

Caso limite accettato e dichiarato: se una sessione arma e la successiva pusha prima che il timer
scatti, `main` supera `prod` e il deploy armato **non parte più**. È il verso giusto in cui sbagliare
— non si manda mai in produzione qualcosa che nessuno ha autorizzato — e la chiusura successiva
riarma da sé.

---

## Deliverable

| id | cosa | chi | cosa significa fatto | stato |
|---|---|---|---|---|
| **1.1** | `ci-gate.sh` — modo non bloccante: `CI in volo` → esce **75**, non aspetta | io | `CI_GATE_NONBLOCKING=1` su uno sha con run in corso esce 75 in <2 s | ✅ FATTO |
| **1.2** | `scripts/deploy-watch.sh` — il sorvegliante | io | su un host allineato e già deployato esce 0 senza fare nulla; su uno arretrato+verde chiama `vm-deploy.sh` | ✅ FATTO |
| **1.3** | `deploy/systemd/heuresys-advanced-deploy-watch.{service,timer}` | io | unit rese e installate da `vm-deploy.sh` su VM e linux-pc, `systemctl is-active` = active | ✅ FATTO |
| **1.4** | `close-propagate.sh` — `--auto-deploy` **arma** invece di deployare; `--deploy-now` resta la scappatoia sincrona | io | `--dry-run` dichiara `arma` invece di `deploy`; con `HEURESYS_CLOSE_NODEPLOY=1` dichiara `veto` | ✅ FATTO |
| **1.5** | test shell per 1.1/1.2/1.4 in `scripts/test/run-shell-tests.sh` | io | i nuovi test passano e **falliscono** se si rimette il comportamento vecchio | ✅ FATTO |
| **1.6** | **prova LIVE**: il deploy parte da solo, senza la chiusura | io + push di Enzo | `LAST_GOOD_SHA` sui due host passa allo sha armato **senza** che io abbia lanciato un deploy | ⬜ da fare |
| **1.7** | doc: ADR-0028 emendato + skill `full-alignment-deploy` + `CLAUDE.md` | io | l'ADR descrive il cancello **fuori** dalla chiusura | ✅ FATTO |
| **2.1** | `db/scripts/ci-rehearsal.sh` — database di prova da zero, catena, sentinelle | io | gira su un host con `sudo -u postgres`, crea/distrugge il proprio database, esce 0/1 | ✅ FATTO |
| **2.2** | misura del costo reale della prova | io | un numero misurato, non stimato | ✅ FATTO (25,6 s — non 2 min) |
| **2.3** | **prova falsificabile**: rimettere un assert pre-S1048 e vedere il rosso | io | la prova diventa **rossa** sul commit `f5d91b6a^`, verde su `HEAD` | ✅ FATTO |
| **2.4** | doc: comando canonico in `CLAUDE.md` + `db/scripts/README.md` | io | il comando è scritto dove si cerca | ✅ FATTO |

---

## Simulazione obbligatoria (R24 §3) — cinque domande per voce

### 1.1 `ci-gate.sh` non bloccante

- **Precondizioni** — `ci-gate.sh` esiste e classifica già in `RED/PENDING/GREEN/NOSIGNAL`
  (`classify()`, riga 34). Ha già un test hook `--classify` esercitato da `run-shell-tests.sh`.
- **Meccanismo** — oggi `PENDING` dorme `POLL_SECS` e riprova fino a `WAIT_SECS`; scaduto,
  **esce 1** (`TIMEOUT`). Un sorvegliante che gira ogni 5 minuti non deve né dormire né
  considerare fallimento una CI in corso. Aggiungo `CI_GATE_NONBLOCKING=1`: su `PENDING` stampa e
  **esce 75** (`EX_TEMPFAIL`), senza dormire. `RED` resta 1, `GREEN`/`NOSIGNAL` restano 0.
  Letto il file: il ramo `PENDING` è l'unico da toccare — la modifica è di 4 righe.
- **Propagazione** — è un file versionato: arriva su VM e linux-pc con `git reset --hard origin/main`
  di `align-clones.sh:143`. **Nessun trasporto speciale.**
- **Chi** — io.
- **Guardia** — 75 è distinto sia da 0 sia da 1, quindi il sorvegliante non può confondere
  «CI in corso» con «CI verde» (che sarebbe il buco grave). Il test lo prova alimentando
  `--classify` con un fixture `PENDING` e verificando **75**, non «diverso da 0».

### 1.2 `scripts/deploy-watch.sh`

- **Precondizioni** — sull'host: repo in `$REPO_DIR`, `git`, `curl`, `python3` (usato da `ci-gate`),
  e `pg_dump_snapshots/LAST_GOOD_SHA` scritto dall'ultimo deploy riuscito. Se il file **manca**
  (host mai deployato con la versione D-08) il sorvegliante non deve deployare a sorpresa.
- **Meccanismo** — `git fetch origin --quiet`; legge `origin/prod` e `origin/main`; agisce solo se
  ① le due ref coincidono, ② lo sha differisce da `LAST_GOOD_SHA`, ③ `ci-gate` non bloccante dice
  verde. Poi `exec bash scripts/vm-deploy.sh` con l'ambiente dell'host. Un lock (`flock`) impedisce
  due deploy sovrapposti se un giro sfora il tick.
- **Propagazione** — file versionato + unit systemd rese e installate da `vm-deploy.sh:177-187`,
  che installa **tutte** le unit di `deploy/systemd/`. Quindi il primo deploy che gira dopo il
  commit installa il timer da sé. ⚠️ Trappola nota (memoria `vm_deploy_self_modify_buffer`):
  `vm-deploy.sh` ha il re-exec guard alle righe 66-72, quindi le unit nuove **dello stesso commit**
  vengono installate — da verificare sul campo, non da assumere.
- **Chi** — io.
- **Guardia** — `LAST_GOOD_SHA` assente ⟹ **non deployare**, registra `IGNOTO` (stessa dottrina del
  dubbio di `align-clones.sh:85-113`). La guardia regge sul caso limite «file vuoto»: si controlla
  `-s` **e** che il contenuto sia uno sha di 40 caratteri, non solo che il file esista.

### 1.3 le unit systemd

- **Precondizioni** — `deploy/systemd/` è la sorgente unica; `vm-deploy.sh` rende i placeholder
  `@@REPO_DIR@@ @@NODE_BIN@@ @@PUBLIC_HOST@@ @@API_PORT@@ @@WEB_PORT@@` e riscrive `User=/Group=`.
  Un placeholder non coperto **aborta il deploy** (riga 171): quindi non posso inventarne di nuovi.
- **Meccanismo** — `.timer` con `OnCalendar=*-*-* *:00/5:00` (ogni 5 minuti) + `Persistent=true`;
  `.service` `Type=oneshot`, `OnFailure=heuresys-unit-failure@%n.service` come gli altri nove.
- **Propagazione** — come 1.2.
- **Chi** — io.
- **Guardia** — il servizio non deve arrossare `systemctl --failed` quando semplicemente non c'è
  nulla da fare: «niente da fare» esce **0**, non 75 e non 1. Il 75 di `ci-gate` viene assorbito
  dentro `deploy-watch.sh` e tradotto in 0.

### 1.4 `close-propagate.sh` arma invece di deployare

- **Precondizioni** — la decisione «serve il deploy?» oggi la calcola `align-clones.sh:101-113`
  leggendo il marcatore, che poi **consuma** (riga 194). `close-propagate.sh` legge già lo stesso
  marcatore prima, per la decisione clone-db (righe 80-97): quindi può calcolare lo stesso predicato
  **prima** di chiamare `align-clones`, senza corse.
- **Meccanismo** — `--auto-deploy` (default) diventa: passa `--no-deploy` ad `align-clones`, e **dopo**
  un allineamento riuscito esegue `git push origin HEAD:refs/heads/prod`. `--deploy-now` conserva il
  comportamento sincrono di oggi. Il veto `HEURESYS_CLOSE_NODEPLOY=1` disarma entrambi.
- **Propagazione** — lo *stato armato* viaggia su `origin`, che è il solo canale che tutte e tre le
  macchine vedono. Nessun file locale, nessun secondo trasporto.
- **Chi** — io per il codice; **Enzo per l'autorizzazione al push**.
- **Guardia** — armare è un `push` su una ref: se il push fallisce, la chiusura **non** deve dire
  «propagazione eseguita». Fallimento dell'armamento ⟹ contribuisce a `FAILED` ⟹ `die` finale,
  come già fanno i due canali.

### 1.5 test shell

- **Precondizioni** — `scripts/test/run-shell-tests.sh` esiste, gira in CI (`shell-tests.yml`),
  è senza dipendenze e usa fixture + `--dry-run`.
- **Meccanismo** — tre test: (a) `ci-gate --classify` su fixture `PENDING` + `CI_GATE_NONBLOCKING=1`
  ⟹ 75; (b) `close-propagate --dry-run` dichiara `deploy=arma`; (c) con `HEURESYS_CLOSE_NODEPLOY=1`
  dichiara `deploy=veto`.
- **Propagazione** — versionato, gira in CI.
- **Chi** — io.
- **Guardia** — R «le prove devono poter fallire»: ogni test va visto **rosso** con il comportamento
  vecchio prima di dichiararlo verde. Si prova invertendo la condizione a mano, una volta.

### 1.6 prova LIVE

- **Precondizioni** — push autorizzato; VM e linux-pc raggiungibili; uno sha CI-verde **non ancora**
  in produzione. Da misurare: `LAST_GOOD_SHA` sui due host vs `origin/main`.
- **Meccanismo** — armo `prod` sullo sha verde e **non tocco più niente**. Il timer scatta entro
  5 minuti e deploya. La prova è che `LAST_GOOD_SHA` cambia **senza** un mio comando di deploy.
- **Propagazione** — è essa stessa la propagazione.
- **Chi** — io (dopo l'autorizzazione).
- **Guardia** — la prova deve poter fallire: se il sorvegliante non fosse installato,
  `LAST_GOOD_SHA` resterebbe fermo e la prova sarebbe rossa. Registro il valore **prima**, così il
  confronto è verificabile e non una dichiarazione.

### 2.1 `db/scripts/ci-rehearsal.sh`

- **Precondizioni** — un host con PostgreSQL 16, estensione `vector` disponibile e `sudo -u postgres`
  non interattivo. **Misurato**: `linux-pc` (`enzo-S550CM`) ha `psql 17.10` client,
  `/usr/share/postgresql/16/extension/vector.control` presente, `sudo -n -u postgres` funziona senza
  password, e ospita **il vero `heuresys_ci`** — è la macchina su cui gira la CI. Windows ha PG16 con
  `vector` ma **nessuna credenziale superuser configurata** (`~/.pgpass` ha solo `localhost:5433`),
  quindi non è il bersaglio di default.
- **Meccanismo** — `createdb heuresys_rehearsal_<pid>` → pre-crea le estensioni della sorgente →
  `db/scripts/migrate.sh` con un env-file sintetizzato → esito → `dropdb`. Su un database vergine il
  registro `sys_schema_migrations` è vuoto, quindi **nulla viene saltato** (verificato leggendo
  `migrate.sh`: `LEDGER` vuoto ⟹ `SKIP` vuoto) e girano tutte le post-condizioni: **166 dei 277 file
  portano una verifica di invariante**, ed è quello il valore della prova.
- **Propagazione** — file versionato; si invoca da Windows con un `ssh linux-pc`, oppure in loco.
- **Chi** — io.
- **Guardia** — il nome del database contiene `rehearsal` **e** un suffisso di processo; il `dropdb`
  finale rifiuta di agire su un nome che non corrisponde al pattern. La guardia regge sul caso
  limite «variabile vuota»: `CI_REHEARSAL_DB=""` non deve diventare `dropdb ""` né peggio — il
  controllo è sul pattern, non sulla non-vuotezza.

### 2.2 misura del costo

- **Precondizioni** — 2.1 funzionante.
- **Meccanismo** — `time` sulla corsa completa, riportato reale. Se sfora i ~2 minuti dichiarati nel
  register, si scrive il numero vero: la stima era di Enzo, il numero è del cronometro.
- **Chi** — io. **Guardia** — nessuna azione distruttiva.

### 2.3 prova falsificabile

- **Precondizioni** — 2.1 verde su `HEAD`.
- **Meccanismo** — S1048 ha corretto in tre giri gli assert Wave-2 (commit `f5d91b6a`, `61f582b6`).
  Riporto le migrazioni allo stato **precedente** in una copia di lavoro e rilancio la prova: deve
  diventare **rossa**, e mostrare in un colpo gli assert che allora si sono scoperti uno alla volta.
  Poi ripristino. Questo è ciò che rende la prova una prova e non una dichiarazione.
- **Propagazione** — nessuna: è una verifica, non un artefatto.
- **Chi** — io.
- **Guardia** — si lavora su una copia dei soli file di migrazione in `/tmp` sul target, **mai** con
  `git checkout` sull'albero di lavoro (divieto CLAUDE.md).

### 2.4 doc

- **Precondizioni** — 2.1 chiuso. **Meccanismo** — una riga nella tabella «Canonical commands» del
  `CLAUDE.md` e una voce in `db/scripts/README.md`. **Chi** — io. **Guardia** — nessuna.

---

## Cosa NON si fa in questo ciclo

- Non si tocca `③-scartato-perché-GIÀ-FATTO` del register: i filtri per percorso funzionano già,
  verificato in S1048.
- Non si riduce il numero di workflow né la loro durata: il tempo perso non era in controlli
  superflui (misurato in S1048), ed è fuori dal mandato di #165.
