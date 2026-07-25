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
| **D2** | consume here via `link:` (validate-only) — **main fix ✅** (Card/Button/Input/blueprint-detail dark OK, live evidence); scrim regression discovered → spun into D3 | both | ✅ validated (link, local, link still active pending publish) |
| **D3** | token-contract consolidation in `@heuresys/ui`: export `globals.css` gap-fills the semantic tokens no consumer declares (overlay/secondary/destructive/input/ring + `*-fg`) + `-fg`↔`-foreground` aliases; brand/surface stays per-consumer (no utility-rule conflict) | ux-design-shared | ✅ DONE — committed `d766b02` (local); validated live apps/web dark (muted-fg→#9ca3af, overlay opaque, secondary/input/ring resolved, brand unchanged) |
| **A (publish)** | published `@heuresys/ui` **0.1.2** (D1+D3) → bumped dep (root+web+showcase) → removed link override → `pnpm install` → committed lockfile | both | ✅ DONE — npm `0.1.2` latest; heuresys-advanced `643e8ef`, ux-design-shared `ecdb6ab`; consumed-from-registry validated live (muted-fg/overlay/secondary OK) |
| **R1a** | migration `auth_role_category` + CHECK + categorize 8 (6 functional / 2 hierarchical_operational) + **CEO** role (26 read/list perms) + `ROLE_CODES` allowlist | advanced | ✅ DONE — `8a733f8` (mig 000045); 9 roles, typecheck + vitest 359/0 green |
| **R1b** | `sys_teams`/`sys_team_members` + TEAM_LEADER/TEAM_MEMBER roles + 3rd scope axis ("my team") in service layer | advanced | ⏳ (deferred — dedicated phase) |
| **R2** | assign 3 functional roles + CEO to real users + logins; live-verify | advanced | ✅ DONE S955 (`000049` + `seed-r2-personas.ts`) |
| **U1** | migration `sys_ui_interfaces` + seed registry + `GET /v1/me/interfaces` | advanced | ✅ DONE S955 (`000050`, test 5/5) |
| **U2** | live sidebar from DB + perspective switcher Process/Enterprise/Talent | advanced | ✅ DONE S955 (layout DB-driven, E2E 76/76) |
| **P1** | `sys_user_preferences` + `GET/PATCH /v1/me/preferences` + frontend load-on-login/apply/persist (3c) | advanced | ⏳ |
| **V** | exhaustive E2E: 8 roles × 2 themes × all pages, evidence-based | advanced | ⏳ |

## Commits so far (S952, local main, no push)
88073e0 A1 · cb1361d B-data · bf2713e A2-A5+A1fix · e11317c R1.1 observability · 2346614 R1.2 metrics. (R1.x observability = a DIFFERENT earlier "R1" build, now suspended; not to be confused with the roles phase R1 above.)

---

## ▶ RESUME (fresh session) — START HERE

**State (S953 cont., 2026-05-31)**: D1 ✅ (`ux-design-shared 4b84a32`), **D2 ✅ validated** (live apps/web dark, link override), **D3 ✅** (`ux-design-shared d766b02` — token-contract gap-fill, validated). All LOCAL, NOT pushed. heuresys-advanced HEAD `8cd602d` (S952 + docs).

**Evidence captured (D2/D3 validation, live :3005)**: main D1 fix works — login/dashboard/blueprint-detail render correct in dark, real RTL_BANK data, Card `#131720`/Button primary/Input all good. D2 surfaced a scrim regression (`--color-overlay` orphaned in `tokens.css`, a wizard artifact no runtime imports) + a wider gap: the lib never exported a canonical token set, each app reinvents a partial subset → `text-muted-fg` rendered full-white (25 uses/dashboard, `-fg`/`-foreground` naming split), `bg-overlay` transparent, secondary/input/ring empty. D3 fixed all via lib gap-fill + aliases (verified: muted-fg→`#9ca3af`, overlay opaque, brand tokens unchanged).

**✅ Phase A (publish) DONE** — `@heuresys/ui@0.1.2` published to npm (D1+D3), consumed here from registry, validated live. Steps executed:
1. `cd ux-design-shared/ui` → bump `0.1.1`→`0.1.2` → `npm publish` (⚠ outward-facing → Enzo's npmjs auth; `! npm publish` or explicit yes).
2. heuresys-advanced: bump `@heuresys/ui ^0.1.1`→`^0.1.2` in root + `apps/web` + `apps/showcase` package.json → **remove the temporary `pnpm.overrides @heuresys/ui: link:...`** → `pnpm install` → commit lockfile + the version bumps.
3. Rebuild + smoke, then R1.

**Working-tree CLEAN** (heuresys-advanced): link override removed, lockfile committed. Local commits ahead of origin: S952 (6) + `3dd3ee9` (doc) + `643e8ef` (deps) = **8 unpushed**. ux-design-shared: `4b84a32`+`d766b02`+`ecdb6ab` local (npm **0.1.2 published**, not pushed to git remote). **Servers**: `:3005` serves the final 0.1.2 build (for inspection; kill when done); `:3000` still serves the OLD pre-fix build (stale — restart with current `.next` to align, or kill).

**✅ R2 DONE (S955)** — migration `000049` granted the 4 holderless roles to real RTL users BY FUNCTION (evidence-based on the B-51 real titles): **PROCESS_OWNER**→luca.bianchi (Operations Director), **BLUEPRINT_MANAGER**→quintino.bellini (IT Director), **READ_ONLY**→alberto.rossetti (Compliance Officer), **CEO**→federica.marchetti (the real RTL CEO, multi-role with TENANT_ADMIN). Logins (LOCAL identity + ARGON2ID, `<TEST_ADMIN_PASSWORD>`) via `db/scripts/seed-r2-personas.ts` / `pnpm db:seed-r2` (+ HRMS_MANAGER maria.colombo/valentina.conti login-only). **Live-verified**: all 4 login 200 + JWT `roles` carries the grant (e.g. `["USER","PROCESS_OWNER"]`, `["TENANT_ADMIN","CEO"]`); auth/rbac suite **28/28 green**; migration+seed idempotent. NO fixtures. The exhaustive 8-roles×routes×2-themes matrix stays **phase V**.

**✅ U1 DONE (S955)** — migration `000050` created `sys.sys_ui_interfaces` (23 nav interfaces, columns: code/label/route/icon/sidebar_group/**perspective** PET/**required_resource**+**required_action**/**requires_admin**/order/is_active) + endpoint `GET /v1/me/interfaces` (in the `me` module) returns the caller's interfaces grouped by the 3 PET perspectives (always all 3 → honest empty-state). Faithfully ports the web layout's **hybrid gate**: ESS items always visible; admin items need an admin-class role AND the per-item permission (the live data shows a pure USER holds many `*:read` for ESS, so per-permission ALONE would leak — `requires_admin` fixes it). Integration test 5/5 (verified: USER sees ONLY the 5 ESS items / 0 admin; MANAGER per-permission filtered — sees blueprints/processes but not brownfield/seeds/comp/roles; PLATFORM_ADMIN sees all). Idempotent.

**✅ U2 DONE (S955)** — `apps/web/src/app/(authenticated)/layout.tsx` now builds the sidebar from `GET /v1/me/interfaces` (hook `useMyInterfaces` in `lib/api/auth.ts`) instead of the hardcoded nav array. **The client-side gating logic (ADMIN_ROLES set + permSet per-item filter) is REMOVED** — gating is now server-side in U1's endpoint, so the layout renders exactly what it returns (icon-name→lucide via `ICON_MAP`). Added a **PET perspective filter** (Tutte/Process/Enterprise/Talent chips): default "Tutte" keeps every perspective visible (behaviour-preserving → existing nav E2E stays green); a specific perspective focuses it; selecting an empty perspective shows an honest empty-state. All nav test-ids preserved (nav-me/nav-dashboard/nav-positions/nav-users). Verified: typecheck + next build + **Playwright 76/76 green** on PROD (landing-pages + smoke-5-personas + a11y + theme-propagation — per-persona nav visibility correct: admin sees all, pure USER sees only `nav-me`).

**🟢 NEXT = P1** (`sys_user_preferences` + `GET/PATCH /v1/me/preferences` + frontend load-on-login/apply/persist of theme+palette per `user_id`, server-side source-of-truth — locked decision 3c). Then V (exhaustive 8-roles×routes×2-themes matrix). R1b (teams) still deferred. **R1a DONE** (`8a733f8`, mig 000045): `auth_role_category` + categorize 8 + CEO (hierarchical_operational, 26 read perms). **R1b** (teams: `sys_teams`/`sys_team_members` + TEAM_LEADER/TEAM_MEMBER + 3rd scope axis) deferred to a dedicated phase. CEO is also holderless until assigned (fold into R2).

**Phase order**: ~~D2~~ ~~D3~~ ~~A~~ ~~R1a~~ ~~R2~~ ~~U1~~ ~~U2~~ → **P1** (+ R1b teams, deferred) → V (table above). All design decisions LOCKED (top of doc).

**R1 grounding audit — re-run instantly** (read-only; outputs roles taxonomy + per-role permission sets + sys_teams design + real-user picks for the 3 holderless functional roles → present to Enzo before the migration):
`Workflow({scriptPath: "C:\\Users\\enzospenuso\\.claude\\projects\\D--heuresys-advanced\\80a3c939-f5b8-4dff-bf80-3e26eca128df\\workflows\\scripts\\r1-roles-grounding-audit-wf_f5530f75-b66.js"})` (stopped mid-run at close).

**Infra at close (background, persists)**: tunnel :5433 UP · API dev :3001 UP · web prod :3000 UP (serving the `bf2713e` build). Restart if down: tunnel `ssh -fN -L 5433:localhost:5432 oracle-vm-default`; API `pnpm --filter @heuresys/api dev`; web `pnpm --filter @heuresys/web build && pnpm --filter @heuresys/web start`.

**S952 forensic-QA findings** (origin of all this): `qa_artifacts/runs/20260531_s952_A/_FINDINGS_REPORT.md` (gitignored). R2 (@heuresys/ui shell contrast) now SUBSUMED by 4b84a32. **R3 OPEN**: pg-pool not resilient to ECONNRESET → prolonged 500s; add pool `error` handler + reconnect in `apps/api/src/db/client.ts`. system-health mock → being replaced via R1.1/R1.2 observability + U1/U2.

**Nit**: QA polluted localStorage `heuresys-theme=light` in the test Chrome — true default is dark; clear the key to verify.
