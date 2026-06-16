# FINDINGS / WS-K — Repo hygiene & footprint (S-100X-A10)

> Audit forense **read-only** del workstream repo-hygiene & footprint. Metodo: misurazione on-disk reale (`du -sh`, `ls -la`, `find -printf`), interrogazione del tracked-tree (`git ls-files`, `git check-ignore`, `git status --ignored`), ispezione di `.gitignore` + `scripts/backup-db.sh` + `package.json` ×5. Evidenza: output `du`/`git` reali + `path:linea`. **ZERO modifiche, ZERO cancellazioni** — questo è un audit, si MISURA e si RACCOMANDA soltanto. Data: 2026-06-16 (S-100X-A10). Classificazione: `AUDIT_PROTOCOL.md`. Cross-ref seed: recon S-100X-0 R07 (`.next`+dumps rigenerabili) + asset "git history sana / 0 dist tracked / D-16 risolto".

## Headline (cosa cambia rispetto al recon R07 e agli asset del seed)

1. **🟠 HIGH K-1 — il footprint rigenerabile è cresciuto da 24G (recon) a 29G `.next` in 3 giorni, ed è quasi tutto UN unico dir mai potato: `apps/web/.next/dev/cache` = 28G** (96,5% del `.next`). Non è il build PROD (`.next/server` 73M, `.next/static` 11M, `.next/build` 863K): è la **cache webpack/turbopack della dev-mode** che il flusso E2E-locale (`next dev`, vedi `reference_playwright_stale_dev_servers`) accumula senza limite. Il recon R07 misurava 24G; oggi 29G → **+5G in 3 giorni, crescita ~1,7G/giorno**. È il singolo item più reclaimable del repo e cresce monotòno.
2. **🟡 MEDIUM K-2 — `pg_dump_snapshots/` = 3,7G di 27 dump ad-hoc pre-op SENZA alcuna retention**; la `backup-db.sh` retention (`:46`) è **deliberatamente scoped** al solo `scheduled/` subdir (che **non esiste neppure localmente** — i timer girano sulla VM) e per design **NON tocca** i `pre-*` manuali (`:44-45` commento esplicito). Risultato: i 27 dump da `2026-05-30` in poi (6× ~414-436M ciascuno = ~2,5G nei soli top-6) restano per sempre. La maggior parte sono milestone già superate (`pre-rtl-rebuild`, `pre-09-collapse`, `pre-ws1..ws7`, `pre-cleanup-s954`) — restore-point storici di valore decrescente.
3. **✅ ASSET CONFERMATO (D-16 chiuso) — 0 file generati tracciati**: `git ls-files | grep -E 'dist/|\.next/'` = **0**, `… pg_dump_snapshots|\.cache/` = **0**. Tutti i 7 dir rigenerabili pesanti (`apps/web/.next`, `apps/showcase/.next`, `node_modules`, `pg_dump_snapshots`, `.cache`, `apps/api/dist`, `packages/shared/dist`) sono `git check-ignore` = **IGNORED**. La `.gitignore` (157 righe) copre `dist/ build/ out/ .next/ .turbo/ *.tsbuildinfo .cache/ node_modules/ pg_dump_snapshots/ *.dump *.backup` + secret + qa-runs + worktrees + apify + media-store. Lo stray `packages/shared/dist/schemas/analytics.d.ts` (D-16) **non si ripresenta**.
4. **`clean` script: NON ESISTE in nessuno dei 5 `package.json`** (`grep '"clean'` root+api+web+showcase+shared = 0 hit) → **QW-K1 = il QW-2 del kickoff** (un `clean` + retention scriptata copre K-1 e K-2 in un colpo, zero rischio, additivo).
5. **Tracked-tree pulito e proporzionato**: il file tracciato più grande è `docs/source_bundle/brownfield/db-export.zip` (1,0M, **input material documentato**, gitignored-by-sibling), poi seed SQL di riconciliazione (0,9M `48_engagement_normalized.sql`) + `pnpm-lock.yaml` (462K). **Nessun candidato LFS, nessun binario abnorme tracciato.** `.git` = 28M (recon: 23M; size-pack ~19M) → **history sana**, nessun bloat da binari committati.

---

## Gruppo A — Footprint rigenerabile on-disk (il cuore di WS-K)

