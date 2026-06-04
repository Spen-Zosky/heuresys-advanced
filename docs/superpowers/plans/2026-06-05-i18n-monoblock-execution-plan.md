# i18n Milestone — MONOBLOCK Execution Plan (Fasi 2–5 + quick-win bundle)

> **Status**: READY TO EXECUTE (prepared S964, 2026-06-05). **For the next fresh session.**
> **How to run**: open the session with **`ultracode`**, read this file + the design spec
> `docs/superpowers/specs/2026-06-04-i18n-milestone-design.md` IN FULL, then execute §4→§7 in order.
> Goal: **close the entire i18n milestone** (Fasi 2–5 + EN gate) **plus** the quick-win bundle
> (next 16 micro-migration, BI P3, F7) in one orchestrated session.

---

## 0. Pre-flight (first 5 minutes of the session)

```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # empty = synced (start clean)
nc -z localhost 5433 && echo tunnel-up                         # DB tunnel for E2E/integration
cd apps/web && pnpm i18n:check                                 # baseline parity 131 x2 x7
pnpm exec eslint "src/app/**/*.tsx" 2>/dev/null | grep -c no-literal-string  # baseline debt ~848
cd ../api && pnpm dev   # API dev server on :3001 (REQUIRED for Playwright login/setup — see note)
```
**NOTE (learned S964)**: Playwright's `webServer` only boots `next dev` (web). The login/auth.setup
**requires the API dev server on :3001** running separately, or all 5 persona setups time out. Start
it first. The auth.setup `tenantAdmin`/`manager` personas are **flaky in dev-mode** (cold-compile
redirect) — `retries:1` absorbs it; a `flaky` (not `failed`) result is green.

---

## 1. Scope — what this monoblock CLOSES vs what it CANNOT

| Closes | Detail |
|---|---|
| **i18n Fasi 2–5** | ~45 pages → 4 namespaces (admin/blueprints/hr/ess) + EN, **closing the whole i18n milestone** |
| **EN gate** | one Playwright spec navigating `?lng=en`, asserting chrome flips; full parity over 7 ns |
| **i18n follow-ups** | guardrail flip `warn`→`error` (once debt = 0); €/number locale-aware in `compensation/page.tsx` |
| **next 16 micro-migration** | adopt next 16.2.7 (pre-validated green S964) + config cleanup + middleware decision |
| **BI ① P3** | org-network analytics view (full-stack, like P2) |
| **F7** | the 6 render-affecting showcase proposals (your call per item) |

