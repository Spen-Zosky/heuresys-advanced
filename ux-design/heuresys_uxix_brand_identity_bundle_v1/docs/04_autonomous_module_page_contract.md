# 04 — Autonomous Module Page Contract

## Principle

Each page may be designed autonomously and with full focus on its business purpose, then connected to the dashboard through routing and a registry.

A page must not be designed as "part of the sidebar". It must be designed as an autonomous business view that the sidebar can activate.

## Flow

```text
1. Design the page independently.
2. Build its component tree.
3. Place it under the correct module.
4. Expose it through a route.
5. Register that route in the Sidebar or in module tabs.
```

## Conceptual model

```text
Autonomous Page / View
        ↓
Module
        ↓
Route
        ↓
Sidebar selection or Top Tab
        ↓
Main Content Window
```

## Module structure

```text
src/modules/[module-name]/
├── [module-name].module.ts
├── [module-name].tabs.ts
└── views/
    ├── FirstView.tsx
    ├── SecondView.tsx
    └── ThirdView.tsx
```

## Route wrappers

```text
src/app/dashboard/[module-name]/
├── layout.tsx
├── first-tab/page.tsx
├── second-tab/page.tsx
└── third-tab/page.tsx
```

## Page rules

Each autonomous page/view:

- Must be self-contained.
- Must not duplicate header, sidebar or footer.
- Must assume it renders inside the main content window.
- May contain internal sections, cards, tables, filters, forms, charts, detail panels and local workflows.
- Should receive data through props, API calls, hooks or loaders.
- Should avoid hardcoded dashboard dependencies.
- Should use shared design tokens and UI components.

## Examples

Autonomous view:

```text
PositionCatalogueView
```

Connected later as:

```text
Sidebar: Positions
Top Tab: Catalogue
Route: /dashboard/positions/catalogue
```

A page without tabs:

```text
Sidebar: Executive Dashboard
Route: /dashboard/executive
View: ExecutiveDashboardView
```

## Architectural statement

Each dashboard module is developed as an autonomous frontend module composed of a module manifest, optional tab configuration and independent view components. The sidebar is generated from a central module registry and links to the default route of each module.
