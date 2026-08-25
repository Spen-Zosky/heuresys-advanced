# Personio — profilo funzionale (estratto)

> Raccolto da agente dream-market (sonnet) il 2026-08-25; file estratto dal transcript del task dall'orchestratore perche' l'agente non dispone di tool di scrittura. Contenuto riportato integralmente, senza modifiche di merito.

Non ho un tool di scrittura file in questo sub-agente (solo Read/Grep/Glob/WebSearch/WebFetch) — restituisco il contenuto completo qui sotto perché l'agente chiamante lo salvi nel path indicato.

**Path previsto**: `D:\heuresys-advanced\docs\vision\DREAM_2026-08-25\_raccolta\competitor_personio.md`
**Voci prodotte nelle tabelle di capacità**: 95 (18 aree)

**Nota metodologica**: WebFetch diretto su `personio.com` ha risposto **429** e su `support.personio.de` **403** per l'intera sessione (probabile protezione anti-bot) — un solo fetch diretto è riuscito (`findstack.com`, terza parte). Il contenuto delle pagine vendor è stato acquisito tramite gli snippet di testo che WebSearch estrae dalle pagine indicizzate di quegli URL: è testo che proviene dal dominio vendor, quindi classificato **Documentato**, ma senza rendering diretto della pagina — flag esplicito dove rilevante.

---

# Profilo funzionale — Personio

**Data di consultazione**: 2026-08-25
**Ruolo dichiarato**: CONCORRENTE DIRETTO — criterio di confronto: portafoglio funzionale (non dimensione clienti)

## Identità e pubblico

- Piattaforma HR "all-in-one" nata in Germania, forte nell'area DACH, in espansione paneuropea. Documentato — `personio.com/medium-business/` (esistenza pagina dedicata al mid-market UK/Europa, 2026-08-25).
- Range dimensionale dichiarato dal vendor: le fonti terze non concordano su un numero unico (alcune citano "10-2.000 dipendenti", altre "10-5.000"); nessun accesso diretto alla pagina ufficiale che lo dichiari in modo univoco. Riportato — `skima.ai/blog/product-deep-dives/personio-reviews`, `research.contrary.com/company/personio` (2026-08-25).
- Composizione clienti attuale: 61% delle aziende clienti ha 11-200 dipendenti; crescita recente concentrata nel segmento mid-market 200-2.000 dipendenti, che pesa ~60% del contract value. Riportato — `skima.ai/evaluations/personio`, `research.contrary.com/company/personio` (2026-08-25).
- Utenti giornalieri tipici, dedotti dalla struttura funzionale delle singole app: HR manager/HRBP (configurazione, workflow, reportistica), People/Talent manager (performance, compensation, recruiting), employee/manager in self-service (assenze, time tracking, review). Documentato (dedotto da più product page) — `personio.com/product/*` (2026-08-25).
- Messaggio in prima pagina più recente (release Q4-2025): "Intelligence at Work, People at Heart" — enfasi su AI assistant, automazioni e career frameworks come leve dichiarate di differenziazione. Documentato — `personio.com/whats-new-q4-25/`, `community.personio.com/product-spotlight-133/what-s-new-in-q4-2025-intelligence-at-work-people-at-heart-5127` (2026-08-25).

## Area: Core HR e dati dipendente

| capacità | stato | fonte | note |
|---|---|---|---|
| Employee file centralizzato (anagrafica, contratti, documenti legali, storico) | Documentato | personio.com/product/core-hr-software/ — 2026-08-25 | — |
| Reminder automatici su scadenze/date importanti | Documentato | personio.com/product/core-hr-software/ — 2026-08-25 | — |
| Self-service: il dipendente aggiorna i propri dati personali | Documentato | personio.com/product/core-hr-software/ — 2026-08-25 | — |
| Organigramma automatico, aggiornato in tempo reale, card personalizzabili (fino a 4 attributi) | Documentato | support.personio.de/hc/en-us/articles/360017540757 — 2026-08-25 | — |
| Multi-entità legale: limitata nel piano base, illimitata nel piano superiore | Documentato | (packaging, vedi Area 16) — 2026-08-25 | pricing/packaging |
| Custom fields/oggetti personalizzati, permessi granulari | Riportato | g2.com/products/personio/features — 2026-08-25 | fonte terza (elenco feature aggregato) |
| Compliance tracking (scadenze, standard) | Documentato | personio.com/product/core-hr-software/ — 2026-08-25 | claim generico, non dettagliato per giurisdizione |

