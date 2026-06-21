# GTM Front-Door Landing + Lead Capture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public marketing landing at `www.heuresys.com/` with a GDPR-consented lead-capture form backed by a real `/v1/leads` endpoint.

**Architecture:** API-first. A `leads` Fastify module (public POST + admin GET) over a new `sys.sys_leads` table feeds a public Next.js landing page that replaces the root `redirect("/login")`. The proxy is opened for the exact path `/`. Everything wired shared→api→web→E2E, no mocks (LIVE-DATA-E2E-ONLY).

**Tech Stack:** pnpm monorepo · Fastify 5 + Zod (fastify-type-provider-zod) + PostgreSQL 16 (apps/api) · Next.js 15 App Router (apps/web) · `@heuresys/ui` primitives · `@heuresys/shared` Zod schemas · react-hook-form + zodResolver · TanStack Query · Playwright.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-06-21-gtm-front-door-landing-lead-capture-design.md`.
- **Module pattern (mandatory, CLAUDE.md):** shared Zod schema → repo (raw parameterized SQL vs `sys.sys_<plural>`, `$1,$2` never interpolation) → service (ActorContext) → routes (`FastifyPluginAsyncZod`) → register in `app.ts` step 13 → integration test via `buildTestApp()` → `pnpm test` green → atomic commit.
- **Errors:** throw typed classes from `src/errors/index.ts` (`ValidationError`, `ForbiddenError`, …) with a SCREAMING_SNAKE code 2nd arg.
- **TS strict:** `noUncheckedIndexedAccess`, `noUnusedLocals/Parameters` (prefix unused `_`), `exactOptionalPropertyTypes` OFF.
- **i18n:** every web string via `useTranslation`; it (default) + en parity (`pnpm i18n:check` must stay green); `no-literal-string` eslint is `error` on `apps/web/src/app/**`.
- **Migration:** next sequential number after `000151` = **`000152`**; idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`); must survive `migrate.sh` twice-run (D-38).
- **Live DB:** OCI VM via SSH tunnel `:5433` (must be up). PROD deploy = `scripts/vm-deploy.sh`.
- **E2E on Windows:** run via the Node-22 wrapper — `pnpm --filter @heuresys/web test:e2e:prod:node22` (or `test:e2e:node22 <spec>` for a single spec in dev).
- **Consent constant:** `LEAD_CONSENT_VERSION = "2026-06-21-v1"` (used by the API when stamping `lead_consent_at`).
- **Company-size bands (varchar+CHECK, never ENUM — RD-08):** `'LT_50' | '50_250' | '250_2000' | 'GT_2000'`.

---

### Task 1: DB migration — `sys_leads` + `leads:read` permission + registry EXCLUDE

**Files:**
- Create: `db/migrations/000152_leads.sql`

**Interfaces:**
- Produces: table `sys.sys_leads`; permission code `leads:read` mapped to `PLATFORM_ADMIN`; registry row `sys_leads`=EXCLUDE.

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================================
-- 000152_leads.sql — GTM lead capture (#4 front-door). A public website lead
-- form (POST /v1/leads) stores prospects here; admin reads via leads:read.
-- Real opt-in PII (consent captured in the form) — read RBAC-gated. Idempotent.
-- Authored: 2026-06-21 (S1002, #4 go-to-market).
-- ============================================================================

CREATE TABLE IF NOT EXISTS sys.sys_leads (
  lead_id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_name             varchar(200) NOT NULL,
  lead_company          varchar(200) NOT NULL,
  lead_email            varchar(320) NOT NULL,
  lead_role             varchar(160),
  lead_company_size     varchar(16) CHECK (lead_company_size IN ('LT_50','50_250','250_2000','GT_2000')),
  lead_message          text,
  lead_source           varchar(40) NOT NULL DEFAULT 'website',
  lead_status           varchar(16) NOT NULL DEFAULT 'NEW' CHECK (lead_status IN ('NEW','CONTACTED','QUALIFIED','CLOSED')),
  lead_consent_at       timestamptz NOT NULL,
  lead_consent_version  varchar(32) NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sys_leads_created_idx ON sys.sys_leads (created_at DESC);

-- Permission leads:read → PLATFORM_ADMIN (the registry/list side; the POST is public).
INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_description)
VALUES ('leads:read', 'Read website lead submissions')
ON CONFLICT (auth_permission_code) DO NOTHING;

INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
JOIN sys.sys_auth_permissions p ON p.auth_permission_code = 'leads:read'
WHERE r.auth_role_code = 'PLATFORM_ADMIN'
  AND NOT EXISTS (
    SELECT 1 FROM sys.sys_auth_role_permissions rp
    WHERE rp.auth_role_id = r.auth_role_id AND rp.auth_permission_id = p.auth_permission_id
  );

-- Reconciliation registry: app-authored, no legacy source.
INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name, reconciliation_registry_bucket,
   reconciliation_registry_declared_status, reconciliation_registry_legacy_source,
   reconciliation_registry_rationale)
VALUES
  ('sys_leads', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — app-authored GTM website leads (mig 000152, #4). Real opt-in prospect PII captured via the public POST /v1/leads form with consent; never imported from legacy.]')
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM sys.sys_auth_role_permissions rp
   JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
   WHERE p.auth_permission_code = 'leads:read' AND r.auth_role_code = 'PLATFORM_ADMIN';
  IF n <> 1 THEN RAISE EXCEPTION '000152: expected leads:read mapped to PLATFORM_ADMIN, found %', n; END IF;
  RAISE NOTICE '000152: sys_leads + leads:read (PLATFORM_ADMIN) + registry EXCLUDE.';
END $$;
```

> Note: verify `sys_reconciliation_registry` has a unique on `reconciliation_registry_table_name` for the `ON CONFLICT`; if not, replace that INSERT with a `WHERE NOT EXISTS` guard on the table name.

- [ ] **Step 2: Apply live + verify**

Run: `psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -v ON_ERROR_STOP=1 -f db/migrations/000152_leads.sql`
Expected: `CREATE TABLE` … `NOTICE: 000152: sys_leads + leads:read …`

- [ ] **Step 3: Prove twice-run idempotency**

Run the same `-f` command again. Expected: no error, same NOTICE, `INSERT 0 0` on the conflict inserts.

- [ ] **Step 4: Full chain re-run (D-38 safety)**

Run: `pnpm db:migrate:sh`
Expected: `OK: 150 migrations applied.`

- [ ] **Step 5: Commit**

```bash
git add db/migrations/000152_leads.sql
git commit -m "feat(db): #4 — sys_leads + leads:read + registry EXCLUDE (mig 000152)"
```

---

### Task 2: Shared schema — `@heuresys/shared/schemas/leads`

**Files:**
- Create: `packages/shared/src/schemas/leads.ts`
- Modify: `packages/shared/src/index.ts` (add export), `packages/shared/package.json` (add subpath)

**Interfaces:**
- Produces: `LeadCreateSchema`, `LeadCreate`, `LeadResponseSchema`, `LeadResponse`, `LeadListResponseSchema`, `LeadCompanySizeEnum`.

- [ ] **Step 1: Write the schema file**

```ts
/**
 * @heuresys/shared — website lead-capture (GTM #4) schemas.
 * Backs the PUBLIC POST /v1/leads (consent-gated, honeypot anti-spam) + the
 * admin GET /v1/leads (leads:read). Zod v4 API.
 */
