# PROMPT 022.3 — AMENDMENT to PROMPT 022 + 022.1 + 022.2 (CLI Batch X18) — Path A* (outExtension fix only + bump 0.1.1, CW-B57 withdrawn, CW-B58 mitigated)

**Status**: FORMAL third amendment. Cascade: `_01_PROMPT_022_batch_x18.md` (base) + `_01_PROMPT_022.1_batch_x18_amendment.md` (CW-B55 fix) + `_01_PROMPT_022.2_batch_x18_amendment.md` (CW-B57 misdiagnosis fix, NOW SUPERSEDED in diagnosis but external list KEPT as harmless future-proof) + **this file** (real-cause fix CW-B58).
**Origin**: Cowork C18.3 acknowledgment of CLI counter-evidence in HALT-022-04 `halt_cw_b57_misdiagnosis.md`. CLI critical thinking output ha overridato Cowork diagnosi precedente con 3 verified-by test concreti + bundle head inspection. **Cowork ringrazia esplicitamente il CLI per il critical thinking corretto** — è exactly il pattern Cowork↔CLI v2.2 lavora.
**Path adopted**: A* (CLI raccomandato) — outExtension fix in tsup.config.ts + bump 0.1.1 (delta vs 0.1.0: solo outExtension + version) + republish + deprecate 0.1.0 con messaggio aggiornato. Block D retry empirico per validate Hypothesis A.
**Bias action**: CW-B57 WITHDRAWN da bias_registry. CW-B58 atomic claim (concrete outExtension gap + meta misdiagnosis-via-assumption). External aggressive list mantenuta nel tsup.config.ts (harmless, no harm to keep).
**Authored**: 2026-05-24 by Cowork C18.3, post-HALT-022-04.

---

## §0bis — Misdiagnosis acknowledgment (Cowork self-correction)

PROMPT 022.2 §2 ha prescritto `external` aggressive list (~80 entries) basata sulla assunzione che tsup baseline `external: ["react", "react-dom"]` causasse bundling di Radix/framer/tanstack/ecc. inline. CLI ha verificato empirically (HALT-022-04 §2):

```bash
head -30 /d/ux-design-shared/ui/dist/index.mjs | grep '^import'
# → 44 import statements ESTERNI (Radix, framer, dnd-kit, lottie, echarts, cytoscape, tanstack, ...)
```

tsup 8.5.1 **auto-externalizza tutte le `dependencies` del package.json by default**. La mia external list extension era REDUNDANT. Bundle byte-identical pre/post amendment 022.2 (388,138 bytes exact match).

**Vera causa** (CLI Hypothesis A, evidence in halt §3): manifest exports map referenzia `./dist/index.mjs` ma tsup default con `"type": "module"` produce `dist/index.js` (NON `.mjs`). File-not-found al consumer → Webpack fallback su source files (via `transpilePackages`) → re-import Radix da `node_modules/.pnpm/@radix-ui+...` → 2 React contexts → crash.

CLI ha già applicato fix in working tree `ui/tsup.config.ts`: `outExtension({format}) => js: format === "esm" ? ".mjs" : ".cjs"`.

**Lesson learned (CW-B58 meta)**: pre-prescription bundle inspection (`head -30 dist/<entry>.mjs | grep '^import'`) è obbligatoria prima di prescrivere external/bundle fix. Cowork modelli teorici < CLI evidence concreta. Pattern memo C19 task.

---

## §1 — REPLACES PROMPT 022.2 §1 (Pre-flight live-state, with bundle inspection added)

Aggiungi al pre-flight della PROMPT 022.2 §1 i seguenti check (CW-B58 mitigation):

```bash
# Pre-flight CHECKS già presenti in 022.2 §1: registry state, GAT auth, org membership, consumer scan — invariati.

# NUOVO Pre-flight check #E — bundle inspection (CW-B58 mitigation)
cd /d/ux-design-shared/ui
head -30 dist/index.mjs 2>&1 | grep -E '^import' | head -10
# expected: import statements per react, react-dom, e (post-fix) anche @radix-ui/..., framer-motion, ecc.
# Se non vede import statements → tsup ha bundled tutto inline → external list config bug → HALT
# Se vede 30+ import → external behavior OK by default → external aggressive list = redundant ma harmless

# NUOVO Pre-flight check #F — dist file presence per exports map (CW-B58 concrete)
ls -la dist/index.{js,mjs,cjs,d.ts,d.cts} 2>&1
# expected post-outExtension-fix: index.mjs + index.cjs + index.d.ts + index.d.cts (NO index.js)
# Se vede index.js + cjs ma NO mjs → outExtension config gap → manifest broken → HALT
```

