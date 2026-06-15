# FINDINGS / WS-F — Test & QA (S-100X-A3)

> Audit forense **read-only** del workstream Test & QA. Metodo: fan-out 4 sub-agent read-only (test-inventory & layering · parallelism & isolation · flakiness & determinism · E2E/QA coverage & CI-gating) → sintesi main-thread (AUDIT_PROTOCOL §4). Evidenza: `path:linea` reali + conteggi misurati live (`ls`/`grep`/`wc`) + anchor di durata registrato (`qa_artifacts/x19a_vitest_api.txt`). Nessun file/codice/test/CI modificato. **Riconciliato con WS-G (A1) e WS-H (A2)**: il fork-PR su runner PROD (D-08 MITIGATO S988), il runner-SPOF, il DB-condiviso CI (WS-G F-3), la velocity-coda CI e la vitest-serialità lato-CI (WS-G F-16) NON sono ri-riportati qui; WS-F copre la **struttura della suite** (layering, isolation, determinismo, coverage E2E) e tocca la CI solo per il **gating dei test**. Data: 2026-06-15 (S-100X-A3). Classificazione: `AUDIT_PROTOCOL.md`.

## Headline (cosa cambia rispetto al seed e a WS-G/WS-H)

1. **🟠 HIGH F-WS-F-1 — la CI non gira mai la full E2E suite.** Il solo gate web è `smoke-5-personas.spec.ts` (1 scenario × 5 persone); la suite canonica `pnpm test:e2e:prod` (~200 test / 9.6 min, playwright.prod.config.ts) è referenziata SOLO in `apps/web/package.json` + docs — **0 reference nei workflow** (verificato: `grep -rl test:e2e:prod .github` = 0). ~46 spec (analytics, insights, content CRUD, MFA UI 2-step, session-refresh, RBAC matrix, **a11y census incl. mobile serious/critical gate**, i18n EN, me-pages, admin liste/tab/pipeline, visualization) **non gating** su push/PR.
2. **🟠 HIGH F-WS-F-2 — zero unit-layer per la business-logic dei moduli.** 104/134 file API bootano un Fastify reale via `buildTestApp()` e colpiscono il DB live OCI via tunnel; `grep vi.mock(pg|pool|db/client|repository)` = **0** (verificato). I 12 file unit reali (122/~920 case) coprono solo helper puri (transform-compiler, upsert-sql coercion, connector, trust-proxy, mailer) — **0 service/repository di modulo isolato**. La authz scope/visibility è coperta solo via integration→tunnel.
3. **La serialità single-worker NON è premature pessimization**: regge su 3 barriere reali (refresh-family single-use, RBAC cache process-global, righe RTL_BANK condivise da 96/134 file). Il wall è **network-bound (tunnel RTT + Argon2 login), non CPU** → il guadagno più economico è sui constant-factor (Argon2-in-test + login-per-file), non sul parallelismo.
4. **L'isolamento è "by discipline", non "by transaction"**: 0 BEGIN/ROLLBACK per-test su 134 file che condividono un pool live; la correttezza dipende da cleanup manuali id/prefix-scoped, molti `try{}catch{/* ignore */}` → classe **residue-leak** non monitorata centralmente.
5. **Asset forti confermati**: 73/73 moduli con test dedicato (supera il documentato 60/60), 0 hard-`.skip`, 0 mock del pool, determinismo API ~totale (1 setTimeout deliberato, 0 Math.random nei body), D-23/D-24/D-25/D-29 tutti **RISOLTI e verificati in codice** (non re-riportati come aperti).

---

## Gruppo A — Layering & DB-coupling della suite (struttura)

### F-WS-F-1 — La CI gera solo uno smoke a 5 scenari; la full prod E2E suite (~200 test) non gira MAI in CI
- Severità: **HIGH** | Flag: DOSSIER
- Evidenza: `.github/workflows/playwright-smoke.yml` esegue `playwright test smoke-5-personas.spec.ts` (1 scenario × 5 persone = login + nav + 2 pagine extra). La suite canonica `pnpm test:e2e:prod` (`playwright.prod.config.ts`, ~200 passed / 9.6 min per DEBT_REGISTER D-24/S985) è citata SOLO in `apps/web/package.json:13` + docs → `grep -rlE 'test:e2e:prod|playwright.prod.config' .github/` = **0** (verificato), nessuno `schedule:`/`cron:` (solo `dependabot.yml` ha `schedule:`). I 47 spec file totali, ~46 non-smoke (analytics ×8, insights ×3, content-workflow CRUD, MFA UI 2-step, session-refresh, RBAC matrix, a11y census desktop+mobile, i18n EN, me-pages, admin liste/tab/pipeline, visualization) **non gating** su push/PR.
- Impatto: robustezza (la rete di regressione E2E che la dottrina LIVE-DATA-E2E impone esiste ma non difende main) + DX (regressioni viste solo da una run manuale)
- Baseline: full E2E prod = ~9.6 min (S985), ben sotto il timeout 30 min; CI gira solo 1/47 spec.
- Proposta: DOSSIER (couples WS-G D-08 velocity + runner-SPOF). Job CI `pnpm --filter @heuresys/web test:e2e:prod` su `schedule:` nightly + `workflow_dispatch` (ideale pre-merge a main), riusando i port-guard/identity-check di playwright-smoke (S984) + il `concurrency` non-cancel per non clobberare il PROD live sullo stesso host. Gate-merge o almeno alert su rosso notturno.

