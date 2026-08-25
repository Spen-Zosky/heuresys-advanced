# Censimento pass-2 — Lotto A: audit/pages + .superpowers + .agents

Seconda passata sul censimento documentazione di `heuresys-advanced`. Copre le tre directory che la prima passata (`docs_censimento.md`) aveva dichiarato "non lette per volume". Fase A (path/dimensione/data/titolo) non viene rifatta: esiste già nel documento della prima passata. Qui: ri-conteggio, lettura integrale, classificazione, digesto.

## Conteggio (comando + numero per directory + delta vs prima passata)

Comandi eseguiti in questa sessione (cwd `D:\heuresys-advanced`):

```
$ find audit/pages -name "*.md" | wc -l
213
$ find .superpowers -name "*.md" | wc -l
23
$ find .agents -name "*.md" | wc -l
24
```

| Directory | Conteggio prima passata | Conteggio ri-misurato (questa sessione) | Delta |
|---|---|---|---|
| `audit/pages/` | 213 | 213 | 0 |
| `.superpowers/` | 23 | 23 | 0 |
| `.agents/` | 24 | 24 | 0 |

Nessun delta. Tutti e 260 i file `.md` delle tre directory sono stati letti per intero in questa sessione (260/260, zero esclusioni — vedi §Esclusioni).

**Nota di tracciamento git** — verificata con `git ls-files audit/pages/ | wc -l` → `0`, `git status --porcelain .agents/` → `?? .agents/`, `cat .superpowers/sdd/.gitignore` → `*`. Le tre directory sono interamente **fuori dal controllo versione** (gitignored o mai aggiunte): `audit/pages/` è ignorata da `.gitignore:221` (`audit/pages/`), `.superpowers/sdd/.gitignore` contiene `*` (ignora tutto), `.agents/` non ha mai avuto un `git add`. Questo le rende, per costruzione, artefatti di lavoro/runtime e non stato versionato — coerente con quanto CLAUDE.md dichiara per `.agents/`/`.codex/`/`.codex-review/` ("legittimamente untracked... non sono Claude's da mantenere").

## Digesti — audit/pages/ (digesto di serie + elenco nominale integrale + deviazioni)

**Provenienza**: snapshot generato in un'unica sessione, tutti i 213 file datati `2026-06-23` (mtime, verificato con `find audit/pages -name "*.md" -printf "%TY-%Tm-%Td\n" | sort -u` → riga singola `2026-06-23`). È l'output grezzo di un audit QA visivo automatizzato per-pagina su 74 pagine dell'app (74 directory sotto `audit/pages/`, verificato con `find audit/pages -maxdepth 1 -mindepth 1 -type d | wc -l` → `74`). **Ruolo: generato.**

