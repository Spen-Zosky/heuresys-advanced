# Design System — `@heuresys/ui` (npm-published, post-migrazione X18)

> Extracted from `CLAUDE.md` at the 2026-07-07 session-start forensics to keep the always-loaded
> project instructions lean. The **operative Rules** stay inline in `CLAUDE.md` (Design System
> section); this file holds the full setup / workflow / maintenance / migration-X18 history.

All reusable UI/UX components live in **`@heuresys/ui`**, una libreria condivisa derivata da `ux-design-shared` (originariamente extracted from `heuresys-evo`). Dal 2026-05 (migrazione X18) la lib è **pubblicata come pacchetto npm versionato**, non più consumata via `link:` symlink locale. La dep è risolta da pnpm contro il registry e installata in `node_modules/@heuresys/ui` come dipendenza normale (pnpm crea un symlink interno alla cache `.pnpm/`, ma è meccanica pnpm — non un live-link a una working copy).

**Stato attuale verificato (HEAD `ad7d5c0`, S932)**:
- Dep in `package.json` (root e `apps/showcase/package.json`): `"@heuresys/ui": "^0.1.1"`. **NON è più `link:../ux-design-shared/ui`.**
- `node_modules/@heuresys/ui` è un symlink pnpm verso `node_modules/.pnpm/@heuresys+ui@<ver>/node_modules/@heuresys/ui` — è la normale risoluzione pnpm, immutabile a runtime.
- Le UI runtime deps (Radix, Tailwind 4, framer-motion, d3, echarts, three.js, ecc.) sono dichiarate dentro `@heuresys/ui` e tirate dentro come transitive deps quando si fa `pnpm install`. Questo repo non le installa direttamente.
- Import standard invariato: `import { Button, Card, DataTable } from "@heuresys/ui"`.
- Tailwind 4 in `apps/web` / `apps/showcase`: `tailwind.config` deve includere `"./node_modules/@heuresys/ui/dist/**/*.{js,mjs}"` (o equivalente path al build output della lib) nel `content` array per raccogliere le utility classes usate dai componenti pubblicati.
- Next.js in `apps/web` / `apps/showcase`: `transpilePackages: ["@heuresys/ui"]` in `next.config.js` se la lib espone ESM/TSX non pre-transpilato; verificare il `package.json` di `@heuresys/ui@0.1.1` per il vero `exports` map.

**Workflow per modificare componenti UI (post-X18)**:
- Le modifiche al codice di `@heuresys/ui` **NON sono live** in questo repo: bisogna versionare, pubblicare una nuova versione della lib, poi bumpare la dep qui (`pnpm update @heuresys/ui` o cambiando `^0.1.1` → versione target) e rifare `pnpm install`.
- Per dev rapido di un componente nuovo o modifica esistente, il flusso consigliato è: lavorare nel repo `ux-design-shared` con Storybook (`npm run storybook` → `http://localhost:6006`), validare, tagliare release npm, poi consumare qui.
- In emergenza (debug rapido di un componente già in prod) è possibile temporaneamente reintrodurre `link:` o `pnpm.overrides` puntando a una working copy locale, MA è un detour — va ripristinato a versione npm prima del commit.

**Rules** (non-negotiable, invariati nello spirito — anche in `CLAUDE.md`):
- **NEVER** create reusable UI components in `apps/web`, `apps/showcase` o `packages/*` di questo repo. Vanno nel repo `ux-design-shared` (sorgente di `@heuresys/ui`).
- **NEVER** aggiungere UI runtime deps (Radix, framer-motion, recharts, ecc.) ai `package.json` di questo repo. Appartengono a `@heuresys/ui` e arrivano come transitive deps.
- Se un componente è genuinamente heuresys-advanced-specific (es. tenant-aware widget che usa schemi Zod da `@heuresys/shared`), vive in `apps/web/src/components/` o `apps/showcase/src/components/` — e anche in quel caso, prefer composing primitives di `@heuresys/ui` invece di reimplementarle.
- React peer: `@heuresys/ui` dichiara React via `peerDependencies`; `apps/web` / `apps/showcase` installano la versione concreta di React (oggi 19.2.5). Evita il crash "due React istanze".

**Maintenance / evolution**:
- Bump versione: `pnpm update @heuresys/ui` (segue il range `^0.1.1`) oppure pinning esplicito a una versione specifica nel `package.json`.
- Aggiungere un nuovo componente o nuova dep: lavoro nel repo `ux-design-shared` → release npm → bump qui.
- Storybook: `cd ux-design-shared && npm run storybook` → `http://localhost:6006` (51 componenti, 16 tier — count storico, verificare allo state corrente del repo).
- Re-validation post-`pnpm install`: il check storico `readlink -f node_modules/@heuresys/ui → /d/ux-design-shared/ui` è **obsoleto** (era valido pre-X18). Oggi `readlink -f node_modules/@heuresys/ui` ritorna un path dentro `node_modules/.pnpm/@heuresys+ui@<ver>/node_modules/@heuresys/ui` — è il pattern pnpm standard.

**Apps che consumano `@heuresys/ui`** (allo stato corrente):
- `apps/web` — admin SPA + ESS portal (Next.js 15, codebase MVP-2a/2b in costruzione).
- `apps/showcase` — Heuresys brand identity v1, static site GitHub Pages (Next.js 15 static export). Aggiunto post-CLAUDE.md originale.

**Note migrazione X18** (storico, leggibile dai commit):
- Prima della migrazione X18 (2026-05), `@heuresys/ui` era consumato via `link:../ux-design-shared/ui` (live symlink). La sezione precedente di questo file descriveva quella configurazione.
- Il switch a npm-published è stato fatto per (i) eliminare la dipendenza dalla working copy locale per dev su altre macchine (Mac/VM), (ii) garantire reproducibilità (lockfile pinning), (iii) supportare deploy CI/CD senza accesso al filesystem dello sviluppatore.
