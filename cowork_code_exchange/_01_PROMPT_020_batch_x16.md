# PROMPT 020 — CLI Batch X16 (MVP-2a Final Certification + Release Tag)

**Protocol**: Cowork↔CLI v2.2 (watchdog OFF, no inbox notify)
**Scope**: chiude i 7 residual fail showcase-smoke X15 via env-correct rebuild + tag rilascio `v0.2.1-mvp2a-final` come stamp "acceptance-criteria-complete"
**Expected duration**: 30-40 min
**Authored**: 2026-05-24T02:30Z by Cowork (batch C16)
**Predecessor**: REPORT 019 X15 E2E vs prod (`_04_REPORT_019_batch_x15.md` §6 Option B + D)

---

## §0 — Identity + CW-B52/B53/B54 pre-flight

You are Claude Code CLI on Windows. Esegui combo **Option B (showcase env fix) + Option D (release tag)** raccomandazione REPORT 019 §6. Bundle in batch unico atomico per chiudere MVP-2a in stato live-verified 125/125 + traceability stamp.

### Pre-flight live-state

```bash
cd D:\heuresys-advanced
git log --oneline -3                                                                  # expected: HEAD 9b6d962 (X15 shipped)
git tag --list | tail -5                                                              # expected: v0.4.0-brand-v1 latest (no v0.2.1 yet)
find apps/web/tests/e2e -name "*.spec.ts" | wc -l                                     # expected: 18
find apps/web/tests/e2e -name "*.spec.ts" -exec grep -c "^\s*test(" {} + | awk -F: '{s+=$2} END {print s}'  # expected: 56
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT COUNT(*) FROM sys.sys_users"  # expected: 433
```

### Acceptance criterion (CW-B53 carry-over + new units)

- "showcase env var" = `NEXT_PUBLIC_ENABLE_SHOWCASE=1` set at **build time** (burn-into-bundle, NOT runtime env)
- "125/125 PASS" = effective PASS (hard + retry) per CW-B53 unit ≥ **125**
- "release tag" = annotated git tag (NOT lightweight) with message describing MVP-2a closure state

### HALT P0 conditions

- HEAD ≠ `9b6d962`
- `pnpm --filter @heuresys/web build` exit ≠ 0 con env var set
- `pnpm start` fail to bind :3000 dopo 2 retry
- Playwright structural FAIL > 0 (route 404 non-env-gate, auth broken, persona seed mismatch)
- showcase routes still 404 dopo rebuild con env var (= burn-into-bundle non funziona, root cause diverso)
- sys_users count regression (≠ 433)

---

## §1 — Block A: Pre-flight teardown + env-aware prod build

### Step A.1 — Teardown leftover X15

```powershell
# X15 ha stopped pnpm start. apps/api dev :3001 carry-over. Verifica:
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
$port3001 = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
Write-Host "Port 3000: $($port3000 -ne $null)"
Write-Host "Port 3001: $($port3001 -ne $null)"

# Se :3000 ancora occupata, libera. Lascia :3001 se attiva.
if ($port3000) { Stop-Process -Id $port3000.OwningProcess -Force }
```

### Step A.2 — Rebuild apps/web con showcase env var burn-in

CRUCIAL: `NEXT_PUBLIC_*` vars sono burn-into-bundle a build time. Vanno passate ALL'ENV del comando build, non runtime.

```powershell
# PowerShell 5.1: env var per il singolo comando
$env:NEXT_PUBLIC_ENABLE_SHOWCASE = "1"
cd D:\heuresys-advanced
pnpm --filter @heuresys/web build 2>&1 | tee qa_artifacts/x16_web_build.txt

# Verifica env burned: cerca "ENABLE_SHOWCASE" nei file built
findstr /S /M "NEXT_PUBLIC_ENABLE_SHOWCASE" apps/web/.next/static/chunks/*.js 2>$null | Measure-Object -Line
# expected: ≥1 match (env burned in qualche chunk client-side)
```

**Acceptance Step A.2**:
- ✅ build exit 0
- ✅ ≥63 route built (X14 baseline; con showcase abilitato dovrebbe restare uguale, le route esistono già)
- ✅ `findstr` ≥1 match conferma burn-in env

### Step A.3 — `pnpm start` con showcase abilitato

```powershell
# Env var resta nel session PowerShell per Start-Process
$env:NEXT_PUBLIC_ENABLE_SHOWCASE = "1"
Start-Process pwsh -ArgumentList "-NoExit","-Command","`$env:NEXT_PUBLIC_ENABLE_SHOWCASE='1'; cd D:\heuresys-advanced\apps\web; pnpm start" -WindowStyle Minimized
Start-Sleep -Seconds 15

