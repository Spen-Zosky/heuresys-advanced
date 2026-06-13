# FINDINGS / WS-G — CI/CD & deploy (S-100X-A1)

> Audit forense **read-only** del workstream CI/CD & deploy. Metodo: fan-out 5 sub-agent read-only (ci-workflows · runner-SPOF · deploy-rollback · release-branch · ci-supply-chain) → sintesi main-thread (AUDIT_PROTOCOL §4). Evidenza: `gh run view/list/api`, `git log`, `path:linea` reali. Nessun file/CI/deploy modificato. `gh` autenticato (Spen-Zosky) → durate REALI. Data: 2026-06-13 (S987). Classificazione: `AUDIT_PROTOCOL.md`.

## Headline (cosa cambia rispetto al seed R01/R02)

1. **🔴 NUOVO CRITICAL non nel seed**: repo **PUBBLICO** + runner self-hosted **sull'host PROD** + trigger `pull_request` su 7/8 workflow → una fork-PR che tocca `apps/api/**` esegue codice attacker-controlled (vitest/build) **sul box di produzione come user `ubuntu`** (lo stesso che possiede i servizi prod + accesso DB `localhost:5432`). Eleva **D-08 da dossier di robustezza a priorità-sicurezza**.
2. **La "CI lenta" è quasi tutta coda, non compute**: typecheck **14m00s wall / 76s compute**; test **12m42s wall / 386s compute** (vitest 353s) — provato via `gh run view --json jobs` (step timings vs `createdAt`). Il runner unico serializza 6-7 workflow per push. **Leva velocity #1 = 2° runner** (parallelizza il fan-out), non micro-ottimizzare un job.
3. **`main` non ha required-status-checks**: la CI gira **dopo** che il commit è già su main (`push:`), nessuna regola la rende gating. PROD fa `reset --hard origin/main` (tip del branch, **non** un tag). CI = advisory, non safety-net.
4. **Saving grace strutturale**: **nessun workflow invoca `vm-deploy.sh`** — il deploy è manuale-SSH-only. Questo **bounda R01+R02** a errore-operatore/no-rollback, **non** a un percorso CI-RCE-to-prod automatico. Da preservare in ogni evoluzione di D-08.

---

## Gruppo A — Runner SPOF & sicurezza (cuore di D-08)

### F-WS-G-1 — Public repo + self-hosted runner sull'host PROD → fork-PR = code-exec su produzione
- Severità: **CRITICAL** | Flag: DOSSIER (→ D-08)
- Evidenza: `gh repo view --json visibility` → `PUBLIC`. 7/8 workflow `runs-on: [self-hosted, oci-vm]` con trigger `pull_request: branches:[main]` (build-web:16, i18n-parity:14, lint:17, playwright-smoke:18, shell-tests:14, test-integration:24, typecheck:20). Unico `if:` = `!contains(...labels...'defer-major')` (filtro churn Dependabot) — **nessun** `pull_request_target`-avoidance, **nessun** actor/owner gate, **nessuna** approval-label. Runner gira come OS user `ubuntu` = stesso user dei servizi prod (`heuresys-advanced-api.service:11 User=ubuntu`) + accesso trusted `psql -h localhost -p 5432` (test-integration.yml:71).
- Impatto: **sicurezza** (RCE sul prod host + accesso DB/secret da codice di una fork-PR)
- Baseline: l'unica barriera è il setting GitHub "require approval for first-time contributors" (account-level, non in-repo, esclude chiunque abbia già un merge). B-30 fu WON'T-DO proprio per "repo PUBBLICO → fork-PR code eseguibile" (`SOT_BACKLOG.md:314`).
- Proposta: **D-08 headline sicurezza**. Conservativa immediata: rimuovere i trigger `pull_request` dai workflow self-hosted sul repo pubblico (o gate dietro label trusted) + require-approval per TUTTE le PR esterne. Evolutiva/radicale: runner ephemeral container-per-job **off-prod** + DB non-prod.
- ✅ **MITIGATO S988** (`7177dda`): applicato un **fork-guard** job-level a tutti i 7 workflow self-hosted (strettamente superiore al drop di `pull_request` — preserva la CI su push + PR same-repo/Dependabot): `if: (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository) && !defer-major`. Una fork-PR valuta `false` → il job è skippato dal controller GitHub **prima** di qualsiasi checkout sul runner → 0 code-exec su PROD. **Il vettore CRITICAL F-1 è chiuso.** Defense-in-depth manuale raccomandata (setting GitHub, non versionabile): "Require approval for all external contributors". **NB**: i restanti finding D-08 (SPOF F-2, DB-condiviso F-3, resource-contention F-4, secret-on-host F-5/6, rollback F-8..13, required-checks F-21/22) restano materiale del dossier robustezza 100X — non coperti da questa mitigazione di sicurezza.

