// prova_spia.mjs — prova che il controllo `spiaTrovata` corretto (W1/W2/W5) accetta i due casi reali
// di W0 che il controllo sulla sola stringa scartava, e che continua a RIFIUTARE un verificatore che
// non ha trovato la spia (controprova: la prova deve saper fallire).
//
//   node .programmi/K-ruoli-direzione/tools/prova_spia.mjs
//
// I casi vengono da evidenze/wf_F0.2_7_202609142251/_risultato.json (estratti in evidenze/spia_casi_w0.json).
// Il predicato qui sotto e' copiato TESTUALMENTE dalla riga degli script; se la riga cambia, cambia qui.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const qui = dirname(fileURLToPath(import.meta.url))
const casi = JSON.parse(readFileSync(join(qui, '..', 'evidenze', 'spia_casi_w0.json'), 'utf8'))

// Testo degli script: la spia altera comandi[0].numero di +7 PRIMA di passarlo al verificatore.
const vecchio = (spia, ver) => !!ver && ver.discrepanze.some(d => d.comando === spia.comandi[0].comando)
const nuovo = (spia, ver) => !!ver && ver.discrepanze.some(d => d.comando === spia.comandi[0].comando || d.atteso === spia.comandi[0].numero)

// La riga viva negli script deve contenere esattamente il predicato nuovo (altrimenti questa prova prova un'altra cosa).
const attesa = "d.comando === spia.comandi[0].comando || d.atteso === spia.comandi[0].numero"
for (const w of ['W1_indagini', 'W2_classificazione', 'W5_presenze']) {
  const src = readFileSync(join(qui, '..', 'workflows', `${w}.js`), 'utf8')
  if (!src.includes(attesa)) { console.log(`ROSSO: ${w}.js non contiene il predicato corretto`); process.exitCode = 1 }
}

let rosso = false
for (const c of casi) {
  const spia = JSON.parse(JSON.stringify({ comandi: c.comandi }))
  spia.comandi[0].numero = spia.comandi[0].numero + 7
  const ver = { discrepanze: c.discrepanze }
  const v = vecchio(spia, ver), n = nuovo(spia, ver)
  console.log(`${c.oggetto.padEnd(22)} lettore=${c.comandi[0].numero} alterato=${spia.comandi[0].numero}  vecchio=${v ? 'ACCETTATO' : 'SCARTATO'}  nuovo=${n ? 'ACCETTATO' : 'SCARTATO'}`)
  if (v || !n) rosso = true   // atteso: il vecchio scartava, il nuovo accetta
  // controprova: un verificatore che riporta come atteso il numero VERO (non alterato) e un comando riscritto NON passa
  const cieco = { discrepanze: c.discrepanze.map(d => ({ ...d, atteso: c.comandi[0].numero })) }
  const nc = nuovo(spia, cieco)
  console.log(`${''.padEnd(22)} controprova (atteso = numero vero, comando riscritto): nuovo=${nc ? 'ACCETTATO' : 'SCARTATO'}`)
  if (nc) rosso = true
}
console.log(rosso ? 'ESITO: ROSSO' : 'ESITO: VERDE — i due casi di W0 ora passano; un verificatore cieco resta scartato')
if (rosso) process.exitCode = 1
