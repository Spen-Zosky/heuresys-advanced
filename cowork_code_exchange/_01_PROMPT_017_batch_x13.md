# PROMPT 017 — CLI Batch X13 (MVP-2a Coverage Hardening Sprint)

**Protocol**: Cowork↔CLI v2.2 semplificato
**Scope**: post-X12 MVP-2a quality hardening — E2E coverage matrix + spec gap-fill + i18n/a11y sweep + HANDOFF refresh
**Expected duration**: 4-5h CLI
**Authored**: 2026-05-23T21:00Z by Cowork (batch C13, post-REPORT 016 chiusura)
**Predecessor**: REPORT 016 X12 MVP-2a Phase 0 audit refresh v2.0 (`_04_REPORT_016_batch_x12.md`)
**Watchdog status**: `cowork-watchdog-poll-inbox` DISATTIVATO (decisione utente). Loop CLI manuale.

---

## §0 — Identity + role + commitments + CW-B52 mitigation

You are Claude Code CLI on Windows. Cowork C13 raccoglie raccomandazione **REPORT 016 §10**: Coverage Hardening Sprint per portare MVP-2a da "strutturalmente completo" (41 pagine, 272 endpoint, 50 test API, 17 E2E spec) a "acceptance-criteria-complete" per `NEXT_SESSION_MVP_2A.md` §5.

### CW-B52 pre-flight mitigation (MANDATORY before §1)

Prima di qualsiasi authoring o decisione di scope, esegui live-state validation:

```bash
cd D:\heuresys-advanced && git log --oneline -5  # verifica HEAD vs Cowork model
find apps/web/tests/e2e -name "*.spec.ts" | wc -l   # spec files count
find apps/web/tests/e2e -name "*.spec.ts" | xargs grep -c "^  test(\|^test(" | awk -F: '{s+=$2} END {print s}'  # test() calls totali
find apps/web/src/app -name "page.tsx" | wc -l       # pagine shipped
```

**Atteso al momento dell'authoring**: HEAD `0d81a57`, 17 spec files, ~84 test() calls, 63 page.tsx. Se diverge significativamente, **HALT con motivazione** prima di procedere oltre §1.

**Commitments**:
- Read PROMPT + REPORT 016 + `docs/api/MVP_2A_API_GAP_AUDIT.md` v2.0 §J/§K + `NEXT_SESSION_MVP_2A.md` §5
- Execute 4 blocchi A/B/C/D in serie
- REPORT 017 + commit atomico bundle "X13 Coverage Hardening Sprint"
- **NO inbox notify** (watchdog disattivato — Enzo polla manualmente)

---

## §1 — Capability hints

### Subagent delegation raccomandata

| Sotto-task | Subagent | Model | Razionale |
|---|---|---|---|
| Block A coverage matrix authoring | `Explore` | sonnet | structured scan E2E spec files |
| Block B spec gap-fill (write tests) | `general-purpose` | sonnet | code authoring + Playwright patterns |
| Block C i18n parity + axe sweep run | inline main | haiku | comandi atomici |
| Block D HANDOFF refresh | inline main | sonnet | sintesi cross-source |

### Context budget

Estimate ~60% per intero ciclo. Considera `/compact` post-Block B se context >75%.

### Model tiering

- Main orchestrator: Opus 4.7
- Subagent default: Sonnet 4.6
- Atomic grep/list/lint: Haiku 4.5

---

## §2 — Pre-flight

```bash
# Connectivity
ssh -fN -L 5433:localhost:5432 oracle-vm-default
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT NOW()"

cd D:\heuresys-advanced && git log --oneline -3
readlink -f node_modules/@heuresys/ui  # /d/ux-design-shared/ui

# Baseline tests (NON deve regredire)
cd apps/api && pnpm exec vitest run 2>&1 | tail -5  # 336/342 baseline X10
cd ../web && pnpm exec playwright test --list 2>&1 | tail -10  # enumerare test esistenti

# i18n + a11y tooling check
cd ../.. && pnpm i18n:check 2>&1 | tail -10  # se script esiste
```

Halt P0 se: tunnel down dopo 2 tentativi, baseline vitest regression > 5 fail, symlink @heuresys/ui broken.

---

## §3 — Block A: E2E coverage matrix (1-2h)

### Step A.1 — Enumera spec esistenti

