# GTM Front-Door Landing + Lead Capture — Design

**Date**: 2026-06-21 (S1002) · **Status**: approved (Enzo) · **Item**: #4 go-to-market (first deliverable)

## 1. Goal & context

The product is at v1.0.0 GA. `#4 go-to-market` is the keystone HOLD; the strategy was decided **hybrid** (investor + customer, S987). This spec is the **first GTM deliverable**: a **public front-door landing** at `www.heuresys.com/` that serves both audiences as the shared entry point.

Grounding (from `docs/product/`):
- **ICP** (PRD §1.4): mid-market EU, 250–2000 employees, regulated sectors (banking — the RTL_BANK reference tenant is a bank — insurance, healthcare, utility). Direct competitor ≈ one (365Talents), not 27.
- **Positioning** (PRD §1.5, adopted): *"The EU-native, ESCO-based, explainable (AI-Act) Skills & Org Intelligence platform for the regulated mid-market"*, on three real wedges: **① ESCO-native open** (no lock-in, EU public standard) · **② deterministic explainability = AI-Act compliance** (the most underrated wedge — turns "no black-box ML" into a feature) · **③ position-centric model** (org-design SAP serves at prohibitive cost).

### Decisions (locked with Enzo, S1002)
- **First deliverable** = public marketing front door (serves investor + customer).
- **Proof mechanism** = **gated lead form** (no live product exposure): message + 3 wedges + credibility, CTA "Prenota una demo" → lead capture. The real demo is 1:1, guided.
- **Placement** = `www.heuresys.com/` becomes the landing; the authenticated app stays behind `/login` + protected routes. Lead form → a real `/v1/leads` endpoint (leads land in the DB, exportable via the existing CSV/XLSX exporter).
- **PII/GDPR** = leads are **real opt-in PII** (first real PII in the system). Required **consent checkbox + privacy notice** in the form; consent timestamp + version stored; read RBAC-gated (PLATFORM_ADMIN). Conscious departure from the synthetic-no-PII posture (ADR-0023 governs the case-study data, not real business leads).

## 2. Architecture (5 units)

### A. Landing page — `apps/web/src/app/page.tsx` (public, `/`)
Replaces the current `redirect("/login")` with a single marketing page. Sections:
1. **Hero** — positioning headline (§1.5) + sub + primary CTA "Prenota una demo" (scrolls to the form) + a minimal top-nav with "Accedi" → `/login`.
2. **3 wedges** — ESCO-native / AI-Act explainability / position-centric, as cards (icon + claim + one-line proof).
3. **Per chi (ICP)** — mid-market EU regulated (banking/insurance/healthcare/utility), with the "excluded" honesty kept implicit.
4. **Credibilità** — EU open-standards story (ESCO), AI-Act auditability, "explainable not black-box". No product screenshots (gated choice).
5. **Lead form CTA + footer**.

Built from `@heuresys/ui` primitives + showcase brand components (HeroCentered/HeroSplit, Card, Button, FieldGrid, PageHeader, etc.). **i18n it+en** (the app is bilingual — both locales, IT default). Follows the existing a11y standard (the project has critical+serious a11y gates).

### B. Proxy — `apps/web/src/proxy.ts`
Make the **exact** path `/` public so the landing renders unauthenticated. `/login`, `/_next`, `/api`, `/showcase` and the authenticated routes are unchanged. (An authenticated user hitting `/` simply sees the public landing — no forced forward; the "Accedi" nav takes them to the app.)

