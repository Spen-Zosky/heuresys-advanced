# 08 — Footer Specification

## Mandatory footer structure

The left area of the footer must include:

```text
FOOTER — Left Area
├── © Current Year
├── Heuresys.com SVG logo
│   └── clickable → opens Heuresys website
└── Social icons
    ├── LinkedIn   → clickable
    ├── GitHub     → clickable
    ├── X/Twitter  → clickable
    └── Facebook   → clickable
```

Visual model:

```text
© 2026 | [Heuresys.com SVG logo] | [LinkedIn icon] [GitHub icon] [X icon] [Facebook icon]
```

## Icon-only social links

LinkedIn, GitHub, X/Twitter and Facebook must be rendered as SVG/icon-only links, not as extended text labels.

Each social icon must be:

- SVG-based.
- Clickable.
- Monochrome/outline or theme-consistent.
- Accessible with `aria-label`.
- Opened safely as an external link.
- Styled through global theme tokens.

Example:

```tsx
<a
  href="https://www.linkedin.com/company/heuresys"
  target="_blank"
  rel="noopener noreferrer"
  aria-label="Open Heuresys on LinkedIn"
>
  <Linkedin className="h-4 w-4" />
</a>
```

## Dynamic footer elements

Footer may also include dynamic operational/context elements:

- Current year.
- App version.
- Environment.
- Tenant context.
- Last data refresh.
- System status.

## Footer persistence

The Footer is persistent, full width and must not change when the Sidebar collapses or expands.

## Architectural statement

The footer left area contains the copyright notice with the current year, the clickable Heuresys.com SVG logo linking to the official website, and clickable SVG/icon-only social links for LinkedIn, GitHub, X/Twitter and Facebook. These elements remain fixed within the persistent footer and inherit visual styling from the global theme.
