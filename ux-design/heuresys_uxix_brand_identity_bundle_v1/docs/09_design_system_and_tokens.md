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

## Brand color scales — derived from logo anchors

Two brand colors are anchored to the logo and are the source of all blue/purple variation in the system:

```text
--brand-blue-500    = hsl(221, 83%, 53%)   ← logo wordmark "heures" + "s"
--brand-purple-500  = hsl(271, 91%, 65%)   ← logo wordmark accent "y"   (= #a855f7)
```

From each anchor, an **11-step luminance ladder** (50, 100, 200, 300, 400, **500**, 600, 700, 800, 900, 950) is generated with the same hue and saturation. The `-500` step is the exact logo color and is preserved across both light and dark themes — it never changes.

```text
--brand-blue-50   221 83% 96%
--brand-blue-100  221 83% 92%
…
--brand-blue-500  221 83% 53%  ← LOGO EXACT (brand anchor)
…
--brand-blue-950  221 83% 14%
```

### Why `--primary` is NOT mapped 1:1 to the logo blue

The logo blue (`--brand-blue-500`) does not meet WCAG AA contrast against the canonical light or dark surface backgrounds for small body text:

| Combination | Contrast ratio | WCAG AA (4.5:1) |
|---|---|---|
| `--brand-blue-500` on light bg `#ffffff` | ~4.20:1 | borderline fail (normal text) |
| `--brand-blue-500` on dark bg `hsl(224 28% 7%)` | ~4.47:1 | borderline fail (normal text) |
| `--brand-blue-700` on light bg `#ffffff` | ~9.50:1 | AAA pass |
| `--brand-blue-400` on dark bg `hsl(224 28% 7%)` | ~5.50:1 | AA pass |

`--primary` is therefore mapped to the **theme-appropriate ladder step** that preserves the brand hue while meeting accessibility:

```css
:root        { --primary: var(--brand-blue-700); } /* light mode */
.dark        { --primary: var(--brand-blue-400); } /* dark mode */
```

This is a **brand vs system distinction** (the same pattern Stripe, Linear, and shadcn/ui follow): the logo color is a brand anchor preserved verbatim, while `--primary` is a system color tuned for action clarity and accessibility. They share the same hue (221), so every blue across the system reads as the same brand family.

### Purple usage

`--brand-purple-500` is reserved for **personality moments** in the UI — selected state highlights, AI-augmented feature flags, premium tier markers — **never** for primary CTA. This preserves the wordmark accent's symbolic weight (the "y" differentiator) without blurring action semantics.

### Categorical accent palette is independent

The `--palette-1..4` accent tokens are **separate** from the brand scales and serve categorical encoding (KPI cards, chart series, tenant identity badges). They are intentionally not derived from the brand anchors to avoid coupling categorical data viz to brand identity.

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

---

## Interactive affordance tokens

Interactive states (hover, active, focus) share a fixed scale of `--primary`-based alpha values. Do not pick arbitrary alpha values in components.

### Alpha ladder (hover affordances)

| Alpha | Surface | Example |
|---|---|---|
| `0.06` | Row cross-hair fill (gentle) | `tbody tr.row-cross > td` |
| `0.08` | Column tint (cross-hair column) | `tbody td.col-cross` |
| `0.12` | Lift shadow primary tint | `0 6px 18px hsl(var(--primary) / 0.12)` |
| `0.15` | Column header highlight bg | `thead th.col-hover-header` |
| `0.18` | Cell intersection (cross-hair) | `tbody td.cell-cross` |
| `0.30` | Active sidebar nav-link border | `border-color` on `aria-current="page"` |
| `0.35` | Outer glow ring on card hover | `box-shadow: 0 0 0 1px hsl(var(--primary) / 0.35)` |
| `0.40` | Hovered button border, sidebar nav-link border | `hover:border-foreground/40` |
| `0.55` | Alert banner border on hover | `[role="alert"]:hover` border |
| `0.70` | Cell intersection ring | `inset 0 0 0 1.5px hsl(var(--primary) / 0.7)` |
| `0.85` | Card hover border | `article:hover` border |

### Scale token

```css
--scale-magnifier: 1.012;
```

Used by `article:hover { transform: scale(var(--scale-magnifier)) }`. Never exceed `1.02` (looks glitchy).

