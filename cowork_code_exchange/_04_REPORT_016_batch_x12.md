# REPORT 016 — CLI Batch X12 (MVP-2a Phase 0 API gap audit — post-execution validation)

**Protocol**: Cowork↔CLI v2.2 semplificato
**Goal ID**: 016
**Slug**: batch_x12_mvp2a_phase0_audit
**PROMPT ref**: `_01_PROMPT_016_batch_x12.md` (Cowork batch C12, 2026-05-23T19:00Z)
**Predecessor**: REPORT 015 X11 hardening sprint
**Author**: Claude Code CLI (Opus 4.7)
**Completed**: 2026-05-23T19:10Z (~30min CLI elapsed — well under 2-3h budget)
**Outcome**: PROMPT 016 premise INVALIDATED by live state; deliverable refreshed to v2.0 post-execution validation

---

## §0 — Pre-conditions

- SSH tunnel 5433: UP (DB raggiungibile, `SELECT NOW()` 2026-05-23 18:10:04 UTC during X11)
- Git HEAD: `996d0d9 feat(cli): X11 hardening sprint` (X11 just shipped to origin/main)
- `NEXT_SESSION_MVP_2A.md`: present (root, 418 lines)
- `CLAUDE.md §MVP-2a / MVP-2b frontend`: present (non-negotiable rules absorbed)
- `cowork_reserved/batch_c12/01_STRATEGIC_ANALYSIS.md`: present (Path C rationale)
- `docs/api/MVP_2A_API_GAP_AUDIT.md`: **already exists** (draft v1.0, 233 lines, dated 2026-05-17)
- `apps/api/.env`: not present (root `.env` is the canonical, verified)
- `apps/web/`: **EXISTS** (next.config.js, playwright.config.ts, tests/e2e/, src/app/ all live)
- `apps/showcase/`: EXISTS (brand showcase pages from MVP-3 work)

---

## §1 — Step A.1 Executive summary MVP-2a doctrine (~200 words)

`NEXT_SESSION_MVP_2A.md` is the canonical authoritative doctrine for MVP-2a + MVP-2b frontend execution. Core principles (§0): **ZERO mock data, ZERO stubbed endpoints, ZERO commit di pagina senza Playwright E2E test verde**. Every page must hit a real `/v1/*` endpoint against live PostgreSQL on OCI VM via tunnel 5433.

Doctrine phases (§1-§5):
- **Pre-flight** (§1): tunnel up, symlink `@heuresys/ui` valid, baseline `pnpm test apps/api` = 182/182 green
- **Phase 0 API Gap Audit** (§2): produce `docs/api/MVP_2A_API_GAP_AUDIT.md` covering 40 routes (27 admin + 13 ESS) vs 267 existing endpoints. Acceptance: 0 ⚠️/❌ rows
- **Phase 1.5 gap-fill** (§2): 7-step pattern (shared schema → repo → service → routes → integration test → register app.ts → atomic commit) for each missing endpoint
- **Phase 1 scaffold** (§3): apps/web with Next.js 15 + TanStack + Hook Form + i18next; transpilePackages `["@heuresys/ui", "@heuresys/shared"]`; auth client wrapper + `/login` pilot + Playwright E2E green
- **Phase 2 page-by-page** (§4): canonical loop per page (E2E test first → implement → 4-level test green → atomic commit)
- **Phase 3 global acceptance** (§5): 27 admin + 13 ESS routes implemented, ≥40 Playwright specs, i18n parity 100%, axe zero-critical

CLAUDE.md §MVP-2a reinforces same rules with explicit reject conditions for mock data / stub endpoints / missing E2E.

---

## §2 — Step A.2 Existing endpoints inventory (live measurement)

Re-counted live at HEAD `996d0d9`:

| Metric | Value | Method |
|---|---:|---|
| Modules with `routes.ts` | **59** | `ls apps/api/src/modules/` |
| `app.get(` registrations | 130 | grep across all `routes.ts` |
| `app.post(` registrations | 57 | idem |
| `app.patch(` registrations | 35 | idem |
| `app.delete(` registrations | 42 | idem |
| `app.put(` registrations | 8 | idem |
| **Total endpoint registrations** | **272** | sum |
| Integration test files | **50** | `git ls-tree HEAD apps/api/test/` |
| Shared Zod schemas | **61** | `git ls-tree HEAD packages/shared/src/schemas/` |
| Migrations applied | **42** | `ls db/migrations/*.sql` |

Key new modules vs v1.0 draft (May 17, 56 modules):
- ✅ `dashboard` (closes GAP-1)
- ✅ `compensation` (closes GAP-2)
- ✅ `brownfield-wave-executor` (engine module — SDBI X3+ work)

