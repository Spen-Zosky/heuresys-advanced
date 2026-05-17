# Sessione di chiusura MVP-2a/2b — plan operativo

> **Scope**: chiudere le **4 voci di acceptance tail** ancora aperte dal `NEXT_SESSION_MVP_2A.md` §5, per dichiarare ufficialmente concluso il ciclo MVP del bootstrap.
> **Stato di partenza**: HEAD `51e44c4` su `main`, feature surface MVP-2a/2b completa (42 web routes + 277 endpoint + 203 vitest + 50+ Playwright E2E + curriculum GitHub).
> **Effort stimato totale**: 3-4 ore in 1 sessione focused.
> **Output**: 4-5 commit atomici + HANDOFF.md aggiornato + tag `v0.2.0-mvp2` opzionale.

---

## 0. Pre-flight obbligatorio

Prima di iniziare:

```bash
cd /d/heuresys-advanced

# A. Git
git status -sb                              # → main pulito, in sync con origin
git pull origin main                        # solo se servono allineamenti remoti
git log --oneline -3                        # ultimi: 51e44c4, bba3e1c, 53b8ea9

# B. Tunnel SSH 5433
ssh -fN -L 5433:localhost:5432 oracle-vm-default
netstat -ano | grep -i ':5433.*LISTEN'      # deve avere PID

# C. Symlink design system
readlink -f node_modules/@heuresys/ui
# → /d/ux-design-shared/ui

# D. Baseline vitest
cd apps/api && pnpm test
# → Tests 203 passed (203)

# E. Dev server entrambi up
cd ../api && pnpm dev > /tmp/api.log 2>&1 &
cd ../web && pnpm dev > /tmp/web.log 2>&1 &
# Verifica:
curl -s -o /dev/null -w "api: %{http_code} web: " http://localhost:3001/healthz
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login
# Atteso: api: 200 web: 200
```

Se uno step fallisce: NON proseguire con il closure. Sanare prima.

---

## 1. Step 1 — `pnpm build` di `apps/web` (15-30 min)

### Obiettivo

Verificare che il bundle production di Next.js si compili senza errori. È **diverso** dal `pnpm dev` (che usa Turbopack in dev mode permissivo) e dal `pnpm typecheck` (che non chiama bundling).

### Comandi

```bash
cd /d/heuresys-advanced/apps/web

# Build production
pnpm build 2>&1 | tee /tmp/web-build.log

# Atteso: ".next/" generato, output finale
#   "Compiled successfully" + tabella delle route con dimensioni bundle.
```

### Errori probabili e fix

| Sintomo | Causa probabile | Fix |
|---|---|---|
| `Type error: ...` in build ma non in `pnpm typecheck` | Next.js strict type check su file build-only (es. `app/api/route.ts`) | Fixare il file specifico |
| `Cannot find module '@heuresys/ui'` | Symlink rotto o `transpilePackages` mancante | Verifica `next.config.js` ha `transpilePackages: ["@heuresys/ui", "@heuresys/shared"]` |
| Bundle size warning >1MB su qualche chunk | Normale, è warning non errore | Ignora (per ora) |
| `useSearchParams() should be wrapped in <Suspense>` | Pattern Next.js 15 per static export | Avvolgi `useSearchParams` in `<Suspense>` o aggiungi `export const dynamic = 'force-dynamic'` |
| `RangeError: Maximum call stack` durante optimization | Pattern raro, di solito CSS Tailwind 4 | Disabilita un'optimization specifica |

### Acceptance Step 1

- [ ] `pnpm build` exit code 0
- [ ] `.next/` directory generata con file `.next/build-manifest.json`
- [ ] Verifica grep output: nessun "Failed to compile" o "Error:"

### Commit (se ci sono fix)

