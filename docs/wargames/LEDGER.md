# LEDGER

One entry per mission. Draft location, point-by-point self-grade against SUCCESS.md, and every patch the refinement loop makes.

---

## Batch 2026-07-06 — Architect: Claude Fable 5 (Cowork) · Executor target: Claude Code CLI (Sonnet/Opus)

### 03-localai (multi-machine: PC Windows / Mac 2012 / VM OCI ARM)
- Draft: `wargames/03-localai.md` (~489 lines) · Self-grade: **8/8** (caveat pt.8: GitHub/HF asset naming drift, mitigated with pick-rules ±15% size tolerance)
- Red-team patch: AnythingLLM default port 3001 collides with heuresys API → remapped to 3051. Open WebUI rejected (non-OSI license + telemetry) → AnythingLLM MIT `DISABLE_TELEMETRY=true`. llama.cpp prebuilt CUDA dropped Maxwell → Vulkan-vs-CPU measured A/B on GTX 950M, never CUDA prebuilt.
- Enzo inputs: NVIDIA driver install if missing/<570; OCI security-list audit if external probe finds 11434/3051 open; Docker-on-VM decision (default avoided).

### 11-heuresys-evidence (#27 A/L2)
- Draft: `wargames/11-heuresys-evidence.md` (~328 lines, 13 moves, 10 forks, 17 verification runs) · Self-grade: **8/8**
- Red-team patch: DRIFT test `scope-data-classes.integration.test.ts:28` forces ordering **permission migration BEFORE taxonomy edit**. Privacy landmines neutralized: `response_is_anonymous` (390 f360 rows), `feedback_is_private`, nullable `rating_subject_user_id` (COALESCE join).
- Enzo inputs (defaults encoded, never blocking): E1 audience of `evidence:read` · E2 PRIVATE-feedback visibility/author masking · E3 dedicated `/me/evidence` page vs panels · E4 `/users/[userId]` as reviews drill-down surface.

### 12-heuresys-goals-okr (#26 A/L1)
- Draft: `wargames/12-heuresys-goals-okr.md` (~276 lines, 15 moves, 8 forks, 13 verification runs) · Self-grade: **8/8** (caveat pt.8: visual composition of goal-timeline.tsx, fallback F5)
- Zero migrations needed (7 dormant tables since mig 000037; perms already seeded). Red-team patches: (a) NULL-subject goals may have 0 events (`check_in_subject_user_id` NOT NULL) → R6+F1; (b) `comment_is_private` hard-filtered everywhere, field excluded from schema.
- Enzo inputs: E1 private-comments exposure policy · E2 goal_templates read endpoint in/out · E3 empty-state as DoD vs demo-history seed.

