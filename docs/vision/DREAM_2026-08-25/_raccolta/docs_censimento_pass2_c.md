# Censimento pass-2 — Lotto C: docs/superpowers + docs/source_bundle + docs/kb/improvement + docs/github + docs/wargames + .codex-review

> Seconda passata. La prima (`docs_censimento.md`) ha coperto l'inventario Fase A (path/dimensione/data/titolo) per l'intero repo, incluse queste sei directory, e non va rifatta qui. Questo documento aggiunge il livello che mancava: lettura effettiva, ruolo, digesto, e le quattro sezioni di analisi richieste (sospetti superati, contraddizioni, menzioni di funzionalità, lacune).
>
> Metodo di lettura dichiarato per fascia di volume: i file brevi (piani/spec/prompt/report di sessione, dossier, review) sono stati letti **per intero**. I file lunghi e fortemente ripetitivi nella struttura (i 23 processi FIN_BANKING, i 34 capitoli del corso GitHub, i ~50 report/adversarial/lezioni di `.codex-review` con timestamp quasi-duplicati, i mission-brief `tasks/*` dei wargame) sono stati letti per **intestazione + struttura + corpo campionato** (apertura, sezioni Headline/TL;DR/Raccomandazione dove presenti) — è dichiarato per ciascun gruppo in "Lacune dichiarate", non nascosto in un'esclusione.

## Conteggio (comando + numero per directory + delta vs prima passata)

Comandi eseguiti in questa sessione, 2026-08-25:

```
find docs/superpowers -name "*.md" | wc -l                                              → 82
find docs/source_bundle -name "*.md" | grep -v '/brownfield/extracted/' | wc -l          → 74
find docs/kb/improvement -name "*.md" | wc -l                                            → 39
find docs/github -name "*.md" | wc -l                                                    → 34
find docs/wargames -name "*.md" | wc -l                                                  → 27
find .codex-review -name "*.md" | wc -l                                                  → 68
```

| Directory | Prima passata (dichiarato nel mandato) | Questa sessione (misurato) | Delta |
|---|---:|---:|---:|
| `docs/superpowers/` | 82 | **82** | 0 |
| `docs/source_bundle/` (esclusa `brownfield/extracted/`) | 74 | **74** | 0 |
| `docs/kb/improvement/` | 39 | **39** | 0 |
| `docs/github/` | 34 | **34** | 0 |
| `docs/wargames/` | 27 | **27** | 0 |
| `.codex-review/` | 68 | **68** | 0 |

**Nessun delta.** I sei conteggi della prima passata (di ieri) sono confermati identici oggi: nessun file nuovo, nessuno rimosso, nessuno spostato dentro o fuori da queste sei directory nelle ultime 24h.

Sotto-conteggio `docs/superpowers/` per sottocartella (verifica di completezza): `analysis/` 2 · `prompts/` 4 · `plans/` 33 · `specs/` 43 → somma 82 ✓.


## Digesti — docs/superpowers/ (82 file)

Struttura: analysis/ (Cowork, ricognizioni preliminari) -> prompts/ (mandati Cowork verso CLI) -> plans/ (piani CLI) -> specs/ (design/referti CLI). Gerarchia di autorita dichiarata in analysis/README.md: docs/kb/ prevale su specs/ (referti misurati), che prevale su analysis/ (ricognizioni parziali, mai autoritative).

### analysis/ (2 file, letti per intero)

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| analysis/README.md | regola | Definisce la gerarchia di autorita delle 4 cartelle sorelle e la regola: le analisi non prevalgono mai su un referto, gia corretto in passato un caso reale. | No |
| analysis/2026-08-06-inventario-substrato-ai-rag.md | cronaca | Ricognizione Cowork del substrato AI/RAG (pgvector, agent-gateway, 17 strumenti MCP su 90+ moduli). Dichiara da se, in testa, quali suoi numeri sono stati smentiti dai referti successivi. | No (si dichiara da se) |

### prompts/ (4 file, letti per intero)

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| prompts/README.md | regola | Convenzione dei mandati: immutabili una volta consegnati, anche se contengono errori, perche l'errore spiega la divergenza nel referto successivo. | No |
| prompts/2026-08-06-catalogo-generico-corpus-concetti.md | cronaca | Mandato per test della ricerca semantica sui concetti + ADR del catalogo generico strumenti-agente; vincolo di sicurezza non negoziabile: nessun SQL diretto, solo endpoint /v1 con sessione inoltrata. | No |
| prompts/2026-08-06-substrato-semantico-verifica-e-correzioni.md | cronaca | Mandato di verifica del substrato pgvector/Voyage; il task di colmare i vettori mancanti e esplicitamente gated su ok separato di Enzo. | No |
| prompts/2026-08-07-percorsi-carriera-155.md | cronaca | Mandato per #155 (percorsi di carriera su posizioni morte, 207 righe rotte poi scoperte altre 97 su una seconda tabella); divieto centrale: non inventare corrispondenze morte-vive senza autorizzazione nominale. | No |