### C. Lead-capture API module — `apps/api` (the 7-step module pattern)
- **Migration** `sys.sys_leads`: `lead_id` (uuid pk), `lead_name`, `lead_company`, `lead_email`, `lead_role` (nullable), `lead_company_size` (nullable varchar+CHECK band), `lead_message` (nullable), `lead_source` (varchar, default `'website'`), `lead_status` (varchar+CHECK NEW/CONTACTED/QUALIFIED/CLOSED, default `'NEW'`), `lead_consent_at` (timestamptz), `lead_consent_version` (varchar), `created_at`. Idempotent (`CREATE TABLE IF NOT EXISTS`). Registered in the reconciliation registry as **EXCLUDE** (app-authored, no legacy source).
- **`@heuresys/shared`** `schemas/leads.ts`: `LeadCreateSchema` (name, company, email [z.email], role?, companySize? [enum band], message? [max len], consent [literal true], website [honeypot, must be empty]) + `LeadResponseSchema` + subpath export.
- **`POST /v1/leads` — PUBLIC** (no `requirePermission`, **no `verifyCsrf`** — a public form has no session/CSRF cookie). Anti-abuse: **honeypot** (`website` field; if non-empty → return 200 success WITHOUT storing, so bots aren't tipped off) + **rate-limit** (per-IP, reuse `@fastify/rate-limit`, e.g. 5/min) + Zod validation (email format, max lengths) + **consent must be `true`** (else 400). Stores `consent_at = now()`, `consent_version` from a constant.
- **`GET /v1/leads` — `requirePermission('leads:read')`** (PLATFORM_ADMIN). Lists leads (newest first), filterable by status. Exportable via the existing zero-touch `?format=csv|xlsx` onSend hook.
- New permission `leads:read` (migration, mapped to PLATFORM_ADMIN).
- **Integration tests** (`buildTestApp`, live DB): public POST stores a lead (200 + row present); honeypot-filled POST returns 200 but stores nothing; missing consent → 400; GET as PLATFORM_ADMIN lists; GET as non-admin → 403; GET unauth → 403.

### D. Lead form — `apps/web/src/components/lead-form.tsx`
Composed from `@heuresys/ui` form primitives (Input, FieldGrid, Button, Checkbox, select). Fields: name, company, work email, role (optional), company size (optional select), message (optional), **consent checkbox (required) + privacy notice link**, hidden honeypot `website`. POSTs to `/api/v1/leads`. Success state ("Grazie, ti ricontattiamo") + error state. TanStack Query mutation. No `initialData`/placeholder.

### E. E2E — `apps/web/tests/e2e/landing.spec.ts` (Playwright, LIVE)
Anonymous (no auth): visit `/` → assert hero + the 3 wedge cards render → fill the lead form (real data, consent checked) → submit → success state → assert the lead is stored (via the PLATFORM_ADMIN `GET /v1/leads`, or a DB check in teardown). Honeypot path: a separate assertion that a bot-filled hidden field does not create a lead. Teardown deletes the E2E test leads (by a marker email domain, e.g. `@e2e.test`).

## 3. Security / PII / GDPR
- Leads = **real opt-in PII**. Lawful basis = **consent** captured in the form (required checkbox; `consent_at` + `consent_version` stored for audit). A short inline privacy notice + a placeholder `/privacy` link (the full privacy page is a follow-up).
- Read is **RBAC-gated** (PLATFORM_ADMIN, `leads:read`). The public POST writes only; it never reads back other leads.
- Anti-abuse on the public endpoint: honeypot + per-IP rate-limit + strict validation. No secrets, no auth bypass.
- **Retention**: documented policy (leads retained until converted/closed or 24 months, whichever first); the purge job is a **follow-up** (not in this deliverable).
- Logging: the lead POST handler must not log the full request body at info level (the email/name are opt-in contact PII). The pino redaction (`LOG_REDACT_PATHS`) targets secrets, not lead fields — so the route simply avoids body logging rather than relying on redaction.

## 4. Out of scope (YAGNI / follow-ups)
- Full `/privacy` + `/terms` pages (inline notice + placeholder link for now).
- Lead-management admin UI (status workflow, assignment) — v1 just stores + lists + exports.
- Retention purge job (policy documented, job later).
- Admin email notification on new lead (nice-to-have).
- Multi-page marketing site, blog, pricing page, analytics/tracking, A/B testing.
- Live product demo / sandbox (explicitly chosen against — gated form).

## 5. Build sequence (high level — detailed plan via writing-plans)
1. API-first: migration `sys_leads` + `leads:read` perm → shared schema → repo → service → routes (POST public + GET gated + anti-spam) → integration tests green.
2. Web: lead form component → landing page (5 sections, i18n it+en) → proxy `/` public.
3. E2E landing.spec green (LIVE). i18n parity + a11y + typecheck + eslint green.
4. Atomic commit(s); deploy to PROD; verify `www.heuresys.com/` shows the landing + a real submit lands a lead in the DB.

## 6. Definition of Done (LIVE, per the repo doctrine)
Every layer wired (shared → api → web → E2E), tests green, and a **live** submit on PROD creates a real lead row (real endpoint, real DB) — no mock. The landing renders publicly at `www.heuresys.com/`.