### F-WS-K-1 — `apps/web/.next/dev/cache` = 28G di cache dev-mode mai potata; il `.next` totale è cresciuto 24G→29G in 3 giorni
- Severità: **HIGH** | Flag: **QUICK-WIN** (clean + cap)
- Evidenza (du reale):
  - `du -sh apps/web/.next` = **29G**. Breakdown: `.next/dev` **29G** · `.next/server` 73M · `.next/static` 11M · `.next/build` 863K · `.next/cache` 354K.
  - Dentro `dev`: `.next/dev/cache` = **28G** · `dev/server` 184M · `dev/static` 137M · `dev/trace` 3,3M. → il 96,5% del `.next` è **una sola cache dev**.
  - Età: `find apps/web/.next/dev -printf` → `build` del **2026-06-10**, `types/validator.ts` del **2026-06-16** → cache viva e in scrittura continua.
  - Crescita: recon S-100X-0 R07 (2026-06-13) misurava `du -sh apps/web/.next` = **24G**; oggi (2026-06-16) = **29G** → **+5G/3gg ≈ 1,7G/giorno** mentre gira il loop E2E-locale `next dev` (vedi `reference_playwright_stale_dev_servers`: gli E2E locali richiedono `next dev`, non `next start`).
- Impatto: footprint (28G di disco recuperabili istantaneamente) + robustezza (crescita monotòna non governata → riempie il disco; sullo stesso volume del DB locale dev)
- Baseline: `apps/web/.next` = 29G (di cui `dev/cache` 28G); `apps/showcase/.next` = 3,0G; `.cache` (root) = 134M. Tutto `git check-ignore`=IGNORED, 0 tracciato.
- Proposta: **QUICK-WIN** — (a) `clean` script che fa `rm -rf apps/*/.next .cache` (rigenerabile a costo zero: `pnpm build`/`next dev` la ricreano); (b) opzionale cap della dev-cache via `next.config` `cacheMaxMemorySize`/pulizia periodica o `.next/dev/cache` nel clean-loop a fine sessione E2E. **Gate**: post-`clean` `du -sh apps/web/.next` < 100M; `pnpm build` rigenera senza errori; E2E PROD (`test:e2e:prod`) verde. **Non azionare a caldo durante una sessione E2E in corso** (la cache attiva).

### F-WS-K-2 — `pg_dump_snapshots/` = 3,7G di 27 dump ad-hoc pre-op senza retention; il pruning di `backup-db.sh` è scoped e non li tocca
- Severità: **MEDIUM** | Flag: **QUICK-WIN** (retention pre-op) / NOTE (decide Enzo quali tenere)
- Evidenza:
  - `du -sh pg_dump_snapshots` = **3,7G**; `ls -la` → **27 file** (24 `.dump`/`.dump.gz`/`.sql` + 3 `.provenance.txt`), dal **2026-05-30** al **2026-06-10**.
  - Top per size: `pre-rtl-rebuild_…20260530.dump` 417M · `pre-09-collapse_…20260530.dump` 417M · `pre-rtl-stabilization_…20260531.dump` 416M · `pre-tenant-cleanup-s954` / `pre-cleanup-s954` / `pre-000045-rekey` ~414M (gz) · 4× `pre-ws{1,4,4-r1b,7}` ~219M · `pre-wave2-49-50_…20260610` 202M. **I 6 più grandi ≈ 2,5G.**
  - Retention: `scripts/backup-db.sh:25` `BACKUP_DIR=$ROOT/pg_dump_snapshots/scheduled` (subdir dedicata); `:44-46` la prune è `find "$BACKUP_DIR" -maxdepth 1 -name "${DB_NAME}_*.dump" -mtime +RETENTION_DAYS -delete` → **scoped al solo `scheduled/`** + pattern `DB_NAME_*.dump`. Il commento `:44-45` è esplicito: *"NEVER touches manual pre-op snapshots in the parent dir"*. `scheduled/` **non esiste localmente** (`ls pg_dump_snapshots/scheduled` → assente; i timer backup girano sulla VM PROD, vedi WS-C F-WS-C-5). → i 27 `pre-*` manuali **non hanno alcuna retention, su nessuna macchina**.