## Area: Assenze/presenze

| capacità | stato | fonte | note |
|---|---|---|---|
| Calcolo automatico ferie/assenze, saldo giorni residui in tempo reale | Documentato | personio.com/product/absence-management/ — 2026-08-25 | — |
| Richiesta assenza self-service + approvazione manager in un click, selezione sostituti | Documentato | personio.com/product/absence-management/ — 2026-08-25 | claim "-80% tempo di processo" non verificato da terzi |
| Calendario assenze condiviso team/HR | Documentato | personio.com/product/absence-management/ — 2026-08-25 | — |
| Reportistica su assenze/malattia | Documentato | personio.com/product/absence-management/ — 2026-08-25 | — |
| Time tracking: ore/pause, overtime | Documentato | personio.com/product/attendance-tracking/ — 2026-08-25 | — |
| Project time tracking nel timesheet, visibilità/config a permessi | Documentato | personio.com/product/attendance-tracking/ — 2026-08-25 | — |
| Approvazioni flessibili (con/senza, workflow di eccezione) | Documentato | personio.com/product/attendance-tracking/ — 2026-08-25 | — |
| Geotracking al clock-in/out (web/mobile) | Documentato | personio.com/product/attendance-tracking/ — 2026-08-25 | — |

## Area: Documenti e firme

| capacità | stato | fonte | note |
|---|---|---|---|
| Repository documentale centralizzato (contratti, lettere, documenti HR) | Documentato | support.personio.de/hc/en-us/articles/115002529589 — 2026-08-25 | — |
| Firma elettronica nativa per dipendenti con login Personio; via DocuSign/email link per candidati e dipendenti senza login | Documentato | support.personio.de/hc/en-us/articles/360012752457 — 2026-08-25 | — |
| Limite di firme elettroniche nel piano base; illimitate nel piano superiore | Documentato | (packaging, vedi Area 16) — 2026-08-25 | pricing/packaging |
| Un Workflow non può avviare direttamente un processo di firma elettronica (avvio manuale, per via di una quota) | Riportato | community.personio.com/integrations-workflows-75/subject-automating-digital-signature-requests-during-onboarding-5213 — 2026-08-25 | limite tecnico segnalato in community, non dichiarato nella doc prodotto |

## Area: Onboarding/offboarding

| capacità | stato | fonte | note |
|---|---|---|---|
| Workflow configurabili di onboarding/offboarding: step, scadenze, assegnazione responsabili | Documentato | support.personio.de/hc/en-us/articles/115002529589 — 2026-08-25 | — |
| Trigger automatici legati a eventi/date (data assunzione, data uscita, N giorni prima/dopo) | Documentato | support.personio.de/hc/en-us/articles/16606744442397 — 2026-08-25 | — |
| AI per il "matching" degli attributi dipendente e onboarding rapido ("minuti") | Documentato | personio.com/whats-new-q4-25/ — 2026-08-25 | **debole**: solo claim vendor, nessun riscontro in recensioni terze reperite |

## Area: Recruiting/ATS

| capacità | stato | fonte | note |
|---|---|---|---|
| Inbox candidature centralizzata con portfolio candidati | Documentato | personio.com/product/applicant-tracking-system/ — 2026-08-25 | — |
| Pipeline/fasi di processo personalizzabili (es. screening) | Documentato | personio.com/product/applicant-tracking-system/ — 2026-08-25 | — |
| Pubblicazione annunci su 600+ portali con un click | Documentato | personio.com/product/applicant-tracking-system/ — 2026-08-25 | — |
| Tag automatico della fonte del candidato (job board/agenzia/headhunter) | Documentato | personio.com/product/applicant-tracking-system/ — 2026-08-25 | — |
| Workflow di recruiting su trigger/azioni/condizioni (email/lettere automatiche) | Documentato | personio.com/product/applicant-tracking-system/ — 2026-08-25 | — |
| Career page personalizzabile, scheduling colloqui, scorecard, offerte con e-signature | Riportato | linktly.com/hr-software/personio-review, treegarden.io/blog/personio-pricing-2026 — 2026-08-25 | non confermato su pagina prodotto ufficiale consultata |
| Add-on Recruiting a 3 taglie per numero posizioni pubblicabili attive: Small (5) / Medium (25) / Large (illimitate) | Riportato | treegarden.io/blog/personio-pricing-2026, skima.ai — 2026-08-25 | packaging; coerente su più fonti terze indipendenti, nessun accesso al listino ufficiale |
| Lamentela: modulo recruiting aggiornato più lentamente del core HRIS; integrazione LinkedIn reindirizza alla careers page riducendo il volume di candidature; alcuni report di recruiting analytics inaccurati | Riportato | g2.com/products/personio/reviews?qs=pros-and-cons — 2026-08-25 | — |
| Recruiting è add-on separato dal piano Core/Core Pro | Riportato | skima.ai, treegarden.io — 2026-08-25 | packaging |

