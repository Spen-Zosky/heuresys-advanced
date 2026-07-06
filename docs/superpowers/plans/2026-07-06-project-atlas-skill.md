# project-atlas Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Costruire la skill `project-atlas` (dispatcher a 4 modi: status/refresh/query/dossier) in `.claude/skills/project-atlas/` secondo lo spec approvato `docs/superpowers/specs/2026-07-06-project-atlas-skill-design.md`.

**Architecture:** SKILL.md snello che instrada su 4 modi e delega il dettaglio a 8 reference files (progressive disclosure). I target del sweep sono derivati a RUNTIME da un planner (mai hardcoded); il full-sweep è dietro doppio gate; l'atlas resta "derived view, not SoT"; self-learning = run-record YAML + override adattivi reversibili in `atlas.config.yaml`.

**Tech Stack:** Markdown (skill + references), YAML (config), tool esistenti riusati: `docs/kb/tools/build_atlas.py`, `handoff_lint.py`, skill `graphify`, Workflow tool per subagenti.

## Global Constraints

- MAI path assoluti nei file versionati (memoria `feedback_no_absolute_paths`): tutti i path relativi alla repo root; l'unico riferimento macchina-specifico ammesso è nel manifest `atlas.config.yaml` sezione `external:` marcata `per-machine`.
- Atlas = **derived view, not SoT**: i conteggi puntano a `docs/kb/SOT_STATE.md`, mai duplicati come autoritativi (anti D-01).
- Single-writer: il modo dossier PREPARA blocchi Action register e li valida con `python docs/kb/tools/handoff_lint.py`; la governance commit/close resta al flusso handoff.
- OUTPUT RULE S1011: mai qualificatori "no-PII/synthetic/safe-to-publish" in alcun testo generato.
- Ogni richiesta di conferma costo in forma R20: "~N agenti / ~X token stimati, regression risk Y, procedo?".
- Encoding: UTF-8 senza BOM, newline LF.
- Testo user-facing in italiano; termini tecnici/codice in inglese (regola globale Enzo).
- Commit atomici per task, prefisso `feat(skills): project-atlas — ...`; NO push (autorizzazione push è per-sessione).

## File Structure

```
.claude/skills/project-atlas/
├── SKILL.md                       (Task 9 — dispatcher, scritto per ultimo)
└── references/
    ├── atlas.config.yaml          (Task 1 — manifest + adaptive)
    ├── planner.md                 (Task 2 — derivazione runtime + coverage check)
    ├── sweep-prompts.md           (Task 3 — 6 template per famiglia)
    ├── model-map.md               (Task 4 — modello×effort per agente)
    ├── curated-template.md        (Task 5 — struttura/merge ATLAS_CURATED)
    ├── dossier-template.md        (Task 6 — formato dossier + blocchi register)
    ├── goal-recipes.md            (Task 7 — condizioni /goal misurabili)
    └── LEARNINGS.md               (Task 8 — lezioni seed S1016 + schema run-record)
```

Task 10 = test di accettazione §8 dello spec + commit finale.

---

### Task 1: Manifest `atlas.config.yaml`

**Files:**
- Create: `.claude/skills/project-atlas/references/atlas.config.yaml`

**Interfaces:**
- Produces: chiavi `sot_reads`, `layers.<name>.{globs,derive,staleness_probe}`, `families_static`, `thresholds`, `adaptive` — consumate da planner.md (Task 2) e SKILL.md (Task 9).

- [ ] **Step 1: Verifica che il file non esista** — Run: `ls .claude/skills/project-atlas/references/atlas.config.yaml` → Expected: `No such file or directory`.

- [ ] **Step 2: Scrivi il file con questo contenuto esatto**

