# PROMPT 022.1 — AMENDMENT to PROMPT 022 (CLI Batch X18) — Exports map full-preservation + pre-flight consumer scan

**Status**: FORMAL amendment to `_01_PROMPT_022_batch_x18.md`. **PROMPT 022 base resta valido** per le sezioni non toccate qui (Block B / C / E / §6-11). Solo le sezioni elencate sono modificate; CLI applica delta.
**Origin**: Cowork C18.1 review of REPORT 022 (HALT-022-02 exports map subpath spec gap) + halt notification `2026-05-24T14-43-30Z__022__halt_exports_map_subpath_gap.md`.
**Path adopted**: A (preserve all subpath in exports + extend `files` array). CLI-recommended in halt §3.
**Bias closed**: CW-B55 atomico in `cowork_reserved/bias_registry.md` §2 (mitigation Cowork-side enforced in this amendment).
**Authored**: 2026-05-24 by Cowork C18.1, post-X18 PRE_BLOCK_A_HALT_P0.
**Predecessor halts**: HALT-022-01 (`npm whoami` Not logged in) RESOLVED by Enzo `npm login`, halt notify moved to `.inbox/cowork/read/` in this batch's commit. HALT-022-02 (exports map gap) addressed by this amendment.

---

## §0 — Acknowledgment + critical-thinking validation

CLI ha applicato correttamente §11 critical-thinking-active del PROMPT 022 e ha bloccato fail-early prima di Block A. Library repo + npm registry INTOCCATI. Recovery cost = zero. Halt notification + REPORT 022 §0bis + §6 + §10 sono **textbook critical thinking output** — exactly the kind of feedback the Cowork↔CLI v2.2 protocol expects.

Cowork (questa sessione) riconosce 5/5 spec improvements del REPORT §10 e li assorbe in questo amendment. Vedi §6 sotto per il mapping.

---

## §1 — REPLACES PROMPT 022 §1 (Pre-flight live-state)

Sostituire interamente §1 di PROMPT 022 con il seguente:

```bash
cd /d/heuresys-advanced
git log --oneline -3                     # expected HEAD: bfc645d + 022.1 amendment commit (this batch) or further
git tag --list 'v*' | sort -V | tail -3  # expected: v0.2.1-mvp2a-final + (X12-era v0.3.0-mvp3 + v0.4.0-brand-v1 visible)
git status --short                       # NOTE: pre-existing modifications OUT OF SCOPE — DO NOT touch (.claude/worktrees/, apps/showcase/src/components/ untracked, _00_STATE_002.md modified, etc.)

cd /d/ux-design-shared
git log --oneline -3                     # expected HEAD: 572b53f (feat brand favicon) or descendant
git status --short                       # MUST be clean — if dirty, HALT P0
cat ui/package.json | sed -n '1,20p'     # baseline manifest

# Decision-A prerequisite check (npm)
npm whoami 2>&1                          # MUST output a username (Enzo C18.1 verified: spen-zosky) — if "Not logged in", HALT P0
npm view @heuresys/ui 2>&1 | head -5     # expected: 404 (verified C18 + C18.1: AVAILABLE)

# NEW PRE-FLIGHT CHECK (CW-B55 mitigation) — exports map consumer scan
cd /d/heuresys-advanced
grep -rn '@heuresys/ui/' . \
  --include='*.ts' --include='*.tsx' --include='*.css' --include='*.mjs' --include='*.js' \
  | grep -vE 'node_modules|cowork_|\.next/|\.git/|\.claude/worktrees/|dist/' \
  | grep -E '^[^:]+:[0-9]+:(import |@import )' \
  | sort -u \
  | tee /d/heuresys-advanced/qa_artifacts/x18_consumer_subpath_scan.txt
```

**Expected output of subpath scan** (CLI verifies match):
- `./apps/web/src/app/globals.css:15:@import "@heuresys/ui/styles";`
- `./apps/showcase/src/app/globals.css:13:@import "@heuresys/ui/styles";`
- `./apps/web/src/app/showcase/logo/page.tsx:12:import { ... } from "@heuresys/ui/brand/candidates";`

**If scan reveals subpath NOT covered by exports map in §2 below** (e.g. nuovo `@heuresys/ui/something-new` introdotto fra C18.1 e batch execution): **HALT P0 immediato + escalate to Cowork** con halt notify `<TS>__022__halt_exports_map_subpath_gap_v2.md` (estende exports map del manifest amendment).

