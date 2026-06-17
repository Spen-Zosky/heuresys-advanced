# WS-T1 — Architecture & Multi-Stack Soundness

> **Postura**: indipendente / avversariale. Ogni claim del venditore rivalidato con evidenza reale (grep live, DB live, lettura diretta file). Data: 2026-06-17. HEAD `ce26608`. Ambiente: host Windows, tunnel SSH :5433 → OCI VM PostgreSQL 16.14 (aarch64).

---

## Sintesi

Il monorepo a 5 workspace (api/web/showcase/agent-gateway/shared) è architetturalmente coerente: nessun import cross-package illecito, zero cicli di dipendenza, zero moduli orfani. Il plugin-chain Fastify a 13 passi è reale e nell'ordine corretto. Il debito architetturale principale è concentrato su tre aree: (1) 78 subpath exports dichiarate in `@heuresys/shared` mai utilizzate (drift-magnet), (2) `apps/agent-gateway` — quinto workspace — fuori da pipeline build/lint/CI pur toccando auth/CSRF/write-gate, (3) infrastruttura cloud single-point-of-failure (runner CI = VM PROD, DB PROD = stesso host). Il pattern di dependency injection è consistente ma la utility `withTransaction` è sepolta nel modulo auth anziché in `db/client.ts`. Architettura DB: 130 migration idempotenti su PostgreSQL 16 nativo, schema `sys.*` con 193 tabelle, zero ORM per le query business (raw SQL parametrico), invarianti I1/I5/I7/I9 rispettati strutturalmente.

---

## Claim del venditore rivalidati

| # | Claim | Fonte | Status | Evidenza |
|---|---|---|---|---|
| C-A1 | "13-step plugin chain corretta, ordine: Zod→requestId→helmet→cors→cookie→JWT→rate-limit→auth→CSRF→tenant→errorHandler→health→routes" | CLAUDE.md §app.ts | **CONFERMATO** | `apps/api/src/app.ts:184-415` letto direttamente: step 1 Zod compilers `:185`, step 2 requestId `:212`, step 3 helmet `:236`, step 4 cors `:249`, step 5 cookie `:256`, step 6 JWT `:262`, step 7 rate-limit `:282`, step 8 auth `:289`, step 9 CSRF `:292`, step 10 tenant `:295`, step 11 errorHandler `:298`, step 12 health `:301-309`, step 13 routes `:334-415`. Note: 1b Swagger e hook lifecycle (metrics/export) inseriti fuori-banda con guard. Ordine core = claim. |
| C-A2 | "0 import web→api internals; api→ui=0; shared è leaf; 0 cicli" | CLAUDE.md §Design System | **CONFERMATO** | `grep -r "@heuresys/api" apps/web/src` → 0 output; `grep -r "@heuresys/ui" apps/api/src` → 0 output; `grep "@heuresys/" packages/shared/src` → solo doc-comment (0 import reali). Bash live 2026-06-17. |
| C-A3 | "75 moduli API, tutti registrati in app.ts, 0 orfani" | CLAUDE.md §architecture | **CONFERMATO** | `ls apps/api/src/modules` = 75 dir; `grep app.register apps/api/src/app.ts` = 77 register (2 moduli multi-group). 0 directory module senza routes.ts in app.ts. |
| C-A4 | "130 migration SQL idempotenti, twice-run proven" | CLAUDE.md / SOT_STATE | **CONFERMATO (count)** | `ls db/migrations/*.sql | wc -l` = **130** (live). Max = 000131, gap 000035 documentato. |
| C-A5 | "193 tabelle in sys.*" | SOT_STATE | **CONFERMATO** | `SELECT count(*) FROM information_schema.tables WHERE table_schema='sys'` → **193** (live 2026-06-17). |
| C-A6 | "drizzle rimosso (R08 chiuso)" | WS-A F-WS-A-4 | **CONFERMATO** | `grep -rn "drizzle" apps/api/package.json apps/api/src` → **0** (live). `db/client.ts:5-7` conferma esplicitamente la rimozione. |
| C-A7 | "withTransaction helper corretto" | WS-B F-WS-B-7 | **CONFERMATO** | `apps/api/src/db/client.ts:74-89`: implementazione BEGIN/COMMIT/ROLLBACK/release corretta letta direttamente. |
| C-A8 | "agent-gateway boundary HTTP-only" | WS-A F-WS-A-3 | **CONFERMATO (boundary) / PARZIALE (governance)** | `grep -rln "@heuresys/agent-gateway" apps packages` = 0. MA: `grep -rln "agent-gateway" .github/workflows` = **0** → fuori CI. `apps/agent-gateway/package.json`: no `build`, no `lint`. |

