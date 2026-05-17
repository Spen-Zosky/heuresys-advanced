# 04.4 · GitHub Packages

> **GitHub Packages** è il registry hosted da GitHub per pacchetti software: npm, Docker container, Maven, NuGet, RubyGems. Gratis per repo public, scope-prefixato automaticamente all'owner. È il candidato naturale per pubblicare `@spen-zosky/ui` se decidi di distribuire il design system come npm package.

---

## 1. Concetto

GitHub Packages è un **registry multi-format**:

| Format | Use case | Comando consumer |
|---|---|---|
| **npm** | JS/TS libraries | `npm install @scope/pkg` |
| **container (OCI)** | Docker images | `docker pull ghcr.io/owner/image` |
| **maven** | Java/Kotlin | `mvn install` con repo GitHub |
| **gradle** | Idem | Idem |
| **nuget** | .NET | `dotnet add package` |
| **rubygems** | Ruby | `gem install` |

Caratteristiche:
- **Scope auto-prefixed**: i pacchetti vivono sotto lo scope `@<owner>/`. Es. `@spen-zosky/ui`.
- **Auth via `GITHUB_TOKEN`**: nel CI, il token automatico ha publish permission se dichiari `permissions: { packages: write }`.
- **Public/private**: i pacchetti ereditano la visibility del repo (public → free; private → quote sul tier).
- **Pricing**: gratis per public packages senza limiti. Per private packages: 500 MB storage + 1 GB transfer/mese su Free tier.

### npm su GitHub Packages vs npmjs.com

| | GitHub Packages | npmjs.com |
|---|---|---|
| **Default scope** | `@<owner>/` (forzato) | Qualsiasi |
| **Auth** | PAT o `GITHUB_TOKEN` | npm login (manual) |
| **Discoverability** | Bassa (no search engine ottimizzato) | Alta (npm registry pubblico) |
| **Pricing public** | Gratis | Gratis |
| **Co-location con codice** | Sì (stesso GitHub) | Separata |
| **CI/CD natural fit** | Sì (`GITHUB_TOKEN` automatico) | Richiede secret `NPM_TOKEN` |

**Convenzione comune**: usare GitHub Packages per pacchetti "internal" (uso aziendale), npmjs.com per pacchetti pubblici che vogliono ampia visibilità.

### Container Registry (ghcr.io)

`ghcr.io` è l'URL del container registry GitHub. Esempi:

```bash
# Pull immagine pubblica
docker pull ghcr.io/spen-zosky/api:latest

# Push (da CI)
docker build -t ghcr.io/spen-zosky/api:v1.0.0 .
echo $GITHUB_TOKEN | docker login ghcr.io -u Spen-Zosky --password-stdin
docker push ghcr.io/spen-zosky/api:v1.0.0
```

Vantaggi su Docker Hub: free unlimited per repo public, integrato con repo, multi-arch builds nativi.

---

## 2. Modello mentale

```
   ┌────────────────────────────────────────────────────────────┐
   │   GitHub Account: Spen-Zosky                               │
   │                                                            │
   │   Repos (codice)              Packages (artifacts)         │
   │   ─────────────               ───────────────────          │
   │   heuresys-advanced  ◄────►   @spen-zosky/api (futuro)     │
   │                               ghcr.io/spen-zosky/api       │
   │                                                            │
   │   ux-design-shared   ◄────►   @spen-zosky/ui  (futuro)     │
   │                                                            │
   │   Auth: GITHUB_TOKEN nel CI (packages:write)               │
   │          PAT classico per local publish                    │
   └────────────────────────────────────────────────────────────┘
```

