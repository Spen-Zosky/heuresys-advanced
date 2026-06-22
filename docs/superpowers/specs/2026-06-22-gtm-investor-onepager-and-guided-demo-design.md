# GTM Deliverables 2 & 3 — Investor One-Pager + Interactive Guided Demo — Design

**Date**: 2026-06-22 (S1003) · **Status**: proposed (awaiting Enzo) · **Item**: #4 go-to-market (second + third deliverables)

## 1. Goal & context

The first GTM deliverable (S1002) shipped a public **front door** at `www.heuresys.com/` + GDPR lead capture (`/v1/leads`). It deliberately deferred two things it pointed at: a deeper **investor** artifact and a **product demo** (the landing's CTA is "Prenota una demo", and the spec recorded "the real demo is 1:1, guided" — `2026-06-21-gtm-front-door-landing-lead-capture-design.md:15`). This spec builds those two, on the exact same public-page foundation.

Enzo chose to build **both**: (A) an **Investor one-pager**, (B) an **Interactive guided demo**. Pricing was explicitly not chosen (depends on Enzo's numbers).

### Decisions locked with Enzo (S1003)

- **Funding ask** = **teaser, no numbers**. No amount, instrument, or valuation on the one-pager; the close is a soft CTA ("parliamone / let's talk"). A light, qualitative "where we're going" is allowed; no figures, no person-weeks, no detailed use-of-funds breakdown.
- **Traction/tone** = **honest, under-promise**. State plainly: *technical* GA live in production, **pre-commercial** (0 paying customers, synthetic case-study data, seeking design partners). No unverified IP/legal claims. This is exactly what the project's own due-diligence rewards as a strength (`docs/due-diligence/EXECUTIVE_SUMMARY.md:11-17`).
- **Positioning** = the line already adopted in the PRD and **already live in the landing** (do not re-litigate): *"The EU-native, ESCO-based, explainable (AI-Act) Skills & Org Intelligence platform for the regulated mid-market."* (`docs/product/BUSINESS_SCOPE_AND_PRD.md:62`, `apps/web/src/locales/it/landing.json:4`).
- **"BPM" framing** = honest scoping. We do NOT claim a process *runtime* (it does not exist — DD X1-001). We describe what is real: process **modeling + governance** (blueprints, RACI, SLA, multi-level approvals).
- **Demo mechanism** = a public **scripted guided tour** (`/demo`) built from **real screenshots** captured from the live app against the RTL_BANK reference tenant — **not** a public live sandbox of a real tenant (keeps the S1002 "no live product exposure" decision). The CTA is the same lead form. The 1:1 guided demo Enzo runs personally is unchanged and out of scope.

### Fresh discovery that changes the frame (S1003)

The due-diligence (S994) flagged "credibility gap #1": *Process Owner* and *Org Director* perspectives had no UI, so a demo could only show HR/Manager/Employee. **Gap#1 was closed S999→S1002**: `/org-director` (Porta 2 — capability maturity L0-L5 + CapabilityRadar) and `/process-owner` (Porta 1 — RACI drill-down) are **live now** (`docs/kb/SOT_STATE.md` Delta S999/S1002). Consequence: the guided demo can credibly show **all three "doors"**, and the one-pager can state that credibility gap as closed. This is a genuine, fresh strength.

### Live metrics harvested for the one-pager (all VERIFIED — query/file + output)

Source: S1003 discovery (psql against the live DB on the tunnel + on-disk counts). The one-pager presents these as facts "traceable to source" (the established credibility line "ogni numero è tracciabile alla sua fonte").

- DB-derivable (served **live** via the new public stats endpoint, see §3.2): **21,939 ESCO skills**, **126,051 occupation→skill requirement edges**, **7,675 ESCO occupation mappings**, **162 users**, **162 positions**, **26 org units**, **24 teams**, **12 RBAC roles**, **154 permissions**, **681 role×permission mappings**, **47 RBAC-gated UI interfaces**, **2 active tenancies**.
- Codebase facts (declared with an "as of S1003" provenance line — build facts, not runtime data): **84 business modules**, **432 `/v1/*` endpoints**, **150 idempotent migrations**, **1,080 API integration tests** (live DB, zero mocks) + **107 Playwright E2E**, **96 web pages** (admin SPA + ESS).
- Capital efficiency (qualitative, from DD): burn ≈ €0 (OCI free-tier + founder time).

## 2. Architecture overview

Three layers, built API-first:

```
Shared foundation (API + shared schema)
 ├─ F1. lead_source enum (WEBSITE | INVESTOR | DEMO) — segment the two new CTAs
 └─ F2. GET /v1/public/platform-stats — public, no-auth, rate-limited, no-PII aggregate counts (live metrics for the one-pager)

Deliverable A — Investor one-pager  (apps/web/src/app/investors/page.tsx, public /investors)
 ├─ live metrics tiles fed by F2 · honest-traction copy · 3 wedges · market/ICP · roadmap (qualitative) · soft CTA (LeadForm source=INVESTOR)
 └─ "Download PDF" → window.print() with a @media print stylesheet (no new deps)

Deliverable B — Guided demo  (apps/web/src/app/demo/page.tsx, public /demo)
 ├─ 11-step scripted tour: real screenshot + caption (persona/route/narration) per step
 ├─ screenshots captured by a re-runnable Playwright spec from the live app (RTL_BANK), reusing the persona storageState (handles mandatory MFA)
 └─ closing CTA (LeadForm source=DEMO)
```

Both web pages reuse the §A pattern from the first deliverable verbatim: `"use client"` page, `useTranslation(<ns>)`, `@heuresys/ui` primitives only (no new UI deps — they belong upstream in `@heuresys/ui`), one string added to `PUBLIC_PATHS` in `proxy.ts`, a new i18n namespace wired in `lib/i18n.ts` (IT source + EN parity, `pnpm i18n:check` green), `no-literal-string` eslint satisfied (every string via `t()`), and a sibling anonymous live E2E.

## 3. Shared foundation (build first, API-first)

### 3.1 — `lead_source` enum (F1)

The `sys_leads` table already has `lead_source varchar default 'website'` (`db/migrations/000152_leads.sql`). Today the client cannot set it (server defaults to `website`). Extend so the two new CTAs are segmentable in the pipeline:

- **Migration** (next number): widen / add a `CHECK (lead_source IN ('WEBSITE','INVESTOR','DEMO'))` (RD-08: varchar+CHECK, never ENUM). Normalize the existing default to `'WEBSITE'`. Idempotent; backfill existing rows `'website'→'WEBSITE'`.
- **`@heuresys/shared/schemas/leads.ts`**: add `source: z.enum(['WEBSITE','INVESTOR','DEMO']).optional()` to `LeadCreateSchema`. Client-settable; it is pure categorization (no trust/security impact — an abuser setting `source` is harmless), still bounded by the enum.
- **Service**: persist `source ?? 'WEBSITE'`. `LeadResponseSchema` already returns source; ensure it's surfaced. GET/export unchanged (still `leads:read`, PLATFORM_ADMIN).
- **`LeadForm`** (`apps/web/src/components/lead-form.tsx`): add an optional prop `source?: 'WEBSITE'|'INVESTOR'|'DEMO'` (default `'WEBSITE'`), included in the POST body. Landing keeps the default → behavior-preserving; the one-pager passes `INVESTOR`, the demo passes `DEMO`.
- **Tests**: extend `apps/api/test/leads.integration.test.ts` — POST with `source=INVESTOR` stores `INVESTOR`; POST without source stores `WEBSITE`; invalid source → 400. Existing landing E2E stays green (default unchanged).

### 3.2 — `GET /v1/public/platform-stats` (F2)

A public, read-only, aggregate-only endpoint feeding the one-pager's live metric tiles (honors DoD "live data, no hardcode" for the DB-derivable numbers).

- **New module** `apps/api/src/modules/public-stats/` (7-step pattern): `repository.ts` runs a handful of `SELECT count(*)` queries (skills, occupation-skill edges, occupation mappings, users, positions, org units, teams, roles, permissions, role×permission mappings, UI interfaces, active tenancies — the exact set in §1). `service.ts` assembles the response; `routes.ts` registers `GET /v1/public/platform-stats`.
- **Public**: no `requirePermission`, no `verifyCsrf` (no session). **Rate-limited** per-IP (reuse `@fastify/rate-limit`, e.g. 30/min — read-only, cheap). **No PII**: only integer aggregates; never row data. **No tenant data leak**: counts are platform-wide aggregates of the synthetic case-study data (ADR-0023, safe to publish).
- **`@heuresys/shared/schemas/public-stats.ts`**: `PlatformStatsResponse` (all fields `z.number().int().nonnegative()`), subpath export `./schemas/public-stats`.
- **Caching**: counts are cheap but the endpoint is public → add a short in-process TTL cache (e.g. 5 min) in the service to bound load. (Stale-by-≤5-min is fine for a marketing stat.)
- **Tests** (`buildTestApp`, live DB): GET returns 200 with all integer fields present and `> 0` for the moat metrics (skills, edges); unauth still 200 (it's public); a malformed query is rejected by Zod. Rate-limit config asserted.
- **Register** in `app.ts` step 13: `app.register(publicStatsRoutes, { prefix: '/v1/public' })`.

## 4. Deliverable A — Investor one-pager

### 4.1 — Route & wiring
- New page `apps/web/src/app/investors/page.tsx` (`"use client"`, `useTranslation("investors")`), sibling of `(authenticated)/` — NOT inside the auth group.
- `apps/web/src/proxy.ts`: add `"/investors"` to `PUBLIC_PATHS`.
- New i18n namespace `investors` (IT source + EN parity) wired into `lib/i18n.ts` (import both, add to `NAMESPACES`, add to `resources.it`/`resources.en`).
- Composed from `@heuresys/ui` primitives already used by the landing (`Card`, `CardContent`, `Button`, `HeuresysWordmark`) + token styling (`bg-background text-foreground text-muted-foreground border-border`). No new deps.

### 4.2 — Sections (honest, teaser, under-promise)
1. **Header/nav** — wordmark + "Accedi" (`/login`) + "Download PDF" button (`window.print()`). `data-testid` on each.
2. **Hero** — positioning headline (the adopted line) + a one-line honest thesis sub: *"GA tecnica in produzione, pre-commerciale — fondazione di prodotto solida, in cerca di design partner."*
3. **The opportunity** — EU regulated mid-market needs Skills & Org intelligence on an open standard (ESCO) with AI-Act-grade explainability; in that niche the direct competitor is ≈ one (365Talents), not 27.
4. **What we've built — live proof** — a tile grid: the **live** DB metrics (fetched from `F2`, with a small "live" indicator) + the codebase facts (with an "as of S1003" provenance line). Lead the grid with the moat: **21,939 ESCO skills · 126,051 occupation→skill edges**. Tagline: "ogni numero è tracciabile alla sua fonte / every number traces back to its source."
5. **3 wedges** — ESCO-native open · deterministic explainability = AI-Act compliance · position-centric model (reuse the landing's proven copy, expanded one line each).
6. **Traction — honest** — explicit: technical GA live (`www.heuresys.com`), **0 paying customers**, synthetic case-study reference tenant (RTL_BANK, a bank), **seeking design partners**; capital efficiency (burn ≈ €0). Plus the fresh win: "credibility gap #1 closed — all three perspectives (HR, Process Owner, Org Director) now have live UI."
7. **Why now / why us** — ESCO + AI-Act timing; under-promise engineering discipline (self-exposes its own findings; 23 ADRs); defensible standards-aligned data layer.
8. **Where we're going** (qualitative, NO numbers) — de-personalize infra → grow the team → commercial layer (signup/billing/onboarding) → EU compliance formalization → first paid pilot. One sentence, no figures, no timeline.
9. **Soft CTA** — "Parliamone / Let's talk" → the `LeadForm` (`source="INVESTOR"`) in a contact section, OR a `mailto:` — **decision: reuse `LeadForm`** (captures the lead into the pipeline, segmented as INVESTOR; better than a mailto). Footer reuses the landing tagline.

### 4.3 — PDF export (print-CSS)
- A "Download PDF" `Button` calls `window.print()` (client concern → page stays `"use client"`).
- `print:hidden` Tailwind variants on the chrome (nav, the "Download PDF" button, the CTA form, footer) + a small `@media print` block in `apps/web/src/app/globals.css` for page-level rules (light-on-white, A4 margins, `break-inside-avoid` on metric tiles). The rendered page IS the PDF (single source of truth, i18n-localized IT/EN — no drift, no new dep).
- Rejected: server-side puppeteer/@react-pdf (banned heavy dep + Chromium on the PROD VM) and a pre-rendered static PDF (drifts from live numbers, not localizable).

### 4.4 — E2E (`apps/web/tests/e2e/investors.spec.ts`, anonymous, LIVE)
- Anonymous `goto("/investors")` → assert hero + the live-metrics grid renders + at least one metric tile shows a number fetched from `F2` (assert the value is numeric/non-empty, proving the live fetch) + the 3 wedges + the "Download PDF" button is present.
- A real CTA round-trip: fill the contact `LeadForm` → submit → success state → (teardown) the lead row exists with `source='INVESTOR'`, deleted by the `@leads-e2e.test` marker (reuse the landing teardown pattern + the new `global-teardown` D-29).

## 5. Deliverable B — Interactive guided demo

### 5.1 — Screenshot capture (live data, re-runnable)
- A dedicated Playwright spec `apps/web/tests/e2e/capture-demo.spec.ts` (run on demand, not in the default suite) logs in as the personas and captures the 11 storyboard screens against the **live RTL_BANK reference tenant**, saving PNGs to `apps/web/public/demo/<NN>-<slug>.png`.
- **MFA**: every persona carries a verified e2e-fixture TOTP factor (mandatory MFA is live, S984). The capture **reuses the existing persona `storageState`** produced by `apps/web/tests/e2e/auth.setup.ts` (which already solves login + TOTP) — no new TOTP handling. The capture spec depends on the `setup` project like the rest of the prod suite.
- **Safety**: screenshots contain only synthetic RTL_BANK case-study data (no real PII — ADR-0023 / I12), so the frozen PNG artifacts are safe to publish. A capture step crops/zooms to the relevant panel where helpful.
- **Drift mitigation**: the capture is a versioned, re-runnable spec → screenshots are a re-derivable artifact, regenerated when the UI changes (not a manual chore). PNGs are committed (they are the demo's content).

### 5.2 — Storyboard (11 steps — the discovery storyboard, persona-driven)
| # | Persona | Route | Shows | Narration (one line) |
|---|---|---|---|---|
| 1 | prospect (logged out) | `/` → `/login` | landing + GDPR lead form, then login | "What a buyer sees — and how a lead becomes a record." |
| 2 | Federica (TENANT_ADMIN) | `/dashboard` → `/organization/org-chart` | tenant overview + live RTL org chart (162 positions, 26 OUs) | "Position-centric: the chair, not the person — RTL Bank's real structure." |
| 3 | Federica | `/positions/[id]` | a position with its skills/KPIs/learning tabs | "A position carries its own requirements, independent of who sits in it." |
| 4 | Federica | `/analytics/skills` → `/gaps` | OU×proficiency coverage heatmap + skill-gap register | "Where the bank is strong vs thin — computed live, not a slide." |
| 5 | Federica | `/insights` → `/insights/succession-readiness` | flight-risk + succession, explainability panel open | "Predictive people analytics — and *why*: every score breaks into weighted features." |
| 6 ⭐ | Federica | `/org-director` | MLCE composite + Maturity L0-L5 per OU + CapabilityRadar | "Organizational capability maturity, rolled up bottom-up from real evidence." |
| 7 | Federica | `/processes` → `/process-owner` | BPM blueprints + RACI (105 assignments / 23 processes) | "Processes are owned, with live RACI accountability per org unit." |
| 8 | Tommaso (USER) | `/me` → `/me/skills/self-assessment` → `/me/matching` | ESS chrome shrinks; self-assess; AI occupation/position match % | "Same platform, employee's eyes: I rate my skills, the engine matches me to roles." |
| 9 | Paolo (MANAGER) | `/me/team` (+ Antonio not visible) | manager sees only his reports; outsider invisible | "Scope is enforced, not cosmetic — a manager sees his team, no further." |
| 10 | Paolo/Federica | `/me/inbox` ↔ `/approvals/[id]` | an approval flows to the inbox; decision applies a real effect | "Decisions move through a real, SLA-tracked, multi-level workflow." |
| 11 | Platform Admin | `/dev/agent` | prompt → SSE stream → human-in-the-loop write-gate | "Agent-ready: an AI can act, but a human approves every write." |

⭐ = wow-moment (step 6): the maturity downgrade (composite 92.9 → L2 because KPI achievement is weak) shows the system telling an uncomfortable truth rather than flattering the data — the credibility kicker. Step 11 is feature-flagged (`NEXT_PUBLIC_ENABLE_AGENT_DEV`); if the agent gateway isn't reachable at capture time, drop step 11 to 10 steps and keep step 6 as the closer.

### 5.3 — Demo page & wiring
- New page `apps/web/src/app/demo/page.tsx` (`"use client"`, `useTranslation("demo")`): renders the steps as a vertical scroll (or stepper) — each step = the screenshot (`next/image` or `<img>` from `/demo/*.png`) + caption (persona badge + route + narration), all text via `t()`. Closing section = `LeadForm` (`source="DEMO"`) + the landing footer.
- `proxy.ts`: add `"/demo"` to `PUBLIC_PATHS`.
- New i18n namespace `demo` (IT source + EN parity) wired into `lib/i18n.ts` — keys: `hero.{title,subtitle}`, `steps.<NN>.{persona,shows,narration}`, `cta.{title,subtitle}`, plus reuse of `form.*`/`footer.*` (the LeadForm uses the `landing` namespace; demo page chrome uses `demo`).
- Composed from `@heuresys/ui` primitives only. Images: keep PNGs reasonably sized; lazy-load below the fold.

### 5.4 — E2E (`apps/web/tests/e2e/demo.spec.ts`, anonymous, LIVE)
- Anonymous `goto("/demo")` → assert the hero + the first N step blocks render (each `data-testid="demo-step-<NN>"` visible, screenshot `<img>` present) + the CTA section.
- A real CTA round-trip: fill the `LeadForm` → submit → success → (teardown) lead row exists with `source='DEMO'`, deleted by the marker.

## 6. Security / PII / GDPR
- `GET /v1/public/platform-stats`: public but aggregate-only integers (no PII, no row data, no tenant leak); per-IP rate-limited; TTL-cached. ADR-0023 makes the underlying case-study data safe to count publicly.
- `lead_source`: client-settable categorization only; no trust impact; bounded by enum + existing honeypot + rate-limit + consent on the POST.
- Demo screenshots: synthetic case-study data only (no real PII); frozen, vetted artifacts — no live tenant exposure (keeps the S1002 decision).
- One-pager / demo CTAs: same anti-abuse as the landing (honeypot + rate-limit + `consent: z.literal(true)` + no body logging).
- No new public *write* surface beyond the already-shipped `/v1/leads` POST (the two CTAs reuse it). The only new public endpoint is the read-only stats GET.

## 7. Out of scope (YAGNI / follow-ups)
- Funding numbers / valuation / detailed use-of-funds (Enzo chose teaser).
- Pricing page (not chosen).
- Lead-management admin UI / source-segmented pipeline views (HOLD #4 GTM v1-deferrals — GET + CSV/XLSX export already segment by source).
- A live public product sandbox / auto-login demo persona (explicitly chosen against — fallback noted, not built).
- Live in-app tour overlay (driver.js/react-joyride) — new UI dep, belongs upstream in `@heuresys/ui`.
- Video walkthrough; analytics/tracking; A/B testing; multi-page marketing site.
- Real funding-stat history / time-series on the one-pager (single live snapshot only).

## 8. Build sequence (high level — detailed plan via writing-plans)
1. **Foundation (API-first)**: F1 `lead_source` enum (migration → shared schema → service → tests) → F2 `/v1/public/platform-stats` (migration none; module → shared schema → repo/service/routes → register → tests). `pnpm test` green.
2. **One-pager (A)**: `investors` i18n (it+en) → page (sections + live tiles from F2 + print CSS) → `LeadForm source=INVESTOR` → proxy `/investors` public → `investors.spec.ts` E2E live. typecheck + eslint + i18n:check green. Atomic commit.
3. **Demo (B)**: `capture-demo.spec.ts` → run capture against live RTL_BANK (reuse persona storageState) → PNGs in `public/demo/` → `demo` i18n (it+en) → `demo/page.tsx` (steps + `LeadForm source=DEMO`) → proxy `/demo` public → `demo.spec.ts` E2E live. Gates green. Atomic commit.
4. **Deploy + live-verify**: `scripts/vm-deploy.sh` on `oracle-vm-default`; verify `www.heuresys.com/investors` (renders + live stats + print) and `www.heuresys.com/demo` (renders + steps) publicly; a real INVESTOR + DEMO lead each land in the DB; delete the verification rows.

## 9. Definition of Done (LIVE, per the repo doctrine)
Each deliverable is done only when every layer is wired (shared → api → web → E2E), all gates green (typecheck all-ws, vitest API suite, Playwright prod, i18n parity, eslint, a11y), and a **live** action on PROD proves it: `www.heuresys.com/investors` renders publicly with metric tiles fed by the live `/v1/public/platform-stats` and prints to PDF; `www.heuresys.com/demo` renders the screenshot tour publicly; a real INVESTOR and a real DEMO lead are created via the live endpoints and observed in the DB. No mock, no placeholder hard-coded number in any data path (codebase facts are declared with provenance, not faked). The teaser one-pager carries no funding figures by design (Enzo's decision) — that is not a placeholder, it is the chosen scope.