### HALT P0 conditions (unchanged from PROMPT 022 §1 + new entry)
| Trigger | Action |
|---|---|
| HEAD heuresys-advanced ≠ descendant of `836880b` | HALT (CW-B52 drift), notify Enzo via REPORT §0 |
| `D:/ux-design-shared` dirty working tree | HALT, do NOT modify files in library repo |
| `npm whoami` = "Not logged in" | HALT (Decisione 0) — Enzo deve `npm login` |
| `npm view @heuresys/ui` returns 200 (someone published in the gap) | HALT, escalate (decisione 1 da rivedere) |
| **NEW**: subpath scan reveals consumer usage NOT covered by amended exports map | HALT (CW-B55 recurrence guard) — escalate |

---

## §2 — REPLACES PROMPT 022 §2 A.1 (Update `ui/package.json`)

Sostituire integralmente il blocco JSON in §2 A.1 con:

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
    },
    "./styles": "./src/styles/globals.css",
    "./brand/candidates": "./src/components/brand/candidates/index.ts",
    "./assets/brand/*": "./src/assets/brand/*"
  },
  "files": [
    "dist",
    "src/styles",
    "src/components/brand/candidates",
    "src/assets/brand",
    "README.md"
  ],
  "scripts": {
    "build": "tsup",
    "publish:dry": "npm publish --dry-run",
    "publish:release": "npm publish"
  }
}
```

**Notes**:
- `exports[".".import|require|types]` resta come Decisione 2 (tsup dual ESM+CJS) → pre-built output del Block A.2.
- `exports["./styles"]` punta direttamente a `src/styles/globals.css` (source-direct, Tailwind 4 pattern, replica esatto contratto link: attuale).
- `exports["./brand/candidates"]` punta a `src/components/brand/candidates/index.ts` (source-direct, consumer importa types + values direttamente dal TS source — apps/web `transpilePackages` lo digerisce; post-migration `apps/web` lo digerisce comunque finché TS source files sono nel tarball).
- `exports["./assets/brand/*"]` wildcard subpath per asset statici (PNG/SVG) referenziati indirettamente.
- `files[]` esteso per includere i 3 source paths esposti via exports. **`LICENSE` rimosso** dalla lista perché non esiste in `D:/ux-design-shared/ui/` (REPORT 022 §10 punto 3, decisione: accept come 0.1.0 dev, niente warning blocker). README.md mantenuto se presente.

**Remove** `"private": true` if present. **Keep** existing `peerDependencies` (react, react-dom) e existing `devDependencies` plus l'aggiunta di `tsup` in A.2. **Do NOT touch** unrelated fields (`repository`, `keywords`, `sideEffects`, `dependencies` runtime — vedi §6 spec improvement #4 per roadmap futuro).

### Critical confidence: HIGH on this exports diff
Tutti e 3 i subpath sono evidence-backed via grep scan §1. Se CLI durante Block A trova *altri* subpath consumers (che non figurano nello scan output sopra), HALT immediato — non aggiungere subpath inline, escalate.

---

## §3 — REPLACES PROMPT 022 §2 A.3 (Dry-run publish acceptance)

Dry-run acceptance criteria estesi:

```bash
cd /d/ux-design-shared/ui
npm publish --dry-run 2>&1 | tee /d/heuresys-advanced/qa_artifacts/x18_publish_dryrun.txt
```

**Acceptance**:
- Dry-run tarball MUST contain:
  - `dist/index.cjs`, `dist/index.mjs`, `dist/index.d.ts` (from tsup build)
  - `src/styles/globals.css`
  - `src/components/brand/candidates/index.ts` + tutti i `.ts/.tsx` referenziati dal barrel (CLI deve verificare grep dentro index.ts e includere i files transitivi se non già coperti da `src/components/brand/candidates/**`)
  - `src/assets/brand/*` (wildcard expansion)
  - `package.json`
  - `README.md` if present
- **No `LICENSE` warning blocker** (accepted as 0.1.0 dev gap, future 0.2.0+ will ship LICENSE).
- Zero critical errors (npm WARN deprecated OK, npm ERR not OK).
- Tarball total size sanity: expected ~bundle size + ~10-50KB source CSS+TS. If > 5MB, HALT (likely accidental inclusion).

**If `npm publish --dry-run` shows package size > 5MB or includes paths NOT in `files[]`**: HALT + investigate `.npmignore` / nested includes.

---

## §4 — REPLACES PROMPT 022 §5 D.1-D.4 (Migration apps/web — extended to apps/showcase)

PROMPT 022 §5 D.1 + D.2 toccano solo `apps/web/package.json` + root. Amendment estende a `apps/showcase/package.json` per coerenza versioned cross-workspace (REPORT 022 §10 spec improvement #5).

### D.1 — Update `apps/web/package.json` (unchanged from PROMPT 022)
```diff
-    "@heuresys/ui": "link:../ux-design-shared/ui",
+    "@heuresys/ui": "^0.1.0",
```

### D.1bis (NEW) — Update `apps/showcase/package.json`
```diff
-    "@heuresys/ui": "link:../../../ux-design-shared/ui",
+    "@heuresys/ui": "^0.1.0",
```
NOTE: `apps/showcase` ha path 3-level-up (non 2 come apps/web). Verificare con `cat apps/showcase/package.json | grep '@heuresys/ui'` prima del diff.

### D.2 — Check root `package.json` (unchanged)
```bash
grep -n '@heuresys/ui' /d/heuresys-advanced/package.json
```
Se root ha link: → update a `^0.1.0`.

### D.3 — Update `apps/web/next.config.js` (unchanged from PROMPT 022)
Rimuovi `@heuresys/ui` da `transpilePackages` se presente. Mantieni `@heuresys/shared` se link interno.

### D.3bis (NEW) — Verifica `apps/showcase/next.config.*` o equivalente
Se `apps/showcase` ha config simile, applicare lo stesso trattamento. Se è Astro/Vite/altro, valutare config equivalente. Se nessuna config touch necessaria, documentare in REPORT §4.

### D.4 — Refresh lockfile (unchanged)
```bash
cd /d/heuresys-advanced
pnpm install
readlink -f node_modules/@heuresys/ui  # ora real dir under .pnpm/, NOT /d/ux-design-shared/ui
```

### D.5 — Verify build + typecheck + Playwright (unchanged)
Acceptance Block D estesa: anche `apps/showcase` typecheck/build deve PASS dopo migration (se ha pipeline propria), altrimenti acceptance limitata a apps/web come PROMPT 022 §5 D.5 originale.

---

## §5 — REPLACES PROMPT 022 §6 (Block E commit + tag — file list update)

Sostituire la lista `git add` con:

```bash
cd /d/heuresys-advanced
git add apps/web/package.json apps/web/next.config.* \
        apps/showcase/package.json \
        package.json pnpm-lock.yaml \
        qa_artifacts/x18_tsup_build.txt qa_artifacts/x18_publish_dryrun.txt \
        qa_artifacts/x18_playwright_versioned.txt qa_artifacts/x18_consumer_subpath_scan.txt \
        cowork_code_exchange/_01_PROMPT_022_batch_x18.md \
        cowork_code_exchange/_01_PROMPT_022.1_batch_x18_amendment.md \
        cowork_code_exchange/_04_REPORT_022_batch_x18.md \
        cowork_reserved/HANDOFF_FRESH_SESSION.md \
        cowork_reserved/bias_registry.md

git commit -m "feat(web): MVP-3 Tappa F — @heuresys/ui 0.1.0 published + apps/web+showcase versioned migration (CW-B55 mitigated)"

git tag -a v0.3.1-mvp3-final -m "MVP-3 complete: A/B/C/D/E backend+UI/F/G shipped + CW-B55 mitigation. Brownfield Wave 1 full-47k SQL upsert residual (deferred to optional session)."
```

**Note**: solo aggiunte file (apps/showcase, qa_artifacts/x18_consumer_subpath_scan.txt, _01_PROMPT_022.1 amendment, bias_registry.md). Tutto il resto unchanged.

---

## §6 — REPORT 022.1 spec improvements assorbiti

| # | REPORT 022 §10 improvement | Cowork decision (this amendment) |
|---|---|---|
| 1 | Halt naming convention (`__halt_` vs `_halt_`) | **Canonical = `__halt_` doppio underscore** (coerenza con `__report_ready`, `__prompt_ready`, `__prompt_amended`). Storico `_008_halt_*` (singolo) è LEGACY pre-v2.2, da migrare opportunistically al successivo touch. CLI già conforme (X18 ha usato doppio). |
| 2 | Pre-publish consumer scan obbligatorio | **Assorbito in §1 di questo amendment** come pre-flight check obbligatorio. Pattern memo `COWORK_CLI_PROMPT_PATTERN.md` aggiornamento §"npm-publish-migration checklist" è TODO Cowork batch C19. |
| 3 | LICENSE file mancante | **Accepted as 0.1.0 dev gap**. Rimosso da `files[]` in §2 sopra. Future 0.2.0+ baseline includerà LICENSE. |
| 4 | `dependencies` runtime in pacchetto pubblicato (dual inclusion con tsup bundle) | **Out-of-scope X18**. Roadmap 0.2.0+ convertirà la maggior parte dei runtime deps a `peerDependencies` / `optionalDependencies`. Registrato come improvement futuro (no action this batch). |
| 5 | `apps/showcase` Tappa F coverage | **Assorbito in §4 D.1bis + D.3bis** di questo amendment. Block D ora estende a apps/showcase. |

---

## §7 — Critical thinking still INVITED (unchanged from PROMPT 022 §11)

CLI continua ad applicare critical thinking attivo. Se durante Block A vede ANCORA subpath consumers non coperti (es. introdotti tra C18.1 authoring e batch execution), HALT P0 esattamente come fatto in X18. Se vede altri spec gap nel manifest amended (es. tarball size anomala, peer dep clash), HALT + REPORT §6 (Cowork spec improvements suggested) come standard.

**Confidence levels in this amendment**:
- §1 pre-flight + consumer scan: HIGH (evidence in REPORT 022 §0bis)
- §2 exports map full-preservation: HIGH (CW-B55 mitigation enforced)
- §3 dry-run extended acceptance: HIGH (sanity bounds rationali)
- §4 apps/showcase extension: MEDIUM (showcase pipeline non completamente conosciuta da Cowork — CLI valuta + documenta in REPORT §4)
- §5 commit file list: HIGH (esplicitato granular)

---

## §8 — Halt convention + retry signal

**This amendment file is the resolution signal** per HALT-022-02. CLI:
1. Legge questo file
2. Sposta `cowork_code_exchange/.inbox/cowork/pending/2026-05-24T14-43-30Z__022__halt_exports_map_subpath_gap.md` → `cowork_code_exchange/.inbox/cowork/read/` al consumo (mark as addressed)
3. Sposta `cowork_code_exchange/.inbox/cli/pending/<TS>__022__prompt_amended.md` (questo amendment inbox notify, emesso in commit) → `cli/read/` al consumo
4. Procede pre-flight §1 e successivi
5. REPORT 022.1 = update incrementale al REPORT 022 esistente, NON nuovo file. Aggiungere sezioni `§0bis-RESUMED`, `§1-§5 outcomes (post-amendment)`, `§9-RESUMED HANDOFF refresh applied`. Le sezioni pre-halt restano come historical record.

---

## §9 — Reference (unchanged from PROMPT 022 §9 + addendum)

| Path | Purpose |
|---|---|
| `D:/heuresys-advanced/CLAUDE.md` §"Design System" | rules ux-design-shared symlink + import policy + integration semantics |
| `cowork_code_exchange/_01_PROMPT_022_batch_x18.md` | PROMPT 022 base (questo amendment lo modifica selettivamente) |
| `cowork_code_exchange/_04_REPORT_022_batch_x18.md` | REPORT 022 con halt outcome (sezioni pre-resume restano valide) |
| `cowork_code_exchange/.inbox/cowork/pending/2026-05-24T14-43-30Z__022__halt_exports_map_subpath_gap.md` | halt notify HALT-022-02 (addressed by this amendment) |
| `cowork_reserved/bias_registry.md` §2 CW-B55 | atomic claim + mitigation enforced |
| `D:/ux-design-shared/ui/package.json` | baseline manifest pre-X18 (Block A.1 applies amendment §2 diff) |

---

## §10 — Out of scope per X18.1 (additions to PROMPT 022 §10)

- **LICENSE authoring** per `D:/ux-design-shared/ui/` — deferred 0.2.0+ baseline
- **`dependencies` → `peerDependencies` conversion** per ridurre dual bundling — deferred 0.2.0+
- **Pattern memo `COWORK_CLI_PROMPT_PATTERN.md` §npm-publish-migration checklist** — Cowork batch C19 task
- **Halt naming legacy migration** (`_008_halt_*` → `__008__halt_*`) — opportunistic touch, non-blocking

---

*End PROMPT 022.1 amendment — CLI applica delta sopra al PROMPT 022 base e procede full sequence Block A → E (extended D), produce REPORT 022.1 (RESUMED sezioni in REPORT 022 esistente) + commit + tag.*
