# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-07-23 (S1028 — batch full-autonomy: 12 item chiusi + Dependabot avviato).

> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`.

## Last session brief (S1028)

Mandato Enzo "procedi con tutti in autonomia": batch end-to-end sul menu completo.
Chiusi i 2 P1 (coerenza per-user 5 dimensioni; engagement history D2 con regression
flight-risk LIVE), 5 P2 (G3 integrità, B7 observability, G1 retention con DB -39%,
D3 verificato già-fatto, F5 self-view ESS con ADR-0031) e 4 P3 (NACE deprecato via
000211, G5 archivio script, GET broadcast-audit, teams lifecycle con team:manage).
Dependabot: next patch MERGED, corsia low-risk lasciata ai check, 4 major deferiti.
Un solo pattern d'errore ricorrente: note register stale su lavoro già fatto (D2
core, D3) — sempre misurare prima di stimare.

## ⚠ Top priorities (next session)

1. **#66 Dependabot residuo** (~0.5-1h, P3) — verificare la corsia low-risk (#52/#44/#40/#50: merge se verdi, altrimenti diagnosi) e mergiare i 4 MAJOR presidiati (#47 rate-limit 11, #43 dotenv 17, #46 @types/node 26, #34 fastify-plugin 6 — check `skipping` da capire) con retest locale post-merge; poi `pnpm install` dal lockfile aggiornato.
2. **#49 D/D5 — employee timeline** (~1-1.5 sessioni, P2) — primo item "grande" della coda batch; doc linea D §D5.
3. **#36 B5 / #37 B2 / #38 B6** (~4-8h ciascuno, P2/P3) — visualization export · reward-gate sui 121 variable-pay · inbox SSE.

## Open questions (autorità *cosa* = Enzo)

- **Wave-3 (#17)** — sblocca il Blocco E Fase 3 (#69). In HOLD.
- **Crosswalk ISCO↔CP2021** — tabella pronta ma vuota: serve la corrispondenza ufficiale Istat.
- WAIT-INPUT invariati: **#4** pricing · **#8** app-password Outlook · **#16** SuccessFactors · **#52** SSO IdP.

## Verification (next session)

```bash
git log origin/main..HEAD --oneline               # 0 dopo il push handoff
python docs/kb/tools/handoff_lint.py              # OK atteso
ls db/migrations/*.sql | tail -1                  # 000214
gh pr list --state open                           # residuo Dependabot (major + eventuali low-risk)
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT pg_size_pretty(pg_database_size(current_database()))"  # ~841 MB (G1)
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT count(*) FROM sys.sys_pulse_checks"  # 2834 (D2)
python docs/kb/tools/session_start.py             # menu + salute
```
