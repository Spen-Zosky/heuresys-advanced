# Brand Identity v1 — Lane handoff

**heuresys-advanced worktree**: `D:\heuresys-advanced\.claude\worktrees\brand-identity-v1`
**heuresys-advanced branch**: `claude/brand-identity-v1` off `main`
**ux-design-shared repo**: `D:\ux-design-shared\` (separate git repo, branch `main`)
**Lane state at handoff**: Session 1 closed; Option 2 (split governance) migration applied. Neither repo pushed.

> This handoff is **lane-local** — it does not replace the project-wide `HANDOFF.md` owned by the main lane (brownfield refactor). The brand lane and the brownfield lane progress independently until a future merge point.

---

## Architecture — Option 2 split

Brand governance and reusable assets live in `D:\ux-design-shared` (a separate, version-controlled, multi-consumer-ready repo). The `heuresys-advanced` brand worktree only hosts the consumer-side showcase pages and lane meta-docs. A single brand decision typically lands two commits — one per repo — cross-linked by the `UXIX-NNNN` decision id.

```
D:\ux-design-shared\                                  (separate git repo)
├── governance/
│   ├── DECISION_REGISTER.md              live, cross-consumer index
│   └── ADR-NNNN-<title>.md               one file per decision
└── ui/
    ├── package.json                      subpath exports: ./brand/candidates, ./assets/brand/*
    └── src/
        ├── assets/brand/
        │   ├── candidates/UXIX-NNNN-<topic>/     raw SVG, exploration phase
        │   ├── logo/                              post-Accepted canonical assets
        │   └── favicon/                           post-Accepted favicon set
        ├── components/brand/
        │   ├── candidates/Logo*.tsx               React wrappers, exploration
        │   ├── HeuresysLogo.tsx                   post-Accepted (Session 2+)
        │   └── HeuresysMark.tsx                   post-Accepted (Session 2+)
        └── styles/tokens.css                      palette + typography post-Accepted

D:\heuresys-advanced\.claude\worktrees\brand-identity-v1\     (this worktree)
├── BRAND_SESSION_CHARTER.md              lane charter + live state
├── HANDOFF_BRAND.md                      this file
└── apps/web/
    ├── src/app/showcase/                 5 routes scaffolded (index, shell, palettes, typography, logo)
    └── tests/e2e/showcase-smoke.spec.ts  Playwright spec
```

## Shipped in heuresys-advanced lane (Session 1, 2026-05-18)

| Commit | Subject | Decisions touched |
|--------|---------|-------------------|
| `120f67b` | `docs(brand): session charter v1 — scope, boundaries, deliverables` | — |
| `391fd0f` | `docs(brand): decision register live + ADR-0001 shell architecture (Accepted)` | UXIX-0001 Accepted; 0002–0010 indexed |
| `53c992f` | `feat(brand): showcase route group scaffold + palette/typography candidates` | UXIX-0005, 0006 Proposed |
| `ed8f63e` | `feat(brand): UXIX-0007 logo candidates A/B/C + /showcase/logo route` | UXIX-0007 Proposed |
| `bda6479` | `test(brand): showcase-smoke Playwright spec (file only, exec deferred)` | — |
| `08ffc4d` | `docs(brand): session 1 handoff + charter live state` | — |
| (next) | `chore(brand): Option 2 migration — governance + candidates out to ux-design-shared` | structural |

## Shipped in ux-design-shared (Session 1, 2026-05-18)

| Commit | Subject |
|--------|---------|
| (pending — see migration commit) | `feat(brand): governance + UXIX-0007 logo candidates land in shared library` |

Brings in:
- `governance/DECISION_REGISTER.md`
- `governance/ADR-0001-shell-architecture-confirm.md`
- `ui/src/assets/brand/candidates/UXIX-0007-logo/` (6 SVG + README)
- `ui/src/components/brand/candidates/LogoCandidate{A,B,C}.tsx` + `index.ts`
- `ui/package.json` subpath exports `./brand/candidates`, `./assets/brand/*`

## Decisions snapshot

| ID | Title | Status |
|---|---|---|
| UXIX-0001 | Dashboard shell architecture | **Accepted** (ADR file in `D:\ux-design-shared\governance\`) |
| UXIX-0002 | Header mandatory composition | Proposed |
| UXIX-0003 | Footer composition | Proposed |
| UXIX-0004 | Sidebar collapse + tree state | Proposed |
| UXIX-0005 | Brand primary palette | Proposed (A=Blue Primary / B=Slate+Teal) |
| UXIX-0006 | Brand typography | Proposed (A=Exo 2 / B=Inter+Plex Mono) |
| UXIX-0007 | Heuresys logo system | Proposed (A=Hex node / B=H ladder / C=Constellation) |
| UXIX-0008 | Status icon mapping | Accepted (no ADR file yet — pending) |
| UXIX-0009 | Module + page registries | Accepted (no ADR file yet — pending) |
| UXIX-0010 | A11y + quality gates | Accepted (no ADR file yet — pending) |

---

## Deferred / not done

These were intentionally not executed in this lane (no install, no dev server, no test exec):

- `pnpm install --frozen-lockfile` in this worktree (~10–30s with warm pnpm CAS).
- `pnpm typecheck --filter @heuresys/web` — verifies the showcase scaffold compiles, including the new `@heuresys/ui/brand/candidates` imports.
- `pnpm exec playwright test showcase-smoke.spec.ts` (with `NEXT_PUBLIC_ENABLE_SHOWCASE=1` and `pnpm dev` server up) — verifies the 5 routes render + a11y baseline holds.
- ADR-0002..0010 file drafts (rows exist in the register; per-decision Markdown files do not).
- Tokens.css extension in `D:\ux-design-shared\ui\src\styles\tokens.css` — held until the Product Owner picks UXIX-0005 / UXIX-0006.
- Shell components port from `code_examples/` into `D:\ux-design-shared\ui\src\components\dashboard\` — held until UXIX-0001 implementation phase (Phase 3 of bundle backlog).

---

## Next session — entry point

### Open the lane

```bash
cd D:/heuresys-advanced/.claude/worktrees/brand-identity-v1
git status                                  # expected: clean on claude/brand-identity-v1
git log --oneline -8 --grep "(brand):"      # brand-prefixed commits in order

# Sister repo:
git -C D:/ux-design-shared status -sb       # clean on main
git -C D:/ux-design-shared log --oneline -3 # the migration commit appears here
```

### Phase 1 verification (must pass before any new work)

```bash
cd D:/heuresys-advanced/.claude/worktrees/brand-identity-v1
pnpm install --frozen-lockfile              # 10-30s with warm CAS — restores node_modules + @heuresys/ui symlink
cd apps/web
pnpm typecheck                              # expect 0 errors (validates @heuresys/ui/brand/candidates resolution)
NEXT_PUBLIC_ENABLE_SHOWCASE=1 pnpm dev      # serves /showcase at :3000
# In another shell:
pnpm exec playwright test showcase-smoke.spec.ts
```

If any step fails, fix in this lane with a `fix(brand):` commit (no cross-area work permitted by charter §1–§2). The most likely failure is Next.js + TS resolution of `@heuresys/ui/brand/candidates` — if so, options: (a) add a `paths` mapping in tsconfig, (b) add a Next.js Webpack alias, (c) restructure to import from main `@heuresys/ui` index.

### Recommended Session 2 deliverables (Phase 2 close + Phase 3 partial)

1. **Product Owner decision capture** for UXIX-0005 / 0006 / 0007 via `ux-design/heuresys_uxix_brand_identity_bundle_v1/prompts/DESIGN_DECISION_CAPTURE_PROMPT.md`. Marks `Accepted` in `D:\ux-design-shared\governance\DECISION_REGISTER.md` + writes the corresponding ADR-0005/0006/0007 files in `D:\ux-design-shared\governance\`.
2. **Tokens.css promotion** — write the chosen palette + scale into `D:\ux-design-shared\ui\src\styles\tokens.css` (CSS variable + Tailwind 4 `@theme`). Showcase pages refactor to read from tokens instead of inline hex.
3. **ADR-0008/0009/0010 drafts** — flesh out the 3 already-`Accepted` register rows that lack ADR files. Files land in `D:\ux-design-shared\governance\`.
4. **Showcase additions** — port the next 4 routes from the pending list: `/showcase/header` (UXIX-0002), `/showcase/sidebar` (UXIX-0004), `/showcase/footer` (UXIX-0003), `/showcase/icons` (UXIX-0008).
5. **Asset register seed** — create `D:\ux-design-shared\governance\ASSET_REGISTER.md` per `templates/ASSET_REGISTER_TEMPLATE.md`, list the 6 candidate SVGs + their planned production variants.
6. **Promote chosen logo** (assuming UXIX-0007 is `Accepted` in Session 2) — move chosen candidate's React components from `ui/src/components/brand/candidates/` to `ui/src/components/brand/` as `HeuresysLogo.tsx` + `HeuresysMark.tsx`. Move raw SVG from `ui/src/assets/brand/candidates/UXIX-0007-logo/` to `ui/src/assets/brand/logo/`. Non-chosen candidates stay in `candidates/` per Register Rule 1.

### Estimated Session 2 effort

12–16h (consistent with the 4-session × 12–16h plan in `~/.claude/plans/functional-wondering-kitten.md`).

---

## Sealed boundaries — reminder (Option 2 adjusted)

This lane DOES touch `D:\ux-design-shared\` (governance + assets + components) — that's the Option 2 architecture, not a violation.

This lane does NOT touch:
- `apps/api/**` (heuresys-advanced backend)
- `db/migrations/**`, `db/seeds/**`, `db/scripts/**`
- `packages/shared/src/schemas/**` (business)
- `apps/web/src/app/(authenticated)/**` (live MVP-2a pages)
- `apps/web/src/app/login/**` (existing login)
- `ui/src/components/*` outside `brand/` (existing 51 primitives are not touched)

Any need to touch the above requires explicit Enzo authorization per charter §7.
