# Evidenze — ciclo DREAM 2026-08-25

**Stato**: RIVISTA POST-VERIFIER (V11, 2026-08-26). Il verifier (Onda 4, `_raccolta/verifier_verdetti.md`) ha riverificato i fatti sul codice e 6 fonti sul web: le righe sotto portano gli esiti. **Quattro fatti corretti** (F3, F10, F27, F31), cinque aggiunti (F35–F39), una fonte aggiunta (S16), due riserve dichiarate (S1, S4).

Questo file consolida i fatti `F` e le fonti `S` a cui puntano `04_MATRICE.md` e `05_PROPOSTE.md`. **Il dettaglio del comando vive nel raccolto citato** (colonna "dove"): ogni raccolto riporta comando eseguito e data per ciascuna misura. Tutte le misure sono del **2026-08-25** salvo dove indicato; per la regola del PUNTO FISSO ogni numero qui è *evidenza datata di quel giorno*, non un'affermazione sul presente.

## Fatti (F) — misure sul progetto

| id | fatto | dove (comando e prova) |
|---|---|---|
| F1 | 228 capacità inventariate (226 Completo, 2 Parziale), 20 aree funzionali | `_raccolta/inventario_raw.md` §Conteggi finali (grep ancorato `^\|`) |
| F2 | 604 route API · 102 pagine web (120 − 18 showcase) | `inventario_raw.md` §Comandi di enumerazione |
| F3 | 31 moduli API senza alcun consumer **web** + 12 capacità puntuali latenti dentro moduli usati. **CORRETTO dal verifier**: "senza consumer web" ≠ "mai raggiunto" — almeno `research` (importato da 3 moduli + app.ts) e `reference-sync` (CLI canonica) hanno consumer non-web; e il "12" non è esaustivo (mancano almeno review-cycles POST/transition, assessment-results POST, notifications broadcast POST) | `inventario_raw.md` §→ Latente + `verifier_verdetti.md` F3 |
| F4 | Mentorship: 17 route CRUD complete; righe vive: programs=5, mentorships=63, sessions=150; zero occorrenze `/v1/mentorship` in apps/web | `latenti_raw.md` (a) — psql count + grep |
| F5 | GDPR admin: 5 endpoint (data-map, requests, export, erasure, retention); righe vive: requests=8, data_map=85; zero UI (`/v1/gdpr` assente dal web); il self-service `/me/gdpr` è invece wired | `latenti_raw.md` (a) |
| F6 | Predictions: 4 route GET read-model; predictive_models=4, model_predictions=468; zero UI | `latenti_raw.md` (a) |
| F7 | Delegations: 4 route (list/get/create/revoke); sys_user_delegations=0 — mai esistita una UI per crearne | `latenti_raw.md` (a) |
| F8 | Visualization node-layouts: 316 posizioni-nodo salvate; il canvas non contiene la stringa `layout` e le ignora a ogni render | `latenti_raw.md` (a) |
| F9 | Viste sentinella vive mai lette dall'API: `v_positions_with_critical_skill_gap`=161 righe; `v_organization_unit_integrity`=43 su 45 unità | `latenti_raw.md` (b) |
| F10 | `MATCHING_FREETEXT_ENABLED` default false NEL CODICE — ma **SMENTITO come stato di produzione**: il flag è `=true` sul `.env` della VM (voce #40 DONE S1018 con dimostrazione live; #6 «LIVE PROD config-only»). La ricerca semantica free-text è ACCESA in produzione; la lezione: quando una misura è negata (.env), si cerca l'informazione nelle altre fonti del progetto (era in SOT_BACKLOG) | `latenti_raw.md` (d) + `verifier_verdetti.md` F10 (SOT_BACKLOG:2623, 1951-1953; SOT_STATE:2181) |
| F11 | Email: SMTP mai fornito → `ConsoleMailer` sempre; EMAIL_OTP escluso da allowedKinds e digest che logga senza inviare; il percorso di sblocco originale (app-password Outlook) è dichiarato impossibile (Basic Auth SMTP ritirata il 2026-04-30) | `latenti_raw.md` (d) + SOT_BACKLOG righe citate lì |
| F12 | Role CRUD assente in UI **e in API**: commento nel codice "full role CRUD lands in MVP-3"; `/admin/roles` è matrice a sola lettura; nessuna POST/PATCH/DELETE su ruoli o mapping | `latenti_raw.md` (f) |
| F13 | SMS: `makeSmsSender` ritorna sempre `ConsoleSms`, nessun branch verso un provider reale esiste nel codice | `latenti_raw.md` (f) |
| F14 | SSO: tabella `sys_auth_sessions` è placeholder dichiarato inerte ("not on MVP-1 hot path"); zero SAML/OIDC/OAuth nel modulo auth | `architettura_raw.md` §8 |
| F15 | Nessuna superficie per terzi: zero webhook, zero api-key/PAT, zero tabelle token; unico endpoint pubblico è `/v1/public/platform-stats` | `architettura_raw.md` §8 |
| F16 | Upload multipart usato solo in 2 moduli (me, content/media): nessun import CSV/Excel di dati business esiste | `architettura_raw.md` §8 |
| F17 | reference_sync: connettori vivi ESCO + ISTAT/ATECO con CLI dedicata e deps-seam testabile; pattern dichiarato riusabile per nuove fonti ufficiali | `architettura_raw.md` §9 |
| F18 | Substrato pgvector `vector(1024)` + cache embedding riusabile per qualunque "trova il più simile" | `architettura_raw.md` §Moltiplicatori |
| F19 | `emitNotification` generico con dedupe e preferenze per-tipo: ogni evento di dominio diventa notifica con una chiamata | `architettura_raw.md` §Moltiplicatori |
| F20 | Motore di scoping M1 (10 domini × 7 classi × 4 modalità) con enforcement al boot (`ORG_GATE_MISSING`): un dominio/classe nuovi = righe di matrice, non refactoring | `architettura_raw.md` §3 |
| F21 | Fattori di velocità: pattern modulo a 7 passi × 98 moduli; 108 schemi Zod condivisi; 238 file di integration test; 100 spec E2E | `architettura_raw.md` §5, §10 |
| F22 | Il PIP è una VIEW (I9) e l'endpoint GET `/v1/positions/:id/intelligence-profile` esiste — nessuna pagina lo chiama | `inventario_raw.md` §capacità puntuali latenti + `architettura_raw.md` §1 |
| F23 | Difetto: pagina enterprise-typing invia POST ma la route espone solo PUT → ogni salvataggio fallisce | `inventario_raw.md` area O (riga Parziale) |
| F24 | Tenant blueprint end-to-end completo con UI: modello → processi → build-plan → apply → diff; approvals engine con decide/apply-effects | `inventario_raw.md` area O, area M |
| F25 | Whistleblowing completo e incluso: canale pubblico anonimo + tracking + console custode isolata (I20) | `inventario_raw.md` aree B, R |
| F26 | Moduli admin latenti (API senza consumer web) fra cui: assessments, assessment-methods, assessment-results, surveys, teams, notifications (broadcast), user-career-plans, successor-readiness | `inventario_raw.md` §→ Latente |
| F27 | 9 macro-aree SDBI con **mini-spec mai eseguite** (2026-05): Recruiting, Onboarding/Preboarding, Surveys/Wellbeing, Feedback Systems, Mentorship, Predictions ML, Compensation Ext, Documents/Signatures, Talent Pool. **CORRETTO**: la fonte attesta "mini-specifica, MAI eseguita" — la completezza del DDL NON è attestata; l'indice SDBI stima 60-90h per 11 aree (~6-8h/area) | `docs_censimento_pass2_b.md` §Lavori interrotti + `verifier_verdetti.md` F27 |
| F28 | Governance AI a 6 stati nelle spec fondative: CANDIDATE → SYSTEM_PROPOSED → DOMAIN_VALIDATED → HR_VALIDATED → MANAGEMENT_APPROVED / REJECTED | `docs_censimento_pass2_c.md` §Menzioni (SECURITY_AND_PRIVACY_BOUNDARIES.md:59-70) |
| F29 | Perimetro fondativo dichiarato: «The platform is not: Core HR Administration; Payroll execution; Time & Attendance execution; Benefits/Welfare administration» | `docs_censimento_pass2_c.md` §Contraddizione 1 (BROWNFIELD_EXCLUSION_RULES.md + BOOTSTRAP_PROMPT §1.6) |
| F30 | Prometheus `/metrics`: fasi 1-4 dichiarate shippate in main ma flag `PROM_METRICS_ENABLED` OFF; fase 5 gated su Enzo — **fonte documentale (D-09), non riverificata sul codice in questo ciclo** | `docs_censimento_pass2_c.md` §In corso |
| F31 | Console agente `/dev/agent` — **SMENTITO come formulato**: il commento del file stesso dichiara «renders without a live agent (blocked-on-Enzo: dev subscription out_of_credits / PROD credential required)»; `NEXT_PUBLIC_ENABLE_AGENT_DEV` non esiste in NESSUN `.env` (PROD compreso, misura 2026-08-16 in pagine_waivers) → la pagina rende un avviso, non una console; un serving customer-facing è dichiarato «nuovo scope» in SOT_BACKLOG:2270 | `verifier_verdetti.md` F31/P-18 |
| F35 | **L'export dati ESISTE già lato API**: hook globale `onSend` che trasforma qualunque endpoint lista in `?format=csv/xlsx/pdf` («zero-touch sulle ~85 list route», post RBAC/scope) + export dedicato delle 9 viste analytics; nessuna pagina web lo usa (0 occorrenze `format=csv`/`export` in apps/web) — smentisce la cella «Assente» della matrice §12 | `verifier_verdetti.md` P-29 (`lib/export/hook.ts:1-15`, `lib/export/serializers.ts`, `analytics/routes.ts:117-141`) |
| F36 | OpenAPI/Swagger già generato dietro flag `API_DOCS_ENABLED` (~407 endpoint) — abbatte il costo "doc" di un'API pubblica | `verifier_verdetti.md` P-03 (WS-J.md:27) |
| F37 | Precedente vivo di scheduler su scadenze: `heuresys-advanced-approvals-sla.timer` + `modules/approvals/sla.ts` (usa emitNotification) | `verifier_verdetti.md` P-08/P-11 |
| F38 | Prometheus: F30 riverificato SUL CODICE dal verifier (env.ts:266, app.ts:251/341-351, `/metrics` loopback-only) e `deploy/systemd/heuresys-prometheus.service` esiste già in repo (collector :9091) — sforzo XS | `verifier_verdetti.md` P-25/F30 |
| F39 | Surveys: il modulo latente (12 route) scrive sul cluster JSONB `sys_engagement_survey_*`, mentre ESS e pagine engagement leggono il **cluster normalizzato** `sys_survey_*`/`sys_pulse_checks` — un sondaggio composto col modulo latente NON arriva ai dipendenti; la scelta fra i due è decisione semantica aperta di Enzo (m2b) | `verifier_verdetti.md` P-07 (surveys/repository.ts:47-201 vs engagement/repository.ts + me/repository.ts:913-1108; SOT_BACKLOG:2426, 2307) |
| F32 | La spec di design sull'arricchimento dati (2026-06-07) ammette solo fonti ufficiali: ESCO, ISTAT/Eurostat, ATECO/NACE, **registri CCNL pubblici** — e sconsiglia lo scraping arbitrario | `docs_censimento_pass2_c.md` §Decise poi scartate |
| F33 | "Future Evolution" del blueprint bancario (mai costruite): Workforce Intelligence Graph · Digital Twin of the Organization · AI-Assisted Experience · Process Mining · Compliance-by-Design | `docs_censimento_pass2_c.md` §Menzioni |
| F34 | La storia RTL a 36 mesi è scorrevole (arriva a ieri, avanzamento schedulato su VM) — base dati viva per ogni demo | CLAUDE.md §storia36 + memoria progetto D-STORIA-B (dichiarativa di progetto) |

## Fonti (S) — competitor, tutte consultate il 2026-08-25

| id | fonte | cosa sostiene | affidabilità |
|---|---|---|---|
| S1 | competitor_personio.md §talent-care — personio.com/product/\*, support.personio.de, marketplace | Succession planning nativo: **non trovata evidenza** di una funzione dedicata; solo via terzi (TalentMapper). **Riserva del verifier**: recensioni terze descrivono la succession "supportata" via org chart + workforce planning — il lessico "scoperto" va ammorbidito in "nessuna funzione dedicata documentata" | ricerca mirata con NTE dichiarato, riconfermata 2026-08-26 con riserva |
| S2 | competitor_personio.md §Formazione — personio.com/product/\*, marketplace.personio.com/category/learning-and-development | LMS nativo: **non trovata evidenza**; delega a LMS terzi via marketplace | idem |
| S3 | competitor_personio.md §packaging + personio.com/product/whistleblowing | Whistleblowing è **add-on a pagamento separato** | Documentato |
| S4 | competitor_personio.md §Integrazioni/packaging — developer.personio.de, support art. 11149358090653 | API custom, webhook, SSO/OAuth solo nel piano superiore; marketplace 200+ integrazioni. **Riserva del verifier**: la direzione (SSO/API = leva di piano) regge e le pagine SSO Entra/Okta esistono; ma **il nome del piano ("Core Pro") viene da snippet di pagina 403 e non è verificato su pagina** (una fonte terza lo chiama "Enterprise") | Documentato con riserva sul nome del piano |
| S5 | competitor_personio.md §Analytics + §Lamentele — g2.com reviews | Reporting rigido, query builder debole, export difficile: lamentela ricorrente sul concorrente diretto | Riportato (recensioni) |
| S6 | competitor_personio.md §Performance — support art. 30454790101789, learn.personio.com | Career Frameworks (10 livelli di competenza) con Job Architecture come prerequisito; Review Cycle Builder | Documentato |
| S7 | competitor_personio.md §Localizzazione — personio.com/product/payroll + outsail.co | Per l'Italia solo preliminary payroll, nessuna esecuzione nativa | Documentato + Riportato |
| S8 | competitor_personio.md §AI — personio.com/product/assistant, whats-new-q2-26 | Personio Assistant: chatbot AI per i dipendenti, fonti di conoscenza esterne (annuncio recente, debole) | Documentato (claim vendor) |
| S9 | competitor_eightfold.md §skills-intelligence, §talent-management | Inferenza skill da segnali di lavoro (Digital Twin), succession AI, marketplace interno — lo stato dell'arte del metro | Documentato (claim vendor) |
| S10 | competitor_eightfold.md §meccanismo — finance.yahoo.com (class action 2026-01-20) | Contestazione legale attiva sulla provenienza del dataset (1,6 mld traiettorie); il vendor nega lo scraping | Riportato (allegazione non provata) |
| S11 | competitor_eightfold.md §identità/packaging — Gartner Peer Insights (sintesi), pin.com | Posizionamento enterprise 10.000+ dipendenti; stima $7-10 PEPM; costi proibitivi sotto i 2.000 dipendenti | Riportato |
| S12 | competitor_zucchetti.md §1 — manuale Interfaccia Rilevazione Presenze (via partner cedbrianteo.it, riserva dichiarata) | 5 tracciati presenze documentati (TRRIPW XML, HGAL_TIMEIMP_TMP, H1TR_CSVVOCI, TRRIPA, FOGPRE), import unidirezionale verso Paghe | Documentato con riserva (dominio partner) |
| S13 | competitor_zucchetti.md §1 — help.zucchetti.it, serviziit.zucchetti.it | API dietro login SSO; `apiportal.zucchetti.it` NON risolve (ENOTFOUND verificato); modello "chiedi al commerciale" | Documentato (esistenza), contenuto non verificabile |
| S14 | competitor_zucchetti.md §1-2 — inrecruiting.zendesk.com, in-recruiting.com | Inrecruiting (ATS Zucchetti) integrabile via API; integrazione nativa con Infinity HR | Riportato |
| S15 | competitor_personio.md S43-S44 + competitor_eightfold.md §packaging | Nessuno dei tre pubblica un listino: prezzo a preventivo/contatto commerciale — **riconfermato dal verifier 2026-08-26** (personio.com/pricing esiste ma senza cifre) | Documentato (assenza) + Riportato |
| S16 | D.lgs. 24/2023 (whistleblowing) — verificato dal verifier 2026-08-26 | Obbligo del canale interno per datori con **≥50 dipendenti** (media ultimo anno), sanzioni ANAC 10-50k € | Documentato (norma) |

## Avvertenze di lettura

- I fatti F30, F31 e F34 portano una componente **documentale o di memoria** dichiarata nella riga: vanno rimisurati prima di diventare fondamento di un'esecuzione.
- Le celle Personio derivate da snippet indicizzati (blocco anti-bot 429/403) sono Documentato-con-flag: il testo proviene dal dominio vendor ma senza rendering diretto della pagina (dichiarato in `competitor_personio.md` testata).
- «Non trovata evidenza» non significa «non ce l'ha»: significa che la ricerca mirata, descritta nel raccolto, non ne ha trovato traccia.
