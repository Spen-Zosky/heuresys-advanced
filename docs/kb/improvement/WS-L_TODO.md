# WS-L TODO — Ecosistema Claude Code (DESIGN-ONLY, esecuzione gated su go Enzo)

> Tutti i task sono **[ ] TODO in fase A** (read-only/design). Nessuna esecuzione senza go esplicito di Enzo. Le leve marcate `(GLOBAL)` toccano config fuori dal repo (`~/.claude/*`, `memory/`) → non propagano via git, si applicano a mano (o via `align-claude-ecosystem`). Ref finding: `WS-L_PLAN.md`.

## Quick-wins CLASS-A (low/zero rischio, reversibili)

| # | Task | Gate | Stato |
|---|---|---|---|
| QW-L1 | Re-index `MEMORY.md`: aggiungere i nodi orfani (`reference_claude_ecosystem_alignment`; verificare `feedback_code_over_docs`) alla categoria corretta (GLOBAL) | `#nodi su disco == #voci indice` | [ ] TODO |
| QW-L2 | `chrome-devtools-mcp` → `false` (lazy-load on-demand, come serena/playwright) (GLOBAL) | riattivabile via flag in sessione web-QA; `/mcp` lo mostra su richiesta | [ ] TODO |
| QW-L3 | Disable-until-needed: `agent-sdk-dev`, `claude-code-setup`, `hookify`, `ralph-loop` → `false` (GLOBAL) | skill riabilitabili al task; zero perdita capability | [ ] TODO |
| QW-L4 | Comprimere `CONTESTO MAC` (macchina ritirata S1007) a 2 righe + pointer nel CLAUDE.md global (GLOBAL) | dettagli Mac leggibili on-demand; −~1,5k char; zero perdita regole | [ ] TODO |
| QW-L5 | Archiviare nodi memoria session-state superati in `memory/_archive/` (goal003, mvp3, brand_session1, claude_setup_refactoring — decide Enzo quali) (GLOBAL) | NON auto-delete; nodi leggibili; indice aggiornato | [ ] TODO |

## Dossier (decisione Enzo — opzioni A/B/C, nessun default)

| # | Task | Gate | Stato |
|---|---|---|---|
| D-L1 | Layered CLAUDE.md global: conservativa (solo Mac) / evolutiva (estrai corpi R7/R18/R20/R22/R23 + contesti-macchina in `~/.claude/reference/*.md`) / radicale (skill `claude-ecosystem-optimizer` full) (GLOBAL) | zero perdita regole R1-R23; corpi on-demand; non-regressione comportamentale | [ ] TODO |
| D-L2 | D-56 remediation claude-mem: se `worker-service.cjs:5` boot-crash riparato upstream → ripristino da `.orig-bak` + riabilita flag; ALTERNATIVA: hook PreToolUse **fail-open** (exit 0 quando worker down) (GLOBAL) | gated su fix upstream; Read non bloccabili da worker down | [ ] TODO (gated) |

## Note (verifica, non fix)

| # | Task | Gate | Stato |
|---|---|---|---|
| N-L1 | De-duplicare `handoff_lint` al boot (eseguito da boot hook + build_menu) | una sola run per boot; menu invariato | [ ] TODO |
| N-L2 | Verificare necessità di `chrome-devtools-npx-bypass.ps1` al boot se chrome-devtools-mcp va lazy (QW-L2) | se plugin off-default, il bypass npx al boot è inutile | [ ] TODO |
| N-L3 | Memorie ridondanti (session_start_optimization ↔ SESSION_START_FORENSICS; claude_mem_flakiness ↔ D-56): pointer-a-SoT invece di ri-narrare (GLOBAL) | SoT nel repo; memorie = hint di recupero | [ ] TODO |
| N-L4 | Abitudine boot a effort ridotto, bump a xhigh sul work-item (comportamentale, `/effort`) | nessuna modifica `settings.json` (xhigh default deliberato) | [ ] TODO (abitudine) |
| N-L5 | Micro-compattazione project CLAUDE.md: unificare le 4 occorrenze "treat-as-real / no-PII retired" con pointer unico (opzionale, LOW) | zero perdita doctrine; −~0,4k tok | [ ] TODO (opz.) |

## Asset da NON regredire (monitor di non-regressione)

| # | Asset | Verifica | Stato |
|---|---|---|---|
| A-L1 | Prune plugin 40→16 | `grep -cE ': true'` resta ~16; voltagent/trailofbits/etc = `false` | [ ] monitor |
| A-L2 | Project CLAUDE.md snellito (236 righe) | non ri-gonfiare; estrazioni verso docs/kb restano | [ ] monitor |
| A-L3 | serena/playwright lazy (`false`) | restano on-demand | [ ] monitor |
| A-L4 | Nessun hook bloccante global | 0 PreToolUse/PostToolUse/Stop bloccanti | [ ] monitor |
| A-L5 | session_start.py 1-round | boot non legge raw i file di stato grossi | [ ] monitor |

> Fase A = read-only. I QW/dossier sono candidati per la fase E su go di Enzo, con i gate sopra. Le leve `(GLOBAL)` non sono nel repo: applicazione manuale + backup (`.bak-*`) prima di ogni flip, revert = restore backup.

## Diagnosi D-56 (claude-mem hook) — sintesi

**Catena causale**: worker bun (`:37778`) crasha al boot (`worker-service.cjs:5`, v13.10.2 Windows) → l'hook PreToolUse su Read è **fail-closed** → worker down = Read bloccate (78 hook consecutivi falliti). **Root cause di design**: un hook PreToolUse su un'operazione CORE (Read) fail-closed rispetto a un backing-service **opzionale** (memoria semantica) — un arricchimento non deve mai bloccare le Read.

**Workaround attivo (S1020, corretto)**: `bun-runner.js` stub `process.exit(0)` + `enabledPlugins[claude-mem]=false`; originali in `.orig-bak`. Impatto: persa la memoria semantica claude-mem (solo tooling locale; la memoria nativa `memory/*.md` è indipendente e funziona).

**Fix proposto (non applicato, gated)**: (1) ripristino su upstream riparato (`npm view claude-mem version` monitor); (2) **fix del design difettoso**: hook PreToolUse **fail-open** (exit 0 quando worker irraggiungibile) — elimina la classe-di-guasto "servizio opzionale down → operazione core bloccata"; (3) abbandono se resta instabile e `memory/` copre il fabbisogno. Raccomandazione: (2) come mitigazione permanente + (1) per recuperare la capability. Decide Enzo.
