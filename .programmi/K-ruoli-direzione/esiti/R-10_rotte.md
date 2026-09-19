# R-10 — tabella rotta -> permesso (passo 49, scritta PRIMA della migrazione)

Oggi 7 moduli (28 rotte, 4 ciascuno: 2 GET su `job-requisition:read`, 1 POST + 1 PATCH
su `job-requisition:manage`) condividono lo stesso permesso perche' "il recruiting e' un
ciclo solo" (commento in testa a `candidates/routes.ts` e agli altri 5 moduli a valle).
`job-requisition:manage` NON si cancella: resta concesso ai plenipotenziari (HRMS_MANAGER,
TENANT_ADMIN, PLATFORM_ADMIN) e la sua `description` viene marcata "superato da...".

Mappatura per dominio dati sottostante (misurato sulle tabelle `sys.*` di ciascun repository):

| modulo | tabella | rotte | permesso vecchio | permesso nuovo |
|---|---|---|---|---|
| job-requisitions | sys_job_requisitions | GET /, GET /:id | job-requisition:read | requisition:read |
| job-requisitions | sys_job_requisitions | POST /, PATCH /:id | job-requisition:manage | requisition:manage |
| job-postings | sys_job_postings | GET /, GET /:id | job-requisition:read | requisition:read |
| job-postings | sys_job_postings | POST /, PATCH /:id | job-requisition:manage | requisition:manage |
| candidates | sys_candidates | GET /, GET /:id | job-requisition:read | candidate:read |
| candidates | sys_candidates | POST /, PATCH /:id | job-requisition:manage | candidate:write |
| candidate-applications | sys_candidate_applications | GET /, GET /:id | job-requisition:read | candidate:read |
| candidate-applications | sys_candidate_applications | POST /, PATCH /:id | job-requisition:manage | candidate:write |
| interviews | sys_interviews | GET /, GET /:id | job-requisition:read | interview:feedback |
| interviews | sys_interviews | POST /, PATCH /:id | job-requisition:manage | interview:feedback |
| interview-feedback | sys_interview_feedback | GET /, GET /:id | job-requisition:read | interview:feedback |
| interview-feedback | sys_interview_feedback | POST /, PATCH /:id | job-requisition:manage | interview:feedback |
| job-offers | sys_job_offers | GET /, GET /:id | job-requisition:read | offer:manage |
| job-offers | sys_job_offers | POST /, PATCH /:id | job-requisition:manage | offer:manage |

28 rotte totali (7 moduli x 4). `interview:feedback` e `offer:manage` governano SIA lettura
SIA scrittura per i loro moduli: il mandato (passo 49) elenca solo sei permessi nuovi, non
otto, quindi per questi due domini non nasce un verbo `:read` separato — e' una decisione
tecnica di questa sessione (S1108), motivata dal fatto che il mandato stesso non lo prevede
e non esiste oggi alcuna rotta che debba distinguere "leggi il colloquio" da "dai il
feedback" a livello di permesso.

Controprova pre-migrazione (misurata ora): `grep -rn "job-requisition:read\|job-requisition:manage" <i 7 routes.ts>`
= 28 righe nei `preHandler` (piu' 5 righe di commento nei 5 file a valle, non contate: sono
prosa, non `requirePermission`).

Post-condizione attesa dopo la migrazione + il cambio di rotte: 0 occorrenze di
`job-requisition:read` / `job-requisition:manage` dentro `preHandler` nei 7 file; i
plenipotenziari hanno tutti e sei i permessi nuovi.
