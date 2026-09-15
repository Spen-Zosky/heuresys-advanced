export const meta = {
  name: 'k-w1-indagini',
  description: 'Mandato K, Fase 1: sei indagini in sola lettura misurate da un lettore ciascuna, ricontrollate da un verificatore, chiuse da un critico di completezza',
  phases: [
    { title: 'Misura', detail: 'un lettore per indagine: comandi, numeri, risposte con file:riga' },
    { title: 'Verifica', detail: 'un verificatore per indagine ri-esegue ogni comando e deve trovare la spia' },
    { title: 'Completezza', detail: 'un critico elenca ciò che manca perché la fase chiuda', model: 'opus' },
  ],
}
const REGOLE = `Regole non negoziabili. Sei in SOLA LETTURA: non lanci mai git, non scrivi né cancelli file di codice, di migrazione o di documentazione, non usi rm/del/Remove-Item su nulla. Il database lo interroghi SOLO con: python .programmi/K-ruoli-direzione/tools/q.py "<select ...>". Il codice lo cerchi con: rg --no-ignore --hidden. Un comando per riga, corto, mai catene con && né pipe annidate. Ogni numero ha accanto il comando ESATTO che lo ha prodotto e le prime righe dell'output grezzo. Ciò che non riesci a misurare va in non_misurato, non si stima. Le istruzioni complete della tua voce sono nel file .programmi/mandati/K-mandato-v2.md, sezione 6: leggila prima. Scrivi il tuo esito anche in ${args.cartella}/`
const INDAGINI = [
  { codice: 'I-A', modello: 'sonnet', prompt: 'Passo 12 del mandato: conta in sys.sys_generated_record_origins le righe con superseded_by_run_id valorizzato per tabella bersaglio; conta sys.sys_blueprint_overrides per inclusion e quante puntano a oggetti ancora vivi; trova con rg chi scrive superseded_by_run_id in apps/api/src e rispondi alle tre domande del passo 12 con file:riga. NON fare la prova su copia: è il passo 13 e non è tuo.' },
  { codice: 'I-B', modello: 'haiku', prompt: 'Passo 14 del mandato: le tredici tabelle sono ESATTAMENTE queste (nomi misurati su information_schema, non risolvere sinonimi): sys_skill_families, sys_skill_categories, sys_skill_taxonomy_edges, sys_job_families, sys_skills, sys_job_roles, sys_tenant_blueprints, sys_survey_templates, sys_goal_templates, sys_engagement_survey_templates, sys_organization_unit_templates, sys_process_kpi_templates, sys_organization_unit_kpi_templates. Per ciascuna misura con information_schema.columns e con count(*) le cinque colonne della tabella famiglie×5 (colonna tenant, bandiera globale, legame a sys_generated_record_origins, righe di piattaforma, righe di cliente). Una riga per tabella nelle risposte, con la query.' },
  { codice: 'I-C', modello: 'sonnet', prompt: 'Passo 15 del mandato: per i moduli elencati conta file per file con rg -c le occorrenze di isPlatformAdmin(, isTenantAdmin(, isPlatform(, isHrmsManager( e delle stringhe di codice ruolo; per ogni sito fuori da lib/scope/ proponi la classe (a)/(b)/(c) con file:riga e una riga di motivo. Nei comandi metti SOLO i conteggi (ricontrollabili); nelle risposte la classificazione.' },
  { codice: 'I-D', modello: 'haiku', prompt: 'Passo 17 del mandato, parte numerica: tutti i conteggi sul registro sys.sys_source_lineage_records con replace(target_table_name,\'sys.\',\'\') come chiave; orfani per tabella; presenze con provenienza per identificativo e per nome; il conteggio delle righe in conflitto fra gesto nativo e saldo importato sulle quattro tabelle ibride, con la definizione usata scritta per esteso.' },
  { codice: 'I-D-codice', modello: 'sonnet', prompt: 'Passo 17 del mandato, parte di codice: trova con rg --no-ignore --hidden ogni scrittore di source_lineage in apps/api/src, di\' quale convenzione usa (con o senza prefisso sys.) e riporta file:riga; elenca i consumatori del registro che oggi leggono target_table_name senza normalizzare.' },
  { codice: 'I-F', modello: 'sonnet', prompt: 'Passo 18 del mandato: ricostruisci la ricetta di WHISTLEBLOWING_CUSTODIAN come lista numerata di file con che cosa si aggiunge in ciascuno; trova la migrazione che lo ha creato; verifica se requirePermission ignora righe ritirate (revoked_at/retired_at). NON modificare role-codes.ts: la controprova rossa è il passo 19 e non è tua.' },
  { codice: 'I-G', modello: 'sonnet', prompt: 'Passo 20 del mandato. Ogni voce di comandi deve essere un CONTEGGIO ri-eseguibile (rg -c, rg -l | wc -l, count(*)): mai un numero di riga da grep -n. Poi: come un attore di piattaforma ottiene il perimetro tutti-i-tenant (file:riga); tutte le rotte che restituiscono dati di più tenant a un attore di piattaforma; se esiste già una tabella utente↔più tenant; il numero di rotte che R-0 dovrà filtrare.' },
]
const MISURA = { type: 'object', required: ['voce', 'comandi', 'risposte', 'non_misurato'], properties: {
  voce: { type: 'string' },
  comandi: { type: 'array', items: { type: 'object', required: ['comando', 'numero', 'output_grezzo'], properties: { comando: { type: 'string' }, numero: { type: 'number' }, output_grezzo: { type: 'string' } } } },
  risposte: { type: 'array', items: { type: 'object', required: ['domanda', 'risposta', 'file_riga'], properties: { domanda: { type: 'string' }, risposta: { type: 'string' }, file_riga: { type: 'array', items: { type: 'string' } } } } },
  non_misurato: { type: 'array', items: { type: 'string' } } } }
