# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-07-08 (S1017 — forensica + ottimizzazione session-start + fix integrità DB).

> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti. Menu generato da `docs/kb/tools/session_start.py` (nuovo — menu+salute in 1 round; wrappa `build_menu` + `status_dashboard --no-net`).

## Last session brief (S1017)

**Forensica session-start**: "avvia sessione" impiegava >20 min — causa dominante = **(N round-modello della doctrine) × (decode a xhigh)**, NON gli MCP (referto `docs/kb/SESSION_START_FORENSICS.md`, workflow 4 profiler + verificatore). Fix shippati (tutti reversibili): **`docs/kb/tools/session_start.py`** (menu+salute in 1 processo/1 round, `--no-net` al boot); **CLAUDE.md** "Session start" riscritta (niente lettura raw dei file di stato grossi al boot) + slim 270→236 righe (Design-System→`docs/kb/DESIGN_SYSTEM_UI.md`, R23-project→`docs/kb/AUTONOMY_R23_PROJECT.md`, pointer MVP stale corretto). Config **globali fuori repo** (effetto prossima sessione CLI, backup `.bak-forensic-20260707`): `~/.claude/settings.json` plugin **40→17** (voltagent/trailofbits/… disabilitati; serena+playwright lazy-load), `~/.claude-mem` obs **50→12**. **Fix integrità DB**: notifiche inbox orfane ASSESSMENT di paolo.caputo eliminate (snapshot+guard) → **tutte le viste strutturali di validazione pulite** (`qa_artifacts/inbox-orphan-cleanup-20260707.{md,csv}`).

## Top priorities (next session)

1. **#27 evidence layer** (P1, ~8-12h, dossier A §L2) — wedge explainability/AI-Act; si rafforza con **#28 trust-ledger** (~4h, accoppiabili).
2. **#26 vita dei goal** (~6-10h) e/o **#34 primo approval handler** (~2-4h) — P1 register, componibili.
3. **pricing page GTM** (#4, ACTIVE — autorità *cosa* = Enzo: servono numeri prezzi/tier).

## Open questions (autorità *cosa* = Enzo)

- **Serie C-G** dei dossier development-lines: quali/quando convertire in register (solo A+B finora).
- **Sblocchi GATED**: #39 EMAIL (app-password Outlook = #8) · #40 free-text search (ok all'uso runtime key Voyage).
- **F4 activity entities** (HOLD #24) · **pricing** numeri tier.
- **Boot a effort ridotto** (raccomandazione S1017, non forzabile): adottare l'abitudine `/effort` basso all'avvio, bump a xhigh sul work-item? Metà del fix session-start.

## Verification (next session)

```bash
git log origin/main..HEAD --oneline                                   # 0 (tutto pushato)
python docs/kb/tools/session_start.py                                 # menu + salute in 1 round (offline-fast)
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc \
  "SELECT count(*) FROM sys.v_inbox_resource_consistency"             # 0 (integrità inbox ripristinata)
python docs/kb/tools/handoff_lint.py                                  # OK
```
