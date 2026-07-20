# FINDINGS / WS-L — Ecosistema Claude Code (footprint always-loaded, plugin, memoria, hook, costo boot)

> Audit forense **read-only DESIGN-ONLY** del workstream "ecosistema Claude Code" (WS-L del programma 100X). Metodo: misurazione reale su disco/config (`wc -l`/`wc -c` su CLAUDE.md global+project, `grep -c` su `enabledPlugins`, `ls`/`find` su `memory/`), lettura `~/.claude/settings.json` + `~/.claude-mem/settings.json` + `SESSION_START_FORENSICS.md` + memorie + `DEBT_REGISTER.md` (D-56). Evidenza: output reali + `path:linea`. **ZERO modifiche, ZERO git, ZERO implementazione**. Data: 2026-07-20 (S1022). Cross-ref: forensica session-start 2026-07-07 (`SESSION_START_FORENSICS.md`, memoria `project_session_start_optimization`) — questo WS-L ne è il follow-up di verifica + estensione al resto dell'ecosistema.

> ⚠️ Molte leve toccano **config GLOBALI fuori dal repo** (`~/.claude/settings.json`, `~/.claude-mem/settings.json`, `~/.claude/CLAUDE.md`, `memory/`): **non propagano via git/align-clones** e sono decisione di Enzo (nessuna esecuzione in fase A).

## Headline (cosa dice la misura oggi)

1. **🟡 MEDIUM L-1** — il CLAUDE.md **GLOBALE** è la seconda voce always-loaded più pesante (135 righe **ma 31.302 char ≈ 7,8k tok**, densità 232 char/riga). Blocchi ad alto costo / basso trigger: `CONTESTO MAC` (macchina **RITIRATA S1007** ma descritta full-fat: hardware 2012, chiavi SSH, path Homebrew Intel) + corpi verbosi di R7/R18/R20/R22/R23 (200-400 parole ciascuno), caricati **ogni turno di ogni progetto**. È l'unico grande blocco non ancora toccato dopo lo slim del project CLAUDE.md (S1017).
2. **🟢 ASSET L-2** — il project CLAUDE.md (236 righe / 36.690 char ≈ 9,2k tok) è già stato snellito 270→236 (S1017); il residuo (invarianti I1-I20, module-pattern 7-step, security model) è **giustificato**. Solo micro-compattazioni opzionali.
3. **🟡 MEDIUM L-3** — 16 plugin attivi / 62 entry; `chrome-devtools-mcp` è l'**UNICO plugin always-on che monta un MCP** (~40 tool deferred + startup npx), mentre `serena` e `playwright` sono già `false` (on-demand). Candidato lazy-load coerente con la dottrina già applicata.
4. **🟡 MEDIUM L-4** — 4 plugin authoring a basso trigger sono always-on (`agent-sdk-dev`, `claude-code-setup`, `hookify`, `ralph-loop`): inerti nella maggior parte delle sessioni prodotto. Candidati disable-until-needed.
5. **🟡 MEDIUM L-5** — la memoria nativa (`memory/`) è a 50 nodi / 1420 righe, ma l'indice `MEMORY.md` è in **DRIFT**: 2 file su disco NON indicizzati (`feedback_code_over_docs.md` del 2026-07-20, `reference_claude_ecosystem_alignment.md` del 2026-06-26). Stessa classe di D-01.
6. **⚪ INFO L-6** — D-56 (claude-mem) è un workaround ATTIVO e corretto (plugin disabilitato + `bun-runner.js` stub); la remediation pulita è gated su fix upstream (diagnosi in coda).
7. **🟢 ASSET L-7** — il prune S1017 (40→16 attivi) è sano e va NON regredito (6 voltagent + 11 trailofbits + example-skills + karpathy tutti `false`; nessuno pertinente allo stack TS/Fastify/Postgres).

---

## Gruppo A — Footprint always-loaded (CLAUDE.md global + project)

