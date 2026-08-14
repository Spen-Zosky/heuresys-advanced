# CLAUDE.md

## What this is

**Heuresys Advanced HRMS/BPM Platform v5** — pnpm monorepo (2026-05-16). Backend-heavy: Fastify 5 API on PostgreSQL 16 with a Zod-typed contract layer shared with a Next.js 15 admin SPA + ESS portal.

At **`v1.0.0` GA baseline** (S957, 2026-06-02). MVP-0→4 and the RBAC/UIX/Perspectives epic are closed; admin SPA (MVP-2a) + ESS portal (MVP-2b) + teams scope axis shipped; a static brand showcase deploys to GitHub Pages. The VM runs **production mode** (API tsup bundle `node dist/server.js` + web `next start`).

**No running count is hardcoded here** (modules / migrations / endpoints / tests / RBAC mappings) — they live in `docs/kb/SOT_STATE.md`, re-derived every session. They drifted before (D-01).

> **La regola è più larga dei conteggi del progetto, e vale in OGNI file** (Enzo, 2026-08-14). **Una misura che varia non si cristallizza da nessuna parte: si misura quando serve, e accanto si scrive il comando che la produce.** Vale per l'occupazione disco di una macchina, la dimensione di un database, una percentuale d'uso, il numero di righe di una tabella — non solo per i conteggi elencati sopra, e non solo in `SOT_STATE`. Un numero simile scritto in un ADR, in un blocco del register o in un piano è **vero il giorno in cui lo scrivi e falso poco dopo**, e chi lo rilegge non ha modo di saperlo. Caso reale che ha prodotto questa regola: «disco VM all'86%» finì in un dossier di inizio agosto e fu ripreso come stato di fatto; misurato il 2026-08-14 era tutt'altro, e nel correggerlo stavo per cristallizzare il numero nuovo esattamente allo stesso modo. **Unica eccezione**: una misura **datata e dichiarata come tale** dentro un'istruttoria o un messaggio di commit — lì è *evidenza storica*, non un'affermazione sul presente, e il contesto lo dice.

**Data provenance** (ADR-0023): `sys.*` business tables are populated by a deterministic brownfield ingestion whose **authoritative data source** is the legacy `heuresys-evo` Docker DB (`heuresys_evo_platform_db` / db `heuresys_platform`). The data is **production data, treated as real**; the advanced `sys.*` schema is the **structural authority** (the legacy adapts to it).

> **OUTPUT RULE (S1011, Enzo — vincolante)**: the "no-PII / synthetic / ADR-0023 / safe-to-publish" qualifier is **RETIRED as a descriptor**. Never append it as reassurance in messages, commits, docs, ADRs or questions; describe a datum for what it **is** (a payslip, an IBAN, an address), never for what it "isn't". The architectural facts stand (no anonymization layer, treat-as-real) — what's banned is the reflexive label.

## Definition of Done — live E2E con dati reali (VINCOLANTE, cross-sessione · ADR-0026)

**Nessuno step si chiude su mock / placeholder / green-test.** Il mock è solo impalcatura transitoria DENTRO uno step; ogni step si chiude SOLO con una **dimostrazione LIVE su dati reali** — output reale allegato (comando + output + path assoluto + timestamp). "Green test" o "il mock funziona" = **in-progress**, non *done*. Unica attesa ammessa: un input che solo Enzo può fornire (secret/credenziale, approval umana) → stato = **`blocked-on-Enzo: <cosa, perché>`**, MAI "done". Scritture eseguite sui **due tenant di produzione correnti** — **RTL Bank** (customer-example) e **Heuresys System** (platform/system) — **trattati come dati reali**: un solo ambiente prod-grade, **nessun «tenant di TEST», nessun «mai produzione»** (→ **ADR-0026**). Per le pagine autenticate la dimostrazione LIVE = **login con una persona reale** (es. `federica.marchetti@rtl-bank.org`, `paolo.caputo@rtl-bank.org`) e uso secondo profilo.

*Regola di Enzo recepita 2026-06-15. Vale per OGNI work-item.*

## Source of Truth (single per domain — do not duplicate)