### F-WS-G-2 — Runner self-hosted unico = la VM PROD (SPOF: CI e PROD cadono insieme) [R01 confermato]
- Severità: HIGH | Flag: DOSSIER (→ D-08)
- Evidenza: `gh api .../actions/runners` → **1** runner (`oracle-vm-default-runner`, online, ARM64/oci-vm). 7/8 workflow `runs-on: [self-hosted, oci-vm]`; host = `oracle-vm-default` (`docs/ci/self-hosted-runners-setup.md:5`) = host PROD (`deploy/README.md:149,153`: web :3013 / api :8013 / PostgreSQL :5432).
- Impatto: robustezza
- Baseline: 1 runner, 0 ridondanza. VM giù → tutti i gate CI **e** PROD cadono insieme. Il jitter OCI free-tier S980 (DEBT_REGISTER D-20, 4 boot falliti) è una demo live.
- Proposta: D-08. Conservativa: cgroup-slice + ephemeral on-VM. Evolutiva: runner off-prod (box/container separato, i 2 gate DB raggiungono il DB via tunnel). Radicale: GH-hosted + tunnel/managed-CI a una replica DB non-prod.

### F-WS-G-3 — CI tests girano contro il LIVE PROD DB (`heuresys_advanced` @ :5432)
- Severità: HIGH | Flag: DOSSIER (→ D-08)
- Evidenza: `test-integration.yml:67-69 psql -h localhost -p 5432 -d $POSTGRES_DATABASE`; runner `POSTGRES_DB=heuresys_advanced` (`self-hosted-runners-setup.md:118-119`) = il DB prod (`deploy/README.md:153`). 901 it-block + `pnpm db:seed-test-admin` mutano lo stesso DB che serve PROD a ogni push/PR.
- Impatto: robustezza (data-integrity coupling oltre il mero SPOF)
- Baseline: CI e PROD condividono un DB → un test write/seed (o una fork-PR, vedi F-1) può corrompere/lockare dati prod; una suite lunga tiene connessioni/lock sul DB prod.
- Proposta: D-08. Conservativa: DB/schema CI separato. Radicale: replica DB non-prod via tunnel da runner off-prod.

### F-WS-G-4 — Resource contention: CI heavy (build/test/E2E) sul prod host senza limiti (0 cgroup/container)
- Severità: HIGH | Flag: DOSSIER (→ D-08)
- Evidenza: `grep -E 'container:|cgroup|MemoryMax|CPUQuota|--cpus|--memory' .github/workflows/*` → **0 hit**. playwright-smoke.yml:64,67,113 fa `pnpm install` + `playwright install --with-deps chromium` + `pnpm build` + boota API (`pnpm dev`) e `next start` sul prod host; test-integration gira 901-it. Durate minuti-lunghe condividono CPU/RAM/disk con api:8013/web:3013/DB:5432.
- Impatto: robustezza
- Baseline: 0 isolamento cgroup; un `next build` o chromium-install che spike RAM sull'ARM free-tier degrada PROD sullo stesso kernel (S984: un foreign next-server su :3100 prova che processi non controllati coesistono e interferiscono).
- Proposta: D-08. Conservativa: systemd cgroup-slice (MemoryMax/CPUQuota) sull'unit del runner. Meglio: spostare il compute CI off-prod.

### F-WS-G-5 — Runner legge secret on-host (`/etc/heuresys-runner.env`), accoppiando l'accesso-secret CI al box prod
- Severità: HIGH | Flag: DOSSIER (→ D-08)
- Evidenza: `grep secrets\. .github/workflows/*` → **1 hit** (showcase.yml:93 `GITHUB_TOKEN`). I 7 gating workflow consumano DB/JWT/cookie/MFA come shell-var dall'EnvironmentFile systemd del runner (test-integration.yml:42-46 comment; bare `$POSTGRES_USER`). `self-hosted-runners-setup.md:115-138`: `/etc/heuresys-runner.env` mode 600 sul prod host. Poiché runner-host == DBMS-host, **ogni** step (incl. fork-PR, F-1) gira con accesso a secret prod-adiacenti + `localhost:5432`.
- Impatto: sicurezza
- Baseline: secret in 1 file on-host; 7/8 workflow sul prod VM.
- Proposta: D-08. Conservativa: tieni l'env on-host (beneficio zero-GitHub-exposure) MA gate fork-PR; OR sposta i check read-only su runner GH-hosted ephemeral con GitHub Secrets scoped.

