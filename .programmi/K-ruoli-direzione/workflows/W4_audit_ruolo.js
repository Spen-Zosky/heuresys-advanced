export const meta = {
  name: 'k-w4-audit-ruolo',
  description: 'Mandato K, Fase 4: dopo ogni migrazione di ruolo, tre confutatori in sola lettura provano a smentire diff, ricetta e perimetro',
  phases: [{ title: 'Audit', detail: 'tre lenti per ruolo: diff e G-D2, ricetta, perimetro' }],
}
const REGOLE = `Regole non negoziabili. Sei in SOLA LETTURA: mai git, mai scritture fuori da ${args.cartella}/, database solo con python .programmi/K-ruoli-direzione/tools/q.py "<select ...>", codice con rg --no-ignore --hidden, un comando per riga, corto. Default: in caso di dubbio la confutazione si scrive. `
const LENTI = [
  { nome: 'diff', modello: 'haiku', effort: 'low', prompt: (r) => `Ruolo ${r}. (1) Leggi .programmi/K-ruoli-direzione/esiti/${r}_permessi_dichiarati.txt se esiste (per R-0 leggi R-0_porte.md). (2) Con q.py estrai i permission_code attivi (revoked_at is null) del ruolo da sys.sys_auth_role_permissions. (3) Confronta insieme per insieme: ogni differenza è una confutazione. (4) q.py su sys.v_permessi_ritirati_a_ruoli_preesistenti: ogni riga è una confutazione. (5) q.py: count(*) dei permessi attivi di HRMS_MANAGER; se diverso da ${args.hrms_atteso} è una confutazione.` },
  { nome: 'ricetta', modello: 'sonnet', effort: 'medium', prompt: (r) => `Ruolo ${r}. Leggi la ricetta in .programmi/K-ruoli-direzione/esiti/I-F.md. Per OGNI file della ricetta esegui rg -c "${r}" <file>: un file con 0 occorrenze è una confutazione. Verifica che db/migrations/${args.migrazione}_*.sql esista, termini con "-- FINE ${args.migrazione}", contenga BEGIN e COMMIT una sola volta ciascuno e nessuna DELETE: ogni mancanza è una confutazione.` },
  { nome: 'perimetro', modello: 'sonnet', effort: 'medium', prompt: (r) => `Ruolo ${r}. Dal registro delle rotte (stesso meccanismo del test di deriva: leggi apps/api/test/unit/role-lists-drift.unit.test.ts per trovarlo) elenca i moduli e per ciascuno una rotta di lettura e una di scrittura con il permesso richiesto. Con q.py elenca i permessi attivi del ruolo. Ogni modulo che il mandato NON assegna al ruolo (sezione 9 di .programmi/mandati/K-mandato-v2.md) ma in cui il ruolo ha il permesso di almeno una rotta è una confutazione.` },
]
const VERDETTO = { type: 'object', required: ['ruolo', 'lente', 'confutazioni'], properties: { ruolo: { type: 'string' }, lente: { type: 'string' }, confutazioni: { type: 'array', items: { type: 'object', required: ['affermazione', 'prova_contraria', 'comando'], properties: { affermazione: { type: 'string' }, prova_contraria: { type: 'string' }, comando: { type: 'string' } } } } } }
if (!Array.isArray(args.ruoli) || !args.ruoli.length) throw new Error('args.ruoli mancante')
if (!args.migrazione || typeof args.hrms_atteso !== 'number') throw new Error('args.migrazione e args.hrms_atteso obbligatori')
phase('Audit')
const coppie = args.ruoli.flatMap(r => LENTI.map(l => ({ r, l })))
const verdetti = await parallel(coppie.map(c => () => agent(`${REGOLE}Scrivi il tuo esito anche in ${args.cartella}/${c.l.nome}_${c.r}.json.\n\n${c.l.prompt(c.r)}`, { label: `${c.l.nome} ${c.r}`, phase: 'Audit', schema: VERDETTO, model: c.l.modello, effort: c.l.effort })))
const tutte = verdetti.filter(Boolean)
const sopravvissute = tutte.flatMap(v => v.confutazioni.map(c => ({ ruolo: v.ruolo, lente: v.lente, ...c })))
log(`${sopravvissute.length} confutazioni; ${coppie.length - tutte.length} lenti senza risposta`)
return { ts: args.ts, cartella: args.cartella, confutazioni: sopravvissute, mancanti: coppie.length - tutte.length }
