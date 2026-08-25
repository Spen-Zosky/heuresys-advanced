# Inventario funzionalità — heuresys-advanced

Data: 2026-08-25. Metodo: enumerazione da `docs/kb/atlas/atlas.yaml` (rigenerato 2026-08-24, commit `c8a29d30`) come indice, poi verifica diretta nel codice per ogni riga (route API `apps/api/src/modules/**/routes.ts` · pagina web `apps/web/src/app/**/page.tsx` e `_components/*.tsx`). Il codice vince sulla documentazione.

## Comandi di enumerazione usati (2026-08-25)

```bash
python docs/kb/tools/build_atlas.py   # rigenera l'atlas (già fatto il 2026-08-24, non ri-eseguito in questa sessione)
grep -rn "app\.\(get\|post\|put\|patch\|delete\)(" apps/api/src/modules --include="*routes.ts" | wc -l   # 604 — combacia con "Route API" dell'atlas
find apps/web/src/app -name "page.tsx" | grep -v "/showcase/" | wc -l                                    # 102 (120 pagine totali − 18 showcase)
grep -rn "apiFetch<" apps/web/src/app --include="*.tsx" | grep -v "/showcase/" | wc -l                   # 247 chiamate dirette
grep -rln "usePaginatedList" apps/web/src/app --include="*.tsx" | grep -v "/showcase/"                   # hook con `path:` non catturato dal grep sopra
```

Estrazione e incrocio pagina↔endpoint fatti con script Python ad-hoc (regex su `apiFetch<...>(` e su `path:` nelle chiamate a `usePaginatedList`, poi match per modulo+metodo+segmenti contro le route registrate). Ogni riga della tabella porta comunque il file:riga letto direttamente, non l'output dello script.

**Granularità dichiarata, applicata a tutte le aree**: una riga per azione distinta che l'utente può compiere su una schermata — consultare/elencare, creare, modificare, eliminare, e le azioni nominate (approvare, attivare, esportare, ecc.). Una schermata di sola consultazione produce una riga; una con CRUD ne produce fino a quattro. Le pagine `/showcase/*` (catalogo interno dei componenti UI, 18 pagine) sono escluse: non sono una funzionalità di prodotto per un utente reale. `/app` è escluso: è un puro redirect a `/login` (nessuna logica propria — `apps/web/src/app/app/page.tsx:7`).

---

## A. Accesso e sicurezza dell'account

| Capacità (lato utente) | Stato | Superficie (SPA/ESS + permesso) | Prova (API file:riga · Web file:riga) |
|---|---|---|---|
| Accedere con email e password | Completo | Pubblico (`/login`, nessun permesso — pre-auth) | `apps/api/src/modules/auth/routes.ts` (login POST, modulo `auth`) · `apps/web/src/app/login/page.tsx` |
| Completare il login con un secondo fattore (TOTP/WebAuthn/email-OTP/SMS-OTP) quando il tenant lo richiede | Completo | Pubblico (`/login`, step 2 post-credenziali) | `apps/api/src/modules/auth/mfa-routes.ts:554` (POST `/webauthn/authentication/verify`) · `apps/web/src/app/login/page.tsx:195` |
| Iscrivere un fattore MFA al primo login forzato (TOTP) | Completo | Pubblico (`/login`) | `apps/api/src/modules/auth/mfa-routes.ts:204` (POST `/enroll`) · `apps/web/src/app/login/page.tsx:240` |
| Iscrivere un fattore MFA email-OTP al primo login forzato | Completo | Pubblico (`/login`) | `apps/api/src/modules/auth/mfa-routes.ts:205` (path `/email-otp/enroll`, `app.post` a riga 204) · `apps/web/src/app/login/page.tsx:246` |
| Iscrivere un fattore MFA WebAuthn (passkey) al primo login forzato | Completo | Pubblico (`/login`) | `apps/api/src/modules/auth/mfa-routes.ts:510` (path `/webauthn/registration/verify`, `app.post` a riga 489) · `apps/web/src/app/login/page.tsx:264` |
| Iscrivere un fattore MFA SMS-OTP al primo login forzato | Completo | Pubblico (`/login`) | `apps/api/src/modules/auth/mfa-routes.ts:345` (path `/sms-otp/enroll`, `app.post` a riga 344) · `apps/web/src/app/login/page.tsx:295` |
| Consultare i propri fattori MFA attivi | Completo | ESS `/me/security` (`me:sessions:manage` per la parte sessioni; i factor-endpoint non passano da `requirePermission`, sono self-implicit sul JWT) | `apps/api/src/modules/auth/mfa-routes.ts:167` (GET `/factors`) · `apps/web/src/app/(authenticated)/me/security/page.tsx:71` |
| Aggiungere un nuovo fattore MFA dal proprio profilo (TOTP/email-OTP/SMS-OTP/WebAuthn) | Completo | ESS `/me/security` | `apps/api/src/modules/auth/mfa-routes.ts:204,344,489` | 
| Rimuovere un proprio fattore MFA | Completo | ESS `/me/security` | `apps/api/src/modules/auth/mfa-routes.ts:180` (DELETE `/factors/:id`) · `apps/web/src/app/(authenticated)/me/security/page.tsx:120` |
| Consultare le proprie sessioni attive | Completo | ESS `/me/security` (`me:sessions:manage`) | `apps/api/src/modules/me/routes.ts:548` · `apps/web/src/app/(authenticated)/me/security/page.tsx:324` |
| Revocare una propria sessione (o tutte le altre) | Completo | ESS `/me/security` (`me:sessions:manage`) | `apps/api/src/modules/me/routes.ts:553,561` · `apps/web/src/app/(authenticated)/me/security/page.tsx:333,338` |
| Consultare la matrice ruoli×permessi (sola lettura) | Completo | Admin `/admin/roles` (`role_matrix:read`) | `apps/api/src/modules/auth/routes.ts:315` · `apps/web/src/app/(authenticated)/admin/roles/page.tsx:21` |
| Configurare la policy MFA di un tenant (quali ruoli sono obbligati) | Completo | Admin `/admin/mfa-policy` (`mfa_policy:read`/`mfa_policy:manage`) | `apps/api/src/modules/mfa-policy/routes.ts:22,32` · `apps/web/src/app/(authenticated)/admin/mfa-policy/page.tsx:57,186` |
| Consultare lo stato del sistema in diretta (pool DB, cache RBAC, code richieste, query lente) | Completo | Admin `/system-health` (permesso implicito via `useSystemHealth`/`useRolePermissions`, letto da `lib/api/observability.ts`) | `apps/api/src/modules/observability/routes.ts:25` (GET `/system-health`) · `apps/web/src/components/SystemHealthLive.tsx` richiamato da `apps/web/src/app/(authenticated)/system-health/page.tsx:6` |


## B. Presenza pubblica e acquisizione lead

| Capacità (lato utente) | Stato | Superficie (SPA/ESS + permesso) | Prova (API file:riga · Web file:riga) |
|---|---|---|---|
| Consultare la landing page pubblica del prodotto | Completo | Pubblico `/` (nessun permesso) | n/a (pagina statica) · `apps/web/src/app/page.tsx:1` |
| Lasciare un contatto commerciale dalla landing page | Completo | Pubblico `/` (nessun permesso, endpoint pubblico) | `apps/api/src/modules/leads/routes.ts:22` (POST `/`) · `apps/web/src/components/lead-form.tsx:22` |
| Consultare il percorso demo guidato (10 schermate) e lasciare un contatto | Completo | Pubblico `/demo` | `apps/api/src/modules/leads/routes.ts:22` · `apps/web/src/app/demo/page.tsx:52` |
| Consultare la pagina investitori con statistiche di piattaforma in diretta e lasciare un contatto | Completo | Pubblico `/investors` | `apps/api/src/modules/public-stats/routes.ts` (unico GET, modulo `public-stats`) · `apps/web/src/lib/api/public-stats.ts:11` usato da `apps/web/src/app/investors/page.tsx:21`; form: `apps/web/src/app/investors/page.tsx:104` |
| Consultare l'informativa privacy | Completo | Pubblico `/privacy` (nessun permesso) | n/a (pagina statica) · `apps/web/src/app/privacy/page.tsx:32` |
| Segnalare una violazione in forma anonima (whistleblowing) | Completo | Pubblico `/whistleblowing` (nessun permesso, per progetto — isolamento assoluto I20) | `apps/api/src/modules/whistleblowing/routes.ts:35` (POST `/`) · `apps/web/src/app/whistleblowing/page.tsx:62` |
| Verificare lo stato di una segnalazione con il codice di tracciamento | Completo | Pubblico `/whistleblowing` (`whistleblowing:read`) | `apps/api/src/modules/whistleblowing/routes.ts:44` · `apps/web/src/app/whistleblowing/page.tsx:191` |
| Consultare e qualificare i lead raccolti dal form pubblico | Completo | Admin `/leads` (`leads:read`) | `apps/api/src/modules/leads/routes.ts:31` (GET lista, `leads:read`) · `apps/web/src/app/(authenticated)/leads/page.tsx:38` |
| Aggiornare lo stato di un lead | Completo | Admin `/leads` (`leads:update`) | `apps/api/src/modules/leads/routes.ts:44` (PATCH) · `apps/web/src/app/(authenticated)/leads/page.tsx:43` |

## C. Home e dashboard direzionale