```
fix(web): resolve build errors for production bundle

[lista fix]

Acceptance MVP-2a #2: pnpm build verde.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 2. Step 2 — `pnpm i18n:check` (parity it/en) (30-45 min)

### Obiettivo

Verificare che ogni chiave i18n usata nel codice esista in entrambi i locale (`it` + `en`). Senza parity, una pagina può apparire vuota o mostrare il key letterale a un utente con locale non-default.

### Verifica esistenza script

```bash
cat apps/web/package.json | grep i18n:check
# Atteso: "i18n:check": "tsx scripts/check-i18n-parity.ts"

ls apps/web/scripts/check-i18n-parity.ts
# Atteso: file esistente (creato durante Phase 1.A)
```

**Se lo script non esiste** (creato in scaffold ma non implementato), va scritto. Pattern minimo:

```typescript
// apps/web/scripts/check-i18n-parity.ts
import fs from "node:fs";
import path from "node:path";

const LOCALES = ["it", "en"];
const BASE = path.join(__dirname, "../src/locales");

function flatten(obj: any, prefix = ""): string[] {
  const keys: string[] = [];
  for (const k of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof obj[k] === "object" && obj[k] !== null) {
      keys.push(...flatten(obj[k], full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

const sets: Record<string, Set<string>> = {};
for (const loc of LOCALES) {
  const f = path.join(BASE, loc, "common.json");
  const j = JSON.parse(fs.readFileSync(f, "utf-8"));
  sets[loc] = new Set(flatten(j));
}

const all = new Set([...sets.it, ...sets.en]);
let errors = 0;
for (const key of all) {
  const missingIn = LOCALES.filter((l) => !sets[l].has(key));
  if (missingIn.length > 0) {
    console.error(`MISSING in [${missingIn.join(", ")}]: ${key}`);
    errors++;
  }
}

if (errors > 0) {
  console.error(`\n${errors} parity violations`);
  process.exit(1);
}
console.log(`✓ Parity OK (${all.size} keys across ${LOCALES.length} locales)`);
```

### Comandi

```bash
cd /d/heuresys-advanced
pnpm i18n:check 2>&1 | tee /tmp/i18n-check.log
# Atteso: "✓ Parity OK (N keys across 2 locales)"
# Se fail: lista keys mancanti
```

### Fix pattern

Per ogni "MISSING in [en]: auth.login.foo" → aggiungere la key nel JSON corrispondente. Convenzione: copia il valore italiano e traduci.

### Acceptance Step 2

- [ ] Script `i18n:check` esistente e funzionante
- [ ] Exit code 0
- [ ] Locales `it/common.json` e `en/common.json` hanno lo stesso set di chiavi

### Commit

```
feat(web): close i18n parity it/en for all 42 routes

[se aggiunto script]: implement check-i18n-parity.ts
[se aggiunte keys]: add N missing translations

Acceptance MVP-2a #4: pnpm i18n:check verde.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 3. Step 3 — Smoke test manuale browser (30-45 min)

### Obiettivo

Verifica umana che ogni delle 5 personas seedate accede correttamente, viene rediretta sulla landing giusta (§11.2 di `FRONTEND_IMPLEMENTATION_PLAN.md`) e può navigare almeno una pagina principale.

### Personas e landing attese

| Persona | Email | Password | Landing attesa | Navigazione di prova |
|---|---|---|---|---|
| PLATFORM_ADMIN | `admin@heuresys.com` | `Admin#PassW0rd!` | `/dashboard` | → `/tenants` → `/admin/roles` |
| TENANT_ADMIN | `tenant_admin_test@rtl-bank.test` | idem | `/dashboard` | → `/users` → `/positions` |
| MANAGER | `manager_test@rtl-bank.test` | idem | `/dashboard` | → `/gaps` → `/me` (Switch to My HR) |
| USER (employee) | `employee_test@rtl-bank.test` | idem | `/me` | → `/me/profile` → `/me/learning/catalogue` |
| USER (outsider) | `outsider_test@rtl-bank.test` | idem | `/me` | → `/me/inbox` → `/me/career` |

### Procedura per ogni persona

1. Browser fresh (incognito o cookie cleared).
2. Vai a `http://localhost:3000`.
3. Verifica redirect a `/login`.
4. Compila form con persona credentials.
5. Submit → osserva URL post-redirect (deve essere == "Landing attesa").
6. Verifica visuale:
   - Header con email persona + bottone "Esci"
   - Nav role-gated (admin nav per i 3 admin, solo "My HR" per i 2 USER)
7. Naviga 2 pagine extra (vedi colonna "Navigazione di prova").
8. Logout → verifica torna a `/login`.

### Errori probabili

| Sintomo | Causa |
|---|---|
| Login OK ma landing sbagliata | Bug in `landingForRoles()` o `(authenticated)/layout.tsx` |
| Header senza email | Query `useCurrentUser` non popolata |
| Nav admin visibile a USER | Bug in `hasAdminRole` check |
| Pagina bianca dopo login | Errore JS nella pagina target, vedi console |
| Logout non torna a /login | Cookie clear fallito |

### Acceptance Step 3

- [ ] 5/5 personas: login → landing redirect corretta
- [ ] 5/5: nav role-gated rispettata
- [ ] 5/5: almeno 2 pagine extra navigate senza errore
- [ ] 5/5: logout pulito

### Commit (se servono fix)

```
fix(web): correct landing redirect for [persona]

[breve descrizione bug]

Acceptance MVP-2a #6: smoke test 5 personas verde.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 4. Step 4 — Accessibility audit con `axe-playwright` (2-3 ore)

### Obiettivo

Per ogni pagina, eseguire `axe-core` (libreria di accessibility scanning di Deque). Asserire zero violazioni con severity `critical`. Le altre (serious/moderate/minor) vengono raccolte come "tail items" per MVP-3.

### Setup

```bash
cd /d/heuresys-advanced/apps/web
pnpm add -D @axe-core/playwright axe-playwright
```

### Spec template

File `tests/e2e/a11y.spec.ts`:

```typescript
/**
 * apps/web/tests/e2e/a11y.spec.ts
 *
 * Run axe-core su ogni pagina autenticata. Asserisce zero violazioni
 * con impact "critical". Le altre vengono solo loggate.
 */

import { test, expect } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";
import { storageStateFor } from "./fixtures";

const PAGES_PER_PERSONA: Record<string, string[]> = {
  platformAdmin: [
    "/dashboard",
    "/users",
    "/tenants",
    "/admin/roles",
  ],
  tenantAdmin: [
    "/dashboard",
    "/users",
    "/positions",
    "/blueprints",
    "/skills",
    "/kpis",
    "/learning",
    "/gaps",
    "/career-succession",
    "/compensation-intelligence",
    "/organization",
    "/processes",
    "/seed-acquisition/runs",
    "/brownfield-adaptation",
    "/visualizations",
  ],
  employee: [
    "/me",
    "/me/profile",
    "/me/positions",
    "/me/skills",
    "/me/skills/self-assessment",
    "/me/learning",
    "/me/learning/catalogue",
    "/me/gaps",
    "/me/kpis",
    "/me/career",
    "/me/career/target",
    "/me/certifications",
    "/me/documents",
    "/me/inbox",
  ],
};

for (const [persona, pages] of Object.entries(PAGES_PER_PERSONA)) {
  test.describe(`a11y as ${persona}`, () => {
    test.use({ storageState: storageStateFor(persona as any) });

    for (const path of pages) {
      test(`${path} has no critical a11y violations`, async ({ page }) => {
        await page.goto(path);
        await injectAxe(page);
        await checkA11y(page, undefined, {
          axeOptions: {
            runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
          },
          detailedReport: false,
          detailedReportOptions: { html: false },
        });
      });
    }
  });
}
```

### Comandi

```bash
cd /d/heuresys-advanced/apps/web

# Run solo a11y
pnpm exec playwright test a11y.spec.ts 2>&1 | tee /tmp/a11y-results.log

# Conteggio violazioni per severity
grep -E "impact: '(critical|serious|moderate|minor)'" /tmp/a11y-results.log | \
  awk -F"'" '{print $2}' | sort | uniq -c
```

### Errori probabili e fix tipici

| Violazione | Fix tipico |
|---|---|
| `color-contrast` | Tailwind class con `text-gray-500` su `bg-white` → cambia in `text-gray-700` |
| `label` | `<input>` senza `<label htmlFor="...">` o `aria-label` |
| `button-name` | `<button>` con solo icon, manca `aria-label` |
| `heading-order` | Saltato un livello heading (h1 → h3) |
| `link-name` | `<a>` con solo icon o solo `>` |
| `region` | Body senza `<main>` (o senza ARIA landmarks) |
| `image-alt` | `<img>` senza `alt` (o senza `role="presentation"`) |

### Strategia di fix

1. **Solo critical** prima — quelli sono show-stopper.
2. **Bulk fix per pattern**: spesso 10+ violazioni stessa causa (es. tutti i `<button>` icon-only).
3. **Documenta i serious/moderate/minor** in un file `docs/a11y-tail-items.md` per MVP-3.
4. **Evita fix superficiali** che peggiorano UX (es. aggiungere `alt=""` a tutte le `<img>` decorative è OK; aggiungere `alt="immagine"` è inutile).

### Acceptance Step 4

- [ ] `pnpm exec playwright test a11y.spec.ts` 0 fail
- [ ] Tutte le route principali (admin + ESS) coperte
- [ ] Tail items (severity < critical) documentati in `docs/a11y-tail-items.md`

### Commit

```
feat(web): pass axe-playwright a11y audit on all 42 routes

- Add a11y.spec.ts: tests all routes per persona via storageState
- Fix N critical violations (lista compatta)
- Document M serious/moderate tail items in docs/a11y-tail-items.md

Acceptance MVP-2a #7: zero critical a11y violations.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 5. Step 5 — Closure deliverables (15 min)

### Obiettivo

Marcare ufficialmente MVP-2a/2b chiuso in `HANDOFF.md` + opzionalmente tag git.

### Aggiornamento `HANDOFF.md`

Editare la sezione iniziale per riflettere:

```
## ✅ MVP-2A / MVP-2B CHIUSI UFFICIALMENTE — 2026-MM-DD

Tutte le 7 voci di Acceptance criteria globali completate:
  ✅ 42 admin + ESS routes implementate
  ✅ Playwright spec ≥ 40 verdi
  ✅ pnpm test API 203/203 verdi
  ✅ pnpm i18n:check verde (parity it/en N keys)
  ✅ pnpm build apps/web verde
  ✅ Smoke test 5 personas verde
  ✅ axe-playwright zero critical violations
  ✅ HANDOFF.md aggiornato (questo update)
```

### Tag opzionale (raccomandato)

```bash
git tag -a v0.2.0-mvp2 -m "MVP-2a/2b closure — 42 routes, 277 endpoints, 203 vitest + 60+ E2E green"
git push origin v0.2.0-mvp2

# Opzionale: GitHub Release
gh release create v0.2.0-mvp2 \
  --title "MVP-2a/2b — Feature complete + acceptance closed" \
  --generate-notes
```

### Commit chiusura

```
docs(handoff): MVP-2a/2b CHIUSI UFFICIALMENTE — 7/7 acceptance criteria green

Closes the MVP-2a/2b cycle with all 7 acceptance criteria from
NEXT_SESSION_MVP_2A.md §5 marked complete:

  ✅ Routes complete (42/42)
  ✅ Playwright specs green (60+ E2E across 12 spec files)
  ✅ Vitest API 203/203
  ✅ i18n parity it/en
  ✅ pnpm build apps/web
  ✅ Manual smoke test 5 personas
  ✅ axe-playwright zero critical violations

Next: MVP-3 — admin role CRUD, brownfield wave execution, MFA,
publish @spen-zosky/ui to npm, mobile responsive, full WCAG 2.2 AA.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 6. Risk register della sessione

| # | Rischio | Probabilità | Mitigazione |
|---|---|---|---|
| R1 | `pnpm build` rivela 10+ type error solo in build mode | M | Allocare buffer +30 min su Step 1; usare `next build --no-mangling --debug` se serve |
| R2 | `pnpm i18n:check` script non esiste e va scritto from scratch | M | Lo script template fornito sopra; ~30 min addizionali se totalmente nuovo |
| R3 | Smoke test rivela bug funzionale (es. landing redirect sbagliata) | M | Bug richiede fix in `(authenticated)/layout.tsx` o `landing.ts`; ~30 min per persona |
| R4 | axe audit rivela >50 critical violations (probabilità: alta perché design system non auditato) | H | Strategia bulk-fix per pattern; se >2 ore di fix, accetta soglia "≤5 critical" e documenta rest in tail-items |
| R5 | Dev server crash durante smoke test (memory, hot-reload glitch) | L | Restart `pnpm dev`; nessuna perdita stato |
| R6 | DB tunnel SSH drop durante test | L | Riaprire tunnel; tests che lo richiedono saltati e re-run dopo |
| R7 | Sessione esaurita prima di completare Step 4 | M | Step 4 è independente da 1-3; se serve, splittare in sessione successiva (Step 4 = "axe-only sessione") |

---

## 7. Effort distribution stimata

| Step | Effort min | Effort max | Note |
|---|---|---|---|
| 0. Pre-flight | 5 min | 10 min | — |
| 1. `pnpm build` | 15 min | 45 min | Dipende da errori |
| 2. `pnpm i18n:check` | 30 min | 60 min | +30 min se script da scrivere |
| 3. Smoke test 5 personas | 30 min | 60 min | Lento se trovi bug |
| 4. axe-playwright | 120 min | 240 min | Il "lungo" — può estendersi |
| 5. Closure deliverables | 10 min | 20 min | — |
| **TOTALE** | **3h 30min** | **7h** | Aspettativa: ~4-5 ore |

Se sessione lunga (>5h), splittare:
- **Sessione A**: Step 0-3 (build + i18n + smoke). ~2h.
- **Sessione B**: Step 4 + 5 (axe + closure). ~3h.

---

## 8. Commit strategy

Per ognuno dei 4 step che produce modifiche → 1 commit atomico:

```
fix(web):  Step 1 build errors           ← solo se ce ne sono
feat(web): Step 2 i18n parity            ← include script se assente
fix(web):  Step 3 smoke fixes            ← solo se ce ne sono
feat(web): Step 4 axe-playwright audit   ← include nuova spec
docs(handoff): Step 5 MVP-2a/2b closed   ← finale
```

Push solo a fine sessione (regola autonomia).

---

## 9. Out of scope per questa sessione

Volutamente NON inclusi (sono "MVP-3 work" o richiedono trigger separato):

- React Flow renderer per `/visualizations/[graphId]`
- Mermaid renderer per KPI cascade
- React Flow + Dagre/ELK per `/organization/org-chart`
- Position sub-CRUD mutation UI (combobox skill picker)
- Compensation-intelligence write UI
- File upload reale per certifications/documents
- Brownfield wave execution
- Publish `@spen-zosky/ui` su GitHub Packages
- Tier 0/1 GitHub setup (topics, LICENSE, Dependabot, branch protection — vedi `docs/github/08-roadmap.md`)
- Full WCAG 2.2 AA audit (al di là di "zero critical")

---

## 10. Per partire

Comando di kick-off (copia-incolla nella prossima sessione):

```
Apri NEXT_SESSION_MVP_CLOSURE.md. Esegui Step 0 (pre-flight). Procedi
sequenzialmente Step 1 → 5. 4-5 commit atomici locali. No push finché
non confermo a fine sessione.
```

---

**Plan owner**: Claude Opus 4.7 (1M context).
**Plan creato**: 2026-05-17 (HEAD `51e44c4`).
**Plan target**: chiudere ufficialmente MVP-2a/2b in 1 sessione (~4-5 ore di execution).