- Impatto: footprint (3,7G, in crescita ~1 dump/milestone) — non perf/robustezza (sono offline, su disco dev)
- Baseline: 3,7G / 27 dump pre-op, oldest 2026-05-30, 0 retention. Gitignored (`*.dump` :108 + `pg_dump_snapshots/` :110), 0 tracciati.
- Proposta: **QUICK-WIN** — retention sui pre-op (es. `find pg_dump_snapshots -maxdepth 1 -name 'pre-*' -o -name '*_pre-*' -mtime +30 -print` come step di `clean`/housekeeping, **dry-run di default**). **NOTE/decide Enzo**: i `pre-*` sono restore-point di milestone già chiuse (rtl-rebuild, v1.0.0-consolidation, ws1..ws7 tutti shipped) → la maggior parte è archiviabile; ma sono restore-point storici, quindi la cancellazione è **decisione Enzo** (mai auto-delete di un dump). Alternativa zero-perdita: spostarli off-disk (bucket OCI / twin linux-pc) — couples WS-C F-WS-C-5 off-host + WS-G F-2 SPOF.

### F-WS-K-3 — `apps/showcase/.next` 3,0G + `.cache` 134M: footprint dev secondario, stessa classe di K-1
- Severità: **LOW** | Flag: QUICK-WIN (coperto da K-1)
- Evidenza: `du -sh apps/showcase/.next` = **3,0G** (static-export build cache showcase), `.cache` (root) = **134M**. Entrambi `git check-ignore`=IGNORED. `node_modules` (root, pnpm hoisted) = **1,9G** (le `node_modules` per-workspace sono symlink pnpm: api 169K, web 172K, showcase 80K, shared 28K → la massa reale è il virtual-store hoisted, sana).
- Impatto: footprint (3,1G aggiuntivi reclaimable)
- Proposta: **incluso nel QW-K1** `clean` (`apps/*/.next` cattura anche showcase; `.cache` esplicito). `node_modules` NON va nel `clean` di default (il re-install pnpm è costoso e cold) → eventuale `clean:deep` separato opt-in.

---

## Gruppo B — Tracked-tree hygiene (.gitignore, generati, binari)

### F-WS-K-4 — ASSET: 0 file generati tracciati (D-16 chiuso e non-recidivo); .gitignore copre tutti i 7 dir rigenerabili
- Severità: INFO | Flag: ASSET
- Evidenza:
  - `git ls-files | grep -cE 'dist/|\.next/'` = **0**; `… 'pg_dump_snapshots|\.cache/'` = **0**. Lo stray `packages/shared/dist/schemas/analytics.d.ts` (recon D-16) **non si ripresenta** nel tracked-tree.
  - `git check-ignore -q` su tutti i 7: `apps/web/.next` · `apps/showcase/.next` · `node_modules` · `pg_dump_snapshots` · `.cache` · `apps/api/dist` · `packages/shared/dist` → **tutti IGNORED**.
  - `.gitignore` (157 righe): build-outputs `dist/ build/ out/ .next/ .turbo/ *.tsbuildinfo .cache/` (`:58-64`), node `node_modules/ .pnpm-store/` (`:48-49`), PG `*.dump *.backup pg_dump_snapshots/` (`:108-110`), secret `.env* *.pem *.key .secrets/` (`:36-43`), test `coverage/ playwright-report/ test-results/ qa_artifacts/runs/ qa_artifacts/db_snapshots/` (`:69-77`), worktrees/apify/media/graphify/deploy-reports. **Copertura completa.**
- Proposta: **NESSUNA azione** — è il pattern corretto. La `.gitignore` è uno degli asset di hygiene più maturi del repo.

### F-WS-K-5 — ASSET: nessun binario tracciato abnorme, 0 candidato LFS; .git sana (28M)
- Severità: INFO | Flag: ASSET
- Evidenza:
  - Top tracked file (`git ls-files -z | xargs -0 ls -la | sort -k5 -n | tail`): `docs/source_bundle/brownfield/db-export.zip` **1,07M** (input material documentato — `.gitignore:15-16` lo conserva by-design come bootstrap input) · `db/seeds/reconciliation/48_engagement_normalized.sql` **912K** · `db/seeds/brownfield/wave1/04_column_mappings.sql` **472K** · `pnpm-lock.yaml` **462K** · `db/seeds/reconciliation/46_engagement_surveys.sql` **382K** · `docs/kb/index_paths.yaml` **349K** · `qa_artifacts/x14_playwright_full.txt` **314K** · `Company_HRMS_…_v5.zip` **223K**. **Tutto sotto 1,1M, tutto testo/SQL/lock + 2 zip di input doc.**
  - `.git` = **28M** (recon: 23M; size-pack ~19M). Nessuna esplosione da binari committati e mai rimossi dalla history.
