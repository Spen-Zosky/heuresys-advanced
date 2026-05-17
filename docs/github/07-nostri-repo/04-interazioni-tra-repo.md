# 07.4 · Interazioni tra `heuresys-advanced` e `ux-design-shared`

> I due repo sono **fratelli, non parent/child**. Vivono separati su GitHub ma comunicano via dipendenza npm (oggi `pnpm link:`, domani publish). Questo file analizza come si parlano, cosa significa cambiare la modalità, e come tenerli allineati.

---

## 1. La relazione oggi

```
       ┌────────────────────────────────────┐
       │  GitHub                            │
       │                                    │
       │  ┌─────────────────────┐           │
       │  │ heuresys-advanced   │           │
       │  │ (consumer)          │           │
       │  └─────────┬───────────┘           │
       │            │                       │
       │            │ (nessuna relazione    │
       │            │  diretta su GitHub)   │
       │            ▼                       │
       │  ┌─────────────────────┐           │
       │  │ ux-design-shared    │           │
       │  │ (provider)          │           │
       │  └─────────────────────┘           │
       └────────────────────────────────────┘

       Filesystem locale (D:\):
       ┌────────────────────────────┐
       │ /d/heuresys-advanced       │
       │   node_modules/            │
       │     @heuresys/ui ──────────┼──► /d/ux-design-shared/ui
       │       (symlink)            │       (real directory)
       └────────────────────────────┘
```

### Caratteristiche della relazione

| Aspetto | Stato |
|---|---|
| **Repo separati su GitHub** | ✅ Sì, niente submodule / subtree |
| **Versioning indipendente** | ✅ Sì, ognuno ha la sua history |
| **Issue cross-link supportato** | ✅ Da GFM: `Spen-Zosky/ux-design-shared#42` |
| **Workflow CI condivisi** | ❌ No |
| **Settings condivisi** | ❌ No (replicare manualmente) |
| **Auth condivisa** | ✅ Stessa account `Spen-Zosky` |
| **Pipeline release** | ❌ Indipendenti |
| **Dipendenza npm/code** | ⚠️ Sì, via `pnpm link:` filesystem |

### Le tecniche per "linking" tra repo GitHub

| Tecnica | Cosa è | Quando ha senso |
|---|---|---|
| **Submodule git** | Un repo "nested" dentro un altro | Quando devi includere code C library | ❌ NO per noi (overhead, conflitti rebase) |
| **Subtree git** | Copia di un branch di un altro repo | Vendoring senza dependency manager | ❌ NO |
| **pnpm link:** | symlink locale (filesystem) | Multi-repo, fast iteration, sole-coder | ✅ Quello che usiamo |
| **npm package** | Dependency standard via registry | Versioning + multi-team + audit | ⏳ Path futuro |
| **GitHub Packages** | Idem ma registry GitHub-hosted | Stesso scope di npm, integrato con repo | ⏳ Path futuro |
| **GitHub Org with team** | Repo dentro un'org con permessi shared | Multi-developer + governance | ❌ NO oggi |

Abbiamo scelto `pnpm link:` per la massima velocità di iterazione sul design system durante lo sviluppo. Tradeoff: nessun versioning e CI ha bisogno di checkout dual.

---

## 2. La relazione domani — opzioni

### Opzione A: `@spen-zosky/ui` su GitHub Packages

Path documentato in `04-publishing/04-packages.md` e `07-nostri-repo/03-ux-design-shared.md`. Recap:

1. `ux-design-shared/ui/package.json` cambia nome → `@spen-zosky/ui`.
2. Workflow di release publishlo a `npm.pkg.github.com`.
3. `heuresys-advanced/package.json` cambia da `"link:..."` a `"^0.1.0"`.

**Pro**:
- Versioning esplicito.
- Setup macchina nuova: 1 repo solo.
- CI funziona senza dual checkout.
- Audit dependency chain pulito.

**Contro**:
- Bump + publish + update per ogni change.
- Lock-in moderato al GitHub Packages registry.
- Login richiede PAT con scope `read:packages`.

### Opzione B: `@spen-zosky/ui` su npmjs.com (registry pubblico)

Stesso flusso di A ma `publishConfig.registry: "https://registry.npmjs.org"`.

**Pro vs A**:
- Discoverability (search engine npm).
- Niente PAT richiesto per consumer.
- Pattern de facto per design system pubblici.

**Contro vs A**:
- Separazione tra codice (GitHub) e package (npm). Login npm separato.
- Username scope `@spen-zosky` deve essere registrato su npmjs.com (potrebbe essere già preso).
- Più visibile = più responsabilità (issue tracker da npm può overlap con GitHub).

### Opzione C: stay on `pnpm link:` per sempre

