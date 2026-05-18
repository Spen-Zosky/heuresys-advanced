# Brand Identity v1 — Session Charter

**Created**: 2026-05-18
**Worktree**: `D:\heuresys-advanced\.claude\worktrees\brand-identity-v1`
**Branch**: `claude/brand-identity-v1` (off `main` @ `42a7401`)
**Scope**: define Heuresys brand identity v1 per bundle `ux-design/heuresys_uxix_brand_identity_bundle_v1/`
**Status**: ACTIVE — Phase 1 (Foundation) + Phase 2 partial (Brand assets candidates)

---

## 0. Why a separate worktree

The main session (`musing-wing-802781`) is mid-execution on the brownfield-wave-executor refactor (Goal 001a v4, EXEC turn 11/40, transform-compiler shipped). Brand identity is creative + UX work that must not contaminate or be contaminated by backend refactor commits. Two parallel git worktrees off the same `main` give physical separation: each can commit, branch, and review independently. Merge points are explicit (PR / fast-forward) when both lanes stabilize.

## 1. In-scope (touchable)

| Area | Path | Notes |
|------|------|-------|
| Bundle docs | `ux-design/heuresys_uxix_brand_identity_bundle_v1/` | refine permitted; supersession rule applies |
| Decision artifacts | `docs/design-decisions/DECISION_REGISTER.md`, `ADR-NNNN-*.md`, `ASSET_REGISTER.md` | NEW files |
| Design tokens | `D:\ux-design-shared\ui\src\styles\tokens.css` (linked package) | extend with motion/z-index/spacing/font-scale/semantic-states |
| Brand assets | `D:\ux-design-shared\ui\src\brand\` SVG + `apps/web/public/brand/` | logo variants, favicon set, manifest |
| Shell components | `D:\ux-design-shared\ui\src\components\dashboard\` | port DashboardShell/Header/Sidebar/Footer/TopTabs from `code_examples/` |
| Showcase routes | `apps/web/src/app/showcase/<area>/page.tsx` × 14 | NEW route group |
| Brand Playwright | `apps/web/tests/e2e/showcase-*.spec.ts` | NEW, brand-scoped only |

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

1. `BRAND_SESSION_CHARTER.md` (this file) — committed.
2. `docs/design-decisions/DECISION_REGISTER.md` — live, schema applied, header populated.
3. `docs/design-decisions/ADR-0001-shell-architecture-confirm.md` — first ADR, status `Accepted` (shell architecture from bundle doc 01 is invariant).
4. `apps/web/src/app/showcase/` skeleton — index page + 3 sub-route scaffolds (`/shell`, `/palettes`, `/typography`).
5. 2 palette candidates in `tokens.css` (A=current blue-primary, B=alternative) — both renderable in `/showcase/palettes`.
6. 2 typography candidates (Exo 2 vs alternative) — both renderable in `/showcase/typography`.
7. 2–3 logo candidates SVG — refined from `ux-design/heuresys_uxix_brand_identity_bundle_v1/assets/logo/*-placeholder.svg`.
8. `apps/web/tests/e2e/showcase-smoke.spec.ts` — verifies showcase routes render without console errors and pass axe-core baseline.

Each deliverable lands in a dedicated atomic commit (prefix `feat(brand):` / `docs(brand):` / `chore(brand):` / `test(brand):`).

## 4. Decision authority

Product Owner decisions on **palette final / typography final / logo final** are Enzo's, captured via `prompts/DESIGN_DECISION_CAPTURE_PROMPT.md` after showcase review. This session produces candidates only — never declares Accepted unilaterally on aesthetic choices. Structural decisions (shell architecture, sidebar collapse rules, header composition) inherit the bundle as `Accepted` and are documented as such in ADR-0001+.

## 5. Commit conventions

- Prefix taxonomy: `feat(brand):` `docs(brand):` `chore(brand):` `test(brand):` `fix(brand):`
- One deliverable per commit; no cross-area commits.
- Body explains decision register impact when applicable (`Decision: UXIX-NNNN proposed/accepted/superseded`).
- Co-author footer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- **No push** from this lane without explicit Enzo ack.

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

## Live state

| Field | Value |
|---|---|
| Worktree HEAD | `42a7401` (initial — will roll forward as deliverables land) |
| Last commit (brand lane) | — (this is the genesis commit) |
| Open ADRs | 0 |
| Accepted ADRs | 0 |
| Showcase routes live | 0 / 14 |
| Phase | 1 (Foundation) |
