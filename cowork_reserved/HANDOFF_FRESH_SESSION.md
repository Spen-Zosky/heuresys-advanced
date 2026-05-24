# HANDOFF — Fresh Cowork Session Bootstrap

**Updated**: 2026-05-24 post-X18 close (MVP-2a CERTIFIED + MVP-3 6/6 Tappe shipped — Tappa F pragmatic close Path B+C)
**Purpose**: bootstrap minimale per una nuova sessione Cowork dopo che la precedente ha saturato il context.
**Reuse pattern**: aggiornare prima di chiudere ogni sessione lunga; nuova sessione legge SOLO questo file + i 2-3 file critici elencati sotto.

---

## §1 — Stato attuale (snapshot)

- **Progetto**: heuresys-advanced (D:\heuresys-advanced) — HRMS/BPM platform
- **Fase**: **MVP-2a CERTIFICATO + tag pushed** + **MVP-3 6/6 Tappe shipped** post-X18 (Tappa F pragmatic close Path B+C). `@heuresys/ui@0.1.1` PUBLISHED su npm registry pubblico (0.1.0 deprecated). apps/web admin core (40+ routes) builds OK con versioned dep. **KNOWN ISSUE deferred**: /showcase routes (apps/web/src/_disabled_showcase_X18) + apps/showcase static deploy hit Next.js 15 RSC bundle-threshold defect (`d.createContext is not a function` / `Class extends value undefined`) — emergent, NON single-component (12 bisect iter HALT-022-06 inconclusive). Proper fix deferred: Path A git bisect ux-design-shared commits / Path F split @heuresys/ui / Path E Next 16 upgrade.
- **Ultimo HEAD pushato**: `da8e9c9` (post-X18 housekeeping cleanup, pushed 2026-05-24T~22Z). Catena X18 completa su origin: `da8e9c9` (inbox cleanup) ← `230afb0` (release notes) ← `754fe35` (Block E MVP-3 Tappa F) ← cascade 022.x amendment. ux-design-shared HEAD `dfa2e81` (0.1.1 publish-ready) pushato anche su origin.
- **Tag**: `v0.2.1-mvp2a-final` (X16) + `v0.3.1-mvp3-final` (X18, target `754fe35`, SHA `a4dc2c3c`) **entrambi su origin**. GitHub releases LIVE: https://github.com/Spen-Zosky/heuresys-advanced/releases/tag/v0.2.1-mvp2a-final + https://github.com/Spen-Zosky/heuresys-advanced/releases/tag/v0.3.1-mvp3-final (published 2026-05-24T23:54:28Z, name "MVP-3 final", notes da `qa_artifacts/x18_mvp3_release_notes_v0.3.1.md`).
- **PROMPT in flight**: nessuno. PROMPT 022 cascade (022 → 022.1 → 022.2 → 022.3 → 022.4 → 022.5) all closed via REPORT 022 RESUMED-X18.5. Tappa F shipped pragmatic.
- **npm registry state**: `@heuresys/ui` org `@heuresys` (owner spen-zosky). 0.1.0 DEPRECATED, 0.1.1 latest. GAT bypass-2fa configured in `~/.npmrc` (R11: never log token value).
- **Loop CLI**: FERMO (cron disattivato S929, manual poll only)
- **REPORT history**: 017 (X13) · 018 (X14) · 019 (X15) · 020 (X16) · 021 (X17) · **022 (X18 Tappa F npm publish — 5 amendment cascade + 6 halt + 12 bisect iter, pragmatic close Path B+C)**

## §2 — Decisione attesa (C18) — per Enzo al risveglio

Post-X18, MVP-2a closed + MVP-3 6/6 Tappe shipped (A/B/C/D/E backend+UI/F-pragmatic/G). Tappa F **COMPLETATA pragmatic** 2026-05-24 (npm publish 0.1.1 + admin versioned migration). 3 direzioni residue + 1 deferred-fix.

| # | Opzione | Effort | Rationale |
|---|---|---|---|
| ~~A~~ | ~~gh release v0.2.1~~ | — | ✅ DONE C18 |
| ~~B~~ | ~~Tappa F npm publish~~ | — | ✅ **DONE X18 pragmatic** — 0.1.1 published, admin versioned, /showcase deferred |
| **DEFER-F** | **Fix /showcase RSC bundle-threshold defect** (re-enable apps/web/src/_disabled_showcase_X18 + apps/showcase static deploy) | 2-3h dedicated | Path A git bisect ux-design-shared (X16-era → dfa2e81) per isolare commit culprit / Path F split @heuresys/ui in subpackages / Path E Next 16 upgrade. Restore: `mv src/_disabled_showcase_X18 src/app/showcase` + rm tsconfig exclude. Vedi HALT-022-06 + CW-B59 |
| **C** | **Brownfield Wave 1 full-47k SQL-side upsert** | 2-3h | Tappa D known issue residual |
| **D** | **MFA login-gating** | 2-3h | Compose `mfaService.beginLoginChallenge` into auth.service.login() + `/login` UI 2-step |

