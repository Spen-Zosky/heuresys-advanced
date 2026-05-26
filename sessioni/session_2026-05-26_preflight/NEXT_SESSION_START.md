# Next Session Start — istruzioni operative per Enzo

**Generato**: 2026-05-26 (post sessione S933 CLOSED, tag `v0.3.3-preflight-partial` pushed)
**Repo state**: `D:\heuresys-advanced\` HEAD `1cd1f83`, sync `origin/main` 0/0, working tree pulito
**Purpose**: prompt **letterali** pronti da copia-incolla per iniziare la prossima sessione Cowork. Una opzione per scenario.

---

## Come usare questo file

1. Apri una nuova sessione Cowork sul folder `D:\heuresys-advanced\`.
2. **Scegli UNA delle opzioni A/B/C/D/E/F sotto** in base a cosa vuoi affrontare.
3. **Copia-incolla l'INTERO blocco PROMPT** della opzione scelta come PRIMO messaggio nella nuova sessione.
4. Cowork eseguirà il bootstrap obbligatorio (turn 1 ACK) e poi partirà nella direzione indicata.

**Note operative**:
- Tutti i prompt assumono **autonomy strict mode già autorizzata** (eredità dalla direttiva 2026-05-26). Se vuoi rivocare l'autonomia, indicalo esplicitamente.
- I prompt P0 (A/B/C) sono i 3 residual obbligatori prima di MVP-4.
- I prompt M/N (D-G) sono i 4 backlog pre-flight deferred (residual workshop, ognuno in mini-sessione dedicata).

---

## Opzione A — P0-2 CW-B60-A forensic engine silent-filter (CONSIGLIATA PRIMA)

**Effort stimato**: 2-3h · **Risk**: MED · **Razionale**: beneficia del logger structured CODE-1 appena shipped + è pure investigation (no architectural change).

```
Sono Enzo. Riprendo heuresys-advanced post sessione S933 (CLOSED, tag v0.3.3-preflight-partial pushed).

CONTESTO sessione fresh:
- HEAD `1cd1f83`, sync 0/0 origin/main, working tree pulito.
- Leggi PRIMA `cowork_reserved/HANDOFF_FRESH_SESSION.md` §0 (sessione S933 outcome) + §1.5 (next-session candidates) per allineamento totale.
- Plan + outcome S933 in `sessioni/session_2026-05-26_preflight/PREFLIGHT_REPORT.md`.

OBIETTIVO sessione: chiudere **P0-2 CW-B60-A forensic engine silent-filter**.

Contesto del bug:
- 3 target brownfield Wave 1 AUTO_APPROVED + 0 rows upserted senza alcun log o audit emit: `sys_skill_categories`, `sys_activity_classification_mappings`, `sys_process_kpi_templates`.
- Già rilevato da batch X19 (run `6f531559`) come residual cat (A) di CW-B60.
- CW-B49 fix (split-on-COALESCE upsert-sql.ts:661) NON copre questi 3 — c'è un secondo silent-filter ancora ignoto.
- Phase 3 CODE-1 ha appena sostituito 6 `console.error` con pino structured `logger.error` in `brownfield-wave-executor/{engine,upsert-sql}.ts` → ora diagnostic è più facile (structured fields phase + sub_phase + table_mapping_id).

