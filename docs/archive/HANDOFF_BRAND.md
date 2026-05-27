# Brand Identity v1 — Lane handoff

**Repo**: `D:\heuresys-advanced` on `main`
**HEAD at handoff**: `c3ae629`
**Sister repo**: `D:\ux-design-shared\` on `main` HEAD `3b3192f`
**Status**: collapse done — single-repo single-branch, plus GitHub Pages static-export pipeline configured. **Neither repo pushed yet.**

---

## Architecture — collapsed

After Session 2 the dual-repo + worktree + junction setup was deemed too
complex by the user. Phase 1 merged `claude/brand-identity-v1` → `main`
(merge commit `12ba5af`), removed the brand worktree + branch + junction.
Phase 2 added `apps/showcase` as a static-export workspace + GHA workflow
for GitHub Pages deploy.

```
D:\heuresys-advanced\               (single-repo, on main)
├── .github/workflows/
│   └── showcase.yml                 GHA: on push to main, builds apps/showcase
│                                    and deploys to gh-pages branch
├── apps/
│   ├── api/                          Fastify backend (untouched, brownfield lane)
│   ├── web/                          Next.js app — CANONICAL source of brand work
│   │   └── src/app/showcase/         17 routes (5 chrome + 12 candidates/library)
│   │   └── src/lib/theme/            PaletteProvider + 5 palettes × light/dark + switchers
│   └── showcase/                     NEW static-export workspace
│       ├── package.json              minimal: next + react + @heuresys/ui + cross-env
│       ├── next.config.js            STATIC_EXPORT=1 → output: "export",
│       │                              basePath: /heuresys-advanced
│       ├── src/app/
│       │   ├── layout.tsx            HTML shell
│       │   ├── globals.css           CSS-var defaults + motion classes
│       │   ├── page.tsx              redirect to /showcase
│       │   ├── showcase/             ← synced from apps/web by sync-showcase.sh
│       │   └── lib/theme/            ← synced from apps/web
│       └── .gitignore                ignores synced + .next + out
├── scripts/
│   └── sync-showcase.sh              copies apps/web/{showcase,theme} → apps/showcase/
└── BRAND_SESSION_CHARTER.md, HANDOFF_BRAND.md   lane meta-docs (in main now)

