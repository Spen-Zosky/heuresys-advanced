# WS-P1 — Product readiness & GA-gap
Agente: Product/Market (avversariale) | Modello: Sonnet 5 | Data: 2026-09-28
HEAD: `5faa2bc2ca78c40bec603e77df9da176c6971337`

## Sintesi

Da giugno (`ce26608`, S994) il prodotto è cresciuto sostanzialmente in ampiezza e in disciplina ingegneristica: 75→111 moduli API (+48%), 85→129 pagine web (+52%), 19→30 pagine ESS, 148→320 file di test API, 46→104 spec Playwright, 130→452 migrazioni. Tenant Builder è passato da idea a fascicolo reale approvato per RTL Bank (P1 8/8 chiuso), la governance del dato (`ADR-0040`, mandato K su ruoli/direzione-dato, sentinelle auto-correttive `check_marciume.py`/`check_exposure.py`) ha raggiunto un livello di rigore raro per un progetto single-developer, e il registro debiti tecnici è a **0 voci aperte**. Ma il gap strutturale di giugno è **identico oggi**: zero signup, zero pricing, zero checkout, zero provisioning self-service di un nuovo tenant — la "GA" resta tecnica, non commerciale. In più, la premessa fornita per questa rivalidazione ("MFA ora attiva in produzione dal 2026-09-09") **non regge**: il codice e il documento di stato più recente (aggiornato oggi stesso) dichiarano ancora `MFA_ENFORCEMENT_ENABLED` OFF in produzione per decisione di Enzo — rilevante perché il solo tenant reale è una banca. Applico il confine di confidence-cap richiesto: senza un esercizio live approfondito multi-ruolo eseguito in questa sessione, lo score non supera la banda Adeguato (max 74) e la confidence non è Alta.

## Claim del venditore rivalidati

| Claim | Esito | Evidenza |
|---|---|---|
| "v1.0.0 GA, tecnicamente completa e cresciuta molto da giugno" | **CONFERMATO** | `ls -d apps/api/src/modules/*/` = 111 (era 75); `find apps/web/src/app -name page.tsx` = 129 (era 85); `docs/kb/SOT_STATE.md:219` "atlante 111 moduli API / 657 rotte / 129 pagine web" (misurato 2026-09-25) |
| "MFA ora attiva in produzione dal 2026-09-09" (premessa del mandato) | **SMENTITO** | `apps/api/src/config/env.ts:254-257` default `true` ma commento esplicito "cio' che PROD fa oggi si misura sulla macchina"; `docs/kb/SOT_STATE.md:7` (blocco di sintesi riscritto con dati "misurati 2026-09-28", cioè oggi): **"MFA disponibile e in uso, enforcement OFF ... `MFA_ENFORCEMENT_ENABLED=false` nel .env di PROD per decisione di Enzo"**. `.env.example:129-137` conferma il kill-switch è per dev/test, ma lo stato dichiarato di PROD nel documento più fresco resta OFF. Nessuna voce successiva a S1029 (2026-07-25) documenta una riattivazione |
| "Nessun percorso di acquisizione cliente self-service" (finding P1-001 di giugno) | **CONFERMATO, invariato** | `grep -rniE "stripe\|billing\|subscription.*plan\|pricing\|checkout" apps/api/src apps/web/src` → solo `showcase/landing-page` e `showcase/typography` (copy statico, non funzionale); nessun modulo `signup`/`onboarding`/`provisioning` self-service; `tenant-blueprints` (15 rotte) è strumento interno `PLATFORM_ADMIN`-only, non un funnel cliente |
| "Deliverable go-to-market shippati dopo giugno (#4 S1002/S1003)" | **CONFERMATO (ma sono lead-gen, non conversione)** | `apps/web/src/app/demo/page.tsx`, `apps/web/src/app/investors/page.tsx`, modulo `apps/api/src/modules/leads/{routes,service,repository}.ts` (`POST /v1/leads`) — landing pubblica + cattura lead GDPR + demo guidata + one-pager investitori. Nessuno di questi crea un tenant o un abbonamento |
| "Tenant Builder — solo progettato a giugno" | **SUPERATO IN MEGLIO** | `docs/kb/SOT_STATE.md`: `#131` Tenant Builder P1 CHIUSO 8/8 (S1051), fascicolo reale `RTL-BANK-CONFIG` v1 APPROVED con fotografia firmata via login reale (23/23 processi, 7/7 decisioni, 0 differenze); P3 progettata 2026-08-16 (memoria progetto). Codice: `apps/api/src/modules/tenant-blueprints/*`, pagine `apps/web/src/app/(authenticated)/tenant-blueprints/**`, `/tenants/**` |
| "a11y: tail R10 ancora aperto" (giugno) | **PARZIALMENTE SUPERATO** | `apps/web/tests/e2e/a11y.spec.ts` + `showcase-a11y.spec.ts` invariati; ma `docs/kb/SOT_STATE.md` registra chiusura post-giugno di residui a11y (`@heuresys/ui@0.1.9`, `/dashboard` axe 0 violazioni con login reale) e D-27 mobile a11y RISOLTO strutturalmente in `@heuresys/ui` (DataTable scroll-region) |
| "Nessun mock/fixture nel frontend (invariante di progetto)" | **CONFERMATO** | `grep -rniE "mockData|fixtureData|hardcoded|fake.*response" apps/web/src` fuori da test/showcase → solo commenti che documentano la *rimozione* di mock passati (`SystemHealthLive.tsx:6` "Replaces the former hardcoded-mock wiring"); nessun dato finto vivo trovato |
| "Single-industry banking-native mascherato da piattaforma" (P1-005 di giugno) | **CONFERMATO, rinforzato** | Tenant Builder deriva blueprint da ATECO risalendo l'albero fino a `FIN_BANKING`→`64` (non `L`, cioè non generalizza oltre il nodo mappato) — la costruzione stessa del Tenant Builder è stata validata e collaudata solo sul caso banking (RTL Bank), nessun secondo tenant industry-diverso onboardato |
| "Registro debiti tecnici" | **MIGLIORATO rispetto a giugno** | `docs/kb/DEBT_REGISTER.md`: tutte le voci ispezionate (D-27, D-51, D-52, D-59, D-61...) risultano `✅ RISOLTO`; SOT dichiara "registro debiti a 0 aperti" da S1015 in poi, con nuove voci aperte e richiuse nel frattempo (ciclo sano, non accumulo) |

