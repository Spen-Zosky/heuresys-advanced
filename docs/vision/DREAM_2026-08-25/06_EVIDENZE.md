# Evidenze — ciclo DREAM 2026-08-25

**Stato**: BOZZA (Onda 3, S1081-dream) — sarà rivista dal verifier (Onda 4).

Questo file consolida i fatti `F` e le fonti `S` a cui puntano `04_MATRICE.md` e `05_PROPOSTE.md`. **Il dettaglio del comando vive nel raccolto citato** (colonna "dove"): ogni raccolto riporta comando eseguito e data per ciascuna misura. Tutte le misure sono del **2026-08-25** salvo dove indicato; per la regola del PUNTO FISSO ogni numero qui è *evidenza datata di quel giorno*, non un'affermazione sul presente.

## Fatti (F) — misure sul progetto

| id | fatto | dove (comando e prova) |
|---|---|---|
| F1 | 228 capacità inventariate (226 Completo, 2 Parziale), 20 aree funzionali | `_raccolta/inventario_raw.md` §Conteggi finali (grep ancorato `^\|`) |
| F2 | 604 route API · 102 pagine web (120 − 18 showcase) | `inventario_raw.md` §Comandi di enumerazione |
| F3 | 31 moduli API senza alcun consumer web + 12 capacità puntuali latenti dentro moduli usati | `inventario_raw.md` §→ Latente |
| F4 | Mentorship: 17 route CRUD complete; righe vive: programs=5, mentorships=63, sessions=150; zero occorrenze `/v1/mentorship` in apps/web | `latenti_raw.md` (a) — psql count + grep |
| F5 | GDPR admin: 5 endpoint (data-map, requests, export, erasure, retention); righe vive: requests=8, data_map=85; zero UI (`/v1/gdpr` assente dal web); il self-service `/me/gdpr` è invece wired | `latenti_raw.md` (a) |
| F6 | Predictions: 4 route GET read-model; predictive_models=4, model_predictions=468; zero UI | `latenti_raw.md` (a) |
| F7 | Delegations: 4 route (list/get/create/revoke); sys_user_delegations=0 — mai esistita una UI per crearne | `latenti_raw.md` (a) |
| F8 | Visualization node-layouts: 316 posizioni-nodo salvate; il canvas non contiene la stringa `layout` e le ignora a ogni render | `latenti_raw.md` (a) |
| F9 | Viste sentinella vive mai lette dall'API: `v_positions_with_critical_skill_gap`=161 righe; `v_organization_unit_integrity`=43 su 45 unità | `latenti_raw.md` (b) |
| F10 | `MATCHING_FREETEXT_ENABLED` default false; la UI è già costruita e collegata (semantic-search-panel → GET `/v1/matching/search`, usata da `/skills` e `/me/matching`): a flag OFF l'utente riceve 404 tipizzato | `latenti_raw.md` (d) |
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
| F27 | 9 macro-aree SDBI con mini-spec DDL complete mai eseguite (2026-05): Recruiting, Onboarding/Preboarding, Surveys/Wellbeing, Feedback Systems, Mentorship, Predictions ML, Compensation Ext, **Documents/Signatures**, Talent Pool | `docs_censimento_pass2_b.md` §Lavori interrotti (batch_c3/sdbi_scale) |
| F28 | Governance AI a 6 stati nelle spec fondative: CANDIDATE → SYSTEM_PROPOSED → DOMAIN_VALIDATED → HR_VALIDATED → MANAGEMENT_APPROVED / REJECTED | `docs_censimento_pass2_c.md` §Menzioni (SECURITY_AND_PRIVACY_BOUNDARIES.md:59-70) |
| F29 | Perimetro fondativo dichiarato: «The platform is not: Core HR Administration; Payroll execution; Time & Attendance execution; Benefits/Welfare administration» | `docs_censimento_pass2_c.md` §Contraddizione 1 (BROWNFIELD_EXCLUSION_RULES.md + BOOTSTRAP_PROMPT §1.6) |
| F30 | Prometheus `/metrics`: fasi 1-4 dichiarate shippate in main ma flag `PROM_METRICS_ENABLED` OFF; fase 5 gated su Enzo — **fonte documentale (D-09), non riverificata sul codice in questo ciclo** | `docs_censimento_pass2_c.md` §In corso |
| F31 | Console agente `/dev/agent` Parziale: flag build-time, non linkata dal menu, gateway esterno; l'accesso in abbonamento risulta chiuso (`AGENT_GATEWAY_SUBSCRIPTION_AUTH=1`) — **quest'ultimo da memoria di progetto, non rimisurato oggi** | `inventario_raw.md` area T + memoria progetto agent9 |
| F32 | La spec di design sull'arricchimento dati (2026-06-07) ammette solo fonti ufficiali: ESCO, ISTAT/Eurostat, ATECO/NACE, **registri CCNL pubblici** — e sconsiglia lo scraping arbitrario | `docs_censimento_pass2_c.md` §Decise poi scartate |
| F33 | "Future Evolution" del blueprint bancario (mai costruite): Workforce Intelligence Graph · Digital Twin of the Organization · AI-Assisted Experience · Process Mining · Compliance-by-Design | `docs_censimento_pass2_c.md` §Menzioni |
| F34 | La storia RTL a 36 mesi è scorrevole (arriva a ieri, avanzamento schedulato su VM) — base dati viva per ogni demo | CLAUDE.md §storia36 + memoria progetto D-STORIA-B (dichiarativa di progetto) |

## Fonti (S) — competitor, tutte consultate il 2026-08-25

| id | fonte | cosa sostiene | affidabilità |
|---|---|---|---|
| S1 | competitor_personio.md §talent-care — personio.com/product/\*, support.personio.de, marketplace | Succession planning nativo: **non trovata evidenza**; disponibile solo via integrazione terza (TalentMapper) | ricerca mirata con NTE dichiarato |
| S2 | competitor_personio.md §Formazione — personio.com/product/\*, marketplace.personio.com/category/learning-and-development | LMS nativo: **non trovata evidenza**; delega a LMS terzi via marketplace | idem |
| S3 | competitor_personio.md §packaging + personio.com/product/whistleblowing | Whistleblowing è **add-on a pagamento separato** | Documentato |
| S4 | competitor_personio.md §Integrazioni/packaging — developer.personio.de, support art. 11149358090653 | API custom, webhook, SSO/OAuth solo nel piano superiore (Core Pro); marketplace 200+ integrazioni | Documentato (fetch bloccati 403, contenuto da snippet indicizzati — flag dichiarato) |
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
| S15 | competitor_personio.md S43-S44 + competitor_eightfold.md §packaging | Nessuno dei tre pubblica un listino: prezzo a preventivo/contatto commerciale | Documentato (assenza) + Riportato |

## Avvertenze di lettura

- I fatti F30, F31 e F34 portano una componente **documentale o di memoria** dichiarata nella riga: vanno rimisurati prima di diventare fondamento di un'esecuzione.
- Le celle Personio derivate da snippet indicizzati (blocco anti-bot 429/403) sono Documentato-con-flag: il testo proviene dal dominio vendor ma senza rendering diretto della pagina (dichiarato in `competitor_personio.md` testata).
- «Non trovata evidenza» non significa «non ce l'ha»: significa che la ricerca mirata, descritta nel raccolto, non ne ha trovato traccia.