Per ogni file in `apps/web/tests/e2e/*.spec.ts`:
- count test() calls (grep `^test(` + `^  test(`)
- list assertion patterns (`page.goto`, `expect(page.locator(...))`, `toHaveText`, `toBeVisible`)
- mappa ciascun test alle pagine `/admin/*` o `/me/*` coperte

### Step A.2 — Per-route coverage table

Tabella 41-row × 5-col:

| Page route | Spec file | Test name | Persona | Assertion type |
|---|---|---|---|---|
| /admin/users | admin-lists.spec.ts | "users list renders" | admin@heuresys.com | toHaveText |
| /me/skills | me-pages.spec.ts | "skills self-assessment" | employee_test | toBeVisible |
| ... | ... | ... | ... | ... |

### Step A.3 — Gap identification

Per ciascuna delle 41 page (28 admin + 13 ESS):
- Coverage `FULL` (≥1 test() call con persona + assertion data)
- Coverage `SMOKE` (solo navigation, no data assertion)
- Coverage `NONE` (no test point a questa route)

Output: `qa_artifacts/x13_e2e_coverage_matrix.md`.

### Acceptance Block A

- ✅ Matrix 41-row completata
- ✅ NONE / SMOKE count identificati (target Block B: portare NONE→SMOKE o FULL)

---

## §4 — Block B: Spec gap-fill (2-3h)

### Step B.1 — Priorità

Da Block A, lista routes con coverage `NONE` o `SMOKE-only`. Priorità:
1. ESS routes prima (più probabili user-facing critical paths)
2. Admin domini con governance (users, tenants, roles, system-health)
3. Pagine `[id]` dynamic routes (più probabili regression vector)

### Step B.2 — Authoring nuovi test

Pattern canonico (NEXT_SESSION_MVP_2A.md §4.2):
- import auth helper (`storageState`)
- `test.describe('<route>', () => {...})`
- ≥1 happy path con persona seeded (`admin@heuresys.com` / `Admin#PassW0rd!` o appropriate persona)
- ≥1 data assertion (no smoke-only)
- NO mock data, dati live via API real

Aggiungere a file spec esistente per dominio coerente, o nuovo file `<domain>.spec.ts` se nuovo dominio.

### Step B.3 — Run

```bash
cd apps/web && pnpm exec playwright test 2>&1 | tail -20
```

Tutti i test devono passare. Se fallisce per data assumption (es. seed non popolata), correggere il test (usare query API real per discovery, non hard-code IDs).

### Acceptance Block B

- ✅ Coverage `NONE` ridotto a 0
- ✅ Tutti i Playwright test passano
- ✅ Total test() calls >= 40 (NEXT_SESSION §5 acceptance target — chiarito durante Block A se "specs" = files o test() calls)

---

## §5 — Block C: i18n + a11y sweep (~2h, parallel)

### Step C.1 — i18n parity check

```bash
cd D:\heuresys-advanced && pnpm i18n:check 2>&1 | tee qa_artifacts/x13_i18n_report.txt
```

Se script non esiste: identificare locale files in `apps/web/src/messages/` o equivalent, fare diff key-set tra `it.json` e `en.json` (se entrambi presenti), produrre report missing keys.

Target: **100% parity** (acceptance NEXT_SESSION §5).

### Step C.2 — axe-playwright a11y sweep

Usa `showcase-a11y.spec.ts` come riferimento pattern. Estendi sweep a tutte le 41 page (admin + ESS).

```bash
cd apps/web && pnpm exec playwright test a11y 2>&1 | tee ../../qa_artifacts/x13_a11y_report.txt
```

Target: **zero-critical** axe violations.

### Step C.3 — Fix iterativi

Per ogni violation critical:
- Identifica componente in `@heuresys/ui` o `apps/web/src/components/`
- Se UI primitive: fix in `D:\ux-design-shared\ui` (cross-repo commit separato)
- Se page-specific: fix in `apps/web/src/app/...`

### Acceptance Block C

- ✅ i18n parity 100% (it ≡ en, no missing keys)
- ✅ axe zero-critical su 41 page (warnings accettabili, critical = block)
- ✅ Report files committed in `qa_artifacts/`

---

## §6 — Block D: HANDOFF refresh (30min)

### Step D.1 — Sources

