# PROMPT 021 — CLI Batch X17 (D + B combo: tag push + showcase contract fix)

**Protocol**: Cowork↔CLI v2.2 (watchdog OFF, no inbox notify)
**Goal ID**: 021 · **Slug**: batch_x17_tag_push_shell_contract_fix
**Authored**: 2026-05-24 by Cowork C17 (delega Enzo notturna ridelegata su baseline post-X16 reale)
**Predecessor**: REPORT 020 X16 MVP-2a Final Certification
**Budget**: ~45 min totali (D ~15 + B ~30). LOW-RISK combo.

---

## §0 — Pre-conditions + commitments

```bash
cd D:\heuresys-advanced && git log --oneline -1   # MUST be 9b6d962
git tag --list "v0.2.1*"                          # MUST list v0.2.1-mvp2a-final (locale)
git remote -v                                     # MUST list origin (heuresys-advanced repo)
ssh -fN -L 5433:localhost:5432 oracle-vm-default  # tunnel UP (carry-over X16)
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT count(*) FROM sys.sys_users"  # MUST be 433 (R-A2 P0)
```

Commitments: read this PROMPT + REPORT 020 §3 + §6 → Block D first, then Block B. Single REPORT 021 at end. NO push beyond what §1 prescribes. Commit signature `test(web): X17 ...`.

---

## §1 — Block D: push tag v0.2.1-mvp2a-final + release notes (~15 min)

### Step D.1 — Push tag
```bash
git push origin v0.2.1-mvp2a-final
```
Verifica esito: `git ls-remote --tags origin | grep v0.2.1-mvp2a-final` deve restituire SHA `9b6d962`.

### Step D.2 — Release notes
Crea `qa_artifacts/x17_release_notes_v0.2.1.md` con:
- Header: `# v0.2.1-mvp2a-final — MVP-2a acceptance-criteria-complete + live-verified`
- §1 Summary 3-righe (Playwright 124/125, prod build con showcase env-gate, sys_users 433 NO REGRESSION)
- §2 Highlights X13→X16 (1 NONE route closed `/system-health`, env-gate burn-in, 6/7 showcase fails → PASS in X16)
- §3 Residual known issue (Shell route contract UXIX-0001 DOM heading, fixed in X17 Block B)
- §4 Acceptance per `NEXT_SESSION_MVP_2A.md §5`: i18n 100%, axe ruleset extended, Playwright ≥40 functional reading PASS
- §5 Tag stamp + commit `9b6d962`

### Step D.3 — GitHub release
```bash
gh release create v0.2.1-mvp2a-final --notes-file qa_artifacts/x17_release_notes_v0.2.1.md --title "MVP-2a final certification"
```
Output: URL release page → in REPORT 021 §1.

**Acceptance Block D**: tag su remote (✅), release page live (URL), `qa_artifacts/x17_release_notes_v0.2.1.md` committed.

---

## §2 — Block B: showcase-smoke shell contract fix (~30 min)

**Target fail**: `apps/web/tests/e2e/showcase-smoke.spec.ts:92` test "Shell route contract (UXIX-0001) — expanded sidebar demo".
**Assertion**: `expect(page.getByRole('heading', { name: 'Expanded sidebar (280px)' })).toBeVisible()` — timeout 5s, element not found.
**Path X14/X15/X16**: fail constant, not env-related, NOT structural.

### Step B.1 — Forensic DOM
```bash
# Find showcase shell page source
ls apps/web/src/app/showcase/shell/
# Grep for heading text variants
grep -rn "Expanded sidebar\|280px\|sidebar.*expanded" apps/web/src/app/showcase/shell/ apps/web/src/components/
```
Capire se la stringa è rinominata, o renderizzata come `<div>`/`<span>` (non `<h*>`) → `getByRole('heading')` fail.

### Step B.2 — Decide fix scope
**Preferred**: cambia assertion test per matchare DOM reale (zero-impact su produzione UI).
- Se la stringa esiste ma in `<div className="text-lg font-semibold">`: usa `page.getByText('Expanded sidebar (280px)')` invece di `getByRole('heading', ...)`.
- Se la stringa è stata rinominata: aggiorna il `name:` locator al testo corrente.
- Se la sezione non esiste più: rimuovi il test obsoleto + nota in REPORT §2.

**Alternativo (solo se DOM richiede)**: aggiungi `<h3>` semantico al componente — ma solo se non rompe layout esistente.

### Step B.3 — Apply fix + verify
1. Patch `showcase-smoke.spec.ts:92-103` (test block "expanded sidebar demo")
2. Re-run mirato: `pnpm --filter @heuresys/web exec playwright test showcase-smoke.spec.ts --grep "Shell route contract"`
3. Verifica: 1 test PASS (era FAIL)
4. Re-run full per certificare zero regression:
   ```bash
   $env:NEXT_PUBLIC_ENABLE_SHOWCASE = "1"
   pnpm --filter @heuresys/web exec playwright test 2>&1 | tee qa_artifacts/x17_playwright_post_fix.txt
   ```
   Target: **125/125 PASS (100%)**.

**Acceptance Block B**: target test PASS, full suite 125/125, no new fail, no struttura regression.

---

## §3 — Acceptance globale

- ✅ Tag `v0.2.1-mvp2a-final` su remote `origin`
- ✅ GitHub release page live con notes
- ✅ Playwright 125/125 (100%)
- ✅ sys_users count = 433 (R-A2 P0)
- ✅ Single commit X17 atomico
- ✅ REPORT 021 prodotto

---

## §4 — Halt triggers P0

| Trigger | Severity |
|---|---|
| `git push origin v0.2.1-mvp2a-final` fail (auth/network/conflict) | P0 — halt, document, attend Enzo |
| `gh` CLI not authenticated o release create fail | P1 — halt, document, manual fallback OK |
| sys_users count ≠ 433 | **P0 CRITICAL** — R-A2 regression |
| Playwright full run new fail > 0 (oltre quello target) | P0 — rollback patch B, document |
| Build break post fix | P0 — rollback patch B |

Halt path: scrivi `cowork_code_exchange/.inbox/cowork/pending/<ISO_TS>_021_halt_<reason>.md` + STOP.

---

## §5 — REPORT format

File: `cowork_code_exchange/_04_REPORT_021_batch_x17.md`. Sezioni:
```
§0 Pre-conditions outcome
§1 Block D — push tag + release notes (URL + verification)
§2 Block B — forensic root cause + fix applied + Playwright verify
§3 Acceptance globale verdict
§4 Bias catalog updates (atteso 0 nuovi; +1 mitigated possibile)
§5 HANDOFF refresh (update HANDOFF_FRESH_SESSION.md §1 + §2 + §5 per post-X17 — lezione Block D obbligatorio)
§6 Next step recommendation per C18
§7 Halt status
```

NO inbox notify (watchdog OFF). Cowork polls manualmente al ritorno Enzo.

---

## §6 — References

| Path | Note |
|---|---|
| `_04_REPORT_020_batch_x16.md` §3 + §6 | Tag locale stato + 4 opzioni C17 |
| `apps/web/tests/e2e/showcase-smoke.spec.ts:92-103` | Test target Block B |
| `apps/web/src/app/showcase/shell/` | Page source da ispezionare |
| `qa_artifacts/x16_playwright_prod_full.txt` | Baseline 124/125 |
| `cowork_reserved/HANDOFF_FRESH_SESSION.md` | Update obbligatorio §5 |

---

*End PROMPT 021 — D+B combo low-risk close MVP-2a 100%. Watchdog OFF, manual handoff via REPORT.*
