# RBAC · UI-interfaces · Perspectives · Per-user prefs — Build Plan (S952→S953)

**Owner**: CLI. **Status**: in execution. Durable SoT for a multi-session epic (survives context compaction).
**Origin**: S952 forensic QA → user-directed architecture: standardize the design system AND build a DB-driven, role-aware, perspective-organized live UI.

## Locked decisions (user-confirmed)
1. **Design system**: in `@heuresys/ui` the ONLY hardcoded colors allowed = the **heuresys logo SVG**. Everything else = semantic tokens / selected palette. Exceptions kept (documented + guard-allowlisted): logo brand hex, achievement **tier** hues, decorative **gradients**. **Scrims → tokenized** (`--color-overlay`). Anti-regression **ESLint guard** lands with the fixes.
2. **Defaults** (already implemented, verified): theme = **dark**, palette = **Default · balanced** (`PALETTES[0]`), login inherits dark. Nothing to build.
3. **Per-user persistence (3c)**: theme+palette remembered **per `user_id` server-side** (DB+API), re-applied every session incl. new device. localStorage = cache, server = source-of-truth.
4. **Roles (a)**: CEO/HR_MANAGER/TEAM_LEADER/TEAM_MEMBER etc. are **auth-roles** (RBAC), NOT positions. Add `auth_role_category` (hierarchical-operational | functional). Roles are **orthogonal to org placement**: `sys_user_auth_roles` (functional grants) is a separate layer from `sys_user_position_assignments` (org structure). Granting a functional role does NOT change org placement → assigning to real users is clean (NO test fixtures).
5. **Registry (b)**: **DB-driven** `sys_ui_interfaces` (code, label, route, icon, sidebar_group, **perspective**, required_resource, required_action, order, is_active). Sidebar 100% from DB.
6. **Perspectives**: top axis = **PET = Process / Enterprise / Talent** (3 perspectives, from the CASCADIA lexicon — PET is literally "3 access perspectives"). Lexicon domains (OPOURSKA/INDOOR/ITLAB/PROGOV/GOKMER/SKILGRO/ESKAP…) = sub-groupings under the 3 perspectives. Empty perspectives → **honest empty-state** (not hidden).
7. **Front B / RBAC seed**: assign the 3 holder-less functional roles (BLUEPRINT_MANAGER, PROCESS_OWNER, READ_ONLY) to **real RTL users** (login added; chosen sensibly by function where determinable). HRMS_MANAGER already has 2 real users → login-only. **No test fixtures.**

## ⚠ TEAMS note (user-flagged, probable addition)
TEAM_LEADER/TEAM_MEMBER imply a **team** entity (a leader leads a *specific* team). Today no team table exists. Probable additions in **R1**: `sys_teams` (team_id, tenant_id, code, name, org_unit_id?, lead_user_id?) + `sys_team_members` (team_id, user_id). Introduces a **3rd scope axis** ("my team") beyond tenant/self/reports-of-mine. Design when R1 lands.

## RBAC model (verified from live DB)
- 8 roles today (flat), 99 permissions, 394 mappings. Scope: `:self` action-suffix = self-scope (DB); `user_auth_role_tenant_id` = tenant scope (grant row); reports-of-mine/cross-tenant = API service layer (I5 FK+middleware, never RLS). Multi-role per user = schema-supported, data not yet used.
- Real findings: NO `rbac:write`/`audit:read` perms (real: role:assign/create/update). Manager-tier roles have NO `:self` → ESS `/me/*` = 403 for them. `/system-health` gated by `tenant:create` (PA-only). READ_ONLY = read:self, no update:self.