| Capacità (lato utente) | Stato | Superficie (SPA/ESS + permesso) | Prova (API file:riga · Web file:riga) |
|---|---|---|---|
| Consultare la dashboard con i widget assegnati al proprio ruolo | Completo | Admin `/dashboard` (`dashboard:view`) | `apps/api/src/modules/dashboard/routes.ts:21` (GET `/widgets`) · `apps/web/src/app/(authenticated)/dashboard/page.tsx:57` |
| Sfogliare il catalogo delle famiglie di dashboard e aprirne una | Completo | Admin `/dashboard/[famiglia]` (nessun permesso singolo per design — filtro per-riga nel service, vedi commento a `routes.ts:26-30`) | `apps/api/src/modules/dashboard/routes.ts:31,46` (GET `/catalog`, GET `/catalog/:code/data`) · `apps/web/src/app/(authenticated)/dashboard/[famiglia]/page.tsx:165,176` |
| Consultare la propria home ESS (riepilogo presenze, performance, profilo, posizioni, learning, gap) | Completo | ESS `/me` (permessi `*:read:self` per sezione) | `apps/api/src/modules/me/routes.ts:100,129,135,167,228,241` · `apps/web/src/app/(authenticated)/me/_components/{attendance,performance,summary}-tab.tsx` |
| Consultare la propria timeline eventi | Completo | ESS `/me` (sotto-sezione timeline) | modulo `me`, prefix `/v1/me/timeline` · `apps/web/src/components/timeline-panel.tsx:33` richiamato da `apps/web/src/app/(authenticated)/me/page.tsx:25` |

## D. Anagrafica utenti e ruoli

| Capacità (lato utente) | Stato | Superficie (SPA/ESS + permesso) | Prova (API file:riga · Web file:riga) |
|---|---|---|---|
| Consultare l'elenco degli utenti del tenant | Completo | Admin `/users` (`user:read`) | `apps/api/src/modules/users/routes.ts:31` · `apps/web/src/app/(authenticated)/users/page.tsx:25` |
| Consultare il dossier completo di un utente | Completo | Admin `/users/[userId]` (`user:read`) | `apps/api/src/modules/users/routes.ts:59` (GET `/:id/dossier`) · `apps/web/src/app/(authenticated)/users/[userId]/page.tsx:98` |
| Modificare l'identità/anagrafica di un utente | Completo | Admin `/users/[userId]` (`user:update`) | `apps/api/src/modules/users/routes.ts:83` (PATCH `/:id`) · `apps/web/src/app/(authenticated)/users/[userId]/_components/identity-editor.tsx:89` |
| Consultare i ruoli assegnati a un utente | Completo | Admin `/users/[userId]` (`user:read`) | `apps/api/src/modules/users/routes.ts:134` (GET `/:id/roles`) · `apps/web/src/app/(authenticated)/users/[userId]/_components/roles-editor.tsx:60` |
| Assegnare un ruolo a un utente | Completo | Admin `/users/[userId]` (`role:assign`) | `apps/api/src/modules/users/routes.ts:150` (POST `/:id/roles`) · `apps/web/src/app/(authenticated)/users/[userId]/_components/roles-editor.tsx:66` |
| Revocare un ruolo a un utente | Completo | Admin `/users/[userId]` (`role:assign`) | `apps/api/src/modules/users/routes.ts:172` (DELETE `/:id/roles/:grantId`) · `apps/web/src/app/(authenticated)/users/[userId]/_components/roles-editor.tsx:72` |
| Consultare la timeline eventi di un utente (audit organizzativo) | Completo | Admin `/users/[userId]` (implicito, `basePath="/v1/user-timeline"`) | modulo `user-timeline`, prefix `/v1/user-timeline` · `apps/web/src/components/timeline-panel.tsx:33` richiamato da `apps/web/src/app/(authenticated)/users/[userId]/page.tsx:313` |

## E. Struttura organizzativa

| Capacità (lato utente) | Stato | Superficie (SPA/ESS + permesso) | Prova (API file:riga · Web file:riga) |
|---|---|---|---|
| Consultare l'elenco delle unità organizzative | Completo | Admin `/organization` (`organization_unit:read`) | `apps/api/src/modules/organization-units/routes.ts:22` · `apps/web/src/app/(authenticated)/organization/page.tsx:22` |
| Creare un'unità organizzativa | Completo | Admin `/organization` (`organization_unit:create`) | `apps/api/src/modules/organization-units/routes.ts:32` · `apps/web/src/app/(authenticated)/organization/_components/org-unit-forms.tsx:116` |
| Modificare un'unità organizzativa (incl. gerarchia/responsabile) | Completo | Admin `/organization` (`organization_unit:update`) | `apps/api/src/modules/organization-units/routes.ts:40` · `apps/web/src/app/(authenticated)/organization/_components/org-unit-forms.tsx:264` |
| Consultare l'organigramma come grafico interattivo | Completo | Admin `/organization/org-chart` (`visualization:read`) | `apps/api/src/modules/visualization-graphs/routes.ts:18,33` · `apps/web/src/app/(authenticated)/organization/org-chart/page.tsx:39,50` |
| Consultare il proprio organigramma (vista ESS) | Completo | ESS `/me/org-chart` (`visualization:read` + `user_position_assignment:read:self`) | `apps/api/src/modules/visualization-graphs/routes.ts:18,33` · `apps/web/src/app/(authenticated)/me/org-chart/page.tsx:20,25` |
| Consultare la mappa dei processi per unità organizzativa proprietaria | Completo | Admin `/process-owner` (`organization_unit_processes:read`) | `apps/api/src/modules/organization-unit-processes/routes.ts:45` · `apps/web/src/app/(authenticated)/process-owner/page.tsx:83` |

## F. Posizioni e catalogo ruoli

| Capacità (lato utente) | Stato | Superficie (SPA/ESS + permesso) | Prova (API file:riga · Web file:riga) |
|---|---|---|---|
| Consultare l'elenco delle posizioni | Completo | Admin `/positions` (`position:read`) | `apps/api/src/modules/positions/routes.ts:38` · `apps/web/src/app/(authenticated)/positions/page.tsx:21` |
| Consultare il dettaglio di una posizione | Completo | Admin `/positions/[positionId]` (`position:read`) | `apps/api/src/modules/positions/routes.ts:47` · `apps/web/src/app/(authenticated)/positions/[positionId]/page.tsx:39` |
| Modificare una posizione (titolare, unità, ruolo, criticità) | Completo | Admin `/positions/[positionId]` (`position:update`) | `apps/api/src/modules/positions/routes.ts:68` (PATCH) · `apps/web/src/app/(authenticated)/positions/[positionId]/_components/position-editor.tsx:122` |
| Consultare i requisiti di competenza di una posizione | Completo | Admin `/positions/[positionId]/skills` (`position:read`) | `apps/api/src/modules/positions/routes.ts:108` · `apps/web/src/app/(authenticated)/positions/[positionId]/skills/page.tsx:27` |
| Consultare i requisiti KPI di una posizione | Completo | Admin `/positions/[positionId]/kpis` (`position:read`) | `apps/api/src/modules/positions/routes.ts:204` · `apps/web/src/app/(authenticated)/positions/[positionId]/kpis/page.tsx:26` |
| Consultare i requisiti/moduli di apprendimento collegati a una posizione | Completo | Admin `/positions/[positionId]/learning` (`position:read`) | `apps/api/src/modules/positions/routes.ts:175,189` · `apps/web/src/app/(authenticated)/positions/[positionId]/learning/page.tsx:36,44` |
| Consultare il catalogo delle famiglie professionali | Completo | Admin `/job-catalog` (`job_family:create` sulla GET — nota sotto) | `apps/api/src/modules/job-families/routes.ts:25` · `apps/web/src/app/(authenticated)/job-catalog/_components/job-families-panel.tsx:57` |
| Creare una famiglia professionale | Completo | Admin `/job-catalog` (`job_family:create`) | `apps/api/src/modules/job-families/routes.ts:33` · `apps/web/src/app/(authenticated)/job-catalog/_components/job-families-panel.tsx:71` |
| Modificare una famiglia professionale | Completo | Admin `/job-catalog` (`job_family:update`) | `apps/api/src/modules/job-families/routes.ts:41` · `apps/web/src/app/(authenticated)/job-catalog/_components/job-families-panel.tsx:85` |
| Consultare il catalogo dei ruoli professionali (job role) | Completo | Admin `/job-catalog` (`job_role:read`) | `apps/api/src/modules/job-roles/routes.ts:21` · `apps/web/src/app/(authenticated)/job-catalog/_components/job-roles-panel.tsx:75` |
| Creare un ruolo professionale | Completo | Admin `/job-catalog` (`job_role:create`) | `apps/api/src/modules/job-roles/routes.ts:31` · `apps/web/src/app/(authenticated)/job-catalog/_components/job-roles-panel.tsx:103` |
| Modificare un ruolo professionale | Completo | Admin `/job-catalog` (`job_role:update`) | `apps/api/src/modules/job-roles/routes.ts:39` · `apps/web/src/app/(authenticated)/job-catalog/_components/job-roles-panel.tsx:129` |
| Consultare le proprie posizioni assegnate | Completo | ESS `/me/positions` (`user_position_assignment:read:self`) | `apps/api/src/modules/me/routes.ts:167` · `apps/web/src/app/(authenticated)/me/positions/page.tsx:31` |

