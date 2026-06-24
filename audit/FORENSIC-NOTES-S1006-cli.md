# Forensic notes — S1006 continuation (CLI headless batch + code-level)

## TAIL STATUS (final, S1006 close)
DONE + deployed/live: G-01 (KPI/processi/non-ESCO/13k ESCO — mig 000156-159) · junk-skills clean (000160, 7846→archive) · skill_code clean OLDDB::→ESCO::/COMP:: (000161) · G-02 org PARENT + gaps user/position/skill names (correlated subqueries). B-01..B-07/G-03/CSP deployed earlier. DATA dashboard "—0.0%" + insights "Medio" = **NON-BUGS** (real data: static synthetic → flat WoW; flight-risk 120 LOW + 39 MEDIUM, no HIGH → top risks legitimately "Medio").
#21 RESIDUO — STATUS (resolved this continuation):
- ✅ **career-succession** G-02 DONE (mig n/a, code) — correlated-subquery user/pool name on successor-candidates list + fixed the local-type `successionPoolId`→`poolId` contract bug. Deployed.
- ✅ **817 stale-ESCO skills** DONE (mig 000162) — their ESCO URIs 404 in current ESCO (stale concepts, NO official IT label) → translated via parallel LLM agents (Enzo: LLM-assisted fallback). **ESCO IT coverage now 14002/14002 = 100%**.
- ⛔ **a11y** /dashboard — **LIB-BLOCKED**: ALL violations are in `@heuresys/ui` shell components, NOT in this repo's pages (verified: `.max-h-[420px]` scrollable-region, `button.sidebar-*` + `footer a` tap-targets, the shell `<main>` duplicate-landmark — none present in apps/web/src). Fix lives in **ux-design-shared** (publish + bump). Not resolvable in heuresys-advanced without the lib change.
- ⛔ **perf** single JS chunk — **LIB-BLOCKED**: the chunk is the `@heuresys/ui` barrel (echarts+three+d3 pulled together by the `import("@heuresys/ui")` dynamic import). `@heuresys/ui` exposes ONLY the barrel `.` (no per-component subpath exports), so the split needs **ux-design-shared** to add subpath exports + publish. CWV already excellent (chunk is on-demand, not blocking initial paint).
- **MFA** stays DISABLED (Enzo decision 2026-06-24).



## FIX STATUS (Fase 2 — local commits on main, NOT pushed; verified live on real data)
| Bug | Commit | Verified |
|---|---|---|
| B-03 ESS lockout (RBAC) | `4671015` mig 000155 | paolo 200 on 10 ESS endpoints (was 403) |
| B-01 brownfield crash | `0e522fb` | inventory renders 4 rows, 0 crash |
| B-05 dark charts | `c151923` | donut/bars colored 95%/89% (was 0%) |
| B-04 KPI gauge | `25e9178` | gauge "92 %" (was 4300370281) |
| B-07 org-chart labels | `ab840ef` | nodes labeled |
| B-02 login GET creds | `a85db08` | form method=post |
| B-06 learning | `cc54368` | NOME shows titles |
| B-06 positions skills/kpis | `e0202f9` | names shown; test 11/11 |
| G-03 dup language toggle | `1a4c072` | header dead btn hidden, sidebar functional |
| CSP+Permissions-Policy | `0a3c909` | repo nginx (apply on VM at deploy) |
| (.gitignore secrets) | `67667bb` | — |

