# Proposte — ciclo DREAM 2026-08-25

> **✅ F3 APPROVATA da Enzo il 2026-08-26** — la tabella MoSCoW ×2 della sezione «V11» in coda è la classificazione DEFINITIVA del ciclo (replicata machine-readable in `manifest.json`). Le schede sotto sono la bozza dell'Onda 3, conservata come record; in caso di divergenza fra una scheda e la V11, vale la V11.

**Stato**: BOZZA (Onda 3, S1081-dream). Classificazione **doppia e PROVVISORIA** (pre-verifier): ogni scheda porta `T1 · T2` — T1 = vendibile a 6 mesi a PMI italiane come complemento talent al gestionale esistente; T2 = dimostrabile dal vivo a prospect/investitori entro pochi mesi. La classificazione definitiva è V11, dopo i verdetti del verifier (Onda 4). Argine MUST ≤ 1/5 per traguardo: **rispettato** (29 sopravvissute → max 5; T1 ne ha 3, T2 ne ha 2).

Riferimenti `F`/`S` → `06_EVIDENZE.md`. Righe di matrice → `04_MATRICE.md` (area §n). `[F]` = fatto verificato, `[S]` = fonte esterna; ciò che non porta né l'uno né l'altro è dichiarato ipotesi.

**Una cosa da dire prima delle schede** (regola della skill): la famiglia "canale dati" (P-01/P-02/P-03/P-04) copre una lacuna a peso alto presente, nelle rispettive forme, in **tutti e tre** i competitor `[S4][S13][S14]`. Non è una funzionalità: è con ogni probabilità la **condizione d'ingresso al mercato** del complemento. Le quattro schede vanno lette come un'unica campagna.

---

## Lente 1 — COLMARE (lacune verso il concorrente diretto, righe a peso alto)

### [P-01] Il canale d'ingresso dei dati: importare persone e organigramma da file
**Classe (provv.)**: MUST-T1 · SHOULD-T2 — **Leva**: 4 (P-02, P-03, onboarding di ogni tenant reale, demo "carico la tua azienda") — **Sforzo**: M
**Cosa**: caricare un file (CSV/Excel) con dipendenti e struttura, vedere l'anteprima, confermare, poter tornare indietro.
**Perché questa classe**: senza ingresso dati ogni nuovo cliente parte a mano. Chi dice no: l'HR o l'IT della PMI che ha l'anagrafica nel gestionale e rifiuta il doppio inserimento. `[F16]` dimostra che oggi non esiste nulla.
**Da dove nasce**: matrice §16 · `[F16]` `[F21]` · `[S4]` (Personio: onboarding dati come leva dichiarata).
**Cosa esiste già**: multipart in 2 moduli `[F16]`; pattern modulo a 7 passi e Zod condiviso `[F21]`; tenant blueprint con apply idempotente come modello di scrittura governata `[F24]`; regole di scrittura di massa già codificate (Metodo di bonifica §4).
**Cosa manca**: parser, mappatura colonne→schema, anteprima, giornale di undo.
**Rischio**: scritture di massa su produzione — mitigato dal pattern guardia+post-condizione+rollback già obbligatorio nel progetto.
**Dipendenze**: nessuna.
**Sonda**: procurarsi un export anagrafico reale (o il tracciato Zucchetti documentato `[S12]`) e mappare a mano 10 colonne su `sys_users`/unità: se più di 3 non trovano casa, lo sforzo è L, non M. Mezza giornata.

### [P-02] Leggere i tracciati del gestionale (presenze/paghe Zucchetti)
**Classe (provv.)**: SHOULD-T1 · COULD-T2 — **Leva**: 2 (alimenta analytics presenze e cedolini con dati del cliente reale) — **Sforzo**: M
**Cosa**: importare i movimenti presenze e i riferimenti cedolino dai formati che Zucchetti documenta pubblicamente, così le analytics parlano dei dati veri del cliente.
**Perché questa classe**: è LA superficie di coesistenza col gestionale dominante italiano — colma senza replicare (la timbratura resta a Zucchetti, `[F29]` conferma il perimetro). Non MUST: si vende anche con i soli dati talent; diventa prezioso alla prima installazione reale.
**Da dove nasce**: matrice §9, §16 · `[S12]` (5 formati documentati) · `[F29]`.
**Cosa esiste già**: le tabelle presenze/cedolini popolate dalla storia36 `[F34]`; l'infrastruttura import di P-01.
**Cosa manca**: parser dei tracciati (TRRIPW in testa), riconciliazione codici dipendente.
**Rischio**: il manuale è ospitato da un partner, non dal dominio primario `[S12]` — la spec va confermata su un'installazione vera.
**Dipendenze**: P-01.
**Sonda**: mappare su carta i campi TRRIPW contro ciò che le pagine analytics presenze consumano davvero: se copre <70%, ripensare. Tre ore.

### [P-03] API per terzi + webhook in uscita
**Classe (provv.)**: SHOULD-T1 · COULD-T2 — **Leva**: 3 (integratori, ATS esistenti `[S14]`, ogni futuro connettore) — **Sforzo**: L
**Cosa**: un modo documentato perché altri programmi leggano/scrivano dati (token dedicati) e vengano avvisati quando qualcosa cambia.
**Perché questa classe**: presente in tutti e tre `[S4]``[S13]``[S14]` → condizione d'ingresso; ma a 6 mesi il file di P-01 basta per vendere le prime installazioni — l'API è il passo immediatamente successivo, non il primo.
**Da dove nasce**: matrice §16 · `[F15]`.
**Cosa esiste già**: contratti Zod per 604 route `[F2]``[F21]` — l'API pubblica può derivare dagli schemi interni; `emitNotification` come sorgente eventi per i webhook `[F19]`.
**Cosa manca**: auth per terzi (token/scope), versioning, dispatcher webhook, doc.
**Rischio**: superficie di sicurezza nuova; scope creep (quale sottoinsieme esporre).
**Dipendenze**: concettualmente autonoma; il valore cresce dopo P-01.
**Sonda**: scegliere i 5 endpoint che un integratore chiederebbe per primi e verificare che i loro schemi Zod siano esponibili senza rimaneggiamenti. Mezza giornata.