Nota: la GET dell'elenco famiglie professionali usa il permesso `job_family:create` invece di un `job_family:read` dedicato — verificato in `apps/api/src/modules/job-families/routes.ts:25` (il modulo non ha un permesso di sola lettura distinto: 5 route, 3 permessi in atlas).

## G. Competenze e tassonomia delle skill

| Capacità (lato utente) | Stato | Superficie (SPA/ESS + permesso) | Prova (API file:riga · Web file:riga) |
|---|---|---|---|
| Consultare il catalogo delle competenze (skill) | Completo | Admin `/skills` (`skill:read`) | `apps/api/src/modules/skills/routes.ts:23` · `apps/web/src/app/(authenticated)/skills/page.tsx:52` |
| Creare una competenza | Completo | Admin `/skills` (`skill:create`) | `apps/api/src/modules/skills/routes.ts:35` · `apps/web/src/app/(authenticated)/skills/_components/skill-forms.tsx:101` |
| Modificare una competenza | Completo | Admin `/skills` (`skill:update`) | `apps/api/src/modules/skills/routes.ts:43` · `apps/web/src/app/(authenticated)/skills/_components/skill-forms.tsx:232` |
| Aggiungere/rimuovere un alias (sinonimo) di una competenza | Completo | Admin `/skills` (`skill:create`/`skill:delete`) | `apps/api/src/modules/skill-aliases/routes.ts:30,43` · `apps/web/src/app/(authenticated)/skills/_components/skill-relations.tsx:65,77` |
| Collegare/scollegare due competenze nella gerarchia di tassonomia | Completo | Admin `/skills` (`skill_taxonomy:create`/`skill_taxonomy:delete`) | `apps/api/src/modules/skill-taxonomy-edges/routes.ts:32,40` · `apps/web/src/app/(authenticated)/skills/_components/skill-relations.tsx:197,212` |
| Consultare/creare/modificare/eliminare una famiglia di competenze | Completo | Admin `/skill-taxonomy` (`skill_taxonomy:create`/`update`/`delete`) | `apps/api/src/modules/skill-families/routes.ts:27,35,43,48` · `apps/web/src/app/(authenticated)/skill-taxonomy/_components/taxonomy-panels.tsx:68,86,100,111` |
| Consultare/creare/modificare una categoria di competenze | Completo | Admin `/skill-taxonomy` (`skill_taxonomy:create`/`update`) | `apps/api/src/modules/skill-categories/routes.ts:25,33,41` · `apps/web/src/app/(authenticated)/skill-taxonomy/_components/taxonomy-panels.tsx:321,337,355` |
| Consultare i livelli di padronanza (proficiency) disponibili | Completo | Admin `/skill-taxonomy` (nessun permesso dichiarato — modulo con 0 permessi in atlas) | `apps/api/src/modules/skill-proficiency-levels/routes.ts:13` · `apps/web/src/app/(authenticated)/skill-taxonomy/_components/taxonomy-panels.tsx:565` |
| Consultare la copertura delle competenze per unità organizzativa (heatmap) | Completo | Admin `/analytics/skills` (`analytics:view`) | `apps/api/src/modules/analytics/routes.ts:72` · `apps/web/src/app/(authenticated)/analytics/skills/page.tsx:63` |
| Consultare la copertura delle competenze per categoria | Completo | Admin `/analytics/skills-by-category` (`analytics:view`) | `apps/api/src/modules/analytics/routes.ts:81` · `apps/web/src/app/(authenticated)/analytics/skills-by-category/page.tsx:64` |
| Consultare la distribuzione delle competenze per gruppo | Completo | Admin `/analytics/skills-group-share` (`analytics:view`) | `apps/api/src/modules/analytics/routes.ts:108` · `apps/web/src/app/(authenticated)/analytics/skills-group-share/page.tsx:15` |
| Consultare la sintesi dei gap di competenza aziendali | Completo | Admin `/gaps` (`gap_analysis:read`) | `apps/api/src/modules/learning-gaps/routes.ts:30,50` · `apps/web/src/app/(authenticated)/gaps/page.tsx:28,38` |
| Consultare l'analisi predittiva dei gap di competenza (skill-gap insight) | Completo | Admin `/insights/skill-gap` (`insights:view`) | `apps/api/src/modules/insights/routes.ts:69` · `apps/web/src/app/(authenticated)/insights/skill-gap/page.tsx:48` |
| Ricalcolare l'analisi dei gap di competenza | Completo | Admin `/insights/skill-gap` (`insights:admin`) | `apps/api/src/modules/insights/routes.ts:75` · `apps/web/src/app/(authenticated)/insights/skill-gap/page.tsx:52` |
| Consultare l'evidenza (fonte, storia) dietro una valutazione di competenza | Completo | Admin (drawer condiviso, es. da `/insights/skill-gap`) / ESS `/me/skills` | modulo `evidence`, prefix `/v1/evidence` (2 route) · `apps/web/src/components/evidence-drawer.tsx:48` |
| Consultare le proprie competenze possedute | Completo | ESS `/me/skills` (`skill:read:self`) | `apps/api/src/modules/me/routes.ts:172,180` · `apps/web/src/app/(authenticated)/me/skills/page.tsx:38,42` |
| Autovalutare una propria competenza | Completo | ESS `/me/skills/self-assessment` | `apps/web/src/app/(authenticated)/me/skills/self-assessment/page.tsx:53` (POST `/v1/me/skills/self-assessments`) |
| Cercare competenze/occupazioni per somiglianza semantica (ricerca AI free-text) | Completo | Admin `/skills` e ESS `/me/matching` (`matching:read`) | `apps/api/src/modules/semantic-matching/routes.ts:112` (GET `/search`) · `apps/web/src/components/semantic-search-panel.tsx:42` (richiamato da `apps/web/src/app/(authenticated)/skills/page.tsx:78` e `.../me/matching/page.tsx:128`) |

## H. Talent review, successione e carriera

| Capacità (lato utente) | Stato | Superficie (SPA/ESS + permesso) | Prova (API file:riga · Web file:riga) |
|---|---|---|---|
| Consultare la griglia nine-box (potenziale × performance) | Completo | Admin `/talent-review` (`talent:read`) | `apps/api/src/modules/talent-review/routes.ts:22` · `apps/web/src/app/(authenticated)/talent-review/page.tsx:96` |
| Consultare i punteggi di fit posizione/persona | Completo | Admin `/talent-review` (`talent:read`) | `apps/api/src/modules/talent-review/routes.ts:31` · `apps/web/src/app/(authenticated)/talent-review/page.tsx:100` |
| Consultare i punteggi di readiness alla successione | Completo | Admin `/talent-review` (`talent:read`) | `apps/api/src/modules/talent-review/routes.ts:40` · `apps/web/src/app/(authenticated)/talent-review/page.tsx:101` |
| Consultare i punteggi di successione | Completo | Admin `/talent-review` (`talent:read`) | `apps/api/src/modules/talent-review/routes.ts:49` · `apps/web/src/app/(authenticated)/talent-review/page.tsx:102` |
| Consultare il catalogo delle posizioni critiche | Completo | Admin `/talent-review` (`talent:read`) | `apps/api/src/modules/talent-review/routes.ts:58` · `apps/web/src/app/(authenticated)/talent-review/page.tsx:103` |
| Consultare la copertura delle posizioni critiche | Completo | Admin `/talent-review` (`talent:read`) | `apps/api/src/modules/talent-review/routes.ts:67` · `apps/web/src/app/(authenticated)/talent-review/page.tsx:104` |
| Consultare la distribuzione di readiness dei successori | Completo | Admin `/career-succession` (`career_succession:read`) | `apps/api/src/modules/successor-candidates/routes.ts:29` · `apps/web/src/app/(authenticated)/career-succession/page.tsx:95` |
| Consultare i percorsi di carriera definiti | Completo | Admin `/career-succession` (`career_succession:read`) | `apps/api/src/modules/career-paths/routes.ts:24` · `apps/web/src/app/(authenticated)/career-succession/page.tsx:78` |
| Consultare i pool di successione | Completo | Admin `/career-succession` (`career_succession:read`) | `apps/api/src/modules/succession-pools/routes.ts:22` · `apps/web/src/app/(authenticated)/career-succession/page.tsx:83` |
| Consultare i candidati successori | Completo | Admin `/career-succession` (`career_succession:read`) | `apps/api/src/modules/successor-candidates/routes.ts:23` · `apps/web/src/app/(authenticated)/career-succession/page.tsx:88` |
| Consultare la predizione di rischio di uscita/flight-risk aziendale | Completo | Admin `/insights` (`insights:view`) | `apps/api/src/modules/insights/routes.ts:26` · `apps/web/src/app/(authenticated)/insights/page.tsx:38` |
| Ricalcolare la predizione di flight-risk | Completo | Admin `/insights` (`insights:admin`) | `apps/api/src/modules/insights/routes.ts:46` · `apps/web/src/app/(authenticated)/insights/page.tsx:42` |
| Consultare l'analisi predittiva di readiness alla successione (insight) | Completo | Admin `/insights/succession-readiness` (`insights:view`) | `apps/api/src/modules/insights/routes.ts:56` · `apps/web/src/app/(authenticated)/insights/succession-readiness/page.tsx:48` |
| Ricalcolare l'analisi di readiness alla successione | Completo | Admin `/insights/succession-readiness` (`insights:admin`) | `apps/api/src/modules/insights/routes.ts:62` · `apps/web/src/app/(authenticated)/insights/succession-readiness/page.tsx:52` |
| Consultare i propri obiettivi di carriera | Completo | ESS `/me/career` (`goal:read:self`) | `apps/api/src/modules/me/routes.ts:278` · `apps/web/src/app/(authenticated)/me/career/_components/goals-tab.tsx:21` |
| Consultare i percorsi di carriera a cui si è candidabili | Completo | ESS `/me/career` (`career_succession:read:self`) | `apps/api/src/modules/me/routes.ts:294` · `apps/web/src/app/(authenticated)/me/career/_components/paths-tab.tsx:16` |
| Consultare il proprio rischio di carriera (career risk) | Completo | ESS `/me/career` (`career_succession:read:self`) | `apps/api/src/modules/me/routes.ts:289` · `apps/web/src/app/(authenticated)/me/career/_components/risk-tab.tsx:16` |
| Consultare le posizioni disponibili per impostare un obiettivo di carriera | Completo | ESS `/me/career/target` (`position:read`) | `apps/api/src/modules/positions/routes.ts:38` · `apps/web/src/app/(authenticated)/me/career/target/page.tsx:35` |
| Impostare una posizione come proprio obiettivo di carriera | Completo | ESS `/me/career/target` (`career:request_target:self`) | `apps/api/src/modules/me/routes.ts:268` (POST `/career/target-positions`) · `apps/web/src/app/(authenticated)/me/career/target/page.tsx:45` |

