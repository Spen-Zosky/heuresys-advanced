# WS-T8 — Operational Readiness & Scalability
> DD investor-grade. Postura: **indipendente / avversariale**. Rivalidazione della DD 2026-06-17 (HEAD `ce26608`). Data: 2026-09-28. HEAD `5faa2bc2ca78c40bec603e77df9da176c6971337`. Auditor: Claude Sonnet 5.

---

## Sintesi

Rispetto al 2026-06-17 (score 62/100, Adeguato) l'infrastruttura operativa ha avuto un salto di maturità reale, misurato sul codice e sulla CI live di oggi, non dichiarato: **5 degli 8 finding HIGH/MEDIUM di giugno risultano risolti**, con un secondo runner CI off-prod, database di CI isolato dalla produzione, rollback applicativo a un comando, backup off-host verificato, e metriche Prometheus in produzione. La verifica ha però scoperto **un difetto nuovo, live**: l'endpoint `/metrics` — che il codice commenta come "mai osservabile pubblicamente" — è in realtà raggiungibile da chiunque su `https://www.heuresys.com/api/metrics` (verificato: `curl` pubblico → HTTP 200, corpo Prometheus completo), perché il rewrite Next.js `/api/:path*` non è coperto dal blocco nginx su `/metrics` nudo, e la connessione che ne risulta appare come loopback all'app che quindi supera il proprio controllo di sicurezza. Non è un incidente su dati di persone (nessuna PII nel corpo), ma è un'esposizione di telemetria interna (rotte, tassi di errore, latenze, contatori di autenticazione) non autenticata, ed è la prova che un controllo scritto nel commento del codice può essere disatteso dalla topologia reale.

**Punteggio: 79/100 | Banda: Forte | Confidence: Alta.**

---

## Claim del venditore rivalidati