## Phases (audit-first per phase, verify, atomic commit)
| Phase | Scope | Repo | Status |
|---|---|---|---|
| **D1** | design-system finalize: scrim→`--color-overlay` token, fix R3 wordmark tests, guard re-verify, commit | ux-design-shared | ✅ DONE — committed ux-design-shared `4b84a32` (local, not pushed) |
| **D2** | consume here: `link:` validate Card/Button/Input + blueprint-detail dark in app; npm publish+bump = **gated user npm auth** | both | ⏳ |
| **R1** | migration `auth_role_category` + new roles + categorize 8 + seed; **probable** `sys_teams`/`sys_team_members` | advanced | ⏳ |
| **R2** | assign 3 functional roles to real users + logins; live-verify 8 roles × routes × 2 themes (matrix) | advanced | ⏳ |
| **U1** | migration `sys_ui_interfaces` + seed registry (every page → PET perspective + permission) + `GET /v1/me/interfaces` | advanced | ⏳ |
| **U2** | live sidebar from DB (permissions × interfaces grouped by perspective) + perspective switcher Process/Enterprise/Talent | advanced | ⏳ |
| **P1** | `sys_user_preferences` + `GET/PATCH /v1/me/preferences` + frontend load-on-login/apply/persist (3c) | advanced | ⏳ |
| **V** | exhaustive E2E: 8 roles × 2 themes × all pages, evidence-based | advanced | ⏳ |

## Commits so far (S952, local main, no push)
88073e0 A1 · cb1361d B-data · bf2713e A2-A5+A1fix · e11317c R1.1 observability · 2346614 R1.2 metrics. (R1.x observability = a DIFFERENT earlier "R1" build, now suspended; not to be confused with the roles phase R1 above.)

---

## ▶ RESUME (fresh session) — START HERE

**Done this session**: design-system standardization (Front A 38 fixes + ESLint guard + D1 scrims→`--color-overlay` + wordmark R3) → committed in **ux-design-shared `4b84a32`** (local, NOT pushed). heuresys-advanced S952 commits (local main, NOT pushed): `88073e0 cb1361d bf2713e e11317c 2346614` + this docs commit.

**🔴 CRITICAL cross-repo gap — do D2 FIRST**: heuresys-advanced still consumes the OLD broken `@heuresys/ui@0.1.1`. The fix is committed in ux-design-shared but NOT consumed here → in the app, Card/Button/Input/blueprint-detail STILL render broken in dark. **D2 bridges it**:
- Option A (stable/portable): bump `@heuresys/ui` + `npm publish` (⚠ outward-facing → Enzo's npmjs auth; explicit yes or `! npm publish` from ux-design-shared/ui) → bump dep here + `pnpm install` → commit lockfile.
- Option B (validate-only): temporary `pnpm.overrides @heuresys/ui: link:../ux-design-shared/ui` → `pnpm install` → rebuild apps/web → verify Card/blueprint-detail dark in browser → REVERT before any commit.

**Phase order**: D2 → R1 → R2 → U1 → U2 → P1 → V (table above). All design decisions LOCKED (top of doc).

**R1 grounding audit — re-run instantly** (read-only; outputs roles taxonomy + per-role permission sets + sys_teams design + real-user picks for the 3 holderless functional roles → present to Enzo before the migration):
`Workflow({scriptPath: "C:\\Users\\enzospenuso\\.claude\\projects\\D--heuresys-advanced\\80a3c939-f5b8-4dff-bf80-3e26eca128df\\workflows\\scripts\\r1-roles-grounding-audit-wf_f5530f75-b66.js"})` (stopped mid-run at close).

**Infra at close (background, persists)**: tunnel :5433 UP · API dev :3001 UP · web prod :3000 UP (serving the `bf2713e` build). Restart if down: tunnel `ssh -fN -L 5433:localhost:5432 oracle-vm-default`; API `pnpm --filter @heuresys/api dev`; web `pnpm --filter @heuresys/web build && pnpm --filter @heuresys/web start`.

**S952 forensic-QA findings** (origin of all this): `qa_artifacts/runs/20260531_s952_A/_FINDINGS_REPORT.md` (gitignored). R2 (@heuresys/ui shell contrast) now SUBSUMED by 4b84a32. **R3 OPEN**: pg-pool not resilient to ECONNRESET → prolonged 500s; add pool `error` handler + reconnect in `apps/api/src/db/client.ts`. system-health mock → being replaced via R1.1/R1.2 observability + U1/U2.

**Nit**: QA polluted localStorage `heuresys-theme=light` in the test Chrome — true default is dark; clear the key to verify.
