# HANDOFF — Fresh Cowork Session Bootstrap

**Updated**: 2026-05-23 post-X13 close
**Purpose**: bootstrap minimale per una nuova sessione Cowork dopo che la precedente ha saturato il context.
**Reuse pattern**: aggiornare prima di chiudere ogni sessione lunga; nuova sessione legge SOLO questo file + i 2-3 file critici elencati sotto.

---

## §1 — Stato attuale (snapshot)

- **Progetto**: heuresys-advanced (D:\heuresys-advanced) — HRMS/BPM platform
- **Fase**: MVP-2a **acceptance-criteria-complete** post-X13. Pivot Path C concluso. Next: SDBI Q4 closure OR MVP-3 finalization OR MVP-2b hardening (Cowork C14 decide).
- **Ultimo batch CLI**: **X13 Coverage Hardening Sprint** (REPORT 017 chiuso, commit locale `main`, NO push)
- **PROMPT in flight**: nessuno (PROMPT 017 chiuso da REPORT 017)
- **Loop CLI**: FERMO (cron `00106625` cancellato S929). Manual poll only.
- **Cowork scheduled task**: `cowork-watchdog-poll-inbox` cron disattivato (decisione utente S929)
- **REPORT 017**: prodotto, in `cowork_code_exchange/_04_REPORT_017_batch_x13.md`

## §2 — Decisione attesa (cosa fare al bootstrap)

X13 ha shippato. Il prossimo passo dipende da quale direzione l'utente vuole prendere:
- **A**. **C14 = SDBI closure (Q4 data flow)** — resume brainstorming da Q4 (mia racc: opzione (a) full brownfield engine + `SYNTHETIC_AI_GENERATED` flag)
- **B**. **C14 = MVP-2a final live validation** — eseguire full Playwright + `pnpm build` apps/web in dev session, certificare i 2 acceptance items deferred-executable di X13
- **C**. **C14 = MVP-3 finalization** — re-open Tappe B/F/E-UI (gated brand identity v1, ora disponibile)
- **D**. **C14 = MVP-2b ESS hardening** — extend `/me/*` mutations e workflow (low priority — ESS coverage già FULL in X13 matrix)

Nuova sessione Cowork: **leggi questo file + i 3 file di §3, poi chiedi all'utente A/B/C/D**. NON procedere autonomamente.

## §3 — File da leggere SUBITO (priorità ordinata)

| # | Path | Righe | Perché |
|---|---|---:|---|
| 1 | `cowork_reserved/bias_registry.md` | ~140 | SoT 53 bias catalogati (CW-B17→B53), next CW-B54 |
| 2 | `.handoff/STATE.md` | ~50 | Live state X13 close (snapshot stack + deltas) |
| 3 | `cowork_code_exchange/_04_REPORT_017_batch_x13.md` | ~250 | Last REPORT chiuso (X13 outcome + next direction) |

**NON leggere** subito (consultare on-demand):
- `cowork_reserved/COWORK_CLI_PROMPT_PATTERN.md` (pattern memo §1-§19, 25 anti + 26 vincenti — solo se serve scrivere PROMPT nuovo)
- `cowork_code_exchange/_04_REPORT_015_batch_x11.md` (~400 righe, già processato, summary in bias_registry CW-B50/B51)
- Batch precedenti `cowork_reserved/batch_c[1-11]/` (archive)

## §4 — Vincoli operativi non-negotiable (heredita)

- **CARD-4 / I-1 NO MOCK**: dati live e2e via Prisma/pg, mai placeholder. Vedi CLAUDE.md root §REGOLA NON NEGOZIABILE
- **R20 Feasibility 5-Q**: prima di dichiarare "non eseguibile" applica i 5 criteri (Grep concreto / token budget / pattern repetitivity / test coverage / risk register). Mai opinione travestita da valutazione
- **Decision Authority**: Enzo decide chiusura/interruzione. Cowork formula proposte evidence-based con budget+rischi, non veti
- **R11 Secret hygiene**: mai loggare password/key/token/connection string
- **I13 PostgreSQL 16 NATIVE no Docker** + **I5 tenant via FK+middleware no RLS** + **I7 auth separato sys.sys_auth_***
- **Halt+escalate**: solo per P0 via `cowork_code_exchange/.inbox/cowork/pending/<TS>_<goalid>_halt_<reason>.md`

## §5 — Engine state snapshot

- **17 transform codes** in registry: DIRECT_COPY · CAST_TIMESTAMPTZ · CAST_VARCHAR · CAST_ENUM · TRIM · LINEAGE_SOURCE_NK · JSON_EXTRACT · LOOKUP_FK · LOOKUP_FK_2HOP · (8 altri)
- **18 ADR accepted**, key: 0014 SDBI · 0015/0016 nullable FK · 0017 LOOKUP_FK_2HOP · 0018 COALESCE-UQ class-of-bug
- **42 migrations applied** (unchanged X11→X13)
- **Test suite**: 336/342 vitest (apps/api) post-X10; web typecheck PASS X13; `playwright --list` 125 tests in 19 files post-X13
- **DB live**: sys.* 60/134 populated (45%), legacy_mirror 116 tables, brownfield.table_mappings IMPORT + 14 REFERENCE_ONLY (post-X11 reclass)
- **CW-B49 fix shipped X10**: `apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts:661` (split-on-COALESCE → parenthesis-depth-aware helper)
- **MVP-2a state**: 41 routes (28 admin + 13 ESS, +1 admin `/system-health` = 29 admin counted live), 272 endpoints, 50 API integration tests, **18 E2E spec files / 125 runtime tests**, i18n parity 100%, axe ruleset extended (live full sweep deferred to dev session)

## §6 — Lessons from session that saturated (apply going forward)

| Lesson | Mitigation |
|---|---|
| Read REPORT integrali consuma 5-8% context cadauno | Leggere solo §0 pre-conditions + §<bias updates> + §<next step>, full read solo se serve azione mirata |
| PROMPT > 80 righe sature troppo | Split: PROMPT principale 60 righe + ALLEGATO.md letto solo da CLI |
| Scheduled task watchdog ogni 15 min consuma context Cowork | Switch a on-demand poll trigger esplicito utente, NON recurring |
| Sessioni > 60 turni con artifact > 100 righe → saturazione lineare | A turno 50 proporre `/compact` o split sessione |
| Autonomia continua senza checkpoint utente → no recovery quando context si esaurisce | Almeno 1 checkpoint utente ogni 3-4 batch decision autonome |

## §7 — Connectivity prerequisites (verifica al bootstrap)

```bash
# SSH tunnel a OCI VM (porta 5433 → 5432)
ssh -fN -L 5433:localhost:5432 oracle-vm-default

# Smoke DB
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT NOW()"

# Verifica symlink @heuresys/ui
readlink -f D:/heuresys-advanced/node_modules/@heuresys/ui  # deve dare /d/ux-design-shared/ui
```

## §8 — Output: prima risposta nuova sessione

Dopo aver letto §1-§5, rispondi:
1. ACK + 3-righe sintesi stato
2. Domanda A/B/C su §2
3. Aspetta decisione utente

**Niente** strategic analysis, **niente** PROMPT nuovo, **niente** azione autonoma prima della risposta utente.

---

*End HANDOFF — aggiornare prima di chiudere ogni sessione lunga.*