- **Current state — two handoff-governed views**, disjoint, no number duplicated between them: `.handoff/STATE.md` (rapid — priorities + open questions) and `docs/kb/SOT_STATE.md` (granular — versions, counts, architecture, milestone narrative). Both rewritten by the `handoff` skill at session close. **Do NOT create other state/handoff/entry-point files.**
- **Open backlog** → `docs/kb/SOT_BACKLOG.md` · **Technical debts** → `docs/kb/DEBT_REGISTER.md`
- **Durable rules / architecture** → this file · **Path index** → `docs/kb/INDEX_PATHS.md` · Public overview → `README.md`
- **Product level** (business scope / PRD / competitive scorecard / latent-capability catalog / product work-item specs) → `docs/product/` (SoT for the product domain, S997). Disjoint from `docs/kb/` (technical state) and `docs/due-diligence/`. ⚠️ The "latent capabilities" the catalog declares are **wiki-derived and partly describe legacy `heuresys-evo`** — re-verify on the *advanced* schema before committing to roadmap.

**Item status vocabulary** (closed set): `ACTIVE` · `GATED` (dependency-blocked) · `WAIT-INPUT` (blocked on an input only Enzo provides) · `HOLD` (parked → pull lane, out of the menu, shown as a count) · `INTERRUPTED` (work in flight, stopped involuntarily — top of menu, `resume-from`) · `DONE`/`FATTO`/`WON'T-DO` (terminal). Menu items are structured blocks in the tagged **Action register** of `SOT_BACKLOG.md`; integrity verified by `docs/kb/tools/handoff_lint.py` (10 blocking checks), menu generated by `build_menu.py`.

Historical records live in `docs/archive/` and are **not** SoT. When state changes, update the relevant SoT above — never spawn a new file.

**Chi può scrivere la SoT di stato** (freeze 2026-05-27, S939 — CLI takeover). L'unico writer e committer di `docs/kb/` è **Claude Code CLI**. Cowork e Claude Desktop sono **read-only** su questi file: per proporre un cambiamento di stato fanno append **solo** a `docs/kb/COWORK_INBOX.md`, che la CLI riconcilia e committa. Nessun altro `docs/kb/`, nessun `git commit`/`push` su questo progetto senza coordinamento CLI.

`cowork_code_exchange/` e `cowork_reserved/` sono **archivio read-only**: niente nuovi cicli PROMPT/PLAN/EXEC/REPORT/REVIEW qui, non sono stato vivo. Il protocollo Cowork↔CLI resta valido negli altri progetti (skill `cowork-cli-protocol`), è congelato solo per questo.

## Session start

**Two modes, declared by the user's first message** (`docs/kb/xtras/SESSION_MODES.md`):

- **`avvia sessione`** → `canonical`. Everything below applies unchanged.
- **`avvia sessione lab`** → `lab`. Read-only analysis session, meant to run **in parallel** to a development one: verify gate skipped for that session alone, writes blocked at the tool layer, artifacts go to `<parent of repo>/heuresys-design-lab/`. Reading is unrestricted — a blocked read is a guard defect. Authenticated browsing is allowed (Chrome first). **Do not present the action menu**: it is not a development session.
- Anything else → `canonical`. Fail-safe: forgetting the command, or mistyping it, never opens a hole.

The mode is state on disk keyed by `session_id`, written by a `UserPromptSubmit` hook before the model sees the message — it does not depend on remembering to activate it.

---

After the infra hooks (tunnel/db/branch), **before** asking what to do or starting work, build the action menu from all live sources — never from memory. ONE command, ONE model round:

```bash
python docs/kb/tools/session_start.py      # --no-db se il tunnel è giù · --show-hold · --net
```

Prints the register-driven action menu **plus** the offline-fast health dashboard. **Do NOT read `SOT_BACKLOG.md` / `SOT_STATE.md` / `DEBT_REGISTER.md` raw at boot** (156KB + 206KB + 65KB — the script already distills them into menu + debts + decisions + drift). Open a source raw **only in drill-down**, for the item the user chooses. The small `.handoff/STATE.md` (~3KB) is fine to read for the narrative.

Then **add only what the register doesn't cover** (debts not-`RISOLTO`, SOT roadmap/gated items) with judgment on impact: **P1** high-impact/unblocking · **P2** quality/debt · **P3** roadmap/gated. Put `INTERRUPTED` items at the **top**. Present, then: *"Scegli #, aggrega (es. 1+4), o nuovo."*

**Do NOT start work before presenting the menu and getting the choice** — unless the user's first message already names a specific task.

Full live health on demand (~5s of network, NOT at boot): `python docs/kb/tools/status_dashboard.py` (alias `pnpm status`) or `session_start.py --net` — adds git sync vs origin, last CI conclusion per workflow, PROD `/login`+`/api/readyz`. It never trusts a cached number; tunnel/offline degrade to `[? ]`, never to a stale guess.

## Canonical commands

