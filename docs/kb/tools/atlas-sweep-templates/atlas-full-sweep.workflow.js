export const meta = {
  name: 'atlas-full-sweep',
  description: 'Full sweep multi-agente heuresys-advanced: API/web/shared/DB/ops/legacy/wiki/ui-lib → frammenti YAML + sintesi',
  phases: [
    { title: 'Sweep' },
  ],
}

const FRAG = 'C:/Users/ENZOSP~1/AppData/Local/Temp/claude/D--heuresys-advanced/bf6ec936-14a5-4757-96b1-3ef921c3699e/scratchpad/atlas_fragments'
const REPO = 'D:/heuresys-advanced'

const SUMMARY = {
  type: 'object',
  properties: {
    fragment_file: { type: 'string', description: 'path assoluto del frammento YAML scritto' },
    counts: { type: 'object', additionalProperties: { type: 'number' } },
    notables: { type: 'array', items: { type: 'string' }, maxItems: 14, description: 'gap/anomalie/opportunita rilevate, ognuna con evidenza file:line o query' },
    summary: { type: 'string', description: 'sintesi 3-6 frasi' },
  },
  required: ['fragment_file', 'summary', 'notables'],
  additionalProperties: false,
}

const COMMON = `REGOLE COMUNI (vincolanti):
- Lavori in ${REPO} (repo heuresys-advanced, Windows). SOLO lettura sul repo; l'UNICA scrittura permessa e' il tuo file frammento sotto ${FRAG}/ (crea la dir se manca).
- MAI leggere .env, .secrets/, *.pem, *.key. MAI loggare credenziali.
- Il frammento e' YAML compatto, dati strutturati, zero prosa ridondante. E' la fonte che verra' usata per costruire l'atlante di progetto: precisione > brevita', ma niente ripetizioni.
- "notables" nel return: segnali utili per il brainstorming sulle linee di sviluppo (gap, feature senza dati, codice morto, TODO, incoerenze, opportunita'), ciascuno con evidenza (file:line o query). Non inventare: se non trovi nulla, lista vuota.
- Il tuo testo finale = solo i dati richiesti dallo schema (StructuredOutput).`

const API_CHUNKS = [
  ['activity-classification-mappings','activity-classifications','analytics','approvals','assessment-methods','assessment-results','assessments','auth','blueprint-activations','blueprint-families'],
  ['blueprint-overrides','blueprint-processes','blueprint-variants','brownfield-import-runs','brownfield-source-exports','brownfield-table-mappings','brownfield-wave-executor','capability-composition','capability-maturity','career-path-steps'],
  ['career-paths','compensation','content','content-blueprint-links','dashboard','engagement','engagement-feedback','enterprise-size-bands','enterprise-typing-profiles','goals'],
  ['insights','job-families','job-roles','kpi-definitions','leads','learning-gaps','learning-modules','learning-path-steps','learning-paths'],
  ['me','mentorship','mfa-policy','notifications','observability','okrs','operating-models','organization-unit-kpi-templates','organization-unit-processes'],
  ['organization-units','position-career-paths','position-succession-relevance','positions','predictions','process-kpi-templates','public-stats','reference-sync','seed-acquisition-runs'],
  ['seed-approval-decisions','seed-candidate-records','semantic-matching','skill-aliases','skill-categories','skill-families','skill-proficiency-levels','skill-taxonomy-edges','skills'],
  ['succession-pools','successor-candidates','successor-readiness','surveys','teams','tenant-materialization','tenants','training-initiatives','user-career-plans'],
  ['users','visualization-edges','visualization-exports','visualization-graphs','visualization-layouts','visualization-node-layouts','visualization-nodes','visualization-styles'],
]

function apiPrompt(chunk, idx) {
  return `${COMMON}

TASK: inventario cross-layer dei seguenti ${chunk.length} moduli API Fastify in ${REPO}/apps/api/src/modules/: ${chunk.join(', ')}.

Per OGNI modulo estrai (leggendo routes.ts + eventuali *-routes.ts extra, repository.ts + eventuali *-repository.ts, service.ts se serve per capire lo scope):
1. prefix di registrazione: grep del nome modulo in ${REPO}/apps/api/src/app.ts (pattern app.register(<x>Routes, { prefix: '/v1/...' })).
2. endpoints: per ogni route -> method, path relativo, permission (argomento di requirePermission('...')), csrf (true se app.verifyCsrf presente), orgGate (true/dataclass se la route ha config.orgGate o marker equivalente).
3. tables: tutte le tabelle referenziate nei file SQL del modulo (regex su FROM / JOIN / INSERT INTO / UPDATE / DELETE FROM / MERGE, schemi sys.* brownfield.* staging.* audit.*), dedup.
4. schemas: subpath import da @heuresys/shared (es. schemas/users).
5. tests: file in ${REPO}/apps/api/test/ il cui nome matcha il modulo (Glob).
6. notes: peculiarita' (CLI file, effects, connettori esterni, pattern di visibilita' tenant/global/platform dichiarato nel service).

Scrivi il frammento YAML in ${FRAG}/api_c${idx + 1}.yaml con struttura:
modules:
  <nome-modulo>:
    prefix: /v1/x
    endpoints:
      - {method: GET, path: /, permission: 'x:read', csrf: false, orgGate: false}
    tables: [sys.sys_x]
    schemas: [x]
    tests: [x.integration.test.ts]
    notes: [...]

counts nel return: {modules: N, endpoints: N, tables_distinct: N}.`
}

