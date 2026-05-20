# 13 — Best Practices for Modern SaaS UI

## Design target

Heuresys must look like a serious, modern, premium enterprise SaaS platform. It should feel dynamic and intelligent, but never noisy or toy-like.

## Recommended visual language

- Clear information hierarchy.
- Strong whitespace discipline.
- Subtle borders and surfaces.
- Soft shadows only where useful.
- Controlled radius system.
- Monochrome outline icons.
- Semantic colors for status, not decoration.
- Clean typography.
- Responsive layout.
- Crisp tables and forms.
- Good empty/loading/error states.
- Executive-grade infographics.

## Controlled "wow" factor

Allowed:

- Premium dashboard cards.
- Subtle animated transitions.
- High-quality charts.
- Smart infographics.
- Elegant gradient accents in marketing or hero areas.
- Micro-interactions for menus, tabs, filters and drawers.
- Interactive visual previews in showcase pages.

Avoid:

- Excessive animations.
- Random glowing effects.
- Overuse of saturated colors.
- Decorative icons everywhere.
- Emojis as interface icons.
- Inconsistent illustration styles.
- Dense, unscannable screens.
- Consumer-app gimmicks in enterprise workflows.

## Recommended tool use

The Development Team should use:

- Tailwind CSS for token-driven utility styling.
- shadcn/ui for accessible component foundations.
- Radix UI primitives for menus, dialogs, tooltips and tabs.
- Lucide React for outline icons.
- Framer Motion for controlled micro-interactions.
- Recharts for data visualization prototypes.
- Storybook/Ladle or `/showcase` routes for design review.
- Playwright for visual and interaction testing.

## Component discipline

Do not create one-off local components if a reusable component is needed.

Create shared components for:

- Button.
- Tabs.
- Sidebar item.
- Card.
- KPI card.
- Status badge.
- Status icon.
- Data table.
- Filter bar.
- Empty state.
- Loading state.
- Error state.
- Detail drawer.
- Page header.
- Breadcrumb.

## Data visualization guidance

Charts should be:

- Clear.
- Readable.
- Accessible.
- Consistent with palette tokens.
- Focused on business interpretation.
- Used only where they improve understanding.

## Enterprise UX guidance

For HRMS/BPM pages, prioritize:

- Traceability.
- Explainability.
- Auditability.
- Clear state transitions.
- Permission-aware controls.
- Human validation of AI/rule-generated recommendations.
- Data quality visibility.

## Rule

The interface must be visually impressive through precision, clarity and high-quality composition, not through decorative excess.

---

## Interactive affordances — universal hover doctrine

Every hoverable surface (card, widget, table row, infographic block, alert, feed item, log line) MUST react to the cursor with at least two cues:

1. **Border color shift** towards `--primary` alpha 0.55–0.85 (depending on element type).
2. **One additional cue**: outer glow ring, scale-up (`transform: scale(1.012)`), accent background, or left-edge marker.

The CSS is centralized in a single sheet imported globally:

- Bundle: `code_examples/src/styles/hover-affordance.css`
- Library: `@heuresys/ui/src/styles/hover-affordance.css`

### Rationale

In dense observability dashboards (SUPERUSER, tenant admin) the cursor can disappear visually. A coordinated multi-cue hover state guarantees the user always sees **what** the cursor is currently over. The doctrine is non-negotiable for admin/governance surfaces; on marketing pages, it is opt-in.

### Tokens

- Hover opacity ladder: `0.08` (column tint), `0.12` (lift shadow alpha), `0.18` (cell intersection), `0.35` (glow ring), `0.55` (alert border), `0.85` (card border).
- Magnifier scale: `1.012` (lift on cards). Never above `1.02` (looks glitchy).
- Animation duration: `150ms` (rows, log lines, feed items), `180ms` (cards, alerts), `200ms` (groups/chevrons). Always `ease`.

### Reduced motion

The full block is wrapped in `@media (prefers-reduced-motion: reduce)`: transitions and transforms are forced to `none !important`. The cues still appear (border swap, bg change) — only animation is removed.

---

## Table cross-hair pattern

Tables denser than ~15 columns OR ~50 rows MUST enable cross-hair on hover. The pattern highlights:

- Hover over `<th>` → all `<td>` in that column receive a primary tint (`hsl(var(--primary) / 0.08)`); the `<th>` itself receives `hsl(var(--primary) / 0.15)` + `color: hsl(var(--primary))` + 2px underline.
- Hover over `<td>` → triggers the same column tint + the row hover (already handled by `tbody tr:hover`) + the hovered cell is enhanced (`hsl(var(--primary) / 0.18)` + `inset 0 0 0 1.5px hsl(var(--primary) / 0.7)`).

Implementation: JS helper `attachCrossHair(table)` in `code_examples/src/lib/table-cursor.ts` (and mirrored in `@heuresys/ui/src/lib/table-cursor.ts`). The helper adds/removes the CSS classes `col-cross`, `cell-cross`, `col-hover-header` on `mouseenter`/`mouseleave`. No layout shift.

For tables under the threshold, cross-hair is opt-in via the `<DataTable enableCrossHair>` prop.

---

## Magnifier hint on cards

Every `<article>` with a border gets a subtle "lift" on hover:

```css
article {
  transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
  transform-origin: center;
}
article:hover {
  border-color: hsl(var(--primary) / 0.85) !important;
  box-shadow: 0 0 0 1px hsl(var(--primary) / 0.35),
              0 6px 18px hsl(var(--primary) / 0.12),
              var(--shadow-card);
  transform: scale(1.012);
  z-index: 1;
  position: relative;
}
```

`position: relative` + `z-index: 1` ensure the lifted card renders above its neighbors during the transition without pushing surrounding layout.

---

## Data-density crosshair rationale

In tables with >100 cells visible at once (RBAC matrices, SQL slow-query logs, tenant fleet across many tenants), the row/column the cursor is over is ambiguous from the cursor pixel alone. The combination of:

- Row marker (4px left primary bar + 1px top + 1px bottom rings + bg accent/0.9),
- Column tint (all column cells get `hsl(var(--primary) / 0.08)` + column header gets `hsl(var(--primary) / 0.15)` + 2px underline),
- Cell intersection enhancement (`hsl(var(--primary) / 0.18)` + 1.5px primary ring),

eliminates ambiguity. Users always see (a) where the cursor is and (b) what row + column the cursor maps to, without moving the eyes.

---

## Alert banners

Persistent (non-toast) alerts use the `[role="alert"]` element with a left accent and one or more CTAs.

### Markup contract

```html
<div role="alert" aria-live="polite"
     class="flex items-start gap-3 rounded-card border-l-4 border-l-warning
            border-y border-r border-y-warning/30 border-r-warning/30
            bg-warning/5 px-4 py-3 shadow-card">
  <span class="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center
               rounded-full bg-warning/15 text-warning">
    <svg><!-- alert-triangle --></svg>
  </span>
  <div class="min-w-0 flex-1">
    <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span class="text-sm font-semibold text-foreground">Title</span>
      <span class="...">P2 · degraded</span>
      <span class="text-xs text-muted-foreground">subtitle / inline meta</span>
    </div>
    <div class="mt-1 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
      meta (started · escalation · oncall)
    </div>
  </div>
  <div class="flex shrink-0 items-center gap-2">
    <button>Acknowledge</button>
    <button>View incident →</button>
    <button aria-label="Chiudi banner">×</button>
  </div>
</div>
```

### Variants

- `warning` (P2 incidents, degraded performance) — `border-l-warning`
- `danger` (P1 incidents, security breaches) — `border-l-danger` + `bg-danger/5`
- `info` (announcements, planned maintenance) — `border-l-info` + `bg-info/5`
- `success` (resolved, all clear) — `border-l-success` + `bg-success/5`

### Rules

- Always at least 1 CTA (Acknowledge / View / Dismiss).
- Dismiss button optional but recommended for non-blocking alerts.
- Auto-escalation tracking (e.g. "auto-escalation to P1 in 4m if not acknowledged") goes in the second meta line.

---

## Reference implementation

- CSS: `code_examples/src/styles/hover-affordance.css` (canonical) + `@heuresys/ui/src/styles/hover-affordance.css` (mirror).
- React: `@heuresys/ui/banner.tsx` (extended with `actions` prop) + `@heuresys/ui/data-table.tsx` (extended with `enableCrossHair`).
- Canonical prototype: `ux-design/prototypes/superuser-system-health.html`