### F-WS-F-2 — Nessun unit-layer per la business-logic dei moduli — repository/service/route testati solo via integration su DB live
- Severità: **HIGH** | Flag: DOSSIER
- Evidenza: `apps/api/test`: 104/134 file bootano un Fastify reale via `buildTestApp()` (`apps/api/test/helpers/build-test-app.ts`) e colpiscono il Postgres OCI via tunnel SSH; `grep -rE 'vi\.mock\(.*(pg|pool|db/client|repository))' apps/api/test/` = **0** (verificato). I soli 12 file unit reali (122/~920 case) coprono funzioni helper pure (transform-compiler 64, upsert-sql coercion 23+4, istat-ateco 7, esco 6, smtp-mailer 6, transform cast/lookup 5+5, trust-proxy 4, rbac-cache-boot-retry 3, semantic-matching-backfill 3, mfa-fixture-parity 2) — **nessun** service/repository di modulo in isolamento. CLAUDE.md conferma "no separate unit/integration split; all integration-level".
- Impatto: robustezza (regressioni di authz scope/visibility in `service.ts` catturabili solo col tunnel su) + velocity (no fast-feedback offline)
- Baseline: ratio integration:unit ≈ 814:122 (~6.7:1); 0 file testa l'autorizzazione di un modulo senza DB.
- Proposta: DOSSIER. Accettare l'architettura integration-only come scelta deliberata MA introdurre un thin unit-layer sulla logica a più alto rischio (autorizzazione scope/visibility nei `service.ts`, error-mapping) con un seam repository in-memory/stubbed, così le regressioni authz si catturano senza tunnel. Se la postura integration-only resta intenzionale, documentarla esplicitamente nel DEBT_REGISTER.

### F-WS-F-3 — L'intera API suite è hard-coupled al DB live OCI via tunnel SSH — nessun path di run offline/CI-isolato
- Severità: **HIGH** | Flag: DOSSIER (couples WS-G F-3 DB-condiviso CI)
- Evidenza: `vitest.config.ts` `setupFiles=./test/helpers/setup.ts` carica il `.env` repo-root (POSTGRES_* / tunnel :5433); ~820 case richiedono il tunnel su. Nessun profilo test usa un Postgres locale/effimero o un pool mockato (`grep vi.mock` = 0). Config forza `maxWorkers:1`/`minWorkers:1` + `fileParallelism:false` (serial, verificato linee 20-23) per evitare race di refresh-rotation → la full suite non può parallelizzare; un singolo pool remoto condiviso gata throughput **e** disponibilità ("the SSH tunnel must be up", CLAUDE.md).
- Impatto: robustezza (failure-mode "tunnel giù" = suite intera rossa) + velocity (collo di bottiglia single-connection)
- Baseline: 0 path di run hermetico; 100% query pagano 1 tunnel RTT.
- Proposta: DOSSIER (couples WS-G D-08 + WS-C backup/restore). Opzione DB hermetico (PG 16 nativo Dockerless per ADR-0004/I13, selezionabile via env) così la suite gira senza il tunnel PROD; rimuove anche il bottleneck serial-single-worker e il failure-mode "tunnel su" segnalato in CLAUDE.md.

---

## Gruppo B — Parallelism, isolation & lifecycle del pool

### F-WS-F-4 — Vitest single-worker è la SPOF del tempo-suite: ~90s oggi, cresce lineare coi moduli e la MFA-flip ha già ~raddoppiato il costo per-login
- Severità: **MEDIUM** | Flag: **QUICK-WIN** (constant-factor) / DOSSIER (parallelismo)
- Evidenza: `vitest.config.ts:20-23` (pool=threads, fileParallelism=false, maxWorkers=1, minWorkers=1) forza esecuzione strettamente seriale. Anchor REALE registrato `qa_artifacts/x19a_vitest_api.txt` riga "Duration **86.53s**" su 342 test / 50 file (verificato; transform 7.51s / setup 1.37s / import 102.80s / tests 133.81s = cumulativi-per-thread che overlappano sull'unico thread → 86.53s è il vero wall). Quella run **PRECEDE** la mandatory-MFA flip (S983/S989). La suite ora è ~920 it() su 134 file: estrapolazione lineare al vecchio costo ≈ 86.53s × (920/342) ≈ **233s (~3.9 min)**, MA ogni login è diventato una macchina-a-stati a 2 richieste post-MFA (`login.ts` loginRaw) + Argon2id 64MiB/3/4 (`password.ts`) + TOTP step-2 + tunnel RTT × 455 login → il wall reale corrente è materialmente sopra la cifra lineare. CI gate `test-integration.yml` `timeout-minutes:15`: comodo ora, ma l'headroom è interamente consumato dalla serializzazione.
- Impatto: velocity/DX (feedback lento) + robustezza (headroom CI non parallelo)
- Baseline: **anchor x19a stale/pre-MFA = 86.53s wall / 342 test / 50 file**; il vero wall post-MFA non è ancora registrato in SoT.
- Proposta: **QUICK-WIN** — abbassare il costo Argon2id **solo per l'env TEST** (es. memoryCost 8MiB/timeCost 1 dietro `NODE_ENV==='test'` in `password.ts`): 455 login × ~150ms ≈ 60-70s di wall risparmiati a **zero rischio isolamento** (i parametri di costo sono una knob di sicurezza runtime, non asseriti dai test). Inoltre registrare il vero wall post-MFA in SoT dopo la prossima full run (l'unico anchor, x19a, è stale). Il parallelismo vero è DOSSIER (→ F-WS-F-7).

