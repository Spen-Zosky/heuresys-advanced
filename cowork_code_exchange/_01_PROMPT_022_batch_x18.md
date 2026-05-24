# PROMPT 022 — CLI Batch X18 (MVP-3 Tappa F — @heuresys/ui npm Publish + apps/web Versioned Migration)

**Status**: FORMAL (promoted from DRAFT `_00_DRAFT_PROMPT_021_batch_x17_tappa_f.md` after Enzo's 4 C18-session decisions, 2026-05-24).
**Protocol**: Cowork↔CLI v2.2 (watchdog OFF, no inbox notify, manual poll only).
**Goal ID**: 022 · **Slug**: `batch_x18_tappa_f_npm_publish_versioned_migration`
**Predecessor**: REPORT 021 (X17 D+B combo, P1 gh release closed in C18 session, HEAD `836880b` post-handoff refresh).
**Scope**: chiude MVP-3 Tappa F — publish `@heuresys/ui` (sibling repo `D:/ux-design-shared`) su npm registry pubblico **as scoped `@heuresys/ui`**, build **dual ESM+CJS via tsup**, version **0.1.0**, migrate `apps/web` da `link:` dep a **`^0.1.0` versioned**.
**Expected duration**: 2-3h (Block A 30min + Block B 10min + Block C 5min Enzo + Block D 45min + Block E 30min + REPORT 30min).
**Cross-repo**: opera su 2 git repo distinti — `D:/heuresys-advanced/` (consumer) e `D:/ux-design-shared/` (library). Commit + push SEPARATI per repo.

---

## §0 — Identity + decisioni adottate

You are Claude Code CLI on Windows.

### §0.1 — 4 decisioni Enzo (C18 session, da rispettare alla lettera)

| # | Decisione | Implicazione tecnica |
|---|---|---|
| **1** | **A — `@heuresys/ui` scoped** | Mantieni nome esistente. `package.json.name = "@heuresys/ui"`. Zero breaking change in ~30 file consumer heuresys-advanced. **Prerequisito**: org `@heuresys` deve esistere su npm e Enzo deve esserne member. Se publish fallisce con `403 You do not have permission to publish "@heuresys/ui"` o `404 Scope not found`, HALT P0 e segnala — Enzo crea org via https://www.npmjs.com/org/create (free per pacchetti pubblici). |
| **2** | **Y — CJS+ESM dual via tsup** | `tsup.config.ts` con `format: ["esm", "cjs"]`, dts, treeshake, external react/react-dom. Output: `dist/index.{mjs,cjs}` + `dist/index.d.ts`. |
| **3** | **V1 — 0.1.0** | `package.json.version = "0.1.0"`. Niente pre-release tag (no `-rc.0`). |
| **4** | **M2 — versioned `^0.1.0`** | Post-publish, `apps/web/package.json` cambia da `"@heuresys/ui": "link:../ux-design-shared/ui"` a `"@heuresys/ui": "^0.1.0"`. Update `next.config.js` rimuovendo `@heuresys/ui` da `transpilePackages` (ora pre-built). E2E re-cert vs versioned dep. |

### §0.2 — Decisione 0 (credentials, R11)

CLI **NON** gestisce credenziali npm. Block C è **MANUAL Enzo** (`npm login` + `npm publish`). Pre-flight verifica `npm whoami` ≠ "Not logged in"; se Enzo non è logged in, CLI HALT P0 prima di Block A e segnala. **Verificato 2026-05-24 in C18 session**: Enzo era NOT logged in localmente — Enzo deve fare `npm login` PRIMA di lanciare questo batch.

---

## §1 — Pre-flight live-state

```bash
cd /d/heuresys-advanced
git log --oneline -3                     # expected HEAD: 836880b (handoff X17 P1 closed C18) or further
git tag --list 'v*' | sort -V | tail -3  # expected: includes v0.2.1-mvp2a-final
git status --short                       # NOTE: pre-existing modifications (deleted inbox files + _00_STATE_002.md + untracked .claude/worktrees/, apps/showcase/) are OUT OF SCOPE for this batch — DO NOT touch

cd /d/ux-design-shared
git log --oneline -3                     # capture current HEAD
git status --short                       # MUST be clean — if dirty, HALT P0 (need to align with Enzo)
cat ui/package.json | head -20           # baseline manifest

# Decision-A prerequisite check (npm)
npm whoami 2>&1                          # MUST output a username — if "Not logged in", HALT P0
npm view @heuresys/ui 2>&1 | head -5     # expected: 404 (verified C18: AVAILABLE)
npm view @heuresys 2>&1 | head -5        # registry returns 405 on scope-root; informational only
```

### HALT P0 conditions
| Trigger | Action |
|---|---|
| HEAD heuresys-advanced ≠ `836880b` (or descendant) | HALT (CW-B52 drift), notify Enzo via REPORT §0 |
| `D:/ux-design-shared` dirty working tree | HALT, do NOT modify files in library repo |
| `npm whoami` = "Not logged in" | HALT (Decisione 0) — Enzo deve `npm login` |
| `npm view @heuresys/ui` returns 200 (someone published in the gap) | HALT, escalate (decisione 1 da rivedere) |

---

## §2 — Block A — Library repo prep (`D:/ux-design-shared/ui`)

### A.1 — Update `ui/package.json`

Apply diff (idempotent):

```json
{
  "name": "@heuresys/ui",
  "version": "0.1.0",
  "description": "Heuresys UI — design system + dashboard components (Tier 1-16)",
  "license": "PROPRIETARY",
  "publishConfig": {
    "access": "public"
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    }
  },
  "files": ["dist", "README.md", "LICENSE"],
  "scripts": {
    "build": "tsup",
    "publish:dry": "npm publish --dry-run",
    "publish:release": "npm publish"
  }
}
```

**Remove** `"private": true` if present. **Keep** existing `peerDependencies` (react, react-dom) and existing `devDependencies` plus `tsup`. **Do NOT touch** unrelated fields (sideEffects, repository, keywords, ecc.).

If the existing manifest has a `"./styles.css"` export entry that's actually built, preserve it in `exports`; otherwise skip.

### A.2 — Install tsup + create config

```bash
cd /d/ux-design-shared/ui
npm install --save-dev --legacy-peer-deps tsup
```

Create `D:/ux-design-shared/ui/tsup.config.ts`:

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  external: ["react", "react-dom"],
  treeshake: true,
  sourcemap: false,
});
```

Run `npm run build`. Verify `dist/` contains `index.mjs`, `index.cjs`, `index.d.ts` (sizes non-zero). Capture build output to `/d/heuresys-advanced/qa_artifacts/x18_tsup_build.txt`.

### A.3 — Dry-run publish

```bash
cd /d/ux-design-shared/ui
npm publish --dry-run 2>&1 | tee /d/heuresys-advanced/qa_artifacts/x18_publish_dryrun.txt
```

Acceptance: dry-run tarball contains `dist/*`, `package.json`, `README.md`, `LICENSE`. Zero critical warnings (npm WARN deprecated OK, npm ERR not OK).

---

## §3 — Block B — Cross-repo commit `ux-design-shared`

```bash
cd /d/ux-design-shared
git add ui/package.json ui/tsup.config.ts ui/package-lock.json
# Decide gitignore stance: commit `ui/dist` only if no CI builds it for publish.
# For MVP-3 standalone: include dist in commit (no CI yet for ux-design-shared).
git add ui/dist
git commit -m "feat(ui): publish-ready 0.1.0 — tsup dual ESM+CJS + publishConfig public"
```

**NO push** from CLI. Enzo will push manually after auditing the cross-repo state.

---

## §4 — Block C — Publish (USER ACTION — Enzo manual, R11)

CLI **does not run** `npm publish`. Output to Enzo the exact commands:

```bash
cd D:\ux-design-shared\ui
# (1) If not logged in:
npm login
# (2) Publish (uses publishConfig.access from package.json):
npm publish
# (3) Verify post-publish:
npm view @heuresys/ui
```

**Confirmation gate**: CLI waits for Enzo response `"publish done"` (or equivalent) + paste of `npm view @heuresys/ui` showing `dist-tags.latest = "0.1.0"` before proceeding to Block D.

If `npm publish` returns `403 Forbidden` with `"You do not have permission to publish"` or `"404 Scope @heuresys not found"`: org `@heuresys` does not exist or Enzo is not member. HALT and instruct: visit https://www.npmjs.com/org/create, create free public org `heuresys`, retry publish.

---

## §5 — Block D — Migrate `apps/web` da link → versioned

### D.1 — Update `apps/web/package.json`

```diff
-    "@heuresys/ui": "link:../ux-design-shared/ui",
+    "@heuresys/ui": "^0.1.0",
```

### D.2 — Check root `package.json`

```bash
grep -n '@heuresys/ui' /d/heuresys-advanced/package.json
```

If root has `"@heuresys/ui": "link:../ux-design-shared/ui"` (per CLAUDE.md §Design System), update to `"^0.1.0"` as well.

### D.3 — Update `apps/web/next.config.js` (or `.mjs`)

Rimuovi `@heuresys/ui` da `transpilePackages` (ora pre-compiled). Mantieni `@heuresys/shared` se ancora link interno.

```diff
-  transpilePackages: ["@heuresys/ui", "@heuresys/shared"],
+  transpilePackages: ["@heuresys/shared"],
```

### D.4 — Refresh lockfile

```bash
cd /d/heuresys-advanced
pnpm install
# Verify: node_modules/@heuresys/ui NOT symlink anymore
readlink -f node_modules/@heuresys/ui
# Expected: a real directory under .pnpm/, NOT /d/ux-design-shared/ui
```

If still symlinked, investigate (pnpm may have cached resolution; try `pnpm install --force`).

### D.5 — Verify build + typecheck + Playwright vs versioned

```bash
cd /d/heuresys-advanced
pnpm --filter @heuresys/web exec tsc --noEmit
pnpm --filter @heuresys/web build  # expect 63 routes + showcase env-gate respected

# Restart prod start with showcase env-gate
NEXT_PUBLIC_ENABLE_SHOWCASE=1 node apps/web/node_modules/next/dist/bin/next start apps/web -p 3000 &
SERVER_PID=$!
sleep 30

# Run full Playwright vs prod
pnpm --filter @heuresys/web exec playwright test 2>&1 | tee /d/heuresys-advanced/qa_artifacts/x18_playwright_versioned.txt | tail -20

# Cleanup
kill $SERVER_PID 2>/dev/null
```

Acceptance Block D: typecheck PASS (0 errors), build PASS (63 routes), Playwright ≥ 124/125 (X16 baseline; Tappa B + Tappa E-UI shipped +2 test files, baseline target rises accordingly — see qa_artifacts/x16_playwright_prod.txt for previous absolute number). Structural fail count = 0; environmental (rate-limit) flaky tolerated with documentation.

---

## §6 — Block E — Commit + tag + REPORT

```bash
cd /d/heuresys-advanced
git add apps/web/package.json apps/web/next.config.* package.json pnpm-lock.yaml \
        qa_artifacts/x18_tsup_build.txt qa_artifacts/x18_publish_dryrun.txt qa_artifacts/x18_playwright_versioned.txt \
        cowork_code_exchange/_01_PROMPT_022_batch_x18.md cowork_code_exchange/_04_REPORT_022_batch_x18.md \
        cowork_reserved/HANDOFF_FRESH_SESSION.md

git commit -m "feat(web): MVP-3 Tappa F — @heuresys/ui 0.1.0 published + apps/web versioned migration"

# Tag MVP-3 closure (only if all A-D Blocks PASS + Brownfield Wave 1 known issue documented as residual)
git tag -a v0.3.1-mvp3-final -m "MVP-3 complete: A/B/C/D/E backend+UI/F/G shipped, Brownfield Wave 1 full-47k SQL upsert residual (deferred to optional session)"
```

**NO push** from CLI. Enzo authorizes push for both `D:/ux-design-shared` (Block B commit) and `D:/heuresys-advanced` (Block E commit + tag).

---

## §7 — REPORT format (`_04_REPORT_022_batch_x18.md`)

```
§0 Pre-conditions outcome (HEAD match, npm whoami, registry checks)
§1 Block A library prep (package.json diff, tsup config, build artifacts list with sizes, dry-run summary)
§2 Block B ux-design-shared commit (SHA + files staged)
§3 Block C publish outcome (Enzo confirmation timestamp + `npm view @heuresys/ui` output)
§4 Block D migration outcome (lockfile diff summary, readlink check, typecheck + build + Playwright counts)
§5 Block E commit + tag (SHA, tag annotated message, push status = PENDING ENZO)
§6 Bias catalog updates (expected: ≥1 new CW-B for cross-repo coupling discovery, or 0 if smooth)
§7 Next step C19 recommendation (MVP-3 closure ✅ → C / D options remain, plus GitHub release for v0.3.1-mvp3-final)
§8 Halt status (P0/P1 raised + actions taken)
§9 HANDOFF refresh applied (Block D lesson)
```

---

## §8 — Halt triggers consolidated

| Trigger | Severity | Action |
|---|---|---|
| Pre-flight HEAD drift | P0 | Stop, REPORT §0, await Enzo guidance |
| `D:/ux-design-shared` dirty | P0 | Stop, do NOT modify, REPORT §0 |
| `npm whoami` Not logged in | P0 | Stop, instruct Enzo `npm login`, REPORT §0 |
| `@heuresys/ui` already published in registry gap | P0 | Stop, escalate (Decisione 1 needs review) |
| tsup build fails (missing src/index.ts, TS errors) | P0 | Stop at Block A.2, capture error, REPORT |
| `npm publish --dry-run` critical errors (missing files, license drift) | P0 | Stop at A.3, REPORT |
| Block C publish 403/404 (org missing) | P0 | Stop, instruct org creation, REPORT |
| Post-publish `npm view` returns 404 (silent failure) | P0 | Stop, REPORT, investigate |
| Block D typecheck regression (> 0 errors that weren't pre-existing) | P0 | Stop, capture, REPORT — rollback decision goes to Enzo |
| Block D build fail | P0 | Same as typecheck |
| Block D Playwright structural fail count > 0 (non-environmental) | P0 | Stop, capture failures, REPORT |
| Cross-repo commit error (git submodule conflict, ecc.) | P0 | Stop, do NOT force, REPORT |

---

## §9 — Reference

| Path | Purpose |
|---|---|
| `D:/heuresys-advanced/CLAUDE.md` §"Design System — CENTRALIZZATO" | rules ux-design-shared symlink + import policy + integration semantics |
| `D:/ux-design-shared/ui/package.json` | baseline manifest (pre-X18) |
| `cowork_code_exchange/_04_REPORT_020_batch_x16.md` §6 | post-MVP-2a Option D recommendation chain |
| `cowork_code_exchange/_04_REPORT_021_batch_x17.md` §7 | C18 options (B selected) |
| `cowork_code_exchange/_00_DRAFT_PROMPT_021_batch_x17_tappa_f.md` | DRAFT origin (this PROMPT promotes + integrates 4 decisions) |
| https://www.npmjs.com/org/create | org creation if `@heuresys` missing |
| https://docs.npmjs.com/cli/v10/commands/npm-publish | publish reference |
| https://tsup.egoist.dev/ | tsup config reference |

---

## §10 — Out of scope per X18

- **Brownfield Wave 1 full-47k SQL-side upsert** — option C of C18, separate dedicated session (~2-3h)
- **MFA login-gating** — option D of C18, separate session (~2-3h) — coordina con `auth.service.login()` refactor
- **`@heuresys/shared` npm publish** — solo `@heuresys/ui` in scope; shared resta link interno
- **GitHub release page for `v0.3.1-mvp3-final`** — manuale post-push, comando: `gh release create v0.3.1-mvp3-final --notes-file qa_artifacts/x18_mvp3_release_notes.md --title "MVP-3 final"` (release notes file to be authored as part of REPORT §7 — optional Block F)
- **CHANGELOG.md per `@heuresys/ui`** — opzionale, da aggiungere al primo bump 0.1.1+ (Keep a Changelog standard)

---

## §11 — Lessons inherited (apply during execution)

- **CW-B52 mitigation** (HANDOFF refresh obligation): aggiorna `cowork_reserved/HANDOFF_FRESH_SESSION.md` §1 + §2 + §5 nello stesso commit Block E, NON in commit separato — chiude staleness window per la prossima sessione Cowork.
- **R11 secret hygiene**: NPM token mai loggato. `npm login` interattivo o `~/.npmrc` letto/scritto solo da Enzo, mai dal CLI.
- **R12 git safety cross-repo**: mai `git push --force` né su `D:/ux-design-shared` né su `D:/heuresys-advanced`. Push autorizzazione esplicita Enzo per entrambi.
- **R10 no-hallucination**: se org `@heuresys` non esiste, dichiararlo apertamente (HALT) — non inventare workaround.

---

*End PROMPT 022 — promote-ready. Cowork-side review window before CLI execution: Enzo greenlight required.*