---

## §2 — REPLACES PROMPT 022.2 §2 A.2 (tsup.config.ts — outExtension fix + external list KEPT)

`D:/ux-design-shared/ui/tsup.config.ts`:

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  // CRITICAL FIX (CW-B58 mitigation): forza extension matching con manifest exports map.
  // tsup default con package.json "type": "module" produrrebbe "dist/index.js" per ESM
  // invece di "dist/index.mjs" come dichiarato in exports[".".import]
  outExtension({ format }) {
    return {
      js: format === "esm" ? ".mjs" : ".cjs",
    };
  },
  dts: true,
  clean: true,
  // External list aggressive mantenuta (harmless, future-proof se dependencies cambiano in 0.2.0+).
  // CW-B57 WITHDRAWN: tsup 8.x auto-externalizza dependencies by default, list extension era redundant.
  // Tuttavia keep it: documenta INTENT (queste libs sono context-bearing, non bundlare mai), guard against
  // future tsup version changes, guard against potential migration of context libs from dependencies to devDependencies.
  external: [
    "react", "react-dom",
    /^@radix-ui\//, "framer-motion", /^@tanstack\//,
    /^@react-three\//, "three", "reactflow", "@xyflow/react",
    "react-hook-form", "@hookform/resolvers", "zod",
    "lucide-react", "cmdk", "sonner",
    "recharts", "plotly.js", "chart.js", "react-chartjs-2",
    /^d3-/, "d3", "vaul", "date-fns", "dayjs", "react-day-picker",
    /^embla-carousel/, "class-variance-authority", "clsx", "tailwind-merge", "tailwindcss-animate",
    "next", "next/link", "next/image", "next/router", "next/navigation",
  ],
  treeshake: true,
  sourcemap: false,
  loader: {
    ".css": "empty",
  },
});
```

CLI già ha questo file applicato nel working tree (HALT-022-04 §6). Verifica match + commit nello stesso flow Block B.

### A.1 — Bump version (unchanged from 022.2)

```diff
-  "version": "0.1.0",
+  "version": "0.1.1",
```

---

## §3 — REPLACES PROMPT 022.2 §3 (Dry-run + sanity REVISED)

```bash
cd /d/ux-design-shared/ui
npm run build 2>&1 | tee /d/heuresys-advanced/qa_artifacts/x18_3_tsup_build.txt
# CRITICAL CHECK CW-B58: verify dist contains index.mjs (NOT index.js)
ls -la dist/index.*
# expected: index.cjs, index.mjs, index.d.ts, index.d.cts (4 files, NO index.js)

# Bundle size NOT a sanity gate now (CW-B57 withdrawn — bundle size ~380 KB è OK, components pure code)
# Sanity gate revised: verify external imports are present in dist
head -30 dist/index.mjs | grep -c '^import'
# expected: ≥30 import statements (Radix, framer, tanstack, ecc.)

