export const meta = {
  name: 'k-w5-presenze',
  description: 'Mandato K, X-6: tre ipotesi sulle presenze senza provenienza, ciascuna misurata da un lettore e ricontrollata da un verificatore, sommate da un sommatore la cui unione viene ri-eseguita',
  phases: [
    { title: 'Misura', detail: 'un lettore per ipotesi: la query che conta le presenze che spiega' },
    { title: 'Verifica', detail: 'un verificatore per ipotesi ri-esegue ogni comando e deve trovare la spia' },
    { title: 'Somma', detail: 'un sommatore scrive la query di unione; un verificatore la ri-esegue' },
  ],
}
const REGOLE = `Regole non negoziabili. Sei in SOLA LETTURA: non lanci mai git, non scrivi né cancelli file di codice, di migrazione o di documentazione, non usi rm/del/Remove-Item su nulla. Il database lo interroghi SOLO con: python .programmi/K-ruoli-direzione/tools/q.py "<select ...>". Il codice lo cerchi con: rg --no-ignore --hidden. Un comando per riga, corto, mai catene con && né pipe annidate. Ogni numero ha accanto il comando ESATTO che lo ha prodotto e le prime righe dell'output grezzo. Ciò che non riesci a misurare va in non_misurato, non si stima. Le istruzioni complete della tua voce sono nel file .programmi/mandati/K-mandato-v2.md, sezione 6: leggila prima. Scrivi il tuo esito anche in ${args.cartella}/`
const INDAGINI = [
  { codice: 'X6-ipotesi-1', modello: 'sonnet', prompt: 'Passo 66 del mandato, ipotesi 1: le presenze di sys.sys_attendance SENZA provenienza per identificativo (nessuna riga di sys.sys_source_lineage_records con source_lineage_target_record_id = attendance_id) sono state importate da una corsa che ha scritto il registro per NOME e non per identificativo. Conta per attendance_source_reference e per corsa di importazione quante di quelle righe questa ipotesi spiega; scrivi la query esatta che le conta, ricontrollabile.' },
  { codice: 'X6-ipotesi-2', modello: 'sonnet', prompt: 'Passo 66 del mandato, ipotesi 2: le presenze senza provenienza sono state seminate dalla materializzazione del tenant senza scrivere il registro. Cerca con rg --no-ignore --hidden chi scrive sys_attendance in apps/api/src e db/ (materializzazione, seed), e conta con q.py quante righe senza provenienza portano l\'impronta di quello scrittore (metadata, riferimento, intervallo di date, tenant). Scrivi la query esatta.' },
  { codice: 'X6-ipotesi-3', modello: 'sonnet', prompt: 'Passo 66 del mandato, ipotesi 3: le corse che hanno prodotto quelle presenze sono state sostituite (superseded_by_run_id in sys.sys_generated_record_origins o nelle corse di importazione) e il registro e\' rimasto sul run vecchio. Conta con q.py quante presenze senza provenienza per identificativo hanno un riferimento a una corsa sostituita. Scrivi la query esatta.' },
]
const MISURA = { type: 'object', required: ['voce', 'comandi', 'risposte', 'non_misurato'], properties: {
  voce: { type: 'string' },
  comandi: { type: 'array', items: { type: 'object', required: ['comando', 'numero', 'output_grezzo'], properties: { comando: { type: 'string' }, numero: { type: 'number' }, output_grezzo: { type: 'string' } } } },
  risposte: { type: 'array', items: { type: 'object', required: ['domanda', 'risposta', 'file_riga'], properties: { domanda: { type: 'string' }, risposta: { type: 'string' }, file_riga: { type: 'array', items: { type: 'string' } } } } },
  non_misurato: { type: 'array', items: { type: 'string' } } } }
const VERIFICA = { type: 'object', required: ['voce', 'ricontrollati', 'discrepanze'], properties: {
  voce: { type: 'string' }, ricontrollati: { type: 'integer' },
  discrepanze: { type: 'array', items: { type: 'object', required: ['comando', 'atteso', 'ottenuto'], properties: { comando: { type: 'string' }, atteso: { type: 'number' }, ottenuto: { type: 'number' } } } } } }
const SOMMA = { type: 'object', required: ['totale_senza_provenienza', 'comando_totale', 'per_ipotesi', 'comando_unione', 'righe_unione', 'non_spiegate'], properties: { totale_senza_provenienza: { type: 'integer' }, comando_totale: { type: 'string' }, per_ipotesi: { type: 'array', items: { type: 'object', required: ['ipotesi', 'righe', 'comando'], properties: { ipotesi: { type: 'string' }, righe: { type: 'integer' }, comando: { type: 'string' } } } }, comando_unione: { type: 'string' }, righe_unione: { type: 'integer' }, non_spiegate: { type: 'integer' } } }
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
    const spiaTrovata = !!ver && k >= 0 && ver.discrepanze.some(d => d.comando === spia.comandi[0].comando)
    if (!spiaTrovata) log(`SCARTATO ${ind.codice}: spia non trovata`)
    return { voce: ind.codice, lettura: mis, verifica: ver, spia_trovata: spiaTrovata }
  })
const validi = esiti.filter(Boolean).filter(e => e.spia_trovata)
phase('Somma')
const somma = await agent(`${REGOLE}sommatore.json.

Sei il sommatore di X-6. Hai le tre ipotesi verificate qui sotto, ciascuna con la query che conta le presenze che spiega. Scrivi UNA query di unione (le sovrapposizioni contate una volta sola: union, non somma) che conta quante presenze senza provenienza per identificativo sono spiegate da almeno una ipotesi, eseguila con q.py, e riporta: il totale senza provenienza (con la query), le righe per ipotesi, le righe dell'unione, e le non spiegate = totale - unione. NON proporre di retro-compilare la provenienza.

${JSON.stringify(validi.map(v => ({ voce: v.voce, comandi: v.lettura.comandi, risposte: v.lettura.risposte })))}`, { label: 'sommatore', phase: 'Somma', schema: SOMMA, model: 'sonnet', effort: 'medium' })
let verificaSomma = null
if (somma) {
  const spia = JSON.parse(JSON.stringify(somma))
  spia.righe_unione = spia.righe_unione + 7
  verificaSomma = await agent(`${REGOLE}sommatore_verifica.json.

Sei il verificatore del sommatore. Ri-esegui con q.py comando_totale, ogni comando in per_ipotesi e comando_unione, e confronta i numeri: almeno uno e' stato alterato apposta e devi trovarlo. Riporta ogni discrepanza con atteso e ottenuto.

${JSON.stringify(spia)}`, { label: 'verifica sommatore', phase: 'Somma', schema: VERIFICA, model: 'haiku', effort: 'low' })
}
const sommaSpiaTrovata = !!verificaSomma && verificaSomma.discrepanze.some(d => d.comando === (somma && somma.comando_unione))
if (!sommaSpiaTrovata) log('SCARTATO sommatore: spia non trovata')
log(`ipotesi valide ${validi.length}/${daFare.length}; somma ${sommaSpiaTrovata ? 'verificata' : 'DA RIFARE'}`)
return { ts: args.ts, cartella: args.cartella, esiti: esiti.filter(Boolean), somma, verifica_somma: verificaSomma, somma_spia_trovata: sommaSpiaTrovata }