const WEB_SWEEPS = [
  {
    file: 'web_admin.yaml',
    label: 'web:admin',
    scope: `tutte le pagine page.tsx sotto ${REPO}/apps/web/src/app/(authenticated)/ ESCLUSA la sottodir me/ (~53 pagine)`,
  },
  {
    file: 'web_me_public.yaml',
    label: 'web:me+public',
    scope: `tutte le pagine page.tsx sotto ${REPO}/apps/web/src/app/(authenticated)/me/ (~24) + le pagine pubbliche direttamente sotto ${REPO}/apps/web/src/app/ fuori da (authenticated) e showcase (~6, es. login/demo/investors)`,
  },
  {
    file: 'web_showcase_lib.yaml',
    label: 'web:showcase+lib',
    scope: `le ~18 pagine sotto ${REPO}/apps/web/src/app/showcase/ (solo route+scopo, senza dettaglio hook) + INOLTRE inventario completo di ${REPO}/apps/web/src/lib/ (client API: ogni file, hook esportati, endpoint chiamati) e ${REPO}/apps/web/src/components/ (11 componenti: nome, cosa compone, quali primitive @heuresys/ui usa) e middleware/proxy auth se presente (middleware.ts, next.config)`,
  },
]

function webPrompt(sweep) {
  return `${COMMON}

TASK: inventario frontend Next.js 15 App Router. Scope: ${sweep.scope}.

Per OGNI pagina estrai (Read del page.tsx + dei componenti locali importati se necessario):
1. route URL derivata dal path della dir (le route group (xxx) non compaiono nell'URL).
2. zona: admin | me | public | showcase.
3. hooks dati: hook TanStack Query / custom hook importati da lib (nome hook).
4. endpoints: endpoint /v1/* chiamati (direttamente o via hook — se il hook e' in lib/, risali all'endpoint con un Grep mirato nel file lib).
5. ui: componenti @heuresys/ui importati.
6. notes: empty-state, gating RBAC client, perspective PET, peculiarita'.

Scrivi il frammento YAML in ${FRAG}/${sweep.file} con struttura:
pages:
  /percorso/url:
    zone: admin
    hooks: [useX]
    endpoints: [GET /v1/x]
    ui: [DataTable, Card]
    notes: [...]
(la parte lib/components della terza sweep va in sezioni separate 'lib:' e 'components:')

counts nel return: {pages: N, endpoints_distinct: N}.`
}

// ---- sweep specs ----
const SPECS = []

API_CHUNKS.forEach((chunk, i) => {
  SPECS.push({ label: 'api:c' + (i + 1), prompt: apiPrompt(chunk, i) })
})
WEB_SWEEPS.forEach((s) => {
  SPECS.push({ label: s.label, prompt: webPrompt(s) })
})

SPECS.push({
  label: 'shared:schemas',
  prompt: `${COMMON}

TASK: inventario di ${REPO}/packages/shared/src/schemas/ (87 file attesi).
1. Lista schemi: per ogni file, gli export Zod principali (Create/Update/Filter/Response — solo i nomi).
2. Parita' subpath exports: confronta la lista file con gli exports in ${REPO}/packages/shared/package.json — segnala schemi senza subpath export e viceversa.
3. Consumers: per ogni schema, quali moduli API (${REPO}/apps/api/src) e quali file web (${REPO}/apps/web/src) lo importano (Grep su '@heuresys/shared/schemas/<nome>' e import dal barrel). Basta la lista dei consumer per schema, non le righe.
4. Orfani: schemi senza alcun consumer (candidati brainstorm).

Scrivi ${FRAG}/shared_schemas.yaml:
schemas:
  <nome>:
    exports: [XCreateSchema, ...]
    subpath_export: true
    consumers_api: [users, me]
    consumers_web: [lib/api/users.ts]
orphans: [...]
export_mismatches: [...]

counts: {schemas: N, orphans: N}.`,
})

