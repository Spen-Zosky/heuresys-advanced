# 03.4 · Anatomia del workflow `deploy-storybook.yml`

> Deep dive sul nostro unico workflow attivo: il deploy automatico di Storybook su GitHub Pages, attivato a ogni push su `main` di `ux-design-shared`. Analizziamo riga per riga per capire cosa fa e come modificarlo.

---

## 1. Concetto

Il workflow `ux-design-shared/.github/workflows/deploy-storybook.yml` (37 righe YAML) compila lo static site di Storybook e lo pubblica su GitHub Pages. È diventato il riferimento concreto di tutto ciò che abbiamo discusso nei capitoli 03.1-03.3:

- Evento trigger (`push` su main + `workflow_dispatch`)
- Permissions esplicite (`contents: read`, `pages: write`, `id-token: write`)
- Concurrency group
- 2 jobs sequenziali (`build` → `deploy`)
- Action di terzi (`actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`)
- Artifact passaggio inter-job
- Environment automaticamente creato (`github-pages`)

---

## 2. Modello mentale

```
   on: push main (o workflow_dispatch)
                  │
                  ▼
   ┌──────────────────────────────────────────┐
   │  Job 1: build                            │
   │  - checkout                              │
   │  - setup-node 20                         │
   │  - npm install --legacy-peer-deps        │
   │  - npm run build-storybook               │
   │  - configure-pages                       │
   │  - upload-pages-artifact (ui/storybook-  │
   │    static)                               │
   └──────────────┬───────────────────────────┘
                  │ needs:
                  ▼
   ┌──────────────────────────────────────────┐
   │  Job 2: deploy                           │
   │  environment: github-pages               │
   │  - deploy-pages@v4                       │
   │      ↓                                   │
   │  Output URL: spen-zosky.github.io/...   │
   └──────────────────────────────────────────┘
```

Tempo totale: ~1m45s (build 1m20s + deploy 25s).

---

## 3. Il file commentato riga per riga

```yaml
name: Deploy Storybook to GitHub Pages
```

`name:` — etichetta mostrata in `Actions` tab. Univoco per workflow ma può ripetersi tra workflow file diversi. Usato anche da `gh workflow list`.

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
```

Due trigger:
- `push: branches: [main]` — qualsiasi push su `main` (incluso un PR mergiato).
- `workflow_dispatch:` — rendi il workflow eseguibile a mano dalla UI (`Actions` tab → questo workflow → `Run workflow`) o via CLI (`gh workflow run deploy-storybook.yml`).

Vantaggio del secondo: se il deploy fallisce per ragioni non-codice (es. quota Pages temporaneamente esaurita), puoi re-runnare senza pushare un commit fake.

```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

Permissions richieste dal `GITHUB_TOKEN`:
- `contents: read` — clonare il repo.
- `pages: write` — deployare su Pages.
- `id-token: write` — emettere il JWT OIDC che `actions/deploy-pages@v4` usa internamente per autenticarsi al Pages service.

Senza `id-token: write` il deploy fallirebbe con "Error: Token does not have id-token write permission".

```yaml
concurrency:
  group: pages
  cancel-in-progress: true
```

Concurrency group `pages` (statico, non parametrizzato): se un secondo push arriva mentre un deploy è in corso, il primo viene **cancellato** (`cancel-in-progress: true`) e il secondo prende il suo posto.

Logica: una Pages deploy è un'operazione "ultimo vince". Cancel del precedente evita di deployare uno stato già obsoleto.

```yaml
jobs:
  build:
    name: Build Storybook
    runs-on: ubuntu-latest
```

Job 1, identifier `build`, esegue su `ubuntu-latest` (Ubuntu 24.04 al momento).

```yaml
    steps:
      - name: Checkout
        uses: actions/checkout@v4
```

Step 1 — clona il repo (default depth 1, niente storia git). Sufficiente perché non serve git log/tag/blame per buildare Storybook.

```yaml
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
```

Step 2 — installa Node 20 LTS sul runner. **Nota**: il `cache: "npm"` era originariamente qui ma è stato **rimosso** nel commit `a28eef1` perché `package-lock.json` non è committato (è in `.gitignore` di `ux-design-shared`).

Conseguenza: l'install non beneficia di cache cross-run, ma il workflow funziona. Tempo install: ~1 min.

```yaml
      - name: Install dependencies
        run: npm install --legacy-peer-deps
```

Step 3 — install. Il flag `--legacy-peer-deps` è necessario perché Storybook 10 ha un conflitto peer-deps con `@storybook/addon-a11y` che blocca npm 7+ in modalità strict. Convivenza accettata; senza il flag l'install fallisce.

```yaml
      - name: Build Storybook static site
        run: npm run build-storybook
```

Step 4 — esegue lo script root `build-storybook`, che delega a `ui/` e produce `ui/storybook-static/`.

Output del build: directory con HTML statico + assets bundlati da Vite. 122 stories indicizzate.

```yaml
      - name: Setup Pages
        uses: actions/configure-pages@v5
```

Step 5 — chiama l'API GitHub Pages per "registrare" che il prossimo deploy parte. Restituisce metadata (URL, build type) ma non deploya ancora.

```yaml
      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ui/storybook-static
```

Step 6 — comprime `ui/storybook-static/` come artifact e lo carica. Nome artifact: `github-pages` (richiesto dal protocollo Pages, non personalizzabile).

