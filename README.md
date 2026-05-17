# Heuresys Advanced — HRMS / BPM Platform v5

Position-centric HR + BPM platform built as a pnpm monorepo. Fastify 4 API on PostgreSQL 16, Next.js 15 admin SPA + ESS portal, shared Zod contracts. Multi-tenant via API middleware (no Postgres RLS), 8 roles × 98 permissions × 388 mappings seeded.

> **Status — 2026-05-17 (HEAD `6e46744` on `main`)**
> MVP-1 + MVP-2a + MVP-2b feature surface **closed**. 277 live API endpoints · 203/203 vitest green · 42 web routes live · 50+ Playwright E2E assertions on live OCI VM data · zero mocks.

---

## Headline numbers

| Layer | Count | Notes |
|---|---|---|
| API endpoints | **277** | 7 auth · 258 business · 13 ESS · 1 dashboard aggregator · 4 compensation · 4 me-extras · 1 admin/roles matrix · 2 health |
| API modules | **58** | Fastify routes registered under `/v1/*` |
| Shared Zod schemas | **256+** | `@heuresys/shared` workspace package |
| DB tables | **123** in `sys.*` + 11 views + aux schemas | 28 idempotent migrations |
| Integration tests | **203 / 203** | vitest, single-thread, real DB via SSH tunnel |
| Web routes shipped | **42** | 28 admin + 14 ESS (`/me/*`) |
| Playwright E2E specs | **12** | live-data, storageState-backed, ≥50 assertions |
| Design system components | **51** | linked via pnpm `link:` from sibling repo `ux-design-shared` · live Storybook: **[spen-zosky.github.io/ux-design-shared](https://spen-zosky.github.io/ux-design-shared/)** |

---

## Tech stack

**Backend** — Fastify 4.28 · Zod typeprovider · Argon2id (64 MiB / 3 / 4) · RS256 JWT 15 min + 30 d refresh rotation w/ replay detection · CSRF double-submit · raw parameterised SQL on `pg` (Drizzle only as wrapper) · `vitest` + `supertest` via `app.inject`.

**Frontend** — Next.js 15.1 App Router · React 19.2 · Tailwind CSS 4.3 · TanStack Query v5 · React Hook Form 7.55 · Zod 3.25 · react-i18next 15 (it/en) · Playwright 1.49 · `@heuresys/ui` (51 components, consumed as live `link:` symlink, no duplication).

**Database** — PostgreSQL 16 (native, no Docker — ADR-0004) running on OCI VM `oracle-vm-default` (eu-milan-1), reached via SSH tunnel `5433 → :5432`. Multi-tenant via FK + API middleware filter (ADR — never RLS).

**Tooling** — pnpm 9 workspaces · TypeScript 5.7 strict mode (`noUncheckedIndexedAccess`, `noUnusedLocals/Parameters`) · Node 20 LTS · Git on Windows + macOS + Linux.

---

## Monorepo layout

```
heuresys-advanced/
├── apps/
│   ├── api/                          Fastify API (58 modules, /v1/*)
│   │   ├── src/
│   │   │   ├── app.ts                 13-step plugin chain
│   │   │   ├── server.ts              network bind + env validation
│   │   │   ├── db/client.ts           singleton pg pool + withTransaction
│   │   │   ├── middleware/            auth · rbac · csrf · tenantContext
│   │   │   ├── modules/
│   │   │   │   ├── auth/              7 endpoints + role-permissions matrix
│   │   │   │   ├── compensation/      4 endpoints (decision support, I8)
│   │   │   │   ├── dashboard/         1 role-gated aggregator
│   │   │   │   ├── me/                17 ESS endpoints (hard self-scope)
│   │   │   │   ├── …55 more business modules
│   │   │   └── errors/                typed error classes
│   │   └── test/                      203 integration tests
│   │
│   └── web/                          Next.js 15 SPA (42 routes)
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx         root provider tree
│       │   │   ├── login/page.tsx     auth pilot
│       │   │   └── (authenticated)/
│       │   │       ├── layout.tsx     role-gated nav + logout
│       │   │       ├── me/…           14 ESS pages
│       │   │       ├── dashboard/     admin landing
│       │   │       ├── users/…        list + detail
│       │   │       ├── positions/…    list + detail + 3 sub-resources
│       │   │       ├── tenants/…      list + 3-tab detail + typing wizard
│       │   │       ├── blueprints/…   list + 2-tab variant detail
│       │   │       ├── visualizations/  list + graph detail
│       │   │       ├── career-succession/   3-tab page
│       │   │       ├── compensation-intelligence/
│       │   │       ├── admin/roles/   role × perm matrix
│       │   │       └── …other admin routes
│       │   ├── lib/api/               fetch · csrf-store · auth · errors
│       │   ├── providers/             QueryClient + i18n
│       │   └── locales/{it,en}/
│       └── tests/e2e/                 11 specs + 1 setup project
│
├── packages/
│   └── shared/                       @heuresys/shared (Zod schemas)
│
├── db/
│   ├── migrations/                    28 idempotent SQL files
│   ├── seeds/                         RTL_BANK_REFERENCE (158 users + 158 positions)
│   └── scripts/                       .ps1 + .sh twins (create / migrate / seed)
│
├── docs/
│   ├── api/API_IMPLEMENTATION_PLAN.md
│   ├── api/MVP_2A_API_GAP_AUDIT.md
│   ├── architecture/adr/              11 Accepted ADRs
│   ├── frontend/FRONTEND_IMPLEMENTATION_PLAN.md
│   ├── security/AUTH_SECURITY_PLAN.md
│   └── db/TARGET_SCHEMA_DESIGN.md
│
├── CLAUDE.md                          Conventions for AI-assisted dev
├── HANDOFF.md                         Live session state
├── NEXT_SESSION_MVP_2A.md             Live-data E2E doctrine
└── README.md                          (this file)
```

---

## Getting started

### 1. Prerequisites

- Node.js ≥ 20.11 · pnpm ≥ 9
- PostgreSQL 16 reachable on `localhost:5433` (we use an SSH tunnel to an OCI VM — see `.env.example`)
- SSH access configured for `oracle-vm-default` host
- For the web E2E suite: `playwright install chromium` runs once after `pnpm install`

### 2. Clone + install

```bash
git clone https://github.com/Spen-Zosky/heuresys-advanced.git
cd heuresys-advanced
# Sibling repo for the design system (linked via pnpm link:)
git clone https://github.com/Spen-Zosky/ux-design-shared.git ../ux-design-shared
( cd ../ux-design-shared && npm install --legacy-peer-deps )
pnpm install
```

### 3. Environment

Copy `.env.example` to `.env` at the repo root. Required variables include `POSTGRES_*` connection params, `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` PEM strings (gitignored under `.secrets/`), and `COOKIE_SECRET` (48-byte base64).

### 4. Tunnel + DB

```bash
ssh -fN -L 5433:localhost:5432 oracle-vm-default
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "\dt sys.sys_auth*"
```

### 5. Run

```bash
pnpm dev                  # all workspaces in parallel
# or per-app:
cd apps/api && pnpm dev   # → :3001  Fastify API
cd apps/web && pnpm dev   # → :3000  Next.js SPA
```

Open `http://localhost:3000`, log in as one of the seeded personas:

| Persona | Email | Role | Lands on |
|---|---|---|---|
| Platform Admin | `admin@heuresys.com` | `PLATFORM_ADMIN` | `/dashboard` |
| Tenant Admin | `tenant_admin_test@rtl-bank.test` | `TENANT_ADMIN` | `/dashboard` |
| Manager | `manager_test@rtl-bank.test` | `MANAGER` | `/dashboard` |
| Employee | `employee_test@rtl-bank.test` | `USER` | `/me` |
| Outsider | `outsider_test@rtl-bank.test` | `USER` | `/me` |

Password for all five (seeded): `Admin#PassW0rd!`.

---

## Testing

### API integration tests

```bash
cd apps/api
pnpm test                                                  # full suite (203 tests, ~110 s)
pnpm exec vitest run test/<module>.integration.test.ts    # focused
```

Tests hit the **real DB through the SSH tunnel**. There are no mocks; the auth flow rotates real cookies and validates the JWT chain end-to-end.

### Frontend E2E

```bash
cd apps/web
pnpm exec playwright install --with-deps chromium     # once
pnpm exec playwright test                              # full suite
pnpm exec playwright test landing-pages.spec.ts        # focused
```

The setup project (`tests/e2e/auth.setup.ts`) logs in 3 personas once and persists their cookie state to `tests/.auth/<persona>.json`, so individual specs reuse the session without hitting the login rate limit (10/5 min).

Every spec asserts on **live data** from the seeded `RTL_BANK_REFERENCE` tenant (158 personas + 158 positions). No mocks, no fixtures inlined in tests, no stubbed endpoints.

---

## Non-negotiable invariants

These are baked into the architecture and cannot be revisited without an ADR / decision-log entry:

- **I1** Position-centric model. Owner ≠ Incumbent.
- **I3 / I4** Business tables in `sys.sys_<plural>`. Aux schemas: `staging`, `brownfield`, `audit`.
- **I5** Tenant isolation = FK + API middleware filter. **Never** Postgres RLS.
- **I7** Auth tables (`sys.sys_auth_*`) are separate from `sys.sys_users`.
- **I8** Compensation module is **decision support only**, not payroll execution.
- **I9** Position Intelligence Profile is a view, not a JSONB blob (ADR-0008).
- **I13** PostgreSQL 16 native — no Docker (ADR-0004).
- **RD-08** Categorical fields = `varchar(N) + CHECK`, never Postgres `ENUM`.
- **ADR-0011** ESS portal is hard self-scoped — no `:userId` in `/v1/me/*` URLs; `selfActor()` derives identity from JWT.

Full invariant list + rationale in `CLAUDE.md`.

---

## Roadmap

| Milestone | Status |
|---|---|
| MVP-0 — Bootstrap, DB, 27 migrations, seed | ✅ closed |
| MVP-1 — API build-out (56 business modules + auth) | ✅ closed (commit `732e08b`) |
| MVP-2a — Admin SPA (28 routes) + auth client | ✅ feature complete (commit `6e46744`) |
| MVP-2b — ESS portal (`/v1/me/*` + 14 web pages) | ✅ feature complete |
| MVP-2a tail — `pnpm build` / `i18n:check` / axe a11y audit | ⏳ open |
| Visualization renderers — React Flow / Mermaid / Dagre layouts | ⏳ open |
| MVP-3 — Admin role CRUD, advanced workflows, payroll handoff integration | ⏳ planned |

For details on what's next, see `HANDOFF.md` (live state) and `NEXT_SESSION_MVP_2A.md` (live-data E2E doctrine).

---

## Repository

- **Code**: https://github.com/Spen-Zosky/heuresys-advanced (public)
- **Design system**: https://github.com/Spen-Zosky/ux-design-shared (public, consumed via pnpm `link:`)
- **Design system Storybook (live)**: https://spen-zosky.github.io/ux-design-shared/ — 51 components, 122 stories, auto-deployed on every push to `main`
- **License**: UNLICENSED (private project, contact the author before reuse)
- **Author**: Enzo Spenuso

Generated and maintained with [Claude Code](https://claude.com/claude-code).
