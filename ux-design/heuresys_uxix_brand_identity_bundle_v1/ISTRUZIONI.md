# Instructions for the Development Team

## Objective

Create the Heuresys UX/IX Brand Identity foundation and browser-reviewable showcase system.

The output must allow the Product Owner to inspect candidate interface designs in the browser, choose among them, request refinements, and have every approved decision recorded and applied consistently across the application.

## Mandatory principles

1. Use a governed design system, not isolated page styling.
2. Build reusable shell components: Header, Sidebar, Footer, MainContentWindow.
3. Treat each page/module as autonomous and then connect it through the navigation registry.
4. Make top tabs optional: use them only where a module has multiple related sub-pages/views.
5. Keep Header and Footer persistent and unchanged when Sidebar collapses/expands.
6. Make Sidebar and Main Content independently scrollable between Header and Footer.
7. Support both fixed and dynamic elements in Header, Sidebar and Footer.
8. Use a professional outline icon system, with semantic colors resolved through tokens.
9. Use browser-rendered showcase pages for design decisions.
10. Record every design decision in the decision register.
11. Allow decisions to be superseded without losing historical traceability.
12. Avoid excessive visual effects: the UI must feel modern, premium and dynamic, but still appropriate for an enterprise SaaS platform.

## Required deliverables

The Development Team must produce:

- Design tokens for colors, typography, spacing, radius, shadows, icons and interaction states.
- Logo system: full logo, symbol, horizontal variant, monochrome variant, light/dark variants.
- Favicon/app icon system.
- Icon strategy based on outline SVG icons.
- Dashboard shell implementation.
- Header implementation with fixed and dynamic regions.
- Sidebar implementation with collapse/expand, tree groups and independent scroll.
- Footer implementation with copyright, Heuresys.com SVG logo and social icons.
- Page metadata contract and registries.
- Module registry and optional tab registry.
- Showcase pages in browser for all key layout and brand alternatives.
- Decision register and ADR-style records for all accepted decisions.
- Acceptance checklist and visual QA artifacts.

## Recommended frontend stack

Adopt the best available tools already aligned with the Heuresys direction:

- Next.js App Router.
- React.
- TypeScript.
- Tailwind CSS.
- shadcn/ui for accessible base components.
- Radix UI primitives where useful.
- Lucide React or Tabler Icons for outline icons.
- Framer Motion for controlled micro-interactions.
- Recharts or equivalent for clean data visualization previews.
- Storybook, Ladle or a dedicated `/showcase` route for visual review.
- Playwright for browser screenshots and interaction validation.
- ESLint, Prettier and TypeScript strictness.

Assets, modules, libraries, components for design and implementatio can be also find inside "D:\evo.heuresys.com" in the Windows local PC and inside "/home/ubuntu/heuresys-evo" in the vm OCI and shall be used as shared objects without replicating them in the actual reposistory directory.

If the system has not yet adopted one of the suggested/required tools, propose the smallest non-disruptive setup path and document the choice before implementation.

## Showcase requirement

The Development Team must create browser-accessible showcase pages, for example:

```text
/showcase
/showcase/shell
/showcase/header
/showcase/sidebar
/showcase/footer
/showcase/palettes
/showcase/typography
/showcase/icons
/showcase/page-types
/showcase/dashboard-cards
/showcase/landing-page
/showcase/login-page
```

Each showcase page must show realistic examples, not empty placeholders.

Examples must include:

- Dashboard shell expanded sidebar.
- Dashboard shell collapsed sidebar.
- Sidebar with long tree menu and independent scroll.
- Header with hamburger, logo, language switcher, palette switcher, theme switcher and user menu.
- Footer with copyright, Heuresys.com logo and social SVG icons.
- Module page with top tabs.
- Module page without top tabs.
- Content-heavy page.
- Login page.
- Primary authenticated initial page.
- Public landing page.
- Palette alternatives.
- Typography alternatives.
- Icon status states.
- Cards, forms, tables, filters, empty states, charts and infographics.

## Decision workflow

For every design decision:

1. Produce at least one browser-reviewable candidate.
2. Prefer 2-3 alternatives where the decision is material.
3. Ask the Product Owner to choose, refine, or reject.
4. Record the decision in `templates/DECISION_REGISTER.md` or the repository equivalent.
5. Apply the decision to tokens/components/registries.
6. Mark superseded decisions when a later choice changes them.
7. Keep screenshots or references to the showcase state used for approval.

## Decision reversibility

A previous decision may be changed. Do not delete it. Mark it as `Superseded`, add a `superseded_by` reference, and create a new active decision.

## Non-negotiable dashboard layout

```text
Dashboard Shell
├── Header - full width, persistent
├── Body
│   ├── Sidebar - collapsible, independently scrollable
│   └── Main Content Window - independently scrollable
└── Footer - full width, persistent
```

Header and Footer must not change size, structure or width when the Sidebar is collapsed or expanded. Only the Body grid columns and the available Main Content width may change.

## Communication style

All deliverables must be in English. Refer to the implementation team as the Development Team.
