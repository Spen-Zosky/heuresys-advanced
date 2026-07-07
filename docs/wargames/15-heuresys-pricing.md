# WARGAME 15 — Public pricing page on www.heuresys.com (GTM #4, next deliverable)

| | |
|---|---|
| **Mission** | Ship `/pricing` (it+en, public, honest-understated) + `lead_source` handling + LeadForm wiring + nav links + E2E, following the repo's brainstorm→spec→plan→build doctrine. Pricing numbers/tiers = **Enzo's authority, full stop** — they DO NOT EXIST yet and must be treated as data, never invented. |
| **Executor** | Claude Code CLI (Sonnet/Opus) on the heuresys-advanced repo — `D:\heuresys-advanced` (Windows) / `/home/ubuntu/heuresys-advanced` (VM) |
| **Wargamed by** | Fable 5 (wargame architect), recon read-only on the mounted repo |
| **Date** | 2026-07-06 (recon snapshot = S1016 state, HEAD `2397eb0a`) |
| **Sources of truth to RE-READ at execution, in this order (SoT wins over this doc)** | 1. `docs/kb/SOT_STATE.md` · 2. `docs/kb/SOT_BACKLOG.md` (item #4) · 3. `docs/kb/DEBT_REGISTER.md` (D-12, D-38, D-42, D-45, D-52) · 4. `.handoff/STATE.md` · 5. project `CLAUDE.md` (DoD, canonical commands, migration rules) · 6. `docs/superpowers/specs/2026-06-22-gtm-investor-onepager-and-guided-demo-design.md` + `docs/superpowers/plans/2026-06-22-gtm-investor-onepager-and-guided-demo.md` (the shipped pattern this mission clones) |

**Rule zero.** This plan was fought on the S1016 snapshot. Counts (167 migrations max `000169`, 189 API test files, 60 E2E specs, i18n parity 1745, pages 101) are snapshots — **re-derive every one live** at execution (`ls db/migrations/*.sql | tail -1`, `python docs/kb/tools/status_dashboard.py`). If SoT contradicts this doc, SoT wins; if the contradiction is structural (files gone, patterns replaced), see ABORT A2.

---

## 1. RECON FINDINGS (verified, with evidence)

All VERIFIED items were read from the repo on 2026-07-06. ASSUMED items are flagged and carry their settling check in §2.

### 1.1 The GTM family pattern (what /pricing must clone)

- **VERIFIED** — Landing `/` is `apps/web/src/app/page.tsx` (63 lines, `"use client"`, `useTranslation("landing")`): header (HeuresysWordmark + `/login` link + CTA), hero, 3 wedge cards, ICP + credibility prose sections, `<LeadForm />` section `id="demo"`, footer tagline. All copy via `t()` keys, testids `landing-page`, `landing-hero`, `wedge-*`, `landing-login`.
- **VERIFIED** — `/investors` = `apps/web/src/app/investors/page.tsx` (110 lines): same skeleton + live stats via `usePlatformStats()` + `window.print()` PDF + `<LeadForm source="INVESTOR" />` at :104. `/demo` = `apps/web/src/app/demo/page.tsx` (58 lines): 10-step screenshot tour + `<LeadForm source="DEMO" />` at :53. Both `"use client"`, no `metadata` export (the family has none — don't add one).
- **VERIFIED** — **Zero cross-links exist between the family pages**: `grep -rn 'href="/investors"|href="/demo"' apps/web/src --include="*.tsx"` returns nothing. The mission's "nav/footer links from the landing family" is therefore NEW work, and linking `/investors` from the public landing was apparently a deliberate omission (investor page is a direct-send artifact). Scope discipline: add **only** the `/pricing` link (see Move 12 + RECON NEEDED RN-5).
- **VERIFIED** — Public-route gate is `apps/web/src/proxy.ts:16`: `PUBLIC_PATHS = ["/login", "/_next", "/api", "/showcase", "/privacy", "/investors", "/demo"]` + `isPublic()` special-cases `"/"` at :19. Adding `"/pricing"` here is the ONLY web-middleware change needed.
- **VERIFIED** — nginx (`deploy/nginx/www.heuresys.com.conf`, per D-42 row in DEBT_REGISTER) proxies `location /` → Next :3013 with no per-route allowlist → **no nginx change needed** for a new page.

### 1.2 LeadForm + leads API (the CTA backbone)

- **VERIFIED** — `apps/web/src/components/lead-form.tsx:11`: `LeadForm({ source = "WEBSITE" }: { source?: "WEBSITE" | "INVESTOR" | "DEMO" })` — the **TS union literal must be extended** if PRICING is added. Form uses `useTranslation("landing")` for ALL its labels (`form.*` keys) — a pricing page reusing `<LeadForm/>` gets the form copy for free, no new form keys needed. Honeypot field `website`, consent checkbox linking `/privacy`, testids `lead-name/company/email/consent/submit`, success card `lead-form-success`.
- **VERIFIED** — `packages/shared/src/schemas/leads.ts`: `LeadSourceEnum = z.enum(["WEBSITE","INVESTOR","DEMO"])`; `LeadCreateSchema.source` optional; **`LeadResponseSchema.source` is `z.string()`** (not the enum) → admin GET/export needs NO change for a 4th value.
- **VERIFIED** — `apps/api/src/modules/leads/routes.ts:21`: `POST /` public (no preHandler, no CSRF opt-in — CSRF is per-route opt-in via `verifyCsrf`, `apps/api/src/middleware/csrf.ts:20-49`), `config: { rateLimit: { max: 5, timeWindow: 60_000 } }`. Registered at `apps/api/src/app.ts:436` prefix `/v1/leads`. `service.ts:26` defaults `source ?? "WEBSITE"`. **No new API endpoint is needed for this mission** — /pricing reuses POST /v1/leads; tier data is frontend config, not an API.
- **VERIFIED** — `GET /v1/public/platform-stats` = `apps/api/src/modules/public-stats/routes.ts` (rate-limit 30/min), prefix `/v1/public` at `app.ts:437`. Pricing page does NOT need it (no live stats on pricing — keep honest-understated, prices only).
- **VERIFIED** — Rate-limit per-IP behind the 2 nginx→Next→API hops was proven live in **D-42** (DEBT_REGISTER:52): 7 rapid POSTs to `https://www.heuresys.com/api/v1/leads` → #1-3 200, #4-7 429, keyed on client IP. This is the live verification pattern to replay.

### 1.3 lead_source enum: migration pattern and the trap

- **VERIFIED** — `db/migrations/000153_lead_source_enum.sql`: RD-08 pattern = **varchar + CHECK, never ENUM**; guarded `ADD CONSTRAINT sys_leads_source_check CHECK (lead_source IN ('WEBSITE','INVESTOR','DEMO'))` only-if-absent by constraint NAME; **tail DO-block raises EXCEPTION if any row has `lead_source NOT IN ('WEBSITE','INVESTOR','DEMO')`** — a hardcoded 3-value list.
- **VERIFIED** — `migrate.sh` replays the FULL chain on every run/deploy (D-12, D-38 evidence: "la catena migrate si rompe al replay"). Therefore: once a PRICING row exists in the live DB, an UNEDITED 000153 replay **raises** at its tail assert → deploy blocker. This is exactly the **D-38 class** (000078 asserted `count==4` on resource `surveys`; 000135 added a 5th; chain broke at the FIRST deploy after — latent, delayed detonation). D-38's accepted fix precedent: **edit the old migration's assert to be scoped/compatible** (DEBT_REGISTER:48, commit `ac4b723`).
- **VERIFIED** — **000142 class** (`db/migrations/000142_goals_okrs_permission_seed.sql:40-42`): its assert is deliberately a **floor, not exact** ("later migrations legitimately add … perms"). Lesson encoded: any assert touching lead_source must tolerate future values (floor or explicit-superset list, never exact-count).
- **VERIFIED** — Full census of code that hardcodes the 3 source values (grep `INVESTOR` over apps/packages/db, node_modules excluded): exactly **6 files** — `packages/shared/src/schemas/leads.ts`, `apps/web/src/components/lead-form.tsx`, `db/migrations/000153_lead_source_enum.sql`, `apps/api/test/leads.integration.test.ts` (asserts INVESTOR stored :88-95, WEBSITE default :98-105, `source:"HACKER"`→400 :108-111), `apps/web/src/app/investors/page.tsx`, `apps/web/tests/e2e/investors.spec.ts` (last two: usage only, no change).
- **VERIFIED** — Migration numbering: 167 files, max `000169` (S1016) → new migration = **max+1 re-derived live** (expected `000170`). Idempotency invariant: twice-run proven (CLAUDE.md §Database migrations). D-45 lesson (DEBT_REGISTER:56): destructive migrations must deploy code first — **ours is purely additive (CHECK widening), so migrate-before-code is safe in the deploy window**.

### 1.4 i18n

- **VERIFIED** — Namespaces are declared in **TWO places** that must both change: `apps/web/src/lib/i18n.ts:32` (`NAMESPACES` + imports :18-23 + `resources.it/.en` :43-57) and `apps/web/scripts/check-i18n-parity.ts:17` (its own `NAMESPACES` const). Forgetting the script = new namespace **silently unchecked** by the parity gate (false green).
- **VERIFIED** — Locale files: `apps/web/src/locales/{it,en}/<ns>.json` (10 existing namespaces incl. `landing`, `investors`, `demo`). Parity gate: `pnpm i18n:check` (root package.json:35), exit 1 on any missing key; current parity count 1745 (SOT_STATE S1016).
- **VERIFIED** — Public-page language: `lib/i18n.ts:64-73` `detectLocale()` = cookie `NEXT_LOCALE` → `NEXT_PUBLIC_DEFAULT_LOCALE` → `"it"`. So the EN live check = set cookie `NEXT_LOCALE=en` (browser/Playwright context), not a URL variant. There is no `/en/pricing` route — do not invent one.
- **VERIFIED** — `eslint-plugin-i18next` is installed (root package.json:60) → no literal UI strings in JSX; ALL pricing copy through `t()`. Numbers from the tier config are numeric expressions (allowed).

### 1.5 E2E + tests

- **VERIFIED** — Pattern specs: `apps/web/tests/e2e/investors.spec.ts` and `demo.spec.ts` (30-32 lines each): anonymous (no storageState), `page.goto(path, { waitUntil: "networkidle" })`, render assertions on testids, then a REAL lead submit with email `e2e+<tag>-${E2E_RUN_ID}@leads-e2e.test` asserting `lead-form-success`.
- **VERIFIED** — Cleanup is already generic: `apps/web/tests/e2e/global-teardown.ts` purges `DELETE FROM sys.sys_leads WHERE lead_email LIKE '%@leads-e2e.test'` via psql (host/port/db/user from repo-root `.env`, password from `~/.pgpass`). A pricing spec using the same email domain needs **zero teardown changes**.
- **VERIFIED** — Playwright: `apps/web/playwright.config.ts` — `workers: 1`, `fullyParallel: false`, `retries: 1`; full-suite mode is **`pnpm test:e2e:prod` only** (D-24); on Node ≥ 23 (Windows has Node 24) use `pnpm test:e2e:prod:node22` / `test:e2e:node22` (D-36). Login rate-limit 10/5min can be exhausted by repeated setup runs (S1016 lesson) — pricing spec itself is anonymous.
- **VERIFIED** — API suite runs under **per-FILE tx isolation** (D-52, `apps/api/test/helpers/tx-isolation.ts` wired in `setup.ts`): each test file's writes are rolled back — new leads tests leave no residue. Full suite baseline: 189 files / 0 fail (S1016). Escape hatch `TEST_TX_ISOLATION=0` exists but must NOT be needed.

### 1.6 Doc flow, gates, deploy

- **VERIFIED** — The shipped GTM flow = design doc in `docs/superpowers/specs/2026-06-22-gtm-investor-onepager-and-guided-demo-design.md` (sections: Goal & context · Decisions locked with Enzo · Architecture · Shared foundation · Deliverables · Security/PII/GDPR · Out of scope · Build sequence · DoD) + implementation plan in `docs/superpowers/plans/2026-06-22-gtm-investor-onepager-and-guided-demo.md` (11 numbered tasks + self-review checklist). The pricing mission produces the same pair. There is no separate `brainstorms/` dir — the brainstorm phase lives as the "Decisions locked/pending with Enzo" section of the design doc.
- **VERIFIED** — DoD (CLAUDE.md §Definition of Done, VINCOLANTE): no step closes on mock/green-test; LIVE demonstration with real data (command + output + absolute path + timestamp); the only permitted wait = input only Enzo can provide → state `blocked-on-Enzo: <what, why>`. Gates table (CLAUDE.md §Canonical commands): `pnpm typecheck` · `pnpm lint` · `pnpm i18n:check` · `pnpm db:migrate:sh` (twice-run) · `cd apps/api && pnpm typecheck:test` · full suites.
- **VERIFIED** — Deploy: `scripts/vm-deploy.sh` (detached + poll per D-49; includes `db:migrate:sh` on the VM + shared→api→web rebuild + restart). CI workflows in `.github/workflows/`: 9 files (build-web, i18n-parity, lint, playwright-smoke, shell-tests, showcase, state-lint, test-integration, typecheck) — SOT_STATE reports "CI 7/7" at S1016 and "CI 6/6" at S1014: the green-gate count **must be re-derived live** (RN-3). `playwright-smoke` CI runs ONLY `smoke-5-personas.spec` (D-47 note) → a new pricing spec is NOT CI-covered; full E2E runs locally.
- **VERIFIED** — CLAUDE.md §Working conventions: "**Never `git push`** without an explicit ask from the user". The mission brief's DoD ("CI 6/6 · vm-deploy · LIVE verification") **is** that explicit ask for this work item. If the execution harness still refuses the push → ABORT A6 (blocked-on-Enzo), never fake "done".
- **ASSUMED** — `/privacy` is a stub but exists and renders (backlog #4 deferral note, SOT_BACKLOG:27). Good enough for the consent link. Settling check in RN-6.

---

## 2. RECON NEEDED (unsettled — each with the exact settling check)

### RN-1 · THE PRICING QUESTION SET FOR ENZO — *the* hard input gap (numbers do not exist)

Post this to Enzo verbatim at Move 2, as one message, before writing the spec's "Decisions" section. **Never invent an answer.** Every question has a shippable default so the page can ship even on silence (fork F-B).

| # | Question for Enzo | Options to offer | Default if withheld |
|---|---|---|---|
| Q1 | Quanti tier pubblici? | 2 / 3 / 3+Enterprise / solo 1 "contattaci" | **single contact-card mode** (see A4 rule) |
| Q2 | Prezzi pubblici in cifre, o "contattaci" per tutti/alcuni tier? | cifre per tutti · cifre solo tier bassi + Enterprise contact-us · nessuna cifra | nessuna cifra (contact-us rendering) |
| Q3 | Unità di fatturazione? | per-employee/mese · per-tenant flat · a scaglioni di dipendenti (LT_50 / 50_250 / 250_2000 / GT_2000, come `LeadCompanySizeEnum`) | non renderizzata (solo contact-us) |
| Q4 | Annuale, mensile, o entrambi (con sconto annuale — quale %)? | annual-only · monthly · both+discount | non renderizzata |
| Q5 | Contenuto di ogni tier (moduli/limiti: HRMS core, BPM, Analytics/BI, AI matching, Insights, ESS, seats, tenants, support level)? | lista libera di Enzo per tier | 3 bullet generici honest-understated per tier, marcati DRAFT nel doc-spec SOLTANTO (mai renderizzati in pagina finché Enzo non valida — A4: sulla pagina i bullet sono omessi), da validare con Enzo prima del deploy |
| Q6 | Trial/pilot policy? (free trial X giorni · pilot guidato su richiesta · nessuno) | — | "pilot guidato su richiesta" → il CTA è già il LeadForm |
| Q7 | Valuta EUR confermata? IVA esclusa? | — | EUR, "IVA esclusa" solo se cifre presenti |
| Q8 | Link `/pricing` nel nav della landing: aggiungere anche link a `/demo` (oggi la famiglia non è cross-linkata — scelta voluta?) | solo pricing · pricing+demo · pricing+demo+investors | SOLO `/pricing` (scope minimo) |

**Settling check**: Enzo's written reply. Absent by the time Move 9 (tier config) is reached → take **fork F-B route C** (contact-us; card count/names per **A4's deterministic rule** — Q1 silent = single contact-card mode). Q5 defaults are the ONLY generated copy — flag them `DRAFT — pending Enzo` in the design doc and ask again before deploy; if still silent, ship tier cards with feature bullets omitted (name + contact-us only), never with invented claims.

### RN-2 · Migration head number
Expected `000170`. **Settle**: `ls db/migrations/*.sql | sort | tail -1` on the execution HEAD. Use max+1, whatever it is.

### RN-3 · CI green-gate count (6 vs 7 vs 9 workflows)
**Settle**: `ls .github/workflows/` + after push `gh run list --commit <sha>` (or `python docs/kb/tools/status_dashboard.py`). Pass = every workflow that triggers on the push is green, whatever the count.

### RN-4 · Doc date slugs
**Settle**: execution date → `docs/superpowers/specs/<YYYY-MM-DD>-gtm-pricing-page-design.md` and `docs/superpowers/plans/<YYYY-MM-DD>-gtm-pricing-page.md`.

### RN-5 · Nav links scope
Landing currently links NOTHING of the family (§1.1). **Settle**: Q8 in RN-1. Default: add `/pricing` to landing header nav + footer; pricing page links back to `/` (wordmark) and `/login` only.

### RN-6 · /privacy stub renders 200
**Settle**: `curl -s -o /dev/null -w "%{http_code}" https://www.heuresys.com/privacy` → 200. If not, note it (backlog #4 deferral), do NOT fix in this mission.

### RN-7 · Recon census still true at execution HEAD
**Settle** (one command batch, Move 1): re-grep the 6-file census of §1.3, re-read `proxy.ts:16`, `lead-form.tsx:11`, `check-i18n-parity.ts:17`. Any structural drift → adapt file:line; missing file/pattern → ABORT A2.

---

## 3. MOVES

Numbered, sequential. Format: **Action → Expected observation → Likely failure / cause → Counter-move.**

### Move 0 — Session bootstrap (SoT + infra)
**Action**: Read in order `docs/kb/SOT_STATE.md` → `docs/kb/SOT_BACKLOG.md` → `docs/kb/DEBT_REGISTER.md` → `.handoff/STATE.md` → project `CLAUDE.md`. Infra: SSH tunnel to VM PG (`:5433`→`:5432`), smoke `psql` check, `python docs/kb/tools/status_dashboard.py`.
**Expect**: backlog #4 still says pricing page is the next GTM candidate with "serve numeri prezzi/tier"; dashboard shows CI green, PROD /login + /api/readyz OK, 0 open debts (or known ones); migration max = RN-2 answer.
**Failure**: tunnel down / dashboard shows PROD red. **Cause**: infra drift unrelated to mission. **Counter**: fix tunnel per CLAUDE.md §Required infrastructure; if PROD is red for pre-existing reasons → R3 assess, if not quickly fixable report and get direction before piling a deploy on a red system (ABORT A5 candidate).

### Move 1 — Execution-time recon re-verify (RN-7)
**Action**: `grep -rln "INVESTOR" apps packages db --include="*.ts" --include="*.tsx" --include="*.sql"` (expect the 6 files of §1.3; a repo-wide grep adds 2 inert `qa_artifacts/schema_snapshot_*.sql` — generated, ignore; the census scope is apps/packages/db) · open `apps/web/src/proxy.ts` (PUBLIC_PATHS), `apps/web/src/components/lead-form.tsx:11`, `apps/web/src/lib/i18n.ts:32`, `apps/web/scripts/check-i18n-parity.ts:17`, `db/migrations/000153_lead_source_enum.sql`.
**Expect**: exact match with §1.1-1.4 (modulo line drift ±5).
**Failure**: extra files now reference the enum (e.g. an admin leads UI shipped in the meantime). **Cause**: sessions after S1016. **Counter**: add each new site to the Move-5/7 touchpoint list (same one-line change class); if `LeadForm` or `proxy.ts` no longer exist in this shape → ABORT A2.

### Move 2 — Post the RN-1 question set to Enzo (WAIT-INPUT, non-blocking start)
**Action**: send RN-1 table (Q1-Q8) to Enzo. Mark the work item `WAIT-INPUT` for the numbers ONLY; docs + scaffold + enum + page-with-fallback proceed in parallel (the design makes numbers data, not layout).
**Expect**: either answers (→ fork F-B route N at Move 9) or silence (→ route C).
**Failure**: partial answers (e.g. tier count but no prices). **Cause**: normal. **Counter**: the tier config supports per-tier `price: null` — apply exactly what was answered, contact-us for the rest; re-flag the gaps in the design doc's "Decisions pending" list.

### Move 3 — Design doc (spec)
**Action**: write `docs/superpowers/specs/<date>-gtm-pricing-page-design.md` cloning the 2026-06-22 design's section skeleton: Goal & context · Decisions locked/PENDING with Enzo (= RN-1 status) · Architecture (tier-config-as-data + contact-us fallback + PRICING source) · Page sections (hero / tier cards / honesty notes / FAQ-lite optional / CTA LeadForm / footer) · Security-PII-GDPR (unchanged: same consent + honeypot + rate-limit; no new PII) · Out of scope (billing engine, checkout, currency switch, admin pricing editor, investors/demo cross-links unless Q8 says otherwise) · Build sequence · DoD.
**Expect**: file exists, honest-understated tone, every open decision attributed to Enzo, zero invented numbers anywhere in the doc.
**Failure**: scope creep into checkout/billing or invented "€X placeholder" values. **Cause**: filling the input gap by imagination. **Counter**: the doc's Decisions table may contain ONLY: Enzo's answers, or `PENDING (contact-us fallback)`. Grep your own doc for `€` and digits in price context before committing.

### Move 4 — Implementation plan doc
**Action**: write `docs/superpowers/plans/<date>-gtm-pricing-page.md` with numbered tasks = Moves 5-18 of this wargame (the 2026-06-22 plan is the template: per-task steps, exact files, gates per task, self-review checklist at the end).
**Expect**: plan file committed alongside the spec (`docs(superpowers): gtm pricing page — design + plan` commit).
**Failure**: none material. **Counter**: —.

### Move 5 — FORK F-A decision + backend enum extension (route B default: add PRICING)
**Action** (route B, see §4 F-A for triggers): in ONE atomic change:
1. `packages/shared/src/schemas/leads.ts`: `LeadSourceEnum = z.enum(["WEBSITE","INVESTOR","DEMO","PRICING"])`.
2. New migration `db/migrations/000170_lead_source_pricing.sql` (number per RN-2), RD-08 pattern, twice-run idempotent:
   - guarded `DO $$` drop `sys_leads_source_check` **only if its definition lacks 'PRICING'** (check `pg_get_constraintdef`), then guarded ADD with the 4-value list;
   - tail assert **floor-style / superset** (000142 lesson): raise only if rows exist with `lead_source NOT IN ('WEBSITE','INVESTOR','DEMO','PRICING')`; NOTICE on success.
3. **Edit `000153_lead_source_enum.sql` tail assert** to the same 4-value `NOT IN` list (D-38 precedent, commit `ac4b723` class fix) — otherwise the full-chain replay detonates at the first deploy AFTER a PRICING row lands (see RED-TEAM, attack that succeeded). Leave 000153's guarded ADD as-is (name-guard makes it a no-op when 000170's constraint exists; on a fresh DB it creates the 3-value CHECK which 000170 then widens — chain-order safe).
**Expect**: `pnpm db:migrate:sh` (against the tunnel = shared prod-grade DB, ADR-0026) exits 0 with "…migrations applied"; **run it twice** — second run also exit 0, no error, NOTICEs only. `psql -c "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='sys_leads_source_check'"` shows the 4 values.
**Failure 1**: chain fails at 000153 on first run. **Cause**: live rows already violate, or your 000153 edit has a syntax slip. **Counter**: `psql -c "SELECT lead_source, count(*) FROM sys.sys_leads GROUP BY 1"` to see reality; fix the edit; re-run.
**Failure 2**: chain fails elsewhere (pre-existing D-12/D-38 class). **Cause**: someone else's assert broke since last deploy. **Counter**: R3 — fix it with the same scoped-assert method, do not `--no-verify`-equivalent around it; 2 failed attempts → ABORT A3.
**Failure 3**: drop/recreate races a concurrent write on the live table. **Cause**: `ALTER TABLE … ADD CONSTRAINT` takes a lock; sys_leads is tiny + low-traffic. **Counter**: run in the deploy window; the CHECK widening is additive so old prod code (3-value Zod) stays valid throughout (D-45 inverse case — safe order).

### Move 6 — API integration test extension
**Action**: extend `apps/api/test/leads.integration.test.ts` mirroring the INVESTOR case (:88-95): POST with `source:"PRICING"` → 200 → `SELECT lead_source … = 'PRICING'`. Keep the `"HACKER"`→400 case untouched (it now proves the enum is exactly 4). Include a distinct `remoteAddress: "10.10.0.4"` exactly like the :90 pattern (per-IP bucket isolation, comment at :85-87).
**Expect**: `cd apps/api && pnpm exec vitest run test/leads.integration.test.ts` → all pass (existing + 1 new); D-52 isolation rolls the rows back (verify: re-run, same result, no residue complaints). `pnpm typecheck:test` exit 0.
**Failure**: 400 on the new POST. **Cause**: shared package not rebuilt — vitest resolves stale `dist` (D-17 class). **Counter**: `pnpm --filter @heuresys/shared build` then re-run.

### Move 7 — LeadForm prop union
**Action**: `apps/web/src/components/lead-form.tsx:11` → `source?: "WEBSITE" | "INVESTOR" | "DEMO" | "PRICING"`. (If the census at Move 1 found new sites hardcoding the union, update them too.)
**Expect**: `pnpm typecheck` exit 0.
**Failure**: type error where LeadForm's prop type is re-derived elsewhere. **Cause**: census miss. **Counter**: follow the compiler — the error IS the census.

### Move 8 — i18n namespace `pricing`
**Action**: create `apps/web/src/locales/it/pricing.json` + `apps/web/src/locales/en/pricing.json` (identical key trees: `nav.*`, `hero.title/subtitle`, `tiers.<id>.name`, `tiers.<id>.features.*` (only if Q5 answered), `tiers.contactUs`, `tiers.priceNote` (billing-unit/period wording, only if Q3/Q4 answered), `honesty.body`, `cta.title/subtitle`, `footer.tagline`). Register in **BOTH** `apps/web/src/lib/i18n.ts` (imports + `NAMESPACES:32` + `resources.it` + `resources.en`) **AND** `apps/web/scripts/check-i18n-parity.ts:17`.
**Expect**: `pnpm i18n:check` exit 0 and the reported key total **rises above 1745** (proof the script actually sees the new namespace — if the total didn't move, you forgot the script's NAMESPACES).
**Failure**: parity green but total unchanged. **Cause**: the silent-unchecked-namespace trap (§1.4). **Counter**: that's why the pass criterion is the COUNT DELTA, not just exit 0.

### Move 9 — Tier config (numbers as data) + FORK F-B resolution
**Action**: create `apps/web/src/app/pricing/tiers.ts`:
```ts
export type TierPrice = {
  amount: number; currency: "EUR";
  unit: "PER_EMPLOYEE_MONTH" | "PER_TENANT_MONTH" | "FLAT";
  billing: "ANNUAL" | "MONTHLY";
} | null; // null → contact-us rendering
export type Tier = { id: string; price: TierPrice; featured?: boolean };
export const TIERS: readonly Tier[] = [/* filled from Enzo's RN-1 answers; price:null default */];
```
> **Representability guard**: the `TierPrice` shape above covers Q3 ∈ {per-employee, per-tenant, flat} × Q4 ∈ {annual-only, monthly-only}. **Trigger**: if Enzo's answers include Q4="both" (dual billing ± discount) or Q3="a scaglioni" (band-tiered pricing) → do NOT improvise the rendering: (1) extend the config type in the same file (`prices: { billing: "ANNUAL"|"MONTHLY"; amount: number }[]` + optional `bands: { size: LeadCompanySize; amount: number }[]`), (2) add ONE amendment section to the design doc (Move 3 file) specifying the toggle/band rendering (billing toggle = two-button group over the grid, `pricing-billing-toggle` testid; bands = rows inside the card), (3) re-run V1-V3 + the Move 13 digit assertion per rendered state. This is a bounded, in-mission amendment — not a new fork.

Fill from Enzo's answers (fork F-B route N) or all-`null` (route C). Names/features/copy live in the `pricing` namespace keyed by `tiers.<id>.*` — the config holds ONLY structure + numbers.
**Expect**: typecheck green; flipping C→N later = edit this one file + (if Q5 lands) add feature keys to 2 JSONs. No layout change.
**Failure**: temptation to encode copy in the config. **Cause**: convenience. **Counter**: eslint-plugin-i18next will flag literals rendered in JSX; keep the boundary strict.

### Move 10 — `/pricing` page
**Action**: create `apps/web/src/app/pricing/page.tsx`, `"use client"`, `useTranslation("pricing")`, cloning the family skeleton (§1.1): header (Wordmark → `/`, `/login` link testid `pricing-login`) · hero (`pricing-hero`) · tier card grid mapping `TIERS` (testid `tier-<id>`; card shows `t(\`tiers.${id}.name\`)`, price block = `Intl.NumberFormat(locale)` on `price.amount` + `t("tiers.priceNote")` when `price !== null`, else `t("tiers.contactUs")` + anchor `#contact`) · honesty section (`t("honesty.body")` — under-promise, mirrors landing credibility tone) · CTA section `id="contact"` testid `pricing-cta` with `<LeadForm source="PRICING" />` · footer tagline. No `metadata` export (family has none). No platform-stats fetch.
**Expect**: `cd apps/web && pnpm dev` → `http://localhost:3000/pricing` renders anonymously (after Move 11), cards show contact-us or numbers per fork, form submits → success card; `pnpm lint` green (no literal strings).
**Failure**: redirect to /login. **Cause**: Move 11 not done / ordering. **Counter**: do Move 11 first or together; it's one array literal.

### Move 11 — proxy.ts allowlist
**Action**: `apps/web/src/proxy.ts:16` → add `"/pricing"` to `PUBLIC_PATHS`.
**Expect**: anonymous `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/pricing` → 200 (not 307→/login).
**Failure**: still 307. **Cause**: middleware matcher cache in dev. **Counter**: restart dev server; verify `isPublic("/pricing")` logic (prefix match handles subpaths).

### Move 12 — Nav/footer links (scope per RN-5/Q8)
**Action**: default scope — `apps/web/src/app/page.tsx` header: add `<Link href="/pricing" data-testid="landing-pricing">` next to the login link (+ a footer link if the footer grows a nav; today it's a tagline-only footer — keep tagline + one pricing link, minimal). Add `nav.pricing` key to `landing.json` it+en. If Q8 says more links, add exactly those.
**Expect**: landing renders the link; `landing.spec.ts` still green (it doesn't assert link absence — verified: it checks hero/wedges/login only).
**Failure**: i18n parity fail. **Cause**: key added to one locale only. **Counter**: parity gate catches it; add both.

### Move 13 — E2E spec
**Action**: create `apps/web/tests/e2e/pricing.spec.ts` cloning `demo.spec.ts` (§1.5): 
1. render test — goto `/pricing`, expect `pricing-hero`, `tier-<firstId>`, `pricing-cta` visible;
2. EN test — `context.addCookies([{name:"NEXT_LOCALE", value:"en", url: baseURL}])`, goto `/pricing`, expect hero text = the EN `hero.title` string (imports the JSON or hardcodes the expected string);
3. lead submit — email `e2e+pricing-${E2E_RUN_ID}@leads-e2e.test`, fill name/company/email + consent, submit, expect `lead-form-success` (teardown purges it — zero changes needed, §1.5);
4. (route N only) a price digit assertion `toContainText(/[0-9]/)` on a priced tier card.
**Expect**: `cd apps/web && pnpm exec playwright test tests/e2e/pricing.spec.ts --project=chromium --no-deps` (dev config; `:node22` wrapper if `node -v` ≥ 23, D-36; the spec is anonymous — no storageState needed; `--no-deps` skips the 5-login `setup` project dependency) → all pass.
**Failure 1**: submit test gets `lead-form-error`. **Cause**: 5/min per-IP rate-limit — you re-ran the spec (or the retry fired) within 60s. **Counter**: wait 60s and re-run; do NOT raise the API limit.
**Failure 2**: EN test sees Italian. **Cause**: cookie set after load / wrong cookie name. **Counter**: cookie name is exactly `NEXT_LOCALE` (`lib/i18n.ts:29`), set on the context BEFORE `goto`.
**Failure 3**: setup project 429s on login (rate-limit 10/5min after repeated iterations). **Cause**: default project dependency running auth.setup you don't need. **Counter**: `--no-deps` as above; if you omitted it, wait 5 min.

### Move 14 — Full local gates (R3: fix EVERYTHING red)
**Action**: from root — `pnpm typecheck` · `cd apps/api && pnpm typecheck:test` · `pnpm lint` · `pnpm i18n:check` · `pnpm db:migrate:sh` ×2 (already proven in Move 5, re-prove post-rebase if any) · full API suite `cd apps/api && pnpm test` · `pnpm build` (web build) · full E2E `cd apps/web && pnpm test:e2e:prod` (or `:prod:node22`).
**Expect**: typecheck/lint/i18n exit 0; API suite ≥190 files 0 fail; E2E ≥61 specs 0 fail (counts = baseline+1, re-derive baseline live).
**Failure**: unrelated pre-existing red (D-43/D-47 class: a stale spec someone else broke). **Cause**: cross-session drift not covered by CI smoke. **Counter**: R3 — fix it in the same push, declare it (precedent: D-43 fix in S1003's gate); if the fix needs product decisions → ABORT A5.

### Move 15 — Commit + push + CI
**Action**: atomic commits in repo style: `docs(superpowers): gtm pricing — design + plan` · `feat(db+shared): lead_source PRICING (mig <NNNNNN>, 000153 assert widened — D-38 class)` · `feat(web): /pricing public page (tier config + contact-us fallback, i18n pricing ns, PRICING lead source)` · `test(api|e2e): pricing lead + pricing.spec`. Push (mission-authorized, §1.6; if harness refuses → ABORT A6). Watch CI: `gh run list --commit <sha>`.
**Expect**: all triggered workflows green (count per RN-3; i18n-parity + typecheck + lint + build-web + test-integration + playwright-smoke at minimum).
**Failure**: test-integration red on CI only. **Cause**: CI runs against its own DB — if CI's migrate step replays the chain, an assert slipped (Move 5 edit incomplete) OR seed drift. **Counter**: read the CI log's exact migration/assert line; that line tells you which file's list is stale; fix, push again. **Note (REVIEW-15 F6)**: `test-integration.yml` currently has NO migrate step — this branch is hypothetical; the migration chain is proven ONLY by V4's local twice-run + the Move 16 VM deploy. A green CI says nothing about 000153/000170.

### Move 16 — Deploy
**Action**: `bash scripts/vm-deploy.sh` (detached + poll, D-49 pattern). It runs `db:migrate:sh` on the VM (widened CHECK — additive, safe pre-code per §1.3) then rebuilds shared→api→web and restarts.
**Expect**: deploy log ends green; `curl https://www.heuresys.com/api/readyz` → OK.
**Failure**: migrate step aborts at an assert. **Cause**: VM DB has rows/states local didn't (shared DB should be identical — the tunnel IS this DB; so this signals a mid-window write). **Counter**: psql the failing assert's predicate, fix data or assert scope, re-run deploy; 2 failures → ABORT A3.

### Move 17 — LIVE verification (D-42 pattern + real lead round-trip)
**Action + pass criteria**: see VERIFICATION RUNS V8-V10 — 200 it+en, real PRICING lead stored and removed, rate-limit per-IP burst.
**Failure**: see V8-V10 rows.

### Move 18 — Close-out
**Action**: update `docs/kb/SOT_BACKLOG.md` #4 note (pricing SHIPPED — or `blocked-on-Enzo` residue for withheld numbers, status per vocabulary: `WAIT-INPUT` on the numbers sub-item if route C shipped) · handoff skill rewrites SOT_STATE/.handoff (its job, not yours to hand-edit counts) · `python docs/kb/tools/handoff_lint.py` green · new debt rows ONLY if something was deferred dirty.
**Expect**: lint 10/10; menu regenerates.
**Failure**: lint red on status vocabulary. **Cause**: wrong lane word. **Counter**: use the closed set (CLAUDE.md §SoT): `WAIT-INPUT`, not "pending".

---

## 4. FORKS (triggers, no judgment calls)

### F-A · lead_source: new PRICING value (route B) vs reuse WEBSITE (route A)
- **Default = route B (add PRICING)**: it is the family's design intent — 000153's own header says the enum exists to "segment GTM leads by entry point"; one surface = one source (WEBSITE/INVESTOR/DEMO ⇒ PRICING). Cost is bounded: the Move-1 census is exactly 6 files, the D-38-class edit of 000153 is a one-line list widening with an accepted precedent (`ac4b723`).
- **Trigger → route A (reuse WEBSITE, zero DB/schema change)**: take route A **iff** (T1) the Move-5 migration chain fails twice on the 000153-widening approach for reasons you cannot scope-fix (R14: two failed attempts in the same direction = change approach), **or** (T2) the Move-1 census reveals ≥3 additional migration files asserting lead_source value-sets (an unforeseen assert web — cost no longer bounded), **or** (T3) Enzo explicitly answers that pricing leads must not be segmented. Route A consequences: skip Moves 5-6 enum parts; `<LeadForm />` on /pricing with default source; **register a new DEBT row** ("pricing leads unsegmented — deferred PRICING enum value") and say so in the design doc. No middle route: do NOT overload `message` or invent a query-param segmentation.
- **Route B sub-trigger**: if the census (Move 1/T2 threshold not met) finds 1-2 extra asserting files → stay on route B and widen each with the same scoped-assert method in the same commit.

### F-B · Numbers-provided (route N) vs contact-us (route C)
- **Trigger**: state of Enzo's RN-1 answers **at the moment Move 9 executes** (and re-check before Move 16 deploy — late answers upgrade C→N with a data-only edit).
- **Route N**: `TIERS[i].price = {amount, currency:"EUR", unit, billing}` per Q2-Q4; page renders formatted numbers + `tiers.priceNote`; E2E adds the digit assertion (Move 13.4). Partial answers → per-tier mix (null where withheld).
- **Route C**: every `price = null`; cards render tier name (+ Q5 features if given, else name-only) + `tiers.contactUs` anchored to the LeadForm. Card count/names follow **A4's deterministic rule**: Q1 unanswered → single contact-card mode (`TIERS = [{ id: "contact", price: null }]`); Q1 answered, Q5 not → N cards, Enzo-named or neutral positional 'Tier 1..N' flagged DRAFT. E2E asserts the contactUs string instead of digits. The page is COMPLETE and shippable in this state — numbers are a config fill, not a relayout (for the answer space outside the base `TierPrice` shape, see the Move 9 representability guard: bounded config-type extension + design-doc amendment, still no relayout of the shipped page).
- Both routes ship `<LeadForm source="PRICING" />` (or WEBSITE under F-A route A).

### F-C · Node version for E2E
- **Trigger**: `node -v` ≥ 23 → use `pnpm test:e2e:prod:node22` / `test:e2e:node22` wrappers (D-36 crash on Playwright 1.61). ≤ 22 → plain commands.

### F-D · CI red after push
- **Trigger**: any workflow red on your commit → read the failing job log FIRST (R14: no guessing); if the failure line references a migration assert → Move-5 edit incomplete (fix list, push); if it references a spec you didn't touch → R3 pre-existing break (fix in follow-up commit, same push session, declare it); 2 consecutive red pushes on the same cause → ABORT A3.

---

## 5. ABORT CONDITIONS (stop and flag — never improvise)

- **A1 — Enzo says no**: any RN-1 reply that forbids a public pricing page or reshapes the deliverable (e.g. "gated PDF only") → stop after Move 4 (docs are still valuable), report.
- **A2 — Structural recon drift**: `lead-form.tsx`, `proxy.ts` PUBLIC_PATHS, `leads` module, or the migrations chain no longer match §1 in SHAPE (not just line numbers) → stop, report the diff; this plan's moves are no longer safe.
- **A3 — Migration chain unrecoverable**: `migrate.sh` (local twice-run, CI, or VM deploy) fails twice after scoped fixes on the same cause → revert the migration edits (`git checkout` the two .sql files — with confirmation), stop, report with the exact assert output. Never ship a chain that replays red (D-12 invariant).
- **A4 — Prices ambiguity**: any pressure (including your own) to publish a number Enzo did not literally write → route C. **Deterministic rule, no judgment**: at Move 9, if Q1 is unanswered → ship **single contact-card mode**: `TIERS = [{ id: "contact", price: null }]`, name key `tiers.contact.name` = a neutral non-claim ('Parliamone' / 'Talk to us'), no feature bullets, LeadForm CTA unchanged. If Q1 IS answered (tier count N) but Q5 is not → N cards, names ONLY if Enzo named them, otherwise neutral positional names ('Tier 1..N') flagged `DRAFT — pending Enzo` in the design doc; feature bullets omitted. Tier names containing positioning claims (e.g. 'Enterprise', 'Pro') are Enzo-authored copy — never generated. This rule OVERRIDES the RN-1 Q1 scaffold default. Numbers = Enzo's authority, full stop.
- **A5 — Unrelated red beyond session scope**: full suite / PROD health red for pre-existing causes needing product decisions or >2h of unrelated work → stop before Move 16, report per R3 with evidence (do not deploy onto red).
- **A6 — Push/deploy not permitted by harness**: `git push` or SSH to VM refused by permissions → complete through Move 15's commits, state `blocked-on-Enzo: push/deploy authorization`, never claim done (DoD forbids it).
- **A7 — Live cleanup impossible**: the verification lead cannot be deleted (psql unreachable) → do not run more live submits; flag the orphan row (email + timestamp) for manual cleanup.

---

## 6. VERIFICATION RUNS (executor performs, in order — pass looks like this)

| # | Run (from repo root unless noted) | When | PASS |
|---|---|---|---|
| V1 | `pnpm typecheck` + `cd apps/api && pnpm typecheck:test` | Moves 7, 14 | exit 0, both |
| V2 | `pnpm lint` | Move 14 | exit 0, 0 errors (i18next literal rule included) |
| V3 | `pnpm i18n:check` | Moves 8, 12, 14 | exit 0 **and** key total > pre-mission baseline (baseline re-derived at Move 0; S1016 = 1745) — the delta proves the `pricing` ns is registered in the parity script |
| V4 | `pnpm db:migrate:sh` **twice** | Move 5, re-run Move 14 | both runs exit 0, "…applied", second run NOTICE-only; `psql`: `sys_leads_source_check` def contains PRICING (route B) |
| V5 | `cd apps/api && pnpm exec vitest run test/leads.integration.test.ts` then full `pnpm test` | Moves 6, 14 | leads file all pass incl. PRICING case; full suite = baseline+0 fails (S1016 baseline 189 files/0 fail; re-derive) |
| V6 | `cd apps/web && pnpm exec playwright test tests/e2e/pricing.spec.ts --project=chromium --no-deps` (F-C wrapper; per-spec iteration — skip the 5-login setup, Move 13 Failure 3) then full `pnpm test:e2e:prod` (full run keeps its setup dependency — other specs need storageState) | Moves 13, 14 | pricing.spec 3-4/3-4; full suite baseline+1 specs, 0 fail |
| V7 | push → `gh run list --commit <sha>` | Move 15 | every triggered workflow green (count per RN-3) |
| V8 | `curl -s -o /dev/null -w "%{http_code}" https://www.heuresys.com/pricing` **and** `PLAYWRIGHT_BASE_URL=https://www.heuresys.com pnpm exec playwright test tests/e2e/pricing.spec.ts --project=chromium --no-deps` (F-C wrapper; `--no-deps` mandatory against PROD — the spec is anonymous and the default `setup` dependency would burn 5 real logins + MFA per attempt against the 10/5min prod login rate-limit and PATCH prod personas' locale) | Move 17, post-deploy | curl = **200** (not 307); spec green against www — the EN-cookie test inside it IS the "en" half of "200 on /pricing it+en" (there is no /en route; language = NEXT_LOCALE cookie, §1.4) |
| V9 | Real lead round-trip: the V8 spec's submit already stored `e2e+pricing-…@leads-e2e.test` on prod → on VM: `psql -c "SELECT lead_source FROM sys.sys_leads WHERE lead_email LIKE 'e2e+pricing-%@leads-e2e.test'"` → then `DELETE … RETURNING 1` | Move 17 | SELECT returns `PRICING` (route B; `WEBSITE` under F-A route A); DELETE returns ≥1; follow-up SELECT count = 0 (removed — R5 evidence: command+output+timestamp) |
| V10 | Rate-limit per-IP (D-42 replay): 7 rapid `curl -X POST https://www.heuresys.com/api/v1/leads` with valid JSON, email domain `@leads-e2e.test` | Move 17, AFTER V9's delete | first ≤5 → 200, remainder → **429** within the same minute (per-IP counting confirmed, as D-42 S1002: #1-3 200 / #4-7 429 depending on window residue); then purge: `DELETE FROM sys.sys_leads WHERE lead_email LIKE '%@leads-e2e.test'` → subsequent count 0 |
| V11 | `python docs/kb/tools/handoff_lint.py` + `python docs/kb/tools/status_dashboard.py` | Move 18 | lint 10/10 green; dashboard shows no drift flags, PROD green |

---

## 7. RED-TEAM RECORD

**Attack that FAILED against the plan** — *"The full E2E suite fires 4 lead submits (landing, investors, demo, pricing) into a 5/min per-IP rate limit → the pricing submit will flake 429 in every full run."* Dead on arrival: `playwright.config.ts` sets `workers: 1, fullyParallel: false` — specs run sequentially and the four submits are separated by whole spec files (seconds-to-tens-of-seconds apart in prod build (~3 s/test, S985), worst case 4 submits + 1 retry = 5 ≤ 5 — at the cap: the NEXT GTM surface must stagger (per-spec `waitForTimeout` before submit or distinct email-domain limiter review)). The residual real risk (rapid LOCAL re-runs of pricing.spec within 60s, or the `retries: 1` double-fire after a slow success) is already encoded as Move 13 Failure 1 with its counter (wait 60s, never raise the limit). No patch needed.

**Attack that SUCCEEDED + the patch applied** — *"Delayed detonation: the draft plan added only the new migration `000170` (drop/recreate CHECK with 4 values). Everything ships green — typecheck, suites, CI, deploy, live checks all pass, because at deploy time zero PRICING rows exist. The bomb: `migrate.sh` replays the FULL chain on every deploy, and `000153`'s tail DO-block raises on any row with `lead_source NOT IN ('WEBSITE','INVESTOR','DEMO')`. The first vm-deploy AFTER a real pricing lead arrives aborts the chain at 000153 — a deploy blocker weeks later, in someone else's session, with this mission's fingerprints."* This is a verified re-run of the D-38 detonation (000078 broke at S996's deploy for an S995 change, DEBT_REGISTER:48). **Patch (now Move 5.3 + V4)**: widening `000153`'s `NOT IN` list to include PRICING is a **mandatory part of the same commit** as 000170, using the D-38 precedent fix class (`ac4b723`); and V4 requires the twice-run full-chain replay as the proof, with V9 deliberately inserting a real PRICING row on prod BEFORE the mission closes — so if the patch were missing, the NEXT deploy in this same mission's verification horizon would already expose it, not a future session.

### Independent adversarial review 2026-07-06 (REVIEW-15)

Verdict **PASS-WITH-PATCHES** (independent reviewer, did not author the plan; 12 primary + 11 secondary claims spot-checked, 0 wrong — incl. independent confirmation that the 000153 delayed-detonation attack above is real). All patches applied to this document:

- **F1 · MEDIUM** — `TierPrice` could not represent two answers RN-1 itself offers (Q4="both+discount", Q3="a scaglioni") → patched: **representability guard** in Move 9 (bounded config-type extension + one design-doc amendment, no improvisation, no new fork).
- **F2 · MEDIUM** — total-silence contradiction (RN-1 Q1 "3 tier scaffold" vs A4 single card) + "feel like invention" judgment call → patched: **deterministic rule in A4** (Q1 silent = single contact-card mode; overrides the old Q1 default; positioning tier names never generated).
- **F3 · LOW** — pricing.spec silently triggers the `setup` project dependency (5 real logins + MFA + locale PATCH), burning the 10/5min login budget — against PROD in V8 → patched: `--project=chromium --no-deps` in Move 13 / V6 / V8 + Move 13 Failure 3.
- **F4 · LOW** — §7 failed-attack justification "minutes apart" wrong for prod-build runs (~3 s/test, S985); real margin = 4 submits + 1 retry = 5 = cap → wording corrected (conclusion stood); next GTM surface must stagger.
- **F5 · LOW** — Move 6 must pin a distinct `remoteAddress: "10.10.0.4"` (per-IP rate-limit bucket isolation, comment at :85-87) → patched into Move 6 Action.
- **F6 · INFO** — CI has no migrate step: the chain is proven ONLY by V4 local twice-run + Move 16 VM deploy → note added to Move 15 Failure.
- **F7 · INFO** — repo-wide `INVESTOR` grep returns 8 files (2 inert generated `qa_artifacts/schema_snapshot_*.sql`) → scope note added to Move 1 to prevent census confusion.

---

## 8. SELF-GRADE vs SUCCESS.md (8 points)

| # | Standard | Grade | Justification |
|---|---|---|---|
| 1 | Every move states its expected observation | **PASS** | Moves 0-18 each carry an **Expect** with concrete signals (exit codes, HTTP codes, constraint defs, count deltas — e.g. V3's parity-count-must-rise). |
| 2 | Every move carries likely failure + cause + counter-move | **PASS** | Every move has ≥1 failure/cause/counter triple; high-risk moves (5, 13, 15, 16) have multiple, each grounded in a registered debt class (D-12/D-17/D-38/D-42/D-45/D-52). |
| 3 | Every fork has a trigger | **PASS (after REVIEW-15 patches)** | F-A: T1/T2/T3 observable triggers (2-strike rule, census threshold ≥3 files, explicit Enzo answer). F-B: presence/absence of RN-1 answers at Move 9, re-checked before deploy — REVIEW-15 found two judgment-call leaks here (F1 unrepresentable answers, F2 "feel like invention"), both closed by the Move 9 representability guard + A4 deterministic rule. F-C: `node -v`. F-D: CI log content. No executor judgment calls remain. |
| 4 | Unsettled assumptions marked RECON NEEDED with the exact settling check | **PASS** | RN-1…RN-7, each with a literal command or "Enzo's written reply". The pricing question set (Q1-Q8) is exhaustive per the brief (tier count, price points/contact-us, billing unit, annual/monthly, tier contents, trial policy) + currency and nav-scope. |
| 5 | Abort conditions exist | **PASS** | A1-A7, each an observable stop-state with the required flag wording (incl. DoD-compliant `blocked-on-Enzo`). |
| 6 | Verification spelled out with pass criteria | **PASS** | V1-V11 table: command, when, pass — including the brief's three named live checks (200 it+en with the cookie-based EN mechanism verified in recon, real lead stored-and-removed with SQL evidence, rate-limit per-IP per the D-42 replay). |
| 7 | Survived a red-team pass, recorded | **PASS** | §7: one attack that failed (rate-limit vs sequential workers — disproven from `playwright.config.ts:47,52`) and one that succeeded (000153 delayed detonation, D-38 re-run) with its patch now welded into Move 5.3 + V4 + V9 ordering. |
| 8 | Executable blind by a mid-tier model | **PASS (after REVIEW-15 patches, with the one designed dependency)** | Every file:line, command, key name, testid, and email pattern is spelled out; counts are re-derived, not trusted. The single external dependency — Enzo's numbers — is by design NOT a question the executor must ask to proceed: Move 2 posts the set, and fork F-B route C ships a complete page on silence. REVIEW-15 F1/F2 were the only points where the executor had to invent or ask (uncovered RN-1 answers; silence-mode ambiguity) — both patched. The executor never has to invent or ask anything else. |

**Overall: 8/8 with the REVIEW-15 patches applied** (independent adversarial grade: **6/8 as-written** — points 3 and 8 failed on the F-B gaps F1/F2 — → **8/8 with F1-F5 applied**; all applied in this document, see §7 REVIEW-15 subsection). Residual weakest point is #8's reliance on the executor actually re-running the Move-1 census instead of trusting §1; mitigated by making the census a numbered move with its own failure branch and by ABORT A2.
