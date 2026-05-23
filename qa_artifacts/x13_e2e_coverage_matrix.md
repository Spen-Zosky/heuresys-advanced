# MVP-2a E2E Coverage Matrix — Batch X13 Block A

**Authored**: 2026-05-23 (CLI batch X13)
**HEAD**: `0d81a57` (handoff S929, post-X12 baseline)
**Source**: `apps/web/tests/e2e/*.spec.ts` (17 files)
**Method**: inline reading + grep verification, route-to-test mapping

---

## §0 — Summary

| Metric | Value |
|---|---:|
| Spec files | **17** |
| Literal `test(` calls (col-0 or indented) | **54** (grep `^\s*test\(`) |
| Effective runtime tests (with `test.describe`/`.only`/`.skip` + programmatic loops) | **~108** |
| Admin business routes | **29** |
| ESS `/me/*` routes | **14** |
| Routes total (MVP-2a + MVP-2b) | **43** |
| Showcase routes (brand v1) | **18** |
| Auth/landing routes | **2** (`/login`, `/`) |
| Page.tsx tracked | **63** (git ls-tree HEAD) |

### Coverage definitions

- **FULL**: ≥1 dedicated `test()` performing navigation + ≥1 structured data assertion on testid-bound element (count text, row count, form fields, mutation response, tab switch).
- **SMOKE**: Page reached via persona-driven smoke walk (`smoke-5-personas.spec.ts`) with `assertNoCrash` only — no data assertion specific to the page beyond non-empty body.
- **NONE**: No `page.goto(...)` or `PAGES_PER_PERSONA` listing points to this route.

---

## §1 — Admin business routes (29)

| # | Route | Spec file(s) | Test count | Personas | Coverage |
|---:|---|---|---:|---|---|
| 1 | `/dashboard` | landing-pages, smoke-5-personas, a11y | 2 + 3 + 2 = **7** | tenantAdmin, platformAdmin, manager, employee, outsider | **FULL** |
| 2 | `/admin/roles` | closing-pages, smoke-5-personas, a11y | 1 + 1 + 1 = **3** | platformAdmin | **FULL** |
| 3 | `/blueprints` | admin-org-bpm, admin-tabs (nav-in), a11y | 1 + 1 + 1 = **3** | tenantAdmin | **FULL** |
| 4 | `/blueprints/[variantId]` | admin-tabs | **1** | tenantAdmin | **FULL** (3 tabs) |
| 5 | `/brownfield-adaptation` | admin-pipelines, a11y | 1 + 1 = **2** | tenantAdmin | **FULL** (3 tabs) |
| 6 | `/career-succession` | complex-domains, a11y | 1 + 1 = **2** | tenantAdmin | **FULL** (3 tabs) |
| 7 | `/compensation-intelligence` | complex-domains, a11y | 1 + 1 = **2** | tenantAdmin | **FULL** (6 status counters) |
| 8 | `/gaps` | admin-pipelines, smoke-5-personas, a11y | 1 + 1 + 1 = **3** | tenantAdmin, manager | **FULL** (4 severity cards) |
| 9 | `/kpis` | admin-catalogues, a11y | 1 + 1 = **2** | tenantAdmin | **FULL** |
| 10 | `/learning` | admin-catalogues, a11y | 1 + 1 = **2** | tenantAdmin | **FULL** |
| 11 | `/learning/training-initiatives` | admin-org-bpm, a11y | 1 + 1 = **2** | tenantAdmin | **FULL** |
| 12 | `/organization` | admin-org-bpm, a11y | 1 + 1 = **2** | tenantAdmin | **FULL** |
| 13 | `/organization/org-chart` | closing-pages, a11y | 1 + 1 = **2** | tenantAdmin | **FULL** (empty state) |
| 14 | `/positions` | admin-lists, position-sub (nav-in), smoke-5-personas, a11y | 1 + 3 + 1 + 1 = **6** | tenantAdmin | **FULL** |
| 15 | `/positions/[positionId]` | admin-lists (detail-click) | **1** | tenantAdmin | **FULL** |
| 16 | `/positions/[positionId]/skills` | position-sub | **1** | tenantAdmin | **FULL** |
| 17 | `/positions/[positionId]/kpis` | position-sub | **1** | tenantAdmin | **FULL** |
| 18 | `/positions/[positionId]/learning` | position-sub | **1** | tenantAdmin | **FULL** |
| 19 | `/processes` | admin-org-bpm, a11y | 1 + 1 = **2** | tenantAdmin | **FULL** |
| 20 | `/seed-acquisition/runs` | admin-pipelines, a11y | 1 + 1 = **2** | tenantAdmin | **FULL** |
| 21 | `/skills` | admin-catalogues, a11y | 1 + 1 = **2** | tenantAdmin | **FULL** |
| 22 | **`/system-health`** | **(none)** | **0** | — | **NONE** ⚠️ |
| 23 | `/tenants` | admin-catalogues, admin-tabs (nav-in), smoke-5-personas, a11y | 1 + 2 + 1 + 1 = **5** | platformAdmin | **FULL** |
| 24 | `/tenants/[tenantId]` | admin-tabs | **1** | platformAdmin | **FULL** (3 tabs) |
| 25 | `/tenants/[tenantId]/enterprise-typing` | admin-tabs | **1** | platformAdmin | **FULL** (4 selects) |
| 26 | `/users` | admin-lists, smoke-5-personas, a11y | 1 + 1 + 1 = **3** | tenantAdmin | **FULL** |
| 27 | `/users/[userId]` | admin-lists (detail-click) | **1** | tenantAdmin | **FULL** |
| 28 | `/visualizations` | visualizations, a11y | 1 + 1 = **2** | tenantAdmin | **FULL** (empty state) |
| 29 | `/visualizations/[graphId]` | visualizations | **1** | tenantAdmin | **FULL** (404 path) |