---

## Finding

### T1-001
**ID**: T1-001
**Titolo**: `apps/agent-gateway` — 5° workspace fuori da pipeline build/lint/CI
**Severità**: Medium
**Tipo**: Architecture / Ops
**Evidenza**: `ls .github/workflows/` → 8 workflow, nessuno referenzia `agent-gateway` (bash live 2026-06-17). `apps/agent-gateway/package.json` ha `typecheck`, `test`, `dev` ma no `build`, no `lint`. `pnpm -r --filter="@heuresys/*" run build` skippa silenziosamente agent-gateway. Servizio di 9 file src che parla via HTTP al `/v1` endpoint auth+CSRF. Fonte: WS-A `F-WS-A-3`.
**Impatto**: Un servizio che tocca il gateway auth/CSRF/write (human-in-the-loop) può regredire silenziosamente: nessun gate di typecheck/build/lint/test in CI a ogni push su main.
**GA-blocker**: No
**Remediation**: Aggiungere `"build": "tsup"` + `"lint": "eslint src"` ad `apps/agent-gateway/package.json`; job CI minimo (typecheck+test). Effort: S.
**Best-practice ref**: Monorepo CI parity — ogni workspace dovrebbe avere build/lint/test gate equivalenti.
**Confidence**: Alta

---

### T1-002
**ID**: T1-002
**Titolo**: 78 subpath exports `@heuresys/shared` dichiarate, 0 usate — drift-magnet
**Severità**: Low
**Tipo**: Architecture
**Evidenza**: `packages/shared/package.json:9-325` dichiara 78 entry `./schemas/<module>`. `grep -rhoE "@heuresys/shared/schemas/[a-z-]+" apps packages db scripts` = 1 hit (doc-comment `index.ts:4`, non import). Tutti i 256 import usano il barrel root. Fonte: WS-A `F-WS-A-1` + grep live.
**Impatto**: 78 entry di `package.json` da mantenere allineate a ogni nuovo schema — drift-magnet senza beneficio runtime.
**GA-blocker**: No
**Remediation**: (a) rimuovere le 78 subpath mantenendo solo `.`; oppure (b) documentarle come API pubblica intenzionale. Gate: `pnpm -r typecheck` verde. Effort: S.
**Confidence**: Alta

---

### T1-003
**ID**: T1-003
**Titolo**: CI/CD SPOF — 7/8 workflow su runner self-hosted che è la VM PROD; DB CI = DB PROD
**Severità**: High
**Tipo**: Architecture / Ops
**Evidenza**: `cat .github/workflows/test-integration.yml` → `runs-on: [self-hosted, oci-vm]`. Idem build-web, lint, typecheck, playwright-smoke, i18n-parity, shell-tests. DISCOVERY.md C6: "CI SPOF: 7/8 workflow su runner self-hosted unico = la VM prod" (ammesso dal venditore). CI test-integration usa `localhost:5432` = DB PROD della VM (stessa istanza PostgreSQL usata da `node dist/server.js` in prod).
**Impatto**: (a) Runner SPOF: VM OCI cade → CI + PROD cadono insieme; (b) test di integrazione girano sul DB PROD — un bug di test con side-effect altera i dati di produzione; (c) CI pesante degrada PROD in concorrenza; (d) fork-PR guard fragile (policy YAML — misconfiguration azzerabile).
**GA-blocker**: Sì (per scaling multi-developer o primo cliente con SLA)
**Remediation**: Separare DB test da PROD (schema `test.*` dedicato o istanza separata); secondo runner OCI o GitHub-hosted per workflow non-segreto. Effort: L.
**Best-practice ref**: Ambienti CI devono essere isolati da PROD. Bulkhead pattern. DORA: deployment frequency vs change failure rate.
**Confidence**: Alta

