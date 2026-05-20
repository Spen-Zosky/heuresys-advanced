# Assets Directory

This directory contains the **canonical Heuresys brand assets** — promoted from legacy `heuresys-evo/services/app/public/brand/` on 2026-05-19 and ratified as the official identity for `heuresys-advanced`.

The placeholder SVGs that previously lived here have been replaced by the production assets listed in `docs/10_graphic_assets_and_icon_system.md` § Logo system.

## Current state — production assets

```
logo/
├── heuresys-wordmark.svg                       ← DEFAULT brand logo (two-color, Exo 2 700)
├── heuresys-mark.svg                           ← symbol (purple "y", 32×32) → favicon source
├── heuresys-wordmark-monochrome-dark.svg       ← single-color white (fallback only)
└── heuresys-wordmark-monochrome-light.svg      ← single-color blue (fallback only)
```

See `docs/10_graphic_assets_and_icon_system.md` for the default-logo doctrine, the variant usage matrix, and the selection rule.

## Rules

- The two-color wordmark (`heuresys-wordmark.svg`) is the **default for every surface**; do not invent new variants without an ADR.
- Use SVG as primary source format. Optimize before production use.
- Generate favicons / app icons from `heuresys-mark.svg` (the symbol), never from the wordmark.
- Record asset changes in the asset register (`templates/ASSET_REGISTER_TEMPLATE.md`).
- Do not modify the color split (`heures` / `y` / `s`) — it is the brand differentiator.
- Monochrome variants are fallbacks, not alternatives. Use them only when full-color rendering is impossible (single-color print, fax, ASCII viewers).
- For any new consumer (showcase, ESS portal, marketing site), inline the default wordmark via SVG `<use>` or copy the file into that consumer's public asset folder — never re-rasterize it to PNG except for OG images and email signatures where SVG is unsupported.