**Quando**:
- Restiamo sole-coder per molto tempo ancora.
- Il design system è strettamente specifico a Heuresys.
- Nessuna terza parte chiederà mai accesso al package.

Decisione fattibile, ma rinunci a versioning + CI native fit.

### Raccomandazione

Per ora: **C**. Per i prossimi 3-6 mesi rimaniamo `pnpm link:`. Quando si verifica uno dei seguenti, passa a A:
1. Arriva un secondo developer al progetto.
2. Devi pubblicare release pubbliche di `heuresys-advanced` versionate.
3. Una terza parte chiede accesso a `@heuresys/ui`.

---

## 3. Tenere i due repo allineati

### Settings replicabili

Quando configuri un setting su un repo, replica anche sull'altro per coerenza. Lista:

| Setting | Comando |
|---|---|
| Topics | `gh repo edit OWNER/REPO --add-topic ...` |
| Wiki disabilitata | `gh repo edit OWNER/REPO --enable-wiki=false` |
| Merge strategies | `gh repo edit OWNER/REPO --allow-merge-commit=false ...` |
| Branch protection Tier 1 | Ruleset duplicato manualmente |
| Dependabot | `.github/dependabot.yml` (path-specific) |
| Issue labels | `gh label clone SRC/REPO --repo DST/REPO` |
| Workflow comune (es. CodeQL) | Stesso YAML in entrambi |

### Cross-link issue/PR/commit

GFM e GitHub UI supportano riferimenti cross-repo:

```markdown
- Bug nel componente: Spen-Zosky/ux-design-shared#3
- Vedi commit Spen-Zosky/heuresys-advanced@aeea62d
- PR collegato: Spen-Zosky/heuresys-advanced#5
```

GitHub auto-linka questi. Anche nelle commit message:
```
fix(api): use button without focus ring

Fixes Spen-Zosky/ux-design-shared#7
```

### Workflow trigger cross-repo (raro ma utile)

Un workflow in `ux-design-shared` può triggerare un workflow in `heuresys-advanced`. Esempio: dopo nuova release del design system, ri-builda l'app per verifica.

File `.github/workflows/notify-consumer.yml` in `ux-design-shared`:

```yaml
name: Notify consumer
on:
  release:
    types: [published]
jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - uses: peter-evans/repository-dispatch@v3
        with:
          token: ${{ secrets.CONSUMER_REPO_PAT }}
          repository: Spen-Zosky/heuresys-advanced
          event-type: ux-design-shared-released
          client-payload: '{"version": "${{ github.event.release.tag_name }}"}'
```

E in `heuresys-advanced/.github/workflows/on-ds-release.yml`:

```yaml
name: On UI release
on:
  repository_dispatch:
    types: [ux-design-shared-released]
jobs:
  rebuild:
    runs-on: ubuntu-latest
    steps:
      - run: echo "New UI release: ${{ github.event.client_payload.version }}"
      # ... bump dipendenza + open PR via release-please ...
```

Setup richiede un PAT con scope `repo` per cross-repo trigger. Oggi: non necessario.

---

## 4. Workflow di sviluppo coordinato

### Scenario A: cambio simultaneo in entrambi i repo

Caso: aggiungi una nuova prop al `<Button>` in `ux-design-shared`, contestualmente la usi in una pagina di `heuresys-advanced`.

Sequenza (oggi, con `pnpm link:`):
1. Modifica `ux-design-shared/ui/src/components/Button.tsx` — aggiungi prop.
2. (Filesystem live) `heuresys-advanced/apps/web/src/.../page.tsx` può già usare la prop.
3. Test in locale via `pnpm dev`.
4. Quando soddisfatto: commit + push **prima** `ux-design-shared` (la dependency), **poi** `heuresys-advanced` (il consumer).
5. CI di `ux-design-shared` triggera deploy Storybook con la nuova prop.

In un mondo `@spen-zosky/ui` su npm:
1. Modifica + commit + PR su `ux-design-shared`.
2. Merge → tag + release `v0.2.0` automatico.
3. PR su `heuresys-advanced` bumpa `"@spen-zosky/ui": "^0.2.0"`.
4. Merge.

Più lento ma più tracciabile.

### Scenario B: bugfix nel design system

Bug scoperto durante uso in `heuresys-advanced`.

Sequenza (oggi):
1. Apri Issue in `ux-design-shared`: "Component X broken when prop Y is true".
2. Fix in `ux-design-shared`. Test locale (lo vede subito).
3. Commit. Push.
4. Chiudi l'issue.
5. (Optional) Issue cross-link in `heuresys-advanced` per documentare l'incidente.

---

## 5. Pattern di Issue tracking per i 2 repo

Quando attiverai Issue (oggi 0 in entrambi):

### Tracking di un cambio cross-repo

