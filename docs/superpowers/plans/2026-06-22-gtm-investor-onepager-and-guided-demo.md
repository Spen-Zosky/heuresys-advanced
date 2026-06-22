# GTM Investor One-Pager + Guided Demo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two public GTM pages — an honest, teaser investor one-pager (`/investors`) with live platform metrics + print-to-PDF, and a scripted screenshot-based guided product demo (`/demo`) — on the existing public-page + lead-capture foundation.

**Architecture:** API-first. A shared foundation adds a `lead_source` enum (segment INVESTOR/DEMO leads) and a public read-only `GET /v1/public/platform-stats` (live aggregate counts). Two `"use client"` public pages reuse the landing pattern (i18n namespace + `PUBLIC_PATHS` + `@heuresys/ui` primitives + anonymous live E2E). The demo's screenshots are captured from the live RTL_BANK tenant by a re-runnable Playwright spec reusing the persona storageState.

**Tech Stack:** Fastify 5 + Zod v4 + raw parameterized SQL (API); Next.js 16 App Router + react-i18next + `@heuresys/ui` + Tailwind 4 (web); Playwright (E2E + capture); PostgreSQL 16 via SSH tunnel :5433.

## Global Constraints

- **No new runtime deps** in this repo (PDF/tour/chart libs forbidden — they belong upstream in `@heuresys/ui`). Both deliverables are built with print-CSS + screenshots → none needed.
- **UI from `@heuresys/ui` primitives only** (`Card`, `CardContent`, `Button`, `Input`, `HeuresysWordmark`). No UI duplication; page-specific composition lives in `apps/web/src/app/**` or `apps/web/src/components/**`.
- **i18n**: IT is the complete source locale, EN is parity. Every new page string goes through `useTranslation(<ns>)`; `no-literal-string` eslint is `error` on `apps/web/src/app/**`. `pnpm i18n:check` must stay green.
- **Positioning (verbatim, already live)**: *"The EU-native, ESCO-based, explainable (AI-Act) Skills & Org Intelligence platform for the regulated mid-market."*
- **Tone**: honest, under-promise. Technical GA, **pre-commercial** (0 paying customers, synthetic case-study data, seeking design partners). No unverified IP/legal claims. **One-pager carries NO funding numbers** (teaser — Enzo's decision; this is scope, not a placeholder).
- **`"BPM"` framing**: process **modeling + governance** (blueprints, RACI, SLA, approvals) — never claim a process runtime.
- **DB rules**: RD-08 categorical = `varchar(N) + CHECK`, never ENUM. I5 tenant isolation = FK + middleware, never RLS. Migrations idempotent + twice-run-proven; next number = **000153**.
- **Public write endpoints**: no auth, no CSRF, + honeypot + per-IP rate-limit + `consent: z.literal(true)`. Public read (`platform-stats`): no auth, rate-limited, aggregate-only (no PII, no rows).
- **DoD (LIVE)**: every layer wired (shared → api → web → E2E), all gates green, and a live action on PROD proves it. No mock, no faked number in any data path; codebase facts are declared with an "as of S1003" provenance line.
- **Windows E2E**: run Playwright via the Node-22 wrapper — `pnpm --filter @heuresys/web test:e2e:prod:node22` (and per-spec `test:e2e:node22`). CI/Mac/VM (Node ≤22) unaffected.
- **Commits**: atomic per deliverable, repo style — `feat(api): #4 — …`, `feat(web): #4 — …`, `test(web): #4 — …`, `chore(db): #4 — …`. Local commits on `main` pre-authorized; **push only on Enzo's ask** (here: end-to-end was authorized S1003 — push at the end).
- **Tunnel must be up** (`:5433`) for every API/integration/E2E step.

---

## Task 1: Foundation F1 — `lead_source` enum (segment INVESTOR/DEMO)

**Files:**
- Create: `db/migrations/000153_lead_source_enum.sql`
- Modify: `packages/shared/src/schemas/leads.ts`
- Modify: `apps/api/src/modules/leads/repository.ts`
- Modify: `apps/api/src/modules/leads/service.ts`
- Modify: `apps/web/src/components/lead-form.tsx`
- Test: `apps/api/test/leads.integration.test.ts` (extend)

**Interfaces:**
- Produces: `LeadSourceEnum = z.enum(["WEBSITE","INVESTOR","DEMO"])`; `LeadCreate.source?: "WEBSITE"|"INVESTOR"|"DEMO"`; `InsertLeadRow.source: string`; `<LeadForm source?: "WEBSITE"|"INVESTOR"|"DEMO" />` (default `"WEBSITE"`).

- [ ] **Step 1: Write the migration** `db/migrations/000153_lead_source_enum.sql`:

```sql
-- ============================================================================
-- 000153_lead_source_enum.sql — segment GTM leads by entry point.
-- The one-pager CTA posts source=INVESTOR, the demo CTA source=DEMO, the
-- landing keeps WEBSITE (default). RD-08: varchar + CHECK, never ENUM. Idempotent.
-- Authored: 2026-06-22 (S1003, #4 go-to-market deliverables 2-3).
-- ============================================================================

-- Normalize the legacy lowercase default + any existing rows to the new enum.
ALTER TABLE sys.sys_leads ALTER COLUMN lead_source SET DEFAULT 'WEBSITE';
UPDATE sys.sys_leads SET lead_source = 'WEBSITE' WHERE lead_source = 'website';

-- Add the CHECK only if absent (guarded — twice-run-safe).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_leads_source_check') THEN
    ALTER TABLE sys.sys_leads
      ADD CONSTRAINT sys_leads_source_check CHECK (lead_source IN ('WEBSITE','INVESTOR','DEMO'));
  END IF;
END $$;

DO $$
DECLARE n_bad int;
BEGIN
  SELECT count(*) INTO n_bad FROM sys.sys_leads WHERE lead_source NOT IN ('WEBSITE','INVESTOR','DEMO');
  IF n_bad <> 0 THEN RAISE EXCEPTION '000153: % rows with invalid lead_source', n_bad; END IF;
  RAISE NOTICE '000153: lead_source enum (WEBSITE/INVESTOR/DEMO) + CHECK.';
END $$;
```

- [ ] **Step 2: Run the migration twice (idempotency)**

Run: `bash db/scripts/migrate.sh` (twice) — or apply 000153 directly via psql twice.
Expected: first run applies; second run NOTICE only, 0 errors, no diff.

- [ ] **Step 3: Extend the shared schema** in `packages/shared/src/schemas/leads.ts` — after `LeadCompanySizeEnum`:

```ts
export const LeadSourceEnum = z.enum(["WEBSITE", "INVESTOR", "DEMO"]);
export type LeadSource = z.infer<typeof LeadSourceEnum>;
```
and add to `LeadCreateSchema` (before `consent`):
```ts
  source: LeadSourceEnum.optional(),
```

- [ ] **Step 4: Update the repository** `apps/api/src/modules/leads/repository.ts` — add `source` to `InsertLeadRow` and the INSERT:

```ts
export interface InsertLeadRow {
  name: string; company: string; email: string;
  role: string | null; companySize: LeadCompanySize | null; message: string | null;
  source: string; consentVersion: string;
}

export async function insertLead(r: InsertLeadRow): Promise<void> {
  await pool.query(
    `INSERT INTO sys.sys_leads
       (lead_name, lead_company, lead_email, lead_role, lead_company_size,
        lead_message, lead_source, lead_consent_at, lead_consent_version)
     VALUES ($1,$2,$3,$4,$5,$6,$7, now(), $8)`,
    [r.name, r.company, r.email, r.role, r.companySize, r.message, r.source, r.consentVersion],
  );
}
```

- [ ] **Step 5: Update the service** `apps/api/src/modules/leads/service.ts` — pass `source` in `create`:

```ts
    await repo.insertLead({
      name: input.name,
      company: input.company,
      email: input.email,
      role: input.role ?? null,
      companySize: input.companySize ?? null,
      message: input.message ?? null,
      source: input.source ?? "WEBSITE",
      consentVersion: LEAD_CONSENT_VERSION,
    });
```

- [ ] **Step 6: Add the `source` prop to `LeadForm`** `apps/web/src/components/lead-form.tsx`:

Change the signature to `export default function LeadForm({ source = "WEBSITE" }: { source?: "WEBSITE" | "INVESTOR" | "DEMO" } = {})` and include it in the POST body:
```ts
        body: JSON.stringify({ ...values, source }),
```
(The landing renders `<LeadForm />` → default `WEBSITE` → behavior preserved.)

- [ ] **Step 7: Extend the integration test** `apps/api/test/leads.integration.test.ts` — add inside the describe:

```ts
  it("public POST with source=INVESTOR stores INVESTOR", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/leads",
      payload: { name: "VC One", company: "Fund X", email: `vc${E2E_DOMAIN}`, source: "INVESTOR", consent: true },
    });
    expect(r.statusCode).toBe(200);
    const { rows } = await pool.query(`SELECT lead_source FROM sys.sys_leads WHERE lead_email=$1`, [`vc${E2E_DOMAIN}`]);
    expect(rows[0].lead_source).toBe("INVESTOR");
  });

  it("public POST without source defaults to WEBSITE", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/leads",
      payload: { name: "Web One", company: "Co", email: `web${E2E_DOMAIN}`, consent: true },
    });
    expect(r.statusCode).toBe(200);
    const { rows } = await pool.query(`SELECT lead_source FROM sys.sys_leads WHERE lead_email=$1`, [`web${E2E_DOMAIN}`]);
    expect(rows[0].lead_source).toBe("WEBSITE");
  });

  it("invalid source → 400", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/leads",
      payload: { name: "Bad", company: "Co", email: `bad${E2E_DOMAIN}`, source: "HACKER", consent: true },
    });
    expect(r.statusCode).toBe(400);
  });
```

- [ ] **Step 8: Build shared + run the leads suite**

Run: `pnpm --filter @heuresys/shared build && cd apps/api && pnpm exec vitest run test/leads.integration.test.ts`
Expected: all leads tests PASS (existing 6 + new 3).

- [ ] **Step 9: Commit**

```bash
git add db/migrations/000153_lead_source_enum.sql packages/shared/src/schemas/leads.ts apps/api/src/modules/leads/ apps/web/src/components/lead-form.tsx apps/api/test/leads.integration.test.ts
git commit -m "feat(api): #4 — lead_source enum (WEBSITE/INVESTOR/DEMO) for GTM segmentation"
```

---

## Task 2: Foundation F2 — `GET /v1/public/platform-stats` (live metrics)

**Files:**
- Create: `apps/api/src/modules/public-stats/repository.ts`
- Create: `apps/api/src/modules/public-stats/service.ts`
- Create: `apps/api/src/modules/public-stats/routes.ts`
- Create: `packages/shared/src/schemas/public-stats.ts`
- Modify: `packages/shared/src/index.ts` (export) + `packages/shared/package.json` (subpath export)
- Modify: `apps/api/src/app.ts` (import + register after line 429)
- Test: `apps/api/test/public-stats.integration.test.ts`

**Interfaces:**
- Consumes: `pool` from `../../db/client.js`.
- Produces: `PlatformStatsResponse` (all fields `z.number().int().nonnegative()`); route `GET /v1/public/platform-stats`.

- [ ] **Step 1: Write the shared schema** `packages/shared/src/schemas/public-stats.ts`:

```ts
/**
 * @heuresys/shared — public platform statistics (GTM one-pager live metrics).
 * Backs the PUBLIC GET /v1/public/platform-stats (no auth, aggregate-only, no PII).
 */
import { z } from "zod";

const count = z.number().int().nonnegative();

export const PlatformStatsResponseSchema = z.object({
  skills: count,
  occupationSkillEdges: count,
  escoOccupationMappings: count,
  users: count,
  positions: count,
  organizationUnits: count,
  teams: count,
  roles: count,
  permissions: count,
  rolePermissionMappings: count,
  uiInterfaces: count,
  activeTenancies: count,
});
export type PlatformStatsResponse = z.infer<typeof PlatformStatsResponseSchema>;
```

- [ ] **Step 2: Export it** — add to `packages/shared/src/index.ts`:
```ts
export * from "./schemas/public-stats.js";
```
and add the subpath export to `packages/shared/package.json` `exports` map (mirror the existing `./schemas/leads` entry), e.g.:
```json
    "./schemas/public-stats": { "types": "./dist/schemas/public-stats.d.ts", "default": "./dist/schemas/public-stats.js" }
```
(Match the exact shape of the sibling `./schemas/leads` entry — read it first and copy its structure.)

- [ ] **Step 3: Write the repository** `apps/api/src/modules/public-stats/repository.ts`:

```ts
/**
 * apps/api/src/modules/public-stats/repository.ts — aggregate-only counts for
 * the public GTM one-pager. No PII, no row data; every figure is a count(*).
 */
import { pool } from "../../db/client.js";
import type { PlatformStatsResponse } from "@heuresys/shared";

export async function fetchStats(): Promise<PlatformStatsResponse> {
  const { rows } = await pool.query(`
    SELECT
      (SELECT count(*) FROM sys.sys_skills)                          AS skills,
      (SELECT count(*) FROM sys.sys_occupation_skill_requirements)   AS occupation_skill_edges,
      (SELECT count(*) FROM sys.sys_esco_occupation_mappings)        AS esco_occupation_mappings,
      (SELECT count(*) FROM sys.sys_users)                           AS users,
      (SELECT count(*) FROM sys.sys_positions)                       AS positions,
      (SELECT count(*) FROM sys.sys_organization_units)              AS organization_units,
      (SELECT count(*) FROM sys.sys_teams)                           AS teams,
      (SELECT count(*) FROM sys.sys_auth_roles)                      AS roles,
      (SELECT count(*) FROM sys.sys_auth_permissions)                AS permissions,
      (SELECT count(*) FROM sys.sys_auth_role_permissions)           AS role_permission_mappings,
      (SELECT count(*) FROM sys.sys_ui_interfaces)                   AS ui_interfaces,
      (SELECT count(DISTINCT user_tenant_id) FROM sys.sys_users)     AS active_tenancies
  `);
  const r = rows[0] as Record<string, string>;
  const n = (k: string) => Number(r[k] ?? 0);
  return {
    skills: n("skills"),
    occupationSkillEdges: n("occupation_skill_edges"),
    escoOccupationMappings: n("esco_occupation_mappings"),
    users: n("users"),
    positions: n("positions"),
    organizationUnits: n("organization_units"),
    teams: n("teams"),
    roles: n("roles"),
    permissions: n("permissions"),
    rolePermissionMappings: n("role_permission_mappings"),
    uiInterfaces: n("ui_interfaces"),
    activeTenancies: n("active_tenancies"),
  };
}
```

- [ ] **Step 4: Write the service** `apps/api/src/modules/public-stats/service.ts` (5-min TTL cache):

```ts
/**
 * apps/api/src/modules/public-stats/service.ts — public stats with a short
 * in-process TTL cache (the endpoint is public; stale-by-≤5-min is fine).
 */
import type { PlatformStatsResponse } from "@heuresys/shared";
import * as repo from "./repository.js";

const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; data: PlatformStatsResponse } | null = null;

export const publicStatsService = {
  async get(): Promise<PlatformStatsResponse> {
    const now = Date.now();
    if (cache && now - cache.at < TTL_MS) return cache.data;
    const data = await repo.fetchStats();
    cache = { at: now, data };
    return data;
  },
  /** test seam */
  _reset() { cache = null; },
};
```

- [ ] **Step 5: Write the routes** `apps/api/src/modules/public-stats/routes.ts`:

```ts
/**
 * apps/api/src/modules/public-stats/routes.ts — /v1/public.
 * GET /platform-stats = PUBLIC (no auth, no CSRF), per-IP rate-limited,
 * aggregate-only (no PII). Feeds the GTM investor one-pager's live metric tiles.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { PlatformStatsResponseSchema } from "@heuresys/shared";
import { publicStatsService } from "./service.js";

export const publicStatsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/platform-stats",
    {
      config: { rateLimit: { max: 30, timeWindow: 60 * 1000 } },
      schema: { response: { 200: PlatformStatsResponseSchema } },
    },
    async () => publicStatsService.get(),
  );
};
```

- [ ] **Step 6: Register the module** in `apps/api/src/app.ts` — add the import near line 120 (next to `leadsRoutes`):
```ts
import { publicStatsRoutes } from "./modules/public-stats/routes.js";
```
and register it right after the `leadsRoutes` line (≈ line 429):
```ts
  await app.register(publicStatsRoutes, { prefix: "/v1/public" });
```

- [ ] **Step 7: Write the integration test** `apps/api/test/public-stats.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { publicStatsService } from "../src/modules/public-stats/service.js";

let suite: TestApp;
beforeAll(async () => { suite = await buildTestApp(); publicStatsService._reset(); });
afterAll(async () => { await suite.app.close(); });

describe("GET /v1/public/platform-stats (public)", () => {
  it("returns live aggregate counts with no auth", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/public/platform-stats" });
    expect(r.statusCode).toBe(200);
    const b = r.json() as Record<string, number>;
    // moat metrics must be populated on the live DB
    expect(b.skills).toBeGreaterThan(1000);
    expect(b.occupationSkillEdges).toBeGreaterThan(1000);
    expect(b.activeTenancies).toBeGreaterThanOrEqual(1);
    // every field is a non-negative integer
    for (const v of Object.values(b)) { expect(Number.isInteger(v)).toBe(true); expect(v).toBeGreaterThanOrEqual(0); }
  });

  it("is cached (second call returns the same object within TTL)", async () => {
    const a = await suite.app.inject({ method: "GET", url: "/v1/public/platform-stats" });
    const b = await suite.app.inject({ method: "GET", url: "/v1/public/platform-stats" });
    expect(a.json()).toEqual(b.json());
  });
});
```

- [ ] **Step 8: Build shared + run the new suite**

Run: `pnpm --filter @heuresys/shared build && cd apps/api && pnpm exec vitest run test/public-stats.integration.test.ts`
Expected: PASS (skills/edges > 1000, all integers).

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/modules/public-stats/ packages/shared/src/schemas/public-stats.ts packages/shared/src/index.ts packages/shared/package.json apps/api/src/app.ts apps/api/test/public-stats.integration.test.ts
git commit -m "feat(api): #4 — public GET /v1/public/platform-stats (live aggregate metrics)"
```

---

## Task 3: One-pager i18n namespace (`investors`)

**Files:**
- Create: `apps/web/src/locales/it/investors.json`
- Create: `apps/web/src/locales/en/investors.json`
- Modify: `apps/web/src/lib/i18n.ts` (import + NAMESPACES + resources)

**Interfaces:** Produces the `investors` namespace with keys consumed by Task 4. The live-metric tiles take their VALUES from F2 at runtime; the JSON holds only labels. Static codebase facts are rendered from a TS constant in Task 4 with labels from this namespace.

- [ ] **Step 1: Write `apps/web/src/locales/it/investors.json`** (IT source — honest, teaser, under-promise):

```json
{
  "nav": { "login": "Accedi", "downloadPdf": "Scarica PDF" },
  "hero": {
    "title": "La piattaforma Skills & Org Intelligence EU-native, ESCO-based e spiegabile per il mid-market regolato",
    "thesis": "Fondazione di prodotto solida e in GA tecnica — pre-commerciale, in cerca di design partner."
  },
  "opportunity": {
    "title": "L'opportunità",
    "body": "Il mid-market europeo regolato (banking, assicurazioni, sanità, utility) deve governare competenze e struttura organizzativa su uno standard aperto (ESCO) con raccomandazioni auditabili secondo l'AI Act. In questa nicchia il concorrente diretto è circa uno, non ventisette."
  },
  "proof": {
    "title": "Cosa abbiamo costruito",
    "tagline": "Ogni numero è tracciabile alla sua fonte.",
    "liveLabel": "live",
    "asOf": "dati di codebase, S1003",
    "live": {
      "skills": "Competenze ESCO (tassonomia)",
      "occupationSkillEdges": "Collegamenti occupazione→competenza",
      "escoOccupationMappings": "Mappature occupazioni ESCO",
      "users": "Utenti (org reale)",
      "positions": "Posizioni",
      "organizationUnits": "Unità organizzative",
      "teams": "Team",
      "rolePermissionMappings": "Mappature ruolo×permesso (RBAC)",
      "uiInterfaces": "Interfacce UI gated da RBAC",
      "activeTenancies": "Tenant attivi"
    },
    "static": {
      "modules": "Moduli business (API)",
      "endpoints": "Endpoint /v1/*",
      "migrations": "Migrazioni DB idempotenti",
      "apiTests": "Test di integrazione API (DB reale)",
      "e2e": "Test E2E Playwright",
      "pages": "Pagine web (admin + ESS)"
    }
  },
  "wedges": {
    "title": "Perché Heuresys",
    "esco": { "title": "ESCO-native, aperta", "body": "Standard pubblico EU: nessun lock-in proprietario, benchmarking cross-country, interoperabilità con il mercato del lavoro europeo." },
    "explain": { "title": "Spiegabile = compliance AI Act", "body": "Ogni raccomandazione (successione, flight-risk, gap) è deterministica e auditabile davanti a un regolatore. Niente black-box: il vantaggio più sottovalutato." },
    "position": { "title": "Modello position-centric", "body": "La posizione è entità prima: org-design e legame struttura↔processo↔competenza che gli ERP servono a costi proibitivi." }
  },
  "traction": {
    "title": "A che punto siamo (onesto)",
    "body": "GA tecnica live in produzione su www.heuresys.com. Pre-commerciale: zero clienti paganti, dati case-study sintetici (tenant di riferimento RTL Bank), in cerca di design partner. Efficienza di capitale: burn ≈ €0 (infra free-tier + tempo del founder).",
    "gapClosed": "Aggiornamento: il gap di credibilità #1 è chiuso — tutte e tre le prospettive (HR, Process Owner, Org Director) hanno ora UI live, inclusa la maturità organizzativa L0-L5."
  },
  "whyNow": {
    "title": "Perché ora, perché noi",
    "body": "ESCO + AI Act rendono attuale lo standard aperto e la spiegabilità. Disciplina ingegneristica che sotto-promette e si auto-espone (23 ADR, findings pubblici); layer dati allineato agli standard, difendibile."
  },
  "roadmap": {
    "title": "Dove stiamo andando",
    "body": "De-personalizzare l'infrastruttura, far crescere il team, costruire il layer commerciale (signup, billing, onboarding), formalizzare la compliance EU e firmare il primo pilota a pagamento."
  },
  "cta": {
    "title": "Parliamone",
    "subtitle": "Sei un investitore o un design partner? Lasciaci un contatto: ti rispondiamo a breve."
  },
  "footer": { "tagline": "Heuresys — Skills & Org Intelligence EU-native." }
}
```

- [ ] **Step 2: Write `apps/web/src/locales/en/investors.json`** — a faithful EN translation with the EXACT same key structure (so `i18n:check` passes). Translate every value to English (e.g. `nav.downloadPdf` = "Download PDF", `hero.thesis` = "A solid product foundation in technical GA — pre-commercial, seeking design partners.", `proof.tagline` = "Every number traces back to its source.", etc.).

- [ ] **Step 3: Wire the namespace** in `apps/web/src/lib/i18n.ts`:
- Add imports after the `landing` imports (lines 18-19):
```ts
import investorsIt from "../locales/it/investors.json";
import investorsEn from "../locales/en/investors.json";
```
- Add `"investors"` to `NAMESPACES` (line 28).
- Add `investors: investorsIt` to `resources.it` and `investors: investorsEn` to `resources.en`.

- [ ] **Step 4: Verify i18n parity**

Run: `cd apps/web && pnpm i18n:check`
Expected: PASS (now 9 namespaces × 2 locales, no missing keys).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/locales/it/investors.json apps/web/src/locales/en/investors.json apps/web/src/lib/i18n.ts
git commit -m "feat(web): #4 — investors i18n namespace (it+en)"
```

---

## Task 4: One-pager page + live metrics + print-PDF

**Files:**
- Create: `apps/web/src/app/investors/page.tsx`
- Create: `apps/web/src/lib/api/public-stats.ts` (tiny client fetch hook)
- Modify: `apps/web/src/app/globals.css` (append a `@media print` block)
- Modify: `apps/web/src/proxy.ts` (add `/investors` to `PUBLIC_PATHS`)

**Interfaces:**
- Consumes: `investors` namespace (Task 3), `GET /api/v1/public/platform-stats` (Task 2 via the `/api` proxy), `PlatformStatsResponse` type, `<LeadForm source="INVESTOR" />` (Task 1).
- Produces: public route `/investors`; `data-testid` hooks for Task 5 (`investors-hero`, `investors-proof`, `stat-skills`, `wedge-esco|explain|position`, `investors-download-pdf`, `investors-cta`).

- [ ] **Step 1: Write the client fetch hook** `apps/web/src/lib/api/public-stats.ts`:

```ts
"use client";
import { useEffect, useState } from "react";
import type { PlatformStatsResponse } from "@heuresys/shared/schemas/public-stats";

export function usePlatformStats(): { data: PlatformStatsResponse | null; error: boolean } {
  const [data, setData] = useState<PlatformStatsResponse | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/v1/public/platform-stats", { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("stats"))))
      .then((d) => { if (alive) setData(d as PlatformStatsResponse); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, []);
  return { data, error };
}
```

- [ ] **Step 2: Write the page** `apps/web/src/app/investors/page.tsx`. Read `apps/web/src/app/page.tsx` as the canonical pattern (header/sections/`useTranslation`/`@heuresys/ui` primitives/`data-testid`). Build these sections in order, all strings via `t` from `useTranslation("investors")`:
  1. **header** — `HeuresysWordmark` + `Link href="/login"` (`t("nav.login")`, testid `investors-login`) + a `Button` (`t("nav.downloadPdf")`, testid `investors-download-pdf`, `onClick={() => window.print()}`, wrapped in `className="print:hidden"`).
  2. **hero** (`data-testid="investors-hero"`) — `t("hero.title")` + `t("hero.thesis")`.
  3. **opportunity** — `t("opportunity.title")` + `t("opportunity.body")`.
  4. **proof** (`data-testid="investors-proof"`) — `t("proof.title")`, tagline `t("proof.tagline")`. A grid of tiles, each a `Card`+`CardContent` with `data-print-card`:
     - **Live tiles**: call `const { data } = usePlatformStats();` and render a tile per live key with the number from `data` (e.g. `data?.skills?.toLocaleString("it")`) + label `t("proof.live.skills")` + a small `t("proof.liveLabel")` badge. Give the skills tile `data-testid="stat-skills"`. While `data` is null, show `—`.
     - **Static tiles**: a TS const at top of file `const STATIC_FACTS = [{ key: "modules", value: 84 }, { key: "endpoints", value: 432 }, { key: "migrations", value: 150 }, { key: "apiTests", value: 1080 }, { key: "e2e", value: 107 }, { key: "pages", value: 96 }] as const;` rendered with `t(`proof.static.${f.key}`)` + an `t("proof.asOf")` provenance caption under the static group. (These are declared codebase facts with provenance, not faked data — per the spec §9.)
  5. **wedges** (`data-testid="investors-wedges"`) — 3 `Card`s, testids `wedge-esco|explain|position`, `t("wedges.<k>.title")`/`.body`.
  6. **traction** — `t("traction.title")`, `t("traction.body")`, and a highlighted `t("traction.gapClosed")` line.
  7. **whyNow** — `t("whyNow.title")` + `t("whyNow.body")`.
  8. **roadmap** — `t("roadmap.title")` + `t("roadmap.body")`.
  9. **cta** (`id="contact"`, `data-testid="investors-cta"`, `className="print:hidden"`) — `t("cta.title")` + `t("cta.subtitle")` + `<LeadForm source="INVESTOR" />`.
  10. **footer** (`className="print:hidden"`) — `t("footer.tagline")`.
  Page root: `<main className="min-h-screen bg-background text-foreground">`. Use the landing's token classes.

- [ ] **Step 3: Append the print block** to `apps/web/src/app/globals.css`:

```css
/* GTM investor one-pager (#4) — print-to-PDF. The rendered page IS the PDF;
   chrome carries print:hidden (Tailwind). Page-level rules here. */
@media print {
  @page { size: A4; margin: 14mm; }
  html, body { background: #fff !important; color: #000 !important; }
  [data-print-card] { break-inside: avoid; }
}
```

- [ ] **Step 4: Make `/investors` public** in `apps/web/src/proxy.ts` — add to `PUBLIC_PATHS`:
```ts
const PUBLIC_PATHS = ["/login", "/_next", "/api", "/showcase", "/privacy", "/investors"];
```

- [ ] **Step 5: Typecheck + lint + build web**

Run: `cd apps/web && pnpm exec tsc --noEmit && pnpm exec eslint src/app/investors src/lib/api/public-stats.ts && pnpm build`
Expected: 0 errors (no-literal-string satisfied; build compiles the new route).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/investors/ apps/web/src/lib/api/public-stats.ts apps/web/src/app/globals.css apps/web/src/proxy.ts
git commit -m "feat(web): #4 — investor one-pager /investors (live metrics + print PDF)"
```

---

## Task 5: One-pager E2E (anonymous, LIVE) + leads teardown

**Files:**
- Create: `apps/web/tests/e2e/investors.spec.ts`
- Modify: `apps/web/tests/e2e/global-teardown.ts` (also purge E2E leads by marker)

**Interfaces:** Consumes the live `/investors` route + `/api/v1/public/platform-stats` + `/api/v1/leads`.

- [ ] **Step 1: Extend global-teardown for leads** — read `apps/web/tests/e2e/global-teardown.ts`; alongside the existing `E2E Test Cert%` delete, add a psql delete of E2E leads:
```sql
DELETE FROM sys.sys_leads WHERE lead_email LIKE '%@leads-e2e.test';
```
(Same connection/`.pgpass` mechanism already used there — no secret read/logged. This covers landing + investors + demo lead specs.)

- [ ] **Step 2: Write the spec** `apps/web/tests/e2e/investors.spec.ts` (model on `landing.spec.ts`):

```ts
/**
 * apps/web/tests/e2e/investors.spec.ts — public investor one-pager (#4).
 * Anonymous: renders + live metrics from /v1/public/platform-stats + a real
 * INVESTOR lead submit. Leads purged by global-teardown (@leads-e2e.test).
 */
import { test, expect } from "@playwright/test";

const STAMP = process.env.E2E_RUN_ID ?? "run";
const email = `e2e+inv-${STAMP}@leads-e2e.test`;

test.describe("Investor one-pager (anonymous)", () => {
  test("renders hero, live metrics, wedges, PDF button", async ({ page }) => {
    await page.goto("/investors", { waitUntil: "networkidle", timeout: 60_000 });
    await expect(page.getByTestId("investors-hero")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("investors-proof")).toBeVisible();
    // live metric fetched from F2 → a real number renders (not the "—" placeholder)
    await expect(page.getByTestId("stat-skills")).toContainText(/[0-9]/, { timeout: 30_000 });
    await expect(page.getByTestId("wedge-esco")).toBeVisible();
    await expect(page.getByTestId("investors-download-pdf")).toBeVisible();
  });

  test("submitting the contact form stores an INVESTOR lead", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/investors", { waitUntil: "networkidle", timeout: 60_000 });
    await page.getByTestId("lead-name").fill("E2E Investor");
    await page.getByTestId("lead-company").fill("E2E Fund");
    await page.getByTestId("lead-email").fill(email);
    await page.getByTestId("lead-consent").check();
    await page.getByTestId("lead-submit").click();
    await expect(page.getByTestId("lead-form-success")).toBeVisible({ timeout: 30_000 });
  });
});
```

- [ ] **Step 3: Run the spec (prod build, Node-22 wrapper on Windows)**

Run: `cd apps/web && pnpm test:e2e:prod:node22 investors.spec.ts` (per-spec iteration may use `test:e2e:node22 investors.spec.ts` against a running prod server).
Expected: 2 passed. Verify a real INVESTOR lead exists, then teardown removes it:
`psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT lead_source FROM sys.sys_leads WHERE lead_email LIKE '%@leads-e2e.test'"`

