# Competitive Scorecard — heuresys-advanced vs alta fascia

> **Nota del 2026-11-25 (com'è oggi).** Benchmark di giugno 2026, tarato sul posizionamento di allora. Il posizionamento di oggi è ADR-0054 (piattaforma del cambiamento organizzativo): il confronto va rifatto su quello prima di usarlo. Le sezioni 5 e 6 (integrabilità e buone pratiche della consulenza, analisi del 2026-10-31) sono più recenti e sono accorpate qui dalla cartella del progetto.

> Benchmark investor-grade, postura avversariale. Ricerca **web live giugno 2026** (12 ricerche, 11+ competitor). Fonti in calce.
> Contesto che incornicia tutto: il **Forrester Skills Intelligence Solutions Landscape Q1 2026** censisce **27 vendor**. heuresys non entra in un vuoto di categoria — entra in un mercato affollato in consolidamento.

## 1. Matrice di copertura

Legenda: ● nativo/forte · ◐ parziale/via integrazione · ○ assente/marginale.

| Vendor | Process | Structure | Role | Competence | Performance | Ontologia | Approccio AI | Segmento |
|---|---|---|---|---|---|---|---|---|
| Workday Skills Cloud | ○ | ◐ | ● | ● (~73k) | ● | Proprietaria ("most open") | ML + graph | Enterprise |
| SAP SuccessFactors + Signavio | ● (Signavio) | ◐ | ● | ● | ● | Proprietaria multi-source | ML + process mining | Enterprise |
| Eightfold AI | ○ | ◐ | ● | ● (1.6M) | ◐ | Proprietaria deep-learning | Deep learning (1.6B carriere) | Mid-Enterprise |
| Beamery | ○ | ◐ | ● | ● (Talent Graph 17B) | ◐ | Proprietaria "strongly typed" | GenAI + KG | Enterprise |
| Visier | ○ | ◐ | ◐ | ◐ | ● | Data model proprietario | Analytics + GenAI | Enterprise |
| Gloat | ○ | ◐ | ● | ● (multi-ontology graph) | ◐ | Proprietaria + public | AI inference + graph | Enterprise |
| Lightcast | ○ | ○ | ● | ● (32k+) | ○ | **Aperta/trasparente** | Data mining bottom-up | Data layer B2B2X |
| Concentra/Orgvue | ◐ | ● (org design) | ● | ◐ | ◐ | Proprietaria | Predictive + scenario | Enterprise/consulting |
| Microsoft Viva (Glint/Skills) | ○ | ○ | ◐ | ◐ (LinkedIn) | ● | LinkedIn graph | Copilot GenAI | Enterprise (MS) |
| Cornerstone (Galaxy/SkyHive) | ○ | ◐ | ● | ● (53-55k) | ● | Proprietaria + 40TB | Inference + Galaxy AI | Enterprise |
| **365Talents** (EU) | ○ | ◐ | ● | ● (dynamic) | ◐ | **ESCO/O*NET/WEF-aligned** | AI enrichment | Mid-Enterprise EU |
| TechWolf (EU) | ○ | ○ | ● | ● (35k) | ○ | Proprietaria KG | 5-layer AI | Enterprise (infra) |
| **heuresys-advanced** | ● (BPM statico) | ● (position-centric) | ● (PIP) | ● (ESCO 21.9k) | ● | **ESCO-native aperta** | Euristiche deterministiche + kNN | (target) mid-market EU |

**Lettura**: heuresys è l'**unico** a marcare ● su tutte e 5 le dimensioni *insieme* a ontologia aperta. MA ogni singola dimensione è già coperta a ● da ≥1 incumbent con risorse 100-1000×. Copertura "full-spectrum" **ampia ma sottile** (euristiche, 0 dati clienti) vs incumbent profondi su 3-4 dimensioni con anni di dati reali. Nota: il ● Process di heuresys è *modeling statico*, non runtime.

## 2. Adjudicazione spietata dei 4 differenziatori dichiarati

| # | Differenziatore | Verdetto | Perché |
|---|---|---|---|
| a | Ontologia ESCO aperta vs proprietaria | **Table-stakes → svantaggio** | Lightcast è aperta+trasparente e più grande (32k); 365Talents è già ESCO-aligned ed è EU. ESCO ~22k è **più piccola** di Workday 73k / Cornerstone 53k / Lightcast 32k. "Aperta ma piccola" è arma a doppio taglio. Margine reale solo in EU pubblico/regolato + anti-lock-in. |
| b | Grafo unificato a 5 dimensioni | **Genuinamente distintivo MA fragile** | È il claim più forte: nessun singolo vendor copre con eguale ampiezza in un solo grafo. Ma il KG è standard de facto (Beamery/Cornerstone/Gloat/Workday), esiste già un brevetto USPTO su "unified graph of skills and acumen", ed è realizzato con euristiche+kNN senza data moat → **demo architetturale, non vantaggio difendibile**. |
| c | 3 prospettive unificate | **Table-stakes** | Multi-persona sullo stesso modello è standard (Visier, SAP TIH, Gloat, Cornerstone). E heuresys ne ha implementata **solo 1 su 3** (HR). |
| d | Continuous platform vs consulting | **Table-stakes / nemico di paglia** | Tutti gli incumbent SaaS sono già "continuous". Il claim combatte le società di consulting org-design, non i veri competitor software. |

**Sintesi**: dei 4, **solo (b) è distintivo**, e solo come ampiezza-di-concept, non come vantaggio difendibile.

## 3. Top 5 minacce · Top 3 white-space

**Minacce**: (1) **365Talents** — EU, ESCO-aligned, Forrester-listed, clienti reali → annulla gran parte del diff. (a); (2) **SAP SuccessFactors+Signavio** — l'unico che unisce davvero process+skills+org su scala → attacca il diff. (b); (3) **Lightcast** — apertura ontologica maggiore, venduta come layer-dati sotto chiunque; (4) **Gloat/Beamery** — grafo+GenAI su dati reali, profondità che heuresys non eguaglia; (5) **TechWolf** — skills-infra leggera, GTM imitabile ma con prodotto+clienti+AI già pronti.

**White-space onesti**: (1) **mid-market EU regolato/pubblico** sensibile a sovranità dati + standard pubblici (ESCO) — il meno improbabile; (2) **process+org come grafo unico sotto-SAP** sfruttando la **position-centricity** (l'asset architetturale più sottovalutato); (3) **spiegabilità/anti-black-box come compliance play AI-Act** — l'unico contesto in cui "no real ML" si capovolge in feature.

## 4. Segmento con la chance meno improbabile

**Mid-market europeo (IT in primis), regolato/pubblico**, buyer sensibile a sovranità dati + standard aperti + spiegabilità algoritmica. Enterprise precluso (no data moat, 0 clienti, single dev). SMB sbagliato (niente complessità da risolvere). In quel segmento i tre asset reali convergono (ESCO rilevante, euristiche = AI-Act-compliant, position-centric serve org-design sotto-SAP) e il competitor diretto è essenzialmente **uno (365Talents)** invece di 27.

**Caveat non addolcito**: anche lì la chance resta *improbabile in assoluto* — pre-revenue + single dev + 0 clienti + no data moat + 27 vendor. La difendibilità non viene dal prodotto (replicabile, non brevettato) ma da GTM + dati accumulati + brand, oggi assenti. La tesi "Organizational Intelligence" come *nuova categoria* **non regge**: va riposizionata come *skills+org intelligence EU-native, ESCO-based, AI-Act-explainable per mid-market regolato*, 1-vs-1 vs 365Talents.

## 5. V8 mercato - integrabilità: affiancare SAP SuccessFactors, Zucchetti, JetHR (e TeamSystem, Workday)

> Accorpato il 2026-11-25 dalla cartella del progetto (`analisi-interfacce/V8_mercato/`, analisi del mercato del 2026-10-31). I rimandi «raccolta/<file> fonte N» puntano agli elenchi delle fonti nell'appendice di `analisi-interfacce/V8_mercato/schede_gruppi.md`, nella stessa cartella del progetto; le affermazioni dei fornitori sono loro dichiarazioni, non verificate.

Data: 2026-10-31. Base: raccolta/ (fonti del 2026-10-31) più sei ricerche web pubbliche del 2026-10-31 (documentazione ufficiale e pagine di terzi, senza login). Nessuna API è stata chiamata e nessuna area riservata è stata aperta.

Convenzione: [F] = fatto citato, con URL; [D] = deduzione dell'autore. Dove una cosa non è stata trovata la dicitura è «non rilevato nelle fonti pubbliche», che non significa assente: molte interfacce sono documentate solo ai clienti o ai partner.

Premessa di scopo: il mandato è proporre Heuresys sia direttamente ai clienti finali sia come strato che affianca il sistema già in uso. Questo file risponde a quattro domande per fornitore: come si integra un terzo, dove Heuresys può affiancarlo, che cosa deve esporre Heuresys, che cosa non si sa.

### 1. Riepilogo per fornitore

| Fornitore | Accesso ai dati per un terzo | Programma partner o marketplace | Standard dichiarati | Difficoltà (deduzione) |
|---|---|---|---|---|
| SAP SuccessFactors | API OData v2 e v4, Compound Employee API (SOAP) | SAP Business Accelerator Hub, SAP Store, SAP PartnerEdge (Build) | OData, SAML2-Bearer per l'accesso | alta |
| Workday | REST (JSON), SOAP, Report-as-a-Service, WQL, Graph API (GraphQL), Extend | Developer site, Extend; marketplace partner non confermato | REST, SOAP, OAuth | alta |
| Zucchetti | Nessuna API HR pubblica rilevata; web service e connettori su accordo | Programma partner e rivenditori; scheda su Microsoft Marketplace | nessuno rilevato | molto alta senza partner |
| JetHR | Jet API (token per applicazione), connettore Odoo, API native per grandi imprese | non rilevato | non rilevato | bassa |
| TeamSystem | Nessuna API HR pubblica rilevata (solo fatturazione elettronica) | TeamSystem Store | non rilevato | alta senza partner |

### 2. SAP SuccessFactors

#### 2.1 Come si integra un terzo

- [F] Due API: OData e SFAPI. «SFAPI is a SOAP Web Service designed for importing and exporting data»; è «currently being deprecated», con la Compound Employee API come sola entità che non sarà deprecata. L'API OData è basata su OData V2, è «data oriented», con accesso CRUD, «best used for frequent or real time requests for small amounts of data». Fonte: SAP KBA 2613670, https://userapps.support.sap.com/sap/support/knowledge/en/2613670
- [F] La guida di riferimento delle API Employee Central è su OData V2 e rinvia a OData V4 come «the latest version of the OData protocol»; la pagina elenca anche Authentication, Rate Limits e API Center. Fonte: https://help.sap.com/docs/successfactors-platform/sap-successfactors-api-reference-guide-odata-v2/about-employee-central-odata-apis
- [F] Integration Center: strumento che usa l'API OData e che «enables HR business analysts to build, run, schedule, and monitor simple integrations». Fonte: KBA sopra.
- [F] L'accesso richiede un utente tecnico (ISU) con permessi sulle API Employee Central e l'OAuth 2.0 registrato in Admin Center, API Center. Fonte: connettore Workato, https://docs.workato.com/en/connectors/successfactors/successfactors.html
- [F] Il connettore Workato dichiara di aver superato l'Application Readiness Check richiesto da SAP PartnerEdge; il connettore MuleSoft supporta interrogazione, creazione, aggiornamento e cancellazione tramite OData. Fonti: link precedente e https://docs.mulesoft.com/sap-successfactors-connector/latest
- [F] Apideck (terza parte) valuta l'integrazione «highly_complex»: autenticazione con asserzione SAML2-Bearer firmata con certificato X.509 («not a standard OAuth consent flow»); nessun sandbox pubblico; i prezzi non sono pubblicati; SAP PartnerEdge Build è facoltativo e dà accesso a portale e documentazione, mentre i tenant di prova richiedono una licenza di sviluppo a pagamento. Fonte: https://developers.apideck.com/apis/hris/sap-successfactors/overview.md
- [F] Il SAP Business Accelerator Hub (api.sap.com) è il portale in cui SAP pubblica le specifiche di tutte le sue API e permette di provarle. Fonte: pagina Employee Central sopra.
- [F] La scheda prodotto cita «SAP Store and SAP Business Accelerator Hub» per applicazioni di partner. Fonte: https://www.sap.com/products/hcm/employee-central-hris/features.html
- [F] SCIM, webhook ed eventi per SuccessFactors: non confermati dalle fonti raccolte. Gli «Events on SAP Business Accelerator Hub» trovati riguardano SAP S/4HANA.

#### 2.2 Dove Heuresys può affiancarlo

- [F] La Position Organization Chart esiste e si apre dall'azione «Create position»; la gestione posizioni è «embedded position management capabilities that support all worker types». Fonti: SAP Help, Position Organization Chart (URL in schede_gruppi.md A5) e pagina Employee Central.
- [F] Il Latest Org Chart «can display up to 1,000 reports under a single manager», mostra solo dipendenti attivi e ha problemi di visualizzazione su Firefox e Safari. Fonti: SAP Help Latest Org Chart e Using Org Chart.
- [F] Il modello di permessi per la gestione posizioni è descritto in una pagina separata («Permissions for Position Management») che la raccolta non ha estratto.
- [D] SAP ha la posizione, ma come modulo opzionale dentro Employee Central; Heuresys la tiene come entità primaria, con competenze ESCO, KPI, profilo di intelligenza e modalità di accesso a quattro livelli. Spazi di affiancamento ipotizzabili: (a) livello di analisi di competenze e successione che legge posizioni e persone da Employee Central via OData e restituisce proposte; (b) simulazione organizzativa fuori dal sistema di registrazione, con scrittura di ritorno solo dopo approvazione umana; (c) vista di posizione per i responsabili che non hanno accesso ai moduli SAP.
- [D] Il rischio dell'affiancamento è la duplicazione del dato anagrafico: SAP resta sistema di registrazione, Heuresys deve dichiarare quali tabelle sono importate e quali native (invariante I23 e ADR-0041).

### 3. Workday

#### 3.1 Come si integra un terzo

- [F] Le API sono: REST («designed for small, user-initiated, self-service transactions... utilizing the JSON format»), SOAP («leading practice for system-to-system integrations involving large volumes of data»), Graph API (GraphQL). Fonte: https://developer.workday.com/api-overview
- [F] Report-as-a-Service: un report personalizzato diventa un servizio web con uscite CSV, GData, JSON, RSS, Simple XML, Workday XML; usabile anche da Excel. Fonte: https://developer.workday.com/documentation/hto1529968349582
- [F] Strumenti di integrazione: EIB (procedura guidata), Cloud Connect (modelli già pronti), Studio (Java, il più personalizzabile); sorgenti dati: API pubbliche, API personalizzate (RaaS), Data Initialization Service. Fonte: https://doc.workday.com/workday-education/en-us/course-manuals/security-for-administrators/integrations.html
- [F] Workday Extend: sviluppo di app dentro Workday con REST sul gateway `api.workday.com/{service}/{version}/{resource}`; ogni metodo REST è protetto da una security policy e vale per un utente di integrazione come per una persona. Fonte: https://developer.workday.com/documentation/gya1560920237072
- [F] Il connettore Microsoft per Workday usa OAuth e limita le chiamate a 200 per connessione ogni 60 secondi (limite del connettore, non di Workday). Fonte: https://learn.microsoft.com/en-us/connectors/workdaysoap
- [F] Workday elenca nel Developer site Community, API, MCP e documentazione. Fonte: https://developer.workday.com/api-overview
- [F] Un programma partner o un marketplace di Workday per prodotti di terzi non è stato confermato dalle fonti raccolte. SCIM per Workday non è stato confermato.

#### 3.2 Dove Heuresys può affiancarlo

- [F] Workday organizza in «supervisory organizations»: «Supervisory organizations... group workers into a management hierarchy and are the primary organization type»; Position Management e Job Management sono due modelli di staffing alternativi. Fonte: Geisinger, URL in schede_gruppi.md A3.
- [F] Un recensore su Capterra riferisce «delayed, inconsistent, or hard-to-access assistance»; prezzo «Contact vendor for pricing», niente prova gratuita. Fonte: https://www.capterra.com/p/66908/Workday-HCM (terza parte).
- [D] Come per SAP: la gerarchia di Workday è organizzativa, la posizione è un'opzione. Spazio: analisi per posizione e competenze su dati letti con RaaS (aggiornamento periodico) o REST, e restituzione tramite Extend solo in organizzazioni che lo acquistano. Il canale Extend ha un costo di licenza e di sviluppo non pubblico: è un canale di grandi clienti.

### 4. Zucchetti (HR Infinity e HR Portal)

#### 4.1 Come si integra un terzo

- [F] Nessuna API HR pubblica è stata trovata. La pagina «API pubbliche» di Zucchetti riguarda il portale Servizi-IT e rinvia a una documentazione OpenAPI di quel portale, non della suite HR. Fonte: https://help.zucchetti.it/cms/kb/soluzioni/servizi-it/api-pubbliche
- [F] Un integratore terzo (Sector Growth, pagina del 2026-09-28) afferma che per Ad Hoc e Infinity «the interface itself is documented only to the distributors», che Zucchetti non pubblica una documentazione di interfaccia e che non esiste un'app nel marketplace HubSpot. Fonte: https://apps.sectorgrowth.com/integrations/zucchetti (affermazione di terza parte su ERP Ad Hoc/Infinity, non sulla suite HR).
- [F] Il partner Technology Partners Italia scrive: «Connettori, migrazioni e automazioni richiedono una verifica tecnica». Fonte: https://www.tp-italia.com/hr.html
- [F] Il caso cliente Lastminute (Zucchetti, 2020) dichiara dati in tempo reale «via web service» e un repository anagrafico globale. Fonte: fonte 8 di raccolta/B_zucchetti_hr_infinity.md.
- [F] Le presenze Zucchetti importano file: «Certificati elettronici di malattia dal file .xml fornito dall'INPS»; «Terminali e software paghe, sia di Zucchetti sia di fornitori esterni». Fonte: https://www.zucchettisystema.it/cms/prodotto/198-rilevazione-presenze.html
- [F] La suite ha una scheda su Microsoft Marketplace («Zucchetti HR», di Zucchetti SpA, «Contact me»). Fonte: https://marketplace.microsoft.com/en-us/product/saas/zucchettispa1742371683827.zucchetti-hr?tab=overview
- [F] Zucchetti pubblica una pagina per diventare partner (https://www.zucchetti.com/en/cms/partners/become-partner-zucchetti/partner-zucchetti.html) e la scheda 3 di raccolta/B_zucchetti_hr_infinity.md mostra l'esistenza di «Top Partner ERP Zucchetti».
- [F] Factorial pubblica un'integrazione con Zucchetti nella categoria Payroll, gratuita, disponibile in Italia. Fonte: https://factorialhr.com/apps/integration/zucchetti (la natura tecnica non è stata aperta).
- [F] Il sito Zucchetti ha aree riservate separate per clienti e per distributori Infinity, Ad Hoc e Alter Ego (support.zucchetti.it). Fonte: collegamenti nella pagina https://www.zucchetti.com/en/cms/our-group/group-companies/zucchetti-axess.html. Si attesta l'esistenza delle aree, non il contenuto: non è provato che vi sia documentazione di API.
- [F] La pagina per diventare partner citata sopra è presente nel sito della consociata Zucchetti Axess (controllo accessi); non è provato che valga per la suite HR.
- [D] L'integrazione realistica è per file (esportazioni CSV o XML con tracciato concordato) o per web service concordati con il cliente e il suo partner Zucchetti, non per API pubblica. Zucchetti vende anche tramite rivenditori: l'accordo con loro è parte della strategia.

#### 4.2 Dove Heuresys può affiancarlo

- [F] HR Infinity dichiara una base dati unica, un portale profilato per HR, manager e dipendenti, analytics con semafori, organigramma con flussi di approvazione, e moduli di selezione, formazione, compensation. Fonti: pagine in schede_gruppi.md B1, B2, B5.
- [F] La parte analitica è descritta con indicatori su assunzioni, retribuzioni, promozioni, assenteismo e turnover (https://www.zucchetti.it/website/cms/prodotto/2985-hr-analytics.html); posizione, competenze e successione compaiono solo come voci di elenco (pagina Delta Informatica).
- [D] Zucchetti è forte su paghe, presenze e portale: sono le aree dove Heuresys è assente (copertura.tsv: Presenze, Payroll, Onboarding). Heuresys non deve competere su queste aree; può leggere da Zucchetti dati organizzativi e contrattuali e fornire sopra di loro posizioni, competenze, successione e simulazioni. Lo scopo per il cliente Zucchetti è colmare ciò che la suite mostra poco.
- [D] Barriera: nessuna documentazione pubblica; senza un cliente che porti il suo partner, la prima integrazione sarebbe un progetto su misura.

### 5. JetHR

#### 5.1 Come si integra un terzo

- [F] Esiste una documentazione pubblica delle API: https://api-doc.jethr.com/docs/introduction (pagina aggiornata, con indice leggibile da agenti in https://api-doc.jethr.com/llms.txt; la pagina introduttiva ha solo il testo «This page will help you get started»). 
- [F] Creazione dell'accesso: un amministratore apre Impostazioni azienda, API, «Le mie applicazioni», crea una nuova applicazione con nome e «Accessible resources» (All oppure Customize) e riceve un token; un token non si rigenera, si crea una nuova applicazione; si consiglia una applicazione per integrazione. Fonte: https://api-doc.jethr.com/docs/your-first-application (aggiornata il 2026-08-26).
- [F] Connettore Odoo: «Integrazione completa tra Odoo e Jet HR con sincronizzazione bidirezionale dei dati»; sincronizza ruoli, mansioni e dati di contratto. Fonte: https://jethr.odoo.com/
- [F] Comunicato di aprile 2026: Jet HR Enterprises prepara «un sistema di API native che consente alla piattaforma di integrarsi e dialogare fluidamente con i principali ERP e applicativi gestionali»; il segmento enterprise vale oltre il 30% dell'ARR. Fonte: comunicato PDF, fonte 9 di raccolta/B_jethr.md.
- [F] Il piano «Advanced» comprende «integrazioni e sicurezza», e compaiono «Accesso sicuro con SSO» e «Campi personalizzati». Fonte: https://jethr.com/prezzi
- [F] Un HR manager recensore scrive «Assolutamente positiva, soprattutto se poi ascoltano i clienti e procedono con le integrazioni». Fonte: https://www.capterra.it/software/1008108/jethr (terza parte).
- [F] Non sono stati rilevati: webhook, limiti di chiamate, elenco delle risorse, programma partner o marketplace.

#### 5.2 Dove Heuresys può affiancarlo

- [F] Jet HR è una piattaforma di rapporto di lavoro, presenze, paghe e consulenza («Consulente del Lavoro» partner), con directory dipendenti automatica, prezzo da 30 euro a dipendente al mese, circa 1.500 aziende clienti dichiarate. Fonti: https://www.jethr.com/cose-jet-hr, https://jethr.com/prezzi, comunicato busta paga.
- [F] Funzioni di performance, competenze, successione e organigramma non risultano fra le funzioni pubblicate; compare solo «Dashboard delle prestazioni» su Capterra (terza parte).
- [D] JetHR è il fornitore più aperto del gruppo (documentazione pubblica, token per applicazione, intenzione dichiarata di rafforzare le API) e quindi il candidato per una prima integrazione dimostrativa: leggere persone e contratti da Jet API, aggiungere posizione e competenze sopra, e restituire (se la risorsa lo consente, da verificare) assegnazioni e ruoli.
- [D] Il cliente tipico di JetHR è piccolo e medio; il profilo target di Heuresys (mid-market regolato, PRD) si sovrappone solo nella parte alta, dove JetHR Enterprises vuole crescere. L'affiancamento è quindi anche una scelta di sequenza commerciale, non solo tecnica.

### 6. TeamSystem

#### 6.1 Come si integra un terzo

- [F] Nessuna API HR pubblica è stata trovata. L'unica API documentata riguarda la fatturazione elettronica: «Digital Invoice dispone di un ampio set di API per l'integrazione con altri applicativi». Fonte: fonte 10 di raccolta/B_teamsystem_hr.md (TeamSystem Store).
- [F] L'architettura è descritta (brochure partner del 2022) con «TeamSystem Framework (autenticazione TS ID, Servizi di integrazione)», «ANALYTICS DATA SERVICE» e un portale per HR centrale, HR business partner, manager e dipendenti; il prodotto «è in grado di controllare la qualità del dato e garantire il corretto funzionamento dei flussi con i sistemi utilizzati dal cliente». Fonte: https://www.alphateam.it/wp-content/uploads/2022/04/HR-BROCHURE-estesa.pdf
- [F] Un articolo editoriale TeamSystem (2025-03-07) cita le API come mezzo di comunicazione con gli stakeholder. Fonte: https://www.teamsystem.com/magazine/risorse-umane/hr-e-intelligenza-artificiale-prospettive-future (visione, non specifica di prodotto).
- [F] Il prodotto Studio HR AI è rivolto ai consulenti del lavoro, che abilitano i clienti: il portale è «il punto di accesso per i Clienti dello Studio a cui sia stata abilitata l'area ... dal proprio Consulente del Lavoro». Fonte: https://www.teamsystem.com/hr/teamsystem-studio-hr/portale-dipendente-app
- [D] Il canale è il consulente del lavoro: qualsiasi integrazione passa da uno studio che gestisce il cliente. Le specifiche di integrazione non sono pubbliche.

#### 6.2 Dove Heuresys può affiancarlo

- [F] TeamSystem HR copre paghe, presenze, turni, incentivi, welfare, salute e sicurezza, portale e app; l'organizzazione «configura ruoli e posizioni di responsabilità» per alimentare organigramma e centri di costo. Fonti: URL in schede_gruppi.md B1 e B5.
- [D] Come per Zucchetti: lo spazio è sopra il sistema di paghe e presenze (competenze, successione, simulazioni), con scambio di file o accordo con lo studio.

### 7. Altri riferimenti utili

- [F] Personio: piano Core Pro con «Access to Public API», OAuth, integrazioni Okta ed Entra ID, «custom integrations (API credentials for building your own integrations)»; marketplace con 200 e più integrazioni. Fonte: https://support.personio.de/hc/en-us/articles/11149358090653-Overview-of-Personio-plans-and-apps (2026-09-15) e https://www.personio.it/pricing.
- [F] Factorial: API pubblica, Zapier, Slack, Microsoft Azure, Okta, programma «Partner Integrations». Fonte: https://factorial.it/integrazioni
- [F] ADP: API Central con wizard di ricerca, credenziali con certificato SSL reciproco, accesso limitato ai clienti, ai partner del Marketplace e agli integratori che lavorano per loro; progetti MCP con accesso per utente. Fonti: https://developers.adp.com/ e https://apps.adp.com/en-US/apps/410612/adp-api-central-for-adp-workforce-now-and-adp-workforce-now-next-generation/features
- [F] UKG Pro: servizi SOAP 1.2 e REST JSON/XML con «Customer API key» e «User API Key», account di servizio con permessi per servizio; richiede «the active participation of a customer programming resource». Fonte: https://developer.ukg.com/hcm/reference
- [F] Celonis: Event Subscription API per «discover business triggers, manage trigger subscriptions and receive spontaneous Celonis business events», Data Push, Agent Tools (MCP), limiti di frequenza. Fonti: https://developer.celonis.com/process-intelligence-apis/overview e https://learn.microsoft.com/en-us/connectors/celonis
- [F] ServiceNow: integrazione Workday costruita da un partner (Bristlecone), dipendente dal Workday HR Spoke; sincronizza profili e attività. Fonte: https://www.servicenow.com/docs/r/employee-service-management/hr-service-delivery/w-integration.html
- [D] Il pattern del mercato è: API REST con credenziali per applicazione e per risorsa (Jet HR, Personio), account tecnico con permessi per servizio (UKG, SAP ISU), marketplace per la distribuzione, MCP per gli agenti (ADP, Celonis, Workday), eventi a sottoscrizione (Celonis).

### 8. Standard utili

| Standard | A che cosa serve | Fonte | Uso per Heuresys (deduzione) |
|---|---|---|---|
| SCIM 2.0 (RFC 7643 schema, RFC 7644 protocollo) | Provisioning di utenti e gruppi fra sistemi di identità | https://www.rfc-editor.org/rfc/inline-errata/rfc7644.html e https://scim.cloud/ | Heuresys come destinatario del provisioning da Entra ID o Okta; come origine per gruppi/ruoli. Non è uno standard per dati HR completi |
| OData (v2 e v4) | API dati REST con query standard; usato da SAP | https://help.sap.com/docs/successfactors-platform/sap-successfactors-api-reference-guide-odata-v2/about-employee-central-odata-apis | Lato consumo: leggere da SuccessFactors. Lato offerta: non necessario |
| HR Open Standards (HR-JSON, HR-XML 4.x) | Vocabolari liberi per Worker, Recruiting, Payroll, Time, Benefits, Compensation | https://www.hropenstandards.org/standards | Mappa di riferimento per i dati di assegnazione e reclutamento; copertura di posizioni e competenze non verificata |
| HR Open Standards, Skills Data API | Schema di API per scambio di competenze (pre-release del gennaio 2026) | https://www.hropenstandards.org/workgroups e https://www.hropenstandards.org/news/430-standard-launches- | Possibile punto d'allineamento per le competenze ESCO; maturità da verificare |
| Webhook (eventi HTTP) | Notifica di eventi in uscita | Nessuno standard HR rilevato; modello pratico: Celonis Event Subscription | Notifiche firmate con ripetizione |
| OpenAPI | Descrizione delle API | In Heuresys è già presente ma disattivata (apps/api/src/app.ts, righe 235-240) | Pubblicare la specifica come contratto per partner |

### 9. Che cosa Heuresys dovrebbe esporre per integrarsi

Stato di partenza verificato nel repository (sola lettura, 2026-10-31):

- [F] Specifica OpenAPI/Swagger registrata ma «gated OFF by default» tramite la variabile API_DOCS_ENABLED. Fonte: apps/api/src/app.ts, righe 235-240.
- [F] Esportazione universale `?format=csv|xlsx|pdf` su circa 85 rotte di elenco, dopo i controlli di accesso. Fonte: docs/product/FUNCTIONAL_CAPABILITY_LEDGER.md, sezione 6, riga Export universale (la cifra va ricontata con docs/kb/SOT_STATE.md).
- [F] Moduli esistenti utili: tenant-import-runs (corse di importazione), reference-sync (connettori ESCO e ATECO in ingresso), auth con MFA e WebAuthn (apps/api/src/modules/auth).
- [F] Una ricerca testuale di scim, oidc, saml e webhook in apps/api/src e packages non ha prodotto risultati. Questa è una ricerca per parola chiave: la sua assenza va verificata sul codice prima di affermarla.

Proposte, in ordine di priorità (tutte [D]):

1. Pubblicare le API come prodotto. Specifica OpenAPI versionata e stabile per un sottoinsieme di risorse (unità organizzative, posizioni, persone, assegnazioni, competenze, profilo di intelligenza della posizione, approvazioni), con sandbox o tenant di prova per partner. Motivo: tutti i fornitori ben integrati lo fanno (Jet HR, Personio, UKG, SAP).
2. Credenziali per applicazione, non per persona. Applicazioni di integrazione create da un amministratore, con risorse accessibili scelte («All» o «Customize», come Jet HR) e token revocabili; macchine con ruolo tecnico che rispettano lo stesso modello di accesso (perimetro gerarchico per modalità edit, read, mask, none). Una integrazione non deve poter vedere più di quanto vede il mandato che le è stato dato; il sistema di permessi di Heuresys è un elemento di vendita verso la sicurezza del cliente.
3. Identificatori esterni e sistema di origine su ogni entità che si può sincronizzare (persona, posizione, unità). Senza chiave esterna l'affiancamento diventa duplicazione. Dichiarare per ogni tabella se è nativa, importata o ibrida (I23).
4. Importazione con prova a secco: file CSV/XLSX con tracciato pubblico, simulazione che mostra cosa cambierebbe, applicazione con giornale di annullamento. Per Zucchetti e TeamSystem è la via realistica; coincide con la regola interna sulle scritture di massa.
5. Eventi e webhook in uscita: persona assunta, trasferita, posizione modificata, approvazione decisa, con firma, ripetizione e registro di consegna.
6. Provisioning e accesso: SCIM 2.0 in ingresso per utenti e gruppi, e accesso unico con OpenID Connect o SAML per i clienti che hanno Entra ID o Okta (JetHR, Personio e Factorial citano SSO). Da verificare lo stato attuale.
7. Connettori di lettura dedicati, in ordine: JetHR (API pubblica), SuccessFactors (OData, utente tecnico), Workday (Report-as-a-Service o REST), Zucchetti e TeamSystem (file concordati, poi web service con il partner).
8. Esposizione ad agenti: un punto di accesso MCP con gli stessi permessi dell'API (modello ADP e Celonis).
9. Mappa verso HR Open Standards per Worker, Position e Skills, per le richieste di un cliente che già usa quello standard.
10. Registro di verifica per integrazione: chi ha letto o scritto che cosa, con tenant e applicazione, per dimostrare al cliente che l'integrazione non esce dai suoi limiti.

### 10. Lacune e passi successivi

- Non sono stati letti elenchi di risorse, limiti di frequenza e condizioni contrattuali delle API di Jet HR, SAP e Workday. Le pagine JetHR sono indicizzate ma la documentazione richiede apertura mirata.
- Nessuna prova su Zucchetti o TeamSystem senza un cliente o un partner: serve una conversazione commerciale.
- I termini di licenza dei programmi partner (SAP PartnerEdge, Workday) non sono stati letti.
- Non è stata confrontata l'offerta con analisti indipendenti.
- Prima di ogni contatto o crawling intensivo va letto il robots.txt dei singoli siti (non letto in questa passata, vedi raccolta/00_INDICE.md).

## 6. V8 mercato - buone pratiche indicate da Deloitte, Mercer, McKinsey e Korn Ferry

> Accorpato il 2026-11-25 dalla cartella del progetto (`analisi-interfacce/V8_mercato/`, analisi del mercato del 2026-10-31). I rimandi «raccolta/<file> fonte N» puntano agli elenchi delle fonti nell'appendice di `analisi-interfacce/V8_mercato/schede_gruppi.md`, nella stessa cartella del progetto; le affermazioni dei fornitori sono loro dichiarazioni, non verificate.

Data: 2026-10-31. Base: raccolta/D_deloitte.md, D_mercer.md, D_mckinsey.md, D_korn_ferry.md (accesso 2026-10-31, estratti del motore di ricerca; le citazioni vanno riverificate sulla pagina prima di un uso esterno).

Convenzione: [F] = fatto citato, con URL; [D] = deduzione dell'autore. Sono pubblicazioni di società che vendono consulenza: le cifre e le raccomandazioni sono posizioni del fornitore, non misure indipendenti.

### 1. Esperienza del dipendente

- [F] Deloitte (2025): il valore delle tecnologie HR si sposta su tre pilastri, produttività, costi e «Better: improve the employee experience to increase engagement and retention». Fonte: https://www.deloitte.com/us/en/insights/focus/human-capital-trends/2025/new-hr-technology-creates-new-tech-value-case.html
- [F] Deloitte (2020): l'autoservizio HR è diventato «Human Experience Management (HXM)». Fonte: https://www.deloitte.com/zm/en/services/consulting/perspectives/distinctly-human.html (articolo del 2020-06-19: dato datato).
- [F] Mercer (2025): «Employee expectations are shaped by consumer experiences. A seamless, personalized digital experience is now a top driver of retention, engagement and productivity». Fonte: https://www.mercer.com/en-us/insights/people-strategy/hr-transformation/priorities-for-2025
- [F] Mercer, stessa fonte: «Too many organizations (67%, in fact) implement technologies without changing how they work».
- [F] McKinsey (2025): «Hyper-personalizing the employee experience» e il miglioramento dei «moments that matter» lungo il ciclo di vita del dipendente (versione 2022). Fonti: https://www.mckinsey.com/capabilities/people-and-organizational-performance/our-insights/a-new-operating-model-for-people-management-more-personal-more-tech-more-human e https://www.mckinsey.com/capabilities/people-and-organizational-performance/our-insights/hrs-new-operating-model
- [F] McKinsey (2025-11): «Employee experience goes from nice to have to necessary to preserve engagement and human productivity». Fonte: https://www.mckinsey.com/capabilities/people-and-organization/our-insights/the-organization-blog/hrs-transformative-role-in-an-agentic-future
- [F] McKinsey HR Monitor 2025: «Enhancing employee experience: A strategic priority for engagement and retention». Fonte: https://www.mckinsey.com/~/media/mckinsey/business%20functions/people%20and%20organization/our%20insights/hr%20monitor%202025/hr-monitor-2025.pdf
- [F] Deloitte (2026): le organizzazioni vincenti ridisegnano il lavoro per «business and human outcomes, like trust, fairness, skills growth and a better day-to-day experience of work». Fonte: https://www.deloitte.com/us/en/about/press-room/deloitte-report-winning-organizations-will-build-the-human-advantage.html
- [F] Deloitte (caso cliente): la diagnosi era «fragmentation and silos meant HR professionals were often bogged down with transactional tasks (like repeatedly answering questions about vacations days)». Fonte: https://www.deloitte.com/us/en/what-we-do/case-studies/putting-the-people-part-in-play.html
- [D] Indicazioni operative per l'interfaccia: un solo punto d'accesso; risposta immediata alle domande ripetitive (ferie, saldi, cedolino); personalizzazione per ruolo e lingua; esperienza legata ai momenti del ciclo di vita (assunzione, trasferimento, promozione, uscita); fiducia e trasparenza nei confronti dell'AI. Heuresys copre il primo, il secondo in parte e il terzo (me/*); onboarding e offboarding risultano assenti (copertura.tsv, area Onboarding e offboarding).

### 2. Modello operativo HR

- [F] McKinsey (2022): le organizzazioni stanno cambiando la funzione dal «classic Ulrich model» verso archetipi EX-driven, leader-led e machine-powered; i grandi gruppi possono combinare più archetipi. Fonte: https://www.mckinsey.com/capabilities/people-and-organizational-performance/our-insights/hrs-new-operating-model (2022-12-22).
- [F] McKinsey HR Monitor 2026: «Agentic HR operating models are emerging, but large-scale AI adoption remains limited»; «The traditional Ulrich model is gradually giving way to more agile and technology-enabled configurations»; la pianificazione del personale resta di breve periodo. Fonte: https://www.mckinsey.com/capabilities/people-and-organizational-performance/our-insights/hr-monitor (2026-06-08).
- [F] McKinsey HR Monitor 2025: «shifting from rigid, role-based structures to gen AI–augmented workflows» e ampliamento dei centri servizi condivisi. Fonte: PDF HR Monitor 2025, URL in sezione 1.
- [F] McKinsey (2026): «Fast movers are already scaling AI-native models. Followers are modernizing SSCs into integrated GBSs». Fonte: https://www.mckinsey.com/~/media/mckinsey/business%20functions/people%20and%20organizational%20performance/our%20insights/the%20state%20of%20organizations/2026/the-state-of-organizations-2026.pdf
- [F] Mercer: modello operativo «outcome-driven, AI-native» con principi «Outcomes as the organizing principle», «Integrated teaming across HR, IT and the business», «A digital fabric that connects data, signals, workflows and experience»; componenti «Outcome delivery teams» e «Enablement services». Fonte: https://www.mercer.com/en-us/solutions/transformation/hr-transformation/hr-operating-model-design
- [F] Mercer (UK): Target Interaction Model con quattro dimensioni, processi, sistemi, contenuti, organizzazione; fasi di co-design, prototipo, test e iterazione. Fonte: https://www.mercer.com/en-gb/solutions/workforce-and-careers/hr-transformation/
- [F] Deloitte (2024): «Boundaryless HR» come disciplina che orchestra «work and blended resources, including humans and machines». Fonte: https://image.marketing.deloitte.de/lib/fe31117075640474771d75/m/1/96cf5d94-ee17-40a7-beca-f4e5e8f8ae72.pdf (2024-02-05).
- [F] Deloitte HR Shared Services: le operazioni HR si allargano oltre i servizi condivisi, verso «integrated solutions», livelli di coinvolgimento e automazione intelligente; modelli multifunzionali (global business services). Fonte: https://www.deloitte.com/us/en/services/consulting/services/hr-shared-services.html
- [F] Deloitte (caso cliente): quattro filoni annidati, riprogettazione del modello operativo HR, supportata da tecnologia e job architecture, con change management. Fonte: URL del caso in sezione 1.
- [D] Per un prodotto: ogni funzione deve poter essere esercitata da un responsabile di linea (leader-led) con l'HR che governa regole e dati; i tier di servizio (domande semplici risolte dall'autoservizio, casi complessi all'HR) devono essere visibili nell'interfaccia; il modello operativo cambia da cliente a cliente, quindi la configurazione dei flussi è parte del prodotto. Collegamento con Heuresys: il catalogo di modelli operativi (modulo operating-models) e la tipizzazione d'impresa sono un punto di partenza coerente; il motore di esecuzione dei processi manca.

### 3. Job architecture e position architecture

- [F] Korn Ferry: «Your job architecture needs to become a living framework that guides daily decisions, not just sit on a shelf»; l'architettura va guidata dalle ambizioni strategiche. Fonte: https://www.kornferry.com/insights/featured-topics/future-of-work/five-questions-to-ask-when-optimizing-your-job-architecture (2025-11-01).
- [F] Korn Ferry: un'architettura aggiornata definisce i ruoli per «skills and capabilities rather than rigid titles», rende possibile la mobilità interna e aiuta a individuare e correggere divari retributivi. Fonte: https://www.kornferry.com/insights/featured-topics/future-of-work-articles/designing-a-future-ready-job-architecture-framework (2025-06-05).
- [F] Korn Ferry: l'architettura serve alla trasparenza retributiva: «a shift from pay as a confidential and discretionary practice to pay as a visible and strategic component of the employee value proposition»; i dipendenti devono poter «see how roles connect and how they can grow». Fonte: https://www.kornferry.com/insights/featured-topics/organizational-transformation-articles/building-a-job-architecture-for-pay-transparency
- [F] Korn Ferry (metodo Hay): la valutazione del lavoro misura i fattori del ruolo «independent of incumbent characteristics, current salary»; obiettivi: chiarire strutture e responsabilità, trovare vuoti e sovrapposizioni di responsabilità, costruire strutture retributive, supportare la conformità; fattori Know-How, Problem Solving, Accountability (a cui l'università SFU aggiunge Working Conditions). Fonti: PDF Hay Guide-Chart (URL in schede_gruppi.md, D6) e https://www.sfu.ca/human-resources/total-compensation/compensation-corner/organization-structure.html
- [F] Korn Ferry Architect si dichiara integrabile con le piattaforme HCM: «Whether you're using Workday, SuccessFactors, or any other leading HCM platforms, Korn Ferry Architect integrates seamlessly with your existing systems». Fonte: URL del 2025-06-05 sopra.
- [F] Mercer Workforce Insights include fra gli indicatori «Job Architecture» e «Skill Profiling». Fonte: https://shop.mercer.com/workforce-insights.html
- [F] McKinsey (2025-11): «Hiring people into static roles based on experience no longer suffices»; priorità a meta-competenze come learning agility e capacità di lavorare con agenti. Fonte: URL del blog agentico in sezione 1.
- [D] Quattro indicazioni per un modello centrato sulla posizione: (1) separare il valore del posto dalla persona che lo occupa, in linea con I1; (2) legare il posto a competenze e non solo al titolo (il Profilo di intelligenza della posizione e le competenze ESCO vanno in questa direzione); (3) rendere visibili le traiettorie di crescita al dipendente (me/career); (4) tenere l'architettura «viva», cioè collegata alle decisioni quotidiane (assunzioni, retribuzione, successione) e non a un documento. Il punto 4 corrisponde al «test del valore» del PRD.
- [D] Un'opportunità di affiancamento: Korn Ferry e Mercer vendono architetture e valutazioni di ruolo come servizio con dati in tabelle e file; un prodotto che le tiene vive e collegate alle posizioni è complementare, e la loro integrazione con gli HCM mostra che il mercato accetta un livello di architettura separato dal sistema anagrafico.

### 4. People analytics

- [F] Deloitte (2023): «People decisions are inherently business decisions»; i team migliori bilanciano capacità umane e tecnologiche, che sono «too often developed and managed in silos»; i dati vanno oltre i sistemi HR (operations, finanza, vendite). Fonte: https://www.deloitte.com/us/en/services/consulting/articles/high-impact-people-analytics.html
- [F] Deloitte India: pochi riescono a «institutionalise and integrate People Analytics»; un cliente chiedeva di automatizzare i rapporti mensili. Fonte: https://www.deloitte.com/in/en/services/consulting/services/human-capital/people-analytics.html
- [F] Mercer Workforce Insights: confronto con benchmark di settore, «over three million data touchpoints», indicatori di retention, equità retributiva, previsione del turnover. Fonte: https://www.mercer.com/solutions/talent-and-rewards/rewards-strategy/workforce-insights
- [F] McKinsey HR Monitor 2026: pianificazione dell'organico ancora di breve periodo; serve una pianificazione «task- and capability-based». Fonte: https://www.mckinsey.com/capabilities/people-and-organizational-performance/our-insights/hr-monitor
- [F] McKinsey (2025-11): scenario modeling, workforce insights e culture monitoring come capacità potenziate dall'AI agentica. Fonte: URL del blog agentico.
- [F] Korn Ferry (CFO Dive, 2025-08): i consigli di amministrazione chiedono «do we have all these jobs benchmarked?». Fonte: https://www.cfodive.com/news/economic-uncertainty-spotlights-comp-incentive-strategies-korn-ferry/758550
- [D] Cinque indicazioni: dati da più sistemi (non solo HR) nello stesso modello; benchmark esterni accanto ai dati interni; scenari e pianificazione per competenze e compiti, non solo per teste; analisi che arrivano a una decisione (assunzione, formazione, successione) e non a un rapporto; automazione dei report mensili. Heuresys ha già analytics su competenze, reti e successione ma non benchmark esterni né pianificazione per compiti; i dati vengono dal solo perimetro HR.

### 5. Che cosa se ne ricava per il prodotto

- [D] I consulenti raccomandano di ridurre la distanza fra architettura dei ruoli, dati dei sistemi e decisioni; il valore di Heuresys sta nel tenere insieme posizione, competenze e organizzazione in un solo modello. È un argomento coerente con tutte e quattro le società.
- [D] Mercer (67% senza cambio di modo di lavorare) e McKinsey (adozione AI in fase pilota) indicano che i clienti chiedono guida di adozione, non solo funzioni: vale come criterio per le dimostrazioni e per l'onboarding del cliente.
- [D] La raccolta non contiene rapporti Gartner, Forrester o Fosway: le indicazioni sopra non sono state confrontate con analisti indipendenti.
- [D] Le consulenze sono anche canali di vendita: Deloitte dichiara riconoscimenti come partner SAP, Workday e ServiceNow (https://www.deloitte.com/ie/en/services/consulting/services/human-resource-transformation.html), cioè lavora sui grandi. Un'alleanza con una consulenza di fascia media o con le divisioni di organizzazione è plausibile; non risulta da fonti.

## Fonti (web, giugno 2026)
Forrester Skills Intelligence Solutions Landscape Q1 2026 (27 vendor); Workday Skills Cloud datasheet/blog; SAP SuccessFactors Talent Intelligence Hub + SAP Signavio; Eightfold (review/Gartner Peer Insights); Beamery (Knowledge Graphs blog, TalentGPT PR); Visier (Vee, 2026 Trends); Gloat (skills ontology framework); Lightcast Open Skills; Orgvue; Microsoft Viva Glint; Cornerstone Workforce AI / Skills Graph datasheet; 365Talents (skills interoperability, Forrester listing, 2026 roadmap); TechWolf Skill Intelligence Index; USPTO patent "unified graph representation of skills and acumen"; Workday/SAP/Oracle PEPM pricing. *(URL completi nel report integrale dell'analista competitivo, sessione 2026-06-17.)*