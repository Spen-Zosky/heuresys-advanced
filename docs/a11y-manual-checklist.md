# Accessibility manual checklist — heuresys-advanced

> **Status (2026-05-17)**: automated axe-core gate green (zero critical on
> 35 routes × 3 persona groups, WCAG 2.0 A/AA + 2.1 A/AA + **2.2 A/AA**).
> This document covers the **17 manual items** from the brand bundle's
> accessibility checklist that axe-core cannot fully validate. Run before
> each release tag.
>
> **Nota del 2026-11-25 (com'è oggi).** I cinque file `governance/` del bundle UX/IX v1 (accessibilità, criteri di accettazione, cancelli di qualità, QA visiva, modello del registro delle interazioni) sono accorpati qui, nella sezione «Criteri del bundle UX/IX v1», e ritirati dal repository; si recuperano dal registro dei ritiri (`docs/piani/riordino-documentazione_20261125/REGISTRO_RITIRI.tsv`). Dove un criterio del bundle e le regole UI di oggi non coincidono, valgono le regole di oggi.

The bundle gate must be satisfied **in addition to** the automated axe gate
(see `apps/web/tests/e2e/a11y.spec.ts`). Manual review is owned by the
maintainer; results are recorded inline below at each release.

## Procedure

1. Run the automated audit: `cd apps/web && pnpm exec playwright test a11y.spec.ts`. Expect critical=0.
2. Boot dev: `pnpm dev` on api (3001) + web (3000), tunnel 5433 up.
3. Open `http://localhost:3000`, walk through each persona (5 from `tests/e2e/fixtures.ts`).
4. Tick each manual item below for each release.

## Checklist v0.2.0-mvp2 (closure baseline, 2026-05-17)

Persona coverage required for the manual pass: `platformAdmin`,
`tenantAdmin`, `manager`, `employee` (USER), `outsider` (USER).

### Bundle items (mirror of the bundle accessibility checklist)

- [ ] All icon-only controls have accessible labels (header logout, social icons in footer, table sort/filter buttons, dialog close buttons).
- [ ] All external links have meaningful aria-labels where icon-only (footer social links: LinkedIn, GitHub, X, Facebook — verify each).
- [ ] Keyboard can access header controls (Tab through hamburger → logo → language switcher → palette switcher → theme switcher → user menu → logout).
- [ ] Keyboard can access sidebar controls (Tab into nav, ↑/↓ traverses items, Enter activates link).
- [ ] Keyboard can open/close tree groups (Enter or Space on group header toggles state).
- [ ] Keyboard can use tabs (top tabs on module pages — Left/Right or Tab navigates, Enter activates).
- [ ] Focus ring is visible on every interactive element (no `outline: none` without replacement) in both light and dark modes.
- [ ] Color contrast is acceptable in light mode (`prefers-color-scheme: light`, all text ≥ 4.5:1, large text ≥ 3:1).
- [ ] Color contrast is acceptable in dark mode (`prefers-color-scheme: dark`, all text ≥ 4.5:1, large text ≥ 3:1).
- [ ] Status meaning is not conveyed only by color (icons + text labels accompany every status: success ✓, warning ⚠, danger ✗, info ℹ).
- [ ] Reduced-motion preferences are respected (`prefers-reduced-motion: reduce` disables non-essential transitions; verify framer-motion + Tailwind transitions).
- [ ] Menus and dropdowns use accessible primitives (`@heuresys/ui` uses Radix UI under the hood — verify Dialog, DropdownMenu, Combobox, Select).
- [ ] Forms have labels and validation messages (every `<input>` has either `<label htmlFor>` or visible `aria-label`; error messages associated via `aria-describedby` or `aria-invalid`).
- [ ] Breadcrumb is accessible navigation (`<nav aria-label="breadcrumb">` with `aria-current="page"` on the leaf).

### Additional items (WCAG 2.2 AA specific, not in bundle)

- [ ] Target size minimum 24×24 CSS px (WCAG 2.2 SC 2.5.8 AA) for all clickable controls outside text contexts. Verify pagination buttons, icon buttons, social footer icons.
- [ ] Focus not obscured (WCAG 2.2 SC 2.4.11 AA): when keyboard-focusing an element, no other UI element (sticky header, sticky footer, fixed banner) hides part of the focus ring.
- [ ] Accessible authentication (WCAG 2.2 SC 3.3.8 AA): login does not require cognitive function tests (no CAPTCHA, no "what is 2+2"). Standard email+password is compliant; verify MFA flow when implemented.
- [ ] Consistent help (WCAG 2.2 SC 3.2.6 A): if a help link/email/chat is present, it appears in a consistent location across pages.
- [ ] Redundant entry (WCAG 2.2 SC 3.3.7 A): multi-step forms do not re-ask the same info already provided in the same session (verify `/me/career/target` if it spans multiple steps).

## Reporting findings

When a checklist item fails:

1. Open an issue with template `bug_report.yml` and label `area/a11y`.
2. Add an entry to `docs/a11y-tail-items.md` under the appropriate severity column.
3. If the violation is `critical` per WCAG impact mapping, **block the release**. Lower severities are tail and can ship with the next maintenance window.

## Tooling references

- Automated: `apps/web/tests/e2e/a11y.spec.ts` — axe-core with `wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22a,wcag22aa` tags.
- Per-route JSON summaries: `apps/web/test-results/a11y-audit/<route>.json`.
- Tail items register: `docs/a11y-tail-items.md`.
- Bundle source: the 14 items above, accorpati dal bundle UX/IX v1 il 2026-11-25 (copia originale nel registro dei ritiri).

## Criteri del bundle UX/IX v1 (accorpati il 2026-11-25)

Dal bundle `ux-design/heuresys_uxix_brand_identity_bundle_v1/` (maggio 2026). Sono i criteri con cui la shell e il sistema visivo erano stati accettati; si usano ancora come lista di controllo prima di presentare una pagina nuova.

### Criteri di accettazione

- Architettura: la shell ha intestazione, barra laterale, area principale e piè di pagina; intestazione e piè di pagina sono persistenti, a tutta larghezza, e non cambiano quando la barra laterale si chiude o si apre; barra laterale e area principale scorrono in modo indipendente; la barra laterale sta fra intestazione e piè di pagina, si chiude e si apre, ha gruppi ad albero richiudibili con uno stato separato da quello della barra; le schede in alto si usano solo dove servono.
- Intestazione: a sinistra il menu e il logo SVG; a destra il selettore di lingua IT/EN, il selettore di palette, il selettore chiaro/scuro e l'avatar dell'utente con il menu che espone l'uscita.
- Piè di pagina: copyright con l'anno corrente, logo Heuresys.com cliccabile, collegamenti a sole icone (LinkedIn, GitHub, X, Facebook) con `target="_blank"` e `rel="noopener noreferrer"`.
- Identità: design token, palette per chiaro e scuro, tipografia centralizzata, icone a contorno con colori semantici dai token, logo e favicon SVG.
- Governo: le decisioni accettate si registrano nel registro delle decisioni del bundle, quelle superate non si cancellano, e ogni accettazione porta l'evidenza della QA.

### Cancelli di qualità

- Codice: typecheck, ESLint, formattazione e build di produzione verdi; nessun errore nella console del browser né di idratazione React.
- Comportamento: intestazione e piè di pagina restano visibili; barra laterale e area principale scorrono dentro di sé e un contenuto lungo non spinge fuori intestazione o piè di pagina; la chiusura della barra laterale cambia solo le colonne del corpo; i gruppi ad albero si aprono e si chiudono; le schede conservano il layout del modulo.
- Coerenza visiva: token invece di stili arbitrari, icone dalla libreria scelta, colori semantici, chiaro e scuro coerenti.
- Accessibilità: le voci della lista sopra.

### QA visiva (stati da fotografare)

- Shell: barra laterale aperta, chiusa, con scorrimento lungo; contenuto lungo; menu, menu utente e selettore di palette aperti; tema cambiato; collegamenti del piè di pagina visibili.
- Navigazione: voce attiva, inattiva, disabilitata; gruppo aperto e chiuso; scheda attiva e inattiva; pagina senza schede.
- Pagina: normale, in caricamento, vuota, in errore, permesso negato, sola lettura.
- Tema: chiaro, scuro, ogni palette, icone semantiche in tutti gli stati.
- Tipi di pagina: cruscotto, modulo con e senza schede, accesso, pagina iniziale, pagina pubblica, tabella, pagina analitica.

### Registro delle interazioni

Un pattern interattivo nuovo del design system si registra con una voce `INT-NNN` che dice: identità (nome, stato `draft`/`ratified`/`deprecated`, data, ADR), superficie (elementi, tipi di pagina, ambito), innesco (eventi, tasti modificatori, dispositivo), comportamento (proprietà CSS, mutazioni del DOM, effetti JS), accessibilità (attributi ARIA, tastiera, gestione del fuoco, annunci ai lettori di schermo). I componenti riutilizzabili vivono in `@heuresys/ui` (`.claude/rules/design-system-ui.md`), quindi il registro sta nel repo `ux-design-shared`.