**Fatto verificato e rilevante**: su tutto il corpus, **zero checkbox spuntate** (`grep -rc "^- \[x\]" audit/pages/` → nessun match in nessun file). Ogni file è un template TODO non eseguito: la fase di crawling/inventario (conteggio componenti dati, controlli, overlay, errori console) è stata completata; le fasi di verifica dichiarate nei task (tracciare la pipeline dato→DB, testare i controlli, testare gli overlay, testare l'occultamento RBAC) risultano **non eseguite** stando al contenuto dei file stessi.

### Il formato ricorrente (tre famiglie di file, byte-identiche nel corpo del checklist)

Verificato con `md5sum` sul corpo (righe dopo l'intestazione numerica) di tutte le occorrenze: `core2-TODO.md` (hash body unico su 31 file), `core3-TODO.md` (hash unico su 32 file), `core4-TODO.md` (hash unico su 31 file), `core6-TODO.md` (hash unico su 74 file). Solo la riga di intestazione e i numeri variano.

| File | Presente in | Contenuto fisso (corpo) | Ciò che varia |
|---|---|---|---|
| `core2-TODO.md` | 31 directory | 5 checklist agente non spuntate: tracciare pipeline dato→hook→API→service→DB, verificare query DB, verificare risposta API↔frontend, coerenza cross-componente, stati loading/empty/error | conteggio "Data components" (2–877), conteggio "API calls captured" (4–28), path screenshot |
| `core3-TODO.md` | 32 directory | 4 checklist non spuntate: interagire con ogni controllo e verificarne lo stato, testare validazione, testare reset/clear, verificare assenza errori console | conteggio "Controls found" (from inventory / visible), path screenshot "before" |
| `core4-TODO.md` | 31 directory | 4 checklist non spuntate: testare tooltip, testare modali (Escape chiude), testare notifiche `role="alert"`, screenshot di ogni stato overlay | conteggio "Overlay components" (1–37) |
| `core6-TODO.md` | **tutte le 74 directory** | 3 checklist non spuntate: definire `expected_pages_hidden` per il ruolo "admin" in `roles-config.json`, eseguire test manuali di bypass URL, verificare visibilità elementi UI admin-only | nessuna — corpo **e** intestazione identici in tutti e 74 (unico ruolo osservato: `[admin]`, verificato `grep -h "^# CORE6 TODO"` → 74/74 `[admin]`) |
| `admin-BUGS.md` | 45 directory | Intestazione `# BUGS — <pagina> [admin]`, voci `## BUG-JS-N \| OPEN \| severity=medium` con riga "JS error at load" | numero di voci (1–3), messaggio errore (vedi sotto) |

**Contenuto di `admin-BUGS.md` (45 file, distribuzione verificata)**: 2 file con 1 sola voce, 22 file con 2 voci, 21 file con 3 voci. Messaggi osservati (`grep -h "JS error at load"` su tutti i 45): la stragrande maggioranza è `[console] Failed to load resource: the server responded with a status of 401 (Unauthorized)`; 15 file hanno una terza voce `429 (Too Many Requests)`; **due file deviano dal pattern in modo sostanziale** (vedi sotto).

### Elenco nominale integrale — 74 directory, 213 file, nessuno saltato

Legenda pattern: **A** = `core2+core3+core4+core6-TODO.md` (4 file, nessun `admin-BUGS.md`) · **B** = `admin-BUGS.md + core6-TODO.md` (2 file) · **DEV** = deviante dal pattern (dettaglio individuale sotto la tabella).

**Pattern A — 29 directory × 4 file = 116 file** (`core2-TODO.md`, `core3-TODO.md`, `core4-TODO.md`, `core6-TODO.md` in ciascuna):
`admin__mfa-policy` · `admin__roles` · `analytics__attendance` · `analytics__compensation` · `analytics__kpi` · `analytics__org-network` · `analytics__overtime` · `analytics__skills` · `analytics__skills-by-category` · `analytics__skills-group-share` · `analytics__workforce` · `approvals` · `approvals__69137767-5795-47f7-8868-fd8461d68fa4` · `blueprints` · `blueprints__b6e81585-8526-410f-bb1b-0138e2cb425f` · `career-succession` · `compensation-intelligence` · `content` · `content__69137767-5795-47f7-8868-fd8461d68fa4` · `dashboard` · `dev__agent` · `engagement` · `gaps` · `goals` · `insights` · `insights__skill-gap` · `insights__succession-readiness` · `kpis` · `learning`

**Pattern B — 42 directory × 2 file = 84 file** (`admin-BUGS.md`, `core6-TODO.md` in ciascuna):
`learning__training-initiatives` · `me` · `me__career` · `me__career__target` · `me__certifications` · `me__documents` · `me__gaps` · `me__handbook` · `me__handbook__69137767-5795-47f7-8868-fd8461d68fa4` · `me__inbox` · `me__kpis` · `me__learning` · `me__learning__catalogue` · `me__matching` · `me__positions` · `me__profile` · `me__security` · `me__skills` · `me__skills__self-assessment` · `me__surveys` · `me__surveys__57850d00-c7cd-4f66-8acd-20586bc63eda` · `me__team` · `okrs` · `organization` · `organization__org-chart` · `org-director` · `positions` · `positions__0e51c0bb-f0df-4752-b003-b75a8607ea88` · `positions__0e51c0bb-f0df-4752-b003-b75a8607ea88__kpis` · `positions__0e51c0bb-f0df-4752-b003-b75a8607ea88__learning` · `positions__0e51c0bb-f0df-4752-b003-b75a8607ea88__skills` · `processes` · `process-owner` · `seed-acquisition__runs` · `skills` · `system-health` · `tenants` · `tenants__86ba7a65-217f-48ba-8ce5-5c09b40a66b0` · `tenants__86ba7a65-217f-48ba-8ce5-5c09b40a66b0__enterprise-typing` · `users__b113459e-5102-4cdd-8f3b-37f654896d9d` · `visualizations` · `visualizations__325ecb42-a79f-4426-93d2-263dc3584ade`

**Pattern DEV — 3 directory, 13 file, digesto individuale**:

1. **`brownfield-adaptation/`** (3 file: `admin-BUGS.md`, `core3-TODO.md`, `core6-TODO.md` — manca `core2` e `core4`). `admin-BUGS.md` riporta **un solo bug reale, diverso da tutti gli altri 44 file**: `JS error at load: Cannot read properties of undefined (reading 'slice')` (non è un 401/429/404 di rete, è un'eccezione JS non gestita). `core3-TODO.md`: "Controls found: 2 (from inventory), 24 (visible)" — inventario e visibilità fortemente disallineati (2 vs 24) rispetto al pattern tipico dove i due numeri sono comparabili.
2. **`engagement__57850d00-c7cd-4f66-8acd-20586bc63eda/`** (5 file: set completo `admin-BUGS.md`+`core2`+`core3`+`core4`+`core6`). `admin-BUGS.md` ha **una sola voce** con `404 (Not Found)` invece di `401`/`429` — unico file su 45 con un 404.
3. **`users/`** (5 file: set completo `admin-BUGS.md`+`core2`+`core3`+`core4`+`core6` — unica directory, insieme alla precedente, che combina il set "pagina con dati" e il bug-log). `admin-BUGS.md`: 2 voci, entrambe 401 (pattern standard). `core2-TODO.md`: "API calls captured: 28" — il valore più alto osservato nel corpo A insieme a `admin__roles` ("Data components: 877", anomalo per ordine di grandezza rispetto a tutti gli altri, che stanno in singola/doppia cifra).

## Digesti — .superpowers/ (tabella: file | ruolo | digesto 1-2 righe | sospetto superato?)

**Nota strutturale, prima della tabella**: `.superpowers/sdd/` contiene artefatti di **due cicli SDD (Spec-Driven-Development) distinti e non correlati**, che riusano gli stessi nomi di file `task-N-brief.md` / `task-N-report.md`. Verificato con le date di modifica (`find .superpowers -name "*.md" -printf "%TY-%Tm-%Td %TH:%TM %p\n"`, nessuna storia git disponibile perche' `.superpowers/sdd/.gitignore` contiene `*`):

- **Ciclo 1 - "GTM front-door landing + lead capture" (#4)**, 2026-06-21, ore 20:39-20:51: `task-10-report.md` (landing E2E, commit 185fd9a) e `final-fix-report.md` (fix GDPR privacy notice, commit 19b6d2f) sono gli unici sopravvissuti su disco di questo ciclo.
- **Ciclo 2 - skill "project-atlas"**, 2026-07-06 18:33 - 2026-07-07 02:03: ha sovrascritto task-1..9-brief.md, task-1..9-report.md e task-10-brief.md con contenuto del proprio ciclo. progress.md e final-review-fixes-report.md appartengono solo a questo ciclo.

Conseguenza verificabile: task-10-brief.md (project-atlas, "Test di accettazione") e task-10-report.md (GTM, "landing E2E") descrivono due lavori diversi, pur essendo la coppia brief/report nominalmente accoppiata dalla convenzione di naming. task-3-report.md si autodichiara sovrascrittura (nota in fondo al file, citata testualmente in Sospetti superati).

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| `progress.md` | report | Log cronologico dei due cicli SDD: Ciclo GTM Task 1-10 + fix finale, poi Ciclo project-atlas Task 1-10 + fix finale, con SHA commit per ogni task e note di deviazione (es. bug reale trovato e corretto in Task 5 e Task 10 GTM; registry count "D48->49" corretto in corsa). Chiude entrambi i cicli come "DONE"/"COMPLETO su main". | no |
| `final-fix-report.md` | report | Fix GDPR privacy notice (#4): link di consenso `<Trans>` verso `/privacy`, nuova pagina pubblica `/privacy`, `PUBLIC_PATHS` aggiornato. Riporta 3 gate PASS (i18n:check, tsc, eslint). Commit 19b6d2f, 2026-06-21. | no |
| `final-review-fixes-report.md` | report | Fix-wave finale review skill project-atlas: 12 fix puntuali (I-1..I-3, M-1..M-5, U-1..U-4) su `.claude/skills/project-atlas/`, con comando+output per ciascuna verifica. Commit 98e1d8ada4c1..., non pushato. | no |
| `task-1-brief.md` | spec | Brief project-atlas Task 1: contenuto esatto (YAML) del manifest `atlas.config.yaml` - chiavi sot_reads, layers (api/web/db/ops con derive+staleness_probe), families_static, thresholds, adaptive: {}. | no |
| `task-1-report.md` | report | Esecuzione Task 1: file scritto 59 righe, YAML valido, 6 chiavi attese presenti, commit 8c7bcbef. | no |
| `task-2-brief.md` | spec | Brief Task 2: contenuto esatto di `planner.md` - procedura "PIANO SWEEP" (deriva i target a runtime, mai liste hardcoded), lancio via Workflow tool, "COVERAGE CHECK" bloccante fail-loud, post-sweep (build_atlas.py x2, handoff_lint.py), delta vs full. | no |
| `task-2-report.md` | report | Esecuzione Task 2: planner.md 55 righe, 5 sezioni verificate via grep, commit 1abe28a1. | no |
| `task-3-brief.md` | spec | Brief Task 3: contenuto esatto di `sweep-prompts.md` - 6 template (code-chunk, db-live, ops, legacy, wiki, design-system) da adattare 1:1 dai prompt del workflow S1016. | no |
| `task-3-report.md` | report | Esecuzione Task 3: 217 righe, 6 template presenti, zero nomi-modulo hardcoded residui, commit 172875df. Contiene una sezione "NOTA (residuo pre-esistente sovrascritto)" che dichiara esplicitamente la sovrascrittura di un report non correlato del ciclo GTM (commit 5485ed0) - citata testualmente in Sospetti superati. | si (auto-dichiarato) |
| `task-4-brief.md` | spec | Brief Task 4: contenuto esatto di `model-map.md` - tabella modello x effort per agente. | no |
| `task-4-report.md` | report | Esecuzione Task 4: trascrizione verbatim, grep "haiku|sonnet" = 4, commit 468e7028. | no |
| `task-5-brief.md` | spec | Brief Task 5: contenuto esatto di `curated-template.md` - struttura a 12 sezioni di ATLAS_CURATED.md, regola di MERGE per sezione (mai rigenerare da zero, i rilievi superati si barrano con data e motivo). | no |
| `task-5-report.md` | report | Esecuzione Task 5: 17 righe, grep "MERGE per sezione" = 1, commit dce460f8. | no |
| `task-6-brief.md` | spec | Brief Task 6: contenuto esatto di `dossier-template.md` - pre-check bloccante su staleness del curated, struttura dossier, formato blocco Action register, procedura di conversione post-selezione Enzo. | no |
| `task-6-report.md` | report | Non e' l'esecuzione del Task 6-brief cosi' come scritto: e' un report di correzione formato ("GATED Format Fix") - cambia il formato blocker/unblock-trigger da una riga a due bullet separate in dossier-template.md e nel piano, verificando contro il formato canonico #39/#40 di SOT_BACKLOG.md. Commit 3f6f4b64. | no |
| `task-7-brief.md` | spec | Brief Task 7: contenuto esatto di `goal-recipes.md` - tre ricette /goal misurabili (refresh --full, refresh delta, dossier). | no |
| `task-7-report.md` | report | Esecuzione Task 7: grep "^/goal|^## " = 6, commit 3cba57b7. | no |
| `task-8-brief.md` | spec | Brief Task 8: contenuto esatto di `LEARNINGS.md` bootstrap - 7 lezioni seed S1016 + schema YAML run-record. | no |
| `task-8-report.md` | report | Esecuzione Task 8: 35 righe, commit 7c2a0d0d. | no |
| `task-9-brief.md` | spec | Brief Task 9: contenuto esatto di `SKILL.md` dispatcher project-atlas - 4 modi (status/refresh/query/dossier), frontmatter con trigger e "NON usare per". | no |
| `task-9-report.md` | report | Esecuzione Task 9: 80 righe, frontmatter e 4 sezioni "## Modo:" verificate, commit aba156c4. | no |
| `task-10-brief.md` | spec | Brief Task 10 del ciclo project-atlas: 6 test di accettazione (status, query x3, refresh delta simulato, dossier dry-run, frontiere/frasi-esca, learnings) + self-review di copertura spec. | no |
| `task-10-report.md` | report | Report Task 10 del ciclo GTM (contenuto non corrispondente al brief omonimo - vedi nota strutturale sopra): 2 test Playwright passati per la landing E2E, bug reale trovato e fisso (companySize vuoto vs undefined in schema Zod .optional()), commit 185fd9a. | si (mismatch strutturale con il brief omonimo, non auto-dichiarato nel file stesso) |

## Digesti — .agents/ (stessa tabella)

.agents/ e' la copia in-repo delle skill di Codex (CLAUDE.md: "Codex's own imports of the project skills"). Non tracciato da git (git status --porcelain .agents/ produce "?? .agents/"). Contiene 4 skill: consolida-pagina, dashboards-jobs, multi-tenant-validator, project-atlas (copia), zero-pending-loop (copia).

**Fatto verificato**: project-atlas in .agents/ e' byte-identica alla copia live in .claude/skills/project-atlas (diff -rq fra le due directory produce "ALL IDENTICAL", 9 file su 9). zero-pending-loop in .agents/ e' invece divergente dalla copia live in .claude/skills/zero-pending-loop: diff -rq segnala 6 file diversi su 12 (SKILL.md, references/adversarial.md, references/driver.md, references/protocol.md, references/selection.md, references/zp.config.yaml [non-md]). Dettaglio in Sospetti superati.

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| consolida-pagina/SKILL.md | regola | Skill operativa "consolida pagina": 7 fasi (A backup, B1 reuse-check registry, B update rbp_pages, C nav_items, D relazioni RBAC a monte, E oggetti derivati, F integrita, G propagazione+doc) per collegare una pagina al grafo Ruoli-Dashboard-Pagine. Opera su tabelle rbp_pages, rbp_dashboard_nav_items, rbp_role_dashboards, rbp_role_permissions, admin_component_registry, connessione dichiarata "docker exec -i heuresys_evo_platform_db psql". | si (vedi sotto - schema/stack non corrispondono a questo repo) |
| consolida-pagina/references/functional_areas.md | regola | Tabella di riferimento: 33 aree funzionali (BUSINESS 7, HR 11, PORTAL 3, SYSTEM 12) con i codici esatti da usare nel campo functional_area_code della skill sopra. | si (stesso motivo) |
| dashboards-jobs/SKILL.md | regola | Skill operativa autoaggiornante per lavori su dashboard: setup con lettura di 7 file in memory/, reuse-check obbligatorio via API localhost:8012, ciclo fix-verify con REBUILD CONTAINER DOCKER a ogni fix frontend, credenziali di test (rtl-bank.pietro.barbieri / password, sysadmin / sysadmin123), architettura Widget Engine con path services/frontend/src/... e services/api-gateway/... | si (vedi sotto) |
| multi-tenant-validator/SKILL.md | regola | Skill generica di validazione multi-tenant basata su Prisma ORM (prisma.user.findMany, @map, @@unique, middleware prisma.$use): regole "query MUST include tenantId", convenzioni schema Prisma, formato di output di un report di validazione. Nessuna menzione di "Heuresys" nel testo. | si (contraddice I5 - vedi Contraddizioni) |
| project-atlas/SKILL.md | regola | Dispatcher della skill project-atlas, identico alla copia .claude: 4 modi (status/refresh/query/dossier), routing deterministico, protocollo self-learning. | no |
| project-atlas/references/planner.md | regola | Procedura PIANO SWEEP + COVERAGE CHECK, identica alla copia .claude. | no |
| project-atlas/references/sweep-prompts.md | regola | 6 template per famiglia di sweep, identici alla copia .claude. | no |
| project-atlas/references/model-map.md | regola | Matrice modello x effort, identica alla copia .claude. | no |
| project-atlas/references/curated-template.md | regola | Struttura 12 sezioni + regole di merge per ATLAS_CURATED, identica alla copia .claude. | no |
| project-atlas/references/dossier-template.md | regola | Template dossier + conversione in blocco Action register, identica alla copia .claude. | no |
| project-atlas/references/goal-recipes.md | regola | Tre ricette /goal, identiche alla copia .claude. | no |
| project-atlas/references/LEARNINGS.md | cronaca | Lezioni seed S1016 + schema run-record, identico alla copia .claude. | no |
| zero-pending-loop/README.md | stato-vivo | Guida di riferimento umana del loop autonomo zero-pendenze: cosa e', come si usa (comandi CLI zp), i tre pezzi (CLI/driver/skill), le 5 classi di rischio A-E, sezione "Stato attuale: cosa esiste e cosa manca" con numeri datati (255 cluster, 42 chiusi, 213 aperti al 2026-07-26) e il freno di sicurezza dichiarato inserito (meta.autorizzato_non_presidiato: false). | si (numeri datati 2026-07-26, testo dichiara esso stesso "i numeri qui sotto invecchiano") |
| zero-pending-loop/SKILL.md | regola | Router della skill: 5 modi (bootstrap/resume/close/censimento/recover/report), contratto col driver via .zp/last-outcome.json, le 5 regole non negoziabili (due prove di natura diversa, tre revisori adversarial, nessun cluster chiuso su test verde, la classe decide la corsia non l'urgenza, due tentativi falliti nella stessa direzione bastano). Diverge dalla copia .claude vigente: qui l'invocazione e' descritta come "Codex -p ...", nella copia .claude come "claude -p ..."; manca inoltre il supporto multi-worker --cluster Z-nnn (#173) presente nella copia .claude. | si (drift datato - dettaglio in Sospetti superati) |
| zero-pending-loop/references/bootstrap.md | regola | Modo bootstrap (verifica integrita' piano, non lo rifa') e modo censimento (due assi: fonti dichiarate + superfici reali, riporta avanti le decisioni terminali). Identico fra le due copie (non nella lista diff). | no |
| zero-pending-loop/references/selection.md | regola | Stato tutto su file (mai in conversazione), ordine di selezione a 6 filtri (INTERRUPTED prioritario, blocking HARD, ondata corrente, dependsOn risolti, classe ammessa, budget). Diverge dalla copia .claude (30 righe di diff). | si (drift, dettaglio non ispezionato riga per riga) |
| zero-pending-loop/references/protocol.md | regola | 5 passi di esecuzione di un cluster: implementazione su pattern repo, due prove di natura diversa (livelli diversi, non solo strumenti diversi), review adversarial, correzione+ri-test (max 2 giri), commit atomico con evidenza (zp_evidence.py). Diverge dalla copia .claude (12 righe di diff). | si (drift) |
| zero-pending-loop/references/adversarial.md | regola | Tre revisori (correttezza, isolamento e sicurezza, riproducibilita'), contesto vuoto, mandato negativo, regola di maggioranza (un rilievo cade se almeno due lo smontano; un rilievo alto su isolamento tenant o segreti vale anche da solo). Diverge dalla copia .claude (39 righe di diff, la piu' ampia delle 4). | si (drift) |
| zero-pending-loop/references/blast-radius.md | regola | 5 classi A-E per raggio d'impatto, indipendenti dall'ondata; corsie safe (A+B) e full (A+B+C); esempio nominato Z-153 (favicon) riclassificato da B a D perche' il "chiuso quando" deploya il sito pubblico. Identico fra le due copie. | no |
| zero-pending-loop/references/gates.md | regola | Gate derivati dallo scope toccato (git diff --name-only), matrice area->controlli, trappole verificate del repo (Playwright/Node>=23, vitest transazione per file, PowerShell $ErrorActionPreference). Identico fra le due copie. | no |
| zero-pending-loop/references/operations.md | regola | Modello/effort per attivita', budget (un cluster per iterazione, --max-budget-usd unico tetto quantitativo, --max-turns non esiste), /goal come contratto di uscita, tabella degradazione per evento. Identico fra le due copie. | no |
| zero-pending-loop/references/close.md | regola | Procedura di chiusura in 6 passi (gate, consolida, delega a handoff, propagazione, verifica live, segnala al driver), perimetro del push (solo origin main, mai --force), modo report (cosa deve contenere PROGRESS.md, incluso "zero pendenze rispetto al piano del <data>"). Identico fra le due copie. | no |
| zero-pending-loop/references/driver.md | regola | Contratto del driver: 3 modi di interruzione (pulito/fine finestra/brutale), fermata pulita via .zp/STOP, recupero da sessione morta, sospensione lunga (>24h forza bootstrap), guard-rail all'avvio (freno, working tree sporco, lock vivo/morto, classificazione mancante). Diverge dalla copia .claude (23 righe di diff). | si (drift) |
| zero-pending-loop/references/LEARNINGS.md | cronaca | Sezione "Lezioni" vuota ("si popola con l'uso"); sezione "Gotcha noti al bootstrap" con ~15 trappole gia' pagate (Playwright/Node23, vitest tx-per-file, MSYS_NO_PATHCONV, pipe che nasconde exit code, PowerShell BOM, --max-turns inesistente, path assoluti MSYS passati a Python, sostituzioni cieche di apostrofi). Identico fra le due copie. | no |

## Sospetti superati - dettaglio con citazioni

**1. .superpowers/sdd/task-3-report.md - auto-dichiara la sovrascrittura di un report di un altro ciclo.**
Citazione testuale (righe 85-91 del file):
> "## NOTA (residuo pre-esistente sovrascritto)
> Questo file conteneva in precedenza un report non correlato ("Task 3 - leads module repository + service", commit 5485ed0) appartenente a un altro ciclo SDD/numbering. Non correlato a project-atlas: sovrascritto come da istruzione del brief corrente [...]. Segnalato per trasparenza, nessuna azione necessaria salvo conferma di Enzo se quel contenuto andava preservato altrove."

Il contenuto originale (report Task 3 del ciclo GTM #4, commit 5485ed0) non esiste piu' su disco in nessun file di .superpowers/. L'unica traccia residua e' la riga di progress.md: "Task 3: complete (commit 5485ed0, controller-verified: honeypot short-circuit + consent-version stamp + parameterized SQL, typecheck 0)".

**2. .superpowers/sdd/task-10-brief.md vs task-10-report.md - coppia nominale non corrispondente.**
Verificato con find + printf mtime: task-10-brief.md ha mtime 2026-07-06 18:34 (ciclo project-atlas), task-10-report.md ha mtime 2026-06-21 20:39 (ciclo GTM) - 15 giorni di distanza, due cicli diversi. task-10-brief.md (riga 1) apre con "### Task 10: Test di accettazione (spec paragrafo 8) + chiusura" (project-atlas); task-10-report.md (riga 1) apre con "### Task 10 Report - landing E2E (DONE)" (GTM). Chi legge solo la coppia sul disco, senza incrociare progress.md o le date, puo' credere che il report risponda al brief.

**3. .agents/skills/zero-pending-loop/ - 6 file su 12 divergono dalla copia vigente in .claude/skills/zero-pending-loop/.**
Verificato con diff -rq fra le due directory: SKILL.md, references/adversarial.md, references/driver.md, references/protocol.md, references/selection.md, references/zp.config.yaml differiscono. Esempio concreto (diff di SKILL.md, riga 14 e riga 48):
> .claude (vigente): "quando l'invocazione arriva da claude -p /zero-pending-loop <modo> (e' il driver che..."
> .agents (Codex): "quando l'invocazione arriva da Codex -p /zero-pending-loop <modo> (e' il driver che..."

> .claude (vigente): "resume | ogni iterazione del driver | seleziona un cluster - o lavora quello che l'invocazione gli assegna con --cluster Z-nnn, quando il driver gira con piu' lavoratori (#173) - lo porta a termine..."
> .agents (Codex): "resume | ogni iterazione del driver | seleziona un cluster, lo porta a termine..." (nessuna menzione di --cluster Z-nnn / #173)

Le date di modifica confermano il drift: la copia .claude dei file divergenti e' stata toccata fino al 2026-08-10 (adversarial.md, protocol.md), 2026-08-09 (selection.md, SKILL.md), 2026-08-04 (driver.md); la copia .agents e' ferma al 2026-07-26/2026-07-27. Rispetto a oggi (2026-08-25) la copia .agents e' indietro di 2-3 settimane su un impianto che, per sua stessa descrizione, e' cambiato nel frattempo (supporto multi-worker aggiunto dopo la copia).

**4. .agents/skills/zero-pending-loop/README.md - numeri esplicitamente datati e auto-dichiarati invecchiabili.**
Citazione (righe 432-436): "Il piano cresce a ogni sessione che scopre pendenze nuove, quindi i numeri qui sotto invecchiano: il comando che li rida' e' python docs/kb/tools/zp_state.py piano [...]. Al 2026-07-26: 255 cluster, 42 chiusi, 213 aperti [...]". Il file segnala da solo la propria obsolescenza attesa; si registra comunque come sospetto perche' un lettore che non nota la premessa puo' prendere i numeri per correnti.

**5. .agents/skills/dashboards-jobs/SKILL.md - referenzia un percorso che non esiste nel repo.**
Il file (riga 61) istruisce: "Read .superpowers/brainstorm/702426-1775610642/content/employee-portal-v5.html". Verificato: .superpowers/ contiene solo la sottodirectory sdd/ (nessuna brainstorm/). Il file descrive inoltre (righe 66-118) un'infrastruttura Docker a 4 container, porte 8012/3012/5433/8765, path services/frontend/, services/api-gateway/ - nessuno di questi corrisponde alla struttura corrente del repo (apps/api, apps/web, nessun Docker per I13). Non e' verificabile da questa passata quando questo stato sia diventato falso (nessuna storia git sul file), ma il file oggi descrive un ambiente non presente nel repo.

**6. .agents/skills/consolida-pagina/SKILL.md e references/functional_areas.md - stesso genere di scollamento del punto 5.**
Il file referenzia (righe 46, 368) "docker exec -i heuresys_evo_platform_db psql -U heuresys -d heuresys_platform", tabelle rbp_pages/rbp_dashboard_nav_items/rbp_role_dashboards/rbp_role_permissions/admin_component_registry, e due documenti (righe 321-322, 352-353) docs/DASHBOARDS_CONSTITUTION_MAP.md e docs/BLUEPRINT_ROLES_DASHBOARDS_PAGES.md. Verificato: nessuno dei due file esiste in questo repo (test -f su entrambi -> NOT FOUND). Il nome tabella rbp_* e "heuresys_evo_platform_db" compaiono altrove nel repo solo in documenti che parlano esplicitamente del legacy Docker-based (ADR-0004, ADR-0023, ADR-0038, SOT_STATE.md) - schema e stack che CLAUDE.md attribuisce al passato/legacy del progetto, non all'architettura corrente (sys.sys_*, invariante I3/I4; nessun Docker in runtime, invariante I13).

## Contraddizioni doc/doc - citazioni testuali di entrambe le parti

**1. Isolamento multi-tenant: FK+middleware vs RLS.**

CLAUDE.md, invariante I5 (vincolante, riportato alla lettera):
> "I5 Tenant isolation = FK + API middleware filter. NEVER RLS. Postgres RLS is not used anywhere."

.agents/skills/multi-tenant-validator/SKILL.md, sezione finale "Recommendations" (riga 338):
> "3. **Enable RLS:** Consider PostgreSQL Row Level Security"

Le due fonti raccomandano meccanismi opposti per lo stesso problema (isolamento dati fra tenant). Non decido quale abbia ragione: registro che multi-tenant-validator/SKILL.md non nomina mai "Heuresys" nel testo, usa esclusivamente esempi Prisma ORM (prisma.user.findMany, @map, @@unique) che non corrispondono allo stack dichiarato dal progetto (nessuna menzione di Prisma altrove nei documenti letti in questo lotto o in CLAUDE.md), il che suggerisce - senza deciderlo - che il file possa essere un template generico non riscritto per questo progetto.

**2. Chi puo' invocare il driver zero-pending-loop: "claude" o "Codex".**

.claude/skills/zero-pending-loop/SKILL.md (copia vigente, riga 14):
> "oppure quando l'invocazione arriva da `claude -p "/zero-pending-loop <modo>"` (e' il driver che chiama)"

.agents/skills/zero-pending-loop/SKILL.md (copia Codex, riga 14):
> "oppure quando l'invocazione arriva da `Codex -p "/zero-pending-loop <modo>"` (e' il driver che chiama)"

Le due copie, presenti entrambe nel repo, dichiarano un soggetto invocante diverso per lo stesso meccanismo. Non e' chiaro da questo lotto se si tratti di un adattamento intenzionale della copia Codex al proprio contesto di esecuzione o di un drift non intenzionale: la registro come contraddizione testuale, non la interpreto.

## Menzioni di funzionalita' del prodotto (citazioni con file:riga)

**Elenco pagine/route attestate da audit/pages/ (74 directory = 74 target di audit; nome directory = route con "__" al posto di "/"):**
`audit/pages/` (elenco directory, fonte: `find audit/pages -maxdepth 1 -mindepth 1 -type d`): admin/mfa-policy, admin/roles, analytics/attendance, analytics/compensation, analytics/kpi, analytics/org-network, analytics/overtime, analytics/skills, analytics/skills-by-category, analytics/skills-group-share, analytics/workforce, approvals (+ istanza con id), blueprints (+ istanza con id), brownfield-adaptation, career-succession, compensation-intelligence, content (+ istanza con id), dashboard, dev/agent, engagement (+ istanza con id), gaps, goals, insights, insights/skill-gap, insights/succession-readiness, kpis, learning, learning/training-initiatives, me + 18 sotto-pagine (career, career/target, certifications, documents, gaps, handbook [+istanza], inbox, kpis, learning, learning/catalogue, matching, positions, profile, security, skills, skills/self-assessment, surveys [+istanza], team), okrs, organization, organization/org-chart, org-director, positions (+ istanza con id, + istanza/kpis, + istanza/learning, + istanza/skills), processes, process-owner, seed-acquisition/runs, skills, system-health, tenants (+ istanza con id, + istanza/enterprise-typing), users (+ istanza con id), visualizations (+ istanza con id).

**Modulo "leads" (GTM front-door landing) - .superpowers/sdd/progress.md righe 6-17:**
> riga 6: "000005 TENANT_ADMIN re-grant leaked leads:read -> 000152 authoritative DELETE strips non-PLATFORM_ADMIN + assert exactly-1-role"
> riga 9: "POST public+rateLimit no-CSRF, GET gated leads:read, registered app.ts:429"
> riga 15: "manual POST /v1/leads -> {ok:true} + DB row (source=website/status=NEW/consent_version=2026-06-21-v1); honeypot -> 200 + 0 stored"

Attesta: endpoint `POST /v1/leads` pubblico (no CSRF, rate-limited), endpoint GET protetto dal permesso `leads:read` riservato a `PLATFORM_ADMIN`, tabella con colonne `source`, `status`, `consent_version`, un campo honeypot anti-spam.

**Form di raccolta lead con validazione company size - .superpowers/sdd/task-10-report.md righe 35-45:**
> "Root cause: LeadCreateSchema uses companySize: LeadCompanySizeEnum.optional(). [...] The native <select> for company size emits "" when no option is selected [...]"
> "Fix in lead-form.tsx: {...register("companySize", { setValueAs: (v: string) => v === "" ? undefined : v })}"

Attesta: form React con campo `companySize` (select), schema Zod `LeadCompanySizeEnum`, file `apps/web/src/components/lead-form.tsx`.

**Pagina pubblica privacy/consenso GDPR - .superpowers/sdd/final-fix-report.md righe 8-23:**
> riga 17: "Minimal public /privacy page - apps/web/src/app/privacy/page.tsx"
> riga 19: "Renders a <main> with h1 and 6 paragraphs covering: data collected, purpose, legal basis (Art. 6(1)(a) GDPR), retention (24 months), withdrawal right, controller contact."

Attesta: pagina pubblica `/privacy` con testo di informativa GDPR (raccolta dati, finalita', base giuridica, retention 24 mesi, diritto di recesso, contatto del titolare).

**Landing page GTM con "3 wedges" - .superpowers/sdd/task-10-report.md riga 16:**
> "renders the positioning + 3 wedges (3.1s)"

Attesta: landing page pubblica con tre proposizioni di posizionamento ("wedges").

**Modulo "goals" con RBAC per ruolo MANAGER - .agents/skills/zero-pending-loop/references/protocol.md riga 48:**
> "comando: pnpm exec vitest run test/goals.integration.test.ts / output: 12 passed (12) - estratto: goals:write enforced for MANAGER"

Attesta: modulo "goals", permesso `goals:write` con enforcement per il ruolo MANAGER, test d'integrazione `test/goals.integration.test.ts`.

**Widget Engine / Employee Portal (stack Docker, non verificato contro apps/web corrente) - .agents/skills/dashboards-jobs/SKILL.md righe 166-207:**
> "Login -> redirect per ruolo -> /portal (EMPLOYEE) -> PortalLayout (sidebar + header + footer) -> DynamicSidebar (da useSidebarNav -> GET /api/rbp/dashboard/:slug/nav-items) -> PortalHeader [...] -> HeroSection [...] -> WorkspaceRenderer (CSS Grid 12-col) -> useWorkspace() -> GET /api/v1/workspace/me -> Per ogni widget: WidgetFactory(code) [...] -> useWidgetData(code) -> GET /api/v1/workspace/widget/:code/data"

Attesta (per lo stack descritto in quel file, non verificato contro il codice corrente in questa passata): route `/portal`, endpoint `GET /api/rbp/dashboard/:slug/nav-items`, `GET /api/v1/workspace/me`, `GET /api/v1/workspace/widget/:code/data`, componenti `DynamicSidebar`, `HeroSection`, `WorkspaceRenderer`, `WidgetFactory`.

**Tassonomia di 33 aree funzionali di prodotto - .agents/skills/consolida-pagina/references/functional_areas.md righe 5-52:**
Elenco completo citato: BUSINESS (Analytics & Reporting, Company PET Analytics, Organization, PET Perspectives, Process Management, Teams, Workforce Intelligence), HR (Benchmarking, Career Management, Compensation & Benefits, Compliance, Core HR, Engagement, Learning & Development, Performance Management, Recruitment, Talent & Skills, Time & Attendance), PORTAL (Notifications & News, Self-Service, Personal Workspace), SYSTEM (AI Quality & Review, AI Services, Data Integration, Design Tools, Knowledge Graph, Marketplace, Platform Management, Platform Navigator, Public API, Security & Access, Semantic Search, System Operations).

## Esclusioni (file non letti: nome + ragione, mai aggregato - l'obiettivo e' ZERO)

**ZERO esclusioni fra i file .md.** Tutti i 213 file di audit/pages/, tutti i 23 file di .superpowers/, tutti i 24 file di .agents/ (260/260) sono stati letti per intero in questa sessione. Nessun file .md e' stato saltato, campionato o riassunto senza lettura diretta.

## Lacune dichiarate

**Ambito dichiarato dal mandato**: "Leggi OGNI file `.md` delle tre directory". I file non-`.md` presenti nelle stesse directory sono quindi fuori dal perimetro di lettura obbligatoria di questa passata, e vengono solo enumerati qui per trasparenza (non letti, non classificati, non esclusi ai sensi della Fase D perche' non sono documenti di testo prosa):

- `audit/pages/`: **0 file non-.md** (verificato con `find audit/pages -type f -not -name "*.md" | wc -l` -> 0). Alcuni file .md referenziano artefatti che dovrebbero esistere altrove (`core2-api-calls.json`, screenshot in `states/` e `controls/`) ma questi path non sono stati verificati in questa passata.
- `.superpowers/sdd/`: **15 file non-.md** - 14 file `.diff` (`review-<sha>..<sha>.diff`, diff di revisione del ciclo project-atlas) + 1 `.gitignore`. Non letti in questa passata (fuori mandato); il loro contenuto e' presumibilmente ridondante con quanto gia' riassunto nei corrispondenti `task-N-report.md`, ma questo non e' stato verificato.
- `.agents/`: **4 file non-.md** - `project-atlas/references/atlas.config.yaml` (verificato indirettamente: confrontato byte-per-byte con `.claude/skills/project-atlas/references/atlas.config.yaml` risultando identico, quindi il suo contenuto e' comunque coperto per equivalenza), `zero-pending-loop/references/zp.config.yaml` (non letto - e' uno dei 6 file segnalati come divergenti dalla copia .claude, quindi il suo contenuto specifico resta una lacuna reale), `zero-pending-loop/evals/evals.json` e `zero-pending-loop/evals/trigger-eval.json` (non letti, non confrontati con l'eventuale equivalente in `.claude/skills/zero-pending-loop/evals/`).

**Corpus fuori dal Lotto A, citato solo per verifica incrociata, non censito qui**: `docs/architecture/adr/0004_no_docker_native_postgresql.md`, `0023_data_source_doctrine.md`, `0038_the_database_is_self_sufficient.md` e `docs/kb/SOT_STATE.md` sono stati consultati **solo con Grep** (ricerca di `rbp_pages`/`heuresys_evo_platform_db`/`heuresys_evo_api_gateway`) per verificare le citazioni della sezione Sospetti superati, non letti per intero: appartengono ad altri lotti del censimento generale e restano a carico di quelle passate.

**File `.claude/skills/project-atlas/` e `.claude/skills/zero-pending-loop/`** sono stati letti solo per il confronto byte-a-byte con le copie `.agents/` (via `diff`), non digeriti singolarmente come documenti propri: non sono nel Lotto A (sono sotto `.claude/`, presumibilmente coperti da un altro lotto del censimento generale, essendo tracciati da git a differenza delle tre directory di questo lotto).

**Nessuna directory del Lotto A e' stata dichiarata "non letta per volume"**: 260 file, tutti di dimensione contenuta (il piu' grande, `zero-pending-loop/README.md`, e' 496 righe), lettura completata in questa sessione senza necessita' di ulteriore parallelizzazione.
