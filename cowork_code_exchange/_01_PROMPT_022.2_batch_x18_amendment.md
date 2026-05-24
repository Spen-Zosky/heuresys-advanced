# PROMPT 022.2 — AMENDMENT to PROMPT 022 + 022.1 (CLI Batch X18) — Dual-package hazard fix via tsup external aggressive + bump 0.1.1

**Status**: FORMAL second amendment. Cascade: `_01_PROMPT_022_batch_x18.md` (base) + `_01_PROMPT_022.1_batch_x18_amendment.md` (CW-B55 fix) + **this file** (CW-B57 fix + CW-B56 documented).
**Origin**: Cowork C18.2 review of HALT-022-03 dual_package_hazard (16:32) + HALT-022 publish_2fa_required (15:50, OBSOLETE — publish done via GAT 16:17). CLI critical-thinking output in halt notify §4.
**Path adopted**: A (CLI recommended) — tsup `external` aggressive on context-bearing libs + bump 0.1.1 + deprecate 0.1.0. `dependencies` invariato (zero break consumer pnpm install).
**Bias closed**: CW-B56 atomic (publish 2FA + org existence pre-flight missing in PROMPT 022 §1, mitigated via this amendment §1 extension). CW-B57 atomic (tsup external minimal + subpath source-direct = dual-package hazard, mitigated via this amendment §2).
**Authored**: 2026-05-24 by Cowork C18.2, post-HALT-022-03.

---

## §0 — Acknowledgment + state

CLI ha applicato critical thinking corretto (6 verified-by test in halt §2). Dual-package hazard è certificato — Cowork accetta diagnosi senza ulteriore investigation. Path A è la scelta canonical per UI library con subpath source-direct.

Block A+B+C DONE. Block D parziale (lockfile refreshed, install OK, typecheck PASS, build FAIL). Block E NOT started. `@heuresys/ui@0.1.0` su registry MA broken-as-is (verrà deprecated post-republish 0.1.1).

Working tree state:
- `D:/ux-design-shared` HEAD `ef46668` (Block A+B commit) — committed, no push
- `D:/heuresys-advanced` HEAD `0780daa` (Cowork C18.1 commit) — Block D file changes uncommitted (3 file con `^0.1.0` instead of `link:`, pnpm-lock.yaml updated, +544 packages installed)

**No rollback richiesto** lato consumer: il `^0.1.0` semver range in apps/web + apps/showcase + root package.json pulls 0.1.1 automaticamente al prossimo `pnpm install`. Block D file changes restano applicati.

---

## §1 — REPLACES PROMPT 022.1 §1 (Pre-flight live-state, extended)

Aggiungi al pre-flight della PROMPT 022.1 §1 i seguenti check (CW-B56 mitigation):

```bash
# Pre-flight check #A — registry state of 0.1.0 (verify it's the broken release)
npm view @heuresys/ui@0.1.0 2>&1 | head -10
# expected: shows 0.1.0 published 2026-05-24T16:17:25Z (cache propagation may take 5-60 min from publish — expect 200 OK by now)

# Pre-flight check #B — npm auth state via GAT (verify config)
cat ~/.npmrc 2>&1 | grep -c '_authToken' || echo "0"
# expected: 1 (token configured for registry.npmjs.org)
npm whoami 2>&1
# expected: spen-zosky

# Pre-flight check #C — org @heuresys exists + user is member
npm org ls heuresys 2>&1 | head -10
# expected: "spen-zosky - owner"

# Pre-flight check #D — consumer subpath scan (CW-B55 recurrence guard, unchanged from 022.1)
grep -rn '@heuresys/ui/' /d/heuresys-advanced \
  --include='*.ts' --include='*.tsx' --include='*.css' --include='*.mjs' --include='*.js' \
  | grep -vE 'node_modules|cowork_|\.next/|\.git/|\.claude/worktrees/|dist/' \
  | grep -E '^[^:]+:[0-9]+:(import |@import |from "@heuresys/ui|require\("@heuresys/ui)' \
  | sort -u \
  | tee /d/heuresys-advanced/qa_artifacts/x18_consumer_subpath_scan.txt
```

