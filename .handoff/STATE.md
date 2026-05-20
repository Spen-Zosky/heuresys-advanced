# heuresys-advanced — STATE

**Updated**: 2026-05-20 21:50 GMT+2
**Branch**: `main` — 1 commit ahead (`b3321ef` deferred refinements doc, not yet pushed by this handoff)
**Last tag**: `v0.4.0-brand-v1` (both heuresys-advanced + ux-design-shared)

## Last session brief

S925: Brand identity v1 + v1.1 patch shipped end-to-end. Tier 1/2/3 rebuild dei 17 showcase non-canonical pages → DashboardShell + token-driven. ADR-0013 SoT policy. 3 UXIX aesthetic decisions Accepted (A Blue Primary + A Exo 2 + D Y-accent). Tier 7 a11y audit (18/18 axe runtime zero-critical). Tag `v0.4.0-brand-v1` pushed entrambi repo. v1.1 patch: skip-link, favicon set 7 sizes, social kit OG/Twitter/LinkedIn, UXIX-0002/0003/0004 ratified, axe runtime CI. ~16 commit heuresys-advanced + ~6 commit ux-design-shared.

## Top priorities (next session)

1. **Goal 003 SDBI strategic pivot** — ancora SUSPENDED da S923 (NOT toccato in S924+S925). Z-decisions superate dal pivot Enzo 2026-05-20T01:30. Vedi `cowork_code_exchange/_00_SESSION_HANDOFF_2026-05-20.md` + `_00_STATE_003.md`. Effort: aprire sessione strategica SDBI (Semantic-Driven Brownfield Import) — discutere Q2/Q3/Q4, decidere fate dei 8 commit Goal 003 non-pushati, emit DISCOVERY 004 SDBI. **NON spingere comunque i commit Goal 003 senza decisione strategica.**
2. **v1.1 deferred refinements** — 22 items cataloged in `docs/BRAND_V1_DEFERRED_REFINEMENTS.md` (5 famiglie: SK social kit, FV favicon follow-ups, A11Y residuals, SC showcase chrome, GV ADR shells). Totale ~6h batched. Priorità raccomandata: A11Y-1+2 first (clears dominant axe serious in ~20min), poi GV-1..5 (governance completeness ~1h), poi pick-and-choose.
3. **Nuovo filone**: MVP-3 tappa B graph renderers (React Flow `/visualizations/[id]` + Mermaid KPI/process cascade) ora sbloccata da UXIX-0005 Accepted. Vedi memory `feedback_brand_before_graph_renderers` — la condizione "brand identity definita" è ora soddisfatta.

## Open questions (next session)

- **Push del commit `b3321ef`** (deferred refinements doc) — l'handoff stesso lo include nel push S925, ma se vuoi review prima fai stash.
- **8 commit Goal 003 non-pushati** ancora pending: push o reset dopo SDBI decision?
- **Tag annotation push**: ricorda che `v0.4.0-brand-v1` è stato pushato. Se vuoi creare release notes su GitHub Releases (gh release create), action manuale post-tag.

## Stack snapshot (deltas vs S924)

- **Tag**: `v0.4.0-brand-v1` (entrambi i repo, post-Tier-7 + v1.1 patch).
- **`@heuresys/ui`**: +4 primitives promoted (`HeuresysLogoBadge`, `TimeRangeSelector`, `PageActions`, `StatusIcon` con danger→destructive fix); 9 nuovi ADR governance file (ADR-0002/0003/0004/0005/0006/0007); 7 favicon PNG + 3 social PNG asset (`src/assets/brand/logo/*`, `src/assets/brand/social/*`).
- **apps/web**: 17 showcase pages rebuilt token-driven; legacy `src/lib/theme/` retired (4 file rimossi, PaletteProvider→ThemeProvider unificato); skip-link WCAG 2.4.1; lucide-react direct dep; next/font/google Exo 2 + Inter wired in `/showcase/typography`; 2 script generation (`apps/web/scripts/generate-{favicons,social-kit}.mjs`); `tests/e2e/showcase-a11y.spec.ts` runtime axe-core (18/18 zero-critical).
- **apps/showcase**: `Providers` wrapper (ThemeProvider unified); class="dark" + boot script matching apps/web; sync-showcase.sh dropped lib/theme copy.
- **Audit + governance docs**: `docs/SHOWCASE_AUDIT_2026-05-20.md`, `docs/A11Y_AUDIT_TIER7_2026-05-20.md`, `docs/BRAND_V1_DEFERRED_REFINEMENTS.md`, `docs/a11y-baseline/showcase/*.json` (18 baseline JSONs). ADR-0013 in `docs/architecture/adr/`.

## Verification (next session pre-flight)

```bash
ssh -fN -L 5433:localhost:5432 oracle-vm-default                # tunnel up
cd D:/heuresys-advanced && pnpm --filter @heuresys/web typecheck # expect green
cd D:/heuresys-advanced && pnpm --filter @heuresys/showcase typecheck
git -C D:/heuresys-advanced log --oneline -5
git -C D:/ux-design-shared log --oneline -3
curl -sI https://spen-zosky.github.io/heuresys-advanced/showcase/system-health/   # 200
```

## Resume protocol

1. Read this STATE + `docs/BRAND_V1_DEFERRED_REFINEMENTS.md` se priorità #2 attiva.
2. Per priorità #1 (Goal 003 SDBI) leggi `cowork_code_exchange/_00_SESSION_HANDOFF_2026-05-20.md` PRIMA di toccare.
3. Per priorità #3 (graph renderers) consulta `feedback_brand_before_graph_renderers` memory + le 2 route target (`/visualizations/[id]`, `/organization/org-chart`).