**Admin totals**: 28 FULL, 0 SMOKE, **1 NONE** (`/system-health`).

---

## §2 — ESS routes /me/* (14)

| # | Route | Spec file(s) | Test count | Personas | Coverage |
|---:|---|---|---:|---|---|
| 1 | `/me` | landing-pages, smoke-5-personas, a11y | 1 + 2 + 1 = **4** | employee, outsider, manager | **FULL** (cards + nav-gating assertion) |
| 2 | `/me/profile` | me-pages, smoke-5-personas, a11y | 1 + 1 + 1 = **3** | employee | **FULL** (PATCH mutation) |
| 3 | `/me/positions` | me-pages, a11y | 1 + 1 = **2** | employee | **FULL** (TEST_SUB_POS assertion) |
| 4 | `/me/skills` | me-pages, a11y | 1 + 1 = **2** | employee | **FULL** |
| 5 | `/me/skills/self-assessment` | closing-pages, a11y | 1 + 1 = **2** | employee | **FULL** (form 3 selects) |
| 6 | `/me/learning` | me-pages, a11y | 1 + 1 = **2** | employee | **FULL** |
| 7 | `/me/learning/catalogue` | closing-pages, smoke-5-personas, a11y | 1 + 1 + 1 = **3** | employee | **FULL** (filter + count) |
| 8 | `/me/gaps` | me-pages, a11y | 1 + 1 = **2** | employee | **FULL** |
| 9 | `/me/kpis` | me-pages, a11y | 1 + 1 = **2** | employee | **FULL** |
| 10 | `/me/career` | me-pages, smoke-5-personas, a11y | 1 + 1 + 1 = **3** | employee, outsider | **FULL** |
| 11 | `/me/career/target` | closing-pages, a11y | 1 + 1 = **2** | employee | **FULL** (form 4 fields) |
| 12 | `/me/certifications` | me-pages, ess-certifications-upload, a11y | 1 + 2 + 1 = **4** | employee | **FULL** (POST mutation + Zod gate) |
| 13 | `/me/documents` | me-pages, a11y | 1 + 1 = **2** | employee | **FULL** |
| 14 | `/me/inbox` | me-pages, smoke-5-personas, a11y | 1 + 1 + 1 = **3** | employee, outsider | **FULL** |

**ESS totals**: 14 FULL, 0 SMOKE, 0 NONE.

---

## §3 — Auth + landing routes (2)