import { z } from "zod";

export const LeadCompanySizeEnum = z.enum(["LT_50", "50_250", "250_2000", "GT_2000"]);
export type LeadCompanySize = z.infer<typeof LeadCompanySizeEnum>;

/** Public submission. `website` is a honeypot — real users never fill it. */
export const LeadCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  company: z.string().trim().min(1).max(200),
  email: z.email().max(320),
  role: z.string().trim().max(160).optional(),
  companySize: LeadCompanySizeEnum.optional(),
  message: z.string().trim().max(2000).optional(),
  consent: z.literal(true),
  website: z.string().max(0).optional().default(""), // honeypot: must be empty
});
export type LeadCreate = z.infer<typeof LeadCreateSchema>;

export const LeadCreateResponseSchema = z.object({ ok: z.literal(true) });

export const LeadResponseSchema = z.object({
  leadId: z.uuid(),
  name: z.string(),
  company: z.string(),
  email: z.string(),
  role: z.string().nullable(),
  companySize: LeadCompanySizeEnum.nullable(),
  message: z.string().nullable(),
  source: z.string(),
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "CLOSED"]),
  consentAt: z.iso.datetime(),
  consentVersion: z.string(),
  createdAt: z.iso.datetime(),
});
export type LeadResponse = z.infer<typeof LeadResponseSchema>;