### F-WS-L-1 — Global CLAUDE.md: 31.302 char always-loaded, con blocchi on-demand descritti full-fat + corpi-regola verbosi
- Severità: **MEDIUM** | Flag: **DOSSIER** (tocca `~/.claude/CLAUDE.md`, user-global cross-project → decide Enzo)
- Evidenza: `wc -l ~/.claude/CLAUDE.md` = **135 righe**; `wc -c` = **31.302 char** (~7,8k tok). Densità = 232 char/riga → paragrafi. Blocchi ad alto costo / basso trigger: `CONTESTO MAC` (macchina `RITIRATA S1007`) descritta integralmente pur essendo on-demand-only; corpi estesi di **R7** (PowerShell robusto), **R18** (plugin-over-MCP + diagnosi Desktop Commander), **R20** (feasibility 5 criteri), **R22** (delega CLASSE A/B), **R23** (autonomia tool-proattiva). Tutti caricati ogni turno di ogni progetto.
- Impatto: footprint (~7,8k tok always-loaded cross-project) + rumore (regole a bassa frequenza competono con R1-R6 ad alta frequenza)
- Baseline: 135 righe / 31.302 char / ~7,8k tok. Combinato con project CLAUDE.md = ~68k char / ~17k tok.
- Proposta (design-only, 3 opzioni):
  - **Conservativa**: comprimere solo `CONTESTO MAC` a 2 righe con pointer; −~1,5k char, zero perdita regole. Reversibile.
  - **Evolutiva**: layered CLAUDE.md — INLINE le regole ad alto trigger (R1-R6, R8-R12, DECISION AUTHORITY) + gli headline di R7/R13/R16/R18/R20/R22/R23; estrarre i **corpi estesi** e i contesti-macchina in `~/.claude/reference/*.md` on-demand. Stima −3-4k tok always-loaded, zero perdita. Analogo global dello slim S1017.
  - **Radicale**: skill `claude-ecosystem-optimizer` in modalità implementazione su TUTTO l'ecosistema global come refactor unico governato (backup/verifica/rollback). Massimo guadagno, sessione dedicata + gate di non-regressione.
- Nota: nessuna regola R1-R23 va **persa** — ridurre il caricato-sempre, non il corpus. Decide Enzo (è il suo user-global).

### F-WS-L-2 — ASSET: project CLAUDE.md già snellito (S1017), residuo giustificato
- Severità: INFO | Flag: **ASSET**
- Evidenza: `wc -l D:/heuresys-advanced/CLAUDE.md` = **236 righe** (era 270 pre-S1017); `wc -c` = **36.690 char**. Lo slim ha estratto Design-System-X18 → `docs/kb/DESIGN_SYSTEM_UI.md`, R23-project → `docs/kb/AUTONOMY_R23_PROJECT.md`, MVP compattato a pointer. Il residuo (invarianti I1-I20, module-pattern 7-step, plugin-chain 13-step, security) è la spina dorsale architetturale enforce-ata dal codebase.
- Proposta: **NESSUNA azione strutturale**. Micro-compattazione opzionale: la doctrine "treat-as-real / no-PII retired" appare 4 volte (Data provenance + OUTPUT RULE + I15 + I12); un pointer unico farebbe −~0,4k tok. LOW priority.

---

## Gruppo B — Plugin footprint (surface always-on)

### F-WS-L-3 — `chrome-devtools-mcp` unico plugin always-on che monta un MCP — candidato lazy-load
- Severità: **MEDIUM** | Flag: **QUICK-WIN** (flip a `false`, on-demand)
- Evidenza: `~/.claude/settings.json:59` `chrome-devtools-mcp: true`. Unico dei 16 attivi che espone un server MCP (~40 tool `mcp__plugin_chrome-devtools-mcp_*`). `serena` (`:65`) e `playwright` (`:57`) sono già `false` = pattern on-demand già adottato. Uso reale = web-QA/E2E debugging, non ogni sessione.
- Proposta: **QUICK-WIN** — `false` di default + riabilitazione on-demand, identico a serena/playwright. Gate: `/mcp` mostra il server su richiesta. Reversibile.

### F-WS-L-4 — 4 plugin authoring a basso trigger always-on
- Severità: **LOW** | Flag: **QUICK-WIN** (disable-until-needed)
- Evidenza: `settings.json` — `agent-sdk-dev:46`, `hookify:44`, `claude-code-setup:49`, `ralph-loop:63` = `true`. Plugin di meta-lavoro: iniettano skill/agent nel surface ma firano raramente durante il lavoro prodotto. `agent-sdk-dev` porta 2 sub-agent verifier.
- Proposta: **QUICK-WIN** — `false` di default con riattivazione al task specifico. Gate: skill riabilitabili al flag; zero perdita capability.

