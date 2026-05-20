# heuresys-advanced — STATE

**Updated**: 2026-05-20 17:40 GMT+2
**Branch**: `main` — clean, synced con `origin/main` (push completato)
**Last commit**: `c2226a4` ci(showcase): include apps/web/src/components/** + layout.tsx in trigger paths

## Last session brief

SUPERUSER prototype patterns promossi a brand default. 15 commit heuresys-advanced + 6 commit ux-design-shared (prima push, upstream set). GitHub Pages deploy LIVE: https://spen-zosky.github.io/heuresys-advanced/showcase/system-health/ — canonical dashboard con tutti i 20 pattern, tema dark default, logo wordmark hardcoded.

## Top priorities (next session)

1. **Goal 003 closure HALT_STATE** (ereditata da S923, NOT toccata in questa sessione) — leggere `cowork_code_exchange/.inbox/cli/pending/` per Cowork Z-decision (Z1/Z2/Z3 su 5 INFEASIBLE targets). Se Z1: Wave 1 retry P1-only + Item L REPORT 003 + STATE finalize atomic commit. **Effort ~4-5 turn**. Vedi `cowork_code_exchange/_00_STATE_003.md` + `_03_EXEC_003_CLASSB_UQ_BLOCK_Item_F.md`.
2. **Showcase altre pages rebuild a brand-default standard** — le 5 page (shell/header/footer/sidebar/palettes) + 11 altre showcase scaffolds restano in stato "skeleton" UXIX-0001..0005. La canonical `/showcase/system-health` è il reference. Effort ~15 page × 1-2h cad = 15-30h (multi-session). Doctrine: ogni nuova page DEVE usare DashboardShell + DashboardHeader + DashboardSidebar + DashboardFooter da `@heuresys/ui/dashboard/*`.
3. **PaletteProvider 5-candidate apps/web cleanup** — sistema legacy UXIX-0005 ancora attivo, inietta inline su html, in conflitto col PaletteDropdown brand default (4-preset balanced). Dopo decisione UXIX-0005 ratificata, dismantle PaletteProvider e usare SOLO PaletteDropdown. Effort ~2-3h.

## Open questions (next session)

- **Z-decision Goal 003** (Z1/Z2/Z3) ancora pending da S923 — non ho touched in questa sessione.
- **PaletteProvider 5-candidate**: smontare o tenere parallel? Conflitto con default balanced del nuovo dropdown.
- **Untracked Cowork artefacts** in `cowork_code_exchange/` (DISCOVERY/PROMPT/PLAN/APPROVAL/EXEC files Goal 001+002+003) — committarli o lasciare untracked? Stesso stato di S923.

## Stack snapshot (deltas vs S923)

- **Brand bundle**: 5 docs estesi (06/07/09/12/13) + 16 nuovo + governance INTERACTION_REGISTER_TEMPLATE + 13 nuovi code_examples + hover-affordance.css + table-cursor.ts. 4 SVG logo ufficiali in assets/logo/.
- **`@heuresys/ui` (D:/ux-design-shared)**: PRIMA PUSH ad origin/main. 14 nuovi dashboard components + HeuresysMark + hover-affordance.css (color-mix-based per supportare hex/HSL) + table-cursor.ts. wordmark.tsx con BRAND_BLUE + BRAND_PURPLE hardcoded (regola "logo sempre quello").
- **apps/web**: layout authenticated con HeuresysWordmark. Login con wordmark hero. Dashboard con KPIStrip. globals.css `@source` Tailwind v4 + `@theme inline` mapping + dark+light tokens shifted (--accent #EEF2F8 → #D9E1EF per contrast). Root layout default `<html class="dark">` + boot inline script. NEW `src/components/SystemHealthDashboard.tsx` (canonical port del prototype, inline SVG icons no lucide dep). NEW route `/system-health` PLATFORM_ADMIN-gated + `/showcase/system-health` con fullscreen layout takeover.
- **apps/showcase**: sync-showcase.sh include `src/components/**`. Workflow paths estesi a `apps/web/src/components/**` + `apps/web/src/app/layout.tsx`.
- **GitHub Pages**: deploy LIVE @ https://spen-zosky.github.io/heuresys-advanced/showcase/system-health/ (HTTP 200, 131KB, smoke-check 12/12 keywords presenti).

## Verification (next session pre-flight)

```bash
ssh -fN -L 5433:localhost:5432 oracle-vm-default
PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT 1"
cd D:/heuresys-advanced && pnpm --filter @heuresys/api test         # expected 318 passed | 5 skipped (no regression)
cd D:/heuresys-advanced && pnpm --filter @heuresys/web typecheck    # expected green
cd D:/heuresys-advanced && pnpm --filter @heuresys/showcase typecheck
git log --oneline -5                                                # last c2226a4
curl -sI https://spen-zosky.github.io/heuresys-advanced/showcase/system-health/   # HTTP 200
```

## Resume protocol

1. Read `cowork_code_exchange/_00_STATE_003.md` se priority #1 (Goal 003 closure) attiva
2. Check `cowork_code_exchange/.inbox/cli/pending/` per Cowork Z-decision message
3. Apri https://spen-zosky.github.io/heuresys-advanced/showcase/system-health/ per visual reference brand default
4. Read `ux-design/heuresys_uxix_brand_identity_bundle_v1/docs/16_system_health_admin_dashboard_patterns.md` per per-widget specs
5. Doctrine: ogni nuova page dashboard USA `@heuresys/ui/dashboard/*` primitives
