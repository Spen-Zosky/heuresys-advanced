# PROMPT 025 — CLI Batch X21 (DEFER-F /showcase Next 15 RSC bundle threshold proper fix)

**Goal ID**: 025 · **Slug**: `batch_x21_defer_f_showcase_rsc_bundle_threshold_fix`
**Origin**: DEFER-F deferral X18.5 (Path B+C pragmatic workaround applicato, `_disabled_showcase_X18`). Cowork C19 Enzo decision "voglio tutto e subito".
**Expected duration**: 3-4h CLI (più rischioso degli altri X19/X20 — empirical investigation)
**Predecessor**: HEAD origin/main `82a30a1` (post-X18 close). REPORT 022 + halt cascade 022-01 → 022-06 + qa_artifacts/x18_4_bisect_iter_*.txt (12 iter evidence).
**Scope**: identificare root cause del Next 15 RSC bundle-threshold defect (`d.createContext undefined` su /showcase routes con bundle >50 components) + applicare proper fix + re-enable /showcase routes (restore `_disabled_showcase_X18` → `src/app/showcase`).
**Out of scope**: Brownfield (PROMPT 023), MFA (PROMPT 024), Dependabot (PROMPT 026), refactor `@heuresys/ui` API surface.

---

## §0 — Identity + context

**X18 historical context** (READ ME):
- 5 amendment cascade Cowork-side, 4 narrative hypothesis confutate empirically dal CLI
- 12 bisect iterations Path β su `src/index.ts` exports → NO single-component culprit (CW-B59 architettural)
- Bundle ~80 deps tutte auto-externalized da tsup 8.x by default (CW-B57 withdrawn)
- outExtension fix shipped 0.1.1 (CW-B58 partial — fix necessario ma non sufficiente)
- Real cause = bundle complexity threshold + Next 15 RSC boundary issue

**X21 approach**: empirical investigation con 3 path concorrenti (NON cascade) testabili in 2-3 iterazioni:
- **Path A**: git bisect ux-design-shared commits tra X16-era baseline e HEAD `dfa2e81` (~13 commit, 4-6 iterations log2)
- **Path F**: split `@heuresys/ui` in subpackages (`@heuresys/ui-core` minimal primitives + `@heuresys/ui-dashboard` observability + `@heuresys/ui-brand` showcase-only) — separate npm publishes
- **Path E**: upgrade Next.js 15.5.18 → 15.5.latest (potrebbe avere fix) o evaluate Next 16 stable (if released)

Strategia decision-tree:
1. Tentare Path A FIRST (cheap, 1-2h, identifica WHICH commit ha rotto)
2. Se Path A identifica commit specifico → applica fix targeted (revert dep update, alternative lib, ecc.)
3. Se Path A inconclusive (es. drift gradual su molteplici commits) → Path F split package (più invasivo, ~2-3h)
4. Path E come last resort

---

## §1 — Pre-flight live-state

```bash
ssh -fN -L 5433:localhost:5432 oracle-vm-default  # se serve DB per Playwright auth
cd /d/heuresys-advanced
git log --oneline -3   # expected HEAD: 82a30a1 or descendant

# X18 deferred state verify
ls apps/web/src/_disabled_showcase_X18/ | head -5
cat apps/web/tsconfig.json | grep -c '_disabled_showcase_X18'  # expected 1 (exclude present)
cat apps/web/package.json | grep '@heuresys/ui'  # expected ^0.1.1
readlink -f node_modules/@heuresys/ui  # expected: .pnpm/@heuresys+ui@0.1.1_...

# ux-design-shared state
cd /d/ux-design-shared
git log --oneline | head -15  # baseline per Path A bisect
git tag --list 2>&1   # vedi se ci sono tag X16-era

# Identify X16-era baseline commit (last-known-good)
# Heuristic: cerca commit ~3df32b8 menzionato in HALT-022-05 §4 OR ultimo commit pre-MVP-2a-cert (May 16)
git log --oneline --until='2026-05-16' | head -5
# OR cerca tag-like commits
git log --oneline --grep='UXIX-0001\|UXIX-0002' | head -5

cd /d/heuresys-advanced
# Baseline reproduce: restore /showcase + remove tsconfig exclude + rebuild apps/web → confirm FAIL
# (use ephemeral copy, no commit until fix landed)
cp -r apps/web/src/_disabled_showcase_X18 apps/web/src/app/showcase.bak-x21-bisect  # safety backup
```

