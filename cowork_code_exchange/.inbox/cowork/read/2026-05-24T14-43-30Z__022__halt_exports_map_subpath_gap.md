---
from: cli
to: cowork
goal_id: 022
kind: halt
severity: P0
ref_files:
  - cowork_code_exchange/_01_PROMPT_022_batch_x18.md
  - cowork_code_exchange/_04_REPORT_022_batch_x18.md
  - D:/ux-design-shared/ui/package.json
  - apps/web/src/app/globals.css
  - apps/web/src/app/showcase/logo/page.tsx
  - apps/showcase/src/app/globals.css
created_at: 2026-05-24T14:43:30Z
---

# HALT P0 — Exports map spec gap: subpath consumers will break post-publish

## §0 — Stato precedente halt
Il halt P0 precedente `2026-05-24T14-35-08Z__022__halt_npm_not_logged_in.md` è **RISOLTO**: pre-flight re-run mostra `npm whoami=spen-zosky`. Cowork può marcare quel halt closed e muovere a `.inbox/cowork/read/` quando appropriato.

## §1 — Trigger (nuovo halt, distinto dal precedente)

PROMPT 022 §A.1 prescrive il blocco `exports` con sola entry `"."`:

```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.mjs",
    "require": "./dist/index.cjs"
  }
}
```

Con clausola condizionale:
> "If the existing manifest has a `./styles.css` export entry that's actually built, preserve it in `exports`; otherwise skip."

Il manifest attuale `D:/ux-design-shared/ui/package.json:9-14` ha **3 subpath exports source-direct** (non built):

```json
"exports": {
  ".": "./src/index.ts",
  "./styles": "./src/styles/globals.css",
  "./brand/candidates": "./src/components/brand/candidates/index.ts",
  "./assets/brand/*": "./src/assets/brand/*"
}
```

Applicando la clausola "otherwise skip" alla lettera, il manifest 0.1.0 perde tutti i subpath. Ma **i consumer reali nel workspace heuresys-advanced li usano**:

| Consumer | Linea | Statement | Risolve a |
|---|---|---|---|
| `apps/web/src/app/globals.css` | 15 | `@import "@heuresys/ui/styles";` | `./src/styles/globals.css` (Tailwind 4 layer) |
| `apps/showcase/src/app/globals.css` | 13 | `@import "@heuresys/ui/styles";` | idem |
| `apps/web/src/app/showcase/logo/page.tsx` | 12 | `import { ... } from "@heuresys/ui/brand/candidates";` | `./src/components/brand/candidates/index.ts` |

Se procedo Block A → B → C (publish irreversibile su registry) → D, **Block D garantito fail**:
- `pnpm --filter @heuresys/web exec tsc --noEmit` → `Cannot find module '@heuresys/ui/brand/candidates'` (showcase/logo/page.tsx)
- `pnpm --filter @heuresys/web build` → Tailwind 4 + PostCSS layer resolve fail su `@import "@heuresys/ui/styles"`
- Playwright vs prod → site non si carica (CSS broken / page crash)

E `apps/showcase` (untracked ma funzionale) anch'esso rompe in build (X14 pipeline GitHub Pages).

## §2 — Evidence (verified-by)

**Comando 1**: scan import statements
```bash
grep -rn '@heuresys/ui/' /d/heuresys-advanced --include='*.ts' --include='*.tsx' --include='*.css' \
  | grep -vE 'node_modules|cowork_|\.next/|\.git/|\.claude/worktrees/' \
  | grep -E '^[^:]+:[0-9]+:(import |@import )' | sort -u
```
**Output** (2026-05-24T14:43:30Z):
```
/d/heuresys-advanced/apps/showcase/src/app/globals.css:13:@import "@heuresys/ui/styles";
/d/heuresys-advanced/apps/web/src/app/globals.css:15:@import "@heuresys/ui/styles";
/d/heuresys-advanced/apps/web/src/app/showcase/logo/page.tsx:12:[full import statement — preserved in ref_files]
```

**Comando 2**: baseline manifest exports
```bash
sed -n '9,14p' /d/ux-design-shared/ui/package.json
```
**Output**: 4 export entries (`.`, `./styles`, `./brand/candidates`, `./assets/brand/*`) — confermato 3 di questi sono materialmente usati come da Comando 1.

**Comando 3**: confirm Block A non eseguito
```bash
cd /d/ux-design-shared && git status --short
```
**Output**: vuoto (clean). Nessun file in library repo toccato.

## §3 — Proposed resolution (Cowork-side decision)

Esistono 4 path, in ordine di simplicity:

### Path A — Preserve all subpath in exports + extend `files` (RACCOMANDATO)
Modifica PROMPT §A.1 exports map a:
```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.mjs",
    "require": "./dist/index.cjs"
  },
  "./styles": "./src/styles/globals.css",
  "./brand/candidates": "./src/components/brand/candidates/index.ts",
  "./assets/brand/*": "./src/assets/brand/*"
}
```
+ `"files": ["dist", "src/styles", "src/components/brand/candidates", "src/assets/brand", "README.md", "LICENSE"]`

