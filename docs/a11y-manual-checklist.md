# Accessibility manual checklist — heuresys-advanced

> **Status (2026-05-17)**: automated axe-core gate green (zero critical on
> 35 routes × 3 persona groups, WCAG 2.0 A/AA + 2.1 A/AA + **2.2 A/AA**).
> This document covers the **17 manual items** from the brand bundle's
> `governance/ACCESSIBILITY_CHECKLIST.md` that axe-core cannot fully
> validate. Run before each release tag.

The bundle gate must be satisfied **in addition to** the automated axe gate
(see `apps/web/tests/e2e/a11y.spec.ts`). Manual review is owned by the
maintainer; results are recorded inline below at each release.

## Procedure

1. Run the automated audit: `cd apps/web && pnpm exec playwright test a11y.spec.ts`. Expect critical=0.
2. Boot dev: `pnpm dev` on api (3001) + web (3000), tunnel 5433 up.
3. Open `http://localhost:3000`, walk through each persona (5 from `tests/e2e/fixtures.ts`).
4. Tick each manual item below for each release.

## Checklist v0.2.0-mvp2 (closure baseline, 2026-05-17)

Persona coverage required for the manual pass: `platformAdmin`,
`tenantAdmin`, `manager`, `employee` (USER), `outsider` (USER).

### Bundle items (governance/ACCESSIBILITY_CHECKLIST.md mirror)

- [ ] All icon-only controls have accessible labels (header logout, social icons in footer, table sort/filter buttons, dialog close buttons).
- [ ] All external links have meaningful aria-labels where icon-only (footer social links: LinkedIn, GitHub, X, Facebook — verify each).
- [ ] Keyboard can access header controls (Tab through hamburger → logo → language switcher → palette switcher → theme switcher → user menu → logout).
- [ ] Keyboard can access sidebar controls (Tab into nav, ↑/↓ traverses items, Enter activates link).
- [ ] Keyboard can open/close tree groups (Enter or Space on group header toggles state).
- [ ] Keyboard can use tabs (top tabs on module pages — Left/Right or Tab navigates, Enter activates).
- [ ] Focus ring is visible on every interactive element (no `outline: none` without replacement) in both light and dark modes.
- [ ] Color contrast is acceptable in light mode (`prefers-color-scheme: light`, all text ≥ 4.5:1, large text ≥ 3:1).
- [ ] Color contrast is acceptable in dark mode (`prefers-color-scheme: dark`, all text ≥ 4.5:1, large text ≥ 3:1).
- [ ] Status meaning is not conveyed only by color (icons + text labels accompany every status: success ✓, warning ⚠, danger ✗, info ℹ).
- [ ] Reduced-motion preferences are respected (`prefers-reduced-motion: reduce` disables non-essential transitions; verify framer-motion + Tailwind transitions).
- [ ] Menus and dropdowns use accessible primitives (`@heuresys/ui` uses Radix UI under the hood — verify Dialog, DropdownMenu, Combobox, Select).
- [ ] Forms have labels and validation messages (every `<input>` has either `<label htmlFor>` or visible `aria-label`; error messages associated via `aria-describedby` or `aria-invalid`).
- [ ] Breadcrumb is accessible navigation (`<nav aria-label="breadcrumb">` with `aria-current="page"` on the leaf).

### Additional items (WCAG 2.2 AA specific, not in bundle)

- [ ] Target size minimum 24×24 CSS px (WCAG 2.2 SC 2.5.8 AA) for all clickable controls outside text contexts. Verify pagination buttons, icon buttons, social footer icons.
- [ ] Focus not obscured (WCAG 2.2 SC 2.4.11 AA): when keyboard-focusing an element, no other UI element (sticky header, sticky footer, fixed banner) hides part of the focus ring.
- [ ] Accessible authentication (WCAG 2.2 SC 3.3.8 AA): login does not require cognitive function tests (no CAPTCHA, no "what is 2+2"). Standard email+password is compliant; verify MFA flow when implemented.
- [ ] Consistent help (WCAG 2.2 SC 3.2.6 A): if a help link/email/chat is present, it appears in a consistent location across pages.
- [ ] Redundant entry (WCAG 2.2 SC 3.3.7 A): multi-step forms do not re-ask the same info already provided in the same session (verify `/me/career/target` if it spans multiple steps).

## Reporting findings

When a checklist item fails:

1. Open an issue with template `bug_report.yml` and label `area/a11y`.
2. Add an entry to `docs/a11y-tail-items.md` under the appropriate severity column.
3. If the violation is `critical` per WCAG impact mapping, **block the release**. Lower severities are tail and can ship with the next maintenance window.

## Tooling references

- Automated: `apps/web/tests/e2e/a11y.spec.ts` — axe-core with `wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22a,wcag22aa` tags.
- Per-route JSON summaries: `apps/web/test-results/a11y-audit/<route>.json`.
- Tail items register: `docs/a11y-tail-items.md`.
- Bundle source: `ux-design/heuresys_uxix_brand_identity_bundle_v1/governance/ACCESSIBILITY_CHECKLIST.md`.