### HALT P0 conditions
| Trigger | Action |
|---|---|
| ux-design-shared HEAD `dfa2e81` non presente o lokal corrotto | HALT |
| Path A baseline good commit non identifiabile | HALT, escalate per scope reassessment |
| Bisect richiede > 8 iterations (CW-B59 time-box) | HALT P1, escalate per Path F switch |

---

## §2 — Block A: Path A git bisect ux-design-shared commits

### A.1 — Identify good baseline + bad HEAD

```bash
cd /d/ux-design-shared
# Bad: HEAD dfa2e81 (current, BROKEN)
# Good: identify commit pre-X16 / pre-MVP-2a-cert (build apps/web PASS at X16)
GOOD_SHA="<identify>"  # es. commit dal 2026-05-12 o anteriore
BAD_SHA="dfa2e81"

git bisect start
git bisect bad $BAD_SHA
git bisect good $GOOD_SHA
```

### A.2 — Bisect iteration script

Per ogni commit candidato:
```bash
# Inside bisect (ux-design-shared current commit)
cd /d/ux-design-shared/ui
npm install --legacy-peer-deps 2>&1 | tail -3
npm run build 2>&1 | tail -3

# Test apps/web build with this @heuresys/ui state via link:
cd /d/heuresys-advanced
sed -i 's|"@heuresys/ui": "\^0.1.1"|"@heuresys/ui": "link:../ux-design-shared/ui"|g' apps/web/package.json
pnpm install --no-frozen-lockfile 2>&1 | tail -3

# Restore /showcase from backup (test if THIS commit fa passare build)
rm -rf apps/web/src/app/showcase 2>/dev/null
cp -r apps/web/src/app/showcase.bak-x21-bisect apps/web/src/app/showcase
# Edit tsconfig.json to NOT exclude showcase (temp)
sed -i 's|"src/_disabled_showcase_X18",||' apps/web/tsconfig.json

NEXT_PUBLIC_ENABLE_SHOWCASE=1 pnpm --filter @heuresys/web build > /tmp/x21_bisect_iter.txt 2>&1
if grep -q 'd.createContext is not a function\|Class extends value undefined' /tmp/x21_bisect_iter.txt; then
  cd /d/ux-design-shared && git bisect bad
else
  cd /d/ux-design-shared && git bisect good
fi

# Cleanup tsconfig + showcase per next iter
cd /d/heuresys-advanced
git checkout -- apps/web/tsconfig.json apps/web/package.json
rm -rf apps/web/src/app/showcase
```

Converge in ~log2(N_commits) iterations (4-6 expected).

### A.3 — Culprit identified

```bash
cd /d/ux-design-shared
git bisect log > /d/heuresys-advanced/qa_artifacts/x21_bisect_log.txt
git bisect reset

# Identify culprit commit
CULPRIT_SHA="<from bisect log>"
git show $CULPRIT_SHA --stat
git show $CULPRIT_SHA | head -100
```

**Analyze culprit**:
- Se è dep update (es. echarts X.Y → X.Z): possibile revert dep + investigate alternatives
- Se è component addition (es. new Mermaid renderer): possibile lazy-import / dynamic / `'use client'` boundary
- Se è multi-file refactor: granular analysis required

**EMIT HALT P1 con culprit details + 3-5 fix options** per Cowork directive (NON applicare fix inline, è strategic decision Cowork-side).

---

## §3 — Block B: Path F fallback (se Path A inconclusive)

Solo se Block A non identifica single culprit OR converge a "drift gradual cumulativo".

### B.1 — Split @heuresys/ui in subpackages

```
D:/ux-design-shared/
├── ui/                # legacy, mantain per backward-compat (consumer ^0.1.1)
├── ui-core/           # NEW: primitives Tier 1-4 (Button, Input, Card, ecc.) ~10-15 components
├── ui-dashboard/      # NEW: observability widgets (SQLSlow, RBAC, Tenant, Error, ecc.) ~15-20 components
└── ui-brand/          # NEW: brand-specific (logos, showcase, palettes) ~15-20 components
```

Ogni subpackage: own package.json + tsup.config.ts + dist + npm publish (`@heuresys/ui-core@0.2.0`, `@heuresys/ui-dashboard@0.2.0`, `@heuresys/ui-brand@0.2.0`).