### HALT P0 conditions (additions)
| Trigger | Action |
|---|---|
| Pre-flight #A: `npm view @heuresys/ui@0.1.0` returns 404 dopo 30 min dal publish | HALT, investigate (publish potrebbe essere stato unpublished o registry issue) |
| Pre-flight #B: `~/.npmrc` no token | HALT, instruct Enzo to re-setup GAT |
| Pre-flight #C: `npm org ls heuresys` non mostra spen-zosky owner | HALT, escalate |

---

## §2 — REPLACES PROMPT 022 §2 A.2 + 022.1 §2 (tsup config + manifest)

### A.2 — Update `tsup.config.ts` (external aggressive)

Sostituire `D:/ux-design-shared/ui/tsup.config.ts` con:

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  external: [
    // React core (already in 0.1.0 tsup)
    "react",
    "react-dom",
    // Radix UI — all packages (regex per ergonomia, ~25 entries in dependencies)
    /^@radix-ui\//,
    // Framer Motion (context-bearing animation library)
    "framer-motion",
    // TanStack (Query + Table, context-bearing state management)
    /^@tanstack\//,
    // Three.js ecosystem (R3F context-bearing)
    /^@react-three\//,
    "three",
    // React Flow (graph rendering with React context)
    "reactflow",
    "@xyflow/react",
    // Forms (react-hook-form context + hookform resolvers + zod for resolvers)
    "react-hook-form",
    "@hookform/resolvers",
    "zod",
    // Icons (lucide-react if present in deps — context-free usually but bundle bloat)
    "lucide-react",
    // CMDK + cmdmod (Command palette context)
    "cmdk",
    // Sonner (toast context)
    "sonner",
    // Recharts / Plotly / Chart.js (chart context-bearing)
    "recharts",
    "plotly.js",
    "chart.js",
    "react-chartjs-2",
    // D3 (no context but bundle bloat)
    /^d3-/,
    "d3",
    // Vaul (drawer context)
    "vaul",
    // Date libraries (no context but bundle bloat)
    "date-fns",
    "dayjs",
    // React Day Picker (calendar context)
    "react-day-picker",
    // Embla Carousel (carousel context)
    /^embla-carousel/,
    // Class Variance Authority + clsx + tailwind-merge (utility, but small)
    "class-variance-authority",
    "clsx",
    "tailwind-merge",
    "tailwindcss-animate",
    // Next.js (peer-like, NEVER bundle)
    "next",
    "next/link",
    "next/image",
    "next/router",
    "next/navigation",
  ],
  treeshake: true,
  sourcemap: false,
  // Skip processing imports of source CSS (subpath src/styles/* preserved as-is in `files`)
  loader: {
    ".css": "empty",
  },
});
```

**Critical thinking note for CLI**: la lista sopra è esaustiva basata su quello che è plausibile in `package.json.dependencies` di `@heuresys/ui` baseline. **Verifica reale prima di applicare**: `cat /d/ux-design-shared/ui/package.json | grep -c '"@radix-ui'` (expected 25) + `jq '.dependencies | keys' /d/ux-design-shared/ui/package.json` per enumerare TUTTE le deps runtime. Se ci sono context-bearing libs non in lista sopra (es. `@dnd-kit/*`, `react-hot-toast`, `swr`, ecc.), aggiungile a `external`. **HALT escalate** se trovi dependencies non-context-bearing ma bundle-large (>50KB ognuna) che vorresti escludere — Cowork decide.

### A.1 — Bump version

```diff
-  "version": "0.1.0",
+  "version": "0.1.1",
```

Tutto il resto del manifest `D:/ux-design-shared/ui/package.json` (exports map full-preservation, files[], publishConfig, ecc.) **invariato** da PROMPT 022.1 §2.

---

## §3 — REPLACES PROMPT 022 §2 A.3 (Dry-run + sanity)

```bash
cd /d/ux-design-shared/ui
npm run build 2>&1 | tee /d/heuresys-advanced/qa_artifacts/x18_2_tsup_build.txt
# CRITICAL CHECK: dist/index.cjs MUST be < 100 KB now (was 388 KB at 0.1.0 = broken)
# If dist/index.cjs > 200 KB, external list missed some libs → HALT, investigate

ls -la dist/
# expected: index.cjs ~50-100 KB, index.mjs ~50-100 KB, index.d.ts ~100 KB (unchanged), index.d.cts ~100 KB (unchanged)

npm publish --dry-run 2>&1 | tee /d/heuresys-advanced/qa_artifacts/x18_2_publish_dryrun.txt
# Tarball total size < 1 MB (was 326.6 KB at 0.1.0 with bundled libs → expected ~200 KB now without)
```

**Acceptance Block A.2 revised**:
- `dist/index.cjs` size < 100 KB (down from 388 KB — sanity check external aggressive worked)
- `dist/index.mjs` size < 100 KB (down from 359 KB)
- `dist/index.d.ts` + `.d.cts` ~100 KB each (types unchanged)
- Tarball total < 1 MB
- Zero new errors vs 0.1.0 build

---

## §4 — REPLACES PROMPT 022 §3 (Block B cross-repo commit ux-design-shared, updated message)

```bash
cd /d/ux-design-shared
git add ui/package.json ui/tsup.config.ts ui/dist
git commit -m "fix(ui): 0.1.1 — tsup external aggressive (Radix/framer/tanstack/...) — CW-B57 dual-package hazard mitigation"
```

NO push from CLI. Enzo manual.

---

## §5 — REPLACES PROMPT 022 §4 (Block C publish + deprecate 0.1.0)

### C.1 — Publish 0.1.1 (GAT bypass-2fa attivo, no --otp needed)

```bash
cd /d/ux-design-shared/ui
npm publish 2>&1 | tee /d/heuresys-advanced/qa_artifacts/x18_2_publish.txt
# Expected: "+ @heuresys/ui@0.1.1"
```

### C.2 — Deprecate 0.1.0 (best practice — no unpublish)

```bash
npm deprecate '@heuresys/ui@0.1.0' 'Broken first release — dual-package hazard (CW-B57). Use 0.1.1+ which marks Radix/framer/tanstack/etc. as external in tsup config.' 2>&1
# Idempotent on retry. Should succeed via GAT (deprecate is a write op that bypass-2fa GAT covers).
```

### C.3 — Verify post-publish

```bash
npm view '@heuresys/ui' 2>&1 | head -20
# Expected: latest=0.1.1, versions includes [0.1.0, 0.1.1], 0.1.0 deprecated flag visible

npm view '@heuresys/ui@0.1.0' --json 2>&1 | grep -A1 'deprecated'
# Expected: deprecated message visible
```

---

## §6 — REPLACES PROMPT 022 §5 D.4-D.5 (Block D retry post-republish)

Block D.1+D.1bis+D.2+D.3 changes ALREADY APPLIED (in working tree, uncommitted). NON ripetere. NON modificare apps/web/next.config.js né apps/showcase/next.config.js — devono restare invariati rispetto a HEAD `0780daa` salvo la rimozione di `@heuresys/ui` da `transpilePackages` (che CLI ha tentato e poi ripristinato in halt §3 reversibili). **Final state next.config**: `@heuresys/ui` REMOVED da transpilePackages (ora pre-built dist via dual ESM+CJS, niente più bisogno di transpile).

### D.4 — Refresh lockfile post-republish

```bash
cd /d/heuresys-advanced

# Clean pnpm store cache for @heuresys/ui to force re-pull from registry
pnpm store prune 2>&1 | head -5

pnpm install 2>&1 | tee /d/heuresys-advanced/qa_artifacts/x18_2_pnpm_install.txt
# Should pull @heuresys/ui@0.1.1 (semver ^0.1.0 satisfies 0.1.1)

readlink -f node_modules/@heuresys/ui
# Expected: .pnpm/@heuresys+ui@0.1.1_...

cat node_modules/@heuresys/ui/package.json | grep version
# Expected: "version": "0.1.1"
```

### D.5 — Re-verify build + typecheck + Playwright

```bash
pnpm --filter @heuresys/web exec tsc --noEmit 2>&1 | tail -5
# Expected: 0 errors

pnpm --filter @heuresys/web build 2>&1 | tee /d/heuresys-advanced/qa_artifacts/x18_2_web_build.txt | tail -20
# Expected: 63 routes build OK, NO collect-configuration error per /showcase

# Apps/showcase build (if pipeline exists, see PROMPT 022.1 §4 D.3bis):
if [ -f apps/showcase/package.json ] && grep -q '"build"' apps/showcase/package.json; then
  pnpm --filter '@heuresys/showcase' build 2>&1 | tee /d/heuresys-advanced/qa_artifacts/x18_2_showcase_build.txt | tail -10
fi

# Restart prod start with showcase env-gate + Playwright vs prod
NEXT_PUBLIC_ENABLE_SHOWCASE=1 node apps/web/node_modules/next/dist/bin/next start apps/web -p 3000 &
SERVER_PID=$!
sleep 30

pnpm --filter @heuresys/web exec playwright test 2>&1 | tee /d/heuresys-advanced/qa_artifacts/x18_2_playwright_versioned.txt | tail -20

kill $SERVER_PID 2>/dev/null
```

**Acceptance Block D revised**: typecheck PASS (0 errors), apps/web build PASS (63 routes), apps/showcase build PASS (if pipeline), Playwright structural fail count = 0 vs X16 baseline 124/125.

---

## §7 — REPLACES PROMPT 022.1 §5 (Block E commit + tag, updated file list)

```bash
cd /d/heuresys-advanced
git add apps/web/package.json apps/web/next.config.* \
        apps/showcase/package.json apps/showcase/next.config.* \
        package.json pnpm-lock.yaml \
        qa_artifacts/x18_consumer_subpath_scan.txt \
        qa_artifacts/x18_publish_dryrun.txt qa_artifacts/x18_tsup_build.txt \
        qa_artifacts/x18_2_tsup_build.txt qa_artifacts/x18_2_publish_dryrun.txt \
        qa_artifacts/x18_2_publish.txt qa_artifacts/x18_2_pnpm_install.txt \
        qa_artifacts/x18_2_web_build.txt qa_artifacts/x18_2_playwright_versioned.txt \
        cowork_code_exchange/_01_PROMPT_022_batch_x18.md \
        cowork_code_exchange/_01_PROMPT_022.1_batch_x18_amendment.md \
        cowork_code_exchange/_01_PROMPT_022.2_batch_x18_amendment.md \
        cowork_code_exchange/_04_REPORT_022_batch_x18.md \
        cowork_reserved/HANDOFF_FRESH_SESSION.md \
        cowork_reserved/bias_registry.md

git commit -m "feat(web): MVP-3 Tappa F — @heuresys/ui 0.1.1 published + apps/web+showcase versioned migration (CW-B55/B56/B57 mitigated)"

git tag -a v0.3.1-mvp3-final -m "MVP-3 complete: A/B/C/D/E backend+UI/F/G shipped + 3 bias mitigated (CW-B55 subpath gap / CW-B56 publish 2FA preflight / CW-B57 dual-package hazard). Brownfield Wave 1 full-47k SQL upsert residual."
```

NO push from CLI. Enzo authorizes both `D:/ux-design-shared` push + `D:/heuresys-advanced` push.

Also include `qa_artifacts/x18_showcase_build.txt` se generato.

---

## §8 — REPORT 022 update (RESUMED sections)

CLI updates `cowork_code_exchange/_04_REPORT_022_batch_x18.md` adding sezioni RESUMED dopo le sezioni pre-halt esistenti:

```
§0bis-RESUMED-X18.2     pre-flight outcome (A/B/C/D checks)
§1-RESUMED              Block A library prep — A.1 (manifest 0.1.1) + A.2 (tsup external aggressive) + A.3 (dry-run sanity)
§2-RESUMED              Block B cross-repo commit ux-design-shared (new SHA after ef46668)
§3-RESUMED              Block C publish 0.1.1 outcome + deprecate 0.1.0 outcome
§4-RESUMED              Block D migration verify outcome (post-republish: pnpm install, typecheck, build, Playwright)
§5-RESUMED              Block E commit + tag v0.3.1-mvp3-final (SHA + tag annotated message)
§6-RESUMED              Bias catalog updates final: CW-B55 mitigated (Cowork C18.1) + CW-B56 mitigated (Cowork C18.2) + CW-B57 mitigated (Cowork C18.2)
§7-RESUMED              Next step C19 recommendation (MVP-3 closure ✅, options C Brownfield Wave 1 / D MFA login-gating restano)
§8-RESUMED              Halt status final: HALT-022-01 RESOLVED · HALT-022-02 RESOLVED · HALT-022 publish_2fa_required RESOLVED via GAT · HALT-022-03 RESOLVED via Path A
§9-RESUMED              HANDOFF refresh applied (post-X18.2 final state)
§10-RESUMED             Cowork spec improvements deferred for C19 pattern memo update (npm-publish-migration checklist + GAT setup + tsup external policy)
```

Sezioni pre-halt restano come historical record. NON cancellare.

---

## §9 — Halt convention + resolution signal

This amendment is the resolution signal for HALT-022-03 (dual-package hazard) + closes obsolete HALT-022 publish_2fa_required (publish done via GAT). CLI:

1. Legge questo file + PROMPT 022.1 + PROMPT 022 base (cascade)
2. Sposta i seguenti halt notifications da `cowork/pending/` a `cowork/read/` al consumo:
   - `2026-05-24T14-43-30Z__022__halt_exports_map_subpath_gap.md` (RESOLVED by C18.1, in pending da inerzia)
   - `2026-05-24T15-50-39Z__022__halt_publish_2fa_required.md` (RESOLVED via GAT bypass-2fa setup)
   - `2026-05-24T16-32-00Z__022__halt_dual_package_hazard.md` (RESOLVED by this amendment)
3. Sposta `2026-05-24T<TS>Z__022__prompt_amended.md` (questo amendment inbox notify) → `cli/read/` al consumo
4. Procede pre-flight §1 e successivi

---

## §10 — Out of scope per X18.2 (additions to PROMPT 022 §10 + 022.1 §10)

- **`dependencies` → `peerDependencies` migration full** — out-of-scope. Path A clean sufficiente per MVP-3 close. Future 0.2.0 valuterà peerDeps canonical pattern.
- **GAT lifecycle policy** (rotate, scoped per package vs per scope, expiration discipline) — pattern memo C19 task
- **npm-publish-migration end-to-end checklist** consolidato (org existence + 2FA gate + GAT setup + consumer scan + tsup external + bump + deprecate) — pattern memo C19 task
- **ADR-0017 npm package architecture** (Path D del HALT-022-03) — deferred unless future @heuresys/shared publish surface contraddizioni
- **REPORT 022 historical sections cleanup** — lasciare immutate, sono auditable trace di evoluzione iterativa

---

## §11 — Critical thinking still INVITED

Se durante Block A.2 il CLI trova nelle dependencies di `@heuresys/ui` librerie context-bearing che NON sono nella mia lista `external` (es. una libreria che ho missato), aggiunge alla lista + HALT escalate per validazione Cowork prima di publish 0.1.1.

Se durante Block D.5 il build apps/showcase fallisce con errore diverso (non dual-package), HALT P0 + halt notify + REPORT §6 spec improvement.

Confidence levels in this amendment:
- §1 pre-flight + 4 nuovi check: HIGH (evidence-based dal halt notify §2)
- §2 tsup external aggressive: HIGH-MEDIUM (lista comprehensive ma non esaustiva al 100% — CLI critical thinking verifica completness via grep dependencies effettive)
- §3 dry-run sanity bounds: HIGH (~100 KB target è 4x reduction da 388 KB attuale, realistico per "no Radix bundled")
- §5 publish + deprecate: HIGH (deprecate è write op coperto da GAT bypass)
- §6 Block D retry: HIGH (rebuild + rerun standard, prerequisiti chiari)

---

## §12 — Reference (additions)

| Path | Purpose |
|---|---|
| `cowork_code_exchange/_01_PROMPT_022_batch_x18.md` | PROMPT 022 base |
| `cowork_code_exchange/_01_PROMPT_022.1_batch_x18_amendment.md` | First amendment (CW-B55) |
| `cowork_code_exchange/_04_REPORT_022_batch_x18.md` | REPORT 022 with pre-halt + post-halt sections |
| `cowork_code_exchange/.inbox/cowork/pending/2026-05-24T16-32-00Z__022__halt_dual_package_hazard.md` | HALT-022-03 detail |
| `cowork_code_exchange/.inbox/cowork/pending/2026-05-24T15-50-39Z__022__halt_publish_2fa_required.md` | HALT-022 publish 2FA (obsolete, resolved via GAT) |
| `cowork_reserved/bias_registry.md` §2 CW-B56 + CW-B57 | atomic claims this batch |
| `D:/ux-design-shared/ui/dist/index.cjs` (current 388 KB) | broken bundle baseline |
| `https://www.npmjs.com/package/@heuresys/ui` | post-publish 0.1.1 live page |

---

*End PROMPT 022.2 amendment — CLI applica delta sopra (cascade base+022.1+022.2), retry full sequence Block A.2 → A.3 → B → C (republish 0.1.1 + deprecate 0.1.0) → D.4 → D.5 → E, update REPORT 022 RESUMED sections.*
