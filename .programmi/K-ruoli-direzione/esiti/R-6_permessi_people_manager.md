# R-6, passo 56 — permessi di PEOPLE_MANAGER — ESITO

Data: 2026-09-19, sessione S1109.

## Generazione

`python .programmi/K-ruoli-direzione/tools/permessi_da_classificazione.py` produce **124**
permessi (scrittura su tabelle `nativo`+`ibrido` unione lettura su `importato`, testo esatto
del passo 56, più `compensation_intelligence:update` esplicito).

## Revisione a mano (il mandato la pretende esplicitamente)

L'euristica associa a UNA tabella TUTTI i permessi di scrittura/lettura del MODULO che la
tocca — se un `repository.ts` scrive su piu' tabelle con classificazione diversa, o un
`routes.ts` ha rotte per azioni molto diverse fra loro, l'unione porta dentro permessi che
non appartengono al dominio "gestione operativa delle persone". **46 permessi ESCLUSI**
(39 dalla prima revisione + 7 trovati dal cancello di guardia al primo giro della
migrazione — vedi nota sotto), con motivo:

| permessi esclusi | dominio reale | perche' non a PEOPLE_MANAGER |
|---|---|---|
| `blueprint:activate`, `blueprint:delete`, `blueprint:override` | avviamento (Tenant Builder) | R-5: BLUEPRINT_MANAGER/TENANT_ADMIN |
| `candidate:write`, `interview:feedback`, `offer:manage`, `requisition:manage` | recruiting | R-4/R-10: RECRUITER/HIRING_MANAGER |
| `capability:admin`, `insights:admin`, `matching:admin` | amministrazione di sistema | "admin" e' un potere piu' ampio della gestione operativa; PEOPLE_MANAGER ha le viste (`*:view`/`*:read`), non l'amministrazione |
| `delegation:manage` | atto amministrativo | il commento del modulo lo dichiara esplicitamente: "conferire una delega per conto di altri e' un atto amministrativo", tenuto solo da PLATFORM_ADMIN/TENANT_ADMIN/HRMS_MANAGER (mig. 000314) — PEOPLE_MANAGER non e' equivalente a HRMS_MANAGER in ampiezza (I22 e' di HRMS_MANAGER, non suo) |
| `enterprise_typing:create/delete/update`, `operating_model:delete/update` | tassonomia aziendale/struttura | classificazione dell'azienda (ATECO/operating model), non dato di persona |
| `gdpr:erase`, `gdpr:export`, `gdpr:retention` | GDPR | R-2: DPO/TENANT_ADMIN/HRMS_MANAGER/PLATFORM_ADMIN |
| `leads:update` | commerciale | R-9: SALES |
| `occupation_classification:create/delete/update`, `skill_alias:manage`, `skill_taxonomy:create/delete/update` | tassonomia competenze | R-3: TAXONOMY_STEWARD |
| `project:manage` | funzionale-sul-lavoro | il modulo dichiara esplicitamente "l'autorita' di un capo progetto e' SUL LAVORO, NON SULLE PERSONE" (I18) — dominio diverso da "gestione persone" |
| `reference_sync:trigger` | sincronizzazione riferimenti | PLATFORM_ADMIN/TAXONOMY_STEWARD |
| `role:assign` | concessione di ruoli | atto amministrativo, mai a un ruolo senza mandato esplicito (CAN_GRANT_ROLES) |
| `seed_acquisition:approve/delete/trigger` | avviamento | R-8: IMPLEMENTATION_CONSULTANT/BLUEPRINT_MANAGER |
| `tenant:create/delete/read/update` | piattaforma | gestione anagrafica clienti, non persone |
| `tenant_materialization:execute` | avviamento, atto irreversibile | PLATFORM_ADMIN-only (#132 E29) |
| `whistleblowing:manage` | **isolamento assoluto** | ADR-0036 §5: solo WHISTLEBLOWING_CUSTODIAN, **mai** la piattaforma — invariante non negoziabile |
| `job_family:create/update/delete` | residuo G2 (000199) | l'audience di questo permesso DEVE essere identica a quella del suo sorgente (`tenant:create`, PLATFORM_ADMIN-only) — `rbac-delete-permissions.test.ts` lo verifica letteralmente. **Trovato dal test, non dalla revisione iniziale**: il primo giro della migrazione sul gemello e' andato rosso su questo esatto controllo |
| `organization_unit_kpi_template:*`, `process_kpi_template:*` | residuo G2 (000199) | stesso meccanismo: sorgente `bpm_process:*`, che PEOPLE_MANAGER non detiene — stessa causa, stesso test, corretto nello stesso giro |

## Elenco finale — 78 permessi

```
analytics:view, approval:create, approval:decide, assessment:create, assessment:update,
branch:list, branch:read, capability:read, career_succession:create, career_succession:delete,
career_succession:read, career_succession:update, compensation_intelligence:read,
compensation_intelligence:update, content:create, content:delete, content:publish,
content:update, dashboard:view, engagement_feedback:create, engagement_feedback:delete,
engagement_feedback:update, evidence:read, gap_analysis:create, gap_analysis:delete,
gap_analysis:read, gap_analysis:update, goal:create, goal:delete, goal:read, goal:update,
insights:view, job_role:create, job_role:update, kpi:create, kpi:delete, kpi:read, kpi:update,
learning:create, learning:delete, learning:update, leave:read, mentorship:create,
mentorship:delete, mentorship:read, mentorship:update, okr:create, okr:delete, okr:update,
org_director:read, organization_unit:create, organization_unit:delete, organization_unit:update,
organization_unit_processes:create, organization_unit_processes:delete, position:create,
position:delete, position:read, position:update, predictions:read, skill:create,
skill:self_assess, skill:update, surveys:create, surveys:delete, surveys:read, surveys:update,
talent:read, team:manage, timeline:read, training_initiative:create, training_initiative:update,
user:create, user:delete, user:update, visualization:create, visualization:delete,
visualization:update_layout
```

## Nota su `user:create/delete/update`

Lasciato dentro nonostante sia un potere ampio (creare/cancellare utenze): e' coerente con
"gestione operativa delle persone" (assumere = creare l'utenza) e la separazione dei compiti
regge — `role:assign` e' escluso, quindi PEOPLE_MANAGER crea l'account ma non puo' concedergli
un ruolo di privilegio. Se Enzo lo ritiene eccessivo, si toglie con la stessa forma delle
altre esclusioni (una riga nella VALUES della migrazione, non una DELETE a valle — ADR-0035).

## Verdetto

Nessuna decisione nuova per Enzo: le esclusioni sono tutte derivate da separazione dei compiti
gia' decisa altrove nel mandato (R-2, R-3, R-4/R-10, R-5, R-8, R-9) o da un'invariante non
negoziabile (whistleblowing). L'elenco e' pronto per la migrazione.
