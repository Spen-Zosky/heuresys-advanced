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

### Default brand logo — non-negotiable

The **canonical, default Heuresys logo** is the **two-color wordmark** `heuresys-wordmark.svg`:

- Font family: **Exo 2** (weight 700)
- Letter-spacing: `-0.5px`
- Color split (two-color identity):
  - Primary blue `hsl(221, 83%, 53%)` → letters `heures` and `s`
  - Accent purple `#a855f7` → middle letter `y`
- The single colored `y` is the **brand differentiator** — never change its color, position, or weight relative to the rest of the wordmark.
- The `y` letter alone (`heuresys-mark.svg`) is the **symbol mark**, used for favicons, collapsed sidebar, and loading screens.

**This default applies to every surface unless explicitly overridden:**

```text
Default surfaces (use heuresys-wordmark.svg):
- Dashboard header (light + dark theme)
- Login page
- Landing pages
- Marketing material
- ESS portal header
- Authenticated initial page
- Embedded reports (web view)
- Storybook / showcase
```

The two-color wordmark is **theme-agnostic** — the primary blue and accent purple both retain WCAG-acceptable contrast on both light (`#ffffff`) and dark (`hsl(224 28% 7%)`) backgrounds, so a single canonical asset serves both themes.

Monochrome variants are **only** used when the default cannot render correctly (single-color print, fax, faxed PDF, etc.) — they are **fallbacks**, not alternatives.

### Variant inventory

```text
assets/logo/
├── heuresys-wordmark.svg                        ← DEFAULT (two-color, Exo 2 700)
├── heuresys-mark.svg                            ← symbol (purple "y" only, 32×32)
├── heuresys-wordmark-monochrome-dark.svg        ← single-color white, fallback for dark backgrounds
└── heuresys-wordmark-monochrome-light.svg       ← single-color blue, fallback for monochrome print
```

Usage matrix:

```text
heuresys-wordmark.svg                    → DEFAULT for every UI surface
heuresys-mark.svg                        → favicon, collapsed sidebar, app icon, loading spinner center
heuresys-wordmark-monochrome-dark.svg    → fallback only: dark bg where rendering forces single color
heuresys-wordmark-monochrome-light.svg   → fallback only: light bg in monochrome print / PDF / fax
```

Selection rule:

```text
if (surface_supports_full_color) → heuresys-wordmark.svg          (always)
elif (background_is_dark)        → heuresys-wordmark-monochrome-dark.svg
else                             → heuresys-wordmark-monochrome-light.svg
```

Primary format:

```text
SVG
```

SVG is scalable, lightweight, sharp on all screens and embeds its color identity via a scoped `<style>` block — so it survives copy-paste, theme switches, and CSS resets without depending on `currentColor`.

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