## I. Performance, obiettivi e OKR

| Capacità (lato utente) | Stato | Superficie (SPA/ESS + permesso) | Prova (API file:riga · Web file:riga) |
|---|---|---|---|
| Consultare i cicli di valutazione delle performance | Completo | Admin `/performance` (`performance-review:read`) | `apps/api/src/modules/review-cycles/routes.ts:19` · `apps/web/src/app/(authenticated)/performance/page.tsx:60` |
| Consultare le sessioni di calibrazione | Completo | Admin `/performance` (`performance-review:read`) | `apps/api/src/modules/calibration-sessions/routes.ts:19` · `apps/web/src/app/(authenticated)/performance/page.tsx:70` |
| Consultare le valutazioni di performance individuali | Completo | Admin `/performance` (`performance-review:read`) | `apps/api/src/modules/performance-reviews/routes.ts:18` · `apps/web/src/app/(authenticated)/performance/page.tsx:65` |
| Consultare gli obiettivi aziendali (goal) e la loro timeline | Completo | Admin `/goals` (`goal:read`) | `apps/api/src/modules/goals/routes.ts:20` · `apps/web/src/app/(authenticated)/goals/page.tsx:47` |
| Consultare gli OKR aziendali | Completo | Admin `/okrs` (`okr:read`) | `apps/api/src/modules/okrs/routes.ts:16` · `apps/web/src/app/(authenticated)/okrs/page.tsx:42` |
| Consultare le definizioni KPI aziendali | Completo | Admin `/kpis` (`kpi:read`) | `apps/api/src/modules/kpi-definitions/routes.ts:27` · `apps/web/src/app/(authenticated)/kpis/page.tsx:57` |
| Creare una definizione KPI | Completo | Admin `/kpis` (`kpi:create`) | `apps/api/src/modules/kpi-definitions/routes.ts:65` · `apps/web/src/app/(authenticated)/kpis/_components/kpi-forms.tsx:74` |
| Modificare una definizione KPI | Completo | Admin `/kpis` (`kpi:update`) | `apps/api/src/modules/kpi-definitions/routes.ts:73` · `apps/web/src/app/(authenticated)/kpis/_components/kpi-forms.tsx:216` |
| Consultare la timeline di avanzamento di un obiettivo aziendale | Completo | Admin `/goals` (dialog di dettaglio, stesso permesso `goal:read`) | `apps/api/src/modules/goals/routes.ts:20` · `apps/web/src/components/goal-timeline-dialog.tsx` (richiamato da `apps/web/src/app/(authenticated)/goals/page.tsx:33`) |
| Consultare i propri KPI assegnati | Completo | ESS `/me/kpis` (`kpi:read:self`) | `apps/api/src/modules/me/routes.ts:386` · `apps/web/src/app/(authenticated)/me/kpis/page.tsx:32` |
| Consultare la propria valutazione di performance | Completo | ESS `/me/performance` (`assessment:read:self`) | `apps/api/src/modules/me/routes.ts:129` · `apps/web/src/app/(authenticated)/me/performance/page.tsx:36` |

## J. Apprendimento e contenuti formativi

| Capacità (lato utente) | Stato | Superficie (SPA/ESS + permesso) | Prova (API file:riga · Web file:riga) |
|---|---|---|---|
| Consultare il catalogo dei moduli di apprendimento | Completo | Admin `/learning` (`learning:read`) | `apps/api/src/modules/learning-modules/routes.ts:21` · `apps/web/src/app/(authenticated)/learning/page.tsx:53` |
| Creare un modulo di apprendimento | Completo | Admin `/learning` (`learning:create`) | `apps/api/src/modules/learning-modules/routes.ts:33` · `apps/web/src/app/(authenticated)/learning/_components/learning-forms.tsx:79` |
| Modificare un modulo di apprendimento | Completo | Admin `/learning` (`learning:update`) | `apps/api/src/modules/learning-modules/routes.ts:41` · `apps/web/src/app/(authenticated)/learning/_components/learning-forms.tsx:230` |
| Consultare i percorsi formativi (learning path) | Completo | Admin `/learning` (`learning:read`) | `apps/api/src/modules/learning-paths/routes.ts:24` · `apps/web/src/app/(authenticated)/learning/_components/learning-paths.tsx:70` |
| Creare un percorso formativo | Completo | Admin `/learning` (`learning:create`) | `apps/api/src/modules/learning-paths/routes.ts:36` · `apps/web/src/app/(authenticated)/learning/_components/learning-paths.tsx:105` |
| Modificare un percorso formativo | Completo | Admin `/learning` (`learning:update`) | `apps/api/src/modules/learning-paths/routes.ts:44` · `apps/web/src/app/(authenticated)/learning/_components/learning-paths.tsx:124` |
| Aggiungere una tappa (step) a un percorso formativo | Completo | Admin `/learning` (`learning:create`) | `apps/api/src/modules/learning-path-steps/routes.ts:35` · `apps/web/src/app/(authenticated)/learning/_components/learning-paths.tsx:377` |
| Modificare una tappa di un percorso formativo | Completo | Admin `/learning` (`learning:update`) | `apps/api/src/modules/learning-path-steps/routes.ts:43` · `apps/web/src/app/(authenticated)/learning/_components/learning-paths.tsx:404` |
| Rimuovere una tappa da un percorso formativo | Completo | Admin `/learning` (`learning:delete`) | `apps/api/src/modules/learning-path-steps/routes.ts:48` · `apps/web/src/app/(authenticated)/learning/_components/learning-paths.tsx:399` |
| Consultare le iniziative formative aziendali (training initiative) | Completo | Admin `/learning/training-initiatives` (`training_initiative:list`) | `apps/api/src/modules/training-initiatives/routes.ts:22` · `apps/web/src/app/(authenticated)/learning/training-initiatives/page.tsx:35` |
| Consultare/gestire il contenuto documentale (handbook, policy) | Completo | Admin `/content` (`content:read`) | `apps/api/src/modules/content/routes.ts:66` · `apps/web/src/app/(authenticated)/content/page.tsx:93` |
| Creare un documento di contenuto | Completo | Admin `/content` (`content:create`) | `apps/api/src/modules/content/routes.ts:81` · `apps/web/src/app/(authenticated)/content/page.tsx:126` |
| Creare/eliminare una categoria di contenuto | Completo | Admin `/content` (`content:create`/`content:delete`) | `apps/api/src/modules/content/routes.ts:42,52` · `apps/web/src/app/(authenticated)/content/page.tsx:140,151` |
| Cercare nel contenuto documentale | Completo | Admin `/content` (`content:read`) | `apps/api/src/modules/content/routes.ts:59` · `apps/web/src/app/(authenticated)/content/page.tsx:110` |
| Consultare il dettaglio e le versioni di un documento | Completo | Admin `/content/[id]` (`content:read`) | `apps/api/src/modules/content/routes.ts:37,76` · `apps/web/src/app/(authenticated)/content/[id]/page.tsx:64,68` |
| Modificare un documento di contenuto | Completo | Admin `/content/[id]` (`content:update`) | `apps/api/src/modules/content/routes.ts:86` · `apps/web/src/app/(authenticated)/content/[id]/page.tsx:107` |
| Eliminare un documento di contenuto | Completo | Admin `/content/[id]` (`content:delete`) | `apps/api/src/modules/content/routes.ts:91` · `apps/web/src/app/(authenticated)/content/[id]/page.tsx:119` |
| Sottoporre un documento a revisione (submit-for-review) | Completo | Admin `/content/[id]` (`content:update`) | `apps/api/src/modules/content/routes.ts:103` · `apps/web/src/app/(authenticated)/content/[id]/page.tsx:142` |
| Pubblicare / ritirare la pubblicazione di un documento (publish, unpublish, return-to-draft) | Completo | Admin `/content/[id]` (`content:publish`) | `apps/api/src/modules/content/routes.ts:108,113,118` · `apps/web/src/app/(authenticated)/content/[id]/page.tsx:142` |
| Ripristinare una versione precedente di un documento | Completo | Admin `/content/[id]` (`content:update`) | `apps/api/src/modules/content/routes.ts:98` · `apps/web/src/app/(authenticated)/content/[id]/page.tsx:148` |
| Collegare un documento a un processo di blueprint | Completo | Admin `/content/[id]` (`content:update`) | `apps/api/src/modules/content-blueprint-links/routes.ts:28` · `apps/web/src/app/(authenticated)/content/[id]/page.tsx:154` |
| Scollegare un documento da un processo di blueprint | Completo | Admin `/content/[id]` (`content:delete`) | `apps/api/src/modules/content-blueprint-links/routes.ts:33` · `apps/web/src/app/(authenticated)/content/[id]/page.tsx:160` |
| Consultare i propri moduli/percorsi di apprendimento assegnati | Completo | ESS `/me/learning` (`learning:read:self`) | `apps/api/src/modules/me/routes.ts:228` · `apps/web/src/app/(authenticated)/me/learning/page.tsx:16` |
| Sfogliare il catalogo formativo | Completo | ESS `/me/learning/catalogue` (`learning:read` implicito sulla lista paginata) | `apps/api/src/modules/learning-paths/routes.ts:24` (GET lista) · `apps/web/src/app/(authenticated)/me/learning/catalogue/page.tsx:27` |
| Iscriversi a un percorso formativo dal catalogo | Completo | ESS `/me/learning/catalogue` (`learning:enroll:self`) | `apps/api/src/modules/me/routes.ts:233` (POST `/learning/enrollments`) · `apps/web/src/app/(authenticated)/me/learning/catalogue/page.tsx:33` |
| Consultare le proprie certificazioni | Completo | ESS `/me/certifications` (`certification:read:self`) | `apps/api/src/modules/me/routes.ts:450` · `apps/web/src/app/(authenticated)/me/certifications/page.tsx:109` |
| Caricare una propria certificazione | Completo | ESS `/me/certifications` (`certification:upload:self`) | `apps/api/src/modules/me/routes.ts:455` · `apps/web/src/app/(authenticated)/me/certifications/page.tsx:114` |
| Consultare i propri documenti personali | Completo | ESS `/me/documents` (`document:read:self`) | `apps/api/src/modules/me/routes.ts:463` · `apps/web/src/app/(authenticated)/me/documents/page.tsx:28` |
| Sfogliare il manuale/policy aziendale (handbook) assegnato | Completo | ESS `/me/handbook` (`me:content:read`) | `apps/api/src/modules/me/routes.ts:497` · `apps/web/src/app/(authenticated)/me/handbook/page.tsx:23` |
| Leggere una pagina del manuale/policy con i relativi allegati | Completo | ESS `/me/handbook/[id]` (`me:content:read`) | `apps/api/src/modules/me/routes.ts:502,519` · `apps/web/src/app/(authenticated)/me/handbook/[id]/page.tsx:47,52` |