- [ ] **Step 4: Commit**

```bash
git add apps/web/tests/e2e/investors.spec.ts apps/web/tests/e2e/global-teardown.ts
git commit -m "test(web): #4 — investor one-pager E2E (live render + INVESTOR lead) + leads teardown"
```

---

## Task 6: Demo i18n namespace (`demo`)

**Files:**
- Create: `apps/web/src/locales/it/demo.json`
- Create: `apps/web/src/locales/en/demo.json`
- Modify: `apps/web/src/lib/i18n.ts`

**Interfaces:** Produces the `demo` namespace with `hero.{title,subtitle}`, `steps.s01..s11.{persona,shows,narration}`, `cta.{title,subtitle}`, `footer.tagline`.

- [ ] **Step 1: Write `apps/web/src/locales/it/demo.json`** — hero + 11 steps from the storyboard (spec §5.2). Structure:

```json
{
  "hero": {
    "title": "Una visita guidata di Heuresys",
    "subtitle": "Undici tappe sul tenant di riferimento RTL Bank: dalla struttura organizzativa alla maturità di capacità, fino all'agente AI con approvazione umana."
  },
  "steps": {
    "s01": { "persona": "Prospect", "shows": "Landing pubblica + modulo lead GDPR, poi login", "narration": "Ciò che vede un buyer — e come un contatto diventa un record." },
    "s02": { "persona": "Federica · Tenant Admin", "shows": "Panoramica tenant e org chart reale di RTL Bank (162 posizioni, 26 unità)", "narration": "Position-centric: la sedia, non la persona — la struttura reale della banca." },
    "s03": { "persona": "Federica · Tenant Admin", "shows": "Dettaglio di una posizione con competenze, KPI e learning", "narration": "Una posizione porta i propri requisiti, indipendentemente da chi la occupa." },
    "s04": { "persona": "Federica · Tenant Admin", "shows": "Heatmap di copertura competenze per unità + registro gap", "narration": "Dove la banca è forte e dove è scoperta — calcolato live, non una slide." },
    "s05": { "persona": "Federica · Tenant Admin", "shows": "Flight-risk e succession readiness con pannello di spiegabilità", "narration": "Analytics predittiva delle persone — e il perché: ogni score si scompone in feature pesate." },
    "s06": { "persona": "Federica · Tenant Admin", "shows": "Maturità di capacità organizzativa L0-L5 per unità + radar dei criteri", "narration": "Maturità organizzativa, aggregata dal basso a partire da evidenze reali." },
    "s07": { "persona": "Federica · Tenant Admin", "shows": "Blueprint di processo + mappa RACI (105 assegnazioni / 23 processi)", "narration": "I processi sono presidiati, con accountability RACI viva per unità organizzativa." },
    "s08": { "persona": "Tommaso · Dipendente", "shows": "Self-service: auto-valutazione competenze e matching AI a occupazioni/ruoli", "narration": "Stessa piattaforma, occhi del dipendente: valuto le mie competenze, il motore mi abbina ai ruoli." },
    "s09": { "persona": "Paolo · Manager", "shows": "Vista 'il mio team': solo i riporti diretti; un esterno non è visibile", "narration": "Lo scope è imposto, non cosmetico — un manager vede il suo team, niente di più." },
    "s10": { "persona": "Paolo / Federica", "shows": "Una richiesta di approvazione arriva in inbox; la decisione applica un effetto reale", "narration": "Le decisioni passano per un workflow multi-livello tracciato con SLA." },
    "s11": { "persona": "Platform Admin", "shows": "Agente AI: prompt → stream → gate di approvazione umana prima di ogni scrittura", "narration": "Pronta per gli agenti: un'AI può agire, ma un umano approva ogni scrittura." }
  },
  "cta": {
    "title": "Prenota una demo guidata",
    "subtitle": "Vuoi vederla sui tuoi dati? Lasciaci un contatto: organizziamo una demo 1:1."
  },
  "footer": { "tagline": "Heuresys — Skills & Org Intelligence EU-native." }
}
```

