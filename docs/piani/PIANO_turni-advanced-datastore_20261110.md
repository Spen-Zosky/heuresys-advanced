# Piano: heuresys-advanced e heuresys-datastore nei turni gemelli VM ↔ Debian (2026-11-10)

Richiesta di Enzo del 2026-11-10 (thread «Allineare a turni il repo VM e Debian»): il repo sulla VM e quello sulla Debian devono essere allineati per essere idempotenti; lavorano a turno e nessuno lavora se il turno ce l'ha l'altro. Sulla Debian si fanno test e implementazioni; ciò che piace a Enzo si porta sulla VM. La produzione è solo sulla VM; la Debian lavora su copie del DBMS e può solo proporre migrazioni. La stessa regola vale per heuresys-datastore.

Questo piano non inventa un meccanismo: completa la voce R6 di `/home/ubuntu/hub/PIANO_sviluppo-debian-rilascio_20261110.md` («heuresys-datastore, heuresys-advanced, hub nei turni, ciascuno con sviluppo sul Debian e rilascio») e la voce D2 di `/home/ubuntu/hub/PIANO_turni-gemelli_20261109.md`, usando `turno` 3 del repo privato `Spen-Zosky/turni-gemelli` (clone `~/turni-gemelli` sulla VM e `/home/modwd/turni-gemelli` sulla Debian), già provato su ux-design-shared e mod-platform. Le decisioni già prese da Enzo il 9-10/11 (F1-F4, G1-G7, R1-R3: database a senso unico, registro su GitHub, riserva unica ruotata da sola, commit bloccati senza turno, migrazioni non rilasciate riapplicate da sole sul gemello) valgono anche qui e non si richiedono.

## Che cosa ho misurato (2026-11-10, 19:57-20:05 UTC, sola lettura)

Comandi lanciati dalla VM verso la Debian con `ssh -i ~/.config/vm-verso-pc/id_ed25519 modwd@mod-hpz420workstation`.

| oggetto | VM (`/home/ubuntu/...`) | Debian (`/media/modwd/HDD-01/...`) |
|---|---|---|
| advanced, `main` | 89d44bee, 7 dietro origin (è il codice in servizio) | 8ac24a6e, 8 dietro origin 7ec1fbbd; nessuna modifica tracciata |
| advanced, non tracciati | `.auto-memory/`, `.integrazioni-esterne/` | gli stessi due più 3 piani solo Debian: `PIANO_atlante-pr193_20261107.md`, `PIANO_copia-identica-hdd01_20261109.md`, `PIANO_giro-selezione_20261107.md` |
| advanced, rami e worktree | 22 righe di `git worktree list` | 25 rami; 1 worktree `bridge-cse_01L8VLYTsADhugoGv8y9sGgp` (7ec1fbbd, locked, aperto il 10/11 21:51 ora della Debian dalla sessione Remote Control) |
| datastore, `main` | d57f7f74, uguale al suo origin locale | d57f7f7, pulito |
| PostgreSQL | 16 main 5432 (produzione advanced), 16 datastore 5435 | 16 main 5432 e 16 datastore 5435 online, impostazioni rese identiche il 9/11 (voce B1) |
| database del repo | `heuresys_advanced`; `heuresys_datastore`, `_modello`, `_demo` | nessuno dei quattro: sul 5432 ci sono solo `mod_piattaforma`, `turno_prova_db*`; sul 5435 `turno_prova_db` |
| `.env` del repo | punta alla produzione | advanced: `POSTGRES_HOST=localhost`, `POSTGRES_PORT=5432`, `POSTGRES_DB=heuresys_advanced`, `NODE_ENV=development` (struttura, non valori) |
| descrittore `.turno/gemelli.json` | assente in tutti e due | assente |
| registro in turni-gemelli | solo `mod-platform.json` e `ux-design-shared.json` | idem |

