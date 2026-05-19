# Brand Identity v1 — Lane handoff

**heuresys-advanced worktree**: `D:\heuresys-advanced\.claude\worktrees\brand-identity-v1`
**heuresys-advanced branch**: `claude/brand-identity-v1` off `main`
**ux-design-shared repo**: `D:\ux-design-shared\` on `main` (separate git repo)
**Session 2 closed**: 2026-05-19. Neither repo pushed (push requires Enzo's explicit ack per `feedback_full_autonomy.md`).

---

## Architecture state

Brand identity v1 runs under **Option 2 split**:
- Governance (register + ADR) + reusable assets (raw SVG + React wrappers) + design tokens live in `D:\ux-design-shared\`
- Showcase consumer + lane meta-docs live in the heuresys-advanced brand worktree

```
D:\ux-design-shared\                                  (separate git repo)
├── governance/
│   ├── DECISION_REGISTER.md              live, cross-consumer
│   └── ADR-0001-shell-architecture-confirm.md
└── ui/
    ├── package.json                      exports: ./brand/candidates, ./assets/brand/*
    └── src/
        ├── assets/brand/
        │   ├── candidates/UXIX-0007-logo/    A/B/C/D × {symbol,full} + README
        │   └── legacy/                        6 evo.heuresys.com SVGs imported 2026-05-19
        ├── components/brand/
        │   └── candidates/                    LogoCandidate{A,B,C,D}.tsx + index
        └── styles/                            tokens.css (palette/typography pending Acceptance)

D:\heuresys-advanced\.claude\worktrees\brand-identity-v1\
├── BRAND_SESSION_CHARTER.md
├── HANDOFF_BRAND.md                      this file
└── apps/web/
    ├── public/                            (no brand-candidates mirror — served via @heuresys/ui)
    ├── src/
    │   ├── app/
    │   │   ├── globals.css                CSS-var defaults + motion keyframes + reduce-motion guard
    │   │   └── showcase/                   17 routes, all dynamic-theme aware
    │   ├── lib/
    │   │   └── theme/                      palettes.ts + PaletteProvider + PaletteSwitcher + ThemeToggle
    │   └── middleware.ts                   /showcase added to PUBLIC_PATHS
    └── tests/e2e/showcase-smoke.spec.ts    Playwright spec (file only, exec deferred)
```

## Cross-worktree bridge (one-time setup, persistent)

The `link:../ux-design-shared/ui` protocol in root `package.json` resolves relative to package.json location, so nested worktrees would resolve to a non-existent path. A Windows directory junction bridges this:

```
D:\heuresys-advanced\.claude\worktrees\ux-design-shared  →  D:\ux-design-shared
```

Verified intact at handoff via `Get-Item ... | LinkType: Junction`. If lost (e.g. worktrees folder wiped), recreate:

```powershell
New-Item -ItemType Junction `
  -Path  "D:\heuresys-advanced\.claude\worktrees\ux-design-shared" `
  -Target "D:\ux-design-shared"
```

---

## Sessions shipped

### Session 1 (2026-05-18) — 9 commits on brand lane + 2 commits on ux-design-shared

`120f67b` charter
`391fd0f` decision register + ADR-0001 (Accepted)
`53c992f` showcase scaffold (index + shell + palettes + typography)
`ed8f63e` UXIX-0007 logo candidates A/B/C + /showcase/logo
`bda6479` showcase-smoke Playwright spec (file only)
`08ffc4d` Session 1 handoff
`78d2503` Option 2 migration outbound
`9029880` junction documentation
`53a983d` middleware fix → /showcase public

ux-design-shared: `a683939` governance + UXIX-0007 inbound · `1d6ce79` Exo 2 stack + UXIX-0011/0012

### Session 2 (2026-05-19) — 3 commits on brand lane + 2 commits on ux-design-shared

`11c393f` complete showcase scaffold (12 new routes, 16/16 live)
`f6998a7` 5-palette + UXIX-0011 no-gradient rule + 3 gradient removals
`68c0cc2` dynamic theme + palette system + CSS-var bulk refactor + motion + Candidate D wired

ux-design-shared: `3b3192f` legacy SVG archive + Candidate D Y-accent

### Current HEADs at handoff

| Repo | HEAD | Branch |
|------|------|--------|
| heuresys-advanced brand lane | `68c0cc2` | `claude/brand-identity-v1` |
| ux-design-shared | `3b3192f` | `main` (ahead origin/main by 3 commits) |

Neither repo pushed.

---

## Decisions snapshot

| ID | Title | Status | Notes |
|----|-------|--------|-------|
| UXIX-0001 | Dashboard shell architecture | **Accepted** | ADR file written |
| UXIX-0002 | Header mandatory composition | Proposed | 2 variants in /showcase/header |
| UXIX-0003 | Footer composition | Proposed | light + dark in /showcase/footer |
| UXIX-0004 | Sidebar collapse + tree state | Proposed | expanded + collapsed in /showcase/sidebar |
| UXIX-0005 | Brand primary palette | Proposed | **5 candidates** A=Blue Primary / B=Studio Slate / C=Choco & Coffee / D=Cognac & Oatmeal / E=Onyx & Champagne |
| UXIX-0006 | Brand typography | Proposed | 2 candidates A=Exo 2 / B=Inter+Plex Mono |
| UXIX-0007 | Heuresys logo system | Proposed | **4 candidates** A=Hex node / B=H ladder / C=Constellation / D=Y-accent (legacy port) |
| UXIX-0008 | Status icon mapping | Accepted | ADR pending |
| UXIX-0009 | Module + page registries | Accepted | ADR pending |
| UXIX-0010 | A11y + quality gates | Accepted | ADR pending |
| UXIX-0011 | No-gradient rule | **Accepted** | ADR pending; rule banner in /showcase/palettes |
| UXIX-0012 | Logo wordmark font stack (Exo 2) | **Accepted** | ADR pending |

## Showcase routes

**16 / 16 scaffolded · all routes live**. All routes dynamic-theme aware (consume CSS vars driven by `PaletteProvider`):

Chrome decisions with candidates: `/showcase/shell` · `/header` · `/sidebar` · `/footer`
Brand decisions with candidates: `/showcase/palettes` · `/typography` · `/logo`
Visual library: `/showcase/icons` · `/dashboard-cards` · `/forms` · `/tables` · `/charts`
Page-type prototypes: `/showcase/page-types` · `/landing-page` · `/login-page` · `/primary-initial-page`

## Dynamic theme + palette system (live verified)

- 5 palettes × 2 modes (light/dark) typed in `apps/web/src/lib/theme/palettes.ts`
- `PaletteProvider` reads/writes localStorage (`heuresys.brand.palette`, `heuresys.brand.theme`)
- `<PaletteSwitcher />` (5 swatches) + `<ThemeToggle />` (sun/moon pill) in `/showcase` nav
- `applyPalette(id, mode)` writes ~18 CSS custom properties on `:root` + toggles `.dark` class on `<html>`
- 17 showcase pages bulk-refactored to consume CSS vars (Tailwind `bg-[var(--card)]` etc.)
- Smooth 240ms transitions on `html, body` color properties

Verified via DOM eval at Session 2 close:
```
default        → palette=blue,  mode=light, --bg=#FAFBFD, --p1=#2563EB
click swatch 3 → palette=choco, mode=light, --bg=#FAF6F1, --p1=#3E2723
click theme    → palette=choco, mode=dark,  --bg=#1F1410, --fg=#E5DBD0, .dark class added
```

## Motion (CSS-first, framer-motion deferred per restraint ethos)

| Class | Effect |
|-------|--------|
| `hx-card-enter` | fade + translateY(8→0) in 320ms cubic-bezier(0.16, 1, 0.3, 1) |
| `hx-card-hover` | translateY(-2px) + shadow on hover, 200ms |
| `hx-stagger > *:nth-child(N)` | stagger entrance 60ms × N (up to 8 children) |
| `hx-logo` | scale(1.03) on hover, 280ms ease-out |
| PaletteSwitcher swatch | hover scale 1.10 + ring on active |
| ThemeToggle knob | translateX 200ms between 2px / 22px |

`@media (prefers-reduced-motion: reduce)` global guard caps all animations/transitions to 0.01ms.

---

## Resume protocol — fresh session

### Step 0 — orient

Open Claude Code (or any shell) and run:

```bash
# Confirm both repos are intact and HEADs match this handoff
git -C D:/heuresys-advanced/.claude/worktrees/brand-identity-v1 log --oneline -5
# Expected top: 68c0cc2 feat(brand): dynamic theme + palette system, CSS-var refactor, motion, Candidate D wired

git -C D:/ux-design-shared log --oneline -3
# Expected top: 3b3192f feat(brand): UXIX-0007 Candidate D (Y-accent legacy port) + legacy SVG archive

# Confirm junction bridge intact
powershell -Command "Get-Item D:\heuresys-advanced\.claude\worktrees\ux-design-shared | Select LinkType, Target"
# Expected: LinkType=Junction, Target=D:\ux-design-shared
```

If junction is gone (e.g. worktree folder rebuilt):

```powershell
New-Item -ItemType Junction `
  -Path  "D:\heuresys-advanced\.claude\worktrees\ux-design-shared" `
  -Target "D:\ux-design-shared"
```

### Step 1 — start dev server

Two options.

**Option A** — via Claude Code's `Claude_Preview` MCP (recommended if you're in Claude Code):

`.claude/launch.json` is already configured at `D:\heuresys-advanced\.claude\worktrees\musing-wing-802781\.claude\launch.json` with:

```json
{
  "configurations": [{
    "name": "brand-web",
    "runtimeExecutable": "pnpm",
    "runtimeArgs": ["--dir", "D:/heuresys-advanced/.claude/worktrees/brand-identity-v1/apps/web", "exec", "next", "dev"],
    "autoPort": true
  }]
}
```

Ask Claude to `preview_start("brand-web")`. It picks a free port (autoPort) since `:3000` is held by a stale Next.js process from 2026-05-17 (PID 19736 — not killed; can be terminated manually if you want `:3000` back).

**Option B** — direct pnpm:

```bash
cd D:/heuresys-advanced/.claude/worktrees/brand-identity-v1/apps/web
pnpm dev
# defaults to :3000 if free, otherwise -p <other>
# Or override the hardcoded port in package.json by overriding script args:
#   pnpm exec next dev -p 3001
```

Either way the showcase is gated by `NEXT_PUBLIC_ENABLE_SHOWCASE=1` OR `NODE_ENV !== "production"`. `pnpm dev` sets NODE_ENV=development automatically, so no env tweak needed.

### Step 2 — interact in your browser

Open the URL printed by the dev server. Visit `/showcase` (no auth needed — middleware allows the path public).

The header has:
- 5-swatch `PaletteSwitcher` → click to switch palette (Blue / Slate / Choco / Cognac / Onyx)
- Sun/moon `ThemeToggle` → click to toggle light / dark

Both persist in localStorage. Every showcase page reacts.

### Step 3 — make a decision in chat

In Claude, say e.g.:

- *"Scelgo Cognac & Oatmeal per UXIX-0005, in modalità light"* — Claude will mark `Accepted` in `D:\ux-design-shared\governance\DECISION_REGISTER.md`, write `ADR-0005-brand-primary-palette.md`, promote the chosen palette into `D:\ux-design-shared\ui\src\styles\tokens.css`, and commit both repos.
- *"Per UXIX-0007 scelgo Candidate D (Y-accent legacy port)"* — promote D's React + raw SVG from `candidates/` to canonical `ui/src/components/brand/HeuresysLogo.tsx` + `ui/src/assets/brand/logo/`. Non-chosen candidates stay in `candidates/` per Register Rule 1.
- *"Modifica Cognac & Oatmeal: rendi il primary leggermente più scuro per migliorare il contrast WCAG"* — Claude iterates the candidate in place, you re-verify in browser, then accept.

### Step 4 — verify automatically

Before marking any decision `Accepted`, run the smoke test:

```bash
cd D:/heuresys-advanced/.claude/worktrees/brand-identity-v1/apps/web
pnpm exec playwright test showcase-smoke.spec.ts
```

(Must pass: zero critical a11y violations on the 5 scaffolded routes + console error free.)

### Step 5 — push when ready

Neither repo has been pushed. When the brand v1 work is mature (e.g. after picking palette/typography/logo), push explicitly:

```bash
# heuresys-advanced
git -C D:/heuresys-advanced/.claude/worktrees/brand-identity-v1 push -u origin claude/brand-identity-v1

# ux-design-shared (separate repo, own remote)
git -C D:/ux-design-shared push origin main
```

If the brand lane should be merged back to `main` of heuresys-advanced, open a PR from `claude/brand-identity-v1` once green.

---

## What's still open

Decisions awaiting Product Owner pick (in priority order):

1. **UXIX-0005 Palette** — 5 candidates live; visible in browser via the header switcher.
2. **UXIX-0006 Typography** — 2 candidates in `/showcase/typography` (Exo 2 vs Inter+Plex Mono). Note: Exo 2 webfont not loaded yet (no `@font-face` / `next/font`); pages currently render via fallback. Loading the webfont is a Session-3 follow-on once UXIX-0006 is `Accepted`.
3. **UXIX-0007 Logo** — 4 candidates in `/showcase/logo`. Candidate D (Y-accent legacy port) adapts to active palette via `--logo-body` + `--logo-accent` CSS vars set by `PaletteProvider`.
4. **UXIX-0002 / 0003 / 0004** — header / footer / sidebar variants. Lower priority — these inherit the palette/typography choices, so wait until 0005/0006 lock in.

ADRs `pending` (Accepted register rows that lack ADR files):
UXIX-0008 (icons), 0009 (registries), 0010 (a11y), 0011 (no-gradient), 0012 (logo font).

Other deferred items:
- Promote `tokens.css` from defaults in `globals.css` to the canonical `D:\ux-design-shared\ui\src\styles\tokens.css` once UXIX-0005 / 0006 are Accepted.
- Promote chosen logo from `candidates/` to `ui/src/components/brand/HeuresysLogo.tsx` + canonical SVG slots, and generate derivative variants (horizontal/monochrome/light/dark) + favicon set.
- Port shell components (DashboardShell/Header/Sidebar/Footer/TopTabs) from bundle `code_examples/` into `D:\ux-design-shared\ui\src\components\dashboard\` so they're consumable by `apps/web` (Session 3, Phase 3 of bundle backlog).
- Wire `apps/web/src/app/(authenticated)/layout.tsx` to use the new `<DashboardShell />` from `@heuresys/ui` once available.
- Webfont loading for Exo 2 in `apps/web` via `next/font` (Session 3).

---

## Sealed boundaries — unchanged

This lane does NOT touch:
- `apps/api/**` (heuresys-advanced backend)
- `db/migrations/**`, `db/seeds/**`, `db/scripts/**`
- `packages/shared/src/schemas/**` (business)
- `apps/web/src/app/(authenticated)/**` (live MVP-2a pages — touched only via the showcase mirror at `/showcase/primary-initial-page`)
- `apps/web/src/app/login/**` (existing login — touched only via `/showcase/login-page` prototype)
- `ui/src/components/*` outside `brand/` in `@heuresys/ui` (existing 51 primitives intact)

This lane DOES touch (per Option 2 architecture, not a violation):
- `D:\ux-design-shared\governance\` (decision register + ADRs)
- `D:\ux-design-shared\ui\src\assets\brand\` (raw SVG: candidates + legacy archive)
- `D:\ux-design-shared\ui\src\components\brand\` (React wrappers)
- `D:\ux-design-shared\ui\package.json` (subpath exports for `./brand/candidates` + `./assets/brand/*`)
- heuresys-advanced `apps/web/src/app/showcase/` (NEW routes), `apps/web/src/lib/theme/` (NEW), `apps/web/src/app/globals.css`, `apps/web/src/middleware.ts` (one-line `/showcase` public-path add)

Any need to break a seal → flag explicitly in the next handoff.
