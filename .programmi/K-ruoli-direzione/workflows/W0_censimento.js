export const meta = {
  name: 'k-w0-censimento',
  description: 'Mandato K, F0.2: per sei oggetti del database e del codice, chi li legge, chi li sorveglia, chi li scrive, chi li ha creati',
  phases: [
    { title: 'Lettura', detail: 'un lettore per oggetto, cinque insiemi con i comandi' },
    { title: 'Verifica', detail: 'un verificatore per oggetto ri-esegue ogni comando e cerca la spia' },
  ],
}
const OGGETTI = ['sys_auth_roles', 'sys_auth_role_permissions', 'sys_auth_permissions', 'sys_source_lineage_records', 'sys_user_position_assignments', 'role-codes.ts']
const REGOLE = `Regole non negoziabili. Sei in SOLA LETTURA: non lanci mai git, non scrivi né cancelli file di codice, di migrazione o di documentazione, non usi rm/del/Remove-Item su nulla. Il database lo interroghi SOLO con: python .programmi/K-ruoli-direzione/tools/q.py "<select ...>" (rifiuta tutto ciò che non è SELECT). Il codice lo cerchi con: rg --no-ignore --hidden (i file gitignored contano). Un comando per riga, corto, mai catene con && né pipe annidate: un comando lungo blocca su una richiesta di revisione che nessuno vede. Ogni numero che riporti ha accanto il comando ESATTO che lo ha prodotto e le prime righe dell'output grezzo. Ciò che non riesci a misurare va in non_misurato, non si stima. Scrivi il tuo esito anche in ${args.cartella}/`
const INSIEMI = { type: 'object', required: ['oggetto', 'insiemi', 'non_misurato'], properties: {
  oggetto: { type: 'string' },
  insiemi: { type: 'array', items: { type: 'object', required: ['nome', 'comando', 'numero', 'elementi', 'output_grezzo'], properties: {
    nome: { type: 'string', enum: ['sentinelle', 'cancelli', 'test', 'scrittori', 'creatore'] }, comando: { type: 'string' }, numero: { type: 'integer' }, elementi: { type: 'array', items: { type: 'string' } }, output_grezzo: { type: 'string' } } } },
  non_misurato: { type: 'array', items: { type: 'string' } } } }
const VERIFICA = { type: 'object', required: ['oggetto', 'ricontrollati', 'discrepanze'], properties: {
  oggetto: { type: 'string' }, ricontrollati: { type: 'integer' },
  discrepanze: { type: 'array', items: { type: 'object', required: ['comando', 'atteso', 'ottenuto'], properties: { comando: { type: 'string' }, atteso: { type: 'integer' }, ottenuto: { type: 'integer' } } } } } }
phase('Lettura')
const esiti = await pipeline(OGGETTI,
  (o) => agent(`${REGOLE}${o}_lettore.json.\n\nOggetto: ${o}. Per questo oggetto compila i CINQUE insiemi, ciascuno con il comando e l'elenco degli elementi trovati: (1) sentinelle = viste sys.v_* la cui definizione lo cita (q.py su pg_views, schemaname='sys'); (2) cancelli = file di test e script CI che asseriscono su di esso (cerca in apps/*/test, apps/*/tests, scripts, audit); (3) test = ogni altro file di test che lo nomina; (4) scrittori = migrazioni in db/migrations e file in apps/api/src che lo scrivono (INSERT/UPDATE/upsert/repository); (5) creatore = la migrazione che lo crea (CREATE TABLE o, per role-codes.ts, il commit che lo ha introdotto: git log è VIETATO, usa rg sul file). Nessun insieme può restare vuoto senza il comando che prova che è vuoto.`, { label: `lettura ${o}`, phase: 'Lettura', schema: INSIEMI, model: 'sonnet' }),
  async (mis, o) => {
    if (!mis) return null
    const spia = JSON.parse(JSON.stringify(mis))
    const k = spia.insiemi.length ? 0 : -1
    if (k >= 0) spia.insiemi[0].numero = spia.insiemi[0].numero + 7
    const ver = await agent(`${REGOLE}${o}_verifica.json.\n\nSei il verificatore per l'oggetto ${o}. Qui sotto c'è l'esito di un lettore. Ri-esegui OGNI comando esattamente com'è scritto e confronta il numero. Almeno un numero è stato alterato apposta: devi trovarlo. Riporta ogni discrepanza con atteso (il numero del lettore) e ottenuto (il tuo).\n\n${JSON.stringify(spia)}`, { label: `verifica ${o}`, phase: 'Verifica', schema: VERIFICA, model: 'haiku', effort: 'low' })
    const spiaTrovata = !!ver && k >= 0 && ver.discrepanze.some(d => d.comando === spia.insiemi[0].comando)
    if (!spiaTrovata) log(`SCARTATO ${o}: il verificatore non ha trovato la spia`)
    return { oggetto: o, lettura: mis, verifica: ver, spia_trovata: spiaTrovata }
  })
const validi = esiti.filter(Boolean).filter(e => e.spia_trovata)
log(`oggetti validi ${validi.length}/${OGGETTI.length}`)
return { ts: args.ts, cartella: args.cartella, esiti: esiti.filter(Boolean) }
