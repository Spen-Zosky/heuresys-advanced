# 04.3 · Releases e Tags

> Un **tag** git è un riferimento immutabile a un commit. Una **GitHub Release** è un oggetto pubblicato su GitHub che linka un tag, ha release notes (Markdown), file allegati e checksum. Insieme costituiscono il modo standard di "marcare un punto stabile" del progetto.

---

## 1. Concetto

### Tag git (lato git)

Un tag è un puntatore immutabile a un commit. Due tipi:

| Tipo | Comando | Cosa contiene |
|---|---|---|
| **Lightweight** | `git tag v1.0` | Solo nome + commit SHA |
| **Annotated** | `git tag -a v1.0 -m "Release 1.0"` | Nome + SHA + autore + data + message (oggetto git separato) |

Per release pubbliche **sempre annotated**: ha autore/data/message ed è firmabile (`git tag -s`).

### GitHub Release (lato GitHub)

Un oggetto sopra il tag con:
- **Tag name** (es. `v1.0.0`)
- **Title** (es. "v1.0.0 — First public release")
- **Body** (Markdown, "release notes")
- **Assets** (file binari allegati, es. installer, zip dei build)
- **Pre-release flag** (`v1.0.0-rc.1`, `v1.0.0-beta.2`)
- **Draft flag** (visibile solo agli autori finché non pubblicata)
- **Latest flag** (alla release marker "latest")
- **Discussion link** (opt-in, crea una Discussion linkata)

URL: `https://github.com/<owner>/<repo>/releases/tag/v1.0.0`
URL latest: `https://github.com/<owner>/<repo>/releases/latest`

### Semantic Versioning (semver)

Convenzione `MAJOR.MINOR.PATCH` + optional pre-release/build:

| Componente | Quando incrementare |
|---|---|
| MAJOR | Breaking change (API rotta, schema rotto) |
| MINOR | Nuova feature backward-compatible |
| PATCH | Bug fix |
| Pre-release | `-alpha`, `-beta`, `-rc.1` (es. `1.0.0-rc.1`) |
| Build metadata | `+build.1` (raramente usato) |

Esempi:
- `0.1.0` — primo MVP
- `0.1.1` — bug fix sopra `0.1.0`
- `0.2.0` — nuova feature
- `1.0.0-rc.1` — release candidate 1 per `1.0.0`
- `1.0.0` — first stable
- `2.0.0` — breaking change

### Automazione release

Tools popolari:
- **release-please** (Google) — analizza Conventional Commits, propone bump + PR con CHANGELOG.
- **semantic-release** — full automation, no manual step.
- **changesets** — feedback per monorepo con publish a npm separato per package.
- **GitHub native** — manual via UI o `gh release create`.

---

## 2. Modello mentale

```
   main:    A───B───C───D───E───F   ◄── commit lineari
                     │       │
                     │       │
                     │       └─ tag v0.2.0 (annotated)
                     │           ↓
                     │       GitHub Release v0.2.0
                     │       ├── title: "v0.2.0 — Feature X"
                     │       ├── body: CHANGELOG markdown
                     │       └── assets: storybook-static.zip
                     │
                     └─ tag v0.1.0
                         ↓
                       GitHub Release v0.1.0 (latest=false ora)
```

Workflow naturale:
1. Sviluppo continuo su `main`.
2. Quando vuoi rilasciare: `git tag -a v0.2.0 -m "..."` + push tag.
3. Crea GitHub Release dal tag (manuale o via Action).
4. Distribuisci: linka la release pubblica.

---

## 3. Applicato ai nostri repo

### Stato attuale

| Repo | Tag | Release |
|---|---|---|
| `heuresys-advanced` | 0 | 0 |
| `ux-design-shared` | 0 | 0 |

Mai usato nessuno dei due. Ha senso così perché:
- Entrambi sono pre-1.0 sviluppo continuo.
- Non c'è ancora una API stabile da promettere.
- Il design system è consumato via `pnpm link:` (filesystem), non via release npm.

### Quando attivare release per `ux-design-shared`

Trigger naturale: **passaggio a publish npm** come `@spen-zosky/ui`. In quel momento:
- Tag e Release diventano necessari per il versioning.
- Ogni release = un publish npm.
- I consumer (incluso `heuresys-advanced`) si lockano a una versione specifica.

Versioning iniziale proposto:
- `v0.1.0` — first publish (snapshot iniziale, "as is")
- `v0.2.0` — primi miglioramenti API/component
- `v1.0.0` — quando il design system è "completo" per MVP-3 (target: dopo MVP-2 chiuso)

### Quando attivare release per `heuresys-advanced`

Trigger:
- **Soft trigger**: quando vuoi marcare milestone (es. fine MVP-2a). Solo per audit, non per distribuzione.
- **Hard trigger**: quando il progetto va in produzione e deployment è versionato (`v1.0.0` = primo deploy prod).

Versioning proposto:
- `v0.1.0-mvp1` — fine MVP-1 (commit `732e08b` retroattivamente)
- `v0.2.0-mvp2a` — fine MVP-2a (commit `6e46744` retroattivamente)
- `v1.0.0` — primo deploy production

---

## 4. Comandi / checklist

### Tag git

```bash
# Tag annotated del HEAD
git tag -a v0.1.0 -m "First MVP-1 milestone"

# Tag su commit specifico (retroattivo)
git tag -a v0.1.0 732e08b -m "First MVP-1 milestone (retroattivo)"

# Lista
git tag                                # local tags
git tag --sort=-creatordate            # ordinati per data discendente
git tag -l "v0.*"                      # filtro

# Push tag al remote
git push origin v0.1.0                 # singolo tag
git push origin --tags                 # tutti i tag (sconsigliato — può accidentalmente pushare tag locali wip)

# Elimina tag
git tag -d v0.1.0                      # locale
git push origin --delete v0.1.0        # remoto

# Tag firmato (GPG)
git tag -s v1.0.0 -m "..."

# Vedi dettagli tag annotated
git show v0.1.0
```