## K. Retribuzione e compensation intelligence

| Capacità (lato utente) | Stato | Superficie (SPA/ESS + permesso) | Prova (API file:riga · Web file:riga) |
|---|---|---|---|
| Consultare le fasce retributive (bands) | Completo | Admin `/compensation-intelligence` (`compensation_intelligence:read`) | `apps/api/src/modules/compensation/routes.ts:49` · `apps/web/src/app/(authenticated)/compensation-intelligence/page.tsx:388` |
| Consultare la distribuzione retributiva | Completo | Admin `/compensation-intelligence` (`compensation_intelligence:read`) | `apps/api/src/modules/compensation/routes.ts:74` · `apps/web/src/app/(authenticated)/compensation-intelligence/page.tsx:319` |
| Consultare i gate della retribuzione variabile (reward gates) | Completo | Admin `/compensation-intelligence` (`compensation_intelligence:read`) | `apps/api/src/modules/compensation/routes.ts:62` · `apps/web/src/app/(authenticated)/compensation-intelligence/page.tsx:309` |
| Consultare/valutare un calcolo di retribuzione variabile | Completo | Admin `/compensation-intelligence` (`compensation_intelligence:read`) | `apps/api/src/modules/compensation/routes.ts:100,110` · `apps/web/src/app/(authenticated)/compensation-intelligence/page.tsx:355,134` |
| Consultare le raccomandazioni retributive generate | Completo | Admin `/compensation-intelligence` (`compensation_intelligence:read`) | `apps/api/src/modules/compensation/routes.ts:119` · `apps/web/src/app/(authenticated)/compensation-intelligence/page.tsx:358` |
| Consultare i pool bonus | Completo | Admin `/compensation-intelligence` (`compensation_intelligence:read`) | `apps/api/src/modules/compensation/routes.ts:128` · `apps/web/src/app/(authenticated)/compensation-intelligence/page.tsx:361` |
| Consultare le regole di collegamento obiettivo↔retribuzione | Completo | Admin `/compensation-intelligence` (`compensation_intelligence:read`) | `apps/api/src/modules/compensation/routes.ts:137` · `apps/web/src/app/(authenticated)/compensation-intelligence/page.tsx:364` |
| Consultare il peso economico di una posizione | Completo | Admin `/compensation-intelligence` (`compensation_intelligence:read`) | `apps/api/src/modules/compensation/routes.ts:146` · `apps/web/src/app/(authenticated)/compensation-intelligence/page.tsx:367` |
| Consultare i record di handoff retributivo | Completo | Admin `/compensation-intelligence` (`compensation_intelligence:read`) | `apps/api/src/modules/compensation/routes.ts:155` · `apps/web/src/app/(authenticated)/compensation-intelligence/page.tsx:370` |
| Consultare la sintesi retributiva aziendale (analytics) | Completo | Admin `/analytics/compensation` (`analytics:view`) | `apps/api/src/modules/analytics/routes.ts:63` · `apps/web/src/app/(authenticated)/analytics/compensation/page.tsx:100` |
| Consultare i propri cedolini paga | Completo | ESS `/me/profile` scheda retribuzione (`user_profile:read:self`) | `apps/api/src/modules/me/routes.ts:123` · `apps/web/src/app/(authenticated)/me/profile/_components/pay-slips-tab.tsx:16` |

## L. Tempo, presenze e ferie

| Capacità (lato utente) | Stato | Superficie (SPA/ESS + permesso) | Prova (API file:riga · Web file:riga) |
|---|---|---|---|
| Consultare le richieste di ferie/permesso aziendali | Completo | Admin `/time-off` (`leave:read`) | `apps/api/src/modules/time-off/routes.ts:18` · `apps/web/src/app/(authenticated)/time-off/page.tsx:71` |
| Consultare le regole di maturazione ferie (accrual) | Completo | Admin `/time-off` (`leave:read`) | `apps/api/src/modules/time-off/routes.ts:27` · `apps/web/src/app/(authenticated)/time-off/page.tsx:76` |
| Consultare i movimenti del saldo ferie | Completo | Admin `/time-off` (`leave:read`) | `apps/api/src/modules/time-off/routes.ts:36` · `apps/web/src/app/(authenticated)/time-off/page.tsx:80` |
| Consultare le presenze/assenze aziendali (analytics) | Completo | Admin `/analytics/attendance` (`analytics:view`) | `apps/api/src/modules/analytics/routes.ts:54` · `apps/web/src/app/(authenticated)/analytics/attendance/page.tsx:93` |
| Consultare gli straordinari aziendali (analytics) | Completo | Admin `/analytics/overtime` (`analytics:view`) | `apps/api/src/modules/analytics/routes.ts:99` · `apps/web/src/app/(authenticated)/analytics/overtime/page.tsx:140` |
| Consultare le proprie presenze/timbrature | Completo | ESS `/me/time-off` (`user_profile:read:self`) | `apps/api/src/modules/me/routes.ts:135` · `apps/web/src/app/(authenticated)/me/time-off/page.tsx:41` |
| Consultare le proprie richieste di ferie/permesso | Completo | ESS `/me/time-off` (`leave:read:self`) | `apps/api/src/modules/me/routes.ts:142` · `apps/web/src/app/(authenticated)/me/time-off/page.tsx:45` |
| Richiedere ferie o un permesso | Completo | ESS `/me/time-off` (`leave:request:self`) | `apps/api/src/modules/me/routes.ts:150` · `apps/web/src/app/(authenticated)/me/time-off/page.tsx:50` |

## M. Approvazioni e notifiche

