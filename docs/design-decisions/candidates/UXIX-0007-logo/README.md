# UXIX-0007 — Logo candidates

Three exploratory logo candidates for the Heuresys brand identity v1. All SVG use `stroke="currentColor"` / `fill="currentColor"` so they inherit color from CSS (compatible with palette switcher + dark mode).

## Candidates

| ID | Concept | Symbol viewBox | Full viewBox | Wordmark weight |
|----|---------|----------------|--------------|-----------------|
| A | Hex node mark — hexagonal frame with internal 3-node constellation (skill + role + capability) | 48×48 | 220×48 | 700 (bold), letter-spacing −0.5 |
| B | H ladder mark — rounded square with custom H letterform implying skill-progression rungs | 48×48 | 220×48 | 500 (medium), letter-spacing 0 |
| C | Triangle constellation mark — circle scaffold + three nodes forming a triangle (people / role / capability) | 48×48 | 220×48 | 300 (light), letter-spacing 1, all-lowercase |

## How to review

1. Open `/showcase` in the running webapp (`pnpm dev` in `apps/web`); navigate to `/showcase/logo` (route to be added in the next iteration of this session — pending).
2. View each candidate in light + dark theme; confirm `currentColor` inheritance.
3. Render at sidebar-collapsed scale (24×24 effective for symbol) and at header scale (32px height) to verify legibility.
4. Capture choice via `prompts/DESIGN_DECISION_CAPTURE_PROMPT.md` → update `DECISION_REGISTER.md` row UXIX-0007 to `Accepted` + create `ADR-0007-heuresys-logo-system.md`.

## Files

- `heuresys-logo-A-symbol.svg` — 48×48 symbol mark only
- `heuresys-logo-A-full.svg` — 220×48 symbol + wordmark
- `heuresys-logo-B-symbol.svg`
- `heuresys-logo-B-full.svg`
- `heuresys-logo-C-symbol.svg`
- `heuresys-logo-C-full.svg`

## After Acceptance

The chosen candidate's symbol + full files are promoted to `D:\ux-design-shared\ui\src\brand\` as the canonical assets, then derivative variants (horizontal / monochrome / light / dark) and the favicon set (favicon.ico, favicon.svg, apple-touch-icon.png, icon-192.png, icon-512.png, manifest.webmanifest) are generated. The non-chosen candidates remain here as historical record (no deletion per register Rule 1).
