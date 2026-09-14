export const meta = {
  name: 'k-w2-classificazione',
  description: 'Mandato K, I-E: ogni tabella sys.sys_* misurata (scrittori, righe, provenienza) e proposta in uno dei quattro stati, a lotti, con verifica dei numeri',
  phases: [
    { title: 'Lotto', detail: 'un lettore per lotto di tabelle' },
    { title: 'Verifica', detail: 'un verificatore per lotto ri-esegue i conteggi e cerca la spia' },
    { title: 'Riunione', detail: 'controllo in codice: nessuna tabella persa fra lotti' },
  ],
}
const REGOLE = `Regole non negoziabili. Sei in SOLA LETTURA: mai git, mai scritture o cancellazioni fuori da ${args.cartella}/, database solo con python .programmi/K-ruoli-direzione/tools/q.py "<select ...>", codice con rg --no-ignore --hidden, un comando per riga, corto. Ogni numero con il comando esatto e l'output grezzo. `
const RIGA = { type: 'object', required: ['tabella', 'scrittori_api', 'scrittori_import', 'colonna_origine', 'righe', 'righe_con_provenienza', 'stato_proposto', 'dubbia', 'motivo'], properties: {
  tabella: { type: 'string' }, scrittori_api: { type: 'array', items: { type: 'string' } }, scrittori_import: { type: 'array', items: { type: 'string' } }, colonna_origine: { type: 'string' }, righe: { type: 'integer' }, righe_con_provenienza: { type: 'integer' },
  stato_proposto: { type: 'string', enum: ['nativo', 'importato', 'ibrido', 'infrastruttura'] }, dubbia: { type: 'boolean' }, motivo: { type: 'string' } } }
const LOTTO = { type: 'object', required: ['righe', 'comandi'], properties: { righe: { type: 'array', items: RIGA }, comandi: { type: 'array', items: { type: 'object', required: ['tabella', 'comando', 'numero'], properties: { tabella: { type: 'string' }, comando: { type: 'string' }, numero: { type: 'integer' } } } } } }
const VERIFICA = { type: 'object', required: ['ricontrollati', 'discrepanze'], properties: { ricontrollati: { type: 'integer' }, discrepanze: { type: 'array', items: { type: 'object', required: ['comando', 'atteso', 'ottenuto'], properties: { comando: { type: 'string' }, atteso: { type: 'integer' }, ottenuto: { type: 'integer' } } } } } }
if (!Array.isArray(args.lotti) || !args.lotti.length) throw new Error('args.lotti mancante: passare un array di array di nomi di tabella')
phase('Lotto')
const esiti = await pipeline(args.lotti,
  (lotto, _, i) => agent(`${REGOLE}Scrivi il tuo esito anche in ${args.cartella}/lotto_${i}_lettore.json.\n\nPasso 22 del mandato K (file .programmi/mandati/K-mandato-v2.md, sezione 6, I-E: leggilo). Per OGNI tabella di questo lotto, senza saltarne nessuna, produci la riga con i cinque campi misurati e lo stato proposto; applica la regola meccanica per dubbia. Le quattro tabelle di D6 (contratti, buste paga, documenti d'identità, profili retributivi di posizione) sono importate per decisione e dubbia=true con motivo D6. In comandi metti, per ogni tabella, il count(*) con la query esatta.\n\nLotto: ${JSON.stringify(lotto)}`, { label: `lotto ${i}`, phase: 'Lotto', schema: LOTTO, model: 'sonnet' }),
  async (res, lotto, i) => {
    if (!res) return null
    const spia = JSON.parse(JSON.stringify(res))
    const k = spia.comandi.length ? 0 : -1
    if (k >= 0) spia.comandi[0].numero = spia.comandi[0].numero + 7
    const ver = await agent(`${REGOLE}Scrivi il tuo esito anche in ${args.cartella}/lotto_${i}_verifica.json.\n\nVerificatore del lotto ${i}: ri-esegui ogni comando dell'elenco e confronta il numero; almeno uno è stato alterato apposta e devi trovarlo.\n\n${JSON.stringify(spia.comandi)}`, { label: `verifica lotto ${i}`, phase: 'Verifica', schema: VERIFICA, model: 'haiku', effort: 'low' })
    const spiaTrovata = !!ver && k >= 0 && ver.discrepanze.some(d => d.comando === spia.comandi[0].comando)
    if (!spiaTrovata) log(`SCARTATO lotto ${i}: spia non trovata`)
    return { lotto: i, attese: lotto, righe: res.righe, verifica: ver, spia_trovata: spiaTrovata }
  })
phase('Riunione')
const validi = esiti.filter(Boolean).filter(e => e.spia_trovata)
const viste = new Set(validi.flatMap(e => e.righe.map(r => r.tabella)))
const perse = args.lotti.flat().filter(t => !viste.has(t))
if (perse.length) log(`TABELLE PERSE (${perse.length}): ${perse.join(', ')}`)
return { ts: args.ts, cartella: args.cartella, lotti_validi: validi.length, lotti_totali: args.lotti.length, perse, righe: validi.flatMap(e => e.righe), dubbie: validi.flatMap(e => e.righe).filter(r => r.dubbia).map(r => r.tabella) }
