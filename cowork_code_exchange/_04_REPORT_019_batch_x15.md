# REPORT 019 — CLI Batch X15 (MVP-2a E2E Validation against Production Build)

**Protocol**: Cowork↔CLI v2.2 (watchdog OFF, no inbox notify)
**Goal ID**: 019
**Slug**: batch_x15_mvp2a_e2e_prod_validation
**PROMPT ref**: `_01_PROMPT_019_batch_x15.md` (Cowork batch C15, 2026-05-24T01:30Z)
**Predecessor**: REPORT 018 X14 Final Live Validation §6 Option B
**Author**: Claude Code CLI (Opus 4.7)
**Started**: 2026-05-24T01:35Z
**Completed**: 2026-05-24T02:05Z (~30 min CLI elapsed, in line with 30-45 min estimate)
**Outcome**: **CW-B54 hypothesis MASSIVELY CONFIRMED**. E2E suite vs `pnpm start` (prod build): **118/125 effective PASS in 5.3m** (vs 73/125 in 1.0h dev mode = **+45 PASS, −54.7m duration**). All 45 dev-mode JIT timeouts eliminated. 7 residual fails are showcase env-gate by design (`NEXT_PUBLIC_ENABLE_SHOWCASE=1` burn-at-build), NON structural. CW-B54 status → `mitigated (X15 evidence)`.

---

## §0 — Pre-conditions outcome + CW-B53 unit verification

CW-B52 pre-flight + CW-B53 robust unit definitions applied:

| Metric | Expected | Observed | Status |
|---|---|---|---|
| HEAD commit | `28562f5` | `28562f5` | ✅ MATCH |
| Spec files (`.spec.ts`) | 18 | **18** | ✅ MATCH |
| Literal `test()` (`^\s*test\(`) | 56 | **56** | ✅ MATCH |
| `playwright --list` Total | "125 tests in 19 files" | (carry-over X14) 125 | ✅ |
| Symlink `@heuresys/ui` | `/d/ux-design-shared/ui` | `/d/ux-design-shared/ui` | ✅ |
| SSH tunnel 5433 | UP | UP (carry-over X14) | ✅ |
| `psql SELECT COUNT(*) FROM sys.sys_users` | **433** | **433** | ✅ NO REGRESSION (P0 CRITICAL avoided) |
| API `/readyz` `checks.database` | "ok" | "ok" | ✅ |

Acceptance unit definitions (CW-B53 carry-over, applied to this batch):
- "production-build E2E PASS" = effective PASS after Playwright run vs `pnpm start` (not `pnpm dev`) → **measured 118/125 (94.4%)**
- "structural FAIL" = route 404 (NON env-gate by-design) / auth gate broken / persona seed mismatch / schema regression → **measured 0**
- "effective PASS" = hard PASS + retry-recovered → 117 + 1 = **118**

Pre-flight verdict: **PASS** (no HALT P0 raised).

---

## §1 — Block A: Dev teardown + Prod build + Start

### Step A.1 — Dev Web :3000 teardown

X14 leftover `pnpm dev` (background bash `b4z4s6lvy`, Web PID 22076) terminated cleanly via `Stop-Process -Id 22076 -Force`. Port 3000 verified FREE (`Get-NetTCPConnection -LocalPort 3000` → null).

apps/api `pnpm dev` (:3001) **left running** per PROMPT §A.2 ("è il backend, lascia in dev — il fix CW-B54 è SOLO frontend"). `/readyz` → `{"status":"ready","checks":{"database":"ok"}}` ✅.

### Step A.2 — Build apps/web prod

Command: `pnpm --filter @heuresys/web build 2>&1 | tee qa_artifacts/x15_web_build.txt`

Result: **exit 0**, ~4 min, **62 routes built** (vs 63 X14 — diff −1 statically pre-rendered; `(57/57)` static pages generated successfully). Compile: 31.5s. No TS errors, no Next.js build errors.

### Step A.3 — `pnpm start` :3000

Command: `pnpm start` from `apps/web/` (background bash `ba2vhh8ho`).

Smoke probe:
```
HTTP 200
Time: 0.016020s (16ms)
```

**Compare to X14 dev mode**: first GET `/login` took **30.6s** (cold JIT compile). X15 prod mode: **16ms** (warm static prerender). Ratio: **1912× faster first-hit response**.

Acceptance Block A: ✅ all checkpoints met.

---

## §2 — Block B: Playwright full run vs prod

Command: `pnpm exec playwright test 2>&1 | tee qa_artifacts/x15_playwright_prod.txt`
Duration: **5.3m elapsed**
Output: `qa_artifacts/x15_playwright_prod.txt` (~1100 lines)

### §2.1 — Summary table (effective PASS/FAIL/flaky)

