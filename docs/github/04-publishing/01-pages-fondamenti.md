# 04.1 · GitHub Pages — fondamenti

> GitHub Pages è hosting statico **gratuito** per file HTML/CSS/JS serviti da un repo. È usato per documentazione, landing page, blog, web app SPA, design system Storybook (come il nostro). Limiti: solo file statici (no backend), max 1 GB di repo size, 100 GB di bandwidth/mese.

---

## 1. Concetto

Un sito Pages è un **file system pubblicato a una URL**. La URL dipende dal tipo:

| Tipo | URL pattern | Source |
|---|---|---|
| **User/org site** | `https://<username>.github.io/` | Repo speciale `<username>/<username>.github.io` |
| **Project site** | `https://<username>.github.io/<repo>/` | Qualsiasi repo, sub-path = nome repo |
| **Custom domain** | `https://example.com/` | Configurabile via CNAME |

### Source: due modalità

**Modalità A — Branch source** (più semplice):
- Pages serve direttamente i file di un branch + path (tipicamente `main/` o `gh-pages/` root, o `main/docs/`).
- Nessun workflow CI/CD richiesto.
- Build server-side: Jekyll automatico se rileva file `_config.yml` o sintassi Jekyll. Altrimenti static raw.
- Tempi: pubblicazione in ~1 minuto dopo push.
- Limite: il branch deve contenere già i file finali (es. `docs/index.html` direttamente, non `docs/src/`).

**Modalità B — GitHub Actions source** (più potente):
- Un workflow custom builda lo static site e lo deploya.
- Permette build complessi (Storybook, Next.js export, Hugo, Astro, ecc.).
- Trigger custom (push su qualsiasi branch, schedule, manuale).
- Tempi: dipende dal build (1-10 min tipico).
- Action ufficiali: `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`.

### Custom domain

Pages supporta domini custom (es. `heuresys.com` → punti A record o CNAME a `<username>.github.io`).

Configurazione:
1. `Settings → Pages → Custom domain → inserisci dominio`.
2. GitHub crea un file `CNAME` nel branch root (committato automaticamente).
3. Configura DNS sul tuo provider:
   - **Apex domain** (`heuresys.com`): A record a 4 IP GitHub (`185.199.108.153`, `.154`, `.155`, `.156`).
   - **Subdomain** (`www.heuresys.com`): CNAME a `<username>.github.io`.
4. Aspetta propagazione DNS (1-24h).
5. Abilita `Enforce HTTPS` (richiede 1-24h dopo DNS).

### Jekyll auto-build

Branch source con file Markdown è automaticamente buildato da Jekyll (Ruby static site generator). Per disabilitare: aggiungi `.nojekyll` file nel root. Senza Jekyll, GitHub serve i file Markdown come HTML-rendered (limited) ma niente layout/include.

---

## 2. Modello mentale

```
                      ┌────────────────────────────────────┐
                      │  Repository                        │
                      │                                    │
                      │  main branch:                      │
                      │    /src   ◄── codice sorgente      │
                      │    /dist  ◄── output di build      │
                      │           ◄── opt: Pages legge qui │
                      │                                    │
                      │  gh-pages branch (opt):            │
                      │    /index.html ◄── Pages legge qui │
                      │    /assets/...                     │
                      └──────────────┬─────────────────────┘
                                     │
                                     │ workflow Actions
                                     │ (modalità B)
                                     ▼
                      ┌────────────────────────────────────┐
                      │  pages-build-deployment            │
                      │  artifact → Pages CDN              │
                      └──────────────┬─────────────────────┘
                                     │
                                     ▼
                      https://<username>.github.io/<repo>/

                      o, con custom domain:
                      https://example.com/
```

---

## 3. Applicato ai nostri repo

| Repo | Pages | Source | URL | Custom domain |
|---|---|---|---|---|
| `heuresys-advanced` | ❌ disabled | — | — | — |
| `ux-design-shared` | ✅ enabled | Actions workflow | `https://spen-zosky.github.io/ux-design-shared/` | ❌ no |

### `ux-design-shared`

Setup attuale (dettagliato in `02-pages-il-nostro-caso.md`):
- Workflow: `.github/workflows/deploy-storybook.yml`
- Build: Storybook 10 + Vite + 122 stories
- Output: `ui/storybook-static/` → Pages
- Trigger: push su `main` + `workflow_dispatch` manuale
- HTTPS: enforced
- Latest deploy: ~1m45s

### `heuresys-advanced` — candidato per Pages?

Sì in 2 scenari:

**Scenario A: pubblicare la documentazione `docs/**`**
- Source: branch `main`, path `/docs` (o costruito con `mkdocs-material` via Actions).
- URL: `https://spen-zosky.github.io/heuresys-advanced/`
- Audience: developer che lavorano sul progetto + potenziali contributor.
- Effort: medio (richiede config mkdocs/Docusaurus per nav decente).

