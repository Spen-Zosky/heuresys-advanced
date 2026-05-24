# HANDOFF — Fresh Cowork Session Bootstrap

**Updated**: 2026-05-24 post-X17 close (MVP-2a CERTIFIED + MVP-3 5/6 Tappe shipped)
**Purpose**: bootstrap minimale per una nuova sessione Cowork dopo che la precedente ha saturato il context.
**Reuse pattern**: aggiornare prima di chiudere ogni sessione lunga; nuova sessione legge SOLO questo file + i 2-3 file critici elencati sotto.

---

## §1 — Stato attuale (snapshot)

- **Progetto**: heuresys-advanced (D:\heuresys-advanced) — HRMS/BPM platform
- **Fase**: **MVP-2a CERTIFICATO + tag pushed** + **MVP-3 5/6 Tappe shipped** post-X17. Playwright 124/125 (99.2%) X16 baseline + 1 shell contract fix isolated PASS (X16b). Tag `v0.2.1-mvp2a-final` su origin remote (pushed X16 sequence). MVP-3 chain post-tag: X16b shell fix + Tappa B Mermaid + Tappa E-UI TOTP enrollment all shipped/pushed.
- **Ultimo HEAD pushato**: post-X17 commit (vedi `git log --oneline -1`)
- **Tag pushato**: `v0.2.1-mvp2a-final` annotated, target `75baf54` (X16). Release notes file `qa_artifacts/x17_release_notes_v0.2.1.md` shipped X17. **GitHub release create P1 deferred** (gh CLI not authenticated) — manual command for Enzo: `gh release create v0.2.1-mvp2a-final --notes-file qa_artifacts/x17_release_notes_v0.2.1.md --title "MVP-2a final certification"`.
- **PROMPT in flight**: nessuno. PROMPT 021 X17 closed (REPORT 021). DRAFT PROMPT 022 (Tappa F npm publish, ~145 lines) ready in `cowork_code_exchange/_00_DRAFT_PROMPT_021_batch_x17_tappa_f.md` — needs 4 Enzo decisions before promotion.
- **Loop CLI**: FERMO (cron disattivato S929, manual poll only)
- **Cowork scheduled task**: `cowork-watchdog-poll-inbox` cron disattivato (decisione utente S929)
- **REPORT history**: 017 (X13 hardening) · 018 (X14 dev mode) · 019 (X15 E2E vs prod) · 020 (X16 final certification) · **021 (X17 D+B combo, CW-B52 recurrence)**

## §2 — Decisione attesa (C18) — per Enzo al risveglio

Post-X17, MVP-2a closed + MVP-3 5/6 Tappe shipped (A/B/C/D/E backend+UI/G), solo Tappa F pending. Per REPORT 021 §7, 4 direzioni valide.

| # | Opzione | Effort | Rationale |
|---|---|---|---|
| **A** | **Enzo: complete `gh release create v0.2.1-mvp2a-final`** | ~5 min manual | Close P1 deferred X17 (gh CLI auth + create release page) |
| **B** | **MVP-3 Tappa F — @heuresys/ui npm publish** | 2-3h | DRAFT PROMPT 022 ready (`_00_DRAFT_PROMPT_021_batch_x17_tappa_f.md`), needs 4 decision answers (naming / build target / version / migration). Closes last MVP-3 tappa not shipped |
| **C** | **Brownfield Wave 1 full-47k SQL-side upsert** | 2-3h | Tappa D known issue residual, dedicated session per memoria `project-mvp3-session-state` |
| **D** | **MFA login-gating** | 2-3h | Compose `mfaService.beginLoginChallenge` into auth.service.login() + `/login` UI 2-step. Completes Tappa E full scope (frontend enroll shipped X17 Tappa E-UI a0d4545) |

**Recommended**: A (~5 min Enzo) → then B (CLI batch X18 with PROMPT 022 formalized). C/D possono interleave per priority.

Nuova sessione Cowork: **leggi questo file + i 3 file di §3, poi chiedi all'utente A/B/C/D**. NON procedere autonomamente.

## §3 — File da leggere SUBITO (priorità ordinata)

| # | Path | Righe | Perché |
|---|---|---:|---|
| 1 | `cowork_code_exchange/_04_REPORT_021_batch_x17.md` | ~210 | Last REPORT — X17 D+B combo + CW-B52 recurrence detection + C18 options |
| 2 | `cowork_reserved/bias_registry.md` | ~140 | SoT 54 bias (CW-B17→B54), next CW-B55 |
| 3 | `cowork_code_exchange/_00_DRAFT_PROMPT_021_batch_x17_tappa_f.md` | ~215 | Solo se scelta è B (Tappa F npm publish) — bozza CLI con 4 decisioni da risolvere |

**NON leggere** subito (consultare on-demand):
- `cowork_reserved/COWORK_CLI_PROMPT_PATTERN.md` (pattern memo — solo se serve scrivere PROMPT nuovo)
- REPORT 015/017/019 (già processati, info essenziali in registry + STATE)
- Batch precedenti `cowork_reserved/batch_c[1-13]/` (archive)

## §4 — Vincoli operativi non-negotiable (heredita)

