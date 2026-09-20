// Prove che possono fallire, per ogni hook di enzo-guard. Si eseguono con
// `claude plugin test plugins/enzo-guard`: il motore carica il plugin come in
// sessione, e gli hook registrati qui con `on` stanno SOTTO il plugin — sono il
// mondo (fs, process, env, ui) che il plugin crede di vedere.
import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

const bash = (command: string) => ({ tool: 'Bash' as const, command })
const denyOf = (r: unknown) => (r as { deny?: string }).deny
// Il mondo minimo sotto il plugin: session.start risponde con la cwd, ui.log si inghiotte.
const world = (on: On) => {
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('ui.log', () => ({ value: undefined }))
}

// ──────────────────────────────────────── 1. Python UTF-8
test('python: su Windows python3 → python e PYTHONUTF8=1 in testa', async ($, on) => {
  world(on)
  mock.env(on, { OS: 'Windows_NT' })
  let seen = ''
  on('fs.exists', () => ({ value: false }))
  on('tool.call', { tool: 'Bash' }, (_$, e) => { seen = e.command; return { result: 'ok' } })
  await $.session.start({ cwd: 'D:/x', surface: 'terminal', isInteractive: false })
  await $.tool.call(bash('python3 -c "print(1)"'))
  expect(seen).toBe('export PYTHONUTF8=1; python -c "print(1)"')
})
test('python: fuori da Windows python3 resta, il prefisso si aggiunge', async ($, on) => {
  world(on)
  mock.env(on, { OS: 'Linux' })
  let seen = ''
  on('fs.exists', () => ({ value: false }))
  on('tool.call', { tool: 'Bash' }, (_$, e) => { seen = e.command; return { result: 'ok' } })
  await $.session.start({ cwd: '/x', surface: 'terminal', isInteractive: false })
  await $.tool.call(bash('cd a && python3 t.py'))
  expect(seen).toBe('export PYTHONUTF8=1; cd a && python3 t.py')
})
test('python: un comando senza python non si tocca; uno già con PYTHONUTF8 nemmeno', async ($, on) => {
  const seen: string[] = []
  on('tool.call', { tool: 'Bash' }, (_$, e) => { seen.push(e.command); return { result: 'ok' } })
  await $.tool.call(bash('ls -la'))
  await $.tool.call(bash('PYTHONUTF8=1 python x.py'))
  expect(seen).toEqual(['ls -la', 'PYTHONUTF8=1 python x.py'])
})

// ──────────────────────────────────────── 2. Divieti git
test('git: push --force, --no-verify, reset --hard, add -A negati; --force-with-lease e add con path passano', async ($, on) => {
  let ran = 0
  on('tool.call', { tool: 'Bash' }, () => { ran++; return { result: 'ok' } })
  for (const c of ['git push --force origin main', 'git push origin main -f', 'git commit -m x --no-verify', 'git reset --hard HEAD~1', 'git add -A', 'git add .', 'git add --all'])
    expect(denyOf(await $.tool.call(bash(c)))).toMatch(/Regola/)
  expect(ran).toBe(0)
  for (const c of ['git push --force-with-lease origin feat', 'git add src/a.ts docs/b.md', 'git status'])
    expect(denyOf(await $.tool.call(bash(c)))).toBeUndefined()
  expect(ran).toBe(3)
})
test('git: --amend, checkout . e restore . senza dialogo (corsa -p) sono negati; checkout -- <path> passa', async ($, on) => {
  on('tool.call', { tool: 'Bash' }, () => ({ result: 'ok' }))
  expect(denyOf(await $.tool.call(bash('git commit --amend --no-edit')))).toMatch(/Amend non autorizzato/)
  expect(denyOf(await $.tool.call(bash('git checkout .')))).toMatch(/working tree non autorizzato/)
  expect(denyOf(await $.tool.call(bash('git restore -- .')))).toMatch(/working tree non autorizzato/)
  expect(denyOf(await $.tool.call(bash('git checkout -- apps/web/src/a.ts')))).toBeUndefined()
})

