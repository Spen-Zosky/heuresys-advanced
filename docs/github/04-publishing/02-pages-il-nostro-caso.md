# 04.2 · Pages — il nostro caso (`ux-design-shared` Storybook)

> Walkthrough completo del setup Pages di `ux-design-shared`, dal commit iniziale fino al deploy live. Include i 2 fix che abbiamo dovuto fare (cache npm + MSW relative URL) come case study di troubleshooting.

---

## 1. Concetto: cosa abbiamo deployato

Storybook è uno static site generator per design systems React. Compila tutte le `*.stories.tsx` + i componenti React in un sito navigabile con:
- Sidebar di indicizzazione delle stories
- Renderer iframe per ogni componente
- Controls panel (props editabili live)
- Documentation auto-generata
- Add-on: a11y, themes, MSW (mock service worker)

Per `ux-design-shared`:
- 51 componenti React
- 122 story files
- Build via Vite + Storybook 10
- Output: ~50 MB di static files (HTML + JS chunks + assets)

---

## 2. Modello mentale del flow

```
   Push su main (ux-design-shared)
              │
              ▼
   ┌──────────────────────────────────────────┐
   │  Workflow: deploy-storybook.yml          │
   │  Job 1: build (~1m20s)                   │
   │   ├─ checkout                            │
   │   ├─ setup-node 20                       │
   │   ├─ npm install --legacy-peer-deps      │
   │   └─ npm run build-storybook             │
   │       (Vite build → ui/storybook-static) │
   │                                          │
   │  Job 2: deploy (~25s)                    │
   │   └─ deploy-pages@v4                     │
   └──────────────┬───────────────────────────┘
                  │
                  ▼
   https://spen-zosky.github.io/ux-design-shared/
   ◄────── HTML statico servito da CDN GitHub ─►
```

---

## 3. Cronologia del setup (la nostra)

### Step 1 — Inventario iniziale

Quando abbiamo iniziato, `ux-design-shared` aveva:
- 122 story files in `ui/src/components/**/*.stories.tsx`
- Script `build-storybook` in `package.json` (sia root che `ui/`)
- **Manca `.storybook/main.ts` e `preview.ts`** — eliminati dall'extract iniziale di `heuresys-evo`
- **`ui/tsconfig.json` extends `../../tsconfig.base.json`** che non esiste nel repo standalone

### Step 2 — Restore della config Storybook

Copiato dalla source originale `D:\evo.heuresys.com\packages\ui\.storybook\`:

`ui/.storybook/main.ts`:
```typescript
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx|mdx)", "../src/**/*.mdx"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-themes", "msw-storybook-addon"],
  framework: { name: "@storybook/react-vite", options: {} },
  typescript: { reactDocgen: "react-docgen-typescript" },
  staticDirs: ["../public"],
};

export default config;
```

`ui/.storybook/preview.ts`:
```typescript
import type { Preview } from "@storybook/react";
import { withThemeByClassName } from "@storybook/addon-themes";
import { initialize, mswLoader } from "msw-storybook-addon";
import "../src/styles/globals.css";

initialize({
  onUnhandledRequest: "bypass",
  serviceWorker: { url: "./mockServiceWorker.js" },   // ← fix subpath
});

// ... (themes + a11y + storySort) ...
```

### Step 3 — Fix tsconfig

`tsconfig.json` extendeva `D:/tsconfig.base.json` che non esisteva. Inlinato il contenuto:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "jsx": "react-jsx",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "types": ["node"],
    "incremental": true,
    "tsBuildInfoFile": "./tsconfig.tsbuildinfo",
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "storybook-static", "**/*.stories.tsx"]
}
```

### Step 4 — Workflow `deploy-storybook.yml`

Creato `.github/workflows/deploy-storybook.yml` con 2 jobs (build + deploy). Dettagli in `03-automazione/04-workflow-storybook.md`.

### Step 5 — Abilitare Pages

```bash
gh api -X POST repos/Spen-Zosky/ux-design-shared/pages \
  -F 'build_type=workflow' \
  -F 'source[branch]=main' \
  -F 'source[path]=/'
```

Output: Pages enabled, ma il primo workflow è failed perché lanciato **prima** dell'enable.

### Step 6 — Fix #1: cache npm

Prima run failed in 9 secondi con error: "Dependencies lock file is not found ... Supported file patterns: package-lock.json,npm-shrinkwrap.json,yarn.lock".

Root cause: `actions/setup-node@v4` con `cache: "npm"` cerca un lockfile committato. `package-lock.json` è in `.gitignore` di `ux-design-shared`.

Fix: rimosso `cache: "npm"` dal step. Commit `a28eef1`.

Run successivo: ✅ success in 1m45s.

### Step 7 — Fix #2: MSW relative URL per subpath

Sito live ma con error in console:
```
[MSW] Failed to register a Service Worker for scope ('https://spen-zosky.github.io/')
with script ('https://spen-zosky.github.io/mockServiceWorker.js'):
Service Worker script does not exist at the given path.
```