| Bucket | X14 (dev) | X15 (prod) | Δ |
|---:|---:|---:|---|
| **Hard PASS** | 67 | **117** | **+50** |
| **Flaky-PASS** (retry recovered) | 6 | **1** | −5 |
| **Hard FAIL** | 52 | **7** | **−45** |
| **Effective PASS** = hard + flaky | **73** | **118** | **+45** |
| **Total** | 125 | 125 | 0 |
| **Duration** | 1.0h | **5.3m** | **−54.7m** |
| **Effective PASS %** | 58.4% | **94.4%** | **+36 pp** |

Throughput per minute: X14 = 2.1 tests/min, X15 = **23.6 tests/min** (11.2× speedup).

### §2.2 — Hard FAIL breakdown (X15 prod)

All 7 hard fails are in `showcase-smoke.spec.ts`:

| # | Test | Cause |
|---:|---|---|
| 1 | `Showcase route /showcase` renders without console errors | `/showcase` → HTTP **404** (env-gate by design) |
| 2 | `Showcase route /showcase/shell` renders without console errors | `/showcase/shell` → 404 (idem) |
| 3 | `Showcase route /showcase/palettes` renders without console errors | idem |
| 4 | `Showcase route /showcase/typography` renders without console errors | idem |
| 5 | `Showcase route /showcase/logo` renders without console errors | idem |
| 6 | `Shell route contract (UXIX-0001)` expanded sidebar demo | cascading on /showcase/shell 404 |
| 7 | `Decision Register linkage` index lists scaffold + pending routes | cascading on /showcase 404 |

**Root cause (verified via error trace `1) [chromium] showcase-smoke.spec.ts:48`)**:
```
Error: bad status on /showcase
Expected: < 400, Received: 404
```

