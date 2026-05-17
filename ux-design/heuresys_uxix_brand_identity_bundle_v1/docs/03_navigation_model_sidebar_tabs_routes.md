# 03 — Navigation Model: Sidebar, Tabs and Routes

## Navigation hierarchy

```text
Level 1 — Dashboard Shell
Header / Sidebar / Footer / Content Area

Level 2 — Sidebar Navigation
Selects the main business domain or module

Level 3 — Top Tabs
Selects sub-pages, views or operational sections within that module

Level 4 — Page Content
Tables, cards, forms, charts, workflows, detail panels
```

## Core navigation model

```text
Sidebar selection → Module route
Module route → Module page
Module page → Optional top tabs
Top tab → Specific component tree
Component tree → DOM subtree rendered by browser
```

## Sidebar purpose

The Sidebar exposes primary modules or business domains. It must not become a long flat list of every possible page.

Examples of sidebar modules:

- Executive Dashboard.
- Organization.
- Positions.
- Skills.
- Performance.
- Learning.
- Workforce Intelligence.
- Analytics.
- Administration.

## Top tabs purpose

Top tabs expose secondary navigation inside a selected module.

Example:

```text
Sidebar: Positions
Top Tabs: Catalogue | Requirements | Skills | KPIs | Career Paths | Criticality
```

## Tabs are optional

A module page may have no tabs.

```text
Sidebar selection → Module page → Direct view rendering
```

Example:

```text
/dashboard/executive
```

No tabs are required if the page has a single primary purpose.

## Why sidebar + tabs reduces sidebar length

Without hierarchy:

```text
- Position Catalogue
- Position Requirements
- Position Skills
- Position KPIs
- Organization Chart
- Organizational Units
- Cost Centers
- Skill Catalogue
- Skill Gap Analysis
- Performance Cycles
- Objectives
- KPI Assessments
```

With hierarchy:

```text
Sidebar
- Positions
- Organization
- Skills
- Performance
```

Then local tabs provide detail:

```text
Positions: Catalogue | Requirements | Skills | KPIs
Organization: Org Chart | Org Units | Cost Centers
Performance: Cycles | Objectives | KPIs | Calibration
```

## Route structure example

```text
src/app/dashboard/
├── layout.tsx
├── executive/
│   └── page.tsx
├── positions/
│   ├── layout.tsx
│   ├── catalogue/page.tsx
│   ├── requirements/page.tsx
│   ├── skills/page.tsx
│   └── kpis/page.tsx
└── organization/
    ├── layout.tsx
    ├── structure/page.tsx
    ├── units/page.tsx
    └── cost-centers/page.tsx
```

## Architectural statement

The sidebar should expose only primary modules or business domains. Related sub-pages, operational views and contextual sections should be placed inside the selected module through top tabs, local navigation or internal page sections.