| Capacità (lato utente) | Stato | Superficie (SPA/ESS + permesso) | Prova (API file:riga · Web file:riga) |
|---|---|---|---|
| Consultare le richieste di approvazione aziendali | Completo | Admin `/approvals` (`approval:read`) | `apps/api/src/modules/approvals/routes.ts:34` · `apps/web/src/app/(authenticated)/approvals/page.tsx:58` |
| Avviare manualmente una richiesta di approvazione | Completo | Admin `/approvals` (`approval:create`) | `apps/api/src/modules/approvals/routes.ts:27` · `apps/web/src/app/(authenticated)/approvals/page.tsx:71` |
| Consultare il dettaglio di una richiesta di approvazione | Completo | Admin `/approvals/[id]` (`approval:read`) | `apps/api/src/modules/approvals/routes.ts:39` · `apps/web/src/app/(authenticated)/approvals/[id]/page.tsx:35` |
| Approvare o rifiutare uno step di una richiesta | Completo | Admin `/approvals/[id]` (`approval:decide`) | `apps/api/src/modules/approvals/routes.ts:44` (POST `/:id/steps/:stepId/decide`) · `apps/web/src/app/(authenticated)/approvals/[id]/page.tsx:40,118,121` |
| Applicare (eseguire) una richiesta di approvazione già approvata | Completo | Admin `/approvals/[id]` (`approval:create`) | `apps/api/src/modules/approvals/routes.ts:53` · `apps/web/src/app/(authenticated)/approvals/[id]/page.tsx:56` |
| Consultare la propria inbox di notifiche/approvazioni | Completo | ESS `/me/inbox` (`notification:read:self`) | `apps/api/src/modules/me/routes.ts:311` · `apps/web/src/app/(authenticated)/me/inbox/page.tsx:89` |
| Approvare o rifiutare uno step di approvazione direttamente dall'inbox | Completo | ESS `/me/inbox` (`approval:decide`) | `apps/api/src/modules/approvals/routes.ts:44` · `apps/web/src/app/(authenticated)/me/inbox/page.tsx:101` |
| Consultare le proprie richieste di approvazione avviate | Completo | ESS `/me/approvals` (`approval:read:self`) | `apps/api/src/modules/me/routes.ts:306` · `apps/web/src/app/(authenticated)/me/approvals/page.tsx:18` |

## N. Engagement e survey

| Capacità (lato utente) | Stato | Superficie (SPA/ESS + permesso) | Prova (API file:riga · Web file:riga) |
|---|---|---|---|
| Consultare i sondaggi di engagement aziendali | Completo | Admin `/engagement` (`surveys:read`) | `apps/api/src/modules/engagement/routes.ts:20` · `apps/web/src/app/(authenticated)/engagement/page.tsx:44` |
| Consultare il polso (pulse) di engagement aziendale | Completo | Admin `/engagement` (`surveys:read`) | `apps/api/src/modules/engagement/routes.ts:30` · `apps/web/src/app/(authenticated)/engagement/page.tsx:48` |
| Consultare i risultati di un sondaggio di engagement | Completo | Admin `/engagement/[surveyId]` (`surveys:read`) | `apps/api/src/modules/engagement/routes.ts:25` · `apps/web/src/app/(authenticated)/engagement/[surveyId]/page.tsx:35` |
| Consultare i propri sondaggi da compilare | Completo | ESS `/me/surveys` (`surveys:respond:self`) | `apps/api/src/modules/me/routes.ts:197` · `apps/web/src/app/(authenticated)/me/surveys/page.tsx:15` |
| Aprire un proprio sondaggio da compilare | Completo | ESS `/me/surveys/[surveyId]` (`surveys:respond:self`) | `apps/api/src/modules/me/routes.ts:204` · `apps/web/src/app/(authenticated)/me/surveys/[surveyId]/page.tsx:27` |
| Rispondere a un proprio sondaggio | Completo | ESS `/me/surveys/[surveyId]` (`surveys:respond:self`) | `apps/api/src/modules/me/routes.ts:211` (POST `/surveys/:surveyId/responses`) · `apps/web/src/app/(authenticated)/me/surveys/[surveyId]/page.tsx:45` |

## O. Processi, blueprint e org design

| Capacità (lato utente) | Stato | Superficie (SPA/ESS + permesso) | Prova (API file:riga · Web file:riga) |
|---|---|---|---|
| Consultare la mappa dei processi di blueprint (catalogo processi) | Completo | Admin `/processes` (`blueprint:read`) | `apps/api/src/modules/blueprint-processes/routes.ts:15` · `apps/web/src/app/(authenticated)/processes/page.tsx:28` |
| Consultare le famiglie di blueprint | Completo | Admin `/blueprints` (`blueprint:read`) | `apps/api/src/modules/blueprint-families/routes.ts:15` · `apps/web/src/app/(authenticated)/blueprints/page.tsx:104` |
| Consultare le varianti di blueprint | Completo | Admin `/blueprints` (`blueprint:read`) | `apps/api/src/modules/blueprint-variants/routes.ts:15` · `apps/web/src/app/(authenticated)/blueprints/page.tsx:109` |
| Consultare il dettaglio di una variante di blueprint | Completo | Admin `/blueprints/[variantId]` (`blueprint:read`) | `apps/api/src/modules/blueprint-variants/routes.ts:19` · `apps/web/src/app/(authenticated)/blueprints/[variantId]/page.tsx:45` |
| Consultare le attivazioni di blueprint per tenant | Completo | Admin `/blueprints` (`blueprint:read`) | `apps/api/src/modules/blueprint-activations/routes.ts:16` · `apps/web/src/app/(authenticated)/blueprints/page.tsx:80` |
| Attivare un blueprint su un tenant | Completo | Admin `/blueprints` (`blueprint:activate`) | `apps/api/src/modules/blueprint-activations/routes.ts:24` · `apps/web/src/app/(authenticated)/blueprints/page.tsx:85` |
| Consultare l'elenco dei tenant blueprint (progetti di configurazione tenant) | Completo | Admin `/tenant-blueprints` (`tenant_blueprint:read`) | `apps/api/src/modules/tenant-blueprints/routes.ts:47` · `apps/web/src/app/(authenticated)/tenant-blueprints/page.tsx:74` |
| Creare un tenant blueprint | Completo | Admin `/tenant-blueprints` (`tenant_blueprint:write`) | `apps/api/src/modules/tenant-blueprints/routes.ts:59` · `apps/web/src/app/(authenticated)/tenant-blueprints/page.tsx:79` |
| Consultare il dossier di un tenant blueprint | Completo | Admin `/tenant-blueprints/[id]` (`tenant_blueprint:read`) | `apps/api/src/modules/tenant-blueprints/routes.ts:74` · `apps/web/src/app/(authenticated)/tenant-blueprints/[id]/page.tsx:51` |
| Modificare l'identità di un tenant blueprint (dati anagrafici del progetto) | Completo | Admin `/tenant-blueprints/[id]` (`tenant_blueprint:write`) | `apps/api/src/modules/tenant-blueprints/routes.ts:136` (PATCH `/:id/versions/:number/identity`) · `apps/web/src/app/(authenticated)/tenant-blueprints/[id]/page.tsx:172` |
| Impostare il modello di riferimento (variante) del tenant blueprint | Completo | Admin `/tenant-blueprints/[id]` (`tenant_blueprint:write`) | `apps/api/src/modules/tenant-blueprints/routes.ts:158` (PUT `/:id/versions/:number/model`) · `apps/web/src/app/(authenticated)/tenant-blueprints/[id]/page.tsx:355` |
| Modificare un processo del tenant blueprint | Completo | Admin `/tenant-blueprints/[id]` (`tenant_blueprint:write`) | `apps/api/src/modules/tenant-blueprints/routes.ts:181` (PATCH `/:id/versions/:number/processes/:processId`) · `apps/web/src/app/(authenticated)/tenant-blueprints/[id]/page.tsx:498` |
| Rimuovere un processo dal tenant blueprint | Completo | Admin `/tenant-blueprints/[id]` (`tenant_blueprint:write`) | `apps/api/src/modules/tenant-blueprints/routes.ts:203` (DELETE `/:id/versions/:number/processes/:processId`) · `apps/web/src/app/(authenticated)/tenant-blueprints/[id]/page.tsx:507` |
| Sottoporre una versione del tenant blueprint (submit) | Completo | Admin `/tenant-blueprints/[id]` (`tenant_blueprint:write`) | `apps/api/src/modules/tenant-blueprints/routes.ts:244` (POST `/:id/versions/:number/submit`) · `apps/web/src/app/(authenticated)/tenant-blueprints/[id]/page.tsx:597` |
| Consultare la proposta di modello (model-proposal) di un tenant blueprint | Completo | Admin `/tenant-blueprints/[id]` (`tenant_blueprint:read`) | `apps/api/src/modules/tenant-blueprints/routes.ts:149` (GET `/:id/versions/:number/model-proposal`) · `apps/web/src/app/(authenticated)/tenant-blueprints/[id]/page.tsx:349` |
| Consultare i processi di una versione del tenant blueprint | Completo | Admin `/tenant-blueprints/[id]` (`tenant_blueprint:read`) | `apps/api/src/modules/tenant-blueprints/routes.ts:172` (GET `/:id/versions/:number/processes`) · `apps/web/src/app/(authenticated)/tenant-blueprints/[id]/page.tsx:450` |
| Generare il piano di costruzione (build-plan) di una versione | Completo | Admin `/tenant-blueprints/[id]/versions/[n]/build` (`tenant_blueprint:write`) | `apps/api/src/modules/tenant-blueprints/routes.ts:223` (POST `/:id/versions/:number/build-plan`) · `apps/web/src/app/(authenticated)/tenant-blueprints/[id]/versions/[n]/build/page.tsx:81` |
| Applicare (apply) il piano di costruzione a un tenant | Completo | Admin `/tenant-blueprints/[id]/versions/[n]/build` (`tenant_blueprint:write`) | `apps/api/src/modules/tenant-blueprints/routes.ts:235` (POST `/:id/versions/:number/apply`) · `apps/web/src/app/(authenticated)/tenant-blueprints/[id]/versions/[n]/build/page.tsx:100` |
| Confrontare (diff) una versione del tenant blueprint con il modello più recente | Completo | Admin `/tenant-blueprints/[id]/versions/[n]/diff` (`tenant_blueprint:read`) | `apps/api/src/modules/tenant-blueprints/routes.ts:253` (GET `/:id/versions/:number/diff`) · `apps/web/src/app/(authenticated)/tenant-blueprints/[id]/versions/[n]/diff/page.tsx:31` |
| Consultare le classificazioni di attività (ATECO/settore) per un tenant blueprint | Completo | Admin `/tenant-blueprints/[id]` (`enterprise_typing:read`) | `apps/api/src/modules/activity-classifications/routes.ts:16` · `apps/web/src/app/(authenticated)/tenant-blueprints/[id]/page.tsx:155` |
| Consultare la composizione delle capability organizzative | Completo | Admin `/org-director` (`capability:read`) | `apps/api/src/modules/capability-composition/routes.ts:26` · `apps/web/src/app/(authenticated)/org-director/page.tsx:81` |
| Consultare la maturità delle capability organizzative | Completo | Admin `/org-director` (`capability:read`) | `apps/api/src/modules/capability-maturity/routes.ts:23` · `apps/web/src/app/(authenticated)/org-director/page.tsx:85` |
| Consultare la classifica delle capability essenziali (essential-ranking) | Completo | Admin `/org-director` (`capability:read`) | `apps/api/src/modules/capability-composition/routes.ts:38` · `apps/web/src/app/(authenticated)/org-director/page.tsx:90` |
| Consultare l'advisor strategico (suggerimenti org design) | Completo | Admin `/org-director/advisor` (`org_director:read`) | `apps/api/src/modules/advisor/routes.ts:19` · `apps/web/src/app/(authenticated)/org-director/advisor/page.tsx:85` |
| Consultare la salute organizzativa aggregata (org-health) | Completo | Admin `/org-director/health` (`org_director:read`) | `apps/api/src/modules/org-health/routes.ts:18` · `apps/web/src/app/(authenticated)/org-director/health/page.tsx:113` |
| Consultare l'analisi VRIO delle capability | Completo | Admin `/org-director/vrio` (`capability:read`) | `apps/api/src/modules/capability-composition/routes.ts:52` · `apps/web/src/app/(authenticated)/org-director/vrio/page.tsx:113` |
| Consultare il profilo di enterprise typing di un tenant | Completo | Admin `/tenants/[tenantId]` (`enterprise_typing:read`) | `apps/api/src/modules/enterprise-typing-profiles/routes.ts:16` · `apps/web/src/app/(authenticated)/tenants/[tenantId]/page.tsx:59` |
| Consultare i modelli operativi disponibili | Completo | Admin `/tenants/[tenantId]/enterprise-typing` (`operating_model:read`) | `apps/api/src/modules/operating-models/routes.ts:17` · `apps/web/src/app/(authenticated)/tenants/[tenantId]/enterprise-typing/page.tsx:50` |
| Creare/aggiornare il profilo di enterprise typing di un tenant | Parziale | Admin `/tenants/[tenantId]/enterprise-typing` (`enterprise_typing:update`) | `apps/api/src/modules/enterprise-typing-profiles/routes.ts:24` (solo `app.put("/", ...)`, nessuna route POST) · `apps/web/src/app/(authenticated)/tenants/[tenantId]/enterprise-typing/page.tsx:64` (invia `method: "POST"`) — manca: il metodo HTTP inviato dalla pagina (POST) non ha una route corrispondente nel modulo (che espone solo GET/PUT/DELETE); ogni tentativo di salvataggio da questa pagina restituisce un errore di rotta non trovata |
| Consultare le fasce dimensionali d'impresa (enterprise size band) | Completo | Admin `/tenants/[tenantId]/enterprise-typing` (`enterprise_typing:read`) | `apps/api/src/modules/enterprise-size-bands/routes.ts:15` · `apps/web/src/app/(authenticated)/tenants/[tenantId]/enterprise-typing/page.tsx:54` |

