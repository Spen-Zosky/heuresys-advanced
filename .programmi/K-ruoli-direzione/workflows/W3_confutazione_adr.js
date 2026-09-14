export const meta = {
  name: 'k-w3-confutazione-adr',
  description: 'Mandato K, Fase 3: tre confutatori per ADR provano a smentire ogni affermazione misurabile, in sola lettura',
  phases: [{ title: 'Confuta', detail: 'tre lenti per ADR: database, codice, decisioni' }],
}
const REGOLE = `Regole non negoziabili. Sei in SOLA LETTURA: mai git, mai scritture fuori da ${args.cartella}/, database solo con python .programmi/K-ruoli-direzione/tools/q.py "<select ...>", codice con rg --no-ignore --hidden, un comando per riga, corto. `
const LENTI = [
  { nome: 'database', prompt: 'Per OGNI numero e OGNI affermazione su un insieme (tutti, solo, nessuno, N righe) scritti nell\'ADR, ri-misura sul database con q.py e riporta il comando. Un numero che non riesci a ri-misurare è una confutazione, non un dubbio.' },
  { nome: 'codice', prompt: 'Per OGNI affermazione dell\'ADR su che cosa fa il codice (chi scrive una tabella, quale rotta esiste, quale colonna c\'è) trova il file:riga con rg. Un\'affermazione senza file:riga è una confutazione.' },
  { nome: 'decisioni', prompt: 'Confronta l\'ADR con la sezione 2 del file .programmi/mandati/K-mandato-v2.md: ogni punto in cui l\'ADR contraddice, allarga o traduce una decisione di Enzo (nomi degli stati, tabelle di D6, numero I23, ruoli di piattaforma) è una confutazione.' },
]
const VERDETTO = { type: 'object', required: ['adr', 'lente', 'confutazioni'], properties: { adr: { type: 'string' }, lente: { type: 'string' }, confutazioni: { type: 'array', items: { type: 'object', required: ['affermazione', 'prova_contraria', 'comando'], properties: { affermazione: { type: 'string' }, prova_contraria: { type: 'string' }, comando: { type: 'string' } } } } } }
if (!Array.isArray(args.adr) || !args.adr.length) throw new Error('args.adr mancante: array di percorsi degli ADR da confutare')
phase('Confuta')
const coppie = args.adr.flatMap(a => LENTI.map(l => ({ adr: a, lente: l })))
const verdetti = await parallel(coppie.map(c => () => agent(`${REGOLE}Scrivi il tuo esito anche in ${args.cartella}/${c.lente.nome}_${c.adr.split('/').pop()}.json.\n\nSei un confutatore. Leggi l'ADR in ${c.adr}. Il tuo compito è SMENTIRLO, non approvarlo: in caso di dubbio la confutazione si scrive. Lente: ${c.lente.nome}. ${c.lente.prompt}`, { label: `${c.lente.nome} su ${c.adr.split('/').pop()}`, phase: 'Confuta', schema: VERDETTO, model: 'sonnet', effort: 'high' })))
const tutte = verdetti.filter(Boolean)
const sopravvissute = tutte.flatMap(v => v.confutazioni.map(c => ({ adr: v.adr, lente: v.lente, ...c })))
log(`${sopravvissute.length} confutazioni da esaminare in linea; ${coppie.length - tutte.length} confutatori non hanno risposto`)
return { ts: args.ts, cartella: args.cartella, confutazioni: sopravvissute, mancanti: coppie.length - tutte.length }
