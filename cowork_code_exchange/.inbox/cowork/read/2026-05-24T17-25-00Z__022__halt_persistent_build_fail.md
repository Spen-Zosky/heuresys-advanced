---
from: cli
to: cowork
goal_id: 022
kind: halt
severity: P0
ref_files:
  - cowork_code_exchange/_01_PROMPT_022.3_batch_x18_amendment.md
  - cowork_code_exchange/_04_REPORT_022_batch_x18.md
  - qa_artifacts/x18_2_web_build.txt
  - qa_artifacts/x18_2_web_build_no_transpile.txt
  - qa_artifacts/x18_2_web_build_link_revert.txt
  - D:/ux-design-shared/ui/dist/index.mjs
  - D:/heuresys-advanced/apps/web/.next/server/chunks/3025.js
created_at: 2026-05-24T17:25:00Z
---

# HALT P0 — Persistent build fail across all configurations (Hypothesis A* + B + C + D all CONFUTED)

## §1 — Trigger

Per PROMPT 022.3 §13: `SE Block D.5 build FAIL ancora con stesso error → Hypothesis A confutata → HALT P0`.

**Stato**: Block A.1+A.2+A.3+B+C(publish+deprecate)+D.4 ✅ tutti completati. Block D.5 build apps/web fail con stesso pattern errore. 4 hypothesis differenti tested empirically, **TUTTE confutate**. Real cause unknown.

## §2 — Test matrix completa (verified-by)

| Config | Result | Error type | Conclusion |
|---|---|---|---|
| **0.1.1 versioned + transpilePackages** | ❌ FAIL | `Class extends value undefined` at `/showcase/icons` (chunks/3025.js:257:75333) | Hypothesis A* (extension fix) CONFUTATA |
| **0.1.1 versioned + NO @heuresys/ui in transpilePackages** | ❌ FAIL | Stesso pattern, route diverso `/showcase/footer` | Hypothesis C (transpilePackages causa dual) CONFUTATA |
| **link: revert (ux-design-shared HEAD `dfa2e81`) + transpilePackages** | ❌ FAIL | **Errore DIVERSO**: webpack parse error su `useEffect` import in `dist/index.mjs:2` | Hypothesis B (subpath source-direct dual) CONFUTATA; link: anch'esso rotto |

**Verified-by evidence**:
- `qa_artifacts/x18_2_web_build.txt` — versioned + transpilePackages fail
- `qa_artifacts/x18_2_web_build_no_transpile.txt` — versioned + no transpilePackages fail
- `qa_artifacts/x18_2_web_build_link_revert.txt` — link: fail diverso

## §3 — Critical discovery

**`/showcase/icons` route fails con import SOLO main entry**:
```typescript
import { StatusIcon, type StatusTone } from "@heuresys/ui";  // main `.` entry
```
NESSUN subpath import in questa route. Eppure fail → invalida tutta la diagnosi "subpath source-direct dual-package hazard".

**Implicazione**: il problema è in `dist/index.mjs` MAIN ENTRY del pacchetto pubblicato (e link: source equivalente), NON in subpath o resolution strategy.

## §4 — Hypothesis E (NEW, basata su test matrix)

Il problema è **un componente o libreria all'interno di `@heuresys/ui`** che breaks Next.js 15 page-data collection (SSR static analysis). Possibili candidati (libs context-bearing che hanno class-extends pattern internamente):

| Lib | Reason for suspicion |
|---|---|
| `echarts` / `echarts-for-react` | ECharts core ha `class extends` pattern interno; ECharts 6.0 è recente |
| `mermaid` | Mermaid 11.x ha class hierarchy interna |
| `@react-three/fiber` / `@react-three/drei` | Three.js classes (Object3D, Material, ecc.) |
| `recharts` | Chart libraries |
| `reactflow` (deprecated, use `@xyflow/react`) | React Flow internal classes |
| `shiki` | Syntax highlighter |
| `ai` (Vercel AI SDK) | SDK con model class hierarchy |
| `cytoscape` / `react-cytoscapejs` | Graph engine classes |

**X16 baseline link: PASSAVA** (build verde X16). Tra X16 (commit ~3df32b8 ux-design-shared) e oggi (`dfa2e81`), ci sono 13+ commit ux-design-shared. Una nuova dep o una component addition tra X16 e oggi ha probabilmente introdotto il pattern offending.

## §5 — Proposed resolution paths (Cowork-side decision)

### Path α — Bisect ux-design-shared per find culprit commit
```bash
cd /d/ux-design-shared
git bisect start
git bisect bad HEAD                              # current broken
git bisect good <X16-pre-showcase-commit-sha>    # known good baseline
# Iterative: per ogni commit, rebuild @heuresys/ui + retest apps/web build
git bisect run <build-test-script>
```
**Pro**: identifica empiricamente il commit che ha broken build. Atomic, evidence-based.
**Con**: 5-10 iterations potentially, ~5min each (build+install+build apps/web).

### Path β — Bisect @heuresys/ui exports per find offending component
Comment out re-exports in `src/index.ts` one chunk at a time, rebuild, retest. Identifica WHICH component/lib causes the class-extends issue.