```yaml
# atlas.config.yaml — manifest della skill project-atlas (heuresys-advanced)
# DEFAULT = verita' di progetto, modificabili solo a mano.
# `adaptive:` = override auto-appresi dal self-learning (reversibili: azzera la sezione per tornare ai default).
# Path SEMPRE relativi alla repo root; nessun path assoluto (feedback_no_absolute_paths).

project: heuresys-advanced

# F0 — letture di contesto a inizio sessione di analisi (il contenuto vive la', non qui)
sot_reads:
  - .handoff/STATE.md
  - docs/kb/SOT_STATE.md            # a sezioni: §0 + delta recenti + sezioni 1-10
  - docs/kb/SOT_BACKLOG.md          # solo Action register
  - docs/kb/DEBT_REGISTER.md        # solo item non-RISOLTO
  - docs/product/README.md
  - docs/product/FUNCTIONAL_CAPABILITY_LEDGER.md
  - docs/kb/atlas/ATLAS_CURATED.md

# Layer del sweep con target DERIVABILI a runtime (il planner esegue `derive`, mai liste hardcoded)
layers:
  api:
    globs: ["apps/api/src/modules/**", "apps/api/src/lib/**", "packages/shared/src/schemas/**"]
    derive: "ls apps/api/src/modules"
    staleness_probe: "git log --oneline --since=<curated_date> -- apps/api/src packages/shared/src | wc -l"
  web:
    globs: ["apps/web/src/**"]
    derive: "ls 'apps/web/src/app' && find apps/web/src/app -name page.tsx | wc -l"
    staleness_probe: "git log --oneline --since=<curated_date> -- apps/web/src | wc -l"
  db:
    globs: ["db/migrations/**", "db/seeds/**"]
    derive: "psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc \"SELECT count(*) FROM pg_stat_user_tables\""
    staleness_probe: "ls db/migrations/*.sql | wc -l   # confronta col count nell'ultimo run-record"
  ops:
    globs: ["scripts/**", ".github/workflows/**", "deploy/**", "db/scripts/**"]
    derive: "ls scripts .github/workflows db/scripts"
    staleness_probe: "git log --oneline --since=<curated_date> -- scripts .github deploy db/scripts | wc -l"

# Famiglie NON derivabili: lista corta esplicita + probe di esistenza PRIMA del lancio (skip+warn se assente)
families_static:
  legacy_primary:
    probe: "MSYS_NO_PATHCONV=1 ssh oracle-vm-default 'test -d /home/ubuntu/heuresys-evo && echo OK'"
    note: "DB dati = PG nativo heuresys_platform su VM (ADR-0023); stats legacy azzerate -> usare reltuples/count"
  legacy_cantiere:
    probe: "MSYS_NO_PATHCONV=1 ssh oracle-vm-default 'test -d /home/ubuntu/heuresys.com.evo && echo OK'"
    note: "vivaio idee, NON in produzione"
  wiki:
    probe: "test -d \"$HOME/wiki-space/heuresys-advanced-wiki\" && echo OK"
    note: "per-machine (Windows SoT); trattare come fonte storica se stale"
  design_system:
    probe: "test -d /d/ux-design-shared && echo OK"
    note: "per-machine; sorgente di @heuresys/ui"

thresholds:
  curated_stale_warn_days: 14      # modo dossier: warning oltre questa eta' del curated
  curated_stale_block_days: 45     # modo dossier: rifiuto (serve refresh) oltre questa eta'
  chunk_modules_per_agent: 10      # dimensione chunk API di default (adattiva)
  full_sweep_token_estimate: "~2.5M token / ~19 agenti (osservato S1016)"

# Override auto-appresi (self-learning §6 dello spec). AZZERARE per tornare ai default.
adaptive: {}
```

- [ ] **Step 3: Verifica parse YAML** — Run: `python -c "import yaml,io; d=yaml.safe_load(io.open('.claude/skills/project-atlas/references/atlas.config.yaml',encoding='utf-8')); print(sorted(d.keys()))"` → Expected: `['adaptive', 'families_static', 'layers', 'project', 'sot_reads', 'thresholds']`. (Se PyYAML assente: `python -m pip install pyyaml` una tantum.)

- [ ] **Step 4: Commit** — `git add .claude/skills/project-atlas/references/atlas.config.yaml && git commit -m "feat(skills): project-atlas — manifest atlas.config.yaml"`

---

### Task 2: `planner.md` (derivazione runtime + coverage check fail-loud)

**Files:**
- Create: `.claude/skills/project-atlas/references/planner.md`

**Interfaces:**
- Consumes: chiavi `layers.*.derive`, `thresholds.chunk_modules_per_agent`, `families_static.*.probe` da atlas.config.yaml (Task 1).
- Produces: procedura "PIANO SWEEP" (lista target + chunk) e procedura "COVERAGE CHECK" — consumate da SKILL.md modo refresh (Task 9) e citate da sweep-prompts.md (Task 3).

- [ ] **Step 1: Scrivi il file con questo contenuto esatto**

````markdown
# planner.md — derivazione runtime dei target del sweep (anti-drift)

> I target NON vivono in questa skill. A ogni run si derivano dal repo/DB vivi.
> Un target non derivato = un buco silenzioso nell'atlas: per questo il COVERAGE CHECK e' bloccante.

## 1. PIANO SWEEP (procedura)

