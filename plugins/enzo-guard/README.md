# enzo-guard — le regole di Enzo che il motore fa rispettare da solo

Plugin di **function hooks** di Claude Code (≥ 2.1.263, flag `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`
in `~/.claude/settings.json` → `env`). Gira **dentro il motore, prima del modello**: un divieto
qui non è una riga di CLAUDE.md che il modello legge e a volte dimentica, è codice che nega,
chiede o riscrive **prima** che il tool parta. Nato dall'audit `/hooks-audit` del 2026-09-20
(62 sessioni / 60 giorni misurate: report in `tmp/hooks-audit/report-2026-09-20.md` e in
`Claude Desktop\hooks-audit_20260920\`).

## Come si accende, come si spegne (tornare indietro)

| Livello | Come | Effetto |
|---|---|---|
| **Tutto il plugin** | la junction `~/.claude/skills/enzo-guard` → `plugins/enzo-guard` lo carica in **ogni** sessione di questa macchina (`enzo-guard@skills-dir`). Per spegnerlo: `Remove-Item $env:USERPROFILE\.claude\skills\enzo-guard` (toglie il collegamento, non i file). Per riaccenderlo: `New-Item -ItemType Junction -Path $env:USERPROFILE\.claude\skills\enzo-guard -Target D:\heuresys-advanced\plugins\enzo-guard` | on/off globale, effetto dalla sessione successiva |
| **Un hook alla volta** | `/config` → righe «enzo-guard» (una per hook, `userConfig`); oppure in `~/.claude/settings.json` → `pluginConfigs["enzo-guard@skills-dir"].options.<nome>: false` | spegne solo quel comportamento, il modulo si ricarica da sé |
| **Il codice** | è versionato nel repo: `git revert` dei commit `feat(plugin): enzo-guard …` e `docs(claude): …` | torna il CLAUDE.md di prima |

Le regole tolte dai CLAUDE.md sono rimaste **in una riga** ciascuna: Cowork, Codex, cron e le
macchine senza il plugin (Mac, VM, linux-pc) non eseguono plugin e continuano a leggerle lì.

## Gli hook

| # | Nome (`/config`) | Evento | Cosa fa | Regola / segnale d'origine | Beneficio misurato (60 gg) |
|---|---|---|---|---|---|
| 1 | `pythonUtf8` | `tool.call` Bash/PowerShell | `python3` → `python` (solo Windows); `export PYTHONUTF8=1;` in testa se manca | globale «python3 = stub Store»; storico | 40 errori `charmap` in 11 sessioni, 128 prefissi scritti a mano |
| 2 | `gitGuard` | `tool.call` Bash/PowerShell | **nega** `push --force` (senza `--force-with-lease`), `commit --no-verify`, `reset --hard`, `--amend`, `checkout .`, `restore .` **chiedono**; `add -A/.` **negato solo con un'altra sessione viva** sul progetto (registro `~/.claude/sessioni/attive`, pid verificato da `hooks/sessioni_vive.py`; non misurabile = negato) | globale §Divieti «Git»; progetto (mai `-A`) | 24 occorrenze |
| 3 | `secretsGuard` | `tool.call` Read/Edit/Write/Bash | **nega** lettura/scrittura di `.env*` (non `.example`), `.secrets/`, `*.pem|key|p12|pfx`, `*credentials*.json`; nega `git add` che li include | globale §Divieti «Segreti»; progetto «What NOT to touch» | 3 `cat .env` |
| 4 | `commitSecrets` | `tool.call` Bash (pre `git commit`) | legge `git diff --cached` **più** i percorsi che lo stesso comando aggiunge/committa (anche file nuovi); **nega** su chiave privata, `sk-…`, JWT, token GitHub/Slack/AWS, connection string con password; logga le assegnazioni `password|secret|token = "…"` | globale §Divieti «prima di un commit, grep sullo staged diff» — il pre-commit git del repo **non** lo fa | 622 commit |
| 5 | `deleteGuard` | `tool.call` Bash/PowerShell | `rm`, `rmdir`, `del`, `Remove-Item`, `git clean -f`, `git rm`, `find -delete`: **chiede**; senza dialogo (corsa `-p`) **nega** e propone la cartella nuova | globale §Divieti «mai cancellare senza conferma» + «non presidiato: MAI» | 81 `rm` in 22 sessioni |
| 6 | `dbGuard` | `tool.call` Bash/PowerShell | solo dove esiste `db/scripts/`: `psql … 5433 …` con DELETE/UPDATE/TRUNCATE/DROP/INSERT/ALTER o `-f *.sql`, `pnpm db:reset`, `pnpm db:migrate` da Windows → **chiede**; senza dialogo nega con il comando giusto (`pnpm db:migrate:vm`) | progetto C4, «db:reset: ask», «migrazioni SI ESEGUONO SULLA VM» | 5 psql write su :5433, 1 `db:reset`, 1 migrate da Windows (~80 min) |
| 7 | `guardianoBar` | `turn.complete` (solo interattivo, loop principale) | lancia `guardiano.py --json --sorveglia` e mette le due misure nella **riga di stato** (`guardiano · contesto NN% · 5h NN% · ok/⚠/⛔`); exit 3 → toast + log | progetto/globale «Il guardiano» | 566 invocazioni a mano in 49 sessioni |
| 7b | `guardianoAutoClose` (**spento**) | idem | se acceso, a exit 3 sottomette `/handoff` da solo | «se il guardiano dice di chiudere, la chiusura è l'ultimo atto» | — |
| 8 | `sessionAliases` | `prompt.submit` (solo composer/bridge) | «avvia sessione [lab]», «chiudi (la) sessione»: **non tocca il testo** (il command hook `session_mode.py` lo legge letterale), aggiunge un contesto che impone la skill `avvio`/`handoff` come prima azione | storico: 46 prompt; S1068 (skill omonima che mascherava `handoff`) | determinismo |
| 9 | `mcpGuard` | `tool.call` `mcp__*__(send|forward|reply|trash|delete|remove|execute_sql|apply_migration|deploy|buy|write_action|…)` (esclusi browser, `ccd_*`, computer-use, Windows-MCP) | **chiede**; senza dialogo nega | segnale `mcp-destructive-tools` | rischio evitato |
| 10 | `generatedGuard` | `tool.call` Edit/Write | se le prime 600 lettere del file portano `GENERATO` / `non editare a mano` / `auto-generated`: **nega** e indica il generatore citato nel file | segnale `autogenerated` (`ATLAS.md`, `ADR_INDEX.md`) | rework evitato |

Ogni hook è in `try/catch`: un hook che lancia viene **saltato** dal motore (protezione zero), quindi
un errore interno degrada a «lascia passare» e lo scrive nel debug log (`[enzo-guard] …`).

## Verifica (deve poter fallire)

```bash
claude plugin validate plugins/enzo-guard                       # il motore vede 12 hook e le chiamate $.…
npx -y -p typescript@5 tsc -p plugins/enzo-guard/tsconfig.json  # zero output = ok (tipi in .claude/types, rigenerati con /plugin-types)
claude plugin test plugins/enzo-guard                           # 17 prove con il mondo (fs/process/env/ui) mockato sotto il plugin
```

Collaudo a runtime del 2026-09-20 (headless, bersagli finti): 8 hook su 8 esercitabili in `-p` hanno
intercettato (`tmp/hooks-audit/probe-run1.out`); il plugin si carica da `skills-dir` senza flag
(`probe-run2.out`). **Restano da vedere in sessione interattiva**: la riga di stato del guardiano
(#7) e la domanda dei gate B (#2 amend, #5, #6, #9) — in `-p` la domanda non esiste e il gate nega,
che è il comportamento voluto.

Dopo un aggiornamento di Claude Code: `/plugin-types .claude/types` (i tipi sono l'autorità), poi
i tre comandi sopra.
