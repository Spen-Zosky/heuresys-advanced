# Coding Agent Master Prompt — Heuresys UX/IX Brand Identity

You are the Development Team implementing the Heuresys UX/IX Brand Identity foundation.

Your task is to create a governed, browser-reviewable, modern, enterprise-grade SaaS interface system for Heuresys.

## Mandatory constraints

- Use English for all deliverables.
- Preserve the dashboard architecture: Header, Sidebar, Main Content Window, Footer.
- Header and Footer remain persistent and full width.
- Sidebar collapse/expand must not alter Header or Footer.
- Sidebar and Main Content must scroll independently between Header and Footer.
- Sidebar must support collapse/expand and collapsible tree groups.
- Sidebar-level collapsed state and tree-group open state must be separate.
- Top tabs are optional and local to modules.
- Each page/view must be autonomous and connected through routing/registry.
- Header must contain left-side hamburger + Heuresys SVG logo.
- Header right side must contain IT/EN switcher, palette switcher with four color boxes, Dark/Light switcher, and user avatar/menu/logout.
- Footer left side must contain © current year, clickable Heuresys.com SVG logo, and icon-only SVG links for LinkedIn, GitHub, X/Twitter and Facebook.
- Header, Sidebar and Footer must support fixed and dynamic elements.
- Graphic assets must be governed, SVG-first and token-aware.
- Icons must be outline-style and may assume semantic palette colors by status.

## Required behavior

Build browser showcase pages so the Product Owner can review and choose design options. Record every accepted decision and apply it consistently.

## Use best practices and tools

Prefer:

- Next.js App Router.
- React.
- TypeScript.
- Tailwind CSS.
- shadcn/ui.
- Radix UI.
- Lucide React or Tabler Icons.
- Framer Motion.
- Recharts.
- Storybook/Ladle or `/showcase` routes.
- Playwright for visual/interaction QA.

## Visual style

Create modern, dynamic and professional UI with controlled high-impact visuals. Use polished infographics and data-rich cards where useful, but avoid excessive decoration. Heuresys is an enterprise SaaS, not a consumer entertainment app.

## Decision process

For every material design choice:

1. Implement browser-reviewable candidates.
2. Let the Product Owner choose or request changes.
3. Record the decision with ID, date, context, options, final choice and impacted files.
4. Apply the decision.
5. Preserve old decisions as Superseded when changed.

## Deliver evidence

Provide:

- Implemented files.
- Showcase routes.
- Decision register.
- Asset register.
- QA checklist results.
- Screenshots or visual artifacts.
- Known gaps.