# Smoke showcase routes (devono ora rispondere 200, non 404)
Invoke-WebRequest -Uri http://localhost:3000/showcase -UseBasicParsing | Select-Object -ExpandProperty StatusCode  # expected: 200
Invoke-WebRequest -Uri http://localhost:3000/showcase/shell -UseBasicParsing | Select-Object -ExpandProperty StatusCode  # expected: 200
Invoke-WebRequest -Uri http://localhost:3000/login -UseBasicParsing | Select-Object -ExpandProperty StatusCode  # expected: 200 (carry-over check)
```

**Acceptance Step A.3**: tutte e 3 le smoke return 200. Se `/showcase` 404 ancora → HALT P0 (root cause diverso da env var).

---

## §2 — Block B: Playwright full run, target 125/125

```bash
cd D:\heuresys-advanced\apps\web
pnpm exec playwright test 2>&1 | tee ../../qa_artifacts/x16_playwright_prod_full.txt
```

Expected: tutti i 7 X15 residual fail (showcase-smoke 5 diretti + 2 cascade) ora PASS. Effective PASS target: **125/125** (o ≥123 con jitter residuo accettabile).

### Confronto X15 vs X16

```bash
echo "=== X15 (prod, no env) ===" && grep -E "passed|failed|flaky" qa_artifacts/x15_playwright_prod.txt | tail -5
echo "=== X16 (prod, env set) ===" && grep -E "passed|failed|flaky" qa_artifacts/x16_playwright_prod_full.txt | tail -5
```

### Acceptance Block B

- ✅ effective PASS ≥ **123** (≥98.4% del total; consente 0-2 jitter Windows-residual)
- ✅ structural FAIL = **0**
- ✅ tutti i 7 showcase-smoke X15 fail → ora PASS
- ❌ Se effective PASS < 123 dopo retry → indagare causa (NON HALT P0 se zero structural; raccoglie diagnostic in `qa_artifacts/x16_failures/`)

---

## §3 — Block C: Release tag `v0.2.1-mvp2a-final`

### Step C.1 — Pre-tag verification

```bash
cd D:\heuresys-advanced
git status --short  # expected: solo qa_artifacts/x16_*.txt + PROMPT/REPORT 020 (uncommitted)
git log --oneline -5
git tag --list "v0.*" | sort -V  # expected: v0.4.0-brand-v1 latest
```

### Step C.2 — Commit X16 changes prima del tag

Commit atomico include:
- `qa_artifacts/x16_web_build.txt`
- `qa_artifacts/x16_playwright_prod_full.txt`
- `cowork_code_exchange/_01_PROMPT_020_batch_x16.md`
- `cowork_code_exchange/_04_REPORT_020_batch_x16.md` (questo report al completion)

Message:
```
test(web): X16 MVP-2a final certification — playwright 125/125 vs pnpm start con NEXT_PUBLIC_ENABLE_SHOWCASE=1
```

### Step C.3 — Annotated tag

```bash
git tag -a v0.2.1-mvp2a-final -m "MVP-2a acceptance-criteria-complete

Live-verified state at HEAD <X16-commit>:
- 41 pagine shipped (28 admin + 13 ESS + 1 system-health admin X13)
- 272 endpoint /v1/*
- 50 integration test API
- 19 Playwright spec files / 56 literal test() / 125 playwright list count
- Effective PASS: 125/125 vs pnpm start con NEXT_PUBLIC_ENABLE_SHOWCASE=1 (X16)
- axe a11y: 51 scans critical=0
- i18n parity 100% (17 keys × 2 locales)
- Build OK: 62-63 routes prerendered
- CW-B52/B53/B54 mitigated

Pipeline: MVP-1 → MVP-2a (this tag) → MVP-2b (ESS shipped) → MVP-3 (next)
"

git tag --list "v0.*" | sort -V  # verifica nuovo tag presente
```

### Acceptance Block C

- ✅ Commit X16 shipped
- ✅ Tag `v0.2.1-mvp2a-final` creato (annotated, con message multi-line)
- ✅ `git tag --list` mostra il nuovo tag

NOTE: NO push del tag. Enzo decide quando push (tag remoti = release pubblico).

---

## §4 — Block D: Teardown finale

```powershell
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($port3000) { Stop-Process -Id $port3000.OwningProcess -Force }
Remove-Item Env:\NEXT_PUBLIC_ENABLE_SHOWCASE -ErrorAction SilentlyContinue  # cleanup session env

# apps/api :3001 può restare per sessioni successive (idem X15)
```

---

## §5 — REPORT format

`cowork_code_exchange/_04_REPORT_020_batch_x16.md`. Structure:

```
§0 Pre-conditions outcome (4 contatori + tag list baseline)
§1 Block A outcome:
    §1.1 Teardown status
    §1.2 Build con env var (burn-in verification)
    §1.3 Smoke showcase 200
§2 Block B outcome:
    §2.1 Summary X14 vs X15 vs X16 (3-col diff)
    §2.2 Showcase-smoke 7 fail → 0 confirmed
    §2.3 Acceptance verdict
§3 Block C outcome (commit + tag)
§4 Block D teardown
§5 Bias catalog updates (CW-B55+ se surface — atteso 0)
§6 Next step C17 recommendation (default: MVP-3 finalization)
§7 Halt status
```

NO inbox notify (watchdog OFF). NO push.

---

## §6 — Halt triggers P0

| Trigger | Severity |
|---|---|
| HEAD ≠ `9b6d962` at pre-flight | P0 |
| `pnpm build` con env var exit ≠ 0 | P0 |
| `findstr NEXT_PUBLIC_ENABLE_SHOWCASE` 0 match dopo build (env NON burned) | P0 |
| `/showcase` 404 dopo rebuild + env var | P0 (root cause ≠ env, indagare) |
| `pnpm start` fail to bind :3000 dopo 2 retry | P0 |
| Playwright structural FAIL > 0 (route 404 non-env, auth, seed) | P0 |
| sys_users count regression (≠ 433) | **P0 CRITICAL** |

Halt → file in `.inbox/cowork/pending/`. NO inbox notify.

---

## §7 — Reference

| Path | Purpose |
|---|---|
| `cowork_code_exchange/_04_REPORT_019_batch_x15.md` §2.2 + §6 | X15 baseline 118/125 + 7 fail root cause |
| `qa_artifacts/x15_playwright_prod.txt` | X15 prod-mode log for diff |
| `apps/web/tests/e2e/showcase-smoke.spec.ts:23-25` | env-gate requirement documentazione |
| `cowork_reserved/bias_registry.md` CW-B54 | mitigated state da preservare |
| `NEXT_SESSION_MVP_2A.md` §5 | acceptance criteria già augmented X15 |

---

*End PROMPT 020 — Cowork standing by per REPORT 020 (poll manuale, watchdog off).*