export const LeadListResponseSchema = z.object({
  items: z.array(LeadResponseSchema),
  total: z.number().int().min(0),
});
export type LeadListResponse = z.infer<typeof LeadListResponseSchema>;
```

- [ ] **Step 2: Export from index + package.json**

In `packages/shared/src/index.ts` add (alphabetically near other schema exports):
```ts
export * from "./schemas/leads.js";
```
In `packages/shared/package.json` `exports`, add a subpath mirroring `./schemas/auth`:
```json
"./schemas/leads": {
  "types": "./dist/schemas/leads.d.ts",
  "default": "./src/schemas/leads.ts"
},
```

- [ ] **Step 3: Build shared + typecheck**

Run: `pnpm --filter @heuresys/shared build && pnpm --filter @heuresys/shared exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/schemas/leads.ts packages/shared/src/index.ts packages/shared/package.json
git commit -m "feat(shared): #4 — lead-capture Zod schemas (@heuresys/shared/schemas/leads)"
```

---

### Task 3: API module — repository + service

**Files:**
- Create: `apps/api/src/modules/leads/repository.ts`, `apps/api/src/modules/leads/service.ts`

**Interfaces:**
- Consumes: `LeadCreate`, `LeadResponse`, `LeadCompanySize` (Task 2); `ActorContext` from `../../lib/actor.js`; `pool` from `../../db/client.js`.
- Produces: `leadsService.create(input: LeadCreate): Promise<{ ok: true }>`, `leadsService.list(actor: ActorContext): Promise<LeadListResponse>`.

- [ ] **Step 1: repository.ts**

```ts
/**
 * apps/api/src/modules/leads/repository.ts — raw SQL over sys.sys_leads.
 */
import { pool } from "../../db/client.js";
import type { LeadResponse, LeadCompanySize } from "@heuresys/shared";

export interface InsertLeadRow {
  name: string; company: string; email: string;
  role: string | null; companySize: LeadCompanySize | null; message: string | null;
  consentVersion: string;
}

export async function insertLead(r: InsertLeadRow): Promise<void> {
  await pool.query(
    `INSERT INTO sys.sys_leads
       (lead_name, lead_company, lead_email, lead_role, lead_company_size,
        lead_message, lead_source, lead_consent_at, lead_consent_version)
     VALUES ($1,$2,$3,$4,$5,$6,'website', now(), $7)`,
    [r.name, r.company, r.email, r.role, r.companySize, r.message, r.consentVersion],
  );
}

export async function listLeads(): Promise<LeadResponse[]> {
  const res = await pool.query(
    `SELECT lead_id, lead_name, lead_company, lead_email, lead_role, lead_company_size,
            lead_message, lead_source, lead_status, lead_consent_at, lead_consent_version, created_at
       FROM sys.sys_leads ORDER BY created_at DESC`,
  );
  return res.rows.map((x: Record<string, unknown>) => ({
    leadId: x.lead_id as string,
    name: x.lead_name as string,
    company: x.lead_company as string,
    email: x.lead_email as string,
    role: (x.lead_role as string | null),
    companySize: (x.lead_company_size as LeadCompanySize | null),
    message: (x.lead_message as string | null),
    source: x.lead_source as string,
    status: x.lead_status as LeadResponse["status"],
    consentAt: (x.lead_consent_at as Date).toISOString(),
    consentVersion: x.lead_consent_version as string,
    createdAt: (x.created_at as Date).toISOString(),
  }));
}
```

- [ ] **Step 2: service.ts**

```ts
/**
 * apps/api/src/modules/leads/service.ts — lead capture business logic.
 * The honeypot + consent checks live here; the route is a thin public POST.
 */
import type { ActorContext } from "../../lib/actor.js";
import type { LeadCreate, LeadListResponse } from "@heuresys/shared";
import * as repo from "./repository.js";

export type { ActorContext };

/** Set once; the form stamps consent with this version for audit. */
export const LEAD_CONSENT_VERSION = "2026-06-21-v1";

