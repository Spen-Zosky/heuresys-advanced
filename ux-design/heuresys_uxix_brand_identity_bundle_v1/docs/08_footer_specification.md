# 08 — Footer Specification

## Mandatory footer structure — non-negotiable

Every Heuresys surface (dashboard, ESS, landing, login, embedded reports) must render a persistent footer. The **left area is fixed** across all surfaces; the right area is context-specific (build info, environment, runtime metrics, etc.).

### Left area — fixed composition (canonical order)

```text
FOOTER — Left Area (FIXED — every surface)
├── © Current Year                  ← copyright symbol + dynamic year
├── heuresys.com                    ← clickable text link → https://www.heuresys.com
└── Social icons (outlined, in this order):
    ├── LinkedIn   → clickable
    ├── GitHub     → clickable
    ├── Discord    → clickable
    ├── Facebook   → clickable
    └── X (Twitter) → clickable
```

Visual model:

```text
© 2026 · heuresys.com · [LinkedIn] [GitHub] [Discord] [Facebook] [X]
```

### Right area — context-specific (variable)

Examples per surface:

```text
Dashboard SUPERUSER  → app version · build SHA · runtime · DB pool · tunnel status · clock
Dashboard tenant     → app version · environment · tenant code · last refresh
ESS portal           → app version · environment
Landing page         → (empty, or single privacy/terms link)
Login page           → (empty)
```

## Icon-only social links

LinkedIn, GitHub, Discord, Facebook and X (Twitter) must be rendered as **outlined SVG/icon-only** links, never as extended text labels.

Each social icon must be:

- SVG-based, outlined stroke style (consistent with Lucide / Tabler icon family).
- Clickable, opening in a new tab.
- Monochrome by default, inheriting `currentColor` from theme tokens.
- Accessible with an explicit `aria-label`.
- Opened safely as an external link (`target="_blank"` + `rel="noopener noreferrer"`).
- Sized at `h-4 w-4` inside a `h-7 w-7` hit-target wrapper (≥ 24px tap area).

Example:

```tsx
<a
  href="https://www.linkedin.com/company/heuresys"
  target="_blank"
  rel="noopener noreferrer"
  aria-label="Open Heuresys on LinkedIn"
  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
>
  <Linkedin className="h-4 w-4" />
</a>
```

## heuresys.com link

The text link `heuresys.com` is clickable and points to `https://www.heuresys.com` (the public marketing site). It is rendered as a plain text link (not the SVG wordmark — that lives in headers and login pages). Styling:

- Inherits `text-muted-foreground` from theme.
- On hover → `text-foreground` (no underline by default; underline appears only on hover for tighter visual).
- Opens in a new tab with the same `target="_blank"` + `rel="noopener noreferrer"` safety rules as the social links.

## Dynamic year

The copyright year MUST be sourced from runtime, not hardcoded:

```tsx
const currentYear = new Date().getFullYear();
```

Hardcoded years in the source are forbidden — they rot at year-end and create cross-surface inconsistencies.

## Footer persistence

The Footer is persistent, full width, and must not change when the Sidebar collapses or expands. It survives all module navigation transitions inside the dashboard shell.

## Architectural statement

The footer left area is fixed across every Heuresys surface: it contains the copyright notice with the current year, the clickable `heuresys.com` text link to the public website, and five clickable outlined SVG/icon-only social links (LinkedIn, GitHub, Discord, Facebook, X) in that exact order. These elements remain immutable within the persistent footer and inherit visual styling from the global theme. The right area of the footer is context-specific and varies per surface but never modifies the left composition.
