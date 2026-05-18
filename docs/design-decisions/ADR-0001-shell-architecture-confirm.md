# ADR-0001 — Dashboard shell architecture confirm

## Decision ID

UXIX-0001

## Status

Accepted

## Date

2026-05-18

## Decider

Joint (Product Owner Enzo + Development) — inherits invariant from `ux-design/heuresys_uxix_brand_identity_bundle_v1/docs/01_dashboard_shell_architecture.md`.

## Context

`heuresys-advanced` is a multi-tenant HRMS/BPM SaaS that must render dozens of business modules (positions, skills, learning, certifications, processes, governance, ESS, …) within a coherent authenticated workspace. Prior to brand identity v1, `apps/web/src/app/(authenticated)/layout.tsx` shipped a working header + nav + footer pattern (MVP-2a), but without the formal architectural statement, fixed-viewport invariants, or independent-scroll guarantees described by the bundle.

The bundle `docs/01_dashboard_shell_architecture.md` defines a non-negotiable shell: a persistent, full-viewport frame with Header + Body(Sidebar/Main) + Footer, where Header and Footer **never** change when the Sidebar collapses. Only the body grid columns shift between `280px + 1fr` (expanded) and `72px + 1fr` (collapsed).

This ADR formalizes adoption of that architecture in `apps/web` and in the shared component package `@heuresys/ui` (sourced from `D:\ux-design-shared`). All future shell-impacting decisions (Header composition, Sidebar tree state, Footer composition, palette switcher placement, theme toggle placement) inherit from this baseline.

## Options considered

### Option A — Adopt bundle shell as-is (chosen)

- CSS grid `grid-rows-[64px_1fr_44px]`, body cols `[280px_1fr]` expanded / `[72px_1fr]` collapsed.
- Header and Footer locked across collapse transitions; only body cols animate.
- Independent vertical scroll for Sidebar and Main, both constrained between Header and Footer.
- Pros: Matches the bundle reference implementation in `code_examples/src/components/dashboard/DashboardShell.tsx`. Predictable visual rhythm. No layout shift between collapsed/expanded states for header/footer regions. Lines up with established SaaS UX (Linear, Notion, Vercel admin).
- Cons: Requires migration of the existing `apps/web/src/app/(authenticated)/layout.tsx` to the new grid contract (small refactor, no business-logic impact).

### Option B — Document-flow shell with sticky header/footer

- Standard page flow with `position: sticky` for Header and Footer.
- Pros: Simpler CSS, easier to retrofit.
- Cons: Sticky elements bleed during scroll quirks (overscroll bounce, iOS Safari edge cases), z-index management becomes fragile. Footer rarely behaves correctly without complex IntersectionObserver workarounds. Independent scroll for Sidebar requires extra plumbing.

### Option C — Two-column shell (no global footer)

- Drop the persistent footer; surface system status (env, version, tenant, last refresh) inside the Sidebar instead.
- Pros: Slightly more vertical real estate for content.
- Cons: Loses the marketing footprint (Heuresys.com link, social links), conflicts with bundle `docs/08_footer_specification.md` mandatory composition, breaks parity with the broader brand expression.

## Decision

Adopt **Option A** — bundle shell architecture as the canonical and only supported shell for `apps/web` (authenticated routes) and `@heuresys/ui` shell components.

Concrete contract:

```tsx
<div className="h-screen grid grid-rows-[64px_1fr_44px] overflow-hidden">
  <header className="border-b ..."> {/* persistent */} </header>
  <div className={cn(
    "grid min-h-0",
    sidebarCollapsed ? "grid-cols-[72px_1fr]" : "grid-cols-[280px_1fr]"
  )}>
    <aside className="border-r min-h-0 overflow-y-auto"> {/* Sidebar */} </aside>
    <main className="min-h-0 overflow-y-auto"> {children} </main>
  </div>
  <footer className="border-t ..."> {/* persistent */} </footer>
</div>
```

Row heights: header `64px`, footer `44px`. The 4px delta vs the bundle's example (`40px`) is intentional, reserving vertical space for the social icon set + version chip at the bundle-mandated minimum size.

