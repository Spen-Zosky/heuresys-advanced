# Piano B2 — ruolo PostgreSQL limitato per gli agenti (2026-11-21)

Obiettivo: gli agenti scrivono nel database di produzione con un ruolo che non può fare DROP, TRUNCATE né ALTER; il database rifiuta questi comandi per qualunque strada. Le migrazioni passano solo dal proprietario `heuresys` (script di rilascio).

## Misure (2026-11-21, sola lettura)

- Ruoli esistenti: `heuresys` (proprietario, migrator), `heuresys_app` (API, LOGIN), `heuresys_ro` (NOLOGIN), `heuresys_backup`, `heuresys_datastore_ro`. Nessuno è superuser tranne `postgres`.
- `heuresys_app` ha SELECT/INSERT/UPDATE/DELETE su 505 tabelle, nessun TRUNCATE, nessun CREATE, non è proprietario: già soddisfa il requisito, ma lo usa l'API, non gli agenti.
- Gli script e gli strumenti degli agenti (`scripts/*.sh`, `docs/kb/tools/*.py`) usano `POSTGRES_USER` del `.env`, cioè il proprietario `heuresys`: è questo il buco.

## Voci

| id | cosa | chi | fatta quando |
|---|---|---|---|
| B2.1 | `deploy/postgres/ruolo-agenti.sql`: crea `heuresys_agenti` (NOLOGIN finché non ha password), stessi privilegi di riga di `heuresys_app`, niente TRUNCATE/REFERENCES/TRIGGER, niente CREATE, non proprietario; post-condizioni nel file | io | file nel repo, eseguito, post-condizione verde |
| B2.2 | `deploy/postgres/assegna-password-agenti.sh`: genera la password, la scrive solo in `~/.config/claude-agenti/db-agenti.env` (modo 600), mai stampata | io | file nel repo, eseguito |
| B2.3 | `deploy/postgres/psql-agenti.sh`: wrapper che carica quel file e lancia `psql` come `heuresys_agenti`; gli agenti usano questo | io | file nel repo, collegamento provato |
| B2.4 | `deploy/postgres/prova-ruolo-agenti.sh`: prova DROP/TRUNCATE/ALTER/CREATE rifiutati su una tabella temporanea creata dal proprietario in uno schema di prova, e SELECT/INSERT/UPDATE/DELETE ammessi | io | exit 0 con output |
| B2.5 | PR in bozza | io | PR aperta |

## Simulazione (prima di eseguire)

- Deve già essere vero: backup verificato < 24 h (`bash ~/.claude/tools/backup-verificato.sh heuresys_advanced`); `sudo -u postgres` funziona sulla VM (misurato: sì).
- Strumento: `sudo -u postgres psql -d heuresys_advanced -f ruolo-agenti.sql`, come `ruoli.sql`; idempotente; solo `CREATE ROLE`/`GRANT`, nessuna tabella reale toccata.
- Portare il risultato altrove: i file stanno nel repo; il segreto resta sulla VM. Propagare alle altre macchine non è in questo ciclo (decisione di Enzo).
- Serve Enzo? No per la creazione (permesso permanente con backup). Sì se si vuole togliere al proprietario l'accesso degli agenti: vedi sotto.
- Distruttiva? No. La prova di DROP/TRUNCATE gira solo su una tabella creata apposta in uno schema `prova_agenti_<id>` e poi eliminata dal proprietario; mai su tabelle reali.

## Cosa non si chiude in questo ciclo

1. Spostare ogni script esistente da `heuresys` a `heuresys_agenti`: molti fanno DDL legittimo (migrazioni, seed). Va deciso script per script.
2. Impedire fisicamente che un agente usi la password del proprietario: oggi lo fanno solo `enzo-guard` e il blocco di lettura del `.env`; il database non può distinguere chi sta dietro `heuresys`. Soluzione piena (decisione di Enzo): la password del proprietario esce dall'ambiente degli agenti e resta al solo script di rilascio.
3. Propagazione ai PC.

## Tappa 2 — gli script degli agenti su `heuresys_agenti` (PR separata, sì di Enzo 21/11 19:52)