**Scenario B: pubblicare la SPA `apps/web` come demo**
- Source: workflow Actions che builda Next.js export (`next export` o `output: "export"`).
- Problema: la SPA è collegata a un backend API che richiede un server reale + DB. Senza backend, la demo sarebbe statica e non funzionale.
- Conclusione: **non utile** finché non c'è anche un backend pubblico.

**Decisione**: per ora Pages non serve a `heuresys-advanced`. Scenario A potrebbe valere se decidessi di "pubblicare" il curriculum GitHub (`docs/github/**`) come sito navigabile invece che leggerlo solo da GitHub web UI.

---

## 4. Comandi / checklist

### Abilitare Pages da CLI

```bash
# Modalità A: branch source main, path /docs
gh api -X POST repos/Spen-Zosky/heuresys-advanced/pages \
  -F 'build_type=legacy' \
  -F 'source[branch]=main' \
  -F 'source[path]=/docs'

# Modalità B: workflow source (come per ux-design-shared)
gh api -X POST repos/Spen-Zosky/heuresys-advanced/pages \
  -F 'build_type=workflow' \
  -F 'source[branch]=main' \
  -F 'source[path]=/'
```

### Vedere lo stato Pages

```bash
gh api repos/Spen-Zosky/ux-design-shared/pages

# Output esempio:
# {
#   "url": "...",
#   "status": null,
#   "cname": null,
#   "html_url": "https://spen-zosky.github.io/ux-design-shared/",
#   "build_type": "workflow",
#   "source": { "branch": "main", "path": "/" },
#   "public": true,
#   "https_enforced": true
# }
```

### Vedere lo storico dei build

```bash
gh api repos/Spen-Zosky/ux-design-shared/pages/builds --jq '.[] | {status, created_at, updated_at, duration: .duration}'
```

### Custom domain via CLI

```bash
# Imposta
gh api -X PUT repos/Spen-Zosky/heuresys-advanced/pages \
  -F 'cname=docs.heuresys.com'

# Disabilita custom domain (torna al .github.io)
gh api -X PUT repos/Spen-Zosky/heuresys-advanced/pages \
  -f 'cname=null'

# Force HTTPS
gh api -X PUT repos/Spen-Zosky/heuresys-advanced/pages \
  -F 'https_enforced=true'
```

### Disabilitare Pages

```bash
gh api -X DELETE repos/Spen-Zosky/heuresys-advanced/pages
```

### Checklist setup Pages (modalità workflow)

- [ ] Crea workflow YAML in `.github/workflows/` con job `build` + `deploy`.
- [ ] Configura permissions: `contents: read, pages: write, id-token: write`.
- [ ] Aggiungi `actions/configure-pages` + `actions/upload-pages-artifact` + `actions/deploy-pages`.
- [ ] Decidi base path / sub-path se servono asset URL relativi.
- [ ] Abilita Pages: `gh api -X POST .../pages -F build_type=workflow ...` o Web UI.
- [ ] Push workflow file → primo run.
- [ ] Verifica URL pubblicato.

---

## 5. Trappole comuni

- **Modalità A senza file `index.html` o `README.md`** in path: Pages 404.
- **Sub-path asset URLs**: se il sito è a `https://user.github.io/repo/` ma il build genera asset con path `/`, gli asset 404. Soluzione:
  - In Vite: `base: '/repo/'`.
  - In Next.js: `basePath: '/repo'` + `assetPrefix: '/repo'`.
  - In Hugo: `baseURL: 'https://user.github.io/repo/'`.
- **`.nojekyll` mancante per file con underscore prefix**: Jekyll ignora di default file e directory che iniziano con `_` (es. `_next/`). Se i tuoi asset hanno underscore prefix (Next.js fa così), aggiungi `.nojekyll` in root.
- **HTTPS non disponibile subito dopo custom domain**: GitHub deve emettere un certificato Let's Encrypt — possono volerci ore. Spunta solo dopo che `https_enforced` è possibile.
- **DNS apex con CNAME**: i record CNAME non sono validi per il root domain. Usa A record con 4 IP GitHub.
- **Quote Pages**: 100 GB/mese bandwidth + 10 build/ora + max 1 GB repo size. Difficile da raggiungere ma esistono.
- **Pages disabilitato su repo private senza Pro**: per repo private serve almeno GitHub Pro ($4/mese personal) o Team (org). Public è sempre OK.
- **Workflow `deploy-pages` non collegato a environment**: la UI Actions mostra il link al sito solo se il workflow specifica `environment: { name: github-pages, url: ... }`.

---

## 6. Per approfondire

- **About Pages**: <https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages>
- **Creating sites**: <https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site>
- **Custom domains**: <https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site>
- **Jekyll on Pages**: <https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll>
- **Static site generators with Actions**: <https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#publishing-with-a-custom-github-actions-workflow>
- File curriculum: [02-pages-il-nostro-caso.md](02-pages-il-nostro-caso.md) · [03-automazione/04-workflow-storybook.md](../03-automazione/04-workflow-storybook.md)
