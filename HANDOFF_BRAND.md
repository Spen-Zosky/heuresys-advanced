# Brand Identity v1 — Lane handoff

**Worktree**: `D:\heuresys-advanced\.claude\worktrees\brand-identity-v1`
**Branch**: `claude/brand-identity-v1` off `main @ 42a7401`
**Lane state at handoff**: Session 1 closed; 6 commits; not pushed.

> This handoff is **lane-local** — it does not replace the project-wide `HANDOFF.md` owned by the main lane. The brand lane and the brownfield lane (`musing-wing-802781`) progress independently until a future merge point.

---

## Shipped (Session 1, 2026-05-18)

| Commit | Subject | Decisions touched |
|--------|---------|-------------------|
| `120f67b` | `docs(brand): session charter v1 — scope, boundaries, deliverables` | — |
| `391fd0f` | `docs(brand): decision register live + ADR-0001 shell architecture (Accepted)` | UXIX-0001 Accepted; 0002–0010 indexed |
| `53c992f` | `feat(brand): showcase route group scaffold + palette/typography candidates` | UXIX-0005, 0006 Proposed |
| `ed8f63e` | `feat(brand): UXIX-0007 logo candidates A/B/C + /showcase/logo route` | UXIX-0007 Proposed |
| `bda6479` | `test(brand): showcase-smoke Playwright spec (file only, exec deferred)` | — |
| (next) | `docs(brand): session 1 handoff + charter live state` | — |

### Artifacts

- `BRAND_SESSION_CHARTER.md` — scope + boundaries + deliverables + live state.
- `docs/design-decisions/DECISION_REGISTER.md` — 10 rows seeded (UXIX-0001..0010), 5 rules, status enum.
- `docs/design-decisions/ADR-0001-shell-architecture-confirm.md` — Accepted, options A/B/C considered.
- `docs/design-decisions/candidates/UXIX-0007-logo/` — 3 candidates × (symbol + full) = 6 SVG + README.
- `apps/web/src/app/showcase/` — 5 routes (index, shell, palettes, typography, logo).
- `apps/web/public/brand-candidates/UXIX-0007/` — serving mirror of the 6 logo SVGs.
- `apps/web/tests/e2e/showcase-smoke.spec.ts` — Playwright smoke (file only).

### Decisions snapshot

| ID | Title | Status |
|---|---|---|
| UXIX-0001 | Dashboard shell architecture | **Accepted** (ADR-0001 written) |
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

- `pnpm install --frozen-lockfile` in this worktree.
- `pnpm typecheck --filter @heuresys/web` — verifies the showcase scaffold compiles.
- `pnpm exec playwright test showcase-smoke.spec.ts` (with `NEXT_PUBLIC_ENABLE_SHOWCASE=1` and `pnpm dev` server up) — verifies the 5 routes render + a11y baseline holds.
- ADR-0002..0010 file drafts (the rows exist in the register; the per-decision Markdown files do not).
- Tokens.css extension in `D:\ux-design-shared\ui\src\styles\tokens.css` — held until the Product Owner picks UXIX-0005 / UXIX-0006.
- Shell components port from `code_examples/` into `D:\ux-design-shared\ui\src\components\dashboard\` — held until UXIX-0001 implementation phase (Phase 3 of bundle backlog).

---

## Next session — entry point

Open the brand lane:

```bash
cd D:/heuresys-advanced/.claude/worktrees/brand-identity-v1
git status                                  # expected: clean on claude/brand-identity-v1
git log --oneline -8                        # expected: 6 brand-prefixed commits
```

### Phase 1 verification (must pass before any new work)

```bash
pnpm install --frozen-lockfile              # one-time worktree setup
cd apps/web
pnpm typecheck                              # expect 0 errors
NEXT_PUBLIC_ENABLE_SHOWCASE=1 pnpm dev      # serves /showcase at :3000
# In another shell:
pnpm exec playwright test showcase-smoke.spec.ts
```

If any of the above fails, fix in this lane with `fix(brand):` commit before proceeding.

### Recommended Session 2 deliverables (Phase 2 close + Phase 3 partial)

1. **Product Owner decision capture** for UXIX-0005 / 0006 / 0007 via `ux-design/heuresys_uxix_brand_identity_bundle_v1/prompts/DESIGN_DECISION_CAPTURE_PROMPT.md`. Marks Accepted in DECISION_REGISTER + writes the corresponding ADR-0005/0006/0007 files.
2. **Tokens.css promotion** — write the chosen palette + scale into `D:\ux-design-shared\ui\src\styles\tokens.css`. Showcase pages refactor to read from tokens instead of inline hex.
3. **ADR-0008/0009/0010 drafts** — flesh out the 3 already-Accepted register rows that lack ADR files.
4. **Showcase additions** — port the next 4 routes from the pending list: `/showcase/header` (UXIX-0002), `/showcase/sidebar` (UXIX-0004), `/showcase/footer` (UXIX-0003), `/showcase/icons` (UXIX-0008).
5. **Asset register seed** — create `docs/design-decisions/ASSET_REGISTER.md` per `templates/ASSET_REGISTER_TEMPLATE.md`, list the 6 candidate SVGs + their planned production variants.

### Estimated Session 2 effort

12–16h (consistent with the 4-session × 12–16h plan in `~/.claude/plans/functional-wondering-kitten.md`).

---

## Sealed boundaries — reminder

This lane does not touch (verified by `git log --oneline | xargs git show --stat`):

- `apps/api/**`
- `db/migrations/**`, `db/seeds/**`, `db/scripts/**`
- `packages/shared/src/schemas/**` (business)
- `apps/web/src/app/(authenticated)/**` (business pages)
- `apps/web/src/app/login/**` (existing login)
- `D:\ux-design-shared\**` (deferred until Accepted aesthetics)

Any need to touch the above requires explicit Enzo authorization per charter §7.