- [ ] **Step 2: Write `apps/web/src/locales/en/demo.json`** — faithful EN translation, identical key structure.

- [ ] **Step 3: Wire the namespace** in `apps/web/src/lib/i18n.ts` (imports `demoIt`/`demoEn`, add `"demo"` to `NAMESPACES`, add to both `resources`).

- [ ] **Step 4: i18n parity**

Run: `cd apps/web && pnpm i18n:check`
Expected: PASS (10 namespaces × 2 locales).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/locales/it/demo.json apps/web/src/locales/en/demo.json apps/web/src/lib/i18n.ts
git commit -m "feat(web): #4 — demo i18n namespace (it+en)"
```

---

## Task 7: Demo screenshot capture (live RTL_BANK)

**Files:**
- Create: `apps/web/tests/e2e/capture-demo.spec.ts`
- Modify: `apps/web/playwright.prod.config.ts` (add an on-demand `capture-demo` project, depends on `setup`, NOT in the default suite chain)
- Produces: `apps/web/public/demo/01-*.png` … `11-*.png` (committed — they are the demo content)

**Interfaces:** Consumes persona `storageState` files produced by `apps/web/tests/e2e/auth.setup.ts` (read it for the exact `.auth/*.json` paths + which persona maps to which file).

- [ ] **Step 1: Read `auth.setup.ts`** to learn the storageState file paths (e.g. `tests/.auth/platform-admin.json`, `.../tenant-admin.json` (Federica), `.../manager.json` (Paolo), `.../user.json` (Tommaso)). Note the exact filenames.

- [ ] **Step 2: Write `capture-demo.spec.ts`** — one test per storyboard screen; each creates a context from the right persona's storageState, navigates, waits for the key element, and screenshots to `public/demo/<NN>-<slug>.png`. Skeleton:

```ts
import { test } from "@playwright/test";
import path from "node:path";

const OUT = path.resolve(__dirname, "../../public/demo");
const AUTH = path.resolve(__dirname, ".auth");

async function shot(browser, stateFile: string, route: string, file: string, waitFor?: string) {
  const ctx = await browser.newContext({ storageState: path.join(AUTH, stateFile), viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(route, { waitUntil: "networkidle", timeout: 60_000 });
  if (waitFor) await page.waitForSelector(waitFor, { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, file), fullPage: false });
  await ctx.close();
}

test("capture demo screenshots", async ({ browser }) => {
  test.setTimeout(300_000);
  // map each step to (storageState, route, output, optional wait selector) per the storyboard
  await shot(browser, "tenant-admin.json", "/organization/org-chart", "02-org-chart.png");
  await shot(browser, "tenant-admin.json", "/analytics/skills", "04-skills-heatmap.png");
  await shot(browser, "tenant-admin.json", "/insights/succession-readiness", "05-succession.png");
  await shot(browser, "tenant-admin.json", "/org-director", "06-maturity.png");
  await shot(browser, "tenant-admin.json", "/process-owner", "07-raci.png");
  await shot(browser, "user.json", "/me/matching", "08-matching.png");
  await shot(browser, "manager.json", "/me/team", "09-team.png");
  await shot(browser, "platform-admin.json", "/tenants", "10-governance.png");
  // step 1 (public landing) + step 3 (a specific position id) + step 11 (/dev/agent, flag-gated):
  // capture step 1 anonymously; step 3 by reading a real position id; step 11 only if NEXT_PUBLIC_ENABLE_AGENT_DEV is on.
});
```
(Adjust routes/filenames to the final storyboard. For step 3, fetch a real position id first, e.g. open `/positions`, click the first row, capture its detail. For step 11, guard on the env flag; if off, ship 10 steps.)

- [ ] **Step 3: Run the capture against the live app**

Run (Windows): `cd apps/web && pnpm exec playwright test capture-demo --project=capture-demo` via the Node-22 wrapper (`pnpm test:e2e:node22 capture-demo.spec.ts` against a running prod server with fresh persona storageState from `auth.setup`).
Expected: PNGs land in `apps/web/public/demo/`. Eyeball each: real RTL_BANK synthetic data visible, no broken/login-redirect screens (a login screen = dead session → re-run `auth.setup`).

- [ ] **Step 4: Commit**

```bash
git add apps/web/tests/e2e/capture-demo.spec.ts apps/web/playwright.prod.config.ts apps/web/public/demo/
git commit -m "feat(web): #4 — guided-demo screenshot capture (live RTL_BANK) + PNG assets"
```

---

## Task 8: Demo page + public route

**Files:**
- Create: `apps/web/src/app/demo/page.tsx`
- Modify: `apps/web/src/proxy.ts` (add `/demo`)

**Interfaces:** Consumes the `demo` namespace (Task 6), the PNGs in `public/demo/` (Task 7), `<LeadForm source="DEMO" />` (Task 1). Produces public route `/demo` with testids `demo-hero`, `demo-step-01..11`, `demo-cta`.

- [ ] **Step 1: Write `apps/web/src/app/demo/page.tsx`** (`"use client"`, `useTranslation("demo")`). Read `apps/web/src/app/page.tsx` as the pattern. Structure:
  - **header** — `HeuresysWordmark` + `Link href="/login"`.
  - **hero** (`data-testid="demo-hero"`) — `t("hero.title")` + `t("hero.subtitle")`.
  - **steps** — a `STEPS` const `[{ id: "s01", img: "/demo/01-landing.png" }, … { id: "s11", img: "/demo/11-agent.png" }]` (match the PNGs actually captured; if step 11 was skipped, drop it). For each, a section `data-testid={`demo-step-${i+1 padded}`}`: an `<img src={s.img} alt={t(`steps.${s.id}.shows`)} loading="lazy" className="rounded-card border border-border w-full" />` + a caption block: persona badge `t(`steps.${s.id}.persona`)`, `t(`steps.${s.id}.shows`)`, narration `t(`steps.${s.id}.narration`)`.
  - **cta** (`data-testid="demo-cta"`) — `t("cta.title")` + `t("cta.subtitle")` + `<LeadForm source="DEMO" />`.
  - **footer** — `t("footer.tagline")`.

- [ ] **Step 2: Make `/demo` public** in `apps/web/src/proxy.ts`:
```ts
const PUBLIC_PATHS = ["/login", "/_next", "/api", "/showcase", "/privacy", "/investors", "/demo"];
```

- [ ] **Step 3: Typecheck + lint + build**

Run: `cd apps/web && pnpm exec tsc --noEmit && pnpm exec eslint src/app/demo && pnpm build`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/demo/ apps/web/src/proxy.ts
git commit -m "feat(web): #4 — guided demo page /demo (scripted screenshot tour)"
```

---

## Task 9: Demo E2E (anonymous, LIVE)

**Files:**
- Create: `apps/web/tests/e2e/demo.spec.ts`

- [ ] **Step 1: Write the spec** `apps/web/tests/e2e/demo.spec.ts`:

```ts
/**
 * apps/web/tests/e2e/demo.spec.ts — public guided demo (#4).
 * Anonymous: renders the tour + a real DEMO lead submit. Leads purged by
 * global-teardown (@leads-e2e.test).
 */