| # | Claim (giugno 2026, F-T8-NN) | Esito oggi | Evidenza |
|---|---|---|---|
| F-T8-01 | Runner self-hosted unico = VM PROD (SPOF CI+PROD) | **RISOLTO** | `docs/ci/self-hosted-runners-setup.md` §10: secondo runner `linux-pc-runner` (host LAN, x86_64, twin di PROD) con label `off-prod,linux-pc`. `test-integration.yml`, `playwright-smoke.yml`, `build-web.yml` ora girano `runs-on: [self-hosted, off-prod]`; solo i gate leggeri (typecheck/lint/i18n-parity/shell-tests) e `state-lint` (deliberatamente, per leggere lo stato REALE di PROD) restano su `oci-vm`. `docs/kb/SOT_STATE.md`: "D-08 F2-F5 SHIPPED... i 3 workflow pesanti retargati... PROD fuori dal loro path CI". |
| F-T8-02 | DB PROD usato come DB CI per gli integration test | **RISOLTO** | `test-integration.yml` righe 63-68: `POSTGRES_DB: heuresys_ci` — database isolato sul gemello linux-pc, clonato da PROD e portato a HEAD con `db/scripts/migrate.sh` a ogni run, MAI la connessione a `heuresys_advanced`. |
| F-T8-03 | CI serializzata: 1 runner, nessun parallelismo | **PARZIALMENTE RISOLTO** | Con 2 runner (oci-vm + off-prod) i gate leggeri e quelli pesanti possono correre in parallelo su host diversi; resta un solo runner per classe di gate (nessun parallelismo interno alla classe "pesante"). `gh run list` di oggi mostra run concorrenti su branch diversi (push main + PR Dependabot) senza coda visibile. |
| F-T8-04 | Assenza di rollback automatizzato (KPI "≤1 comando" non soddisfatto) | **RISOLTO** | `scripts/vm-rollback.sh` esiste: `bash scripts/vm-rollback.sh [<sha>]`, default al contenuto di `pg_dump_snapshots/LAST_GOOD_SHA`; fa checkout detached, rebuild, restart, e verifica con probe `/readyz` + `/login`. `vm-deploy.sh` righe 193-206 scrive uno snapshot `pg_dump -Fc` pre-deploy PRIMA di ogni deploy (rete di sicurezza sul DB) e righe 335-337 registrano `LAST_GOOD_SHA` solo a probe riuscita. |
| F-T8-05 | PROD traccia `origin/main` HEAD, nessun versioning esplicito | **RISOLTO** | Il rilascio non è più "ogni push a main finisce in prod al prossimo deploy": CLAUDE.md e `scripts/deploy-watch.sh` descrivono un gate esplicito su `refs/heads/prod` (ADR-0028) — `close-propagate.sh` arma il ref, `heuresys-advanced-deploy-watch.timer` esegue il rollout SOLO quando la CI sullo sha è verde (`ci-gate.sh`, fail-closed, dentro `vm-deploy.sh` riga 85). Il deploy resta manuale/armato, mai automatico su ogni push. |
| F-T8-06 | Backup on-VM, nessuna copia off-host | **RISOLTO** | `scripts/pull-prod-backups.sh`: PULL (non push, per non dare a PROD credenziali verso l'archivio) da `linux-pc` — host fisicamente diverso, dietro NAT domestico — con verifica di integrità `pg_restore --list` su ogni dump scaricato e soglia anti-troncamento (10 MiB). Schedulato: `heuresys-backup-pull.timer` fra i 14 timer systemd oggi installati (erano 4 a giugno). |
| F-T8-07 | Metriche solo in-RAM, nessun Prometheus, nessuna persistenza | **RISOLTO (con una riserva nuova)** | `apps/api/src/modules/observability/prometheus.ts`: registro `prom-client` con istogramma latenza per rotta/metodo/stato, contatore eventi auth, metriche di processo default (event-loop lag, heap, GC, fd). `docs/kb/SOT_STATE.md`: "Prometheus 3.13.1 su VM, `heuresys-prometheus.service` loopback :9091... target `heuresys-api` UP... `PROM_METRICS_ENABLED=true` in PROD" — confermato: `curl https://www.heuresys.com/api/metrics` → **200**, corpo Prometheus reale con istogrammi live (vedi Finding F-T8-09: il controllo di loopback dell'app è aggirato dal rewrite Next.js). |
| F-T8-08 | Architettura single-node, nessun path di scale-out documentato | **INVARIATO** | Nessun riferimento a cluster/load-balancer/replica in `deploy/README.md` o nei deploy script letti oggi. Non riverificato in dettaglio in questa sessione (fuori dal delta principale); resta un gap accettabile per lo stadio attuale. |

---

## Finding

| ID | Titolo | Severità | Tipo | Evidenza | Impatto | GA-blocker | Remediation + effort | Confidence |
|---|---|---|---|---|---|---|---|---|
| F-T8-09 | `/metrics` pubblicamente osservabile via rewrite `/api/*`, in contraddizione con il commento del codice | MEDIUM | Security / Observability | `apps/api/src/app.ts` righe 357-370: la rotta `/metrics` nega con 404 chi non è loopback (`req.socket.remoteAddress`), col commento "l'endpoint non è mai osservabile pubblicamente". `deploy/nginx/www.heuresys.com.conf` righe 63-67 blocca solo il path nudo `/metrics`. `apps/web/next.config.*` riga 65: `rewrites()` inoltra `/api/:path*` → l'API interna per QUALSIASI path, incluso `/metrics`, senza esclusione. Poiché Next.js (sulla stessa VM) si connette all'API via loopback, la richiesta arriva all'app **sempre** come peer `127.0.0.1`, quindi il controllo passa per un client esterno qualsiasi. Verificato live oggi: `curl -s https://www.heuresys.com/api/metrics` → HTTP 200, corpo Prometheus completo (istogrammi di latenza per rotta, contatori di eventi auth, metriche di processo Node). | Nessuna PII nel corpo osservato, ma esposizione non autenticata di telemetria operativa interna (nomi di rotta, tassi di errore, volumi, latenze) utile a un attaccante per ricognizione. Il gap è anche documentale: il commento nel codice descrive una garanzia che la topologia reale smentisce — lo stesso pattern di rischio già visto altrove nel progetto (fidarsi del commento invece di misurare). | CONDIZIONALE (non blocca GA per un tenant attuale; da chiudere prima di clienti enterprise con requisiti di hardening perimetrale) | Aggiungere `/api/metrics` (oltre a `/metrics`) all'elenco escluso dal rewrite Next.js, o negare esplicitamente il path in `next.config` `beforeFiles`; alternativamente, l'app dovrebbe verificare un header interno iniettato solo dal collector systemd (non fidarsi del solo `remoteAddress` quando esiste un reverse proxy sullo stesso host). ~0.25 sessioni. | Alta (misurato con richiesta HTTP reale, non dedotto dal codice) |
| F-T8-10 | Scalabilità single-node: nessun cambiamento misurato dal 2026-06-17 | LOW | Scalability | Nessun riferimento a scale-out in `deploy/README.md`; non riverificato in profondità in questa sessione. | Come a giugno: accettabile per lo stadio attuale (2 tenant, carico moderato), da rivedere oltre soglie di crescita non ancora raggiunte. | NO | Documentare soglie di scale-out; verificare uso reale di pgbouncer nella connection string dell'API. | Media (non ri-misurato oggi in dettaglio) |
| F-T8-11 (ex F-T8-03) | CI parallela solo fra classi di gate, non dentro la classe pesante | LOW | Velocity | 3 workflow pesanti (`test-integration`, `playwright-smoke`, `build-web`) condividono comunque il solo runner `off-prod`: un push che li tocca tutti e tre li mette ancora in coda fra loro. | Miglioria via, non un blocco: il tempo di feedback per un push "pesante" resta seriale (~20-75 min secondo `playwright-integrale.yml`), ma non blocca più i gate leggeri né PROD. | NO | Un secondo runner off-prod, o partizionare per directory (D-06 caching/affected, già proposto a giugno). | Alta |

**Finding di giugno CHIUSI in questa rivalidazione**: F-T8-01, F-T8-02, F-T8-04, F-T8-05, F-T8-06, F-T8-07 (con riserva → F-T8-09).
**GA-blocker count: 0 assoluti, 1 condizionale (F-T8-09, hardening pre-enterprise).**

---

## Score del pilastro

**Score: 79/100 | Banda: Forte (75-89) | Confidence: Alta**

| Area | Punti max | Assegnati (giugno) | Assegnati (oggi) | Motivazione del delta |
|---|---|---|---|---|
| CI/CD pipeline attiva e configurata | 25 | 18 | 23 | SPOF risolto (2° runner off-prod), DB CI isolato; resta un margine per il parallelismo intra-classe (F-T8-11) |
| Deploy automatizzato e robusto | 20 | 14 | 19 | Rollback a un comando, `pg_dump` pre-deploy, `LAST_GOOD_SHA`, deploy-gate su CI-verde (ADR-0028) — tutto verificato nel codice dei tre script |
| Backup & DR | 20 | 12 | 18 | Backup off-host reale (pull da host fisicamente diverso, con verifica `pg_restore --list`), 14 timer systemd attivi incl. `dr-drill` e `clonedb`; RTO non ri-misurato oggi in una corsa dal vivo (non richiesto da questo ciclo) |
| Observability | 20 | 10 | 15 | Prometheus reale in produzione con scrape attivo; -5 per F-T8-09 (esposizione pubblica non voluta, scoperta live) |
| Scalability & architettura | 15 | 8 | 4 | Non riverificata in profondità in questo ciclo (fuori dal perimetro principale della rivalidazione); punteggio riportato prudenzialmente più basso per assenza di nuova evidenza, non per un peggioramento misurato |

**Nota metodologica**: il punteggio "Scalability" è tenuto deliberatamente cauto (non hanno numeri per addition confidence) perché questa rivalidazione si è concentrata sul delta CI/CD/deploy/backup/observability, dove il codice e la CI davano evidenza diretta e verificabile in pochi minuti; una verifica di scalabilità richiederebbe un carico reale o una lettura più estesa che qui non è stata fatta.

**Asset non riconosciuti dal punteggio di giugno, oggi confermati**:
- `codeql.yml` (security scanning, SHA-pinned) aggiunto al parco CI (12 workflow oggi contro 8 a giugno)
- `playwright-integrale.yml` (suite E2E completa, non solo smoke) come gate separato
- `state-lint.yml` e `atlas-freshness.yml`: governance della coerenza fra stato dichiarato e stato reale, automatizzata in CI
- 14 timer systemd (`heuresys-advanced-*` + `heuresys-backup-pull`) contro i 4 di giugno: backup, DR drill, deploy-watch, clone-db, GDPR retention, SLA approvazioni, digest notifiche — un'operatività molto più matura di quanto il singolo numero di score suggerisca da solo