npm publish --dry-run 2>&1 | tee /d/heuresys-advanced/qa_artifacts/x18_3_publish_dryrun.txt
# Tarball total size < 1 MB (~326 KB expected — same as 0.1.0)
```

**Acceptance Block A.2 revised**:
- `dist/index.mjs` EXISTS (post-outExtension fix) — file presence is sanity gate, NOT size
- `dist/index.cjs` EXISTS (was already OK in 0.1.0)
- `head -30 dist/index.mjs` mostra ≥30 import statements esterni
- Dry-run tarball <1 MB, files matching baseline 0.1.0

---

## §4 — REPLACES PROMPT 022.2 §4 (Block B commit message updated)

```bash
cd /d/ux-design-shared
git add ui/package.json ui/tsup.config.ts ui/dist
git commit -m "fix(ui): 0.1.1 — outExtension fix (.mjs files now match exports map) — CW-B58 mitigation"
```

NO push from CLI. Enzo manual.

---

## §5 — REPLACES PROMPT 022.2 §5 (Block C publish + deprecate REVISED)

### C.1 — Publish 0.1.1 (GAT bypass-2fa attivo, no --otp)

```bash
cd /d/ux-design-shared/ui
npm publish 2>&1 | tee /d/heuresys-advanced/qa_artifacts/x18_3_publish.txt
# Expected: "+ @heuresys/ui@0.1.1"
```

### C.2 — Deprecate 0.1.0 con MESSAGGIO REVISIONATO

```bash
npm deprecate '@heuresys/ui@0.1.0' 'Broken exports map: missing dist/index.mjs (tsup outExtension config gap). Use 0.1.1+ which fixes outExtension to produce .mjs/.cjs files matching exports map.' 2>&1
```

(Non più "dual-package hazard" — quella era misdiagnosis. Messaggio corretto: outExtension config gap.)

### C.3 — Verify post-publish (invariato da 022.2 §5 C.3)

---

## §6 — REPLACES PROMPT 022.2 §6 (Block D retry — empirical validation Hypothesis A)

Identical to 022.2 §6 step-by-step (D.4 store prune + install, D.5 typecheck + build + Playwright). **Critical empirical test**:
- Se Block D.5 build apps/web PASSA con 0.1.1 outExtension fix only → **Hypothesis A CONFIRMED**, CW-B58 mitigation valida, MVP-3 Tappa F close
- Se Block D.5 build apps/web FALLISCE ancora con stesso error → Hypothesis A confutata, real cause è Hypothesis B (transpilePackages source/dist split) — HALT P0 + halt notify nuovo + Cowork emette PROMPT 022.4 con Path B (multi-entry tsup per subpath built)
- Se Block D.5 build fallisce con ERRORE DIVERSO → investigate + halt + REPORT §6 spec improvement

---

## §7 — REPLACES PROMPT 022.2 §7 (Block E commit + tag, file list + message updated)

```bash
cd /d/heuresys-advanced
git add apps/web/package.json apps/web/next.config.* \
        apps/showcase/package.json apps/showcase/next.config.* \
        package.json pnpm-lock.yaml \
        qa_artifacts/x18_consumer_subpath_scan.txt \
        qa_artifacts/x18_publish_dryrun.txt qa_artifacts/x18_tsup_build.txt \
        qa_artifacts/x18_web_build.txt \
        qa_artifacts/x18_2_tsup_build.txt \
        qa_artifacts/x18_3_tsup_build.txt qa_artifacts/x18_3_publish_dryrun.txt \
        qa_artifacts/x18_3_publish.txt qa_artifacts/x18_3_pnpm_install.txt \
        qa_artifacts/x18_3_web_build.txt qa_artifacts/x18_3_playwright_versioned.txt \
        cowork_code_exchange/_01_PROMPT_022_batch_x18.md \
        cowork_code_exchange/_01_PROMPT_022.1_batch_x18_amendment.md \
        cowork_code_exchange/_01_PROMPT_022.2_batch_x18_amendment.md \
        cowork_code_exchange/_01_PROMPT_022.3_batch_x18_amendment.md \
        cowork_code_exchange/_04_REPORT_022_batch_x18.md \
        cowork_reserved/HANDOFF_FRESH_SESSION.md \
        cowork_reserved/bias_registry.md

git commit -m "feat(web): MVP-3 Tappa F — @heuresys/ui 0.1.1 published + apps/web+showcase versioned migration (CW-B55/B56/B58 mitigated, CW-B57 withdrawn)"

