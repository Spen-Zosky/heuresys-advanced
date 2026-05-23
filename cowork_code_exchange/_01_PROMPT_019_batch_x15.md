# PROMPT 019 — CLI Batch X15 (MVP-2a E2E Validation against Production Build)

**Protocol**: Cowork↔CLI v2.2 (watchdog OFF, no inbox notify)
**Scope**: chiude CW-B54 — Playwright suite re-run contro `pnpm start` (warm prod build) invece di `next dev`, certifica MVP-2a "live-verified" senza environmental caveat
**Expected duration**: 30-45 min
**Authored**: 2026-05-24T01:30Z by Cowork (batch C15)
**Predecessor**: REPORT 018 X14 Final Live Validation (`_04_REPORT_018_batch_x14.md` §6 Option B)

---

## §0 — Identity + CW-B52/B53/B54 pre-flight

You are Claude Code CLI on Windows. Esegui Option B raccomandazione REPORT 018 §6: re-run Playwright suite contro production build (`pnpm start`) per certificare 125/125 PASS senza dev-mode JIT jitter (CW-B54 mitigation evidence).

### Pre-flight live-state (CW-B52 + CW-B53 robust regex)

```bash
cd D:\heuresys-advanced
git log --oneline -3                                                                  # expected: HEAD 28562f5 (X14 shipped)
find apps/web/tests/e2e -name "*.spec.ts" | wc -l                                     # expected: 18 (pure spec files, excl auth.setup.ts)
find apps/web/tests/e2e -name "*.spec.ts" -exec grep -c "^\s*test(" {} + | awk -F: '{s+=$2} END {print s}'  # expected: 56 literal test() calls
cd apps/web && pnpm exec playwright test --list 2>&1 | tail -3                        # expected: "Total: 125 tests in 19 files" (incl auth.setup)
```

### Acceptance criterion unit definitions (CW-B53 carry-over)

- "playwright list count" = `Total: N tests` line from `playwright test --list` → expected **125**
- "effective PASS" = hard PASS + retry-recovered (per playwright.config.ts `retries: 1`)
- "structural FAIL" = route 404 / auth gate broken / persona seed mismatch / schema regression — distinct from "timing FAIL" (TimeoutError, locator timeout)
- "production-build E2E PASS" = effective PASS count **after** Playwright run against `pnpm start` (not `pnpm dev`)

### HALT P0 conditions

- HEAD ≠ `28562f5`
- `playwright --list` count < 100
- symlink `@heuresys/ui` broken (`readlink -f node_modules/@heuresys/ui` ≠ `/d/ux-design-shared/ui`)
- `pnpm --filter @heuresys/web build` exit ≠ 0 (no prod build = no `pnpm start` = no batch)
- sys_users count regression (verifica via `/v1/auth/admin/users` count o psql `SELECT COUNT(*) FROM sys.sys_users` = 433)

---

## §1 — Block A: Dev environment teardown + Prod build

### Step A.1 — Teardown dev servers leftover X14

```powershell
# CLI X14 §4 lasciò dev servers attivi. Stop esplicito prima di prod start.
Get-Process | Where-Object { $_.ProcessName -eq "node" -or $_.ProcessName -eq "pwsh" } | Where-Object { $_.MainWindowTitle -match "pnpm dev|next dev" } | Stop-Process -Force -ErrorAction SilentlyContinue

# Verifica porte libere
$port3000 = (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue)
$port3001 = (Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue)
Write-Host "Port 3000 occupied: $($port3000 -ne $null)"
Write-Host "Port 3001 occupied: $($port3001 -ne $null)"

# Se occupate, kill explicit via PID
if ($port3000) { Stop-Process -Id $port3000.OwningProcess -Force -ErrorAction SilentlyContinue }
if ($port3001) { Stop-Process -Id $port3001.OwningProcess -Force -ErrorAction SilentlyContinue }
```

### Step A.2 — Conferma SSH tunnel + apps/api dev (sempre dev mode per API, non in scope CW-B54)

```bash
ssh -fN -L 5433:localhost:5432 oracle-vm-default  # idempotent, fallisce silent se già up
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT COUNT(*) FROM sys.sys_users"  # expected: 433

# Riparte apps/api in dev (è il backend, lascia in dev — il fix CW-B54 è SOLO frontend)
Start-Process pwsh -ArgumentList "-NoExit","-Command","cd D:\heuresys-advanced\apps\api; pnpm dev" -WindowStyle Minimized
Start-Sleep -Seconds 25  # attendi RBAC cache load
Invoke-RestMethod -Uri http://localhost:3001/readyz  # expected: {"status":"ready","checks":{"database":"ok"}}
```

### Step A.3 — Build apps/web prod + Start

```bash
cd D:\heuresys-advanced
pnpm --filter @heuresys/web build 2>&1 | tee qa_artifacts/x15_web_build.txt
# expected: exit 0, 63 routes built (carry-over X14)

# Start prod server (warm, no JIT compile on first hit)
Start-Process pwsh -ArgumentList "-NoExit","-Command","cd D:\heuresys-advanced\apps\web; pnpm start" -WindowStyle Minimized
Start-Sleep -Seconds 15

# Smoke prod web
Invoke-WebRequest -Uri http://localhost:3000/login -UseBasicParsing | Select-Object -ExpandProperty StatusCode  # expected: 200, <1s response (no JIT)
```

### Acceptance Block A

- ✅ Dev servers leftover X14 stopped (port 3000 free before prod start)
- ✅ apps/api `/readyz` 200 with `checks.database: ok`
- ✅ `pnpm build` exit 0 (no TS / Next.js errors)
- ✅ `pnpm start` up, `/login` 200 in <2s response time