### F-WS-F-5 — Singleton pool + `closePool()` per-file è safe solo per accidente di `isolate=true`; un futuro `isolate:false` romperebbe la suite
- Severità: **LOW** | Flag: **QUICK-WIN**
- Evidenza: `src/db/client.ts` esporta `pool` come const module-level creato una volta; `closePool()` chiama `pool.end()` che lo termina permanentemente (nessun path di ricreazione). **81/134** file test chiamano `closePool()` in afterAll (verificato `grep -lE 'closePool\(' apps/api/test/*.test.ts | wc -l` = 81). Con `fileParallelism:false` il 2° file girerebbe contro un pool morto — funziona SOLO perché `isolate` è unset (default Vitest = true) e ogni file ottiene un module-graph fresco → un `pool` fresco. Se qualcuno setta `isolate:false` (tweak comune "speed up vitest"), ogni file dopo il primo throwerebbe "Cannot use a pool after calling end". Nessun `globalSetup`/`globalTeardown` definito (`grep` in vitest.config = vuoto) → il pattern closePool-per-file è anche ridondante col teardown di isolate.
- Impatto: robustezza (fragilità latente a una tweak di config "innocua")
- Proposta: **QUICK-WIN** (<1h) — rendere l'invariante esplicito e robusto: (a) commento in `vitest.config.ts` + `client.ts` che `isolate` DEVE restare true per il contratto `pool.end()` per-file; O (b) spostare il teardown del pool in un singolo `globalTeardown` e droppare gli 81 `closePool()` per-file, così il lifecycle non dipende dal default di isolate.

