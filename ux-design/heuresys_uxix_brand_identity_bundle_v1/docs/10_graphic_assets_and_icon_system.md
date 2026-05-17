# 10 — Graphic Assets and Icon System

## Asset system

Graphic resources must be created as part of a governed brand/UI asset system.

```text
Brand Assets
├── Logo system
├── Icon system
├── Favicons / app icons
├── Illustration / visual assets
└── UI design tokens
```

## Logo system

The logo should exist in controlled variants:

```text
logo/
├── heuresys-logo-full.svg
├── heuresys-logo-symbol.svg
├── heuresys-logo-horizontal.svg
├── heuresys-logo-monochrome.svg
├── heuresys-logo-light.svg
└── heuresys-logo-dark.svg
```

Usage:

```text
Full logo          → login page, landing page, documentation
Symbol logo        → collapsed sidebar, favicon base, loading screen
Horizontal logo    → dashboard header
Monochrome logo    → footer, print, PDF reports, governance documents
Light logo         → dark backgrounds
Dark logo          → light backgrounds
```

Primary format:

```text
SVG
```

SVG is scalable, lightweight, sharp on all screens and can inherit colors through CSS.

## Favicon and app icons

Generate:

```text
favicon/
├── favicon.ico
├── favicon.svg
├── apple-touch-icon.png
├── icon-192.png
├── icon-512.png
└── manifest.webmanifest
```

The favicon source should usually be the symbol mark, not the full wordmark.

## Icon library

Adopt a professional outline icon library. Recommended options:

- Lucide React.
- Heroicons.
- Tabler Icons.
- Radix Icons.

For Heuresys, Lucide React is recommended for speed, consistency and React integration.

## Outline icons with dynamic semantic colors

Icon style must remain consistent, but icon color may vary according to semantic status, state and context.

```text
Icon style = outline
Icon shape = fixed and consistent
Icon color = dynamic and semantic
```

Typical mapping:

```text
Neutral / default    → muted/foreground token
Informational        → info token
Success / positive   → success token
Warning / attention  → warning token
Error / critical     → danger token
Disabled / inactive  → disabled token
```

Use `currentColor`:

```svg
stroke="currentColor"
```

or:

```svg
fill="currentColor"
```

## Status vs interaction state

Separate semantic status from interaction state.

Semantic status:

```text
success, warning, error, info, inactive
```

Interaction state:

```text
default, hover, active, focused, selected, disabled
```

## Icon use cases in Heuresys

Semantic icons are useful for:

- Workflow states.
- Approval states.
- Validation results.
- Compliance alerts.
- Risk indicators.
- Readiness levels.
- Critical role flags.
- Data quality issues.
- Notification severity.
- KPI trend direction.

## Caution

Not every icon should be colored. Use semantic color intentionally.

Recommended rule:

```text
Navigation icons           → usually neutral
Action icons               → neutral unless destructive or primary
Status icons               → semantic color
Alert/notification icons   → semantic color
Decorative icons           → neutral or muted
```

## Asset storage

Recommended structure:

```text
src/
├── assets/
│   ├── brand/
│   │   ├── logo/
│   │   ├── favicon/
│   │   └── marks/
│   ├── icons/
│   │   ├── outline/
│   │   └── custom/
│   ├── illustrations/
│   └── patterns/
│
├── components/
│   ├── brand/
│   │   ├── HeuresysLogo.tsx
│   │   └── HeuresysMark.tsx
│   └── ui/
│       ├── Icon.tsx
│       └── AppIcon.tsx
│
public/
├── brand/
├── favicon.ico
├── favicon.svg
├── apple-touch-icon.png
└── icon-512.png
```

## Architectural statement

Heuresys graphic resources are governed brand assets. Logos, favicons, icons and visual marks must be created from controlled SVG sources, stored in a dedicated asset structure, optimized for web usage, and consumed through reusable React components or shared UI components. Icons should follow a monochrome outline style and inherit color from global design tokens.
