// enzo-guard — le regole di Enzo che il motore può far rispettare da solo.
// Ogni hook: (1) si spegne da /config (userConfig), (2) è avvolto in try/catch
// (un hook che lancia viene SALTATO = protezione zero), (3) in una corsa `-p`
// un `$.ui.ask` rifiuta → il gate NEGA: è il comportamento voluto in regime non
// presidiato («non si cancella niente, nemmeno con conferma data per altro»).
// Origine di ogni regola: README.md accanto. Tipi: .claude/types/claude-code.d.ts.
import type { Register, EngineInterface } from 'claude-code'

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const short = (s: string, n = 160) => (s.length > n ? s.slice(0, n) + '…' : s).replace(/\s+/g, ' ')

// $.ui.ask restituisce l'etichetta scelta; RIFIUTA se il dialogo è chiuso o non
// esiste (-p / SDK). Un dialogo chiuso vale «no».
async function confirm($: EngineInterface, q: string, yes: string, no: string, header: string) {
  try { return (await $.ui.ask(q, { options: [yes, no], header })) === yes } catch { return false }
}

// I segmenti di un comando shell: `a && b | c ; d` → [a, b, c, d]. Serve per
// riconoscere il PRIMO token di ogni segmento (rm, git, python) senza cadere
// dentro un argomento (`grep rm`, `echo "git push --force"` resta un rischio
// accettato: falso positivo raro, costo di un deny basso).
function segments(cmd: string): string[] {
  return cmd.split(/&&|\|\||;|\|(?!\|)|\$\(|\(|\n/).map(s => s.trim()).filter(Boolean)
}
const firstWord = (seg: string) => (seg.match(/^(?:sudo\s+|env\s+(?:[A-Z_]+=\S*\s+)*|MSYS_NO_PATHCONV=1\s+|[A-Z_]+=\S*\s+)*(\S+)/)?.[1] ?? '')

let sessionId = ''
let altreVive: { n: number; at: number } | null = null

// Quante ALTRE sessioni vive sullo stesso progetto (registro ~/.claude/sessioni/attive,
// pid verificato dal SO da hooks/sessioni_vive.py). Cache 60 s. Null = non misurabile.
async function altreSessioniVive($: EngineInterface): Promise<number | null> {
  const now = Date.now()
  if (altreVive && now - altreVive.at < 60_000) return altreVive.n
  try {
    const cwd = await $.session.cwd()
    const progetto = cwd.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? ''
    const r = await $.process.run(['python', `${$.plugin.root}/hooks/sessioni_vive.py`, progetto, sessionId.slice(0, 8)], { timeoutMs: 10_000 })
    const n = Number.parseInt(r.stdout.trim(), 10)
    if (r.exitCode !== 0 || Number.isNaN(n)) return null
    altreVive = { n, at: now }
    return n
  } catch { return null }
}

export const register: Register = (on, options) => {
  const opt = (k: string, dflt = true) => (typeof options[k] === 'boolean' ? (options[k] as boolean) : dflt)

  // ───────────────────────────────────────────────────────────── stato di sessione
  let isWindows = false
  let interactive = false
  let guardianoArgv: string[] | null = null
  let guardianoLine: string | undefined
  on('session.start', async ($, e, next) => {
    interactive = e.isInteractive
    try { sessionId = await $.session.id() } catch { sessionId = '' }
    altreVive = null
    // Ogni passo nel suo try: un fallimento su uno non deve spegnere gli altri.
    try { isWindows = (await $.env.get('OS')) === 'Windows_NT' } catch { isWindows = false }
    if (opt('guardianoBar')) {
      // Il guardiano del progetto, altrimenti la copia a livello utente.
      try {
        if (await $.fs.exists('docs/kb/tools/guardiano.py')) guardianoArgv = ['python', 'docs/kb/tools/guardiano.py']
        else {
          const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? ''
          if (home) guardianoArgv = ['python', `${home}/.claude/tools/guardiano.py`]
        }
      } catch (err) { $.ui.log(`enzo-guard session.start (guardiano): ${String(err)}`, { to: 'debug' }) }
    }
    return next(e)
  })

  // ───────────────────────────────────────────── 1. Python UTF-8 (C, rewrite)
  // 40 errori `charmap` in 60 gg, 128 prefissi scritti a mano. Regola globale:
  // «python3 = stub Store, usa python». `export` in testa vale per tutti i
  // segmenti del comando; su PowerShell `$env:`.
  const PY_CALL = /(^|[\s;&|(])python3?(\.exe)?(\s|$)/
  on('tool.call', { tool: ['Bash', 'PowerShell'] }, ($, e, next) => {
    if (!opt('pythonUtf8')) return next(e)
    try {
      let cmd = e.command
      if (!PY_CALL.test(cmd)) return next(e)
      if (isWindows) cmd = cmd.replace(/(^|[\s;&|(])python3(\.exe)?(?=\s|$)/g, '$1python')
      if (!/PYTHONUTF8|PYTHONIOENCODING/.test(cmd)) {
        cmd = e.tool === 'PowerShell' ? `$env:PYTHONUTF8='1'; ${cmd}` : `export PYTHONUTF8=1; ${cmd}`
      }
      if (cmd === e.command) return next(e)
      $.ui.log(`enzo-guard: python → UTF-8 (${short(cmd, 60)})`, { to: 'debug' })
      return next({ ...e, command: cmd })
    } catch (err) { $.ui.log(`enzo-guard pythonUtf8: ${String(err)}`, { to: 'debug' }); return next(e) }
  })

  // ─────────────────────────────────────────────── 2. Divieti git (A + B)
  // Globale §Divieti: mai push --force su main senza avviso, mai reset --hard
  // senza status, mai --amend su commit pushato / con due sessioni, mai
  // --no-verify. `git add -A` solo con un'altra sessione viva (vedi sotto).
  const GIT_DENY: Array<[RegExp, string]> = [
    [/\bgit\s+push\b(?![^|;&]*--force-with-lease)[^|;&]*(--force\b|\s-f\b)/, 'Regola 🔒 (Divieti git): niente `git push --force`. Se serve davvero, fermati e chiedi a Enzo; con più sessioni sullo stesso tree la storia non si riscrive. Alternativa: nuovo commit, o `--force-with-lease` SOLO dopo conferma esplicita.'],
    [/\bgit\s+commit\b[^|;&]*--no-verify\b/, 'Regola 🔒 (Divieti git): mai `--no-verify` per aggirare un hook che fallisce. Indaga la causa del fallimento e correggila.'],
    [/\bgit\s+reset\s+--hard\b/, 'Regola 🔒 (Divieti git): niente `git reset --hard` (mai senza `git status` verificato e conferma di Enzo; mai con due sessioni sullo stesso tree). Preferisci `git stash`, `git checkout <ref> -- <path>` o un nuovo commit.'],
  ]
  on('tool.call', { tool: ['Bash', 'PowerShell'] }, async ($, e, next) => {
    if (!opt('gitGuard')) return next(e)
    try {
      const cmd = e.command
      if (!/\bgit\s/.test(cmd)) return next(e)
      for (const [re, why] of GIT_DENY) if (re.test(cmd)) return { deny: why }
      // `git add -A/--all/.`: vietato SOLO con due sessioni sullo stesso working tree
      // (globale «I percorsi vanno sul commit, non sull'add»). Da soli passa: in
      // heuresys-datastore è la forma normale (166 volte in 60 gg, misurato).
      if (/\bgit\s+add\s+(-A\b|--all\b|\.(\s|$))/.test(cmd)) {
        const n = await altreSessioniVive($)
        if (n === null || n > 0) return { deny: `Regola 🔒: ${n === null ? 'non ho potuto misurare se ci sono altre sessioni vive, e' : `c'è ${n} altra sessione viva su questo progetto, e`} l'indice git è condiviso: \`git add -A/.\` metterebbe in stage anche il lavoro altrui (e i file di una sessione dream/lab). Elenca i file: \`git add <path> <path>\` e \`git commit -F <msg> -- <gli stessi path>\`.` }
      }
      if (/\bgit\s+commit\b[^|;&]*--amend\b/.test(cmd)) {
        const ok = await confirm($, `\`git commit --amend\` riscrive l'ultimo commit (vietato se già pushato o con due sessioni sul tree): ${short(cmd)} — autorizzi?`, 'Amend', 'Annulla', 'Git 🔒')
        if (!ok) return { deny: 'Amend non autorizzato (nessuna conferma, o corsa non presidiata): crea un NUOVO commit; un messaggio sbagliato si lascia com\'è.' }
      }
      if (/\bgit\s+(checkout|restore)\s+(--\s+)?\.(\s|$)/.test(cmd)) {
        const ok = await confirm($, `\`${short(cmd, 80)}\` butta via TUTTE le modifiche non committate del working tree. Autorizzi?`, 'Scarta tutto', 'Annulla', 'Git 🔒')
        if (!ok) return { deny: 'Scarto dell\'intero working tree non autorizzato (nessuna conferma, o corsa non presidiata). Ripristina i SOLI file che servono: `git checkout -- <path>`, o `git stash`.' }
      }
      return next(e)
    } catch (err) { $.ui.log(`enzo-guard gitGuard: ${String(err)}`, { to: 'debug' }); return next(e) }
  })

  // ───────────────────────────────────────────────── 3. Segreti (H, deny)
  // Globale §Divieti «Segreti»: di un .env si riporta la struttura, mai i valori.
  const SECRET_PATH = /(^|[\\/])(\.env(\.(?!example$|sample$|template$)[^\\/]+)?|\.secrets([\\/].*)?|[^\\/]+\.(pem|key|p12|pfx)|[^\\/]*credentials[^\\/]*\.json)$/i
  const SECRET_MSG = "File di segreti (regola 🔒): non si legge e non si scrive nel contesto. Servono solo i NOMI delle variabili: `grep -o '^[A-Z_][A-Z0-9_]*=' .env`. Per un valore, chiedi a Enzo di usarlo lui."
  on('tool.call', { tool: ['Read', 'Edit', 'Write'] }, ($, e, next) => {
    if (!opt('secretsGuard')) return next(e)
    try { return SECRET_PATH.test(str(e.file_path)) ? { deny: SECRET_MSG } : next(e) }
    catch { return next(e) }
  })
  const SECRET_READERS = /(^|[\s;&|(])(cat|less|more|head|tail|sed|awk|bat|type|Get-Content|gc|strings|base64|xxd|od)\b[^|;&]*(\.env(?![\w.]*(example|sample|template))\b|\.secrets[\\/]|\.(pem|key|p12|pfx)\b)/
  const SECRET_ADD = /\bgit\s+add\b[^|;&]*(\.env(?![\w.]*(example|sample|template))\b|\.secrets[\\/]?|\.(pem|key|p12|pfx)\b)/
  on('tool.call', { tool: ['Bash', 'PowerShell'] }, ($, e, next) => {
    if (!opt('secretsGuard')) return next(e)
    try {
      if (SECRET_READERS.test(e.command)) return { deny: SECRET_MSG }
      if (SECRET_ADD.test(e.command)) return { deny: 'Regola 🔒: `.env`, `.secrets/`, `*.pem`, `*.key` non entrano MAI in git. Togli quei percorsi dal `git add`; se uno è già tracciato, segnalalo a Enzo prima di qualunque push.' }
      return next(e)
    } catch { return next(e) }
  })

  // ────────────────────────── 4. Cancello segreti prima del commit (E-pre, deny)
  // Globale §Divieti: «prima di un commit, grep sullo staged diff per
  // password|secret|api.key|sk-|token|BEGIN PRIVATE KEY». Il pre-commit git del
  // repo non lo fa (misurato 2026-09-20). Forti = deny; deboli = solo log.
  const STRONG: Array<[RegExp, string]> = [
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'chiave privata'],
    [/\bsk-(ant-|proj-)?[A-Za-z0-9_-]{20,}/, 'API key sk-…'],
    [/\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, 'JWT'],
    [/\bgh[pousr]_[A-Za-z0-9]{30,}/, 'GitHub token'],
    [/\bxox[abpr]-[A-Za-z0-9-]{10,}/, 'Slack token'],
    [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key'],
    [/\bpostgres(ql)?:\/\/[^:\s]+:[^@\s]{4,}@/, 'connection string con password'],
  ]
  const WEAK = /\b(password|passwd|secret|api[_-]?key|token)\b\s*[:=]\s*['"][^'"\s]{8,}['"]/i
  function scanAdded(diff: string, hits: string[], file: string, weak: string[]) {
    for (const line of diff.split('\n')) {
      if (!line.startsWith('+') || line.startsWith('+++')) continue
      for (const [re, what] of STRONG) if (re.test(line)) hits.push(`${file}: ${what} → ${short(line, 60)}`)
      if (WEAK.test(line)) weak.push(`${file}: ${short(line, 80)}`)
    }
  }
  on('tool.call', { tool: ['Bash', 'PowerShell'] }, async ($, e, next) => {
    if (!opt('commitSecrets')) return next(e)
    const cmd = e.command
    if (!/\bgit\s+commit\b/.test(cmd)) return next(e)
    try {
      const hits: string[] = []; const weak: string[] = []
      // (a) l'indice com'è adesso
      const staged = await $.process.run(['git', 'diff', '--cached', '-U0', '--no-color'])
      if (staged.exitCode === 0) scanAdded(staged.stdout, hits, '(staged)', weak)
      // (b) i percorsi che il comando stesso aggiunge o committa (`git add x && git commit -F m -- x`):
      //     al momento dell'hook non sono ancora nell'indice.
      const paths = new Set<string>()
      for (const seg of segments(cmd)) {
        const m = seg.match(/^git\s+(add|commit)\b(.*)$/)
        if (!m) continue
        const tail = m[1] === 'commit' ? (seg.split(/\s--\s/)[1] ?? '') : (m[2] ?? '')
        for (const t of tail.split(/\s+/)) if (t && !t.startsWith('-') && !/^["']?\$/.test(t)) paths.add(t.replace(/^["']|["']$/g, ''))
      }
      for (const p of paths) {
        const d = await $.process.run(['git', 'diff', 'HEAD', '-U0', '--no-color', '--', p])
        if (d.exitCode === 0 && d.stdout) scanAdded(d.stdout, hits, p, weak)
        const u = await $.process.run(['git', 'ls-files', '--others', '--exclude-standard', '--', p])
        for (const f of u.stdout.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 50)) {
          try {
            const st = await $.fs.stat(f)
            if (st.kind !== 'file' || st.size > 2_000_000) continue
            scanAdded('+' + (await $.fs.read(f)).replace(/\n/g, '\n+'), hits, f, weak)
          } catch { /* binario o illeggibile: si salta */ }
        }
      }
      if (hits.length) return { deny: `Regola 🔒 (segreti in git): il commit porterebbe ${hits.length} segreto/i. Rimuovili, sposta il valore in .env/.secrets (gitignored) e ricommitta. Trovati:\n- ${hits.slice(0, 10).join('\n- ')}` }
      if (weak.length) $.ui.log(`enzo-guard: ${weak.length} assegnazione/i password|secret|token nel commit (non bloccate): ${weak.slice(0, 3).join(' · ')}`)
      return next(e)
    } catch (err) { $.ui.log(`enzo-guard commitSecrets non ha potuto misurare: ${String(err)}`, { to: 'debug' }); return next(e) }
  })

  // ─────────────────────────────────────────────── 5. Cancellazioni (B, ask)
  // Globale §Divieti: mai cancellare senza conferma; non presidiato = MAI, e una
  // richiesta di permesso non vista uccide la corsa. Qui il permesso lo chiede il
  // plugin: senza dialogo nega e propone la cartella nuova.
  const DELETE_CMDS = new Set(['rm', 'rmdir', 'del', 'erase', 'rd', 'ri', 'remove-item', 'unlink', 'shred', 'trash'])
  on('tool.call', { tool: ['Bash', 'PowerShell'] }, async ($, e, next) => {
    if (!opt('deleteGuard')) return next(e)
    try {
      const cmd = e.command
      const seg = segments(cmd).find(s => DELETE_CMDS.has(firstWord(s).toLowerCase()) || /^git\s+(clean\s+-[a-z]*f|rm\b)/.test(s) || /^find\b.*\s-delete\b/.test(s))
      if (!seg) return next(e)
      const ok = await confirm($, `Il comando cancella qualcosa: \`${short(seg, 120)}\`. Autorizzi la cancellazione?`, 'Cancella', 'Annulla', 'Cancella 🔒')
      if (ok) { $.ui.log(`enzo-guard: cancellazione autorizzata da Enzo — ${short(seg, 80)}`, { to: 'debug' }); return next(e) }
      return { deny: 'Cancellazione NON autorizzata (nessuna conferma di Enzo, oppure corsa non presidiata). Regola 🔒: non si cancella niente; se serve spazio pulito crea una cartella nuova con nome unico (timestamp) e vai avanti; scrivi nell\'esito che una cancellazione è rimasta da fare.' }
    } catch (err) { $.ui.log(`enzo-guard deleteGuard: ${String(err)}`, { to: 'debug' }); return next(e) }
  })

  // ──────────────────────────────── 6. Scritture sul DB vivo (B, ask; progetto)
  // Progetto: C4 (prova distruttiva su copia, mai sull'originale), «db:reset —
  // ask user», «migrazioni SI ESEGUONO SULLA VM» (17 s contro ~80 min misurati).
  const DB_WRITE = /\b(DELETE\s+FROM|TRUNCATE|DROP\s+(TABLE|SCHEMA|VIEW|DATABASE|INDEX)|UPDATE\s+\w+(\.\w+)?\s+SET|INSERT\s+INTO|ALTER\s+TABLE)\b/i
  on('tool.call', { tool: ['Bash', 'PowerShell'] }, async ($, e, next) => {
    if (!opt('dbGuard')) return next(e)
    try {
      const cmd = e.command
      let q: string | null = null; let hint = ''
      if (/\bpnpm\s+db:reset\b/.test(cmd)) { q = '`pnpm db:reset` è DISTRUTTIVO sul database (regola: chiedere prima). Procedo?'; hint = 'Regola: `pnpm db:reset` solo con conferma esplicita di Enzo.' }
      else if (/\bpnpm\s+db:migrate(:sh)?(\s|$)/.test(cmd) && isWindows) { q = '`pnpm db:migrate` da Windows attraversa il tunnel (~80 min misurati contro 17 s sulla VM). Vuoi davvero eseguirlo QUI?'; hint = 'Le migrazioni si applicano sulla VM: `pnpm db:migrate:vm` (prova prima sul gemello con `bash db/scripts/prova-idempotenza.sh`).' }
      else if (/\bpsql\b/.test(cmd) && /(-p\s*5433|:5433|heuresys_advanced)/.test(cmd) && (DB_WRITE.test(cmd) || /\s-f\s+\S+\.sql/.test(cmd))) { q = `psql sul database di PRODUZIONE (5433) con una scrittura: \`${short(cmd, 140)}\`. Autorizzi?`; hint = 'Regola C4: una prova che cancella/sovrascrive gira su una COPIA usa-e-getta (gemello, `ci-rehearsal.sh`), mai sull\'originale. Se è una migrazione, si applica dalla VM con `pnpm db:migrate:vm`.' }
      if (!q) return next(e)
      if (!(await $.fs.exists('db/scripts'))) return next(e)   // non è heuresys-advanced
      const ok = await confirm($, q, 'Esegui', 'Annulla', 'DB vivo 🔒')
      return ok ? next(e) : { deny: `Scrittura sul DB vivo NON autorizzata (nessuna conferma, o corsa non presidiata). ${hint}` }
    } catch (err) { $.ui.log(`enzo-guard dbGuard: ${String(err)}`, { to: 'debug' }); return next(e) }
  })

  // ──────────────────────────────── 7. Il guardiano in riga di stato (G + E)
  // 566 invocazioni a mano in 49 sessioni. Dopo ogni turno del loop principale:
  // `guardiano.py --json --sorveglia`; le due misure nella riga di stato; exit 3
  // → avviso, e (solo se scelto in /config) `/handoff` sottomesso da solo.
  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (!opt('guardianoBar') || !guardianoArgv || e.agentId || !interactive) return r
    try {
      const p = await $.process.run([...guardianoArgv, '--json', '--sorveglia'], { timeoutMs: 20_000 })
      const j = JSON.parse(p.stdout) as { contesto?: { ok?: boolean; percento?: number }; cinque_ore?: { ok?: boolean; percento?: number; errore?: string }; verdetto?: { chiudi?: boolean; motivi?: string[]; ridosso?: string[]; cieco?: boolean } }
      const ctx = j.contesto?.ok && typeof j.contesto.percento === 'number' ? `${j.contesto.percento.toFixed(1)}%` : 'NON MISURABILE'
      const h5 = j.cinque_ore?.ok && typeof j.cinque_ore.percento === 'number' ? `${j.cinque_ore.percento.toFixed(0)}%` : (typeof j.cinque_ore?.percento === 'number' ? `${j.cinque_ore.percento}% (stantio)` : 'NON MISURABILE')
      const v = j.verdetto ?? {}
      const flag = p.exitCode === 3 ? (v.ridosso?.length ? '⚠ A RIDOSSO' : '⛔ SOGLIA RAGGIUNTA') : (v.cieco ? '? cieco' : 'ok')
      guardianoLine = `guardiano · contesto ${ctx} (soglia 75%) · 5h ${h5} (soglia 80%) · ${flag}`
      $.ui.status(guardianoLine)
      if (p.exitCode === 3) {
        const msg = `${flag}: ${(v.motivi ?? v.ridosso ?? []).join('; ') || 'una delle due soglie'} — regola: interrompi, registra, committa E PUSHA, chiudi.`
        $.ui.toast(msg, { timeoutMs: 12_000 })
        $.ui.log(`enzo-guard guardiano: ${msg}`)
        if (opt('guardianoAutoClose', false)) void $.prompt.submit({ text: `/handoff\n\nIl guardiano ha misurato ${guardianoLine}: chiusura obbligata (regola di Enzo). Esegui la chiusura completa: registra il progresso, committa e pusha tutto, poi chiudi.` })
      }
    } catch (err) { $.ui.status('guardiano: NON MISURABILE'); $.ui.log(`enzo-guard guardiano: ${String(err)}`, { to: 'debug' }) }
    return r
  })

  // ──────────────────────────────────────── 8. Alias di sessione (D, context)
  // «avvia sessione» ×27 e «chiudi sessione» ×19 in 60 gg. Il testo NON si
  // riscrive: il command hook di progetto (session_mode.py) lo legge letterale
  // per il modo lab. Si aggiunge contesto: la skill da invocare è decisa qui, non
  // dalla memoria del modello (una skill omonima l'ha già mascherata: S1068).
  on('prompt.submit', ($, e, next) => {
    if (!opt('sessionAliases')) return next(e)
    try {
      if (e.origin.kind !== 'composer' && e.origin.kind !== 'bridge') return next(e)
      let note: string | null = null
      if (/^\s*avvia\s+sessione(\s+lab)?\s*[.!:]?\s*$/i.test(e.text)) note = `[enzo-guard] Alias riconosciuto: invoca la skill \`avvio\` con il tool Skill come PRIMA azione (args: ${/\blab\b/i.test(e.text) ? 'lab' : 'nessuno'}). Non improvvisare l'avvio a memoria.`
      else if (/^\s*chiudi\s+(la\s+)?sessione\s*[.!:]?\s*$/i.test(e.text)) note = '[enzo-guard] Alias riconosciuto: invoca la skill `handoff` con il tool Skill come PRIMA azione. Non improvvisare la chiusura a memoria.'
      if (!note) return next(e)
      return next({ ...e, context: [...(e.context ?? []), note] })
    } catch { return next(e) }
  })

  // ─────────────────────────── 9. Tool MCP di invio/cancellazione (B, ask)
  // Nessuna chiamata in 60 gg: beneficio = rischio evitato (invio esterno, dati).
  on('tool.call', { tool: /^mcp__(?!claude-in-chrome__|ccd_|Claude_Browser__|computer-use__|Windows-MCP__)[^_].*__(?:.*(?:send|forward|reply|trash|delete|remove|batch_delete|batch_modify|execute_sql|apply_migration|reset_branch|merge_branch|deploy|buy|purchase|write_action|create_event|update_event|respond_to_event|set_vacation|share_file|update_file|upload|pause_project|cancel_deployment|put_|patch_).*)$/i }, async ($, e, next) => {
    if (!opt('mcpGuard')) return next(e)
    try {
      const name = e.tool.replace(/^mcp__[0-9a-f-]{36}__/, 'mcp__<server>__')
      const ok = await confirm($, `Il tool ${name} invia, cancella o scrive FUORI dalla macchina. Autorizzi questa chiamata?`, 'Autorizza', 'Annulla', 'MCP 🔒')
      return ok ? next(e) : { deny: `Chiamata a ${name} NON autorizzata (nessuna conferma, o corsa non presidiata). Prepara una bozza / proposta e lascia l'invio o la cancellazione a Enzo.` }
    } catch (err) { $.ui.log(`enzo-guard mcpGuard: ${String(err)}`, { to: 'debug' }); return next(e) }
  })

  // ────────────────────────────── 10. File generati (H, deny per marcatore)
  // Il marcatore sta in testa al file (ATLAS.md, ADR_INDEX.md, …): si legge quello,
  // non un elenco che invecchia.
  const GENERATED = /\b(GENERAT[OAE]|non editare a mano|do not edit|auto-?generated)\b/i
  on('tool.call', { tool: ['Edit', 'Write'] }, async ($, e, next) => {
    if (!opt('generatedGuard')) return next(e)
    try {
      const fp = str(e.file_path)
      if (!fp || !(await $.fs.exists(fp))) return next(e)
      const st = await $.fs.stat(fp)
      if (st.kind !== 'file' || st.size > 5_000_000) return next(e)
      const head = (await $.fs.read(fp)).slice(0, 600)
      if (!GENERATED.test(head)) return next(e)
      const gen = head.match(/`([^`]*\.(py|sh|ps1|ts|js))`/)?.[1]
      return { deny: `File GENERATO (marcatore in testa): non si edita a mano. ${gen ? `Rigeneralo con \`${gen}\`` : 'Modifica la sorgente e lancia il generatore indicato nelle prime righe del file'}; se il generatore è sbagliato, correggi il generatore.` }
    } catch { return next(e) }
  })
}