| **CANNOT close (gated on external conditions)** | Why |
|---|---|
| **typescript 6** (PR #22) | upstream: `typescript-eslint` must support TS6 + tsconfig `baseUrl` refactor |
| **vite 8** (PR #20) | upstream: `vitest` must support vite 8 (peer `@vitest/mocker` wants vite ^6) |
| **AI ② P1** | needs `VOYAGE_API_KEY` in the VM `.env` (Enzo's action) |

→ Do **not** spend the session on these three; they unblock when the external condition arrives.

---

## 2. LOCKED invariants (decided in Fasi 0b/1 — do NOT re-litigate)

1. **Client-only i18n** — `useTranslation(ns)` in every page (all 45 are client components). No server-side i18next.
2. **IT byte-identical** — the `it/<ns>.json` value = today's literal, character-for-character. This keeps the 29 E2E specs green (they assert testids/numbers/`scope.kind`, plus ~20 count-word regexes that must stay IT-identical). **Behavior-preserving is non-negotiable.**
3. **Reuse shared keys** — loading → `t("common:loading")` (already exists); generic error/empty → reuse `common`/area key. Do NOT duplicate `common.json` keys; **do not mutate `common.json`/`shell.json` from the fan-out** (avoids cross-agent merge conflicts).
4. **ECharts/option builders** — module-scope builders receive **already-resolved strings** as params (e.g. `monthlyLineOption(rows, { total: t("..."), overtime: t("...") })`), NOT the `t` function. Type-safe, no `TFunction` threading. (Pattern proven in Fase 1 attendance/compensation/skills.)
5. **Interpolations** — `t("key", { var })` with `{{var}}`; ICU plural (`_one`/`_other`) on count keys for correct EN.
6. **Numbers/currency** — `compensation` €: bind `Intl.NumberFormat` to the active locale (the one follow-up beyond extraction).
7. **Guardrail** — `i18next/no-literal-string` is `warn` on all `apps/web/src/app/**`. After the milestone (debt = 0) **flip to `error`** in `eslint.config.mjs` (comment already in file). The guardrail is the **live work-list**: `pnpm exec eslint "<dir>/**/*.tsx" | grep -c no-literal-string` per area.
8. **Props are the bulk** — the guardrail only flags JSX plain-text; `title`/`description`/`label`/`ariaLabel` props are NOT counted but MUST be extracted (Fase 1 had 28 JSX-text but ~3× that in props). Read each page fully; don't trust the warning count as the whole job.
9. **Per-page checklist** = shared Zod (n/a here, no new endpoints) → `useTranslation` → all JSX text + props + builder strings via `t()` → page-area E2E green (IT identical) → parity green.

---

## 3. Page → namespace map (measured S964; 45 residual pages, analytics excluded)

> Namespaces already scaffolded in `apps/web/src/lib/i18n.ts` (`admin/blueprints/hr/ess` exist, empty).
> Separate `<ns>.json` files → the 4 area-agents fan out with **zero file conflicts**.

**`ess`** (16 — all `/me/*`): `me`, `me/career`, `me/career/target`, `me/certifications`, `me/documents`, `me/gaps`, `me/inbox`, `me/kpis`, `me/learning`, `me/learning/catalogue`, `me/positions`, `me/profile`, `me/security`, `me/skills`, `me/skills/self-assessment`, `me/team`. (Heaviest: ~78 JSX-text warnings + props.)

**`admin`** (16 — org/identity/access/system): `users`, `users/[userId]`, `tenants`, `tenants/[tenantId]`, `tenants/[tenantId]/enterprise-typing`, `organization`, `organization/org-chart`, `positions`, `positions/[positionId]`, `positions/[positionId]/kpis`, `positions/[positionId]/learning`, `positions/[positionId]/skills`, `admin/roles`, `dashboard`, `system-health`, `visualizations` + `visualizations/[graphId]`. (Heavy: tenants ~25, visualizations ~12, positions ~10.)

**`hr`** (7 — talent/skills/learning/kpi): `skills`, `kpis`, `gaps`, `career-succession`, `compensation-intelligence`, `learning`, `learning/training-initiatives`. (Heavy: compensation-intelligence ~8, gaps ~8.)

**`blueprints`** (5 — process/data-pipeline): `blueprints`, `blueprints/[variantId]`, `processes`, `brownfield-adaptation`, `seed-acquisition/runs`.

> Note: `visualizations/*` may be brand/graph-gated (React Flow/Mermaid — see memory `feedback_brand_before_graph_renderers`). If a viz page is gated/empty, extract its chrome only and skip gated renderers. `dashboard`/`system-health` are light (the latter ~1 string, mostly an English demo fixture per design §10 — leave the demo fixture, extract real chrome only).

---

## 4. Orchestration — ultracode fan-out (Phase A: i18n Fasi 2–5)

**Shape**: 4 area-agents in parallel (one per namespace), each owns its `<ns>.json` (it+en) + its pages.
Because namespaces are separate files and page dirs don't overlap, **agents don't conflict**. Use the
Workflow tool. Each agent's brief is self-contained (it doesn't see this context) — embed the invariants
(§2), the page list (§3), and the Fase-1 reference pattern.

```js
export const meta = {
  name: 'i18n-fasi-2-5',
  description: 'Extract i18n for admin/blueprints/hr/ess namespaces (it byte-identical + en)',
  phases: [{ title: 'Extract' }, { title: 'Verify' }],
}

const AREAS = [
  { ns: 'ess',        pages: [/* §3 ess */] },
  { ns: 'admin',      pages: [/* §3 admin */] },
  { ns: 'hr',         pages: [/* §3 hr */] },
  { ns: 'blueprints', pages: [/* §3 blueprints */] },
]

// Phase A: each agent extracts its namespace. Worktree isolation so parallel file writes don't clash
// on the shared working copy (each writes only its <ns>.json + its own page dirs, but worktree is the
// safe default for parallel mutation). Brief MUST embed §2 invariants + the Fase-1 pattern verbatim.
const extracted = await parallel(AREAS.map(area => () =>
  agent(
    `You are migrating the "${area.ns}" i18n namespace of apps/web (Next 15 client pages).
     PAGES: ${area.pages.join(', ')} (under src/app/(authenticated)/).
     RULES (non-negotiable): ${/* paste §2 invariants 1-9 */ ''}
     REFERENCE: mirror the Fase-1 analytics commit 1950817 exactly (useTranslation(ns); JSX text +
     PageHeader/StatsCard/EmptyState props + EChartsCard ariaLabels + ECharts series/axis labels via
     t(); builders receive resolved strings; it/<ns>.json byte-identical; en/<ns>.json HR/BPM EN).
     DELIVER: src/locales/{it,en}/${area.ns}.json fully populated (symmetric keys) + every listed page
     refactored. Run \`pnpm exec eslint "<your page dirs>" | grep -c no-literal-string\` → must reach 0
     JSX-text for your pages. Return the list of files changed + residual count.`,
    { label: `extract:${area.ns}`, phase: 'Extract', isolation: 'worktree', schema: AREA_RESULT_SCHEMA }
  )
))