`me/routes.ts` registrations now include `/v1/me/kpis` (GAP-3 closed), `/v1/me/certifications` GET+POST (GAP-4 closed), `/v1/me/documents` (GAP-5 closed) — verified via direct grep.

---

## §3 — Step A.3 27 admin + 13 ESS routes identification (live)

`apps/web/src/app/(authenticated)/` enumeration of `page.tsx` files yields:

### Admin shipped pages (28, vs PROMPT projected 27 — +1 over)

`admin/roles`, `blueprints` + `blueprints/[variantId]`, `brownfield-adaptation`, `career-succession`, `compensation-intelligence`, `dashboard`, `gaps`, `kpis`, `learning` + `learning/training-initiatives`, `organization` + `organization/org-chart`, `positions` + `positions/[positionId]` + 3 sub (`skills`, `kpis`, `learning`), `processes`, `seed-acquisition/runs`, `skills`, `system-health`, `tenants` + `tenants/[tenantId]` + `tenants/[tenantId]/enterprise-typing`, `users` + `users/[userId]`, `visualizations` + `visualizations/[graphId]`.

The +1 over: `system-health` — was not in NEXT_SESSION_MVP_2A.md §11 page roster (possibly added post-doctrine).

### ESS shipped pages (13, matches PROMPT)

`me`, `me/career` + `me/career/target`, `me/certifications`, `me/documents`, `me/gaps`, `me/inbox`, `me/kpis`, `me/learning` + `me/learning/catalogue`, `me/positions`, `me/profile`, `me/skills` + `me/skills/self-assessment`.

### Other tracked pages

`/login` (Phase 1 pilot), `/` (root landing), 17 `/showcase/*` pages (brand showcase from MVP-3 brand-identity work).

**Total `apps/web` tracked pages**: 63 (`git ls-tree HEAD apps/web/src/app/` = 63 `page.tsx`).

---

## §4 — Step A.4 Gap matrix outcomes — POST-EXECUTION

| Decision class | Count | Notes |
|---|---:|---|
| `OK_AS_IS` (existing endpoint covers page need) | 36/40 | per v1.0 audit + verified by live module presence |
| `BUILD_NEW` (gap-fill required) | 5 (v1.0) → **0** (v2.0) | All 5 v1.0 gaps closed: GAP-1 dashboard, GAP-2 compensation, GAP-3 me/kpis, GAP-4 me/certifications, GAP-5 me/documents |
| `EXTEND_EXISTING` | 4 (v1.0 ⚠️) → 0 effectively | All resolved via client-side composition (no new endpoints needed): processes, users/assignments, positions/learning, gaps, admin/roles |
| `OUT_OF_MVP2A_SCOPE` | n/a | none reclassified |

**Effective MVP-2a Phase 0 closure**: 100%. All originally projected gaps were closed in the May 17 — May 23 execution window (Sessions 1+2 per project memory observation 9593: "20/40 Pages Live").

Current HEAD goes further: **41 of 40 originally projected routes shipped** (+system-health bonus).

---

## §5 — Step A.5 `docs/api/MVP_2A_API_GAP_AUDIT.md` authoring

The original v1.0 audit (233 lines, May 17) is preserved verbatim as historical record. v2.0 amendments added:
- **§0 Quick diff** v1.0 projections vs v2.0 measurements
- **§J Residual work refresh** (E2E coverage shortfall, endpoint count reconciliation, HANDOFF staleness, CW-B52 bias)
- **§K Recommendation for Cowork batch C13** (3 viable directions ranked)

File grew from 233 → ~340 lines net. v2.0 is the authoritative section; v1.0 sections A-H remain accessible for traceability.

---

## §6 — Endpoint build queue priority for X13+ batches

Per v2.0 audit §K, the build queue for X13+ is **NOT** "endpoint authoring" (already done) but rather **quality hardening**:

| Priority | Item | Estimated effort |
|---|---|---|
| P1 | E2E coverage matrix — enumerate `test()` calls inside 17 spec files → per-route coverage validation | 1-2h CLI |
| P1 | Missing E2E specs to reach NEXT_SESSION_MVP_2A.md §5 acceptance ≥40 specs (if 17 grouped specs don't cover all 41 routes) | 2-3h CLI |
| P2 | OpenAPI re-generation + drift detection vs 272 live endpoints | 1h CLI |
| P2 | i18n parity sweep — `pnpm i18n:check` across 41 pages | 1h CLI |
| P2 | axe-playwright zero-critical sweep across 41 pages | 1-2h CLI |
| P3 | HANDOFF.md refresh to HEAD state | 30min CLI |

---

## §7 — Implementation order recommended

**Phase 0 + 1 + 2 ARE ALREADY DONE** — no implementation order to prescribe in the original PROMPT sense.

For Cowork batch C13 the recommended order:
1. **Coverage matrix audit first** (1-2h) — gives precise residual gap list
2. **Spec gap-fill** (variable, depends on #1 output) — close ≥40 spec acceptance
3. **i18n + a11y sweeps** (parallel, ~2h combined) — global quality gate
4. **HANDOFF.md refresh** (chore, atomic commit) — state SoT correction

This converts MVP-2a from "structurally complete" to "acceptance-criteria-complete" per NEXT_SESSION_MVP_2A.md §5.

---

## §8 — Bias catalog updates

### CW-B52 — PROMPT spec staleness against live execution state (P2)
**Surface**: X12 PROMPT 016 §3 vs live HEAD state.
**Symptom**: PROMPT 016 prescribed "Phase 0 API gap audit" as if MVP-2a were pre-execution. Live HEAD `996d0d9` shows MVP-2a structurally complete (41 pages shipped, 272 endpoints, 50 API tests, 17 E2E specs, 5 v1.0 gaps closed). The PROMPT premise is invalidated.
**Root cause hypothesis**: Cowork-side spec authoring uses an internal model frozen at v1.0 state (May 17 + project memory observation 9593 from same date). Subsequent MVP-2a sessions (Session 1: "20/40 Pages Live", and an apparent Session 2 extending to 41/40) didn't refresh Cowork's working model. Memory observations indicate Sessions occurred but Cowork-batch authoring relied on the older `docs/api/MVP_2A_API_GAP_AUDIT.md` draft v1.0 as ground truth.
**Mitigation applied**: refreshed audit doc to v2.0 with §0 quick-diff + §J residual + §K recommendation; CLI bypassed Phase 0 execution (already done) and produced a state-validation deliverable instead.
**Preventive measure**: Cowork batch authoring pre-flight should include `git ls-tree HEAD apps/<area>/` + `grep -rc <pattern> <area>` to verify live state vs internal model. Suggest pattern memo §20 update.

### Engine bias catalog totals post-X12

- **Pre-X12**: 51 catalogati (CW-B17 → CW-B51 after X11)
- **Post-X12**: **52 catalogati** (CW-B52 NEW)
- Next available: CW-B53

---

## §9 — Cowork spec improvements suggested

1. **Live-state pre-flight in PROMPT authoring** (§20 pattern memo update): every batch authoring should include `git ls-tree HEAD <relevant-area>/` + module/page/test counts. Prevents CW-B52 staleness.
2. **Project memory refresh discipline**: when CLI Sessions execute multi-batch work (e.g. MVP-2a Sessions 1+2 May 17-23), Cowork should snapshot live state to memory and reference that snapshot in subsequent PROMPTs. Currently memory has observation 9593 ("20/40 Pages Live") but PROMPT 016 doesn't reference it.
3. **PROMPT envelope versioning**: distinguish "first-time scope authoring" vs "continuation/refinement" PROMPTs in the frontmatter (`promptKind: scope_authoring | continuation | refinement | validation`). Helps CLI decide between full execution vs validation-only.

---

## §10 — Next step recommendation for Cowork batch C13

**C13 = Coverage hardening sprint** (per §6 P1 items):
- Block A: enumerate 17 E2E spec files → per-route assertions matrix (1h)
- Block B: identify under-covered routes → author missing specs to reach ≥40 (1-2h)
- Block C: i18n + a11y sweeps (parallel, ~2h)
- Block D: HANDOFF.md refresh (30min)

Estimated 4-5h total CLI work.

**Alternative C13 directions** (per audit §K):
- Option 2 — MVP-3 kickoff (re-open B/F/E-UI tasks per `project_mvp3_session_state.md`)
- Option 3 — i18n + a11y full sweep alone (smaller scope)

User decision required only if Coverage hardening + MVP-3 conflict in priority; otherwise default to Coverage hardening as natural continuation.

---

## §11 — Halt status

- ✅ Pre-flight all conditions met (NEXT_SESSION_MVP_2A.md present, no compile broken, R-A2 sys_users 433)
- ✅ No P0 trigger raised during X12
- ✅ Audit doc updated v1.0 → v2.0 in place (preserved v1.0 sections for traceability)
- ✅ Deliverable shifted from "Phase 0 execution" to "Phase 0 post-execution validation" (Inline Mitigation Scope §13 — surface stale PROMPT premise without halting)

No halt notifications emitted; only final `report_ready` inbox notify follows.

---

*End REPORT 016 — X12 MVP-2a Phase 0 API gap audit v2.0 post-execution validation*
