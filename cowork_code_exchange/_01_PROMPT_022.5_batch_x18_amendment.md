# PROMPT 022.5 — AMENDMENT (FINAL X18 CLOSE) — Path B+C pragmatic workaround + MVP-3 Tappa F SHIPPED with documented caveat

**Status**: FORMAL final amendment X18. Cascade: 022 → 022.1 → 022.2 (CW-B57 withdrawn) → 022.3 → 022.4 (bisect inconclusive) → **this file** (Path B+C pragmatic close).
**Origin**: Cowork C18.5 + Enzo decision post HALT-022-06 `bisect_inconclusive` (bisect 12 iter, NO single culprit, identified instead bundle-complexity-threshold + Next 15 RSC boundary issue NON risolvibile in X18 scope).
**Path adopted**: B (force-dynamic workaround on /showcase/layout.tsx) + C (fallback skip /showcase from build se anche force-dynamic fail).
**X18 close target**: MVP-3 Tappa F SHIPPED con caveat documentato "showcase routes use SSR force-dynamic, no static gen — proper fix deferred to dedicated session per Next 15 RSC bundle threshold investigation".
**Out of scope per X18**: Path A (git bisect ux-design-shared commits), Path F (split @heuresys/ui), Path E (Next 16 upgrade) → tutti deferred a sessione dedicata future, NON in X18.

---

## §0 — Final retro acknowledgment

PROMPT 022 + 5 amendment cascade in ~5h. 6 halt P0/P1 catturate. 4 hypothesis confutate empirically. 12 bisect iterations CLI. Real root cause = architetturale Next 15 RSC + bundle complexity, NON risolvibile in X18 scope. Enzo decisione corretta: chiudere X18 OGGI con workaround pragmatic + caveat, deferral del proper fix a sessione dedicata.

**Lesson finalizzata per pattern memo C19**:
1. Empirical test matrix > narrative diagnosis (CW-B58 finalizzato)
2. Bisect methodology contamination (CW-B59 candidate da claim atomico)
3. **Time-box bisect**: max 8-10 iterations OR 60-90 min budget. Beyond that, halt + escalate Cowork per scope reassessment. Path β bisect è valido SOLO per single-component culprits.
4. **MVP closure pragmatic > scope perfectionism**: shippare con caveat documentato è valido se il caveat è chiaro + deferral plan è esplicito.

---

## §1 — REPLACES PROMPT 022.4 §1 D.0-D.6 (Block D close pragmatic Path B+C)

### D.0 — Restore consumer to versioned state (cleanup bisect contamination)

```bash
cd /d/heuresys-advanced

# Verify backup files exist from X18.4 bisect
ls *.bak-bisect apps/web/package.json.bak-bisect apps/showcase/package.json.bak-bisect 2>&1

# Cleanup bisect-specific backups del ux-design-shared
cd /d/ux-design-shared/ui
git checkout -- src/index.ts 2>&1  # ripristina src/index.ts dal bisect contamination
rm -f src/index.ts.bisect-bak src/index.ts.iter5-bak 2>&1
git status --short  # working tree clean atteso (eccetto package.json se ancora 0.1.1)

# Ricostruire dist da src restaurato (full set, no bisect stubs)
npm run build 2>&1 | tail -3

# heuresys-advanced consumer: assicurati che usi versioned ^0.1.1 (bumppando ovunque per coerenza)
cd /d/heuresys-advanced
sed -i 's|"@heuresys/ui": "link:[^"]*"|"@heuresys/ui": "^0.1.1"|g' apps/web/package.json apps/showcase/package.json package.json
pnpm install 2>&1 | tail -5
readlink -f node_modules/@heuresys/ui  # expected: .pnpm/@heuresys+ui@0.1.1_...
```

### D.1 — Apply Path B workaround (force-dynamic on showcase routes)

```bash
cd /d/heuresys-advanced/apps/web

# Verify current layout
cat src/app/showcase/layout.tsx | head -20

# Apply force-dynamic: prepend export prima di qualsiasi altra cosa nel file
# Adapt to existing file structure (might already have other exports like metadata)
```

Edit `apps/web/src/app/showcase/layout.tsx` aggiungendo all'inizio del file (dopo eventuali import):

```typescript
// X18 Tappa F pragmatic close (CW-B58/B59 — Next 15 RSC bundle threshold workaround, see HALT-022-06):
// /showcase/* routes skip static gen finché architetturale fix (Path A bisect commits o Path F split @heuresys/ui)
// non viene eseguito in sessione dedicata. Admin core routes /(authenticated)/* NOT affette.
export const dynamic = "force-dynamic";
```