### F-WS-F-6 — Classe root-cause: la suite integration NON ha transaction-isolation — la correttezza dipende interamente dalla cleanup-discipline manuale su 134 file che condividono un pool live
- Severità: **MEDIUM** | Flag: DOSSIER
- Evidenza: `vitest.config.ts:20-23` un pool singleton seriale; **0** BEGIN/ROLLBACK per-test (grep dir test: 0 ROLLBACK, 0 `withTransaction` nei test — l'helper `withTransaction` di `repository.ts` wrappa il pool di produzione, non i test). ~70 file mutanti si affidano a afterEach/afterAll DELETE scritti a mano (molti in `try{}catch{/* ignore */}`). Un test che throwa tra insert e cleanup-swallowed lascia una riga nel DB OCI live; la run successiva con assert count/list (es. mfa-policy rows≥2, content empty-corpus, insights idempotency D-18) può driftare. La serializzazione rimuove la sottoclasse concurrency-race ma NON la sottoclasse leaked-residue.
- Impatto: robustezza (drift silenzioso su DB condiviso con PROD — couples WS-G F-3)
- Baseline: 0 transaction-isolation; isolamento = solo cleanup id/prefix-scoped + serialità.
- Proposta: DOSSIER (strategico, non urgente — la suite è verde e serial). Opzioni: (a) transaction-per-test (BEGIN in beforeEach su client dedicato, ROLLBACK in afterEach) per i moduli mutanti — elimina leak-on-throw; (b) spostare ogni cleanup in afterEach (non afterAll) così un throw mid-file pulisce i test precedenti; (c) drift-assertion post-suite in CI (`SELECT count(*) ... WHERE name LIKE 'E2E%'` == 0 sulle tabelle test-prefix note). Authority = Enzo (i file auth HOT-path sono sensibili).

### F-WS-F-7 — DOSSIER: percorsi di parallelizzazione e il loro costo di isolamento (per-worker tenant vs transaction-per-test vs leave-serial)
- Severità: **MEDIUM** | Flag: DOSSIER
- Evidenza (vincoli misurati): 0 mock (DB live), tunnel RTT per query, pg pool max=20 ma 1 sola conn usata a workers=1, 96/134 file su RTL_BANK condiviso, refresh-family single-use (`repository.ts:278-289`), nessun `SET search_path`/schema-per-test oggi (grep vuoto), RBAC cache process-global, `withTransaction` esiste (`repository.ts:542-557`) ma wrappa il pool prod, non i test. Il wall è dominato da **RTT serializzato + Argon2 login, NON CPU** → anche un parallelismo modesto (N=4) quartizzerebbe la parte network-bound.
  - **OPZIONE A — per-worker tenant + per-worker persona** (raccomandata se si parallelizza): ogni worker Vitest ha il suo tenant seedato + la sua refresh-family (persona parametrizzata da `VITEST_WORKER_ID`). Pro: rimuove le barriere (1)+(3), speedup ~lineare col pool a 20 conn. Contro: serve N tenant/persona pre-seedati (estensione `seed-test-admin.ts`), pool-sizing per-worker (`pg max≈ceil(20/N)`), i test cross-tenant LIST (visibility global+tenant) vanno pinnati a un gruppo serial dedicato.
  - **OPZIONE B — transaction-per-test rollback**: BEGIN/ROLLBACK su una conn condivisa. Pro: isolamento perfetto, no seed-proliferation. Contro: **INCOMPATIBILE** con la suite as-written — `buildTestApp` boota un Fastify reale che acquisisce le PROPRIE conn dal pool, quindi il BEGIN del test su conn X è invisibile alla conn Y della request; richiederebbe iniettare un singolo client pinnato nell'app (refactor grosso) e rompe ogni code-path che apre una propria transazione (BEGIN annidato). Resta comunque serial (1 conn).
  - **OPZIONE C — leave serial, attacca i constant-factor**: Argon2-in-test (F-WS-F-4) + riuso di un login per-file invece che per-test (455 login → ~134) — zero rischio isolamento, recupera la gran parte del wall senza toccare il parallelismo.
- Risk register: A = effort medio / regression-risk medio (seed + worker-plumbing, ma i test cross-tenant sono un set finito noto) / mitigato da un pool serial per le visibility-spec; B = effort alto / risk alto / NON raccomandata data l'architettura Fastify-per-test; C = effort basso / risk **LOW** / raccomandata per prima.
- Proposta: DOSSIER — sequenza: (1) ship OPZIONE C (Argon2 test-only + login-per-file) e ri-misura il vero wall post-MFA — potrebbe rendere il parallelismo non necessario; (2) solo se il wall eccede ancora il budget, OPZIONE A (per-worker tenant+persona, maxWorkers=4, pg max scalato, sub-gruppo serial per le visibility-spec); (3) NON perseguire OPZIONE B salvo refactor di buildTestApp per un client pinnato.

### F-WS-F-8 — ASSET: la serialità è load-bearing su 3 barriere d'isolamento reali (non pessimismo prematuro)
- Severità: INFO | Flag: ASSET
- Evidenza: (1) refresh-token single-use con family-wide replay-revoke (`repository.ts:261-289`): 2 worker che riusano la stessa refresh-family triggererebbero `REFRESH_REPLAY_DETECTED` e revocherebbero la family mid-suite (esatto failure-mode documentato per Playwright in `playwright.prod.config.ts:5-12`). (2) RBAC cache process-global (`cache-loader.ts` → singleton; `build-test-app.ts:28-34` la carica una volta per file via cacheLoadedOnce; fine per-file perché isolate=true, ma stato mutabile globale). (3) collisioni dati shared-tenant: 96/134 file operano sulle stesse righe RTL_BANK con 0 mock → create/list concorrenti vedrebbero le scritture reciproche. Il commento `vitest.config.ts:16-17` ("serial avoids refresh-rotation race") è accurato ma sottostima le barriere (2) e (3).
- Proposta: **NESSUNA azione** — documentare le 3 barriere così un futuro contributor non flippa naïvemente `maxWorkers>1` finendo su `REFRESH_REPLAY_DETECTED` non-deterministico + flake di list cross-tenant. (Couples F-WS-F-7 Opzione A.)

---

## Gruppo C — Flakiness & determinismo

### F-WS-F-9 — Sibling-exposure: cleanup `try/catch`-swallowed nascondono i fallimenti di cleanup → accumulo silenzioso di residui (classe D-18/D-29, non monitorata centralmente)
- Severità: **LOW** | Flag: **QUICK-WIN**
- Evidenza: decine di cleanup usano `try { await pool.query('DELETE ...') } catch { /* ignore */ }` (es. `seed-acquisition.integration.test.ts:45-47`, `mentorship.integration.test.ts:34`, `learning-paths.integration.test.ts:38`, `visualization-*.integration.test.ts`). Una FK-violation o errore transiente durante il cleanup è swallowed → la riga resta. È lo stesso meccanismo che ha prodotto D-18 (crescita score-table insights) e D-29 (drift cert E2E), entrambi fixati point-wise, ma il pattern swallow generico è scoperto: nulla fallisce/avvisa quando un cleanup no-op silenziosamente.
- Impatto: robustezza (drift accumulato invisibile finché un count-assert non flaka)
- Proposta: **QUICK-WIN** (low-cost) — cambiare i blocchi swallow in `console.warn('cleanup failed', e)` invece di puro `/* ignore */`, così i residui accumulati emergono nei log CI; pairare con il drift-count post-suite di F-WS-F-6(c). Zero behavior-change sul green-path.

### F-WS-F-10 — TOTP 30s-boundary MITIGATO (server ±30s window) ma la suite genera codici fresh per login senza guard di confine
- Severità: LOW | Flag: NOTE
- Evidenza: `fixtures.ts:18-27` + `helpers/login.ts:39-50` generano un TOTP a call-time (period:30); con mandatory-MFA live la suite fa centinaia di login 2-step (`setup.ts:22` alza il rate-limit a 10000 proprio per questo). Un codice coniato al secondo 29.x e validato al 30.x attraversa un confine di periodo — assorbito dal `window:1` del server (`mfa-service.ts:53,144` = ±30s). Il round-trip flake è coperto; non c'è guard client-side "evita di generare vicino al confine", che conterebbe solo se la tolerance fosse mai ridotta a 0.
- Proposta: **NESSUNA azione ora**. Se `TOTP_WINDOW` venisse ridotto (security tightening), aggiungere un retry boundary-aware in `totpFor` (rigenera se entro ~2s da un period-rollover).

### F-WS-F-11 — Playwright `retries:1` universale maschera flake reali single-shot by-design (accettabile per dev-jitter, flaggato)
- Severità: INFO | Flag: NOTE
- Evidenza: `playwright.config.ts:29` (retries:1, verificato) + 17 spec lo re-settano ridondantemente. Razionale documentato (dev-mode compile-on-demand + hydration-race jitter, `a11y.spec.ts:20`). La full prod run S985 riportò "200 passed / 1 flaky-retry-green" — un test passato solo al retry, che retries:1 ha assorbito silenziosamente. Un test genuinamente flaky (non-jitter) resterebbe nascosto dietro il retry — e il prod-build NON ha compile-on-demand jitter, quindi un flaky-retry **lì** punta a un gap di determinismo reale (es. residue F-WS-F-6 o un auto-wait mancante), non a cold-compile.
- Proposta: **NESSUNA azione** — tenere retries:1 (giustificato per dev-jitter) ma trattare ogni riga "flaky" nel report prod-run come segnale da investigare, non come pass.

### F-WS-F-12 — ASSET: determinismo API ~totale + mutating-state sempre con cleanup scoped (0 reset blanket)
- Severità: INFO | Flag: ASSET
- Evidenza: lato API non-determinismo ~ZERO — 1 `setTimeout(resolve, 30)` deliberato (`auth.integration.test.ts:635`, timing rate-window) + 1 `toISOString()` equality (`reference-sync.integration.test.ts:334`, snapshot-diff non clock-read); 0 Math.random, 0 crypto.randomUUID nei body. Lato web 9 spec usano `Date.now()` solo come suffisso d'unicità (non input d'assert); 4 `waitForTimeout` sono settle-wait bounded, non sleep arbitrari. **0** mutating-state senza snapshot-restore: ~70 file mutano poi puliscono targeted-by-id/LIKE-prefix; **0** `DELETE FROM <table>` senza WHERE. I 3 siti config-touching (mfa-policy, auth-mfa-mandatory, login-mfa-enrollment) snapshot-restore la riga esatta pre-test (verificato `mfa-policy-admin.spec.ts:31-78`); MFA-factor wipe label-guarded (`mfa.integration.test.ts:41-47`); reference-sync ripristina la ESCO watermark.
- Proposta: **NESSUNA azione** — quando si aggiunge un test che tocca config persistente, richiedere beforeAll-snapshot + afterAll/finally exact-restore, mai disable/delete blanket.

