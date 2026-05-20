# 06 — Header Specification

## Mandatory header structure

```text
HEADER
├── Left Area
│   ├── Hamburger menu / global context launcher
│   └── Heuresys SVG logo
│
└── Right Area
    ├── Language switcher: IT / EN
    ├── Palette switcher: four palette color boxes
    ├── Theme switcher: Dark / Light
    └── Logged-user SVG/avatar menu
        └── Logout
```

Visual model:

```text
[☰] [Heuresys SVG Logo]                       [IT/EN] [Palette boxes] [Dark/Light] [User]
```

## Header persistence

The Header is persistent, full width and must not change when the Sidebar collapses or expands.

## Left area

### Hamburger menu

The hamburger menu is a fixed header control. It may act as a global context launcher.

It may expose:

- Dashboard Home.
- Tenant Console.
- Admin Console.
- Analytics Workspace.
- Documentation.
- Help Center.
- Release Notes.
- Data Dictionary.
- API Console.
- Audit Logs.

Some items may open in the current application. Others may open in a new tab/window depending on browser settings.

For external or new-tab links use:

```tsx
target="_blank"
rel="noopener noreferrer"
```

### Heuresys SVG logo

The header must show the Heuresys SVG logo. It may link to the authenticated primary initial page.

## Right area

### Language switcher

Must switch between:

```text
IT ↔ EN
```

The visual representation may use text, compact flags/icons or a segmented control, but must remain professional and accessible.

### Palette switcher

Must be represented by a row of four small colored boxes corresponding to the four characteristic colors of the active palette.

Example:

```text
[■][■][■][■]
```

The palette switcher may open a menu of approved palette variants.

### Theme switcher

Must switch between:

```text
Light mode ↔ Dark mode
```

Use a clear icon pair such as Sun/Moon or equivalent outline icons.

### Logged-user SVG/avatar/logo

The logged-user SVG/avatar/logo must be clickable and open a user menu.

Minimum user menu:

```text
User menu
└── Logout
```

Logout returns the user to the authenticated primary initial page, which is distinct from the public landing page.

## Authenticated primary initial page vs public landing page

```text
Public landing page
= marketing/public website/unauthenticated entry point

Authenticated primary initial page
= application-specific login/access/tenant entry point after logout
```

## Architectural statement

The Heuresys dashboard header is a persistent full-width shell component. Its left area contains the global context hamburger menu and Heuresys SVG logo. Its right area contains language switcher, palette switcher, light/dark theme switcher and logged-user menu. The user menu exposes logout and redirects the user to the authenticated primary initial page, not to the public landing page.

---

## Interactive specification — palette switcher (listbox dropdown)

The palette switcher is a **dropdown listbox** (not a plain cycle button). The anchor button displays the four swatches of the **active palette** plus a chevron; clicking it opens a menu with the available presets.

### Markup contract

```html
<div class="relative" data-palette-menu-root>
  <button
    id="js-palette-trigger"
    type="button"
    aria-haspopup="listbox"
    aria-expanded="false"
    aria-controls="js-palette-menu"
    aria-label="Cambia palette accent (apri menu)"
  >
    <span class="flex gap-0.5">
      <span class="bg-palette-1"></span>
      <span class="bg-palette-2"></span>
      <span class="bg-palette-3"></span>
      <span class="bg-palette-4"></span>
    </span>
    <svg data-palette-chevron>...</svg>
  </button>

  <div id="js-palette-menu" role="listbox" hidden>
    <ul>
      <li>
        <button role="option" data-palette-idx="0" aria-selected="true">
          [4 hardcoded swatches] Default · balanced [check icon]
        </button>
      </li>
      <!-- 3 more options -->
    </ul>
  </div>
</div>
```

### Canonical preset catalogue

Four presets are ratified. Names and HSL values are reserved and may not be redefined locally.

| Idx | Name | HSL (palette-1..4) |
|---|---|---|
| 0 | `Default (balanced)` | `222 80% 50%` · `188 75% 45%` · `262 65% 60%` · `38 90% 55%` |
| 1 | `Cool ocean` | `178 75% 42%` · `195 85% 48%` · `215 85% 55%` · `245 78% 60%` |
| 2 | `Warm sunset` | `0 80% 55%` · `22 92% 55%` · `38 90% 55%` · `52 92% 60%` |
| 3 | `Brand mono` (derived from brand-blue) | `221 83% 35%` · `221 75% 48%` · `221 65% 60%` · `221 55% 72%` |

### Behavior

- **Open**: click on the trigger toggles `hidden` on the menu + `aria-expanded` on the trigger. Chevron rotates `180deg`.
- **Selection**: click on an option calls `html.style.setProperty('--palette-' + (i+1), value)` for each of the four values. `aria-selected` is updated on all options, the check icon is shown only on the active one. The menu closes.
- **Dismiss**: click outside the menu, or `Escape` keypress while the menu is open.
- **Persistence**: the selected index is stored in `localStorage` under the key `heuresys-palette`. On page load, the saved index is re-applied via `applyPalette(idx)` before first paint hand-off.
- **Default fallback**: if the saved value is missing, NaN, or out-of-range, the index defaults to `0` (Default · balanced).

