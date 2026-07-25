# Brand v1 — Deferred refinements

Catalog of cosmetic / non-functional improvements identified during brand v1
+ v1.1 patch (sessions S925 + post-tag review 2026-05-20). All items here are
**deferred by explicit user choice** — current brand v1.0 + v1.1 patch is
production-ready as shipped. Pick any of these in a future session when there's
appetite for polish.

- **Baseline state**: `v0.4.0-brand-v1` tag on both `heuresys-advanced` and
  `ux-design-shared`, plus v1.1 patch commits (`1822c25`..`7ee9a1f` heuresys-
  advanced, `9efa6bd`..`572b53f` ux-design-shared).
- **Deferred since**: 2026-05-20.

## Social media kit refinements

Source: visual review of `ux-design-shared/ui/src/assets/brand/social/og-
image-1200x630.png` + companion Twitter/LinkedIn variants. Layout works for
share contexts but has 5 polish points.

| # | Refinement | Effort | Effect |
|---|---|---|---|
| SK-1 | Add `HeuresysMark` ("y" gigante) as decorative element on the right side of the social images — balances the bottom whitespace + adds brand symbol recognition | ~10 min | Brand recall + visual balance |
| SK-2 | Vertically center the wordmark + tagline cluster (remove ~25% bottom padding currently reserved as social-crop safe zone) | ~5 min | Tighter composition |
| SK-3 | Increase contrast on the trailing "s" of the wordmark — currently appears slightly violacea due to anti-aliasing adjacency with the BRAND_PURPLE "y". Try `font-feature-settings: 'kern' 1` or a 1px stroke override | ~15 min | Color fidelity in downscaled previews |
| SK-4 | Add a subtle background pattern (dot grid only — UXIX-0011 forbids gradients) for visual interest at scale | ~20 min | Less flat / more editorial |
| SK-5 | Platform-specific variants (LinkedIn = more formal copy + "Enterprise HRMS"; Twitter = punchier "Stop guessing skill gaps"; OG = neutral as today) | ~30 min × 3 | Platform-tuned conversion |

**Where to pick up**: `apps/web/scripts/generate-social-kit.mjs`. Modify the
`html()` template and `TARGETS` array. The pipeline is idempotent — re-run
overwrites `ux-design-shared/ui/src/assets/brand/social/*.png` cleanly.

## Favicon set follow-ups (not surfaced in S925 but worth noting)

| # | Refinement | Effort | Effect |
|---|---|---|---|
| FV-1 | Generate `favicon.ico` multi-resolution container (16+32+48 packed) using a node tool like `png-to-ico` or `to-ico` | ~30 min | Legacy IE / older clients support |
| FV-2 | Manifest file (`site.webmanifest`) referencing the 192 + 512 PNGs for PWA installability | ~15 min | Progressive Web App readiness |
| FV-3 | Apple `apple-touch-icon.png` (180×180) wired in `apps/web/src/app/layout.tsx` via `<link rel="apple-touch-icon">` | ~5 min | iOS home-screen icon |
| FV-4 | Microsoft tile config (`browserconfig.xml` + msapplication-TileImage meta) | ~10 min | Windows tile pinning |

**Where to pick up**: `apps/web/scripts/generate-favicons.mjs` + wire the
generated files in `apps/web/src/app/layout.tsx` `<head>` via Next.js
`metadata.icons` API.

## A11y residuals (serious / moderate / minor — not critical, not blocking)

From `docs/a11y-baseline/showcase/*.json` post-Tier-7 axe runtime pass.
Dominant residual category: `color-contrast` (serious) on:

- `text-muted-foreground/70` mono fragments in `/showcase/system-health`
  DBSupervisorSidebar list (11 nodes — numerics like "576", "42", "1 284",
  etc.)
- `text-destructive` ErrorText paragraphs in `/showcase/forms` (2 nodes —
  "Enter a fully-qualified URL", "Must be unique across the tenant")