**CLARIFICATION (S1006 fix phase): many /me/* findings were B-03 downstream — already resolved.**
The visual workflow reviewed the ESS pages under paolo while B-03 was still breaking them (403), so "career/certifications/gaps/inbox/kpis/learning/skills fail to load", "me/profile empty name", "loading badge stuck" etc. were the 403-broken state, NOT separate bugs. With B-03 fixed, those pages render (verified: /me/profile shows "Paolo Caputo" — user_display_name is set in the DB + mapped at me/repository.ts:96). ~10 HIGH/medium WIRING/DATA findings collapse into B-03.

**RESIDUO (systemic 🟡 — next sessions, autonomous per Enzo's go):**
- **G-02 raw codes — B-06-class joins** (the real remaining mechanical set, all same pattern = endpoint returns only an id, add a JOIN for the name): `/organization` PARENT (self-join sys_organization_units for parent name — endpoint returns only parentId), `/career-succession` + `/gaps` user UUID → join user name, `/skills`+`/learning` legacy codes. Batch these (API+schema+page each).
- **G-01 i18n-of-data (18)** — ARCHITECTURAL, needs a product/design decision (translate DB/ESCO content? runtime entity-name translation layer? leave as-is?). NOT a mechanical fix — flagged for Enzo. CLAUDE.md already calls G-01 "tema architetturale".
- **G-02 raw codes remaining (~15)** — page-level (show name where a name field/join exists): organization PARENT, career-succession/gaps user names, skills/learning legacy codes, kpis POLARITÀ enum, goals/okrs enum, positions/[id] relational UUIDs, positions/[id]/kpis raw-JSON template. Also: positions/skills CODE column still shows legacy `OLDDB::esco_skills::<uuid>` (data-quality of skill_code).
- **DATA placeholders (~20)** — triage needed (real bug vs seed data-quality vs expected): dashboard "—0.0%" trends, me/profile empty name, "Test Auth Path", insights all-"Medio", me/security loopback IP (=D-28 TRUST_PROXY), content fixtures, etc.
- **a11y** — dashboard 9 tap-targets <24px + 1 serious + 3 moderate axe.
- **perf** — single JS chunk 1.68MB → code-splitting.
- **Deploy** — pending Enzo's push authorization (PROD still runs old code).
- **MFA re-enable** on VM at audit close.

---


> Running notes from the CLI autonomous pass (PROD https://www.heuresys.com, admin@heuresys.com,
> read-only observation). Consolidated into FINDINGS.md at report time. Evidence = file:line + live output.

## Harness facts (this session)
- Engine: headless Playwright (`audit-runner.js`) over PROD, storage-state `audit/auth-admin.json` (login POST /api/v1/auth/login → 200, PLATFORM_ADMIN). Node 24 OK (D-36 affects @playwright/test runner, not playwright core).
- Page list: 74 authenticated routes from App Router, dynamic [id] resolved from live DB. `/showcase/*` excluded (separate brand app, already on-brand, out of S1006 scope). Public `/demo` `/investors` `/privacy` to be audited separately (need non-auth context).
- Skill bug fixed: `audit-runner.js` `shellSafe()` stripped `:` → mangled every URL to `https//host` (CORE1 inventory failed). Whitelisted `:` (shell-dangerous chars still stripped). Global skill file — flagged to Enzo.
- CORE5 mechanical reports "0 links" on every page (does not wait for nav hydration) → link-integrity / dead-link (G-06) must be verified separately, NOT via the batch.

## Confirmed / upgraded findings

### B-01 (UPGRADE 🔴) — /brownfield-adaptation: contract drift, 2 of 3 tabs broken
Root cause is NOT a missing `?.` — the page's LOCAL interfaces diverge from the shared Zod contract; `apiFetch<T>` casts without runtime validation so TS never catches it.
- **Inventory tab 🔴 CRASH**: local `BrownfieldExport` (page.tsx:12-18) = `{brownfieldSourceExportId, sourceSystem, capturedAt, rowCount, status}`. Real API contract `BrownfieldSourceExportSchema` (packages/shared/src/schemas/brownfield-source-exports.ts) = `{sourceExportId, name, fileHash, retrievedAt, sizeBytes, status, metadata, createdAt}`. Only `status` matches. `e.capturedAt` is `undefined` for every row → `e.capturedAt.slice(0,19)` (page.tsx:42) throws → error boundary. Even if guarded, System/RowCount columns render empty and React `key` (brownfieldSourceExportId) is undefined.
- **Mapping tab 🟡**: local `BrownfieldMapping` reads `m.sourceTable` + `m.status`; shared `brownfield-table-mappings.ts` exposes `sourceTableId` + `approvalStatus` → Source & Status columns empty (no crash; `targetTable` matches).
- **Run tab ✅**: local type matches shared `brownfield-import-runs.ts`; `r.startedAt?.slice(...) ?? none` (page.tsx:61) already guarded.
- **Fix**: replace the page's local interfaces with the shared types (`BrownfieldSourceExport`, `BrownfieldTableMapping`) and rewrite `buildInventoryCols`/`buildMappingCols` to the real fields (name, retrievedAt, sizeBytes / sourceTableId, approvalStatus). Add `?.` defensively on date `.slice`.

### G-05 (root cause pinned 🔴) — perspective resets to "Tutte"
`apps/web/src/app/(authenticated)/layout.tsx:97` → `const [filter, setFilter] = useState<FilterCode>("ALL")`. Pure ephemeral React state, default ALL, **no persistence layer** (no localStorage/cookie/preferences). Lost on reload and on RSC-driven remount. Matches the planned P1 item (`sys_user_preferences` + `GET/PATCH /v1/me/preferences`). Fix: persist selection (localStorage quick-win, or wire to the planned preferences endpoint).

### NEW B-02 (🟡 security/privacy) — login credentials in URL on pre-hydration / no-JS submit
Submitting the login form before React hydrates (or with JS disabled) does a native **GET** → `…/login?email=<email>&password=<password>` (observed live during auth-setup). Credentials leak into browser history, server access logs, and Referer. Root: login `<form>` has no hard guard against native submit (relies on JS onSubmit/preventDefault). Fix: set form `method="post"` + a server-side no-JS handler, or disable the submit button until hydrated, or use `event.preventDefault` wired at the form level that also blocks native GET. Severity 🟡 (needs JS-off / race), real.

## B-01-class scan result (static, schema-checked)
- The 3 initial candidates (`me/skills:83 assessedAt`, `me/gaps:45 detectedAt`, `positions/[positionId]/learning:74 detectedAt`) are **SAFE** — those fields are `z.iso.datetime()` (non-nullable) in the shared schemas, so the API always returns them. The discriminator for B-01 is that `capturedAt` is NOT in any shared schema (local-only invented field). → Remaining contract-drift risk lives in pages that define local interfaces instead of importing shared types; brownfield is the confirmed instance.

## NEW B-03 (🔴 RBAC) — functional-role employees locked out of their OWN ESS
Verified 3 ways (live HTTP 403 + RBAC data + role assignment). Persona `paolo.caputo@rtl-bank.org` is a real employee with roles **TEAM_LEADER, TEAM_MEMBER, MANAGER** and **NO `USER` role**. The ESS self-scope permission `user_profile:read:self` (and siblings `learning:read:self`, `career_succession:read:self`, `certification:read:self`, `document:read:self`, `skills:*:self`, `kpi:*:self`, `gap:*:self`, ...) is granted ONLY to `PLATFORM_ADMIN, READ_ONLY, TENANT_ADMIN, USER` — NOT to the functional roles. Result: paolo gets **403 on his own** `/me/profile`, `/me/skills`, `/me/kpis`, `/me/gaps`, `/me/certifications`, `/me/positions`, `/me/career`, `/me/documents`, `/me/inbox`, `/me/learning` (10+ ESS pages). Personas WITH `USER` (tommaso.fiore, antonio.parisi) work; federica.marchetti works via `TENANT_ADMIN`. **Fix = a model decision (PM)**: either every employee also carries `USER` (assignment fix — roles additive), or the base functional role `TEAM_MEMBER` is granted the self-scope permission set (mapping fix). Either way it is a real lockout: a manager cannot see their own profile/skills/payslip-equivalent.
- Pages that DO work for paolo (employee context, real data): `/me/team` (2725 chars), `/me/matching` (30 rows), `/me/security`, `/me/skills/self-assessment`, `/me/learning/catalogue` (25 rows), `/me/career/target` (1816 chars) — so the ESS shell + those endpoints are wired; the gap is specifically the `*:read:self` permissions not reaching functional roles.

## CTX scan findings (representative pages, fresh admin auth, PROD)
- **Security (app-wide headers)** 🟡: MISSING `content-security-policy` + `permissions-policy`. PRESENT: HSTS, x-frame-options, x-content-type-options, referrer-policy. SRI: warn 🟢. clickjack/mixed-content/exposure: pass. (No active XSS/redirect probes on PROD — R18.)
- **Accessibility (axe + WCAG2.2)** 🟡: `/dashboard` FAIL = 1 serious + 3 moderate axe violations + **9 target-size failures** (tap targets <24px) + 2 needs-review; color-contrast axe PASSES (0 failures). `/users`, `/analytics/workforce`, `/login` PASS. (G-07 "dark-on-dark" is about chart series colors, which axe contrast doesn't catch → judged visually by the review workflow.)
- **Performance** ✅CWV / 🟡budget: Core Web Vitals EXCELLENT (`/dashboard` LCP 360ms, CLS 0, FCP 360, TTFB 128). Budget FAIL = **resource weight**: 2.38 MB total transfer, of which **2.35 MB is JS**, incl. a single **1.68 MB chunk** (`_next/static/chunks/0m5f3qo3lbrvq.js`) → code-splitting opportunity, not a user-perceived-speed issue.
- **SCA (client-side vuln libs)**: INCONCLUSIVE — retire.js not runnable (offline npx / no signature DB). 24 external scripts + 8 inline observed; needs a re-run with retire.js available.

## Candidates (need a decision / more data — NOT confirmed bugs)
- `/engagement/[surveyId]`: `GET /api/v1/engagement/surveys/<id>/results` returns **404** for a survey that EXISTS in `sys_engagement_surveys`. Either the survey has no published results (then the endpoint should return **200 + empty**, not 404 → minor API-contract issue) or a real wiring/scoping bug. Verify against a survey known to have results.

## Notes / non-bugs
- `/approvals/[id]` 404 in the batch is a FALSE POSITIVE: `sys_approval_requests` is empty, so the dynamic id fell back to a content-doc id. Approval detail not testable without seeded approval data.
- The ~45 "401 Unauthorized" pages from the long batch are a HARNESS ARTIFACT (15-min JWT TTL expired mid-run over a frozen storage state), NOT a product bug — re-verified clean (401:0) with periodic re-login. Recorded so nobody mistakes it for a finding.
- MFA is currently DISABLED on the VM (`MFA_ENFORCEMENT_ENABLED=false`, backup `.env.bak.mfa-*`) for this audit — **must be re-enabled when the audit closes** (carried over from the S1006 note).