// ──────────────────────────────────────── 3. Segreti
test('segreti: Read/Edit/Write e cat su .env, .secrets, .pem negati; .env.example passa', async ($, on) => {
  on('tool.call', () => ({ result: 'ok' }))
  for (const p of ['.env', 'apps/api/.env.local', '.secrets/db.json', 'keys/server.pem', 'C:\\x\\.secrets\\a', 'gcp-credentials.json'])
    expect(denyOf(await $.tool.call({ tool: 'Read', file_path: p }))).toMatch(/segreti/)
  expect(denyOf(await $.tool.call({ tool: 'Read', file_path: '.env.example' }))).toBeUndefined()
  expect(denyOf(await $.tool.call({ tool: 'Write', file_path: 'a/.env', content: 'x' }))).toMatch(/segreti/)
  expect(denyOf(await $.tool.call(bash('cat .env')))).toMatch(/segreti/)
  expect(denyOf(await $.tool.call(bash('head -3 apps/api/.env | sort')))).toMatch(/segreti/)
  expect(denyOf(await $.tool.call(bash('cat .env.example')))).toBeUndefined()
  expect(denyOf(await $.tool.call(bash("grep -o '^[A-Z_]*=' .env")))).toBeUndefined()
  expect(denyOf(await $.tool.call(bash('git add .env src/a.ts')))).toMatch(/non entrano MAI in git/)
})

// ──────────────────────────────────────── 4. Segreti nel commit
test('commit: una chiave privata nello staged diff nega; un diff pulito passa', async ($, on) => {
  let diff = '+++ b/a.txt\n+hello\n+-----BEGIN RSA PRIVATE KEY-----\n'
  on('process.run', (_$, e) => {
    if (e.argv[1] === 'diff') return { value: { exitCode: 0, stdout: diff, stderr: '' } }
    return { value: { exitCode: 0, stdout: '', stderr: '' } }
  })
  on('tool.call', { tool: 'Bash' }, () => ({ result: 'ok' }))
  expect(denyOf(await $.tool.call(bash('git commit -m "x"')))).toMatch(/chiave privata/)
  diff = '+++ b/a.txt\n+const x = 1\n'
  expect(denyOf(await $.tool.call(bash('git commit -m "x"')))).toBeUndefined()
})
test('commit: un file aggiunto nello stesso comando (non ancora in indice) viene letto', async ($, on) => {
  on('process.run', (_$, e) => {
    if (e.argv[1] === 'ls-files') return { value: { exitCode: 0, stdout: 'plugins/probe.txt\n', stderr: '' } }
    return { value: { exitCode: 0, stdout: '', stderr: '' } }
  })
  on('fs.stat', () => ({ value: { kind: 'file' as const, size: 40, mtimeMs: 0, isLink: false } }))
  on('fs.read', () => ({ value: 'token = "sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123"' }))
  on('tool.call', { tool: 'Bash' }, () => ({ result: 'ok' }))
  expect(denyOf(await $.tool.call(bash('git add plugins/probe.txt && git commit -F m.txt -- plugins/probe.txt')))).toMatch(/API key sk-/)
})

// ──────────────────────────────────────── 5. Cancellazioni
test('cancellazioni: rm / Remove-Item / git clean / find -delete negati senza dialogo; un rm dentro un argomento passa', async ($, on) => {
  on('tool.call', () => ({ result: 'ok' }))
  for (const c of ['rm -rf tmp/x', 'cd a && rm b', 'Remove-Item -Recurse x', 'git clean -fd', 'find . -name "*.log" -delete', 'rmdir x'])
    expect(denyOf(await $.tool.call(bash(c)))).toMatch(/Cancellazione NON autorizzata/)
  expect(denyOf(await $.tool.call({ tool: 'PowerShell', command: 'Remove-Item a.txt' }))).toMatch(/Cancellazione NON autorizzata/)
  expect(denyOf(await $.tool.call(bash('grep -rn "rm -rf" docs/')))).toBeUndefined()
  expect(denyOf(await $.tool.call(bash('npm rm lodash')))).toBeUndefined()
})