Standard workspace scripts (`install`, `dev`, `build`, `typecheck`, `lint`, `test`, `db:*`, `i18n:check`) are in `package.json` — read them there. Only the non-obvious ones live here:

| Task | Command |
|---|---|
| Single test file | `cd apps/api && pnpm exec vitest run test/<name>.integration.test.ts` |
| Single test by name | `cd apps/api && pnpm exec vitest run -t "<pattern>"` |
| **Full E2E web suite** — the only supported full-run mode (D-24) | `cd apps/web && pnpm test:e2e:prod`. The dev config (`test:e2e`) is per-spec iteration only: auth sessions live 15 min. **On Node ≥23** (e.g. Windows Node 24) Playwright 1.61 crashes at import time (D-36) → use `pnpm test:e2e:prod:node22` / `test:e2e:node22` (wrapper runs Playwright under a Node 22 portable; passthrough on Node ≤22, so CI/Mac/VM are unaffected) |
| Typecheck test files | `cd apps/api && pnpm typecheck:test` (uses `tsconfig.test.json`) |
| DB reset (destructive) | `pnpm db:reset` — **ask user before running** |
| **Prova generale della CI, prima di pushare** (#165) | `ssh linux-pc 'cd ~/heuresys-advanced && bash db/scripts/ci-rehearsal.sh'` — copia `heuresys_ci`, riapplica l'intera catena, interroga le sentinelle. **~26 s** contro i 20-30 min di un giro CI. Lanciala **sempre** dopo aver toccato `db/migrations/**`: le post-condizioni che contano righe sono verdi in locale e rosse in CI (→ memoria `ci_clone_lacks_script_imported_data`). `--migrations-from <ref>` prova la catena com'era; `--from-zero` è il modo severo (oggi si ferma alla 000049) |
| Storia RTL 36 mesi | `bash db/scripts/storia36.sh custodia` (regge ancora?) · `... avanzamento` (portala a ieri) · `... custodia --repair-missing`. Triage e trappole nella skill `storia36-custodia`; stato in `.storia36/PROGRESS.md`. Un timer settimanale la esegue su VM e linux-pc |
| **Il guardiano** — contesto e finestra 5h, misurati mai stimati | `python docs/kb/tools/guardiano.py` · `--sorveglia` (exit 3 = si chiude) · `--budget N` (exit 2 = non ci sta) · `--selftest`. **Regola: contesto ≥ 75% OPPURE finestra 5h ≥ 80% → interrompi, registra, committa E PUSHA, chiudi.** I numeri vengono dai token che l'**API** riporta nel transcript e da `rate_limits.five_hour` che Claude Code passa alla riga di stato (depositato in `~/.claude/rate-limits.json`). Il boot li stampa già in cima alla dashboard, in **entrambe** le modalità. Copia a livello utente in `~/.claude/tools/guardiano.py` |
| **Il rubinetto del brownfield è chiuso** — e questo lo tiene chiuso (ADR-0038) | `python docs/kb/tools/check_no_legacy_ingest.py` · `--elenco` · `--selftest` (9/9). Esce **1** se compare un artefatto **nuovo** che prende righe dal DB legacy. I 30 storici sono congelati in `legacy_ingest_allowlist.txt`; `reference_sync` (ISTAT/ATECO/ESCO) **non** è brownfield e non fa scattare nulla |
| **Session start** (menu + health, ONE round) | `python docs/kb/tools/session_start.py` — canonical boot command |
| Status dashboard (full live health, on demand) | `python docs/kb/tools/status_dashboard.py` / `pnpm status` |
| **Plancia** — cruscotto in una pagina web (webapp di servizio) | `pnpm plancia` → `:8481`. **Un processo solo, e basta per guardare**: mostra sessioni *e* zero-pendenze insieme, perché legge da sé i dati dell'altro (ne importa la sola funzione di lettura). `pnpm plancia:sessioni` è la sola vista sessioni. **`pnpm plancia:zp` (:8477) NON è una variante**: è l'unico che **agisce** — lancia il driver, tira il freno, crea/cancella attività pianificate Windows. Quelle azioni non sono duplicate nella plancia, per non avere due posti da cui mutare lo stesso stato. **Nessuno dei due si avvia da solo** (verificato: né attività pianificate, né hook, né servizi) e non ripartono dopo un riavvio. Stato di runtime e chiave d'accesso in `.panel/`, fuori dal repo |
| Session mode — diagnostica e autodiagnosi | `sh scripts/hooks/hook.sh mode <session_id>` · `... selftest` · `... gc` (→ `docs/kb/xtras/SESSION_MODES.md`) |

PowerShell scripts are the Windows canonical; `.sh` siblings exist for bash/SSH-to-VM use. Every `db/scripts/*.{ps1,sh}` is idempotent and safe to re-run.

## Infrastructure

The SessionStart hook (`scripts/session-boot.ps1`) already checks tunnel, pgpass, DB, branch, dirty tree, unpushed and lint at every session start, and prints the result. Re-establish by hand only if it reports a piece down:

```bash
ssh -fN -L 5433:localhost:5432 oracle-vm-default              # tunnel OCI VM :5433 → :5432
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "\dt sys.sys_auth*"
cd apps/api && pnpm dev                                        # look for "RBAC permission cache loaded"
```

`.env` is **gitignored but real**; `.env.example` has three runtime blocks (A localhost / B OCI VM / C OCI Managed). **Option B (OCI VM, tunnel 5433) is the active runtime** (RD-25, ADR-0010). Never commit `.env`, `.secrets/`, `*.pem`.

## Codex read-only audit channel

Codex has a separate least-privilege audit channel for this repo and the OCI database. Broker, access map and operating notes: `.codex-review/service/access/`. The DB identity is `codex_auditor`, read-only by default. **Claude remains autonomous**: do not reuse, rotate or copy the Codex credential, and do not treat `.codex-review` as product source or state SoT. Coordination: `.codex-review/service/access/CLAUDE_INTEGRATION.md`.

Least privilege is **verified, not asserted** (measured S1034, 2026-07-28; re-check with `SELECT * FROM pg_roles WHERE rolname='codex_auditor'` + `information_schema.role_table_grants`): login but not superuser, no `CREATEDB`/`CREATEROLE`/`BYPASSRLS`, `default_transaction_read_only=on` pinned at role level, `statement_timeout=30s`, `lock_timeout=2s`, `idle_in_transaction_session_timeout=60s`, only grant is `SELECT` on `sys` and `audit`.

**Working-tree consequence**: `.codex/`, `.codex-review/`, `.agents/` (Codex's skill path — the user-level twin is `~/.agents/skills/`; the in-repo copy holds Codex's own imports of the project skills, and Codex tracks it as its surface to govern) and the root `AGENTS.md` (Codex's own equivalent of this file) legitimately appear as untracked. They are **not** stray files to clean up, they are **not** Claude's to maintain, and `align-clones` / `close-propagate` do not carry them — the two channels stay separate by design.

## Non-negotiable invariants

These are enforced architecturally and cannot be revisited without a new ADR / decision-log entry. They override "common patterns" you may want to apply from other projects.

- **I1 Position-centric** model, not Employee-centric. Position owner ≠ Incumbent.
- **I3/I4 Schema discipline**: business tables live in `sys.sys_<plural>`. Aux schemas are `staging`, `reference_sync`, `audit`. **Never** `usr_*` / `br_*` / etc. (`brownfield` **ritirato** da #164 F4, mig. `000297`: le tre tabelle vive — `source_exports`, `import_runs`, `source_watermarks` — sono traslocate in `reference_sync`, che è la casa della sincronizzazione ISTAT/ATECO/ESCO; il 90% delle corse era già sua.)
- **I5 Tenant isolation = FK + API middleware filter. NEVER RLS.** Postgres RLS is not used anywhere.
- **I7 Auth is separate from `sys.sys_users`** — 11 dedicated `sys.sys_auth_*` tables.
- **I9 PIP** (Position Intelligence Profile) is a **VIEW / MATERIALIZED VIEW**, never a JSONB blob (ADR-0008).
- **I13 PostgreSQL 16 NATIVE. NO DOCKER.** (ADR-0004 hard policy.) Runtime location is OCI VM via SSH tunnel (ADR-0010 Option B / RD-25). NO-DOCKER governs the advanced **runtime** only — the read-only legacy `heuresys-evo` Docker DB consulted during extract/import is a data **source**, not a runtime dependency, and does not violate this (ADR-0004 source-vs-runtime note; ADR-0023).
- **RD-08 Categorical fields = `varchar(N) + CHECK`. NEVER PostgreSQL ENUM.** Enum-like values are TS-side discriminators.
- **RD-09** Use `date` for date-only columns; `timestamptz` only where time-of-day precision is required.
- **I12 — ⛔ IL RUBINETTO È CHIUSO** (Enzo, 2026-08-14 — **supera la formulazione precedente**). *«Nessun dato riferito al brownfield deve essere rimesso in circolo. Tutto va ricostruito con il DBMS attuale.»* **Non si importa più nulla dal legacy.** Ciò che manca si **costruisce o si deriva dai dati che `sys.*` già contiene**; il legacy resta consultabile come fonte di **concetti** (quali entità esistono, come si legano, cosa è servito davvero all'uso) — **mai** come fonte di righe. Vale per ogni voce futura: un piano che prevede un import è un piano da riscrivere, non da eseguire. *Formulazione superata, tenuta per storia*: «il legacy è la fonte canonica autoritativa che popola `sys.*` via `brownfield.column_mappings`» — è ciò che **è avvenuto** fino a questa data, e spiega la provenienza dei dati oggi presenti; non è più ciò che deve avvenire. Restano validi: `sys.*` è l'**autorità strutturale**; l'ingestione storica non ha avuto alcuno strato di anonimizzazione (`pii_disposition=NONE` su tutte le `column_mappings`) e i dati si trattano come **produzione reale**. → **ADR-0023** (che descrive l'ingestione storica) e la **OUTPUT RULE** qui sopra restano leggibili come cronaca, non come mandato.
- **I14 Legacy ingestion is EMPLOYEE-centric** (ADR-0024). In the legacy Docker DB the **person/business entity is `employees`** (95 cols; **207 FK** hang off it — bio, job, org, kpi, learning, skills, compensation), **NOT `users`** (16-col auth shell; only **45 FK**, all audit-actor; `users.employee_id → employees.id` makes `users` subordinate). Therefore: legacy `employees` ⟹ `sys.sys_users` + `sys.sys_user_*` satellites; legacy `users` ⟹ `sys.sys_auth_*` (credentials only, never the person). The canonical crosswalk key is **`user_external_code = 'LEGACY_EMP::' || employees.id`** (or email cross-check), **never** `'LEGACY:' || users.id`. Coverage is driven by `employees` (an employee with no `users` row is still a credential-less person, not skipped). The `sys.sys_users` ↔ legacy `users` name collision is a **false friend**. Full map: `docs/brownfield/EMPLOYEE_CENTRIC_MAPPING_DOCTRINE.md`.
- **ADR-0011** ESS (Employee Self-Service) is **MVP-2b** — 13 pages `/me/*` + 18 `/v1/me/*` endpoints with 19 self-scope permissions. Don't add `/me/*` routes to existing modules; they get a dedicated module.
- **I15 Single production-grade environment, two current tenants** (ADR-0026). There is **one** environment and it is **production** (prod runtime, TLS, native DB — ADR-0010). **RTL Bank** (customer-example tenant — the populated business dataset, 162 users) and **Heuresys System** (platform/system tenant) are the **current production tenants**, NOT "test" tenants. Data is **treated as real production data** (quality, referential coherence, governance, idempotent/reversible writes); the legacy is only the data *source* (ADR-0023). Two access paths: **public prospect** (unauthenticated landing → `/demo`·`/investors` → lead capture) and **authenticated production app** (login → use per RBAC profile). The phrases "tenant di TEST" / "mai produzione" are **retired**. Business-data writes target RTL Bank by *role* (it models a customer company), never as a test/prod split.
- **I21 Industry-coherent tenant data, industry-open taxonomies** (Enzo, 2026-08-03). Data that **derives from a tenant's industry** must be coherent with it: **Heuresys System = Consulenza Direzionale** (`MGMT_CONSULTING`, ATECO 70.20) · **RTL Bank = Banche e Assicurazioni** (`FIN_BANKING`, ATECO 64.19), both declared in `sys.sys_tenancies` (mig 000242). Tables that define **taxonomies and ontologies** — Industry, ESCO, ISCO, NACE, ATECO, operating-model catalog, CCNL/union reference bands — stay **open to every industry**: without them the platform could no longer create new blueprints, tenants, org structures or processes. The test has **two questions, in order**. First: does the table define a **classification** (ESCO/ISCO/NACE/ATECO/CCNL/operating models) or **product content** (KPI definitions, learning catalog, blueprint content)? A classification stays open to every industry — that is the whole point. Content does not get a pass just for being global: it must serve an industry the platform actually hosts. Second, for content: a row **carrying `tenant_id`** must match that tenant's industry. Worked examples: `BP-SF-*` purged (named SmartFood) · the 35 food/energy learning paths purged (content, no industry hosting them — mig 000241) · `HACCP-COMPLIANCE` and `ENERGY-SAVINGS` purged (mig 000243 — **"global" was not enough**: a KPI is content, not a classification) · the 37 food/energy **ESCO skills kept**, because ESCO is the European skills taxonomy and falls squarely inside what the invariant keeps open.
- **I16 Domini ortogonali** (**ADR-0036**, supersede ADR-0027). L'accesso è l'**intersezione** di un perimetro **gerarchico** (*su quali persone* — fonte canonica: l'albero delle **unità**, `organization_unit_parent_id` + `organization_unit_manager_user_id`; il resolver su quell'albero è il bersaglio di #99 F4 — oggi percorre ancora l'albero delle posizioni, riallineato dal rammendo #114) e di una modalità **funzionale** (*quali dati e come* — dichiarata per classe nella matrice M1: 11 domini funzionali × 7 classi, modalità `edit/read/mask/none`). Un dominio gerarchico **non ha modalità**; nessuna lista di ruoli decide una vista. RBAC resta il *se* (permesso); i domini il *su chi/cosa*.
- **I17 Universal ESS floor + completezza vincolante di `self`** (C4, ADR-0036). Every user is at least `USER`: guaranteed the Employee Portal (`/v1/me/*`) + full access to their OWN data. Self-scope overrides every axis. In più: ogni tabella che referenzia una persona è raggiungibile self-scope, o la sua esclusione è **dichiarata una per una, motivata** (M2; cancello meccanico → #117).
- **I18 Sensitive data is organizational-only.** Another user's `PERSONAL`/`COMPENSATION`/`SKILL`/`EVALUATION` data is accessible ONLY via the organizational chain. Functional (team/process) membership NEVER unlocks sensitive data. (Regola cardinale di ADR-0027, confermata invariata da ADR-0036.)
- **I19 Principio della catena** (C5, ADR-0036). Chi è a capo di una catena organizzativa accede a tutto ciò che gli sta sotto, in cascata a ogni livello, e a **niente** delle catene sorelle — anche da manager, anche se l'altra persona è un semplice impiegato. Il vertice vede tutto perché la sua catena È l'azienda, non per eccezione.
- **I20 Organizational prevalence (absolute for sensitive data).** When axes concur, the org chain prevails for sensitive data. **HR**-mandated roles (`TENANT_ADMIN`, `HRMS_MANAGER`) keep tenant-wide sensitive access by explicit mandate — con **quattro eccezioni dichiarate** (ADR-0036 §5): segnalazioni whistleblowing (isolamento assoluto: solo la custodia, nemmeno il platform), `SPECIAL_CATEGORY` (classe vuota e presidiata), retribuzione dei vertici (soglia di catena), valutazioni non comunicate (stato di comunicazione: `shared_at OR acknowledged_at`). **`PLATFORM_ADMIN` is a *technical* mandate, not an HR one** (ADR-0032, Enzo 2026-08-04): it does **not** open `COMPENSATION` and `EVALUATION` — those fields are withheld and declared via `masked` (`apps/api/src/lib/scope/mask.ts`) su **tutta** la superficie delle due classi (S1053: dossier incluso), while the row, subject, period and status stay visible. `PERSONAL`/`SKILL` are unaffected; I17 always wins; an actor holding an HR mandate *alongside* `PLATFORM_ADMIN` reads unmasked. This is the **fourth authorization state** (`mask`).

- **I22 `HRMS_MANAGER` plenipotenziario sui dati business** (Enzo; formalizzato da ADR-0036 — il numero I21 è occupato dalla coerenza di industry). CRUD completo su ogni dato business del tenant per mandato esplicito; lo delimitano le sole quattro eccezioni di ADR-0036 §5; le superfici tecniche/di piattaforma restano fuori dal mandato.

When a new requirement seems to conflict with these, **stop and ask** rather than working around.

## What NOT to touch

- `.env`, `.secrets/`, any `*.pem` or `*.key` — gitignored secrets.
- `docs/source_bundle/brownfield/extracted/` and `docs/brownfield/_inspection_artifacts/` — gitignored generated dump/inspection artifacts. **Never commit** — repo hygiene (large, reproducible from the pipeline), not a privacy gate. They **may** be read for ingestion/seed authoring; just don't paste absolute legacy-source paths into committed files.
- `node_modules/`, `dist/`, `.next/`, `*.tsbuildinfo` — generated.
- Legacy codebase at `D:\evo.heuresys.com\` (Win) and `/home/ubuntu/heuresys-evo` (OCI VM) — read-only enrichment source. Authorized for inspection but **don't commit absolute paths to it**; reference via `docs/brownfield/BROWNFIELD_IMPORT_PLAN.md`.

## Frontend — due divieti che restano sempre carichi

- **NEVER** create reusable UI components in `apps/web`, `apps/showcase` o `packages/*` di questo repo. Vanno nel repo `ux-design-shared` (→ `@heuresys/ui`).
- **NEVER** aggiungere UI runtime deps (Radix, framer-motion, recharts, ecc.) ai `package.json` di questo repo. Appartengono a `@heuresys/ui` e arrivano come transitive deps.
- **No mock data / demo fixtures / placeholder hard-codes / stubbed endpoints.** Ogni cella, grafico, tabella, form è alimentato da una chiamata `/v1/*` reale; API-first, wiring completo fino al Playwright E2E verde, o non è *done*.

Dottrina completa: `.claude/rules/design-system-ui.md` (design system) e `.claude/rules/frontend-live-data.md` (live-data E2E) — si caricano da sé lavorando su `apps/web/**` o `apps/showcase/**`.

## Metodo di bonifica (S1049, Enzo — VINCOLANTE)

> **«Siamo noi a governare la piattaforma, non il contrario.»** Il database e il codice portano gli strati di due anni di costruzione — import legacy, ricostruzioni, correzioni, ritiri. **Il residuo è lo stato normale, e va bonificato.** Il fallimento da evitare non è «ho rotto qualcosa»: è **«non l'ho toccato perché non avevo lo strumento»** o **«l'ho dichiarato immutabile»**. Devo sempre avere strumenti per modificare in profondità dati, codice e ogni altro oggetto del repo — con prudenza e possibilità di rollback.

Sei regole. **Ognuna nasce da un errore reale**, non da teoria:

1. **Misura prima, sul vivo.** Il piano, il registro e le consegne sono **ipotesi**; il database e il sistema che gira sono la verità. In S1049 la misura ha smentito il piano **quattro volte** — tabelle «vuote e inerti» che erano l'ingresso di uno strumento vivo; una pulizia da 30 minuti che era una decisione di sicurezza; 490 valutazioni la cui causa non era quella che avevo scritto io; tre tabelle «residuo» che erano la casa di una funzionalità attiva. **Verifica anche le affermazioni positive**, non solo quelle negative.
2. **Prova generale prima della produzione.** Ogni tocco a `db/**` passa da `bash db/scripts/ci-rehearsal.sh` (copia di `heuresys_ci`, **due passate**, ~26 s). Ha già intercettato quattro difetti che sarebbero stati CI rossa 25 minuti dopo il push — e uno che aveva già rotto la produzione.
3. **Ritirare non è cancellare** → **ADR-0035**. La catena si ri-applica per intero a ogni deploy: una `DELETE` a valle viene disfatta al giro dopo. Si emenda **il file che crea** l'oggetto (o lo si marca `-- @migrate: once`), e solo *in aggiunta* si rimuove l'esemplare esistente. Il costo di un ritiro si misura **in file da emendare**, e va stimato prima di iniziare.
4. **Ogni scrittura di massa porta quattro cose**: (a) la misura **prima**; (b) una **guardia** che ri-verifica la precondizione *al momento dell'esecuzione*, mai ereditata; (c) una **post-condizione che protegge ciò che NON doveva cambiare**, non solo ciò che doveva; (d) un **rollback dichiarato** — un giornale `staging.*_undo` con la funzione che lo applica, oppure la ragione scritta per cui non esiste. Elenco esplicito, **mai un carattere jolly**, quando si cancella.
5. **Le prove devono poter fallire.** Un controllo che non si è mai visto rosso non è una prova. In S1049 tre miei strumenti hanno prodotto **falsi verdi** (una variabile occupata dal `.env`, un esito letto dai messaggi invece che dal codice d'uscita, un `trap` che restituiva 1 su un verde): ogni volta lo strumento misurava sé stesso.
6. **Una batteria che si ferma al primo rosso nasconde tutti gli altri** — **sei** occorrenze in due sessioni, una perfino dentro la stessa funzione. Quando ne correggi uno, **rilancia**: quasi sempre ne compare un altro che era lì da mesi.

## Working conventions

- **TS strict quirks**: `tsconfig.base.json` ha `noUncheckedIndexedAccess: true` più `noUnusedLocals` / `noUnusedParameters`. L'accesso per indice e `Map.get()` ritornano `T | undefined` — restringi esplicitamente. I parametri inutilizzati vanno prefissati `_`. `exactOptionalPropertyTypes` è intenzionalmente **off** per non rovinare l'ergonomia dei tipi inferiti da Zod.
- **Il lavoro su un modulo segue il pattern in 7 passi + commit atomico.** Non spezzare un modulo su più commit.
- Stile dei commit già stabilito: `feat(api): MVP-1 5.1.X — <module> module (...)`, `chore(db): seed — ...`, `docs(handoff): ...`, `test(api): ...`.
- **Mai `git push`** senza richiesta esplicita. I commit locali su `main` sono pre-autorizzati per questo progetto; i push no. L'autorizzazione al push è **session-scoped**: una volta concessa vale fino a revoca, e **una sessione nuova torna a "chiedi"**.
- **Un CI rosso è un errore che Claude DEVE correggere**, mai restituire all'utente — `gh run list` / `gh run watch` come evidenza.
- **La verifica lunga di chiusura si esegue sul linux-pc, non su Windows** (S1054, Enzo — **standard di chiusura**). Ordine obbligato: **propaga → rinfresca il clone (`clone-vm-db.sh`) → verifica lì**. Il cancello locale (`verify_gate`) resta il guardiano di fine turno per il lavoro in corso. Misure, causa e due leve già provate e scartate → skill `full-alignment-deploy`.
- **La chiusura di sessione non aspetta più la CI** (#165, S1049). `close-propagate.sh` **arma** il deploy (`refs/heads/prod`) e ritorna; il rollout lo esegue `heuresys-advanced-deploy-watch.timer` quando la CI diventa verde (ADR-0028, emendamento S1049). Non annunciare mai «deployato» alla chiusura: annuncia «armato». **La chiusura finisce leggendo dalle macchine**: `scripts/verifica-deploy.sh` dichiara con vocabolario chiuso **DEPLOYATO · IN-VOLO · CI-ROSSA · DISALLINEATO · NON-VERIFICATO**; `NON-VERIFICATO` **non** vuol dire «a posto», vuol dire che non si è potuto guardare. Dettaglio operativo → skill `full-alignment-deploy`.
- **Il guardiano: contesto ≥ 75% OPPURE finestra 5h ≥ 80% → si chiude** (Enzo, 2026-08-13 — vale in **ogni** sessione, canonical e lab; la regola sta anche nel `~/.claude/CLAUDE.md` globale). Non «valuta»: **interrompi, registra il progresso, committa E PUSHA tutto, chiudi**. Nessuna frase sui limiti — «si stringe», «siamo al limite», «meglio chiudere» — senza l'output di `guardiano.py` accanto. Il contesto è un **pavimento** (il turno in corso non è ancora nel transcript), quindi a ridosso di una soglia la si considera raggiunta, non si tira; un dato 5h più vecchio di 15 min è **stantio** e non decide. Ciò che non si misura si dichiara **NON MISURABILE** e non si torna a intuire — se entrambi i rami sono ciechi il guardiano lo dice, perché un «tutto bene» nato dal buio è identico a uno nato da una misura. Fuori dalle due soglie, misurare **non** è decidere: la chiusura resta di Enzo.
- Il repo gira su Windows: valgono i vincoli PowerShell del CLAUDE.md globale.

Autonomia operativa: vale la regola globale. Specifiche di progetto (tool preferiti per task, runner CI self-hosted, gestione tunnel, livello di verifica dei test) → `docs/kb/xtras/AUTONOMY_R23_PROJECT.md`.

## Dove sta il resto

| Cosa | Dove | Quando si carica |
|---|---|---|
| Pattern dei moduli API, plugin chain, error handling | `.claude/rules/api-module-pattern.md` | lavorando in `apps/api/**` o `packages/shared/**` |
| Modello di sicurezza (Argon2id, JWT, refresh rotation, CSRF, ruoli, personas) | `.claude/rules/security-auth.md` | lavorando su auth/rbac |
| Migrazioni DB | `.claude/rules/db-migrations.md` | lavorando in `db/**` |
| Test: Vitest, isolamento transazionale, tunnel | `.claude/rules/tests.md` | lavorando sui test |
| Design system `@heuresys/ui` (setup, workflow, React peer) | `.claude/rules/design-system-ui.md` | lavorando in `apps/web/**`, `apps/showcase/**`, `packages/**` |
| Dottrina live-data E2E del frontend (no mock, API-first, wiring) | `.claude/rules/frontend-live-data.md` | lavorando in `apps/web/**` o `apps/showcase/**` |
| Dottrina di allineamento cloni e deploy — **più** le misure della verifica lunga su linux-pc e il dettaglio di `verifica-deploy.sh` | skill `full-alignment-deploy` | su invocazione |
