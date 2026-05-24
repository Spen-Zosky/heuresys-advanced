# REPORT 022 — CLI Batch X18 (MVP-3 Tappa F) — **PRE_BLOCK_A_HALT_P0 (spec gap)**

**Status**: HALT P0 al pre-Block A per scoperta materiale (exports map spec coupling gap). Esecuzione X18 NON avviata sui file repo.
**Goal ID**: 022 · **Slug**: `batch_x18_tappa_f_npm_publish_versioned_migration`
**Predecessor**: REPORT 021 (X17 D+B combo).
**Emitted by**: CLI · 2026-05-24T14:43:30Z (replaces precedente outcome PRE_FLIGHT_HALT_P0 npm-not-logged-in, ora RISOLTO da Enzo `npm login`)
**Halt notification (corrente)**: `cowork_code_exchange/.inbox/cowork/pending/2026-05-24T14-43-30Z__022__halt_exports_map_subpath_gap.md`
**Halt notification (precedente, risolta)**: `.inbox/cowork/pending/2026-05-24T14-35-08Z__022__halt_npm_not_logged_in.md` (Cowork può chiudere/movere a `read/`)

---

## §0 — Pre-conditions outcome

| Check | Expected | Actual | Status |
|---|---|---|---|
| `npm whoami` | username string ≠ "Not logged in" | `spen-zosky` | ✅ |
| HEAD `D:/heuresys-advanced` = descendant of `836880b` | `bfc645d` (3 commit C18 ahead origin/main) | ✅ matches Cowork snapshot |
| `D:/ux-design-shared` working tree clean | clean (HEAD `572b53f`) | ✅ verified |
| `npm view @heuresys/ui` | 404 (name available) | E404 Not Found | ✅ |
| Tags include `v0.2.1-mvp2a-final` | yes | yes (+ v0.3.0-mvp3 + v0.4.0-brand-v1) | ✅ |

**Outcome §0**: tutti pre-flight ✅. Halt P0 precedente (npm-not-logged-in) RISOLTO da Enzo `npm login` tra il primo run di questa sessione e il "rifai daccapo".

---

## §0bis — Pre-Block A discovery scan (CLI critical-thinking active)

PROMPT §A.1 §0.2 e §11 dichiarano critical thinking ATTIVO. Prima di applicare il diff `ui/package.json` (irreversibile downstream una volta passato Block C publish), ho eseguito uno scan di sanity sui consumer del workspace per validare che il diff exports map non rompa contract pre-existing.

**Comando**: 
```bash
grep -rn '@heuresys/ui/' /d/heuresys-advanced --include='*.ts' --include='*.tsx' --include='*.css' \
  | grep -vE 'node_modules|cowork_|\.next/|\.git/|\.claude/worktrees/' \
  | grep -E '^[^:]+:[0-9]+:(import |@import )' | sort -u
```

**Subpath consumers reali rilevati**:
| Consumer file | Linea | Statement | Target |
|---|---|---|---|
| `apps/web/src/app/globals.css` | 15 | `@import "@heuresys/ui/styles";` | `./src/styles/globals.css` (CSS source) |
| `apps/showcase/src/app/globals.css` | 13 | `@import "@heuresys/ui/styles";` | idem |
| `apps/web/src/app/showcase/logo/page.tsx` | 12 | `import { LogoCandidate*, ... } from "@heuresys/ui/brand/candidates";` | `./src/components/brand/candidates/index.ts` |

**Manifest current** (`D:/ux-design-shared/ui/package.json` linee 9-14) ha 4 export entries: `.`, `./styles`, `./brand/candidates`, `./assets/brand/*`. **3 di queste sono materialmente usate.**

**Diff PROMPT §A.1** elimina tutti i subpath (clausola "skip se non built"). Applicare alla lettera → al Block D, dopo Block C publish irreversibile, il consumer `apps/web` typecheck + Tailwind build fallisce e Playwright crasha. Apps/showcase pipeline GitHub Pages anch'essa rotta.

**Decisione CLI**: HALT P0 fail-early. Non procedere con Block A (sarebbe inutile finché spec exports map non viene corretto), tanto meno Block C (publish irreversibile su nome scoped pubblico).

---

## §1 — Block A library prep
**NOT EXECUTED**. Nessuna modifica a `D:/ux-design-shared/ui/package.json`. Nessuna `tsup` install. Nessuna `tsup.config.ts` creata. Nessun build. Nessun dry-run. Library repo working tree resta CLEAN al HEAD `572b53f`.

## §2 — Block B ux-design-shared commit
**NOT EXECUTED**.

## §3 — Block C publish outcome
**NOT REACHED**. Critical: `@heuresys/ui` resta UNPUBLISHED su npm registry. Decisione di publish ancora reversibile.

## §4 — Block D migration outcome
**NOT EXECUTED**. `apps/web/package.json`, `apps/web/next.config.*`, root `package.json`, `pnpm-lock.yaml` tutti intoccati. Junction Windows `node_modules/@heuresys/ui → D:/ux-design-shared/ui` preservata.

## §5 — Block E commit + tag
**NOT EXECUTED**. Nessun commit creato in `D:/heuresys-advanced`. Tag `v0.3.1-mvp3-final` NON applicato. HANDOFF refresh NON applicato.

---

## §6 — Bias catalog updates

**Candidate nuovo: CW-B55 — "Spec-Coupling-Gap: subpath exports stripping without consumer scan"**

