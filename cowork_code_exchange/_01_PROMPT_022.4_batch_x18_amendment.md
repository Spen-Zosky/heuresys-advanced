# PROMPT 022.4 — AMENDMENT to PROMPT 022.x cascade (Path β bisect exports @heuresys/ui src/index.ts)

**Status**: FORMAL fourth amendment. Cascade: 022 → 022.1 (CW-B55) → 022.2 (CW-B57 redundant external, withdrawn) → 022.3 (CW-B58 outExtension fix — empirically falsified by HALT-022-05) → **this file** (Path β bisect to identify real culprit inside @heuresys/ui).
**Origin**: Cowork C18.4 acknowledgment of HALT-022-05 test matrix (3 config tested, all 4 hypothesis A/B/C + A* falsified). Vera causa è una libreria o componente DENTRO `@heuresys/ui` che breaks Next 15 SSR collect-configuration. Enzo decision: Path β (bisect exports src/index.ts) over alternatives α/γ/δ/ε.
**Scope**: bisect logaritmico exports/imports di `D:/ux-design-shared/ui/src/index.ts` con link: setup (no re-publish per iteration), identifica componente/lib offending, propone fix (replace/remove/lazy-import/dynamic), Cowork valida, CLI implementa + bump 0.1.2 + republish + retest finale.
**Authored**: 2026-05-24 by Cowork C18.4.
**Cowork acknowledgment**: il mio pattern tentativi-ed-errori (4 amendment cascade, 4 hypothesis confutate) ha consumato tempo e token. Il CLI test matrix in HALT-022-05 §2 è la prima evidence empirica seria del problema. Da ORA in poi tutto è bisect-driven, no narrative diagnosis.

---

## §0 — Retro-acknowledgment

CW-B58 lesson "empirical test matrix > narrative diagnosis" non applicata da Cowork in PROMPT 022.3. CLI ha dovuto fare la test matrix da solo in self-check post HALT-022-04. Risultato: 3 amendment Cowork-side basati su hypothesis sbagliate. **Da PROMPT 022.4 in poi**:
- Zero new narrative hypothesis Cowork-side
- CLI ha autorità ampia su bisect meccanico
- Cowork interviene solo per decisione strategica al momento di fix culprit (replace lib / remove component / lazy-import / dynamic)

---

## §1 — REPLACES PROMPT 022.3 §6 Block D (bisect procedure)

### D.0 — Setup bisect environment

```bash
cd /d/heuresys-advanced
# Revert consumer to link: per bisect rapido (no publish ogni iteration)
# Backup pnpm-lock.yaml + 3 manifest pre-bisect
cp pnpm-lock.yaml pnpm-lock.yaml.bak-bisect
cp apps/web/package.json apps/web/package.json.bak-bisect
cp apps/showcase/package.json apps/showcase/package.json.bak-bisect
cp package.json package.json.bak-bisect

# Switch consumer to link: (temporary)
sed -i 's|"@heuresys/ui": "\^0.1.1"|"@heuresys/ui": "link:../ux-design-shared/ui"|' apps/web/package.json
sed -i 's|"@heuresys/ui": "\^0.1.1"|"@heuresys/ui": "link:../../../ux-design-shared/ui"|' apps/showcase/package.json
sed -i 's|"@heuresys/ui": "\^0.1.1"|"@heuresys/ui": "link:../ux-design-shared/ui"|' package.json

pnpm install 2>&1 | tail -5

# Verify link active
readlink -f node_modules/@heuresys/ui
# Expected: /d/ux-design-shared/ui

# Verify baseline FAIL replicates with link:
NEXT_PUBLIC_ENABLE_SHOWCASE=1 pnpm --filter @heuresys/web build 2>&1 | tee /d/heuresys-advanced/qa_artifacts/x18_4_bisect_baseline_link.txt | tail -10
# Expected: FAIL stesso pattern (conferma fail riproducibile via link)
```