---

## Gruppo D — E2E/QA coverage & CI gating

### F-WS-F-13 — Il gate mobile-a11y (serious/critical, ~42 scan) gira solo in locale — non in CI
- Severità: **MEDIUM** | Flag: DOSSIER
- Evidenza: `a11y.spec.ts` impone critical=0 (riga 154) AND serious=0 (riga 167) su desktop + Pixel 7 (`playwright.prod.config.ts:55-65` progetti mobile-a11y + a11y-desktop). D-27 (DEBT_REGISTER) mostra **2 violazioni serious mobili REALI** (scrollable-region-focusable su /kpis + /me/certifications) sfuggite a PROD, catturate solo da una full-run manuale S988; l'anti-vacuity guard (`a11y.spec.ts:88-89`) che le espose fu aggiunto reattivamente. Poiché i progetti a11y vivono solo in `playwright.prod.config.ts` e quel config NON è in CI (couples F-WS-F-1), ogni regressione a11y dipende da una run manuale.
- Impatto: robustezza/UX (a11y gate esiste ma non difende)
- Proposta: DOSSIER — includere mobile-a11y + a11y-desktop nel job full-suite proposto (F-WS-F-1). Se la full-suite-in-CI è deferita, un workflow a11y dedicato leggero che gira solo quei 2 progetti (axe scan = 2-6s/route, ~42 route).