## Finding

**P1-001 · GA è tecnica, non commerciale: nessun percorso di acquisizione cliente self-service · High · functional-debt**
Evidenza: `grep -rniE "stripe|billing|subscription.*plan|pricing|checkout" apps/api/src apps/web/src` → 0 match funzionali; nessuna pagina `signup/register/onboard/pricing/plan`; il modulo `tenant-blueprints` (`apps/api/src/modules/tenant-blueprints/routes.ts`) è uno strumento interno per PLATFORM_ADMIN, non un funnel self-service. Il modulo `leads` (S1002) cattura solo contatti, non crea tenant.
Impatto: identico a giugno — il prodotto non converte un visitatore in cliente pagante senza intervento manuale del founder. Tre mesi di sviluppo hanno ampliato il prodotto ma non hanno toccato questo gap strutturale, nonostante deliverable GTM (lead-gen, investor page, demo) siano stati shippati nel frattempo: sono marketing, non transazione.
GA-blocker: **sì** (per GA commerciale).
Remediation: provisioning self-service + billing + tenant lifecycle. Effort **XL**.
Confidence: Alta.

**P1-002 · Crescita funzionale genuina e misurata (+48% moduli, +52% pagine, raddoppio dei test) · High · strength**
Evidenza: 111 moduli API (era 75), 129 pagine web (era 85), 30 pagine `/me/*` (era 19), 320 file di test API (era 148), 104 spec Playwright (era 46), 452 migrazioni (era 130). Tenant Builder passato da assente a fascicolo reale approvato per un cliente-modello.
Impatto: l'asset codice continua a crescere a un ritmo sostenuto con disciplina di test che tiene il passo (il rapporto test/moduli è stabile, non degradato). Per un acquirente, tre mesi aggiuntivi di profondità funzionale HRMS reale.
GA-blocker: no (è un plus).
Remediation: n/a — preservare. Confidence: Media (ampiezza da conteggio + SOT, non esercitata feature-by-feature da questo fork).

**P1-003 · La premessa "MFA attiva in produzione" fornita al mandato è falsa: enforcement resta OFF · Medium · risk**
Evidenza: `apps/api/src/config/env.ts:240-257` — default `true` nel codice, ma commento esplicito che lo stato reale si misura sulla macchina, non nel default; `docs/kb/SOT_STATE.md:7`, blocco di sintesi con numeri "misurati 2026-09-28" (oggi), dichiara testualmente `MFA_ENFORCEMENT_ENABLED=false` nel `.env` di PROD per decisione di Enzo, con 25 fattori registrati ma enforcement sospeso. Nessuna sessione successiva a S1029 (2026-07-25) documenta una riattivazione.
Impatto: per un investitore che valuta la vendibilità a clienti regolamentati — l'unico tenant reale oggi è una banca (RTL Bank) — un secondo fattore opzionale (non imposto) è una lacuna di postura di sicurezza rilevante in un settore dove il 2FA obbligatorio è spesso un requisito contrattuale o di compliance. La capacità tecnica c'è (TOTP+WebAuthn, policy per-tenant, UI di enrollment) — manca solo la decisione di attivarla, quindi il costo di chiusura è basso ma il gap oggi è reale e non un dettaglio tecnico dimenticato: è una scelta esplicita di Enzo, ripetuta da giugno a oggi.
GA-blocker: no per GA tecnica; **sì** per la vendita a clienti enterprise/regolamentati che la richiedono contrattualmente.
Remediation: attivare `MFA_ENFORCEMENT_ENABLED=true` in PROD (o policy per-tenant granulare) — decisione di business, non di ingegneria. Effort **S**.
Confidence: Alta (dato letto da codice + documento di stato aggiornato oggi; non ho eseguito una prova di login live in questo fork per confermare il comportamento runtime effettivo).

