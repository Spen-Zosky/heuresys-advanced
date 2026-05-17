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
