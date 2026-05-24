# DRAFT PROMPT 021 — CLI Batch X17 (MVP-3 Tappa F — @heuresys/ui npm Publish + apps/web Migration)

**Status**: DRAFT (CLI-authored bozza for Cowork-side review). Promote to `_01_PROMPT_021_batch_x17.md` when Enzo approves the decisions encoded in §0.5.
**Protocol**: Cowork↔CLI v2.2 (watchdog OFF, no inbox notify)
**Scope**: chiude MVP-3 Tappa F — pubblica `@heuresys/ui` (sibling repo `D:/ux-design-shared`) su npm registry pubblico + migra `apps/web` da `link:` dep a versioned dep
**Expected duration**: 2-3h (decisioni 30min + build setup 30min + publish 5min + migration 30min + E2E re-cert 30min + REPORT 30min)
**Authored**: 2026-05-24 by CLI X16/post-Tappa-E-UI (autonomous draft)
**Predecessor**: Tappa B (`b5d9fa0`) + Tappa E-UI (`a0d4545`) — both pushed; MVP-3 stato A/B/C/D/E backend+UI/G shipped, only F remaining

---

## §0 — Identity + cross-repo scope acknowledgment

You are Claude Code CLI on Windows. Questo batch **opera su 2 repo git distinti**:
1. **`D:/heuresys-advanced/`** — consumer repo (apps/web `link:` dep → `@heuresys/ui`)
2. **`D:/ux-design-shared/`** — library repo (`@heuresys/ui` package source)

Per CLAUDE.md doctrine: "Modifiche al package separato `ux-design-shared` sono cross-repo; lasciale visibili a Enzo prima di pushare a remote." Ogni operazione su `D:/ux-design-shared/` richiede commit + push **separato** dal heuresys-advanced commit.

### §0.5 — Decisioni richieste prima di execution