## P. Visualizzazioni e org network

| Capacità (lato utente) | Stato | Superficie (SPA/ESS + permesso) | Prova (API file:riga · Web file:riga) |
|---|---|---|---|
| Consultare l'elenco dei grafici salvati | Completo | Admin `/visualizations` (`visualization:read`) | `apps/api/src/modules/visualization-graphs/routes.ts:18` · `apps/web/src/app/(authenticated)/visualizations/page.tsx:54` |
| Consultare gli export dei grafici prodotti | Completo | Admin `/visualizations` (`visualization:read`) | `apps/api/src/modules/visualization-exports/routes.ts:15` · `apps/web/src/app/(authenticated)/visualizations/page.tsx:65` |
| Consultare il dettaglio di un grafico (nodi, archi) | Completo | Admin `/visualizations/[graphId]` (`visualization:read`) | `apps/api/src/modules/visualization-graphs/routes.ts:23` · `apps/web/src/app/(authenticated)/visualizations/[graphId]/page.tsx:66` |
| Salvare una nuova versione di un grafico | Completo | Admin `/visualizations/[graphId]` (`visualization:create`) | `apps/api/src/modules/visualization-graphs/routes.ts:52` · `apps/web/src/app/(authenticated)/visualizations/[graphId]/page.tsx:112` |
| Esportare un grafico (es. PNG/PDF) | Completo | Admin `/visualizations/[graphId]` (`visualization:create`) | `apps/api/src/modules/visualization-exports/routes.ts:23` · `apps/web/src/app/(authenticated)/visualizations/[graphId]/page.tsx:127` |
| Consultare le versioni salvate di un grafico | Completo | Admin `/visualizations/[graphId]` (`visualization:read`) | `apps/api/src/modules/visualization-graphs/routes.ts:47` · `apps/web/src/app/(authenticated)/visualizations/[graphId]/page.tsx:97` |
| Consultare l'analisi della rete organizzativa (org-network analytics) | Completo | Admin `/analytics/org-network` (`analytics:view`) | `apps/api/src/modules/analytics/routes.ts:90` · `apps/web/src/app/(authenticated)/analytics/org-network/page.tsx:115` |
| Consultare la forza lavoro aziendale (analytics workforce) | Completo | Admin `/analytics/workforce` (`analytics:view`) | `apps/api/src/modules/analytics/routes.ts:36` · `apps/web/src/app/(authenticated)/analytics/workforce/page.tsx:79` |
| Consultare i KPI aziendali in forma aggregata (analytics KPI) | Completo | Admin `/analytics/kpi` (`analytics:view`) | `apps/api/src/modules/analytics/routes.ts:45` · `apps/web/src/app/(authenticated)/analytics/kpi/page.tsx:24` |

## Q. Amministrazione tenant e piattaforma

| Capacità (lato utente) | Stato | Superficie (SPA/ESS + permesso) | Prova (API file:riga · Web file:riga) |
|---|---|---|---|
| Consultare l'elenco dei tenant | Completo | Admin `/tenants` (`tenant:read`) | `apps/api/src/modules/tenants/routes.ts:31` · `apps/web/src/app/(authenticated)/tenants/page.tsx:69` |
| Creare un tenant | Completo | Admin `/tenants` (`tenant:create`) | `apps/api/src/modules/tenants/routes.ts:72` · `apps/web/src/app/(authenticated)/tenants/page.tsx:47` |
| Eliminare un tenant | Completo | Admin `/tenants` (`tenant:delete`) | `apps/api/src/modules/tenants/routes.ts:124` · `apps/web/src/app/(authenticated)/tenants/page.tsx:62` |
| Consultare i codici industry/ATECO disponibili per un tenant | Completo | Admin `/tenants` (`tenant:read`) | `apps/api/src/modules/tenants/routes.ts:47` · `apps/web/src/app/(authenticated)/tenants/page.tsx:42` |
| Consultare il dettaglio di un tenant | Completo | Admin `/tenants/[tenantId]` (`tenant:read`) | `apps/api/src/modules/tenants/routes.ts:59` (GET `/:id`) · `apps/web/src/app/(authenticated)/tenants/[tenantId]/page.tsx:52` |
| Consultare la sintesi di provenienza dei dati (data lineage) | Completo | Admin `/provenance` (`provenance:read`) | `apps/api/src/modules/provenance/routes.ts:28` · `apps/web/src/app/(authenticated)/provenance/page.tsx:61` |
| Consultare il dettaglio di provenienza di un record | Completo | Admin `/provenance` (`provenance:read`) | `apps/api/src/modules/provenance/routes.ts:23` · `apps/web/src/app/(authenticated)/provenance/page.tsx:66` |
| Consultare la sintesi dei record generati automaticamente (generated origins) | Completo | Admin `/generated-origins` (`provenance:read`) | `apps/api/src/modules/generated-origins/routes.ts:31` · `apps/web/src/app/(authenticated)/generated-origins/page.tsx:86` |
| Consultare l'elenco dei record generati automaticamente | Completo | Admin `/generated-origins` (`provenance:read`) | `apps/api/src/modules/generated-origins/routes.ts:23` · `apps/web/src/app/(authenticated)/generated-origins/page.tsx:91` |
| Consultare le corse di acquisizione dati (seed acquisition run) | Completo | Admin `/seed-acquisition/runs` (`seed_acquisition:read`) | `apps/api/src/modules/seed-acquisition-runs/routes.ts:18` · `apps/web/src/app/(authenticated)/seed-acquisition/runs/page.tsx:42` |

## R. Whistleblowing (console interna)

