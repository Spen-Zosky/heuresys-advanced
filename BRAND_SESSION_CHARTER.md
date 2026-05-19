# Brand Identity v1 — Session Charter

**Created**: 2026-05-18
**Worktree**: `D:\heuresys-advanced\.claude\worktrees\brand-identity-v1`
**Branch**: `claude/brand-identity-v1` (off `main` @ `42a7401`)
**Scope**: define Heuresys brand identity v1 per bundle `ux-design/heuresys_uxix_brand_identity_bundle_v1/`
**Status**: ACTIVE — Phase 1 (Foundation) + Phase 2 partial (Brand assets candidates)

---

## 0. Why a separate worktree

The main session (`musing-wing-802781`) is mid-execution on the brownfield-wave-executor refactor (Goal 001a v4, EXEC turn 11/40, transform-compiler shipped). Brand identity is creative + UX work that must not contaminate or be contaminated by backend refactor commits. Two parallel git worktrees off the same `main` give physical separation: each can commit, branch, and review independently. Merge points are explicit (PR / fast-forward) when both lanes stabilize.

## 1. In-scope (touchable) — Option 2 split

Per decision 2026-05-18: brand governance and reusable assets live entirely in the shared library repo `D:\ux-design-shared` (Option 2). The `heuresys-advanced` brand worktree only hosts the consumer-side showcase + lane meta-docs. Both repos may be committed from this lane.

### `D:\ux-design-shared\` (separate git repo, branch `main`)

| Area | Path | Notes |
|------|------|-------|
| Decision register | `governance/DECISION_REGISTER.md` | live, cross-consumer index |
| ADR files | `governance/ADR-NNNN-<title>.md` | one file per row |
| Asset register | `governance/ASSET_REGISTER.md` | logo + favicon + asset inventory (pending Session 2) |
| Design tokens | `ui/src/styles/tokens.css` | extend with motion/z-index/spacing/font-scale/semantic-states |
| Brand assets (raw SVG) | `ui/src/assets/brand/candidates/UXIX-NNNN-<topic>/` (exploration) → `ui/src/assets/brand/logo/`, `ui/src/assets/brand/favicon/` (post-Accepted) | logo variants, favicon set, manifest |
| Brand components (React) | `ui/src/components/brand/candidates/Logo*.tsx` (exploration) → `ui/src/components/brand/HeuresysLogo.tsx`, `HeuresysMark.tsx` (post-Accepted) | inline SVG, `currentColor` for theme inheritance |
| Shell components | `ui/src/components/dashboard/` | port DashboardShell/Header/Sidebar/Footer/TopTabs from `code_examples/` (Session 2+) |
| Subpath exports | `ui/package.json` `exports` field | `./brand/candidates`, `./assets/brand/*` already wired |

### `D:\heuresys-advanced\` brand worktree (this lane)

| Area | Path | Notes |
|------|------|-------|
| Bundle docs | `ux-design/heuresys_uxix_brand_identity_bundle_v1/` | refine permitted; supersession rule applies |
| Showcase routes | `apps/web/src/app/showcase/<area>/page.tsx` × 14 | consumer pages — render and review candidates from `@heuresys/ui/brand/candidates` |
| Brand Playwright | `apps/web/tests/e2e/showcase-*.spec.ts` | NEW, brand-scoped only |
| Lane meta-docs | `BRAND_SESSION_CHARTER.md`, `HANDOFF_BRAND.md` | session governance; lane-local |

## 2. Out-of-scope (sealed — do not touch)

| Area | Reason |
|------|--------|
| `apps/api/**` | backend logic, RBAC, auth — owned by main session / brownfield refactor |
| `db/migrations/**`, `db/seeds/**`, `db/scripts/**` | schema + data — locked under I3/I4/I13 invariants |
| `packages/shared/src/schemas/**` (business) | API contract types — only touch if a brand-specific Zod schema is genuinely needed (unlikely) |
| `apps/web/src/app/(authenticated)/**` business pages | live MVP-2a routes, no regression allowed from this lane |
| `apps/web/src/app/(public)/login/` existing | will be redesigned only after `/showcase/login-page` is Accepted in Decision Register |
| SSH tunnel, DB pool, RBAC cache, auth flow | runtime state — sealed |
| vitest API integration tests | `pnpm test` in `apps/api/` is not run from this lane |

## 3. Deliverables — Session 1 (this session)

Backlog reference: `ux-design/heuresys_uxix_brand_identity_bundle_v1/docs/15_implementation_backlog.md`, Phase 1 + Phase 2 partial.