**DECISIONE 1 — Naming**:
- (A) Mantieni `@heuresys/ui` come nome npm (NB: serve creare l'organization `@heuresys` su npm, OR pubblicare unscoped come `heuresys-ui`). **Zero breaking import** in `heuresys-advanced` repo.
- (B) Rename a `@spen-zosky/ui` (org GitHub Enzo riuso). **Breaking change**: ~30 file in `heuresys-advanced` da aggiornare (`import { ... } from "@heuresys/ui"` → `from "@spen-zosky/ui"`). Plus `next.config.js transpilePackages` + `tailwind.config content` references.

→ **Raccomandazione CLI**: opzione (A) se l'organization `@heuresys` è registrabile, altrimenti (B). Decision matrice 4-Q FBI:
- Q1: `@heuresys` org disponibile su npm? — verifica con `npm view @heuresys` o WebFetch https://www.npmjs.com/org/heuresys (404 → libera, 200 → presa)
- Q2: Costo: org npm è free per repos pubblici, $7/user/mo per privati — per @heuresys/ui pubblico = $0
- Q3: NPM_TOKEN credentials disponibili? CHIEDI A ENZO (R11 — non lo gestisco io)
- Q4: Q5: Alternativa: pubblicare unscoped come `heuresys-ui` (no org needed, single-word name). **Sub-raccomandazione**: se org disponibile (A); altrimenti unscoped `heuresys-ui` over `@spen-zosky/ui` (meno breaking).

**DECISIONE 2 — Build target**:
- (X) ESM only (`type: "module"`, `module: "./dist/index.js"`, no CJS) — clean, modern, ma rompe consumer CJS legacy
- (Y) CJS+ESM dual (entrypoints `main`/`module`/`types`) — universale, ma raddoppia bundle size
- (Z) Pubblica sorgenti TSX as-is (sec `transpilePackages` lato consumer come ora) — zero build pipeline, ma forza ogni consumer a transpile

→ **Raccomandazione CLI**: opzione (Y) per universalità. Eseguo `tsup` o `tsc --build` per produrre `dist/{index.js,index.mjs,index.d.ts}`.

**DECISIONE 3 — Version bump iniziale**:
- (V1) 0.0.0 → **0.1.0** (semver: prima minor release, no stability promise)
- (V2) 0.0.0 → 1.0.0 (semver: signal stability/production-ready)

→ **Raccomandazione CLI**: V1 (0.1.0). Production-ready stamping può attendere CHANGELOG + breaking-change discipline.

**DECISIONE 4 — Migration apps/web**:
- (M1) **Stay symlink** post-publish — `apps/web/package.json` resta `"@heuresys/ui": "link:../ux-design-shared/ui"`. Il publish è solo pubblicazione esterna, no migration interna.
- (M2) **Switch to versioned** — `apps/web/package.json` diventa `"@heuresys/ui": "^0.1.0"`. Consumer in heuresys-advanced ora usa npm package vs symlink locale.

→ **Raccomandazione CLI**: **M2** per testare il pubblicato end-to-end, ma fare M1 prima del Block D (post-publish) per permettere `npm publish` finale a Enzo manuale (non blocca workflow). In effetti, M2 senza M1 = batch CLI testa solo se Enzo ha fatto publish; M1+M2 in sequenza permette CLI prep tutto + Enzo fa publish solo + CLI poi rieseguono test post-migration.

**ATTENDI le 4 risposte di Enzo PRIMA di iniziare execution.** Pre-flight non procede.

---

## §1 — Pre-flight live-state (post-decisioni)

```bash
cd D:/heuresys-advanced
git log --oneline -3                                    # expected: HEAD a0d4545 (Tappa E-UI) or further
git tag --list | sort -V | tail -3                      # expected: v0.2.1-mvp2a-final + future MVP-3 tags

cd D:/ux-design-shared
git log --oneline -3                                    # expected: HEAD 3b3192f (memory) or further — VERIFY
git status --short                                      # expected: clean (no uncommitted)
cat ui/package.json | head -20                          # current state of @heuresys/ui manifest

# Verifica org npm availability (Decision 1A path)
npm view @heuresys 2>&1 | head -5                       # expected: 404 if free, else org details
npm whoami 2>&1 | head -3                               # expected: Enzo's npm username if logged in, else "Not logged in"
```

### HALT P0 conditions

- HEAD `D:/heuresys-advanced` ≠ branch atteso (drift since draft authoring)
- `D:/ux-design-shared` dirty working tree (commit unaligned con Enzo's state)
- `npm whoami` non logged in (no auth → no publish capability)
- Org/package name preso da altri (rivedere Decision 1)

---

## §2 — Block A: Library repo prep (D:/ux-design-shared)

### Step A.1 — Update package.json

Editare `D:/ux-design-shared/ui/package.json`:

```json
{
  "name": "@heuresys/ui",  // or per Decision 1
  "version": "0.1.0",       // per Decision 3
  "description": "Heuresys UI — design system + dashboard components (Tier 1-16)",
  "license": "PROPRIETARY",  // verifica vs LICENSE file del repo
  "publishConfig": {
    "access": "public"
  },
  "main": "./dist/index.cjs",     // per Decision 2Y dual
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    },
    "./styles.css": "./dist/styles.css"   // se esiste
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  // remove "private": true
  // keep peerDependencies (react, react-dom)
  "scripts": {
    "build": "tsup",      // or "tsc --build && rollup -c" — see Step A.2
    "publish:dry": "npm publish --dry-run",
    "publish:release": "npm publish"
  }
}
```

### Step A.2 — Build pipeline

Verifica se `D:/ux-design-shared/ui` ha già un build script. Se no, installare `tsup`:

```bash
cd D:/ux-design-shared/ui
npm install --save-dev --legacy-peer-deps tsup
```

Creare `tsup.config.ts`:

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  external: ["react", "react-dom"],
  treeshake: true,
});
```

Eseguire `npm run build`. Verifica `dist/` contiene `index.cjs`, `index.mjs`, `index.d.ts`.

### Step A.3 — Dry-run publish

```bash
cd D:/ux-design-shared/ui
npm publish --dry-run 2>&1 | tee /d/heuresys-advanced/qa_artifacts/x17_publish_dryrun.txt
```

Acceptance: dry-run mostra il tarball con file expected (`dist/*`, `package.json`, `README.md`, `LICENSE`). No warnings critici.

---

## §3 — Block B: Cross-repo commit ux-design-shared

Commit nel repo separato:

```bash
cd D:/ux-design-shared
git add ui/package.json ui/tsup.config.ts ui/dist .gitignore
# Verifica .gitignore esclude dist se vogliamo `npm publish` re-generate dist al CI;
# OR committa dist se è il caso di MVP-3 (no CI per ux-design-shared yet — committa dist)
git commit -m "feat(ui): publish-ready — version 0.1.0 + tsup dual build + publishConfig public"

# NO push (lasciare a Enzo per audit pre-publish)
```

---

## §4 — Block C: Publish (USER ACTION REQUIRED)

**Questo step è eseguito MANUALMENTE da Enzo, NON dal CLI**, per R11 secret hygiene (NPM_TOKEN handling).

CLI fornisce le istruzioni precise:

```bash
cd D:/ux-design-shared/ui
# Se non già loggato:
npm login    # prompt interactive — Enzo inserisce username/password/2FA

# Pubblicazione effettiva:
npm publish

# Verifica post-publish:
npm view @heuresys/ui
```

**Confirmation gate**: Enzo conferma al CLI "publish done" → CLI procede Block D.

---

## §5 — Block D: Migrate apps/web da link → versioned

### Step D.1 — Update apps/web/package.json

```bash
cd D:/heuresys-advanced
# Edit apps/web/package.json:
# OLD:  "@heuresys/ui": "link:../ux-design-shared/ui"
# NEW:  "@heuresys/ui": "^0.1.0"
```

### Step D.2 — Update root package.json se ha dep

(Verifica `cat package.json | grep heuresys/ui` — se è solo in apps/web non serve)

### Step D.3 — Update next.config.js

`transpilePackages: ["@heuresys/ui", "@heuresys/shared"]` può restare (dual o solo `@heuresys/shared`):
- Pre-compiled dist non richiede transpile → rimuovi `@heuresys/ui` da `transpilePackages`
- `@heuresys/shared` ancora `link:` interno → resta in transpilePackages

### Step D.4 — Refresh lockfile

```bash
pnpm install
# Lockfile updated. node_modules/@heuresys/ui ora resolve da npm registry, non symlink.
readlink -f node_modules/@heuresys/ui  # ora dovrebbe NON essere /d/ux-design-shared/ui
```

### Step D.5 — Verify E2E + build still green

```bash
pnpm --filter @heuresys/web exec tsc --noEmit   # exit 0
pnpm --filter @heuresys/web build                # exit 0, 63 routes
# Restart pnpm start with NEXT_PUBLIC_ENABLE_SHOWCASE=1
NEXT_PUBLIC_ENABLE_SHOWCASE=1 node apps/web/node_modules/next/dist/bin/next start apps/web -p 3000 &
sleep 30
pnpm --filter @heuresys/web exec playwright test 2>&1 | tail -5
# expected: ~124/125 PASS (baseline X16 + Tappa B + Tappa E-UI = +2 tests)
```

Acceptance Block D: typecheck PASS, build PASS, Playwright effective PASS ≥ 125 (or ≥ 95% se shell-contract pre-existing fail residual).

---

## §6 — Block E: Commit + tag + push

```bash
cd D:/heuresys-advanced
git add apps/web/package.json apps/web/next.config.js pnpm-lock.yaml qa_artifacts/x17_*.txt cowork_code_exchange/_04_REPORT_021_batch_x17.md
git commit -m "feat(web): MVP-3 Tappa F — migrate @heuresys/ui from link to versioned dep (0.1.0)"

# Tag MVP-3 closure
git tag -a v0.3.1-mvp3-final -m "MVP-3 complete: A/B/C/D/E backend+UI/F/G all shipped, Brownfield Wave 1 known issue residual"

# Push commit + tag — esplicita autorizzazione richiesta a Enzo
# (CLI NON push autonomamente per cross-repo + tag pubblici)
```

---

## §7 — REPORT format

`cowork_code_exchange/_04_REPORT_021_batch_x17.md`. Structure:

```
§0 Pre-conditions outcome + 4 decisioni adottate
§1 Block A library prep outcome (package.json diff, build artifacts list, dry-run)
§2 Block B ux-design-shared commit
§3 Block C publish outcome (Enzo confirmation timestamp + npm view output)
§4 Block D migration outcome (typecheck + build + Playwright vs versioned dep)
§5 Block E commit + tag summary
§6 Bias catalog updates (atteso ≥1 nuovo CW-B per cross-repo coupling? to be seen)
§7 Next step C18 recommendation (MVP-3 closure, optional: Brownfield Wave 1 full-47k SQL-side upsert session)
§8 Halt status
```

---

## §8 — Halt triggers P0

| Trigger | Severity |
|---|---|
| Decisioni 1-4 non risposte da Enzo | P0 (no execution) |
| `npm whoami` Not logged in | P0 |
| Org/package name preso | P0 (rivedi Decision 1) |
| `npm publish --dry-run` warnings critici (es. missing files, license drift) | P0 |
| Post-publish: `npm view @heuresys/ui` ritorna 404 (publish silently failed) | P0 |
| Post-migration: typecheck regression > 0 errors | P0 |
| Post-migration: Playwright structural FAIL > 0 (non timing/env) | P0 |
| `D:/ux-design-shared` dirty pre-batch | P0 (allinea con Enzo) |

---

## §9 — Reference

| Path | Purpose |
|---|---|
| `D:/heuresys-advanced/CLAUDE.md` §"Design System" | rules ux-design-shared symlink + import policy |
| `D:/ux-design-shared/ui/package.json` | current manifest (version 0.0.0, private) |
| `cowork_code_exchange/_04_REPORT_020_batch_x16.md` §6 | post-MVP-2a Option D recommendation chain |
| Memory `project_brand_session1_state.md` | ux-design-shared HEAD `3b3192f` (verify current) |
| https://www.npmjs.com/org/heuresys | check org availability |
| https://docs.npmjs.com/cli/v10/commands/npm-publish | publish reference |

---

## §10 — Out of scope per X17

- **Brownfield Wave 1 full-47k SQL-side upsert** (Tappa D known issue) — separate ~2-3h session
- **Login-gating MFA** (`/v1/auth/login` → mfaChallenge response) — Tappa E-UI partial, login refactor coordinated session
- **`@heuresys/shared` npm publish** — solo `@heuresys/ui` in scope; shared resta link interno
- **GitHub release notes per v0.3.1-mvp3-final** — manuale post-push

---

*End DRAFT PROMPT 021 — Cowork to review + promote to _01_PROMPT_021_batch_x17.md.*
