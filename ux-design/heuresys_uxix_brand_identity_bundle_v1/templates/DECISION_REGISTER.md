# Heuresys UX/IX Decision Register

Use this register for all UX/IX, brand identity, page layout, asset, component and visual-system decisions.

| Decision ID | Date | Category | Title | Status | Final Decision | Showcase Reference | Supersedes | Superseded By | Impacted Areas |
|---|---:|---|---|---|---|---|---|---|---|
| UXIX-0001 | YYYY-MM-DD | Shell | Dashboard shell structure | Accepted | Header + Body(Sidebar/Main) + Footer fixed viewport shell | /showcase/shell | - | UXIX-2026-05-20 | DashboardShell, Header, Sidebar, Footer |
| UXIX-0002 | YYYY-MM-DD | Header | Header mandatory composition | Accepted | Left: hamburger + Heuresys SVG logo. Right: IT/EN, palette boxes, theme switcher, user menu/logout. | /showcase/header | - | UXIX-2026-05-20 | Header |
| UXIX-0003 | YYYY-MM-DD | Footer | Footer left composition | Accepted | © year + clickable Heuresys.com SVG logo + icon-only social links. | /showcase/footer | - | UXIX-2026-05-20 | Footer |
| UXIX-2026-05-20 | 2026-05-20 | Brand promotion | SUPERUSER prototype patterns ratified as default | Accepted | Tutti i 20 pattern del prototype canonical `ux-design/prototypes/superuser-system-health.html` promossi a default ufficiale del brand. Bundle docs 06/07/09/12/13/16 aggiornati + governance INTERACTION_REGISTER + 13 nuovi code_examples + asset CSS/JS (hover-affordance + table-cursor). @heuresys/ui implementa i pattern come 14 nuovi component + 1 brand mark + estensione styles. apps/web autenticato adotta HeuresysWordmark + PaletteSwitcher + ThemeToggle + KPIStrip. apps/showcase ha nuova page `system-health` come live demo completa. Commit chain in heuresys-advanced: `145d4d6` `12e1035` `fd8079e` (+ HANDOFF/DECISION update). Commit local in ux-design-shared (NO push): `8224abd` `cba8120`. Doctrine: ogni nuova page dashboard DEVE usare DashboardShell + DashboardHeader + DashboardSidebar + DashboardFooter da @heuresys/ui/dashboard/*. | /showcase/system-health | UXIX-0001, UXIX-0002, UXIX-0003 (parzialmente) | - | Bundle docs, code_examples, governance, @heuresys/ui, apps/web layout/login/dashboard, apps/showcase index |

## Status values

- Proposed
- Accepted
- Superseded
- Rejected
- Needs Review

## Rule

Do not delete superseded decisions. Mark them as `Superseded` and link them to the new active decision.
