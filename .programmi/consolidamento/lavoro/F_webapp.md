# F — Censimento delle webapp e proposta per ogni gruppo di pagine

Misurato il 2026-10-23 in sola lettura su `heuresys-advanced` (clone `main`) e `heuresys-datastore` (clone `main`, commit `c263bda`), più il ramo `interfaccia-unica` letto da GitHub senza checkout. Strumenti riproducibili: `strumenti/estrai_rotte.py` (rotte, scrive `E_api.tsv`) e `strumenti/estrai_pagine.py` (pagine, scrive `strumenti/pagine.json`). Tabella completa delle pagine di advanced: sezione 2. Nessun server avviato, nessun database interrogato: ciò che dipende dal DB vivo (menu attivo, ruoli titolari dei permessi) è ricostruito dalle migrazioni e lo dico dove conta.

## 0. Rilievi in cima

1. **Il ramo `interfaccia-unica` non è nel clone locale** (`git branch -a` mostra solo `main` e `origin/main`; `git ls-remote origin` lo mostra: `2f3c368`, più `prova-ui-1.2.0` `8db1fbb`). Esiste su GitHub e contiene `apps/console` (Next.js, porta 3107 secondo `esecuzione/onda1/G2_LE_SCELTE.md`), non unito a `main`. L'ho letto via API GitHub (solo `menu.ts` e l'elenco delle cartelle); le pagine `cataloghi/cerca/archivio/contratti/modellazione` della console riusano quelle di `apps/web` del datastore (import relativo `../../../web/src/app/lingua`), le nuove sono `catene/{passi,cataloghi}`, `traccia-datastore/{prototipi-e-corse,confronta-corse,corsa}`, `dati/*`, `in-costruzione/[voce]`.
2. **La misura "pagina per pagina" della voce 17 di ADR-0043 dà un esito diverso dall'elenco dell'ADR**: delle dieci aree, solo `skill-taxonomy/`, `seed-acquisition/` e (con riserve) `leads/` sono davvero di piattaforma. `blueprints/`, `tenant-blueprints/`, `generated-origins/` e `provenance/` sono gesti o audit del tenant e ADR-0043 stesso li tiene in advanced (righe "restano" della sezione "Che cosa resta in advanced"). `job-catalog/` è da ridisegnare (perimetro + voci proprie), non da spostare. Dettaglio in sezione 4.
3. **Il datastore legge direttamente il database di advanced** (sezione 6 di questo file e punto 3 della consegna): `apps/api/src/servizio_rtl.ts`, `rtl_lettura.ts`, `src/config/config.ts` (`PRODUZIONE_SOLA_LETTURA`, porta 5433). Il contrario (advanced che legge il database o le rotte del datastore a runtime) non esiste: nessuna occorrenza in `apps/`, `packages/`, `db/scripts/`, `scripts/`.
4. **Dati statici in advanced**: `/investors` ha `STATIC_FACTS` con sei conteggi scritti nel codice (moduli 106, endpoint 615, migrazioni 384, test API 1871, e2e 239, pagine 122) in una pagina pubblica; contraddice la regola "i conteggi si misurano, non si scrivono". Il commento nel file riporta i comandi che li producono, ma il valore è fisso. `/demo` usa dieci schermate PNG statiche (`/demo/01-landing.png` …). Il sito `apps/showcase` e `/showcase/*` hanno dati dimostrativi per disegno (array di righe con sparkline scritte a mano in `SystemHealthDashboard.tsx`).
5. **Tre sotto-pagine di `/positions/[positionId]` non hanno alcun collegamento** (`/skills`, `/kpis`, `/learning`): esistono, chiamano rotte vere, ma nessun link né voce di menu le raggiunge. Altre orfane: `/app` (redirect a `/login`) e `/dev/agent` (dietro `NEXT_PUBLIC_ENABLE_AGENT_DEV`, per disegno).
6. **Nessuna pagina chiama una rotta inesistente** (due segnalazioni dello strumento sono falsi positivi: `/v1/content/${id}/${action}` e un `${status}` non chiuso in `leads`). **300 rotte su 667 di advanced non hanno consumatori nel frontend** (sezione 5).

## 1. Le webapp

| webapp | tecnologia | pagine | attore | stato |
|---|---|---|---|---|
| advanced `apps/web` | Next.js 16, app router, `@heuresys/ui`, dati da `/v1/*` via `apiFetch` | 129 `page.tsx` (18 sotto `/showcase`) | tutti i ruoli del tenant; menu DB-driven (`sys.sys_ui_interfaces`); ESS sotto `/me/*`; pubbliche `/`, `/login`, `/jobs`, `/whistleblowing`, `/privacy`, `/investors`, `/demo` | produzione |
| advanced `apps/showcase` | export statico dei `/showcase` di `apps/web` | 1 pagina + componenti | brand review | vetrina, dati finti per disegno |
| advanced `apps/agent-gateway` | server HTTP nativo, non Fastify; 4 rotte (`/healthz`, `/agent/approve`, `/research/propose`, `/agent`) | nessuna (la UI è `/dev/agent`) | sviluppatore | dietro flag |
| datastore `apps/web` (porta 3102) | Next.js, server component che chiamano la 3101 con `chiedi()` (`servizio.ts`), client con `/api/v1/*` | 9 pagine | l'Amministratore di Sistema (identità unica, nessun RBAC) | in uso |
| datastore `apps/banco` (servito dalla 3103/3104 da `banco_interfaccia.ts`) | SPA statica (`index.html`, `app.js`, moduli `.mjs`), niente framework | 1 pagina a schede | stesso attore | in uso; scheda "Traccia advanced" è un segnaposto dichiarato ("da costruire", `public/app.js` riga 61) |
| datastore `apps/console` (ramo `interfaccia-unica`) | Next.js 3107, menu in 5 gruppi | 16 voci di menu: 12 `pronta`, 4 `in-costruzione` (`quadro`, `nuovo-prototipo`, `tenant-advanced`, `vuoti-advanced`) | stesso attore | **non unita a `main`** |

## 2. Censimento delle pagine di advanced