## Rationale

- The bundle defines this shell as a load-bearing invariant; deviating fragments the system before any aesthetic decision is taken.
- The independent-scroll contract is the cleanest way to handle long sidebars (24+ tree groups) and infinite scroll in tables without footer eviction.
- Header/footer immutability across sidebar collapse eliminates a class of layout bugs we'd otherwise pay for forever.
- The 4px footer height upgrade (40 → 44) is a one-time call: it accommodates Apple's 44×44 minimum touch target for the social icon hit zones without violating the bundle's intent (the bundle gives `40px` as recommended, not mandatory).

## Consequences

### Code

- Migrate `apps/web/src/app/(authenticated)/layout.tsx` to the new grid contract — non-breaking for child pages because the grid is internal to the layout.
- Port `DashboardShell`, `Header`, `Sidebar`, `Footer`, `TopTabs` from `ux-design/heuresys_uxix_brand_identity_bundle_v1/code_examples/src/components/dashboard/*` into `D:\ux-design-shared\ui\src\components\dashboard\` (live link, available to `apps/web` via existing `@heuresys/ui` symlink).
- Introduce `useShellContext()` (per bundle doc 05) to expose page metadata (title, breadcrumb, primary actions) without prop drilling.

### Tokens

- New token in `D:\ux-design-shared\ui\src\styles\tokens.css`:
  - `--shell-header-height: 64px;`
  - `--shell-footer-height: 44px;`
  - `--shell-sidebar-expanded: 280px;`
  - `--shell-sidebar-collapsed: 72px;`
- Existing radius/shadow/surface tokens remain untouched by this ADR.

### Assets

- None directly. Logo/asset decisions live in UXIX-0007.

### Tests

- `apps/web/tests/e2e/showcase-smoke.spec.ts` will assert the grid contract (computed heights for header/footer, body col widths for expanded vs collapsed, independent scroll on `aside` and `main`).
- Existing Playwright shell-related assertions in `apps/web/tests/e2e/` must continue to pass after the migration (regression guard).

### Process

- Future Header/Sidebar/Footer composition ADRs (UXIX-0002..0004) are scoped inside this shell — they decorate but cannot violate it.
- Any future ADR proposing a non-fixed-viewport variant (e.g. mobile pull-up sheets) must explicitly cite this ADR in its `Supersedes` field, and the corresponding showcase route must demonstrate the new variant alongside the current.

## Showcase reference

- `/showcase/shell` — to be implemented in this session (Session 1 deliverable §4). Will render expanded vs collapsed states side-by-side with long-scroll content in both Sidebar and Main, demonstrating the independent-scroll guarantee and the immutability of Header/Footer across collapse.
- Bundle source of truth: `ux-design/heuresys_uxix_brand_identity_bundle_v1/docs/01_dashboard_shell_architecture.md`.

## Impacted files/components/tokens

- `apps/web/src/app/(authenticated)/layout.tsx` (migration target)
- `D:\ux-design-shared\ui\src\components\dashboard\DashboardShell.tsx` (port from bundle)
- `D:\ux-design-shared\ui\src\components\dashboard\Header.tsx` (port from bundle, composed per UXIX-0002)
- `D:\ux-design-shared\ui\src\components\dashboard\Sidebar.tsx` (port from bundle, state per UXIX-0004)
- `D:\ux-design-shared\ui\src\components\dashboard\Footer.tsx` (port from bundle, composed per UXIX-0003)
- `D:\ux-design-shared\ui\src\components\dashboard\TopTabs.tsx` (port from bundle)
- `D:\ux-design-shared\ui\src\lib\shell-context.tsx` (new — bundle doc 05)
- `D:\ux-design-shared\ui\src\styles\tokens.css` (shell-height tokens added)
- `apps/web/src/app/showcase/shell/page.tsx` (new)
- `apps/web/tests/e2e/showcase-smoke.spec.ts` (new, asserts shell contract)

## Supersedes

N/A (genesis ADR for this register).

## Superseded by

N/A.
