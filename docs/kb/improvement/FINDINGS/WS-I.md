# FINDINGS / WS-I — Documentazione (S-100X-A11)

> Audit forense **read-only** del workstream Documentazione (drift / duplicazione / index / orfani). Metodo: lettura SoT (`CLAUDE.md`, `README.md`, `.handoff/STATE.md`, `docs/kb/SOT_STATE.md`, `docs/kb/INDEX_PATHS.md`, l'albero `docs/kb/improvement/`) + cross-check dei claim numerici contro la realtà live (codice via `ls`/`grep`/`find`; DB PROD via tunnel `:5433` per RBAC + ledger migration). Evidenza: `path:linea` reali + comando con output reale. **Zero modifiche** a doc/codice/config; nessuna scrittura DB (solo SELECT/catalogo). Data: 2026-06-16 (S-100X-A11). Classificazione: `AUDIT_PROTOCOL.md`. NB: l'output di questo audit (`WS-I.md`) e i delta S993 sono **correnti** (non flaggati).

## Headline (cosa cambia rispetto a WS-C/WS-G/WS-F)

1. **🟠 HIGH I-1 — `README.md` è un milestone-snapshot congelato a v1.0.0/S957 e ora deriva su ~tutti i conteggi headline** (misurato). La tabella "Headline numbers" + il blocco "Tech stack" + il layout monorepo riportano valori vecchi di 36 sessioni: **60 moduli** (live **75**), **55 migration** (live **130**), **272/279 endpoint** (live **77 prefissi `/v1`** + **424 route-reg**), **8 ruoli × 99 perm × 394 map** (live **11 / 137 / 600**), **576 test** (S992 full-suite **1007**), **Next 15 / TS 5.7 / Node 20** (live **Next 16.2.7 / TS 6.0.3 / Node 22**). È la singola superficie doc più drift-densa del repo e quella public-facing (homepage GitHub). D-01 risolse il drift su CLAUDE.md+README a S958 ma il README **non è handoff-governed** → ha riaccumulato drift mentre SOT_STATE/STATE (riscritti dalla skill `handoff`) sono rimasti veri.
2. **🟠 HIGH I-2 — `CLAUDE.md` (regole durature, sempre-caricato) ha drift numerico nelle sezioni "What this is" + layout + "Database migrations" + RBAC** (misurato). Claim stale: **~60 moduli** (×2: `:9`, `:95`), **55 migration `000001..000056`** (×3: `:9`, `:101`, `:209-211`), **~279 endpoint / 576 test / 60/60 moduli** (`:9`), **586 role×permission mappings** (×3: `:81`, `:161`, `:206` — live **600**). A differenza del README, CLAUDE.md è caricato in OGNI sessione e cita questi numeri come baseline autorevole → il drift si propaga nel context di ogni sessione (R9: pattern stale peggiori del "non so").
3. **🟠 HIGH I-3 — `docs/kb/INDEX_PATHS.md` è stantio di 18 giorni e ~3 sessioni-batch** (generato 2026-05-27, S939). Dichiara **1369 file dominio**, **44 db-migration** (live **130**), **194 api-module file / ~64 moduli** (live **75 moduli = 225+ file**); **13 moduli nuovi mancano del tutto** dall'indice (`analytics`, `engagement`, `insights`, `mentorship`, `notifications`, `observability`, `predictions`, `reference-sync`, `semantic-matching`, `surveys`, `teams`, `mfa-policy`, `content`+`content-blueprint-links`). L'INDEX è generato da un tool (`docs/kb/tools/build_index.py`) ma NON è ricostruito dalla skill `handoff` → è un SoT "path index" che mente sulla topologia attuale.
4. **🟡 MEDIUM I-4 — `README.md` punta a 2 file root che non esistono più** (`HANDOFF.md`, `NEXT_SESSION_MVP_2A.md` nel blocco layout `:110-111`): entrambi **archiviati** in `docs/archive/` (verificato). Link/riferimenti rotti nella doc public-facing.
5. **Asset forti confermati**: la **disjunction-rule SoT v2 È rispettata** (`.handoff/STATE.md` = 0 conteggi numerici di sistema, lo dichiara e lo onora — i soli "numeri" sono ID-sessione/QW/porte; tutti i counts vivono solo in `SOT_STATE.md`) → **0 duplicazioni di fatto tra i due SoT handoff-governed**. SOT_STATE + STATE sono **correnti e veri** (riscritti dalla skill `handoff`, delta S993 allineato a live). L'albero `improvement/` è internamente coerente (TODO_100X ↔ FINDINGS register hanno 1 disallineamento minore di stato, I-7). Nessun doc-SoT duplica i counts (il README e CLAUDE.md sono **snapshot dichiarati**, non SoT vivi — ma il drift resta da sanare).

---

## Gruppo A — Doc DRIFT (claim vs realtà live)

### F-WS-I-1 — `README.md`: ~tutti i conteggi headline derivati (milestone-snapshot v1.0.0 mai aggiornato post-GA)
- Severità: **HIGH** | Flag: **QUICK-WIN** (rewrite mirato della tabella + tech-stack + layout)
- Evidenza (claim drifted → valore reale live):

  | README claim (riga) | README dice | Valore reale live | Comando di verifica |
  |---|---|---|---|
  | Subtitle (`:3`) | "8 roles × 99 permissions × 394 mappings" | **11 / 137 / 600** | `psql … sys_auth_roles/role_permissions` |
  | Status (`:6`) | "~279 endpoints · 576 vitest tests · 65 web routes · 55 migrations (000001..000056) · 21 Playwright" | **77 `/v1` prefissi / ~424 route-reg · 1007 (S992) · 85 page.tsx · 130 (000001..000131) · 48 spec** | `grep`/`find`/`ls` |
  | Headline tab (`:15-17`) | "272 business+2 health · 60 API modules · 62 shared schemas" | **77 prefissi · 75 moduli · 78 schemi** | `ls -d modules/*/`, `ls schemas/*.ts` |
  | Headline tab (`:18-19`) | "~138 sys tables · 55 migrations · 576 PASS/5 SKIP (60/60)" | **~144 tabelle con righe (S984) · 130 migration · 1007 pass/6 skip (75/75)** | `ls db/migrations`, SOT_STATE S992 |
  | Headline tab (`:21`) | "21 Playwright spec" | **48 spec** | `ls tests/e2e/*.spec.ts` |
  | Tech stack (`:30-35`) | "Next 15.5 · React 19.2 · Tailwind 4.3 · Playwright 1.55 · Zod 3.25 · TS 5.7 · Node 20 LTS · pnpm 9.15" | **Next 16.2.7 · Playwright 1.61 · Zod 4.4.3 · TS 6.0.3 · Node 22** | `BASELINE_METRICS.md` §Stack |
  | Layout (`:44`,`:50`,`:60`,`:83`,`:86`) | "58 modules · 47 routes · 59 subpath/427 schemas · 43 migrations (000001..000044)" | **75 moduli · 85 page · 78 schemi · 130 migration** | idem |
  | Roadmap pers. tab (`:162-165`) | personas `*.test@rtl-bank.test` (tenant_admin_test, manager_test…) | personas **reali RTL** post-S950 (`federica.marchetti@rtl-bank.org` ecc.; gli `*.test` furono CANCELLATI) | CLAUDE.md §Security model |
- Impatto: **DX** (homepage GitHub menzognera per ogni nuovo lettore/valutatore) + robustezza-percepita (un valutatore due-diligence legge "576 test / 60 moduli" mentre il prodotto ne ha 1007/75)
- Baseline: README fermo allo snapshot 2026-06-02 (v1.0.0); 36 sessioni di drift accumulato (S958→S993).
- Proposta: **QUICK-WIN** doc-only — riscrivere la tabella "Headline numbers" + "Tech stack" + il blocco layout ai valori live, e **aggiungere una riga di disclaimer** che rimanda esplicitamente a `SOT_STATE.md` per i running-counts (già c'è a `:7` ma i numeri inline la contraddicono). Fix personas a `:162-165`. **Verify-gate**: ogni numero nel README ha un comando riproducibile (la tabella sopra) → post-fix, re-grep deve combaciare.

### F-WS-I-2 — `CLAUDE.md`: drift numerico in 4 sezioni (sempre-caricato → si propaga in ogni sessione)
- Severità: **HIGH** | Flag: **QUICK-WIN**
- Evidenza (`grep` su `CLAUDE.md`):
  - `:9` ("What this is"): "ships ~60 business modules + auth (~279 live /v1/* endpoints, 576 integration tests across ~82 files, 60/60 modules covered)" → live **75 moduli / 77 prefissi `/v1` / 1007 test su 146 file / 75-su-75**.
  - `:95` (layout): "~60 business modules + auth shipped" → **75**.
  - `:101` + `:209` + `:211` (DB migrations): "55 idempotent SQL files (000001..000056)" / "55 numbered SQL files in 000001..000056" → live **130 file `000001..000131`** (`ls db/migrations/*.sql | wc -l` = 130; max `000131_drop_dead_lineage_natural_key_idx.sql`).
  - `:81` + `:161` + `:206` (RBAC): "rolesLoaded:11 mappingsLoaded:586" / "586 role×permission mappings, 11 roles" → live `SELECT count(*) FROM sys.sys_auth_role_permissions` = **600** (11 ruoli ✅ corretto; 137 permission distinte; **mappings 586→600 stale**). NB `:206` aggiunge "verify live" → invita alla verifica ma stampa comunque il numero vecchio inline.
- Impatto: **DX** + propagazione (R9: il numero stale entra nel context di OGNI sessione e viene replicato — es. PROMPT subagent, REPORT). Più insidioso del README perché sempre-caricato.
- Baseline: la sezione "What this is" + "Database migrations" non sono ri-derivate dalla skill `handoff` (la skill riscrive SOT_STATE/STATE/backlog/debt, **non** CLAUDE.md) → CLAUDE.md è un doc a manutenzione manuale che ha accumulato drift dopo D-01.
- Proposta: **QUICK-WIN** doc-only — aggiornare i 4 punti (60→75 moduli, 55/000056→130/000131 migration ×3, 586→600 map ×3, e la riga `:9` su endpoint/test/file). **Decisione di policy** (rimando leggero a I-8): valutare se sostituire i numeri inline di CLAUDE.md con "(verify live — vedi SOT_STATE)" per i conteggi volatili, lasciando hardcoded solo gli invarianti (11 ruoli, gap 000035, pattern 7-step). Riduce il re-drift futuro.

### F-WS-I-3 — `INDEX_PATHS.md` stantio (2026-05-27): 1369 file / 44 migration / 13 moduli mancanti
- Severità: **HIGH** | Flag: DOSSIER (rigenerare + decidere se cablarlo all'handoff) / QUICK-WIN (rigenerazione one-shot)
- Evidenza:
  - Header `:3`: "Generato 2026-05-27T16:38:44Z · Totale file dominio 1369". `BASELINE_METRICS.md:73` misura **file tracked 1791** (S-100X-0) → l'indice è 422 file dietro.
  - Tabella categorie `:24`: "db-migration **44**" → live **130** (`ls db/migrations/*.sql`). `:18-19`: "api-module 194 · shared-schema 61" → live **225+ file api-module (75 moduli × 3) · 78 schemi**.
  - Moduli LIVE assenti dalla sezione `### api-module` (l'indice si ferma alla topologia S939): `analytics`, `engagement`, `engagement-feedback`, `insights`, `mentorship`, `notifications`, `observability`, `predictions`, `reference-sync`, `semantic-matching`, `surveys`, `teams`, `mfa-policy`, `content`, `content-blueprint-links`, `organization-unit-processes` (verificato `test -d` su tutti → esistono on-disk, assenti dall'INDEX). L'indice elenca invece moduli ancora presenti ma con un sottoinsieme vecchio.
  - ADR: sezione `### ADR` lista fino a `0020` (+ skip 0019) → live **23 ADR** incl. `0021/0023/0024/0025` (verificato `ls docs/architecture/adr/`).
- Impatto: **DX** (chi usa l'INDEX come mappa-percorsi trova path inesistenti e non trova i 13+ moduli nuovi — anti-pattern per un "path index" SoT).
- Baseline: generato 1 volta a S939, mai rigenerato; il tool `build_index.py` esiste ma non è nel flusso `handoff` (a differenza dei counts SOT_STATE).
- Proposta: **QUICK-WIN** = rilanciare `python docs/kb/tools/build_index.py` (se il tool è ancora valido) → rigenera `INDEX_PATHS.md` + `index_paths.yaml`. **DOSSIER** (lega a I-8): decidere se l'INDEX va (a) cablato in `handoff` Step-X come i counts, (b) declassato a "snapshot datato, rigenerare on-demand" con header che lo dichiara, o (c) deprecato a favore di `glob` live (R8c: Grep/Glob battono un indice statico per localizzare). **Verify-gate**: post-rigenerazione, il count `db-migration` = `ls db/migrations/*.sql | wc -l` e ogni `apps/api/src/modules/*/` ha 3 entry nell'INDEX.

### F-WS-I-4 — `README.md` punta a `HANDOFF.md` + `NEXT_SESSION_MVP_2A.md` a repo-root, entrambi archiviati
- Severità: **MEDIUM** | Flag: **QUICK-WIN**
- Evidenza: `README.md:110-111` (blocco layout monorepo) lista `├── HANDOFF.md` e `├── NEXT_SESSION_MVP_2A.md` come file root. Verificato: **mancano a root** (`test -f` = MISSING ×2), entrambi in `docs/archive/` (`find` → `./docs/archive/{HANDOFF.md,NEXT_SESSION_MVP_2A.md}`). Coerente con CLAUDE.md `:9` che dichiara "`HANDOFF.md` … archived under `docs/archive/`" — quindi il README **contraddice CLAUDE.md** sulla posizione.
- Impatto: DX (riferimento rotto nella doc public-facing) — minore (sono nel blocco layout, non link cliccabili).
- Proposta: **QUICK-WIN** — nel blocco layout README sostituire le 2 righe con `.handoff/STATE.md` + nota "(HANDOFF.md, NEXT_SESSION_MVP_2A.md → docs/archive/)". Risolto insieme a I-1 (stesso file).

### F-WS-I-5 — 2 doc orfani a repo-root referenziati SOLO dall'INDEX stantio, non dai SoT vivi
- Severità: **LOW** | Flag: NOTE (verify-first)
- Evidenza: `ls *.md` a root → `CLAUDE.md`, `README.md`, `heuresys-advanced-bootstrap-vm.md`, `START_HERE.md`. Dei 4, **`heuresys-advanced-bootstrap-vm.md`** e **`START_HERE.md`** non sono referenziati da `CLAUDE.md`/`README.md`/`SOT_STATE.md`/`STATE.md` (grep = 0 hit) — solo da `INDEX_PATHS.md` (che è esso stesso stantio, I-3). Possono essere (a) ancora utili ma non indicizzati, (b) orfani residui di bootstrap.
- Impatto: footprint/DX (root-clutter; un nuovo lettore non sa se `START_HERE.md` è il vero entry-point o un residuo).
- Proposta: **NOTE verify-first** — leggere i 2 file e decidere: se vivi → linkarli da README/CLAUDE; se residui bootstrap → archiviare in `docs/archive/` (convention `_99_`/archive, CLASS-A solo dopo la lettura, R22 pre-condizione). Non azionare alla cieca.

---

## Gruppo B — DUPLICAZIONE & disjunction-rule (SoT discipline)

### F-WS-I-6 — ASSET: la disjunction-rule SoT v2 è rispettata — 0 duplicazione counts tra `.handoff/STATE.md` e `SOT_STATE.md`
- Severità: INFO | Flag: ASSET
- Evidenza: `.handoff/STATE.md:5` dichiara "Domini disgiunti — nessun numero qui" e lo **onora**: il grep dei numeri ≥2-cifre nel file ritorna solo ID-sessione (`S993`), nomi-QW (`QW-C3`, `B-30`), porte/anno nel blocco Verification (`5433`, `2026`, `15min`) — **0 conteggi di sistema** (moduli/endpoint/migration/test). Tutti i counts vivono in `SOT_STATE.md` (delta per-sessione S979→S993). Un solo updater (skill `handoff`) per entrambi → nessuna divergenza strutturale possibile (come da design `2026-06-05-sot-unification-design.md §11`).
- Proposta: **NESSUNA azione** — è l'asset di governance doc centrale; mantenerlo (ogni nuovo conteggio va SOLO in SOT_STATE).

### F-WS-I-7 — `improvement/` tree: FINDINGS/README index disallineato vs TODO_100X sullo stato di 4 WS
- Severità: **LOW** | Flag: **QUICK-WIN**
- Evidenza: `FINDINGS/README.md:9-12` marca **WS-H / WS-F / WS-C = TODO** e WS-G = done; ma `TODO_100X.md:14-17` marca **A1/A2/A3/A4 = DONE** (WS-G S987, WS-H S988, WS-F S990, WS-C S993) e i file `WS-H.md`/`WS-F.md`/`WS-C.md` **esistono** (letti in questo audit). Il register `FINDINGS/README.md` non è stato aggiornato dopo A2/A3/A4. (`BASELINE_METRICS.md` è invece correttamente dichiarato "snapshot orientativo pinnato a S-100X-0 HEAD `7e5b86d`" `:3` → i suoi counts vecchi (72 moduli/108 migration/901 it) NON sono drift, sono baseline-by-design — vedi I-9.)
- Impatto: DX (il register interno del programma 100X si contraddice con la todo).
- Proposta: **QUICK-WIN** — aggiornare la tabella `FINDINGS/README.md` (WS-H/F/C → done con sessione) + aggiungere la riga `WS-I.md` (questo audit). Risolvibile in-commit con la chiusura di A11.

### F-WS-I-8 — DOSSIER (policy): nessun doc a manutenzione-manuale è cablato a un check di non-drift (README/CLAUDE/INDEX restano fuori dalla skill `handoff`)
- Severità: **MEDIUM** | Flag: DOSSIER
- Evidenza: la skill `handoff` riscrive `SOT_STATE.md` + `STATE.md` (+ backlog/debt) ri-derivando i counts via psql/ls/git → questi 2 non driftano mai. Ma `README.md`, `CLAUDE.md`, `INDEX_PATHS.md` sono **manuali** e hanno accumulato il drift di I-1/I-2/I-3. D-01 (S958) fu un fix one-shot manuale → ri-driftato. Non esiste un guard (test/CI/hook) che fallisca quando un numero hardcoded in README/CLAUDE diverge dalla realtà.
- Impatto: robustezza-processo (il drift è strutturale, non incidentale: ricapita ogni N sessioni).
- Proposta: **DOSSIER, 3 opzioni** (decide Enzo):
  - **Conservativa**: smettere di hardcodare counts in README/CLAUDE → sostituire con "(running counts → SOT_STATE.md)" e tenere SOLO gli invarianti stabili (11 ruoli, gap migration, pattern). Costo ~0, elimina la classe di drift.
  - **Evolutiva**: uno shell-test (famiglia `scripts/test/run-shell-tests.sh`) o step CI `doc-drift-check.sh` che estrae i pochi numeri-chiave da README/CLAUDE e li confronta con `ls`/`grep`/psql → fallisce loud se divergono (come il già-esistente `i18n:check`).
  - **Radicale**: generare le sezioni "Headline numbers" di README + "What this is" di CLAUDE da un template alimentato da `SOT_STATE.md` nella skill `handoff` (un solo updater per tutti i doc-count). Costo medio, elimina del tutto la manutenzione manuale.
  - **Raccomandazione**: Conservativa subito (chiude I-1/I-2 in modo durevole) + valutare l'Evolutiva come guardrail. La Radicale è over-eng per un repo single-dev finché il drift non ricapita una 3ª volta.

### F-WS-I-9 — ASSET: `BASELINE_METRICS.md` correttamente auto-dichiarato snapshot pinnato (i suoi counts vecchi NON sono drift)
- Severità: INFO | Flag: ASSET
- Evidenza: `BASELINE_METRICS.md:1,3` ancora i numeri a "S-100X-0 (2026-06-13, HEAD `7e5b86d`)" + "Snapshot orientativo — ri-misurare a ogni sessione che ne dipende". Per design il file è la baseline contro cui misurare i delta di esecuzione → i suoi 72 moduli/108 migration/901 it sono **storicamente corretti** (lo erano a S-100X-0), non un errore. §"Drift osservati vs SoT" `:81-87` documenta esso stesso i drift noti (package.json desc, env var, drizzle dead-dep) → meta-onesto.
- Proposta: **NESSUNA azione** — è il pattern corretto per un doc-baseline (datato + auto-dichiarato). Da NON "aggiornare" ai valori live (perderebbe la sua funzione di baseline).

---

## Quick wins (QW-I*) — CLASS-A estraibili (doc-only, low/zero rischio)

- **QW-I1** — rewrite mirato di `README.md`: tabella "Headline numbers" + "Tech stack" + blocco layout ai valori live (75 moduli · 130 migration · 77 prefissi `/v1`/424 route-reg · 11/137/600 RBAC · 1007 test · Next 16/TS 6/Node 22 · 48 spec · 85 page) + fix personas reali RTL + fix riferimenti `HANDOFF.md`/`NEXT_SESSION_MVP_2A.md`→`docs/archive/` [F-WS-I-1, F-WS-I-4]. **Gate**: ogni numero ha un comando riproducibile che combacia (tabella in F-WS-I-1); link/path nel layout esistono on-disk.
- **QW-I2** — fix dei 4 punti drift in `CLAUDE.md` (60→75 ×2, 55/000056→130/000131 ×3, 586→600 ×3, riga `:9` endpoint/test/file) [F-WS-I-2]. **Gate**: `grep -nE "~60 business|55 (idempotent|numbered)|000056|586 role" CLAUDE.md` = 0 hit residui.
- **QW-I3** — rigenerare `INDEX_PATHS.md` + `index_paths.yaml` via `docs/kb/tools/build_index.py` (verify-first che il tool sia ancora valido) [F-WS-I-3]. **Gate**: count `db-migration` nell'INDEX = `ls db/migrations/*.sql | wc -l` (130); i 13+ moduli nuovi compaiono nella sezione api-module.
- **QW-I4** — aggiornare `FINDINGS/README.md` (WS-H/F/C → done + riga WS-I) [F-WS-I-7]. **Gate**: la tabella combacia con `TODO_100X.md:14-24`.

> Tutti i QW restano **doc-only in questa fase A** (read-only). Sono candidati per la fase E su go di Enzo, su branch, coi gate sopra.

---

## ASSET confermati (NON regredire senza dossier)

- **Disjunction-rule SoT v2 rispettata** (`STATE.md` 0 counts, `SOT_STATE.md` tutti i counts, un solo updater = skill `handoff`) → 0 duplicazione tra i 2 SoT vivi [F-WS-I-6].
- **`SOT_STATE.md` + `STATE.md` correnti e veri** (delta S993 allineato a live: 130 migration, 75 moduli, 600 map — tutti confermati dal cross-check di questo audit) — sono la SoT da citare, non README/CLAUDE.
- **`BASELINE_METRICS.md` auto-dichiarato snapshot pinnato** (counts vecchi by-design, drift meta-documentato) [F-WS-I-9].
- **Albero `improvement/` internamente coerente** (MASTER_PLAN ↔ AUDIT_PROTOCOL ↔ TODO_100X ↔ FINDINGS allineati, salvo il register-README I-7).

---

## Baseline Documentazione (misure reali — aggiorna `BASELINE_METRICS.md` §Drift)

| Claim doc | Doc dice | Valore reale live | Comando/Fonte |
|---|---|---|---|
| Moduli business | README **60** / CLAUDE.md **~60** | **75** | `ls -d apps/api/src/modules/*/ \| wc -l` = 75 |
| File migration | README/CLAUDE **55** (`000001..000056`) | **130** (`000001..000131`, gap 000035) | `ls db/migrations/*.sql \| wc -l` = 130 |
| Ledger migration | — | **130** | `SELECT count(*) FROM sys.sys_schema_migrations` |
| Prefissi `/v1` (app.ts) | README "272 business" | **77** prefissi · **424** route-reg | `grep -coE "prefix: ['\"]/v1" app.ts` = 77 |
| RBAC ruoli/perm/map | README **8/99/394** · CLAUDE.md **11/—/586** | **11 / 137 / 600** | `psql sys_auth_roles / role_permissions / permissions` |
| Test API | README **576** (60/60) · CLAUDE.md **576/~82 file** | **1007 pass/6 skip** (S992) · **146 file** | SOT_STATE S992 · `ls test/*.test.ts` = 146 |
| Web page.tsx | README **65** | **85** | `find apps/web/src/app -name page.tsx \| wc -l` = 85 |
| Playwright spec | README **21** | **48** | `ls apps/web/tests/e2e/*.spec.ts \| wc -l` = 48 |
| Shared schema | README **62** | **78** | `ls packages/shared/src/schemas/*.ts \| wc -l` = 78 |
| ADR | README **18** | **23** | `ls docs/architecture/adr/*.md \| wc -l` = 23 |
| Stack | README Next 15 / TS 5.7 / Node 20 / Zod 3.25 / PW 1.55 | **Next 16.2.7 / TS 6.0.3 / Node 22 / Zod 4.4.3 / PW 1.61** | `BASELINE_METRICS.md` §Stack |
| INDEX_PATHS totale | **1369** file (2026-05-27) | tracked **1791** (S-100X-0) · 13+ moduli mancanti | `git ls-files \| wc -l` · `ls modules/` |
| Root .md orfani | — | `START_HERE.md`, `heuresys-advanced-bootstrap-vm.md` non-ref dai SoT vivi | `grep` su CLAUDE/README/SOT_STATE/STATE |
| README→root refs | `HANDOFF.md` + `NEXT_SESSION_MVP_2A.md` a root | entrambi in `docs/archive/` | `test -f` (missing) + `find` |

**Insight chiave**: la documentazione **viva e handoff-governed è sana** (STATE/SOT_STATE corrente, disjunction-rule rispettata, 0 dup tra i 2 SoT, improvement-tree coerente). Il drift è **concentrato nei 3 doc a manutenzione-manuale fuori dal flusso `handoff`**: README (HIGH, public-facing, ~12 numeri stale), CLAUDE.md (HIGH, sempre-caricato, 4 sezioni stale incl. 586→600 RBAC), INDEX_PATHS (HIGH, stantio + 13 moduli mancanti). La leva di processo (I-8) è smettere di hardcodare i counts in questi doc o cablare un drift-check — D-01 dimostrò che un fix manuale one-shot ri-derива.

---

## Roll-up → candidati (decide Enzo per-finding; questo è un audit, non un fix)

**Dossier (richiedono decisione Enzo):**
- D — **policy anti-drift doc** (Conservativa: de-hardcodare counts in README/CLAUDE · Evolutiva: shell-test/CI drift-check · Radicale: generare le sezioni-count dalla skill `handoff`) [F-WS-I-8].
- D — **destino `INDEX_PATHS.md`** (cablare a `handoff` vs declassare a snapshot-datato vs deprecare pro-`glob`) [F-WS-I-3].

**Quick-wins CLASS-A** (eseguibili su go, gate espliciti sopra): QW-I1 rewrite README · QW-I2 fix 4 punti CLAUDE.md · QW-I3 rigenera INDEX_PATHS · QW-I4 fix FINDINGS/README register.

**Note (verifica, non fix):** 2 root .md orfani (`START_HERE.md`, `heuresys-advanced-bootstrap-vm.md`) → leggere e decidere keep/archive [F-WS-I-5].

**Asset da NON regredire**: disjunction-rule SoT v2 · SOT_STATE/STATE correnti · BASELINE_METRICS snapshot-by-design · improvement-tree coerente.

---

*Audit S-100X-A11 — read-only, lettura SoT + cross-check live (codice via ls/grep/find, RBAC+ledger via tunnel :5433). Nessuna modifica a doc/codice/config, zero scritture DB. I finding qui confluiscono nel registro dossier 100X — decisione per-finding di Enzo. Cross-ref: D-01 (drift fix S958 → ri-derivato, motiva I-8) · `2026-06-05-sot-unification-design.md §11-12` (disjunction-rule, confermata asset I-6) · WS-G/F/C (i loro FINDINGS esistono ma il register `FINDINGS/README.md` non lo riflette → I-7).*