---

### T1-004
**ID**: T1-004
**Titolo**: Pool PostgreSQL hardcoded a max=20, non configurabile via env
**Severità**: Medium
**Tipo**: Architecture
**Evidenza**: `apps/api/src/db/client.ts:21` → `max: 20`. Commento: "Production tuning is post-MVP." Pool sizing fisso senza env-var override. `connectionTimeoutMillis: 5_000` ha causato 4 boot consecutivi falliti sotto jitter OCI (D-20 — documentato). DB live size: **1240 MB**.
**Impatto**: Sotto carico (N+1 broadcast: 322-483 query serializzate su pool=20), il pool si satura. OCI free-tier non scala orizzontalmente. Latenza degrada per tutti gli utenti sotto load spike.
**GA-blocker**: No
**Remediation**: Pool sizing via env-var `POSTGRES_POOL_MAX`; monitoring pool stats in `/v1/observability`. Effort: S.
**Best-practice ref**: PostgreSQL tuning: `max_connections` = min(OCPU×4, 100) per connessioni pooled.
**Confidence**: Alta

---

### T1-005
**ID**: T1-005
**Titolo**: ASSET — Monorepo a boundary puliti: 0 import illeciti, 0 cicli, shared leaf
**Severità**: Info
**Tipo**: Architecture (Asset)
**Evidenza**: `grep -r "@heuresys/api" apps/web/src` = 0; `grep -r "@heuresys/ui" apps/api/src` = 0; `grep "@heuresys/" packages/shared/src` = 0 import reali. 5 workspace, dipendenze dirette: `api→shared`, `web→shared+ui`, `showcase→ui`. Fonte: bash live + WS-A F-WS-A-4.
**Impatto**: La disciplina di boundary previene accidentali import di internals API nel frontend.
**GA-blocker**: N/A
**Remediation**: Nessuna azione. Mantenere enforceability via ESLint `import/no-restricted-imports`.
**Confidence**: Alta

---

### T1-006
**ID**: T1-006
**Titolo**: ASSET — Plugin-chain Fastify 13-step in ordine corretto, error-handling tipizzato
**Severità**: Info
**Tipo**: Architecture (Asset)
**Evidenza**: `apps/api/src/app.ts:184-415` letto direttamente. Tutti 13 step nell'ordine documentato. `errors/index.ts` 11 classi tipizzate → envelope `{error:{code,message}}` deterministico con anti-enumeration su tenant-boundary (→404).
**GA-blocker**: N/A
**Confidence**: Alta

---

### T1-007
**ID**: T1-007
**Titolo**: `.nvmrc` = 20.11.0 — discrepante da `engines: >=22.0.0`
**Severità**: Low
**Tipo**: Architecture / Ops
**Evidenza**: `cat .nvmrc` → **20.11.0**. `package.json:8-9` → `engines: { node: ">=22.0.0" }`. CI runner usa Node 22 (workflow: `node-version: "22"`). Dev host = Node 24.3.0 (D-36). Il `.nvmrc` punta a Node 20 che è sotto il minimo dichiarato.
**Impatto**: Un contributor che usa `nvm use` ottiene Node 20; potenziali comportamenti diversi. Confonde i nuovi sviluppatori sul setup corretto.
**GA-blocker**: No
**Remediation**: Aggiornare `.nvmrc` a `22`. Effort: XS.
**Confidence**: Alta

---

## Score del pilastro

| Score | Confidence | Motivazione |
|---|---|---|
| **72 / 100 — Adeguato** | Alta | Architettura monorepo strutturalmente sana: boundary puliti, chain corretta, 0 cicli, raw-SQL parametrico, 130 migration idempotenti. Il debito è concentrato su ops/governance: CI SPOF (runner CI = VM PROD, T1-003 = finding HIGH), agent-gateway fuori pipeline, pool non configurabile. Nessun difetto architetturale sistemico, ma l'infrastruttura non è pronta per scaling multi-tenant senza un refactoring infra. |