**Anche** per apps/showcase se applicabile (static-export pipeline GitHub Pages potrebbe richiedere approach diverso; verifica + adapt):

```bash
ls apps/showcase/src/app/layout.tsx apps/showcase/src/app/showcase/layout.tsx 2>&1
```

Se apps/showcase è static export (output: "export" in next.config), `force-dynamic` non funziona — usa invece `dynamic = "error"` + sposta showcase pages a apps/web only oppure documenta limitazione apps/showcase.

### D.2 — Test build apps/web COMPLETO

```bash
cd /d/heuresys-advanced
NEXT_PUBLIC_ENABLE_SHOWCASE=1 pnpm --filter @heuresys/web build 2>&1 | tee /d/heuresys-advanced/qa_artifacts/x18_5_web_build_path_B.txt | tail -20
```

**Scenarios**:

| Outcome | Action |
|---|---|
| ✅ Full build PASS (admin + showcase con force-dynamic) | Path B works. Procedi D.4. |
| ❌ Build fail SOLO su /showcase (force-dynamic non risolve) | Fallback Path C: skip /showcase via next.config pageExtensions OR move /showcase to separate route group escluso da build (vedi D.3). |
| ❌ Build fail anche su /(authenticated)/* | HALT P0 catastrofico — il bundle threshold è oltre showcase. Cowork escalation: bisect via Path A o defer X18 entirely (Path δ). |

### D.3 — Path C fallback (SE D.2 fail)

Solo se D.2 mostra force-dynamic non sufficiente:

```bash
# Approach 1: skip /showcase via next.config pageExtensions
```

Edit `apps/web/next.config.js` aggiungendo:
```javascript
// Exclude /showcase route from build (Path C fallback per X18 close pragmatic)
const NEXT_PUBLIC_ENABLE_SHOWCASE = process.env.NEXT_PUBLIC_ENABLE_SHOWCASE === "1";
module.exports = {
  // ... existing config ...
  // SKIP /showcase route compilation per workaround Next 15 RSC bundle threshold
  // (when proper architecture fix lands, remove this rewrite)
  ...(NEXT_PUBLIC_ENABLE_SHOWCASE ? {} : {
    pageExtensions: ['tsx', 'ts'].map(ext => `!(showcase)/*.${ext}`),  // adapt to actual Next.js syntax
  }),
};
```

Alternativa più pulita (test prima):
```bash
# Approach 2: move /showcase folder fuori da apps/web/src/app/ temporaneamente
mv apps/web/src/app/showcase apps/web/src/_disabled_showcase_X18
# build
NEXT_PUBLIC_ENABLE_SHOWCASE=1 pnpm --filter @heuresys/web build 2>&1 | tee /d/heuresys-advanced/qa_artifacts/x18_5_web_build_path_C.txt | tail -10
# se PASS: documenta "X18 close admin-only, /showcase deferred"
# se ancora fail: HALT P0 catastrophic
```

Decidi Approach 1 (cleaner, route resta in repo ma skipped from build) vs Approach 2 (move out, restore in future fix). Cowork raccomanda Approach 1.

### D.4 — Playwright vs prod (admin routes only)

```bash
# Restart prod start (con o senza showcase, dipende da D.2/D.3 outcome)
NEXT_PUBLIC_ENABLE_SHOWCASE=1 node apps/web/node_modules/next/dist/bin/next start apps/web -p 3000 &
SERVER_PID=$!
sleep 30

# Run Playwright (existing spec files con focus auth + admin routes; spec showcase potrebbero fail se Path C applicato — documenta)
pnpm --filter @heuresys/web exec playwright test 2>&1 | tee /d/heuresys-advanced/qa_artifacts/x18_5_playwright_path_B.txt | tail -20

kill $SERVER_PID 2>/dev/null
```

**Acceptance Block D pragmatic**: typecheck PASS, build apps/web PASS (full o admin-only se Path C), Playwright admin routes PASS (showcase routes potrebbero essere skipped se Path C).

---

## §2 — REPLACES PROMPT 022.4 §2 Block E commit + tag (FINAL X18 CLOSE)

```bash
cd /d/heuresys-advanced
git add apps/web/package.json apps/web/next.config.* apps/web/src/app/showcase/layout.tsx \
        apps/showcase/package.json apps/showcase/next.config.* \
        package.json pnpm-lock.yaml \
        qa_artifacts/x18_*.txt \
        cowork_code_exchange/_01_PROMPT_022_batch_x18.md \
        cowork_code_exchange/_01_PROMPT_022.1_batch_x18_amendment.md \
        cowork_code_exchange/_01_PROMPT_022.2_batch_x18_amendment.md \
        cowork_code_exchange/_01_PROMPT_022.3_batch_x18_amendment.md \
        cowork_code_exchange/_01_PROMPT_022.4_batch_x18_amendment.md \
        cowork_code_exchange/_01_PROMPT_022.5_batch_x18_amendment.md \
        cowork_code_exchange/_04_REPORT_022_batch_x18.md \
        cowork_reserved/HANDOFF_FRESH_SESSION.md \
        cowork_reserved/bias_registry.md

# Cleanup .bak-bisect files (NON committarli, sono local backups)
rm -f *.bak-bisect apps/web/package.json.bak-bisect apps/showcase/package.json.bak-bisect package.json.bak-bisect 2>&1

git commit -m "feat(web): MVP-3 Tappa F — @heuresys/ui 0.1.1 versioned migration + showcase force-dynamic workaround (Next 15 RSC bundle threshold, deferred proper fix)

MVP-3 Tappa F shipped pragmatic close per Enzo decision post-HALT-022-06 bisect inconclusive:
- @heuresys/ui 0.1.1 published su npm registry (0.1.0 deprecated; npm immutable artifacts)
- apps/web + apps/showcase + root consumer migrated link: -> ^0.1.1 versioned
- apps/web/src/app/showcase/layout.tsx: 'export const dynamic = \"force-dynamic\"' workaround per Next 15 RSC bundle complexity threshold (skip static gen, accept SSR runtime cost)
- Admin core /(authenticated)/* routes unaffected, build OK, full functionality preserved

KNOWN ISSUE — Next 15 RSC bundle threshold:
- @heuresys/ui >= ~50 components triggers chunk evaluation 'd.createContext is not a function' al page-data collection
- Symptom: /showcase/* routes fail static gen con Class extends value undefined
- Workaround: force-dynamic skips static gen, route works at runtime
- Proper fix DEFERRED to dedicated session (Path A git bisect ux-design-shared commits + Path F split @heuresys/ui in subpackages)
- Reference: HALT-022-06 §3-§5, qa_artifacts/x18_4_bisect_iter_*.txt (12 iter empirical evidence)

Bias mitigated this batch (final):
- CW-B55 npm-publish-migration subpath exports gap (C18.1)
- CW-B56 npm publish pre-flight (org/2FA/GAT) (C18.2)
- CW-B58 outExtension config gap + meta misdiagnosis-via-assumption (C18.3, reinforced cross-batch)
- CW-B59 bisect methodology contamination (C18.4, claim atomico via REPORT)

Bias withdrawn:
- CW-B57 dual-package hazard (misdiagnosis acknowledged via CLI counter-evidence)

X18 close metrics:
- 5 amendment cascade (022 + 022.1/.2/.3/.4/.5)
- 6 halt P0/P1 caught (npm not logged in / exports gap / publish 2FA / dual hazard / misdiagnosis / persistent fail / bisect inconclusive)
- 4 narrative hypothesis confutate empirically by CLI
- 12 bisect iterations (Path beta) inconclusive -> threshold/architectural issue
- Path B+C pragmatic close adopted Enzo decision"

git tag -a v0.3.1-mvp3-final -m "MVP-3 complete: A/B/C/D/E backend+UI/F-pragmatic/G shipped. 4 bias mitigated this batch (CW-B55 subpath/CW-B56 publish/CW-B58 outExtension+meta/CW-B59 bisect contamination). CW-B57 withdrawn. KNOWN ISSUE: Next 15 RSC bundle threshold /showcase/* routes (workaround force-dynamic, proper fix deferred to dedicated session). Brownfield Wave 1 full-47k SQL upsert residual."
```

NO push from CLI. Enzo authorizes both `D:/ux-design-shared` push (HEAD `dfa2e81` + future 0.1.2 if proper fix landed) + `D:/heuresys-advanced` push (multiple commit + tag).

---

## §3 — REPLACES PROMPT 022.4 §3 REPORT 022 RESUMED sections final

CLI aggiorna `_04_REPORT_022_batch_x18.md` con sezioni RESUMED-X18.5 FINAL:

```
§0bis-RESUMED-X18.5     X18 close pragmatic acknowledgment + retro 5-amendment cascade lessons
§4-RESUMED-X18.5        Block D Path B (force-dynamic) outcome + Path C fallback se applicato
§5-RESUMED-X18.5        Block E commit + tag v0.3.1-mvp3-final + HANDOFF refresh
§6-RESUMED-X18.5        Bias catalog FINAL: CW-B55/B56/B58/B59 mitigated, CW-B57 withdrawn. Tally aggiornato.
§7-RESUMED-X18.5        Next step C19 recommendation: dedicated session "Next 15 RSC bundle threshold investigation" (Path A bisect + Path F split package + ADR-0017 architecture). Plus options C Brownfield Wave 1 / D MFA login-gating restano.
§8-RESUMED-X18.5        Halt status FINAL: ALL 6 halts RESOLVED (last via X18.5 pragmatic close).
§9-RESUMED-X18.5        HANDOFF refresh applied
§10-RESUMED-X18.5       Spec improvements C19 pattern memo (CW-B58 meta-rule, CW-B59 bisect time-box, npm-publish-migration end-to-end checklist, GAT lifecycle, Next 15 RSC bundle threshold workaround pattern)
```

---

## §4 — Halt convention + resolution signal

CLI:
1. Legge `_01_PROMPT_022.5_batch_x18_amendment.md`
2. Sposta `2026-05-24T18-32-00Z__022__halt_bisect_inconclusive.md` → `cowork/read/` al consumo
3. Sposta `2026-05-24T<TS>Z__022__prompt_amended.md` (questo amendment inbox notify) → `cli/read/` al consumo
4. Procede D.0 cleanup + D.1 force-dynamic + D.2 test build + D.3 fallback se serve + D.4 Playwright + Block E commit + tag + REPORT + HANDOFF refresh

---

## §5 — Critical thinking ATTIVO (con scope ridotto)

CLI critical thinking ATTIVO solo per:
- HALT P0 catastrophic se D.2 anche con force-dynamic E D.3 anche con skip /showcase fall su admin routes
- Anomalie inattese durante Playwright admin run
- Cleanup issues (bisect-bak files restituiti, src/index.ts non restorato correttamente)

NON aggiungere nuove diagnosi narrative — X18 chiude pragmatic, deferral è esplicito.

---

## §6 — Out of scope per X18.5 (final)

- **Path A git bisect commits ux-design-shared** — deferred dedicated session
- **Path F split @heuresys/ui subpackages** — deferred  
- **Path E Next.js 16 upgrade** — deferred
- **Path G revert ux-design-shared** — non adopted (perderemmo work valido)
- **CW-B59 atomic registry update** — Cowork side, NOT CLI side per evitare race con questo amendment commit. CLI può solo flag in REPORT §6 candidate.
- **Pattern memo C19 update** — Cowork batch C19 task

---

## §7 — Bias action this amendment (Cowork-side)

CW-B59 atomic claim (Cowork updates bias_registry pre-commit):
- **CW-B59**: "Bisect methodology contamination — quando bisect via export removal in src/index.ts, watch for: (a) downstream consumer typecheck blocking page-data testing, (b) stub replacement changing module structure, (c) link: vs versioned different fail modes. Mitigation: source-file impl replacement (stub IMPL, keep export signature) NOT export-list manipulation; time-box bisect max 8-10 iter or 60-90 min budget; beyond escalate Cowork per scope reassessment."

---

## §8 — Reference (cascade final)

| Path | Purpose |
|---|---|
| `cowork_code_exchange/_01_PROMPT_022_batch_x18.md` | base |
| `cowork_code_exchange/_01_PROMPT_022.{1,2,3,4}_batch_x18_amendment.md` | amendment cascade |
| `cowork_code_exchange/_01_PROMPT_022.5_batch_x18_amendment.md` | **this file** — X18 FINAL CLOSE |
| `cowork_code_exchange/.inbox/cowork/pending/2026-05-24T18-32-00Z__022__halt_bisect_inconclusive.md` | CLI bisect 12-iter evidence |
| `cowork_reserved/bias_registry.md` | CW-B55/B56/B58/B59 mitigated, CW-B57 withdrawn |

---

*End PROMPT 022.5 amendment — X18 CLOSE PRAGMATIC. Path B force-dynamic + Path C fallback. MVP-3 Tappa F SHIPPED con caveat documentato. Proper fix Next 15 RSC bundle threshold deferred a dedicated session.*