export const leadsService = {
  /** Public. Honeypot-filled submissions are silently accepted but NOT stored
   *  (don't tip off bots). Consent is enforced by the Zod literal(true) upstream. */
  async create(input: LeadCreate): Promise<{ ok: true }> {
    if (input.website && input.website.length > 0) return { ok: true }; // honeypot trip
    await repo.insertLead({
      name: input.name,
      company: input.company,
      email: input.email,
      role: input.role ?? null,
      companySize: input.companySize ?? null,
      message: input.message ?? null,
      consentVersion: LEAD_CONSENT_VERSION,
    });
    return { ok: true };
  },

  async list(_actor: ActorContext): Promise<LeadListResponse> {
    const items = await repo.listLeads();
    return { items, total: items.length };
  },
};
```

- [ ] **Step 3: typecheck**

Run: `cd apps/api && pnpm exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/leads/repository.ts apps/api/src/modules/leads/service.ts
git commit -m "feat(api): #4 — leads module repository + service"
```

---

### Task 4: API module — routes + registration

**Files:**
- Create: `apps/api/src/modules/leads/routes.ts`
- Modify: `apps/api/src/app.ts` (register at step 13)

**Interfaces:**
- Consumes: `leadsService` (Task 3); `requirePermission` from `../../middleware/rbac.js`; schemas from `@heuresys/shared`.
- Produces: `leadsRoutes: FastifyPluginAsyncZod` registered at prefix `/v1/leads`.

- [ ] **Step 1: routes.ts**

```ts
/**
 * apps/api/src/modules/leads/routes.ts — /v1/leads.
 * POST = PUBLIC (no auth, no CSRF — a public website form) + per-IP rate-limit +
 * honeypot (in the service). GET = leads:read (PLATFORM_ADMIN), CSV/XLSX-exportable
 * via the global onSend exporter.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import {
  LeadCreateSchema,
  LeadCreateResponseSchema,
  LeadListResponseSchema,
} from "@heuresys/shared";
import { leadsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const leadsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    "/",
    {
      config: { rateLimit: { max: 5, timeWindow: 60 * 1000 } },
      schema: { body: LeadCreateSchema, response: { 200: LeadCreateResponseSchema } },
    },
    async (req) => leadsService.create(req.body),
  );

  app.get(
    "/",
    { preHandler: [requirePermission("leads:read")], schema: { response: { 200: LeadListResponseSchema } } },
    async (req) => leadsService.list(actor(req)),
  );
};
```

- [ ] **Step 2: Register in app.ts step 13**

In `apps/api/src/app.ts`, after the `approvalsRoutes` registration (line ~427), add:
```ts
  await app.register(leadsRoutes, { prefix: "/v1/leads" });
```
and add the import near the other module-route imports:
```ts
import { leadsRoutes } from "./modules/leads/routes.js";
```

- [ ] **Step 3: typecheck**

Run: `cd apps/api && pnpm exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/leads/routes.ts apps/api/src/app.ts
git commit -m "feat(api): #4 — /v1/leads routes (public POST + gated GET)"
```

---

### Task 5: API integration test

**Files:**
- Create: `apps/api/test/leads.integration.test.ts`

**Interfaces:**
- Consumes: `buildTestApp` (`./helpers/build-test-app.js`), `loginRaw` (`./helpers/login.js`), `pool` (`../src/db/client.js`).

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const E2E_DOMAIN = "@leads-it.test";

function cookieHeader(cookies: { name: string; value: string }[]) {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

let suite: TestApp;
let adminCookies: string;
let adminCsrf: string;

beforeAll(async () => {
  suite = await buildTestApp();
  const r = await loginRaw(suite.app, "admin@heuresys.com", PWD);
  adminCookies = cookieHeader(r.cookies);
  adminCsrf = (r.json() as { csrfToken: string }).csrfToken;
  await pool.query(`DELETE FROM sys.sys_leads WHERE lead_email LIKE $1`, [`%${E2E_DOMAIN}`]);
});

afterAll(async () => {
  await pool.query(`DELETE FROM sys.sys_leads WHERE lead_email LIKE $1`, [`%${E2E_DOMAIN}`]);
  await suite.app.close();
});

describe("/v1/leads (GTM lead capture)", () => {
  it("public POST stores a lead (no auth, no CSRF)", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/leads",
      payload: { name: "Mario Rossi", company: "Banca X", email: `mario${E2E_DOMAIN}`, companySize: "250_2000", consent: true },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ ok: true });
    const { rows } = await pool.query(`SELECT lead_consent_version FROM sys.sys_leads WHERE lead_email=$1`, [`mario${E2E_DOMAIN}`]);
    expect(rows.length).toBe(1);
    expect(rows[0].lead_consent_version).toBe("2026-06-21-v1");
  });

  it("honeypot-filled POST returns ok but stores nothing", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/leads",
      payload: { name: "Bot", company: "Spam", email: `bot${E2E_DOMAIN}`, consent: true, website: "http://spam" },
    });
    expect(r.statusCode).toBe(200);
    const { rows } = await pool.query(`SELECT 1 FROM sys.sys_leads WHERE lead_email=$1`, [`bot${E2E_DOMAIN}`]);
    expect(rows.length).toBe(0);
  });

  it("missing consent → 400", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/leads",
      payload: { name: "No Consent", company: "X", email: `nc${E2E_DOMAIN}` },
    });
    expect(r.statusCode).toBe(400);
  });

  it("GET as PLATFORM_ADMIN lists leads", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/leads", headers: { cookie: adminCookies, "x-csrf-token": adminCsrf } });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { email: string }[]; total: number };
    expect(body.items.some((x) => x.email === `mario${E2E_DOMAIN}`)).toBe(true);
  });

  it("GET without auth → 403", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/leads" });
    expect(r.statusCode).toBe(403);
  });
});
```

- [ ] **Step 2: Run the test (gate)**

Run: `cd apps/api && pnpm exec vitest run test/leads.integration.test.ts`
Expected: `Tests  5 passed (5)`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/leads.integration.test.ts
git commit -m "test(api): #4 — /v1/leads integration (public POST, honeypot, gated GET)"
```

---

### Task 6: Web — i18n landing namespace

**Files:**
- Create: `apps/web/src/locales/it/landing.json`, `apps/web/src/locales/en/landing.json`
- Modify: `apps/web/src/lib/i18n.ts`

**Interfaces:**
- Produces: namespace `landing` with keys consumed by Tasks 7–8.

- [ ] **Step 1: it/landing.json**

```json
{
  "nav": { "login": "Accedi", "cta": "Prenota una demo" },
  "hero": {
    "title": "La piattaforma Skills & Org Intelligence EU-native, ESCO-based e spiegabile per il mid-market regolato",
    "subtitle": "Governa competenze, posizioni e capacità organizzativa con uno standard pubblico europeo (ESCO) e raccomandazioni auditabili, compliant con l'AI Act.",
    "cta": "Prenota una demo"
  },
  "wedges": {
    "title": "Perché Heuresys",
    "esco": { "title": "ESCO-native, aperta", "body": "Standard pubblico EU: nessun lock-in proprietario, benchmarking cross-country, interoperabilità." },
    "explain": { "title": "Spiegabile = compliance AI Act", "body": "Ogni raccomandazione (successione, flight-risk, gap) è deterministica e auditabile davanti a un regolatore. Niente black-box." },
    "position": { "title": "Modello position-centric", "body": "La posizione è entità prima: org-design e legame struttura↔processo↔competenza che gli ERP servono a costi proibitivi." }
  },
  "icp": {
    "title": "Per chi",
    "body": "Mid-market europeo, 250–2000 dipendenti, in settori strutturati e regolati: banking, assicurazioni, sanità, utility."
  },
  "credibility": {
    "title": "Costruita su standard, non su promesse",
    "body": "ESCO (Commissione Europea) come ontologia delle competenze, euristiche deterministiche al posto di ML opaco, modello dati position-centric: ogni numero è tracciabile alla sua fonte."
  },
  "form": {
    "title": "Prenota una demo",
    "subtitle": "Raccontaci della tua organizzazione: ti ricontattiamo per una demo guidata.",
    "name": "Nome e cognome",
    "company": "Azienda",
    "email": "Email di lavoro",
    "role": "Ruolo (facoltativo)",
    "companySize": "Dimensione azienda",
    "sizes": { "LT_50": "Meno di 50", "50_250": "50–250", "250_2000": "250–2000", "GT_2000": "Oltre 2000" },
    "message": "Messaggio (facoltativo)",
    "consent": "Acconsento al trattamento dei miei dati per essere ricontattato (vedi {{privacy}}).",
    "privacyLink": "informativa privacy",
    "submit": "Invia richiesta",
    "submitting": "Invio…",
    "success": "Grazie! Ti ricontattiamo a breve.",
    "error": "Invio non riuscito. Riprova."
  },
  "footer": { "tagline": "Heuresys — Skills & Org Intelligence EU-native." }
}
```

- [ ] **Step 2: en/landing.json**

```json
{
  "nav": { "login": "Sign in", "cta": "Book a demo" },
  "hero": {
    "title": "The EU-native, ESCO-based, explainable Skills & Org Intelligence platform for the regulated mid-market",
    "subtitle": "Govern skills, positions and organizational capability on a European public standard (ESCO) with auditable, AI-Act-ready recommendations.",
    "cta": "Book a demo"
  },
  "wedges": {
    "title": "Why Heuresys",
    "esco": { "title": "ESCO-native, open", "body": "An EU public standard: no proprietary lock-in, cross-country benchmarking, interoperability." },
    "explain": { "title": "Explainable = AI-Act compliance", "body": "Every recommendation (succession, flight-risk, gap) is deterministic and auditable before a regulator. No black-box." },
    "position": { "title": "Position-centric model", "body": "The position is a first-class entity: org-design and the structure↔process↔skill link that ERPs charge a fortune for." }
  },
  "icp": {
    "title": "Who it's for",
    "body": "European mid-market, 250–2000 employees, in structured and regulated sectors: banking, insurance, healthcare, utilities."
  },
  "credibility": {
    "title": "Built on standards, not promises",
    "body": "ESCO (European Commission) as the skills ontology, deterministic heuristics instead of opaque ML, a position-centric data model: every number traces back to its source."
  },
  "form": {
    "title": "Book a demo",
    "subtitle": "Tell us about your organization — we'll get back to you for a guided demo.",
    "name": "Full name",
    "company": "Company",
    "email": "Work email",
    "role": "Role (optional)",
    "companySize": "Company size",
    "sizes": { "LT_50": "Under 50", "50_250": "50–250", "250_2000": "250–2000", "GT_2000": "Over 2000" },
    "message": "Message (optional)",
    "consent": "I consent to my data being processed so you can contact me (see {{privacy}}).",
    "privacyLink": "privacy notice",
    "submit": "Send request",
    "submitting": "Sending…",
    "success": "Thank you! We'll be in touch soon.",
    "error": "Submission failed. Please try again."
  },
  "footer": { "tagline": "Heuresys — EU-native Skills & Org Intelligence." }
}
```

- [ ] **Step 3: Wire the namespace in `lib/i18n.ts`**

Add the imports (next to the `ess` pair):
```ts
import landingIt from "../locales/it/landing.json";
import landingEn from "../locales/en/landing.json";
```
Add `"landing"` to `NAMESPACES`:
```ts
export const NAMESPACES = ["common", "shell", "analytics", "admin", "blueprints", "hr", "ess", "landing"] as const;
```
Add `landing: landingIt` to the `it` block and `landing: landingEn` to the `en` block of `resources`.

- [ ] **Step 4: i18n parity (gate)**

Run: `pnpm i18n:check`
Expected: `✓ Parity OK (... × 2 locales × 8 namespaces)`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/locales/it/landing.json apps/web/src/locales/en/landing.json apps/web/src/lib/i18n.ts
git commit -m "feat(web): #4 — landing i18n namespace (it+en)"
```

---

### Task 7: Web — lead form component

**Files:**
- Create: `apps/web/src/components/lead-form.tsx`

**Interfaces:**
- Consumes: `LeadCreateSchema`/`LeadCompanySizeEnum` from `@heuresys/shared`; `@heuresys/ui` primitives; the `landing` namespace (Task 6).
- Produces: `<LeadForm />` (default export) used by Task 8.

- [ ] **Step 1: Write the component**

```tsx
"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, Input } from "@heuresys/ui";
import { LeadCreateSchema, type LeadCreate } from "@heuresys/shared";

const SIZES = ["LT_50", "50_250", "250_2000", "GT_2000"] as const;

export default function LeadForm() {
  const { t } = useTranslation("landing");
  const [state, setState] = useState<"idle" | "submitting" | "ok" | "error">("idle");
  const { register, handleSubmit, formState: { errors } } = useForm<LeadCreate>({
    resolver: zodResolver(LeadCreateSchema),
    defaultValues: { website: "" },
  });

  async function onSubmit(values: LeadCreate) {
    setState("submitting");
    try {
      const res = await fetch("/api/v1/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      setState(res.ok ? "ok" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "ok") {
    return (
      <Card data-testid="lead-form-success">
        <CardContent className="p-6 text-sm text-foreground">{t("form.success")}</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form data-testid="lead-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">{t("form.name")}</span>
              <Input data-testid="lead-name" {...register("name")} aria-invalid={!!errors.name} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">{t("form.company")}</span>
              <Input data-testid="lead-company" {...register("company")} aria-invalid={!!errors.company} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">{t("form.email")}</span>
              <Input data-testid="lead-email" type="email" {...register("email")} aria-invalid={!!errors.email} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">{t("form.role")}</span>
              <Input data-testid="lead-role" {...register("role")} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">{t("form.companySize")}</span>
              <select data-testid="lead-size" {...register("companySize")} className="w-full rounded-control border border-border bg-card px-3 py-2 text-sm">
                <option value="">—</option>
                {SIZES.map((s) => (<option key={s} value={s}>{t(`form.sizes.${s}`)}</option>))}
              </select>
            </label>
          </div>
          <label className="space-y-1 text-sm block">
            <span className="text-muted-foreground">{t("form.message")}</span>
            <textarea data-testid="lead-message" {...register("message")} rows={3} className="w-full rounded-control border border-border bg-card px-3 py-2 text-sm" />
          </label>
          {/* honeypot: visually hidden, off-screen, not announced */}
          <input {...register("website")} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] h-0 w-0" />
          <label className="flex items-start gap-2 text-sm">
            <input data-testid="lead-consent" type="checkbox" {...register("consent")} className="mt-1" />
            <span className="text-muted-foreground">
              {t("form.consent", { privacy: t("form.privacyLink") })}
            </span>
          </label>
          <Button type="submit" disabled={state === "submitting"} data-testid="lead-submit">
            {state === "submitting" ? t("form.submitting") : t("form.submit")}
          </Button>
          {state === "error" ? <p data-testid="lead-form-error" className="text-sm text-danger">{t("form.error")}</p> : null}
        </form>
      </CardContent>
    </Card>
  );
}
```

> Note: `consent` is `z.literal(true)` — an unchecked box yields `false` → zodResolver blocks submit (no API call). If `@heuresys/ui` exports a `Checkbox`/`Textarea`, prefer them over the raw elements; the raw elements above are the fallback and are a11y-labelled.

- [ ] **Step 2: typecheck + eslint**

Run: `cd apps/web && pnpm exec tsc --noEmit && pnpm exec eslint "src/components/lead-form.tsx"`
Expected: exit 0 for both.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/lead-form.tsx
git commit -m "feat(web): #4 — lead form (consent + honeypot, posts /api/v1/leads)"
```