### F-WS-F-14 — Coverage read-only: le pagine analytics & insights asseriscono il render, non la correttezza-dato né la mutazione
- Severità: **MEDIUM** | Flag: DOSSIER
- Evidenza: grep per chiamate di mutazione (`.post/.patch/.delete` + submit/save testid) colpisce 19 file; gli 8 `analytics-*.spec.ts` + 3 `insights*.spec.ts` hanno 1 test() ciascuno e ZERO match di mutazione — sono assert render/no-crash (cfr pattern `admin-lists.spec.ts:18-31`: testid visibile + row-count ≥ 5, non integrità field-level). I CRUD round-trip reali esistono solo in `content-workflow.spec.ts` (create→submit-review→publish→read→unpublish→delete), `me-preferences.spec.ts` (PATCH+reload server-SoT), `login-mfa*.spec.ts` (enroll/verify/delete) e `ess-certifications-upload.spec.ts`. Nessuno spec muta users, positions, skills, KPIs, learning, compensation o struttura org via UI.
- Impatto: UX/robustezza (la dottrina LIVE-DATA-E2E impone mutazioni verificate via re-fetch come gate di page-completion)
- Proposta: DOSSIER — almeno un create/edit/delete (o edit+revert) E2E per dominio admin maggiore (users, positions, skills, KPIs) con verifica via re-fetch, sul pattern `content-workflow.spec.ts`. Priorità sotto F-WS-F-1.

