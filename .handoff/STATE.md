# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-05 (S967).

> **Vista rapida** dello stato di lavoro (priorità · open questions). Lo **snapshot granulare del sistema** (versioni, DB/API/web/CI counts, architettura, migration) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Entrambe le viste (rapida + granulare) sono governate dalla skill `handoff` — **domini disgiunti, nessun numero duplicato qui**.

## Last session brief (S967 — ultracode)

**Manutenzione ambiente Claude Code — no-op sul repo** (working tree clean, HEAD invariato `9c44564`, SOT_STATE/backlog/debt non toccati). Diagnosticata la flakiness transiente del server MCP `claude-mem:mcp-search` (`-32000` "Failed to reconnect" al boot sessione): lo stack è sano (worker `bun` su `127.0.0.1:37777` con `mcpReady:true`, 21 tool esposti correttamente eseguendo lo spawn **identico** a quello dell'harness). Causa = race di spawn del bridge stdio al cold-start su Windows (non difetto di config) → workaround a costo zero **`/mcp` → Reconnect**. claude-mem già all'ultima (`13.4.0`, npm `latest`). Preparata esclusione Windows Defender della cache plugin come mitigazione (**pending, azione Enzo in PS admin**). Dettaglio durevole → memoria `reference_claude_mem_mcp_flakiness`.

## Top priorities (next session)

1. **next 16** (B-23 / PR #21) — **STAND-BY** fino a un driver (feature/perf next16 o EOL linea 15). ~2-3h.
2. **② AI P1 backfill** — gated su `VOYAGE_API_KEY` nel `.env` VM (azione Enzo); poi voyage-3.5 person→occupation + skill→skill. ~3-4h.
3. **F7 split/extract** (decisione Enzo) — split `SystemHealthDashboard` / extract `DashboardShell` (lib-owned → upstream `ux-design-shared`). ~2h.

## Open questions

- `VOYAGE_API_KEY` nel `.env` VM → sblocca ② AI P1 (azione Enzo).
- next 16: quale driver per uscire da STAND-BY?
- F7 split/extract: procedere o lasciare on-brand com'è?

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline      # vuoto = synced
cd apps/showcase && pnpm exec tsc -p tsconfig.json --noEmit       # verde (D-15 chiuso)
gh run list --limit 6                                            # main CI verde
```
