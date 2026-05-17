# Accessibility tail items (MVP-2a → MVP-3)

> **Status**: MVP-2a/2b acceptance #7 chiusa — **0 violazioni `critical` su 35 rotte × 3 persona group** (WCAG 2.0/2.1 A/AA baseline).
> Tappa G (post-MVP-2 hardening) ha esteso il ruleset a **WCAG 2.2 A/AA** + integrato la checklist manuale del bundle (`docs/a11y-manual-checklist.md`).
> Le rimanenti violazioni (severity `serious` / `moderate` / `minor`) raccolte da `axe-core` durante l'audit di chiusura sono documentate qui come tail items per MVP-3.

---

## Audit di riferimento

- **Spec**: `apps/web/tests/e2e/a11y.spec.ts`
- **Engine**: `axe-core` via `@axe-core/playwright` 4.11.x (+ `axe-playwright` 2.2.x)
- **Ruleset attivi**: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, **`wcag22a`, `wcag22aa`** (estesi in Tappa G)
- **Manual checklist**: `docs/a11y-manual-checklist.md` (14 voci dal bundle + 5 voci WCAG 2.2 AA specifiche)
- **Coverage**:
  - `platformAdmin` (4 rotte): `/dashboard`, `/tenants`, `/admin/roles`, `/users`
  - `tenantAdmin` (17 rotte): tutto il set admin TENANT — `/dashboard`, `/users`, `/positions`, `/blueprints`, `/skills`, `/kpis`, `/learning`, `/gaps`, `/career-succession`, `/compensation-intelligence`, `/organization`, `/processes`, `/seed-acquisition/runs`, `/brownfield-adaptation`, `/visualizations`, `/learning/training-initiatives`, `/organization/org-chart`
  - `employee` (14 rotte): tutto il portale ESS — `/me` + `/me/{profile, positions, skills, learning, gaps, kpis, career, certifications, documents, inbox}` + `/me/skills/self-assessment` + `/me/learning/catalogue` + `/me/career/target`
- **Gate di accettazione**: `bySeverity.critical.length === 0` per ogni rotta.

### Rigenerazione

```bash
# Pre-requisiti: tunnel SSH 5433 up, API+web dev su 3001/3000.
cd apps/web
pnpm exec playwright test a11y.spec.ts
```

Lo spec scrive un summary JSON per rotta in `apps/web/test-results/a11y-audit/<route>.json`:

```json
{
  "route": "/dashboard",
  "summary": "critical=0 serious=N moderate=M minor=K",
  "timestamp": "2026-05-17T...",
  "violations": [
    { "id": "color-contrast", "impact": "serious", "nodes": 4, "help": "...", "helpUrl": "..." }
  ]
}
```

---

## Categorie tail attese (priorità qualitativa)

Dal pattern dei design system Tailwind 4 + Radix non specificamente auditati a livello WCAG 2.1 AA si attendono concentrazioni in:

| Categoria axe-core | Severità tipica | Causa probabile nel design system | Pattern di fix |
|---|---|---|---|
| `color-contrast` | serious | Token `text-muted-foreground` su `bg-card` con contrast < 4.5:1 in dark areas | Ritarare la palette in `@heuresys/ui` (single source) — aggiornare CSS var `--muted-foreground` |
| `label` / `label-content-name-mismatch` | serious | `<input>` con `aria-label` ma senza `<label htmlFor>` esplicito; o label "Submit" su button con icon-only | Audit di tutti i form fields in `@heuresys/ui/Input`, `Select`, `Combobox` |
| `button-name` / `link-name` | serious | Icon-only `Button` / `IconButton` senza `aria-label` esplicito (e.g. paginazione, dismiss) | Convenzione: ogni `<Button>` con solo `<Icon>` deve avere `aria-label={t("...")}` |
| `region` / `landmark-one-main` | moderate | Layout senza `<main>` esplicito o landmark ARIA duplicati | Verificare che `(authenticated)/layout.tsx` e `/login` espongano un singolo `<main>` |
| `heading-order` | moderate | Pagine che saltano da `h1` a `h3` per styling reasons | Convenzione: `h1` di pagina sempre presente; sezioni in `h2`; sub in `h3` |
| `image-alt` | serious-moderate | `<img>` decorative senza `alt=""`; logo SVG senza title | Audit di `@heuresys/ui/Avatar`, `Logo`, `Illustration` |
| `aria-allowed-attr` / `aria-required-attr` | serious | Radix primitives wrapper-ed in modo sub-ottimale (es. `Dialog.Trigger` con `aria-expanded` duplicato) | Tornare ai primitives Radix puri senza pass-through extra |
| `tabindex` | moderate | `tabindex` positivi su widget custom | Sostituire con `tabindex="0"` o `-1` per logica di focus management |
| `frame-title` | minor | Eventuali `<iframe>` da renderer charts senza title | N/A oggi (no iframe), futuro per Tier 3+ embed |
| `duplicate-id` | minor | Component duplicato in pagine ricche (es. due `<details>` con stesso id) | Audit a14yi tramite ID stabili o generated ids |

---

## Strategia di chiusura per MVP-3

1. **Bulk fix per pattern**: tipico è che una violazione (es. `color-contrast` su `text-muted-foreground`) colpisce 20-30 rotte simultaneamente. Una singola modifica nel token del design system risolve tutto. Stima 80% delle violazioni serious sono "design system tier 1".
2. **Audit `@heuresys/ui`**: la library a monte è il punto di leva. Aggiungere uno step di axe-core anche allo Storybook di `ux-design-shared` per catturare le violazioni a livello primitive prima che si propaghino ai consumer.
3. **Mantenere il gate critical=0**: la spec `a11y.spec.ts` resta nella CI come gate non-regression. Inalzare la soglia (es. `serious === 0`) solo quando le violazioni sono <10 stabilmente.
4. **WCAG 2.2 AA full**: target post-MVP-3 una volta che `serious` è zero. WCAG 2.2 aggiunge AAA-likable rules (touch target size, focus appearance) trattate fuori dal MVP boostrap.

---

## Out-of-scope per oggi

- Audit con `wcag2aaa` / `wcag21aaa` / `wcag22aa` (target MVP-3).
- Mobile / responsive audit (target MVP-3 — l'app oggi è desktop-first).
- Keyboard navigation manual test (Tab order, Skip-to-content, modal focus trap) — `axe-core` cattura solo subset.
- Screen reader narrative test (NVDA / JAWS / VoiceOver) — manual QA fuori MVP bootstrap.
- Hi-contrast / forced-colors mode (Windows hi-contrast).

---

**Owner**: Claude Opus 4.7 + Enzo.
**Audit run di riferimento**: 2026-05-17 (HEAD `85562eb` + audit spec creata su sessione closure).
**Re-audit consigliato**: in apertura di ogni nuova UI feature touching `@heuresys/ui` o aggiunta di rotte.
