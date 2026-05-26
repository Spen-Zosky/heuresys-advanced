# `/loop` watchdog PROMPT autoritativo — Cowork↔CLI session-bounded automation

**Status**: production-ready (FBI 5/5 verified 2026-05-23 con test triviale in `D:\tmp\loop_test\`)
**Author**: Cowork batch C10.10
**Date**: 2026-05-23
**Pattern memo ref**: §17 vincente 21 (post-validation)

---

## §1 — When to use this watchdog

Quando vuoi che CLI auto-execute PROMPT files emessi da Cowork **durante working hours**, senza copy-paste manuale. Sessione CLI dedicata + `/loop` skill rimane attiva fino a chiusura finestra o expire dopo 3 giorni.

**Riduzione intermediation attesa**: ~90-95% per ciclo Cowork↔CLI in mode automation.

**Costo**: OAuth-mediated (no API key extra). Token consumption ~120-300k/h idle (depending interval); molto di più quando triggered work execution.

**Lifecycle**:
- Loop muore al close finestra terminal (rilancio mattutino)
- Auto-expire dopo 3 giorni (rilancio settimanale)
- Stop manual via `/stop` o Ctrl+C in finestra CLI

---

## §2 — Lancio: comandi setup per Enzo

**Una volta per session** (tipicamente la mattina):

```powershell
# Finestra PowerShell dedicata watchdog
cd D:\heuresys-advanced

# Verifica tunnel SSH attivo (CLI userà connessione per Wave 1 retry su DB)
ssh -fN -L 5433:localhost:5432 oracle-vm-default
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT NOW()" | head

# Lancia claude interactive
claude
```

**Dentro la sessione CLI** (paste il prompt `/loop` da §3 sotto).

---

## §3 — PROMPT `/loop` autoritativo

Paste questo nella sessione `claude` interactive aperta in `D:\heuresys-advanced`:

```
/loop 5m Watchdog mode for Cowork↔CLI v2.2 protocol on heuresys-advanced.

Each iteration:

1. SCAN cowork_code_exchange/.inbox/cli/pending/ for files matching:
   - *__prompt_ready.md
   - *__exec_directive*.md

2. IF no new file:
   - Append 1 line to cowork_reserved/loop_heartbeat.log: "[<UTC timestamp>] heartbeat idle pending=0"
   - Skip to next iteration (sleep until next wakeup)

3. FOR EACH new file found (process oldest first by LastWriteTime):

   a. Read file content + extract ref_files from frontmatter
   b. Read referenced PROMPT file (cowork_code_exchange/_01_PROMPT_<NNN>_<slug>.md)
   c. Read all spec files listed in ref_files (cowork_reserved/batch_c<N>/<area>/*.md)

   d. Execute the batch per Cowork↔CLI v2.2 protocol:
      - Follow CLAUDE.md project rules (heuresys-advanced)
      - Apply Inline Mitigation Scope §13 ampliata (pattern memo cowork_reserved/COWORK_CLI_PROMPT_PATTERN.md §10-§16)
      - Halt SOLO per P0 triggers ESPLICITAMENTE listati nel PROMPT body (sezione "Halts P0")
      - Tutto il resto = inline mitigation autorizzato

   e. Write REPORT to cowork_code_exchange/_04_REPORT_<NNN>_<slug>.md following PROMPT §REPORT format

   f. Emit notification: write file cowork_code_exchange/.inbox/cowork/pending/<UTC-iso-ts>__<goal_id>__report_ready.md with YAML frontmatter (from, to, goal_id, slug, kind=report_ready, ref_files, created_at)

   g. Move processed inbox file: cowork_code_exchange/.inbox/cli/pending/<file>.md → cowork_code_exchange/.inbox/cli/read/<file>.md

   h. Commit + push as singolo bundle: "X<N> <topic> bundle"

4. P0 HALT detection (during execution OR auto-discovery):
   - If any P0 trigger fires (regression sys_users/sys_esco/sys_job_roles, R-A2 admin loss, schema CHECK violation non-recoverable, OR any halt criterion listed in PROMPT §Halts P0):
     a. STOP execution immediately
     b. Write cowork_code_exchange/.inbox/cowork/pending/<UTC-iso-ts>__<goal_id>__halt_<reason>.md
     c. Include diagnostic dump + halted-at step + suggested next action
     d. Continue loop (do not exit), so Enzo or Cowork can review halt + emit exec_directive

5. ERROR HANDLING (non-P0):
   - SSH tunnel down → log warning, skip iteration, retry next loop (60s tunnel typically self-recovers)
   - DB unreachable → log warning, skip
   - Test suite >5 new failures → halt P1 + emit inbox warning, don't proceed to commit
   - typecheck failure → halt P1
   - Anything else inline-mitigatable per pattern memo §13 → fix and continue

6. HEARTBEAT throttle:
   - "heartbeat idle" log line: max 1 per 10 min (don't spam log when no work)
   - Use modulo on iteration count or last-heartbeat-timestamp check

7. CONTEXT BUDGET awareness:
   - If context budget >80% during execution (mega-bundle PROMPT 4+ blocks), prefer subagent delegation per pattern memo §13 Subagent-first
   - Use `Task subagent_type=general-purpose model=sonnet` for Block-level execution to isolate context
   - Main loop session resta orchestrator, never bloats

Continue loop indefinitely. Stop ONLY on /stop command or session close. Log iteration count + last-action summary to terminal output for visibility.
```

---

## §4 — Cosa fare quando arriva REPORT

Quando il loop emette `<TS>__<goal_id>__report_ready.md` in `cowork_code_exchange/.inbox/cowork/pending/`:

1. **Tu (Enzo)** vedi notification in finestra CLI terminal
2. **Apri sessione Cowork (questa chat o nuova)** e dici "leggi REPORT XN"
3. **Io (Cowork)** leggo REPORT + processo cognitive review autonomously
4. Se OK → emetto next PROMPT in `.inbox/cli/pending/` (loop lo prende next iteration)
5. Se halt P0 → io leggo halt notice + propongo exec_directive

---

## §5 — Lifecycle + manutenzione

| Evento | Frequency | Azione tua |
|---|---|---|
| Loop auto-expire dopo 3 giorni | Settimanale (ogni lunedì?) | Re-paste prompt §3 in sessione fresh |
| Session close (chiudi finestra) | Quando spegni PC | Re-paste mattina dopo |
| Bash tool permission prompts | Prima invocation post-restart | Approve once, memo stored on task |
| Token budget exhaustion (raro durante working day) | Notification CLI | `/stop` + restart fresh |

---

## §6 — Coexistence con sessione CLI X-cycle

**Importante**: il loop watchdog è una sessione SEPARATA dalla sessione CLI che esegue il batch corrente (es. X10 ora).

**Workflow combinato**:
- **Sessione A** (working dedicata batch corrente, es. X10): Enzo lavora attivamente, vede REPORT, conversational
- **Sessione B** (loop watchdog): in background, auto-processa NEXT PROMPT quando emesso

Dopo X10 chiude:
- Sessione A diventa idle
- Loop watchdog (Sessione B) era già attivo OR si lancia con `/loop` prompt §3 in sessione fresh
- Da X11+ in poi, sessione A NON è più necessaria (loop fa tutto)

---

## §7 — Halt P0 escalation flow

Quando loop watchdog rileva P0:

1. Loop scrive `.inbox/cowork/pending/<TS>__<goal_id>__halt_<reason>.md`
2. Loop continua a girare (no exit) — next iteration vede file in `_01_PROMPT_*` o `__exec_directive_*` da Cowork response
3. Cowork riceve notification (questa chat OR scheduled task)
4. Cowork processa halt + emette `__exec_directive_*` in `.inbox/cli/pending/`
5. Loop next iteration vede directive + esegue resolution

Tutto autonomous **eccetto** la review cognitive Cowork-side (resta human-in-loop su decisione architetturale).

---

## §8 — Sanity checks da fare al primo lancio loop reale

Prima di affidare X11+ al loop in autonomia, conferma:

1. **Detection works**: io emetto un PROMPT trivial (es. "verifica `SELECT NOW()`"), loop dovrebbe trovarlo entro 5 min + processarlo
2. **REPORT emission works**: post-trivial PROMPT, file REPORT scritto + inbox cowork notification emessa
3. **Halt detection works**: prove emettere un PROMPT con un P0 trigger artificiale (es. "sleep 5; raise halt P0 test_halt") + verifica loop ha emesso `__halt_*` in cowork inbox
4. **Heartbeat log throttling works**: dopo 30+ min idle, `loop_heartbeat.log` ha max ~3-5 righe (non 60+)

Solo dopo 4/4 PASS, affida X11+ autonomously al loop.

---

## §9 — Cost monitoring

Comando per verificare token consumption durante working day:

```bash
# In una shell separata dalla sessione CLI
tail -f cowork_reserved/loop_heartbeat.log
# Conta iterations × stima 3-5k token/iter (idle) o 10-50k token/iter (work)
```

Se sustained idle cost > 1M token/day risulta troppo:
- Aumenta interval a 10m (`/loop 10m` invece di `/loop 5m`)
- Halve iter/h → halve idle cost

---

## §10 — Combinazione ottimale (Cowork-side + CLI-side)

| Componente | Quando | Riduce |
|---|---|---|
| `/loop` watchdog CLI side (questo file) | Working hours session-bounded | Operativa: copy-paste trigger (~95%) |
| Scheduled task Cowork side (test in corso 18:30) | Cowork app aperta, auto-review REPORT | Cognitiva: review + draft next PROMPT (~70%) |
| Manual paste fallback | Sempre disponibile | Backup quando le altre fail |

Massimo combinato: **~98% intermediation reduction**. Restano tue: ADR approval + P0 halt review.

---

*End loop_watchdog PROMPT autoritativo — paste §3 in sessione `claude` dedicata per attivare watchdog Cowork↔CLI*