```yaml
  deploy:
    name: Deploy to GitHub Pages
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
```

Job 2, `deploy`. Tre cose notevoli:

- `needs: build` — sequenziale dopo job `build` (parte solo se `build` è verde).
- `environment: { name: github-pages, url: ... }` — environment auto-creato. `url:` viene popolato dinamicamente dall'output di `deploy-pages` (sotto). Mostra il link cliccabile nella UI Actions.
- Il `github-pages` environment è gestito da GitHub stesso, non richiede config manuale.

```yaml
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

Singolo step nel job deploy. L'action `actions/deploy-pages@v4`:
1. Scarica l'artifact `github-pages` dal job `build` (gratis, via `needs:` linking).
2. Autentica con `id-token` (OIDC) al Pages service.
3. Pubblica il contenuto al sub-path del repo (`/ux-design-shared/`).
4. Emette `outputs.page_url` (es. `https://spen-zosky.github.io/ux-design-shared/`).

L'`id: deployment` permette di referenziare l'output nello stesso job (qui usato per `environment.url`).

---

## 4. Comandi / checklist

### View live del workflow

```bash
# Lista workflow
gh workflow list --repo Spen-Zosky/ux-design-shared
# → ID: 25994151505 | name: Deploy Storybook ... | state: active

# View del file
gh workflow view deploy-storybook.yml --repo Spen-Zosky/ux-design-shared

# Lista degli ultimi run
gh run list --repo Spen-Zosky/ux-design-shared --workflow=deploy-storybook.yml --limit 10

# Re-run manuale del workflow
gh workflow run deploy-storybook.yml --repo Spen-Zosky/ux-design-shared

# Aspetta che finisca
gh run watch <RUN_ID> --repo Spen-Zosky/ux-design-shared
```

### Modifiche tipiche

**Aggiungere un test step prima del build**:

```yaml
      - name: Test
        run: npm test
```

(inserito tra `Install dependencies` e `Build Storybook static site`).

**Aggiungere un job di lint/typecheck parallelo**:

```yaml
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm install --legacy-peer-deps
      - run: npm run typecheck

  build:
    needs: quality          # ← build aspetta che quality sia verde
    runs-on: ubuntu-latest
    ...
```

**Schedulare un re-deploy notturno** (per "ravvivare" Pages dopo le sue scadenze interne):

```yaml
on:
  push:
    branches: [main]
  schedule:
    - cron: "0 3 * * *"    # 03:00 UTC ogni giorno
  workflow_dispatch:
```

### Debug della prima failure (storica)

Il primo run (`25993970602`) fallì perché `cache: "npm"` cercava un lockfile inesistente. Il fix è stato rimuovere il cache.

Per debugare un workflow:

1. Apri il run rosso nella UI o:
   ```bash
   gh run view 25993970602 --log-failed --repo Spen-Zosky/ux-design-shared
   ```
2. Cerca l'error message specifico (in quel caso: `Dependencies lock file is not found ... Supported file patterns: package-lock.json, npm-shrinkwrap.json, yarn.lock`).
3. Modifica il workflow + commit + push → nuovo run.

---

## 5. Trappole comuni con Pages workflow

- **`actions/checkout@v3` + Node 20**: a volte versioni miste causano problemi. Pinna entrambi.
- **`upload-pages-artifact` con `path:` sbagliato**: l'action vuole il **path della directory dello static site**, non un file zip. Se path non esiste → step fallisce.
- **`configure-pages` non chiamato**: senza questo step, l'action `deploy-pages` non sa dove deployare. Aggiungilo prima dell'upload.
- **`environment.url:` con sintassi sbagliata**: se non c'è un `id:` sullo step di deploy, l'`outputs.page_url` non risolve e il link nella UI è vuoto.
- **`concurrency` su `${{ github.ref }}` invece di group statico**: per Pages deploys, lo stesso branch può avere più push consecutivi. Group statico `pages` (come abbiamo) è giusto perché vogliamo "ultimo vince globalmente".
- **Pages non abilitato**: il workflow gira ma il deploy fallisce con "404 from API". Soluzione: `Settings → Pages → Source: GitHub Actions` (oppure `gh api -X POST repos/.../pages -F build_type=workflow ...` come abbiamo fatto).
- **Trigger su `pull_request:` deploy**: ATTENZIONE — può sovrascrivere il deploy production. Pages production è 1 sola. Per preview deploy serve workflow separato con cleanup.

---

## 6. Per approfondire

- **Sample workflow officials**: <https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#publishing-with-a-custom-github-actions-workflow>
- **actions/deploy-pages docs**: <https://github.com/actions/deploy-pages>
- **actions/configure-pages docs**: <https://github.com/actions/configure-pages>
- **Concurrency reference**: <https://docs.github.com/en/actions/using-jobs/using-concurrency>
- File del repo: [`.github/workflows/deploy-storybook.yml`](https://github.com/Spen-Zosky/ux-design-shared/blob/main/.github/workflows/deploy-storybook.yml)
- File curriculum: [01-actions-fondamenti.md](01-actions-fondamenti.md) · [02-actions-ricette.md](02-actions-ricette.md) · [04-publishing/02-pages-il-nostro-caso.md](../04-publishing/02-pages-il-nostro-caso.md)