- **CARD-4 / I-1 NO MOCK**: dati live e2e via Prisma/pg, mai placeholder. Vedi CLAUDE.md root §REGOLA NON NEGOZIABILE
- **R20 Feasibility 5-Q**: prima di dichiarare "non eseguibile" applica i 5 criteri (Grep concreto / token budget / pattern repetitivity / test coverage / risk register). Mai opinione travestita da valutazione
- **R10 No-hallucination**: se manca contesto (S929 brainstorming, opzione (a)/(b)/(c) referenti), dichiarare apertamente e leggere file mancanti prima di emettere PROMPT
- **Decision Authority**: Enzo decide chiusura/interruzione. Cowork formula proposte evidence-based con budget+rischi, non veti. **Delega su stato stale = non vincolante** — re-confermare su baseline corretta
- **R11 Secret hygiene**: mai loggare password/key/token/connection string
- **I13 PostgreSQL 16 NATIVE no Docker** + **I5 tenant via FK+middleware no RLS** + **I7 auth separato sys.sys_auth_***
- **Halt+escalate**: solo per P0 via `cowork_code_exchange/.inbox/cowork/pending/<TS>_<goalid>_halt_<reason>.md`

## §5 — Engine state snapshot (post-X17)

- **17 transform codes** (DIRECT_COPY · CAST_TIMESTAMPTZ · CAST_VARCHAR · CAST_ENUM · TRIM · LINEAGE_SOURCE_NK · JSON_EXTRACT · LOOKUP_FK · LOOKUP_FK_2HOP · +8)
- **18 ADR accepted** (0014 SDBI · 0015/0016 nullable FK · 0017 LOOKUP_FK_2HOP · 0018 COALESCE-UQ)
- **Migrations applied**: 42 (last X13)
- **Bias**: 54 catalogati (CW-B17→B54), 35 mitigated, next CW-B55. **CW-B52 recurrence in X12/X13/X17** — pattern strutturale al cycle Cowork-side ↔ CLI autonomous flow; structural mitigation = HANDOFF refresh obligatorio per ogni CLI batch (lesson appresa X14-X16, applied X17)
- **Test suite**: 336/342 vitest (apps/api); web typecheck PASS; **Playwright 124/125 (99.2%) in 5.1m vs prod build** (X16) + shell contract X16b isolated PASS
- **DB live**: sys.* 60/134 populated (45%), legacy_mirror 116 tables, brownfield.table_mappings IMPORT + 14 REFERENCE_ONLY
- **MVP-2a state**: 41 routes (28 admin + 13 ESS, +1 admin `/system-health`), 272 endpoints, 50 API integration tests, 19 spec files (18 spec + mfa-enroll.spec.ts) / ~58 literal `test()` / 127+ runtime via `--list`, i18n parity 100% it/en, axe ruleset extended (+1 employee `/me/security`), sys_users 433 NO REGRESSION
- **MVP-3 state**: A ✅ · B ✅ (Mermaid renderer in `/visualizations/[graphId]` via `@heuresys/ui`) · C ✅ · D ✅ (47k known issue residual) · E backend ✅ + UI ✅ (`/me/security` TOTP enrollment shipped X17 commit `a0d4545`; login-gating composing pending) · F ⏳ (DRAFT PROMPT 022 ready) · G ✅
- **Showcase env-gate**: `NEXT_PUBLIC_ENABLE_SHOWCASE=1` burn-in CONFIRMED via runtime HTTP smoke (canonical test; findstr inadequate per pattern memo §22 candidate)

## §6 — Lessons (apply going forward)

| Lesson | Mitigation |
|---|---|
| Read REPORT integrali consuma 5-8% context cadauno | Leggere solo §0 pre-conditions + §<bias updates> + §<next step>, full read solo se serve azione mirata |
| PROMPT > 80 righe sature troppo | Split: PROMPT principale 60 righe + ALLEGATO.md letto solo da CLI |
| Scheduled task watchdog recurring consuma context Cowork | On-demand poll trigger esplicito utente, NON recurring |
| Sessioni > 60 turni con artifact > 100 righe → saturazione lineare | A turno 50 proporre `/compact` o split sessione |
| Autonomia continua senza checkpoint utente → no recovery quando context si esaurisce | Almeno 1 checkpoint utente ogni 3-4 batch decision autonome |
| **HANDOFF non aggiornato dopo CLI batch in autonomia → Cowork riparte su stato stale** | Ogni batch CLI deve aggiornare HANDOFF_FRESH_SESSION.md §1 + §2 + §3 nel proprio §5 Block D, non solo `.handoff/STATE.md` |
| **Burn-in `NEXT_PUBLIC_*` findstr in chunks = false-negative** | Next.js inlines values, not names. Canonical burn-in = HTTP smoke su gated route |

## §7 — Connectivity prerequisites (verifica al bootstrap)

```bash
ssh -fN -L 5433:localhost:5432 oracle-vm-default
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT NOW()"
readlink -f D:/heuresys-advanced/node_modules/@heuresys/ui  # deve dare /d/ux-design-shared/ui
```

## §8 — Output: prima risposta nuova sessione

Dopo aver letto §1-§5, rispondi:
1. ACK + 3-righe sintesi stato (MVP-2a CERTIFIED post-X16, 124/125 PASS, tag locale)
2. Domanda A/B/C/D su §2 (con nota delega stale)
3. Aspetta decisione utente

**Niente** strategic analysis, **niente** PROMPT nuovo, **niente** azione autonoma prima della risposta utente.

---

*End HANDOFF — aggiornare prima di chiudere ogni sessione lunga. **Lezione X14-X16**: ogni REPORT CLI deve includere "HANDOFF refresh" come Block D obbligatorio.*