SPECS.push({
  label: 'db:live',
  prompt: `${COMMON}

TASK: snapshot del DB live heuresys_advanced (PostgreSQL 16 su OCI VM via tunnel gia' attivo: psql -h localhost -p 5433 -U heuresys -d heuresys_advanced, pgpass configurato — usa il tool Bash, comandi psql -c "..." con output -At o -F'|' per parsing facile).
1. Schemi presenti (\\dn).
2. Per OGNI tabella utente: schemaname, relname, n_live_tup (pg_stat_user_tables) + size (pg_total_relation_size pretty). Ordina per schema+nome.
3. Tabelle con n_live_tup=0: verifica esatta con SELECT count(*) SOLO su quelle → lista definitiva TABELLE VUOTE (= feature senza dati, oro per il brainstorming).
4. Viste e materialized view in sys.* (nome + se matview).
5. Top 20 tabelle per size.
6. Conteggi chiave di contesto: tenants attivi, utenti, posizioni, org unit, ruoli, mappature role_permissions, ui_interfaces.
7. Estensioni installate (\\dx — es. uuid-ossp, vector?).

Scrivi ${FRAG}/db_live.yaml con sezioni: schemas, tables (lista {schema, name, rows, size}), empty_tables, views, matviews, top_size, key_counts, extensions.
counts: {tables: N, empty_tables: N, views: N}.
notables: le tabelle vuote piu' significative (feature shipped senza dati) + anomalie.`,
})

SPECS.push({
  label: 'ops:scripts+ci',
  prompt: `${COMMON}

TASK: inventario operativo.
1. ${REPO}/scripts/ (31 file): per ciascuno — nome, cosa fa (leggi header/commenti primi ~25 righe), quando si usa (sessione/deploy/CI/one-shot).
2. ${REPO}/.github/workflows/ (9 yml): nome, trigger (on:), jobs principali, runner (self-hosted VM?).
3. ${REPO}/db/scripts/ (26 file): nome + scopo in una riga (dai commenti header).
4. ${REPO}/deploy/README.md: sezioni principali (solo indice + 1 riga ciascuna).
5. Unita' systemd note sulla VM (riporta questa lista gia' verificata, integrala se deploy/ contiene unit file): heuresys-advanced-{api,web,approvals-sla,auth-housekeeping,backup,dr-drill,insights,notifications-digest,reindex,scraping} + heuresys-{api-gateway,app,enrichment} (legacy evo) + runner GitHub Actions. Se ${REPO}/deploy/ contiene i file .service/.timer, elenca i timer e le cadenze.

Scrivi ${FRAG}/ops.yaml con sezioni: scripts, workflows, db_scripts, deploy_docs, systemd.
counts: {scripts: N, workflows: N, db_scripts: N}.`,
})

SPECS.push({
  label: 'legacy:primary',
  prompt: `${COMMON}

TASK: mappa dei DATI CHE ABBIAMO — read-only.

⛔ EMENDATO 2026-08-14 — ADR-0038. Questo passo interrogava il database legacy per
censire "cosa resta da importare". Quella domanda non esiste piu': il rubinetto e'
chiuso, il DBMS advanced e' autosufficiente, e nessun lavoro futuro importera' righe dal
legacy. Censire il legacy produrrebbe una lista di cose da NON fare, e prima o poi
qualcuno la eseguirebbe. Percio' il passo guarda l'advanced.

1. Inventario reale di sys.* (psql -h localhost -p 5433 -U heuresys -d heuresys_advanced):
   tabelle con conteggio righe, top 30 per volume, dimensione del database.
2. Tabelle POPOLATE ma non lette da alcun modulo API — e' il cancello di esposizione (#79):
   python docs/kb/tools/check_exposure.py, e riportane l'esito.
3. Tabelle VUOTE: per ognuna, e' un vuoto legittimo (event-driven, si popola all'uso) o una
   funzionalita' che non e' mai partita? La distinzione e' il vero oro per il brainstorming.
4. reference_sync (ISTAT/ATECO/ESCO/NACE): stato delle sincronizzazioni. NON e' brownfield —
   sono classificazioni ufficiali esterne, e continuano.

Scrivi ${FRAG}/legacy_primary.yaml con sezioni: sys_tables (top+counts), unexposed_tables,
empty_tables (con la distinzione del punto 3), reference_sync_state.
counts: {legacy_tables: N, mapped_tables: N, uncovered_big: N}.
notables: i residui non importati piu' promettenti.`,
})