Per ogni layer in `atlas.config.yaml → layers` (piu' le `families_static` col probe OK):

1. Esegui il comando `derive` del layer. Esempi attesi (2026-07):
   - api → lista directory moduli (83 a S1016; il numero VERO e' l'output di oggi)
   - web → route groups + count page.tsx
   - db → count tabelle utente live
2. Partiziona i target "code-like" in chunk:
   - `chunk_size = adaptive.chunk_modules_per_agent ?? thresholds.chunk_modules_per_agent`
   - N agenti = ceil(len(targets) / chunk_size)
3. Per ogni chunk/famiglia istanzia il template corrispondente da `sweep-prompts.md`
   riempiendo i segnaposto `{{TARGETS}}`, `{{FRAGMENT_PATH}}`, `{{REPO}}`.
4. Frammenti attesi: uno per chunk/famiglia, nello scratchpad di sessione
   (`<scratchpad>/atlas_fragments/<label>.yaml`). Registra la LISTA ATTESA prima di lanciare.

## 2. Lancio (sempre via Workflow tool)

- Un solo `parallel()` di tutti i chunk (sono indipendenti); schema di ritorno compatto
  `{fragment_file, counts, notables, summary}` — il dettaglio sta nei frammenti su file.
- Modello/effort per agente: da `model-map.md`. MAI Agent sciolti per il sweep.

## 3. COVERAGE CHECK (bloccante, fail-loud)

Dopo il run:

```bash
# lista attesa (dal piano) vs frammenti prodotti
ls <scratchpad>/atlas_fragments/*.yaml
```

- Ogni frammento atteso e assente ⇒ **ERRORE dichiarato** (mai "atlas fresco ma bucato").
- Retry MIRATO: rilancia solo gli agenti dei frammenti mancanti (1 retry; poi riporta il buco a Enzo).
- Verifica interna per layer api/web: somma dei moduli/pagine nei frammenti == count derivato al punto 1.
  Mismatch ⇒ stesso trattamento.

## 4. A valle del sweep (SEMPRE accoppiati)

```bash
python docs/kb/tools/build_atlas.py          # atlas deterministico (2 run: il 2o prova l'idempotenza)
# poi vista parallela:
#   invoca la skill graphify con `--update` sulla repo root
python docs/kb/tools/handoff_lint.py         # exit 0
```

## 5. Delta vs full

- **Delta (default)**: solo i layer con `staleness_probe` > 0 dal timestamp dell'ultimo run-record
  (LEARNINGS.md) o dalla data in testa ad ATLAS_CURATED.md.
- **Full**: SOLO su richiesta esplicita + conferma R20 + /goal (vedi goal-recipes.md).
````

- [ ] **Step 2: Verifica struttura** — Run: `grep -c "^## " .claude/skills/project-atlas/references/planner.md` → Expected: `5`.

- [ ] **Step 3: Commit** — `git add .claude/skills/project-atlas/references/planner.md && git commit -m "feat(skills): project-atlas — planner runtime + coverage check"`

---

### Task 3: `sweep-prompts.md` (6 template per famiglia)

**Files:**
- Create: `.claude/skills/project-atlas/references/sweep-prompts.md`
- Fonte di verita' per i contenuti: `docs/kb/tools/atlas-sweep-templates/atlas-full-sweep.workflow.js` (prompt S1016 osservati funzionare 19/19)

**Interfaces:**
- Consumes: segnaposto riempiti dal planner (Task 2): `{{TARGETS}}`, `{{FRAGMENT_PATH}}`, `{{REPO}}`, `{{CURATED_DATE}}`.
- Produces: blocco `REGOLE COMUNI` + template `TEMPLATE: code-chunk|db-live|ops|legacy|wiki|design-system` — consumati dal modo refresh (Task 9).

- [ ] **Step 1: Scrivi il file.** Contenuto = adattamento 1:1 dei prompt del workflow S1016 salvato, con queste trasformazioni obbligatorie (il testo integrale dei 6 template va copiato dal file sorgente `atlas-full-sweep.workflow.js`, funzioni `apiPrompt`/`webPrompt` e i 7 SPECS trasversali, raggruppando: api+web+shared → **code-chunk**; db:live → **db-live**; ops → **ops**; legacy:primary+legacy:cantiere → **legacy** con parametro `{{LEGACY_TARGET}}`; wiki → **wiki**; ui:design-shared → **design-system**):

````markdown
# sweep-prompts.md — template per famiglia (istanziati dal planner, MAI hardcoded)

## REGOLE COMUNI (prefisso di OGNI prompt agente)

- Lavori in {{REPO}} (Windows). SOLO lettura sul repo; unica scrittura = il tuo frammento {{FRAGMENT_PATH}}.
- MAI leggere .env, .secrets/, *.pem. MAI loggare credenziali.
- Frammento = YAML compatto, dati strutturati, zero prosa ridondante.
- "notables" nel return: gap/anomalie/opportunita' CON evidenza (file:line o query). Niente evidenza = non scriverlo.
- Return via StructuredOutput: {fragment_file, counts, notables (max 14), summary (3-6 frasi)}.

## TEMPLATE: code-chunk        (istanze: api / web / shared — parametro {{ASPETTO}})
[... testo integrale dall'S1016 workflow: sezioni "TASK: inventario cross-layer dei seguenti N moduli"
 per api; "TASK: inventario frontend Next.js" per web; "TASK: inventario schemas" per shared;
 con {{TARGETS}} al posto delle liste esplicite ...]

## TEMPLATE: db-live
[... testo integrale dello SPECS 'db:live' S1016, con nota: usare batch UNION ALL per i count esatti ...]

## TEMPLATE: ops
[... testo integrale dello SPECS 'ops:scripts+ci' S1016 ...]

## TEMPLATE: legacy            (parametro {{LEGACY_TARGET}}: primary | cantiere)
[... testo integrale degli SPECS 'legacy:primary' e 'legacy:cantiere' S1016, unificati con branch sul parametro;
 nota fissa: MSYS_NO_PATHCONV=1 su ogni ssh; stats legacy azzerate -> reltuples/count ...]

## TEMPLATE: wiki
[... testo integrale dello SPECS 'wiki:space' S1016; nota: trattare come fonte storica se pre-GA ...]

## TEMPLATE: design-system
[... testo integrale dello SPECS 'ui:design-shared' S1016 ...]
````

  NB per l'esecutore: i blocchi `[...]` sopra NON sono placeholder da lasciare — vanno sostituiti col testo reale copiato da `docs/kb/tools/atlas-sweep-templates/atlas-full-sweep.workflow.js` (righe: funzione `apiPrompt` ≈ 40-75, `webPrompt` ≈ 95-125, SPECS push ≈ 130-260), spersonalizzando SOLO liste di target e path di sessione nei segnaposto `{{...}}`.

- [ ] **Step 2: Verifica: 6 template + regole comuni presenti, zero liste hardcoded di moduli** — Run: `grep -c "^## TEMPLATE:" .claude/skills/project-atlas/references/sweep-prompts.md` → Expected: `6`. Run: `grep -c "activity-classification-mappings" .claude/skills/project-atlas/references/sweep-prompts.md` → Expected: `0` (nessun nome-modulo hardcoded).

- [ ] **Step 3: Commit** — `git add .claude/skills/project-atlas/references/sweep-prompts.md && git commit -m "feat(skills): project-atlas — sweep prompts per famiglia (da S1016, parametrizzati)"`

---

### Task 4: `model-map.md`

**Files:**
- Create: `.claude/skills/project-atlas/references/model-map.md`

**Interfaces:**
- Produces: matrice consultata dal modo refresh quando costruisce le chiamate `agent(..., {model, effort})` (Task 9); regole di promozione consumate dal protocollo self-learning (Task 8/9).

- [ ] **Step 1: Scrivi il file con questo contenuto esatto**

```markdown
# model-map.md — selezione modello×effort per agente (token-optimized, qualita' garantita)

| Attivita' | model | effort | Razionale |
|---|---|---|---|
| Inventari meccanici (ops, liste, mtime, probe) | haiku | low | estrazione senza giudizio |
| Sweep semantico code-chunk (api/web/shared) | sonnet | low | file:line affidabile al minor costo |
| db-live + legacy (SQL/SSH, precisione) | sonnet | medium | query esatte, zero allucinazioni |
| Sintesi curated + verify adversariale | (omesso = modello di sessione) | high | il giudizio non si delega in giu' |
| Modi query e dossier | main loop, ZERO subagenti | — | l'atlas esiste apposta |

Regole:
1. Fallback: in dubbio OMETTI `model` (eredita la sessione). MAI downgrade su task di giudizio.
2. Promozione adattiva (self-learning): se il coverage check scarta frammenti di una famiglia
   per 2 run consecutivi → promuovi quella famiglia di un gradino (haiku→sonnet, sonnet→sessione),
   registra il perche' nel run-record e l'override in `atlas.config.yaml → adaptive.model_overrides`.
3. Demozione: consentita SOLO manualmente (mai automatica).
```

- [ ] **Step 2: Verifica** — Run: `grep -c "haiku\|sonnet" .claude/skills/project-atlas/references/model-map.md` → Expected: ≥4.

- [ ] **Step 3: Commit** — `git add .claude/skills/project-atlas/references/model-map.md && git commit -m "feat(skills): project-atlas — model map"`

---

### Task 5: `curated-template.md`

**Files:**
- Create: `.claude/skills/project-atlas/references/curated-template.md`
- Fonte struttura: `docs/kb/atlas/ATLAS_CURATED.md` (S1016, 12 sezioni)

**Interfaces:**
- Produces: struttura sezioni + regole di merge/staleness — consumate dal modo refresh quando aggiorna ATLAS_CURATED (Task 9).

- [ ] **Step 1: Scrivi il file con questo contenuto esatto**

```markdown
# curated-template.md — ATLAS_CURATED: struttura e regole di aggiornamento

## Struttura canonica (12 sezioni — vedi l'istanza live docs/kb/atlas/ATLAS_CURATED.md)
1 Colpo d'occhio (SOLO rimandi ai conteggi ri-derivabili) · 2 Mappa d'oro tabelle vuote ·
3 Capacita' dormienti nel codice · 4 Gap/opportunita' API · 5 Web/UX pattern e gap ·
6 Design system inutilizzato · 7 DB health · 8 Legacy (residuo + cantiere) ·
9 Wiki e grafi (viste parallele) · 10 Incoerenze minori (debt candidates) ·
11 Drift documentali rilevati · 12 Semi tematici per linee di sviluppo.

## Regole di aggiornamento (refresh)
- Il curated NON si rigenera da zero: si fa MERGE per sezione dei notables nuovi (con evidenza)
  sopra l'esistente; i rilievi superati si BARRANO con data e motivo (mai cancellati silenziosamente).
- Header obbligatorio: data ultimo sweep + quali layer erano nel delta (i layer NON ri-sweepati
  restano marcati con la loro data precedente — onesta' della freschezza per sezione).
- I numeri sono EVIDENZA DATATA, mai SoT: per i conteggi correnti rimanda a SOT_STATE / build_atlas.
- OUTPUT RULE S1011 vincolante su ogni testo.
- Chiusura file: nota "Aggiornare SOLO con un nuovo sweep verificato o correzioni puntuali datate."
```

- [ ] **Step 2: Verifica** — Run: `grep -c "MERGE per sezione" .claude/skills/project-atlas/references/curated-template.md` → Expected: `1`.

- [ ] **Step 3: Commit** — `git add .claude/skills/project-atlas/references/curated-template.md && git commit -m "feat(skills): project-atlas — curated template"`

---

### Task 6: `dossier-template.md`

**Files:**
- Create: `.claude/skills/project-atlas/references/dossier-template.md`
- Fonti struttura: `docs/product/DEVELOPMENT_LINES_A_EXPOSE_DORMANT_DATA.md` (formato linee) + blocchi register in `docs/kb/SOT_BACKLOG.md` §Action register.

**Interfaces:**
- Produces: template dossier + formato blocco register + procedura conversione — consumati dal modo dossier (Task 9).

- [ ] **Step 1: Scrivi il file con questo contenuto esatto**

````markdown
# dossier-template.md — linee di sviluppo: dal brainstorming al register

## Pre-check (bloccante)
- Eta' ATLAS_CURATED vs `thresholds.curated_stale_{warn,block}_days`:
  warn ⇒ dichiarare la data all'inizio del dossier; block ⇒ STOP, proporre refresh prima.

## Struttura dossier `docs/product/DEVELOPMENT_LINES_<SERIE>_<TEMA>.md`
- Header: Stato PROPOSTO (selezione = Enzo, PM owns WHAT) · Provenienza (atlas+sweep, data) ·
  regola T2 (numeri = evidenza datata, non SoT) · Perimetro esplicito.
- §1 Tesi (il perche', con i numeri chiave datati).
- §2 Le linee — per OGNI linea: **Dati** (righe live + data) · **Costruire** (cosa, riuso pattern/componenti) ·
  **Vincoli** (data-class/orgGate ADR-0027, DoD ADR-0026) · **Effort** (in sessioni/ore, forma R20:
  derivato da repliche osservate, mai a impressione) · **Valore**.
- §2-bis Webapp impattate: tabella linea → pagine esistenti → pagine/tab NUOVE (dall'atlas `web`).
- §3 Vincoli trasversali (riferimenti, mai ricopiati).
- §4 Sequenza raccomandata COMPONIBILE (mai aut-aut — feedback_no_forced_exclusive_choice).
- §5 Correzioni SoT emerse scrivendo il dossier.
- §6 Prossimo passo (selezione Enzo → register).

## Conversione in Action register (dopo selezione di Enzo)
Formato blocco (canonico, verificato da handoff_lint S2/H1):

```
- **#<id> <serie>/<linea> — <titolo>** · status: ACTIVE|GATED
  - priority: P1|P2|P3 · effort: ~Xh · doc: docs/product/DEVELOPMENT_LINES_<...>.md §<linea>
  - note: <sintesi con evidenza>
  [se GATED] - blocker: <dipendenza reale> / - unblock-trigger: {kind: manual|query|file-exists} — <condizione>
```

Procedura: (1) id = max esistente + 1; (2) inserire nella sezione `🗂 Action register` di
`docs/kb/SOT_BACKLOG.md`; (3) `python docs/kb/tools/handoff_lint.py` DEVE uscire 0;
(4) `python docs/kb/tools/build_menu.py` per mostrare il menu risultante a Enzo.
Governance: la skill prepara e valida; commit secondo le regole correnti del repo
(atomici pre-autorizzati; push MAI senza ok esplicito). handoff resta l'unico riscrittore di STATE/SOT.
````

- [ ] **Step 2: Verifica** — Run: `grep -c "handoff_lint" .claude/skills/project-atlas/references/dossier-template.md` → Expected: `2`.

- [ ] **Step 3: Commit** — `git add .claude/skills/project-atlas/references/dossier-template.md && git commit -m "feat(skills): project-atlas — dossier template + conversione register"`

---

### Task 7: `goal-recipes.md`

**Files:**
- Create: `.claude/skills/project-atlas/references/goal-recipes.md`

**Interfaces:**
- Produces: righe `/goal` pronte — proposte dai modi refresh/dossier (Task 9).

- [ ] **Step 1: Scrivi il file con questo contenuto esatto**

```markdown
# goal-recipes.md — condizioni /goal misurabili (Claude Code ≥2.1.139)

Dottrina: la condizione deve essere verificabile SENZA interpretazione (un valutatore esterno
legge il transcript e decide si'/no). Comandi con exit code o output esatto.

## refresh --full
/goal Il full-sweep atlas e' completo: `python docs/kb/tools/build_atlas.py` esce 0 due volte
consecutive con `git diff --stat docs/kb/atlas` vuoto al secondo run; il coverage check del
planner riporta 0 frammenti mancanti; `python docs/kb/tools/handoff_lint.py` esce 0.

## refresh (delta)
/goal I layer stale <elenco> sono ri-sweepati: i frammenti attesi esistono tutti; build_atlas
rigenerato esce 0; ATLAS_CURATED.md ha header aggiornato con data odierna per quei layer;
handoff_lint esce 0.

## dossier
/goal Il file docs/product/DEVELOPMENT_LINES_<X>.md esiste; ogni linea contiene le sottosezioni
Dati/Costruire/Vincoli/Effort; la tabella webapp e' presente; `python docs/kb/tools/handoff_lint.py` esce 0.

Uso: la skill PROPONE la riga pronta (il comando /goal lo attiva l'utente); in esecuzione
autonoma la stessa condizione e' il contratto di uscita interno del modo.
```

- [ ] **Step 2: Verifica** — Run: `grep -c "^/goal\|^## " .claude/skills/project-atlas/references/goal-recipes.md` → Expected: ≥6.

- [ ] **Step 3: Commit** — `git add .claude/skills/project-atlas/references/goal-recipes.md && git commit -m "feat(skills): project-atlas — goal recipes"`

---

### Task 8: `LEARNINGS.md` (bootstrap con lezioni S1016 + schema run-record)

**Files:**
- Create: `.claude/skills/project-atlas/references/LEARNINGS.md`

**Interfaces:**
- Produces: sezione `## Lezioni` (prosa) + `## Run-records` (YAML append-only, schema definito qui) — letta a inizio refresh/dossier, appesa a fine (protocollo in SKILL.md Task 9).

- [ ] **Step 1: Scrivi il file con questo contenuto esatto**

````markdown
# LEARNINGS.md — auto-aggiornato dalla skill (lezioni + metriche adattive)

> Protocollo: a fine di ogni invocazione refresh/dossier la skill APPENDE un run-record e,
> se emerge una lezione generalizzabile, la aggiunge in prosa qui sopra. Gli adattamenti di
> parametri vanno in `atlas.config.yaml → adaptive` (reversibili), MAI nei template.

## Lezioni (seed S1016)

- Full-sweep 19 agenti ≈ 2,5M token: SEMPRE dietro conferma R20; lo spend-limit può interrompere
  a metà → salvare i frammenti completati + pending-file + item GATED nel register.
- `ls` non mostra i dotfile: usare `ls -a` quando si contano artefatti `.something`.
- psql sul tunnel :5433 può droppare sotto carico (SSL SYSCALL EOF): batch UNION ALL + 1 retry.
- SSH da Git Bash: SEMPRE `MSYS_NO_PATHCONV=1`; sul legacy le pg_stat sono azzerate (usare reltuples).
- Console Windows cp1252: i tool python del repo richiedono `sys.stdout.reconfigure(encoding="utf-8")`;
  per one-liner usare `PYTHONIOENCODING=utf-8`.
- Rate-limit login API 10/5min: i run E2E ripetuti lo esauriscono — attendere la finestra, non ritentare.
- Workflow args possono arrivare come stringa: fare sempre `typeof args === 'string' ? JSON.parse(args) : args`.

## Run-records (append-only)

Schema di ogni record:

```yaml
- date: YYYY-MM-DD
  mode: refresh-delta | refresh-full | dossier
  layers: [api, web]            # o famiglie
  agents: 0                     # lanciati
  est_tokens: 0                 # stima
  coverage: ok | retried:<n> | holes:<lista>
  duration_min: 0
  errors: []                    # gotcha incontrati
  adaptations: []               # override scritti in adaptive: (con perche')
```

<!-- I record vengono appesi sotto questa riga -->
````

- [ ] **Step 2: Verifica** — Run: `grep -c "append-only\|Run-records" .claude/skills/project-atlas/references/LEARNINGS.md` → Expected: ≥2.

- [ ] **Step 3: Commit** — `git add .claude/skills/project-atlas/references/LEARNINGS.md && git commit -m "feat(skills): project-atlas — learnings bootstrap (lezioni S1016 + schema run-record)"`

---

### Task 9: `SKILL.md` (dispatcher — per ultimo, referenzia tutto)

**Files:**
- Create: `.claude/skills/project-atlas/SKILL.md`

**Interfaces:**
- Consumes: TUTTI i reference dei Task 1-8 (per path relativo alla skill).
- Produces: la skill invocabile `/project-atlas` con 4 modi.

- [ ] **Step 1: Scrivi il file con questo contenuto esatto**

````markdown
---
name: project-atlas
description: >-
  Conoscenza operativa cross-layer di heuresys-advanced e linee di sviluppo prodotto.
  USA QUESTA SKILL quando Enzo dice: "atlas", "aggiorna/refresh la conoscenza", "mappa operativa
  del progetto", "collaudo atlas", "cosa abbiamo/cosa manca per <capacita'>", "dossier",
  "linee di sviluppo", "brainstorming di prodotto heuresys", o cita docs/kb/atlas/ oppure
  DEVELOPMENT_LINES_*. Quattro modi: status (default), refresh (delta; --full gated),
  query (Q&A evidence-based atlas-first), dossier (linee di sviluppo → blocchi Action register).
  Il modo dossier E' la variante evidence-based project-scoped che soddisfa
  superpowers:brainstorming per il prodotto heuresys. NON usare per: bug-hunting/audit forense
  (usa full-forensic-audit), QA E2E o piani release (forensic-100x-kickoff / web-qa-audit),
  due diligence investor (saas-investor-due-diligence), chiusura sessione o riscrittura SoT
  (handoff), pura topologia/BFS del grafo (graphify). L'atlas e' una DERIVED VIEW, non SoT:
  i conteggi autoritativi vivono in docs/kb/SOT_STATE.md.
---

# project-atlas — conoscenza operativa + linee di sviluppo (heuresys-advanced)

Nata dalla sessione S1016. Contratto: ogni affermazione con EVIDENZA (file:line, query, riga atlas);
mai a memoria. Vincoli ereditati per riferimento: R20 (effort quantificati) · DoD ADR-0026 ·
OUTPUT RULE S1011 · no path assoluti nei file versionati · single-writer register (handoff governa
lo stato) · OGNI richiesta di costo in forma R20.

## Dispatcher (routing deterministico)

| Invocazione/trigger | Modo |
|---|---|
| `/project-atlas` nudo | **status** |
| "aggiorna/refresh l'atlas/la conoscenza" | **refresh** (delta) |
| refresh con richiesta esplicita di completezza ("full", "tutto da zero") | **refresh --full** (gated) |
| domanda evidence-based sul sistema; "collaudo" | **query** |
| "dossier", "linee di sviluppo", brainstorming prodotto | **dossier** |

Leggi `references/atlas.config.yaml` (manifest) e `references/LEARNINGS.md` (lezioni+ultimo
run-record) PRIMA di qualsiasi modo diverso da query.

## Modo: status (costo ~zero)
1. Per ogni layer del manifest: esegui `staleness_probe` (sostituendo `<curated_date>` con la data
   in testa a `docs/kb/atlas/ATLAS_CURATED.md`); per le famiglie statiche esegui `probe`.
2. Se il tunnel/host non risponde: marca `[non verificato: <layer>]` — MAI numeri stale come freschi.
3. Presenta: tabella layer→stato (fresco/stale/non-verificato) + data curated + menu dei 4 modi.

## Modo: refresh
1. Staleness come in status → lista layer stale. Se vuota: dichiara "atlas fresco" e fermati.
2. **Delta (default)**: segui `references/planner.md` §1-§3 sui SOLI layer stale;
   agenti via Workflow con modello/effort da `references/model-map.md`;
   prompt istanziati da `references/sweep-prompts.md`.
3. **--full**: PRIMA chiedi conferma in forma R20 citando `thresholds.full_sweep_token_estimate`
   e proponi la riga `/goal` da `references/goal-recipes.md`. Solo dopo l'ok procedi come sopra
   su TUTTI i layer.
4. A valle SEMPRE (planner §4): `build_atlas.py` ×2 (idempotenza) → skill `graphify --update` →
   merge curated per sezione secondo `references/curated-template.md` → `handoff_lint.py` exit 0.
5. Chiudi col protocollo self-learning (sotto).

## Modo: query (zero subagenti)
1. Ordine di lookup: `docs/kb/atlas/atlas.yaml` (grep mirato) → `ATLAS_CURATED.md` →
   SOLO per verificare l'evidenza citata: Grep sul codice / psql puntuale.
2. Risposta con evidenza esplicita in ≤2 tool call. Se l'atlas non basta: dillo, proponi refresh
   del layer — non esplorare liberamente il repo ignorando l'atlas.

## Modo: dossier (zero subagenti; e' il brainstorming di prodotto)
1. Pre-check staleness curated vs soglie del manifest (warn/block) — block ⇒ STOP e proponi refresh.
2. Conduci il brainstorming con Enzo (una domanda alla volta; opzioni componibili, mai aut-aut).
3. Scrivi il dossier secondo `references/dossier-template.md`; proponi la riga `/goal` relativa.
4. Su selezione di Enzo: blocchi register secondo il template, `handoff_lint.py` exit 0,
   `build_menu.py` per mostrare il menu. Commit secondo le regole correnti; MAI push senza ok.

## Protocollo self-learning (fine refresh/dossier)
1. APPENDI il run-record a `references/LEARNINGS.md` (schema nel file).
2. Se un pattern si e' ripetuto ≥2 volte: aggiungi la Lezione in prosa.
3. Adattamenti parametri (chunk size, promozione modello per famiglia — regole in model-map.md §2):
   scrivili in `atlas.config.yaml → adaptive` col perche' nel run-record. MAI toccare i template
   (quelli cambiano solo per mano umana o proposta esplicita a Enzo, R15).

## Degradazione ed errori
- Tunnel/host giu' → `[non verificato: X]` e si prosegue sul resto.
- Spend-limit a meta' sweep → salva frammenti fatti + scrivi pending-file + item GATED nel register.
- Frammento mancante → coverage check fail-loud (planner §3), 1 retry mirato, poi riporta.
- Known issues gia' catalogati in LEARNINGS: consultali PRIMA di ri-diagnosticare.
````

- [ ] **Step 2: Verifica frontmatter e struttura** — Run: `head -1 .claude/skills/project-atlas/SKILL.md` → Expected: `---`. Run: `grep -c "^## Modo:" .claude/skills/project-atlas/SKILL.md` → Expected: `4`. Run: `grep -c "NON usare per" .claude/skills/project-atlas/SKILL.md` → Expected: `1`.

- [ ] **Step 3: Commit** — `git add .claude/skills/project-atlas/SKILL.md && git commit -m "feat(skills): project-atlas — SKILL.md dispatcher (4 modi)"`

---

### Task 10: Test di accettazione (spec §8) + chiusura

**Files:**
- Modify: `.claude/skills/project-atlas/references/LEARNINGS.md` (primo run-record dai test)
- Nessun file di prodotto toccato.

**Interfaces:**
- Consumes: tutta la skill (Task 1-9).

- [ ] **Step 1: Test 1 — status.** Invoca la skill (Skill tool, args vuoti). Expected: tabella staleness per layer con valori misurati (confronta a campione: `git log --oneline --since=<data curated> -- apps/api/src | wc -l` a mano deve coincidere), nessun numero non verificato spacciato per fresco, menu 4 modi.

- [ ] **Step 2: Test 2 — query ×3.** Domande dal collaudo S1016: (a) "quali pagine toccano sys_positions?" (b) "quali feature hanno schema ma zero dati?" (c) "chi può leggere i cedolini di un altro utente?". Expected: ciascuna risposta con evidenza (riga atlas/curated + eventuale verifica puntuale) in ≤2 tool call.

- [ ] **Step 3: Test 3 — refresh delta simulato.** Tocca un file marker in un layer (`git log` vedrà il commit di skill appena fatto su `.claude/` — usa invece: modifica temporanea `touch`-equivalente committata? NO: usa il fatto che i commit della skill NON toccano `apps/`): il probe api/web deve risultare 0 (fresco) se nessun commit ha toccato quei glob dalla data curated; verifica che il modo refresh dichiari correttamente "atlas fresco" e NON lanci agenti. Expected: zero agenti, messaggio esplicito.

- [ ] **Step 4: Test 4 — dossier dry-run.** Chiedi alla skill un mini-dossier su una linea GIÀ nota (es. serie G/G3 integrità) SENZA convertire nel register (dry-run dichiarato). Expected: struttura conforme al template (header/§1/§2 con Dati-Costruire-Vincoli-Effort/webapp); il blocco register mostrato come anteprima passa `handoff_lint.py` in una copia temporanea o per ispezione di formato manuale contro un blocco canonico esistente.

- [ ] **Step 5: Test 5 — frontiere.** Tre frasi-esca: "trova i bug del progetto", "chiudi la sessione", "fai la due diligence per un investitore". Expected: la skill NON si attiva (o, se il dispatcher viene raggiunto, redirige esplicitamente alla skill giusta senza eseguire).

- [ ] **Step 6: Test 6 — learnings.** Verifica che dopo i test esista ≥1 run-record completo in LEARNINGS.md e che azzerando `adaptive: {}` in atlas.config.yaml nessun comportamento residuo persista (grep degli override = 0).

- [ ] **Step 7: Commit finale + registrazione.** `git add .claude/skills/project-atlas/ && git commit -m "feat(skills): project-atlas — acceptance tests + primo run-record"`. Poi: (a) `python docs/kb/tools/build_index.py` (la skill entra in INDEX_PATHS, categoria claude-config); (b) proponi a Enzo l'aggiunta di una riga nella memoria `project_atlas_knowledge_sot` che punta alla skill.

---

## Self-Review (eseguita)

1. **Spec coverage**: §1 perimetro→Task 9 dispatcher · §2 architettura/modi→Task 1,9 · §3 planner→Task 2 · §4 orchestrazione→Task 2,3,9 · §5 model-map→Task 4 · §6 self-learning+/goal→Task 7,8,9 · §7 description/frontiere→Task 9 Step 1 frontmatter · §8 test→Task 10 · §9 effort→granularita' task. Nessun gap.
2. **Placeholder scan**: gli unici blocchi `[...]` sono in Task 3 Step 1 con istruzione esplicita di sostituzione dal file sorgente versionato (righe indicate) — non sono TBD, sono un riferimento a contenuto esistente per non duplicare ~200 righe già in repo.
3. **Type consistency**: chiavi manifest (`layers`, `families_static`, `thresholds`, `adaptive`) coerenti tra Task 1, 2, 9; nomi reference coerenti tra Task 9 e Task 1-8; formato run-record identico tra Task 8 e Task 9 §self-learning.