---

### Task 8: Web — landing page (replaces root redirect)

**Files:**
- Modify: `apps/web/src/app/page.tsx` (replace `redirect("/login")` with the landing)

**Interfaces:**
- Consumes: `<LeadForm />` (Task 7); `@heuresys/ui` primitives; the `landing` namespace.

- [ ] **Step 1: Replace the root page**

```tsx
"use client";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, HeuresysWordmark } from "@heuresys/ui";
import LeadForm from "@/components/lead-form";

export default function HomePage() {
  const { t } = useTranslation("landing");
  return (
    <main data-testid="landing-page" className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <HeuresysWordmark />
        <div className="flex items-center gap-3">
          <Link href="/login" data-testid="landing-login" className="text-sm text-muted-foreground hover:text-foreground">{t("nav.login")}</Link>
          <a href="#demo"><Button size="sm">{t("nav.cta")}</Button></a>
        </div>
      </header>

      <section data-testid="landing-hero" className="mx-auto max-w-4xl px-6 py-16 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("hero.title")}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">{t("hero.subtitle")}</p>
        <a href="#demo" className="mt-8 inline-block"><Button size="lg" data-testid="hero-cta">{t("hero.cta")}</Button></a>
      </section>

      <section data-testid="landing-wedges" className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="mb-6 text-center text-xl font-semibold">{t("wedges.title")}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {(["esco", "explain", "position"] as const).map((k) => (
            <Card key={k} data-testid={`wedge-${k}`}>
              <CardContent className="space-y-2 p-6">
                <h3 className="font-medium">{t(`wedges.${k}.title`)}</h3>
                <p className="text-sm text-muted-foreground">{t(`wedges.${k}.body`)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-12 text-center">
        <h2 className="text-xl font-semibold">{t("icp.title")}</h2>
        <p className="mt-3 text-muted-foreground">{t("icp.body")}</p>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-12 text-center">
        <h2 className="text-xl font-semibold">{t("credibility.title")}</h2>
        <p className="mt-3 text-muted-foreground">{t("credibility.body")}</p>
      </section>

      <section id="demo" data-testid="landing-demo" className="mx-auto max-w-2xl px-6 py-16">
        <h2 className="text-center text-2xl font-semibold">{t("form.title")}</h2>
        <p className="mx-auto mt-2 mb-6 max-w-xl text-center text-muted-foreground">{t("form.subtitle")}</p>
        <LeadForm />
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">{t("footer.tagline")}</footer>
    </main>
  );
}
```