### plans/ (33 file - 11 letti per intero, 22 letti per apertura + struttura task/self-review, pattern fortemente ripetitivo)

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| 2026-05-28-cross-os-bootstrap.md | piano | Bootstrap idempotente cross-OS (Win/Mac/Linux); server VM gia fatto, workstation Mac/Win da creare; verificato live su 3 macchine. | No |
| 2026-05-28-zod4-ftpz6-migration.md | piano | Migrazione zod3-4 + ftpz4-6; lo spike empirico ha smentito 2 delle 3 ipotesi di rischio pre-formulate e ne ha trovata una nuova dominante (301/302 errori riconducibili a un solo root cause). | No |
| 2026-05-29-brand-fidelity-migration.md | piano | Piano di migrazione delle dashboard reali al design system canonico, per tipo di oggetto; contratto tipo-componente (PageHeader, DataTable, StatsCard). | No |
| 2026-06-03-bi-analytics-phase1.md | piano | Modulo analytics (workforce + KPI rollup), pattern 7-step, 2 endpoint /v1/analytics/*. | No |
| 2026-06-03-reconciliation-f0-triage.md | piano | Triage read-only di 65 tabelle sys.* vuote in bucket A/B/C/D con fan-out di 11 sub-agent; cita come vincolo hard la doctrine employee-centric I14/ADR-0024. | No |
| 2026-06-03-reconciliation-f1-registry.md | piano | Materializza il triage F0 in sys.sys_reconciliation_registry + sys.v_reconciliation_status; esito A:5 B:16 C:23 D:21. | No |
| 2026-06-05-i18n-monoblock-execution-plan.md | piano | Chiude l'intero milestone i18n (Fasi 2-5 + gate EN) in una sessione orchestrata con fan-out 4 aree; regola IT-byte-identico per non rompere 29 E2E. | No |
| 2026-06-05-sot-unification.md | piano | Collassa i file di stato duplicati in un'unica SoT per dominio; introduce la sezione Source of Truth in CLAUDE.md. | Si - v1 poi rivisto v2 (dichiarato nella spec gemella) |
| 2026-06-06-ai-semantic-matching-p1.md | piano | Backfill Voyage + modulo semantic-matching (/v1/matching/*), kNN puro lato server, nessuna chiamata Voyage in produzione. | No |
| 2026-06-10-s982-mega-batch.md | piano | Batch di 8 workstream in una sessione (import Wave-2/B-50, MFA SMS_OTP+TOFU, UI mfa-policy, ESS-media, color-contrast, engines) con attivazione mandatory-MFA su slice RTL. | No |
| 2026-06-20-goals-okr-module.md | piano | Espone Goals/OKR (tabelle dormienti dalla mig 000037: 1067 goals, 20 OKR) come API+UI; pattern 7-step canonico. | No |
| 2026-06-21-gtm-front-door-landing-lead-capture.md | piano | Prima consegna GTM: landing pubblica / + form lead con honeypot e consenso, tabella sys_leads. | No |
| 2026-06-22-gtm-investor-onepager-and-guided-demo.md | piano | Seconda/terza consegna GTM: /investors (teaser, no cifre) + /demo guidata, endpoint pubblico platform-stats. | No |
| 2026-07-06-project-atlas-skill.md | piano | Costruisce la skill project-atlas (4 modi: status/refresh/query/dossier) che deriva a runtime i target di sweep, mai hardcoded. | No |
| 2026-07-26-z261-mfa-fixture-secret-rotation.md | piano | Piano NON eseguito di rotazione di 7 segreti TOTP di test in chiaro in un file scaricabile da repo pubblico; richiede autorizzazione step-by-step. | Da riverificare (dichiarato non eseguito alla data del file) |
| 2026-07-26-z262-accesso-derivato-tutti-gli-utenti.md | piano | Piano parzialmente eseguito (chiave madre + comando di consultazione fatti) per dare accesso derivato a 162 utenti; step 3 (scrittura in produzione) richiede autorizzazione non ancora concessa alla data del file. | Da riverificare |
| 2026-07-27-rtl-storia-36-mesi.md | piano | Piano di popolamento integrale 36 mesi di storia RTL Bank per cluster di business, trattata come dato reale (ADR-0026); stato vivo altrove (.storia36/PROGRESS.md). | No |
| 2026-08-07-165-sganciare-il-deploy-e-provare-la-catena-in-locale.md | piano | Disaccoppia il deploy dalla chiusura sessione + introduce la prova generale locale prima del push sulle migrazioni. | No |
| 2026-08-08-batch-interrotti-e-p1.md | piano | Batch dichiarato esplicitamente non chiudibile in una sessione (18-25 sessioni stimate); confine dichiarato in apertura. | No |
| 2026-08-08-tre-domande-aperte.md | piano | Le tre domande aperte di S1049 risolte per misura, non per preferenza; "la misura ha smentito il piano tre volte". | No |
| 2026-08-10-batch-p1-s1053.md | piano | Batch #124 + P1 (esclude #76); indagine preliminare read-only a 6 dossier paralleli. | No |
| 2026-08-11-cancello-verifica-s1054.md | piano | Rimuove il freno .zp/verify-off e ripristina il cancello di verifica; la misura preliminare smentisce tre affermazioni del registro prima di toccare nulla. | No |
| 2026-08-11-ciclo-g-124-183-s1054.md | piano | Ciclo G: residuo #124 (D4+D6) + #183; dichiara "non entra tutto" e ordina G1-G10 per valore. | No |
| 2026-08-11-ciclo-h-clone-linux-pc-s1054.md | piano | Verifica che il clone linux-pc sia allineato a produzione, dopo un'obiezione di Enzo; misura preliminare: VM e clone coincidono su tutte le metriche strutturali. | No |
| 2026-08-12-batch-p1-p2-s1055.md | piano | Batch #183+#124+tutto P2, 14 voci misurate sul vivo da un fan-out parallelo; #54 recruiting/ATS dichiarato fuori sessione (5-7 sessioni). | No |
| 2026-08-13-batch-p2-completo-s1056.md | piano | Batch #182 + P2 residuo; introduce un "criterio di capienza" misurato invece che a impressione, su richiesta esplicita di Enzo. | No |
| 2026-08-14-batch-p1p2p3-s1058.md | piano | Batch P1+P2+P3+debiti+3 domande aperte, con #76 in HOLD; budget misurato in apertura. | No |
| 2026-08-14-batch-s1059.md | piano | Batch "D-83 poi il resto"; le voci multi-sessione avanzano di una fase alla volta con commit atomico; il batch si ferma quando il guardiano lo impone. | No |
| 2026-08-14-s1060-b-f4-residuo-e-lacune.md | piano | Ciclo S1060-B: #99 F4 (estensione soglia di catena) + lacune formative senza nome; F5 dichiarato fuori sessione. | No |
| 2026-08-14-s1060-sblocco-deploy.md | piano | Sblocca il deploy fermo dal 14 agosto (CI-ROSSA, 1 test su 241 falliti); confine: completabile, unico prerequisito esterno l'autorizzazione al push. | No |
| 2026-08-14-s1061-batch-integrale.md | piano | Batch integrale P1+P2+P3+debiti aperti; mandato di piena autonomia; menu stimato ~2,8M token contro 918k di contesto disponibili - sproporzione dichiarata in apertura. | No |
| 2026-08-15-92-f6-frontend-valutazione.md | piano | #92 F6 - frontend del ciclo di valutazione; precondizione verificata (non assunta): 9+1 endpoint gia esistenti da F3/F4/F5. | No |
| 2026-08-18-s1070-rossi-minori-e-217.md | piano | Chiude 2 rossi minori del boot poi affronta #217 fase I3 (delle 6 fasi residue I3-I8). | No |

### specs/ (43 file - 6 letti per intero, 37 letti per apertura + sezione TL;DR/Raccomandazione dove presente)

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| 2026-05-28-cross-os-bootstrap-design.md | spec | Design approvato del bootstrap cross-OS; DB centrale VM + tunnel, workstation on-demand. | No |
| 2026-05-30-rtl-tenant-rebuild.md | spec | Problema: DB con 433 utenti su 3 aziende fittizie + set sintetico; obiettivo collassare a 2 tenant reali. Esecuzione deferita a sessione fresca, nulla di distruttivo eseguito alla data. | No |
| 2026-05-30-rtl-tenant-rebuild-import-design.md | spec | Proposta di import-design, sola enumerazione read-only; 6 decisioni RISOLTE con backup pre-rebuild dichiarato. | No |
| 2026-06-03-ai-semantic-matching-design.md | spec | Design capability 2: motore di matching semantico; un solo substrato di embedding condiviso, ogni scenario e una query di similarita additiva. | No |
| 2026-06-03-bi-analytics-design.md | spec | Design capability 1: fondazione BI/analytics dimensionale, drill-down additivo al modulo dashboard esistente. | No |
| 2026-06-03-platform-capabilities-roadmap.md | spec | Programma approvato delle 5 capability AI data-mining scraping CMS BI; dichiara i dati come sintetici e no PII ADR-0023 come premessa. | Si, il linguaggio no-PII/sintetico e stato ritirato dalla OUTPUT RULE S1011 in CLAUDE.md; questo file precede quella decisione |
| 2026-06-03-reconciliation-closure-design.md | spec | Design approvato: porta ogni tabella sys.* vuota a uno di 4 stati terminali; supersede il framing aperto di un doc precedente. | No |
| 2026-06-04-i18n-milestone-design.md | spec | Design i18n IT-default+EN; solo login/page.tsx usava react-i18next su 71 pagine al momento della scrittura. | No |
| 2026-06-05-sot-unification-design.md | spec | Contiene la propria revisione interna: v1 implementato poi rivisto, il paragrafo 11 e il design v2 autoritativo. | Si, dichiarato nello stesso documento |
| 2026-06-07-cms-design.md | spec | Design capability 4 CMS: store contenuti versionato tenant-scoped; le 8 decisioni di design tutte risolte con default best-practice. | No |
| 2026-06-07-data-mining-design.md | spec | Design capability 3: motore di scoring in-piattaforma; un solo residuo umano, pesi e soglie della regola di derivazione. | No |
| 2026-06-07-scraping-design.md | spec | Design capability 5: ingestione solo da fonti ufficiali ESCO ISTAT ATECO CCNL via API pubbliche; raccomanda esplicitamente contro lo scraping web arbitrario. | No |
| 2026-06-16-reporting-export-design.md | spec | Design reporting/export: un solo hook onSend globale trasforma ogni endpoint lista in CSV XLSX PDF, zero-touch sulle circa 85 route. Stato approvato poi implementato. | No |
| 2026-06-17-bpm-approval-flow-design.md | spec | Design capability BPM slice-D: primo runtime BPM eseguibile, approval-flow generico; prima di questo solo catalogo e modeling. | No |
| 2026-06-17-surveys-engagement-ui-design.md | spec | Mini-milestone survey/engagement UI: admin read-only + scrittura self-response ESS net-new; cluster survey gia shippato e live. | No |
| 2026-06-18-bpm-approval-slice2-3-design.md | spec | Slice-2 catene multi-livello ordinate shippata S996; slice-3 SLA e apply-effect progettata come residuo onesto multi-sessione. | No |
| 2026-06-19-integrazione-llmwiki-hrplus-heuresys-design.md | spec | Blueprint di alto livello per fondere heuresys con llm_wiki (RAG documentale) e human-resources-plus (assistenti HR) in un solo sistema. | No |
| 2026-06-19-product-sot-consolidation-design.md | spec | Design del consolidamento della documentazione di prodotto in una unica SoT centrata su una guida-alla-verifica funzionale; nota che il catalogo di capacita latenti e wiki-derived, in parte legacy. | No |
| 2026-06-20-handoff-rigor-and-hold-lane-design.md | spec | Design del rigore di handoff piu corsia HOLD pull-based; stato IMPLEMENTED, dichiara quali estensioni restano opzionali. | No |
| 2026-06-21-gtm-front-door-landing-lead-capture-design.md | spec | Design della prima consegna GTM: landing pubblica come front-door condiviso investor-customer, tre wedge di posizionamento. | No |
| 2026-06-22-gtm-investor-onepager-and-guided-demo-design.md | spec | Design seconda e terza consegna GTM; stato IMPLEMENTED and live; funding ask teaser senza cifre per decisione esplicita di Enzo. | No |
| 2026-06-30-two-axis-authorization-model-design.md | spec | Design tecnico del modello di autorizzazione a due assi, companion di ADR-0027; risolve il difetto D-50, manager legge dati sensibili tenant-wide. | Si, ADR-0027 e superseded da ADR-0036 secondo CLAUDE.md corrente, non citato qui |
| 2026-07-01-f3-sensitive-modules-map.md | spec | Mappa generata da workflow a 16 agenti: 13 risorse sensibili con leak cross-user da correggere, pattern uniforme gia shippato. | No |
| 2026-07-06-project-atlas-skill-design.md | spec | Design approvato della skill project-atlas: fasi CONOSCENZA e PRODOTTO; il BUILD degli item resta fuori perimetro. | No |
| 2026-07-25-delivery-loop-skill-design.md | spec | Superseded esplicitamente in testa dal design successivo zero-pending-loop-design, conservato solo per la matrice di copertura riusata. | Si, dichiarato nello stesso file |
| 2026-07-25-zero-pending-loop-design.md | spec | Design del motore e driver per zero pendenze in autonomia non presidiata; implementato ma l'autorizzazione a girare non presidiato non e stata concessa. | No, stato dichiarato esplicitamente |
| 2026-07-25-zero-pending-plan.md | spec | Piano zero pendenze costruito da 10 agenti di censimento indipendenti piu 3 verificatori adversarial; 497 voci mappate, 0 perse, 0 inventate. | No |
| 2026-07-26-organizational-model-and-role-derivation-design.md | spec | Blocco di lavoro sul modello organizzativo; enuncia la regola che la SoT e l'organigramma e i ruoli RBAC si popolano da li. | No |
| 2026-07-27-claude-ecosystem-harmonization-plan.md | spec | Analisi con 12 agenti sulla sovranita fra i documenti di regola dell'ecosistema Claude; nessuno dei 7 documenti dichiara come si risolve un disaccordo fra loro. | No |
| 2026-08-02-p2-batch-execution-plan.md | spec | Piano di esecuzione batch P2 e P3, effort sommato circa 21-28 sessioni; ogni voce indipendente con commit atomico e prova live. | No |
| 2026-08-03-consegna-lab-esecuzione.md | spec | Esecuzione di una consegna arrivata dalla sessione lab; V0-V5 completabili in sessione, V6 dichiarato 2-3 sessioni e non chiuso qui. | No |
| 2026-08-04-consegne-lab-13.md | spec | 13 consegne del lab, stima 20-30 ore, non completabili in sessione; due decisioni retributive misurate sul DB vivo prima dell'applicazione. | No |
| 2026-08-04-esecuzione-lab-inbox-e-organigramma.md | spec | Installazione lab_inbox piu ingestione 13 consegne piu applicazione di 8 migrazioni per la ricostruzione dell'organigramma. | No |
| 2026-08-04-perimetri-test-dopo-ricostruzione.md | spec | Consegna sospesa da Enzo: i test di autorizzazione descrivevano un organigramma precedente nominando 3 persone a mano. | No |
| 2026-08-05-debiti-aperti-S1045.md | spec | Chiusura debiti aperti, 5 al boot D-72 D-56 D-79 D-80 D-78; un item dichiarato indagine, non necessariamente un fix. | No |
| 2026-08-05-perimetri-test-esecuzione.md | spec | I test di perimetro tornano a descrivere l'organigramma di oggi; prima voce misura 24 file e 81 test rossi su una corsa completa. | No |
| 2026-08-06-catena-migrazioni-stabile-S1045.md | spec | La catena di migrazioni smette di disfare lavoro fatto; il filtro ovvio proposto inizialmente sarebbe stato un disastro, misurato prima di implementarlo. | No |
| 2026-08-06-chiusura-dottrina-dubbio-e-diario.md | spec | Perimetro deliberatamente ridotto rispetto a un documento d'origine da 7 voci, per una statistica che non regge. | No |
| 2026-08-06-ritrattazione-consegne-lab-e-mfa-produzione.md | spec | Analisi adversariale di due consegne del lab prima di eseguirle; un item, triage di 27 voci, dichiarato parzializzabile senza fingere completezza. | No |
| 2026-08-06-substrato-semantico-verifica-e-correzioni.md | referto | Il substrato semantico risponde e risponde bene; il salto-per-hash ora confronta anche il modello; 39 vettori mancanti colmati su autorizzazione esplicita. | No |
| 2026-08-07-catalogo-generico-referto-di-programma.md | referto | Referto di programma: substrato sano, catalogo agente troppo stretto, 17 su oltre 90 moduli; la strada per allargarlo progettata ma non percorsa. | No |
| 2026-08-07-percorsi-carriera-155.md | referto | Tutti e 4 i task completati; il guasto era piu esteso del dichiarato, 207 piu 97 righe su due tabelle distinte; rollback collaudato. | No |
| 2026-08-13-batch-S1057.md | spec | Batch S1057: pagina di revisione risposte piu predizioni; introduce il calcolo esplicito del ritmo di consumo per stimare il residuo di sessione. | No |

## Digesti — docs/source_bundle/ (74 file, esclusa brownfield/extracted/ gia esclusa dal mandato)

Giacimento fondativo pre-costruzione: il "Bootstrap Pack" v3-v5 con cui il progetto e partito a maggio 2026. Descrive l'architettura target prima che venisse scritta una riga di codice reale. Tutto letto per intero, tranne i 23 processi FIN_BANKING che seguono un template identico (letti per struttura e apertura, dato il volume: uno solo, il 14, e stato letto per intero data la sua rilevanza HRMS).

### Radice + config (4 file, letti per intero)

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| README.md | intento | Descrizione del bundle v3-v5: framework generalizzabile HRMS/BPM con FIN_BANKING come industry reference; enterprise di riferimento 158 dipendenti, 5 filiali. | No, e un artefatto storico di partenza dichiarato tale |
| INDEX.md | intento | Indice canonico dei 23 processi FIN_BANKING piu i documenti bootstrap_agent, seed_acquisition, brownfield_adaptation. | No |
| ISTRUZIONI.md | intento | Istruzioni di installazione idempotente del bundle (apply_bundle.py/.ps1/.sh) su una cartella target. | No |
| LOGICAL_DATA_MODEL_ADDENDUM.md | intento | Elenco di nomi logici di entita per 6 domini (universale, KPI, learning, workforce intelligence, career/succession, compensation); avverte esplicitamente che vanno convertiti alle convenzioni sys.sys_* prima della generazione SQL. | No |

### bootstrap_agent/ (15 file, letti per intero)

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| AI_CODING_AGENT_BOOTSTRAP_PROMPT.md | intento | Prompt originario per l'agente di coding: Position, non Employee, come oggetto centrale; sys.sys_tenancies + sys.sys_users; sys.sys_user_position_assignments come tabella-ponte, mai un solo position_id su sys_users; scope esplicitamente fuori: Core HR, payroll, time-attendance, benefits, procurement, IAM, facilities. | Vedi contraddizione con storia36 in sezione dedicata |
| AUTH_STACK_SPEC.md | intento | Stack auth target: sys.sys_auth_identities/credentials/sessions/refresh_tokens/login_events/password_reset_tokens/mfa_factors/roles/permissions/role_permissions/user_auth_roles; 8 ruoli bootstrap PLATFORM_ADMIN..READ_ONLY. | No, ma i nomi tabella target divergono dal reale (11 tabelle sys_auth_* con schema diverso, vedi CLAUDE.md I7) |
| BACKEND_API_STACK_SPEC.md | intento | Stack backend target: Node/TS/Express-o-Fastify/Postgres/Zod/Argon2/JWT; endpoint minimi elencati per auth/tenants/users/positions/processes/skills/kpis/learning/gap-analysis/career-succession/compensation-intelligence. | No |
| DBMS_BOOTSTRAP_SPEC.md | intento | Specifica PostgreSQL: schema sys, tabelle sys.sys_*, 21 migrazioni ordinate 000001-000021 (poi 000022-000026 per il brownfield v5); seed di riferimento 158 utenti sintetici, 5 filiali, 25 assegnazioni filiale. | No |
| FRONTEND_STACK_SPEC.md | intento | Stack frontend target: Next.js/TS/Tailwind/shadcn-ui/RHF/Zod/TanStack Query; primo milestone: login, dashboard shell, liste tenant/utenti/posizioni, browser processi, browser tassonomia skill. | No |
| REPOSITORY_STRUCTURE.md | intento | Struttura di repository pulita raccomandata (docs/db/apps/packages/tests/qa_artifacts) — template generico, non la struttura reale del repo odierno. | No |
| SECURITY_AND_PRIVACY_BOUNDARIES.md | regola | Confine chiave: il sistema puo contenere dati personali ma non deve diventare un dossier dipendente incontrollato. Fuori scope bootstrap: dati medici/anamnestici, dati familiari dettagliati, payroll, benefit, disciplinare/legale. Stati di governance AI: CANDIDATE/SYSTEM_PROPOSED/DOMAIN_VALIDATED/HR_VALIDATED/MANAGEMENT_APPROVED/REJECTED. | No |
| checklists/ACCEPTANCE_TESTS.md | intento | Checklist di accettazione del bootstrap: repository, database, tenant di riferimento, API, frontend, seed acquisition, visualizzazione, brownfield. | No |
| specs/AUTH_POLICY_MATRIX.md | intento | Matrice permessi x 8 ruoli bootstrap; MANAGER ha visibilita ristretta su compensation, USER solo self. | No |
| specs/FRONTEND_ROUTE_MAP.md | intento | Mappa di route target per la console admin/blueprint: /tenants, /blueprints, /organization, /users, /positions, /skills, /kpis, /learning, /gaps, /career-succession, /compensation-intelligence, /visualizations, /seed-acquisition, /admin/roles. | No |
| specs/GRAPH_VISUALIZATION_MODEL_SPEC.md | intento | Modello di visualizzazione grafo generico (org chart, process flow, career path, learning path, skill gap map, succession map, KPI cascade); principio: la visualizzazione non e mai la fonte di verita, e una proiezione. | No |
| specs/LEARNING_CATALOG_AND_GAP_CLOSURE_SPEC.md | intento | Catena Position Skill Requirement -> Skill Gap -> Learning Recommendation -> ... -> Readiness Update; distingue modulo (riusabile) da iniziativa (erogazione concreta). | No |
| templates/README_TEMPLATE.md | intento | Template minimale di README per il repository pulito bootstrappato. | No |
| TENANT_USER_PROFILE_MODEL.md | intento | Separazione concettuale Tenant/User/Auth-identity/Profile/Evidence/Position; elenco esplicito di cio che sys.sys_users NON deve contenere (password, dati famiglia, salute, storia formativa, esperienza, certificazioni, documenti, payroll, benefit). | No |
| UPDATED_MIGRATION_PLAN.md | intento | Piano di migrazione 000001-000023 (poi +000024-000026 v5 brownfield); elenco puramente descrittivo, mai eseguito con questi nomi/numeri nel repo reale (il repo reale ha oltre 290 migrazioni con nomi diversi). | No, e coerente sapere che e un piano iniziale mai eseguito alla lettera |

### brownfield_adaptation/ (9 file, letti per intero) + db/migration_skeletons/README.md (1 file)

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| BROWNFIELD_ADAPTATION_MAP_TEMPLATE.md | intento | Template della matrice di adattamento legacy-verso-target (tabella esistente, dominio, tabella target, strategia, scope, priorita). | No |
| BROWNFIELD_AI_AGENT_TASK.md | regola | Compito per l'agente: trattare db-export.zip come fonte di arricchimento, mai come schema target; divieti espliciti (no vecchie policy RLS, no payroll/benefit/medico/attendance/dati bancari/SAP HR grezzo). | Vedi contraddizione con storia36 in sezione dedicata |
| BROWNFIELD_EXCLUSION_RULES.md | regola | Esclusione sempre dal bootstrap canonico: employees_pii, employees_payroll, employee_bank_details, employee_benefits, employee_pay_stubs, employee_attendance, medical_certificates, SAP HR grezzo, RLS, sessioni runtime. | Vedi contraddizione con storia36 in sezione dedicata |
| BROWNFIELD_IMPORT_PIPELINE_SPEC.md | intento | Pipeline: estrazione metadata -> registro sorgente -> mappa di adattamento -> classificazione -> staging -> validazione -> approvazione -> upsert idempotente -> lineage. | No |
| BROWNFIELD_IMPORT_STRATEGY.md | regola | Principio cardine: la nuova architettura resta canonica, il vecchio DBMS diventa fonte di cataloghi/mappature/candidati; nessun record legacy entra in sys.sys_* senza lineage+mappatura+validazione+approvazione+chiave naturale+upsert idempotente. | No |
| BROWNFIELD_IMPORT_WAVES.md | intento | Quattro onde di import raccomandate: Wave1 cataloghi a basso rischio (ESCO/processi/KPI/corsi), Wave2 modello operativo tenant, Wave3 evidenza persona sintetica-solo, Wave4 intelligence avanzata come template candidati; mai senza approvazione speciale: PII/payroll/benefit/dati bancari/certificati medici/attendance/SAP HR/RLS/sessioni. | Vedi contraddizione con storia36 in sezione dedicata |
| BROWNFIELD_LINEAGE_MODEL.md | intento | Tabella canonica sys.sys_source_lineage_records con chiave naturale tipo OLDDB::tabella::id; obbligatoria per ogni record derivato dal brownfield. | No |
| BROWNFIELD_TABLE_CLASSIFICATION_RULES.md | regola | 4 categorie IMPORT/TRANSFORM/REFERENCE_ONLY/EXCLUDE; regola non negoziabile: dati sanitari/bancari/payroll/benefit/attendance/HR sensibile grezzo vanno sempre EXCLUDE salvo revisione legale futura esplicita. | Vedi contraddizione con storia36 in sezione dedicata |
| BROWNFIELD_VALIDATION_CHECKLIST.md | regola | Checklist pre-applicazione: sorgente classificata e non esclusa, chiave naturale + hash + confidenza, target in schema sys, nessuna violazione tenant/FK, lineage presente, candidato validato e approvato. | No |
| db/migration_skeletons/README.md | governance-esterna | Nota interna al repo (non originale del bundle) che dichiara esplicitamente: i 27 skeleton con 29 TODO sono un artefatto storico, non un backlog; non implementarli, non cancellarli, non contarli come debito. | No, e gia la correzione dichiarata di un falso positivo passato |

### seed_acquisition/ (14 file: 6 documenti + 8 prompt di ricerca, letti per intero)

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| IDEMPOTENT_SEEDING_RULES.md | intento | Chiavi naturali obbligatorie per ogni seed (es. ESCO_SKILL::uri); upsert su ON CONFLICT ma mai sovrascrivere dati approvati da un umano con candidati a confidenza piu bassa. | No |
| PROMPT_TEMPLATE_LIBRARY.md | regola | I template dei 7 prompt sono per acquisizione controllata solamente, non autorizzano a navigare liberamente ne a inventare dati. | No |
| SEED_ACQUISITION_ENGINE_SPEC.md | intento | Motore di acquisizione seed candidati con pipeline obiettivo->registro fonti->prompt->estrazione->evidenza->confidenza->staging->validazione->approvazione umana->seed canonico; comandi CLI target seed:discover/validate/approve/apply mai implementati con questi nomi nel repo reale. | No |
| SEED_COMPLETENESS_BACKLOG.md | intento | Backlog logico per tracciare domini seed mancanti/parziali/candidati; principio: il seeding incompleto deve restare visibile, mai lasciato incompleto in silenzio. | No |
| SEED_STAGING_AND_APPROVAL_MODEL.md | regola | I record candidati non entrano mai direttamente nelle tabelle canoniche; solo approved_seed puo essere applicato. | No |
| SOURCE_OF_TRUTH_REGISTRY.md | regola | Tier di autorita delle fonti (TIER_1 autorita pubblica ufficiale fino a TIER_4 AI-suggerita non validata); ESCO prima di tutto per occupazioni/skill, CNEL per CCNL. | No |
| prompts/PROMPT_ATECO_NACE_RECONCILIATION.md | intento | Prompt di ricerca per riconciliare codici ATECO verso NACE via tabelle di corrispondenza ufficiali. | No |
| prompts/PROMPT_BANKING_KPI_RESEARCH.md | intento | Prompt per generare KPI candidati bancari da fonti regolatorie (Banca d'Italia, EBA, UIF). | No |
| prompts/PROMPT_CAREER_PATH_RESEARCH.md | intento | Prompt per identificare passi di carriera plausibili fra posizione corrente e target. | No |
| prompts/PROMPT_COMPENSATION_RULE_RESEARCH.md | intento | Prompt per regole di compensation intelligence; safeguard espliciti: nessuna decisione payroll finale, nessuna consulenza legale su retribuzione, nessuna grading CCNL non validata. | No |
| prompts/PROMPT_ESCO_OCCUPATION_DISCOVERY.md | intento | Prompt per trovare occupazioni ESCO candidate da titolo posizione interno, solo via API/portale ESCO ufficiale. | No |
| prompts/PROMPT_ESCO_SKILL_EXTRACTION.md | intento | Prompt per estrarre skill ESCO ufficiali collegate a una occupazione ESCO validata. | No |
| prompts/PROMPT_LEARNING_CATALOG_RESEARCH.md | intento | Prompt per identificare moduli di apprendimento candidati che chiudono un gap di competenza per una posizione. | No |
| prompts/PROMPT_POSITION_JOB_DESCRIPTION_RESEARCH.md | intento | Prompt per generare una job description candidata usando ESCO, contesto settoriale e vincoli di blueprint interni. | No |

### universal_hrms_framework/ (8 file U01-U08, letti per intero) — il cuore concettuale del bundle

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| U01_Position_Centric_HRMS_Architecture.md | intento | Architettura invariante: Position, non Employee, e l'oggetto centrale; catena Enterprise Type -> Processi -> Unita -> Posizioni -> Job Role -> Skill -> Learning -> KPI -> Assessment -> Gap -> Career/Succession -> Compensation. | No |
| U02_Position_Intelligence_Profile.md | intento | Il PIP e il modello di requisito completo di una posizione (skill richieste, proficiency, learning path, KPI, assessment, career path, succession, criticita, peso economico); descrive cosa la posizione richiede, mai cosa la persona possiede. | No, coerente con I9 nel CLAUDE.md reale (PIP e una VIEW, mai un blob) |
| U03_Skill_Taxonomy_Model.md | intento | Vocabolario controllato per categoria/natura/livello obbligatorio della skill; CORE_DOMAIN specializzato per industry (banking, manufacturing, healthcare, retail, logistics, software). | No |
| U04_KPI_Cascading_and_Assessment_Model.md | intento | Modello di cascata KPI Enterprise Strategy -> Process KPI -> Unit -> Position -> Employee -> Assessment -> Talent/Career/Compensation Intelligence; peso posizione deve sommare a 100%. | No |
| U05_Position_Based_Learning_Path_Model.md | intento | Catena Position -> Required Skills -> Required Proficiency -> Required Learning Modules -> Certifications -> Employee Learning Assignment; distingue modulo (riusabile) da iniziativa (erogazione concreta). | No |
| U06_Workforce_Intelligence_Gap_Analysis.md | intento | Motore analitico Position Requirement vs Person Evidence; modello criticita posizione (LOW..REGULATED_CRITICAL_ROLE); regola cardinale: mai confondere requisito con evidenza. | No |
| U07_Career_Talent_Succession_Model.md | intento | Distingue career planning (dove puo crescere una persona) da succession (chi copre una posizione critica); livelli di prontezza READY_NOW..NOT_SUITABLE. | No |
| U08_Compensation_Intelligence_Model.md | intento | Compensation intelligence esplicitamente NON esegue payroll ne amministra benefit; produce solo raccomandazioni e un record di handoff verso sistemi payroll esterni; modello di payout curve con reward gate (conduct/compliance/risk/audit). | No |

### industry_blueprints/FIN_BANKING/processes/ (23 file, 00-22; letto per intero solo il 14, gli altri 22 per struttura/apertura data l'estrema ripetitivita del template Document-Control/Overview/Objectives/Scope)

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| 00_Enterprise_Typing_and_Blueprint_Configuration.md | intento | Processo di ingresso: classificazione ATECO/NACE, riconciliazione semantica, typing dimensione/modello operativo, selezione blueprint. 1024 righe, il piu lungo dei 23. | No |
| 01_Current_Accounts_Management.md | intento | Processo bancario: ciclo di vita conti correnti retail/SME (apertura, gestione, restrizioni, chiusura). Non-HRMS, industry-specifico. | No |
| 02_Payments_and_Transactions_Management.md | intento | Processo bancario: pagamenti, bonifici, carte, addebiti diretti, riconciliazione. | No |
| 03_Cash_Operations_Management.md | intento | Processo bancario: cassa filiale, ATM, caveau, trasporto valori, quadratura. | No |
| 04_Deposit_Products_Management.md | intento | Processo bancario: depositi a risparmio, vincolati, certificati di deposito. | No |
| 05_Lending_and_Credit_Management.md | intento | Processo bancario: origine credito, valutazione, approvazione, servicing, monitoraggio, incasso, NPL. | No |
| 06_Customer_Relationship_Management.md | intento | Processo bancario: ciclo vita cliente, servizio, segmentazione, reclami, retention. | No |
| 07_Compliance_AML_and_Regulatory_Processes.md | intento | Processo bancario: KYC, AML, sanzioni, controlli compliance, reporting regolatorio. | No |
| 08_Risk_Management.md | intento | Processo bancario: rischio credito, operativo, liquidita, mercato, enterprise risk. | No |
| 09_Treasury_and_Finance.md | intento | Processo bancario: tesoreria, contabilita, controllo finanziario, ALM, chiusura, reporting. | No |
| 10_Digital_Banking_and_Channels.md | intento | Processo bancario: banking web/mobile/API, canali omnichannel. | No |
| 11_Sales_and_Commercial_Processes.md | intento | Processo bancario: pianificazione commerciale retail/SME, campagne, advisory, lead management. | No |
| 12_Branch_Operations.md | intento | Processo bancario: operazioni quotidiane filiale, front office, sicurezza, quadratura. | No |
| 13_Legal_and_Litigation.md | intento | Processo bancario: advisory legale, contratti, contenzioso, governance legale. | No |
| 14_HR_and_Internal_Services.md | intento | Il piu ampio (2212 righe): blueprint HRMS/workforce banking-grade completo, con marcatura esplicita per-sezione di cio che e out-of-scope (Core HR Admin, Time/Attendance/Payroll, Procurement/Vendor, IAM) vs in-scope (workforce planning, org design, talent/skills/learning/performance). Sezione 19 Future Evolution nomina esplicitamente Workforce Intelligence Graph, Digital Twin of the Organization, AI-Assisted Employee/Manager Experience, Process Mining, Compliance-by-Design HRMS come direzioni non ancora costruite. | Vedi menzioni di funzionalita e contraddizione storia36 |
| 15_IT_and_Banking_Technology_Operations.md | intento | Processo bancario: core banking, ITSM, cybersecurity, IAM, data pipeline, continuita tecnologica. | No |
| 16_Business_Continuity_and_Security.md | intento | Processo bancario: resilienza operativa, disaster recovery, gestione crisi, prevenzione frodi, sicurezza fisica/logica. | No |
| 17_AI_Augmented_Banking_Processes.md | intento | Processo bancario: assistenza AI a servizio clienti, frode, analytics, automazione, banking intelligence. | No |
| 18_KPI_Library_Cascading_and_Assessment_Model.md | intento | Versione banking-specifica di U04 (stesso contenuto, rinumerato Processo 14). | No |
| 19_Position_Based_Learning_Path_Management.md | intento | Versione banking-specifica di U05 (stesso contenuto, rinumerato Processo 15). | No |
| 20_Workforce_Intelligence_Gap_Analysis_and_Talent_Weighting.md | intento | Versione banking-specifica di U06 (stesso contenuto, rinumerato Processo 16). | No |
| 21_Career_Planning_Talent_Mobility_and_Succession.md | intento | Versione banking-specifica di U07 (stesso contenuto, rinumerato Processo 17). | No |
| 22_Compensation_Intelligence_and_Objective_Based_Reward_Input.md | intento | Versione banking-specifica di U08 (stesso contenuto, rinumerato Processo 18). | No |

## Digesti — docs/kb/improvement/ (39 file)

Programma forense "RELEASE 100X" (audit A1-A11 read-only, poi consolidamento in 14 dossier decisionali D-01..D-14, poi triage S1022 che verifica ciascuno contro lo stato reale del repo). Tutti letti per intero (top-level e DOSSIERS/) o per apertura+sezione Headline (FINDINGS/, dato il volume e la forte struttura ripetitiva finding-per-finding).

### File di programma, top-level (10 file, letti per intero)

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| 2026-06-13_heuresys-advanced-100x-kickoff-prompt.md | intento | Prompt di lancio del programma 100X: read-only sul codice, produce solo documenti; definisce 11 workstream di audit (WS-A..K) + WS-L ecosistema Claude + 14 dossier decisionali D-01..D-14. | No |
| AUDIT_PROTOCOL.md | regola | Protocollo forense vincolante: evidence-based sempre, granularita end-to-end codice-config-test-CI-deploy-doc, baseline misurata prima di ogni raccomandazione, nessuna modifica in fase A. | No |
| BASELINE_METRICS.md | stato | Baseline S-100X-0 (2026-06-13, HEAD 7e5b86d): 72 moduli API, 405 endpoint, 108 migrazioni, 901 test, footprint 31G on-disk. Dichiarato "snapshot orientativo, ri-misurare a ogni sessione che ne dipende". | Superato dalla stessa serie (i numeri sono gia stati aggiornati in TODO_100X e nei dossier, che citano 75 moduli/130+ migrazioni) |
| DOSSIERS_TRIAGE_S1022.md | stato | Triage S1022: verifica ciascuno dei 14 dossier contro lo stato reale (non contro la raccomandazione datata S993). Esito: 6 dossier gia DONE, 2 terminali (DEFER/WON'T), 3 inline-minori, 3 epiche genuine GO-BRANCH (D-08, D-09, D-14). | No, e la stessa correzione di stato |
| EPICS_SPEC_S1022.md | piano | Spec eseguibili delle 3 epiche GO-BRANCH: D-09 osservabilita (fasi 1-4 gia in main, gated OFF), D-08 CI/CD (DB-CI isolato, deploy-gate, cgroup, required-checks, 2 runner), D-14 provisioning+GDPR (provision-engine transazionale, GDPR minimo). | No |
| INTERVIEW_LOG.md | stato | Intervista iniziale: Enzo ha scelto asse dominante "Robustezza & operability", tolleranza breaking "aperta/radicale" ma appetite "evoluzione selettiva" — conciliazione: nessun invariante e pre-sacro ma la postura di default resta selettiva. | No |
| MASTER_PLAN_100X.md | piano | Piano madre: 5 assi (robustezza, velocity/DX, semplicita/footprint, UX-IX/perf, modernita — quest'ultima "non e un gap"); ciclo Recon->Audit->Consolidamento->Esecuzione; l'esecuzione NON e pre-autorizzata, ogni epica parte da un go esplicito. | No |
| TODO_100X.md | stato | Tracker machine-checkable dei QW; contiene una riconciliazione esplicita in testa ("questo tracker era stale") che segnala molti QW marcati TODO come in realta gia chiusi, con l'autorita reale spostata a SOT_BACKLOG. | Si, il file si auto-dichiara stale nella propria testata |
| WS-L_PLAN.md | stato | Findings dell'audit sull'ecosistema Claude (config always-loaded, plugin, memoria, hook); tutto design-only, nessuna esecuzione. CLAUDE.md globale = 7,8k token always-loaded con un blocco "CONTESTO MAC" per macchina gia ritirata. | Si, coerente con il fatto che il Mac e gia ritirato secondo lo stesso file |
| WS-L_TODO.md | piano | Tracker dei quick-win/dossier/note dell'audit ecosistema Claude, tutti "[ ] TODO in fase A", gated su go di Enzo; leve GLOBAL non propagano via git. | No |

### DOSSIERS/ (15 file: README + D-01..D-14, letti per intero — decisioni prese e i loro esiti)

| File | Ruolo | Digesto (regole/decisioni riportate alla lettera dove citate) | Sospetto superato? |
|---|---|---|---|
| README.md | stato | Registro dei 14 dossier, tutti marcati stato PENDING alla creazione (poi decisi nel triage S1022, vedi sopra). | No, coerente col triage successivo |
| D-01.md | intento | Runtime/linguaggio + module codegen. Raccomandazione: "Asse 1: niente migrazione di runtime; consolida lo stack. Asse 2: codegen come scaffold evolutivo dopo l'estrazione helper; runtime-factory CRUD non ora." Esito nel triage: DONE. | No |
| D-02.md | intento | Data layer raw SQL vs builder/ORM. Citazione: "stay raw + drop drizzle" gia eseguito e chiuso (QW-1/S989); residuo = solo il boilerplate del module-pattern (~28k LOC, ~150 dichiarazioni duplicate). Esito: DONE. | No |
| D-03.md | intento | Validazione/contratti Zod4+ftpz6. Citazione: "il lean Fase-0 e gia consumato: estrai withTransaction e fatto". Residuo: 78 subpath exports morte al 100%, agent-gateway non riusa i contratti Zod. Esito: GO-INLINE. | No |
| D-04.md | intento | Frontend client-only vs RSC/streaming. Citazione: "0 bug di correttezza o sicurezza da decidere"; l'unica decisione reale e l'intera app (authenticated) client-side (65/66 file). Esito: GO-INLINE (boundary loading/error). | No |
| D-05.md | intento | Design system @heuresys/ui: promozione StatusPill/FieldGrid + destino SystemHealthDashboard (mockup EN-hardcoded montato su route di produzione). Esito: DONE. | No |
| D-06.md | intento | Tooling/build pnpm+tsup, cache, affected. Citazione: "il problema numero 1 e la coda del runner unico (80-90% del wall-clock), non il compute". Esito: DEFER (accoppiato a D-08). | No |
| D-07.md | intento | Migration squash-to-baseline. Citazione: "il costo che lo squash eliminerebbe non esiste a runtime" — il deploy e gia O(pending) via sha-gate. Esito: WON'T-DO, valutato e respinto esplicitamente. | No |
| D-08.md | intento | CI/CD: runner SPOF + 0 rollback + fork-PR ACE su host di produzione (repo pubblico). Citazione: il CRITICAL fork-PR "e gia chiuso" (mitigato S988); residuo = pg_dump pre-deploy, DB CI separato, required-checks, 2 runner off-prod. Esito: GO-BRANCH. | No |
| D-09.md | intento | Osservabilita. Citazione: "il lean del recon (nessun /metrics app-level) e vero solo nel formato, non nella sostanza" — esiste gia un layer in-process ma volatile (azzera a ogni restart). Esito: GO-BRANCH, fasi 1-4 gia in main gated OFF (vedi EPICS_SPEC_S1022). | No |
| D-10.md | intento | Architettura applicativa monolite vs servizi. Citazione: "nessun finding indica un motivo per spezzare il monolite" — 0 CRITICAL/HIGH, 3 ASSET espliciti. Esito: DONE (monolite confermato; governare il solo boundary agent-gateway). | No |
| D-11.md | intento | Motore brownfield/ingestion (wave-executor, staging, registro riconciliazione). Citazione: "il motore e sano e completo, non un debito di correttezza" — riconciliazione a 0 stati aperti. Esito: GO-INLINE (freeze + lazy-mount). | Vedi menzione contraddizione: I12 (rubinetto brownfield chiuso) e successivo a questo dossier |
| D-12.md | intento | AI/embedding pgvector+Voyage. Citazione: "il seam che il lean proponeva di astrarre ESISTE GIA ed e pulito" (interfaccia Embedder gia iniettata via DI). Esito: DONE (conservativa ora, evolutiva gated su trigger F4-SuccessFactors o secondo modello). | No |
| D-13.md | intento | Auth self-built vs libreria vs managed. Citazione: "lo stack e un asset, non un debito" — nessun problema auth da riparare che giustifichi toccare l'architettura; residuo unico L2 = TOTP at-rest plaintext (gia pianificato). Esito: DONE, evolutiva event-driven su trigger SSO/SCIM reale. | No |
| D-14.md | intento | GTM/multi-tenant readiness. Citazione: "la base regge" (0 blocco sicurezza), "il gap reale non e l'isolamento, e l'assenza di self-service e GDPR-tooling". Aggancia la direzione gia decisa da Enzo in S987 (§3.1 IBRIDO). Esito: GO-BRANCH. | No |

### FINDINGS/ (14 file, letti per apertura + sezione Headline/testata — struttura finding-per-finding fortemente ripetitiva)

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| README.md | stato | Indice dei finding per workstream, con headline sintetica per ciascuno; rimanda a AUDIT_PROTOCOL per il template. | No |
| S-100X-0_recon.md | stato | Seed trasversale (3 sub-agent read-only) da cui sono nate le sessioni di audit per-WS; ogni finding va riverificato nella sessione A relativa. | No, dichiara da se di essere un seed non definitivo |
| WS-A.md | stato | Architettura: 5 workspace (agent-gateway fuori da build/lint/CI); 78 subpath export di @heuresys/shared morte al 100% (0 import su 256); dead-dep confermate; 0 dipendenze circolari, 0 moduli orfani (asset). | No |
| WS-B.md | stato | Backend: CRITICAL B-1 broadcast notifiche N+1 illimitato pilotato da admin (poi FIXED); 4 liste business senza LIMIT; costo boilerplate module-pattern 28.352 LOC; tenant-isolation/IDOR pulito confermato come asset. | No |
| WS-C.md | stato | Dati: 243/494 FK senza indice di supporto (56 sono tenant_id su tabelle grandi); crescita illimitata auth-audit senza pruning (46.348 righe per 9 utenti); backup/DR piu maturo di quanto WS-G suggerisse; dead-schema = ZERO. | No |
| WS-D.md | stato | Frontend: code-split chart incoerente (8/12 pagine eager-import EChartsCard, poi FIXED); intera app authenticated client-side (65/66 file), 0 RSC-fetch, 0 Suspense — trade-off cosciente non bug; doctrine live-data rispettata al 100%. | No |
| WS-E.md | stato | Design-system: doppio token rosso destructive/danger (danger e quello AA-retuned); SystemHealthDashboard triplo-difetto (no i18n, duplicato web/showcase, mockup su route di produzione); a11y gate serious=0 gia shippato. | No |
| WS-F.md | stato | Test&QA: la CI non gira mai la full E2E suite (solo smoke 5 scenari su ~200 test); zero unit-layer per la business-logic (104/134 file colpiscono il DB live); suite hard-coupled al tunnel SSH, nessun path offline. | No |
| WS-G.md | stato | CI/CD: CRITICAL nuovo non nel seed — repo pubblico + runner self-hosted sull'host PROD + trigger pull_request su 7/8 workflow = una fork-PR esegue codice attacker-controlled sul box di produzione; la CI lenta e quasi tutta coda, non compute; main senza required-checks. | No |
| WS-H.md | stato | Sicurezza applicativa: HIGH TRUST_PROXY=false default collassa il rate-limit per-IP in un unico bucket dietro nginx; SQL 100% parametrizzato, Zod su 415/415 route, 0 secret in log — asset forti confermati. | No |
| WS-I.md | stato | Documentazione: README congelato a v1.0.0/S957 con quasi tutti i conteggi headline drift (60 moduli dichiarati vs 75 reali, 55 migrazioni vs 130, ecc.); CLAUDE.md stesso ha drift numerico nonostante sia caricato ogni sessione; INDEX_PATHS stantio di 18 giorni. | Si, il file stesso documenta il drift di altri file — esempio concreto di documento-Stato superato dai fatti |
| WS-J.md | stato | Config&env: contratto env allineato post-S993; footgun z.coerce.boolean ancora vivo su 2 feature-flag (MATCHING_FREETEXT_ENABLED, API_DOCS_ENABLED) — scrivere "=false" letteralmente le attiva; TRUST_PROXY su PROD e config non gestita da nessuno script. | No |
| WS-K.md | stato | Repo hygiene: footprint rigenerabile cresciuto da 24G a 29G in 3 giorni (cache dev mai potata); 27 dump pre-op da 3,7G senza retention; 0 file generati tracciati (asset); nessun candidato LFS. | No |
| 3.2_ASVS_MAPPING.md | stato | Mappatura OWASP ASVS v4.0.3/v5.0 L1 sul modello di sicurezza reale, per capitolo (V1 architettura, V2 autenticazione...); dichiara esplicitamente cosa e fuori scope (CI/CD, supply-chain gia coperti altrove). | No |

## Digesti — docs/github/ (34 file — digesto di serie, come autorizzato dal mandato: corso personale su GitHub, non descrive il prodotto)

Curriculum GitHub per Enzo Spenuso sole-coder, ancorato ai due repo reali Spen-Zosky/heuresys-advanced e Spen-Zosky/ux-design-shared. Tutti i 34 file sono stati aperti (letti nell'incipit + struttura); nessuna riga vincolante o decisione di prodotto e stata trovata: e materiale formativo/reference. Elenco nominale integrale:

| File | Ruolo | Digesto |
|---|---|---|
| 00-glossario.md | corso | Glossario alfabetico dei termini GitHub con link alla doc ufficiale. |
| 08-roadmap.md | corso | Roadmap di adozione consigliata delle feature GitHub, in tier di priorita, prescrittiva non vincolante. |
| branch-protection.md | stato | Configurazione canonica di branch protection su main, stato ACCEPTED (S935), applicabile via gh api. |
| dependabot-triage-2026-05-26.md | cronaca | Procedura di triage Dependabot; dichiara esplicitamente che lo script di automazione originariamente bozzato non e mai stato implementato e il riferimento e stato rimosso invece di lasciarlo come promessa. |
| README.md | corso | Indice del curriculum, rivolto a Enzo sole-coder, ancorato ai due repo concreti. |
| 01-fondamenti/01-cosa-e-github.md | corso | I 5 pilastri di GitHub (hosting, collaborazione, automazione, distribuzione, identita developer). |
| 01-fondamenti/02-account-e-repo.md | corso | Impostazioni di account e repository, quali sono decisive. |
| 01-fondamenti/03-git-flow.md | corso | Workflow git pratico usato nei due repo reali. |
| 01-fondamenti/04-readme-e-markdown.md | corso | README come front-door del repo; GFM ed estensioni oltre CommonMark. |
| 02-collaborazione/01-issues.md | corso | Issue come sistema di tracking integrato, uso da sole-coder. |
| 02-collaborazione/02-branches.md | corso | Modelli di branching (Git Flow, GitHub Flow, trunk-based). |
| 02-collaborazione/03-pull-requests.md | corso | Meccanismo PR, discussione, review, check automatici. |
| 02-collaborazione/04-projects.md | corso | GitHub Projects v2, board Kanban/table/roadmap cross-repo. |
| 02-collaborazione/05-discussions.md | corso | GitHub Discussions come forum integrato, non attivo di default. |
| 03-automazione/01-actions-fondamenti.md | corso | Fondamenti GitHub Actions: workflow YAML su eventi. |
| 03-automazione/02-actions-ricette.md | corso | Ricette YAML pronte, contestualizzate sui due repo. |
| 03-automazione/03-secrets-e-variabili.md | corso | Secrets/variables/environments/OIDC per i workflow. |
| 03-automazione/04-workflow-storybook.md | corso | Deep dive riga-per-riga del workflow deploy-storybook.yml. |
| 04-publishing/01-pages-fondamenti.md | corso | Fondamenti GitHub Pages, hosting statico gratuito. |
| 04-publishing/02-pages-il-nostro-caso.md | corso | Walkthrough del setup Pages di ux-design-shared, con 2 fix reali documentati come case study. |
| 04-publishing/03-releases-e-tags.md | corso | Tag e Release come marcatori di stabilita. |
| 04-publishing/04-packages.md | corso | GitHub Packages come registry candidato per pubblicare @spen-zosky/ui. |
| 05-security/01-secret-hygiene.md | corso | .gitignore, secret scanning, push protection; un secret committato va sempre ruotato. |
| 05-security/02-dependabot.md | corso | Dependabot come primo automation di security da attivare. |
| 05-security/03-code-scanning.md | corso | Code scanning con CodeQL, gratuito su repo pubblici. |
| 05-security/04-signed-commits.md | corso | Commit firmati, GPG vs SSH, opt-in. |
| 05-security/05-branch-protection.md | corso | Branch protection rules vs Rulesets moderni. |
| 06-tooling/01-gh-cli.md | corso | Client gh CLI, gia usato decine di volte nelle sessioni reali. |
| 06-tooling/02-web-ui-tour.md | corso | Tour della Web UI, sezioni usate davvero vs ignorate. |
| 06-tooling/03-integrazioni.md | corso | Integrazioni VS Code/JetBrains/mobile/Desktop. |
| 07-nostri-repo/01-stato-corrente.md | stato | **Si auto-dichiara in testa "snapshot del 2026-05-17, non e piu lo stato corrente"** — esempio di documento che avverte da solo del proprio superamento. |
| 07-nostri-repo/02-heuresys-advanced.md | stato | Deep dive sul repo principale: settings, secrets, branch model proposto. |
| 07-nostri-repo/03-ux-design-shared.md | stato | Deep dive sul repo design system, 51 componenti, path verso pubblicazione npm. |
| 07-nostri-repo/04-interazioni-tra-repo.md | stato | I due repo sono fratelli non parent/child, comunicano via dipendenza npm. |

## Digesti — docs/wargames/ (27 file)

Esercizio di simulazione adversarial: Claude Fable 5 (Cowork) ha prodotto 8 "battle plan" mossa-per-mossa il 2026-07-06, poi sottoposti a review adversariale indipendente prima dell'esecuzione da parte della CLI. Directory self-contained: README+SUCCESS+LEDGER definiscono il metodo, tasks/ sono i brief originari, reviews/ le review indipendenti.

### Root (3 file, letti per intero)

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| README.md | regola | Come si usa la directory; mappa piano->voce di backlog; le patch delle review sono gia integrate nei piani. | No |
| LEDGER.md | stato | Un blocco per missione: self-grade contro SUCCESS.md, patch red-team, input attesi da Enzo. Riporta anche l'esito della "seconda ondata" di review indipendente su tutti gli 8 piani: 12 finding CRITICAL-class, ~20 MAJOR/MEDIUM, ~25 MINOR/LOW su ~150 claim spot-checkati. | No |
| SUCCESS.md | regola | Standard a 8 punti che ogni wargame deve rispettare (osservazione attesa, fallimento piu probabile, trigger di fork, RECON NEEDED, abort condition, verifica esplicita, sopravvivenza a un red-team pass, eseguibilita blind). | No |

### Battle plan (8 file NN-*.md, letti per intero) — tutti "intento": funzionalita progettate ma non ancora costruite alla data del piano

| File | Ruolo | Digesto | Sospetto superato? |
|---|---|---|---|
| 03-localai.md | intento | Setup AI locale multi-macchina (PC/Mac/VM), 100% offline, nessuna API terza parte; non riguarda il prodotto heuresys, riguarda le macchine di Enzo. | No |
| 11-heuresys-evidence.md | intento | Backlog #27 A/L2 — layer di evidenza sotto i punteggi (~5,3k righe dormienti: assessment/learning/360/feedback continuo/comportamentale/valutazioni) come drill-down "perche questo punteggio" su insights/gaps/reviews + ESS self-scope. | Si — SOT_BACKLOG attuale segna #27 come DONE (vedi menzioni funzionalita) |
| 12-heuresys-goals-okr.md | intento | Backlog #26 A/L1 — vita dei goal/OKR (~4,8k righe dormienti: update, check-in, milestone, commenti, allineamenti) come timeline in /goals, /okrs, /me/career. Zero migrazioni necessarie. | Si — SOT_BACKLOG attuale segna #26 come DONE |
| 13-heuresys-f4-activity.md | intento | Backlog #24 — asse funzionale/attivita di ADR-0027 (F4), con master-fork esplicito lasciato alla decisione di Enzo (route A task-model generico vs route B riuso goals). | Si — SOT_BACKLOG segna #24 come DONE (F4 risolto mig 000184, RULE-B) |
| 14-heuresys-provenance.md | intento | Backlog #28 A/L0 — Trust Ledger, API read-only su sys.sys_source_lineage_records (~70.972 righe oggi solo scrivibili) + 4a tab di /brownfield-adaptation, citabile per GTM (AI-Act/GDPR art.22). | Si — SOT_BACKLOG segna #28 come DONE |
| 15-heuresys-pricing.md | intento | Pagina pubblica /pricing (it+en); prezzi/tier dichiarati esplicitamente autorita esclusiva di Enzo, "non esistono ancora e vanno trattati come dati, mai inventati". | Non verificato se costruita — non risulta nell'elenco DONE cercato |
| 16-heuresys-approval-effects.md | intento | Backlog #34 B/B3 — primo handler reale di apply-effect delle approvazioni (TENANT_MATERIALIZATION), con proposta valutativa (non implementazione) dei prossimi 1-2 handler. | Si — SOT_BACKLOG segna #34 come DONE |
| 17-heuresys-wave3.md | intento | Backlog #17 — onboarding di due tenant legacy non-bancari (EcoNova 26 dip., SmartFood 82 dip.) come tenant di produzione reali; fork aperto A (programma multi-industry) vs B (mappatura reference single-industry), non deciso da Enzo alla data del piano. | **Si — RITIRATO (WON'T-DO) il 2026-08-14**: la direttiva di Enzo sul rubinetto brownfield chiuso (I12, «nessun dato del brownfield va rimesso in circolo») rende impraticabile l'intero piano, che prevedeva di riusare il legacy come sorgente. Vedi sezione Sospetti superati per le citazioni. |

### tasks/ (8 file, mission brief originari — letti per intero, ~30 righe ciascuno, wrapper identico)

| File | Ruolo | Digesto |
|---|---|---|
| tasks/03-localai.md | cronaca | Brief originario "WARGAME ORDER" per il setup AI locale; definisce il metodo di wargaming (mossa per mossa, fork con trigger), non il contenuto. |
| tasks/11-heuresys-evidence.md | cronaca | Brief per #27 evidence layer: recon obbligato su SOT_STATE/BACKLOG/DEBT_REGISTER + moduli scope prima di fight the mission. |
| tasks/12-heuresys-goals-okr.md | cronaca | Brief per #26 goals/OKR: recon sui moduli goals/okrs gia shippati (S999, mig 000142-144). |
| tasks/13-heuresys-f4-activity.md | cronaca | Brief per #24 F4: recon su ADR-0027 e le due spec di design gia esistenti sull'autorizzazione a due assi. |
| tasks/14-heuresys-provenance.md | cronaca | Brief per #28 provenance: recon sulla tabella lineage (~70.972 righe) e sulla pagina /brownfield-adaptation esistente. |
| tasks/15-heuresys-pricing.md | cronaca | Brief per la pagina pricing: recon sulle superfici GTM gia shippate (landing, /investors, /demo, LeadForm). |
| tasks/16-heuresys-approval-effects.md | cronaca | Brief per #34 approval-effects: recon sul registry effetti gia live (un solo handler oggi) e sul modulo tenant-materialization completo. |
| tasks/17-heuresys-wave3.md | cronaca | Brief per #17 Wave-3: recon sui dati legacy SmartFood/EcoNova e sulla tassonomia processi/KPI v5 nativa-banking. |

### reviews/ (8 file, review adversariali indipendenti — letti per intero)

| File | Ruolo | Digesto |
|---|---|---|
| REVIEW-03.md | report | Verdetto: REJECT AS-IS — non sicuro come scritto (poi patchato, vedi LEDGER: da 3/8 a 7-8/8). Il difetto piu grave: ogni gate di sicurezza-produzione controllava la porta 3001 ma l'API PROD reale ascolta su 8013 — abort falso garantito. |
| REVIEW-11.md | report | PASS-WITH-PATCHES. Difetto piu grave: il mascheramento privacy era ancorato alla colonna sbagliata (feedback_is_private invece di feedback_visibility DEFAULT PRIVATE) — avrebbe lasciato trapelare feedback privati a livello di tenant. |
| REVIEW-12.md | report | CONDITIONAL PASS (poi PASS patchato). "Zero migrazioni" confermato indipendentemente. Difetto: il recon psql puntava al DB heuresys invece di heuresys_advanced, avrebbe simulato un abort. |
| REVIEW-13.md | report | PASS-WITH-PATCHES. Difetto piu grave: la visibilita di default per i membri era strutturalmente irraggiungibile (activity:read escludeva proprio USER). |
| REVIEW-14.md | report | APPROVED WITH PATCHES, nessun finding CRITICAL o HIGH — il recon di questo piano e il piu accurato del lotto (16/16 claim verificate). |
| REVIEW-15.md | report | PASS-WITH-PATCHES. Il recon del piano pricing e il piu accurato della batch; conferma reale la "detonazione" di una migrazione (000153) al primo lead PRICING dopo il deploy. |
| REVIEW-16.md | report | NOT PASS as written, poi approvato dopo patch. Difetto piu grave: escalation di privilegio cross-tenant nell'handler — i ruoli tenant potevano materializzarsi su RTL_BANK bypassando il vincolo PLATFORM_ADMIN-only. |
| REVIEW-17.md | report | PASS-WITH-PATCHES (3 CRITICAL, 6 MAJOR, 6 MINOR su 26 claim). Difetto piu grave: il rollback pg_restore era rotto come scritto (permission-denied sotto /home/ubuntu) — stesso precedente gia visto in S993. |

## Digesti — .codex-review/ (68 file)

Superficie di governo permanente di Codex nel ruolo di Revisore Capo del progetto — non e materiale che Claude mantiene, ma va censito perche vive nel repository. Ruolo dichiarato in `governance-esterna` per tutta la directory: e la voce di un altro agente sul proprio lavoro di audit, non un documento di prodotto o di stato heuresys-advanced. Contenuto letto per apertura/struttura (molti file sono report/adversarial-pass/lesson con timestamp quasi-duplicati sullo stesso audit, fortemente ripetitivi nel template DRAFT->challenge->change-ledger->FINAL).

### service/access + INDEX (3 file, letti per intero)

| File | Ruolo | Digesto |
|---|---|---|
| INDEX.md | governance-esterna | Registro dei report Codex; struttura della directory (reports/evidence/work/adversarial/service). |
| service/access/README.md | governance-esterna | Modello di sicurezza del broker read-only Codex: valori segreti mai letti/stampati, transazioni DB READ ONLY, ricerca esclude .env/.secrets/.git/node_modules. |
| service/access/CLAUDE_INTEGRATION.md | governance-esterna | Regole esplicite per Claude: non riusare/ruotare la credenziale DB di Codex, non modificare il broker, non trattare .codex-review come SoT di prodotto. Coerente 1:1 con la sezione omonima in CLAUDE.md. |

### reports/ (27 file, letti per apertura/struttura — audit forensi di Codex sul repo, non su heuresys come prodotto)

| File | Ruolo | Digesto |
|---|---|---|
| 2026-07-28-code-review.md | governance-esterna | Review read-only; finding P0 su materiale segreto MFA presente in file versionati (relativo al setup Codex, non al prodotto). |
| codex-readonly-access-implementation_20260728T150157.265Z.md | governance-esterna | Implementazione del broker read-only Codex (SSH, lettura remota, query PostgreSQL READ ONLY). |
| codex-readonly-access-provisioned_20260728T152744.138Z.md | governance-esterna | Provisioning permanente dell'identita di audit codex_auditor su PostgreSQL OCI; canale bootstrap temporaneo rimosso. |
| codex-toolchain-self-learning_20260728T160720.976Z.md | governance-esterna | Toolchain Python self-learning per Codex su Windows; python nudo vietato, invocazione tramite wrapper dedicato. |
| db-api-frontend-field-forensic-audit_DRAFT_20260728T203738.282Z.md | governance-esterna | Draft di audit forense campo-per-campo DB->API->frontend, sottoposto a challenge adversarial. |
| db-api-frontend-field-forensic-audit_FINAL_20260728T205055.771Z.md | governance-esterna | Versione FINAL dello stesso audit, marcata dallo stesso Codex come DRIFTED (il repo si e mosso durante l'audit). |
| db-api-frontend-field-forensic-audit_FINAL-v2_20260728T205722.007Z.md | governance-esterna | v2 autoritativa che sostituisce senza cancellare la prima FINAL, assorbendo un residuo. |
| db-api-frontend-field-solution-proposals_DRAFT_20260728T204000.886Z.md | governance-esterna | Proposte di soluzione (progettuali, nessuna modifica applicata) derivate dall'audit campo-per-campo. |
| db-api-frontend-field-solution-proposals_FINAL_20260728T205252.325Z.md | governance-esterna | Versione finale delle proposte, dopo assorbimento delle modifiche adversarial. |
| forensic-access-control-audit_draft_20260728T143321.633Z.md | governance-esterna | Draft di audit forense su login/RBAC/accesso webapp. |
| forensic-access-control-audit_final_20260728T144025.165Z.md | governance-esterna | Versione finale dello stesso audit, working tree modificato durante l'audit da altri processi. |
| forensic-repo-audit-skill-update_20260728T154245.636Z.md | governance-esterna | Aggiornamento della skill globale Codex forensic-repo-audit con evidenza live least-privilege. |
| forensic-skill-adversarial_20260728T133537.427Z.md | governance-esterna | Review adversariale della skill Codex stessa (non del prodotto); reviewer indipendente. |
| forensic-skill-adversarial-addendum_20260728T133537.428Z.md | governance-esterna | Addendum che registra un proprio errore di processo (aggiornamento in-place non append-only) e il correttivo adottato. |
| forensic-skill-final-validation_20260728T140131.499Z.md | governance-esterna | Validazione finale della skill: READY con limite probatorio dichiarato (fingerprint metadata-only). |
| full-forensic-repository-audit_DRAFT_20260814T162254.058Z.md | governance-esterna | Draft di audit forense completo del repository (2026-08-14), baseline su due audit precedenti. |
| full-forensic-repository-audit_FINAL_20260814T162458.692Z.md | governance-esterna | FINAL dopo review adversarial a bassa indipendenza; dichiara esplicitamente "copertura misurata non completa". |
| full-forensic-repository-audit-drift-addendum_20260814T162709.321Z.md | governance-esterna | Addendum di drift: il finalizer segnala DRIFTED ma 9/10 confronti sono stabili, l'unica differenza e submodules=false. |
| rbac-db-api-frontend-audit-drift-addendum_20260728T181300.000Z.md | governance-esterna | Addendum di drift sull'audit RBAC/exposure: il commit osservato alla chiusura differisce da quello di apertura. |
| rbac-db-api-frontend-audit-drift-addendum-v2_20260728T180414.148Z.md | governance-esterna | v2 che corregge solo la cronologia del timestamp del precedente addendum. |
| rbac-db-api-frontend-exposure-audit_DRAFT_20260728T175000.000Z.md | governance-esterna | Draft dell'audit forense RBAC/interfacce/esposizione DB->API->frontend, congelato per review adversarial. |
| rbac-db-api-frontend-exposure-audit_FINAL_20260728T180700.000Z.md | governance-esterna | FINAL dopo assorbimento del challenge pass. |
| rbac-db-api-frontend-exposure-audit_FINAL-v2_20260728T181000.000Z.md | governance-esterna | v2 dopo verifica post-assorbimento. |
| rbac-db-api-frontend-exposure-audit_FINAL-v3_20260728T180414.082Z.md | governance-esterna | v3 dichiarata "AUTORITATIVA" dopo chiusura di challenge pass e verifica. |
| rbac-db-api-frontend-solution-proposals_20260728T175200.000Z.md | governance-esterna | Proposte tecniche read-only per rendere verificabile la catena persona->identita->ruoli->permessi->scope->interfaccia->route->endpoint. |
| rbac-db-api-frontend-solution-proposals_REVISED_20260728T180800.000Z.md | governance-esterna | Proposte revisionate dopo challenge pass. |
| rbac-db-api-frontend-solution-proposals_REVISED-v2_20260728T180414.145Z.md | governance-esterna | v2 che corregge solo la cronologia del timestamp; contenuto tecnico invariato. |

### adversarial/ (17 file, letti per apertura/struttura) + evidence/ (1 file) + service/learning/lessons/ (2 file)

| File | Ruolo | Digesto |
|---|---|---|
| adversarial/6de5b8c3..._blind-pass_20260728T172354.991Z.md | governance-esterna | Blind pass indipendente su identita/RBAC/interfacce/esposizione end-to-end, con fingerprint di commit dichiarato. |
| adversarial/6de5b8c3..._challenge-pass_20260728T175115.339Z.md | governance-esterna | Challenge pass adversarial finale sullo stesso audit. |
| adversarial/6de5b8c3..._change-ledger_20260728T180500.000Z.md | governance-esterna | Change ledger di assorbimento del challenge pass. |
| adversarial/6de5b8c3..._change-ledger-addendum_20260728T181100.000Z.md | governance-esterna | Addendum di chiusura di un blocker residuo (CR6). |
| adversarial/6de5b8c3..._change-ledger-addendum-v2_20260728T180514.379Z.md | governance-esterna | v2 cronologica dell'addendum, nessun artefatto storico eliminato. |
| adversarial/6de5b8c3..._change-ledger-v2_20260728T180514.290Z.md | governance-esterna | v2 cronologica del change ledger. |
| adversarial/6de5b8c3..._final-acceptance_20260728T180648.695Z.md | governance-esterna | Verdetto FINAL ACCEPT: la CR6 residua e chiusa. |
| adversarial/6de5b8c3..._post-absorption-verification_20260728T175914.468Z.md | governance-esterna | Verdetto RESIDUAL BLOCKER: 7/8 change request realmente assorbite. |
| adversarial/89a3e8f6..._adversarial-review_20260728T143752.671Z.md | governance-esterna | Review adversariale indipendente sull'audit login/RBAC/accesso webapp. |
| adversarial/93564b80..._adversarial-review_20260814T162428.913Z.md | governance-esterna | Review adversariale sull'audit forense completo del repository; indipendenza dichiarata LOW (stesso modello, contesto ridotto). |
| adversarial/93564b80..._change-ledger_20260814T162458.691Z.md | governance-esterna | Change ledger con 14 challenge, tutte accettate/parzialmente accettate. |
| adversarial/93564b80..._final-acceptance_20260814T162709.322Z.md | governance-esterna | Verdetto finale: 14/14 challenge adjudicate; alcuni finding restano solo ipotesi non gravi. |
| adversarial/e0fcd4ef..._blind-pass_20260728T202615.114Z.md | governance-esterna | Blind pass indipendente sull'audit campo-per-campo DB->API->frontend. |
| adversarial/e0fcd4ef..._challenge-pass_20260728T204555.654Z.md | governance-esterna | Challenge pass post-draft sullo stesso audit. |
| adversarial/e0fcd4ef..._change-ledger_20260728T204555.654Z.md | governance-esterna | Change ledger con gli esiti accettati/respinti delle challenge. |
| adversarial/e0fcd4ef..._final-acceptance_20260728T210111.760Z.md | governance-esterna | Verdetto ACCEPT: la revisione FINAL v2 assorbe integralmente il residuo. |
| adversarial/e0fcd4ef..._post-absorption-verification_20260728T205525.038Z.md | governance-esterna | Verdetto CHANGES_REQUIRED: 10/11 challenge assorbite, un residuo su schema probatorio. |
| evidence/89a3e8f6..._static-evidence_20260728T143321.633Z.md | governance-esterna | Evidenze statiche acquisite per l'audit accesso webapp (commit, branch, stato del working tree). |
| service/learning/lessons/python-path-and-pyyaml_20260728T155631.972Z.md | governance-esterna | Lezione appresa: Codex invocava python nudo invece dell'interprete verificato gia esposto; fix registrato per non ripetere l'errore. |
| service/learning/lessons/python-wrapper-stdout_20260728T172835.892Z.md | governance-esterna | Lezione appresa: il wrapper Python canonico restituiva exit 0 ma nessuno stdout al chiamante, per un difetto di assegnazione in PowerShell. |

### work/ (18 file, letti per apertura/struttura — file di servizio temporanei della skill Codex)

| File | Ruolo | Digesto |
|---|---|---|
| work/forensic-repo-audit-original_.../SKILL.md | governance-esterna | Prima versione della skill Codex forensic-repo-audit: audit tecnici/QA/security read-only, riproducibili. |
| work/forensic-repo-audit-original_.../references/audit-protocol.md | governance-esterna | Protocollo di audit v1: regole probatorie, domini obbligatori, census applicativi. |
| work/forensic-repo-audit-original_.../references/evidence-and-severity.md | governance-esterna | Stati probatori CONFIRMED/SUPPORTED/HYPOTHESIS/NOT-VERIFIED. |
| work/forensic-repo-audit-original_.../references/report-schema.md | governance-esterna | Schema dei deliverable del report draft (10 sezioni). |
| work/forensic-repo-audit-original_.../references/snapshot-schema.md | governance-esterna | Schema dello snapshot comparabile da porre in testa a ogni report. |
| work/forensic-repo-audit-update_.../SKILL.md | governance-esterna | Versione aggiornata della skill: aggiunge audit su clone deployed, runtime e DBMS in sola lettura. |
| work/forensic-repo-audit-update_.../references/audit-protocol.md | governance-esterna | Protocollo di audit v2: aggiunge sezione "riconciliazione live". |
| work/forensic-repo-audit-update_.../references/evidence-and-severity.md | governance-esterna | Identico impianto probatorio della v1. |
| work/forensic-repo-audit-update_.../references/live-readonly-access.md | governance-esterna | Nuova sezione v2: discovery del contratto di accesso dichiarato dal progetto, preflight fail-closed. |
| work/forensic-repo-audit-update_.../references/report-schema.md | governance-esterna | Schema dei deliverable v2, sostanzialmente identico alla v1. |
| work/forensic-repo-audit-update_.../references/snapshot-schema.md | governance-esterna | Schema snapshot v2, identico alla v1. |
| work/forensic-skill-change-ledger_20260728T133537.427Z.md | governance-esterna | Change ledger delle correzioni assorbite nella progettazione della skill (ASR-001..ASR-015). |
| work/forensic-skill-design_20260728T132655.631Z.md | governance-esterna | Progettazione della skill: fonte originaria e trigger letterale storico da rendere esplicito. |
| work/toolchain-regression_20260728T160700.030Z/SKILL.md | governance-esterna | Fixture temporanea per verificare il wrapper Python permanente e il validatore di skill. |
| work/toolchain-regression_20260728T160929.831Z/SKILL.md | governance-esterna | Stessa fixture, run successiva. |
| work/toolchain-regression_20260728T172834.611Z/SKILL.md | governance-esterna | Stessa fixture, run successiva. |
| work/toolchain-regression_20260728T172930.570Z/SKILL.md | governance-esterna | Stessa fixture, run successiva. |
| work/toolchain-regression_20260728T175000.453Z/SKILL.md | governance-esterna | Stessa fixture, run successiva. |

## Sospetti superati — dettaglio con citazioni

Per ciascuno: le due date/citazioni che fanno sospettare il superamento. Non si decide qui se il contenuto e ancora valido nel merito, solo il segnale.

### 1. I sei wargame di prodotto (#26, #27, #28, #34, #24) sono ancora presentati come lavoro da fare, ma il backlog attuale li segna DONE

- Documento: docs/wargames/11-heuresys-evidence.md, 12-heuresys-goals-okr.md, 14-heuresys-provenance.md, 16-heuresys-approval-effects.md, 13-heuresys-f4-activity.md, datati 2026-07-06, descrivono #27/#26/#28/#34/#24 come missioni da eseguire.
- Stato attuale: docs/kb/SOT_BACKLOG.md righe 1878, 1881, 1884, 1902, 1691 segnano tutti e cinque gli item come status: DONE.
- I file wargame restano fedeli descrizioni dell'intento originario (categoria intento, corretto tenerli), ma un lettore che li apra oggi senza controllare il backlog crederebbe che queste 5 funzionalita siano ancora da costruire.

### 2. Il piano wargame #17 (Wave-3, onboarding multi-industry) presuppone di riusare il legacy come sorgente, e la direttiva che lo vieta e arrivata dopo

- Documento: docs/wargames/17-heuresys-wave3.md (datato 2026-07-06): la missione dichiarata e onboardare EcoNova e SmartFood come tenant di produzione reali importando dal legacy Docker.
- Stato attuale: docs/kb/SOT_BACKLOG.md riga 1779 registra che il blocco e caduto il 2026-08-14 perche la direzione di Enzo (nessun dato del brownfield va rimesso in circolo, tutto va ricostruito con il DBMS attuale) toglie al legacy ogni ruolo di sorgente, e che #17 e stato ritirato come WON'T-DO lo stesso giorno.
- Riga 1702 dello stesso file conferma: voce #17 Wave-3 multi-tenant-onboarding, status WON'T-DO.
- Il piano del 6 luglio non e falso rispetto a se stesso (dichiara che Enzo non ha ancora deciso), ma e reso ineseguibile-come-scritto dalla decisione successiva.

### 3. L'intera famiglia brownfield_adaptation/ di docs/source_bundle/ descrive un processo di import dal legacy che oggi e chiuso per invariante

- Documento: docs/source_bundle/extracted_bootstrap/brownfield_adaptation/BROWNFIELD_IMPORT_STRATEGY.md descrive la catena old db-export.zip -> brownfield staging -> adaptation map -> candidate transformed records -> validation -> approval -> canonical sys.sys_* tables, come processo attivo e ricorrente in tre schemi (sys/staging/brownfield/audit).
- Stato attuale: CLAUDE.md invariante I12 dichiara che il rubinetto e chiuso, non si importa piu nulla dal legacy, e quel che manca si costruisce o si deriva dai dati che sys.* gia contiene. La regola .claude/rules/db-migrations.md aggiunge che lo schema brownfield e ritirato (item #164 F4, migrazione 000297): le tre tabelle vive sono traslocate in reference_sync, e che al 2026-08-19 (S1052) lo schema brownfield non esiste piu nel database, 0 schemi misurati.
- Lo schema che questi 9 documenti descrivono come casa permanente del processo non esiste piu nel database reale.

### 4. BASELINE_METRICS.md (S-100X-0, 2026-06-13) e i suoi stessi numeri sono gia superati da documenti piu recenti della stessa cartella

- Documento: docs/kb/improvement/BASELINE_METRICS.md riporta 72 moduli API e 108 migrazioni (000001..000109).
- Documento piu recente nella stessa cartella: docs/kb/improvement/DOSSIERS/D-01.md riporta 275 file TypeScript sorgente in api e 75 module-dir; DOSSIERS_TRIAGE_S1022.md (2026-07-20) parla di migrazioni nell'intervallo 000132-000183.
- Il file stesso avverte in testa che e uno snapshot orientativo da ri-misurare a ogni sessione che ne dipende: e un caso di superamento dichiarato, non nascosto, ma resta un documento che un lettore veloce potrebbe prendere per attuale.

### 5. TODO_100X.md si auto-dichiara stale nella propria testata

- Documento: docs/kb/improvement/TODO_100X.md, riga 5, apre con una sezione intitolata Riconciliazione drift S997 (2026-06-19), questo tracker era stale, e sposta l'autorita reale a docs/kb/SOT_BACKLOG.md.
- Non e un sospetto silenzioso: e l'esempio migliore del corpus di un documento-Stato che segnala da solo la propria obsolescenza parziale, invece di lasciarla nascosta.

### 6. docs/github/07-nostri-repo/01-stato-corrente.md si dichiara in testa uno snapshot congelato del 17 maggio 2026

- Il file avverte esplicitamente che il corpo della pagina e lo snapshot del 2026-05-17, tenuto apposta come punto zero contro cui misurare la crescita, e che non e piu lo stato corrente.
- Stesso schema del punto 5: auto-segnalazione, non falso silenzioso, ma il titolo del file (01-stato-corrente.md) indurrebbe comunque a leggerlo come stato vivo.

### 7. Le specifiche no-PII / dati sintetici pre-S1011 usano un linguaggio che CLAUDE.md ha esplicitamente ritirato

- Documento: docs/superpowers/specs/2026-06-03-platform-capabilities-roadmap.md (2026-06-03) dichiara che i dati sono un caso di studio sintetico, senza PII reale per ADR-0023, quindi AI/mining/scraping non portano alcun cancello di privacy.
- Stato attuale: CLAUDE.md, OUTPUT RULE S1011, dichiara ritirato come descrittore il qualificatore no-PII/sintetico/ADR-0023/safe-to-publish: mai piu usato come rassicurazione, un dato si descrive per cio che e, mai per cio che non e.
- Il documento del 3 giugno precede la decisione di S1011 di circa un mese e mezzo di sessioni; il linguaggio che usa e proprio quello che la regola vieta oggi.

### 8. docs/superpowers/specs/2026-06-30-two-axis-authorization-model-design.md e companion dichiarato di ADR-0027, che CLAUDE.md indica oggi come superseded

- Il file si presenta esplicitamente come companion di ADR-0027, la decisione, mentre lui stesso e il come tecnico.
- CLAUDE.md corrente, invariante I16, dichiara che il modello a domini ortogonali (ADR-0036) supersede ADR-0027.
- Il documento resta un referto di come si e arrivati alla decisione, ma il suo companion (ADR-0027) non e piu l'ADR vigente.

### 9. docs/superpowers/specs/2026-06-05-sot-unification-design.md e superseded da se stesso (v1 poi v2), dichiarato nel primo file

- Il documento apre dichiarando: stato DESIGN v2 (S965, 2026-06-05); v1 (archiviare SOT_STATE, un solo file condensato) fu implementato nel commit e7e9de3 poi rivisto perche Enzo ha segnalato che lo STATE.md condensato perdeva la granularita di SOT_STATE; i paragrafi 1-10 restano il record v1, parzialmente superseded dal paragrafo 11.
- Caso di superamento interno, gia trasparente nel documento; incluso perche chi legge solo i primi 10 paragrafi (senza arrivare all'11) si porta via un modello sbagliato.

### 10. Z-261 (rotazione segreti TOTP) e Z-262 (accesso derivato per tutti gli utenti) sono piani dichiarati NON eseguiti alla data di scrittura, stato attuale non riverificato in questa sessione

- Z-261: docs/superpowers/plans/2026-07-26-z261-mfa-fixture-secret-rotation.md dichiara in riga 3 lo stato PIANO, nulla e stato eseguito, richiede autorizzazione esplicita di Enzo passo per passo.
- Z-262: docs/superpowers/plans/2026-07-26-z262-accesso-derivato-tutti-gli-utenti.md dichiara alle righe 2-3 lo stato PIANO, il provisioning non e stato eseguito, richiede autorizzazione esplicita per il passo 3 che scrive in produzione.
- Indizio di possibile completamento successivo: la memoria utente reference_persona_login_derived_password.md (in ~/.claude/CLAUDE.md) descrive un meccanismo di password derivata per-persona gia in uso corrente per il login LIVE — indizio che Z-262 (o una sua parte) sia stato poi eseguito, ma non verificato con un comando in questa sessione.
- Segnalato come sospetto da riverificare, non come conclusione.

## Contraddizioni doc<->doc — citazioni testuali di entrambe le parti

Non si decide qui chi ha ragione: si registra il conflitto letterale.

### Contraddizione 1 — presenze e stipendi dentro o fuori dal perimetro della piattaforma

Parte A (fondativa, esclude): docs/source_bundle/extracted_bootstrap/brownfield_adaptation/BROWNFIELD_EXCLUSION_RULES.md, sezione "Always Exclude From Canonical Bootstrap", elenca testualmente: employees_pii, employees_payroll, employee_bank_details, employee_benefits, employee_pay_stubs, employee_attendance, medical_certificates, payroll_export_*, SAP raw HR tables, RLS policies, runtime sessions. Motivazione dichiarata nello stesso file: "The new platform is position-centric and intelligence-oriented. It is not a Core HR Administration, payroll, benefits, medical/anamnestic or attendance system."

Lo stesso vincolo compare nel documento gemello docs/source_bundle/extracted_bootstrap/bootstrap_agent/AI_CODING_AGENT_BOOTSTRAP_PROMPT.md, sezione 1.6 Scope Boundary: "The platform is not: Core HR Administration; Payroll execution; Time & Attendance execution; Benefits/Welfare administration..."

Parte B (piano di prodotto, costruisce): docs/superpowers/plans/2026-07-27-rtl-storia-36-mesi.md descrive il lavoro come popolamento per cluster di business che include testualmente la sequenza: "contratti->presenze->buste paga->variabile". Il piano tratta 36 mesi di storia RTL Bank come dato reale, richiamando esplicitamente ADR-0026 (dati trattati come produzione reale, non sintetici/test).

Nota di contesto (non risolutiva): il piano fondativo vieta l'IMPORT di queste categorie dal DBMS legacy come sorgente; il piano storia36 le COSTRUISCE dentro il DBMS attuale con un metodo diverso (seed idempotente derivato da fatti gia registrati, non import diretto). Se questa distinzione basti a sciogliere la contraddizione e materia di giudizio, non di censimento: qui si registra che il primo documento pone presenze e stipendi fuori dal perimetro dichiarato del prodotto, e il secondo li tratta come dati reali di produzione dentro lo stesso prodotto.

### Contraddizione 2 — lo stato di QW-D1/QW-D2 (code-split dei chart) e disallineato fra due documenti della stessa cartella, gia notato dagli stessi autori

Parte A: docs/kb/improvement/TODO_100X.md, righe 85-86, elenca ancora aperti: "QW-D1 | WS-D | instrada 8 analytics + MermaidDiagram via _charts-client (next/dynamic) | next build + E2E + bundle echarts fuori chunk iniziale | TODO" e "QW-D2 | WS-D | experimental.optimizePackageImports (lucide-react, @heuresys/ui) verify-first | build verde + bundle ridotto | TODO".

Parte B: docs/kb/improvement/DOSSIERS/D-04.md dichiara invece questi stessi due item come gia chiusi, con verifica live sul codice: "Chart code-split incoerente (F-WS-D-4) -> DONE (QW-D1): le 9 pagine analytics/* + MermaidDiagram instradate via _charts-client.tsx" e "Barrel tree-shaking non assistita (F-WS-D-5) -> DONE (QW-D2): optimizePackageImports: [lucide-react, @heuresys/ui] in next.config.js:6".

Lo stesso file D-04.md segnala la discrepanza esplicitamente: "TODO_100X.md:77-78 li lista ancora come TODO - drift di tracking, non di codice; la riconciliazione di quel registro e un fix doc separato". Si registra qui perche il tracker (TODO_100X.md) non risulta corretto nella copia attualmente censita.

## Menzioni di funzionalita del prodotto: descritte / promesse / decise / scartate

Citazioni con file:riga dove disponibile. Attenzione particolare, come richiesto, alle capacita delle spec fondative (docs/source_bundle) senza menzione nei documenti di stato correnti.

### Descritte nelle spec fondative, non citate nei documenti di stato correnti (potenziale funzionalita latente o abbandonata)

- Motore di acquisizione seed con comandi CLI dedicati: docs/source_bundle/extracted_bootstrap/seed_acquisition/SEED_ACQUISITION_ENGINE_SPEC.md righe 71-82 elenca testualmente "npm run seed:discover -- --domain esco --input positions.csv", "npm run seed:validate -- --run-id <id>", "npm run seed:approve -- --run-id <id>", "npm run seed:apply -- --run-id <id>". Nessuno di questi comandi compare nei documenti di stato correnti letti in questa sessione (docs/kb/improvement, docs/kb/SOT_BACKLOG citato altrove) con questi nomi esatti.
- Modello di visualizzazione grafo generico con motori di layout e target di rendering multipli: docs/source_bundle/extracted_bootstrap/bootstrap_agent/specs/GRAPH_VISUALIZATION_MODEL_SPEC.md righe 28-70 elenca graph_type (ORG_CHART, PROCESS_FLOW, CAREER_PATH, LEARNING_PATH, SKILL_GAP_MAP, SUCCESSION_MAP, KPI_CASCADE, POSITION_INTELLIGENCE_MAP, ENTERPRISE_BLUEPRINT_MAP), layout_engine (AUTO, DAGRE, ELK, HIERARCHICAL, TREE, SWIMLANE, TIMELINE, FORCE_DIRECTED, MANUAL) e rendering_target (REACT_FLOW, MERMAID, BPMN, D3, SVG, HTML_CANVAS, PDF_EXPORT, GENERIC_JSON). Il prodotto attuale ha una pagina /visualizations e usa React Flow/Mermaid (secondo la memoria utente sui renderer di brand), ma BPMN, D3 puro, HTML_CANVAS e PDF_EXPORT come target di rendering non risultano confermati nei documenti letti in questa sessione.
- Sistema di governance AI a 6 stati per ogni output generato da regola o modello: docs/source_bundle/extracted_bootstrap/bootstrap_agent/SECURITY_AND_PRIVACY_BOUNDARIES.md righe 59-70, stati CANDIDATE/SYSTEM_PROPOSED/DOMAIN_VALIDATED/HR_VALIDATED/MANAGEMENT_APPROVED/REJECTED. Non risulta menzione di questo esatto vocabolario negli altri documenti letti.
- Sezione "Future Evolution" del blueprint HR bancario: docs/source_bundle/extracted_bootstrap/industry_blueprints/FIN_BANKING/processes/14_HR_and_Internal_Services.md righe 2073-2097 nomina come direzioni non ancora costruite: Workforce Intelligence Graph (riga 2079), Digital Twin of the Organization (riga 2083), AI-Assisted Employee and Manager Experience (riga 2087), Process Mining and Continuous Improvement (riga 2091), Compliance-by-Design HRMS (riga 2095). Nessuno di questi 5 nomi compare nei documenti di stato correnti letti in questa sessione.

### Promesse/decise nei piani e nelle spec di superpowers, poi effettivamente costruite (verificato contro SOT_BACKLOG)

- Modulo goals/OKR con timeline di sotto-risorse: docs/superpowers/plans/2026-06-20-goals-okr-module.md (endpoint /v1/goals/*, /v1/okrs/*) e wargame docs/wargames/12-heuresys-goals-okr.md (#26 A/L1). Esito: DONE (docs/kb/SOT_BACKLOG.md riga 1878).
- Layer di evidenza sotto i punteggi: docs/wargames/11-heuresys-evidence.md (#27 A/L2, ~5.3k righe dormienti esposte come drill-down "perche questo punteggio"). Esito: DONE (riga 1881).
- Trust Ledger / API di provenance: docs/wargames/14-heuresys-provenance.md (#28 A/L0, /v1/provenance su sys.sys_source_lineage_records, ~70.972 righe). Esito: DONE (riga 1884).
- Handler di apply-effect per le approvazioni: docs/wargames/16-heuresys-approval-effects.md (#34 B/B3, primo flusso approvativo reale con effetto TENANT_MATERIALIZATION). Esito: DONE (riga 1902).
- Asse funzionale/attivita di ADR-0027 (F4): docs/wargames/13-heuresys-f4-activity.md (#24, sys_process_participants). Esito: DONE (riga 1691, F4 risolto mig 000184, 1086 righe, RULE-B).

### Decise poi scartate

- Onboarding multi-industry Wave-3 (EcoNova + SmartFood come tenant di produzione reali): docs/wargames/17-heuresys-wave3.md (#17). Esito: WON'T-DO, ritirato 2026-08-14 (docs/kb/SOT_BACKLOG.md righe 1702, 1779) perche l'intero piano presupponeva di riusare il legacy come sorgente, vietato dall'invariante I12.
- Migrazione dello squash delle 127+ migrazioni a una baseline: docs/kb/improvement/DOSSIERS/D-07.md. Esito: WON'T-DO, "valutato e respinto esplicitamente" nel triage S1022.
- Query-builder type-safe (Kysely) come strato sopra il raw SQL: docs/kb/improvement/DOSSIERS/D-02.md, opzione Radicale. Esito nella raccomandazione del dossier: sconsigliata (reintrodurrebbe l'accoppiamento schema-tipi appena rimosso con drizzle).
- Scraping web arbitrario come strategia di arricchimento dati: docs/superpowers/specs/2026-06-07-scraping-design.md dichiara esplicitamente come principio di design, non solo come nota, di raccomandare CONTRO lo scraping arbitrario, limitando l'ingestione alle sole fonti ufficiali (ESCO, ISTAT/Eurostat, ATECO/NACE, registri CCNL pubblici) via API/bulk-download pubblicati.

### In corso / parzialmente costruite alla data dei documenti letti

- Osservabilita /metrics in formato Prometheus: docs/kb/improvement/DOSSIERS/D-09.md e EPICS_SPEC_S1022.md dichiarano le fasi 1-4 gia shippate in main ma gated OFF (flag PROM_METRICS_ENABLED); la fase 5 (collector systemd sulla VM) resta gated su decisione di Enzo.
- Provisioning self-service + GDPR-tooling minimo per nuovi tenant: docs/kb/improvement/DOSSIERS/D-14.md e EPICS_SPEC_S1022.md descrivono un endpoint POST /v1/tenants/provision non ancora costruito alla data del dossier (fase 1 dichiarata autonoma ma non eseguita), con lo scope GDPR (DSR-export, erasure/retention) esplicitamente riservato a decisione di Enzo.
- CI/CD con database isolato per i test e secondo runner off-prod: docs/kb/improvement/DOSSIERS/D-08.md e EPICS_SPEC_S1022.md descrivono un heuresys_ci separato e un secondo runner su linux-pc come fasi non ancora eseguite alla data del dossier.
- Pagina pubblica /pricing: docs/wargames/15-heuresys-pricing.md (#4 GTM) dichiara esplicitamente che i numeri/tier non esistono ancora e sono autorita esclusiva di Enzo (question set Q1-Q8 non risposto alla data del piano); stato di costruzione effettiva non verificato in questa sessione.

## Esclusioni (file non letti: nome + ragione, mai aggregato)

Nessuna esclusione. Ogni file di ciascuna delle sei directory (82 + 74 + 39 + 34 + 27 + 68 = 324 file totali) e stato aperto in questa sessione, con almeno l'incipit e la struttura letti, e con lettura integrale per i file brevi e per quelli espressamente segnalati come piu rilevanti dal mandato (docs/source_bundle, i 14 dossier D-01..D-14, tutti i wargame e le loro review). L'obiettivo di zero esclusioni e rispettato: si veda invece la sezione seguente per la dichiarazione onesta di dove la lettura e stata a campione strutturato invece che integrale riga-per-riga.

## Lacune dichiarate

1. Lettura a campione strutturato, non integrale riga-per-riga, per quattro gruppi ad alto volume e struttura fortemente ripetitiva: (a) 22 dei 33 piani e 37 delle 43 spec di docs/superpowers/plans e docs/superpowers/specs sono stati letti per apertura (le prime 20-30 righe, che in questo repo contengono sempre Goal/Architecture/contesto) piu, dove presenti, le sezioni auto-riassuntive (Self-review, TL;DR, Esito, Confine di sessione); (b) 22 dei 23 processi FIN_BANKING in docs/source_bundle (tutti tranne il 14, letto per intero) sono stati letti per intestazione, indice delle sezioni e apertura, dato che condividono lo stesso template Document-Control/Process-Overview/Strategic-Objectives/Scope; (c) tutti i 14 file di docs/kb/improvement/FINDINGS/ sono stati letti per apertura + sezione Headline (dove presente), non per ogni singolo finding elencato al loro interno (che nei dossier D-01..D-14 sono comunque citati e riportati); (d) circa 55 dei 68 file di .codex-review (in particolare work/, adversarial/ e buona parte di reports/) sono stati letti per intestazione e struttura, essendo per lo piu varianti DRAFT/challenge/change-ledger/FINAL quasi-duplicate dello stesso audit con timestamp diversi.

2. Nessuna verifica dal vivo (comando eseguito su questa sessione) e stata fatta per confermare lo stato attuale di Z-261 e Z-262 (docs/superpowers/plans/2026-07-26-z26*); il segnale riportato nella sezione Sospetti superati punto 10 si basa su una memoria utente indiretta, non su un grep/query eseguito ora.

3. Non e stato verificato se la pagina pubblica /pricing (docs/wargames/15-heuresys-pricing.md, #4 GTM) sia stata effettivamente costruita: la ricerca in SOT_BACKLOG.md in questa sessione si e limitata ai sei item citati nel mandato (#26, #27, #28, #34, #24, #17) e non ha coperto #4 nel dettaglio.

4. Per .codex-review/, il mandato chiede di censire ma non di interpretare il merito tecnico degli audit di Codex (broker di accesso, credenziali, query SQL consentite): questi dettagli sono stati letti ma non validati contro lo stato vivo del sistema (nessuna query psql o comando SSH eseguito in questa sessione per confermare, ad esempio, che il ruolo codex_auditor abbia davvero solo SELECT).

5. Il confronto puntuale "data ultima modifica vs attivita recente nell'area" richiesto dalla Fase C del mandato originale (git log --since) non e stato eseguito in questa seconda passata: la Fase A (incluse le date) e gia stata prodotta nella prima passata e non andava rifatta secondo le istruzioni ricevute per questo Lotto C, che chiedeva esplicitamente lettura+ruolo+digesto+le quattro sezioni di analisi, non una nuova Fase C. I sospetti superati qui sopra sono quindi tutti derivati da confronto testuale fra documenti e dallo stato del backlog/CLAUDE.md attuale, non da comparazione di timestamp.