// ──────────────────────────────────────── 6. DB vivo
test('db: psql 5433 con DELETE, db:reset e db:migrate da Windows negati senza dialogo (solo nel progetto); una SELECT passa', async ($, on) => {
  world(on)
  mock.env(on, { OS: 'Windows_NT' })
  on('fs.exists', (_$, e) => ({ value: e.path.replace(/\\/g, '/').endsWith('db/scripts') }))
  on('tool.call', () => ({ result: 'ok' }))
  await $.session.start({ cwd: 'D:/heuresys-advanced', surface: 'terminal', isInteractive: false })
  expect(denyOf(await $.tool.call(bash('psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "DELETE FROM sys.sys_x"')))).toMatch(/DB vivo NON autorizzata/)
  expect(denyOf(await $.tool.call(bash('psql -h localhost -p 5433 -d heuresys_advanced -f db/migrations/000300.sql')))).toMatch(/DB vivo/)
  expect(denyOf(await $.tool.call(bash('pnpm db:reset')))).toMatch(/db:reset/)
  expect(denyOf(await $.tool.call(bash('pnpm db:migrate')))).toMatch(/db:migrate:vm/)
  expect(denyOf(await $.tool.call(bash('pnpm db:migrate:vm')))).toBeUndefined()
  expect(denyOf(await $.tool.call(bash('psql -h localhost -p 5433 -d heuresys_advanced -c "SELECT count(*) FROM sys.sys_users"')))).toBeUndefined()
})
test('db: fuori dal progetto (niente db/scripts) non scatta', async ($, on) => {
  on('fs.exists', () => ({ value: false }))
  on('tool.call', () => ({ result: 'ok' }))
  expect(denyOf(await $.tool.call(bash('pnpm db:reset')))).toBeUndefined()
})