## Area: Performance & development (obiettivi, review, career framework, competenze)

| capacità | stato | fonte | note |
|---|---|---|---|
| Goal management centralizzato (creazione/modifica obiettivi per tutti i dipendenti) | Documentato | support.personio.de/hc/en-us/articles/4459458378909 — 2026-08-25 | — |
| Cicli di performance review automatizzati (Review Cycle Builder), reminder automatici a manager/dipendente | Documentato | personio.com/product/performance/ — 2026-08-25 | — |
| 360° feedback (richiesta/invio tra colleghi) | Documentato | personio.com/hr-lexicon/what-is-a-360-review/ — 2026-08-25 | pagina "lexicon" (editoriale), funzione confermata anche da GetApp (terza parte) |
| Feedback continuo | Documentato | personio.com/product/performance/ — 2026-08-25 | — |
| Career Frameworks: competenze per job level (fino a 10 livelli di competenza), visibili al dipendente nel proprio profilo per ruolo attuale/futuro | Documentato | support.personio.de/hc/en-us/articles/30454790101789, .../30458550524573 — 2026-08-25 | richiede prima una Job Architecture (mappatura job families) |
| Job Architecture come prerequisito ai Career Framework | Documentato | learn.personio.com/enhance-employee-motivation-and-career-growth-using-personios-job-architecture-en — 2026-08-25 | — |
| AI-powered summaries dei feedback per i manager (2025) | Documentato | personio.com/whats-new-q4-25/ — 2026-08-25 | **debole**: claim vendor, nessun riscontro terzo reperito |

## Area: Formazione/LMS