apps/web migra a subpath imports specifici per route (es. `/showcase` solo usa `@heuresys/ui-brand`, `/admin` usa `@heuresys/ui-core + @heuresys/ui-dashboard`). Chunk size per route ridotto → threshold non triggerato.

**Effort**: 2-3h refactor. Republish 3 pacchetti. Multi-consumer migration.

---

## §4 — Block C: Re-enable /showcase + verify

Post-fix (Path A targeted o Path F split):

```bash
cd /d/heuresys-advanced
# Restore /showcase definitivo (non temp)
mv apps/web/src/_disabled_showcase_X18 apps/web/src/app/showcase
# Remove tsconfig exclude
sed -i 's|"src/_disabled_showcase_X18",||' apps/web/tsconfig.json
# Cleanup safety backup
rm -rf apps/web/src/app/showcase.bak-x21-bisect

# Verify build full (admin + showcase)
NEXT_PUBLIC_ENABLE_SHOWCASE=1 pnpm --filter @heuresys/web build 2>&1 | tee qa_artifacts/x21_final_web_build.txt | tail -15
NEXT_PUBLIC_ENABLE_SHOWCASE=1 pnpm --filter @heuresys/showcase build 2>&1 | tee qa_artifacts/x21_final_showcase_build.txt | tail -10

# Playwright vs prod (full suite, incluso /showcase routes)
NEXT_PUBLIC_ENABLE_SHOWCASE=1 node apps/web/node_modules/next/dist/bin/next start apps/web -p 3000 &
sleep 30
pnpm --filter @heuresys/web exec playwright test 2>&1 | tee qa_artifacts/x21_playwright.txt | tail -15
```

---

## §5 — Block D: Republish (se Path F) + commit + tag

### Se Path A targeted fix
Bump `@heuresys/ui@0.1.2`, republish, deprecate 0.1.1, update consumer `^0.1.2`.

### Se Path F split
Publish `@heuresys/ui-core@0.2.0` + `@heuresys/ui-dashboard@0.2.0` + `@heuresys/ui-brand@0.2.0`. Deprecate `@heuresys/ui@0.1.1` con migration message.

```bash
git add apps/web/src/app/showcase/ apps/web/tsconfig.json apps/web/package.json \
        apps/showcase/package.json package.json pnpm-lock.yaml \
        qa_artifacts/x21_*.txt \
        cowork_code_exchange/_01_PROMPT_025_batch_x21_defer_f_showcase_fix.md \
        cowork_code_exchange/_04_REPORT_025_batch_x21.md \
        cowork_reserved/HANDOFF_FRESH_SESSION.md \
        cowork_reserved/bias_registry.md

git commit -m "fix(showcase): DEFER-F resolved — Next 15 RSC bundle threshold via <Path A culprit revert / Path F split package> — /showcase routes re-enabled"

git tag -a v0.3.2-mvp3-defer-f-resolved -m "DEFER-F resolved: /showcase routes restored. Root cause: <description>. Bias CW-B59 mitigated proper-fix (was deferred-architectural)."
```

---

## §6 — Halt + critical thinking

- HALT P0: bisect cannot converge dopo 8 iter (escalate Path F)
- HALT P1 (Path A): culprit identified → emit handoff Cowork con fix options
- HALT P0 catastrophic: Path F republish fails / consumer migration breaks admin core
- Critical thinking: se Path A culprit è un dep update non-revertible (es. lib non più maintained), proporre alternative lib in HALT P1 options

---

## §7 — Out of scope X21

- Brownfield (PROMPT 023)
- MFA (PROMPT 024)
- Dependabot (PROMPT 026)
- Storybook visual regression (deferred future)
- ADR-0017 npm package architecture (può essere outcome se Path F adottato)

---

## §8 — Reference

| Path | Purpose |
|---|---|
| `cowork_code_exchange/_04_REPORT_022_batch_x18.md` | X18 saga + halt cascade |
| `qa_artifacts/x18_4_bisect_iter_*.txt` | 12 bisect iter empirical evidence |
| `cowork_reserved/bias_registry.md` CW-B58/B59 | meta-bias + bisect contamination patterns |
| `cowork_reserved/COWORK_CLI_PROMPT_PATTERN.md` §20 | npm-publish-migration checklist + Next 15 RSC workaround tier-list |
| `apps/web/src/_disabled_showcase_X18/` | 21 route files to restore |

---

*End PROMPT 025 — DEFER-F closure attempt. Time-box CW-B59 applicato. Halt P1 al culprit identified per Cowork strategic decision.*