### F-WS-L-5 — `human-resources-plus` è il maggior contributore al surface skill (~60 skill)
- Severità: INFO | Flag: **ASSET** (con nota footprint)
- Evidenza: `settings.json:77` — inietta ~60 skill `hr-*`/`recruit-*` + orchestratori `/hr` `/recruit` + 6 sub-agent. Maggior contributore al surface skill.
- Proposta: **NESSUNA azione** (asset di prodotto — la suite HR nativa è la value-prop). Se in futuro si riduce il surface, è il candidato numerico più grosso ma con **costo funzionale reale** → scelta di prodotto, non quick-win.

### F-WS-L-6 — ASSET: il prune S1017 (40→16) è sano — non regredire
- Severità: INFO | Flag: **ASSET**
- Evidenza: `grep -cE '@.*: (true|false)'` = **62 entry**, **16 true**. Disabilitati: 6 voltagent, 11 trailofbits, 2 levnikolaevich, example-skills, karpathy, context7/github official. Nessuno pertinente allo stack. Attivi legittimi: commit-commands, superpowers, claude-md-management, skill-creator, typescript-lsp, human-resources-plus (prodotto), feature-dev/pr-review-toolkit/code-simplifier/plugin-dev (DX), frontend-design.

---

## Gruppo C — Memoria Claude Code nativa (`memory/`)

### F-WS-L-7 — Indice `MEMORY.md` in DRIFT: 2 nodi su disco non indicizzati
- Severità: **MEDIUM** | Flag: **QUICK-WIN** (re-index)
- Evidenza: `find memory/ -name '*.md' | wc -l` = **51** (50 nodi + MEMORY.md). L'indice NON contiene `feedback_code_over_docs.md` (2026-07-20) e `reference_claude_ecosystem_alignment.md` (2026-06-26). Classe D-01 (doc-drift indice↔realtà). *(Nota S1022: `feedback_code_over_docs` è stato aggiunto all'indice più tardi nella stessa sessione — ri-verificare; `reference_claude_ecosystem_alignment` resta il candidato certo.)*
- Proposta: **QUICK-WIN** — aggiungere le voci mancanti sotto la categoria corretta. Gate: `#nodi su disco == #voci in MEMORY.md`. Zero rischio.

### F-WS-L-8 — Memorie point-in-time superate: candidati archiviazione
- Severità: **LOW** | Flag: NOTE
- Evidenza: nodi "session state" storici superati: `project_goal003_session_state.md` (storico 2026-05-20), `project_mvp3_session_state.md`, `project_brand_session1_state.md`, `project_claude_setup_refactoring_plan.md` (APPROVED, not executed).
- Proposta: **NOTE** — spostare i nodi terminati in `memory/_archive/` mantenendoli leggibili fuori dall'indice attivo. **NON auto-eliminare**. Decide Enzo quali. Analogo a `docs/archive/`.

### F-WS-L-9 — Ridondanza cross-source memorie↔SoT (derivazione, non bug)
- Severità: INFO | Flag: NOTE
- Evidenza: `project_session_start_optimization` ↔ `SESSION_START_FORENSICS.md`; `reference_claude_mem_mcp_flakiness` ↔ D-56. Le memorie sono viste derivate; la SoT vive nel repo.
- Proposta: **NOTE** — tenere un pointer alla SoT repo nelle memorie ridondanti invece di ri-narrare. Nessuna azione forzata.

---

## Gruppo D — Hook & costo session-start (residuo post-S1017)

### F-WS-L-10 — 3 hook SessionStart (~6,1s); `chrome-devtools-npx-bypass` mitiga un problema già risolto
- Severità: **LOW** | Flag: NOTE
- Evidenza: `settings.json:11-29` — 3 comandi SessionStart: `session-bootstrap.ps1 -NoInfra` (2614ms), `session-boot.ps1` (2728ms), `chrome-devtools-npx-bypass.ps1` (754ms). `handoff_lint` eseguito **due volte** (boot hook + build_menu).
- Proposta: **NOTE** — (a) de-duplicare `handoff_lint` al boot; (b) verificare se `chrome-devtools-npx-bypass` è ancora necessario se chrome-devtools-mcp va lazy (F-WS-L-3). Nessun hook PreToolUse/PostToolUse/Stop bloccante in global (il solo bloccante era claude-mem = D-56, neutralizzato).