OUTCOME atteso:
1. Riproduzione locale del silent-skip su 1 dei 3 target (sample run con DEBUG log level).
2. Root cause identification (dove nel codice c'è il filter che skip silently).
3. Fix engine: add explicit audit emit (rule_code candidato `SILENT_FILTER_DEEP_BUG_V1` o simile) + WARN log strutturato.
4. Unit test in `apps/api/test/upsert-sql-cw-b60-*.test.ts` (verifica audit row emitted).
5. Re-run sample → audit count non-zero attesto.
6. Optional: re-run Wave 1 completo se time permette.

VINCOLI:
- Autonomia piena (eredità S933).
- No --force / --no-verify (R12).
- Commit + push autorizzati pre-fix-verified.
- Mantieni invarianti I1-I14 (in particolare I5 no RLS, RD-08 no ENUM PG).
- Aggiorna `cowork_reserved/bias_registry.md` come CW-B61 quando fix shipped.

Procedi. Bootstrap turn 1 ACK obbligatorio prima di partire.
```

---

## Opzione B — P0-3 CW-B60-B Wave 2 / computed views scope ADR

**Effort stimato**: 2-3h · **Risk**: MED · **Razionale**: indipendente da P0-2, sblocca i 3 target rimanenti CW-B60 (scope-gap cat B).

```
Sono Enzo. Riprendo heuresys-advanced post sessione S933 (CLOSED, tag v0.3.3-preflight-partial pushed).

CONTESTO sessione fresh:
- HEAD `1cd1f83`, sync 0/0 origin/main, working tree pulito.
- Leggi PRIMA `cowork_reserved/HANDOFF_FRESH_SESSION.md` §0 + §1.5.
- Plan + outcome S933 in `sessioni/session_2026-05-26_preflight/PREFLIGHT_REPORT.md`.
- MVP-4 ROADMAP §2.1 (`docs/MVP_4_ROADMAP.md`) contiene già lo scope Wave 2.

OBIETTIVO sessione: chiudere **P0-3 CW-B60-B Wave 2 / computed views scope ADR**.

Contesto del problema:
- 3 target IMPORT classificati nelle table_mappings ma SENZA staging.wave1_* source corrispondente: `sys_blueprint_overrides`, `sys_position_learning_requirements`, `sys_position_skill_requirements`.
- Wave 1 NON ha mai estratto le source legacy corrispondenti.
- Decisione architetturale necessaria: (a) estendere Wave 2 per coprirli OR (b) implementarli come VIEW/MATERIALIZED VIEW computed da altre sys.* tabelle (analogo a PIP ADR-0008).

OUTCOME atteso:
1. Analysis: per ciascuno dei 3 target, definire se Wave 2 import vs computed view è più appropriato (motiva con dati semantica + uso downstream).
2. Scrivere ADR nuova (ADR-0019 o successivo libero) con decision: per target X scelgo Wave 2, per target Y scelgo computed view, per target Z scelgo Wave 2 + view fallback.
3. Implementazione minimal: se computed view → migration nuova `db/migrations/000044_*.sql` con view DDL; se Wave 2 → table_mapping + column_mappings staging spec per Wave 2 runner.
4. Aggiornare `cowork_reserved/bias_registry.md` come CW-B62 (cat B closure).
5. Aggiornare `docs/brownfield/wave_runners/wave_2_runner.md` se Wave 2 path scelta.

VINCOLI:
- Autonomia piena.
- Mantieni invarianti I1-I14 (I5 no RLS, I9 PIP=VIEW pattern, RD-08 no ENUM).
- Cross-ref ADR-0014 SDBI (potrebbe applicare), ADR-0008 (pattern view), ADR-0012 (wave column).
- Commit + push autorizzati.

Procedi. Bootstrap turn 1 ACK obbligatorio.
```

---

## Opzione C — P0-1 DEFER-F /showcase RSC bundle-threshold fix (HIGH RISK)

**Effort stimato**: 2-3h+ (potenzialmente molto più) · **Risk**: HIGH · **Razionale**: il più rischioso e isolato — admin routes UNAFFECTED, ma fix non triviale. Solo dopo P0-2 e P0-3 se preferisci ridurre il backlog HIGH-RISK.

```
Sono Enzo. Riprendo heuresys-advanced post sessione S933 (CLOSED, tag v0.3.3-preflight-partial pushed).

CONTESTO sessione fresh:
- HEAD `1cd1f83`, sync 0/0 origin/main, working tree pulito.
- Leggi PRIMA `cowork_reserved/HANDOFF_FRESH_SESSION.md` §0 + §1.5.
- PROMPT 025 X21 DEFER-F pending nell'inbox CLI dal 2026-05-25: `cowork_code_exchange/.inbox/cli/pending/2026-05-25T00-07-39Z__025__prompt_ready.md`.
- Bisect evidence X18: `qa_artifacts/x18_4_bisect_iter_1..12.txt` (12 iter inconclusive).
- CW-B59 catalogato (bisect contamination + Next 15 RSC bundle threshold).

OBIETTIVO sessione: chiudere **P0-1 DEFER-F /showcase RSC bundle-threshold proper fix**.

Stato pre-fix:
- `apps/web/src/_disabled_showcase_X18/` contiene 18 file page.tsx dei /showcase routes disabilitate al batch X18 per Path B+C workaround.
- Restoring queste page.tsx → Next 15 build fail su page-data collection (RSC bundle threshold defect, emergent multi-component).
- Workaround attuale: apps/showcase separato static export funziona ma admin /showcase routes via apps/web non più disponibili.

OUTCOME atteso (sceglie 1 Path e dichiara verbose):
- **Path A bisect**: continua bisect log X18 con metodologia migliorata (CW-B59 contamination fix) — incremental, può scoprire single-component trigger.
- **Path F split @heuresys/ui**: separa la lib in @heuresys/ui-core + @heuresys/ui-dashboard, importa solo subset in apps/web — riduce bundle surface.
- **Path E Next 16 upgrade**: aggiorna a Next 16 (in alpha?) che potrebbe avere fix RSC bundle handling — major bump rischioso.
- **Path G workaround consolidato**: accetta workaround corrente, documenta come architectural decision ADR (NON un fix vero, ma decision esplicita).

Time-box: 90 min su Path scelto → se non risolto, halt + propose Path successivo o Path G.

VINCOLI:
- HIGH-RISK: working tree può rompersi facilmente. Backup branch obbligatorio prima del lavoro (`git checkout -b deferf-attempt`).
- Mai mergiare su main senza verifica build apps/web + apps/showcase + Playwright admin smoke 5 personas verde.
- Autonomia piena MA halt se 2 Paths consecutivi falliscono.
- Aggiorna CW-B59 in `bias_registry.md` con outcome (mitigated o documented partial).

Procedi. Bootstrap turn 1 ACK obbligatorio.
```

---

## Opzione D — Pre-flight residual workshop (CODE-2/3/5/7/10 + i18n discovery)

**Effort stimato**: 5-8h · **Risk**: LOW · **Razionale**: cleanup workshop. Non bloccante per P0 ma utile per workspace pulito.

```
Sono Enzo. Riprendo heuresys-advanced post sessione S933 (CLOSED, tag v0.3.3-preflight-partial pushed).

CONTESTO sessione fresh:
- HEAD `1cd1f83`, sync 0/0 origin/main, working tree pulito.
- Leggi PRIMA `cowork_reserved/HANDOFF_FRESH_SESSION.md` §0 + `sessioni/session_2026-05-26_preflight/PREFLIGHT_REPORT.md` §4.

OBIETTIVO sessione: **pre-flight residual workshop** — chiudere i 5 items CODE deferred da Phase 3 + i18n discovery.

Items in scope:
- CODE-2: cleanup script dead `test:integration` + decidere openapi:generate (rimuovere o implementare scripts/generate-openapi.ts → apps/api/openapi.yaml)
- CODE-3: Tailwind 4 source-scan portability fix (`apps/web/src/app/globals.css:22` punta a `D:/ux-design-shared/ui/src` working copy locale; alternativa: pnpm-resolved path a node_modules/@heuresys/ui/dist; richiede test su Mac scenario)
- CODE-5: rimuovere `apps/web/src/_disabled_showcase_X18/` (18 file dead code) — SE DEFER-F è stato closed in altra sessione; altrimenti skip
- CODE-7: rimuovere script `test` dead da apps/web/package.json (no vitest config + no tests)
- CODE-10: i18n discovery — grep literal IT/EN strings in apps/web/src/**/*.tsx → estendere it/en common.json + verify pnpm i18n:check parity
- CODE-NEW-1: fix root scripts `pnpm typecheck` + `pnpm lint` per PowerShell wildcard compatibility (sostituire `--filter='@heuresys/*'` con pattern che funziona cross-shell)

OUTCOME atteso:
- Tutti 6 items shipped + typecheck/lint PASS + i18n parity verde
- Commit atomici per item
- Push finale + STATE.md refresh

VINCOLI:
- Autonomia piena
- Mantieni invarianti I1-I14
- Live-data doctrine preserved (no mock introduction)

Procedi. Bootstrap turn 1 ACK obbligatorio.
```

---

## Opzione E — SEC base (Dependabot 12 PR triage + qs verify + branch protection docs)

**Effort stimato**: 4-6h · **Risk**: LOW · **Razionale**: backlog security/dependencies. Value alto, non urgente.

```
Sono Enzo. Riprendo heuresys-advanced post sessione S933 (CLOSED, tag v0.3.3-preflight-partial pushed).

CONTESTO sessione fresh:
- HEAD `1cd1f83`, sync 0/0 origin/main, working tree pulito.
- Leggi PRIMA `cowork_reserved/HANDOFF_FRESH_SESSION.md` §0 + `sessioni/session_2026-05-26_preflight/PREFLIGHT_REPORT.md` §4 Phase 5.

OBIETTIVO sessione: chiudere **Phase 5 SEC base** (Dependabot triage + qs verify + branch protection docs).

Items in scope:
1. Verifica `gh --version` (GitHub CLI installato, autenticato)
2. Dependabot 12 PR triage:
   - Merge minor/patch groups (5 PR `dependabot/npm_and_yarn/minor-and-patch-*` + group)
   - Accept actions/setup-node-6 + pnpm/action-setup-6 + peaceiris/actions-gh-pages-4
   - Close duplicato `dependabot/npm_and_yarn/next-15.5.18` (mantieni 1)
   - Label `defer-major` + comment su `dependabot/npm_and_yarn/zod-4.4.3` (breaking changes)
3. `pnpm install -r` lockfile refresh post-merges
4. `pnpm audit --audit-level=moderate` clean check
5. `pnpm why qs` verify dual-resolution 6.15.1 vs 6.15.2 — cleanup se residual
6. Verifica auto-close CVE-2026-41907 (uuid) + #76 (qs) su GitHub Security tab
7. MFA_ENCRYPTION_KEY runtime check in `apps/api/src/config/env.ts` (verify presente come required)
8. Scrivere `docs/github/branch-protection.md` (canonical doc con stato server-side attuale + recommendations)

OUTCOME atteso:
- Dependabot backlog ≤2 PR (solo defer-major + eventuali review-needed)
- pnpm audit moderate = 0 vulnerabilities
- Branch protection docs in repo
- Commit atomici per categoria + push

VINCOLI:
- Autonomia piena
- Mai stampare token/secret/credentials (R11)
- No --force git, no --no-verify
- Se PR Dependabot CI fail → label `needs-review` + skip merge per quella PR

Procedi. Bootstrap turn 1 ACK obbligatorio.
```

---

## Opzione F — CI workflows + dual self-hosted runners (HIGH-EFFORT)

**Effort stimato**: 8-12h · **Risk**: MED · **Razionale**: setup infrastrutturale importante. Sblocca CI gates automatici per tutte future sessioni.

```
Sono Enzo. Riprendo heuresys-advanced post sessione S933 (CLOSED, tag v0.3.3-preflight-partial pushed).

CONTESTO sessione fresh:
- HEAD `1cd1f83`, sync 0/0 origin/main, working tree pulito.
- Leggi PRIMA `cowork_reserved/HANDOFF_FRESH_SESSION.md` §0 + `sessioni/session_2026-05-26_preflight/PREFLIGHT_REPORT.md` §4 Phase 6.
- Decisione utente 2026-05-26: "Entrambi (OCI VM primary + Windows backup)" self-hosted runners.

OBIETTIVO sessione: chiudere **Phase 6 CI workflows + dual self-hosted runners**.

Items in scope:
1. GitHub Actions registration token (ephemeral via `gh api -X POST /repos/Spen-Zosky/heuresys-advanced/actions/runners/registration-token`) — MAI loggare value
2. OCI VM runner install (PRIMARY):
   - SSH oracle-vm-default (80.225.82.207, key oci_recovery_ed25519)
   - Download actions/runner ARM64 + config + systemd service install
   - Labels: `self-hosted, oci-vm, linux, arm64`
3. Windows local runner install (BACKUP):
   - Install in `C:\Users\enzospenuso\actions-runner\`
   - Labels: `self-hosted, windows-fallback`
4. Workflow files in `.github/workflows/`:
   - `typecheck.yml` — matrix shared/api/web/showcase, GitHub-hosted ubuntu-latest
   - `lint.yml` — lint per workspace, GitHub-hosted
   - `i18n.yml` — pnpm i18n:check, GitHub-hosted
   - `test-integration.yml` — `runs-on: [self-hosted, oci-vm]` per access DB live no tunnel needed
   - `playwright.yml` — `runs-on: [self-hosted, oci-vm]` smoke 5 personas
5. Test workflow execution su feature branch + verify runner online
6. Commit + push

OUTCOME atteso:
- ≥1 workflow green su OCI VM runner + ≥1 su Windows backup
- Secrets non leaked nei log
- Branch protection può ora richiedere CI green pre-merge

VINCOLI:
- HIGH-EFFORT, multi-context (SSH + Windows service + GitHub API + workflow yaml)
- Mai loggare registration token / secrets
- Autonomia piena MA halt se setup runner OCI VM fallisce (network/auth issue → potrebbe richiedere intervento OCI security list)
- No modifiche pg_hba.conf / SSH config server-side senza ask

Procedi. Bootstrap turn 1 ACK obbligatorio.
```

---

## Opzione G — Sessione standard "mostrami stato + decidiamo"

**Per quando vuoi solo ri-aprire e decidere insieme cosa fare.**

```
Sono Enzo. Riprendo heuresys-advanced post sessione S933 (CLOSED, tag v0.3.3-preflight-partial pushed).

Leggi:
1. `cowork_reserved/HANDOFF_FRESH_SESSION.md` §0 + §1.5
2. `.handoff/STATE.md`
3. `sessioni/session_2026-05-26_preflight/PREFLIGHT_REPORT.md` §8 (raccomandazioni prossima sessione)

Poi:
- Stampa ACK bootstrap (turn 1)
- Sintesi stato in 4-6 righe
- Lista 3-5 opzioni operative per questa sessione (con effort + risk per ognuna)
- Aspetta mia scelta

Niente azione autonoma prima della mia decisione.
```

---

## Convenzione

- Tutti i prompt assumono che il working tree sia pulito e sync con origin (verificato post S933).
- Se per qualche motivo il tree NON è pulito (es. hai fatto modifiche locali dopo S933), aggiungi `STATO LOCALE: working tree NON pulito, ho modificato X file. Verifica con git status prima di iniziare.` come riga aggiuntiva al prompt.
- Tutti i prompt rispettano R1-R17 + I1-I14 + CW1-CW3 (heredita).
- Tutti i prompt rispettano R12 git safety (no `--force`, no `--no-verify`, no DROP DATABASE).

---

## Reference rapidi

- **HEAD attuale**: `1cd1f83`
- **Tag attuale**: `v0.3.3-preflight-partial`
- **HANDOFF Cowork**: `cowork_reserved/HANDOFF_FRESH_SESSION.md` §0 (sessione S933 outcome) + §1.5 (next-session candidates)
- **STATE operativo**: `.handoff/STATE.md`
- **Forensic doc**: `sessioni/session_2026-05-26_forensic-state-of-the-art/FORENSIC_STATE_OF_ART_2026-05-26.md`
- **Pre-flight plan**: `sessioni/session_2026-05-26_forensic-state-of-the-art/PREFLIGHT_PLAN_2026-05-26.md`
- **Pre-flight report**: `sessioni/session_2026-05-26_preflight/PREFLIGHT_REPORT.md`
- **MVP-4 roadmap**: `docs/MVP_4_ROADMAP.md`
- **Wave runners**: `docs/brownfield/wave_runners/wave_{2,3,4}_runner.md`

---

*NEXT_SESSION_START — 2026-05-26 Cowork session S933 closure deliverable*