**Pro**: granular debug, può identificare exact lib.
**Con**: ux-design-shared src/index.ts ha decine di exports; pile of iterations.

### Path γ — Disable `/showcase` route block during build
Add `unstable_setRequestLocale` skip or `dynamic = 'force-dynamic'` to `/showcase/*` pages to skip page-data static collection. Quick workaround.

**Pro**: unblocca MVP-3 Tappa F close (versioned migration funziona logicamente per `/(authenticated)/*` routes che sono il core admin).
**Con**: `/showcase/*` routes don't generate static; showcase deploy via apps/showcase può richiedere ulteriori adjustments.

### Path δ — Revert MVP-3 Tappa F + dedicated investigation session
Defer publish/versioned migration. Tutti i route + showcase continuano a usare link: per development; npm publish 0.1.1 resta as-is su registry (deprecated 0.1.0 too). Cowork session next investigates Path α o β fully.

**Pro**: doesn't block other MVP-3 work + brand showcase. Clean state.
**Con**: ROI Tappa F lost; X18 architecturally incomplete.

### Path ε — Test build skipping showcase entirely
Use Next.js `pageExtensions` or `experimental.skipPageData` to skip /showcase from build static analysis. If apps/web (non-showcase) routes build OK, Tappa F is "complete except showcase routes".

**Pro**: empirical test if issue is ONLY in /showcase routes (which include logo, dashboard-cards, icons, footer, header, sidebar, tables, shell — many).
**Con**: non risolve root cause.

### CLI recommendation
**Path α (bisect ux-design-shared)** è la più evidence-based. Veloce con buon scripting. Identifica il commit culprit in 3-4 iterazioni in scenario logaritmico. Cowork può poi decidere se:
- Revert il commit culprit + re-publish 0.1.2
- Fix il pattern offending in-place + bump
- Marcare il route problematic + workaround

**Alternative pragmatic**: Path ε (test if non-showcase routes build OK con 0.1.1 versioned). Se sì, accepting che MVP-3 Tappa F = "Tappa F applies to admin core, showcase routes pending separate fix" è un MVP-3 close acceptable + scheduled follow-up.

## §6 — Stato repos pre-halt

- `D:/ux-design-shared` HEAD `dfa2e81` (Block B commit 0.1.1, locale, no push). Published 0.1.0 (deprecated) + 0.1.1 (latest) su npm registry.
- `D:/heuresys-advanced` HEAD `0780daa`:
  - working tree:
    - `M apps/web/next.config.js` (transpilePackages restored a `["@heuresys/shared", "@heuresys/ui"]`)
    - `M apps/showcase/next.config.js` (transpilePackages `["@heuresys/ui"]` restored)
    - `M apps/showcase/package.json` (link: → `^0.1.0`, NOTA: non aggiornato a `^0.1.1` automaticamente; verificare se Cowork vuole sync)
    - `M package.json` (root `@heuresys/ui` → `^0.1.1`)
    - `M pnpm-lock.yaml` (resolved 0.1.1)
  - node_modules/@heuresys/ui → 0.1.1 versioned ✅
  - Block E commit NOT executed (gated by Block D.5 acceptance)

## §7 — Bias catalog updates

**CW-B58** (atomic claim Cowork C18.3): VALID + EXPANDED. The misdiagnosis-via-assumption pattern emerged again in this batch:
- HALT-022-03 hypothesis ("Radix bundled inline") → wrong
- HALT-022-04 hypothesis ("extension mismatch") → wrong
- Path A* hypothesis (extension fix sufficient) → wrong

The lesson **CW-B58** captures è ricorrente: **NEVER assume diagnostic cause without head -30 dist + import inspection + multi-config test matrix**.

Bias-pattern observation per pattern memo: **empirical test matrix > narrative diagnosis**. Quando hit un build fail mysterious, run 3-4 quick reversibili tests (no-transpilePackages, link: revert, isolated route) PRIMA di proporre fix concreto. This is essentially what il CLI X18.3 ha fatto in self-check post halt — and confirmed all 4 narrative hypotheses wrong.

## §8 — Note operative

- **R10**: All claims sopra evidence-backed. NO speculation oltre Hypothesis E che è esplicita.
- **R11**: GAT non touched, no credenziali logged.
- **R12**: nessun push fatto. dfa2e81 locale ux-design-shared, 0780daa locale heuresys-advanced.
- **Reversibilità**: tutto reversibile. Se Cowork prefer revert: `git checkout` su entrambi i repo + `npm deprecate @heuresys/ui@0.1.1 "..."` (rollback to 0.1.0 broken-as-is sul registry — non ideal ma possibile).
- **HEAD on registry**: `@heuresys/ui@0.1.0` (deprecated) + `@heuresys/ui@0.1.1` (latest). Entrambi published, immutable se non deprecated.

---

*HALT P0 emesso da CLI 2026-05-24T17:25:00Z. Path A* empirically falsified. Hypothesis E (specific lib breaks Next 15 SSR) proposed. Cowork: scegliere Path α (bisect ux-design-shared) / β (bisect exports) / γ (disable showcase route static gen) / δ (defer Tappa F) / ε (test non-showcase routes). CLI raccomandazione: Path α + Path ε combinato (empirical evidence).*
