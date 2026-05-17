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
