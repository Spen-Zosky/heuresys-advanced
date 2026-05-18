# Heuresys UX/IX Decision Register

Live register for all UX/IX, brand identity, page layout, asset, component and visual-system decisions of the `heuresys-advanced` platform.

Schema and rule mirror `ux-design/heuresys_uxix_brand_identity_bundle_v1/templates/DECISION_REGISTER.md`. Every row links to the corresponding `ADR-NNNN-<title>.md` file in this directory.

## Status values

| Status | Meaning |
|---|---|
| Proposed | Candidate(s) live in showcase; awaiting Product Owner choice |
| Accepted | Locked in; cited as authority by code, tokens, assets |
| Superseded | Replaced by a later decision; **never deleted** — link `Superseded by` |
| Rejected | Considered and not selected; kept for audit history |
| Needs Review | Was Accepted; new evidence suggests revisit |

## Rules

1. **No deletion**: superseded rows stay; `Superseded by` column points to the new decision ID.
2. **Showcase before Accepted**: aesthetic decisions (palette, typography, logo, motion) require at least 2 candidates live in a `/showcase/<area>` route before Product Owner can mark `Accepted`.
3. **One ADR per row**: every row has a `docs/design-decisions/ADR-NNNN-<slug>.md` file. The ADR holds the full rationale; this register is the index.
4. **Decision authority**: structural decisions (shell architecture, navigation model, page contracts) may be declared `Accepted` on creation when they inherit a non-negotiable invariant from `ux-design/heuresys_uxix_brand_identity_bundle_v1/`. Aesthetic decisions are always `Proposed` first.
5. **Commit traceability**: each register update lands in a commit prefixed `docs(brand):` with the ADR delta in the message body.

---

## Register

| Decision ID | Date | Category | Title | Status | Final Decision | Showcase Reference | Supersedes | Superseded By | Impacted Areas |
|---|---:|---|---|---|---|---|---|---|---|
| UXIX-0001 | 2026-05-18 | Shell | Dashboard shell architecture | Accepted | CSS grid `rows-[64px_1fr_44px]`, body cols `[280px_1fr]` expanded / `[72px_1fr]` collapsed, Header+Footer fixed across collapse. | `/showcase/shell` (pending Phase 5) | — | — | `DashboardShell`, `Header`, `Sidebar`, `Footer`, tokens.css |
| UXIX-0002 | 2026-05-18 | Header | Header mandatory composition | Proposed | Left: hamburger + Heuresys SVG logo. Right: IT/EN switcher, palette 4-box, theme dark/light, user menu→Logout. | `/showcase/header` (pending Phase 5) | — | — | `Header`, language store, palette store, theme store, auth client |
| UXIX-0003 | 2026-05-18 | Footer | Footer composition | Proposed | Left: © year + Heuresys.com SVG (clickable). Right: 4 social icons icon-only, aria-label, `target="_blank" rel="noopener noreferrer"`. | `/showcase/footer` (pending Phase 5) | — | — | `Footer`, brand SVG assets |
| UXIX-0004 | 2026-05-18 | Sidebar | Sidebar collapse + tree state | Proposed | Two separate state levels: `sidebarCollapsed` (width) vs `treeGroups[id].open` (sub-items). localStorage persistence. Permission + tenant flag filtering. | `/showcase/sidebar` (pending Phase 5) | — | — | `Sidebar`, navigation registry, localStorage |
| UXIX-0005 | 2026-05-18 | Palette | Brand primary palette | Proposed | Candidate A (blue-primary current) + Candidate B (alternative) live side-by-side. Product Owner picks. | `/showcase/palettes` (pending) | — | — | tokens.css, all chart components |
| UXIX-0006 | 2026-05-18 | Typography | Brand typography | Proposed | Candidate A (Exo 2 current) + Candidate B (alternative). Scale tokens defined. | `/showcase/typography` (pending) | — | — | tokens.css, all text components |
| UXIX-0007 | 2026-05-18 | Logo | Heuresys logo system | Proposed | 2–3 logo SVG candidates (full, symbol, horizontal). Product Owner picks. | `/showcase/shell` + `/showcase/header` (pending) | — | — | `HeuresysLogo`, `HeuresysComLogo`, favicon set |
| UXIX-0008 | 2026-05-18 | Icons | Status icon mapping | Accepted | Lucide React outline (currentColor); `StatusIcon` component maps `StatusTone = neutral\|info\|success\|warning\|danger\|disabled` to `--color-icon-*` semantic tokens. | `/showcase/icons` (pending Phase 5) | — | — | `StatusIcon`, tokens.css |
| UXIX-0009 | 2026-05-18 | Navigation | Module + page registries | Accepted | Centralized `dashboard-modules.registry.ts` + `dashboard-pages.registry.ts`. Bundle pattern. Permission/tenant flag filtering at registry level. | n/a (code-level) | — | — | `apps/web/src/navigation/*` |
| UXIX-0010 | 2026-05-18 | A11y | Quality gates | Accepted | Combine `ACCEPTANCE_CRITERIA.md` (8 gates) + `VISUAL_QA_CHECKLIST.md` (54 items) + `ACCESSIBILITY_CHECKLIST.md` (17 items) + axe-core zero-critical. All must pass before brand v1 tag. | n/a (process) | — | — | `apps/web/tests/e2e/a11y.spec.ts`, Visual QA tooling |

---

## Index — ADR files

- [ADR-0001 — Shell architecture confirm](./ADR-0001-shell-architecture-confirm.md) (UXIX-0001, Accepted)
- ADR-0002 — Header mandatory composition (UXIX-0002, Proposed) — *pending*
- ADR-0003 — Footer composition (UXIX-0003, Proposed) — *pending*
- ADR-0004 — Sidebar collapse + tree state (UXIX-0004, Proposed) — *pending*
- ADR-0005 — Brand primary palette (UXIX-0005, Proposed) — *pending*
- ADR-0006 — Brand typography (UXIX-0006, Proposed) — *pending*
- ADR-0007 — Heuresys logo system (UXIX-0007, Proposed) — *pending*
- ADR-0008 — Status icon mapping (UXIX-0008, Accepted) — *pending*
- ADR-0009 — Module + page registries (UXIX-0009, Accepted) — *pending*
- ADR-0010 — A11y + quality gates (UXIX-0010, Accepted) — *pending*

ADR files are added incrementally per deliverable in the session backlog. A row in the register without an ADR file is not yet ratified — must be marked `pending` until the file lands.