### Animation duration tokens

```css
--duration-instant: 100ms;
--duration-fast:    150ms;
--duration-medium:  180ms;
--duration-slow:    200ms;
```

| Duration | Use |
|---|---|
| `100ms` ease | Cross-hair tints (column, cell) |
| `150ms` ease | Table row hover, log line hover, feed item hover |
| `180ms` ease | Cards, alerts, badges (border + shadow + transform) |
| `200ms` ease | Group chevrons, dropdown chevrons, sidebar grid-template |

All durations are `ease` timing function unless otherwise specified. All paired with `prefers-reduced-motion: reduce` override (animation forced to `none`).

---

## Cross-hair tokens (data-dense tables)

Tables enable a cross-hair affordance via CSS classes toggled by JS. The complete token set:

```css
/* Row hover */
tbody tr:hover {
  background: hsl(var(--accent) / 0.9) !important;
  box-shadow:
    inset 4px 0 0 hsl(var(--primary)),
    inset 0 1px 0 hsl(var(--primary) / 0.4),
    inset 0 -1px 0 hsl(var(--primary) / 0.4);
}

/* Column tint when th hovered or td hovered */
tbody td.col-cross {
  background-color: hsl(var(--primary) / 0.08) !important;
}

/* Cell intersection (hovered td in cross-hair mode) */
tbody td.cell-cross {
  background-color: hsl(var(--primary) / 0.18) !important;
  box-shadow: inset 0 0 0 1.5px hsl(var(--primary) / 0.7);
}

/* Column header highlight */
thead th.col-hover-header {
  background-color: hsl(var(--primary) / 0.15) !important;
  color: hsl(var(--primary));
  box-shadow: inset 0 -2px 0 hsl(var(--primary));
}

/* Sticky-column overrides (required because bg-card occludes row hover) */
tbody tr:hover > td.sticky,
tbody tr:hover > td[class*="sticky"] {
  background-color: hsl(var(--accent) / 0.9) !important;
}
tbody td.sticky.col-cross,
tbody td[class*="sticky"].col-cross {
  background-color: hsl(var(--primary) / 0.08) !important;
}
tbody td.sticky.cell-cross,
tbody td[class*="sticky"].cell-cross {
  background-color: hsl(var(--primary) / 0.18) !important;
}
thead th.sticky.col-hover-header,
thead th[class*="sticky"].col-hover-header {
  background-color: hsl(var(--primary) / 0.15) !important;
}
```

The full canonical sheet lives in `code_examples/src/styles/hover-affordance.css`.

---

## Sidebar collapse / group toggle tokens

```css
/* Sidebar collapsed state */
body[data-sidebar="collapsed"] [data-shell="grid"] {
  grid-template-columns: 72px 1fr !important;
}
body[data-sidebar="collapsed"] aside .sidebar-section-label,
body[data-sidebar="collapsed"] aside .sidebar-group-toggle,
body[data-sidebar="collapsed"] aside .sidebar-subtree,
body[data-sidebar="collapsed"] aside .sidebar-footer-card,
body[data-sidebar="collapsed"] aside .nav-label,
body[data-sidebar="collapsed"] aside .nav-aux {
  display: none !important;
}
body[data-sidebar="collapsed"] aside .nav-link { justify-content: center; }
body[data-sidebar="collapsed"] .sidebar-icon-collapse { display: none; }
body[data-sidebar="collapsed"] .sidebar-icon-expand   { display: block; }

/* Group expand/collapse */
.sidebar-group-toggle[aria-expanded="false"] + .sidebar-group-content { display: none; }
.sidebar-group-toggle[aria-expanded="false"] [data-group-chevron] { transform: rotate(-90deg); }
[data-group-chevron] { transition: transform 200ms ease; }
```

---

## Bundle CSS files

| File | Purpose | Mirror in @heuresys/ui |
|---|---|---|
| `code_examples/src/styles/tokens.css` | Brand color scales + theme tokens + radius + shadow | n/a (consumed via CSS vars) |
| `code_examples/src/styles/hover-affordance.css` | Universal hover, cross-hair, sidebar state, magnifier | `@heuresys/ui/src/styles/hover-affordance.css` |