### [P-04] SSO aziendale (OIDC prima, SAML poi)
**Classe (provv.)**: MUST-T1 · COULD-T2 — **Leva**: 1 — **Sforzo**: M/L
**Cosa**: entrare con le credenziali aziendali del cliente (Microsoft/Google), senza una password in più.
**Perché questa classe**: requisito d'ingresso frequente per PMI strutturate con IT — l'architettura stessa lo dichiara `[F14]`; il diretto lo riserva al piano alto `[S4]`, segno che è leva di valore. Chi dice no: l'IT manager del prospect che ha policy "solo SSO".
**Da dove nasce**: matrice §1 · `[F14]` · `[S4]`.
**Cosa esiste già**: login a 2 passi con MFA, tabella sessioni SSO (placeholder) `[F14]`, RBAC maturo.
**Cosa manca**: flusso OIDC completo, provisioning/collegamento utenze, test con un IdP reale.
**Rischio**: dettagli per-IdP (Entra ID in testa); da non sottovalutare il logout/refresh.
**Dipendenze**: nessuna.
**Sonda**: due domande a tre prospect ("l'accesso con credenziali aziendali è condizione d'acquisto?") + lettura del seam nel service auth per capire dove si innesta un provider esterno. Mezza giornata.

### [P-05] Ruoli su misura (role CRUD con guardrail)
**Classe (provv.)**: SHOULD-T1 · COULD-T2 — **Leva**: 1 — **Sforzo**: M
**Cosa**: creare/modificare un ruolo e la sua mappa di permessi dal prodotto, senza migrazione.
**Perché questa classe**: il primo tenant vero chiederà un ruolo che i 14 attuali non coprono; oggi non esiste nemmeno l'API `[F12]`. Non MUST: i 14 ruoli coprono la demo e le prime installazioni.
**Da dove nasce**: matrice §1 · `[F12]`.
**Cosa esiste già**: matrice ruoli×permessi in lettura, cache RBAC, 224 permessi granulari.
**Cosa manca**: rotte di scrittura, UI, guardrail (mai togliere l'ESS floor I17, mai auto-lockout).
**Rischio**: un ruolo mal costruito apre o chiude troppo — servono invarianti non negoziabili nel validatore.
**Dipendenze**: nessuna.
**Sonda**: sulla popolazione RTL, quante persone NON sono ben servite dai ruoli attuali? (query di distribuzione ruoli/percorsi, 2 ore).

### [P-06] Condurre una campagna di valutazione dal prodotto
**Classe (provv.)**: MUST-T1 · SHOULD-T2 — **Leva**: 2 (sblocca P-09; alimenta nine-box con dati freschi) — **Sforzo**: L
**Cosa**: l'HR apre un ciclo di valutazione, sceglie chi valuta chi e con che scala, segue l'avanzamento, chiude e comunica.
**Perché questa classe**: oggi il prodotto *mostra* le valutazioni ma non permette di *condurle* (solo consultazione in UI; i moduli assessments sono latenti `[F26]`). Un complemento talent che non sa fare la campagna di review non si vende. Chi dice no: l'HR manager al primo giro annuale.
**Da dove nasce**: matrice §5 · `[F26]` `[F1]` · `[S6]` (il diretto ha il Review Cycle Builder).
**Cosa esiste già**: review-cycles/calibration/performance-reviews in lettura; moduli `assessments*` lato API `[F26]`; approvals engine per i passaggi di stato `[F24]`; notifiche `[F19]`.
**Cosa manca**: il flusso di regia (wizard campagna), le UI di compilazione manager/dipendente, la comunicazione degli esiti (I20: valutazioni non comunicate restano riservate).
**Rischio**: è la proposta più grossa della lente; il perimetro va tagliato al flusso minimo (una scala, un giro, una calibrazione).
**Dipendenze**: nessuna dura; P-11 (reminder) la rende migliore.
**Sonda**: gap-list fra le route `assessments*` esistenti e il flusso minimo di una campagna: quanto è già coperto lato server? Mezza giornata.

### [P-07] Creare i sondaggi dal prodotto (authoring survey)
**Classe (provv.)**: SHOULD-T1 · SHOULD-T2 — **Leva**: 1 — **Sforzo**: M
**Cosa**: l'HR compone un sondaggio (o parte da 3 template), lo lancia, guarda le risposte arrivare.
**Perché questa classe**: la metà "consuma" esiste già completa (ESS + risultati, matrice §11); manca solo la metà "crea" — modulo `surveys` latente `[F26]`. Il diretto lo vende come add-on con 11 template.
**Da dove nasce**: matrice §11 · `[F26]` · competitor_personio §survey.
**Cosa esiste già**: engagement/pulse/risposte end-to-end; modulo surveys lato API.
**Cosa manca**: UI di composizione + 3 template italiani sensati.
**Rischio**: basso.
**Dipendenze**: nessuna.
**Sonda**: bozza di 3 template su schema esistente e una corsa di prova sul tenant Heuresys System. Mezza giornata.

### [P-08] Onboarding/offboarding con liste e scadenze
**Classe (provv.)**: SHOULD-T1 · COULD-T2 — **Leva**: 1 — **Sforzo**: M
**Cosa**: quando una persona entra (o esce), il sistema apre i compiti giusti alle persone giuste, con date.
**Perché questa classe**: tocca il ciclo di vita del talento che presidiamo; il diretto ce l'ha; esiste già una mini-spec DDL storica mai eseguita `[F27]`. Non MUST: la PMI sopravvive col processo manuale il primo anno.
**Da dove nasce**: matrice §13 · `[F27]` `[F19]` `[F24]`.
**Cosa esiste già**: approvals engine, notifiche, posizioni/assegnazioni come ancore degli eventi.
**Cosa manca**: modello checklist/trigger su date, UI.
**Rischio**: il confine col "workflow builder generico" (non proposto) va tenuto: solo onboarding/offboarding, a catalogo.
**Dipendenze**: nessuna.
**Sonda**: confrontare la mini-spec SDBI `03_OnboardingPreboarding.md` con lo schema attuale: quanto è riusabile? Due ore.

### [P-09] 360° e feedback continuo
**Classe (provv.)**: COULD-T1 · COULD-T2 — **Leva**: 0 — **Sforzo**: M
**Cosa**: chiedere e dare feedback fra colleghi, fuori dal ciclo formale.
**Perché questa classe**: valore reale, nessun costo nel rinviare: il buyer PMI compra prima la campagna (P-06). Spec storica esiste `[F27]`.
**Da dove nasce**: matrice §5 · `[F27]` · competitor_personio §performance.
**Cosa esiste già / manca / Rischio**: eredita quasi tutto da P-06; da solo non sta in piedi.
**Dipendenze**: P-06.
**Sonda**: nella campagna-sonda di P-06, chiedere a 3 utenti pilota se il 360 è atteso al primo giro. Un'ora.

### [P-10] Firma elettronica sui documenti HR
**Classe (provv.)**: COULD-T1 · COULD-T2 — **Leva**: 0 — **Sforzo**: M
**Cosa**: far firmare una lettera o un'informativa dentro il portale (via provider di firma, non costruendone uno).
**Perché questa classe**: attrito reale ma non blocca la vendita del talent layer; spec storica Documents/Signatures esiste `[F27]`; il diretto la dà con limiti per piano.
**Da dove nasce**: matrice §14 · `[F27]` · competitor_personio §documenti.
**Cosa esiste già**: CMS documentale versionato completo (matrice §14); documenti personali ESS.
**Cosa manca**: integrazione provider (eIDAS), stato firma sul documento.
**Rischio**: scelta provider e costi per firma.
**Dipendenze**: nessuna.
**Sonda**: preventivo API di 2 provider di firma italiani + verifica che il CMS regga un campo stato-firma. Tre ore.

### [P-11] Promemoria automatici sulle scadenze
**Classe (provv.)**: SHOULD-T1 · COULD-T2 — **Leva**: 1 (rende migliori P-06/P-08) — **Sforzo**: S
**Cosa**: contratti in scadenza, certificazioni che scadono, valutazioni non chiuse: il sistema avvisa da sé.
**Perché questa classe**: attrito quotidiano dell'HR; il motore c'è già (`emitNotification` `[F19]`), manca solo il "chi guarda il calendario".
**Da dove nasce**: matrice §2 · `[F19]` · competitor_personio §core-hr.
**Cosa esiste già**: notifiche con preferenze/dedupe; timer systemd come pattern (digest `[F11]`).
**Cosa manca**: un job che scandaglia le scadenze + regole per-tipo.
**Rischio**: basso. Il canale email resta bloccato (`[F11]`) — partono in-app.
**Dipendenze**: nessuna (email: vedi P-23).
**Sonda**: contare le scadenze reali nei dati RTL (contratti, certificazioni con expiry): se sono decine, la proposta respira. Un'ora di query.

### [P-12] Misurare la resa mobile del portale ESS
**Classe (provv.)**: COULD-T1 · COULD-T2 — **Leva**: 1 (decide se serve una PWA) — **Sforzo**: S
**Cosa**: sapere, con misure, come si comporta il portale dal telefono — prima di decidere qualunque investimento mobile.
**Perché questa classe**: la matrice dichiara la resa responsive NON misurata (§1): è un'indagine, deliverable = referto.
**Da dove nasce**: matrice §1 (lacuna dichiarata) · competitor_personio (app mobile inclusa).
**Sonda** (coincide con la voce): Playwright su viewport mobile per 5 pagine ESS chiave + screenshot. Mezza giornata.

---

## Lente 2 — SUPERARE (ciò che nessuno dei tre fa, e questo progetto può fare per com'è costruito)

### [P-13] La pagina del Position Intelligence Profile
**Classe (provv.)**: MUST-T2 · SHOULD-T1 — **Leva**: 2 (dà un volto al posizionamento position-centric; arricchisce ogni demo) — **Sforzo**: S/M
**Cosa**: una pagina che mostra il profilo completo di una posizione — skill richieste, KPI, formazione, successione, peso economico — il "documento d'identità" della posizione.
**Perché questa classe**: è il prodotto-firma (I1/I9) ed è **già pagato**: la VIEW esiste, l'endpoint esiste, nessuna pagina lo chiama `[F22]`. Chi dice no (T2): il prospect che chiede «fammi vedere una posizione» e riceve quattro pagine separate. Nessuno dei tre ha una scheda-posizione così `[S1]` (matrice §3 NTE su tutta la riga).
**Da dove nasce**: matrice §3 · `[F22]` `[F1]`.
**Cosa esiste già**: tutto il lato server; le 4 sotto-pagine posizione da cui aggregare.
**Cosa manca**: una pagina.
**Rischio**: la VIEW ha 6 subquery correlate per riga — latenza da misurare (arch §1, lacuna dichiarata).
**Dipendenze**: nessuna.
**Sonda**: chiamare l'endpoint su 3 posizioni RTL e misurare tempi e completezza dei dati. Un'ora.

### [P-14] Il pacchetto Compliance Italia
**Classe (provv.)**: SHOULD-T1 · SHOULD-T2 — **Leva**: 2 — **Sforzo**: S/M
**Cosa**: presentare come un'unica storia ciò che c'è già o quasi: whistleblowing incluso `[F25]`, console GDPR (latente: 5 endpoint e dati reali, manca una pagina `[F5]`), audit trail, provenance. «La conformità si vede», contro il diretto che la vende a pezzi `[S3]`.
**Perché questa classe**: in Italia il whistleblowing è obbligo sopra i 49 dipendenti e Personio lo fa pagare a parte `[S3]`; la console GDPR è la latente col miglior rapporto costo/argomento (una pagina su endpoint pronti). Vendita e demo insieme.
**Da dove nasce**: matrice §11, §15 · `[F5]` `[F25]` · `[S3]`.
**Cosa esiste già**: tutto tranne la pagina GDPR admin e la voce di menu che unisce.
**Cosa manca**: 1 pagina GDPR + narrazione/menu + una pagina di posizionamento pubblica.
**Rischio**: basso; attenzione a non promettere consulenza legale.
**Dipendenze**: nessuna.
**Sonda**: le 8 richieste GDPR e le 85 righe di data-map reali rendono bene in una tabella? Mock su dati veri, 2 ore.

### [P-15] AI dichiarabile: il registro dei modelli visibile
**Classe (provv.)**: SHOULD-T2 · COULD-T1 — **Leva**: 1 — **Sforzo**: S
**Cosa**: una pagina che mostra quali modelli girano, quali predizioni hanno prodotto (468 già in tabella `[F6]`) e da quale evidenza discendono — l'opposto della scatola nera.
**Perché questa classe**: il metro di riferimento è sotto class action proprio sulla provenienza dei dati del suo motore `[S10]`: "explainable by construction" è un racconto che nessuno dei tre può fare e noi sì (provenance + evidence + read-model già esistenti). T2 forte, T1 non richiesto.
**Da dove nasce**: matrice §12 · `[F6]` · `[S10]`.
**Cosa esiste già**: predictions read-model (4 route), evidence drawer, provenance console.
**Cosa manca**: una pagina che li cuce.
**Rischio**: aspettative — «spiegabile» va detto con misura.
**Dipendenze**: nessuna.
**Sonda**: wireframe su dati veri di modello→predizioni→evidenza per il flight-risk. Mezza giornata.

### [P-16] Il CCNL come tassonomia ufficiale della piattaforma
**Classe (provv.)**: SHOULD-T1 · COULD-T2 — **Leva**: 2 (inquadramenti nella job architecture; riferimento per le fasce comp) — **Sforzo**: M
**Cosa**: portare i contratti collettivi (inquadramenti, livelli) dentro reference_sync come ESCO e ATECO, così posizioni e fasce parlano la lingua contrattuale italiana.
**Perché questa classe**: per una PMI italiana l'inquadramento CCNL è lingua madre; nessuno dei tre lo documenta come tassonomia di prodotto; il pattern connettore è rodato `[F17]` e la spec di design del progetto elenca già i «registri CCNL pubblici» fra le fonti ammesse `[F32]`. I21 tiene le tassonomie aperte a ogni industry.
**Da dove nasce**: matrice §16 · `[F17]` `[F32]`.
**Cosa esiste già**: pipeline reference_sync con CLI e test seam.
**Cosa manca**: la fonte (CNEL?) verificata, il connettore, il collegamento a job-roles/fasce.
**Rischio**: la fonte pubblica potrebbe non esistere in forma scaricabile e con licenza chiara — la sonda decide la vita della proposta.
**Dipendenze**: nessuna.
**Sonda**: l'archivio CNEL dei CCNL è scaricabile in bulk, con che struttura e che licenza? Mezz'ora di ricerca; se no, la proposta cade.

### [P-17] Le sentinelle diventano salute visibile
**Classe (provv.)**: SHOULD-T2 · COULD-T1 — **Leva**: 1 — **Sforzo**: S
**Cosa**: dentro `/org-director/health`, due nuove card già calcolate dal database: le 161 posizioni occupate con gap critici di competenza e le 43 unità con violazioni d'integrità organizzativa `[F9]`.
**Perché questa classe**: dato già pagato, mai riscosso — costa un endpoint e due card; in demo trasforma "abbiamo le analytics" in "il sistema ti dice dove fa male".
**Da dove nasce**: matrice §4, §18 · `[F9]`.
**Cosa esiste già**: le viste vive; la pagina org-health.
**Cosa manca**: endpoint + card (+ dichiararle sentinelle informative per db_health, memoria `new_sys_view_becomes_sentinel`).
**Rischio**: 43/45 unità in violazione è un numero che va spiegato, non solo mostrato.
**Dipendenze**: nessuna.
**Sonda**: SELECT delle due viste e bozza delle card. Un'ora.

### [P-18] L'assistente AI per i dipendenti
**Classe (provv.)**: SHOULD-T2 · COULD-T1 — **Leva**: 1 — **Sforzo**: L
**Cosa**: un assistente nel portale ESS che risponde su handbook, policy e dati propri («quanti giorni di ferie mi restano?»), e per qualunque azione che scrive passa dall'approvazione.
**Perché questa classe**: in una demo 2026 l'AI si aspetta (il diretto la mette in prima pagina `[S8]`); la console agente esiste già come attrezzo interno `[F31]`. T1 COULD: nessun buyer PMI la pretende come condizione oggi.
**Da dove nasce**: matrice §19 · `[F31]` `[F28]` · `[S8]` `[S9]`.
**Cosa esiste già**: gateway agente con approvazione delle scritture; handbook/CMS come base di conoscenza; RBAC/self-scope per il perimetro dati.
**Cosa manca**: superficie ESS, retrieval sulla knowledge del tenant, guardrail di prodotto (non di laboratorio).
**Rischio**: risposte sbagliate su temi sensibili — il perimetro I17/I18 va rispettato dal retrieval, non solo dalla UI. `[F31]` porta un pezzo da memoria: rimisurare lo stato del gateway prima di stimare.
**Dipendenze**: P-19 (per qualunque azione che scrive).
**Sonda**: 10 domande HR reali alla console dev su dati RTL; contare quante risposte sono giuste e con il dato giusto. Mezza giornata.

### [P-19] La trafila degli output AI: governance a 6 stati
**Classe (provv.)**: SHOULD-T2 · COULD-T1 — **Leva**: 3 (P-18, ogni futura funzione prescrittiva, pipeline seed) — **Sforzo**: M
**Cosa**: ogni cosa che un modello propone (un suggerimento, una riga generata) porta uno stato — proposta, validata dal dominio, validata da HR, approvata, respinta — e nessuna scrittura salta la trafila.
**Perché questa classe**: la cornice era già nelle spec fondative `[F28]` e l'attrezzo per farla rispettare esiste (approvals engine con apply-effects `[F24]`): è il cambiamento strutturale che abilita una famiglia intera (AI che agisce, non solo che mostra) senza aprire il fianco. Racconto di fiducia complementare a P-15.
**Da dove nasce**: `[F28]` `[F24]` · matrice §19.
**Cosa esiste già**: approval engine multi-step; provenance per l'origine.
**Cosa manca**: il vocabolario di stato unificato e l'aggancio come effect-handler.
**Rischio**: burocratizzare ciò che non scrive — la trafila vale solo per le scritture.
**Dipendenze**: nessuna.
**Sonda**: mappare i 6 stati fondativi sugli stati dell'approval engine attuale: dove non combaciano? Due ore su carta.

---

## Lente 3 — SBLOCCARE (già costruito, da comporre o accendere)

### [P-20] La pagina della mentorship
**Classe (provv.)**: SHOULD-T2 · COULD-T1 — **Leva**: 1 — **Sforzo**: S
**Cosa**: programmi, coppie mentor-mentee, sessioni: 17 route già complete e 63 rapporti con 150 sessioni REALI in tabella, zero UI `[F4]`.
**Perché questa classe**: la latente più matura dell'intera caccia — distanza dall'utente: una pagina. In demo è una storia con dati veri; il metro la cita nel suo hype `[S9]`.
**Da dove nasce**: matrice §6 · `[F4]`.
**Cosa manca**: una pagina admin + una vista ESS ("le mie mentorship").
**Rischio**: basso.
**Dipendenze**: nessuna.
**Sonda**: coerenza dei 63 rapporti (utenti attivi? date sensate? match-score popolati?). Un'ora di query.

### [P-21] Accendere la ricerca semantica in produzione
**Classe (provv.)**: MUST-T2 · SHOULD-T1 — **Leva**: 1 — **Sforzo**: S
**Cosa**: portare a ON il flag `MATCHING_FREETEXT_ENABLED`: la UI c'è già in due pagine e oggi, a flag spento, l'utente riceve un errore `[F10]`.
**Perché questa classe**: la demo AI già pagata (`[F18]` substrato pgvector). Chi dice no (T2): il prospect che digita nella barra di ricerca AI e vede un 404. È l'unlock più economico dell'intero ciclo.
**Da dove nasce**: matrice §4 · `[F10]` `[F18]`.
**Cosa manca**: la decisione + una misura di latenza/costo prima e dopo.
**Rischio**: costo/latency dell'embedding a runtime — la sonda lo misura; il valore PROD reale del flag non è leggibile da qui (`.env` negato): misurare sul campo.
**Dipendenze**: nessuna.
**Sonda**: flag ON in locale, 20 query realistiche, p95 e qualità percepita. Due ore.

### [P-22] I grafici che si ricordano
**Classe (provv.)**: COULD-T2 · COULD-T1 — **Leva**: 0 — **Sforzo**: S
**Cosa**: riaprire un organigramma e trovarlo come l'avevi sistemato: 316 posizioni-nodo già salvate che il canvas ignora `[F8]`.
**Perché questa classe**: qualità percepita in demo; nessun costo nel rinviare.
**Da dove nasce**: matrice §18 · `[F8]`.
**Sonda**: verificare che i 316 layout salvati appartengano a grafi ancora esistenti. Un'ora.

### [P-23] Broadcast e digest: il canale delle comunicazioni
**Classe (provv.)**: COULD-T1 · COULD-T2 — **Leva**: 1 — **Sforzo**: S (broadcast) + decisione (email)
**Cosa**: la pagina per inviare comunicazioni a tutti (endpoint pronti `[F26]`) e — separatamente — lo sblocco dell'email con un provider transazionale, visto che il percorso originale è morto `[F11]`.
**Perché questa classe**: il broadcast è una latente a costo pagina; l'email è `blocked-on-Enzo` dichiarato: serve una credenziale/decisione che solo lui può dare (**WAIT-INPUT**, non "done" mai finché non invia davvero).
**Da dove nasce**: matrice §10 · `[F11]` `[F26]`.
**Sonda**: per l'email: un provider transazionale (prezzo/GDPR/EU-region) scelto e provato con UNA mail vera sul dominio — richiede la decisione di Enzo prima.

### [P-24] Le deleghe di mandato
**Classe (provv.)**: COULD-T1 · COULD-T2 — **Leva**: 0 — **Sforzo**: S
**Cosa**: conferire/revocare una delega (ferie del manager → approva il vice): 4 route pronte, tabella a zero perché nessuna UI ha mai permesso di crearne una `[F7]`.
**Perché questa classe**: completa il modello dei domini (la delega è uno dei 10 domini di M1 `[F20]`); nessuna urgenza di mercato misurata.
**Da dove nasce**: matrice §15 · `[F7]` `[F20]`.
**Sonda**: chiedere all'uso: nella campagna P-06 pilota, quante approvazioni si incagliano su assenze del responsabile? (si misura lì).

### [P-25] Prometheus: riverificare e accendere
**Classe (provv.)**: COULD-T1 — **Leva**: 0 — **Sforzo**: S
**Cosa**: rimisurare sul codice lo stato del flag `PROM_METRICS_ENABLED` (il fatto è documentale `[F30]`), poi accendere ed eventualmente installare il collector (fase 5 = decisione di Enzo).
**Perché questa classe**: igiene operativa per clienti con IT; nessun impatto demo.
**Da dove nasce**: matrice §Integrazione pass-2 · `[F30]`.
**Sonda**: grep del flag + curl di `/metrics` in locale. Un'ora — la sonda È la riverifica.

### [P-29] Export dei dati: prima di un report builder, il CSV
**Classe (provv.)**: COULD-T1 · COULD-T2 — **Leva**: 1 (metà "uscita" del canale dati) — **Sforzo**: M
**Cosa**: esportare in CSV le viste analytics correnti — il passo minimo dell'uscita dati, rinviando il report builder.
**Perché questa classe**: il diretto è debole proprio su reporting/export (lamentela ricorrente `[S5]`), ma un report builder è XL e nessun buyer lo pretende al primo anno: il CSV copre l'80% della domanda reale ("portami i dati dal commercialista/consulente").
**Da dove nasce**: matrice §12 · `[S5]` `[F1]`.
**Sonda**: quali 5 estrazioni chiederebbe un consulente del lavoro? Chiedere a uno vero. Un'ora di telefonata.

---

## Eretiche (contraddicono una scelta, o tolgono invece di aggiungere)

### [P-26] ERETICA — L'ATS non si costruisce: recruiting fuori perimetro, per sempre
**Classe (provv.)**: WON'T (dichiarato) — **Leva**: (libera capacità) — **Sforzo**: 0
**Cosa**: dichiarare che heuresys non avrà un ATS; il recruiting si integra (Inrecruiting via API `[S14]`, o l'ATS che il cliente ha) attraverso P-03.
**Perché**: contraddice la tassonomia fondativa a 33 aree (che include Recruitment) e l'aspettativa all-in-one — ma il perimetro fondativo `[F29]` e il ruolo coesistente di Zucchetti dicono la stessa cosa: il complemento vince restando complemento. Condizione di rientro: un segmento di prospect che compra SOLO se c'è l'ATS, misurato sui lead.
**Da dove nasce**: matrice §13 · `[F29]` · `[S14]`.
**Sonda**: nei lead raccolti, quante richieste menzionano il recruiting? Query sui lead, un'ora.

### [P-27] ERETICA — Non tutte le latenti vanno accese: ritirarne una parte
**Classe (provv.)**: SHOULD-T1 (come igiene) — **Leva**: 1 (riduce superficie di manutenzione/audit) — **Sforzo**: M (il ritiro si paga in file da emendare, ADR-0035)
**Cosa**: per ciascuno dei 31 moduli senza consumer `[F3]`: o entra in una proposta di questo ciclo, o si ritira formalmente. L'istinto dice «esponi tutto»; l'esperienza del progetto dice che il residuo è lo stato normale e va bonificato.
**Perché**: 31 moduli mantenuti e mai raggiunti sono costo di typecheck, test, sicurezza e comprensione — per sempre. Toglierne metà rende più vere le metriche e più leggero ogni audit.
**Da dove nasce**: `[F3]` · Metodo di bonifica (CLAUDE.md) · ADR-0035.
**Cosa manca**: la tabella di triage e le decisioni (le prende il ciclo di sviluppo, non questo).
**Rischio**: ritirare qualcosa che una proposta futura avrebbe riusato — il triage incrocia QUESTO file prima di decidere.
**Dipendenze**: da eseguire DOPO la classificazione finale (V11), così le keep-list sono note.
**Sonda**: tabella 31 moduli × (dati vivi sì/no, citato in una proposta sì/no, costo di ritiro in file). Mezza giornata.

### [P-28] ERETICA — Il listino pubblico
**Classe (provv.)**: COULD-T2 (WAIT-INPUT sui numeri) — **Leva**: 1 — **Sforzo**: S
**Cosa**: pubblicare i prezzi sul sito, mentre tutti e tre i competitor vendono a preventivo `[S15]`.
**Perché**: per una PMI il preventivo obbligatorio è attrito e sfiducia; "prezzo in chiaro" è un posizionamento che nessuno dei tre può copiare in fretta. Contraddice la norma di segmento; i numeri sono autorità esclusiva di Enzo (wargame #15).
**Da dove nasce**: `[S15]` · matrice §13/GTM · pass2_c (wargame 15: Q1-Q8 senza risposta).
**Sonda**: nei lead raccolti, quanti chiedono il prezzo? Query, un'ora. I numeri restano decisione di Enzo.

---

## Generate e scartate per mancanza di ancoraggio (la lista che non sopravvive)

| idea | perché è caduta |
|---|---|
| Talent marketplace interno (progetti/gig) | solo il metro lo fa `[S9]`; nessuna domanda PMI misurata; pratica da grande impresa — mai MUST e nemmeno SHOULD difendibile oggi |
| Inferenza skill da email/app (Digital Twin) | metro-only `[S9]`; nessun substrato dati di segnali comportamentali nel progetto; implicazioni privacy che il posizionamento "AI dichiarabile" (P-15) contraddirebbe |
| Workspace personale a widget | attestato solo in doc Codex sullo stack legacy (pass2_a); nessuna domanda misurata |
| Multi-entità legale nel tenant | il segmento target è mono-entità; il multi-tenant copre il resto (matrice §2) |
| Benchmarking retributivo di mercato | nessuna fonte dati IT accessibile misurata in questo ciclo; il diretto stesso delega a partner |
| App mobile nativa | prima si misura il responsive (P-12): proposta prematura per costruzione |
| Process mining | nominato solo in Future Evolution `[F33]`; nessun event-log di processo esiste da minare |
| Report builder completo | sforzo XL, T1 non lo chiede a 6 mesi; il primo passo vero è P-29 (export) |
| Turni / note spese / timbratura attiva | perimetro fondativo `[F29]` + ruolo Zucchetti: si integra (P-02), non si costruisce |

---

## Nota per l'Onda 4 (verifier)

Punti dove questa bozza è più attaccabile, dichiarati: (1) le classi provvisorie T1 si reggono su un'ipotesi di buyer PMI non ancora validata da interviste — le sonde di P-04/P-26/P-28 la misurano; (2) F30/F31/F34 hanno componente documentale/memoria; (3) le celle Personio da snippet indicizzati (blocco anti-bot) sono il punto più debole della base fonti; (4) la leva dichiarata è una stima dell'orchestratore, non una misura.

---

# V11 — Recepimento e classificazione definitiva (2026-08-26, post-verifier)

Verdetti in `_raccolta/verifier_verdetti.md`; evidenze corrette in `06_EVIDENZE.md` (F3/F10/F27/F31 corretti, F35–F39 e S16 aggiunti). I riferimenti di linea (`docs/vision/riferimenti/`) sono applicati: nessuna proposta viola i confini del posizionamento; P-19 incarna «AI-assisted decisions, human-governed outcomes»; P-16 incarna la fondazione EU/IT; P-26 coincide col confine «recruiting supportato, non ATS».

## Le quattro cadute, e il loro esito

| id | esito | perché |
|---|---|---|
| P-21 (semantic search ON) | **ELIMINATA — era già fatta.** | Il flag è `true` in PROD dal S975, voce #40 DONE con demo live [F10 corretto]. Non era una proposta: era una lettura sbagliata del ciclo (default di codice preso per stato di produzione mentre la risposta era leggibile in SOT_BACKLOG). Resta un'azione fuori ciclo da 10 minuti: riverifica fresca sulla VM. |
| P-07 (authoring survey) | **GATED → WAIT-INPUT (decisione m2b di Enzo)** | Il modulo latente scrive su un cluster JSONB che l'ESS non legge [F39]: comporlo lì non arriva ai dipendenti. Prima la decisione semantica fra i due cluster (già aperta come m2b), poi l'authoring — che a quel punto è sul cluster normalizzato, lavoro diverso dalla scheda. |
| P-18 (assistente AI ESS) | **Declassata a COULD-T2, con rimisura obbligatoria + WAIT-INPUT credenziale** | La console non è accendibile in nessun ambiente (flag assente da ogni `.env`), il gateway è blocked-on-Enzo, il serving customer-facing è «nuovo scope» [F31 corretto]. La visione resta (riferimento LinkedIn: agenti che propongono, non decidono), i piedi per terra no. |
| P-22 (grafi che si ricordano) | **Spostata fra le SCARTATE (rientra solo con render nuovo)** | Non esiste un canvas che possa onorare i 316 layout: il renderer è Mermaid, che calcola le posizioni; un canvas interattivo è lavoro cross-repo (`ux-design-shared`) di sforzo L — non "una pagina". Il fatto era vero, la conclusione no. |

## Correzioni recepite sulle sopravvissute (delta rispetto alle schede)

- **P-01**: [S4] tolto; «condizione d'ingresso» declassata a ipotesi per l'import file (nella matrice Personio/Eightfold sono n.c. su quella riga); sforzo M→M/L (si aggiungono lineage obbligatorio, guardia/post-condizione/rollback); la sonda richiede un file anagrafico reale → **WAIT-INPUT parziale**, in alternativa si esercita sul tracciato Zucchetti pubblico.
- **P-02**: la direzione dei tracciati è INVERSA a quanto scritto — sono file che i rilevatori producono **verso** Paghe: si legge la copia di quel flusso, la controparte tecnica è il fornitore presenze; la metà "cedolini" cade (nessuna fonte la sostiene).
- **P-03**: costo "doc" abbattuto da OpenAPI già generato [F36]; «in tutti e tre» ristretto a «self-service solo nel diretto».
- **P-04**: **MUST-T1 → SHOULD-T1 provvisorio con promozione condizionata**: sale a MUST se la sonda sui prospect conferma (l'argomento attuale era circolare — citava il giudizio del proprio raccolto). Sforzo → L.
- **P-05**: sforzo M→L — due costi verificati: cache RBAC boot-only senza invalidazione; 76 INSERT di mapping riapplicati dalla catena a ogni deploy (collisione da progettare con ADR-0035).
- **P-06**: «cosa esiste già» rimisurato: creare/avanzare un ciclo c'è già; scrivere una valutazione NON ha endpoint; creare una scala nemmeno. L confermato come tetto.
- **P-08**: «DDL complete» → «mini-spec, contenuto non verificato» [F27 corretto]; scheduler: esiste il precedente `approvals-sla.timer` [F37].
- **P-10**: vincolo dichiarato: i firmati finirebbero su LocalDiskStore (disco locale) — dipendenza dal media store S3 (lat.(f)); sonda WAIT-INPUT (preventivo commerciale).
- **P-12**: esiste già il progetto Playwright **Pixel 7** con a11y mobile verde — la proposta diventa estensione di quello, sforzo <S; a11y ≠ resa di layout, resta da misurare quella.
- **P-13**: MUST-T2 CONFERMATO ma con motivazione riscritta su F22 soltanto (endpoint pagato, zero chiamanti); la rivendicazione «nessuno dei tre» cade (Eightfold era n.c., e [S1] non parlava di PIP).
- **P-14**: il rischio NON è basso: 3 route su 5 sono distruttive (erasure/retention) → guardia, post-condizione e rollback obbligatori; la soglia di legge ora è ancorata [S16: ≥50 dipendenti]; la pagina pubblica di posizionamento è scope separato.
- **P-15**: **condizionata a una rimisura di provenienza**: SOT_BACKLOG qualifica le 468 predizioni come "precomputed legacy" — mostrarle come «i nostri modelli» sarebbe l'opposto dell'AI dichiarabile. Prima la provenienza, poi la pagina (dicendo ciò che è).
- **P-16**: la sonda ha già un esito parziale POSITIVO (il CNEL pubblica «Contratti in Open Data», visto dal verifier); resta da dichiarare che reference_sync è PLATFORM_ADMIN/globale → l'aggancio per-tenant è superficie in più.
- **P-17**: dipendenza dichiarata: mostrare 43/45 unità in violazione in demo è un autogol senza prima bonificare i dati organizzativi RTL — la card nasce DOPO quella bonifica (voce per il ciclo di sviluppo).
- **P-19**: leva 3→1 (resta la pipeline seed); nasce come cornice, non come rimedio: oggi nessuna AI scrive in produzione.
- **P-20**: la vista ESS richiede un modulo `/v1/me/*` nuovo (ADR-0011) — lo sforzo S copre la sola pagina admin; [S9] non copre il mentoring (catena a due passaggi).
- **P-23**: **spezzata**: (a) broadcast admin = COULD, regge; (b) email/digest = NON è una proposta, è la voce #39 già in HOLD dal 2026-08-25 con motivo scritto — non rientra dalla finestra.
- **P-24**: sonda sostituita con una query eseguibile ora (approvazioni ferme su approvatore assente), non col pilota di P-06.
- **P-25**: sforzo S→XS: la riverifica l'ha già fatta il verifier sul codice [F38], il collector systemd è già in repo; resta la decisione di Enzo (fase 5) — **WAIT-INPUT**.
- **P-26**: dipendenza vera da P-03 dichiarata; la sonda sui lead vale solo sopra una soglia minima di volume (da fissare: <30 lead → la sonda non decide).
- **P-27**: il criterio diventa a TRE esiti: proposta / **consumer non-web** (CLI, altro modulo — es. `research`, `reference-sync`) / ritiro; cancellato l'obiettivo «toglierne metà» (senza base).
- **P-28**: stessa soglia minima di volume sulla sonda; resta WAIT-INPUT sui numeri (autorità di Enzo).
- **P-29**: capovolta nel verso giusto: **non si costruisce l'export, si espone quello che c'è** [F35] — un bottone e la scelta del formato; sforzo M→S. La scartata «report builder» perde la motivazione a catena e resta scartata per sforzo/finestra.

## TABELLA MoSCoW ×2 — per la Fermata 3 (ordinata per leva dentro ogni classe)

**Argine**: 24 proposte vive (29 − P-21 eliminata − P-22 scartata − P-07 gated − P-26 WON'T dichiarato + P-23 spezzata in una) → tetto MUST = 4 per traguardo. T1 ne ha 2, T2 ne ha 1.

| id | proposta | **T1** (vendibile 6 mesi) | **T2** (dimostrabile) | leva | sforzo | vincoli |
|---|---|---|---|---|---|---|
| P-01 | Import persone/org da file | **MUST** | COULD | 4 | M/L | sonda WAIT-INPUT parziale |
| P-06 | Condurre una campagna di valutazione | **MUST** | SHOULD | 2 | L | — |
| P-04 | SSO aziendale | **SHOULD*** (→MUST se sonda prospect conferma) | COULD | 1 | L | sonda su Enzo/prospect |
| P-13 | La pagina del PIP | SHOULD | **MUST** | 2 | S/M | — |
| P-14 | Pacchetto Compliance Italia (GDPR console + WB) | SHOULD | SHOULD | 2 | S/M | superficie distruttiva: guardie |
| P-16 | CCNL in reference_sync | SHOULD | COULD | 2 | M | CNEL Open Data: esito sonda già positivo |
| P-03 | API per terzi + webhook | SHOULD | COULD | 3 | L | dopo P-01 |
| P-05 | Ruoli su misura | SHOULD | COULD | 1 | L | cache RBAC + ADR-0035 |
| P-08 | Onboarding/offboarding | SHOULD | COULD | 1 | M | — |
| P-11 | Promemoria scadenze | SHOULD | COULD | 1 | S | — |
| P-02 | Copia dei tracciati presenze (riscritta) | SHOULD | COULD | 2 | M | dopo P-01 |
| P-27 | Triage delle latenti (criterio a 3 esiti) | SHOULD | — | 1 | M | dopo V11 |
| P-15 | AI dichiarabile (registro modelli) | COULD | SHOULD | 1 | S | prima: provenienza delle 468 righe |
| P-17 | Sentinelle in org-health | COULD | SHOULD | 1 | S | prima: bonifica dati org RTL |
| P-20 | Pagina mentorship | COULD | SHOULD | 1 | S(+M per ESS) | modulo /me/* nuovo |
| P-19 | Governance AI a 6 stati | COULD | SHOULD | 1 | M | — |
| P-12 | Misura resa mobile (est. Pixel 7) | COULD | COULD | 1 | <S | — |
| P-09 | 360° e feedback continuo | COULD | COULD | 0 | M | dopo P-06 |
| P-10 | Firma elettronica | COULD | COULD | 0 | M | media store S3; sonda WAIT-INPUT |
| P-23a | Broadcast admin | COULD | COULD | 0 | S | — |
| P-24 | Deleghe di mandato | COULD | COULD | 0 | S | sonda = query, eseguibile ora |
| P-29 | Esporre l'export (bottone) | COULD | COULD | 1 | S | — |
| P-25 | Prometheus (accensione) | COULD | — | 0 | XS | **WAIT-INPUT** fase 5 (Enzo) |
| P-18 | Assistente AI ESS | COULD | COULD | 1 | L | **WAIT-INPUT** gateway/credenziale + rimisura |
| P-28 | Listino pubblico (eretica) | — | COULD | 1 | S | **WAIT-INPUT** numeri (Enzo) |
| P-07 | Authoring survey | **GATED** (decisione m2b di Enzo) | GATED | 1 | M | — |
| P-26 | ATS mai (eretica) | **WON'T dichiarato** | — | — | 0 | rientro: soglia lead + P-03 |
| — | P-21 eliminata (già DONE in PROD) · P-22 scartata (nessun canvas; rientra con renderer cross-repo) | | | | | |

**Confronto fra i due traguardi**: i MUST non collidono — T1 chiede i due ingressi operativi (dati, campagna), T2 chiede una sola cosa (il PIP visibile) e per il resto vive di ciò che è GIÀ completo (blueprint, storia36, flight-risk, semantic search — che si è rivelata già accesa). La spina dorsale T2 è più corta di quanto la bozza credesse, ed è una buona notizia: metà della demo è già in produzione. La tensione vera è una sola: le SHOULD-T1 (SSO, API, ruoli, campagne) sono tutte sforzo L — il semestre non le contiene tutte, e l'ordine lo decideranno le sonde (quasi tutte eseguibili in giorni).