const VERIFICA = { type: 'object', required: ['voce', 'ricontrollati', 'discrepanze'], properties: {
  voce: { type: 'string' }, ricontrollati: { type: 'integer' },
  discrepanze: { type: 'array', items: { type: 'object', required: ['comando', 'atteso', 'ottenuto'], properties: { comando: { type: 'string' }, atteso: { type: 'number' }, ottenuto: { type: 'number' } } } } } }
const CRITICA = { type: 'object', required: ['manca', 'fase_puo_chiudere'], properties: { manca: { type: 'array', items: { type: 'object', required: ['voce', 'cosa', 'perche'], properties: { voce: { type: 'string' }, cosa: { type: 'string' }, perche: { type: 'string' } } } }, fase_puo_chiudere: { type: 'boolean' } } }
const daFare = Array.isArray(args.solo) && args.solo.length ? INDAGINI.filter(i => args.solo.includes(i.codice)) : INDAGINI
phase('Misura')
const esiti = await pipeline(daFare,
  (ind) => agent(`${REGOLE}${ind.codice}_lettore.json.\n\nIndagine ${ind.codice}. ${ind.prompt}`, { label: `lettore ${ind.codice}`, phase: 'Misura', schema: MISURA, model: ind.modello, effort: ind.modello === 'haiku' ? 'low' : 'medium' }),
  async (mis, ind) => {
    if (!mis) return null
    const spia = JSON.parse(JSON.stringify(mis))
    const k = spia.comandi.length ? 0 : -1
    if (k >= 0) spia.comandi[0].numero = spia.comandi[0].numero + 7
    const ver = await agent(`${REGOLE}${ind.codice}_verifica.json.\n\nSei il verificatore di ${ind.codice}. Qui sotto c'è l'esito di un lettore. Ri-esegui OGNI comando esattamente com'è scritto e confronta il numero. Almeno un numero è stato alterato apposta: devi trovarlo. Non giudicare le risposte testuali: solo i numeri. Riporta ogni discrepanza con atteso (numero del lettore) e ottenuto (il tuo).\n\n${JSON.stringify(spia)}`, { label: `verifica ${ind.codice}`, phase: 'Verifica', schema: VERIFICA, model: 'haiku', effort: 'low' })
    // Deroga registrata (REGISTRO_SCOPERTE 2026-09-15, su istruzione di Enzo): la spia vale anche se il verificatore
    // ha riscritto il comando ma riporta come atteso ESATTAMENTE il numero alterato (+7). OR aggiunto, niente tolto.
    const spiaTrovata = !!ver && k >= 0 && ver.discrepanze.some(d => d.comando === spia.comandi[0].comando || d.atteso === spia.comandi[0].numero)
    if (!spiaTrovata) log(`SCARTATO ${ind.codice}: spia non trovata`)
    return { voce: ind.codice, lettura: mis, verifica: ver, spia_trovata: spiaTrovata }
  })
const validi = esiti.filter(Boolean).filter(e => e.spia_trovata)
phase('Completezza')
const critica = await agent(`${REGOLE}critico.json.\n\nSei il critico di completezza della Fase 1 del mandato K. Hai gli esiti verificati qui sotto. Per ciascuna indagine di' che cosa manca perché il suo verdetto (SBLOCCA/RITIRA per le voci a valle elencate nel mandato) sia sostenuto da numeri: una domanda senza risposta, un insieme dichiarato senza il comando che lo prova, un file:riga assente. Non aggiungere lavoro che il mandato non chiede. fase_puo_chiudere è vero solo se manca è vuoto.\n\n${JSON.stringify(validi.map(v => ({ voce: v.voce, risposte: v.lettura.risposte, non_misurato: v.lettura.non_misurato, discrepanze: v.verifica.discrepanze })))}`, { label: 'critico di completezza', phase: 'Completezza', schema: CRITICA, model: 'opus', effort: 'high' })
log(`indagini valide ${validi.length}/${daFare.length}; la fase ${critica && critica.fase_puo_chiudere ? 'può' : 'NON può'} chiudere`)
return { ts: args.ts, cartella: args.cartella, esiti: esiti.filter(Boolean), critica }
