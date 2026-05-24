---
from: cli
to: cowork
goal_id: 022
kind: halt
severity: P0
ref_files:
  - cowork_code_exchange/_01_PROMPT_022_batch_x18.md
  - cowork_code_exchange/_01_PROMPT_022.1_batch_x18_amendment.md
  - cowork_code_exchange/_04_REPORT_022_batch_x18.md
  - D:/ux-design-shared/ui/tsup.config.ts
  - D:/ux-design-shared/ui/package.json
  - D:/heuresys-advanced/qa_artifacts/x18_web_build.txt
  - apps/web/src/app/showcase/logo/page.tsx
created_at: 2026-05-24T16:32:00Z
---

# HALT P0 — Dual-package hazard post Block D.4/D.5 build

## §1 — Trigger

Block D.4 (`pnpm install`) e D.5 step1 (`tsc --noEmit`) ✅ PASS. D.5 step2 (`next build` di apps/web) ✅ compila (74s) ma ❌ FAIL in page-data collection per `/showcase`:

```
[Error: Failed to collect configuration for /showcase] {
  [cause]: TypeError: Class extends value undefined is not a constructor or null
      at cE (D:\heuresys-advanced\apps\web\.next\server\chunks\2145.js:1:145154)
      ...
}
```

**Diagnosi** (verified-by below): **dual-package hazard**. `dist/index.cjs` di `@heuresys/ui@0.1.0` ha bundlato Radix UI + framer-motion + altri runtime context-providers inline (perché tsup `external: ["react", "react-dom"]` only). Apps/web li carica ANCHE da `node_modules/.pnpm/@radix-ui+*` come transitive deps (perché manifest @heuresys/ui dichiara `dependencies: { "@radix-ui/...", ... }` ~80 libs). Risultato: due copie distinte di ogni context provider in process → `React.useContext()` ritorna undefined per la prima copia quando consumer (subpath source-direct) usa la seconda copia.

Triggered specificamente da apps/web/src/app/showcase/logo/page.tsx che importa subpath `@heuresys/ui/brand/candidates` (source `.tsx`) — il subpath risolve Radix indipendente, conflicting con main entry bundlato.

## §2 — Evidence (verified-by)

**Test 1**: dist/index.cjs contiene Radix code bundled
```bash
grep -c 'createContext\|class.*extends' /d/ux-design-shared/ui/dist/index.cjs
# → 3+ matches
ls -la /d/ux-design-shared/ui/dist/index.cjs
# → 388,138 bytes (Radix + others bundled inline)
```

**Test 2**: Radix anche installato come transitive @heuresys/ui dep
```bash
find /d/heuresys-advanced/node_modules/.pnpm -maxdepth 2 -name '@radix-ui+react-dialog*' -type d
# → /d/heuresys-advanced/node_modules/.pnpm/@radix-ui+react-dialog@1.1.15_...
```