**Pro**: zero modifica consumer-side. Tarball cresce di poco (3 source paths). `./styles` resta CSS source (Tailwind 4 lo digerisce — è il pattern attuale `link:`).
**Con**: il pacchetto pubblica source files (parzialmente) — accettabile per design system Tier 1-16 dove utility CSS è sostanzialmente content, non logica.
**Risk**: LOW — preserva esattamente il contratto pre-link consumer.

### Path B — Convert subpath a built outputs via tsup multi-entry
Estendere `tsup.config.ts` con `entry: { index: 'src/index.ts', 'brand/candidates': 'src/components/brand/candidates/index.ts' }` + plugin per CSS (`tsup-plugin-css` o copia manuale).
**Pro**: pacchetto fully-built, no source leakage.
**Con**: scope tsup config esteso, CSS pipeline non triviale, rischio drift.
**Risk**: MEDIUM — più cambi, più test.

### Path C — Migrate consumer a entry `"."`
Refactor `globals.css` per inline CSS Tailwind 4 (no @import), refactor `showcase/logo/page.tsx` per importare candidates da `"."` (require esponendoli dal main index.ts).
**Pro**: pacchetto minimal exports.
**Con**: tocca 3 file consumer, non-trivial; out-of-scope X18 (refactor cross-app non in PROMPT).
**Risk**: HIGH — touch surface ampia.

### Path D — Defer Tappa F + emit PROMPT 022.1 amended
Ferma X18 ora, Cowork emette PROMPT amendment con Path A o B integrato + retry.
**Pro**: zero rischio publish broken.
**Con**: latenza 1 round-trip.
**Risk**: ZERO — è il safe default.

**Raccomandazione CLI**: Path A. È minimal, preserva esattamente il contratto attuale `link:` (zero break consumer), e il pacchetto pubblicato funziona out-of-the-box per heuresys-advanced + apps/showcase + qualsiasi futuro consumer.

## §4 — Stato repos (snapshot pre-halt)

- **`D:/heuresys-advanced`**: HEAD `bfc645d` (verified, 3 commit C18 ahead origin/main, as expected). Working tree pre-existing modifications out-of-scope X18 — non toccate.
- **`D:/ux-design-shared`**: HEAD `572b53f` (verified, matches Cowork snapshot), working tree CLEAN. Branch main. **Nessuna modifica applicata da CLI.**
- **`npm`**: whoami=`spen-zosky` ✅, `npm view @heuresys/ui` returns 404 (nome libero, registry gap intatto).
- **Block A non avviato**: nessun file toccato in `D:/ux-design-shared/ui/` (no package.json edit, no tsup install, no tsup.config.ts created, no build, no dry-run).

## §5 — Bias catalog candidate

Pattern emerso: **CW-B55 candidate — "Spec-Coupling-Gap: subpath exports stripping without consumer scan"**.

Categoria: estensione CW-B33 (Spec-Implementation Coupling Gap già nel catalog). 
Discriminante: CW-B33 è "template SQL syntax OK ma runtime fail" (DB layer). CW-B55 candidate è "package.json exports map looks minimal-and-clean ma consumer subpath usage non-mapped → consumer build fail post-publish".

Trigger condizionale per nuovo numero: Cowork conferma che il pattern è ricorrente (non one-shot) — succederà anche per `@heuresys/shared` futuro publish, per qualsiasi npm publish migration di pacchetti link:-based. Se Cowork conferma, claim CW-B55 atomico in `cowork_reserved/bias_registry.md`.

Mitigazione standard (proposta): pre-PROMPT npm-publish-migration check obbligatorio = `grep -r '<pkgname>/' apps/ --include='*.ts' --include='*.tsx' --include='*.css' | grep -E 'import |@import '` → tutti i subpath devono essere mappati nell'exports map del PROMPT diff, OR esplicitamente migrati consumer-side prima del publish.

## §6 — Note operative

- Il PROMPT §A.1 ha la clausola "preserve `./styles.css` if built" che dimostra che Cowork era consapevole della possibilità di subpath — ma la clausola è singolare (`./styles.css`) e condizionale (`if actually built`), non copre il caso `./styles` source-direct (Tailwind pattern) né altri subpath.
- Apps/showcase è untracked nel git status (out-of-scope X18 per il PROMPT, ma materialmente parte del workspace pnpm). Migrare `link:` → `^0.1.0` anche lì potrebbe essere appropriato (Cowork decide se aggiungerlo a Block D).
- R10 enforcement: NESSUN file in `D:/ux-design-shared/ui/` toccato, NESSUN commit creato. Halt fail-early prima di azioni distruttive/irreversibili (npm publish).
- R11 enforcement: nessun token loggato, nessuna credenziale referenziata.

---

*HALT P0 emesso da CLI 2026-05-24T14:43:30Z. Esecuzione X18 sospesa al pre-Block A. Attesa Cowork decisione tra Path A/B/C/D + ri-trigger con PROMPT amendment (se Path D o A modificato) oppure exec_directive "procedi con Path A inline mitigation" (se Cowork autorizza inline scope extension §1.4 skill).*