### F-WS-L-11 — Leva dominante residua = `effortLevel: xhigh` al boot (comportamentale, scelta Enzo)
- Severità: INFO | Flag: NOTE
- Evidenza: `settings.json:144` `effortLevel: xhigh`. La forensica 2026-07-07 ha stabilito che il costo dominante di "avvia sessione" era (N round doctrine) × (decode a xhigh); lo slim ha tagliato N, il moltiplicatore xhigh sul boot resta.
- Proposta: **NOTE** — nessuna modifica config (xhigh è default deliberato). Re-flag dell'abitudine: boot a effort medio, xhigh al work-item (`/effort`). Scelta comportamentale.

### F-WS-L-12 — D-56 claude-mem: workaround attivo corretto; remediation pulita gated su fix upstream
- Severità: **MEDIUM** | Flag: DOSSIER (gated)
- Evidenza: `DEBT_REGISTER.md:69` D-56 — worker `claude-mem@thedotmack` v13.10.2 crasha al boot (`worker-service.cjs:5`), l'hook PreToolUse su Read usciva bloccante → Read bloccate. Workaround S1020: `bun-runner.js` stub + `enabledPlugins[claude-mem]=false`. Originali salvati (`.orig-bak`).
- Proposta: vedi diagnosi + fix in coda. Remediation gated su fix upstream. Decide Enzo se/quando ripristinare vs abbandonare.

---

## Quick wins (QW-L*) — CLASS-A (design-only, esecuzione gated su go Enzo)

- **QW-L1** — re-index `MEMORY.md` (2 nodi orfani) [F-WS-L-7]. Gate: `#nodi == #voci`. Zero rischio.
- **QW-L2** — `chrome-devtools-mcp` → lazy-load (`false`) come serena/playwright [F-WS-L-3]. Reversibile.
- **QW-L3** — disable-until-needed 4 authoring plugin [F-WS-L-4]. Reversibile.
- **QW-L4** — comprimere `CONTESTO MAC` a pointer nel CLAUDE.md global [F-WS-L-1 conservativa]. Zero perdita.
- **QW-L5** — archiviare nodi memoria session-state superati in `memory/_archive/` [F-WS-L-8]. NON auto-delete.

> Tutti i QW restano **doc-only/config-proposal in fase A** (read-only). Le modifiche a config global (`~/.claude/*`) sono **decisione di Enzo** e NON propagano via git — vanno applicate a mano (o via `align-claude-ecosystem`).

## ASSET confermati (NON regredire senza dossier)

- Prune plugin S1017 (40→16) [F-WS-L-6]. Project CLAUDE.md già snellito [F-WS-L-2]. serena+playwright già lazy [F-WS-L-3]. Nessun hook bloccante global [F-WS-L-10]. session_start.py 1-round [SESSION_START_FORENSICS.md].

## Baseline Ecosistema Claude (misure reali 2026-07-20)

| Metrica | Valore reale |
|---|---|
| Global CLAUDE.md | **135 righe / 31.302 char / ~7,8k tok** |
| Project CLAUDE.md | **236 righe / 36.690 char / ~9,2k tok** |
| CLAUDE.md combinati always-loaded | **~68k char / ~17k tok** |
| Plugin entry / attivi | **62 / 16** |
| Plugin che montano MCP always-on | **1** (chrome-devtools-mcp) |
| Memory nodi | **50** (+MEMORY.md), 1420 righe |
| MEMORY.md indice | **9.642 char / ~2,4k tok** always-injected |
| Nodi non indicizzati (drift) | **≤2** |
| Hook SessionStart | **3** (~6,1s, handoff_lint duplicato) |
| effortLevel boot | **xhigh** (leva dominante residua, scelta Enzo) |
| claude-mem | **DISABILITATO** (D-56 workaround attivo) |

**Insight**: dopo lo slim S1017 l'ecosistema è già molto più sano. Gap residui: (1) CLAUDE.md GLOBALE non ancora slim (~7,8k tok, Mac ritirato full-fat); (2) 1 MCP always-on (chrome-devtools) asimmetrico; (3) 4 plugin authoring a basso trigger; (4) drift indice memoria. La leva di latency più grande (effortLevel xhigh al boot) è comportamentale. Tutti i finding sono reversibili e config-local (nessun impatto codebase/PROD/contratti).