### F-WS-F-15 — Coverage showcase E2E condizionale e skippata in PROD/full-suite by-default
- Severità: **LOW** | Flag: **QUICK-WIN**
- Evidenza: `playwright.prod.config.ts:78-86` `testIgnore` droppa showcase-a11y.spec.ts e showcase-smoke.spec.ts salvo `NEXT_PUBLIC_ENABLE_SHOWCASE=1` baked a build **e** run time; il prod-build spedisce showcase off (layout gate) → gli spec showcase a11y/smoke non girano nella full-suite canonica. `showcase.yml` CI builda+deploya solo lo static export, **0** Playwright/axe. Quindi il brand site non ha gate a11y/smoke automatico in nessun path CI (cross-ref WS-G F-30/asset showcase).
- Impatto: robustezza (l'unico deploy pubblico non ha gate a11y/smoke)
- Proposta: **QUICK-WIN** — girare il progetto `chromium-anonymous` (no DB/auth/tunnel) in `showcase.yml` post-build, o nel job nightly full-suite col flag set. Non serve tunnel → gira sul runner GitHub-hosted.

### F-WS-F-16 — User-journey non testati: logout UI, WebAuthn full-flow, concurrent-session revoke, i18n EN profondo
- Severità: **LOW** | Flag: **QUICK-WIN**
- Evidenza: `auth.spec.ts` copre login (200/401) + redirect middleware su no-session, ma nessuno spec esercita un logout UI esplicito → cookie-clear → /login. `webauthn.spec.ts` ha 1 test() (solo surface passkey). `me-sessions.spec.ts` ha 1 test() (lista sessioni). `i18n-en.spec.ts` asserisce solo 6 stringhe-chrome rappresentative su 6 pagine + `<html lang>` (i18n:check garantisce key-parity ma non che ogni pagina renderizzi EN). Nessun E2E per refresh-replay revocation dalla UI (`session-refresh.spec.ts` prova solo l'happy single-flight path; il replay/family-revoke negativo è coperto solo a livello vitest API).
- Impatto: UX/robustezza (gap di copertura su flussi auth significativi)
- Proposta: **QUICK-WIN** — spec piccoli: (a) logout UI pulisce cookie + bounce a /login; (b) un assert negativo di refresh-replay a livello E2E se fattibile. Backlog dopo F-WS-F-1/F-14.

### F-WS-F-17 — 6 test env-gated sono default-skipped (zero-coverage silente se il flag non è settato)
- Severità: **LOW** | Flag: NOTE
- Evidenza: `wave1-idempotency.test.ts` + `wave1-debug-scale-v4.test.ts` usano `it.skipIf(!RUN_IDEMPOTENCY)`/`it.skipIf(!RUN_DEBUG_V4)` — 6 case (verificato `grep it.skipIf|runIf` = 6; hard `.skip` = 0) che non girano in un `pnpm test` normale. Sono invarianti di brownfield-import (idempotency/debug-scale del wave-executor).
- Impatto: robustezza (invarianti import effettivamente non testate nella run di default)
- Proposta: NOTE — confermare che le assertion idempotency/debug-scale girino da qualche parte in CI (job schedulato con `RUN_*` set); altrimenti notare il gating nel DEBT_REGISTER così non vengono scambiate per copertura live.

### F-WS-F-18 — Lo smoke gira in PROD-build in CI (corretto) ma il singolo host PROD condiviso impone port/identity-guard a ogni job E2E aggiunto
- Severità: INFO | Flag: NOTE
- Evidenza: `playwright-smoke.yml:117-121` fa `pnpm build` poi `next start` (prod) — coerente con la dottrina "verify in PROD build not dev". Buono. Ma il job setta `AUTH_LOGIN_RATELIMIT_MAX=200` e `PLAYWRIGHT_WEB_PORT=3187` con port-guard espliciti su processi estranei (linee 88-92, 112-116) dopo l'incidente S984 (health-check sull'app sbagliata) — segno che il singolo runner self-hosted PROD-host è ambiente condiviso/conteso (couples WS-G F-2/F-4).
- Proposta: NOTE per l'implementazione di F-WS-F-1 — il nuovo job full-suite deve ereditare gli stessi port/identity-guard + rate-limit override + il `concurrency` non-cancel per non clobberare l'app PROD live sullo stesso host.

### F-WS-F-19 — Doc-count della suite stale (~918 case / ~82 file / 60 moduli)
- Severità: **LOW** | Flag: **QUICK-WIN**
- Evidenza: CLAUDE.md / SOT_STATE dichiarano "~918 case / ~82 file, 60/60 moduli". Misurato (verificato): **134** `*.test.ts` file, **~920** case, **73** module-dir tutte con test dedicato (**73/73**). Le cifre 82-file / 60-moduli precedono le aggiunte visualization-*, mfa, me-*, reconciliation-*, seed-* e connector. (Cross-ref WS-H baseline-stale RBAC "8 ruoli/394".)
- Impatto: DX (doc drift)
- Proposta: **QUICK-WIN** — rinfrescare i count in CLAUDE.md / `docs/kb/SOT_STATE.md` a **134 file / ~920 case / 73 moduli** (la skill `handoff` ri-deriva i count; assicurare che copra anche i file non-integration).

---

## Asset confermati (NON regredire senza dossier)

- **Module-to-test coverage completa 73/73** (verificato): ogni `src/modules/*/` (incl. visualization-* family, me-*, mfa-policy, engagement-feedback, teams, tenants, analytics, observability) ha un `*.integration.test.ts` dedicato; moduli-senza-test = 0 → **supera** il documentato 60/60. Web aggiunge 47 spec Playwright / ~96 case (login-real-persona E2E per la dottrina LIVE-DATA-E2E). Mantenere lo step-6 del 7-step module-pattern (test file obbligatorio) enforced.
- **0 mock del pool/repository** (verificato `grep vi.mock(pg|pool|db/client|repository)` = 0) + **0 hard-`.skip`**: ogni test colpisce dati reali, coerente con la dottrina LIVE-DATA-E2E.
- **Determinismo**: API ~totale (1 setTimeout deliberato, 1 toISOString-snapshot, 0 Math.random/randomUUID nei body); web `Date.now()` solo come suffisso d'unicità, `waitForTimeout` solo settle bounded.
- **Cleanup discipline**: 0 `DELETE FROM <table>` senza WHERE; cleanup id/prefix-scoped; config-persistente con snapshot-restore esatto (mfa-policy, watermark ESCO, i18n locale).
- **D-23/D-24/D-25/D-29 RISOLTI e VERIFICATI in codice — NON re-riportati come aperti**:
  - **D-24** (full-suite prod-config chain + mid-suite re-login): `playwright.prod.config.ts:48-99` chain setup → mobile-a11y + a11y-desktop → setup-refresh → chromium; `webServer` `next start` `reuseExistingServer:false` (verificato linea 104). ✅ S985 (200 passed / 9.6 min sotto il ceiling 15-min hrx_access). *Tenere la full-run canonica su `pnpm test:e2e:prod`, mai via dev-config.*
  - **D-23** (config-test snapshot-restore esatto): `mfa-policy-admin.spec.ts:31-39` snapshotta la policy HS live e ripristina in finally (73-80); MFA-factor cleanup label-guarded (`mfa.integration.test.ts:44-47` esclude la label e2e-fixture); 0 `DELETE FROM` unscoped. ✅
  - **D-25** (i18n locale restore crash-resilient + self-healing 3-layer): `i18n-en.spec.ts:52` normalizza 'en'→'it'; `setServerLocale` non-nullable (29, chiude {locale:null}→400); afterAll throw LOUD con recovery-SQL (60-68); `auth.setup.ts:48-61` PATCH locale='it' per ogni persona pre-run. ✅ S985 (crash-sim ×2).
  - **D-29** (globalTeardown psql-delete cert E2E + anti-vacuity dead-session guard): `global-teardown.ts:43` cancella `sys.sys_user_certifications WHERE user_certification_name LIKE 'E2E Test Cert%'` (best-effort, password da ~/.pgpass mai letta/loggata — secret hygiene), wired a `playwright.config.ts:24` + ereditato in prod; anti-vacuity guard `a11y.spec.ts:88-89` (`expect(audited).toBe(route)`) fallisce loud su dead-session /login redirect (preveniva i 97 a11y-pass vacui pre-S984). ✅

---

## Baseline Test & QA (misure reali — aggiorna `BASELINE_METRICS.md`)

| Metrica | Valore reale | Comando |
|---|---|---|
| File test API | **134** `*.test.ts` (116 `*.integration.test.ts` + 18 non-integration) | `ls apps/api/test/*.test.ts \| wc -l` |
| Case API (it/test) | **~920** (914 plain + 6 env-gated `it.skipIf` + qualche `test.each`) | `grep -hcE '^\s*(it\|test)\(' ... \| awk` |
| Hard-skip (`.skip`) | **0** · env-gated default-skip | **6** | `grep '(it\|test\|describe)\.skip'` = 0 ; `grep 'it.skipIf'` = 6 |
| Layer split | 12 file / 122 case TRUE-unit · 104 file boot Fastify reale · ratio integration:unit **≈ 6.7:1** | grep `buildTestApp` / unit-file inventory |
| Mock del pool | **0** (`vi.mock(pg\|pool\|db/client\|repository)` = none) | `grep -rE 'vi\.mock\(.*(pg\|pool...)'` |
| Module coverage | **73/73** module-dir con test dedicato (0 senza) | `ls -d src/modules/*/ \| wc -l` = 73 |
| Worker model API | `pool=threads, fileParallelism=false, maxWorkers=1, minWorkers=1` (strettamente seriale, 1 query in-flight) | `vitest.config.ts:20-23` |
| Vitest wall (anchor) | **86.53s / 342 test / 50 file** — **stale/pre-MFA** (estrap. ~233s lineare; reale > per la 2-step MFA) | `qa_artifacts/x19a_vitest_api.txt` |
| `closePool()` per-file | **81/134** file (safe solo per `isolate=true`; 0 globalTeardown) | `grep -lE 'closePool\(' \| wc -l` = 81 |
| Spec web E2E | **47** `*.spec.ts` / ~96 case Playwright | `ls apps/web/tests/e2e/*.spec.ts \| wc -l` = 47 |
| Worker model web | `workers=1, fullyParallel=false, retries=1`; prod `reuseExistingServer=false` | `playwright.config.ts:25,29,30` |
| Full E2E in CI | **NO** (`grep -rl test:e2e:prod\|playwright.prod.config .github` = 0; solo `smoke-5-personas.spec.ts`) | `grep -rlE ... .github/` = 0 |
| a11y gate | critical=0 AND serious=0 (desktop + Pixel 7) — **solo locale, non in CI** | `a11y.spec.ts:154,167` |

**Insight chiave**: la suite è **integration-only su DB live (0 unit-layer di modulo, 0 mock)**, seriale per 3 barriere d'isolamento reali, e **network-bound** (tunnel RTT + Argon2 login) non CPU. Le 2 leve a maggior impatto sono (1) **gating CI della full E2E** (oggi gira 1/47 spec) e (2) **constant-factor sul wall** (Argon2-test-only + login-per-file) prima di qualsiasi parallelismo.

---

## Roll-up → candidati (decide Enzo per-finding; questo è un audit, non un fix)

**Dossier (richiedono decisione Enzo):**
- D — **full E2E suite in CI** (nightly + workflow_dispatch + a11y desktop/mobile) [F-WS-F-1 + F-WS-F-13] — couples WS-G D-08 (velocity/runner-SPOF).
- D — **thin unit-layer** per authz scope/visibility + error-mapping (seam repository stubbed) [F-WS-F-2].
- D — **opzione DB hermetico** (PG16 nativo selezionabile via env) per run offline/CI-isolato [F-WS-F-3] — couples WS-G F-3 + WS-C.
- D — **transaction-isolation vs drift-assertion** post-suite (eliminare la classe residue-leak) [F-WS-F-6].
- D — **parallelizzazione**: sequenza C→A, mai B (dossier 3-opzioni completo in F-WS-F-7).
- D — **CRUD round-trip E2E** per dominio admin (users/positions/skills/KPIs) per la dottrina LIVE-DATA-E2E [F-WS-F-14].

**Quick-wins CLASS-A estraibili (indipendenti, ~ore):**
- QW-F1: **Argon2id cost test-only** (`NODE_ENV==='test'`) → ~60-70s di wall a 0 rischio [F-WS-F-4].
- QW-F2: rendere robusto il contratto pool/isolate (commento o globalTeardown, drop dei 81 closePool) [F-WS-F-5].
- QW-F3: `console.warn` sui cleanup swallowed + drift-count post-suite [F-WS-F-9 + F-WS-F-6c].
- QW-F4: showcase a11y/smoke in `showcase.yml` (chromium-anonymous, no tunnel) [F-WS-F-15].
- QW-F5: spec logout-UI + refresh-replay negativo E2E [F-WS-F-16].
- QW-F6: refresh doc-count suite → 134 file / ~920 case / 73 moduli [F-WS-F-19].

**Note (verifica, non fix):** confermare che i 6 test env-gated wave1 girino in un job schedulato `RUN_*` o notarli nel DEBT_REGISTER [F-WS-F-17]; ogni nuovo job E2E in CI eredita port/identity-guard + rate-limit override + concurrency non-cancel [F-WS-F-18].

**Asset da NON regredire**: 73/73 module-test · 0 mock-pool · 0 hard-skip · determinismo API ~totale · cleanup id/prefix-scoped + snapshot-restore config · **D-23/D-24/D-25/D-29 chiusi e verificati**.

---

*Audit S-100X-A3 — read-only, 4 sub-agent + sintesi main-thread. Nessuna modifica a codice/test/CI/deploy. I finding qui confluiscono nel registro dossier del programma 100X — decisione per-finding di Enzo. Cross-ref: WS-G (CI velocity/runner-SPOF/DB-condiviso F-3) + WS-H (Argon2 cost, auth core). Prossimo: S-100X-A4 (WS-C Dati & persistenza).*