D:\ux-design-shared\                 (separate git repo on main)
├── governance/                       DECISION_REGISTER.md + ADR-NNNN-*.md
└── ui/
    ├── package.json                  exports: ./brand/candidates, ./assets/brand/*
    └── src/
        ├── assets/brand/
        │   ├── candidates/UXIX-0007-logo/    A/B/C/D × {symbol,full} + README
        │   └── legacy/                        6 evo.heuresys.com SVGs imported
        ├── components/brand/
        │   └── candidates/                    LogoCandidate{A,B,C,D}.tsx + index
        └── styles/                            tokens.css (palette/typography pending)
```

The `@heuresys/ui` package in `D:\ux-design-shared` is referenced from the
root `package.json` via `"@heuresys/ui": "link:../ux-design-shared/ui"`,
which resolves to `D:\ux-design-shared\ui` (the two repos live side-by-side
on `D:\`). pnpm install creates a symlink `node_modules/@heuresys/ui` →
`D:\ux-design-shared\ui` for the workspace.

The GHA workflow handles the same on Ubuntu by checking out both repos as
sibling directories before pnpm install. **Requirement**: `ux-design-shared`
repo must be publicly readable OR the workflow must use a PAT — see the
push checklist below.

---

## Decisions snapshot (unchanged by collapse)

| ID | Title | Status | Notes |
|----|-------|--------|-------|
| UXIX-0001 | Shell architecture | **Accepted** | ADR file at `D:\ux-design-shared\governance\` |
| UXIX-0002 | Header composition | Proposed | candidates in `/showcase/header` |
| UXIX-0003 | Footer composition | Proposed | `/showcase/footer` |
| UXIX-0004 | Sidebar collapse + tree state | Proposed | `/showcase/sidebar` |
| UXIX-0005 | Brand primary palette | Proposed | **5 candidates** A=Blue / B=Slate / C=Choco / D=Cognac / E=Onyx in `/showcase/palettes` |
| UXIX-0006 | Brand typography | Proposed | A=Exo 2 / B=Inter |
| UXIX-0007 | Logo system | Proposed | **4 candidates** A=Hex / B=H-ladder / C=Constellation / D=Y-accent (legacy) |
| UXIX-0008..0010 | Icons / registries / a11y | Accepted | ADRs pending |
| UXIX-0011 | No-gradient rule | **Accepted** | ADR pending |
| UXIX-0012 | Logo wordmark Exo 2 | **Accepted** | ADR pending |

---

## Push + GitHub Pages setup — 5 steps once

### Step 1 — push ux-design-shared (sister repo, must be reachable by GHA)

```powershell
git -C D:/ux-design-shared push origin main
```

The GHA workflow checks out this repo at runtime to resolve `@heuresys/ui`.
Visibility must be either:
- **Public** (no token needed; GITHUB_TOKEN works out of the box), OR
- **Private** + you create a Personal Access Token with `repo` scope and
  store it as a repo secret `UX_DESIGN_SHARED_TOKEN`, then add `token:
  ${{ secrets.UX_DESIGN_SHARED_TOKEN }}` to the relevant checkout step in
  `.github/workflows/showcase.yml`.

Check current visibility:
```powershell
gh repo view Spen-Zosky/ux-design-shared --json visibility
```

If `private` and you don't want a PAT, make it public:
```powershell
gh repo edit Spen-Zosky/ux-design-shared --visibility public --accept-visibility-change-consequences
```

### Step 2 — push heuresys-advanced main

```powershell
git -C D:/heuresys-advanced push origin main
```

This pushes 14 commits (13 brand + 1 showcase pipeline). Triggers the GHA
workflow because `apps/showcase/**` is in the path-filter.

### Step 3 — enable GitHub Pages source

Once the workflow runs the first time (~2-3 min), it creates the `gh-pages`
branch. Then:

1. Go to https://github.com/Spen-Zosky/heuresys-advanced/settings/pages
2. **Source**: "Deploy from a branch"
3. **Branch**: `gh-pages` / `/ (root)`
4. Save

### Step 4 — verify the URL

After 2-3 more minutes, the showcase is live at:

```
https://spen-zosky.github.io/heuresys-advanced/showcase
```

Open in Chrome. The 5-swatch palette switcher + sun/moon theme toggle
work via client-side localStorage (no server needed). All 16 showcase
routes accessible.

### Step 5 — verify the workflow

Future pushes to main that touch `apps/web/src/app/showcase/**`,
`apps/web/src/lib/theme/**`, `apps/showcase/**`, `scripts/sync-showcase.sh`,
or the workflow itself will auto-redeploy. Check runs at:

```
https://github.com/Spen-Zosky/heuresys-advanced/actions/workflows/showcase.yml
```

---

## Working on brand from now on

```powershell
cd D:\heuresys-advanced
```

That's it. No worktree, no junction, no `-C` flag. You're on `main`. All
brand work lives in `apps/web/src/app/showcase/` and `apps/web/src/lib/theme/`.

To iterate locally (fast dev cycle):

```powershell
cd apps\web
pnpm dev
# open http://localhost:3000/showcase
```

To preview the static export locally (what GH Pages will serve):

```powershell
pnpm --filter @heuresys/showcase build:static
npx serve apps\showcase\out  # or any static file server on apps/showcase/out/
```

To make a decision: in chat, say e.g. *"Per UXIX-0005 scelgo Cognac &
Oatmeal"*. Claude marks Accepted in `D:\ux-design-shared\governance\
DECISION_REGISTER.md`, writes the corresponding ADR, propagates tokens.css,
commits both repos.

---

## Open items / next session priorities

1. **UXIX-0005 palette pick** — 5 candidates ready
2. **UXIX-0006 typography pick** — 2 candidates ready
3. **UXIX-0007 logo pick** — 4 candidates including legacy Y-accent port
4. **Token promotion** — chosen palette/typography into `D:\ux-design-shared\ui\src\styles\tokens.css`
5. **ADR-0008..0012 drafts** — 5 Accepted register rows still need their ADR files
6. **Logo promotion** — chosen candidate from `candidates/` to canonical `HeuresysLogo`/`HeuresysMark` + favicon set
7. **Exo 2 webfont** — wire via `next/font` (currently falls back to system-ui)
8. **Shell components port** — DashboardShell/Header/Sidebar/Footer/TopTabs from bundle `code_examples/` into `@heuresys/ui`

---

## Sealed boundaries

This work does NOT touch:
- `apps/api/**` (brownfield lane territory)
- `db/migrations/**`, `db/seeds/**`, `db/scripts/**`
- `packages/shared/src/schemas/**` (business)
- `apps/web/src/app/(authenticated)/**` (live MVP-2a pages)
- `apps/web/src/app/login/**` (existing login)
- 51 primitives in `@heuresys/ui/src/components/` outside `brand/`
