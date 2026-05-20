# 07 — Sidebar Specification

## Mandatory behavior

The Sidebar must be:

- Persistent within the Body area.
- Constrained between Header and Footer.
- Independently scrollable when navigation is long.
- Collapsible and expandable.
- Able to contain grouped navigation items organized as collapsible tree sections.
- Independent from Header and Footer layout.

## Two distinct control levels

```text
Sidebar controls
├── Sidebar collapse / expand icon
│   └── Controls the width of the entire sidebar
│
└── Tree group open / close icons
    └── Control the visibility of items inside each navigation group
```

These states must be managed separately.

```text
sidebarCollapsed: true / false

treeGroups:
- organization: open / closed
- positions: open / closed
- performance: open / closed
```

## Expanded sidebar

```text
[ Collapse < ]

▾ Organization
  - Org Chart
  - Org Units
  - Cost Centers

▸ Positions
  - Catalogue
  - Requirements
  - Skills

▾ Performance
  - Objectives
  - KPIs
  - Calibration
```

Expanded sidebar may show:

- Icons.
- Labels.
- Group headings.
- Tree open/close controls.
- Badges/counters/warnings.
- Active route state.

## Collapsed sidebar

```text
[ > ]

[Org icon]
[Positions icon]
[Performance icon]
[Skills icon]
[Analytics icon]
```

Collapsed sidebar may:

- Show compact module icons only.
- Hide or abbreviate labels.
- Hide group titles.
- Expose tooltips or flyouts.
- Preserve tree state internally without rendering the full tree.

## Sidebar scroll behavior

If the sidebar navigation is longer than available height, the internal sidebar content must scroll under the header and above the footer.

```text
Header: fixed
Footer: fixed
Sidebar content: independent vertical scroll
Main content: independent vertical scroll
```

## Header/Footer independence

When the sidebar collapses/expands:

- Header remains unchanged.
- Footer remains unchanged.
- Only Body grid columns change.
- Main content adapts to remaining width.

## Dynamic sidebar elements

The sidebar must support:

- Active selected module.
- Visible modules by permissions.
- Enabled modules by tenant.
- Badges and counters.
- Warning indicators.
- Disabled/unavailable items.
- Collapsed state persistence.
- Tree group state persistence.

## Architectural statement

The sidebar includes a dedicated control for collapsing or expanding the whole sidebar. Navigation groups inside the sidebar are collapsible tree sections with separate open/close icons. Sidebar-level collapse state and tree-group expansion state are independent and must not affect Header or Footer layout.

---

## State management — collapse / expand persistence

The sidebar collapse state is driven by a `data-sidebar` attribute on `<body>`, NOT by a React state isolated to the sidebar component. This allows the surrounding shell grid to react via plain CSS.

### Markup contract

```html
<body data-sidebar="collapsed">  <!-- or no attribute when expanded -->
  <div data-shell="grid" style="grid-template-columns: 260px 1fr !important;">
    <aside>...</aside>
    <main>...</main>
  </div>
</body>
```

### Behavior

- **Toggle**: clicking `#js-sidebar-toggle` adds/removes the `data-sidebar="collapsed"` attribute on `<body>` and updates the grid column inline style via `setProperty('grid-template-columns', '72px 1fr', 'important')` (when collapsed) or `'260px 1fr'` (when expanded).
- **Persistence**: state stored in `localStorage` under `heuresys-sidebar` (`"collapsed"` or `"expanded"`).
- **Hydration**: saved state applied on page load before first paint.
- **Icon swap**: the toggle button contains two SVGs (`.sidebar-icon-collapse` + `.sidebar-icon-expand`); CSS swaps visibility via `body[data-sidebar="collapsed"] .sidebar-icon-collapse { display: none }` + reverse.

### Why inline style + `!important`

Chrome's `transition: grid-template-columns` has a partial-support quirk that prevents layout updates from committing on subsequent class changes. Setting the inline style with `!important` via `setProperty(...)` bypasses this entirely. The classic Tailwind `grid-cols-[260px_1fr]` class is therefore **not** used on this element — only the data attribute + inline style.

---

## Group toggles — `aria-expanded` pattern

Each navigation group (Platform / Database / Administration / Diagnostics / …) has a clickable header that toggles the visibility of its children.

### Markup contract

```html
<div class="sidebar-group" data-group="platform">
  <button type="button" data-group-toggle="platform" aria-expanded="true"
          class="sidebar-group-toggle ...">
    <span>Platform</span>
    <svg data-group-chevron class="h-3 w-3 transition-transform">...</svg>
  </button>
  <ul class="sidebar-group-content ...">
    <li>...</li>
    ...
  </ul>
</div>
```

### Behavior

- **Toggle**: click on the `[data-group-toggle="X"]` button flips its `aria-expanded` between `"true"` and `"false"`.
- **CSS-driven visibility**:
  ```css
  .sidebar-group-toggle[aria-expanded="false"] + .sidebar-group-content { display: none; }
  .sidebar-group-toggle[aria-expanded="false"] [data-group-chevron]    { transform: rotate(-90deg); }
  ```
  No JS mutation on the `<ul>` itself.
- **Persistence**: per-group state is stored in `localStorage` under `heuresys-sidebar-groups` as a JSON object `{ "platform": true, "database": false, ... }`. Default for new groups: `true` (expanded).

---