| # | Refinement | Effort | Effect |
|---|---|---|---|
| A11Y-1 | Bump `--color-muted-foreground` lightness in dark theme by ~5-7% (currently `oklch(0.5 0.012 252)` light / equivalent dark — push muted-foreground in dark mode to ~0.62-0.65 to clear WCAG AA on the `/70` opacity overlay) | ~10 min | 11 nodes serious -> 0 on /showcase/system-health |
| A11Y-2 | Adjust `--color-destructive` lightness for higher contrast on light theme `bg-card` (current oklch(0.55..0.60) — push to ~0.50 to clear AA on small text) | ~10 min | 2 nodes serious -> 0 on /showcase/forms |
| A11Y-3 | Move the axe runtime pass into CI (GitHub Actions step in showcase.yml or new a11y.yml) — pin baseline JSONs as artifacts + diff on PR | ~30 min | Regression prevention |

**Where to pick up**: `ux-design-shared/ui/src/styles/tokens.css` for color
adjustments; `.github/workflows/` for CI integration.

## Showcase chrome polish

Surfaced via visual QA but deemed non-blocker.

| # | Refinement | Effort | Effect |
|---|---|---|---|
| SC-1 | User menu in `DashboardHeader` is cosmetic-only in showcase (the live app uses Radix `DropdownMenu`); showcase version should at minimum expand a styled menu on click for completeness | ~30 min | Showcase parity with production |
| SC-2 | Language switcher (IT/EN button) is cosmetic in showcase. Add a Radix `DropdownMenu` with the 2 options for showcase + wire `onToggleLanguage` callback | ~20 min | Same as above |
| SC-3 | `/showcase/palettes` 5-candidate page is now historical-record-only (UXIX-0005 Accepted = A Blue Primary). Could be visually re-arranged to emphasize the chosen one + display the 4 rejected as "considered alternatives" instead of side-by-side equal weighting | ~30 min | Page intent clarity |
| SC-4 | `/showcase/logo` 4-candidate page same as above — could emphasize D Y-accent and demote A/B/C to "considered alternatives" | ~20 min | Page intent clarity |
| SC-5 | `/showcase/typography` shows Exo 2 + Inter side-by-side; could likewise demote Inter to historical | ~10 min | Page intent clarity |

## Tier 7 follow-up: 12 ADR registry homogeneity check

The `ux-design-shared/governance/DECISION_REGISTER.md` has 12/12 rows
Accepted but ADR-0008/0009/0010/0011/0012 are marked "Accepted — pending
*ADR file*" in the index. These 5 file shells should be written (each ~30
lines, ratifying-de-facto pattern like ADR-0002/0003/0004 added in this
session) for governance completeness.

| # | Refinement | Effort | Effect |
|---|---|---|---|
| GV-1 | Write ADR-0008 (Status icon mapping) | ~10 min | Governance completeness |
| GV-2 | Write ADR-0009 (Module + page registries) | ~15 min | Same |
| GV-3 | Write ADR-0010 (A11y quality gates) | ~15 min | Same |
| GV-4 | Write ADR-0011 (No-gradient rule) | ~10 min | Same |
| GV-5 | Write ADR-0012 (Logo wordmark font stack) | ~10 min | Same — already implied by ADR-0006/0007 |

## Total deferred effort

5 SK + 4 FV + 3 A11Y + 5 SC + 5 GV = **22 refinements**, total ~6h batched, or
individual pick-and-choose. Order of priority (subjective recommendation):

1. **A11Y-1 + A11Y-2** (color contrast token bumps) — clears the dominant
   residual serious axe violations across the showcase. ~20 min total.
2. **GV-1..GV-5** (5 ADR shells) — governance completeness, no code change.
   ~1h total.
3. **FV-1..FV-4** (favicon + PWA + manifest) — production polish. ~1h.
4. **SK-1..SK-5** (social kit refinements) — share-context conversion. ~1.5h.
5. **SC-1..SC-5** (showcase chrome polish) — page intent clarity. ~2h.
6. **A11Y-3** (CI integration) — regression prevention. ~30 min.

None are blockers. Brand v1.0 + v1.1 is shippable as-is.

## References

- `docs/SHOWCASE_AUDIT_2026-05-20.md` (Tier 1-3 source audit)
- `docs/A11Y_AUDIT_TIER7_2026-05-20.md` (Tier 7 source audit)
- `docs/a11y-baseline/showcase/` (18 axe baseline JSONs)
- `ux-design-shared/governance/DECISION_REGISTER.md` (12/12 ADR
  Accepted)
- Tag `v0.4.0-brand-v1` (both repos)