Ogni package è linkabile a un repo (mostrato nella sidebar del repo + nella tab `Packages` dell'utente).

---

## 3. Applicato ai nostri repo

### Stato attuale: **0 pacchetti pubblicati**

Nessuno dei due repo ha pubblicato qualcosa. Il design system è consumato via `pnpm link:` (filesystem).

### Path verso il publish di `@spen-zosky/ui`

Quando decidi di passare da `pnpm link:` a `npm install @spen-zosky/ui@^1.0.0`:

**Step 1 — Update `ui/package.json`**

```json
{
  "name": "@spen-zosky/ui",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist", "src"],
  "publishConfig": {
    "registry": "https://npm.pkg.github.com",
    "access": "public"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/Spen-Zosky/ux-design-shared.git",
    "directory": "ui"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

Changes critici:
- Nome con scope (`@spen-zosky/ui`, era `@heuresys/ui`)
- Aggiungi `publishConfig.registry` puntato a GitHub Packages
- Aggiungi `repository` (link al repo)
- Aggiungi `peerDependencies` (React come peer, non bundled)
- Build script che genera `dist/` con .d.ts type declarations

**Step 2 — Workflow `.github/workflows/publish.yml`**

```yaml
name: Publish to GitHub Packages

on:
  release:
    types: [published]

permissions:
  contents: read
  packages: write

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          registry-url: https://npm.pkg.github.com

      - run: npm install --legacy-peer-deps

      - name: Build dist
        run: npm run build --workspace=ui

      - run: npm publish --workspace=ui
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Step 3 — Update `heuresys-advanced` per consumare**

```jsonc
// apps/web/package.json (e root)
{
  "dependencies": {
    // OLD: "@heuresys/ui": "link:../ux-design-shared/ui"
    "@spen-zosky/ui": "^0.1.0"
  }
}
```

E nella stessa directory, un file `.npmrc`:
```
@spen-zosky:registry=https://npm.pkg.github.com
```

Più un PAT con `read:packages` scope, configurato sulla macchina dev e in CI come `secrets.PERSONAL_ACCESS_TOKEN`:
```
//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
```

**Step 4 — Workflow di release**

Vedi `04.3-releases-e-tags.md` per setup release-please che crea automaticamente release+tag → triggera `publish.yml`.

### Pro/contro vs `pnpm link:` attuale

**Pro publish**:
- Versioning esplicito (heuresys-advanced lock a versione specifica).
- Setup nuova macchina più semplice (no need clonare 2 repo).
- Terze parti possono usare il design system.
- CI/CD funziona senza checkout di 2 repo.

**Contro publish**:
- Workflow di release aggiunto.
- Ogni piccola modifica → bump version + publish + update consumer.
- Latenza dev: cambio in `ui` → rilascia → bump in app → install.
- Lock-in al GitHub registry (più macchinoso da migrare a npmjs.com).

**Quando passare**: quando avete 2+ consumer di `@heuresys/ui` o quando entra un secondo dev che non vuole gestire il setup symlink.

---

## 4. Comandi / checklist

### npm publish a GitHub Packages

```bash
# Auth locale (una tantum)
echo "//npm.pkg.github.com/:_authToken=$YOUR_PAT" >> ~/.npmrc
# YOUR_PAT con write:packages scope

# Tag che fa il publish (con publishConfig configurato)
cd ui
npm version 0.1.0
npm publish
```

In CI con `secrets.GITHUB_TOKEN`: vedi workflow sopra.

### Install di un package consumato

```bash
# .npmrc del consumer
@spen-zosky:registry=https://npm.pkg.github.com

# auth via PAT (read:packages scope) — ENV var
export GITHUB_PACKAGES_TOKEN=$YOUR_PAT
echo "//npm.pkg.github.com/:_authToken=$GITHUB_PACKAGES_TOKEN" >> .npmrc

# install
pnpm add @spen-zosky/ui
```

### Container publish (esempio per future `api` image)

```bash
# Local
docker build -t ghcr.io/spen-zosky/heuresys-api:v0.1.0 .
echo $GITHUB_TOKEN | docker login ghcr.io -u Spen-Zosky --password-stdin
docker push ghcr.io/spen-zosky/heuresys-api:v0.1.0
docker push ghcr.io/spen-zosky/heuresys-api:latest

# CI workflow
# permissions: packages: write
# steps:
#   - uses: docker/login-action@v3 with: { registry: ghcr.io, username: ..., password: ${{ secrets.GITHUB_TOKEN }} }
#   - uses: docker/build-push-action@v6 with: { tags: ghcr.io/spen-zosky/heuresys-api:v0.1.0, push: true }
```

### Vedere packages pubblicati

```bash
# Lista packages dell'utente
gh api /users/Spen-Zosky/packages --jq '.[] | {name, package_type, visibility}'

# Versioni di un package
gh api /users/Spen-Zosky/packages/npm/ui/versions
```

Web UI: `https://github.com/Spen-Zosky?tab=packages`

### Permessi PAT per pacchetti

Per **publish** (writer): scope `write:packages` + `read:packages`.
Per **consume** (reader): scope `read:packages` (sufficiente per public e private a cui hai accesso).

Per fine-grained PAT: invece di scope, scegli "Packages: Read/Write" sotto Repository permissions.

### Checklist primo publish

- [ ] Decidi nome (`@spen-zosky/ui`?) e versione iniziale (`0.1.0`).
- [ ] Aggiorna `package.json` con `publishConfig` + `repository` + `peerDependencies`.
- [ ] Build genera `dist/` con types.
- [ ] Crea workflow `publish.yml` triggered on `release:published`.
- [ ] Crea release (`gh release create v0.1.0 --generate-notes`) → triggera publish.
- [ ] Verifica package live: `gh api /users/Spen-Zosky/packages/npm/ui`.
- [ ] Aggiorna README con `npm install @spen-zosky/ui`.

---

## 5. Trappole comuni

- **Scope obbligatorio** su GitHub Packages npm: package name **deve** iniziare con `@<owner>/`. Senza scope, `npm publish` fail.
- **Visibility ereditata da repo**: package public solo se repo public. Cambiare visibility del repo cambia anche dei suoi packages.
- **PAT classic con scope mancante**: se publish fallisce con 401/403, verifica scope `write:packages` (classic) o "Packages: Write" (fine-grained).
- **`GITHUB_TOKEN` con `packages: write` mancante**: nel workflow, anche se default è `write` ora, dichiaralo esplicitamente.
- **Cancellazione package**: GitHub permette di "delete" un package, **ma non puoi ripubblicare la stessa versione**. Bump version sempre.
- **Quota private packages**: 500 MB storage + 1 GB transfer/mese (Free tier). Public è illimitato.
- **Dependency su altro `@scope/`**: se `@spen-zosky/ui` dipende da `@altro-scope/x`, il consumer deve avere `.npmrc` con entrambi i registry — può diventare scomodo.
- **Container image multi-arch**: Docker Hub fa multi-arch facilmente; `ghcr.io` ok ma serve buildx setup nel workflow.
- **Mismatch tag git vs package version**: convenzione tagging `v1.0.0` (con v prefix) ma `package.json: "1.0.0"` (no v). release-please gestisce.

---

## 6. Per approfondire

- **GitHub Packages overview**: <https://docs.github.com/en/packages/learn-github-packages/about-github-packages>
- **Working with the npm registry**: <https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry>
- **Working with the Container registry**: <https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry>
- **Pricing & billing**: <https://docs.github.com/en/billing/managing-billing-for-github-packages/about-billing-for-github-packages>
- File curriculum: [03-releases-e-tags.md](03-releases-e-tags.md) · [07-nostri-repo/04-interazioni-tra-repo.md](../07-nostri-repo/04-interazioni-tra-repo.md) `🚧 in arrivo`