HALT P0 se build fallisce (no fallback — il batch dipende dalla prod build).

---

## §2 — Block B: Playwright full run contro prod build

```bash
cd D:\heuresys-advanced\apps\web
# Same command as X14 §2, ma adesso il target è :3000 = pnpm start (prod)
pnpm exec playwright test 2>&1 | tee ../../qa_artifacts/x15_playwright_prod.txt
```

Expected outcome (CW-B54 hypothesis):
- Effective PASS sale da **73** (X14 dev mode) → **120-125** (X15 prod mode)
- Pattern timing fail (TimeoutError, locator timeout) → ridotto a 0-3 isolated
- 0 structural fail (carry-over X14: no route/auth/seed regression)

### Confronto X14 vs X15

A run terminato, estrarre i counter via grep:

```bash
echo "=== X14 (dev mode) ===" && grep -E "passed|failed|flaky" qa_artifacts/x14_playwright_full.txt | tail -5
echo "=== X15 (prod mode) ===" && grep -E "passed|failed|flaky" qa_artifacts/x15_playwright_prod.txt | tail -5
```

### Acceptance Block B

- ✅ effective PASS ≥ **120** (sopra 95% del total 125; CW-B53 unit: hard PASS + retry-recovered)
- ✅ structural FAIL = **0** (carry-over X14 verdict, deve restare)
- ⚠️ timing FAIL accettabili 0-5 isolated (env jitter Windows residuo)
- ❌ Se effective PASS < 120 → CW-B54 hypothesis confutata, indagare. NON HALT P0 (no structural), ma raccoglie diagnostic in `qa_artifacts/x15_failures/` (test traces + screenshot).
- ❌ Se structural FAIL > 0 (route 404, auth break, persona seed mismatch) → HALT P0 + halt file `cowork_code_exchange/.inbox/cowork/pending/<TS>_019_halt_structural_regression.md`.

---

## §3 — Block C: CW-B54 verdict consolidation

Aggiorna `cowork_reserved/bias_registry.md` §2 CW-B54 entry status:
- Se X15 effective PASS ≥ 120: status **mitigated (X15 evidence)** + reference `qa_artifacts/x15_playwright_prod.txt`
- Se X15 effective PASS < 120: status **partial mitigation, root cause needs deeper investigation** + reference X15 failures

Aggiorna `NEXT_SESSION_MVP_2A.md` §5 acceptance criterion (CW-B53 preventive measure carry-over):
- Aggiungi nota esplicita: *"E2E run cadence: la suite acceptance va eseguita contro `pnpm start` (warm prod build), non `pnpm dev` (JIT contention, CW-B54). Dev mode acceptable solo per debugging single-spec con `--workers=1`."*

### Acceptance Block C

- ✅ Bias registry CW-B54 status updated con X15 evidence
- ✅ NEXT_SESSION_MVP_2A.md §5 augmented con E2E run cadence specification

---

## §4 — Block D: Teardown + Commit

```powershell
# Stop prod web server (apps/api può restare per session successiva)
$port3000 = (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue)
if ($port3000) { Stop-Process -Id $port3000.OwningProcess -Force }
```

Commit atomico singolo:
```
test(web): X15 MVP-2a E2E validation against pnpm start — effective PASS N/125 + CW-B54 verdict
```

Include in commit: `qa_artifacts/x15_*.txt`, `cowork_reserved/bias_registry.md` update, `NEXT_SESSION_MVP_2A.md` augment, `cowork_code_exchange/_04_REPORT_019_batch_x15.md`.

NO push.

---

## §5 — REPORT format

`cowork_code_exchange/_04_REPORT_019_batch_x15.md`. Structure:

```
§0 Pre-conditions outcome (4 contatori CW-B53 + acceptance unit verification)
§1 Block A outcome (teardown + prod build + smoke)
§2 Block B outcome:
    §2.1 Summary table effective PASS/FAIL/flaky (vs X14 baseline)
    §2.2 Per-spec breakdown comparison X14 vs X15
    §2.3 Failures residual analysis (se >0)
§3 Block C outcome (CW-B54 verdict + NEXT_SESSION update)
§4 Block D commit summary
§5 Bias catalog updates (CW-B55+ se surface — atteso 0 in questo batch)
§6 Next step C16 recommendation (default: MVP-3 finalization Tappe B/F/E-UI)
§7 Halt status
```

NO inbox notify (watchdog OFF).

---

## §6 — Halt triggers P0

| Trigger | Severity |
|---|---|
| HEAD ≠ `28562f5` at pre-flight | P0 |
| `pnpm --filter @heuresys/web build` exit ≠ 0 | P0 |
| `pnpm start` fail to bind :3000 dopo 2 retry | P0 |
| `/readyz` apps/api ≠ 200 dopo restart | P0 |
| Playwright structural FAIL > 0 (route 404, auth, seed) | P0 |
| sys_users count regression (≠ 433) | **P0 CRITICAL** |

Halt → file in `.inbox/cowork/pending/`. NO inbox notify.

---

## §7 — Reference

| Path | Purpose |
|---|---|
| `cowork_code_exchange/_04_REPORT_018_batch_x14.md` §2 + §5 | X14 baseline (73/125 dev mode) + CW-B54 detail |
| `qa_artifacts/x14_playwright_full.txt` | dev-mode baseline for diff |
| `cowork_reserved/bias_registry.md` CW-B54 | da aggiornare in Block C |
| `NEXT_SESSION_MVP_2A.md` §5 | acceptance criteria da augment |
| `apps/web/playwright.config.ts` | runner config (singleThread, retries=1) |

---

*End PROMPT 019 — Cowork standing by per REPORT 019 (poll manuale, watchdog off).*