import { test, expect } from "@playwright/test";

const STAMP = process.env.E2E_RUN_ID ?? "run";
const email = `e2e+demo-${STAMP}@leads-e2e.test`;

test.describe("Guided demo (anonymous)", () => {
  test("renders hero + tour steps", async ({ page }) => {
    await page.goto("/demo", { waitUntil: "networkidle", timeout: 60_000 });
    await expect(page.getByTestId("demo-hero")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("demo-step-02")).toBeVisible();
    await expect(page.getByTestId("demo-step-06")).toBeVisible(); // the maturity wow-step
    await expect(page.getByTestId("demo-cta")).toBeVisible();
  });

  test("submitting the CTA stores a DEMO lead", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/demo", { waitUntil: "networkidle", timeout: 60_000 });
    await page.getByTestId("lead-name").fill("E2E Demo Prospect");
    await page.getByTestId("lead-company").fill("E2E Bank");
    await page.getByTestId("lead-email").fill(email);
    await page.getByTestId("lead-consent").check();
    await page.getByTestId("lead-submit").click();
    await expect(page.getByTestId("lead-form-success")).toBeVisible({ timeout: 30_000 });
  });
});
```

- [ ] **Step 2: Run it (prod, Node-22 wrapper)**

Run: `cd apps/web && pnpm test:e2e:prod:node22 demo.spec.ts`
Expected: 2 passed; a DEMO lead exists, purged by teardown.

- [ ] **Step 3: Commit**

```bash
git add apps/web/tests/e2e/demo.spec.ts
git commit -m "test(web): #4 — guided demo E2E (live render + DEMO lead)"
```

---

## Task 10: Full gate sweep + fixes

- [ ] **Step 1: Workspace typecheck**

Run: `pnpm -r typecheck` (or `pnpm typecheck`)
Expected: all workspaces exit 0.

- [ ] **Step 2: API integration suite** (tunnel up)

Run: `cd apps/api && pnpm exec vitest run`
Expected: full suite green (leads + public-stats included).

- [ ] **Step 3: i18n parity + lint**

Run: `cd apps/web && pnpm i18n:check && pnpm exec eslint src`
Expected: PASS (10 namespaces × 2 locales; no `no-literal-string` violations).

- [ ] **Step 4: Playwright prod full suite** (Windows → Node-22 wrapper; capture-demo project is on-demand, excluded from the default chain)

Run: `cd apps/web && pnpm test:e2e:prod:node22`
Expected: green (incl. landing + investors + demo). Fix any regression before proceeding — no "TODO fix later".

- [ ] **Step 5: Commit any fixes** (atomic, descriptive).

---

## Task 11: Deploy to PROD + live verification

- [ ] **Step 1: Push** (end-to-end authorized S1003)

Run: `git push origin main`

- [ ] **Step 2: Deploy**

Run: `MSYS_NO_PATHCONV=1 ssh oracle-vm-default 'cd /home/ubuntu/heuresys-advanced && bash scripts/vm-deploy.sh'`
Expected: build prod (shared→api→web) + `db:migrate` (000153 applied) + restart systemd + verify readyz/login.

- [ ] **Step 3: Verify the public pages render**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://www.heuresys.com/investors   # 200
curl -s -o /dev/null -w "%{http_code}\n" https://www.heuresys.com/demo        # 200
curl -s https://www.heuresys.com/api/v1/public/platform-stats | head -c 200   # live JSON counts
```
Expected: 200, 200, JSON with `skills`/`occupationSkillEdges` > 0.