Come: due aiuti gemelli, `deploy/postgres/env-agenti.sh` (bash, da includere dopo il file d'ambiente del repo) e `docs/kb/tools/_pg_agenti.py` (Python, importato), leggono `~/.config/claude-agenti/db-agenti.env` e portano `POSTGRES_USER`, `POSTGRES_PASSWORD`, `PGUSER`, `PGPASSWORD`, `ATLAS_PGUSER` su `heuresys_agenti`. Dove il file manca (PC via tunnel, gemello) lo dicono su stderr e lasciano l'ambiente com'era: la propagazione della credenziale è una decisione di Enzo.

Censimento: `git grep -lE 'POSTGRES_USER|POSTGRES_PASSWORD|PGUSER|PGPASSWORD|DATABASE_URL|-U heuresys'` sui file `.sh .py .ps1 .mjs .ts .js .json`, fuori da `node_modules`.

### Passano a `heuresys_agenti` (leggono o scrivono solo righe; nessuna istruzione di struttura, misurato con grep)

| file | cosa fa |
|---|---|
| `docs/kb/tools/build_atlas.py`, `build_soglie_agente.py`, `censimento_riferimenti_orfani.py`, `check_domini_ricercabili.py`, `check_embedding_coverage.py`, `check_identita_azienda.py`, `check_pagine_raggiungibili.py`, `check_permessi_inutili.py`, `check_tenant_contamination.py`, `chi_ripara.py`, `chi_sorveglia.py`, `completezza_tenant.py`, `db_health.py`, `dead_columns.py`, `exposure_columns.py`, `verifica_incrociata.py` | controlli e misure in sola lettura |
| `db/scripts/audit-storia36-semantic.py` | controllo in sola lettura della storia RTL |
| `scripts/auth-housekeeping.sh` | DELETE dei token scaduti e degli eventi di login vecchi |
| `scripts/gdpr-retention-sweep.sh` | DELETE per conservazione GDPR |
| `scripts/atlante-automatico.sh` | lettura per l'atlante |

Prova dal vivo sulla VM (2026-11-21, sessione senza la password del proprietario nell'ambiente, `PGPORT=5432`): i 13 strumenti con accesso al database girano senza un solo errore di permesso o di autenticazione (`grep -ciE 'permission denied|password authentication|no password'` = 0); le uscite 1/2 sono rossi di contenuto già noti (sentinelle, verifiche incrociate), non di accesso.

Misura richiesta dalla revisione (2026-11-21, sola lettura, come `heuresys_agenti`): `select schemaname, count(*) from pg_stat_user_tables where schemaname not in ('sys','audit','staging','reference_sync') group by 1` → nessuna riga; fuori dai quattro schemi ci sono solo 2 viste in `public`, leggibili dal ruolo. `build_atlas.py` completo come `heuresys_agenti`: exit 0, «432 tabelle DB», 0 errori di permesso (i file generati sono stati rimessi com'erano). Nessun permesso da aggiungere.

Ripiego: finché la tappa 3 non è applicata, se il file della credenziale manca o è rovinato i due aiuti tornano al proprietario e lo dicono solo su stderr; dopo lo spostamento della password il ripiego fallisce l'autenticazione, quindi il difetto si chiude da sé.

### Restano al proprietario `heuresys` (DDL legittimo o fuori dal perimetro degli agenti)

| file | perché |
|---|---|
| `db/scripts/migrate.sh`, `migrate.ps1`, `migrate-if-pending.sh` | migrazioni: creano e cambiano la struttura |
| `scripts/rilascia.sh`, `scripts/vm-deploy.sh` e la catena di rilascio | applicano le migrazioni |
| `db/scripts/storia36.sh` | `CREATE OR REPLACE` delle funzioni della storia |
| `db/scripts/setup_oci_vm_database.sh`, `create_local_database.*`, `reset_local_database.*`, `scripts/setup-local-pg.sh`, `scripts/provision-ci-runner-linuxpc.sh` | creano database, ruoli, estensioni |
| `db/scripts/ci-rehearsal.sh`, `ci-rehearsal-census.sh`, `ci-db-usa-e-getta.sh`, `scripts/clone-vm-db.sh`, `db/scripts/onda2/prova-*.sh`, `db/scripts/pacchetto/prova-*.sh` | creano e distruggono copie usa-e-getta |
| `db/scripts/validate_database.*` | `pg_dump --schema-only` e confronto dello schema, sul gemello |
| `db/scripts/seed-*.ts`, `provision-*.ts`, `encrypt-totp-secrets.ts`, `stop-deriving-totp.ts`, `verify-separazione-totp.ts`, `sospendi-collaudo.ts`, `db/scripts/pacchetto/*.mjs` | seed e provisioning: portano a uno stato dichiarato; vanno rivisti uno per uno in un giro a parte |
| `docs/kb/tools/build_menu.py`, `check_completezza_self.py`, `check_exposure.py`, `check_pagine_orfane.py`, `status_dashboard.py` | hanno `-U heuresys` e la porta 5433 scritti nel codice: girano dal PC via tunnel. Nota: `chi_ripara.py` importa `_pg_agenti` e poi chiama `check_exposure.py`; dove la credenziale degli agenti esiste (VM) quella chiamata parte come `heuresys` con la password degli agenti e fallisce, ma sulla VM la porta 5433 non risponde comunque |
| `scripts/turno/dopo-presa-debian.sh`, `scripts/verifica-cloni.sh`, `scripts/db-health-graph.sh`, `scripts/session-boot.ps1`, `scripts/setup-tunnel-automation.ps1` | girano sul PC o sulla Debian via tunnel, dove la credenziale degli agenti non c'è |
| `scripts/propagate-secret-rotation.sh`, `deploy/postgres/assegna-password-*.sh`, `prova-identita-app.sh` | gestiscono le credenziali stesse |
| `apps/api/src/**`, `apps/agent-gateway/src/**` | servizi: in produzione usano già `heuresys_app` (`POSTGRES_APP_USER`) |
| `apps/api/scripts/*.mjs`, `apps/*/test/**`, `cowork_reserved/**`, `db/seeds/rtl-rebuild/00_extract_legacy_subset.sh`, `db/scripts/extract_users_employees_legacy.sh`, `db/scripts/import-d1-user-skills.sh`, `docs/archive/**`, `.programmi/**` | prove locali, test, ingestione legacy chiusa (ADR-0038), archivio |

## Tappa 3 — la password del proprietario esce dall'ambiente degli agenti (PR separata, sì di Enzo 21/11 19:52)

| id | cosa | chi | fatta quando |
|---|---|---|---|
| B2.3a | `deploy/postgres/env-proprietario.sh`: incluso dopo il file d'ambiente, prende la password da `~/.config/heuresys-proprietario/db.env` (600) se c'è | io | file nel repo, prova su file finti verde |
| B2.3b | `db/scripts/migrate.sh`, `migrate-if-pending.sh` (la usa il deploy), `storia36.sh` lo includono | io | `bash -n` verde; CI verde |
| B2.3c | `deploy/postgres/come-proprietario.sh <cmd>`: seed e provisioning con DDL legittimo | io | file nel repo |
| B2.3d | `apps/api/src/lib/inbox-stream.ts` ascolta come `heuresys_app` dove `POSTGRES_APP_USER` è impostata, come il pool: senza, con la password del proprietario vuota il canale delle notifiche cadrebbe | io | CI verde |
| B2.3e | `deploy/postgres/sposta-password-proprietario.sh`: sposta la password nel file nuovo e lascia `POSTGRES_PASSWORD=` vuota nel file d'ambiente (lo schema dell'API la pretende presente). Guardie: la password deve entrare prima, il file nuovo deve entrare prima di svuotare il vecchio, post-condizione; cerca per contenuto le copie che contengono ancora la password sotto `$HOME` (`.env.bak` di `assegna-password-app.sh`, `.env.bak-<data>` di `propagate-secret-rotation.sh`, `banco.env`, `~/.pgpass`, copie nei worktree, `_da_eliminare/`) senza stamparla e non dice «ok» finché ce n'è una (exit 3); `--verifica` solo legge e le elenca; `--ritorna` è il rollback, con post-condizione (riga presente, uguale al file, password che entra). Password mai fra gli argomenti dei processi (awk con `ENVIRON`, grep con `-f`), riscrittura atomica (temporaneo nella stessa cartella + `mv`), temporanei tolti da `trap … EXIT` | io lo scrivo; lo esegue un thread dopo unione e rilascio, con il sì di Enzo | prova su file finti, 6 casi verdi: helper con e senza file; password che non entra → niente spostato, exit 1; copia residua trovata per contenuto e valore mai stampato; `--ritorna` con riga assente → riga aggiunta con la barra rovesciata intatta e niente «ok» se non entra; nessun temporaneo residuo |
| B2.3f | Regola della guardia: `~/.config/heuresys-proprietario/**` è un file di segreti (Read/Edit/Write e lettori da shell negati) e una sessione non carica `come-proprietario.sh` né `env-proprietario.sh`; `Read(~/.config/heuresys-proprietario/**)` in `settings-comuni.json`. Spostamento e regola vanno insieme: senza la regola il file nuovo è 600 ma dello stesso utente degli agenti, e la protezione è solo contro lo sbaglio | io; sì di Enzo (classe guardie e permessi) | Spen-Zosky/claude-ecosystem PR #1 in bozza; `claude plugin test enzo-guard` 129 pass / 2 fail, gli stessi 2 fail (`python: …`) presenti identici sulla versione attuale |

Simulazione: l'ordine conta. Prima si uniscono e si rilasciano #377, la PR della tappa 2 e questa; poi, sulla VM, `bash deploy/postgres/sposta-password-proprietario.sh`, poi `--verifica` e una `pnpm db:migrate:vm` a vuoto per dimostrare che le migrazioni entrano ancora. Se lo spostamento venisse prima del rilascio, il deploy successivo non troverebbe la password e si fermerebbe rosso (non distruttivo). Il percorso del rilascio include ancora `.env` via collegamento (`scripts/rilascio-copia.sh`), quindi basta un file solo.

Limiti, da dichiarare e non correzioni di codice:

- Sulla VM resta `sudo -u postgres` senza password: chi esegue comandi come `ubuntu` è ancora superuser del database. La barriera vera resta la guardia (B2.3f).
- La password attuale è stata per mesi nel file d'ambiente letto dalle sessioni, e sta ancora nei file d'ambiente dei PC e del gemello, da cui si arriva alla produzione via tunnel. L'unica chiusura completa è ruotare la password del proprietario dopo lo spostamento: costa riallineare i PC, ed è una decisione di Enzo.

Non si chiude qui: la stessa separazione sul gemello e sui PC (propagazione, decisione di Enzo); gli script elencati come «seed e provisioning» vanno lanciati con `come-proprietario.sh` dopo lo spostamento.