Il fatto che cambia il progetto rispetto a mod-platform: **sulla VM la produzione gira dentro la cartella del repo**. `heuresys-advanced-api` esegue `node dist/server.js` e `heuresys-advanced-web` `next start` da `~/heuresys-advanced`; `scripts/vm-deploy.sh` ci fa `git reset --hard origin/<ramo>`, `pnpm install`, la build e il riavvio. `heuresys-datastore-api`, `-demo` e `-console` girano da `~/heuresys-datastore` direttamente sui sorgenti. `turno prendi` sulla VM, così com'è, farebbe avanzare `main` con `merge --ff-only`, lancerebbe `pnpm install` e riceverebbe file dalla Debian: cambierebbe sotto i servizi ciò che è in produzione, senza build e senza il cancello della CI. È lo stesso problema che per mod-platform la voce R1 ha risolto servendo l'API da una copia rilasciata.

## Il modello

T1. **Il turno.** Uno alla volta per repo, con `turno` 3: `turno prendi` prenota nel registro su GitHub (se un'altra macchina l'ha già, GitHub rifiuta e il comando si ferma), riallinea la cartella all'ultimo turno chiuso e la dichiara pronta; `turno chiudi` rifiuta se c'è codice non pubblicato o modifiche tracciate, scrive il manifesto SHA-256 dei file fuori da git e libera il turno. I due repo hanno turni separati: si può avere advanced sulla Debian e datastore sulla VM. Il turno si prende e si chiude con i riti di sessione (`avvia sessione` e `chiudi sessione`, `.claude/sessione/AVVIO.md` e `CHIUSURA.md` dei due repo), come per mod-platform (R3).

T2. **Il codice passa solo da GitHub.** Sulla Debian si lavora su un ramo, si pubblica, si apre la PR; la CI gira come oggi sul runner della VM. Ciò che piace a Enzo si unisce a `main` (con «unisci la N»); alla presa successiva l'altro gemello lo riceve da GitHub. Niente copie a mano di sorgenti. `turno` porta i rami solo in avanti e non fa mai `reset --hard`.

T3. **Sulla VM la cartella del repo smette di essere la produzione** (decisione D1 qui sotto). Raccomandata la stessa strada di mod-platform R1: la produzione gira da una copia rilasciata (`~/heuresys-servizio/<repo>-<ambiente>`, creata da `git archive` del commit di `refs/heads/prod`, con build e collegamenti ai dati vivi), e solo `vm-deploy.sh` (advanced) o un rito di rilascio nuovo (datastore) la crea e la scambia, con ritorno automatico alla copia precedente. Da quel momento `~/heuresys-advanced` e `~/heuresys-datastore` sulla VM sono gemelli di sviluppo come la Debian, e il turno può muoverli senza toccare il servizio.