Apri 2 issue, 1 per repo, linkate:

```
ux-design-shared#1: Add dark mode support to Card component
heuresys-advanced#1: Adopt Card dark mode in /me/profile page
                     Depends on Spen-Zosky/ux-design-shared#1
```

### Label coordinati

Stessi label nei 2 repo (clone via gh label clone). Es:

```
type/feat, type/fix, type/docs, type/chore
area/ui (per ux-design-shared) — area/api, area/web, area/db (per heuresys-advanced)
severity/critical, /high, /medium, /low
```

### Project v2 cross-repo

Un singolo Project "Heuresys Roadmap" che aggrega issue da entrambi i repo:

```bash
gh project item-add 1 --owner Spen-Zosky \
  --url https://github.com/Spen-Zosky/ux-design-shared/issues/1
gh project item-add 1 --owner Spen-Zosky \
  --url https://github.com/Spen-Zosky/heuresys-advanced/issues/1
```

Vista a livello "platform" senza limitarsi a un singolo repo.

---

## 6. Migration playbook: da `pnpm link:` a npm package

Sequenza step-by-step quando deciderai di fare il salto. Tutti gli step sono reversibili (committa prima di ognuno).

### Fase 1 — Preparazione (`ux-design-shared`)

1. Aggiorna `ui/package.json`:
   - `name`: `@spen-zosky/ui`
   - `version`: `0.1.0`
   - `publishConfig.registry`: `https://npm.pkg.github.com`
   - `files`: `["dist", "src"]`
   - `main` / `types` / `exports`: configura per ESM + d.ts
2. Aggiungi tooling per `dist/` (es. `tsup`):
   ```bash
   npm install -D tsup
   ```
   `tsup.config.ts`:
   ```typescript
   import { defineConfig } from 'tsup';
   export default defineConfig({
     entry: ['src/index.ts'],
     format: ['esm'],
     dts: true,
     external: ['react', 'react-dom'],
   });
   ```
   Aggiungi script `"build": "tsup"`.
3. Test locale: `npm run build && ls dist/`
4. Commit: `feat(build): add tsup build for npm publish`.

### Fase 2 — Release workflow

5. Crea `.github/workflows/publish.yml` (template in `04-publishing/04-packages.md`).
6. Crea `.github/workflows/release-please.yml` (template in `04-publishing/03-releases-e-tags.md`).
7. Commit. Push.

### Fase 3 — Prima release

8. release-please apre un PR `chore(release): 0.1.0`.
9. Merge il PR → tag `v0.1.0` + GitHub Release auto-creata.
10. `publish.yml` triggera → `@spen-zosky/ui@0.1.0` su npm.pkg.github.com.
11. Verifica: `gh api /users/Spen-Zosky/packages/npm/ui/versions`.

### Fase 4 — Switch consumer (`heuresys-advanced`)

12. In `heuresys-advanced/package.json` (root e/o `apps/web`):
    ```diff
    -  "@heuresys/ui": "link:../ux-design-shared/ui"
    +  "@spen-zosky/ui": "^0.1.0"
    ```
13. Aggiungi `.npmrc`:
    ```
    @spen-zosky:registry=https://npm.pkg.github.com
    //npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
    ```
14. Setup ENV var `GITHUB_PACKAGES_TOKEN` con PAT scope `read:packages` (sia locale che eventualmente in CI).
15. Rinomina tutti gli import nel codice:
    ```bash
    grep -rl "@heuresys/ui" apps/ packages/ | \
      xargs sed -i 's|@heuresys/ui|@spen-zosky/ui|g'
    ```
16. `pnpm install` → verifica risolva da registry.
17. Test: `pnpm typecheck && pnpm test`.
18. Commit: `feat(deps): migrate from pnpm link: to @spen-zosky/ui ^0.1.0`.

### Fase 5 — Cleanup

19. Rimuovi `pnpm link:` dependency da `package.json`.
20. (Opzionale) Aggiorna `CLAUDE.md` di `heuresys-advanced` per riflettere il nuovo flow.
21. (Opzionale) Mantieni un fallback `link:` per dev veloce (npm scripts).

Tempo totale stimato: 4-6 ore se è la prima volta che lo fai.

---

## 7. Per approfondire

- `04-publishing/04-packages.md` — setup tecnico GitHub Packages
- `04-publishing/03-releases-e-tags.md` — release automation
- `07.2` [`02-heuresys-advanced.md`](02-heuresys-advanced.md) — repo consumer
- `07.3` [`03-ux-design-shared.md`](03-ux-design-shared.md) — repo provider
- `08` [`../08-roadmap.md`](../08-roadmap.md) — quando fare cosa
- File del repo: `CLAUDE.md` sezione "Design System" del `heuresys-advanced` per il setup `link:` corrente
