# Showcase Audit — 2026-05-20

Audit a tappeto delle 18 showcase pages (`apps/web/src/app/showcase/*`) contro la canonical `/showcase/system-health`. Output: gap catalog cross-page + rebuild order motivato.

- **Audit method**: source read (16 page.tsx + root index + canonical SystemHealthDashboard) + commit history analysis. Visual cross-check non eseguito su GH Pages (audit è strutturale, non rendering).
- **Baseline commit**: `a30a55a` (post-lucide-restore + ADR-0013).
- **Confronto**: ogni page vs il pattern canonico definito da `apps/web/src/components/SystemHealthDashboard.tsx`.

## 1. Reference brand-default (canonical)

Il pattern di riferimento `/showcase/system-health` ha questi tratti distintivi (tutti da rispettare nelle pages rebuildate):

| Tratto | Implementazione | Source |
|---|---|---|
| Shell composito | `DashboardShell` + `DashboardHeader` + `DashboardSidebar` + `DashboardFooter` | `@heuresys/ui` primitives |
| Logo | Inline SVG wordmark "heuresys" Exo 2 700, `hsl(221 83% 53%)` body + `#a855f7` accent | `SystemHealthDashboard.tsx:55-68` |
| Logo badge | `<span>advanced</span>` con border + bg-card + uppercase tracking-wider | `SystemHealthDashboard.tsx:70-74` |
| Icons | `lucide-react` direct import (post-restore) | `SystemHealthDashboard.tsx:37-39` |
| KPI primitives | `KPIStrip`, `AlertBanner`, `AuditFeed`, `IncidentTimeline`, `LogStream`, `RBACMatrix`, `SQLSlowQueryTable`, `TenantFleetTable`, `ErrorRateBreakdown`, `DBSupervisorSidebar` | `@heuresys/ui` |
| Color system | CSS vars `--background`, `--foreground`, `--card`, `--border`, `--muted`, `--accent`, `--palette-1..4`, `--color-icon-*` + semantic tones `success/warning/danger/info` | tokens.css in `@heuresys/ui/styles` |
| Time range selector | 15m / 1h / 24h / 7d / 30d pill row + Refresh + Export buttons | `SystemHealthDashboard.tsx:179-213` |
| Pulse animations | `pulse-dot` utility | tokens.css |
| Hover affordance | universal hover via `hx-card-hover` + cross-hair tables | tokens.css |

## 2. Gap pattern catalog (cross-page)

Sei pattern di disallineamento ricorrenti, ordinati per severità:

| # | Pattern | Severità | Pages affette |
|---|---|---|---|
| **G1** | Non usa `DashboardShell`/`DashboardHeader`/`DashboardSidebar`/`DashboardFooter`: ridisegna lo shell come mock locale | **alta** | shell, header, footer, sidebar (16/16 escluse fondazionali by design — vedi note) |
| **G2** | Color values hex hardcoded (es. `#2563EB`, `#0F1828`, `#1F2937`) invece di `var(--palette-1)` o token semantico → palette switch non si riflette | **alta** | header, footer, charts, landing-page, primary-initial-page |
| **G3** | Tailwind hard utility (`bg-blue-50`, `text-blue-700`, `bg-emerald-100`, `text-amber-900`) per status/accent → idem G2, palette switch non si riflette | **alta** | sidebar, login-page, primary-initial-page, page-types, dashboard-cards, forms, tables, charts, landing-page (9/16) |
| **G4** | Icons page reinventa SVG path inline invece di usare lucide-react primitives (ADR-0008 dice "Lucide React outline 1.75 stroke") | **media** | icons |
| **G5** | Non usa primitives `KPIStrip`/`AlertBanner`/`DataTable`/`AuditFeed` da `@heuresys/ui` quando pertinente → duplicazione layout/style | **media** | dashboard-cards (custom KpiCard/SparklineCard/ProgressCard/MultiStatCard), tables (custom Table), charts (custom Heatmap/LineChart/BarChart/Donut) |
| **G6** | Heuresys wordmark canonical (`SystemHealthDashboard.tsx:55-68`) non promosso a primitive `@heuresys/ui/brand/HeuresysWordmark` — vive solo in `SystemHealthDashboard.tsx` | **media** | tutte (le altre usano `LogoCandidateAFull` proxy, non il wordmark canonical |

## 3. Per-page audit (compatto)

`State`: `live` (canonical) / `scaffold-ok` (skeleton coerente col subject) / `scaffold-rebuild` (skeleton ma con G1-G6 gravi). `UXIX`: decision ID. `K-Gaps`: count gap critici.

| Page | UXIX | Status auto | Shell | Lucide | Tokens | K-Gaps | Effort | Note |
|---|---|---|---|---|---|---|---|---|
| `/showcase/system-health` | 2026-05-20 | **live** | ✅ | ✅ | ✅ | 0 | — | Canonical reference |
| `/showcase/shell` | 0001 Accepted | scaffold-rebuild | ❌ mock div grid | ❌ | ✅ tokens | G1 | 2h | Sostituire `ShellDemo` con vero `<DashboardShell>` da `@heuresys/ui` |
| `/showcase/header` | 0002 Proposed | scaffold-rebuild | ❌ HeaderMock | ❌ | ❌ hex hardcoded `#0F1828`,`#1F2937`,`#374151`,`#D1D5DB`,`#DBEAFE`,`#1E40AF`,`#FFFFFF`,`#E2E6EE` | G1,G2 | 2h | Sostituire HeaderMock con `<DashboardHeader>` reale, varianti standard + with-breadcrumb |
| `/showcase/footer` | 0003 Proposed | scaffold-rebuild | ❌ FooterMock | ❌ | ❌ hex hardcoded `#0F1828`,`#1F2937`,`#374151`,`#FFFFFF`,`#E2E6EE` | G1,G2 | 1.5h | Sostituire FooterMock con `<DashboardFooter>` reale, rightSlot dinamico |
| `/showcase/sidebar` | 0004 Proposed | scaffold-rebuild | ❌ SidebarMock | ❌ | ⚠️ misto: tokens + `bg-blue-50/text-blue-900` per active | G1,G3 | 2h | Sostituire SidebarMock con `<DashboardSidebar>` reale; active row deve usare `--accent`/`--palette-1`, non blue-50 |
| `/showcase/palettes` | 0005 Proposed | scaffold-ok+cleanup | ❌ by design | ❌ | ⚠️ 5 candidate hex by design ma `bg-amber-50/text-amber-900` per warning box | G3 (low) | 1h | Subject è palette switching → OK come-è. Cleanup PaletteProvider legacy + integrazione PaletteDropdown brand default è priorità separata (vedi §6) |
| `/showcase/typography` | 0006 Proposed | scaffold-ok | ❌ by design | ❌ | ✅ tokens | 0 | 0.5h | Solo wire-up Exo 2 webfont via `next/font` per fare living preview |
| `/showcase/logo` | 0007 Proposed | scaffold-ok | ❌ by design | ❌ | ⚠️ `bg-neutral-900` hardcoded per dark preview | G3 (low) | 0.5h | Già usa `@heuresys/ui/brand/candidates`. Solo dark preview color tokenize |
| `/showcase/icons` | 0008 Accepted | scaffold-rebuild | ❌ by design | ❌❌ SVG path inline invece di lucide | ❌ hex `#64748B`,`#2563EB`,`#16A34A`,`#F59E0B`,`#DC2626`,`#CBD5E1`,`#475569` | G2,G4 | 2.5h | **Critico**: importare 11 lucide icons direct + `StatusIcon` semantic-tone wrapper + colori da `--color-icon-*` token. Allineamento esplicito con ADR-0013 R2 (lucide already direct dep). |
| `/showcase/page-types` | — | scaffold-ok | ❌ by design | ❌ | ⚠️ `bg-blue-100`, `bg-blue-500`, `bg-blue-600` per highlights | G3 (low) | 1h | 8 sketches didattici. Tokenize i blue-* highlights |
| `/showcase/dashboard-cards` | — | scaffold-rebuild | ❌ | ❌ | ⚠️ tokens + `bg-blue-600`,`text-emerald-700`,`text-red-700`, custom hex in MultiStatCard | G3,G5 | 3h | **Sostituire** SimpleKpiCard/SparklineCard/ProgressCard/MultiStatCard/ActivityCard custom con `<KPIStrip>` + `<AuditFeed>` da `@heuresys/ui`; tokenize semantic colors |
| `/showcase/forms` | — | scaffold-ok | ❌ by design | ❌ | ⚠️ `accent-blue-600`, `bg-blue-600`, `text-blue-700` | G3 (low) | 1.5h | OK come reference form. Tokenize blue-* in button/accent |
| `/showcase/tables` | — | scaffold-rebuild | ❌ | ❌ | ⚠️ tokens + `bg-blue-50/text-blue-900`, `bg-emerald-100`, `bg-amber-100` per status pill | G3,G5 | 2.5h | **Sostituire** custom Table con `<DataTable>` da `@heuresys/ui`; status pill colors da `--color-icon-*` |
| `/showcase/charts` | — | scaffold-rebuild | ❌ | ❌ | ❌❌ hex hardcoded ovunque: `#2563EB`,`#E2E6EE`,`#DC2626`,`#F59E0B`,`#16A34A`,`#475569`,`#64748B`,`#0F1828`,`#FFFFFF`,`#E5E7EB` | G2 | 3h | **Critico per palette switch**: SVG inline charts con hex hardcoded → non rispondono al palette change. Sostituire con `currentColor` + CSS vars `var(--palette-N)` |
| `/showcase/landing-page` | — | scaffold-rebuild | ❌ by design | ❌ | ❌ `bg-neutral-900`, `text-blue-400`, `bg-blue-600`, `bg-blue-700`, `bg-blue-50` | G2,G3 | 4h | Marketing surface, shell-less by design. Però hero `bg-neutral-900` + CTA `bg-blue-600` sono hardcoded → palette switch invisibile. Tokenize tutto |
| `/showcase/login-page` | — | scaffold-rebuild | ❌ by design | ❌ | ⚠️ tokens + `bg-blue-900`, `text-blue-400`, `bg-blue-600`, `text-blue-700`, `accent-blue-600` | G3 | 3h | Shell-less by design. Hero side blue-900 + form CTA blue-600 da tokenize. Wordmark canonical da promuovere a `HeuresysWordmark` primitive e usare qui |
| `/showcase/primary-initial-page` | — | scaffold-rebuild | ❌ | ❌ | ⚠️ tokens + `bg-blue-50`,`text-blue-700`, `bg-purple-100`,`bg-emerald-100`,`bg-amber-100` per tag colors | G1,G3 | 3h | Dovrebbe dimostrare la primary initial **dentro DashboardShell**, non come full-width senza shell. Tag colors tokenize |

## 4. Anomalie rilevanti (per-page, solo dove serve dettaglio)

### `/showcase/icons` — duplica lucide invece di importarlo
Il file ridisegna 11 SVG path manualmente (`STATUS_ICONS` + `NAV_ICONS` in `icons/page.tsx:17-31`) e li renderizza con `IconSvg` locale che ignora `currentColor` e prende color da prop. Con ADR-0013 R2 e lucide ora direct dep di `apps/web` + `apps/showcase`, va importato da `lucide-react`: `CheckCircle, AlertTriangle, XCircle, Info, Clock, Users, Briefcase, Layers, BarChart3, BookOpen, Settings`. Inoltre il `StatusIcon` wrapper menzionato nel testo non esiste in `@heuresys/ui` — va creato e promosso lì se è la canonical primitive.

### `/showcase/charts` — palette switch non funziona
Inline SVG con hex hardcoded in 4 chart variants. Heatmap usa `fill="#2563EB"` (linea 37), LineChart usa `stroke="#2563EB"` (65) + `stroke="#E2E6EE"` (63,64) + `fill="#2563EB"` (66,67), BarChart usa `fill="#E2E6EE"` (97) + `fill="#2563EB"` (98) + `fill="#0F1828"` (99), Donut usa colori semantic hardcoded (109-112). Refactor: tutti i `#2563EB` → `var(--palette-1)`, `#E2E6EE` → `var(--border)`, `#16A34A/#F59E0B/#DC2626` → `var(--color-icon-success/warning/danger)`. SVG fill/stroke accettano CSS vars via `currentColor` o computed-style.

### `/showcase/primary-initial-page` — manca shell
Per ADR-0011 ESS è la "primary authenticated initial page" — atterraggio post-login. Doctrine: vive **dentro** `DashboardShell` (header + sidebar + footer + main content). Attualmente è full-width div sequence senza shell. Rebuild: wrappare in `<DashboardShell>` con sidebar appropriata (Workforce groups), header con user+breadcrumb, footer canonical.

### `/showcase/palettes` — PaletteProvider legacy in conflitto
Da `STATE.md` (priority #3): il sistema 5-candidate iniettato da `apps/web/src/lib/theme/PaletteProvider.tsx` su `<html>` confligge con il `PaletteDropdown` brand default (4-preset balanced) introdotto in S924 (commit `19168dd`). Cleanup tracciato a parte (vedi §6 — task indipendente da rebuild della page palettes stessa).

## 5. Gap di promozione (componenti che andrebbero in `@heuresys/ui`)

Componenti definiti localmente in `apps/web/src/components/SystemHealthDashboard.tsx` che la canonical ha hardcoded ma andrebbero come primitive `@heuresys/ui`:

1. **`HeuresysWordmark`** (canonical wordmark SVG, righe 55-68) → `@heuresys/ui/brand/HeuresysWordmark.tsx`. Consumers: header showcase, login-page, landing-page, primary-initial-page, e tutte le future pages che hostano il logo.
2. **`HeuresysLogoBadge`** (badge "advanced", righe 70-74) → `@heuresys/ui/brand/HeuresysLogoBadge.tsx`.
3. **`TimeRangeSelector`** (pill row 15m/1h/24h/7d/30d, righe 180-186) → `@heuresys/ui/dashboard/TimeRangeSelector.tsx`. Comune a system-health, dashboard-cards rebuild, charts rebuild.
4. **`PageActions`** (Refresh + Export pattern, righe 188-212) → `@heuresys/ui/dashboard/PageActions.tsx`.
5. **`StatusIcon`** (semantic-tone wrapper menzionato in `icons/page.tsx:50`) → `@heuresys/ui/StatusIcon.tsx`. Discriminated tone `info|success|warning|danger|neutral|disabled` → semantic token color.

Promuovendoli ora si rispetta ADR-0013 R1 (no-edit zone sul mirror) e ADR-0013 R2 (portability invariant).

## 6. Rebuild order proposal (3 tier)

**Tier 1 — Foundation** (sblocca pattern per tier 2/3): 8-10h, 1 sessione lunga o 2 corte.

1. **Promozione primitives** (1.5h) — `HeuresysWordmark`, `HeuresysLogoBadge`, `TimeRangeSelector`, `PageActions`, `StatusIcon` in `@heuresys/ui`. Refactor `SystemHealthDashboard.tsx` per consumarli (no behavior change, only refactor).
2. **shell** (2h) — sostituire `ShellDemo` con vero `<DashboardShell>`, mostrare expanded/collapsed via state.
3. **header** (2h) — sostituire `HeaderMock` con `<DashboardHeader>`, varianti standard + with-breadcrumb, light + dark surface tokenizzati.
4. **footer** (1.5h) — sostituire `FooterMock` con `<DashboardFooter>`, rightSlot dinamico, light + dark.
5. **sidebar** (2h) — sostituire `SidebarMock` con `<DashboardSidebar>`, expanded + collapsed, groups + customContent + active state via `--accent`/`--palette-1`.

**Tier 2 — Brand consistency** (2-4h, single session): 1 sessione.

6. **icons rebuild** (2.5h) — rimuovere SVG inline custom, importare 11 lucide icons direct, creare `StatusIcon` con tone→`--color-icon-*` mapping. Aggiornare ADR-0008 conformance check.
7. **PaletteProvider cleanup** (separato dalla page palettes — 2-3h, priority #3 dallo STATE.md). Dismantle legacy 5-candidate inject su `<html>`, lasciare solo `PaletteDropdown` brand default. Non blocca rebuild altre pages ma è prerequisito per validare che palette switch funzioni effettivamente.

**Tier 3 — Composite + entry-points** (10-15h, 3-5 sessioni):

8. **charts rebuild** (3h) — hex → CSS vars, abilita palette responsivity.
9. **dashboard-cards rebuild** (3h) — custom cards → `<KPIStrip>` + `<AuditFeed>`.
10. **tables rebuild** (2.5h) — custom Table → `<DataTable>` + status pill tokens.
11. **primary-initial-page rebuild** (3h) — wrappare in `<DashboardShell>`, tag colors tokenize.
12. **login-page rebuild** (3h) — usare `HeuresysWordmark` promosso; tokenize blue-* CTA/hero.
13. **landing-page rebuild** (4h) — marketing surface, tokenize hero+CTA, preserva shell-less.
14. **forms tokenize** (1.5h) — solo tokenize blue-*, no rebuild strutturale.
15. **typography wire** (0.5h) — Exo 2 via `next/font`.
16. **logo tokenize dark preview** (0.5h) — `bg-neutral-900` → token dark surface.
17. **page-types tokenize** (1h) — blue-* highlights → tokens.

## 7. Effort totale e dipendenze

| Tier | Pages | Effort | Sessioni | Sblocca |
|---|---|---|---|---|
| 1 Foundation | 5 (incl. primitive promotions) | 8-10h | 1 lunga / 2 corte | tutto tier 2+3 |
| 2 Brand consistency | 2 (icons + PaletteProvider) | 4-5h | 1 | validation palette switch |
| 3 Composite + entry | 10 | 18-22h | 3-5 | full coverage |
| **Totale** | **17 pages + 5 primitives** | **30-37h** | **5-7 sessioni** | brand v1 closure |

Una sessione ~4-6h è il pattern già osservato (S924 ha shippato 15 commit in ~7h di lavoro). 5-7 sessioni è realistico per chiudere brand v1 completamente.

## 8. Aspetti deliberatamente NON nell'audit

- **Visual rendering** non eseguito (audit strutturale by design — i pattern di gap sono identificabili da codice senza screenshot).
- **A11y / WCAG compliance** non auditata (Tier 7 separato del bundle `governance/ACCESSIBILITY_CHECKLIST.md`).
- **Performance metric** (bundle size, FCP) non misurate (la canonical `/showcase/system-health` è già 1.55 MB; le altre 16 sono 218 B — atteso post-rebuild che salga proporzionalmente).
- **Decisione UXIX-0005/0006/0007** (quale palette/typography/logo scegliere) NON è scope di questo audit — è una decisione di Product Owner. L'audit identifica i gap _indipendentemente_ dalle scelte UXIX ancora aperte.

## References

- ADR-0013 `docs/architecture/adr/0013_showcase_sot_policy.md` (SoT policy, R1/R2/R3)
- ADR-0008 (icons = lucide)
- ADR-0011 (ESS scope + primary initial page definition)
- Canonical: `apps/web/src/components/SystemHealthDashboard.tsx` post-`a30a55a`
- Brand bundle: `ux-design/heuresys_uxix_brand_identity_bundle_v1/docs/16_system_health_admin_dashboard_patterns.md`
- Live deploy: https://spen-zosky.github.io/heuresys-advanced/showcase/system-health/
- Companion priority list: `.handoff/STATE.md` §"Top priorities (next session)"