// Barrier, then merge worktrees back (main loop), pnpm i18n:check, typecheck web.
// Phase B (Verify): per-area Playwright E2E + parity, each as soon as its area lands.
```

**After the fan-out merges** (main loop): `pnpm typecheck` (web) · `pnpm i18n:check` (parity over 7 ns) ·
`pnpm exec eslint "src/app/**/*.tsx" | grep -c no-literal-string` (debt should approach 0 for JSX-text) ·
then per-area Playwright specs (IT identical → green). Fix any regression before the EN gate. Atomic
commit per area (`feat(i18n): Fase N — <ns> namespace (M pages, it+en)`).

---

## 5. EN gate (Phase A close)

- Author the EN values for all 4 namespaces (AI-assisted HR/BPM technical pass; ICU plurals on count keys).
- New spec `apps/web/tests/e2e/i18n-en.spec.ts`: set `NEXT_LOCALE=en` (or the switcher), navigate a
  representative page per namespace, assert at least one chrome string is the EN value (not IT).
- `pnpm i18n:check` must pass over **all 7 namespaces**. → **i18n milestone CLOSED.**
- **Flip the guardrail**: in `eslint.config.mjs`, `i18next/no-literal-string` `warn` → `error`
  (only after `eslint "src/app/**/*.tsx" | grep -c no-literal-string` JSX-text = 0). Commit
  `chore(i18n): guardrail no-literal-string warn→error (milestone closed)`.
- Follow-up in the same phase: `compensation/page.tsx` — bind `Intl.NumberFormat` to the active locale.

---

## 6. Phase B — quick-win bundle (sequential, after i18n closes)

1. **next 16 micro-migration** (PR #21, pre-validated green S964 — build/typecheck/lint/E2E 8/8):
   `pnpm up next@16.2.7 -r` + `pnpm up eslint-config-next@16 -D -w`; remove the deprecated `eslint`
   key from `next.config.js`; **decide `middleware`→`proxy`** (next 16 deprecates the `middleware`
   file; it still works but is removed in next 17 — either rename `middleware.ts`→`proxy.ts` now or
   document the deferral); run full gate (typecheck/lint/build/E2E) + a **prod-mode smoke**
   (`next build && next start` + curl `/login`→200) before commit. Commit, push, CI. (Do NOT deploy
   to prod here — `vm-deploy` is a separate, monitored step.) Close PR #21.
2. **BI ① P3 — org-network** view: full-stack like P2 (shared Zod schema → repo raw SQL scope-filtered
   → service → route `analytics:view` → integration test → page from `@heuresys/ui` → nav migration →
   Playwright E2E live). Atomic commit.
3. **F7 — 6 showcase proposals**: tokenize colors, extract DashboardShell, split SystemHealthDashboard,
   etc. (from S961 list). Each is your call; do the non-controversial ones, surface the rest.

---

## 7. Final verification + close

```bash
pnpm -r typecheck                                   # all workspaces green
cd apps/web && pnpm i18n:check                      # parity over 7 ns (full EN)
pnpm exec eslint "src/app/**/*.tsx" | grep -c no-literal-string   # 0 (guardrail now `error`)
pnpm exec playwright test                           # 29+ specs green (IT identical) + EN gate
cd ../api && pnpm test                              # api suite green (regression check)
gh run list --branch main --limit 8                 # all CI green
```
Update `.handoff/STATE.md` (milestone i18n CLOSED; remaining = the 3 gated + any deferred F7/next-deploy)
and `docs/kb/SOT_BACKLOG.md`. Done.

---

## 8. Risk register (for the executor)

| Risk | P | I | Mitigation |
|---|---|---|---|
| Context exhaustion mid-run (volume ~9× Fase 1) | med | high | fan-out parallel (4 agents) keeps each agent's context small; commit per area so progress survives a restart; if budget runs low, stop after Phase A (milestone still closed) and defer Phase B |
| E2E regression from prop refactor | med | med | IT byte-identical + per-area E2E gate before next area; 29 specs assert testids/numbers, not chrome |
| Cross-agent file conflict | low | med | namespaces are separate files; agents in `isolation: 'worktree'`; don't touch common/shell |
| next 16 middleware deprecation | low | med | decided in §6.1 (rename to proxy or document); prod-mode smoke before commit; not deployed here |
| viz pages brand-gated | low | low | extract chrome only, skip gated renderers (§3 note) |
| Flaky auth.setup in dev-mode | low | low | `retries:1`; flaky≠failed; API server must be up (§0) |