Se baseline link: NON fallisce → escalation P0, problema solo nel publish (improbabile dato HALT-022-05 §2 link: revert anch'esso fallisce). Procedi al bisect.

### D.1 — Read src/index.ts + enumera export blocks

```bash
cd /d/ux-design-shared/ui
wc -l src/index.ts
cat src/index.ts | grep -n '^export' | head -50
```

Identifica le re-export sections (es. per Tier: Tier 1 primitives, Tier 2 forms, ..., Tier 16 advanced). Conta blocks totali.

### D.2 — Bisect logaritmico

**Iteration N pattern**:

```bash
cd /d/ux-design-shared/ui

# Create backup of src/index.ts
cp src/index.ts src/index.ts.bisect-bak

# Comment out blocks per iteration logica (vedi §3 partition strategy)
# Example iteration 1: comment second half (Tier 9-16)
sed -i '<line_range>s|^export|// export|' src/index.ts

# Rebuild @heuresys/ui (dist refresh)
npm run build 2>&1 | tail -3

# Build apps/web (apps/showcase TBD)
cd /d/heuresys-advanced
NEXT_PUBLIC_ENABLE_SHOWCASE=1 pnpm --filter @heuresys/web build 2>&1 | tee /d/heuresys-advanced/qa_artifacts/x18_4_bisect_iter_N.txt | tail -10

# Result analysis:
# PASS → culprit in COMMENTED half → uncomment + comment OTHER half + next iteration
# FAIL → culprit in UNCOMMENTED half → split UNCOMMENTED + next iteration
# Convergence: ~log2(N_blocks) iterations
```

Restore src/index.ts.bisect-bak between iterations (`mv src/index.ts.bisect-bak src/index.ts && cp src/index.ts src/index.ts.bisect-bak`).

### D.3 — Partition strategy (logica per granularità)

Suggestion ordering per bisect efficiency (CLI può deviare se evidence empirica):

1. **First split**: by Tier (1-8 vs 9-16) — 2 halves grossi
2. **Second split**: within failing half, by component category (forms vs charts vs layouts vs animations)
3. **Third split**: within failing category, by individual lib import
4. **Final**: isolate exact `export {...} from "./components/<X>"` block che causa FAIL when included

**Skip ottimization**: se il fail error message menziona un chunk specifico (es. `chunks/3025.js`), grep `dist/` per identificare component/lib reference + accelera bisect.

### D.4 — Culprit identification + HALT P1 escalation

Quando bisect converge a singolo export block (es. `export * from "./components/charts/echarts-dashboard"`):

```bash
# Identify which lib/components in that block trigger the issue
cat src/components/charts/echarts-dashboard/*.tsx | grep -E 'import.*from'
```

**EMIT HALT P1** (NOT P0 — non blocker, è handoff a Cowork decision) a `cowork_code_exchange/.inbox/cowork/pending/<TS>__022__halt_bisect_culprit_identified.md`:

```yaml
---
from: cli
to: cowork
goal_id: 022
kind: halt
severity: P1
created_at: <TS>
---

# Bisect culprit identified

## §1 — Culprit
File/block: `src/components/<...>`
Imports: `<lib-A>`, `<lib-B>`, ...
Probable offender: `<lib-X>` (reason: ...)

## §2 — Evidence
- Bisect iterations N total: ...
- Final FAIL config (uncommented): ...
- Final PASS config (commented): ...
- qa_artifacts/x18_4_bisect_iter_*.txt

## §3 — Proposed fix options
- (a) Remove component if unused in MVP-3
- (b) Replace lib X with alternative (e.g. `<lib-Y>`)
- (c) Lazy-import via dynamic import (`const C = lazy(() => import(...))`)
- (d) Wrap in `'use client'` boundary + dynamic with ssr:false
- (e) Custom shim/polyfill for class-extends issue

Cowork decides.
```

CLI HALT + AWAIT exec_directive da Cowork con fix strategy. Cowork può rispondere con inline exec_directive (per fix simple) o PROMPT 022.5 (per fix architetturali).

### D.5 — Fix implementation (post Cowork directive)

CLI implementa fix in `D:/ux-design-shared/ui/src/...` (specifico al directive), rebuild, verify build apps/web PASSA con link.

### D.6 — Republish 0.1.2 + restore consumer versioned

```bash
cd /d/ux-design-shared/ui
# Bump 0.1.1 → 0.1.2
sed -i 's|"version": "0.1.1"|"version": "0.1.2"|' package.json
npm run build
npm publish 2>&1 | tee /d/heuresys-advanced/qa_artifacts/x18_4_publish_012.txt
# expected: + @heuresys/ui@0.1.2 (GAT bypass-2fa, no --otp)

npm deprecate '@heuresys/ui@0.1.1' 'Build-breaking via <culprit description>. Use 0.1.2+ which fixes <fix description>.' 2>&1

cd /d/heuresys-advanced
# Restore consumer to versioned ^0.1.0 (semver pulls 0.1.2)
mv apps/web/package.json.bak-bisect apps/web/package.json
mv apps/showcase/package.json.bak-bisect apps/showcase/package.json
mv package.json.bak-bisect package.json
mv pnpm-lock.yaml.bak-bisect pnpm-lock.yaml

# Optional: bump consumer manifest to ^0.1.2 for clarity (semver ^0.1.0 covers anyway)
sed -i 's|"@heuresys/ui": "\^0.1.1"|"@heuresys/ui": "\^0.1.2"|g' apps/web/package.json apps/showcase/package.json package.json

pnpm store prune
pnpm install
readlink -f node_modules/@heuresys/ui  # expected .pnpm/@heuresys+ui@0.1.2_...

# Final verification
pnpm --filter @heuresys/web exec tsc --noEmit
NEXT_PUBLIC_ENABLE_SHOWCASE=1 pnpm --filter @heuresys/web build 2>&1 | tee /d/heuresys-advanced/qa_artifacts/x18_4_final_web_build.txt | tail -10
NEXT_PUBLIC_ENABLE_SHOWCASE=1 pnpm --filter @heuresys/showcase build 2>&1 | tee /d/heuresys-advanced/qa_artifacts/x18_4_final_showcase_build.txt | tail -10
```

Se apps/web build PASS + apps/showcase build PASS → procedi Block E. Se ancora fail → HALT P0 escalate (real cause potrebbe essere multi-component, ripeti bisect).

---

## §2 — REPLACES PROMPT 022.3 §7 (Block E commit message + tag)

```bash
cd /d/heuresys-advanced
git add apps/web/package.json apps/web/next.config.* \
        apps/showcase/package.json apps/showcase/next.config.* \
        package.json pnpm-lock.yaml \
        qa_artifacts/x18_*.txt \
        cowork_code_exchange/_01_PROMPT_022_batch_x18.md \
        cowork_code_exchange/_01_PROMPT_022.1_batch_x18_amendment.md \
        cowork_code_exchange/_01_PROMPT_022.2_batch_x18_amendment.md \
        cowork_code_exchange/_01_PROMPT_022.3_batch_x18_amendment.md \
        cowork_code_exchange/_01_PROMPT_022.4_batch_x18_amendment.md \
        cowork_code_exchange/_04_REPORT_022_batch_x18.md \
        cowork_reserved/HANDOFF_FRESH_SESSION.md \
        cowork_reserved/bias_registry.md

git commit -m "feat(web): MVP-3 Tappa F — @heuresys/ui 0.1.2 published + apps/web+showcase versioned migration (CW-B55/B56/B58 mitigated, CW-B57 withdrawn, CW-B59 <culprit-description> mitigated via bisect)"

git tag -a v0.3.1-mvp3-final -m "MVP-3 complete: A/B/C/D/E backend+UI/F/G shipped. 4 bias mitigated this batch (CW-B55 subpath gap / CW-B56 publish 2FA preflight / CW-B58 outExtension config / CW-B59 <real culprit dentro @heuresys/ui via bisect>). CW-B57 withdrawn. Brownfield Wave 1 full-47k SQL upsert residual."
```

`<culprit-description>` e `<real culprit>` da popolare in base a bisect outcome.

---

## §3 — REPORT 022 RESUMED sections final

CLI aggiorna `_04_REPORT_022_batch_x18.md` con sezioni RESUMED-X18.4:

```
§0bis-RESUMED-X18.4     bisect baseline + 4 hypothesis A*/B/C precedenti CONFUTATE acknowledgment
§1-RESUMED-X18.4        Block A-C (publish 0.1.1 + deprecate 0.1.0) outcome (già done in X18.3)
§4-RESUMED-X18.4        Block D bisect procedure outcome (N iterations, culprit identified + fix applied)
§5-RESUMED-X18.4        Block D.6 republish 0.1.2 + npm deprecate 0.1.1 + final consumer verification
§5-RESUMED-X18.4        Block E commit + tag v0.3.1-mvp3-final
§6-RESUMED-X18.4        Bias catalog updates: CW-B55/B56/B58 mitigated (storico) + CW-B59 atomic claim (real culprit identificato via bisect, mitigation = <fix>) + CW-B57 withdrawn (storico). Final tally aggiornato.
§7-RESUMED-X18.4        Next step C19 recommendation
§8-RESUMED-X18.4        Halt status FINAL: HALT-022-01/02/03/04/05 ALL RESOLVED + bisect halt P1 RESOLVED via exec_directive
§9-RESUMED-X18.4        HANDOFF refresh
§10-RESUMED-X18.4       Spec improvements C19 pattern memo tasks
```

---

## §4 — Halt convention + resolution signal

CLI:
1. Legge `_01_PROMPT_022.4_batch_x18_amendment.md` + cascade
2. Sposta `2026-05-24T17-25-00Z__022__halt_persistent_build_fail.md` → `cowork/read/` al consumo
3. Sposta `2026-05-24T<TS>Z__022__prompt_amended.md` (questo amendment inbox notify) → `cli/read/` al consumo
4. Procede D.0 setup bisect environment + D.1 enumerate exports + D.2 bisect iterations
5. Al culprit identified: EMIT halt P1 (NOT P0 — è handoff strategy) per Cowork decision
6. Aspetta Cowork exec_directive con fix strategy → implementa D.5 fix
7. D.6 republish + restore consumer + final verify
8. Block E commit + tag + REPORT + HANDOFF refresh

---

## §5 — Critical thinking ATTIVO (con scope esteso)

CLI ha autorità ampia su:
- **Bisect mechanics**: scelta partitioning strategy, iteration count, skip ottimization basata su error message specifics (es. chunk SHA in error → grep dist per accelerare)
- **Diagnostic reporting**: identifica imports/libs nel culprit block, propone 5+ fix options con pro/contro
- **Lib alternative scan**: se culprit è lib specifica (es. echarts), può suggerire alternatives (recharts, plotly, chart.js)

CLI HALT P1 (not P0) per:
- Culprit identified → handoff decision a Cowork
- Bisect non converge dopo 8+ iterations (problema multi-component, escalation)

CLI HALT P0 per:
- pnpm install fail post-bisect
- Build break across BOTH link: + versioned (non riproducibile via link, problema solo nel publish)
- Bisect rivela > 1 culprit indipendenti (architettura review needed)

---

## §6 — Out of scope per X18.4

- **ADR-0017 npm package architecture** (Path δ del HALT-022-05) — deferred unless bisect rivela problema architetturale generalizzato
- **Storybook visual regression** dei componenti modificati — deferred a C19+
- **Pattern memo C19 tasks** consolidated update — deferred (CW-B58 lesson + meta-rule + checklists)
- **Brownfield Wave 1 + MFA login-gating** — restano disponibili per sessioni future

---

## §7 — Reference (cascade)

| Path | Purpose |
|---|---|
| `cowork_code_exchange/_01_PROMPT_022_batch_x18.md` | base |
| `cowork_code_exchange/_01_PROMPT_022.1_batch_x18_amendment.md` | CW-B55 fix (subpath exports preserve) |
| `cowork_code_exchange/_01_PROMPT_022.2_batch_x18_amendment.md` | CW-B57 withdrawn (external aggressive — kept harmless) |
| `cowork_code_exchange/_01_PROMPT_022.3_batch_x18_amendment.md` | CW-B58 outExtension fix (empirically falsified by HALT-022-05) |
| `cowork_code_exchange/_01_PROMPT_022.4_batch_x18_amendment.md` | **this file** — Path β bisect to identify real culprit |
| `cowork_code_exchange/.inbox/cowork/pending/2026-05-24T17-25-00Z__022__halt_persistent_build_fail.md` | CLI test matrix evidence |
| `cowork_reserved/bias_registry.md` §2 CW-B55/B56/B58 mitigated + CW-B57 withdrawn + (post-bisect) CW-B59 culprit | bias state |

---

*End PROMPT 022.4 amendment — Path β bisect adopted. CLI esegue D.0-D.6 con autorità ampia su bisect mechanics. HALT P1 al culprit identified per Cowork fix strategy decision. Da qui in poi: zero narrative diagnosis, solo bisect-driven evidence.*
