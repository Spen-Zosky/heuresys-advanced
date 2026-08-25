# Matrice di copertura funzionale — ciclo DREAM 2026-08-25

**Stato**: BOZZA (Onda 2, S1081). Costruita sui sei raccolti di Onda 1 (`_raccolta/`). Il pass-2 del censimento documentazione (lotti A/B/C, ~856 file) è in corso: al suo rientro questa matrice viene ri-verificata e le righe eventualmente emerse vengono integrate — l'integrazione sarà annotata in coda (§Integrazione pass-2).

## Come si legge

**Colonne e ruoli** (dal contratto di Fase 0 — il ruolo cambia il significato della cella):
- **heuresys-advanced** — il progetto. Stati: `Completo` / `Parziale` / `Latente` (costruito, l'utente non ci arriva) / `Assente`. Ogni stato porta la prova.
- **Personio** — CONCORRENTE DIRETTO. Una sua capacità assente da noi è una **lacuna** (può diventare MUST se il peso lo giustifica).
- **Eightfold AI** — METRO DI RIFERIMENTO. Indica lo stato dell'arte: può generare SHOULD/COULD, **mai un MUST**.
- **Zucchetti** — PIATTAFORMA COESISTENTE. Una sua capacità **non è una lacuna**: è una **superficie di integrazione**; replicarla va motivato esplicitamente.

**Stati competitor**: `Doc` = Documentato (pagina vendor, URL+data nel raccolto) · `Rip` = Riportato (fonte terza, meno affidabile) · `NTE` = cercato e **non trovata evidenza** (mai "non ce l'ha") · `n.c.` = non censito nella raccolta (nessuna ricerca mirata fatta — è una lacuna della raccolta, non un'assenza del prodotto).

**Prove del progetto** (abbreviazioni → file in `_raccolta/`): `inv.X` = `inventario_raw.md` area X · `lat.(x)` = `latenti_raw.md` categoria x · `arch §n` = `architettura_raw.md` sezione n. I file:riga puntuali stanno lì; il consolidamento in fatti `F` numerati avviene in `06_EVIDENZE.md` (Onda 3).

**Due pesi per riga** (A=alto, M=medio, B=basso), giudicati sui due traguardi:
- **T1** — entro 6 mesi vendibile a PMI italiane strutturate come **complemento talent al gestionale HR esistente**. Corollario che governa molte righe: payroll, timbrature, turni, note spese **restano al gestionale** (tipicamente Zucchetti): lì la domanda non è "costruirlo" ma "leggerne i dati".
- **T2** — piattaforma **dimostrabile dal vivo** a prospect/investitori entro pochi mesi. Pesa ciò che si vede in demo: dati vivi, AI, visualizzazioni, storie complete.

---

## 1. Accesso, identità e piattaforma

| Capacità | heuresys | Personio | Eightfold | Zucchetti | T1 | T2 |
|---|---|---|---|---|---|---|
| Login email+password con MFA (TOTP, passkey/WebAuthn) | **Completo** — inv.A | n.c. | n.c. | n.c. | A — igiene minima di vendita | M |
| MFA via email-OTP / SMS-OTP funzionanti in produzione | **Parziale** — chassis completo ma email bloccata su credenziale SMTP mai fornita (blocked-on-Enzo) e SMS senza provider reale (ramo mai scritto) — lat.(d),(f) | n.c. | n.c. | n.c. | M — TOTP/passkey già coprono | B |
| SSO aziendale (SAML/OIDC con IdP del cliente) | **Assente** — tabella sessioni SSO è placeholder dichiarato inerte — arch §8 | Doc — solo piano Core Pro (Okta, MS Entra ID) | Rip — enterprise, gestito a contratto | n.c. (usa Keycloak per i SUOI portali) | **A** — requisito d'ingresso frequente per PMI strutturate con IT (arch §8 lo dichiara) | B |
| Policy MFA per tenant (quali ruoli obbligati) | **Completo** — inv.A | n.c. | n.c. | n.c. | M | B |
| Matrice ruoli×permessi consultabile | **Completo** (sola lettura) — inv.A | Rip — permessi granulari (G2) | n.c. | n.c. | M | M — racconta la profondità RBAC in demo |
| Creare/modificare ruoli e mappe permessi (role CRUD) | **Assente in UI e in API** — commento nel codice "lands in MVP-3", mai arrivato — lat.(f) | Rip — custom fields/permessi (G2) | n.c. | n.c. | A — un tenant reale chiederà un ruolo su misura; oggi si fa solo via migrazione | B |
| Gestione sessioni attive / revoca | **Completo** — inv.A | n.c. | n.c. | n.c. | B | B |
| Interfaccia in italiano (+ inglese) | **Completo** strutturalmente — 2 lingue, 10 file chiave ciascuna; copertura reale non verificata in questo ciclo (`pnpm i18n:check` non eseguito) — arch §6 | Doc — sito/prodotto localizzato (personio.it) | n.c. (prodotto enterprise EN) | Doc — prodotto italiano | **A** — parlare italiano è il minimo nel segmento | A |
| App mobile nativa | **Assente** (app nativa); resa responsive del web non misurata in questo ciclo — lacuna dichiarata | Doc — app mobile inclusa nel Core | n.c. | Doc — ZTravel mobile | M — l'ESS si consuma anche da telefono; da misurare prima il responsive | M |

## 2. Core HR — anagrafica e dossier

| Capacità | heuresys | Personio | Eightfold | Zucchetti | T1 | T2 |
|---|---|---|---|---|---|---|
| Fascicolo dipendente centralizzato (anagrafica, contratti, storico) | **Completo** — inv.D, inv.S (dossier admin + profilo/contratti/esperienze ESS) | Doc — core-hr-software | n.c. (si appoggia all'HRIS del cliente) | Doc — Dossier RU | A — base del complemento: senza fascicolo il talent layer non ha soggetto | A |
| Self-service: il dipendente aggiorna i propri dati | **Completo** — inv.S | Doc | n.c. | Doc — HR Portal | A | M |
| Organigramma automatico e interattivo (admin + vista ESS) | **Completo** — inv.E | Doc — org chart real-time | n.c. | Doc — Organigramma | A | A — sempre mostrato in demo |
| Reminder automatici su scadenze (contratti, date chiave) | **Assente** — nessuna capacità censita nell'inventario (le notifiche esistono come infrastruttura generica, emitNotification — arch §Moltiplicatori) | Doc — core-hr | n.c. | n.c. | M — attrito operativo, non blocco | B |
| Campi custom sull'anagrafica | **Assente** — schema governato da migrazioni, nessuna capacità censita | Rip — custom fields (G2) | n.c. | n.c. | M | B |
| Multi-entità legale nello stesso tenant | **Assente** come concetto interno (il multi-azienda è il multi-tenant di piattaforma — arch §2) | Doc — limitata in Core, illimitata in Core Pro | n.c. | n.c. | B — la PMI target è mono-entità; il multi-tenant copre il resto | B |
| Documenti personali del dipendente (consultazione) | **Completo** — inv.J (me/documents) | Doc — repository documentale | n.c. | Doc — cedolini/documenti al portale | A | M |

## 3. Organizzazione, posizioni e job architecture

| Capacità | heuresys | Personio | Eightfold | Zucchetti | T1 | T2 |
|---|---|---|---|---|---|---|
| Unità organizzative CRUD con gerarchia e responsabili | **Completo** (delete solo API, senza UI — inv. latenti puntuali) — inv.E | Doc (implicito nell'org chart) | n.c. | Doc | A | M |
| Modello position-centric: posizione con owner ≠ incumbent, criticità | **Completo** — inv.F; fondamento strutturale (arch §1, I1) | Doc — position management solo Core Pro | n.c. (job-centric è il system of record del cliente) | n.c. | A — è l'architrave del prodotto | A — differenziante da raccontare |
| Position Intelligence Profile (profilo integrato skill+KPI+learning+succession della posizione) | **Latente** — la VIEW esiste (I9) e l'endpoint GET c'è, ma **nessuna pagina lo chiama** — inv. latenti puntuali | NTE | n.c. | NTE | A — è il prodotto-firma, e non si vede | **A** — il pezzo da demo per eccellenza, già costruito |
| Job architecture: famiglie e ruoli professionali CRUD | **Completo** — inv.F | Doc — Job Architecture (prerequisito dei Career Frameworks) | n.c. | n.c. | A | M |
| Requisiti di posizione: skill / KPI / learning (consultazione) | **Completo** — inv.F | Doc — competenze per job level (Career Frameworks) | n.c. | n.c. | A | A |
| Requisiti di posizione: modifica (aggiungi/rimuovi skill e KPI) | **Latente** — POST/PATCH/DELETE esistono, nessuna UI li chiama — inv. latenti puntuali | Doc (idem sopra) | n.c. | n.c. | A — senza scrittura il PIP non si amministra dal prodotto | M |
| Storico dei requisiti di una posizione | **Latente** — GET history senza chiamante — inv. latenti puntuali | n.c. | n.c. | n.c. | B | M |

## 4. Competenze, ontologia e matching

| Capacità | heuresys | Personio | Eightfold | Zucchetti | T1 | T2 |
|---|---|---|---|---|---|---|
| Catalogo competenze con tassonomia, alias, gerarchia (CRUD) | **Completo** — inv.G; ~14k skill (lat.(f)) | Doc — skills matrix nei Career Frameworks (10 livelli) | Doc — ontologia proprietaria (1,6M skill dichiarate) | n.c. | A | A |
| Aggancio a tassonomie ufficiali EU/IT (ESCO, ISCO, ISTAT/ATECO) con sync vivo | **Completo** — connettori reference_sync + CLI — arch §9 | NTE | NTE (ontologia proprietaria, non standard pubblici) | n.c. | **A** — vantaggio non copiabile in fretta: standard EU parlano alle PMI regolate | A |
| Ricerca semantica free-text su skill/occupazioni (AI) | **Parziale** — UI costruita e collegata, ma flag `MATCHING_FREETEXT_ENABLED` default OFF: se OFF in prod l'utente riceve 404 — lat.(d) | NTE | Doc — matching "beyond keywords" | n.c. | M | **A** — demo AI immediata, già pagata |
| Matching persona↔occupazioni/posizioni/ruoli (ESS) | **Completo** — inv.S | NTE nativo (mobilità via partner Neobrain) | Doc — cuore del prodotto | n.c. | A — è il "talent" del complemento | A |
| Inferenza skill da segnali di lavoro reale (progetti, email, app — stile Digital Twin) | **Assente** | NTE | Doc — Digital Twin, skill-refresh continuo | n.c. | B — stato dell'arte, nessun cliente PMI lo chiede oggi (metro: mai MUST) | M |
| Gap di competenza: individuale (ESS), aziendale, predittivo | **Completo** — inv.G (gaps, insights/skill-gap con ricalcolo) | NTE | Doc (implicito nel matching) | n.c. | A | A |
| Heatmap copertura skill per unità / categoria / gruppo | **Completo** — inv.G | NTE | Rip — dashboard distribuzione skill | n.c. | M | A |
| Sentinella "posizioni con gap critici" esposta al prodotto | **Latente** — vista `v_positions_with_critical_skill_gap` (161 righe vive) mai letta dall'API — lat.(b) | n.c. | n.c. | n.c. | M — già calcolata, costa un endpoint | A — numero forte in demo |
| Autovalutazione skill del dipendente | **Completo** — inv.G | n.c. | Doc (profilo aggiornato dall'attività) | n.c. | M | M |

## 5. Performance, obiettivi, OKR

| Capacità | heuresys | Personio | Eightfold | Zucchetti | T1 | T2 |
|---|---|---|---|---|---|---|
| Cicli di review, calibrazioni, valutazioni (consultazione) | **Completo** — inv.I | Doc — Review Cycle Builder automatizzato | n.c. | Doc — valutazione posizioni/performance/potenziale | A | M |
| Authoring/gestione dei cicli e delle valutazioni da UI | **Latente/Assente** — l'inventario censisce solo consultazione; i moduli `assessments`, `assessment-methods`, `assessment-results` sono latenti (API senza UI) — inv. latenti | Doc — creazione cicli, reminder automatici | n.c. | Doc | **A** — un HR non può *condurre* una campagna di review dal prodotto, solo guardarla | M |
| 360° feedback | **Assente** — non censito | Doc | n.c. | n.c. | M | B |
| Feedback continuo | **Assente** — non censito | Doc | n.c. | n.c. | M | B |
| Goal aziendali + timeline, OKR (consultazione) | **Completo** — inv.I | Doc — goal management | n.c. | n.c. | M | M |
| KPI: definizioni CRUD + assegnazioni + vista ESS | **Completo** — inv.I | n.c. | n.c. | n.c. | M | A — raro trovarlo così strutturato |
| Sintesi AI dei feedback per i manager | **Assente** | Doc (claim vendor recente, debole) | n.c. | n.c. | B | M |

## 6. Talent review, successione, carriera

| Capacità | heuresys | Personio | Eightfold | Zucchetti | T1 | T2 |
|---|---|---|---|---|---|---|
| Nine-box (potenziale×performance), fit posizione/persona, readiness | **Completo** — inv.H | **NTE nativo** — trovate solo integrazioni terze (TalentMapper) e contenuti educativi | Doc — raccomandazione automatica successori | Doc — gestione carriere e successioni (profondità non verificata) | **A** — qui il concorrente diretto è SCOPERTO e noi siamo completi | **A** |
| Pool di successione, candidati, posizioni critiche e copertura | **Completo** (lettura) — inv.H; gestione fine (readiness override, relevance, path-steps) **Latente** — moduli API senza UI — inv. latenti | NTE nativo | Doc — "succession for every role" | Doc (generico) | A | A |
| Percorsi di carriera + obiettivo di carriera scelto dal dipendente (ESS) | **Completo** — inv.H (career, target position) | Doc — career path nel profilo (Career Frameworks) | Doc — Career Planner predittivo | n.c. | A | A |
| Flight-risk / rischio di uscita predittivo (aziendale + ESS career risk) | **Completo** con ricalcolo — inv.H | NTE | Doc (retention al centro del pitch) | n.c. | M | **A** — il numero che accende la platea |
| Talent marketplace interno (progetti/gig con matching) | **Assente** | NTE nativo (via Neobrain) | Doc — project marketplace | n.c. | B — pratica da grande impresa (metro: mai MUST) | M |
| Mentorship (programmi, coppie, sessioni, match-score) | **Latente** — 17 route CRUD complete, 63 mentorship e 150 sessioni REALI in tabella, **zero UI** — lat.(a) | n.c. | Rip — mentoring citato (Gartner Hype Cycle) | n.c. | M — già pagata: costa una pagina | A — storia demo pronta coi dati veri |

## 7. Learning e sviluppo

| Capacità | heuresys | Personio | Eightfold | Zucchetti | T1 | T2 |
|---|---|---|---|---|---|---|
| Catalogo moduli e percorsi formativi (CRUD, tappe) | **Completo** — inv.J | **NTE nativo** — nessuna pagina LMS; solo integrazioni marketplace | Rip — learning nel marketplace interno | Doc — e-learning + gamification | A — secondo scoperto del diretto | M |
| Iscrizione self-service dal catalogo + assegnazioni | **Completo** — inv.J | NTE (idem) | Doc | Doc | A | M |
| Certificazioni personali (consultazione + upload) | **Completo** — inv.J | n.c. | Doc (certificazioni aggiornano il profilo) | n.c. | M | B |
| Authoring contenuti e-learning (SCORM, quiz, erogazione) | **Assente** — il CMS è documentale, non authoring e-learning — inv.J | NTE nativo (delega a LMS terzi) | n.c. | Doc | B — si integra un LMS, non si costruisce | B |
| Collegamento gap→percorso formativo (gap closure) | **Completo** — shippato, verificato nella ri-verifica dei claim vecchi — lat. premessa | NTE | Doc (implicito) | n.c. | A — chiude il cerchio del talent | A |
| Iniziative formative aziendali (campagne) | **Completo** (lettura) — inv.J | n.c. | n.c. | Doc — budget e corsi | M | B |

## 8. Compensation

| Capacità | heuresys | Personio | Eightfold | Zucchetti | T1 | T2 |
|---|---|---|---|---|---|---|
| Fasce retributive, distribuzione, peso economico posizione | **Completo** — inv.K | Doc — salary bands | n.c. | Doc — politiche retributive | A | M |
| Retribuzione variabile: gate, calcoli, valutazione, bonus pool, regole goal↔pay | **Completo** — inv.K | n.c. | n.c. | Doc (piani di incentivazione, generico) | A — profondità rara nel segmento | A |
| Ciclo di salary review guidato (proposte manager → budget → approvazione) | **Parziale** — esistono raccomandazioni e approvals generici, ma nessun flusso di campagna censito — inv.K, inv.M | Doc — ciclo completo con confronto budget | n.c. | Doc — salary review | M | B |
| Benchmarking retributivo di mercato | **Assente** | Rip — nativo "basic", esteso via partner (Pave/Ravio) | n.c. | n.c. | B | B |
| Cedolini consultabili dal dipendente | **Completo** — inv.K (pay-slips-tab) | n.c. (preliminary payroll) | n.c. | Doc — il payroll è SUO | A — ma il dato a regime arriva dal gestionale: superficie di integrazione, non motore paghe | M |
| Motore paghe / payroll run italiano | **Assente per posizionamento** — coesistenza: il payroll resta al gestionale (T1) | Doc — payroll nativo NON per l'Italia (solo pre-payroll) | n.c. | Doc — core storico | B — NON è lacuna: è LA superficie di coesistenza con Zucchetti | B |

## 9. Tempo, assenze, presenze

| Capacità | heuresys | Personio | Eightfold | Zucchetti | T1 | T2 |
|---|---|---|---|---|---|---|
| Richiesta ferie/permessi ESS + approvazione | **Completo** — inv.L, inv.M | Doc — un click, sostituti | n.c. | Doc — workflow presenze | A | M |
| Saldi, maturazione (accrual), movimenti | **Completo** (consultazione admin+ESS) — inv.L | Doc — calcolo automatico saldi | n.c. | Doc | A | B |
| Timbrature: consultazione | **Completo** — inv.L | Doc | n.c. | Doc | M | B |
| Timbrare (clock-in/out), time tracking attivo, geolocalizzazione | **Assente** — nessuna capacità di scrittura presenze censita | Doc — ore/pause/overtime/geo | n.c. | Doc — regno suo (5 tracciati) | B — resta al gestionale per posizionamento; il valore è LEGGERNE i dati | B |
| Turni / scheduling | **Assente** | n.c. | n.c. | Doc — ZScheduling | B — coesistenza | B |
| Calendario assenze condiviso di team | **Assente** — non censito | Doc | n.c. | n.c. | M | B |

## 10. Workflow, approvazioni, automazioni

| Capacità | heuresys | Personio | Eightfold | Zucchetti | T1 | T2 |
|---|---|---|---|---|---|---|
| Motore approvazioni multi-step con decide/apply + inbox unificata | **Completo** — inv.M | Doc — workflow di approvazione dedicati | n.c. | Doc — workflow | A | M |
| Workflow builder self-service (trigger + condizioni + azioni configurabili da UI) | **Assente** — i flussi sono a catalogo, non componibili dall'utente | Doc — motore generico con trigger su eventi/date e targeting | n.c. | n.c. | M — attrito per HR evoluti, non blocco a 6 mesi | B |
| Notifiche in-app con preferenze e dedupe | **Completo** — infrastruttura generica emitNotification — arch §Moltiplicatori | Doc (implicito) | n.c. | n.c. | M | B |
| Broadcast admin di comunicazioni + audit invii | **Latente** — endpoint pronti, nessuna UI — lat.(a) | n.c. | n.c. | n.c. | M | B |
| Digest email periodico delle notifiche | **Parziale** — chassis+timer pronti, mai inviato: credenziale SMTP mai fornita (blocked-on-Enzo, percorso originale ormai impossibile: Basic Auth ritirata) — lat.(d) | n.c. | n.c. | n.c. | M | B |

## 11. Engagement, survey, whistleblowing

| Capacità | heuresys | Personio | Eightfold | Zucchetti | T1 | T2 |
|---|---|---|---|---|---|---|
| Survey di engagement + pulse + risultati (consultazione) | **Completo** — inv.N | Doc — add-on a pagamento, 11 template | n.c. | n.c. | A | M |
| Creazione/authoring dei sondaggi da UI | **Latente** — modulo `surveys` (admin) senza consumer web — inv. latenti | Doc — template "expert-built" | n.c. | n.c. | A — senza authoring il ciclo survey non parte dal prodotto | M |
| Compilazione self-service | **Completo** — inv.N | Doc | n.c. | n.c. | A | M |
| Whistleblowing: canale anonimo pubblico + tracking + console custode isolata | **Completo, incluso** — inv.B, inv.R; isolamento assoluto I20 | Doc — **add-on a pagamento separato** | n.c. | n.c. | **A** — obbligo di legge in Italia (>49 dipendenti): incluso vs add-on è un argomento di vendita secco | M |

## 12. Analytics, predizioni, reporting

| Capacità | heuresys | Personio | Eightfold | Zucchetti | T1 | T2 |
|---|---|---|---|---|---|---|
| Dashboard per ruolo + catalogo famiglie di dashboard | **Completo** — inv.C | Doc — dashboard predefinite | Rip — dashboard summary-level (con lamentele) | Doc — dashboard budget | A | A |
| Analytics: workforce, presenze, straordinari, comp, skill, KPI, rete organizzativa | **Completo** — inv.G, inv.L, inv.P | Doc (aree principali) | Rip | Doc (costi) | A | A |
| Modelli predittivi come read-model consultabile (registro modelli + 468 predizioni) | **Latente** — 4 route GET, zero UI — lat.(a) | NTE | Doc — è il pitch, ma opaco | n.c. | M | A — "guarda: registro modelli e predizioni ispezionabili" è un racconto di trasparenza AI che Eightfold non fa |
| Report builder custom + export dati verso strumenti esterni | **Assente** — esiste solo export dei grafici — inv.P | Doc ma **lamentela ricorrente**: rigido, query builder debole, export difficile (G2) | Rip — lamentele identiche | n.c. | M — il diretto qui è debole: parità non necessaria, sorpasso possibile ma non a 6 mesi | B |
| Statistiche di piattaforma live su pagina investitori | **Completo** — inv.B (unico endpoint pubblico) | n.c. | n.c. | n.c. | B | A |

## 13. Recruiting e onboarding

| Capacità | heuresys | Personio | Eightfold | Zucchetti | T1 | T2 |
|---|---|---|---|---|---|---|
| ATS: pipeline candidati, job posting multi-portale | **Assente** | Doc — 600+ portali, add-on | Doc — TA con agenti AI | Doc — Inrecruiting (integrabile via API) | M — la PMI target ha spesso già un ATS (spesso Zucchetti): prima integrazione, poi costruzione | B |
| Onboarding/offboarding con workflow, trigger su date | **Assente** | Doc | n.c. | n.c. | M — SHOULD naturale: tocca il talent lifecycle che presidiamo | B |
| Colloqui AI / interview companion | **Assente** | n.c. | Doc — AI Interviewer | n.c. | B (metro: mai MUST) | M |

## 14. Documenti, contenuti, firma

| Capacità | heuresys | Personio | Eightfold | Zucchetti | T1 | T2 |
|---|---|---|---|---|---|---|
| CMS documentale versionato con review/publish + handbook ESS | **Completo** — inv.J | Doc — repository (versioning NTE) | n.c. | n.c. | A | M |
| Firma elettronica su documenti HR | **Assente** | Doc — nativa + DocuSign (limiti per piano) | n.c. | n.c. | M | B |
| Allegati su storage S3/MinIO (alternativa al disco locale) | **Parziale** — solo LocalDiskStore implementato, interfaccia pronta — lat.(f) | n.c. | n.c. | n.c. | M — vincolo operativo di deploy, non funzionalità visibile | B |

## 15. Compliance, GDPR, audit, provenienza

| Capacità | heuresys | Personio | Eightfold | Zucchetti | T1 | T2 |
|---|---|---|---|---|---|---|
| GDPR self-service del dipendente (export, richieste) | **Completo** — wired su /me — lat.(a) nota | Doc (dichiarazioni GDPR generiche) | Doc — responsible AI (dichiarativo) | n.c. | A | M |
| Console GDPR admin: data-map, registro richieste, export/erasure/retention | **Latente** — 5 endpoint pronti, 8 richieste e 85 righe di data-map REALI, zero UI — lat.(a) | n.c. | n.c. | n.c. | **A** — per un HRMS europeo è compliance visibile; già costruita, manca la pagina | M |
| Audit trail per utente (timeline organizzativa) | **Completo** — inv.D | n.c. | n.c. | n.c. | A | M |
| Provenienza/lineage del dato (chi ha generato cosa, con console) | **Completo** — inv.Q (provenance + generated-origins) | NTE | NTE | NTE | M | A — argomento di fiducia unico: nessuno dei tre lo documenta |
| Deleghe di mandato (conferisci/revoca con audit) | **Latente** — 4 route, tabella vuota perché nessuna UI ha mai permesso di crearne — lat.(a) | n.c. | n.c. | n.c. | M | B |

## 16. Integrazione ed estensibilità (la superficie di coesistenza)

| Capacità | heuresys | Personio | Eightfold | Zucchetti | T1 | T2 |
|---|---|---|---|---|---|---|
| API pubblica per terzi (auth dedicata, token, doc) | **Assente** — nessun meccanismo auth-per-terzi, nessuna tabella token — arch §8 | Doc — Developer Hub, API REST, webhook (Core Pro) | Doc (esistenza) — a contratto, non self-service | Doc (esistenza) — dietro SSO, contenuto non verificabile | **A** — il "complemento" vive di dati che entrano ed escono; presente in tutti e tre = probabile condizione d'ingresso | M |
| Webhook in uscita verso sistemi terzi | **Assente** — zero dispatcher eventi — arch §8 | Doc | Doc (esempio Greenhouse: sync 30 min) | NTE | M | B |
| Import massivo persone/dati da file (CSV/Excel) | **Assente** — multipart usato solo per media — arch §8 | n.c. (onboarding AI dichiarato) | n.c. | Doc — import tracciati è il suo pane | **A** — senza ingresso dati, ogni nuovo tenant PMI parte a mano: blocco di vendita | A — "carico la tua azienda davanti a te" è demo fortissima |
| Lettura presenze/paghe dal gestionale (tracciati Zucchetti TRRIPW/CSV/FOGPRE…) | **Assente** — nessun connettore; i formati Zucchetti sono documentati pubblicamente (5 tracciati) | n.c. | n.c. | Doc — formati pubblici, import unidirezionale verso Paghe | A — È la superficie di coesistenza concreta col gestionale dominante italiano | M |
| Sync tassonomie ufficiali (ESCO/ISTAT/ATECO) | **Completo** — arch §9 (pattern connettore riusabile) | NTE | NTE | n.c. | A | M |
| Marketplace di integrazioni | **Assente** | Doc — 200+ | n.c. | Doc — store di prodotti propri, non di terzi | B — non a 6 mesi | B |
| SSO come integrazione IdP cliente | vedi riga area 1 | — | — | — | — | — |

## 17. Amministrazione piattaforma e tenant builder

| Capacità | heuresys | Personio | Eightfold | Zucchetti | T1 | T2 |
|---|---|---|---|---|---|---|
| Gestione tenant (CRUD) + industry/ATECO | **Completo** (modifica e provisioning guidato solo API — latenti puntuali) — inv.Q | n.c. (multi-entità è altra cosa) | n.c. | n.c. | A — è il canale di onboarding clienti | A |
| Tenant blueprint: modello→processi→build-plan→apply→diff (azienda costruita da blueprint di settore) | **Completo** — inv.O, catena end-to-end verificata | **NTE** | **NTE** | **NTE** | A — riduce il costo di onboarding di OGNI cliente | **A** — "creo la tua azienda in demo" non lo fa nessuno dei tre |
| Enterprise typing del tenant (profilo operativo, size band) | **Parziale** — **difetto reale**: la pagina invia POST ma la route è solo PUT → ogni salvataggio fallisce — inv.O riga puntuale | n.c. | n.c. | n.c. | M | M |
| Blueprint di processo: famiglie, varianti, attivazioni | **Completo** — inv.O | n.c. | n.c. | n.c. | M | A |
| Osservabilità di sistema (pool DB, cache RBAC, query lente) | **Completo** — inv.A | n.c. | n.c. | n.c. | M | M |
| Materializzazione tenant / seed acquisition console | **Latente** (materializzazione) / **Completo** (runs, lettura) — inv.Q, inv. latenti | n.c. | n.c. | n.c. | M | B |

## 18. Org design intelligence (il territorio di sorpasso)

| Capacità | heuresys | Personio | Eightfold | Zucchetti | T1 | T2 |
|---|---|---|---|---|---|---|
| Capability composition + maturity (L0-L5) + essential ranking | **Completo** — inv.O (317 score live da FUNCTIONAL_CAPABILITY_LEDGER, ri-verifica lat.) | NTE | NTE | NTE | M — differenzia presso direzioni/consulenti, non è chiesto dal buyer HR medio | **A** |
| Analisi VRIO delle capability | **Completo** — inv.O | NTE | NTE | NTE | M | A — lessico da board room in un HRMS: unico |
| Org-health aggregata + advisor strategico | **Completo** — inv.O | NTE | NTE | NTE | M | A |
| Sentinella integrità organizzativa esposta (43/45 unità con violazioni: senza responsabile, ecc.) | **Latente** — vista viva mai letta dall'API; /org-director/health esiste ma non la usa — lat.(b) | n.c. | n.c. | n.c. | M | A — trasforma un dato già calcolato in "health check" vendibile |
| Grafi organizzativi: versioni, export PNG/PDF | **Completo** — inv.P | n.c. | n.c. | n.c. | M | A |
| Persistenza layout/stili dei grafi (riapri come l'avevi lasciato) | **Latente** — 316 posizioni-nodo salvate che il canvas IGNORA a ogni render — lat.(a) | n.c. | n.c. | n.c. | B | M — in demo il grafo che "si ricorda" fa qualità |
| Org network analytics (rete organizzativa) | **Completo** — inv.P | NTE | Rip | n.c. | M | A |

## 19. Assistenza AI

| Capacità | heuresys | Personio | Eightfold | Zucchetti | T1 | T2 |
|---|---|---|---|---|---|---|
| Assistente AI per tutti i dipendenti (domande HR self-service) | **Assente** come superficie di prodotto — esiste una console agente dev **Parziale**: gated da flag build-time, non linkata dal menu, gateway esterno — inv.T | Doc — Personio Assistant + fonti esterne (Q2-26) | Doc — Talent Agents | n.c. | M — differenziatore dichiarato del diretto, ma non ancora condizione d'ingresso PMI | **A** — in una demo 2026 l'AI si aspetta |
| Ricerca semantica AI su skill/occupazioni | **Parziale** — vedi area 4 (flag) | n.c. | Doc | n.c. | M | A |
| Advisor org design con suggerimenti | **Completo** — inv.O | NTE | NTE | n.c. | M | A |

---

## Lettura d'insieme (per l'Onda 3 — non ancora proposte)

**Lacune verso il concorrente diretto su righe a peso T1 alto** (candidate MUST/SHOULD, argine da applicare in Onda 5): SSO · role CRUD · authoring cicli di performance · authoring survey · API pubblica + import dati (presente in tutti e tre nelle rispettive forme → probabile **condizione d'ingresso al mercato**, da dire come tale).

**Dove il concorrente diretto è scoperto e noi completi** (argomenti di vendita, non lavoro): succession/nine-box nativo · LMS nativo · whistleblowing incluso (obbligo di legge IT) · KPI strutturati · variable pay · provenance · tenant blueprint · org design intelligence.

**Latenti a peso alto** (già pagate, distanza = una pagina o un flag): PIP in UI · mentorship (63+150 righe reali) · GDPR admin console · surveys authoring · assessments authoring · predictions read-model · sentinelle qualità (gap critici 161 righe, integrità org 43 righe) · semantic search flag · broadcast admin · node-layouts.

**Superfici di coesistenza con Zucchetti** (mai "lacune"): payroll/cedolini a regime · timbrature/turni/note spese · tracciati presenze documentati (TRRIPW, CSV, FOGPRE) · Inrecruiting via API. Ogni proposta che replichi una di queste deve motivare perché rifare batte collegarsi.

**Difetti reali trovati dall'inventario** (non proposte — vanno nel registro fuori-ciclo): enterprise-typing POST/PUT rotto (ogni salvataggio fallisce) · GET famiglie professionali protetta da `job_family:create` invece di un permesso di lettura.

## Integrazione pass-2 (compilata S1081, al rientro dei lotti A/B/C — 856/856 file, 0 esclusioni, delta 0)

**Nessuna cella di stato del progetto è stata smentita**: i tre lotti hanno letto documenti, non codice, e sulle celle vige il codice (già misurato dall'inventario). L'integrazione aggiunge due righe, un rafforzamento e quattro ancoraggi per l'Onda 3.

**Righe aggiunte** (vivono qui, riferite alle aree 17 e 12 — non duplicate sopra per non riscrivere le tabelle):
| Capacità | heuresys | Personio | Eightfold | Zucchetti | T1 | T2 |
|---|---|---|---|---|---|---|
| Metriche Prometheus `/metrics` per monitoraggio esterno | **Latente (da riverificare sul codice)** — D-09/EPICS_SPEC dichiarano fasi 1-4 shippate in main ma flag `PROM_METRICS_ENABLED` OFF; fase 5 (collector) gated su Enzo — pass2_c §In corso | n.c. | n.c. | n.c. | M — igiene operativa per un cliente con IT | B |
| Workspace personale configurabile a widget dall'utente | **Assente** — la dashboard attuale è per ruolo (inv.C); il workspace a widget era del legacy (WidgetFactory/WorkspaceRenderer, attestato solo in doc Codex sul vecchio stack — pass2_a §Menzioni) | n.c. | n.c. | n.c. | B | M |

**Rafforzamento**: la dottrina fondativa (pass2_c, `BROWNFIELD_EXCLUSION_RULES.md` + `AI_CODING_AGENT_BOOTSTRAP_PROMPT.md` §1.6) dichiara testualmente *«The platform is not: Core HR Administration; Payroll execution; Time & Attendance execution; Benefits/Welfare administration»* — conferma dalla fonte più antica i pesi B delle righe payroll/timbrature/turni e la lettura per-ruolo della colonna Zucchetti. (La contraddizione apparente con storia36 — che *costruisce* presenze e cedolini — è di metodo, non di perimetro: quei dati servono la dimostrabilità T2, non un motore paghe.)

**Ancoraggi per l'Onda 3** (concetti, non righe legacy — I12 vieta le righe, non le idee):
1. **Le lacune "Assente" hanno già spec storiche**: onboarding/preboarding, feedback systems, documents/signatures, recruiting, talent pool hanno mini-spec DDL complete mai eseguite in `cowork_reserved/batch_c3/sdbi_scale/` (pass2_b §Lavori interrotti). Tre sorelle di quelle spec (mentorship, predictions, surveys) furono POI costruite — e oggi sono i moduli latenti della matrice: il pattern «spec SDBI → modulo» ha precedenti riusciti.
2. **Governance AI a 6 stati** (CANDIDATE→…→MANAGEMENT_APPROVED/REJECTED, spec fondativa `SECURITY_AND_PRIVACY_BOUNDARIES.md` — pass2_c) — vocabolario mai citato nei doc di stato correnti; spiega il modulo latente `seed-approval-decisions` e offre la cornice per qualunque proposta AI-che-scrive.
3. **Future Evolution del blueprint bancario** (pass2_c): Workforce Intelligence Graph · Digital Twin of the Organization · AI-Assisted Experience · Process Mining · Compliance-by-Design — cinque direzioni fondative mai costruite; la seconda è lo stesso concetto che Eightfold vende come stato dell'arte (colonna metro).
4. **Tassonomia a 33 aree funzionali** (pass2_a, `functional_areas.md` di Codex, derivata dal legacy): utile come check di completezza delle righe di questa matrice — le aree BUSINESS/HR/PORTAL/SYSTEM vi trovano tutte una corrispondenza, con l'eccezione di Marketplace e Public API (entrambe già righe "Assente" qui) e Benchmarking (riga area 8).