| Capacità (lato utente) | Stato | Superficie (SPA/ESS + permesso) | Prova (API file:riga · Web file:riga) |
|---|---|---|---|
| Consultare le segnalazioni ricevute | Completo | Admin `/whistleblowing-console` (`whistleblowing:read`) | `apps/api/src/modules/whistleblowing/routes.ts:54` · `apps/web/src/app/(authenticated)/whistleblowing-console/page.tsx:53` |
| Consultare il dettaglio di una segnalazione | Completo | Admin `/whistleblowing-console` (`whistleblowing:read`) | `apps/api/src/modules/whistleblowing/routes.ts:63` · `apps/web/src/app/(authenticated)/whistleblowing-console/page.tsx:58` |
| Gestire (aggiornare stato/esito di) una segnalazione | Completo | Admin `/whistleblowing-console` (`whistleblowing:manage`) | `apps/api/src/modules/whistleblowing/routes.ts:72` · `apps/web/src/app/(authenticated)/whistleblowing-console/page.tsx:79` |

## S. Portale ESS — profilo personale, team e matching

| Capacità (lato utente) | Stato | Superficie (SPA/ESS + permesso) | Prova (API file:riga · Web file:riga) |
|---|---|---|---|
| Consultare il proprio profilo anagrafico | Completo | ESS `/me/profile` (`user_profile:read:self`) | `apps/api/src/modules/me/routes.ts:100` · `apps/web/src/app/(authenticated)/me/profile/page.tsx:125` |
| Modificare il proprio profilo (dati modificabili dall'utente) | Completo | ESS `/me/profile` (`user_profile:update:self`) | `apps/api/src/modules/me/routes.ts:105` · `apps/web/src/app/(authenticated)/me/profile/page.tsx:130` |
| Consultare il proprio dossier completo (profilo esteso) | Completo | ESS `/me/profile` (`user_profile:read:self`) | `apps/api/src/modules/me/routes.ts:111` (GET `/profile/full`) · `apps/web/src/app/(authenticated)/me/profile/page.tsx:211` |
| Consultare i propri dati contrattuali | Completo | ESS `/me/profile` scheda contratti (`user_profile:read:self`) | `apps/api/src/modules/me/routes.ts:117` · `apps/web/src/app/(authenticated)/me/profile/_components/contracts-tab.tsx:16` |
| Consultare le proprie esperienze professionali pregresse | Completo | ESS `/me/profile` scheda esperienze (`user_profile:read:self`) | `apps/api/src/modules/me/routes.ts:223` · `apps/web/src/app/(authenticated)/me/profile/_components/experiences-tab.tsx:20` |
| Consultare la propria analisi di sviluppo/analytics personale | Completo | ESS `/me/analytics` (`user_profile:read:self` / `insight:read:self`) | `apps/api/src/modules/me/routes.ts:300,393` · `apps/web/src/app/(authenticated)/me/analytics/page.tsx:17,21` |
| Consultare i membri del proprio team (per i responsabili) | Completo | ESS `/me/team` (`team:read:self`) | `apps/api/src/modules/me/routes.ts:482` · `apps/web/src/app/(authenticated)/me/team/page.tsx:18` |
| Consultare i propri gap di competenza | Completo | ESS `/me/gaps` (`gap_analysis:read:self`) | `apps/api/src/modules/me/routes.ts:241` · `apps/web/src/app/(authenticated)/me/gaps/page.tsx:16` |
| Consultare il proprio matching con le occupazioni ESCO | Completo | ESS `/me/matching` (`matching:read`) | `apps/api/src/modules/semantic-matching/routes.ts:43` · `apps/web/src/app/(authenticated)/me/matching/page.tsx:45` |
| Consultare il proprio matching con le posizioni aperte | Completo | ESS `/me/matching` (`matching:read`) | `apps/api/src/modules/semantic-matching/routes.ts:61` · `apps/web/src/app/(authenticated)/me/matching/page.tsx:49` |
| Consultare il proprio matching con i ruoli professionali | Completo | ESS `/me/matching` (`matching:read`) | `apps/api/src/modules/semantic-matching/routes.ts:80` · `apps/web/src/app/(authenticated)/me/matching/page.tsx:53` |

## T. Strumenti interni

| Capacità (lato utente) | Stato | Superficie (SPA/ESS + permesso) | Prova (API file:riga · Web file:riga) |
|---|---|---|---|
| Dialogare con l'agente AI interno e approvare/negare le sue scritture (console sviluppo) | Parziale | Admin `/dev/agent`, gated dal flag build-time `NEXT_PUBLIC_ENABLE_AGENT_DEV` — nessun link di navigazione la punta (raggiungibile solo digitando l'URL) | `apps/web/src/app/(authenticated)/dev/agent/page.tsx:121,147` (chiama un gateway esterno `agent-gateway`, non una route `/v1/*` di questo repo) — manca: nessun collegamento dal menu, dipende da un servizio esterno con credenziali dichiarate `blocked-on-Enzo` nel commento del file (riga 21) |

---

## → Latente (endpoint presente, nessuna schermata lo chiama)

Verificato con `grep -rl "<nome-modulo>" apps/web/src --include="*.ts" --include="*.tsx" | grep -v /showcase/` (2026-08-25): zero occorrenze per ciascuno dei moduli seguenti (nome modulo = directory in `apps/api/src/modules/`). Solo nomi, nessun approfondimento — di competenza di un altro agente:

- activity-classification-mappings
- assessment-methods
- assessment-results
- assessments
- blueprint-overrides
- career-path-steps
- delegations
- engagement-feedback
- gdpr
- mentorship
- notifications (broadcast admin — l'inbox self-service `/v1/me/inbox` è invece usata, vedi area M)
- occupation-classifications
- organization-unit-history
- organization-unit-kpi-templates
- position-career-paths
- position-succession-relevance
- predictions
- process-kpi-templates
- reference-sync
- research
- seed-approval-decisions
- seed-candidate-records
- successor-readiness
- surveys (creazione/gestione admin dei sondaggi — la sola lettura `/v1/engagement/*` è usata, vedi area N)
- teams (creazione/gestione team come entità propria — `/v1/me/team` è un'altra rotta, self-scope, usata in area S)
- tenant-materialization
- user-career-plans
- user-target-positions
- visualization-layouts
- visualization-node-layouts
- visualization-styles

Capacità singole latenti dentro moduli altrimenti usati (endpoint puntuale senza chiamante web, non l'intero modulo):

- creare un utente (`POST /v1/users`)
- disattivare un utente (`DELETE /v1/users/:id`)
- eliminare fisicamente un utente (`DELETE /v1/users/:id/purge`)
- eliminare un'unità organizzativa (`DELETE /v1/organization-units/:id`)
- aggiungere/rimuovere un requisito di competenza su una posizione (`POST`/`DELETE /v1/positions/:id/skills`)
- aggiungere/modificare/rimuovere un requisito KPI su una posizione (`POST`/`PATCH`/`DELETE /v1/positions/:id/kpis`)
- consultare la storia dei requisiti di competenza di una posizione (`GET /v1/positions/:id/skill-requirements/history`)
- consultare/ottenere il Position Intelligence Profile (`GET /v1/positions/:id/intelligence-profile`)
- modificare un tenant (`PATCH /v1/tenants/:id`)
- effettuare il provisioning guidato di un tenant (`POST /v1/tenants/provision`)
- consultare gli utenti simili per matching semantico e i similar-skill (`GET /v1/matching/users/:userId/*`, `GET /v1/matching/skills/:skillId/similar`)
- ri-costruire l'indice di ricerca semantica (`POST /v1/matching/reindex`)

## Da verificare (fatti non pienamente accertabili in questa sessione)

- Alcuni permessi non erano estraibili dal grep automatico su route registrate con costanti (`requirePermission(WRITE)` invece di una stringa letterale) — per i moduli `tenant-blueprints` e `capability-maturity` sono stati letti a mano dal sorgente e riportati corretti; altri moduli minori con lo stesso pattern potrebbero non essere stati controllati singolarmente.
- Il numero di occorrenze `apiFetch(` senza generic esplicito trovato con una seconda passata (14, vedi correzioni sopra) segnala che l'estrazione automatica iniziale (basata su `apiFetch<...>(`) non era esaustiva al 100%: le 228 righe di questa tabella sono state verificate una per una nel codice, ma un'ulteriore mutazione isolata scritta con un pattern ancora diverso (es. dentro un hook custom non elencato in `apps/web/src/lib/api/`) non è escluso possa essere sfuggita.

## Conteggi finali (misurati in questa sessione, comandi riportati)

```bash
grep -c "^| .* | Completo | " docs/vision/DREAM_2026-08-25/_raccolta/inventario_raw.md   # 226
grep -c "^| .* | Parziale | " docs/vision/DREAM_2026-08-25/_raccolta/inventario_raw.md   # 2
grep -c "^## [A-Z]\. " docs/vision/DREAM_2026-08-25/_raccolta/inventario_raw.md          # 20 aree funzionali
```

Nota di metodo: un conteggio con `grep -c "| Completo |"` senza l'ancora `^|` intercetta anche la riga di comando stessa dentro questo blocco (falso positivo da auto-riferimento) — l'ancora a inizio riga lo evita.

- **Totale voci in inventario**: 228 (226 Completo, 2 Parziale).
- **Aree funzionali coperte**: 20 (A→T, elencate nell'indice sopra).
- **Moduli API interamente latenti** (nessun consumer web trovato): 31.
- **Capacità puntuali latenti dentro moduli altrimenti usati**: 12 elencate sopra.