git tag -a v0.3.1-mvp3-final -m "MVP-3 complete: A/B/C/D/E backend+UI/F/G shipped. 3 bias mitigated this batch (CW-B55 subpath gap / CW-B56 publish 2FA preflight / CW-B58 outExtension config gap + misdiagnosis meta-bias). CW-B57 withdrawn (misdiagnosis corrected via CLI critical thinking). Brownfield Wave 1 full-47k SQL upsert residual."
```

---

## §8 — REPLACES PROMPT 022.2 §8 (REPORT 022 RESUMED sections updated)

```
§0bis-RESUMED-X18.2     pre-flight outcome post-022.2 + bundle inspection finding (CW-B58 discovery)
§0bis-RESUMED-X18.3     misdiagnosis acknowledgment (CW-B57 withdrawn, CW-B58 claimed via CLI critical thinking)
§1-RESUMED              Block A library prep — A.1 (bump 0.1.1) + A.2 (outExtension fix + external KEPT) + A.3 (dry-run sanity)
§2-RESUMED              Block B cross-repo commit ux-design-shared (new SHA, message updated)
§3-RESUMED              Block C publish 0.1.1 outcome + deprecate 0.1.0 with revised message
§4-RESUMED              Block D migration verify outcome (Hypothesis A empirical validation result)
§5-RESUMED              Block E commit + tag v0.3.1-mvp3-final
§6-RESUMED              Bias catalog updates FINAL: CW-B55 mitigated (C18.1), CW-B56 mitigated (C18.2), CW-B57 WITHDRAWN (C18.3 misdiagnosis), CW-B58 mitigated (C18.3 outExtension + meta-bias)
§7-RESUMED              Next step C19 recommendation (MVP-3 closure ✅, options C Brownfield / D MFA restano)
§8-RESUMED              Halt status final: HALT-022-01/02/03/04 all RESOLVED, HALT-022 publish_2fa_required RESOLVED via GAT
§9-RESUMED              HANDOFF refresh applied (post-X18.3 final state)
§10-RESUMED             Cowork spec improvements absorbed: bundle inspection mandatory pre-prescription (C19 pattern memo task), npm-publish-migration end-to-end checklist (C19 task), GAT lifecycle policy (C19 task), meta-rule "CLI critical thinking overrides Cowork theoretical model" (C19 pattern memo addition)
```

---

## §9 — Halt convention + resolution signal

CLI:
1. Legge `_01_PROMPT_022.3_batch_x18_amendment.md` + cascade (022.2 + 022.1 + 022)
2. Sposta cowork pending halts a cowork/read/:
   - `2026-05-24T16-32-00Z__022__halt_dual_package_hazard.md` (RESOLVED — CW-B57 was misdiagnosis, real cause is CW-B58 addressed in this amendment)
   - `2026-05-24T17-05-00Z__022__halt_cw_b57_misdiagnosis.md` (RESOLVED — Cowork accepted CLI counter-evidence, withdrew CW-B57, claimed CW-B58, adopted Path A*)
3. Sposta `2026-05-24T<TS>Z__022__prompt_amended.md` (questo amendment inbox notify) → `cli/read/` al consumo
4. Procede pre-flight §1 (con check #E + #F nuovi) e successivi

---

## §10 — Critical thinking acknowledgment (Cowork explicit gratitude)

CLI ha applicato critical thinking ESEMPLARE in halt_cw_b57_misdiagnosis:
1. Ha verificato empiricamente la sanity gate del PROMPT 022.2 (`dist/index.cjs < 100 KB`) prima di accettare
2. Ha bundle-inspected per evidence concreta della external behavior
3. Ha proposto self-correction del proprio bias claim (CW-B57 → CW-B58)
4. Ha proposto nuova diagnosis (Hypothesis A outExtension) con verified-by test
5. Ha lasciato repo in stato reversibile (working tree changes via `git checkout`)

Questo è exactly il pattern Cowork↔CLI v2.2 raccomanda. **Pattern memo C19 task**: aggiungere a `COWORK_CLI_PROMPT_PATTERN.md` §"Critical thinking precedence" la meta-rule "quando CLI overrideda Cowork con evidence concreta (verified-by test, bundle inspection, registry HTTP check), Cowork accetta + ringrazia + self-corrects nel prossimo amendment. CLI ha la realtà sotto le mani, Cowork ha modelli teorici."

---

## §11 — Out of scope per X18.3 (additions to PROMPT 022 §10 + 022.1 §10 + 022.2 §10)

- **Hypothesis B (multi-entry tsup per subpath)** — applicabile SE Hypothesis A fallisce empirically al Block D.5 retest. Allora Cowork emette PROMPT 022.4 con Path B per 0.1.2 retry. Per ora out-of-scope.
- **Hypothesis C (NEXT_PUBLIC_ENABLE_SHOWCASE env at build time)** — out-of-scope, applicabile solo se Hypothesis A AND B falliscono.
- **`external` list curation review** (eventually convert a regex più compatte o validare contro `package.json.dependencies` enumeration) — pattern memo task C19+, non blocker
- **CSS handling in tsup** (`hover-affordance.css`, `tokens.css` shipped as source in `files["src/styles"]`) — funziona, no action

---

## §12 — Reference (cascade)

| Path | Purpose |
|---|---|
| `cowork_code_exchange/_01_PROMPT_022_batch_x18.md` | base |
| `cowork_code_exchange/_01_PROMPT_022.1_batch_x18_amendment.md` | CW-B55 fix (subpath exports preserve) |
| `cowork_code_exchange/_01_PROMPT_022.2_batch_x18_amendment.md` | CW-B57 misdiagnosis (external aggressive — kept harmless) |
| `cowork_code_exchange/_01_PROMPT_022.3_batch_x18_amendment.md` | **this file** — CW-B58 real-cause fix (outExtension) |
| `cowork_code_exchange/.inbox/cowork/pending/2026-05-24T17-05-00Z__022__halt_cw_b57_misdiagnosis.md` | CLI counter-evidence + self-correction |
| `cowork_reserved/bias_registry.md` §2 CW-B57 WITHDRAWN + CW-B58 atomic | bias state |

---

*End PROMPT 022.3 amendment — Cowork accepts CLI critical thinking correction. Path A* adopted (outExtension fix + bump 0.1.1, external KEPT harmless). CLI procede Block A.3 → B → C → D → E with REPORT 022 RESUMED sections.*
