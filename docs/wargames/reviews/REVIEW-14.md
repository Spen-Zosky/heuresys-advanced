# REVIEW-14 — Adversarial review of `wargames/14-heuresys-provenance.md`

- **Reviewer**: independent adversarial pass (Fable 5), 2026-07-06. Repo `D:\heuresys-advanced` read-only; no repo file touched, no git command run.
- **Target**: battle plan for backlog #28 A/L0 "Trust Ledger" (`/v1/provenance` + 4th tab of `/brownfield-adaptation`).
- **Standard**: `SUCCESS.md` (8 points). **Brief**: `tasks/14-heuresys-provenance.md`.

## VERDICT

**APPROVED WITH PATCHES.** No CRITICAL or HIGH finding. The plan's factual base survived a 20+ item spot-check with only cosmetic line-number drift and one stale index claim. One MEDIUM security finding: the plan's own celebrated red-team patch (the tenant predicate) contains a fail-open branch for null-tenant non-platform actors that contradicts the repo's canonical fail-closed pattern. Five LOW findings, two INFO. Safe to execute blind **after** patch P1 is applied; the rest are hygiene.

**Findings: 0 CRITICAL · 0 HIGH · 1 MEDIUM · 5 LOW · 2 INFO.**

---

## 1. SPOT-CHECK OUTCOMES (≥10 claims, all verified against the repo)

