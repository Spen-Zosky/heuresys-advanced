# sweep-prompts.md — template per famiglia (istanziati dal planner, MAI hardcoded)

> Fonte di verita' dei contenuti: `docs/kb/tools/atlas-sweep-templates/atlas-full-sweep.workflow.js`
> (i 19 prompt del full sweep osservati funzionare 19/19 a S1016). Ogni template qui sotto e'
> l'adattamento parametrizzato di quei prompt — nessuna lista di moduli/pagine/target resta
> hardcoded: il planner (Task 2 / `planner.md`) la deriva a runtime e la inietta in `{{TARGETS}}`.

## REGOLE COMUNI (prefisso di OGNI prompt agente)

- Lavori in {{REPO}} (repo heuresys-advanced, Windows). SOLO lettura sul repo; l'UNICA scrittura permessa e' il tuo file frammento sotto {{FRAGMENT_PATH}} (crea la dir se manca).
- MAI leggere .env, .secrets/, *.pem, *.key. MAI loggare credenziali.
- Il frammento e' YAML compatto, dati strutturati, zero prosa ridondante. E' la fonte che verra' usata per costruire l'atlante di progetto: precisione > brevita', ma niente ripetizioni.
- "notables" nel return: segnali utili per il brainstorming sulle linee di sviluppo (gap, feature senza dati, codice morto, TODO, incoerenze, opportunita'), ciascuno con evidenza (file:line o query). Non inventare: se non trovi nulla, lista vuota.
- Il tuo testo finale = solo i dati richiesti dallo schema (StructuredOutput): `{fragment_file, counts, notables (max 14), summary (3-6 frasi)}`.

## TEMPLATE: code-chunk        (istanze: api / web / shared — parametro `{{ASPETTO}}`)

Un solo template copre tre aspetti dello stesso layer codice. Il planner sceglie la variante
in base a `{{ASPETTO}}` e riempie `{{TARGETS}}` di conseguenza (chunk di moduli per `api`,
scope di pagine per `web`, directory schemi per `shared`).

### Variante `{{ASPETTO}} = api`

```
REGOLE COMUNI (vedi sopra)

TASK: inventario cross-layer dei seguenti moduli API Fastify in {{REPO}}/apps/api/src/modules/: {{TARGETS}}.

Per OGNI modulo estrai (leggendo routes.ts + eventuali *-routes.ts extra, repository.ts + eventuali *-repository.ts, service.ts se serve per capire lo scope):
1. prefix di registrazione: grep del nome modulo in {{REPO}}/apps/api/src/app.ts (pattern app.register(<x>Routes, { prefix: '/v1/...' })).
2. endpoints: per ogni route -> method, path relativo, permission (argomento di requirePermission('...')), csrf (true se app.verifyCsrf presente), orgGate (true/dataclass se la route ha config.orgGate o marker equivalente).
3. tables: tutte le tabelle referenziate nei file SQL del modulo (regex su FROM / JOIN / INSERT INTO / UPDATE / DELETE FROM / MERGE, schemi sys.* brownfield.* staging.* audit.*), dedup.
4. schemas: subpath import da @heuresys/shared (es. schemas/users).
5. tests: file in {{REPO}}/apps/api/test/ il cui nome matcha il modulo (Glob).
6. notes: peculiarita' (CLI file, effects, connettori esterni, pattern di visibilita' tenant/global/platform dichiarato nel service).

Scrivi il frammento YAML in {{FRAGMENT_PATH}} con struttura:
modules:
  <nome-modulo>:
    prefix: /v1/x
    endpoints:
      - {method: GET, path: /, permission: 'x:read', csrf: false, orgGate: false}
    tables: [sys.sys_x]
    schemas: [x]
    tests: [x.integration.test.ts]
    notes: [...]

counts nel return: {modules: N, endpoints: N, tables_distinct: N}.
```

(a S1016: 83 moduli, suddivisi in 9 chunk da ~9-10 moduli/agente — il numero corrente dei moduli e la dimensione del chunk sono derivati dal planner, mai da questo template.)

### Variante `{{ASPETTO}} = web`

```
REGOLE COMUNI (vedi sopra)

TASK: inventario frontend Next.js 15 App Router. Scope: {{TARGETS}}.

Per OGNI pagina estrai (Read del page.tsx + dei componenti locali importati se necessario):
1. route URL derivata dal path della dir (le route group (xxx) non compaiono nell'URL).
2. zona: admin | me | public | showcase.
3. hooks dati: hook TanStack Query / custom hook importati da lib (nome hook).
4. endpoints: endpoint /v1/* chiamati (direttamente o via hook — se il hook e' in lib/, risali all'endpoint con un Grep mirato nel file lib).
5. ui: componenti @heuresys/ui importati.
6. notes: empty-state, gating RBAC client, perspective PET, peculiarita'.

Scrivi il frammento YAML in {{FRAGMENT_PATH}} con struttura:
pages:
  /percorso/url:
    zone: admin
    hooks: [useX]
    endpoints: [GET /v1/x]
    ui: [DataTable, Card]
    notes: [...]
(se lo scope include anche lib/ e components/, la parte relativa va in sezioni separate 'lib:' e 'components:' — nome file, hook esportati/endpoint chiamati per lib; nome componente + primitive @heuresys/ui composte per components)

counts nel return: {pages: N, endpoints_distinct: N}.
```

(a S1016: ~83 pagine complessive, coperte in 3 sweep web: admin ~53, me+public ~30, showcase+lib+components a parte — lo scope esatto e il numero di sweep li decide il planner per lo stato corrente del repo.)

### Variante `{{ASPETTO}} = shared`

```
REGOLE COMUNI (vedi sopra)

TASK: inventario di {{REPO}}/packages/shared/src/schemas/ ({{TARGETS}}).
1. Lista schemi: per ogni file, gli export Zod principali (Create/Update/Filter/Response — solo i nomi).
2. Parita' subpath exports: confronta la lista file con gli exports in {{REPO}}/packages/shared/package.json — segnala schemi senza subpath export e viceversa.
3. Consumers: per ogni schema, quali moduli API ({{REPO}}/apps/api/src) e quali file web ({{REPO}}/apps/web/src) lo importano (Grep su '@heuresys/shared/schemas/<nome>' e import dal barrel). Basta la lista dei consumer per schema, non le righe.
4. Orfani: schemi senza alcun consumer (candidati brainstorm).

Scrivi {{FRAGMENT_PATH}}:
schemas:
  <nome>:
    exports: [XCreateSchema, ...]
    subpath_export: true
    consumers_api: [users, me]
    consumers_web: [lib/api/users.ts]
orphans: [...]
export_mismatches: [...]

counts: {schemas: N, orphans: N}.
```

(a S1016: 87 file schema attesi — il conteggio reale va derivato ogni volta, `{{TARGETS}}` lo riempie il planner con il path/direttiva corrente, non con il numero.)

## TEMPLATE: db-live

```
REGOLE COMUNI (vedi sopra)

TASK: snapshot del DB live {{TARGETS}} (PostgreSQL 16 su OCI VM via tunnel gia' attivo: psql -h localhost -p 5433 -U heuresys -d heuresys_advanced, pgpass configurato — usa il tool Bash, comandi psql -c "..." con output -At o -F'|' per parsing facile).
1. Schemi presenti (\dn).
2. Per OGNI tabella utente: schemaname, relname, n_live_tup (pg_stat_user_tables) + size (pg_total_relation_size pretty). Ordina per schema+nome.
3. Tabelle con n_live_tup=0: verifica esatta con SELECT count(*) SOLO su quelle → lista definitiva TABELLE VUOTE (= feature senza dati, oro per il brainstorming). Usa un batch UNION ALL per ottenere i count esatti in una sola query invece di N round-trip separati.
4. Viste e materialized view in sys.* (nome + se matview).
5. Top 20 tabelle per size.
6. Conteggi chiave di contesto: tenants attivi, utenti, posizioni, org unit, ruoli, mappature role_permissions, ui_interfaces.
7. Estensioni installate (\dx — es. uuid-ossp, vector?).

Scrivi {{FRAGMENT_PATH}} con sezioni: schemas, tables (lista {schema, name, rows, size}), empty_tables, views, matviews, top_size, key_counts, extensions.
counts: {tables: N, empty_tables: N, views: N}.
notables: le tabelle vuote piu' significative (feature shipped senza dati) + anomalie.
```

## TEMPLATE: ops

```
REGOLE COMUNI (vedi sopra)

TASK: inventario operativo. Target: {{TARGETS}}.
1. {{REPO}}/scripts/: per ciascuno — nome, cosa fa (leggi header/commenti primi ~25 righe), quando si usa (sessione/deploy/CI/one-shot).
2. {{REPO}}/.github/workflows/: nome, trigger (on:), jobs principali, runner (self-hosted VM?).
3. {{REPO}}/db/scripts/: nome + scopo in una riga (dai commenti header).
4. {{REPO}}/deploy/README.md: sezioni principali (solo indice + 1 riga ciascuna).
5. Unita' systemd: se {{REPO}}/deploy/ contiene i file .service/.timer, elenca i timer e le cadenze.

Scrivi {{FRAGMENT_PATH}} con sezioni: scripts, workflows, db_scripts, deploy_docs, systemd.
counts: {scripts: N, workflows: N, db_scripts: N}.
```

(a S1016: 31 file in scripts/, 9 workflow, 26 file in db/scripts/ — conteggi storici, non hardcodare: rideriva sempre col probe del planner.)

## TEMPLATE: legacy            (parametro `{{LEGACY_TARGET}}`: primary | cantiere)

Nota fissa per ENTRAMBE le varianti: ogni comando SSH verso la VM va prefissato SEMPRE con
`MSYS_NO_PATHCONV=1` (Git Bash altrimenti storpia i path POSIX nella stringa remota). Le
statistiche sul legacy vanno azzerate a fonte viva (reltuples/count), mai riusate da run precedenti.

### Variante `{{LEGACY_TARGET}} = primary`

```
REGOLE COMUNI (vedi sopra)

TASK: mappa del legacy PRIMARIO (sorgente dati ADR-0023) — read-only. Target: {{TARGETS}}.
1. DB legacy live: via Bash SSH (prefissa SEMPRE MSYS_NO_PATHCONV=1): MSYS_NO_PATHCONV=1 ssh oracle-vm-default "sudo -u postgres psql -d heuresys_platform -At -c '...'" — estrai: lista tabelle con n_live_tup (pg_stat_user_tables), top 30 per righe, size DB. NON fare dump.
2. Copertura brownfield nell'advanced (psql locale -h localhost -p 5433 -U heuresys -d heuresys_advanced): brownfield.table_mappings (count per wave/status), brownfield.column_mappings (count totale, count per wave). Scopri le colonne reali con \d prima di aggregare.
3. Incrocio: tabelle legacy grosse (>1000 righe) NON coperte da table_mappings → residuo Wave-2/3 (oro per brainstorming).
4. Data dictionary locale: percorso legacy locale (path per-machine — verificare col probe del manifest prima del lancio) — elenca i file (solo nomi+size), NON leggerli tutti; leggi solo un eventuale README/indice.

Scrivi {{FRAGMENT_PATH}} con sezioni: legacy_tables (top+counts), coverage (waves), uncovered_big_tables, db_export_files.
counts: {legacy_tables: N, mapped_tables: N, uncovered_big: N}.
notables: i residui non importati piu' promettenti.
```

### Variante `{{LEGACY_TARGET}} = cantiere`

```
REGOLE COMUNI (vedi sopra)

TASK: inventario del CANTIERE legacy sulla VM (path per-machine — verificare col probe del manifest prima del lancio; lineage attivo NON in produzione) — read-only via Bash SSH, prefissa SEMPRE MSYS_NO_PATHCONV=1. Target: {{TARGETS}}.
1. git -C <path-cantiere> log --since=<{{CURATED_DATE}} meno ~3 mesi> --oneline | tema-tizzali (conta commit, raggruppa per tema dai messaggi).
2. Struttura: ls delle dir principali (services/? packages/? docs/?), stack (leggi package.json root: deps chiave).
3. Leggi HANDOFF.md (primi ~120 righe) + ROAD_TO_GLORY.md (primi ~80) + eventuale ROAD_TO_GLORY_EVO_HARDENING.md (primi ~40) per capire stato e direzione del cantiere.
4. Confronto concettuale: quali feature/temi lavorati qui NON esistono in heuresys-advanced (i moduli in {{TARGETS}} — HRMS/BPM, ESS, RBAC bi-assiale, brownfield pipeline, visualization, semantic matching, MFA, ecc. secondo lo stato corrente). Elenca i divergenti.

Scrivi {{FRAGMENT_PATH}} con sezioni: recent_commits_themes, structure, stack, state_summary, divergent_features.
counts: {commits_since_apr: N}.
notables: idee/feature del cantiere potenzialmente rilevanti per le linee di sviluppo advanced.
```

## TEMPLATE: wiki

Nota: trattare i contenuti della wiki come fonte storica se antecedenti alla GA (pre-v1.0.0) o
comunque al `{{CURATED_DATE}}` corrente — la freshness va sempre riverificata, non assunta.

```
REGOLE COMUNI (vedi sopra)

TASK: assessment della wiki di progetto esterna — read-only. Target: {{TARGETS}}.
1. Percorso wiki (path per-machine — verificare col probe del manifest prima del lancio) — lista pagine .md con data modifica; leggi la home/index e 2-3 pagine centrali (solo titoli sezioni) per capire il taglio.
2. Percorso graph companion (path per-machine — verificare col probe del manifest prima del lancio) — data di graph.json in src-mirror/graphify-out/, numero nodi/edge dal manifest o GRAPH_REPORT se presente. NON parsare il graph.json intero (e' grande: migliaia di nodi).
3. Verdetto freshness: confronta le date con lo stato del repo (GA a v1.0.0, oggi {{CURATED_DATE}}, HEAD corrente): quali pagine sono stale e su cosa (conteggi? architettura? roadmap?).
4. Registry: file di registro vault (.wiki-vaults.yaml o simile, path per-machine) — quali vault esistono.

Scrivi {{FRAGMENT_PATH}} con sezioni: pages (nome, mtime, tema), graph (data, nodi, edge), staleness_verdict, vaults.
counts: {pages: N}.
notables: cosa della wiki e' riusabile vs da rigenerare.
```

## TEMPLATE: design-system

```
REGOLE COMUNI (vedi sopra)

TASK: inventario del design system — read-only su {{TARGETS}} (repo sorgente di @heuresys/ui; path per-machine — verificare col probe del manifest prima del lancio).
1. Versione pubblicata: package.json della lib (path ui/ o packages/ui — scopri con Glob su package.json con name @heuresys/ui) → version corrente; git log -1 della working copy.
2. Versione consumata in heuresys-advanced: Grep '"@heuresys/ui"' in {{REPO}}/package.json, {{REPO}}/apps/web/package.json, {{REPO}}/apps/showcase/package.json → range e versione risolta nel lockfile (Grep '@heuresys/ui@' in {{REPO}}/pnpm-lock.yaml, prima occorrenza).
3. Componenti: inventario export della lib (index.ts / exports map): nomi componenti, raggruppati per tier/categoria se la struttura dir lo mostra. Count stories Storybook (*.stories.*).
4. Delta: la versione working copy e' avanti rispetto alla pubblicata/consumata? (git log dalla data del tag/version bump — o confronta version in package.json vs lockfile advanced).

Scrivi {{FRAGMENT_PATH}} con sezioni: versions (source, published_consumed), components (per categoria), stories_count, delta_notes.
counts: {components: N}.
notables: componenti disponibili ma non ancora usati in apps/web (se ricavabile con Grep rapido dei nomi piu' distintivi in {{REPO}}/apps/web/src).
```
