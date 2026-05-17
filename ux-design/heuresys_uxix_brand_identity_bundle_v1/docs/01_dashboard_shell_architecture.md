# 01 — Dashboard Shell Architecture

## Baseline architecture

The Heuresys dashboard is composed of:

```text
Dashboard Shell
├── Header
├── Body
│   ├── Sidebar
│   └── Main Content Window
└── Footer
```

The shell is persistent. The main content window renders the selected page, module or tab view.

## Fixed viewport shell

The dashboard must use a fixed viewport shell:

- Header remains visible.
- Footer remains visible.
- Sidebar remains constrained between header and footer.
- Main content remains constrained between header and footer.
- Sidebar content scrolls independently when long.
- Main content scrolls independently when long.

Recommended layout:

```text
┌──────────────────────────────────────────────┐
│ HEADER - persistent / full width             │
├───────────────┬──────────────────────────────┤
│ SIDEBAR       │ MAIN CONTENT WINDOW          │
│ independent   │ independent                  │
│ scroll        │ scroll                       │
├───────────────┴──────────────────────────────┤
│ FOOTER - persistent / full width             │
└──────────────────────────────────────────────┘
```

## Critical layout rule

Header and Footer must not change when the Sidebar is collapsed or expanded. Only the Body grid columns may change.

```text
Sidebar expanded:  body grid = 280px + 1fr
Sidebar collapsed: body grid = 72px + 1fr
```

## Recommended Tailwind layout model

```tsx
<div className="h-screen grid grid-rows-[64px_1fr_40px] overflow-hidden">
  <header className="border-b px-6 flex items-center">
    Header
  </header>

  <div className="grid grid-cols-[280px_1fr] min-h-0">
    <aside className="border-r min-h-0 overflow-y-auto">
      Sidebar navigation
    </aside>

    <main className="min-h-0 overflow-y-auto p-6">
      {children}
    </main>
  </div>

  <footer className="border-t px-6 flex items-center">
    Footer
  </footer>
</div>
```

## Architectural statement

The Heuresys dashboard shell is a persistent, full-viewport application frame. Header and Footer are persistent full-width regions. The Body contains a collapsible Sidebar and a Main Content Window, both independently scrollable within the space between Header and Footer.
