# 09 — Design System and Tokens

## Principle

Palette, themes, typography, spacing, border radius, shadows, icon style and other visual rules must be centralized in a design system and inherited by all dashboard regions and module pages.

The visual identity is global. Page composition is local.

## Design hierarchy

```text
Level 1 — Brand / Design Tokens
Palette, typography, spacing, radius, shadows, icon style

Level 2 — Global Theme
Light mode, dark mode, semantic colors, accessibility rules

Level 3 — Dashboard Shell Components
Header, sidebar, footer, content area

Level 4 — Shared UI Components
Buttons, tabs, cards, tables, forms, filters, modals

Level 5 — Module-Specific Views
Positions, Organization, Skills, Performance, Learning, Analytics
```

## What must be global

Define once and reuse everywhere:

- Color palette.
- Light/dark theme.
- Typography.
- Font family.
- Font sizes.
- Font weights.
- Spacing scale.
- Border radius.
- Shadows.
- Icon style.
- Button styles.
- Form styles.
- Table styles.
- Card styles.
- Modal/dialog styles.
- Tab styles.
- Sidebar item styles.
- Header/footer styles.

## Token categories

Recommended token groups:

```text
colors.brand.*
colors.semantic.*
colors.surface.*
colors.text.*
colors.border.*
colors.icon.*
typography.family.*
typography.size.*
typography.weight.*
spacing.*
radius.*
shadow.*
motion.*
zIndex.*
```

## Semantic colors

Prefer semantic names over raw colors.

Do not hardcode:

```text
success = green-500
warning = yellow-500
error = red-500
```

Use semantic tokens:

```text
--color-success
--color-warning
--color-danger
--color-info
--color-muted
```

This allows themes and palettes to change without rewriting components.

## Controlled local variation

Module pages may have local layout needs:

- Different card arrangement.
- Specific chart composition.
- Workflow-specific panels.
- Advanced tables and filters.
- Specialized infographics.

They must not redefine the platform identity.

## Recommended visual quality

The interface should be:

- Modern.
- Professional.
- Data-rich.
- Clear.
- Responsive.
- Visually polished.
- Suitable for executive and operational HR/BPM users.

It should avoid:

- Random gradients.
- Excessive glow effects.
- Emoji-driven UI.
- Inconsistent icon families.
- Uncontrolled colors.
- Decorative clutter.
- Marketing-style exaggeration inside operational dashboards.

## Architectural statement

Visual identity must be defined centrally and inherited by all dashboard regions and module pages through shared design tokens, global theme variables and reusable UI components.