// ──────────────────────────────────────── 7. Guardiano
test('guardiano: dopo un turno interattivo la riga di stato porta le due misure; exit 3 → toast, nessun /handoff (auto-close spento)', async ($, on) => {
  world(on)
  mock.env(on, { OS: 'Windows_NT' })
  on('fs.exists', (_$, e) => ({ value: e.path.replace(/\\/g, '/').endsWith('docs/kb/tools/guardiano.py') }))
  const json = { contesto: { ok: true, percento: 76.2 }, cinque_ore: { ok: false, percento: 69, errore: 'stantio' }, verdetto: { chiudi: true, motivi: ['contesto 76.2% >= 75%'], ridosso: [], cieco: false } }
  let argv: readonly string[] = []
  on('process.run', (_$, e) => { argv = e.argv; return { value: { exitCode: 3, stdout: JSON.stringify(json), stderr: '' } } })
  let status: string | undefined; const toasts: string[] = []; let submitted = 0
  on('ui.status', (_$, e) => { status = e.text; return { value: undefined } })
  on('ui.toast', (_$, e) => { toasts.push(e.text); return { value: undefined } })
  on('prompt.submit', () => { submitted++; return { text: '' } })
  on('turn.complete', () => ({ text: '' }))
  await $.session.start({ cwd: 'D:/heuresys-advanced', surface: 'terminal', isInteractive: true })
  await $.turn.complete({ answer: 'x', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer' })
  expect(argv).toEqual(['python', 'docs/kb/tools/guardiano.py', '--json', '--sorveglia'])
  expect(status).toMatch(/contesto 76\.2% .* 5h 69% \(stantio\).*SOGLIA RAGGIUNTA/)
  expect(toasts[0]).toMatch(/committa E PUSHA/)
  expect(submitted).toBe(0)
})
test('guardiano: in una corsa -p non gira; se il processo fallisce dichiara NON MISURABILE', async ($, on) => {
  world(on)
  on('fs.exists', () => ({ value: true }))
  let runs = 0
  on('process.run', () => { runs++; throw new Error('boom') })
  let status: string | undefined
  on('ui.status', (_$, e) => { status = e.text; return { value: undefined } })
  on('turn.complete', () => ({ text: '' }))
  await $.session.start({ cwd: 'D:/heuresys-advanced', surface: null, isInteractive: false })
  await $.turn.complete({ answer: 'x', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer' })
  expect(runs).toBe(0)
  await $.session.start({ cwd: 'D:/heuresys-advanced', surface: 'terminal', isInteractive: true })
  await $.turn.complete({ answer: 'x', durationMs: 10, isAborted: false, turnId: 't2', reason: 'answer' })
  expect(runs).toBe(1)
  expect(status).toBe('guardiano: NON MISURABILE')
})

// ──────────────────────────────────────── 8. Alias di sessione
test('alias: «avvia sessione lab» e «chiudi sessione» dal composer aggiungono il contesto senza toccare il testo; altri prompt no', async ($, on) => {
  const seen: Array<{ text: string; context?: readonly string[] }> = []
  on('prompt.submit', (_$, e) => { seen.push({ text: e.text, context: e.context }); return { text: e.text } })
  await $.prompt.submit({ text: 'avvia sessione lab', wait: false, origin: { kind: 'composer' } })
  await $.prompt.submit({ text: 'Chiudi la sessione.', wait: false, origin: { kind: 'composer' } })
  await $.prompt.submit({ text: 'avvia sessione e poi fai X', wait: false, origin: { kind: 'composer' } })
  expect(seen[0]?.text).toBe('avvia sessione lab')
  expect(seen[0]?.context?.[0]).toMatch(/skill `avvio`.*args: lab/)
  expect(seen[1]?.context?.[0]).toMatch(/skill `handoff`/)
  expect(seen[2]?.context).toBeUndefined()
})

// ──────────────────────────────────────── 9. MCP di invio/cancellazione
test('mcp: un tool di invio/cancellazione è negato senza dialogo; un tool di lettura e il browser passano', async ($, on) => {
  const ran: string[] = []
  on('tool.call', (_$, e) => { if (e.tool.startsWith('mcp__')) ran.push(e.tool); return { result: 'ok' } })
  for (const t of ['mcp__f7446010-8860-4b6f-8079-fff8509f6972__send_message', 'mcp__zapier__execute_zapier_write_action', 'mcp__5c6b9676-3dcd-4126-aa7b-02849a1343e5__execute_sql', 'mcp__6cca65bf-25e4-4a0f-902c-7dbafb5976b2__trash_file', 'mcp__93e88169-0ef5-4fe5-bf5e-e65cab8dd30e__outlook_batch_delete_messages'])
    expect(denyOf(await $.tool.call({ tool: t } as never))).toMatch(/NON autorizzata/)
  expect(ran).toEqual([])
  for (const t of ['mcp__zapier__list_zapier_skills', 'mcp__claude-in-chrome__tabs_close_mcp', 'mcp__ccd_session__mark_chapter', 'mcp__f7446010-8860-4b6f-8079-fff8509f6972__search_threads'])
    expect(denyOf(await $.tool.call({ tool: t } as never))).toBeUndefined()
  expect(ran.length).toBe(4)
})

// ──────────────────────────────────────── 10. File generati
test('generati: Edit su un file con marcatore GENERATO in testa è negato con il generatore; un file normale passa', async ($, on) => {
  on('fs.exists', () => ({ value: true }))
  on('fs.stat', () => ({ value: { kind: 'file' as const, size: 100, mtimeMs: 0, isLink: false } }))
  on('fs.read', (_$, e) => ({ value: e.path.endsWith('ATLAS.md') ? '# ATLAS (GENERATO)\n> Generato da `docs/kb/tools/build_atlas.py` — non editare a mano\n' : '# Note\nciao\n' }))
  on('tool.call', () => ({ result: 'ok' }))
  expect(denyOf(await $.tool.call({ tool: 'Edit', file_path: 'docs/kb/atlas/ATLAS.md', old_string: 'a', new_string: 'b' }))).toMatch(/build_atlas\.py/)
  expect(denyOf(await $.tool.call({ tool: 'Edit', file_path: 'docs/NOTE.md', old_string: 'a', new_string: 'b' }))).toBeUndefined()
})