Legenda. *Attore*: voce di menu ricostruita dalle migrazioni (`perspective; risorsa:azione; admin` = `requires_admin`), più i permessi richiesti dalle rotte GET chiamate; per `/me/*` l'attore è la persona stessa (I17). *Segni*: euristiche lessicali (array di oggetti letterali, `mock/fixture`, `TODO`, "coming soon", pulsanti senza handler), già depurate dei falsi positivi che ho verificato a mano (`/me/analytics`, `/me/approvals`, `/performance`: array di chiavi con valori che arrivano da `/v1`; `/tenant-blueprints/.../build`: etichette di righe; pulsanti dentro `<a href>`). Il "segno" che resta è dunque reale: solo `/investors`. *Raggiungibilità*: `menu` = voce attiva nelle migrazioni; `via link` = un altro file contiene la rotta come letterale o template; `ORFANA` = nessuno dei due. Il menu è un registro DB: lo stato vivo può differire (voci tolte o rese inattive a mano).

| percorso | attore probabile (menu/permesso) | rotte /v1 chiamate | segni di dato statico o incompleto | raggiungibilità |
|---|---|---|---|---|
| `/` | pubblica |  | - | radice |
| `/admin/mfa-policy` | menu (OVERVIEW; mfa_policy:read; admin); rotte: mfa_policy:read, tenant:read | mfa-policy, mfa-policy/:p, tenants | - | menu |
| `/admin/roles` | menu (GOVERNANCE; role:read; admin); rotte: role_matrix:read | auth/role-permissions | - | menu |
| `/analytics/attendance` | menu (WORKFORCE; analytics:view; admin); rotte: analytics:view | analytics/attendance | - | menu |
| `/analytics/compensation` | menu (WORKFORCE; analytics:view; admin); rotte: analytics:view | analytics/compensation | - | menu |
| `/analytics/kpi` | menu (WORKFORCE; analytics:view; admin); rotte: analytics:view | analytics/kpi | - | menu |
| `/analytics/org-network` | INATTIVA (WORKFORCE; analytics:view; admin); rotte: analytics:view | analytics/org-network | - | via link |
| `/analytics/overtime` | INATTIVA (WORKFORCE; analytics:view; admin); rotte: analytics:view | analytics/overtime | - | via link |
| `/analytics/skills` | menu (WORKFORCE; analytics:view; admin); rotte: analytics:view | analytics/skills | - | menu |
| `/analytics/skills-by-category` | INATTIVA (WORKFORCE; analytics:view; admin); rotte: analytics:view | analytics/skills-by-category | - | via link |
| `/analytics/skills-graph` | ereditato dal genitore; permessi rotte: skill:read | skills, skills/graph | - | via link |
| `/analytics/skills-group-share` | INATTIVA (WORKFORCE; analytics:view; admin); rotte: analytics:view | analytics/skills-group-share | - | via link |
| `/analytics/workforce` | menu (WORKFORCE; analytics:view; admin); rotte: analytics:view | analytics/workforce | - | menu |
| `/app` | pubblica |  | - | ORFANA (nessun riferimento) |
| `/approvals` | menu (OVERVIEW; approval:read; admin); rotte: user:read | approvals, users | - | menu |
| `/approvals/[id]` | ereditato dal genitore; permessi rotte: approval:read | approvals/:p, approvals/:p/apply, approvals/:p/steps/:p/decide | - | via link |
| `/blueprints` | menu (GOVERNANCE; blueprint:read; admin); rotte: blueprint:read, tenant:read | blueprint-activations, blueprint-families, blueprint-variants, tenants | - | menu |
| `/blueprints/[variantId]` | ereditato dal genitore; permessi rotte: blueprint:read | blueprint-activations, blueprint-processes, blueprint-variants/:p, content-blueprint-links/by-variant | - | via link |
| `/career-succession` | menu (WORKFORCE; career_succession:read; admin); rotte: career_succession:read | career-paths, succession-pools, successor-candidates, successor-candidates/readiness-distribution | - | menu |
| `/compensation-intelligence` | INATTIVA (WORKFORCE; compensation_intelligence:read; admin); rotte: compensation_intelligence:read | compensation/bands, compensation/bonus-pools, compensation/distribution, compensation/handoff-records, compensation/objective-reward-rules, compensation/position-economic-weight, compensation/recommendations (+3) | - | via link |
| `/content` | menu (INTELLIGENCE; content:read; admin); rotte: content:read | content, content/categories, content/categories/:p, content/search | - | menu |
| `/content/[id]` | ereditato dal genitore; permessi rotte: blueprint:read, content:read | blueprint-processes, content-blueprint-links, content-blueprint-links/:p, content-blueprint-links/by-document, content/:p, content/:p/:p, content/:p/versions (+2) | chiamata senza rotta: /v1/content/:p/:p | via link |
| `/dashboard` | menu (OVERVIEW; NULL:NULL; admin); rotte: dashboard:view | dashboard/widgets | - | menu |
| `/dashboard/[famiglia]` | menu (OVERVIEW; dashboard_company:view; admin) | dashboard/catalog, dashboard/catalog/${famiglia | - | menu |
| `/demo` | pubblica |  | - | via link |
| `/dev/agent` | ereditato dal genitore |  | - | ORFANA (nessun riferimento) |
| `/engagement` | menu (INTELLIGENCE; surveys:read; admin); rotte: surveys:read | engagement/pulse, engagement/surveys | - | menu |
| `/engagement/[surveyId]` | ereditato dal genitore; permessi rotte: surveys:read | engagement/surveys/:p/results | - | via link |
| `/gaps` | INATTIVA (WORKFORCE; gap_analysis:read; admin); rotte: gap_analysis:read | learning-gaps, learning-gaps/summary | - | via link |
| `/generated-origins` | menu (OVERVIEW; provenance:read; admin); rotte: provenance:read | generated-origins, generated-origins/summary | - | menu |
| `/goals` | menu (WORKFORCE; goal:read; admin); rotte: goal:read | goals | - | menu |
| `/insights` | menu (INTELLIGENCE; insights:view; admin); rotte: insights:view | insights/flight-risk, insights/recompute | - | menu |
| `/insights/skill-gap` | INATTIVA (WORKFORCE; insights:view; admin); rotte: insights:view | insights/skill-gap, insights/skill-gap/recompute | - | via link |
| `/insights/succession-readiness` | INATTIVA (WORKFORCE; insights:view; admin); rotte: insights:view | insights/succession-readiness, insights/succession-readiness/recompute | - | via link |
| `/investors` | pubblica |  | array-letterale STATIC_FACTS (6 oggetti) | via link |
| `/job-catalog` | menu (GOVERNANCE; job_role:read; admin); rotte: job_role:read | job-families, job-families/:p, job-roles, job-roles/:p | - | menu |
| `/jobs` | pubblica | public/job-postings | - | via link |
| `/kpis` | INATTIVA (WORKFORCE; kpi:read; admin); rotte: kpi:read | kpi-definitions, kpi-definitions/:p | - | via link |
| `/leads` | menu (GOVERNANCE; leads:read; admin) | leads, leads/:p | - | menu |
| `/learning` | menu (GOVERNANCE; learning:read; admin); rotte: learning:read | learning-modules, learning-modules/:p, learning-path-steps, learning-path-steps/:p, learning-paths, learning-paths/:p | - | menu |
| `/learning/training-initiatives` | menu (GOVERNANCE; learning:read); rotte: training_initiative:list | training-initiatives | - | menu |
| `/login` | pubblica | auth/mfa/email-otp/enroll, auth/mfa/email-otp/verify-setup, auth/mfa/enroll, auth/mfa/enroll-confirm, auth/mfa/sms-otp/enroll, auth/mfa/sms-otp/verify-setup, auth/mfa/verify-setup (+4) | - | via link |
| `/me` | ESS: persona autenticata (/me, I17) | me/attendance, me/gaps, me/learning, me/performance, me/positions, me/profile, me/timeline | - | menu |
| `/me/analytics` | ESS: persona autenticata (/me, I17) | me/analytics, me/development | array-letterale kpis (4 oggetti) | menu |
| `/me/approvals` | ESS: persona autenticata (/me, I17) | me/approvals | array-letterale stats (3 oggetti) | menu |
| `/me/career` | ESS: persona autenticata (/me, I17) | me/career-paths, me/goals, me/risk | - | menu |
| `/me/career/target` | ESS: persona autenticata (/me, I17) | me/career/target-positions, positions | - | menu |
| `/me/certifications` | ESS: persona autenticata (/me, I17) | me/certifications | - | menu |
| `/me/documents` | ESS: persona autenticata (/me, I17) | me/documents | - | menu |
| `/me/gaps` | ESS: persona autenticata (/me, I17) | me/gaps | - | menu |
| `/me/handbook` | ESS: persona autenticata (/me, I17) | me/content | - | menu |
| `/me/handbook/[id]` | ESS: persona autenticata (/me, I17) | content/media, me/content/:p, me/content/:p/media, me/content/media | - | via link |
| `/me/inbox` | ESS: persona autenticata (/me, I17) | approvals/:p/steps/:p/decide, me/inbox | - | menu |
| `/me/kpis` | ESS: persona autenticata (/me, I17) | me/kpis | - | menu |
| `/me/learning` | ESS: persona autenticata (/me, I17) | me/learning | - | menu |
| `/me/learning/catalogue` | ESS: persona autenticata (/me, I17) | learning-paths, me/learning/enrollments | - | menu |
| `/me/matching` | ESS: persona autenticata (/me, I17) | matching/me/job-roles, matching/me/occupations, matching/me/positions | - | menu |
| `/me/org-chart` | ESS: persona autenticata (/me, I17) | me/positions, visualization-graphs, visualization-graphs/:p/render | - | menu |
| `/me/performance` | ESS: persona autenticata (/me, I17) | me/performance | - | menu |
| `/me/positions` | ESS: persona autenticata (/me, I17) | me/positions | - | menu |
| `/me/profile` | ESS: persona autenticata (/me, I17) | me/contracts, me/documents, me/pay-slips, me/professional-experiences, me/profile, me/profile/full | - | menu |
| `/me/security` | ESS: persona autenticata (/me, I17) | auth/mfa/email-otp/enroll, auth/mfa/email-otp/resend, auth/mfa/email-otp/verify-setup, auth/mfa/enroll, auth/mfa/enroll-confirm, auth/mfa/enroll-confirm/resend, auth/mfa/factors (+11) | - | menu |
| `/me/skills` | ESS: persona autenticata (/me, I17) | me/skills, me/skills/possession | - | menu |
| `/me/skills/self-assessment` | ESS: persona autenticata (/me, I17) | me/skills/self-assessments, skills | - | menu |
| `/me/surveys` | ESS: persona autenticata (/me, I17) | me/surveys | - | menu |
| `/me/surveys/[surveyId]` | ESS: persona autenticata (/me, I17) | me/surveys/:p, me/surveys/:p/responses | - | via link |
| `/me/team` | ESS: persona autenticata (/me, I17) | me/team | - | menu |
| `/me/time-off` | ESS: persona autenticata (/me, I17) | me/attendance, me/time-off/requests | - | menu |
| `/okrs` | menu (WORKFORCE; okr:read; admin); rotte: okr:read | okrs | - | menu |
| `/org-director` | menu (OVERVIEW; org_director:read; admin); rotte: capability:read | capability/composition, capability/composition/essential-ranking, capability/maturity | - | menu |
| `/org-director/advisor` | menu (OVERVIEW; org_director:read; admin); rotte: org_director:read | advisor/suggestions | - | menu |
| `/org-director/health` | menu (OVERVIEW; org_director:read; admin); rotte: org_director:read | org-health | - | menu |
| `/org-director/vrio` | menu (OVERVIEW; capability:read; admin); rotte: capability:read | capability/composition/vrio | - | menu |
| `/organization` | menu (WORKFORCE; organization_unit:read; admin); rotte: organization_unit:read, user:read | organization-units, organization-units/:p, users | - | menu |
| `/organization/org-chart` | menu (WORKFORCE; organization_unit:read); rotte: visualization:read | visualization-graphs, visualization-graphs/:p/render | - | menu |
| `/performance` | voce trovata solo per letterale in 000313_voci_menu_valutazione.sql (stato attivo non verificato); rotte: performance-review:read | calibration-sessions, performance-reviews, review-cycles | array-letterale kpi (6 oggetti) | menu |
| `/positions` | menu (GOVERNANCE; position:read; admin); rotte: position:read | positions | - | menu |
| `/positions/[positionId]` | ereditato dal genitore; permessi rotte: job_role:read, organization_unit:read, position:read | job-roles, organization-units, positions, positions/:p, users | - | via link |
| `/positions/[positionId]/kpis` | ereditato dal genitore; permessi rotte: position:read | positions/:p/kpis | - | ORFANA (nessun riferimento) |
| `/positions/[positionId]/learning` | ereditato dal genitore; permessi rotte: gap_analysis:read, position:read | learning-gaps, positions/:p/learning-modules, positions/:p/learning-requirements | - | ORFANA (nessun riferimento) |
| `/positions/[positionId]/skills` | ereditato dal genitore; permessi rotte: position:read | positions/:p/skills | - | ORFANA (nessun riferimento) |
| `/privacy` | pubblica |  | - | via link |
| `/process-owner` | menu (OVERVIEW; process_owner:read; admin); rotte: blueprint:read, organization_unit_processes:read | blueprint-processes, organization-unit-processes/by-process/:p | - | menu |
| `/processes` | menu (GOVERNANCE; bpm_process:read; admin); rotte: blueprint:read | blueprint-processes | - | menu |
| `/projects` | menu (WORKFORCE; project:list); rotte: project:list | projects | - | menu |
| `/projects/[id]` | ereditato dal genitore; permessi rotte: project:read | projects/:p | - | via link |
| `/provenance` | menu (OVERVIEW; provenance:read; admin); rotte: provenance:read | provenance, provenance/summary | - | menu |
| `/recruiting` | menu (WORKFORCE; job-requisition:read); rotte: candidate:read | candidate-applications/:p | - | menu |
| `/recruiting/applications/[id]` | ereditato dal genitore; permessi rotte: candidate:read, interview:feedback, offer:manage | candidate-applications/:p, interview-feedback, interviews, interviews/:p, job-offers, job-offers/:p, users | - | via link |
| `/recruiting/candidates` | ereditato dal genitore; permessi rotte: candidate:read | candidate-applications, candidates | - | via link |
| `/recruiting/postings` | ereditato dal genitore; permessi rotte: requisition:read | job-postings, job-postings/:p | - | via link |
| `/recruiting/requisitions` | ereditato dal genitore; permessi rotte: requisition:read | job-requisitions, job-requisitions/:p | - | via link |
| `/seed-acquisition/runs` | menu (OVERVIEW; seed_acquisition:read; admin); rotte: seed_acquisition:read | seed-acquisition-runs | - | menu |
| `/skill-taxonomy` | menu (GOVERNANCE; skill:read; admin) | skill-categories, skill-categories/:p, skill-families, skill-families/:p, skill-proficiency-levels | - | menu |
| `/skills` | menu (GOVERNANCE; skill:read; admin); rotte: skill:read | skill-aliases, skill-aliases/:p, skill-categories, skill-taxonomy-edges, skill-taxonomy-edges/:p, skills, skills/:p | - | menu |
| `/system-health` | menu (OVERVIEW; tenant:read; admin) |  | - | menu |
| `/talent-review` | menu (WORKFORCE; talent:read; admin); rotte: talent:read | talent-review/critical-coverage, talent-review/critical-positions, talent-review/fit, talent-review/nine-box, talent-review/readiness, talent-review/succession | - | menu |
| `/tenant-blueprints` | menu (GOVERNANCE; tenant_blueprint:read; admin); rotte: tenant_blueprint:read | tenant-blueprints | - | menu |
| `/tenant-blueprints/[id]` | ereditato dal genitore; permessi rotte: enterprise_typing:read, operating_model:read, tenant_blueprint:read | activity-classifications, enterprise-size-bands, operating-models, tenant-blueprints/:p, tenant-blueprints/:p/versions/:p | - | via link |
| `/tenant-blueprints/[id]/versions/[n]/build` | ereditato dal genitore; permessi rotte: tenant_blueprint:read | tenant-blueprints/:p, tenant-blueprints/:p/versions/:p/apply, tenant-blueprints/:p/versions/:p/build-plan | array-letterale righe (9 oggetti) | via link |
| `/tenant-blueprints/[id]/versions/[n]/diff` | ereditato dal genitore; permessi rotte: tenant_blueprint:read | tenant-blueprints/:p/versions/:p/diff | - | via link |
| `/tenants` | menu (GOVERNANCE; tenant:read; admin); rotte: tenant:read | tenants, tenants/:p, tenants/industry-codes | - | menu |
| `/tenants/[tenantId]` | ereditato dal genitore; permessi rotte: enterprise_typing:read, tenant:read | enterprise-typing-profiles, tenants/:p | - | via link |
| `/tenants/[tenantId]/enterprise-typing` | ereditato dal genitore; permessi rotte: blueprint:read, enterprise_typing:read, operating_model:read | blueprint-families, blueprint-variants, enterprise-size-bands, enterprise-typing-profiles, operating-models | - | via link |
| `/time-off` | menu (WORKFORCE; leave:read; admin); rotte: leave:read | time-off/accrual-rules, time-off/balance-transactions, time-off/requests | - | menu |
| `/users` | menu (GOVERNANCE; user:read; admin); rotte: user:read | users | - | menu |
| `/users/[userId]` | ereditato dal genitore; permessi rotte: timeline:read, user:read | user-timeline, users/:p, users/:p/dossier, users/:p/roles, users/:p/roles/:p | - | via link |
| `/visualizations` | menu (INTELLIGENCE; visualization:read; admin); rotte: visualization:read | visualization-exports, visualization-graphs, visualization-graphs/summary | - | menu |
| `/visualizations/[graphId]` | ereditato dal genitore; permessi rotte: visualization:read | visualization-edges, visualization-exports, visualization-exports/:p/download, visualization-graphs/:p, visualization-graphs/:p/versions, visualization-nodes | - | via link |
| `/whistleblowing` | pubblica | whistleblowing, whistleblowing/status/:p | - | via link |
| `/whistleblowing-console` | voce trovata solo per letterale in 000205_whistleblowing_custodian_and_console.sql (stato attivo non verificato); rotte: whistleblowing:read | whistleblowing/reports, whistleblowing/reports/:p | - | menu |

Le pagine `/showcase/*` (18) sono pubbliche per disegno (`PUBLIC_PATHS` in `proxy.ts`) e mostrano dati dimostrativi: non entrano in questa tabella.

## 3. Censimento delle pagine del datastore

### 3.1 `apps/web` (3102)

Chiamate lette da `app/servizio.ts` (server) e `fetch('/api/v1/...')` (client). Nessun RBAC: ogni rotta è aperta all'unica identità dell'involucro.

| percorso | scopo | rotte `/v1` | segni | raggiungibilità |
|---|---|---|---|---|
| `/` | elenco cataloghi e contratti, radici | `cataloghi`, `contratti`, `cataloghi/:c/radici` | - | radice |
| `/cataloghi/[codice]` | albero di un catalogo | `cataloghi/:c/radici`, `concetti/figli` | - | link da `/` |
| `/cerca` | ricerca per significato, antenati, spiegazione | `cerca`, `concetti/antenati`, `spiegazione`, `concetti`, `concetti/figli`, `concetti/legami`, `concetti/cammino` | - | link |
| `/archivio` | stato dell'archivio (edizioni, isolati, distribuzione, ponti) | `edizioni`, `concetti/isolati`, `distribuzione`, `ponti` | - | link |
| `/contratti` | CCNL, minimi, lacune | `contratti`, `contratti/:codice`, `contratti/lacune` | - | link |
| `/modellazione/prototipi` | prototipi d'impresa, organigramma, processi | `prototipi`, `ricerche`, `organigramma`, `processi`; scrive `ricerche` (POST) | - | link |
| `/modellazione/blueprint` | blueprint composto, firma di un'edizione | `prototipi`, `blueprint`, `blueprint/edizioni`, `blueprint/edizione`; scrive `blueprint/edizioni` | - | link |
| `/modellazione/classi` | classi dimensionali | `classi-dimensionali` | - | link |
| `/modellazione/ricerche` | coda delle ricerche | `ricerche` | - | link |

Il dato è sempre dell'archivio: nessun array fittizio, nessun TODO. Le uniche occorrenze di "coming soon" dello strumento sono la parola italiana *segnaposto* (attributo `placeholder`): falso positivo.

### 3.2 `apps/banco` (SPA, 3103 con scritture, 3104 sola lettura RTL)

Schede: prototipi e corse, copie, passi (31 passi), misure, verifica, telemetria, "Traccia advanced". Chiama `/banco/api/datastore/{stato,prototipi,copie,prototipi/:id,prototipi/:id/:vista,prototipi/:id/job/:job}` in lettura e 9 scritture inoltrate a `/v1/banco/*` (`SCRITTURE_DELLA_PAGINA`). Sulla 3104 aggiunge `vuoti-rtl.js` e la rotta `prototipi/prtl_bank/vuoti`, che confronta un prototipo con il tenant RTL Bank letto **direttamente dal database di advanced** (sezione 6). Segno di incompiuto: la scheda "Traccia advanced — da costruire".

### 3.3 `apps/console` (ramo `interfaccia-unica`, non unito)

Le quattro voci `in-costruzione` descrivono funzioni che sovrappongono advanced: `tenant-advanced` ("i tenant letti da advanced, oggi RTL Bank, in sola lettura"), `vuoti-advanced` ("quali passi e campi mancano ai dati di advanced rispetto a una corsa completa"), `nuovo-prototipo`, `quadro`.

## 4. La misura pagina per pagina della voce 17 (ADR-0043)

Criterio dell'ADR: esce verso il datastore ciò che "genera o cura cataloghi"; resta in advanced "l'amministrazione tecnica dei tenant" e (sezione "Che cosa resta") il registro/attivazione dei modelli per tenant, la costruzione del tenant dal fascicolo, i vettori dei profili e il tenant RTL Bank. Per ogni area: attore, permesso e dati toccati misurati su `E_api.tsv`; "ruoli" ricavati dalle migrazioni 000171, 000232, 000322, 000418, 000422, 000431 (non dal DB vivo).

| area | pagine | rotte chiamate | permesso / ruoli | tabelle | esito della misura |
|---|---|---|---|---|---|
| `blueprints/` | `/blueprints`, `/blueprints/[variantId]` | `blueprint-families`, `-variants`, `-processes`, `-activations`, `content-blueprint-links/by-variant`, `tenants` | `blueprint:read` (concesso anche a `USER`, come dice `gate.ts`), `blueprint:activate` | `sys_blueprint_*`, attivazioni per tenant (`catalogGate: tenant`) | **Gesto del tenant, non di piattaforma.** La pagina elenca varianti/famiglie (catalogo di modelli, `catalogGate: open`) e permette di attivare una variante per un tenant: l'attivazione è nell'elenco "restano" dell'ADR. **Riprogettare**: la lista diventa lettura del perimetro (S4); l'attivazione si fonde con `tenant-blueprints/`. Non spostare. |
| `skill-taxonomy/` | `/skill-taxonomy` | `skill-families`, `skill-categories`, `skill-proficiency-levels` (+ scritture) | menu `skill:read`+admin; scritture `skill-family`/`-category`/`-level` admin | `sys_skill_families/categories/proficiency_levels` | **Piattaforma pura**: "si cura la forma del catalogo" (commento di pagina). ADR riga 4. **Spostare nel datastore**; in advanced resta al più la lettura del perimetro. Nota: le letture di `skill-families`, `skill-categories`, `skill-taxonomy-edges`, `skill-aliases`, `skill-proficiency-levels`, `job-families` non richiedono alcun `requirePermission`: qualunque utente autenticato legge il catalogo intero (contrario alla regola 3 dell'ADR). |
| `job-catalog/` | `/job-catalog` | `job-families`, `job-roles` | menu `job_role:read`+admin; `job_role:create/update` solo plenipotenziari (allowlist 000418) | `sys_job_roles` (colonna cliente opzionale), `sys_job_families` | **Misto.** Catalogo di ruoli (riga 6, il datastore deve costruirlo) **e** voci proprie del tenant (regola 4: stessa tabella, colonna valorizzata; `POST /v1/job-roles` è usato anche da `positions/[id]/position-editor`). **Riprogettare**: perimetro + voci proprie in advanced; authoring del catalogo nel datastore. |
| `generated-origins/` | `/generated-origins` | `generated-origins`, `generated-origins/summary` | `provenance:read`: `PLATFORM_ADMIN`, `TENANT_ADMIN`, `PLATFORM_OPERATOR` | `sys_generated_record_origins` (righe del tenant) | **Audit del tenant**, non piattaforma: "quali righe di *questa azienda* sono nate da una costruzione, e da quale versione di quale fascicolo". La costruzione del tenant dal fascicolo resta in advanced. **Conservare**, accorpare a `provenance/`. |
| `provenance/` | `/provenance` | `provenance`, `provenance/summary` | `provenance:read` come sopra; "AI-Act / GDPR art.22" | `sys.v_source_lineage_normalizzata` | **Audit del tenant** (ADR-0023). **Conservare**; è la risposta a "questo dato da dove viene?". |
| `leads/` | `/leads` | `leads`, `leads/:id` (PATCH stato) | `leads:read/update`: `PLATFORM_ADMIN`, `SALES` | `sys_leads` (nessun tenant) | **Piattaforma commerciale**, non catalogo: richieste di contatto del sito pubblico (`lead-form` in `/` e `/demo`). Fuori dal dominio del tenant, ma il datastore (cataloghi e modelli) non è la casa naturale di un CRM. **Decisione da prendere** (vedi 7): il form pubblico `POST /v1/leads` resta con il sito. |
| `system-health/` | `/system-health` | via `SystemHealthLive` → `observability/system-health`, `slow-queries`, `request-series` | solo `PLATFORM_ADMIN` (controllato nella pagina); rotte `observability:read` (+ `PLATFORM_OPERATOR`) | cache RBAC, `pg_stat`, metriche del processo | **Salute di advanced**: resta (ADR lo dice). Non duplica `/v1/metriche` e la telemetria del banco, che misurano un altro oggetto. |
| `tenants/` | `/tenants`, `/tenants/[id]`, `/tenants/[id]/enterprise-typing` | `tenants`, `tenants/industry-codes`, `enterprise-typing-profiles`, `enterprise-size-bands`, `operating-models`, `blueprint-families/variants` | `tenant:*`, `enterprise_typing:*` | `sys_tenancies`, `sys_industry_codes` | **Amministrazione tecnica**: resta. `POST /v1/tenants/provision` (creazione sintetica, riga 15) non ha pagina. La pagina `enterprise-typing` mostra cataloghi interi (`catalogGate: open`): da passare al perimetro. |
| `tenant-blueprints/` | `/tenant-blueprints`, `/[id]`, `/[id]/versions/[n]/build`, `/diff` | `tenant-blueprints`, `…/versions/:n`, `…/build-plan`, `…/apply`, `…/diff`, `activity-classifications`, `enterprise-size-bands`, `operating-models` | `tenant_blueprint:read/write` (BLUEPRINT_MANAGER, TENANT_ADMIN, PLATFORM_ADMIN; consulente in sola lettura) | `sys_tenant_blueprint*`, `sys_blueprint_*`, per la build `sys_organization_units`, `sys_positions`, ecc. | **Va spezzata.** `build-plan`/`apply`/`diff` costruiscono il tenant dal fascicolo: restano (ADR). La modifica a mano di modello e processi (`PUT …/model`, `…/processes/:id`) e le 4 rotte di ricerca (`research-domains`, `…/research`, `…/apply-research`) sono generazione di modelli (riga 14): **12 rotte su 20 non hanno pagina**. **Riprogettare**: la pagina diventa "fascicolo ricevuto dal datastore: carica pacchetto, vedi differenze, costruisci"; l'authoring esce. |
| `seed-acquisition/` | `/seed-acquisition/runs` | `seed-acquisition-runs` (GET, POST) | `seed_acquisition:read/trigger`; `PLATFORM_ADMIN`, `IMPLEMENTATION_CONSULTANT` (assegnati ai clienti) | `sys_seed_acquisition_runs` | **Piattaforma pura** (riga 16). Pagina di 69 righe; 14 rotte tra `seed-acquisition-runs`, `seed-candidate-records`, `seed-approval-decisions`, di cui 12 senza pagina. **Spostare/dismettere** insieme ai moduli. Attenzione: `tenant-import-runs` (5 rotte, nessuna pagina) usa gli stessi permessi e le stesse tabelle `sys_seed_*` ma serve all'ingresso delle persone vere nel tenant (`staging.tenant_import_people`, `sys_positions`, `sys_user_position_assignments`): **non è piattaforma**, e il ritiro di `sys_seed_*` lo rompe se non si separa prima. |

Sintesi: dei dieci gruppi, **uscire** `skill-taxonomy/` e `seed-acquisition/`; **ridisegnare** `job-catalog/`, `blueprints/` e `tenant-blueprints/`; **tenere** `generated-origins/`, `provenance/`, `tenants/`, `system-health/`; **decidere** `leads/`. Il `reference-sync` (4 rotte, nessuna pagina, riga 13) e `platform-tenant-assignments` (3 rotte, nessuna pagina) sono API-only: il primo esce, il secondo resta.

## 5. Rotte senza pagina, pagine senza rotta

- **Pagine che chiamano rotte inesistenti: nessuna** (matching del percorso, metodo non verificato).
- **Rotte di advanced senza consumatore nel frontend: 300 su 667.** Moduli con più rotte senza pagina: `mentorship` 17/17, `me` 15/65, `tenant-blueprints` 12/20, `surveys` 12/12, `engagement-feedback` 10/10, `auth` 9/31 (rotte MFA e di sessione chiamate in modi non letterali), `teams` 6/6, `user-target-positions` 6/6, `semantic-matching` 6/10, `tenant-import-runs` 5/5, `seed-candidate-records` 5/5, `occupation-classifications` 5/5, `positions` 5/16, `gdpr` 5/5, `visualization-*` 16 in tutto, `reference-sync` 4/4, `blueprint-overrides` 4/4, `platform-tenant-assignments` 3/3. Elenco per rotta nella colonna `n_consumatori` di `E_api.tsv` (0 = nessuno).
- **Rotte del datastore senza pagina in `apps/web`**: `/v1/fonti`, `/v1/ricerche/esegui`, `/v1/ricerche/esito`, `/v1/processi/proposti`, `/v1/prototipi/{sedi,sospendi,riprendi}`, tutti i `/v1/passi/*` (31, chiamati dal banco, dalla CLI e dagli script `esegui_passi_*`), `/v1/fascicoli/:prototipo/estensioni`, `/v1/banco/{pacchetto,pacchetti/confronto,pacchetto/sezione,corse/*,copia,passo,prototipi/*}` e `/v1/archivio/tabelle-v03`. Sono verbi per chi chiama da fuori (MCP, CLI, banco): ammesso dal vocabolario dei verbi.
- Limite: la consultazione per prefisso (`consumatori_prefisso`) segnala dove un modulo è citato con percorsi costruiti, che lo strumento non risolve.

## 6. Accoppiamenti diretti fra i due database o servizi (punto 3 della consegna)

**Datastore verso advanced (esistono, tutti in sola lettura, ma sono letture dirette del database):**

| dove | che cosa | note |
|---|---|---|
| `apps/api/src/servizio_rtl.ts` (righe 40-80) | istanza 3104 (`DATASTORE_RTL_PORT`) che apre un pool `pg` sul database di advanced: `DATASTORE_RTL_DB_HOST/PORT/NAME/USER`, `DATASTORE_RTL_FONTE` = `copia` (5435, `heuresys_advanced_20261010`) o `produzione` (5433, `heuresys_advanced`, utente `heuresys`); `default_transaction_read_only=on`, rifiuta di partire se non è in sola lettura | script `scripts/servizio_rtl.ps1`; la parola d'ordine arriva da pgpass, non è nel codice |
| `apps/api/src/rtl_lettura.ts` | legge `sys_tenancies`, `sys_organization_units`, `sys_branches`, `sys_positions`, `sys_user_position_assignments`, `sys_enterprise_typing_profiles`, `sys_enterprise_size_bands`, `sys_activity_classifications`, `sys_operating_model_catalog`, `sys_blueprint_process_registry`, `sys_organization_unit_processes`, `sys_kpi_definitions`, `sys_kpi_targets`, `sys_learning_modules`, `sys_projects`, `sys_leave_accrual_rules`, `sys_objective_reward_rules`, `sys_reference_translations`, `sys_seed_source_evidence` | espone il tenant RTL Bank come "prototipo" `prtl_bank` e calcola i vuoti (`rtl_vuoti.ts`) |
| `src/config/config.ts` righe 418-423 | `PRODUZIONE_SOLA_LETTURA`: `ADVANCED_DB_HOST/PORT/NAME/USER` (predefiniti `localhost`, 5433, `heuresys_advanced`, `heuresys`); `.env.example` righe 56-59 | il divieto di scrittura (DIV-02) è nel nome |
| `scripts/piano034/*` (`matrice_copertura.py`, `prova_completa.sh`, `dump_produzione_20261010.sh`, `ripristino_20261010.sh`, `prova_sola_lettura.py`) | dump della produzione di advanced con `pg_dump -p 5433` e ripristino in un database locale; confronto matrice di copertura | usa i nomi `heuresys_advanced`, `heuresys_advanced_20261010`, porta 5433 |
| `scripts/ripristino_locale.cmd`, `src/carico/*` | ripristino in `heuresys_advanced_20260819` sulla 5435; `src/carico/processi_di_riferimento.ts` (`SORGENTE = "heuresys-advanced"`) e `livelli_organizzativi.ts` citano advanced come fonte documentale | la dicitura è fonte, non connessione |

Il datastore tiene inoltre **copie** del contratto (`src/contratto/v0.1..v0.3`, `vocabolari.json` con la corrispondenza dei vocabolari di advanced) dichiarate "nessuna dipendenza a tempo di esecuzione".

**Advanced verso datastore: nessun accesso a runtime.** Cercati `heuresys_datastore`, `:5435`, `:3101`, `:3103`, `:3107`, `DATASTORE_*`, schemi `datastore_*`, `fetch` verso le rotte del datastore in `apps/`, `packages/`, `db/scripts/`, `scripts/`, `deploy/`, `.github/`, `.env.example`: zero. Le uniche occorrenze sono documentali (`.programmi/esiti-onda0/CENSIMENTO_separazione.md`, che dichiara di aver letto il datastore "in sola lettura dal suo database" durante la misura S1, ADR-0046, `docs/kb/*`) e file-based: `db/scripts/pacchetto/accogli-pacchetto.mjs` (portato da `heuresys-datastore/scripts/piano034/accogli_pacchetto.mjs`) e `contratto/v0.2|v0.3` (copie con impronta controllata da `VERSIONE.json`); il caricatore legge un file pacchetto, non il database. Il valore `origine_dato = 'DATASTORE'` e `PACCHETTO_DATASTORE` sono etichette di dati. Questo è coerente con ADR-0043 ("Leggere i cataloghi dal datastore a ogni richiesta" scartata).

Conseguenza per il consolidamento: l'unica dipendenza a runtime fra i due progetti è quella del **datastore che legge advanced** (RTL Bank). Va dichiarata nell'ADR della separazione, perché inverte la direzione che l'ADR descrive (il datastore dà il fascicolo, advanced lo riceve) e perché, con la 3104 su `produzione`, un guasto o un carico del datastore ricade sul database vivo di advanced.

## 7. Sovrapposizioni funzionali: la stessa funzione fatta due volte?

| funzione | in advanced | nel datastore | giudizio |
|---|---|---|---|
| cercare e sfogliare competenze, professioni, classificazioni (ESCO, ISCO, ATECO, NACE) | `/skills` (ricerca semantica + testuale su ~14k competenze), `/skill-taxonomy`, `/job-catalog`, `/analytics/skills-graph`, rotte `occupation-classifications`, `activity-classifications` | `/cataloghi`, `/cerca`, `/archivio`, `/contratti`, rotte `concetti/*`, `cerca`, `spiegazione` | **Sì, due volte.** È la riga 1-12 dell'ADR. Il datastore ha il lettore completo; advanced deve tenere solo perimetro + voci proprie. |
| classi dimensionali / fasce | `enterprise-size-bands`, `operating-models` (con `/tenants/[id]/enterprise-typing`) | `/modellazione/classi`, `/v1/classi-dimensionali` | Sì. Resta in advanced solo il profilo di tipizzazione del tenant. |
| modelli (famiglie, varianti, processi, fascicoli) | `/blueprints`, `/tenant-blueprints` (authoring a mano di modello e processi, `research`) | `/modellazione/blueprint`, `/modellazione/prototipi`, banco a 31 passi, `POST /v1/passi/*`, pacchetto v0.3 | **Sì, per l'authoring**: advanced dovrebbe solo ricevere, attivare, differenziare e costruire. |
| ricerche e acquisizione dei semi | `/seed-acquisition/runs`, `seed-candidate-records`, `seed-approval-decisions`, `tenant-blueprints/…/research`, `agent-gateway` `/research/propose` | `/modellazione/ricerche`, `POST /v1/ricerche`, `/ricerche/esegui`, `/ricerche/esito`, involucro con costo in token | **Sì**: il datastore ha anche il registro dei costi (`datastore_call`), advanced no. |
| vista del tenant RTL Bank come "prototipo" | l'intero advanced | banco 3104 `vuoti-rtl.js`, `rtl_lettura.ts`, console `tenant-advanced`/`vuoti-advanced` (in costruzione) | **Sovrapposizione in costruzione, e con direzione sbagliata**: il datastore ricostruisce con letture dirette ciò che advanced già espone. Se serve, dovrebbe leggere un export o la rotta `/v1/*` di advanced, non le tabelle. |
| salute / misura | `/system-health`, `/v1/observability/*` | `/v1/salute`, `/v1/metriche`, scheda telemetria del banco | No: oggetti diversi (processo advanced / corse del banco). |
| tre interfacce nel datastore | - | `apps/web` (3102), `apps/banco` (3103/3104), `apps/console` (3107, non unita): le prime due sono già due modi di vedere prototipi e corse | **Sì, dentro il datastore**: la console `interfaccia-unica` nasce per riunirle; finché non è unita `main` ne ha due. |

## 8. Proposta per ogni webapp e gruppo

Etichette: conservare / completare / accorpare / riprogettare / spostare nel datastore / dismettere.

**advanced `apps/web`** (attore: ruoli del tenant, ESS, pubblico).
- Pagine HR e ESS (`/me/*`, `/positions`, `/organization`, `/analytics/*`, `/goals`, `/okrs`, `/performance`, `/talent-review`, `/recruiting/*`, `/projects`, `/time-off`, `/users`, `/visualizations`, `/engagement`, `/whistleblowing-console`, `/approvals`, `/content`, `/learning`): **conservare**; chiamano rotte vere. **Completare**: `mentorship` (17 rotte, nessuna pagina), `surveys` lato admin, `engagement-feedback`, `teams`, `gdpr` (5), `user-career-plans`, `user-target-positions`, `semantic-matching` (6 senza pagina) sono funzioni di prodotto senza interfaccia: decidere per ognuna se ha un attore e un processo, altrimenti dismettere la rotta.
- `/positions/[id]/{skills,kpis,learning}`: **accorpare** nella pagina `positions/[id]` (oggi orfane) o aggiungere i link.
- `/analytics/*` assorbite e `/gaps`, `/kpis`, `/compensation-intelligence`, `/insights/*`: voci inattive raggiunte da tab: **conservare**, ma tenere allineato il test "nessuna pagina irraggiungibile" (migrazione 000306).
- `/investors`: **completare** togliendo `STATIC_FACTS` (la pagina usa già `usePlatformStats` accanto ai valori fissi: portare i sei valori sotto la stessa fonte) e `/demo`: PNG statici accettabili come materiale di vendita ma da dichiarare tali.
- `/app`: **dismettere** (redirect inutile). `/dev/agent`: **conservare** dietro flag.
- Gruppi di piattaforma: vedi tabella della sezione 4: **spostare nel datastore** `skill-taxonomy/` e `seed-acquisition/` (con i moduli `reference-sync`, `seed-*`, scritture dei cataloghi); **riprogettare** `job-catalog/`, `blueprints/`, `tenant-blueprints/` su perimetro e fascicolo ricevuto; **conservare** `generated-origins/`, `provenance/` (accorpandole sotto un solo punto di menu "Provenienza"), `tenants/`, `system-health/`; **decidere** `leads/`.
- Precondizione trasversale: i sei cataloghi senza `requirePermission` e le rotte `catalogGate: open` (14) vanno chiusi al perimetro prima di togliere le pagine, altrimenti la regola "il tenant non sfoglia il catalogo generale" è violata anche senza pagina.

**advanced `apps/showcase`**: **conservare** come vetrina di brand (dati finti dichiarati per disegno); non spostare.

**advanced `apps/agent-gateway`**: **conservare**; la rotta `/research/propose` è la parte di generazione e segue la sorte di `research` (datastore).

**datastore `apps/web`**: **conservare** come lettore del catalogo; **accorpare** nella console unica (`interfaccia-unica`), dove le pagine sono già riusate per import. Attore e processo: l'Amministratore di Sistema che consulta i cataloghi e cura i modelli.

**datastore `apps/banco`**: **accorpare** nella console unica e poi **dismettere** la SPA statica quando le sue schede hanno equivalente (l'equivalenza è già misurata da `scripts/banco_interfaccia_equivalenza.mjs`); **completare** o togliere la scheda "Traccia advanced" (segnaposto).

**datastore `apps/console` (ramo non unito)**: **completare** le quattro voci `in-costruzione`; **riprogettare** `tenant-advanced`/`vuoti-advanced` perché non leggano più il database di advanced; destinazione naturale delle pagine di piattaforma che escono da advanced (`skill-taxonomy`, `seed-acquisition`, authoring modelli, forse `leads`). La decisione di unire il ramo resta dell'Amministratore di Sistema (`00_PIANO_ONDA1.md` X-22).

## 9. Da decidere

1. `leads/`: dove vive la gestione delle richieste commerciali dopo la separazione (il datastore non è un CRM). Tipo di decisione: prodotto, spetta a Enzo.
2. La voce 17 dell'ADR-0043 andrebbe corretta in base alla sezione 4 (`blueprints/`, `tenant-blueprints/`, `generated-origins/`, `provenance/` non sono funzioni di piattaforma): è un emendamento all'ADR, quindi nuovo ADR o errata approvata.
3. Direzione dell'accoppiamento RTL Bank (sezione 6): letture dirette del datastore sul database di advanced, da regolare.