### F-WS-G-6 — Nessun runner ephemeral/containerizzato/least-privilege (long-lived con accesso host+secret ampio)
- Severità: MEDIUM | Flag: DOSSIER (→ D-08)
- Evidenza: runner registrato `--unattended` come systemd persistente user `ubuntu` (`self-hosted-runners-setup.md:66-77,151`); stesso `_work` dir + pnpm store warm + secret persistono tra tutti i run e tutte le PR. Nessun container/ephemeral teardown.
- Impatto: sicurezza (job N può avvelenare il workspace per N+1; secret raggiungibili da fork-PR — compone il CRITICAL)
- Proposta: D-08. `--ephemeral` e/o container-per-job con secret scoped. Interim: secret per-workflow invece dell'EnvironmentFile blanket.

### F-WS-G-7 — Gap backup-runner riconosciuto ma nessun path sicuro adottato (B-30 WON'T-DO desktop, off-prod non costruito)
- Severità: MEDIUM | Flag: DOSSIER (→ D-08)
- Evidenza: `SOT_BACKLOG.md:314` B-30 WON'T-DO su desktop (copre 4/6 gate, i 2 DB non girano se la VM è giù, + rischio fork-PR sul PC primario); §8 di `self-hosted-runners-setup.md:229-239` DEFERRED. SPOF noto, fallback desktop correttamente respinto, ma nessun runner isolato/off-prod eretto.
- Proposta: D-08 — adottare la direzione già identificata "runner isolato/off-prod" (chiude SPOF-redundancy + resource-contention + fork-PR exposure in un colpo).

---

## Gruppo B — Deploy atomicity & rollback (R02)

