# Interaction Register Template

Use this template to register a new interactive pattern in the Heuresys design system. One entry per pattern. Append to a project-level `INTERACTION_REGISTER.md` file (do not modify this template).

---

## Pattern entry

### Identity

- **ID**: `INT-{NNN}` (sequential)
- **Name**: `<short kebab-case identifier>`
- **Status**: `draft` | `ratified` | `deprecated`
- **Ratified date**: `YYYY-MM-DD`
- **ADR reference**: `ADR-NNNN` (if any)

### Surface

- **Target element(s)**: e.g. `article`, `[role="alert"]`, `tbody tr`, `.log-line`, `<button id="js-X">`
- **Page types involved**: e.g. Dashboard shell, System Health, Tenant detail
- **Scope**: global (all pages) | scoped (specific page type) | opt-in (per-instance prop)

### Trigger

- **Event(s)**: `mouseenter` / `mouseleave` / `click` / `keydown` / `focus` / `Escape` / `⌘K`
- **Modifier keys** (if any): Cmd/Ctrl/Shift/Alt
- **Pointer device requirement**: any | mouse-only | touch-supported

### Behavior

- **Visual change**: list of CSS properties affected (`border-color`, `background-color`, `box-shadow`, `transform`, `display`)
- **DOM mutation**: classes added/removed, attributes set/toggled, elements inserted
- **JS side-effect** (if any): localStorage write, fetch, dispatch event

### ARIA + accessibility

- **ARIA attributes managed**: `aria-expanded` / `aria-selected` / `aria-haspopup` / `aria-controls` / `aria-pressed` / `aria-current`
- **Keyboard navigation**: Tab order, Enter/Space activation, Arrow keys, Escape dismiss
- **Focus management**: trapped | restored | move-to-X
- **Screen reader announcement**: live region usage (`aria-live`), label sources

### Persistence

- **localStorage key** (if any): `heuresys-<scope>`
- **Value format**: scalar | JSON | enum
- **Default fallback**: behavior on first load / corrupted value
- **Cross-tab sync**: yes (via `storage` event) | no

### Animation

- **Duration**: `Nms`
- **Easing**: `ease` | `ease-out` | `cubic-bezier(...)`
- **Properties animated**: list
- **Reduced-motion fallback**: animation disabled | replaced with instant cue

### Browser support

- **Minimum version**: Chrome NNN+ / Firefox NNN+ / Safari NNN+
- **Known quirks**: list browsers with partial/buggy behavior + workaround
- **Polyfill required?**: no | yes (link)

### Tokens consumed

- List `--*` CSS variables referenced (e.g. `--primary`, `--accent`, `--palette-N`)

### Implementation

- **CSS sheet**: `code_examples/src/styles/<file>.css`
- **JS helper**: `code_examples/src/lib/<file>.ts`
- **React component**: `@heuresys/ui/<path>/<Component>.tsx`
- **Bundle example**: `code_examples/src/components/<path>/<Component>.tsx`

### Verification

- **Unit test**: path + test name
- **Visual test (Storybook/Showcase)**: path + story name
- **E2E test (Playwright)**: path + test name
- **Manual QA checklist**: list (3-7 items)

### Related patterns

- Cross-link to other INT-NNN entries that compose with or extend this one

---

## Canonical examples (already registered)

The following patterns are pre-ratified as part of the SUPERUSER prototype promotion (2026-05-20):

| ID | Name | Surface | Doc reference |
|---|---|---|---|
| INT-001 | universal-hover-affordance | `article`, `[role="alert"]`, `tbody tr`, `.log-line`, feed `<li>` | docs/13 |
| INT-002 | magnifier-hint | `article` | docs/13 |
| INT-003 | table-cross-hair | `tbody td`, `thead th` | docs/13 + docs/16 |
| INT-004 | sticky-column-row-hover-override | `tbody tr:hover > td.sticky` | docs/07 |
| INT-005 | sidebar-collapse-expand | `body[data-sidebar]`, `[data-shell="grid"]` | docs/07 |
| INT-006 | sidebar-group-toggle | `[data-group-toggle][aria-expanded]` | docs/07 |
| INT-007 | palette-dropdown-listbox | `#js-palette-trigger`, `#js-palette-menu` | docs/06 |
| INT-008 | theme-toggle-html-dark | `#js-theme-toggle`, `html.dark` | docs/06 |
| INT-009 | command-palette-trigger | `⌘K` button | docs/06 |
| INT-010 | breadcrumb-nav | `<nav aria-label="Breadcrumb">` | docs/06 |
| INT-011 | user-identity-card | header right area | docs/06 |
| INT-012 | db-supervisor-callout | sidebar special variant | docs/07 + docs/16 |
| INT-013 | alert-banner-cta | `[role="alert"]` with CTAs | docs/13 |
| INT-014 | time-range-segmented-control | page header right area | docs/16 |
| INT-015 | live-log-stream-tailing | `<ol>` with `.log-line` items + `aria-live` | docs/16 |