T4. **Database a senso unico.** Alla presa sulla Debian `turno` copia dalla VM i database del descrittore (ruoli con `pg_dumpall --roles-only`, dump `-Fc` in un'istantanea, conteggi riga per riga uguali, scambio con la riserva `<db>__prima`, una sola riserva). Il database della Debian non torna mai sulla VM. Sulla VM la presa del turno non copia database: lì il database è la produzione.

T5. **Le migrazioni si propongono, non si applicano.** Sulla Debian una migrazione nasce come file in `db/migrations/` (advanced) o in `db/migrations/` del datastore, si prova sulla copia, viaggia in una PR e arriva in produzione solo con il rilascio che decide Enzo: per advanced `refs/heads/prod` → `deploy-watch` → `vm-deploy.sh` (snapshot, migrazioni, build), per datastore il rito di rilascio di D1. Alla presa sulla Debian il rito `dopo_presa` riapplica sulla copia appena arrivata le migrazioni del codice non ancora in produzione, così la copia ha lo schema del codice che si sta sviluppando.

T6. **I dati di prova restano sulla Debian.** Ciò che si scrive sulla copia (persone di prova, fascicoli, esiti di agenti) dura fino alla presa successiva più la riserva. Ciò che deve diventare vero in produzione diventa una migrazione o uno script idempotente nel repo, applicato dalla VM al rilascio.

## Le guardie

| id | rischio | guardia | dove |
|---|---|---|---|
| GU1 | due gemelli lavorano insieme | registro su GitHub con pubblicazione semplice: la seconda prenotazione viene rifiutata | `turno prendi` (esiste) |
| GU2 | si committa senza turno | hook `pre-commit` e `pre-push` dei due repo che chiedono a `turno stato` se questa macchina ha il turno; le sessioni cloud (rami `claude/*` pubblicati da GitHub) restano libere, perché non toccano le due cartelle | da costruire (V5), come `tools/modsync/hooks` di mod-platform |
| GU3 | la Debian scrive nel database di produzione | il PostgreSQL della VM ascolta solo su `localhost`, la Debian non ha tunnel; in più uno script `scripts/turno/dove-sono.sh` confronta il `system_identifier` del cluster a cui punta il `.env` con quello registrato della VM e rifiuta `migrate.sh`, i seed e le scritture di massa se coincidono e la macchina non è la VM | da costruire (V6) |
| GU4 | il turno sulla VM cambia la produzione | prima di D1: il descrittore dichiara la VM «senza codice» per i due repo, e `turno` sulla VM si limita a `fetch` e registro (opzione `codice_per` nel descrittore, da aggiungere a turno 3); dopo D1 la produzione non sta più nella cartella | V3 e V4 |
| GU5 | file della Debian finiscono in produzione | `solo_produzione` del descrittore: `.env*`, `.secrets/`, `pg_dump_snapshots/`, `.deploy-watch.lock`, `qa_artifacts/storia36/`, `_da_eliminare/`, `.claude/worktrees/`, per datastore anche `_banco_dati/`, `_pubblicazioni/`, `_scarichi/`, `libreria/` (le misure precise in V2) | descrittore |
| GU6 | una migrazione arriva in produzione senza essere provata | in PR la CI (`test-integration`, `ci-rehearsal`) gira su `heuresys_ci`; il rilascio passa da `vm-deploy.sh` con snapshot prima delle migrazioni e cancello CI verde | esiste |
| GU7 | la copia sulla Debian si scambia per produzione nelle dimostrazioni | dopo la presa il rito `dopo_presa` scrive nel database copiato un segno «copia Debian, turno N» (per datastore: il ruolo `copia` che la guardia 409 già conosce); le dimostrazioni di chiusura (ADR-0026) dichiarano su quale database sono fatte | V6 |
| GU8 | si perde lavoro alla presa | `turno` non cancella: ciò che c'è solo sulla macchina che prende va in `<base>/_da_eliminare/turno-<repo>-<n>/`; i rami locali che non discendono dal turno fermano la presa | esiste |

## Decisioni di Enzo prima di costruire

D1. Produzione da una copia rilasciata per advanced e datastore (T3), come mod-platform R1. Raccomandazione: sì. Costo: una voce di lavoro per repo, un cambio delle unità systemd (sudo) con ritorno indietro provato, circa 1-2 GB di spazio sulla VM per le copie (da misurare in V4). Rischio: un'ora di lavoro su `vm-deploy.sh`, che è il rito più sorvegliato del repo; senza D1 la VM resta un gemello «a metà», che non può lavorare in turno sul proprio `main`.

D2. I 3 piani che esistono solo sulla Debian e i 25 rami locali: alla prima presa `turno` sposta i file in `_da_eliminare/turno-heuresys-advanced-1/`; i rami già contenuti in origin si tolgono con il tuo sì, quelli che non lo sono si pubblicano prima. Raccomandazione: sì, con l'elenco davanti (voce V2).

D3. Il gemello linux-pc (enzo-s550cm, G7) resta per `ci-rehearsal` e `sul-gemello.sh`, oppure la Debian lo sostituisce. Raccomandazione: rimandare a dopo V8, quando i turni avranno girato una settimana.

## Voci

| id | cosa | chi | fatta quando | stato |
|---|---|---|---|---|
| V0 | Indagine: stato dei due repo su VM e Debian, cluster, servizi, meccanismo esistente | Claude | sezione «Che cosa ho misurato» | fatta |
| V1 | Decisioni D1-D3 | Enzo | risposta nel thread | da fare |
| V2 | Indagine per repo: elenco completo di `solo_produzione`, file ignorati da copiare, dimensioni dei database (`pg_database_size`), tempi di dump e ripristino (voce A5 del piano turni), ruoli necessari, comportamento della guardia 409 del datastore su una copia ripristinata | Claude | tabella nel registro | da fare |
| V3 | turno 3: opzione `codice_per` (per macchina: `tutto`, `solo_registro`) e `database_per` nel descrittore, con le prove `prova_coppia` e `prova_database` estese; commit in turni-gemelli | Claude | prove verdi su VM e Debian | da fare |
| V4 | Solo con D1 = sì. advanced: `vm-deploy.sh` costruisce e serve da `~/heuresys-servizio/advanced-prod`; datastore: rito `scripts/rilascia.sh` con lo stesso schema; prima su un'unità di anteprima, poi produzione, ritorno indietro provato | Claude, Enzo per il via in produzione | un `git checkout` nella cartella del repo non cambia lo sha servito (`scripts/verifica-deploy.sh` DEPLOYATO) | da fare |
| V5 | Descrittore `.turno/gemelli.json` nei due repo (macchine vm e debian; node 22/pnpm 9.15.0 per advanced, node 24/pnpm 11.19.0 per datastore; database; `solo_produzione`; riti); hook GU2; testo dei CLAUDE.md sulle regole dei turni (sostituisce «si lavora solo sulla VM») | Claude | PR unite | da fare |
| V6 | Riti: `dopo_presa` sulla Debian = migrazioni non rilasciate sulla copia (`db/scripts/migrate-if-pending.sh` per advanced, `pnpm run migra` + `prove:modello` per datastore) e segno GU7; `scripts/turno/dove-sono.sh` (GU3) agganciato a `migrate.sh` e ai seed | Claude | prova rossa prima e verde dopo, sulla Debian | da fare |
| V7 | `turno inizializza` dalla VM per i due repo (turno 0) | Claude | registro con turno 0 chiuso | da fare |
| V8 | Prova vera: turno 1 preso dalla Debian (copia dei database, conteggi uguali, migrazioni pendenti applicate), una migrazione di prova innocua in PR, turno chiuso; turno 2 preso dalla VM, `turno verifica` UGUALE; la migrazione arriva in produzione solo con il rilascio scelto da Enzo | Claude, Enzo per unire e rilasciare | due passaggi verdi per repo | da fare |
| V9 | Regole d'uso scritte nei riti di sessione e in memoria; esito del piano | Claude | registro compilato | da fare |

## Simulazione

V2: sola lettura su VM e Debian; il dump di prova per i tempi si ripristina sulla Debian in un database con nome a parte, che si toglie a fine misura (sulla Debian, con il sì di Enzo).
V3: si cambia solo turni-gemelli; le prove girano su cartelle e registro finti (`TURNO_REGISTRO`), come C2.
V4: tocca le unità systemd della VM: si fa con `sudo` solo con il tuo via scritto nel thread, prima sull'anteprima, con il ritorno alla copia precedente provato. Non arma rilasci e non muove `refs/heads/prod`.
V5-V6: PR normali nei due repo; i riti girano sulla Debian e sulla copia, mai sul database della VM. La guardia GU3 si vede rossa puntando di proposito il `.env` di una copia di prova al `system_identifier` della VM.
V7-V8: `turno inizializza` sulla VM scrive solo nel registro; la presa sulla Debian riceve database e file; senza D1 la presa dalla VM (turno 2) gira con `codice_per vm = solo_registro`.
Ogni pull, propagazione, rilascio e cancellazione sulla Debian o sulla VM parte solo con una frase scritta da Enzo nel thread.

## Che cosa non si chiude in questa sessione

Oggi si chiude solo V0 e la scrittura del piano. V1 aspetta Enzo; V4 aspetta D1; V8 aspetta Enzo per unire e rilasciare.

## Registro

- 2026-11-10 V0: misure nella tabella iniziale. Il worktree `bridge-cse_01L8VLYTsADhugoGv8y9sGgp` sulla Debian è quello della sessione Remote Control aperta oggi: non si tocca.