- Impatto: nessuno (asset)
- Proposta: **NESSUNA azione** — 0 candidati LFS (il più grande tracciato è 1,07M; LFS si giustifica >>10-50M). I 2 `.zip` sono input-material legittimi (bootstrap pack + db-export). **NB**: il `db-export.zip` 1,07M è tracciato deliberatamente (`.gitignore:14-20` documenta che l'estratto va ignorato ma lo zip-input resta versionato).

### F-WS-K-6 — NOTE: 2 file untracked-not-ignored (1 da committare, 1 fuori-scope)
- Severità: **LOW** | Flag: NOTE
- Evidenza: `git status --porcelain --ignored=no | grep '^??'` = **2** entry: (a) `.claude/skills/` — config Claude locale (coerente col gitStatus di sessione); (b) `deploy/systemd/heuresys-advanced-dr-drill.service` **+** `…-dr-drill.timer` (creati 2026-06-16 22:13) = **gli artefatti del QW-C3 di WS-C** (timer dr-drill schedulato), untracked perché generati in una sessione successiva al recon, **da committare** quando QW-C3 viene shipped.
- Impatto: hygiene (un artefatto deploy reale non ancora tracciato — non un leak)
- Proposta: **NOTE** — il `.service`/`.timer` dr-drill vanno tracciati nel commit che chiude QW-C3 (sono unit systemd versionabili, come i fratelli `*-backup.{service,timer}`). `.claude/skills/` è config-locale (ignorabile a livello globale o lasciabile untracked). **Nessuna azione in fase A** (read-only).

---

## Gruppo C — Tooling di hygiene (clean script, retention, growth)

### F-WS-K-7 — `clean` script NON ESISTE (0/5 package.json) → QW-K1 = il QW-2 del kickoff
- Severità: **MEDIUM** | Flag: **QUICK-WIN**
- Evidenza: `grep -rn '"clean' package.json apps/api/package.json apps/web/package.json apps/showcase/package.json packages/shared/package.json` = **0 hit**. Nessun `clean`, `clean:deep`, `prune`, `gc` definito. Coerente col kickoff/recon: *"none existed at recon"* (QW-2 candidate). Oggi la pulizia dei 29G+3,7G+3,1G è **100% manuale** (`rm -rf` a mano), quindi **non avviene** → la dev-cache cresce ~1,7G/giorno (K-1).
- Impatto: footprint (nessuna leva automatica per recuperare ~35G) + DX (ogni sviluppatore deve sapere quali dir nuke a mano)
- Baseline: 0 clean script; ~35G reclaimable senza alcun comando canonico.
- Proposta: **QUICK-WIN (QW-K1)** — aggiungere al root `package.json`:
  - `"clean": "rm -rf apps/*/.next packages/*/dist apps/*/dist .cache apps/*/*.tsbuildinfo"` (rigenerabili a costo build, ~35G→<200M);
  - `"clean:dumps": "find pg_dump_snapshots -maxdepth 1 -name 'pre-*' -mtime +30 -print"` (**dry-run di default**, NO `-delete` — l'eliminazione di un dump è decisione Enzo);
  - opzionale `"clean:deep": "pnpm clean && rm -rf node_modules apps/*/node_modules packages/*/node_modules"` (opt-in, re-install cold).
  - **Gate**: `pnpm clean` poi `du -sh apps/web/.next` < 100M; `pnpm build` verde post-clean; `pnpm clean:dumps` lista i pre-op >30g senza cancellare nulla; `git status` resta pulito (i target sono già gitignored). **Doc-only in fase A.**

### F-WS-K-8 — ASSET: docs/qa_artifacts/sessioni sotto controllo (no sprawl di footprint; lo sprawl R13 è di COUNT, non di GB)
- Severità: INFO | Flag: ASSET (con cross-ref a R13/WS-A11)
- Evidenza: `du -sh` → `docs` **19M** (341 file tracciati) · `qa_artifacts` **4,1M** (93 tracciati, `runs/` gitignored `:74`) · `cowork_code_exchange` **2,6M** · `cowork_reserved` **1,7M** · `sessioni` **342K** (12 tracciati). **Il footprint-GB di docs/qa è trascurabile** (~28M totali su 38G repo). Il problema docs è di **numerosità/drift** (recon R13: 230 md, source_bundle drift-magnet, ~150 log cowork storici) — che è **scope di WS-A11 (DX/docs)**, non di WS-K (footprint).
- Impatto: nessuno sul footprint; rimando a R13/WS-A11 per il drift
- Proposta: **NESSUNA azione in WS-K** — i docs non sono un problema di footprint. Cross-ref R13 per il drift di numerosità (decisione Enzo: archiviare i ~150 log `cowork_code_exchange/` storici sotto `_archive/` taglierebbe count+2,6M, ma è hygiene-DX non footprint).

---

## Quick wins (QW-K*) — CLASS-A estraibili (indipendenti, low/zero rischio)

- **QW-K1** (= il **QW-2** del kickoff) — `clean` + `clean:dumps`(dry-run) + opt-in `clean:deep` nel root `package.json` [F-WS-K-1/2/3/7]. Recupera **~35G** rigenerabili (29G `.next` web + 3,0G showcase + 134M `.cache` = ~32G subito; +3,7G dumps via `clean:dumps` solo su decisione Enzo). **Gate**: post-`pnpm clean` `du -sh apps/web/.next` < 100M + `pnpm build` verde + `git status` pulito (target già gitignored). **Zero rischio** (target tutti rigenerabili + gitignored; nessun touch a tracked/secret/DB).
- **QW-K2** — cap/pulizia ricorrente della dev-cache `apps/web/.next/dev/cache` (28G, +1,7G/gg) come step di chiusura del loop E2E-locale [F-WS-K-1]. **Gate**: la cache non supera una soglia (es. 5G) tra sessioni; E2E PROD resta verde. **NB**: non azionare durante una sessione E2E attiva.
- **QW-K3** — retention/archiviazione dei 27 dump `pre-*` di milestone chiuse (decisione Enzo su quali tenere; alternativa zero-perdita = off-disk OCI/linux-pc) [F-WS-K-2]. **Gate**: `clean:dumps` dry-run elenca i candidati >30g; nessuna cancellazione senza go esplicito; `du -sh pg_dump_snapshots` cala del previsto.

> Tutti i QW restano **doc-only in questa fase A** (read-only). Sono candidati per la fase E (esecuzione) su go di Enzo, con i gate sopra. **`clean:dumps` e QW-K3 non cancellano mai un dump in autonomia** — un restore-point si archivia/sposta, non si auto-elimina.

---

## ASSET confermati (NON regredire senza dossier)

- **0 file generati tracciati** (D-16 chiuso, non-recidivo): `dist/`/`.next/`/`pg_dump_snapshots`/`.cache` = 0 hit in `git ls-files`; tutti `git check-ignore`=IGNORED [F-WS-K-4].
- **.gitignore completa** (157 righe, copre i 7 dir rigenerabili + secret + qa-runs + worktrees + apify + media + graphify + deploy-reports) [F-WS-K-4].
- **0 candidato LFS, .git sana** (28M; top tracked = `db-export.zip` 1,07M input-material; tutto il resto testo/SQL/lock) [F-WS-K-5].
- **backup-db.sh retention scoped e corretta** (tocca solo `scheduled/`+`DB_NAME_*.dump`, mai i pre-op manuali by-design) — è una buona pratica, NON un bug; il gap è la **mancanza** di una retention separata per i pre-op (K-2), non un difetto della scoped-prune [F-WS-K-2].
- **Footprint docs/qa trascurabile** (~28M su 38G repo) — lo sprawl è di count/drift (R13/WS-A11), non di GB [F-WS-K-8].

---

## Baseline Repo hygiene & footprint (misure reali — aggiorna `BASELINE_METRICS.md`)

### Before / after-potential footprint (du reale 2026-06-16)

| Dir | On-disk ORA | Tracciato? | Reclaimable | Dopo QW-K1 (potenziale) |
|---|---|---|---|---|
| `apps/web/.next` (di cui `dev/cache` 28G) | **29G** | 0 (IGNORED) | sì (rigenerabile) | < 100M |
| `apps/showcase/.next` | **3,0G** | 0 (IGNORED) | sì | < 100M |
| `node_modules` (root, pnpm hoisted) | **1,9G** | 0 (IGNORED) | sì (`clean:deep` opt-in) | invariato (default) |
| `pg_dump_snapshots` (27 dump pre-op) | **3,7G** | 0 (IGNORED) | sì (decide Enzo) | ~0-3,7G (QW-K3) |
| `.cache` (root) | **134M** | 0 (IGNORED) | sì | < 10M |
| `apps/api/dist` | 1,5M | 0 (IGNORED) | sì | 0 |
| `packages/shared/dist` | 892K | 0 (IGNORED) | sì | 0 |
| **Repo totale on-disk** | **38G** | — | **~36G rigenerabile** | **~2-3G** (post clean + dumps decision) |
| **`.git`** | **28M** | (history) | no (sana) | invariato |

### Hygiene counts

| Metrica | Valore reale | Comando/Fonte |
|---|---|---|
| Tracked `dist/`/`.next/` | **0** (D-16 chiuso, non-recidivo) | `git ls-files \| grep -cE 'dist/\|\.next/'` |
| Tracked `pg_dump`/`.cache` | **0** | `git ls-files \| grep -cE 'pg_dump_snapshots\|\.cache/'` |
| Dir rigenerabili pesanti gitignored | **7/7** IGNORED | `git check-ignore -q` ×7 |
| `clean` script | **0/5** package.json (QW-2 candidate) | `grep '"clean' package.json apps/*/… packages/*/…` |
| Top tracked file | `db-export.zip` **1,07M** (input-material doc) | `git ls-files \| xargs ls -la \| sort -k5 \| tail` |
| Candidati LFS | **0** (max tracciato 1,07M) | idem |
| `.git` size | **28M** (recon 23M, size-pack ~19M) | `du -sh .git` |
| Untracked-not-ignored | **2** (`.claude/skills/` config + dr-drill `.service`/`.timer` da committare) | `git status --ignored=no` |
| `pg_dump_snapshots` retention | **0** sui pre-op (backup-db.sh scoped a `scheduled/` only) | `scripts/backup-db.sh:25,44-46` |
| `.next/dev/cache` growth | **24G→29G in 3gg (~1,7G/giorno)** | recon R07 vs du odierno |
| docs / qa_artifacts footprint | 19M (341 trk) / 4,1M (93 trk) — trascurabile | `du -sh docs qa_artifacts` |

**Insight chiave**: l'hygiene **strutturale** del repo è eccellente — **0 generati tracciati** (D-16 chiuso), `.gitignore` completa, `.git` sana (28M), 0 candidato LFS. Tutto il "peso" del repo (38G su disco) è **rigenerabile e già gitignored**: il 96,5% del `.next` è una **singola cache dev-mode** (`apps/web/.next/dev/cache` 28G) che cresce ~1,7G/giorno perché **non esiste un `clean` script** (l'unico vero gap di tooling, = QW-2 del kickoff). I 3,7G di dump `pre-*` sono restore-point storici senza retention (la prune di `backup-db.sh` è scoped al `scheduled/` per design). **GB recuperabili immediati: ~32G** (`clean` di `.next`+`.cache`+`dist`, zero rischio, target tutti rigenerabili+gitignored), **+3,7G** in più su decisione Enzo (archiviazione dump pre-op).

---

## Roll-up → candidati (decide Enzo per-finding; questo è un audit, non un fix)

**Quick-wins CLASS-A** (eseguibili su go, gate espliciti sopra):
- **QW-K1** = **QW-2 del kickoff**: `clean` + `clean:dumps`(dry-run) + opt-in `clean:deep` nel root package.json → ~32G immediati [F-WS-K-1/3/7].
- **QW-K2**: cap/pulizia ricorrente di `.next/dev/cache` a fine loop E2E-locale [F-WS-K-1].
- **QW-K3**: retention/archiviazione (NON auto-delete) dei 27 dump `pre-*` di milestone chiuse — couples WS-C F-WS-C-5 off-host + WS-G F-2 SPOF [F-WS-K-2].

**Note (verifica/decisione, non fix):**
- Committare le unit `dr-drill.service`/`.timer` (untracked) quando QW-C3 di WS-C viene shipped [F-WS-K-6].
- Docs/cowork-log sprawl è **count/drift** (R13/WS-A11), non footprint — fuori scope WS-K [F-WS-K-8].

**Asset da NON regredire**: 0 generati tracciati (D-16) · .gitignore completa · .git sana 28M · 0 LFS · backup-db.sh retention scoped corretta.

---

*Audit S-100X-A10 — read-only, misurazione on-disk reale (`du`/`ls`/`find`) + tracked-tree (`git ls-files`/`check-ignore`/`status --ignored`) + ispezione `.gitignore`/`backup-db.sh`/`package.json`. ZERO modifiche, ZERO cancellazioni. I finding confluiscono nel registro dossier/QW 100X — decisione per-finding di Enzo. Cross-ref: recon S-100X-0 R07 (`.next`+dumps → quantificato e cresciuto) + WS-C F-WS-C-5 (backup/DR scoped, dr-drill artifacts) + WS-G F-2 (SPOF off-host per K-3) + R13/WS-A11 (docs drift di count, non footprint).*