| # | Plan claim | Verified evidence | Outcome |
|---|---|---|---|
| S1 | DDL at `000025:73-105`, `source_lineage_tenant_id uuid NOT NULL` FK → tenancies | `db/migrations/000025_brownfield_lineage_and_mapping.sql:73-89` — NOT NULL at :75, CHECK 4 statuses :91-95 | **CORRECT.** The red-team patch rests on a real column. Also settles the brief's "NULL tenant rows — who sees them?" attack: **no NULL-tenant row can exist**. |
| S2 | SDBI columns at `000063:116-131` (4 cols + CHECK 0..1) | `000063_sdbi_infra.sql:115-131` — exact columns, CHECK at :126-131 | **CORRECT** (start line off by 1). But see F5: :111-113 says brownfield-path rows leave them NULL, no backfill. |
| S3 | 70,972 rowcount at `rowcount_all_tables.csv:221` | `qa_artifacts/dbms_health_2026-06-22/rowcount_all_tables.csv:221` = `sys,sys_source_lineage_records,70972` | **CORRECT**, and plan correctly demotes it to evidence-not-SoT (R1 re-derives live). |
| S4 | page.tsx 3-tab structure at :31-32, default `inventory` :63, `{items,total}` envelope :66 | `apps/web/src/app/(authenticated)/brownfield-adaptation/page.tsx:31-32,63,66` — exact; testids generated from `TAB_KEYS` map (:88-100) so `brownfield-tab-provenance` comes free | **CORRECT.** |
| S5 | TENANT_ADMIN denylist excludes only `:approve` for brownfield (plan cite 000005:415-423) | `000005_auth_foundation.sql:417-424` — `NOT IN ('tenant:create','tenant:delete','role:create','role:update','brownfield_adaptation:approve','reference_sync:read','reference_sync:trigger')`; PLATFORM_ADMIN CROSS JOIN :409-414 | **CORRECT** (cite off by 2 lines; content exact). TENANT_ADMIN holds `brownfield_adaptation:read` today. |
| S6 | 000085 platform-only precedent (DELETE grant + scoped assert) | `000085_reference_sync_platform_only.sql:20-37` | **CORRECT**, including the header's explanation of why revoke-after-catch-all works (revoke runs after 000005 in every chain → end state stable). |
| S7 | `provenance` absent from data-classes.ts and from RBAC | `apps/api/src/lib/scope/data-classes.ts:45-70` — no `provenance` key; repo-wide grep: no `/v1/provenance` route, no provenance permission INSERT in any migration, "provenance" appears only in comments/ingestion tests | **CORRECT** (A4 remains a live check, rightly kept as R4). |
| S8 | #25 precedent at SOT_BACKLOG.md:64 (position resources not sensitive → no orgGate) | `docs/kb/SOT_BACKLOG.md:62-64` — note at :64 verbatim: "le risorse position non sono nella tassonomia sensitive → nessun orgGate richiesto dal boot-gate D-51" | **CORRECT.** #28 ACTIVE at :71-73; note names both UI options. |
| S9 | Indexes at 000025:97-105 incl. "partial index on source_natural_key"; "(000131 dropped a dead natural-key index **variant**)" | `000025:97-105` creates it; **`000131_drop_dead_lineage_natural_key_idx.sql:19` drops exactly that index** — not a variant. It no longer exists live. | **PARTIAL — F2.** The unique source index and `target_idx` (the #27 contract carrier) are real and live. |
| S10 | E2E spec :21-31, tenantAdmin storage, no tab-count assert | `apps/web/tests/e2e/admin-pipelines.spec.ts:12,21-31` — asserts 3 testids individually, never a count | **CORRECT.** Red-team "attack that failed" is genuine. `storageStateFor("platformAdmin")` also exists (`fixtures.ts:75`) so Move 7's counter-move is executable. |
| S11 | Sibling service ignores actor (`brownfield-source-exports/service.ts:14-21`), comment at :3 misleading | Verified verbatim — `_actor` unused, comment claims "PLATFORM_ADMIN-gated" while route uses `brownfield_adaptation:read` (`routes.ts:16`) which TENANT_ADMIN holds | **CORRECT.** The successful red-team attack is grounded. |
| S12 | app.ts:406 register sibling; insights orgGate syntax :29,39,59,72; gate.ts:27 closed set | `app.ts:406-409`; `insights/routes.ts:29,39,59,72` — `config: { orgGate: "service" }`; `gate.ts:27` — `"service" | "catalog" | "aggregate"` | **CORRECT.** Gate only fires on taxonomy-sensitive resources (gate.ts:81) → fork B route A default is architecturally sound, not just precedent-based. |
| S13 | 167 migration files, max 000169 → next 000170 | `ls db/migrations | wc -l` = 167; tail = `000169_hrms_manager_data_plenipotentiary_grant.sql` | **CORRECT** (and rightly re-derived at R2). |
| S14 | 000050:73 brownfield registry row; 000169:7 excludes `brownfield_adaptation:*` | Both verified verbatim | **CORRECT.** |
| S15 | Move 2 INSERT column list mirrors 000005 | `000005:372` and `000142:8` use exactly `(auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)` | **CORRECT.** |
| S16 | shared package.json subpath pattern :242-245; it/blueprints.json `brownfield` at :71; dossier §L0 line 30 ("PLATFORM/TENANT_ADMIN; nessun dato personale nuovo") and §2-bis :73 ("fit naturale") | All four verified at the cited lines | **CORRECT.** |

### Brief-mandated attack probes that came back CLEAN

- **Migration-count asserts (D-38/000142)**: `000142_goals_okrs_permission_seed.sql:38-44` uses a *floor* assert scoped to its own resource; grep of every `CROSS JOIN sys.sys_auth_permissions` in migrations shows **only 000005's two catch-alls are code-agnostic** (PLATFORM_ADMIN all; TENANT_ADMIN NOT-IN-denylist) — on every future full-chain re-run they grant `provenance:read` to exactly the same 2 roles the plan's Move 2 assert expects. The expect-2 assert is **stable across re-runs and even across the future platform-only alternative** (a revoke migration would run after it). Verified sound.
- **Reconciliation registry**: the "reconciliation registry" (`audit.import_validation_rule_codes`, UNCLASSIFIED checks in `sdbi-perf-feedback.integration.test.ts:8`) is ingestion-side; the plan creates **no new table** and a read API adds no rows. No interaction. Plan's "no reconciliation touch" claim verified.
- **Hardcoded-count test couplings**: no test or source references `70972`; the 6 test files touching `sys_source_lineage` are wave-executor/SDBI-scoped and a read module mutates nothing; Move 5's synthetic cross-tenant INSERT is rolled back by D-52 (`test/helpers/tx-isolation.ts` exists; fixtures-visible-to-app confirmed as the established pattern). Clean.
- **Data-class drift test**: `scope-data-classes.integration.test.ts:28-32` is **one-directional** (every classified resource must exist in DB) — adding a new DB resource `provenance` without classifying it breaks nothing. Clean.
- **Cross-tenant predicate coverage**: Move 4 mandates the predicate on "**Every query**" including stats and the by-wave JOIN, and test #7 + the synthetic-second-tenant fallback make it unskippable. Specified precisely for all 3 endpoints. Clean — except the null-tenant branch (F1).
- **Pagination**: list is LIMIT 50 default / 200 max + offset, UI fetches `?limit=200` once; no unpaginated endpoint exists in the plan. Clean (perf note in F3).

---

## 2. FINDINGS

### F1 · MEDIUM · The mandated tenant predicate fails OPEN for a null-tenant non-platform actor

**Evidence.** Move 4: "`WHERE ($1::uuid IS NULL OR source_lineage_tenant_id = $1)` with `$1 = isPlatform(actor) ? null : actor.tenantId`". `ActorContext.tenantId` is `string | null` (`apps/api/src/lib/actor.ts:23`); `isPlatform` checks only the PLATFORM_ADMIN role (:28-30). A non-platform actor whose `tenantId` is `null` produces `$1 = null` → the predicate collapses to TRUE → **full cross-tenant read**. The repo's canonical pattern is fail-closed, e.g. `goals/service.ts:22` (`if (a.tenantId === null || rowTenantId !== a.tenantId) throw new NotFoundError(...)`), `skills/service.ts:59`, `capability-maturity/service.ts:35` (`ForbiddenError("Tenant context required", "TENANT_REQUIRED")`). Exposure is bounded (only PLATFORM_ADMIN/TENANT_ADMIN hold `provenance:read`, and a TENANT_ADMIN should always carry a tenant), but a mis-provisioned platform-plane account with the TENANT_ADMIN role and NULL tenant would silently see every tenant's lineage — on the GDPR-posture feature. Move 5's test #7 (foreign tenantAdmin) does **not** cover this branch.

**EXACT PATCH** — in Move 4, `service.ts` bullet, append:

> Before any repo call, apply the repo-canonical fail-closed guard: `if (!isPlatform(actor) && actor.tenantId === null) throw new ForbiddenError("Tenant context required", "TENANT_REQUIRED");` (pattern: `capability-maturity/service.ts:35`, `skills/service.ts:59`). The SQL predicate's `$1 IS NULL` branch is reserved for platform actors ONLY — never reachable via a null `actor.tenantId`.

And in Move 5, extend test list:

> (9) null-tenant guard: build an ActorContext with a non-platform role and `tenantId: null` (service-level unit call, or inject a token if the login helper supports it) → expect `403 TENANT_REQUIRED`, not a full list.

### F2 · LOW · Stale index claim: the natural-key partial index was itself dropped by 000131

**Evidence.** Plan §1.1 lists "partial index on `source_natural_key`" among "Indexes that matter" and calls 000131 the drop of "a dead natural-key index **variant**". `000131_drop_dead_lineage_natural_key_idx.sql:2-4,19` drops **exactly** `sys_source_lineage_records_natural_key_idx`, the one 000025:103-105 created. Live index set = unique source quadruple + `target_idx` only. No planned query filters on natural_key, so no functional impact — but it is a false evidence line.

**EXACT PATCH** — §1.1 index bullet, replace the parenthetical with:

> (the 000025 partial index on `source_natural_key` was DROPPED by `000131` as dead — it no longer exists live; do not recreate it, and do not plan any natural-key-filtered query on the assumption of index support.)

### F3 · LOW · No index supports the default list ordering or the tenant filter — unstated perf trade-off

**Evidence.** Live indexes (S9): unique `(source_system, source_table, source_record_id, target_table_name)` + `(target_table_name, target_record_id)`. Move 4's default list (`ORDER BY created_at DESC LIMIT/OFFSET` + tenant predicate) and the whole `/stats` endpoint are full-table scans/sorts over ~70,972 rows on every call. At this scale Postgres does it in tens of ms — acceptable — but the plan silently assumes it. If row count grows 10× (waves keep running), the panel's stats-on-load becomes the slowest query on the page.

**EXACT PATCH** — add to Move 4 Expected: "list/stats are seq-scan+sort over ~70k rows by design — acceptable at current scale (verify: `EXPLAIN ANALYZE` the list query once, expect <150 ms through the tunnel). Do NOT add indexes in the permission migration; if R1 shows >500k rows, flag an index follow-up (`created_at DESC`) to Enzo instead of hand-adding it."

### F4 · LOW · False rationale on route ordering (instruction harmless, reason wrong)

**Evidence.** Move 4: "register `/stats` BEFORE `/:id` (Fastify static-vs-param ordering...)". Fastify's find-my-way router gives static segments precedence over parametric **regardless of registration order**; registration order is not the mechanism. The instruction costs nothing and guards against schema-level 400s if `:id` validates uuid — keep it, fix the claim so a blind executor doesn't generalize a false rule.

**EXACT PATCH** — replace the parenthetical with: "(find-my-way resolves static over parametric regardless of order, but `/stats` declared first also protects against a uuid-validating `:id` schema rejecting it — declare `/stats` first as belt-and-suspenders)".

### F5 · LOW · SDBI "AI-Act payload" columns are NULL for the entire brownfield-path population — unmarked assumption, no recon probe

**Evidence.** `000063:111-113`: "Brownfield-path lineage rows leave these NULL (preserved invariant). Backfills nothing: the 5939 existing SDBI pilot rows keep their jsonb provenance". Only the later D6 SDBI Option-B slice populates the first-class columns (`sdbi-perf-feedback.integration.test.ts:143-150` asserts non-NULL for that slice only). So `sdbiAiModelId` / `sdbiHumanApprover` — sold by §1.1 as "the AI-Act payload" and put on screen as UI columns in Move 6 — will render empty for the overwhelming majority of the 70,972 rows. This is an assumption recon could have settled (SUCCESS point 4) and it touches the GTM demo story.

**EXACT PATCH** — add to R1's first query: `count(*) FILTER (WHERE source_lineage_sdbi_ai_model_id IS NOT NULL) AS sdbi_rows,` and add to Move 6: "expect `sdbi*` columns to be NULL on all brownfield-path rows (000063 invariant) — render `—`, and if R1's `sdbi_rows` is a small fraction, keep the two SDBI columns but note in the report: 'AI-Act columns populated on N of M rows (SDBI-path only)' so the GTM claim is stated honestly."

### F6 · LOW · ABORT-6 references a leak path the schema never opens (metadata jsonb) — make the exclusion explicit instead

**Evidence.** ABORT-6 says "PII still leaks through `metadata` jsonb in responses — pull the `metadata` field from the schema", but Move 3's field list never includes `sourceLineageMetadata` — the abort's scenario is unreachable as designed, and its phrasing could induce a blind executor to *add* the field so the abort makes sense. The metadata jsonb genuinely may carry legacy row snapshots (000063:112 — SDBI rows "keep their jsonb provenance").

**EXACT PATCH** — add to Move 3: "Do NOT include `sourceLineageMetadata` in any response schema — SDBI-path rows carry legacy jsonb provenance there (000063:111-113); it stays DB-only, same posture as fork D route B for naturalKey." Rephrase ABORT-6's trigger to "any response field found carrying raw legacy personal values at live verification".

### F7 · INFO · Move 9 live API check contains a literal `...` in the URL

"authenticated `GET https://www.heuresys.com/api/... /v1/provenance/stats`" — a blind executor has to guess the prod API origin/path. Suggested wording: "verify via the browser DevTools Network tab while clicking the Provenance tab (the SPA's own `apiFetch` shows the real prod path), or replay that exact request with the session cookie."

### F8 · INFO · Line-cite drift ±1-2 on three claims

000005 denylist actual :417-424 (cited 415-423); 000063 SDBI block actual :115-131 (cited 116-131); §1.4 cites data-classes.ts:13-14 correctly but the RESOURCE_DATA_CLASS map spans :45-70 exactly as cited. Content matches in all cases; no action needed beyond noting the plan's cites are grep-anchored well enough for a blind executor.

---

## 3. ATTACKS RUN AND OUTCOME (summary)

| Attack | Outcome |
|---|---|
| Cross-tenant isolation precision (all endpoints incl. aggregates) | HELD — "Every query" mandate + test #7 + synthetic-tenant fallback. One residual branch: F1 (null-tenant fail-open). |
| NULL-tenant lineage rows visibility | N/A — column is NOT NULL (000025:75); plan's premise verified true. |
| 70k-row pagination/perf, index availability | HELD with note — list/stats are seq scans (F3); pagination capped at 200; UI single fetch. |
| Permission-seed interactions (catch-all re-runs vs expect-2 assert; D-38; reconciliation registry) | HELD — only 000005's catch-alls are code-agnostic and they produce exactly the asserted 2 grants; no registry interaction; asserts code-scoped. |
| #27 evidence-layer linkability contract | HELD — `(targetTableName, targetRecordId)` addressing rides the live `target_idx` (000025:100-101); matches #27's drill-down note (SOT_BACKLOG:70). |
| Hardcoded-count test couplings | CLEAN — no 70972 anywhere; lineage tests write-side only; D-52 rollback covers the synthetic row. |
| E2E fragility of adding a 4th tab | HELD — spec asserts individual testids, both personas' storage states exist. |
| Blind-executability guess points | Two wobbles: F7 (`...` URL), Move 6 "cards or compact EntityTable" choice (acceptable — either satisfies the testids). Everything else is copy-pasteable. |

---

## 4. INDEPENDENT 8-POINT GRADE (vs SUCCESS.md)

| # | Point | Grade | Note |
|---|---|---|---|
| 1 | Expected observation per move | **PASS** | Verified concrete for Moves 0-10. |
| 2 | Likely failure + cause + counter per move | **PASS** | Each verified plausible against the real codebase (e.g. TS2307/subpath, RBAC cache staleness are real mechanics). |
| 3 | Forks with triggers | **PASS** | 4 forks, observable triggers, defaults evidence-grounded (all evidence verified). |
| 4 | RECON NEEDED with exact settling checks | **PASS with gap** | R1-R6 are copy-pasteable; one unmarked assumption slipped through: SDBI column population (F5). Patched by one added FILTER clause. |
| 5 | Abort conditions | **PASS** | 7 observable states; ABORT-6 internally inconsistent (F6) but still a stop-signal. |
| 6 | Verification spelled out | **PASS** | V1-V8 with when/command/pass; V2 pins the grant blast radius; V6 makes the #27 contract testable. |
| 7 | Red-team survived and recorded | **PASS** | Both attacks verified genuine against real files. However the successful attack's patch itself carries the F1 fail-open branch — the red-team stopped one step short of the repo's own fail-closed canon. |
| 8 | Executable blind | **PASS** | F7's `...` and F1's absent guard are the only points where a mid-tier executor could go wrong without asking; with P1 applied, blind execution is realistic. |

**Independent grade: 7.5/8** (plan self-graded 8/8 — the half-point gap is F1 inside the red-team patch plus the unmarked F5 assumption).

---

## 5. BOTTOM LINE

- The plan's evidence discipline is the best-verified of the batch: 16/16 substantive claims check out, 2 with cosmetic drift, 1 stale (F2).
- The single change that MUST land before execution is **P1 (F1)** — one guard line + one test. Everything else is wording/recon hygiene.
- **Safe after patching: YES.**