> Note: the previous root `redirect("/login")` is fully removed. An authenticated user can still reach the app via the "Accedi" link / `/login`.

- [ ] **Step 2: typecheck + eslint + build**

Run: `cd apps/web && pnpm exec tsc --noEmit && pnpm exec eslint "src/app/page.tsx" && pnpm exec next build`
Expected: exit 0; build succeeds (root `/` now a client page, no SSR crash).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "feat(web): #4 — public front-door landing at / (replaces login redirect)"
```

---

### Task 9: Web — open the proxy for `/`

**Files:**
- Modify: `apps/web/src/proxy.ts`

**Interfaces:**
- Consumes: existing `isPublic` / `PUBLIC_PATHS`.

- [ ] **Step 1: Make the exact root public**

In `apps/web/src/proxy.ts`, change `isPublic` so the exact `/` is public WITHOUT making every path public (a bare `"/"` in `PUBLIC_PATHS` would match everything via `startsWith("/")`):

```ts
function isPublic(pathname: string): boolean {
  if (pathname === "/") return true; // public marketing landing (front door)
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
```

- [ ] **Step 2: Verify the change is surgical**

Confirm `PUBLIC_PATHS` is unchanged and only the exact-`/` early-return was added. `/dashboard`, `/me`, etc. still redirect to `/login` when unauthenticated.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/proxy.ts
git commit -m "feat(web): #4 — serve the public landing at exact / (proxy)"
```

---

### Task 10: E2E — landing.spec (LIVE)

**Files:**
- Create: `apps/web/tests/e2e/landing.spec.ts`

**Interfaces:**
- Consumes: a running web+API (the prod config webServer + API on :3001/PROD proxy); no auth fixture (anonymous).

- [ ] **Step 1: Write the spec**

```ts
/**
 * apps/web/tests/e2e/landing.spec.ts — public GTM front door (#4).
 * Anonymous (no storageState): the landing renders + a real lead submit hits the
 * live /v1/leads endpoint and stores a row. Teardown deletes the E2E leads.
 */
import { test, expect } from "@playwright/test";

const STAMP = process.env.E2E_RUN_ID ?? "run";
const email = `e2e+${STAMP}@leads-e2e.test`;

test.describe("GTM front-door landing (anonymous)", () => {
  test("renders the positioning + 3 wedges", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("landing-hero")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("wedge-esco")).toBeVisible();
    await expect(page.getByTestId("wedge-explain")).toBeVisible();
    await expect(page.getByTestId("wedge-position")).toBeVisible();
    await expect(page.getByTestId("landing-login")).toBeVisible();
  });

  test("submitting the lead form stores a real lead", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.getByTestId("lead-name").fill("E2E Prospect");
    await page.getByTestId("lead-company").fill("E2E Bank");
    await page.getByTestId("lead-email").fill(email);
    await page.getByTestId("lead-consent").check();
    await page.getByTestId("lead-submit").click();
    await expect(page.getByTestId("lead-form-success")).toBeVisible({ timeout: 30_000 });
  });
});
```

- [ ] **Step 2: Add a teardown for the E2E leads**

In `apps/web/tests/e2e/global-teardown.ts`, add a psql DELETE for `lead_email LIKE '%@leads-e2e.test'` (mirror the existing `E2E Test Cert` cleanup block — same host/port/db/user from `.env`, password from `~/.pgpass`).

- [ ] **Step 3: Run the spec (gate)**

Ensure the API dev server is up (`pnpm --filter @heuresys/api dev`, wait for "RBAC permission cache loaded"). Then:
Run: `cd apps/web && node scripts/e2e-node22.mjs test landing.spec.ts`
Expected: `2 passed`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/tests/e2e/landing.spec.ts apps/web/tests/e2e/global-teardown.ts
git commit -m "test(web): #4 — landing E2E (render + live lead submit) + teardown"
```

---

### Task 11: Full gates + PROD deploy + live verification

**Files:** none (verification + deploy).

- [ ] **Step 1: Full local gates**

Run, expecting all green:
```bash
pnpm typecheck                       # all workspaces
pnpm --filter @heuresys/web exec eslint "src/**/*.{ts,tsx}"
pnpm i18n:check                      # 8 namespaces parity
cd apps/api && pnpm exec vitest run  # full API suite incl. leads (no regression)
```

- [ ] **Step 2: Full prod E2E (Node-22 wrapper)**

Run: `pnpm --filter @heuresys/web test:e2e:prod:node22`
Expected: full suite green (landing + a11y + existing specs); the landing must pass the a11y gate (critical+serious = 0).

- [ ] **Step 3: Deploy PROD**

Run: `MSYS_NO_PATHCONV=1 ssh oracle-vm-default 'cd /home/ubuntu/heuresys-advanced && git pull --ff-only origin main && bash scripts/vm-deploy.sh'`
(Push first if not already pushed.) Expected: `/api/readyz` ok + web restart.

- [ ] **Step 4: Live verification on PROD**

- Visit `https://www.heuresys.com/` → the landing renders (hero + 3 wedges + form), NOT a login redirect.
- Submit a real test lead, then confirm it stored:
```bash
MSYS_NO_PATHCONV=1 ssh oracle-vm-default "sudo -u postgres psql -d heuresys_advanced -c \"SELECT lead_company, lead_consent_version, created_at FROM sys.sys_leads ORDER BY created_at DESC LIMIT 3;\""
```
Expected: the test lead row present with `lead_consent_version='2026-06-21-v1'`. Delete it after: `... DELETE FROM sys.sys_leads WHERE lead_email LIKE '%@leads-e2e.test';`

- [ ] **Step 5: Final commit / handoff**

State update (#4 first deliverable shipped; landing live) + push + propagate handled by the `handoff` skill at session close.

---

## Self-Review

**Spec coverage:** A (landing) → Tasks 8/9; B (proxy) → Task 9; C (API module: migration/perm/registry/schema/repo/service/routes/test) → Tasks 1–5; D (lead form + consent + honeypot) → Task 7; E (E2E) → Task 10; PII/GDPR (consent stored + RBAC read + no body-log) → Tasks 1/3/4/7; gates+deploy → Task 11. All spec sections covered.

**Placeholder scan:** No TBD/TODO; every code step shows complete code; the one "Note" blocks are guidance, not gaps.

**Type consistency:** `LeadCreate`/`LeadResponse`/`LeadCompanySize`/`LeadListResponse` (Task 2) are consumed verbatim in Tasks 3/4/5/7; `leadsService.create/list` signatures match between Task 3 (produced) and Task 4 (consumed); `LEAD_CONSENT_VERSION="2026-06-21-v1"` matches between service (Task 3) and the test assertion (Task 5) and the live check (Task 11). Company-size bands identical across migration CHECK (Task 1), enum (Task 2), form (Task 7), i18n (Task 6).