**P1-004 · Documentazione tuttora soggetta a drift, ma ora auto-rilevato invece che scoperto da un audit esterno · Medium · risk (migliorato da giugno)**
Evidenza: `docs/kb/SOT_BACKLOG.md` mostra scoperte di drift correnti e continue (es. `#262`, scoperto 2026-09-28, oggi: tre tabelle popolate mai esposte da un'API, una non raggiunta dal self-portal) trovate da strumenti automatici propri del progetto (`check_marciume.py`, `check_exposure.py`, `handoff_lint.py`), non da un revisore esterno come in giugno.
Impatto: il drift documentale non è sparito (è strutturale in un progetto che cambia così velocemente), ma il progetto si è dotato di sentinelle che lo trovano da solo entro la stessa sessione in cui nasce — riduce il rischio per un investitore di basarsi su una SoT bugiarda, a patto di rivalidare comunque (come qui) invece di fidarsi ciecamente della prosa.
GA-blocker: no.
Remediation: continuare il pattern esistente (già in atto). Effort **S** (manutenzione continua).
Confidence: Alta.

**P1-005 · UX maturity non esercitata live in questa rivalidazione — confidence-cap applicato · Medium · risk**
Evidenza: questo fork non ha eseguito un login reale multi-ruolo né navigato le 129 pagine; l'evidenza di maturità resta indiretta (conteggio test, commenti nel codice, SOT). Nessun accesso a credenziali di persona in questo turno.
Impatto: la qualità percepita da un HR-admin reale — la metrica che vende un HRMS — resta non misurata indipendentemente in questa sessione, esattamente come a giugno.
GA-blocker: no.
Remediation: QA E2E multi-ruolo dal vivo (skill `web-qa-audit`) prima di alzare lo score sopra la banda Adeguato. Effort **M**.
Confidence: Bassa (per costruzione: non esercitato).

**P1-006 · Single-industry banking-native, ora rinforzato dal Tenant Builder stesso · Medium · functional-debt**
Evidenza: la derivazione blueprint del Tenant Builder risale l'albero ATECO fino al primo nodo mappato (`FIN_BANKING`→`64`), collaudata e validata solo sul caso RTL Bank; nessun secondo tenant di industry diversa onboardato per collaudare la generalità dichiarata.
Impatto: il TAM servibile *oggi*, senza ulteriore lavoro di generalizzazione tassonomica, resta "banking/financial services", non "HRMS generico" — vincola il pricing e il GTM (vedi P2). Il fatto che lo strumento di provisioning più maturo del prodotto (Tenant Builder) sia stato validato solo su questo caso rinforza, non attenua, il vincolo rispetto a giugno.
GA-blocker: no (ma vincola il business model).
Remediation: onboardare e collaudare un secondo tenant di industry diversa. Effort **L**.
Confidence: Alta.

## Score del pilastro

Score: 63 / 100 (Adeguato) | Confidence: Media

Motivazione: rispetto a giugno (58/100) il prodotto è cresciuto in modo misurabile e sostanziale — moduli, pagine, test, e soprattutto la maturità del Tenant Builder (da idea a fascicolo cliente reale approvato) e della disciplina di governance del dato (debiti tecnici a zero, sentinelle auto-correttive) meritano un incremento di score (P1-002, P1-004). Ma il gap che pesava di più a giugno — GA tecnica senza percorso commerciale self-service (P1-001) — è **identico oggi**, tre mesi e centinaia di commit dopo, nonostante deliverable di marketing (lead capture, demo, investor page) siano stati aggiunti nel frattempo: continuano a essere strumenti di lead-gen, non di conversione. A questo si aggiunge una scoperta di rivalidazione non banale: la premessa che l'MFA fosse ora "attiva in produzione" è falsa (P1-003) — rilevante perché il solo tenant reale è una banca, e un secondo fattore opzionale è un gap di postura commerciale per quel segmento. Il vincolo single-industry (P1-006) non solo persiste ma è stato rinforzato dallo strumento stesso che avrebbe dovuto generalizzarlo. Applico il confine di confidence-cap richiesto dal mandato: senza un esercizio live approfondito multi-ruolo in questa sessione, lo score non supera la banda Adeguato (max 74) e la confidence resta Media, non Alta — il miglioramento è misurato da codice/documenti, non da un uso diretto del prodotto.