## Sticky first column override

Tables with a sticky first column (e.g. RBAC permissions matrix) require explicit overrides because `bg-card` on the sticky cell occludes row-hover backgrounds inherited from the `<tr>`.

```css
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

This is **part of the universal hover-affordance CSS** (`code_examples/src/styles/hover-affordance.css`). It applies globally; no per-table opt-in required.

---

## DB Supervisor sidebar entry — special variant

The DB Supervisor entry is a **callout-style sidebar item** that signals it opens a dedicated multi-tab page covering granular DBMS object management.

### Markup contract

```html
<a href="#" class="nav-link flex items-center justify-between gap-2
                   rounded-control border border-palette-2/30 bg-palette-2/5
                   px-2 py-2 text-sm font-medium text-foreground
                   transition hover:bg-palette-2/10 hover:border-palette-2/50">
  <span class="flex min-w-0 items-center gap-2">
    <svg class="h-4 w-4 shrink-0 text-palette-2"><!-- DB icon --></svg>
    <span class="nav-label truncate">DB Supervisor</span>
  </span>
  <span class="nav-aux inline-flex items-center gap-0.5 rounded-sm bg-palette-2/15
               px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase
               tracking-wider text-palette-2"
        title="Apre pagina con tabs dedicate per ogni oggetto DBMS">
    <svg class="h-2.5 w-2.5"><!-- tabs glyph --></svg>
    tabs
  </span>
</a>

<!-- Sub-tree preview of DB Supervisor tabs (12 DBMS object types) -->
<ul class="sidebar-subtree mt-1 ml-3 space-y-0.5 border-l border-border/60 pl-2.5">
  <li><a>Schemas</a></li>
  <li><a>Tables</a></li>
  <li><a>Views &amp; MViews</a></li>
  <li><a>Indexes</a></li>
  <li><a>Functions &amp; Proc.</a></li>
  <li><a>Triggers</a></li>
  <li><a>Sequences</a></li>
  <li><a>Constraints &amp; FKs</a></li>
  <li><a>Roles &amp; Grants</a></li>
  <li><a>Extensions</a></li>
  <li><a>Connection Pools</a></li>
  <li><a>Backups &amp; PITR</a></li>
  <li><a>Vacuum &amp; Bloat</a></li>
</ul>
```

### Rules

- **Color**: uses `palette-2` (cyan) as accent, NOT `primary` — signals "infrastructure / DBA tooling" semantic distinct from generic platform navigation.
- **Badge**: a `tabs` chip indicates the entry opens a multi-tab page. Tooltip clarifies via `title`.
- **Sub-tree preview**: 12 hardcoded sub-items mirror the tabs of the dedicated DB Supervisor page. Hidden when sidebar is collapsed (via `.sidebar-subtree` class).
- **Singleton**: the DB Supervisor entry lives inside the **Database** sidebar group, alone. Never paired with other items in the same group.

---

## Sidebar-internal CSS classes

Three semantic class names are reserved for the sidebar markup. Do not repurpose them.

| Class | Purpose | Hidden when sidebar collapsed? |
|---|---|---|
| `.sidebar-section-label` | "Navigation" label at the top toolbar | yes |
| `.sidebar-group-toggle` | Group header `<button>` | yes |
| `.sidebar-group-content` | Group `<ul>` children container | no (icons stay visible) |
| `.sidebar-subtree` | DB Supervisor (or other) sub-tree `<ul>` | yes |
| `.sidebar-footer-card` | Build info card at sidebar bottom | yes |
| `.nav-link` | Each `<a>` nav item | no (centers on collapse) |
| `.nav-label` | Text span inside `<a>` | yes |
| `.nav-aux` | Badge/dot/count span inside `<a>` | yes |

CSS rules for collapsed visibility live in `code_examples/src/styles/hover-affordance.css` (universal sheet) under the `body[data-sidebar="collapsed"] aside …` block.

---

## Accessibility patterns

- The toggle button has `aria-label="Comprimi/espandi sidebar"` + `aria-pressed` set to `"true"` (collapsed) or `"false"` (expanded).
- Each group toggle has `aria-expanded` (true/false) reflecting its state; the content `<ul>` does not require `id` linking because the adjacent-sibling CSS selector handles visibility.
- Each nav-link has `aria-current="page"` when active.
- The DB Supervisor "tabs" chip is decorative; the `<a>` itself has `title="Apre pagina con tabs dedicate per ogni oggetto DBMS"` to convey the multi-tab nature to assistive tech.
- When collapsed, nav-link icons remain visible. Users can rely on browser tooltips (set `title="<label>"` on each `<a>` when collapsed) or hover flyouts (future enhancement).
- Sub-trees and group headers are hidden via `display: none` (not `visibility: hidden` nor `opacity: 0`) so screen readers skip them entirely when collapsed.

---

## Reference implementation

- React: `@heuresys/ui/dashboard/DashboardSidebar.tsx` + `dashboard/GroupToggle.tsx` + `dashboard/DbSupervisorSidebarEntry.tsx`
- Bundle example: `code_examples/src/components/dashboard/Sidebar.tsx` + `DBSupervisorSidebar.tsx` + `GroupToggle.tsx`
- Live showcase: `apps/showcase/src/app/showcase/sidebar/page.tsx`
- Canonical prototype: `ux-design/prototypes/superuser-system-health.html`