Estensione concettuale di CW-B33 (Spec-Implementation Coupling Gap, DB layer focus). Categoria distinta:
- **CW-B33**: SQL template syntax OK ma runtime fail (DB layer)
- **CW-B55 candidate**: package.json exports diff appare minimal-clean ma consumer subpath usage non-mapped → consumer build fail post-publish (npm/registry layer)

Pre-claim CW-B55 numero atomico in `cowork_reserved/bias_registry.md` solo se Cowork conferma pattern ricorrente (es. anche per futuro `@heuresys/shared` publish). Mitigazione canonical proposta: pre-PROMPT npm-publish-migration scan = `grep -r '<pkgname>/' apps/ --include='*.{ts,tsx,css,mjs}' | grep -E 'import |@import |require\('` → ogni subpath risultante deve essere esplicitamente mappato (preserve) o migrato (refactor consumer-side) nel PROMPT diff.

Vedi halt notification §5 per dettaglio completo.

---

## §7 — Next step C19 recommendation

**Sospeso**. Sequenza retry attesa:

1. **Cowork** valuta proposed resolution paths in halt notification §3:
   - **Path A** (raccomandato CLI): preserve all subpath in exports map + extend `files` array. Minimal change, zero consumer break.
   - **Path B**: tsup multi-entry build subpath. Più cambi.
   - **Path C**: refactor consumer-side. Out-of-scope X18.
   - **Path D**: defer Tappa F + retry session.
2. **Cowork** emette decisione: 
   - opzione (i): exec_directive autorizzante inline mitigation Path A (CLI applica subito senza nuovo PROMPT)
   - opzione (ii): PROMPT 022.1 amendment con exports map corretto + retry full execution
3. **CLI** re-trigger e procede full sequence Block A → E.

Out-of-scope X18 confermato: option C (refactor consumer-side) non in scope, ma valutabile in sessione dedicata futura se Cowork preferisce minimal-exports surface a lungo termine.

---

## §8 — Halt status

| ID | Severity | Description | Action taken | Pending |
|---|---|---|---|---|
| HALT-022-01 | P0 | `npm whoami` E401 (npm-not-logged-in) | Halt notify emessa, REPORT §0 popolato | **RESOLVED** — Enzo `npm login` confermato, whoami=`spen-zosky`. Cowork può marcare closed + move to `.inbox/cowork/read/` |
| HALT-022-02 | **P0** | Exports map subpath spec gap (3 consumer reali non-mapped) | Halt notify emessa (`...__022__halt_exports_map_subpath_gap.md`), nessun file touched, REPORT aggiornato | Cowork: decide Path A/B/C/D, emit exec_directive o PROMPT amendment |

P1/P2: nessuno.

---

## §9 — HANDOFF refresh applied

**NOT APPLIED** in questo turno. Correttamente: nessun lavoro di codice eseguito sui repo, nulla da consegnare; lesson CW-B52 (HANDOFF refresh in same-commit-as-feature) resta valida e sarà applicata nello stesso commit Block E al retry post-resolution.

---

## §10 — Cowork spec improvements suggested (critical thinking emerged)

1. **Halt convention**: convention naming halt files in `.inbox/cowork/pending/` non specificata formalmente. Storico mostra `__008_halt_*` (singolo `_` pre-halt) e `__022__halt_*` (doppio `_` pre-halt — quello che ho usato per coerenza pattern report_ready/prompt_ready). Cowork-side da decidere canonical.

2. **Pre-publish consumer scan obbligatorio** (CW-B55 candidate mitigation): aggiungere al pattern memo `cowork_reserved/COWORK_CLI_PROMPT_PATTERN.md` una sezione "npm-publish-migration checklist" con step "grep subpath usages in consumer apps ed espliciti mapping in exports diff". Eviterebbe HALT-022-02 pattern in futuro.

3. **License file**: `files: ["dist", "README.md", "LICENSE"]` PROMPT §A.1 referenzia `LICENSE` ma file non esiste in `D:/ux-design-shared/ui/`. Non bloccante (npm publish skip missing files con warning), ma per igiene del pacchetto Cowork può aggiungere step "create LICENSE if missing" prima di Block A o accettare il warning post-publish. Documentato per visibilità.

4. **`dependencies` runtime in pacchetto pubblicato**: il manifest baseline ha ~80 `dependencies` (Radix, framer-motion, d3, three, ecc.). Con tsup `external: ["react", "react-dom"]`, queste vengono bundlate nel dist MA restano dichiarate come `dependencies` — doppia inclusione. Sub-ottimale ma non bloccante. Improvement futuro (0.2.0+): convertire le maggior parte a `peerDependencies` o `optionalDependencies`. Out-of-scope X18, segnalato per roadmap.

5. **`apps/showcase` Tappa F coverage**: showcase ha `"@heuresys/ui": "link:../../../ux-design-shared/ui"` (path 3-level-up dal package, non 2). Block D PROMPT §5 menziona solo `apps/web` e root `package.json`. Se Cowork vuole coerenza versioned cross-workspace, aggiungere `apps/showcase/package.json` al Block D. Altrimenti `apps/showcase` resta `link:` (continua a funzionare con CSS @import broken sul versioned `@heuresys/ui` finché il subpath non è mappato).

Nessuna delle 5 osservazioni è da sola halt material. La materiale halt è solo §0bis (subpath spec gap, HALT-022-02).

---

*REPORT 022 emesso da CLI 2026-05-24T14:43:30Z. Stato finale: PRE_BLOCK_A_HALT_P0 (exports map subpath spec gap). Esecuzione X18 sospesa al pre-Block A. Library repo + consumer repo entrambi UNTOUCHED. Attesa Cowork resolution (Path A/B/C/D) + ri-trigger.*