SPECS.push({
  label: 'legacy:cantiere',
  prompt: `${COMMON}

TASK: inventario del CANTIERE legacy /home/ubuntu/heuresys.com.evo sulla VM (lineage attivo NON in produzione, ultimo commit 2026-06-29) — read-only via Bash SSH, prefissa SEMPRE MSYS_NO_PATHCONV=1.
1. git -C /home/ubuntu/heuresys.com.evo log --since=2026-04-01 --oneline | tema-tizzali (conta commit, raggruppa per tema dai messaggi).
2. Struttura: ls delle dir principali (services/? packages/? docs/?), stack (leggi package.json root: deps chiave).
3. Leggi HANDOFF.md (primi ~120 righe) + ROAD_TO_GLORY.md (primi ~80) + eventuale ROAD_TO_GLORY_EVO_HARDENING.md (primi ~40) per capire stato e direzione del cantiere.
4. Confronto concettuale: quali feature/temi lavorati qui NON esistono in heuresys-advanced (che ha: 83 moduli HRMS/BPM, ESS, RBAC bi-assiale, brownfield pipeline, visualization, semantic matching, MFA). Elenca i divergenti.

Scrivi ${FRAG}/legacy_cantiere.yaml con sezioni: recent_commits_themes, structure, stack, state_summary, divergent_features.
counts: {commits_since_apr: N}.
notables: idee/feature del cantiere potenzialmente rilevanti per le linee di sviluppo advanced.`,
})

SPECS.push({
  label: 'wiki:space',
  prompt: `${COMMON}

TASK: assessment della wiki di progetto esterna — read-only.
1. C:/Users/enzospenuso/wiki-space/heuresys-advanced-wiki/ — lista pagine .md con data modifica; leggi la home/index e 2-3 pagine centrali (solo titoli sezioni) per capire il taglio.
2. C:/Users/enzospenuso/wiki-space/heuresys-advanced-graph/ — data di graph.json in src-mirror/graphify-out/, numero nodi/edge dal manifest o GRAPH_REPORT se presente. NON parsare il graph.json intero (8543 nodi).
3. Verdetto freshness: confronta le date con lo stato del repo (v1.0.0 GA 2026-06-02, oggi 2026-07-05, HEAD 2026-07-05): quali pagine sono stale e su cosa (conteggi? architettura? roadmap?).
4. Registry: C:/Users/enzospenuso/wiki-space/.wiki-vaults.yaml o simile — quali vault esistono.

Scrivi ${FRAG}/wiki.yaml con sezioni: pages (nome, mtime, tema), graph (data, nodi, edge), staleness_verdict, vaults.
counts: {pages: N}.
notables: cosa della wiki e' riusabile vs da rigenerare.`,
})

SPECS.push({
  label: 'ui:design-shared',
  prompt: `${COMMON}

TASK: inventario del design system — read-only su D:/ux-design-shared (repo sorgente di @heuresys/ui).
1. Versione pubblicata: package.json della lib (path ui/ o packages/ui — scopri con Glob su package.json con name @heuresys/ui) → version corrente; git log -1 della working copy.
2. Versione consumata in heuresys-advanced: Grep '"@heuresys/ui"' in ${REPO}/package.json, ${REPO}/apps/web/package.json, ${REPO}/apps/showcase/package.json → range e versione risolta nel lockfile (Grep '@heuresys/ui@' in ${REPO}/pnpm-lock.yaml, prima occorrenza).
3. Componenti: inventario export della lib (index.ts / exports map): nomi componenti, raggruppati per tier/categoria se la struttura dir lo mostra. Count stories Storybook (*.stories.*).
4. Delta: la versione working copy e' avanti rispetto alla pubblicata/consumata? (git log dalla data del tag/version bump — o confronta version in package.json vs lockfile advanced).

Scrivi ${FRAG}/ui_lib.yaml con sezioni: versions (source, published_consumed), components (per categoria), stories_count, delta_notes.
counts: {components: N}.
notables: componenti disponibili ma non ancora usati in apps/web (se ricavabile con Grep rapido dei nomi piu' distintivi in ${REPO}/apps/web/src).`,
})

// ---- esecuzione: tutte indipendenti, un'unica ondata parallela ----
phase('Sweep')
log('Lancio ' + SPECS.length + ' sweep paralleli (9 API + 3 web + 7 trasversali)')

const results = await parallel(SPECS.map((s) => () =>
  agent(s.prompt, { label: s.label, phase: 'Sweep', schema: SUMMARY })
    .then((r) => (r ? { label: s.label, ...r } : null))
))

const ok = results.filter(Boolean)
const failed = SPECS.map((s, i) => (results[i] ? null : s.label)).filter(Boolean)
log('Sweep completati: ' + ok.length + '/' + SPECS.length + (failed.length ? ' — FALLITI: ' + failed.join(', ') : ''))

return {
  completed: ok.length,
  failed,
  fragments: ok.map((r) => r.fragment_file),
  summaries: ok.map((r) => ({ label: r.label, counts: r.counts || {}, summary: r.summary, notables: r.notables })),
}