### Anchor button swatches

The four swatches inside the anchor button use `bg-palette-1..4` (i.e. `hsl(var(--palette-N))`). They **automatically update** when the palette CSS variables change — no JS mutation is needed on these swatches.

---

## Interactive specification — theme switcher

The theme switcher is a **single button with two icons** (Sun for light mode, Moon for dark mode); the visible icon is driven by the presence/absence of the `dark` class on the `<html>` element.

### Markup contract

```html
<button id="js-theme-toggle" type="button" aria-label="Alterna tema chiaro/scuro">
  <!-- Sun: visible only in light theme -->
  <svg class="h-4 w-4 dark:hidden"><!-- sun --></svg>
  <!-- Moon: visible only in dark theme -->
  <svg class="hidden h-4 w-4 dark:block"><!-- moon --></svg>
</button>
```

### Behavior

- **Toggle**: click toggles `html.classList.toggle('dark')`. The two SVGs swap automatically via Tailwind `dark:hidden` / `hidden dark:block`.
- **Persistence**: the resolved theme is stored in `localStorage` under the key `heuresys-theme` (`"dark"` or `"light"`).
- **Hydration**: on page load, the saved theme is applied **before** React/markup hydration to avoid FOUC. Tailwind config must use `darkMode: 'class'`.

---

## Interactive specification — command palette trigger

A search/command bar (Mac-style `⌘ K` trigger) lives between the hamburger/logo cluster and the right-area cluster.

### Markup contract

```html
<button type="button" aria-label="Apri command palette"
        class="hidden md:inline-flex h-9 items-center gap-2 ...">
  <svg><!-- search icon --></svg>
  <span>Cerca tenant, log, audit…</span>
  <kbd class="ml-2 font-mono">⌘ K</kbd>
</button>
```

### Behavior

- Visible only at `md+` viewport.
- Click or `Cmd/Ctrl + K` opens the command palette (separate component; see `@heuresys/ui` `<CommandPalette>`).
- Placeholder text is **surface-specific** ("Cerca tenant, log, audit…" on system-health; "Cerca posizioni, persone, skill…" on HR pages).

---

## Breadcrumb pattern

A breadcrumb fragment lives between the logo cluster and the command palette trigger (or wraps to its own line on narrower viewports).

### Markup contract

```html
<nav aria-label="Breadcrumb" class="flex items-center gap-2 text-sm text-muted-foreground">
  <span>Platform</span>
  <svg class="h-3 w-3 opacity-50"><!-- chevron-right --></svg>
  <span class="font-medium text-foreground">System Health</span>
</nav>
```

### Rules

- **Levels**: typically 2 levels (`<Section> / <Page>`), occasionally 3 for nested module views.
- **Active leaf**: the current page is rendered without a link and with `font-medium text-foreground`. Ancestor levels are `text-muted-foreground` and may link back to their landing.
- **Separator**: chevron-right SVG at opacity 50 (no text `/` or `›`).
- **Truncation**: long labels truncate at the segment level with `truncate max-w-[20ch]`.

---

## User identity card (right area)

Replace the bare avatar with a compact identity card that surfaces username + active role.

### Markup contract

```html
<div class="ml-1 flex items-center gap-2 rounded-control border border-border bg-card px-2 py-1.5">
  <span class="relative inline-flex h-7 w-7 items-center justify-center rounded-full bg-palette-3/20 text-xs font-semibold text-palette-3">ES</span>
  <div class="hidden flex-col leading-tight sm:flex">
    <span class="text-xs font-medium text-foreground">enzo.spenuso</span>
    <span class="font-mono text-[10px] uppercase tracking-wider text-warning">SUPERUSER</span>
  </div>
</div>
```

### Rules

- **Role badge color** uses semantic tokens: `text-warning` for `SUPERUSER` / `PLATFORM_ADMIN`, `text-palette-3` for `TENANT_ADMIN`, `text-palette-1` for `HRMS_MANAGER` / `BLUEPRINT_MANAGER`, `text-palette-2` for `MANAGER`, `text-muted-foreground` for `USER` / `READ_ONLY`.
- **Avatar initials** computed from username (first letter of given+surname, fallback to first two letters).
- **Avatar bg color** rotates through `palette-1..4` deterministically based on the user id hash.
- Click opens the user menu (see Architectural statement).

---

## Reference implementation

The canonical implementation of all the above lives in:

- React: `@heuresys/ui/dashboard/DashboardHeader.tsx`
- Bundle example: `code_examples/src/components/dashboard/Header.tsx`
- Live showcase: `apps/showcase/src/app/showcase/header/page.tsx`
- Canonical prototype: `ux-design/prototypes/superuser-system-health.html` (HTML standalone)