| capacità | stato | fonte | note |
|---|---|---|---|
| Gestione corsi/sessioni dentro la Performance & Development App | Riportato | sintesi di ricerca aggregata (non individuata pagina prodotto dedicata) — 2026-08-25 | affidabilità media, non confermato su pagina prodotto propria |
| LMS nativo completo (authoring contenuti, certificazioni, e-learning) | **Non trovata evidenza** | cercato in: personio.com/product/* (nessuna pagina "learning management system"), personio.com/hr-lexicon/* (solo articoli educativi generici) — 2026-08-25 | — |
| Integrazione con LMS terzi (Workademy, Learnster, elearnio, HowNow, 360Learning, LearnUpon, eloomi) via Marketplace | Documentato | marketplace.personio.com/category/learning-and-development/ — 2026-08-25 | — |

## Area: Compensation

| capacità | stato | fonte | note |
|---|---|---|---|
| App Compensation Management: setup/lancio/gestione cicli di salary review a scala aziendale | Documentato | personio.com/product/compensation-management/, support.personio.de/hc/en-us/articles/13929161963677 — 2026-08-25 | — |
| Proposta aumenti dai responsabili, approvazione secondo la gerarchia organizzativa | Documentato | support.personio.de/hc/en-us/articles/13929161963677 — 2026-08-25 | — |
| Confronto aumenti approvati vs budget disponibile | Documentato | support.personio.de/hc/en-us/articles/13929161963677 — 2026-08-25 | — |
| Salary bands e guideline integrate | Documentato | personio.com/product/compensation-management/ — 2026-08-25 | — |
| Benchmarking retributivo nativo dichiarato "basic"; per dati di mercato più ampi Personio integra Pave/Ravio (terzi) | Riportato | workflowautomation.net/reviews/personio, ravio.com/partners/personio — 2026-08-25 | profondità del benchmarking nativo non verificabile in dettaglio |
| Compensation è add-on separato dal piano Core/Core Pro | Riportato | skima.ai, treegarden.io — 2026-08-25 | packaging |

## Area: Workforce/headcount planning

| capacità | stato | fonte | note |
|---|---|---|---|
| Planning Cycles: pianificazione organico per ruolo e periodo | Documentato | support.personio.de/hc/en-us/articles/22630849301021 — 2026-08-25 | — |
| Plan owner crea/aggiorna/rimuove posizioni aperte per il proprio team | Documentato | support.personio.de/hc/en-us/articles/22605893471517 — 2026-08-25 | — |
| Reportistica automatizzata e scenario planning integrati con recruiting | Documentato | personio.com/product/workforceplanning/ — 2026-08-25 | claim di sintesi da snippet vendor; non verificato il dettaglio del "forecasting di budget" |
| Workforce Planning disponibile solo nel piano superiore (non nel piano base) | Documentato | (packaging, vedi Area 16) — 2026-08-25 | pricing/packaging |

## Area: Analytics e reporting

| capacità | stato | fonte | note |
|---|---|---|---|
| Dashboard predefinite per headcount, retention, absence, recruitment, compensation collegate ai dati anagrafici | Documentato | personio.com/product/people-analytics/ — 2026-08-25 | — |
| Report HR generabili "istantaneamente" (claim vendor) | Documentato | personio.com/product/people-analytics/ — 2026-08-25 | **debole**: claim di velocità non riscontrato da fonti terze specifiche |
| Lamentela: modulo di reporting rigido, combinazioni di campi limitate, query builder custom "substandard", export verso strumenti esterni difficoltoso | Riportato | g2.com/products/personio/reviews?qs=pros-and-cons — 2026-08-25 | — |

## Area: Workflow e automazioni

| capacità | stato | fonte | note |
|---|---|---|---|
| Motore workflow: trigger + condizioni/regole + azioni (assegna task, notifica, invia email, aggiungi partecipante) | Documentato | support.personio.de/hc/en-us/articles/16606744442397, .../16599105162909 — 2026-08-25 | — |
| Trigger su eventi (approvazioni, documenti, eventi dipendente) o su tempo/date | Documentato | support.personio.de/hc/en-us/articles/16606744442397 — 2026-08-25 | — |
| Regole di targeting per attributo (es. solo per un dipartimento) | Documentato | support.personio.de/hc/en-us/articles/16599105162909 — 2026-08-25 | — |
| Workflow di approvazione dedicati per assenze e per modifiche ai dati dipendente | Documentato | support.personio.de/hc/en-us/articles/20418710205341, .../21453114449053 — 2026-08-25 | — |
| Limite: un Workflow non innesca direttamente una firma elettronica (quota di firme, avvio manuale) | Riportato | community.personio.com/integrations-workflows-75/... — 2026-08-25 | — |
| Lamentela: richiesta di automazioni più granulari (es. reminder al singolo invece che a un intero gruppo) | Riportato | sintesi g2.com/products/personio/reviews — 2026-08-25 | — |

## Area: Integrazioni, marketplace e API pubblica

| capacità | stato | fonte | note |
|---|---|---|---|
| Marketplace con 200+ integrazioni catalogate per categoria (ATS, L&D, compensation, ecc.) | Documentato | marketplace.personio.com/ — 2026-08-25 | — |
| API REST pubblica documentata su Developer Hub: endpoint Employee/Attendance/Absence/Document/Recruiting; webhook | Documentato | developer.personio.de/, support.personio.de/hc/en-us/articles/7438224536093 — 2026-08-25 | fetch diretto bloccato (403); contenuto da indicizzazione WebSearch |
| Accesso API custom (client_id/client_secret) richiede il piano superiore (Core Pro) | Documentato | (packaging, vedi Area 16) — 2026-08-25 | pricing/packaging |
| SSO/OAuth con Okta, Microsoft Entra ID disponibile solo nel piano superiore | Documentato | (packaging, vedi Area 16) — 2026-08-25 | pricing/packaging |
| Marketplace TOS & API Policy pubblicata per sviluppatori terzi | Documentato | developer.personio.de/docs/tos-api-security-1 — 2026-08-25 | titolo/esistenza confermati da ricerca; testo integrale non letto (blocco 403) |

## Area: Assistenti AI

| capacità | stato | fonte | note |
|---|---|---|---|
| Personio Assistant: chatbot AI per tutti i dipendenti, risposte HR self-service 24/7 | Documentato | personio.com/product/assistant/, personio.com/blog/personio-assistant/ — 2026-08-25 | — |
| Riduzione carico amministrativo HR (claim vendor) | Documentato | personio.com/product/assistant/ — 2026-08-25 | **debole**: nessun dato quantitativo indipendente reperito |
| Connessione a fonti di conoscenza esterne (Confluence, Google Drive) per risposte contestualizzate | Documentato | personio.com/whats-new-q2-26/ — 2026-08-25 | annuncio release molto recente (Q2 2026); nessuna recensione utente ancora reperita → debole |
| AI-powered summaries dei feedback di performance per i manager | Documentato | personio.com/whats-new-q4-25/ — 2026-08-25 | vedi anche Area Performance; debole (solo claim vendor) |

## Area: People survey

| capacità | stato | fonte | note |
|---|---|---|---|
| Survey di engagement con domande "expert-built", punteggi su modello proprietario, 11 template pronti | Documentato | personio.com/product/surveys/ — 2026-08-25 | — |
| Pulse survey continue con dashboard/heatmap/report | Documentato | personio.com/product/surveys/ — 2026-08-25 | — |
| "People Matter Framework": misura Engagement Strength + intenzione di restare + willingness to refer | Documentato | personio.com/blog/survey-people-matter-framework/ — 2026-08-25 | framework proprietario recente (2025); **debole**, nessun riscontro terzo indipendente |
| Risposte confidenziali/non identificabili | Documentato | personio.com/product/surveys/ — 2026-08-25 | — |
| Surveys è add-on separato dal piano Core/Core Pro | Riportato | skima.ai, treegarden.io — 2026-08-25 | packaging |

## Area: Capacità talent-care (succession, skills matrix, mobilità, career path)

| capacità | stato | fonte | note |
|---|---|---|---|
| Succession planning nativo (funzione di prodotto dedicata) | **Non trovata evidenza** | cercato in: personio.com/product/* (nessuna pagina "product/succession"), support.personio.de (query "succession" + "product") — 2026-08-25 | trovati solo contenuti educativi (hr-lexicon) e integrazioni terze che aggiungono succession planning SOPRA Personio |
| Succession planning via integrazione terza (es. TalentMapper) | Documentato | marketplace.personio.com — 2026-08-25 | conferma solo l'esistenza dell'integrazione, non di una funzione nativa |
| Skills/competency matrix per job level, dentro i Career Framework (fino a 10 livelli di competenza) | Documentato | support.personio.de/hc/en-us/articles/30454790101789 — 2026-08-25 | — |
| Competence/responsibility matrix visibile sull'org chart o sulla lista dipendenti | **Non trovata evidenza** di integrazione nativa | cercato in: community.personio.com/employee-data-documents-86/employees-responsibility-competence-matrix-seen-on-the-org-chart-employee-list-3224 — 2026-08-25 | il thread stesso è una **richiesta** di funzionalità da parte di un utente, segno che oggi non è disponibile lì |
| Matching interno / talent marketplace per mobilità | **Non trovata evidenza** di funzione nativa | cercato in: personio.com/product/*, marketplace.personio.com — 2026-08-25 | disponibile solo tramite integrazione con piattaforma terza specializzata (Neobrain) |
| Percorsi di carriera (career path): il dipendente vede aspettative/competenze per ruolo attuale e ruoli futuri nel proprio profilo | Documentato | support.personio.de/hc/en-us/articles/30454790101789, .../30458550524573 — 2026-08-25 | — |

## Area: Packaging/pricing — piani e cosa include ciascuno

| capacità | stato | fonte | note |
|---|---|---|---|
| Struttura: piano base in due versioni (Core, Core Pro) + app add-on separate (Recruiting, Surveys, Performance & Development, Compensation Management, Whistleblowing, Employer of Record, Premium Support) | Documentato | support.personio.de/hc/en-us/articles/11149358090653 (fetch diretto bloccato 403; contenuto confermato da indicizzazione WebSearch e riscontrato coerentemente su più fonti terze indipendenti) — 2026-08-25 | vedi nota metodologica in testa al documento |
| Piano Core: employee profiles, absences, time tracking, documenti (con limiti), workflow, preliminary payroll, analytics, self-service, app mobile | Documentato | idem — 2026-08-25 | — |
| Piano Core Pro (superset): entità legali illimitate, position management, workforce planning, e-signature illimitate, accesso API, SSO/OAuth (Okta, Microsoft Entra ID), permessi più ampi | Documentato | idem — 2026-08-25 | è il piano dove si concentrano le funzionalità "di espansione" (multi-entità, API, planning) — segnale di valore |
| Prezzo non pubblico: a preventivo, per dipendente attivo/mese, contratto minimo 12 mesi, sconti a volume oltre 100/250/500 dipendenti | Riportato | findstack.com/products/personio/pricing (fetch diretto riuscito), treegarden.io/blog/personio-pricing-2026 — 2026-08-25 | — |
| Whistleblowing: canale di segnalazione anonima, separato dal sistema principale, comunicazione bidirezionale, GDPR | Documentato | personio.com/product/whistleblowing/, support.personio.de/hc/en-us/articles/12955259279517 — 2026-08-25 | add-on a pagamento separato |

## Area: Localizzazione e idoneità al mercato PMI italiano

| capacità | stato | fonte | note |
|---|---|---|---|
| Interfaccia disponibile anche in italiano | Documentato | esistenza sito localizzato personio.it — 2026-08-25 | — |
| Payroll nativo (esecuzione) disponibile solo per Germania (certificazione ITSG), UK, Irlanda, Austria, Spagna, Paesi Bassi | Riportato | outsail.co/post/personios-case-as-a-strong-global-hris-choice, hr.software/reviews/personio — 2026-08-25 | — |
| Per l'Italia: solo "preliminary/pre-payroll" (preparazione ed export dati verso un payroll provider/commercialista esterno), non esecuzione nativa | Documentato (per il concetto "preliminary payroll") | personio.com/product/payroll/ — 2026-08-25 | combinato con la nota Riportato sopra sull'assenza di esecuzione italiana |
| Lamentela: Personio più forte nell'area DACH; aziende non-DACH segnalano difficoltà con workflow di compliance locale e col supporto; impostazioni non specifiche per paesi diversi dalla Germania | Riportato | g2.com/products/personio/reviews?qs=pros-and-cons — 2026-08-25 | rilevante per il target PMI italiane del progetto |

## Area: Lamentele ricorrenti (sintesi)

| capacità/tema | stato | fonte | note |
|---|---|---|---|
| Funzionalità mancanti / personalizzazione limitata (48/44/42 menzioni per categorie affini) | Riportato | g2.com/products/personio/reviews?qs=pros-and-cons — 2026-08-25 | — |
| Reporting rigido, query builder debole, export difficile verso strumenti esterni | Riportato | g2.com/products/personio/reviews?qs=pros-and-cons — 2026-08-25 | duplicato in Area Analytics per completezza di area |
| Modulo recruiting più lento negli aggiornamenti; integrazione LinkedIn riduce il volume di candidature; recruiting analytics con inaccuratezze segnalate | Riportato | g2.com/products/personio/reviews?qs=pros-and-cons — 2026-08-25 | — |
| Pre-calcolo payroll errato su cambi stipendio a metà mese o bonus in valuta diversa | Riportato | g2.com/products/personio/reviews?qs=pros-and-cons — 2026-08-25 | — |
| Prezzo non pubblico, richiede contatto commerciale, difficile confronto anticipato dei costi | Riportato | g2.com/products/personio/reviews?qs=pros-and-cons — 2026-08-25 | — |
| Un cliente segnala rinegoziazione contrattuale al rinnovo con vincolo a più seat del necessario | Riportato | g2.com/products/personio/reviews?qs=pros-and-cons — 2026-08-25 | singolo reviewer verificato, non generalizzabile |
| Localizzazione non specifica per alcuni paesi (es. ferie Paesi Bassi); necessità di acquistare entità legali aggiuntive per uso realmente internazionale | Riportato | capterra.com/p/158622/Personio/reviews/ — 2026-08-25 | — |
| Time tracking poco intuitivo; interfaccia che cambia spesso per aggiornamenti frequenti | Riportato | capterra.com/p/158622/Personio/reviews/ — 2026-08-25 | — |
| Supporto clienti disomogeneo: buono con Premium Support (add-on a pagamento), altrimenti a volte solo rimando alla knowledge base | Riportato | capterra.com/p/158622/Personio/reviews/ — 2026-08-25 | — |

---

## Dove ho cercato

| id | URL | data consultazione | cosa ho preso da lì |
|---|---|---|---|
| S1 | https://www.personio.com/product/core-hr-software/ | 2026-08-25 | core HR: employee file, reminder, self-service, compliance |
| S2 | https://www.personio.com/pricing/ | 2026-08-25 | tentativo diretto fallito (429); non usato come fonte primaria |
| S3 | https://www.personio.com/product/absence-management/ | 2026-08-25 | assenze: calcolo ferie, richieste, calendario, reportistica |
| S4 | https://www.personio.com/product/attendance-tracking/ | 2026-08-25 | time tracking: ore, project tracking, approvazioni, geotracking |
| S5 | https://support.personio.de/hc/en-us/articles/115002529589 | 2026-08-25 | workflow onboarding/offboarding |
| S6 | https://support.personio.de/hc/en-us/articles/360012752457 | 2026-08-25 | firma elettronica |
| S7 | https://community.personio.com/integrations-workflows-75/subject-automating-digital-signature-requests-during-onboarding-5213 | 2026-08-25 | limite: workflow non avvia firma automaticamente |
| S8 | https://www.personio.com/product/applicant-tracking-system/ | 2026-08-25 | ATS: inbox, pipeline, pubblicazione annunci, tag fonte |
| S9 | https://www.personio.com/hr-lexicon/applicant-tracking-integrations/ | 2026-08-25 | contesto ATS integrations (editoriale) |
| S10 | https://www.personio.com/product/performance/ | 2026-08-25 | performance: goal, review cycle, feedback continuo |
| S11 | https://support.personio.de/hc/en-us/articles/4459458378909 | 2026-08-25 | Overview app Performance & Development |
| S12 | https://www.personio.com/hr-lexicon/what-is-a-360-review/ | 2026-08-25 | 360° feedback |
| S13 | https://support.personio.de/hc/en-us/articles/30454790101789 | 2026-08-25 | Career Frameworks — setup, livelli di competenza |
| S14 | https://support.personio.de/hc/en-us/articles/30458550524573 | 2026-08-25 | gestione Career Frameworks |
| S15 | https://learn.personio.com/enhance-employee-motivation-and-career-growth-using-personios-job-architecture-en | 2026-08-25 | Job Architecture come prerequisito |
| S16 | https://www.personio.com/product/compensation-management/ | 2026-08-25 | compensation: salary review, salary bands |
| S17 | https://support.personio.de/hc/en-us/articles/13929161963677 | 2026-08-25 | Overview Compensation Management |
| S18 | https://workflowautomation.net/reviews/personio | 2026-08-25 | benchmarking retributivo "basic" |
| S19 | https://ravio.com/partners/personio | 2026-08-25 | integrazione benchmarking terza |
| S20 | https://www.personio.com/product/workforceplanning/ | 2026-08-25 | workforce planning overview |
| S21 | https://support.personio.de/hc/en-us/articles/22630849301021 | 2026-08-25 | Overview Workforce Planning |
| S22 | https://support.personio.de/hc/en-us/articles/22605893471517 | 2026-08-25 | Planning Cycles — proporre/rivedere headcount plan |
| S23 | https://www.personio.com/product/people-analytics/ | 2026-08-25 | people analytics: dashboard predefinite |
| S24 | https://support.personio.de/hc/en-us/articles/16606744442397 | 2026-08-25 | Overview Workflows: trigger/azioni |
| S25 | https://support.personio.de/hc/en-us/articles/16599105162909 | 2026-08-25 | componenti workflow: rules |
| S26 | https://support.personio.de/hc/en-us/articles/20418710205341 | 2026-08-25 | workflow approvazione attendance |
| S27 | https://support.personio.de/hc/en-us/articles/21453114449053 | 2026-08-25 | workflow approvazione modifica dati dipendente |
| S28 | https://www.marketplace.personio.com/ | 2026-08-25 | marketplace 200+ integrazioni |
| S29 | https://developer.personio.de/ | 2026-08-25 | Developer Hub API pubblica (fetch diretto bloccato 403) |
| S30 | https://support.personio.de/hc/en-us/articles/7438224536093 | 2026-08-25 | build integrazione custom con API |
| S31 | https://developer.personio.de/docs/tos-api-security-1 | 2026-08-25 | Marketplace TOS & API Policy (titolo/esistenza) |
| S32 | https://www.personio.com/product/assistant/ | 2026-08-25 | Personio Assistant (AI) |
| S33 | https://www.personio.com/blog/personio-assistant/ | 2026-08-25 | annuncio AI Assistant |
| S34 | https://www.personio.com/whats-new-q4-25/ | 2026-08-25 | release Q4-2025: AI onboarding, AI summaries performance |
| S35 | https://www.personio.com/whats-new-q2-26/ | 2026-08-25 | release Q2-2026: fonti conoscenza esterne per AI assistant |
| S36 | https://community.personio.com/product-spotlight-133/what-s-new-in-q4-2025-intelligence-at-work-people-at-heart-5127 | 2026-08-25 | conferma tema release Q4-2025 |
| S37 | https://www.personio.com/product/surveys/ | 2026-08-25 | survey: template, pulse, confidenzialità |
| S38 | https://www.personio.com/blog/survey-people-matter-framework/ | 2026-08-25 | People Matter Framework |
| S39 | https://www.personio.com/hr-lexicon/succession-planning/ | 2026-08-25 | contenuto educativo su succession, non funzione prodotto |
| S40 | https://www.marketplace.personio.com/category/workforce-planning/ (e ricerca Neobrain/TalentMapper) | 2026-08-25 | succession/mobilità solo via integrazioni terze |
| S41 | https://community.personio.com/employee-data-documents-86/employees-responsibility-competence-matrix-seen-on-the-org-chart-employee-list-3224 | 2026-08-25 | richiesta utente non soddisfatta: competence matrix su org chart |
| S42 | https://support.personio.de/hc/en-us/articles/11149358090653 (Overview of Personio plans and apps) | 2026-08-25 | packaging Core/Core Pro/add-on (fetch diretto bloccato 403, confermato via WebSearch + fonti terze) |
| S43 | https://findstack.com/products/personio/pricing | 2026-08-25 | prezzi indicativi (fetch diretto riuscito) |
| S44 | https://treegarden.io/blog/personio-pricing-2026/ | 2026-08-25 | packaging e pricing dettagliato (terza parte) |
| S45 | https://www.tinyteam.io/blog/personio-pricing | 2026-08-25 | conferma packaging Core/Core Pro |
| S46 | https://skima.ai/blog/product-deep-dives/personio-reviews | 2026-08-25 | packaging, target company size |
| S47 | https://skima.ai/evaluations/personio | 2026-08-25 | composizione clienti per fascia dipendenti |
| S48 | https://www.g2.com/products/personio/reviews?qs=pros-and-cons | 2026-08-25 | lamentele ricorrenti (reporting, recruiting, payroll, pricing, contratto) |
| S49 | https://www.g2.com/products/personio/features | 2026-08-25 | elenco feature aggregato (custom fields) |
| S50 | https://capterra.com/p/158622/Personio/reviews/ | 2026-08-25 | lamentele: localizzazione, time tracking, supporto |
| S51 | https://www.personio.com/product/whistleblowing/ | 2026-08-25 | modulo whistleblowing |
| S52 | https://support.personio.de/hc/en-us/articles/12955259279517 | 2026-08-25 | Overview Whistleblowing |
| S53 | https://www.personio.com/product/payroll/ | 2026-08-25 | concetto di preliminary/pre-payroll |
| S54 | https://outsail.co/post/personios-case-as-a-strong-global-hris-choice | 2026-08-25 | copertura payroll nativo per paese |
| S55 | https://www.hr.software/reviews/personio | 2026-08-25 | conferma copertura payroll/EOR |
| S56 | https://support.personio.de/hc/en-us/articles/360017540757 | 2026-08-25 | Overview Org chart |
| S57 | https://www.personio.com/medium-business/ | 2026-08-25 | target mid-market (esistenza pagina) |