**Test 3**: ux-design-shared/ui/package.json declares Radix in `dependencies` (~80 libs runtime), tsup config NON marca external (REPORT §10-RESUMED #4 dual-bundle warning was deferred 0.2.0+):
```bash
grep -c '"@radix-ui' /d/ux-design-shared/ui/package.json
# → 25 entries in dependencies
```

**Test 4**: subpath usage in consumer triggers the issue
```bash
grep -n '@heuresys/ui/brand/candidates' apps/web/src/app/showcase/logo/page.tsx
# → 12:} from "@heuresys/ui/brand/candidates";
```

**Test 5**: X16 baseline build passava perché link: dep → unica risoluzione Radix (live source path), no bundle, no dual.

**Test 6**: type-only checks PASS (tsc resolves via path, no runtime instantiation), build FAIL (webpack page-data collection instantiate React tree → context lookup → undefined extends).

## §3 — Stato lavoro Block D (parziale)

Modifiche applicate **(reversibili)**:
- `apps/showcase/package.json` line 14: `link:../../../ux-design-shared/ui` → `^0.1.0`
- `package.json` root line 44: `link:../ux-design-shared/ui` → `^0.1.0`
- `apps/web/next.config.js` line 4: rimosso `@heuresys/ui` da transpilePackages — POI ripristinato (inline mitigation per src/.tsx loader)
- `apps/showcase/next.config.js`: rimosso `transpilePackages: ["@heuresys/ui"]` line — POI ripristinato
- `pnpm-lock.yaml`: aggiornato con +544 packages installed
- `node_modules/@heuresys/ui`: ora real dir under `.pnpm/@heuresys+ui@0.1.0_...` (versioned, NOT symlink)
- `qa_artifacts/x18_web_build.txt`: build log saved (fail evidence)

**Block D incomplete**. Block E NOT started (gated by Block D acceptance).

## §4 — Proposed resolution (Cowork-side decision)

3 path tecnici. **Tutti richiedono nuovo publish** perché tarball `0.1.0` su registry è broken-as-is.

### Path A — `tsup external` aggressive + bump 0.1.1
Marcare `external` in tsup.config.ts tutte le librerie context-bearing (Radix UI ~25 entries, framer-motion, @tanstack/react-query, @react-three/fiber, reactflow, ecc.). Mantenere `dependencies` nel manifest (npm install dei consumer pulled deps tramite npm).

```typescript
// tsup.config.ts modificato
external: [
  "react", "react-dom",
  /^@radix-ui\//,
  "framer-motion", "@tanstack/react-query", "@tanstack/react-table",
  "@react-three/fiber", "@react-three/drei", "reactflow",
  "react-hook-form", "@hookform/resolvers", "zod",
  // ... altri context-bearing libs
]
```

**Pro**: dist diventa thin (~50-100 KB instead of 388 KB), niente duplicazione runtime, future-proof.
**Con**: lista da curare manualmente; rischio missing-external se aggiunti deps futuri. Republish 0.1.1.

### Path B — Convert `dependencies` to `peerDependencies` + bump 0.1.1
Spostare tutte le runtime libs (Radix, framer, tanstack, ecc.) da `dependencies` a `peerDependencies`. Consumer responsabile dell'install.

**Pro**: zero duplicate by-design (npm/pnpm resolution unica per peer). Architettura coerente con typical UI library practices (es. `@chakra-ui/react`).
**Con**: rompe first-time install per consumer nuovi (devono installare 80+ deps manualmente o via post-install hook). MVP-3 ha solo heuresys-advanced come consumer — accettabile costo. Republish 0.1.1.

### Path C — Bundle subpath sources (multi-entry tsup) + bump 0.1.1
Estendere tsup per buildare anche `./brand/candidates` come pre-bundled output (sempre source-direct ora). Inline Radix solo nell'output bundlato, nessun subpath source.

**Pro**: subpath ricevono treatement uguale al main entry. Coerente con "fully built" decision.
**Con**: tsup config + complexity (CSS multi-entry, multi-format); manifest exports map deve switchare a built outputs anche per `./brand/candidates`. Republish 0.1.1.

### Path D — Defer Tappa F + ADR-0017 npm package architecture
Cowork session emette PROMPT 022.2 amendment con ADR formale su:
- External strategy per UI package (Path A vs B vs C decision)
- peerDependencies vs dependencies policy
- Sub-path exports strategy (source-direct vs built)
- Version bump policy (semver minor per breaking-publish vs patch)

**Pro**: governance solida cross-package (`@heuresys/ui`, futuro `@heuresys/shared`, futuro `@heuresys/api` se pubblicato).
**Con**: latency 1-2 round-trip.

### CLI recommendation
**Path A** se prioritario time-to-MVP-3-close (modifica isolata tsup config, 1 batch CLI retry). **Path B** se Cowork prepara `@heuresys/shared` publish in seguito (pattern peer-deps è canonical UI library). **Path C** se vuole zero source leakage nel tarball. **Path D** se la decisione merita un ADR formale.

## §5 — Bias catalog candidate

**CW-B57 candidate — "tsup `external` minimal default crea dual-package hazard quando subpath exports sono source-direct"**

Distinct da CW-B55 (subpath consumer scan) e CW-B56 (2FA pre-flight): qui il problema è la **combinazione** Path A (preserve subpath source-direct) + tsup default external minimal (`["react", "react-dom"]`) → 2 copie context provider → runtime crash.

Mitigation canonical (pattern memo): "se preservare subpath source-direct in exports map, tsup external DEVE includere tutte le runtime libs context-bearing (Radix, framer, tanstack, ecc.) — altrimenti dual-package hazard certificato".

Pre-claim CW-B57 numero atomico SOLO se Cowork conferma pattern ricorrente (es. anche per futuro @heuresys/shared publish con subpath source-direct, anche per altri pacchetti UI Heuresys).

## §6 — Note operative

- **Nessun rollback necessario su `D:/ux-design-shared`**. Block A+B (`ef46668`) restano valid; tsup.config.ts dovrà evolvere ma il commit storico è OK.
- **Possibile cleanup decisione Cowork**: se Path A/B selected, retry batch X18.2 sostituisce 0.1.0 con 0.1.1. 0.1.0 resta su registry come "broken first release" (npm best practice: deprecate via `npm deprecate @heuresys/ui@0.1.0 "broken, use 0.1.1+"`, non unpublish).
- **Rollback consumer (heuresys-advanced)** possibile/opzionale:
  - Riportare 3 file (`apps/showcase/package.json`, root `package.json`, refresh lockfile) a `link:` se Cowork preferisce restore-to-pre-Block-D state. Però comodo lasciare a `^0.1.0` se Path A retry imminente (basta `pnpm install` per re-resolve dopo 0.1.1 published).
- **R10 enforcement**: nessuna invenzione di tsup config esteso, halt + escalate per decisione architetturale.
- **R12 enforcement**: nessun push fatto su nessun repo. `D:/ux-design-shared` HEAD `ef46668` locale, `D:/heuresys-advanced` HEAD `0780daa` (Block D file changes uncommitted locally).

---

*HALT P0 emesso da CLI 2026-05-24T16:32:00Z. Block A+B+C(publish) DONE. Block D parziale (file changes applicati, lockfile refreshed, install OK, typecheck OK, build FAIL). Block E NOT started. Attesa Cowork: scegliere Path A/B/C/D + emit exec_directive (se inline mitigation Path A) o PROMPT 022.2 (se ADR formale Path D).*