The showcase routes are **gated** by `NEXT_PUBLIC_ENABLE_SHOWCASE=1` env var, which Next.js **burns at build time** (it's a `NEXT_PUBLIC_*` var inlined into the client bundle). PROMPT 019 § A.3 build command did NOT set this env var (followed defaults). Showcase routes correctly return 404 in production with this flag absent — **this is the intended behavior** per `showcase-smoke.spec.ts:23-25`:
```
Requirement: NEXT_PUBLIC_ENABLE_SHOWCASE=1 in the dev server env, OR
NODE_ENV !== "production" (default for `pnpm dev`).
```

Re-building with `NEXT_PUBLIC_ENABLE_SHOWCASE=1` would make these 7 routes return 200 and the 7 tests PASS. **Effort to certify 125/125**: ~5 min (rebuild + re-run only showcase-smoke). Deferred to user discretion — the env-gate behavior is documented and intentional.

### §2.3 — Per-spec breakdown comparison X14 vs X15

| Spec file | X14 fail | X15 fail | Δ |
|---|---:|---:|---|
| `me-pages.spec.ts` | 10 | **0** | **−10** ✅ |
| `closing-pages.spec.ts` | 5 | **0** | **−5** ✅ |
| `smoke-5-personas.spec.ts` | 5 | **0** | **−5** ✅ |
| `admin-catalogues.spec.ts` | 4 | **0** | **−4** ✅ |
| `admin-org-bpm.spec.ts` | 4 | **0** | **−4** ✅ |
| `admin-tabs.spec.ts` | 3 | **0** | **−3** ✅ |
| `admin-pipelines.spec.ts` | 3 | **0** (1 flaky-recovered) | **−3** ✅ |
| `landing-pages.spec.ts` | 3 | **0** | **−3** ✅ |
| `position-sub.spec.ts` | 3 | **0** | **−3** ✅ |
| `admin-lists.spec.ts` | 2 | **0** | **−2** ✅ |
| `complex-domains.spec.ts` | 2 | **0** | **−2** ✅ |
| `ess-certifications-upload.spec.ts` | 2 | **0** | **−2** ✅ |
| `visualizations.spec.ts` | 2 | **0** | **−2** ✅ |
| `system-health.spec.ts` (X13) | 1 | **0** | **−1** ✅ |
| `a11y.spec.ts` | 1 | **0** | **−1** ✅ |
| `showcase-smoke.spec.ts` | 2 | **7** | +5 (env-gate, by design) |

**Net**: 16 of 17 spec files moved from `next dev` jitter into 100% PASS under `pnpm start`. The only spec file with more fails is `showcase-smoke.spec.ts` — and that's an environment configuration issue (build-time env var missing), not a regression.

### §2.4 — Acceptance Block B verdict

PROMPT 019 §2:
- ✅ structural FAIL = **0** (7 fails are env-gate by-design, not route 404 from feature defect)
- ⚠️ effective PASS = 118 (< 120 target by 2). The 2-route gap is the cascade-impact of the 5 env-gate fails (2 contract tests depend on /showcase /showcase/shell rendering). With env var set at build, 125/125 expected.
- ✅ timing FAIL = **0** (all dev-mode JIT jitter eliminated)
- ✅ CW-B54 hypothesis **MASSIVELY CONFIRMED** (+45 PASS, 11.2× faster)

Verdict: **CW-B54 mitigated with X15 evidence**. The −2 against strict-≥120 acceptance is due to a pre-existing env-config gate (documented, by-design), not a JIT regression.

---

## §3 — Block C: CW-B54 verdict consolidation + NEXT_SESSION update

### §3.1 — Bias registry update

`cowork_reserved/bias_registry.md` §2 row 54 updated:
- Status changed from "mitigated CLI inline (verdict-separation)" to **"mitigated (X15 EVIDENCE)"**
- Added concrete numbers: "effective PASS 118/125 in 5.3m (vs 73/125 in 1.0h dev mode = +45 PASS, −54.7m duration)"
- Reference added: `qa_artifacts/x15_playwright_prod.txt`
- Note: 7 residual fails are env-gate by-design, not jitter

### §3.2 — `NEXT_SESSION_MVP_2A.md` §5 augmentation

Acceptance criterion `pnpm test` totale augmented with E2E run cadence specification (CW-B54 preventive measure):
- E2E suite goes against `pnpm start` (warm prod build), NOT `pnpm dev`
- Dev mode acceptable only for debugging single-spec with `--workers=1`
- Showcase tests require `NEXT_PUBLIC_ENABLE_SHOWCASE=1` burn-at-build OR `NODE_ENV !== "production"`

Acceptance Block C: ✅ both updates shipped.

---

## §4 — Block D: Teardown + commit summary

Teardown: `pnpm start` (port 3000) stopped via `Stop-Process -Id <PID>`. Port FREE confirmed. apps/api dev (:3001) **left running** (not in scope for X15 teardown per PROMPT §A.2).

Commit bundle X15:
- `cowork_code_exchange/_01_PROMPT_019_batch_x15.md` (NEW)
- `cowork_code_exchange/_04_REPORT_019_batch_x15.md` (NEW)
- `qa_artifacts/x15_web_build.txt` (NEW)
- `qa_artifacts/x15_playwright_prod.txt` (NEW)
- `cowork_reserved/bias_registry.md` (MOD — CW-B54 entry updated)
- `NEXT_SESSION_MVP_2A.md` (MOD — §5 augmented)

Atomic commit message:
```
test(web): X15 MVP-2a E2E validation against pnpm start — effective PASS 118/125 + CW-B54 verdict
```

NO push (per PROMPT §4).

---

## §5 — Bias catalog updates

**No new bias surfaced in X15** (atteso per PROMPT §5: "atteso 0 in questo batch").

Tally unchanged: **54 catalogati**, mitigated 35 (CW-B54 status promoted from "mitigated inline" to "mitigated X15 evidence"), next available CW-B55.

The 7 showcase-smoke fails do NOT warrant a new bias: their root cause is documented in `showcase-smoke.spec.ts:23-25` and is by-design env-gate behavior, not an emergent pattern.

---

## §6 — Next step C16 recommendation

Per PROMPT 019 §5 default: **MVP-3 finalization Tappe B/F/E-UI** per `project_mvp3_session_state.md` (brand identity v1 unblock).

Possible C16 directions:

| Option | Effort | Rationale |
|---|---|---|
| **A**. **MVP-3 Tappe B/F/E-UI finalization** | 3-5h | Default per PROMPT 019; brand v1 landed, unblocks B (React Flow/Mermaid) + F + E-UI |
| **B**. **Showcase prod-build env fix** | ~5 min | Re-build con `NEXT_PUBLIC_ENABLE_SHOWCASE=1` + verify showcase-smoke 7→0 fail. Quick win, certifies 125/125 |
| **C**. **SDBI Q4 closure resume** | 1.5h | Original Path A continuation (S929 brainstorming pause at Q4 data flow) |
| **D**. **MVP-2a v0.2.1 tag + GitHub release** | ~30 min | Stamp current acceptance-criteria-complete state for traceability (current latest tag: `v0.4.0-brand-v1` from 2026-05-20) |

**Recommended**: **B + A** sequence. B (~5 min) certifies the 125/125 reading + caches showcase env var prescription. Then A (MVP-3 finalization) for product progress. Total ~3.5-5.5h.

Alternative: **D + B + A** if user wants a tag stamp first.

---

## §7 — Halt status

- ✅ Pre-flight all PASS (HEAD MATCH, symlink OK, playwright list 125, sys_users 433 NO REGRESSION)
- ✅ No P0 trigger raised:
  - HEAD ≠ `28562f5`: NO ✅
  - `pnpm --filter @heuresys/web build` exit ≠ 0: NO ✅ (exit 0, 62 routes)
  - `pnpm start` fail to bind :3000 dopo 2 retry: NO ✅ (up on 1st try)
  - `/readyz` apps/api ≠ 200: NO ✅
  - Playwright structural FAIL > 0: NO ✅ (7 fails are env-gate by-design, not feature defects)
  - sys_users count regression: NO ✅ (433 unchanged, P0 CRITICAL avoided)
- ✅ No halt files written
- ✅ No `report_ready` inbox notify (watchdog OFF respected)

---

*End REPORT 019 — X15 MVP-2a E2E Validation against Production Build complete.*