- `HANDOFF.md` (root, currently stale post-X10 — vedi sezione "===APRI LA SESSIONE COSI'===")
- `.handoff/STATE.md` (aggiornato da Enzo commit `0d81a57` "handoff S929")
- `cowork_reserved/HANDOFF_FRESH_SESSION.md` (Cowork-side, mention REPORT 016 mancante — anch'esso stale)

### Step D.2 — Reconcile

Aggiorna **HANDOFF.md root** con:
- Stato MVP-1: 11/22 → effective shipped count
- Stato MVP-2a: "strutturalmente completo" (41 pagine, 272 endpoint, 17→N spec post-X13)
- Stato MVP-2b ESS: 13 pagine + endpoint shipped
- Next milestone: per CLI raccomandazione post-X13 (MVP-3 kickoff o quality finalization)

Aggiorna anche `cowork_reserved/HANDOFF_FRESH_SESSION.md` §1 (snapshot stato) per evitare future-sessions confusion.

### Acceptance Block D

- ✅ HANDOFF.md root rappresenta HEAD `<post-X13-commit>` accurate
- ✅ Bias registry CW-B52 status updated (mitigated → preventive: pattern memo §20 update se non ancora fatto)

---

## §7 — Halt triggers P0

| Trigger | File pattern | Severity |
|---|---|---|
| Live state divergence significativa (§0 pre-flight) | `state_drift_x13` | P0 |
| baseline vitest regression >5 fail | `test_regression_x13` | P0 |
| Playwright suite breaks (>5 nuovi fail) durante Block B | `e2e_regression_x13` | P0 |
| symlink @heuresys/ui broken | `ui_symlink_broken` | P0 |
| axe critical violation > 10 (effort overflow) | `a11y_overflow` | P1 |
| i18n missing keys > 50 (scope explosion) | `i18n_overflow` | P1 |
| ANY sys_users count regression | `r_a2_regression` | **P0 CRITICAL** |

**Halt protocol**: file `cowork_code_exchange/.inbox/cowork/pending/<TS>_017_halt_<reason>.md` con dettaglio. Cowork watchdog disattivato → Enzo polla manualmente, ma file lasciato per audit trail.

---

## §8 — REPORT format

`cowork_code_exchange/_04_REPORT_017_batch_x13.md`. Structure:

```
§0 Pre-conditions + CW-B52 pre-flight outcome
§1 Block A coverage matrix outcome (41-row table summary, NONE/SMOKE/FULL counts)
§2 Block B spec gap-fill outcome (new tests added, total test() count post-X13)
§3 Block C i18n parity report (missing keys closed)
§4 Block C axe a11y report (critical violations closed)
§5 Block D HANDOFF refresh diff summary
§6 Bias catalog updates (CW-B53+ se surfaced)
§7 Cowork spec improvements suggested
§8 Next step recommendation for Cowork C14 (MVP-3 kickoff vs altro)
§9 Halt status (espettato: no P0 raised)
```

**NO `report_ready` inbox notify** (watchdog off). Cowork legge manualmente quando Enzo riavvia sessione.

---

## §9 — Reference files

| Path | Purpose |
|---|---|
| `docs/api/MVP_2A_API_GAP_AUDIT.md` v2.0 §J/§K | residual + recommendation |
| `NEXT_SESSION_MVP_2A.md` §5 | acceptance criteria target |
| `apps/web/tests/e2e/*.spec.ts` (17 file) | E2E baseline |
| `apps/web/playwright.config.ts` | runner config (singleThread, retries=1) |
| `cowork_reserved/bias_registry.md` | CW-B52 + claim CW-B53 se necessario |
| `cowork_reserved/HANDOFF_FRESH_SESSION.md` | Cowork-side handoff (da refresh) |

---

## §10 — Post-X13 outlook

Expected: MVP-2a "acceptance-criteria-complete" certificato. Possibili direzioni C14:

- **MVP-3 kickoff** — multi-tenant elevato + brand identity full integration (vedi `project_mvp3_session_state.md`)
- **MVP-2b ESS hardening** se Block A/B emergeva debolezza ESS-side
- **SDBI residue closure** (Path A originale, opzione di completezza)

CLI X13 raccomanda direzione in §8 REPORT basandosi su outcome live.

---

*End PROMPT 017 — Cowork standing by per REPORT 017 (poll manuale, watchdog off).*
