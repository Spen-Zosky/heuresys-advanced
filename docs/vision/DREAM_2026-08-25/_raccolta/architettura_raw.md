# Vincoli tecnici - mappa dei soffitti e dei moltiplicatori

Data: 2026-08-25
Ambito: D:\heuresys-advanced - misure ripetibili con Grep/Read su questa sessione (comandi indicati dove non e' un file:riga diretto).

## 1. Modello dati position-centric

| vincolo/abilitatore | fatto (file:riga o comando) | conseguenza funzionale |
|---|---|---|
| Posizione come nodo centrale, con owner diverso da incumbent | db/migrations/000011_position_model.sql:22-43 (sys.sys_positions, colonna position_owner_user_id) + commento riga 6-9 "Position is the CENTRAL HRMS object (invariant I1) - NOT employee" | Carriera/successione/matching si costruiscono SU una posizione stabile nel tempo anche quando la persona cambia - funzionalita' come "successione su una posizione critica" o "storico di chi l'ha occupata" costano poco: la tabella lo prevede gia' (sys_position_succession_relevance, riga 237-263). Funzionalita' che ragionano SOLO per persona richiedono di attraversare sys_user_position_assignments (mig. 000012, non letta in questa sessione - verifica separata necessaria) |
| PIP come VIEW, non blob | db/migrations/000011_position_model.sql:272-320 (CREATE OR REPLACE VIEW sys.sys_position_intelligence_profiles_v), commento riga 11-12 conferma ADR-0008/I9 | Ogni nuovo requisito di posizione (skill, KPI, learning, comp, succession) e' gia' una tabella satellite con FK a position_id - aggiungere un settimo dominio di requisito costa una tabella + un join nella view, non una migrazione di uno schema JSON. Query aggregate sul profilo pagano il costo di 6 subquery correlate per riga a ogni lettura (nessuna misura di piano query eseguita in questa sessione - lacuna dichiarata) |
| Criticita'/proficiency come varchar+CHECK, non ENUM | db/migrations/000011_position_model.sql:45-49, 105-115, 250-254 | Aggiungere un valore ammesso e' un ALTER TABLE ... DROP/ADD CONSTRAINT, non una migrazione di tipo a cascata - economico. Verificato anche CREATE TYPE ... AS ENUM assente in tutto db/migrations (comando: Grep "CREATE TYPE.*AS ENUM" db/migrations -> 0 file) |

## 2. Multi-tenancy: FK + filtro middleware, mai RLS

| vincolo/abilitatore | fatto (file:riga o comando) | conseguenza funzionale |
|---|---|---|
| Isolamento tenant = FK + middleware, MAI RLS | apps/api/src/middleware/tenantContext.ts:14-26 - req.tenantId = req.user.tenantId, 403 se manca e il ruolo non e' PLATFORM_ADMIN | Ogni nuova rotta/servizio deve leggere req.tenantId e filtrarlo esplicitamente nella query: non c'e' una rete di sicurezza a livello DB. Un nuovo modulo che dimentica il filtro tenant nella WHERE produce una fuga di dati cross-tenant che nessun meccanismo intercetta automaticamente (nessuna RLS, comando: Grep "ENABLE ROW LEVEL SECURITY|CREATE POLICY" db/migrations -> 0 file) |
| Diffusione del vincolo tenant_id nello schema | comando: grep -l tenant_id db/migrations/*.sql, poi wc -l -> 126 file su 352; grep -o tenant_id db/migrations/*.sql, poi wc -l -> 978 occorrenze | La disciplina FK-tenant e' pervasiva e ripetuta identica ovunque - un multi-tenant "vero" (isolamento fisico, schema-per-tenant) e' precluso senza toccare 126 file di migrazione; ma un NUOVO tenant (riga in sys.sys_tenancies) non richiede provisioning infrastrutturale, solo dati |
| PLATFORM_ADMIN puo' operare cross-tenant | apps/api/src/middleware/tenantContext.ts:17-24 | Funzionalita' "vista aggregata multi-tenant per il vendor" e' tecnicamente aperta solo a questo ruolo, ma ogni query dei moduli sotto deve gestire esplicitamente tenantId === undefined: non e' un caso gia' coperto ovunque (non verificato modulo per modulo - lacuna dichiarata) |

## 3. Modello autorizzativo - RBAC + domini + quarto stato mask

| vincolo/abilitatore | fatto (file:riga o comando) | conseguenza funzionale |
|---|---|---|
| RBAC caricato in cache all'avvio, ~100 permessi su 8 ruoli storici | db/migrations/000005_auth_foundation.sql:3,14-16,19 (commento: "11 auth tables ... 8 roles ... ~100 permissions") - conteggio corrente non ri-derivato in questa sessione (dichiarato variabile da .claude/rules/security-auth.md, misurato 14 ruoli a S1052) | Aggiungere un permesso e' un INSERT + un requirePermission('resource:verb') in una rotta - economico e gia' a pattern. Cambiare la SEMANTICA di un permesso esistente tocca ogni rotta che lo referenzia: nessun livello di indirection tra permesso e rotta |
| Boot-time enforcement: ogni rotta sensibile DEVE dichiarare orgGate | apps/api/src/lib/scope/gate.ts:90-126 - registerOrgGateAssertion, onReady lancia ORG_GATE_MISSING se una rotta di lettura su risorsa sensibile non dichiara service/catalog/aggregate | Un nuovo modulo che espone dati di classe sensibile (elenco in apps/api/src/lib/scope/data-classes.ts:36-43) non puo' nemmeno avviarsi in produzione se dimentica lo scoping - il costo dello scoping e' spostato da "runtime silenzioso" a "boot fallito", il che rende ECONOMICO aggiungere moduli sensibili nuovi (l'errore emerge subito, non in audit) |
| Matrice M1 = 10 domini x 7 classi x 4 modalita' | apps/api/src/lib/scope/domains.ts:56-66 (export type Domain = con 10 valori: platform_mandate, hr_mandate, line_management, team_lead, process_owner, mentor, approver, team_peer, delegation, custody) e apps/api/src/lib/scope/data-classes.ts:36-43 (7 DataClass) e apps/api/src/lib/scope/matrix.ts:39,42,59 (AccessMode = "edit"|"read"|"mask"|"none", commento riga 42: "M1 - 10 domini x 7 classi") | Un nuovo dominio funzionale o una nuova classe di dato e' UNA riga/colonna nella matrice, propagata automaticamente a mask.ts (via classiMascherateDa) e al calcolo del menu (M3) - moltiplicatore diretto. Nota: il CLAUDE.md radice dichiara "11 domini funzionali" nell'invariante I16, ma il codice attuale (domains.ts:56-66) ne definisce 10 - discrepanza rilevata, non risolta in questo mandato |
| mask come quarto stato, mai lato-client, mai RLS | apps/api/src/lib/scope/mask.ts:14-19 ("Never in the frontend ... Never in the database either ... never via RLS, which invariant I5 excludes project-wide") | Ogni nuovo campo sensibile che debba essere mascherabile deve passare esplicitamente dal service allo strato di masking - non esiste un default automatico: un nuovo endpoint che serializza direttamente dal repository bypassa il mascheramento se non lo invoca |
| Resolver gerarchico cammina sull'albero delle UNITA', non delle posizioni | apps/api/src/lib/scope/org.ts:12,45,53,87-96 (organization_unit_parent_id, organization_unit_manager_user_id) | Riorganizzazioni ridefiniscono immediatamente il perimetro di visibilita' di chi gestisce l'unita' - nessuna tabella di cache separata da invalidare per la gerarchia |

## 4. Catena migrazioni e disciplina schema

| vincolo/abilitatore | fatto (file:riga o comando) | conseguenza funzionale |
|---|---|---|
| 352 migrazioni numerate, idempotenti | comando: ls db/migrations, poi wc -l -> 352 (2026-08-25) | La catena si riapplica per intero a ogni deploy (.claude/rules/db-migrations.md) - ogni nuova migrazione aggiunge tempo lineare a QUEL processo, ma e' economica in isolamento: pattern replicato 352 volte |
| Ritiro = emenda la fonte, mai DELETE a valle isolata | doc: .claude/rules/db-migrations.md sezione "Ritirare un oggetto" (ADR-0035) | Rimuovere una capacita' gia' shippata costa la ricerca del file che la CREA, non solo un DROP - il costo di un ritiro cresce con la distanza temporale dalla creazione |
| Naming rigido sys.sys_<plural>, schemi ausiliari chiusi | .claude/rules/db-migrations.md sezione "Vincoli di schema" (I3/I4) - verificato anche via lo schema reference_sync (vedi sezione 9) | Un dominio dati che non si presta a "tabella business del tenant" deve trovare posto in staging/reference_sync/audit o forzare sys.* - non c'e' un quarto schema libero dichiarato |

## 5. Contratti Zod condivisi API-web

| vincolo/abilitatore | fatto (file:riga o comando) | conseguenza funzionale |
|---|---|---|
| 108 file di schema Zod, ognuno con subpath export dedicato | comando: ls packages/shared/src/schemas, poi wc -l -> 108; grep -c "./schemas" packages/shared/package.json -> 108 | Estendere una superficie esistente e' un cambio in UN file di schema che propaga il tipo sia al servizio API sia al client web - nessuna duplicazione di interfacce TS a mano |
| 117 file web importano @heuresys/shared (136 occorrenze) | comando: Grep "@heuresys/shared" apps/web/src -> 136 occorrenze, 117 file | Un breaking change su UNO schema condiviso rompe la build TypeScript in tutti i punti che lo consumano - il compilatore lo individua, ma la superficie di impatto e' ampia per costruzione: 117 file e' la stima minima dei punti da rivedere |
| I moduli API sono 98 directory, 111 app.register in app.ts | comando: ls apps/api/src/modules, poi wc -l -> 98; grep -c "app.register" apps/api/src/app.ts -> 111 | Il pattern a 7 passi rende un modulo NUOVO a schema noto economico (schema+repo+service+routes+test, 1 commit), ma ogni modulo passa dagli stessi 13 plugin fissi in app.ts - un requisito che a quello step non si adatta (es. streaming lungo, non-JSON) non ha un binario alternativo dichiarato |

## 6. Internazionalizzazione - stato reale

| vincolo/abilitatore | fatto (file:riga o comando) | conseguenza funzionale |
|---|---|---|
| Due lingue attive, i18next + react-i18next | comando: ls apps/web/src/locales -> en, it (10 file JSON ciascuna); Grep "i18next|react-i18next" apps/web/package.json -> i18next@26.3.6, react-i18next@17.0.11 | Aggiungere una TERZA lingua e' a pattern (nuova cartella locales/<lang> + le stesse 10 chiavi) - economico strutturalmente. Non verificato in questa sessione: copertura reale delle 10 chiavi - richiede pnpm i18n:check, non eseguito |

## 7. Runtime di produzione - VM OCI, systemd, tsup, Next start, no Docker

| vincolo/abilitatore | fatto (file:riga o comando) | conseguenza funzionale |
|---|---|---|
| API = bundle tsup singolo, eseguito con node dist/server.js sotto systemd | apps/api/tsup.config.ts:19-22 (entry: ["src/server.ts"], bundle: true, outDir: "dist") + deploy/systemd/heuresys-advanced-api.service:16-20 (ExecStart node dist/server.js, Type=simple) | Non c'e' orchestrazione multi-processo/multi-istanza dichiarata: la scalabilita' orizzontale dell'API non e' un cambiamento di configurazione, e' un pezzo di infrastruttura da costruire da zero |
| nginx punta a UN solo upstream web (127.0.0.1:3013) | deploy/nginx/www.heuresys.com.conf:51 (proxy_pass http://127.0.0.1:3013;) | Nessun load balancing dichiarato nella conf servita - servire piu' tenant con isolamento di processo richiederebbe infrastruttura nuova, non prevista oggi |
| No Docker (I13, ADR-0004) | assenza confermata: find . -maxdepth 1 -iname docker* e find apps -maxdepth 2 -iname docker* -> nessun file | Onboarding di un NUOVO ambiente non puo' appoggiarsi a un'immagine container portabile: richiede una VM nativa con PostgreSQL 16 installato a mano - il costo di un ambiente aggiuntivo e' quello di una VM intera, non di un docker run |
| Provisioning di un NUOVO TENANT e' dati, non infrastruttura | apps/api/src/modules/tenant-materialization/service.ts:1-20 (commento: "il contenuto si legge dal database... il totale ora si legge dal piano") | Aggiungere un tenant cliente non tocca systemd/nginx/DB provisioning - e' economico. Ma resta sulla STESSA VM/stesso processo API di tutti gli altri tenant: nessun isolamento di failure-domain tra tenant a livello di processo |

## 8. Superfici di integrazione esistenti verso l'esterno

| vincolo/abilitatore | fatto (file:riga o comando) | conseguenza funzionale |
|---|---|---|
| Un solo endpoint pubblico senza autenticazione: /v1/public/platform-stats | apps/api/src/modules/public-stats/routes.ts:10-18 - aggregato, rate-limited 30/min, no PII (commento riga 2-4) | Non esiste OGGI una superficie API pubblica per integrazioni di terzi: comando Grep "webhook|personal_access_token|api_key" db/migrations -i -> solo 1 falso positivo in un commento di 000062 (app-generated AI infra). Costruire un'API pubblica per un cliente/partner parte da zero: nessun meccanismo di auth-per-terzi, nessuna tabella di token |
| Nessun webhook in uscita | stesso comando sopra, 0 tabelle o rotte trovate con pattern webhook nel codice sorgente (Grep "webhook" apps/api/src -> 3 file, tutti falsi positivi: header di sicurezza in app.ts, il nome del modulo public-stats, voyage-client.ts) | "Notifica un sistema esterno quando succede X" e' una famiglia di funzionalita' interamente da costruire: non c'e' un dispatcher di eventi verso URL esterni |
| Auth = solo provider LOCAL, tabella sessioni SSO e' placeholder inerte | db/migrations/000005_auth_foundation.sql:9,82-84 (commento: "sys_auth_sessions (placeholder; future SSO)", "placeholder; not on MVP-1 hot path") + Grep "SSO|SAML|OAuth|OIDC" apps/api/src/modules/auth -> 1 file, falso positivo (smtp-mailer.ts) | Login aziendale via SSO (SAML/OIDC) - spesso un requisito hard per PMI strutturate - non ha alcuna implementazione: la tabella esiste ma e' dichiarata dal codice stesso "non sul percorso critico" |
| Un unico punto di lettura pagine web esterne, sandboxato | apps/api/src/modules/research/web-reader.ts:4-30 (quattro guardie: solo https, no rete interna/SSRF, limiti dimensione/tempo, redirect verificati a mano) | E' un moltiplicatore per ricerca/arricchimento (vedi sezione Moltiplicatori), ma non e' un connettore verso sistemi terzi strutturati (ATS, gestionali) - legge pagine, non API di terzi |
| Upload file: solo @fastify/multipart, usato in 2 moduli | comando: Grep "multipart" apps/api/src -> apps/api/src/modules/me/routes.ts, apps/api/src/modules/content/media-routes.ts | Import massivo via file (CSV/Excel) NON e' un pattern esistente nei moduli business (skills, positions, users): l'unico uso di multipart e' upload media/contenuti, non ingestione dati strutturati. Un "importa dipendenti da CSV" per un nuovo tenant PMI e' da costruire ex-novo |

## 9. Pipeline dati esistenti (reference_sync, ingestione storica chiusa)

| vincolo/abilitatore | fatto (file:riga o comando) | conseguenza funzionale |
|---|---|---|
| reference_sync ha connettori vivi per ESCO e ISTAT/ATECO, con CLI dedicata | apps/api/src/modules/reference-sync/esco-connector.ts, istat-ateco-connector.ts, sync-cli.ts (presenza confermata via ls); rotte in apps/api/src/modules/reference-sync/routes.ts:1-11; comando canonico pnpm reference-sync:run in apps/api/package.json:20 | Aggiungere una NUOVA fonte ufficiale di tassonomia segue un pattern gia' rodato (deps seam iniettabile per test) - economico rispetto a costruire un sync pipeline da zero |
| reference_sync e' PLATFORM_ADMIN-only, nessuna superficie tenant | apps/api/src/modules/reference-sync/routes.ts:9 (commento: "Reference taxonomies are GLOBAL platform infra -> PLATFORM_ADMIN-only") | Un tenant NON puo' portare la propria tassonomia custom attraverso questo canale - richiede un percorso tenant-scoped separato, oggi assente |
| Ingestione dal legacy CHIUSA (I12, ADR-0038) | CLAUDE.md sezione "Data provenance" - cancello: docs/kb/tools/check_no_legacy_ingest.py (non eseguito in questa sessione, citato come meccanismo esistente, non come misura fresca) | Qualunque funzionalita' che presupponga "arricchisci ancora dal DB legacy" e' strutturalmente preclusa dalla dottrina corrente - un nuovo import da li' e' un piano da riscrivere, non da eseguire |

## 10. Infrastruttura di test come vincolo/abilitatore di velocita'

| vincolo/abilitatore | fatto (file:riga o comando) | conseguenza funzionale |
|---|---|---|
| 238 file di test di integrazione Vitest, contro DB reale | comando: find apps/api/test -iname "*.integration.test.ts", poi wc -l -> 238 | Un nuovo modulo a pattern eredita gratis la stessa profondita' di test (4-8 test/modulo) - il costo marginale di "un modulo testato" e' basso perche' il pattern e' ripetuto 238 volte, non inventato ogni volta |
| Isolamento transazionale dei test dichiarato in un helper dedicato | comando: ls apps/api/test/helpers -> include tx-isolation.ts, build-test-app.ts, login.ts, actors.ts | I test non richiedono un DB usa-e-getta per ogni corsa - questo abbassa il costo di iterazione, ma lega la velocita' dei test alla disponibilita' del tunnel verso il DB reale (nessun mock DB, per dottrina di progetto) |
| 100 spec Playwright E2E, un solo modo di corsa piena supportato (test:e2e:prod) | comando: find apps/web -path "*e2e*" -iname "*.spec.ts", poi wc -l -> 100; regola in CLAUDE.md sezione "Canonical commands" (D-24: sessioni auth dev durano 15 min) | Una feature che tocca l'UI autenticata end-to-end eredita 100 scenari di regressione gia' scritti - moltiplicatore di sicurezza. Ma la corsa PIENA richiede su Node >=23 un wrapper Node 22 (D-36, citato in CLAUDE.md, non ri-verificato in questa sessione): la velocita' di iterazione locale su Windows con Node recente e' penalizzata da un livello di indirection in piu' |

## 11. Invarianti CLAUDE.md verificati nel codice

| invariante | fatto (file:riga) | verifica |
|---|---|---|
| I1 Position-centric, owner diverso da incumbent | db/migrations/000011_position_model.sql:6-9,30 | CONFERMATO - vedi sezione 1 |
| I5 Tenant isolation = FK + middleware, mai RLS | apps/api/src/middleware/tenantContext.ts:14-26; 0 ENABLE ROW LEVEL SECURITY/CREATE POLICY in db/migrations | CONFERMATO - vedi sezione 2 |
| I9 PIP = VIEW, mai JSONB blob | db/migrations/000011_position_model.sql:272-320 | CONFERMATO - vedi sezione 1 |
| RD-08 Categoriali = varchar+CHECK, mai ENUM | 0 CREATE TYPE ... AS ENUM in db/migrations (comando eseguito) | CONFERMATO |
| I13 No Docker nel runtime, PostgreSQL nativo | apps/api/tsup.config.ts, deploy/systemd/heuresys-advanced-api.service; 0 file docker* in root/apps | CONFERMATO - vedi sezione 7 |
| I16 Domini ortogonali (gerarchico x funzionale) | apps/api/src/lib/scope/org.ts:12 (albero unita') + apps/api/src/lib/scope/matrix.ts:39-59 | CONFERMATO nel meccanismo; numero domini dichiarato (11) NON coincide con il codice (10) - vedi discrepanza in sezione 3 |
| I17 Universale ESS floor + self-scope | apps/api/src/lib/scope/gate.ts:79 (if parts.includes("self") return null - I17 self-scope exempt by design) | CONFERMATO nel meccanismo di gate |
| I20 Organizational prevalence, mandato piattaforma diverso da mandato HR, mask come quarto stato | apps/api/src/lib/scope/mask.ts:8-19,62-63 | CONFERMATO |
| I7 Auth separata da sys.sys_users, 11 tabelle sys.sys_auth_* | db/migrations/000005_auth_foundation.sql:3-17 (elenco 11 tabelle) | CONFERMATO nel commento della migrazione fondativa; conteggio corrente non ri-derivato in questa sessione |

## Moltiplicatori

| pezzo esistente | prova | famiglia di capacita' che abilita |
|---|---|---|
| Motore di scoping generico (domains.ts + data-classes.ts + matrix.ts + mask.ts + gate.ts) | apps/api/src/lib/scope/matrix.ts:59 (M1: Readonly Record Domain Readonly Record DataClass AccessMode); enforcement automatico al boot in gate.ts:111-123 | Qualunque nuova famiglia di dati sensibili o nuovo attore organizzativo si aggiunge dichiarando righe/colonne nella matrice - la propagazione a mascheramento e a superficie UI (M3) e' automatica, non richiede toccare ogni modulo consumatore |
| Contratto Zod condiviso a subpath export (108 schemi) | packages/shared/package.json (108 voci ./schemas/*); 117 file web che li importano (Grep "@heuresys/shared" apps/web/src -> 136 occorrenze) | Ogni nuova entita'/campo che segua il pattern a 7 passi propaga il tipo end-to-end (API-web) senza duplicare interfacce - riduce drasticamente il costo di superfici CRUD nuove sullo stesso schema di validazione |
| Pipeline reference_sync con connettori ESCO/ISTAT-ATECO e CLI iniettabile per test | apps/api/src/modules/reference-sync/esco-connector.ts, istat-ateco-connector.ts, sync-cli.ts; routes.ts:10-11 (il deps seam consente ai test di iniettare un fetcher fittizio) | Aggiungere una tassonomia ufficiale terza e' un nuovo connettore a pattern noto, non una pipeline da disegnare |
| Substrato pgvector + cache embedding per matching semantico | db/migrations/000060_pgvector_substrate.sql:47,66,85,106 (colonne vector(1024)); apps/api/src/modules/semantic-matching/query-embedding-cache.ts (import in service.ts:18) | Qualunque feature di "trova il piu' simile a" (posizione-competenza, candidato-ruolo, contenuto-gap) riusa lo stesso substrato vettoriale e la stessa cache - non richiede una nuova infrastruttura di ricerca semantica |
| Layer di notifica in-app generico (emitNotification) | apps/api/src/lib/notifications/emit.ts:45 - accetta Pool o PoolClient, con dedupe e preferenze per-tipo (righe 13-37) | Qualunque nuovo evento di dominio diventa una notifica in-app con un'unica chiamata, riusando preferenze utente e dedupe gia' scritti - non serve costruire un sistema di notifica ad hoc per modulo |
| Lettore web sandboxato con quattro guardie (SSRF, https-only, limiti, redirect verificati) | apps/api/src/modules/research/web-reader.ts:4-30 | Qualunque feature che debba arricchire dati da fonti web pubbliche riusa un punto di ingresso gia' presidiato, invece di aprire un nuovo varco di rete in uscita da controllare da zero |
| Pattern modulo a 7 passi, applicato uniformemente a 98 moduli | .claude/rules/api-module-pattern.md; comando: ls apps/api/src/modules, poi wc -l -> 98 | Un nuovo modulo CRUD ha un costo prevedibile e basso perche' segue un template meccanico (schema-repo-service-routes-registrazione-test-commit), non un progetto di design ogni volta |

## Lacune dichiarate (non colmate in questo mandato)

- Nessuna misura di piano-query eseguita sulla VIEW PIP (sys_position_intelligence_profiles_v) sotto carico realistico - l'affermazione "6 subquery correlate per riga" e' strutturale (dal DDL), non una misura di costo.
- Copertura reale dell'i18n (se esistono stringhe fuori dalle 10 chiavi JSON per lingua) non verificata - richiede pnpm i18n:check, non eseguito in questa sessione.
- Conteggio corrente di ruoli/permessi RBAC (sys.sys_auth_roles, sys.sys_auth_role_permissions) non ri-derivato via query DB in questa sessione - riportati solo i valori dal commento della migrazione fondativa (8 ruoli, ~100 permessi), dichiarati dalla dottrina di progetto come variabili nel tempo.
- Mig. 000012 (assegnazione posizione-utente, incumbency) non letta in questa sessione: l'affermazione su "storico di chi ha occupato una posizione" e' dedotta dal commento di 000011, non verificata riga per riga sulla tabella satellite.
- Esecuzione effettiva di check_no_legacy_ingest.py non lanciata in questa sessione: il vincolo I12 e' riportato come dottrina dichiarata nel CLAUDE.md, non come esito di comando fresco.
