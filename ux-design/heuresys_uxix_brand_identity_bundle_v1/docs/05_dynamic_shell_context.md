# 05 — Dynamic Shell Context

## Principle

Header, Sidebar and Footer are persistent shell regions. They must support both fixed and dynamic elements.

Dynamic elements may be resolved from:

- Current page metadata.
- Authenticated user/session.
- Tenant context.
- Permissions.
- Active modules.
- Theme settings.
- Palette settings.
- Language settings.
- Environment.
- Notification state.
- Runtime application state.

## Dynamic context layers

### 1. Page context

Used for header, breadcrumbs and local actions.

```text
- Page title
- Page subtitle
- Breadcrumb
- Current module
- Current tab
- Primary page action
- Secondary page actions
```

### 2. User context

Used for header, permissions and user menu.

```text
- Logged-in user
- Avatar/SVG user mark
- Role
- Permission profile
- Language preference
- Notification state
```

### 3. Tenant context

Used across header, sidebar, footer and content.

```text
- Tenant name
- Tenant code
- Industry profile
- Enabled modules
- Subscription/licensing status
- Current operating period
```

### 4. Runtime context

Used for UI state.

```text
- Sidebar collapsed/expanded
- Tree groups open/closed
- Active route
- Active theme
- Active palette
- Active language
- Environment
- App version
- Last data refresh
```

## Fixed and dynamic shell map

```text
Header
├── Fixed: hamburger, Heuresys logo, switchers, user menu container
└── Dynamic: page title, breadcrumb, tenant, user, notifications, actions

Sidebar
├── Fixed: structural navigation container, collapse control
└── Dynamic: active state, permission-filtered modules, badges, tree state

Footer
├── Fixed: copyright, Heuresys.com logo, social icons
└── Dynamic: current year, environment, version, tenant, system status
```

## Architectural statement

The dashboard shell contains fixed identity/navigation elements and dynamic context-aware elements. Dynamic elements are resolved from the current page, authenticated user, tenant, permissions, settings, environment and runtime state.