> **Bound chiave (asset)**: `grep uses: .github/workflows/*` → **nessun** workflow invoca `vm-deploy.sh` o restarta i servizi (`docs/ci/workflows-overview.md:19`: showcase/gh-pages è l'unico deploy-workflow). Il deploy app gira solo via `bash scripts/vm-deploy.sh` su SSH di Enzo → **codice non-trusted non raggiunge mai il runtime app automaticamente**. R02 è quindi un rischio errore-operatore/no-rollback, non CI-RCE.

### F-WS-G-8 — `vm-deploy.sh` ZERO rollback: reset→build→restart in-place, no last-good/release-dir/auto-revert
- Severità: HIGH | Flag: DOSSIER (→ D-08)
- Evidenza: `scripts/vm-deploy.sh:44-46` `fetch; checkout; reset --hard origin/$BRANCH` poi build lineare (92-103) → restart (128-133). Nessuna sha catturata prima del reset; nessun `releases/`+`current` symlink; `grep rollback|last.good|previous.sha|revert scripts/` → 0 hit in vm-deploy.sh (l'unica rollback-machinery è `align-claude-ecosystem.sh:325`, config Claude, non l'app).
- Impatto: robustezza
- Baseline: 0 path di rollback.
- Proposta: D-08. **Conservativa** (cheapest, ~1-2h, additiva): `LAST_GOOD=$(git rev-parse HEAD)` prima del reset + `vm-rollback.sh <sha>` scriptato. Evolutiva: release-dir + `current`→release-N symlink swap atomico (ritieni N-1). Radicale: blue-green / artifact immutabile.

### F-WS-G-9 — Health probe (readyz/login) OSSERVA ma non AGISCE → nessun auto-revert; il build rotto è già LIVE quando la probe gira
- Severità: HIGH | Flag: DOSSIER (→ D-08)
- Evidenza: `vm-deploy.sh:140-147` — su `/readyz` fail solo `echo "... FAILED" >&2`; la probe web `/login` stampa `HTTP $code`. Nessun `exit`/rollback/alert. Il restart (128-133) è già avvenuto → broken build LIVE prima che la probe giri.
- Impatto: robustezza
- Proposta: D-08. Rendere la probe un **gate**: non-2xx → trigger del rollback scriptato a LAST_GOOD + exit non-zero (così CI/align-clones vedono rosso). Si accoppia con F-8.

### F-WS-G-10 — Nessuno snapshot DB pre-deploy → le migration girano senza rete di sicurezza (cross-ref R5: nemmeno un backup schedulato esiste)
- Severità: HIGH | Flag: DOSSIER (→ D-08, accoppia R5)
- Evidenza: `vm-deploy.sh:83-84` esegue `migrate-if-pending.sh` con **nessun** `pg_dump` prima. L'unico pg_dump è `clone-vm-db.sh:33` (stream VM→box dev locale, on-demand, non un backup ritenuto). `grep OnCalendar deploy/systemd` → insights(02:15)+scraping(Sun 03:30), nessuno è un dump DB. Una migration parziale/fallita sul DB prod condiviso non ha restore-point.
- Impatto: robustezza
- Baseline: 0 snapshot pre-deploy + 0 backup schedulato (R5) = **zero restore-point** sull'unico DB prod.
- Proposta: D-08 (couples R5). Conservativa: `pg_dump -Fc` timestamped/ritenuto come **step 0** del deploy (solo se migration pending) + stampa il restore one-liner. **Il singolo hardening più alto-valore/costo dato che il DB è l'asset prod irrimpiazzabile.**

### F-WS-G-11 — Migration forward-only (nessun down/rollback per uno schema-change cattivo)
- Severità: MEDIUM | Flag: DOSSIER (→ D-08)
- Evidenza: `db/scripts/migrate.sh:40-64` applica `*.sql` in ordine lessicale; `grep DROP|down|rollback|revert|undo` → 0; glob `db/migrations/*down*` → 0 file. Una migration che corrompe/locka può solo essere fixata da una nuova migration forward (lenta).
- Proposta: D-08. Accetta forward-only come policy MA rendila sopravvivibile via il pg_dump pre-deploy (F-10) (il "down" pratico = restore dello snapshot); documentalo come scelta cosciente.

### F-WS-G-12 — Recovery da deploy fallito 100% manuale (nessuna procedura scriptata/runbook)
- Severità: MEDIUM | Flag: DOSSIER (→ D-08)
- Evidenza: su failure lo script esce con messaggio (vm-deploy.sh:72-76) o restarta un build rotto e logga la probe. `deploy/README.md` ha una rollback-section SOLO per `align-claude-ecosystem.sh`; nessun runbook app/DB. Lo stato half-deployed (nuovi node_modules/dist/.next + migration forse-applicata + unit restartate) persiste finché un umano interviene.
- Proposta: D-08 — `vm-rollback.sh` + runbook README (trasforma "archeologia manuale" in un comando).

### F-WS-G-13 — `align-clones.sh --auto-deploy` può spedire a PROD senza gate su una deploy-leg fallita (auto-deploy a session-close)
- Severità: MEDIUM | Flag: DOSSIER (→ D-08)
- Evidenza: `align-clones.sh:143-145` ssh→vm-deploy come ultima leg; handoff la chiama `all --delta --resilient --auto-deploy` (`deploy/README.md:69-77`). `--resilient` skippa un host **irraggiungibile**, ma un host **raggiungibile** la cui vm-deploy lascia prod rotto (probe-only, no revert) propaga un prod degradato da una chiusura-sessione automatica. Nessun gate di conferma sulla mutazione prod.
- Proposta: D-08 — eredita probe-as-gate + last-good capture così l'auto-deploy a handoff si auto-reverta / fallisce loud invece di lasciare prod rotto in silenzio.

---

## Gruppo C — Velocity & caching

### F-WS-G-14 — Il runner unico serializza 6-7 workflow per push → la coda domina il wall-clock (costo reale, non compute)
- Severità: HIGH | Flag: DOSSIER (→ D-08, track velocity)
- Evidenza: `gh run view 27448838420 --json jobs`: typecheck JOB compute=76s (install 12s + 4 typecheck ~43s) ma run `createdAt` 23:25:13 → wall **14m00s** = ~12.7m **in coda**. test-integration run 27448838430: compute=386s (vitest 353s), job started 23:31:28 vs created 23:25:13 → ~6m coda. Tutti i 7 self-hosted hanno girato sullo stesso push, uno-alla-volta sul runner unico. Storicamente lo stesso typecheck: 21m44s/14m00s (coda pesante) vs 1m18s (coda vuota).
- Impatto: DX (feedback lento) + robustezza
- Baseline: typecheck 14m wall / 76s compute; test 12m42s wall / 386s compute.
- Proposta: D-08 — un 2° runner (o ephemeral) parallelizza lint/i18n/typecheck/build, collassando i 14m queue-bound a ~76s compute. **Caching e affected-only sono moltiplicatori secondari** e prerequisiti per la portabilità del runner.

### F-WS-G-15 — Zero caching dichiarato sui 6 workflow self-hosted (solo showcase ha `cache: pnpm`) → fa affidamento su stato FS warm implicito
- Severità: MEDIUM | Flag: **QUICK-WIN**
- Evidenza: `grep cache .github/workflows/*` → solo showcase.yml:63 `cache: pnpm`. I 6 self-hosted usano `setup-node@v6` con solo `node-version: 22`, **nessun** `cache:`; nessun `actions/cache` per pnpm-store/.next/tsbuildinfo. typecheck.yml:47 ammette "setup-node usato solo per il path-resolution della pnpm store cache" ma nessun cache-step segue. Install è `--frozen-lockfile --prefer-offline` → si affida al FS persistente (implicito, non portabile a un 2° runner).
- Impatto: footprint + robustezza (cache invisibile/non-riproducibile; un 2° runner ha install cold ~3GB)
- Proposta: **QUICK-WIN** (<1h): `cache: pnpm` + `cache-dependency-path: pnpm-lock.yaml` sui 6 setup-node (già provato in showcase.yml) + `actions/cache` per `apps/web/.next/cache`. **Prerequisito** per il 2° runner di F-14.

### F-WS-G-16 — Vitest fully serial (`maxWorkers:1`, `fileParallelism:false`) — 353s single-thread, by-design (DB condiviso), no shard/affected
- Severità: MEDIUM | Flag: DOSSIER (→ D-08)
- Evidenza: `apps/api/vitest.config.ts:20-22`; `gh run view 27448838430` step vitest = 353s/386s. Comment (16-17): "i test integration condividono un singolo DB pool — serial evita race refresh-rotation". Parallelismo bloccato da design (shared live DB), non oversight. No `--shard`, no affected.
- Proposta: D-08 (track velocity) — schemi DB per-shard isolati per shard paralleli, OR change-affected selection (turbo/nx). Non-triviale, decisione Enzo.

### F-WS-G-17 — Full CI su ogni push, no affected-only (typecheck/lint girano tutti i 4 workspace anche per un cambio 1-riga)
- Severità: MEDIUM | Flag: DOSSIER (→ D-08)
- Evidenza: typecheck.yml:10-19 + lint.yml:7-16 usano solo `paths-ignore` (docs/md/...) → girano su QUALSIASI push di codice; typecheck.yml:56-69 typechecka shared+api+api-test+web+showcase ogni volta. Nessun task-graph monorepo. Solo test-integration/build-web/i18n/showcase/shell-tests hanno `paths:` mirati.
- Proposta: D-08 — task-runner affected-only (turbo/nx) per scoping ai workspace cambiati; taglia compute + pressione-coda. Scelta architetturale → Enzo.

### F-WS-G-18 — playwright-smoke ricostruisce web da zero (`pnpm build`) + reinstalla i browser ogni run (duplica build-web)
- Severità: LOW | Flag: **QUICK-WIN**
- Evidenza: playwright-smoke.yml:113 `pnpm build` + :67 `playwright install --with-deps chromium` (re-download ogni run, no cache); build-web.yml:61 builda già lo stesso `apps/web`. Nessun `actions/cache` per `~/.cache/ms-playwright`.
- Proposta: QUICK-WIN — cache `~/.cache/ms-playwright` per versione + riusa l'artifact di build-web (upload/download-artifact `.next`) invece di ricostruire.

### F-WS-G-19 — `timeout-minutes` bounda il compute non la coda → falso soffitto 10m, latenza reale illimitata sotto contesa
- Severità: LOW | Flag: DOSSIER (→ D-08)
- Evidenza: typecheck.yml:33 `timeout-minutes: 10` ma run con 14m wall (compute 76s). `timeout-minutes` è job-execution-only; i ~12.7m in `queued` non sono bounded e non emettono failure.
- Proposta: D-08 (parte dello SPOF) — un 2° runner rimuove il rischio coda-illimitata; non esiste fix workflow-only.

### F-WS-G-20 — `cancel-in-progress` inconsistente (test/playwright `false`, corretto, ma impila sul runner unico)
- Severità: LOW | Flag: QUICK-WIN (interazione, valore standalone basso)
- Evidenza: `grep cancel-in-progress` → 6/8 `true`; 2 `false` (test-integration.yml:34, playwright-smoke.yml:24). Il `false` su test è corretto (non killare suite DB-mutanti mid-flight) ma con runner unico push back-to-back impilano un 2° run da 386s. Mitigazione netta = 2° runner (D-08).

---

## Gruppo D — Release strategy & branch protection

### F-WS-G-21 — `main` ha 0 required-status-checks e 0 required-PR → CI advisory, mai gating
- Severità: HIGH | Flag: DOSSIER (→ D-08)
- Evidenza: `gh api .../branches/main/protection` → 404 "Branch not protected". Unico ruleset attivo `main-protection-tier1` (`gh api .../rulesets/16506473`) ha SOLO `deletion` + `non_fast_forward` — **nessun** `required_status_checks`, **nessun** `pull_request`. Tutti i workflow triggano su `push: branches:[main]` → CI gira DOPO il commit già su main. Nulla blocca un commit rosso dal sedersi su main.
- Impatto: robustezza
- Proposta: D-08 — `required_status_checks` con i context gating (typecheck/lint/test-integration/build-web/i18n/playwright). **Decisione Enzo**: quali check mandatory vs informativi (il runner unico è anche PROD → check required che hang il runner bloccherebbero tutti i merge — vedi F-2).

### F-WS-G-22 — PROD traccia `origin/main` HEAD, non il tag rilasciato → nessun gate di release tra merge e deploy
- Severità: HIGH | Flag: DOSSIER (→ D-08)
- Evidenza: `vm-deploy.sh:44-46` reset al tip del branch, non a `v1.0.0`/un tag. Con F-21 (no required-checks): un commit pushato direct-to-main (CI post-hoc) può essere deployato dal prossimo `vm-deploy.sh` manuale **prima che la sua CI finisca**. Nessuno staging/canary tra main e PROD (il twin linux-pc è clone isolato, non un gate).
- Proposta: D-08 — deploy da tag/last-good ref, OR gate vm-deploy sul commit con CI verde (`gh run list --commit <sha> --json conclusion`). Pairs F-8.

### F-WS-G-23 — Release 100% manuali (annotated tag + `gh release` a mano) — zero automazione tag/release
- Severità: MEDIUM | Flag: DOSSIER (→ D-08)
- Evidenza: `grep -iE 'tag|release|gh release|softprops|semver' .github/workflows/*` → solo `version: 9.15.0` (pnpm), nessuna release-action. `git cat-file -t v1.0.0` → annotated (Enzo Spenuso). `gh release list` → 6 release manuali. No CHANGELOG generator, no version-bump automation.
- Impatto: DX
- Proposta: D-08 (opzionale) — `release.yml` tag-triggered (build + artifact + notes + deploy gated). Bassa urgenza solo-dev; decisione Enzo sulla cadenza.

### F-WS-G-24 — Semver drift: tutti i package.json a 1.0.0 across 242 commit post-GA (incl. feature + un major bump)
- Severità: MEDIUM | Flag: DOSSIER (→ D-08)
- Evidenza: `git log v1.0.0..main --oneline --no-merges | wc -l` = **242** (0 merge). Tutti i package.json (api/web/showcase/shared/root) a `1.0.0`. I 242 includono feature shipped (mandatory-MFA `5c64f63`, ISTAT/ATECO `0761ca2`) + major bump (vite 6→8 `9c58f0a`).
- Proposta: D-08 — convenzione bump-on-ship (manuale o changesets); minimo, taglia `v1.1.0`/`v1.0.1` per checkpointare i 242 commit di drift.

### F-WS-G-25 — Trunk-based direct-to-main, no PR review su repo pubblico (242 commit / 0 merge dal GA)
- Severità: MEDIUM | Flag: DOSSIER (→ D-08)
- Evidenza: `git log --merges` = 3 su 740 commit (1 sola PR reale #24). Dal v1.0.0: 242 commit, 0 merge → 100% direct-to-main. `visibility: public`. CLAUDE.md codifica "commit locali su main pre-autorizzati; push richiedono ask". No PR-template/CODEOWNERS/review. Modello solo-dev **intenzionale** (R17), ma su repo pubblico senza branch protection ogni push (incl. PAT compromesso) atterra sulla deploy-branch unchecked.
- Impatto: sicurezza
- Proposta: D-08 — frame come trade-off documentato; se mantenuto, compensare con required-checks (F-21) + deploy-gating (F-22) come safety-net che la review assente non è.

### F-WS-G-26 — `defer-major` skip mina il design dei required-checks (test/playwright skippano sulle PR defer-major)
- Severità: LOW | Flag: DOSSIER (→ D-08, design-note)
- Evidenza: test-integration.yml:39 + playwright-smoke.yml:29 `if: !contains(...'defer-major')`. Se questi diventassero required-checks, una PR defer-major non avrebbe un run passante → bloccata per sempre o merge col gate skippato.
- Proposta: D-08 design-detail — `if: always()` con shim neutral/skip-to-success per defer-major, o escludere le PR defer-major dal required-check.

---

## Gruppo E — Supply chain

### F-WS-G-27 — Tutte le GitHub Actions pinnate a tag MOBILI (@v6/@v7/@v4), 0 a commit-SHA → tag-mutation risk su un runner che porta secret prod
- Severità: MEDIUM | Flag: **QUICK-WIN**
- Evidenza: `grep uses: .github/workflows/*` (13 occorrenze, 0 SHA-pinned): checkout@v6 ×8, pnpm/action-setup@v6 ×6, setup-node@v6 ×6, upload-artifact@v7 ×2, **peaceiris/actions-gh-pages@v4** (third-party, rischio più alto). Un tag mobile può essere ri-puntato da un maintainer compromesso a codice malevolo che gira sul runner secret-bearing.
- Impatto: sicurezza
- Proposta: **QUICK-WIN** (~30min, meccanico, zero behavior change): pin a SHA 40-char con commento `# vN` (specie la peaceiris). Dependabot continua a proporre update (dependabot.yml:34 traccia github-actions).

### F-WS-G-28 — Nessun SBOM / dependency-provenance / build-attestation / signed commits
- Severità: MEDIUM | Flag: DOSSIER (→ D-08-adjacent)
- Evidenza: `grep codeql|attest|sbom|trivy|grype|dependency-review .github` → nessuno. `git log -20 --pretty='%G?'` → ogni commit `N` (unsigned); `commit.gpgsign`/`gpg.format` vuoti. Solo provenance = metadata gh-pages (showcase.yml:100-102). `--frozen-lockfile` dà integrity lockfile ma no SBOM/artifact firmato.
- Proposta: D-08-adjacent (decidere se attestation GA-grade è in scope): additive — (a) `anchore/sbom-action`/CycloneDX come artifact CI, (b) `actions/dependency-review-action` su PR, (c) commit-signing opt-in (SSH, low-friction). (a)+(b) highest-value per prodotto proprietario single-maintainer; signing opzionale.

### F-WS-G-29 — CI env-contract drift: 7+ var di `env.ts` assenti da `.env.example` + name-mismatch POSTGRES_DB/POSTGRES_DATABASE (cross-ref R09)
- Severità: MEDIUM | Flag: **QUICK-WIN**
- Evidenza: `env.ts` dichiara con NO entry in `.env.example`: MEDIA_STORAGE_DIR (:98), MFA_ENROLL_CONFIRM (:128), SMS_PROVIDER/SMS_FROM (:135), WEBAUTHN_RP_ID/RP_NAME/ORIGINS (:150-152); COOKIE_SECURE/MATCHING_FREETEXT_ENABLED comment-only. Name-mismatch reale: `env.ts` legge `POSTGRES_DB` ma i workflow leggono `POSTGRES_DATABASE` (test-integration.yml:68) → l'EnvironmentFile deve settare ENTRAMBI (`self-hosted-runners-setup.md:118-119`).
- Impatto: DX (contratto CI conoscibile solo leggendo 3 file)
- Proposta: **QUICK-WIN** (~45min): aggiungi le var (commented default) a `.env.example` + nota SoT `env.ts → .env.example → runner EnvironmentFile` (incl. il dual-set POSTGRES_DB/DATABASE). Lega al dossier più ampio R09/QW-3.

### F-WS-G-30 — `showcase.yml` premessa `link:` stantia → checkout di un repo-fratello esterno + `npm install --legacy-peer-deps` sull'unico deploy pubblico
- Severità: MEDIUM | Flag: DOSSIER (low-risk, verify-build-first)
- Evidenza: showcase.yml:32-35 comment asserisce root package.json = `"@heuresys/ui": "link:../ux-design-shared/ui"` e su quella base checkout di `Spen-Zosky/ux-design-shared` (:42-48) + `npm install --legacy-peer-deps` (:73-75). Ma reale: `grep @heuresys/ui package.json` → `^0.1.5` (npm-published, post-X18). Lavoro dead/misleading + allarga la supply-chain del deploy gh-pages pubblico con un repo extra (peer relaxed).
- Proposta: DOSSIER (verify-first): conferma che `pnpm install --frozen-lockfile` risolve `@heuresys/ui` dal registry senza il checkout-fratello → droppa gli step (:42-48,73-75) + fix comment. Rimuove un repo esterno dall'unico deploy public-facing.

---

## Asset confermati (NON toccare senza dossier)

- **NO auto-deploy-on-push** (`workflows-overview.md:19`): il deploy app è solo manuale-SSH → controllo strutturale che impedisce a R01+R02 di essere un path RCE-to-prod automatico. **Il più importante da preservare.**
- **Secret hygiene**: 0 secret reali nel tracked tree (`git ls-files | grep -iE '\.pem$|\.key$|\.secrets/'` → none), `.gitignore` corretto, 0 secret inlined in YAML (solo GITHUB_TOKEN), EnvironmentFile mode 600 root-owned, LOG_REDACT_PATHS live, PEM via stdin (R10).
- **Hardening deploy già presente**: self-modify-buffer re-exec (vm-deploy.sh:49-58), Node-ABI clean reinstall (64-77), D-17 clean shared build (92-94), frozen-lockfile fail-loud (72-76), migrate-if-pending sha256 ledger (43-55), env-key-merge additivo + backup (.bak-stamp).
- **CI hygiene**: defer-major skip (anti-churn Dependabot), paths-ignore/paths disciplinati, port-collision guards + identity-check S984 (playwright-smoke), VM port-map governato (`deploy/README.md`), action-version + toolchain pinnate (a tag — vedi F-27), `--frozen-lockfile` ovunque, Dependabot ben configurato (weekly grouped, majors deferred).
- **Branch**: force-push + deletion protection ATTIVE (ruleset `main-protection-tier1`), tag annotati semver-clean + 6 GitHub Releases (release-ledger pulito), CI gira su push **e** PR (coverage esiste, basta abilitare required-checks).

---

## Baseline CI (misure reali — aggiorna `BASELINE_METRICS.md`)

| Metrica | Valore reale | Comando |
|---|---|---|
| Workflow totali | 8 (7 self-hosted oci-vm + 1 ubuntu-latest showcase) | `ls .github/workflows` |
| Runner registrati | **1** (oracle-vm-default-runner, online, ARM64) | `gh api .../actions/runners` |
| Typecheck | **14m00s wall / 76s compute** (~12.7m coda) | `gh run view 27448838420 --json jobs` |
| Test-integration | **12m42s wall / 386s compute** (vitest 353s, ~6m coda) | `gh run view 27448838430 --json jobs` |
| Lint / Playwright / Build-web / Showcase | 3m20s / 6m15s / 1m53s / 1m56s wall | `gh run list` |
| Actions SHA-pinned | **0/13** (tutte tag mobili) | `grep uses: .github/workflows/*` |
| `main` ruleset | solo `deletion` + `non_fast_forward`; **0 required-checks** | `gh api .../rulesets/16506473` |
| Commit direct-to-main dal v1.0.0 | **242** (0 merge) | `git log v1.0.0..main --no-merges \| wc -l` |
| Caching dichiarato | 1/8 workflow (solo showcase `cache: pnpm`) | `grep cache .github/workflows/*` |
| `secrets.*` in CI | 1 (GITHUB_TOKEN) — resto via EnvironmentFile on-host | `grep 'secrets\.' .github` |

**Insight chiave**: le durate documentate (14m/12m42s) sono ~80-90% **coda** sul runner unico, non compute. La velocity-leva #1 è un 2° runner.

---

## Roll-up → Dossier D-08 (alta leva; ora **security-priority** non solo robustezza)

Tutti i finding HIGH/CRITICAL + i MEDIUM strutturali confluiscono in **D-08**. Framing per il dossier (S-100X-C), 3 opzioni come da AUDIT_PROTOCOL:

- **Conservativa** (low effort, no nuova infra, additiva): (a) drop `pull_request` dai workflow self-hosted sul repo pubblico + require-approval ALL outside PR [chiude il CRITICAL F-1]; (b) systemd cgroup-slice MemoryMax/CPUQuota sul runner [F-4]; (c) `--ephemeral` runner [F-6]; (d) DB/schema CI separato [F-3]; (e) `LAST_GOOD` sha + `vm-rollback.sh` + `pg_dump` pre-migrate [F-8/9/10/12]; (f) `required_status_checks` sul ruleset esistente [F-21] + deploy-gate su CI-verde [F-22]; (g) SHA-pin actions [F-27]. **Chiude il CRITICAL + il grosso del rischio robustezza in ~1 sessione, low-risk.**
- **Evolutiva**: runner **off-prod** (box/container separato, i 2 gate DB via tunnel a DB non-prod) [F-2/3/4/5/6/7]; release-dir + symlink swap + auto-revert su probe [F-8/9]; affected-only task-runner (turbo/nx) + caching [F-15/17]; SBOM + dependency-review [F-28].
- **Radicale**: GH-hosted + managed-CI a replica DB non-prod (elimina la superficie self-hosted al costo del pnpm-store cold — la ragione storica del self-hosting, ora pesabile contro il CRITICAL); blue-green/immutable-artifact deploy.

**Quick-wins CLASS-A estratti** (eseguibili su go, indipendenti dal dossier): QW-G1 caching pnpm/.next [F-15], QW-G2 SHA-pin actions [F-27], QW-G3 env-contract `.env.example` [F-29], QW-G4 showcase drop sister-repo [F-30], QW-G5 cache ms-playwright + reuse artifact [F-18].

---

*Audit S-100X-A1 — read-only, 5 sub-agent + sintesi main-thread. Nessuna modifica a codice/CI/deploy. Prossimo: S-100X-A2 (WS-H sicurezza & supply-chain) — nota: il CRITICAL F-WS-G-1 e i finding sicurezza qui (F-5/6/25/27/28) vanno riconciliati con WS-H per non duplicare.*