### 13-heuresys-f4-activity (#24 F4, HOLD→fork)
- Draft: `wargames/13-heuresys-f4-activity.md` (~337 lines, common moves C0-C9 + route A + route B) · Self-grade: **8/8** (caveat pt.8: the only stop IS Enzo's decision, packaged as fork with shippable checkpoint α)
- Key finding: A/B fork touches ONLY the storage layer; RBAC resource `activity`, D-51 gate extension (`activityGate`/`ACTIVITY_GATE_MISSING`), functional resolver and `sys_process_participants` (does NOT exist yet — verified) are route-invariant → zero wasted work pre-decision.
- Red-team patch: taxonomy edit moved AFTER migrate (C6) — drift-test ordering trap with misleading error message.
- Enzo inputs: **RN-1 MASTER FORK A vs B** (honest evidence table §5.3) · RN-2 MEMBER visibility · RN-3 LEAD/MEMBER vs RACI vocabulary · RN-4 UI in scope or API-only · RN-5 I21 tenant-wide on ACTIVITY.

### 14-heuresys-provenance (#28 A/L0)
- Draft: `wargames/14-heuresys-provenance.md` (~256 lines, 11 moves, 4 forks, 8 verification runs) · Self-grade: **8/8** (caveat pt.8: RBAC fork MUST stay with Enzo per mission constraint)
- Verified: `sys.sys_source_lineage_records` (mig 000025:73-105 + SDBI cols 000063), 70,972 rows (CSV 2026-06-22); `/brownfield-adaptation` already 3-tab container → default fork A = 4th tab, no nav migration. `provenance` not in sensitive taxonomy → no orgGate required (precedent #25).
- Red-team patch: verbatim copy of brownfield service (actor-ignoring) on a `tenant_id NOT NULL` table = cross-tenant leak on a GDPR feature → mandatory tenant predicate in every query + isolation test + V2 grant-set pin.
- Enzo inputs: fork C — `provenance:read` PLATFORM_ADMIN+TENANT_ADMIN(tenant-filtered, default) vs strict platform-only; R3 PII probe on natural keys → route B if hits.

### 15-heuresys-pricing (GTM #4 next deliverable)
- Draft: `wargames/15-heuresys-pricing.md` (~300 lines, 19 moves incl. spec+plan doc-flow, 4 forks, V1-V11) · Self-grade: **8/8**
- Red-team patch (critical): mig `000153` tail assert `NOT IN ('WEBSITE','INVESTOR','DEMO')` detonates on first deploy AFTER a PRICING lead lands (D-38 class) → assert widening in the SAME commit as the new migration + V9 inserts a deliberate PRICING lead pre-close. Page ships numbers-as-data (`price: null` → contact-us rendering).
- Enzo inputs: **RN-1 pricing question set Q1-Q8** (tier count, public figures vs contact-us, billing unit, annual/monthly+discount, tier contents, trial policy, EUR+VAT confirm, nav-link scope).

### 16-heuresys-approval-effects (#34 B/B3)
- Draft: `wargames/16-heuresys-approval-effects.md` (~248 lines, 9 moves, 4 forks, 10 verification runs) · Self-grade: **8/8**
- Zero migrations (resource_type varchar no-CHECK; metadata jsonb exists but not writable today → threaded as optional field, fork B if ripple excessive). Red-team patch: handler MUST use the effect's client, NEVER `tenantMaterializationService` — under D-52 the facade masks the atomicity bug, only live V9 exposes it → hard rule + mechanical grep + live failure-path demo.
- Enzo inputs: R2 live counts decide 2nd handler (recommendation: TIME_OFF_APPROVAL first, GOAL_COMPLETION deferred) · M7h demo tenant keep-vs-purge (default purge).

### 17-heuresys-wave3 (#17 L2/L3 multi-industry, HOLD→fork)
- Draft: `wargames/17-heuresys-wave3.md` (~367 lines, common moves 4 phases + route A + route B, 9 forks, 10 verification runs) · Self-grade: **8/8** (caveat pt.8: legacy column-name drift, covered by `\d`-first rule F8)
- Quantified mismatch from repo: v5 = 23 banking processes + 243 GLOBAL KPI defs; legacy has `BP-SF-*` SmartFood processes; SF/EN footprint = 164/412 kpi-targets, 4 career paths, 8 bonus pools; canonical tenants absent in v5 (collapsed in 000047). `wave_3_runner.md` = stale DRAFT (pre-ADR-0024/0026), demoted to historical. Honest costing: **Route A = 4-8 sessions (program) · Route B = 1.5-2.5 sessions**; "B now + A later" supported, person/org import route-invariant. Production writes → strict aborts + pg_dump snapshot restore path.
- Enzo inputs: **route decision** informed by Q1-Q11 live queries (process family counts, KPI semantics, blueprint variants, per-tenant volumes).

**Batch verification (architect-side)**: all 8 files structurally checked (moves/observations/failures, RECON NEEDED, forks+triggers, abort conditions, verification runs, red-team record, self-grade present in each). Grading = self-grade by each architect agent + structural gate.

### Independent adversarial re-review 2026-07-06 (Enzo's pick: 17 + 13)

- **17-heuresys-wave3**: REVIEW-17 verdict **PASS-WITH-PATCHES** (3 CRITICAL · 6 MAJOR · 6 MINOR; 26 claims spot-checked, 5 refuted). Graded 6.5/8 as-written → **8/8 after patches, 15/15 applied**. Deadliest catches: rollback pg_restore broken as written (permission-denied under /home/ubuntu, S993 precedent + stranded heuresys role); post-import full-suite guaranteed red on hardcoded 162-user census asserts with no stale-assert-vs-defect rule → wrongful-restore risk; markdown-escaped `\|` corrupting the Master-Fork recon regexes. Review: `wargames/reviews/REVIEW-17.md`.
- **13-heuresys-f4-activity**: REVIEW-13 verdict **PASS-WITH-PATCHES** (1 CRITICAL · 4 MAJOR · 4 MINOR; 26 claims spot-checked, 0 refuted). Graded 6/8 as-written → **8/8 after patches, 9/9 applied**. Deadliest catches: C1 registry INSERT breaks the hardcoded reconciliation-registry counts and would trigger a wrongful ABORT-5 (paired test edit now mandatory); member-visibility default unreachable (activity:read audience excluded USER); route-B CHECK made B5 case 4 structurally unsatisfiable. Review: `wargames/reviews/REVIEW-13.md`.
### Independent adversarial re-review 2026-07-06, second wave (11/12/14/15/16/03) — ALL PLANS NOW INDEPENDENTLY REVIEWED

- **11-heuresys-evidence**: PASS-WITH-PATCHES (3C·4M·4m; 26 spot-checks, 4 refuted). 6/8 as-written → **8/8 patched, 11/11 applied**. Deadliest: privacy masking keyed on the wrong column (`feedback_is_private` instead of `feedback_visibility` DEFAULT 'PRIVATE' → ~0 rows masked, PRIVATE feedback leaked org-wide); vacuous E2E gate (wrong testDir); fabricated COALESCE-join evidence at a guess point.
- **12-heuresys-goals-okr**: CONDITIONAL PASS (1H·3M·3L·2I; 20 spot-checks, "zero migrations" independently CONFIRMED). → **PASS patched, 8 applied + 2 INFO recorded**. Deadliest: test-file branch colliding with hardcoded `toBe(4)`; recon PSQL pointed at db `heuresys` instead of `heuresys_advanced` (would simulate an abort); impossible per-event testid vs the real Timeline API; OKR check-ins I18 leak (subjectUserId nulled v1).
- **14-heuresys-provenance**: APPROVED WITH PATCHES (1MED·5L·2I; 16/16 claims verified — best recon of the batch). 7.5/8 → **8/8 patched, 7 applied + 1 no-action**. Deadliest: tenant predicate failing OPEN for tenantId:null actors (repo canon fails closed); SDBI AI-Act columns NULL-by-design on brownfield rows → honest-labeling + probe.
- **15-heuresys-pricing**: PASS-WITH-PATCHES (2MED·3L·2I; 23 spot-checks, 0 refuted — the 000153 detonation confirmed real). 6/8 → **8/8 patched, 7/7 applied**. Deadliest: TierPrice type unable to represent two of RN-1's own options (annual+monthly, scaglioni); contradictory silence-mode rule → deterministic contact-card rule; hidden Playwright `setup` dependency burning the PROD login rate-limit → `--no-deps`.
- **16-heuresys-approval-effects**: NOT PASS as-written, approved after patching (2C·1H·2M·3L; 24 spot-checks, 3 failed). 6/8 → **approved, 9/9 applied**. Deadliest: wrong env var (`TEST_PERSONA_PASSWORD` vs real `TEST_ADMIN_PASSWORD` → wrongful abort at the live demo); **cross-tenant privilege escalation** in the handler (tenant roles could materialize onto RTL_BANK bypassing PLATFORM_ADMIN-only) → creator-parity gate + test + WAIT-INPUT Enzo; unscoped live DELETEs in cleanup → tenant-scoped. The plan's central §7.2 red-team attack checked out line-exact.
- **03-localai**: **REJECT as-written, 3/8** (2C·1H·4M·4L; 13 web/repo spot-checks, 1 load-bearing claim refuted). → **7-8/8 patched, 10 applied + 1 no-action**. Deadliest: every VM production-safety gate curled :3001 but PROD API listens on :8013 → guaranteed false "production sick" abort; the original showcase red-team patch (port collision) verified a collision that doesn't exist — recorded honestly; docker fallback claimed "localhost-only" while binding 0.0.0.0:3051 → host-network-first block + mandatory ufw/OCI gates. PC/Mac routes and the whole model/quantization layer verified sound.

**Batch status finale**: 8/8 piani con review adversariale indipendente + patch integrate + red-team record aggiornato. Totale finding: 12 CRITICAL-class · ~20 MAJOR/MEDIUM · ~25 MINOR/LOW su ~150 claim spot-checkati. Reviews in `wargames/reviews/REVIEW-{03,11,12,13,14,15,16,17}.md`.
