# Forense frontend 15/11/2026 — Dati 3 (pagine di prodotto, admin, piattaforma, pubbliche)

Metodo: API di produzione letta come le persone indicate (solo GET; uno script equivalente a `chiama-come` con un solo accesso per persona, perché ogni chiamata di `chiama-come` rifà il login e dopo poche chiamate l'accesso risponde 429), numeri rifatti con `sql-sola-lettura.mts`, codice delle pagine letto. Le prove grezze stanno nello scratchpad della sessione, non versionate. Non è stato modificato niente.

## 1. Copertura pagina x dato

Esiti: OK = vero e coerente; RILIEVO = vedi sezione 2; NV = non verificato (motivo nella riga).

| pagina | dato | valore API | valore DB | esito |
|---|---|---|---|---|
| positions | totale / attive / non attive | 316 / 162 / 154 | 316 / 162 / 154 | OK |
| positions | vacanti fra le attive | 4 (158 coperte) | 4 attive senza assegnazione ACTIVE, 158 con | OK |
| users | persone / utenze di servizio | 158 / 9 (totale 167) | 158 STANDARD, 9 SERVICE | OK (le 9: D3-12) |
| users (piattaforma) | totale | 176 | 158+3 persone, 9+6 servizio | OK |
| organization | unità | 42 (38 attive, 4 no) | 42 (38/4) | OK; D3-14 |
| org-director/health | unità, organico | 37 unità, somma organico 158 | 158 persone | OK (manca Direzione Generale) |
| org-director/vrio | persone | 167 | 158 persone | RILIEVO D3-09 |
| org-director | maturità | 20 unità, etichette inglesi | n.d. | RILIEVO D3-08 |
| org-director/advisor | 89 suggerimenti (77+12) | 12 «in coda» = 12 LAGGING di health | coerente | RILIEVO D3-07 |
| approvals | richieste | 741 (578 applicate, 138 approvate, 25 respinte, 0 in attesa) | identico | OK; D3-01, D3-02 |
| time-off | richieste | 2325 (2315 approvate, 10 in attesa) | identico | OK; D3-03 |
| time-off | regole / movimenti | 5 / 20 | 5 / 20 | OK; D3-04 |
| job-catalog | ruoli / famiglie | 142 / 16 | catalogo globale 176, 142 visibili | OK; D3-10 |
| learning | moduli | 122 = 77 piattaforma + 45 azienda | 77 / 45 | OK; D3-11 |
| learning/training-initiatives | iniziative | 62 | 62 (61 COMPLETED, 1 IN_PROGRESS, 0 pianificate) | RILIEVO D3-05 |
| engagement | sondaggi / risposte / inviti | 14; Risposte 800 su 158 inviti | 800 righe = 100 persone x 8 domande | RILIEVO D3-06 |
| engagement | rilevazioni rapide | 2833, 52 settimane | 2834 righe, 2024-2026 | RILIEVO D3-06b |
| content | documenti | 152 (138 archiviati, 10 pubblicati, 4 bozze) | identico | RILIEVO D3-13 |
| projects | progetti | 25, tutti Attivo, nessuna data/avanzamento | 25 squadre migrate | RILIEVO D3-15 |
| processes | processi | 53 = 30 + 23 di due modelli | catalogo globale | RILIEVO D3-16 |
| blueprints | varianti / famiglie / attivazioni | 3 / 3 / 1 | n.d. | RILIEVO D3-17 |
| recruiting | richieste aperte / annunci / candidature | 4 / 4 / 122 | 24 richieste (20 coperte), 24 annunci, 122 | OK |
| recruiting | candidati / colloqui / offerte | 112 / 171 / 24 | 20 HIRED = 20 offerte ACCEPTED = 20 coperte; 19 candidati HIRED | OK; D3-18 |
| skills | competenze | 14.032 | n.d. | OK sul totale; D3-19 |
| skill-taxonomy | famiglie / categorie / alias / archi | 77 / 7 / 80 / 18.438 | famiglie 77 | OK |
| whistleblowing-console | segnalazioni | 2 | n.d. | OK, etichette presenti |
| admin/mfa-policy | politiche / esenzioni | 1 / 9 tutte disattivate | n.d. | RILIEVO D3-12 |
| admin/roles | ruoli x permessi | 24 ruoli, 250 permessi | n.d. | RILIEVO D3-20 |
| tenants | tenant | 2 | 2 | RILIEVO D3-21 |
| tenants/enterprise-typing | organico | 158, fascia M, normativa Alta | 158 persone | OK |
| tenant-blueprints | configurazioni | 1 (ACTIVE) | n.d. | NV dettaglio (accesso 429) |
| provenance | record / tabelle | 70.959 / 36, tutte con etichetta italiana | n.d. | OK |
| generated-origins | origini | 0 | n.d. | OK (vuota) |
| seed-acquisition/runs | corse | lette in parte | n.d. | NV |
| leads | richieste di contatto | 7 | n.d. | OK; D3-22 |
| mandate-acts | atti | lista vuota | n.d. | OK |
| consolidation | consolidamenti | 403 «Tenant context required» (piattaforma e paolo.barbieri) | n.d. | NV |
| system-health, dev/agent | nessuna chiamata /v1 nel codice | n.d. | n.d. | NV |
| dettagli: positions/[id] (+kpis, learning, skills), users/[userId], approvals/[id], projects/[id], content/[id], engagement/[id], blueprints/[variantId], tenants/[id], tenant-blueprints sottopagine, recruiting/applications/[id] | dettaglio | n.d. | n.d. | NV: accesso in 429 da molti minuti (altri thread); di users/[userId] letto il codice (D3-23) |
| login, privacy, whistleblowing, radice | testi statici | n.d. | n.d. | NV (non aperte) |

## 2. Rilievi

**D3-01 — Approvazioni: titoli con «8.00 giorni»** (media). Pagine approvals e approvals/[id], paolo.barbieri. Si vede «Richiesta di ferie — 8.00 giorni dal 20/08/2026»; deve essere «8 giorni». Prova: query su `sys_approval_requests`, titoli con `.00 giorn` = 566 su 566 richieste di assenza. Causa: testo scritto nel dato dalla storia36 (`metadata.storia36 = C7`), il frontend lo stampa così com'è. Correzione: rigenerare i titoli alla fonte, con rollback dichiarato.

**D3-02 — Approvazioni: nessuna richiesta in attesa e nessun richiedente** (media). 741 richieste, 0 PENDING; la lista non dice chi ha chiesto. Correzione: colonna «Richiedente» (Cognome, Nome).

**D3-03 — Assenze: 10 richieste «In attesa» ferme da mesi, senza approvazione** (media). time-off, inizio dal 04/12/2025 al 30/05/2026, tutte passate. Prova: `select r.request_start_date, a.approval_request_status from sys_time_off_requests r left join sys_approval_requests a on a.approval_request_resource_id=r.request_id where r.request_status='PENDING'` → 10 righe, approvazione NULL. Incoerenza con approvals (0 in attesa). Correzione: dato; portarle a stato finale con il sì di Enzo.

**D3-04 — Assenze: codice «leave_request» e numeri col punto** (media). Scheda Movimenti: colonna Riferimento stampa `leave_request` in tutte le 20 righe (le chiavi tradotte sono TIME_OFF_REQUEST, SYSTEM, MANUAL, ACCRUAL). Giorni «0.9», «1.67» col punto. Causa: `apps/web/src/app/(authenticated)/time-off/page.tsx` righe 50, 59, 61. Correzione: aggiungere la chiave `leave_request` e usare `f.numero`. La regola «Maturazione permessi parentali» ha tipo OTHER («Altro»).

**D3-05 — Iniziative formative: «62 pianificate» è falso** (alta). Prova: `select training_initiative_status,count(*) from sys_training_initiatives group by 1` → COMPLETED 61, IN_PROGRESS 1, pianificate 0. Causa: stringa `training.count` in `apps/web/src/locales/it/hr.json`. Correzione: «62 iniziative». I nomi di coorte sono lunghi e ripetono il titolo del corso.

**D3-06 — Sondaggi: «Risposte» conta righe, non persone** (alta). engagement: «Rilevazione di clima 2026-H2» mostra Risposte 800, Inviti 158. Prova: 800 righe in `sys_survey_responses`, 100 persone distinte (8 domande). Causa: `apps/api/src/modules/engagement/repository.ts:28`. Correzione: `count(distinct survey_response_subject_user_id)`, colonna «Partecipanti». Titoli inglesi o di prova: «Q4 2024 Employee Engagement Survey», «Digital Transformation Feedback», «QA Survey»; «2026-H2» cade a giugno e «2026-H1» a marzo.
**D3-06b** (media): il grafico delle rilevazioni rapide raggruppa per numero di settimana su tre anni (la Sett. 4 mescola 22/01/2025 e 25/01/2026), senza anno. Causa: `repository.ts:141-149`. Il totale 2833 contro 2834 righe è probabilmente la soglia di anonimato (NV).

**D3-07 — Consulente: «la dimensione … è performance»** (media). org-director/advisor: in tutte le 12 righe «unità in coda» compare il codice inglese `performance` e il numero col punto («36.5»). Causa: `headlineParams.dimension` non tradotto, `advisor/page.tsx:55`; la chiave `orgHealth.dims.*` esiste. Le unità «in coda» hanno stato Solido o Sano (indice 71-76). Etichette di capacità in minuscolo («… tic»).

**D3-08 — Direttore organizzativo: «L5 · Optimizing»** (media). Colonna Maturità: `org-director/page.tsx:62` stampa livello ed etichetta inglese dell'API (Initial, Repeatable, Defined, Managed, Optimizing). Correzione: tradurre per livello sul web.

**D3-09 — VRIO: «167 persone»** (media). Le persone sono 158; 167 include le 9 utenze di servizio. Inoltre 77 gruppi su 95 sono «Lacuna» (nessuno li possiede), compresi «servizi militari e della difesa»: poco plausibile per una banca.

**D3-10 — Catalogo ruoli: duplicati indistinguibili, minuscoli, forme m/f** (media). Fra i 142 ruoli: «Manager» ×12, «Senior manager» ×12, «Direttore» ×6 (livello Junior), «Vice direttore» ×6, senza famiglia; 35 nomi in minuscolo; 8 nel formato «addetto allo sportello bancario/addetta allo sportello bancario»; 73 senza famiglia (51%). Il codice non è in prima colonna, quindi le righe non si distinguono. Prova: dump `/v1/job-roles` e `select lower(job_role_name),count(*) from sys_job_roles group by 1 having count(*)>1`. Correzione: dato (bonifica con rollback).

**D3-11 — Catalogo formativo: 16 titoli doppi** (media). «Antiriciclaggio AML», «Analisi avanzata dei dati»… esistono come CRS-heuresys-N e CRS-rtl-bank-N, entrambi «di piattaforma»: 32 righe per 16 titoli. 51 moduli senza durata («—»).

**D3-12 — Utenze di collaudo e motivi tecnici a vista** (media). users, filtro Utenze di servizio: 9 utenze «Collaudo DPO», «Collaudo Persona»… con email `@collaudo.invalid` nel tenant RTL Bank. admin/mfa-policy: 9 esenzioni tutte «Disattivata», scadute a settembre-ottobre, motivo «collaudo-access (#169 F2, direttiva Enzo 2026-08-25): …». Causa: `admin/mfa-policy/page.tsx:215-221` stampa email e motivo. Correzione: nascondere esenzioni scadute o disattivate.

**D3-13 — Contenuti: 142 documenti su 152 sono residui di prova** (alta). 140 «[me-media-it] ESS media doc» e 2 «[media-it] media host»; 138 archiviati, 4 bozze; i documenti veri sono 10 pubblicati. Il numero in testa dice 152. Correzione: dato (ritirare i residui, ADR-0035) e filtro predefinito sui non archiviati.

**D3-14 — Organizzazione: «42 unità» include 4 non attive** (bassa). Non attive: Direzione Corporate Banking, Divisione Rischi e Compliance, Area Brescia-Bergamo, Area Milano e Provincia.

**D3-15 — Progetti: sono le squadre migrate** (media). 25 «progetti» tutti «Attivo», senza scopo, date o avanzamento (`origine: mig000363`); nomi «Squadra CFO», «Squadra Human Resources», «Squadra IT & Digital», «Squadra Legal & Compliance», «Squadra RTL Bank S.p.A.»; due portano il nome di unità non attive; «Divisione Rischi e Compliance» (36 membri) è agganciata alla radice. Correzione: rinominare in italiano o chiamare la pagina «Squadre».

**D3-16 — Processi: due modelli mescolati** (alta). processes mostra 53 righe: 30 del modello datastore (P01…P30, 14/11/2026) e 23 della «Banca retail regionale (media)», l'unico attivato per RTL; i numeri d'ordine ricominciano da 0; contenuti sovrapposti («Gestione del rischio operativo e antiriciclaggio (AML)» e «Adeguata verifica e antiriciclaggio»). Prova: `/v1/blueprint-processes` per `variantId`, `/v1/blueprint-activations` → variante b6e81585. Causa: `processes/page.tsx` chiama l'elenco senza variante. Correzione: filtrare sulla variante attivata.

**D3-17 — Modelli: nome di variante lungo come un paragrafo, termini interni, inglese** (media). La variante `p20261010010521tjb` ha come nome una frase di oltre 200 caratteri; famiglia «Pacchetto del datastore» senza settore; la famiglia «Servizi finanziari — Banche» ha descrizione «Retail and commercial banking blueprint family.». Dato.

**D3-18 — Recruiting** (bassa). Etichette tutte tradotte e totali coerenti. Una persona (Martini, Zelda) risulta assunta con due candidature; 30 candidati interni ACTIVE hanno `hiredUserId` valorizzato (campo usato come collegamento).

**D3-19 — Competenze** (bassa). Nessun difetto di dato; il codice ESCO sta in colonna secondaria.

**D3-20 — Ruoli e permessi: 36 permessi su 250 con testo grezzo** (media). admin/roles: «area · azione» ricade sul codice: 9 aree (career, certification, consent, document, insight, job-requisition, me, performance-review, review-cycle) e 14 azioni (read:self, export:self, content:read…) senza etichetta, ad esempio «job-requisition · read». I 24 ruoli sono tutti tradotti. Causa: `locales/it/admin.json` `roles.resources/actions`; le chiavi con `:` non si risolvono in i18next. Correzione: aggiungere le chiavi e usare un separatore diverso.

**D3-21 — Tenant: codici a vista** (alta). tenants (piattaforma): Dimensione «M»/«S» (esiste `enums.sizeBand`, non usato) e Paese «IT»; tenants/[tenantId]: Settore «FIN_BANKING» / «MGMT_CONSULTING». Causa: `tenants/page.tsx` colonne size/country, `tenants/[tenantId]/page.tsx:124-126`. Correzione: etichette `sizeBand`, nome del settore dal catalogo `industry-codes`, paese con `Intl.DisplayNames`.

**D3-22 — Richieste di contatto** (bassa). 7 richieste; la più recente (08/11/2026, «DAvid», decentgears.com) è posta promozionale indesiderata, stato «Nuova».

**D3-23 — Scheda persona, da codice** (alta, NV dal vivo). `users/[userId]/page.tsx`: il Percorso stampa `x.positionId` (UUID) al posto del nome della posizione (riga 280); Valutazioni stampa `type`, `overallRating`, `performanceBox` grezzi (251-253); Competenze `declaredProficiency` e `source` grezzi (296-297); Presenze giorni nudi (341-344). Non confermato sul dato perché l'accesso è in 429.

Senza rilievo: etichette di stato di positions, users, organization, time-off, recruiting, whistleblowing, provenance (36 tabelle con nome italiano), tenant-blueprints. Il dominio `industryFamily` manca in `common.json` (ricade sul codice in parole; NV su dati).

## 3. Per il thread organigrammi

- org-health: 37 unità, organico 158 coerente con persone; la Direzione Generale (attiva) non compare.
- Unità non attive (Corporate Banking, Rischi e Compliance, due Aree) con `effectiveTo` 2026-11-11; la squadra «Divisione Rischi e Compliance» (36 membri) è agganciata alla radice RTL Bank S.p.A.: se l'organigramma nasconde le non attive, i conti per unità devono tornare a 158.
- Nomi e identificativi delle unità in `/v1/organization-units` e `/v1/org-health` coincidono.

## Riassunto

1. Rotte nel perimetro: circa 60; con dati vivi verificati 30, solo da codice 6, non verificate circa 25 (accesso in 429).
2. Tutti i totali confrontati con il DB tornano: 316/162/154 posizioni, 158 persone, 741 approvazioni, 2325 assenze, 62 iniziative, 122 moduli, 152 documenti, 25 progetti, recruiting.
3. Rilievi: 23 più D3-06b; alta 6, media 14, bassa 4.
4. Più gravi: D3-05 «62 pianificate» falso; D3-06 Risposte 800 su 158 inviti; D3-13 142 documenti su 152 sono di prova; D3-16 Processi con due modelli mescolati; D3-21 codici M/IT/FIN_BANKING nei tenant.
5. Poi D3-23 (UUID nella scheda persona), D3-07 e D3-08 (inglese nel direttore organizzativo), D3-12 (collaudo e ticket a vista).
6. Da rifare quando il limite d'accesso si libera: pagine di dettaglio, consolidation, tenant-blueprints sottopagine.
