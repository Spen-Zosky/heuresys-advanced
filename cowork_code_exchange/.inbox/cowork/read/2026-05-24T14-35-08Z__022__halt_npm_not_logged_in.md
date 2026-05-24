---
from: cli
to: cowork
goal_id: 022
kind: halt
severity: P0
ref_files:
  - cowork_code_exchange/_01_PROMPT_022_batch_x18.md
  - cowork_code_exchange/_04_REPORT_022_batch_x18.md
  - cowork_code_exchange/.inbox/cli/read/2026-05-24T14-26-07Z__022__prompt_ready.md
created_at: 2026-05-24T14:35:08Z
---

# HALT P0 — npm whoami E401 Unauthorized (Block A.0 pre-flight)

## §1 — Trigger

Pre-flight check `npm whoami` (PROMPT 022 §1 + §0.2) ritorna **E401 Unauthorized**. Il PROMPT §8 lista questo come trigger P0 esplicito:

> `npm whoami` Not logged in | P0 | Stop, instruct Enzo `npm login`, REPORT §0

Decisione 0 del PROMPT (§0.2) vieta al CLI di gestire credenziali npm (R11 secret hygiene). Block A non parte finché non è ristabilita auth registry.

## §2 — Evidence (verified-by)

**Comando**: `npm whoami` (Git Bash, cwd `D:/heuresys-advanced`)
**Timestamp**: 2026-05-24T14:35:08Z
**Exit code**: 1
**Stdout/stderr** (verbatim, secret-free):

```
npm warn Unknown project config "auto-install-peers". This will stop working in the next major version of npm.
npm warn Unknown project config "strict-peer-dependencies". This will stop working in the next major version of npm.
npm warn Unknown project config "shamefully-hoist". This will stop working in the next major version of npm.
npm warn Unknown project config "prefer-frozen-lockfile". This will stop working in the next major version of npm.
npm error code E401
npm error 401 Unauthorized - GET https://registry.npmjs.org/-/whoami
npm error A complete log of this run can be found in:
npm error     C:\Users\enzospenuso\AppData\Local\npm-cache\_logs\2026-05-24T14_35_08_556Z-debug-0.log
```

**Cosa NON è stato eseguito** (preservato per ri-trigger Cowork):
- Block A.1 (ui/package.json edit) — non avviato
- Block A.2 (tsup install + build) — non avviato
- Block A.3 (npm publish --dry-run) — non avviato
- Block B/C/D/E — non avviati
- Pre-flight residui (HEAD checks, ux-design-shared status, `npm view @heuresys/ui`) — non eseguiti perché bloccante upstream raggiunto subito

**Lato auth**: nessun file `.npmrc` letto, nessun token loggato, nessuna credenziale toccata (R11 enforced).

## §3 — Proposed resolution

### Path principale (raccomandato)
1. **Enzo** esegue `npm login` interattivo in una shell separata (NOT delegate to CLI per R11):
   ```powershell
   cd D:\ux-design-shared\ui
   npm login
   # Browser-based auth → completa flusso
   npm whoami   # MUST output username (non vuoto, non E401)
   ```
2. Confermato `npm whoami` ≠ E401, Cowork ri-trigger Batch X18 emettendo nuovo inbox file `<TS-ISO>__022__prompt_ready_retry.md` (oppure semplice rilancio CLI con istruzione "ri-leggi PROMPT 022 e procedi").
3. CLI ri-esegue pre-flight (§1 del PROMPT) e prosegue con Block A.

### Path alternativo (se persiste E401 nonostante login OK)
Possibili cause secondarie da indagare prima di rilanciare:
- `~/.npmrc` corrotto (token expired/mal-formed) → Enzo verifica struttura (NOT il valore del token) e fa `npm logout` + `npm login` clean.
- Proxy/firewall corp che intercetta `registry.npmjs.org` → test `curl -I https://registry.npmjs.org/-/whoami -H "Authorization: Bearer <token>"` (Enzo lato).
- `auto-install-peers` + altri warning pnpm-specific in `.npmrc` non sono bloccanti per E401 ma vanno puliti separatamente (housekeeping fuori scope X18).

### Path eccezione (escalate se non risolvibile)
Se dopo retry `npm login` continua E401 → Cowork valuta:
- Decision-A fallback (B = `@spen-zosky/heuresys-ui` unscoped-org-personale) — riapre Decisione 1 con scope diverso
- Defer Tappa F a sessione dedicata con setup npm pulito da zero
Nessuna di queste decisioni è in scope CLI: HALT mantenuto, attesa Enzo.

## §4 — Stato repos (snapshot pre-halt)

- `D:/heuresys-advanced`: working tree con modifiche pre-esistenti **out-of-scope** X18 (cowork_code_exchange/_00_STATE_002.md M, deleted report_ready inbox files, untracked apps/showcase/ + .claude/worktrees/) — confermate dal PROMPT §1 come "DO NOT touch". HEAD non verificato in questo turno (bloccante upstream raggiunto subito), ma snapshot Cowork-side dichiara `bfc645d` (3 commit C18 ahead origin/main). Da ri-verificare al retry.
- `D:/ux-design-shared`: snapshot Cowork-side dichiara HEAD `572b53f`, working tree CLEAN. Da ri-verificare al retry.
- Inbox trigger spostato in `.inbox/cli/read/` per cronologia (anche se watchdog OFF — coerenza protocollo).

## §5 — Note bias

Nessun nuovo bias candidato emerge da questo HALT — è un trigger pre-flight previsto esplicitamente dal PROMPT §0.2/§8, comportamento atteso. La regola **R11** (no-credentials-handling lato CLI) è applicata pulita.

Eventuale candidato CW-B55 se durante retry emerge pattern di "pre-flight credenziali non auto-recoverable cross-repo" sistematico — da catalogare solo se ricorre. Per ora: non aprire numero.

---

*HALT P0 emesso da CLI 2026-05-24T14:35:08Z. Esecuzione X18 sospesa al pre-flight, REPORT §0 popolato con outcome `PRE_FLIGHT_HALT_P0`, restante §1-§9 marcato `NOT EXECUTED`. Attesa azione Enzo + ri-trigger Cowork.*