1. `BRAND_SESSION_CHARTER.md` (this file) — committed in heuresys-advanced brand lane.
2. `D:\ux-design-shared\governance\DECISION_REGISTER.md` — live, schema applied, header populated.
3. `D:\ux-design-shared\governance\ADR-0001-shell-architecture-confirm.md` — first ADR, status `Accepted` (shell architecture from bundle doc 01 is invariant).
4. `apps/web/src/app/showcase/` skeleton — index page + 4 sub-route scaffolds (`/shell`, `/palettes`, `/typography`, `/logo`).
5. 2 palette candidates inline in `/showcase/palettes` (A=current blue-primary, B=alternative). Promotion to `D:\ux-design-shared\ui\src\styles\tokens.css` deferred until Accepted.
6. 2 typography candidates inline in `/showcase/typography` (A=Exo 2, B=Inter + IBM Plex Mono).
7. 3 logo candidates as React components + raw SVG in `D:\ux-design-shared\ui\src\components\brand\candidates\` and `D:\ux-design-shared\ui\src\assets\brand\candidates\UXIX-0007-logo\`. Imported in `/showcase/logo` via `@heuresys/ui/brand/candidates`.
8. `apps/web/tests/e2e/showcase-smoke.spec.ts` — verifies showcase routes render without console errors and pass axe-core baseline.

Each deliverable lands in a dedicated atomic commit (prefix `feat(brand):` / `docs(brand):` / `chore(brand):` / `test(brand):`).

## 4. Decision authority

Product Owner decisions on **palette final / typography final / logo final** are Enzo's, captured via `prompts/DESIGN_DECISION_CAPTURE_PROMPT.md` after showcase review. This session produces candidates only — never declares Accepted unilaterally on aesthetic choices. Structural decisions (shell architecture, sidebar collapse rules, header composition) inherit the bundle as `Accepted` and are documented as such in ADR-0001+.

## 5. Commit conventions

- Prefix taxonomy: `feat(brand):` `docs(brand):` `chore(brand):` `test(brand):` `fix(brand):`
- One deliverable per commit; no cross-area commits.
- Body explains decision register impact when applicable (`Decision: UXIX-NNNN proposed/accepted/superseded`).
- Co-author footer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- **Two-repo workflow** (Option 2): a single brand decision may require commits in BOTH `D:\ux-design-shared\` (governance + assets) AND `D:\heuresys-advanced\.claude\worktrees\brand-identity-v1\` (showcase consumer). Each repo holds its own commit; cross-link via the decision id in both messages.
- **No push** from either repo without explicit Enzo ack.

## 6. Quality gates (per-deliverable, before commit)

- TypeScript `pnpm typecheck` in `apps/web` = 0 errors (scope: web only, not API).
- ESLint `pnpm lint --filter @heuresys/web` = 0 errors.
- Playwright smoke `showcase-smoke.spec.ts` = green (when applicable).
- Zero hardcoded styles in scaffolded showcase: only tokens from `@heuresys/ui` or `tokens.css`.
- A11y baseline: aria-label on icon-only controls, keyboard focus visible.
- Visual QA checklist row checkbox (`governance/VISUAL_QA_CHECKLIST.md`) updated per deliverable that maps to a row.

## 7. Out-of-band escalation (when to break the seal)

The seal can be broken in this lane only via explicit Enzo authorization, and only for these reasons:
- A bug in the existing shell (`apps/web/src/app/(authenticated)/layout.tsx`) blocks showcase rendering — fix requires a `fix(web):` commit, flagged in the next handoff.
- An asset path used by the showcase requires a public file in `apps/web/public/brand/` that already exists with conflicting content.
- A `@heuresys/shared` schema needs a brand-only field (deemed unlikely).

In all other cases: open a TODO at the boundary, defer to the main session lane.

## 8. Session handoff protocol

End-of-session ritual:
1. Update `HANDOFF.md` (in this worktree) with brand session state.
2. Update `MEMORY.md` index (auto-memory) with new entries pointing to brand artifacts.
3. List shipped commits + remaining backlog rows.
4. Tag next-session entry point in this charter §3 if rolling over.

---

## Live state (Session 1 close, 2026-05-18, after Option 2 migration)

| Field | Value |
|---|---|
| heuresys-advanced HEAD (brand lane) | rolling forward — see `HANDOFF_BRAND.md` for current SHA |
| ux-design-shared HEAD | rolling forward on `main` — see `HANDOFF_BRAND.md` for current SHA |
| Open ADRs (Proposed) | 6 — UXIX-0002, 0003, 0004, 0005, 0006, 0007 |
| Accepted ADRs | 4 — UXIX-0001 (shell, ADR file in ux-design-shared/governance), 0008 (icons), 0009 (registries), 0010 (a11y gates). 0008/0009/0010 are register-only pending ADR drafts. |
| Showcase routes scaffolded | 5 / 16 — index, shell, palettes, typography, logo |
| Showcase routes pending | 11 — header, sidebar, footer, icons, page-types, dashboard-cards, forms, tables, charts, landing-page, login-page, primary-initial-page |
| Phase | 1 (Foundation) ✅ + 2 (Brand assets candidates) ✅ partial — palette/typography/logo candidates live; tokens.css extension deferred until Acceptance |
| Verification | Deferred to Session 2 start — `pnpm install --frozen-lockfile` (10-30s with warm CAS) → typecheck → `NEXT_PUBLIC_ENABLE_SHOWCASE=1 pnpm dev` → `playwright test showcase-smoke.spec.ts` |
| Architecture | **Option 2** (brand governance + reusable assets in `D:\ux-design-shared`; showcase consumer in `heuresys-advanced`). Two-repo commit workflow per decision. |
