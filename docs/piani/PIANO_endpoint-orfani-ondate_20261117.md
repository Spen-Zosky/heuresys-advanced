# Piano — endpoint senza consumatori, ondate 1-5 (2026-11-17)

Mandato: Enzo ha approvato le 5 ondate nell'ordine proposto dalla classifica `docs/kb/analisi/endpoint-orfani/ENDPOINT_ORFANI_CLASSIFICATI_20261116.tsv` (PR #280). Criteri: (a) manca la schermata, (b) all'agente con le scritture approvate dall'utente, (c) ritiro disattivando, senza cancellazioni. Una PR per ondata; «fatta» solo con una prova dal vivo riproducibile. Rilascio solo con il turno libero, CI verde, backup verificato e verifica dal vivo.

Come si rimisura: `awk -F'\t' 'NR>1{print $10" "$5}' docs/kb/analisi/endpoint-orfani/ENDPOINT_ORFANI_CLASSIFICATI_20261116.tsv | sort | uniq -c`.

| id | cosa | chi | fatta vuol dire | stato |
|---|---|---|---|---|
| O1 | Vocabolario comune e distanza dal modello in `/consolidation` (PR #280) | Claude | PR #280 unita e rilasciata, pagina provata dal vivo come Direttore HR | ACTIVE |
| O2 | Azioni sulle schede esistenti (classe a, ondata 2) | Claude | PR unita e rilasciata, spec `ondata2-azioni-schede.spec.ts` verde, giro reversibile dal vivo | ACTIVE |
| O3 | Pagine nuove e sicurezza: team (nuova `/teams`, voce di menu da migrazione), mentoring, sondaggi, GDPR, carriere, sicurezza dell'utente | Claude | come sopra, una prova per pagina | ACTIVE |
| O4 | Strumenti dell'agente (classe b) e prova dal vivo delle 140 letture dell'agente | Claude | strumenti con approvazione in `write-gate.ts`, giro dell'agente provato dal vivo | ACTIVE · assorbita in F1 del piano Heuresys AI-driven (riesame Z4 del 2026-11-26, `docs/piani/ai-driven_20261126/RIESAME_programmi.md`); questa riga resta la fonte del dettaglio |
| O5 | Cataloghi (classe a, ondata 5) e ritiri (classe c, disattivando) | Claude | PR unita e rilasciata; un ritiro si vede come rotta disattivata, nessuna riga cancellata | ACTIVE |

## Ondata 2 — voci e file

| endpoint | dove | file |
|---|---|---|
| `POST/DELETE /v1/positions/:id/skills` | `/positions/[id]/skills` | `positions/[positionId]/_components/requisiti-modifica.tsx`, `skills/page.tsx` |
| `POST/PATCH/DELETE /v1/positions/:id/kpis` | `/positions/[id]/kpis` | stesso componente, `kpis/page.tsx` |
| `POST /v1/user-position-assignments`, `/:id/terminate`, `/:id/transfer` | `/positions/[id]` | `_components/titolari-posizione.tsx` (crea richieste di approvazione, non incarichi) |
| `POST/PATCH /v1/projects`, `PATCH /:id/progress`, `PUT/DELETE /:id/members/:userId` | `/projects`, `/projects/[id]` | `projects/gestione-progetto.tsx` |
| `POST/PATCH /v1/training-initiatives` | `/learning/training-initiatives` | `iniziative-forms.tsx` |
| `PATCH /v1/content/categories/:id` | `/content` (scheda Categorie) | `content/categoria-rinomina.tsx` |
| `POST /v1/content/:id/return-to-draft`, `/unpublish` | `/content/[id]` | già chiamati da `transition.mutate(...)`: falso orfano dell'estrattore (percorso composto) |
| `POST /v1/delegations`, `/:id/revoke` | `/admin/roles` | `admin/roles/_components/deleghe-amministrazione.tsx` |
| `PATCH /v1/candidates/:id`, `PATCH /v1/interview-feedback/:id` | `/recruiting/applications/[id]` | `recruiting/applications/[id]/correzioni.tsx` |
| `PATCH /v1/me/notification-preferences`, `POST /v1/me/gdpr/export`, `POST /v1/me/consents` | `/me/security` | `me/security/privacy-notifiche.tsx` |
| `POST/PATCH /v1/teams`, `PUT/DELETE /:id/members/:userId` | nuova `/teams` | spostata in O3: chiede una pagina nuova e la voce di menu da migrazione |

Simulazione: tutte le rotte esistono con il loro permesso (`requirePermission`), i comandi compaiono solo a chi ha quel permesso, i dati vengono dalle `/v1/*` vive; nessun tocco al database né all'API. La prova E2E cambia e rimette com'era (reversibile).

## Ondata 3a — schede esistenti

| endpoint | dove | file |
|---|---|---|
| `career-paths`, `career-path-steps`, `position-career-paths`, `succession-pools`, `position-succession-relevance`, `successor-candidates`, `successor-readiness` (scritture) | `/career-succession` | `career-succession/gestione.tsx` |
| `POST /v1/review-cycles/:id/transition` | `/performance` | `performance/avanza-ciclo.tsx` |
| `PATCH /v1/skill-aliases/:id` | `/skills/[id]` | `skills/_components/skill-relations.tsx` |
| `POST/DELETE /v1/organization-unit-processes` | `/process-owner` | `process-owner/assegna-unita.tsx` |
| `PATCH /v1/tenants/:id`, `POST /v1/platform-tenant-assignments`, `/:id/revoke` | `/tenants/[id]` | `tenants/[tenantId]/gestione-tenant.tsx` |
| `GET/POST /v1/auth/mfa/recovery-codes` | `/me/security` | `components/sicurezza-accessi.tsx` |
| `GET /v1/auth/admin/users/:id/sessions`, `POST /v1/auth/admin/revoke-user/:id` | `/users/[id]` | stesso componente |
| `POST /v1/compensation/recommendations` | `/compensation-intelligence` | `compensation-intelligence/nuova-raccomandazione.tsx` |
| `POST /v1/capability/composition/recompute`, `/maturity/recompute` | `/org-director` | `org-director/ricalcola.tsx` (lavoro lungo con `LavoroInCorso`) |

Prova: `apps/web/tests/e2e/ondata3-schede-esistenti.spec.ts`. I gesti che non si disfano (fase di un ciclo, stato di un tenant, rigenerazione dei codici) si provano fino al comando visibile, senza premerlo.

## Ondata 3b — pagine nuove (PR a sé)

Mentoring (`/mentorship`), riscontri e piani d'azione sul clima (nella pagina esistente `/engagement`), valutazioni delle competenze (`/learning/assessments`), GDPR dell'amministrazione (`/admin/gdpr`), capacità dell'agente (`/admin/agent-capabilities`). Nessuna migrazione di menu: ogni pagina entra come scheda di un gruppo di `section-tabs.tsx` (seconda porta ammessa da `check_pagine_raggiungibili.py`), e la scheda compare solo con il permesso di lettura del suo modulo (`PERMESSI_SCHEDE`). `/mentorship` nella Carriera, `/assessments` accanto a `/performance`, `/admin/gdpr` accanto a `/provenance`, `/admin/agent-capabilities` accanto a `/admin/roles`; riscontri e piani d'azione nella pagina `/engagement`. Prova: `apps/web/tests/e2e/ondata3-pagine-nuove.spec.ts`.

## Voce 3c — un solo modello di sondaggio (deciso il 2026-11-17)

Decisione (coordinatore per Enzo, delega sulle decisioni raccomandate): resta il modello della pagina `/engagement` (`sys_surveys`, `sys_survey_questions`, `sys_survey_responses`, `sys_survey_templates`); i dati di `sys_engagement_surveys`, `sys_engagement_survey_templates`, `sys_engagement_survey_responses` vi si trasferiscono; il modello vecchio si disattiva, non si cancella.

Mappatura misurata il 2026-11-17 (`information_schema.columns` e campioni): nessuna sovrapposizione di chiavi naturali né di titoli fra i due modelli. Le domande vecchie stanno in `survey_questions` (jsonb `[{id,text,type,scale}]`) e vanno espanse in righe di `sys_survey_questions`; le risposte vecchie sono una riga per persona con `response_answers` jsonb in due forme (`{question_id,value,question_type}` e `{question_id,rating|nps|text}`) e vanno espanse in una riga per domanda con il valore nella colonna tipizzata (`rating_value`, `text_value`, `choice_value`). Stato e tipo vanno ricondotti ai CHECK del modello nuovo (da leggere nel file che crea le tabelle prima di scrivere).

Esecuzione: migrazione `-- @migrate: once` con giornale `staging.*_undo`, conteggi prima/dopo come post-condizione (sondaggi, domande attese = somma delle domande jsonb, risposte attese = somma delle risposte jsonb), provata su copia usa-e-getta (`db/scripts/prova-idempotenza.sh`) e sulla prova generale della CI, backup verificato prima. Disattivazione: le rotte di scrittura di `/v1/surveys` rispondono 410 con il rimando a `/v1/engagement/surveys` (ondata 5), le tabelle restano.

Fatto (ramo locale, PR dopo la #291): `db/migrations/000497_un_solo_modello_di_sondaggio.sql`, inversa `db/scripts/sondaggi/inversa-000497.sql`. Scelte del coordinatore per Enzo (17/11 19:08): valori invariati, scala sulla domanda (`survey_question_options.scale`), sondaggi trasferiti `archived`, normalizzazione solo in lettura, doppioni di trimestre annotati e non fusi. Scelta analoga presa qui: le 117 risposte della q4 del sondaggio sul benessere scritte come `nps` (5-10) su una domanda a scala 5 restano righe senza voto, con il valore d'origine nel metadato. Letture adeguate: `engagement` (scala nei risultati, grafico riportato a 10), `org-health` (normalizzazione per scala), `insights` (la fonte 1 legge le righe trasferite: misurato sulla copia, 158 persone su 158 con la stessa media), `verify-storia36.sql` C8b (esclude gli archiviati). Prova su copia usa-e-getta di `heuresys_ci` della VM: due passate verdi, inversa e ripassata verdi, 6/30/4.112/5 righe. Come si rimisura: `psql -f db/migrations/000497_un_solo_modello_di_sondaggio.sql` su una copia, il NOTICE finale riporta i conteggi.

## Ondata 4 — fatta (PR #305, unita il 2026-11-19)

Scritture all'agente per nome (`docs/kb/agent-perimetri.json`, campo `scritture`, classe C con approvazione della persona): `learning-gaps.post`, `user-career-plans.post/patch_by_id`, `user-target-positions.post/patch_by_id/post_by_id_review`, `mentorship.post_pairings`, `goals.patch_by_id`, `okrs.patch_by_id`. Restano fuori `seed-acquisition-runs` e `tenant-import-runs` (decisione del coordinatore per Enzo, 18/11: `check_concetti_agente.py` li esclude come superfici di servizio). Difetto corretto: la base dei moduli montati altrove (`semantic-matching` → `/matching`); prova `python docs/kb/tools/prova_indirizzi_agente.py` (con `--come-prima` è rossa). Ondata 4a: `blueprints/[variantId]/gestione-attivazione.tsx`, `tenant-blueprints/[id]/gestione-fascicolo.tsx`, `seed-acquisition/runs/proposte-corsa.tsx`; prova `apps/web/tests/e2e/ondata4-pulsanti.spec.ts`.

## Ondata 5 — PR #316

5c, ritiri: `apps/api/src/lib/rotte-ritirate.ts` (elenco esplicito, `onRoute` prima dei moduli, 410 `ROUTE_RETIRED` con motivo e alternativa; permessi e CSRF restano, nessuna riga cambia). Dentro l'elenco: 26 cancellazioni di dati con storia (si disattiva con PATCH o PUT), `DELETE /v1/users/:id/purge` (si usa la procedura GDPR), le scritture di `/v1/surveys` (resta il modello di `/engagement`, 000497), le scritture dei team (una squadra è un progetto, 000363), `POST /v1/organization-unit-history`. Prova `apps/api/test/rotte-ritirate.integration.test.ts` più le prove dei moduli adattate al 410 con la riga che resta.

5a, schermate dei cataloghi: `/admin/catalogo-kpi` (processo↔KPI e unità↔KPI con il peso, `PUT`/`DELETE` dei modelli dei KPI); `/admin/tassonomie` (professioni ISCO e CP, attività ATECO e NACE con le loro corrispondenze, fasce dimensionali, modelli operativi: `POST`/`PATCH`/`PUT`); `/blueprints` e `/blueprints/[variantId]` (famiglie e varianti create e corrette, processi corretti); `/admin/dati-di-riferimento` (aggiornamento a richiesta dalle fonti ufficiali con `LavoroInCorso`, storico delle corse). Scelta: i cataloghi globali della tipizzazione d'impresa stanno in `/admin/tassonomie`, non nella pagina di un tenant, che li sceglie e non li cura. Prova `apps/web/tests/e2e/ondata5a-cataloghi.spec.ts`.

Rimandati, con la ragione: le scritture a mano sui grafi di visualizzazione (le loro prove costruiscono i grafi con quelle rotte, e il ritiro chiede prima che la rigenerazione copra stili e disposizioni); `POST /v1/tenants/provision` (interruttore già spento in produzione: il ritiro è togliere codice, non spegnere una rotta).

## Fuori da questa sessione

Le ondate 3-5 non si chiudono stanotte: ognuna è una PR e un rilascio a sé, e il turno di rilascio è conteso.

## Registro delle scoperte

Da proporre a Enzo una volta sola, come «fuori da questo ciclo»:

- `POST /v1/organization-unit-history`: scrivere a mano una riga di storia con valori vecchi e nuovi inventati non ha senso; la storia la scrive il sistema. Proposta: classe c (ritiro) nell'ondata 5.
- `POST /v1/compensation/handoff-records`: il passaggio alla paghe è un evento d'integrazione, non un modulo da compilare. Proposta: classe b (agente o integrazione) nell'ondata 4.
- `POST /v1/tenants/provision`: è spento da un interruttore (`FEATURE_DISABLED`) e il suo lavoro lo fa il costruttore di tenant. Proposta: classe c nell'ondata 5.
- `GET /v1/capability/composition/:tipo/:id`, `GET /v1/capability/maturity/org-units/:id`, `GET /v1/mandate-acts/:id`: letture puntuali di dati che le pagine già mostrano dagli elenchi. Proposta: letture dell'agente (ondata 4).

- I team (`POST/PATCH /v1/teams`, membri): la `000363` ha deciso che una squadra è un progetto, e i 26 team sono diventati i 26 progetti (misura del 17/11: `sys_teams` 26, `sys_projects` 26). Una pagina `/teams` riaprirebbe il doppione che quella decisione ha chiuso. Proposta: classe c (ritiro) nell'ondata 5, non una pagina nuova.
- Due modelli di sondaggio convivono e sono entrambi popolati (misura del 17/11): il modulo `engagement` legge `sys_surveys` (14 sondaggi, 8.288 risposte) ed è la pagina `/engagement`; il modulo `surveys` scrive `sys_engagement_surveys` (6 sondaggi, 862 risposte) e non ha pagina. Costruire `/surveys` darebbe due pagine per la stessa cosa: prima si sceglie quale modello resta (decisione di architettura, di Enzo), poi si migra l'altro. Fino ad allora `/surveys` resta fuori dall'ondata 3b.
- L'estrattore di #280 conta come orfani i percorsi composti a runtime (`/v1/content/${id}/${action}`): `return-to-draft` e `unpublish` hanno già un chiamante.
- La mappa GDPR (`sys_gdpr_data_map`, 000186) non registra `sys_survey_responses` né `sys_pulse_checks`: la loro colonna della persona è `ON DELETE SET NULL`, che la dottrina tratta come paternità. Le risposte di clima sono un'opinione della persona (000366): da decidere se entrano nell'esportazione Art. 15.
- La prova generale sulla VM (`ci-rehearsal.sh` contro `heuresys_ci` della VM) si ferma alla 000132 per `sys_auth_refresh_tokens` non classificata: è una differenza di quel database, non della catena; la prova generale vera resta sul gemello.