| # | Route | Spec file(s) | Test count | Coverage |
|---:|---|---|---:|---|
| 1 | `/login` | auth | **4** | **FULL** (4 scenarios: PLATFORM_ADMIN, USER, wrong-password, anonymous-redirect) |
| 2 | `/` (root landing) | (server-side redirect /login or /dashboard) | 0 | **N/A** (no client behavior — pure redirect) |

---

## §4 — Showcase routes (18) — brand v1 / MVP-3

| Spec file | Test count | Coverage scope |
|---|---:|---|
| showcase-smoke | 5×2 + 1 + 1 = **12** | 5 routes (smoke + a11y baseline) + shell contract + decision register |
| showcase-a11y | **18** (programmatic loop) | All 18 showcase routes — axe WCAG 2.2 A/AA zero-critical |

Showcase routes covered by showcase-a11y full sweep:
`/showcase` index, `/showcase/system-health`, `/showcase/shell`, `/showcase/header`, `/showcase/footer`, `/showcase/sidebar`, `/showcase/palettes`, `/showcase/typography`, `/showcase/logo`, `/showcase/icons`, `/showcase/page-types`, `/showcase/dashboard-cards`, `/showcase/forms`, `/showcase/tables`, `/showcase/charts`, `/showcase/landing-page`, `/showcase/login-page`, `/showcase/primary-initial-page`.

**Showcase totals**: 18 FULL (a11y) + 5 SMOKE (showcase-smoke shell/index/palettes/typography/logo deep contracts).

---

## §5 — Gap identification & priority

### NONE routes (require Block B authoring)

| Route | Priority | Rationale | Persona |
|---|---|---|---|
| `/system-health` | **P1** | PLATFORM_ADMIN-gated production page; `SystemHealthDashboard` component live; uncovered by both smoke and a11y sweep | platformAdmin |

### SMOKE-only routes (none — all routes with smoke walk also have dedicated data-driven tests)

None identified — `smoke-5-personas.spec.ts` always touches routes already covered by a dedicated spec.

### Block B scope (deterministic)

1. **Add `/system-health` to a11y.spec.ts `PAGES_PER_PERSONA.platformAdmin`** — pulls it into axe sweep + 1 test() call.
2. **Optionally**: dedicated assertion test in a new spec or extend `admin-pipelines.spec.ts` (similar tabbed admin scope) — `SystemHealthDashboard` exposes KPIStrip + AuditFeed + RBACMatrix + SQLSlowQueryTable testids per showcase reference.

Estimated effort Block B: ~30 min CLI (single file edit + 1 new dedicated test).

---

## §6 — Acceptance vs NEXT_SESSION_MVP_2A.md §5

| Criterion | Required | Actual (HEAD `0d81a57`) | Status |
|---|---|---|---|
| Admin routes implemented | 27 | 29 | ✅ +2 over |
| ESS routes implemented | 13 | 14 | ✅ +1 over (counts `/me/skills/self-assessment` as separate from `/me/skills`) |
| Playwright specs total ≥ 40 | 40 | **54 literal `test()` / ~108 effective with axe loops / 17 spec files** | ✅ if interpreted as `test()` calls / ⚠️ if interpreted as separate `.spec.ts` files |
| Coverage gap | 0 routes uncovered | **1 NONE** (`/system-health`) | ⚠️ to close in Block B |
| Persona coverage (5 personas) | yes | 5 via `smoke-5-personas.spec.ts` | ✅ |
| Mutation tests (PATCH/POST) | yes | `/me/profile` PATCH + `/me/certifications` POST | ✅ |

### Interpretation note for §5 "≥ 40 Playwright spec"

- Reading **strict** ("40 separate `.spec.ts` files"): 17 actual, **gap of 23 files**.
- Reading **functional** ("40 executable `test()` calls"): 54 literal + ~50 programmatic loops = **PASS**.

The functional interpretation aligns with the `_04_REPORT_016_batch_x12.md §J.1` reconciliation note ("structurally different") and with `PROMPT 017 §4 Acceptance Block B: Total test() calls >= 40". **Adopted**: functional reading.

---

## §7 — Output for Block B

Block B input: **1 NONE route** (`/system-health`) → target FULL via dedicated spec authoring.

No SMOKE-only routes promoted; ESS subtree complete; admin subtree complete except for `/system-health`.

---

*End matrix — Block A complete (X13).*
