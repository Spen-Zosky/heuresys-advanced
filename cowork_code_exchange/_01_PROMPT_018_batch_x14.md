# PROMPT 018 — CLI Batch X14 (MVP-2a Final Live Validation)

**Protocol**: Cowork↔CLI v2.2 (watchdog OFF, no inbox notify)
**Scope**: chiude i 2 deferred items X13 — `pnpm exec playwright test` full + axe a11y sweep live
**Expected duration**: 30-45 min
**Authored**: 2026-05-23T23:00Z by Cowork (batch C14)
**Predecessor**: REPORT 017 X13 Coverage Hardening (`_04_REPORT_017_batch_x13.md` §8 Option B)

---

## §0 — Identity + CW-B52/B53 pre-flight

You are Claude Code CLI on Windows. Eseguo Option B raccomandazione REPORT 017 §8: certifica MVP-2a "live-verified PASS" eseguendo i 2 deferred items.

**Pre-flight live-state** (CW-B52 mitigation, CW-B53 regex robusta):

```bash
cd D:\heuresys-advanced
git log --oneline -3                                                  # expected: HEAD b9a637e (X13 shipped)
find apps/web/tests/e2e -name "*.spec.ts" | wc -l                     # expected: 19 (was 17 pre-X13)
find apps/web/tests/e2e -name "*.spec.ts" -exec grep -c "^\s*test(" {} + | awk -F: '{s+=$2} END {print s}'  # expected: ~54 literal test()
cd apps/web && pnpm exec playwright test --list 2>&1 | tail -3        # expected: "Total: 125 tests in 19 files"
```

**Acceptance criterion unit definitions** (CW-B53):
- "spec count" = file `.spec.ts` count
- "test count" = literal `^\s*test(` matches (NO programmatic loop expansion)
- "playwright list count" = `pnpm exec playwright test --list` final "Total: N tests" line

HALT P0 se: HEAD ≠ b9a637e, OR playwright list count < 100, OR symlink @heuresys/ui broken.

---

## §1 — Block A: Dev environment up

```bash
ssh -fN -L 5433:localhost:5432 oracle-vm-default
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT NOW()"

# Avvia API + Web dev in background (Windows: usa Start-Process o sessioni separate)
# Da PowerShell:
Start-Process pwsh -ArgumentList "-NoExit","-Command","cd D:\heuresys-advanced\apps\api; pnpm dev" -WindowStyle Minimized
Start-Process pwsh -ArgumentList "-NoExit","-Command","cd D:\heuresys-advanced\apps\web; pnpm dev" -WindowStyle Minimized

# Smoke API (attendi "RBAC permission cache loaded mappingsLoaded:388"):
Start-Sleep -Seconds 30
Invoke-RestMethod -Uri http://localhost:3001/healthz
Invoke-RestMethod -Uri http://localhost:3001/readyz

# Smoke Web (attendi compile Next.js JIT, ~30-60s prima hit):
Invoke-WebRequest -Uri http://localhost:3000/login -UseBasicParsing | Select-Object -ExpandProperty StatusCode
```

Acceptance: API `/readyz` 200 + Web `/login` 200.

---

## §2 — Block B: Playwright full run

```bash
cd D:\heuresys-advanced\apps\web
pnpm exec playwright test 2>&1 | tee ../../qa_artifacts/x14_playwright_full.txt
```

Expected: 125 tests across 19 files.

Acceptance:
- ✅ Exit 0
- ✅ 0 fail (retry=1 per playwright.config.ts is allowed, conta come PASS se retry passa)
- ⚠️ Se 1-3 fail isolati: indagare causa (race condition, dev-mode JIT jitter) + retry singolo file. Se persiste, raccogliere stack + screenshot in `qa_artifacts/x14_failures/`.
- ❌ Se ≥5 fail strutturali (auth broken, route 404, persona seed mismatch) → HALT P0 file `cowork_code_exchange/.inbox/cowork/pending/<TS>_018_halt_e2e_regression.md`.

---

## §3 — Block C: axe a11y sweep live

Già parte di playwright run (Block B include `a11y.spec.ts` + `showcase-a11y.spec.ts`).

Estrai report dedicato:

```bash
grep -E "Critical|critical violations|axe" qa_artifacts/x14_playwright_full.txt > qa_artifacts/x14_a11y_live.txt
# Plus: copia test-results/a11y-audit/*.json se presente
ls apps/web/test-results/a11y-audit/ 2>/dev/null && cp -r apps/web/test-results/a11y-audit qa_artifacts/x14_axe_results
```

Acceptance: `critical=0` per ogni route (43 admin/ESS + 18 showcase = 61 scans target).

---

## §4 — Block D: Build certification

```bash
cd D:\heuresys-advanced
pnpm --filter @heuresys/web build 2>&1 | tee qa_artifacts/x14_web_build.txt
```

Acceptance: exit 0, no TypeScript errors, no Next.js build errors.

Stop dev servers post-build:
```bash
Get-Process pwsh | Where-Object { $_.MainWindowTitle -match "pnpm dev" } | Stop-Process
```

---

## §5 — REPORT format

`cowork_code_exchange/_04_REPORT_018_batch_x14.md`. Structure:

```
§0 Pre-conditions outcome (4 contatori + acceptance unit verification)
§1 Block A dev env up status
§2 Block B Playwright run outcome (passed/failed/flaky counts)
§3 Block C axe outcome (critical/serious/moderate per route)
§4 Block D build outcome
§5 Bias catalog updates (CW-B54+ se surface)
§6 Next step C15 recommendation (default: MVP-3 finalization Tappe B/F/E-UI per project_mvp3_session_state.md)
§7 Halt status
```

NO inbox notify. Commit atomico: "test(web): X14 MVP-2a live validation — playwright N/N + axe zero-critical + build OK".

---

## §6 — Halt triggers P0

| Trigger | Severity |
|---|---|
| HEAD ≠ b9a637e at pre-flight | P0 |
| dev servers fail to start dopo 2 retry | P0 |
| Playwright ≥5 fail strutturali | P0 |
| axe critical > 0 dopo retry | P0 |
| `pnpm build` exit ≠ 0 | P0 |
| sys_users count regression | **P0 CRITICAL** |

Halt → file in `.inbox/cowork/pending/`. NO inbox notify.

---

*End PROMPT 018*