**Next session entry-point**: leggi REPORT 022 RESUMED-X18.5 (full X18 saga + deferral plan) + bias_registry CW-B55/B56/B58/B59. Push X18 commits + tag richiede Enzo authorization (NON pushato).

Nuova sessione Cowork: **leggi questo file + i file di §3, poi chiedi all'utente DEFER-F/C/D**. NON procedere autonomamente.

## §3 — File da leggere SUBITO (priorità ordinata)

| # | Path | Righe | Perché |
|---|---|---:|---|
| 1 | `cowork_code_exchange/_04_REPORT_022_batch_x18.md` | ~134 | Last REPORT — X18 Tappa F saga (pre-halt sections, cascade documented in PROMPT 022.x amendment files) |
| 2 | `cowork_reserved/bias_registry.md` | ~150 | SoT 58 bias (CW-B17→B59), CW-B57 withdrawn, CW-B59 deferred-architectural, next CW-B60 |
| 3 | `qa_artifacts/x18_mvp3_release_notes_v0.3.1.md` | ~103 | MVP-3 final release notes (overview X18 saga + bias + DEFER-F deferral plan + next session candidates) |

**Solo se scelta è DEFER-F**: leggi anche `cowork_code_exchange/_01_PROMPT_022.4_batch_x18_amendment.md` (bisect procedure CLI executed) + `qa_artifacts/x18_4_bisect_iter_*.txt` (12 iter empirical evidence Next 15 RSC bundle threshold).

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
- **Bias**: 58 catalogati (CW-B17→B59 inclusi gap), 39 mitigated, **CW-B57 WITHDRAWN** (dual-package misdiagnosis — tsup auto-externalize deps by default), **CW-B59 deferred-proper-fix** (bisect methodology contamination + Next 15 RSC bundle threshold). X18 bias: CW-B55 (subpath consumer scan, C18.1) · CW-B56 (publish 2FA + org pre-flight, C18.2) · CW-B58 (outExtension/misdiagnosis-via-assumption, triple-reinforced) · CW-B59 (bisect contamination + RSC threshold). **CW-B58 lesson finale: empirical test matrix > narrative diagnosis** — applicata da CLI in self-check, NON Cowork-side (5 amendment cascade su hypothesis sbagliate).
- **Test suite**: 336/342 vitest (apps/api); **apps/web admin typecheck + build PASS con versioned @heuresys/ui@0.1.1 (40+ routes, X18 Path C)**; Playwright 124/125 X16 baseline. X18 Playwright auth.setup env-blocked (API :3001 + SSH tunnel :5433 non attivi in sessione CLI; build pass = primary gate).
- **DB live**: sys.* 60/134 populated (45%), legacy_mirror 116 tables, brownfield.table_mappings IMPORT + 14 REFERENCE_ONLY
- **MVP-2a state**: 40+ routes admin core (28 admin + 13 ESS + `/system-health`), 272 endpoints, 50 API integration tests, i18n parity 100% it/en, sys_users 433 NO REGRESSION
- **MVP-3 state**: A ✅ · B ✅ · C ✅ · D ✅ (47k residual) · E backend+UI ✅ · **F ✅ pragmatic (npm publish 0.1.1 + admin versioned; /showcase deferred DEFER-F)** · G ✅
- **@heuresys/ui npm**: published 0.1.1 (0.1.0 deprecated), org @heuresys owner spen-zosky, tsup dual ESM+CJS (.mjs/.cjs/.d.ts/.d.cts), exports 4 entries (`.` + 3 subpath preserved), tsup auto-externalizes ~85 deps by default (external list in config harmless-redundant). dist committed in ux-design-shared (no CI). **KNOWN ISSUE**: versioned dep breaks /showcase static page-data collection (Next 15 RSC bundle-threshold) — admin routes UNAFFECTED.
- **X18 deferred restore**: `mv apps/web/src/_disabled_showcase_X18 apps/web/src/app/showcase` + rm `src/_disabled_showcase_X18` from apps/web/tsconfig.json exclude, in DEFER-F session post root-cause fix.

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