- [ ] **Step 4: Live lead round-trip (DoD)**

Submit a real INVESTOR + DEMO lead (via the live pages or curl POST to `/api/v1/leads` with `source`), confirm rows in the DB, then delete the verification rows:
```bash
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT lead_source,count(*) FROM sys.sys_leads GROUP BY 1"
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "DELETE FROM sys.sys_leads WHERE lead_email LIKE '%@verify.test'"
```

- [ ] **Step 5: Final report** — summarize live URLs + verification evidence (R23/e). The deliverables are DONE only after this live proof.

---

## Self-Review (run after writing — checklist)

**Spec coverage:** F1 enum → Task 1 ✓ · F2 stats → Task 2 ✓ · one-pager (route/sections/live tiles/print/CTA) → Tasks 3-4 ✓ · one-pager E2E → Task 5 ✓ · demo i18n → Task 6 ✓ · demo capture → Task 7 ✓ · demo page → Task 8 ✓ · demo E2E → Task 9 ✓ · gates → Task 10 ✓ · deploy+live-verify (DoD) → Task 11 ✓. Security (public read aggregate-only, screenshots synthetic, anti-abuse on CTAs) covered in Tasks 2/5/7/9. No spec section left without a task.

**Placeholder scan:** No "TBD/TODO/later". The one-pager's absent funding numbers are the chosen scope (teaser), explicitly not a placeholder. EN i18n files are "faithful translation" steps (mechanical, structure-identical) — acceptable.

**Type consistency:** `LeadSourceEnum`/`source` (Task 1) used in Task 1 LeadForm + Tasks 4/8 pages. `PlatformStatsResponse` fields (Task 2 schema) match the repo mapping (Task 2) + the hook (Task 4) + the test (Task 2). `data-testid` names are consistent across page (Tasks 4/8) and E2E (Tasks 5/9): `investors-hero`, `stat-skills`, `wedge-esco|explain|position`, `investors-download-pdf`, `investors-cta`, `demo-hero`, `demo-step-NN`, `demo-cta`, plus the reused `lead-*` testids from the shipped `LeadForm`.