### GitHub Release via CLI

```bash
# Crea release da tag esistente
gh release create v0.1.0 \
  --title "v0.1.0 — MVP-1 milestone" \
  --notes "First milestone: 267 API endpoints, 182 tests green"

# Crea release + auto-genera tag
gh release create v0.1.0 main \
  --title "v0.1.0" \
  --generate-notes              # GitHub auto-genera changelog dai commit

# Crea draft (visibile solo agli admin)
gh release create v0.2.0 --draft --title "WIP next release"

# Crea pre-release
gh release create v1.0.0-rc.1 --prerelease

# Upload asset
gh release upload v0.1.0 ./build/output.zip

# Lista
gh release list --limit 10

# View
gh release view v0.1.0
gh release view --web

# Edit
gh release edit v0.1.0 --notes "Updated notes"

# Delete
gh release delete v0.1.0
gh release delete v0.1.0 --cleanup-tag    # rimuove anche il tag
```

### Auto-generated release notes

Il flag `--generate-notes` (o "Generate release notes" nella UI) costruisce un changelog dai commit + PR mergiati dall'ultima release. Risultato tipico:

```markdown
## What's Changed
* feat(api): MVP-2a 1.5.1 — compensation-intelligence by @Spen-Zosky in #5
* feat(web): MVP-2a Phase 2 batch 11 by @Spen-Zosky in #12
* docs(github): batch 1 — index by @Spen-Zosky in #15

**Full Changelog**: https://github.com/.../compare/v0.1.0...v0.2.0
```

Per customizzarlo: crea `.github/release.yml`:

```yaml
changelog:
  exclude:
    labels: [chore, docs]
  categories:
    - title: 🚀 Features
      labels: [enhancement, feature]
    - title: 🐛 Bug Fixes
      labels: [bug]
    - title: 📝 Documentation
      labels: [documentation]
    - title: 🔧 Other Changes
      labels: ["*"]
```

### release-please setup

Per automazione completa, `release-please-action` apre un PR per ogni gruppo di commit Conventional. Quando il PR è mergiato, crea automaticamente il tag + release.

File `.github/workflows/release-please.yml`:

```yaml
name: release-please

on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - uses: googleapis/release-please-action@v4
        with:
          release-type: node              # o "simple" se non npm
          package-name: heuresys-advanced
```

Ad ogni push su `main`, release-please:
1. Analizza i commit dall'ultima release.
2. Calcola il bump (major/minor/patch da Conventional Commits).
3. Aggiorna `CHANGELOG.md` + `package.json` version.
4. Apre un PR "chore(release): X.Y.Z".
5. Quando lo mergi, crea il tag + GitHub Release con notes pre-formattate.

### Checklist prima release di `ux-design-shared`

- [ ] Decidi versione iniziale (`v0.1.0` o `v1.0.0`?).
- [ ] Aggiorna `ui/package.json` version.
- [ ] Considera un `CHANGELOG.md`.
- [ ] Commit `chore: prepare v0.1.0`.
- [ ] Tag annotated + push.
- [ ] `gh release create v0.1.0 --generate-notes`.
- [ ] (Opzionale) Publish a npm — vedi [04-packages.md](04-packages.md).
- [ ] Aggiorna README con badge `![Release](https://img.shields.io/github/v/release/Spen-Zosky/ux-design-shared)`.

---

## 5. Trappole comuni

- **Tag dimenticati nel push**: `git push origin main` non pusha i tag. Devi `git push origin v1.0.0` esplicitamente.
- **Tag con typo**: `v.1.0.0` (extra dot) vs `v1.0.0`. Sembrano uguali a vista d'occhio. Convenzione: solo `v<major>.<minor>.<patch>[-pre]`.
- **Release con tag non esistente**: `gh release create v1.0.0` con tag non creato chiede di crearlo. Se sbagli il commit di partenza, distruggi e ricrea.
- **Force-pushing un tag**: cambiare il commit di un tag già pubblicato confonde i consumer. Mai `git tag -f` su tag pushati pubblicamente.
- **Versioning incoerente** tra `package.json` e tag: se `package.json: "0.2.0"` ma tag `v0.3.0`, gli npm publish failano. release-please risolve auto.
- **Latest pointer**: GitHub sceglie "latest" automaticamente come la release più recente non pre-release. Se vuoi forzare diversamente: `gh release edit vX.Y.Z --latest`.
- **Asset zip generati a mano**: per repo dove il source è già "il deliverable" (es. design system source), gli asset zip aggiunti sono ridondanti. GitHub auto-genera `Source code (zip|tar.gz)` da ogni release — sufficienti.
- **`generate-notes` senza PR merged**: se non hai usato PR (commit diretti su main), le notes sono spoglie. Conventional Commits help: `feat:` `fix:` `docs:` vengono raccolti meglio.

---

## 6. Per approfondire

- **About releases**: <https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases>
- **Managing releases**: <https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository>
- **release-please action**: <https://github.com/googleapis/release-please-action>
- **semantic-release**: <https://semantic-release.gitbook.io>
- **Semver spec**: <https://semver.org/>
- File curriculum: [04-packages.md](04-packages.md) · [01-pages-fondamenti.md](01-pages-fondamenti.md) · [03-automazione/02-actions-ricette.md](../03-automazione/02-actions-ricette.md)