Root cause: MSW init() di default usa `/mockServiceWorker.js` (absolute root path). Su GitHub Pages siamo a `/ux-design-shared/`, quindi il file vero è a `/ux-design-shared/mockServiceWorker.js`.

Fix: passato `serviceWorker.url: "./mockServiceWorker.js"` (relativo) in `preview.ts`. Commit `0a36b19`.

Run successivo: ✅ success, console pulita.

---

## 4. Comandi / checklist

### Riprodurre il deploy localmente

```bash
cd /d/ux-design-shared
npm install --legacy-peer-deps
npm run build-storybook
# Output: ui/storybook-static/
# Serve in locale:
npx serve ui/storybook-static
# → http://localhost:3000
```

### Trigger manuale del deploy

```bash
gh workflow run deploy-storybook.yml --repo Spen-Zosky/ux-design-shared
gh run watch --repo Spen-Zosky/ux-design-shared
```

### Verifica live

```bash
# HTTP status
curl -s -o /dev/null -w "%{http_code}\n" https://spen-zosky.github.io/ux-design-shared/
# Atteso: 200

# Service worker file
curl -s -o /dev/null -w "%{http_code}\n" https://spen-zosky.github.io/ux-design-shared/mockServiceWorker.js
# Atteso: 200

# Title HTML
curl -s https://spen-zosky.github.io/ux-design-shared/ | grep -oE '<title>[^<]+</title>'
# Atteso: <title>storybook - Storybook</title>
```

### Aggiungere/modificare una story

1. Crea o modifica `ui/src/components/<area>/<component>.stories.tsx`
2. `git add` + `git commit` + `git push`
3. Il workflow parte automaticamente (push su main).
4. Aspetta ~2 minuti.
5. Apri la URL live, hard refresh per scaricare il nuovo bundle.

### Setup similar Pages su `heuresys-advanced` (se decidessi di pubblicare docs)

Decisione: oggi non lo facciamo. Ma se un giorno volessi pubblicare `docs/github/**` come sito navigabile:

```bash
# Setup mkdocs-material (Python tool, ottimo per technical docs)
pip install mkdocs-material

# In root del repo:
cat > mkdocs.yml <<EOF
site_name: Heuresys docs
docs_dir: docs/github
theme:
  name: material
  features: [navigation.tabs, navigation.sections]
nav:
  - Home: README.md
  - Glossario: 00-glossario.md
  - Fondamenti: 01-fondamenti/
EOF

mkdocs serve   # locale, http://localhost:8000
mkdocs build   # genera site/
```

Poi workflow Actions `deploy-docs.yml` (simile a Storybook) builda + deploya `site/` su Pages.

---

## 5. Trappole sul nostro caso specifico

- **MSW richiede il file `mockServiceWorker.js`** generato da `npx msw init <public-dir>`. È committato in `ui/public/mockServiceWorker.js` (9 KB). Se viene cancellato per sbaglio, le stories che usano MSW (data-table.stories.tsx) rompono.
- **Storybook 10 + `@storybook/addon-a11y` peer conflict**: richiede `--legacy-peer-deps` per npm install. È documentato nel workflow.
- **Vite chunk size warnings**: il build produce alcuni chunk >500 KB. Sono warning, non error. Non bloccano il deploy ma il bundle è "non-optimal". Quando il design system maturerà, considera code-splitting più aggressivo nel `main.ts` di Storybook.
- **Stories con import broken**: se una `.stories.tsx` importa da un path inesistente, Storybook build fallisce. Il workflow allora rosso. Test locale `npm run build-storybook` prima del push.
- **Cache pollution dopo deploy**: i browser cachano aggressivamente Storybook. Dopo aggiornamenti, hard refresh (Ctrl+Shift+R) è spesso necessario.
- **MSW handler con path absolute**: se una story usa `http.get('/api/employees', ...)` (con leading slash), il path è root-relativo al sito. Su Pages questo significa `https://spen-zosky.github.io/api/employees` — che non esiste, e MSW intercetta solo se l'app fa la fetch verso quel path. Tipicamente i mock funzionano comunque perché lo Storybook iframe non chiama `/api/*` su Pages. Ma se cresci la complexity, considerare path relative-to-base.

---

## 6. Per approfondire

- **Storybook deployment**: <https://storybook.js.org/docs/sharing/publish-storybook>
- **MSW with Storybook**: <https://mswjs.io/docs/recipes/storybook>
- **Storybook on GitHub Pages**: <https://storybook.js.org/docs/sharing/publish-storybook#publish-storybook-with-github-pages>
- **GitHub Pages docs**: <https://docs.github.com/en/pages>
- File del repo (live):
  - Workflow: <https://github.com/Spen-Zosky/ux-design-shared/blob/main/.github/workflows/deploy-storybook.yml>
  - Storybook config: <https://github.com/Spen-Zosky/ux-design-shared/blob/main/ui/.storybook/main.ts>
- File curriculum: [01-pages-fondamenti.md](01-pages-fondamenti.md) · [03-automazione/04-workflow-storybook.md](../03-automazione/04-workflow-storybook.md)
