# PROMPT 026 — CLI Batch X19.A (Dependabot CVE updates — 2 moderate)

**Goal ID**: 026 · **Slug**: `batch_x19a_dependabot_cve_uuid_qs_update`
**Origin**: GitHub Dependabot 2 vulnerabilities moderate rilevate post-push X18 (2026-05-24). Cowork C19 Enzo decision "voglio tutto e subito".
**Expected duration**: 30-60 min CLI (fast batch)
**Predecessor**: HEAD origin/main `82a30a1` (post-X18 close).
**Scope**: bump 2 deps con CVE moderate fix + verify no regression. Quick win.

---

## §0 — CVE summary (GitHub Dependabot API)

| CVE | Package | Severity | Current | Fix | Issue |
|---|---|---|---|---|---|
| CVE-2026-41907 | `uuid` | moderate | < 11.1.1 | **11.1.1** | Missing buffer bounds check in v3/v5/v6 when `buf` is provided |
| CVE-2026-8723 | `qs` | moderate | < 6.15.2 | **6.15.2** | DoS: `qs.stringify` crashes with TypeError on null/undefined entries in comma-format arrays when `encodeValuesOnly` is set |

Reference: https://github.com/Spen-Zosky/heuresys-advanced/security/dependabot

---

## §1 — Pre-flight

```bash
cd /d/heuresys-advanced
git log --oneline -1   # expected HEAD: 82a30a1 or descendant

# Identify which packages currently use uuid + qs
pnpm why uuid 2>&1 | head -20
pnpm why qs 2>&1 | head -20

# Versioni installate correnti
pnpm list uuid qs 2>&1 | head -10
grep -rn '"uuid"\|"qs"' apps/*/package.json packages/*/package.json package.json 2>&1 | head -10
```

### HALT P0
- HEAD ≠ descendant of `82a30a1` → HALT staleness
- `uuid` o `qs` non listati in pnpm tree → vulnerabilità potrebbero essere su transitive deps (gestire diversamente)

---

## §2 — Block A: Update via pnpm override + direct dep bump

### A.1 — Direct deps (se presenti in package.json)

```bash
# Verifica se uuid è direct dep
grep -l '"uuid"' apps/*/package.json packages/*/package.json package.json 2>&1
# Per ogni file trovato, update:
# Example: apps/api/package.json
# pnpm --filter @heuresys/api add uuid@^11.1.1

# Verifica se qs è direct dep
grep -l '"qs"' apps/*/package.json packages/*/package.json package.json 2>&1
# Update analogo

# Probabile: entrambe transitive (uuid via Fastify dep tree, qs via express/fastify dep tree)
```

### A.2 — Transitive deps via pnpm overrides

Edit root `package.json` aggiungendo (se non presente sezione):
```json
{
  "pnpm": {
    "overrides": {
      "uuid": "^11.1.1",
      "qs": "^6.15.2"
    }
  }
}
```

Se sezione `"pnpm".overrides` già esistente, aggiungi/aggiorna le 2 entries preservando altre overrides.

### A.3 — Refresh + verify

```bash
pnpm install 2>&1 | tail -10
pnpm list uuid qs 2>&1 | head -20
# expected: uuid 11.1.1+ e qs 6.15.2+ ovunque (transitive risolti via override)
```

---

## §3 — Block B: Regression verify

```bash
cd /d/heuresys-advanced
pnpm --filter @heuresys/api exec tsc --noEmit 2>&1 | tail -5
pnpm --filter @heuresys/web exec tsc --noEmit 2>&1 | tail -5

# Test API (uuid + qs commonly used in REST API request parsing + IDs)
cd apps/api
pnpm exec vitest run 2>&1 | tee /d/heuresys-advanced/qa_artifacts/x19a_vitest_api.txt | tail -10
# expected: 0 regression vs baseline 336/342

cd /d/heuresys-advanced
# Build web
NEXT_PUBLIC_ENABLE_SHOWCASE=1 pnpm --filter @heuresys/web build 2>&1 | tee qa_artifacts/x19a_web_build.txt | tail -10
# expected: PASS (no regression admin core)
```

Acceptance:
- pnpm list mostra uuid ≥11.1.1, qs ≥6.15.2 (transitive incluse)
- typecheck API + web PASS
- vitest API 0 regression
- web build PASS

---

## §4 — Block C: Verify GitHub Dependabot post-push

Post-push (Enzo manual o batch successivo), verifica:
```bash
gh api '/repos/Spen-Zosky/heuresys-advanced/dependabot/alerts?state=open' 2>&1 | head -20
# expected: 0 open alerts dopo push (Dependabot rileva fix automaticamente, può richiedere 5-30 min)
```

Se 0 open: ✅. Se ancora open: investigate (forse alert su altra dep, o cache Dependabot stale).

---

## §5 — Block D: REPORT + commit

```bash
git add package.json pnpm-lock.yaml \
        qa_artifacts/x19a_vitest_api.txt qa_artifacts/x19a_web_build.txt \
        cowork_code_exchange/_01_PROMPT_026_batch_x19a_dependabot_cve.md \
        cowork_code_exchange/_04_REPORT_026_batch_x19a.md \
        cowork_reserved/HANDOFF_FRESH_SESSION.md

git commit -m "chore(security): X19.A — bump uuid ^11.1.1 + qs ^6.15.2 (CVE-2026-41907 + CVE-2026-8723 fix, Dependabot moderate)"
```

REPORT 026 sezioni standard, scope minimo (~50 righe).

---

## §6 — Halt + critical thinking

- HALT P0: typecheck regression > 0, vitest fail > baseline+0, build break web
- HALT P1: pnpm override non risolve transitive (lib X dipende strict da uuid < 11) → fix richiede revert deprecated lib o alternative
- Critical thinking: se uuid v11 ha breaking changes API vs v10 (es. signature change), adatta consumer code + documenta in REPORT

---

## §7 — Out of scope X19.A

- Brownfield (PROMPT 023)
- MFA (PROMPT 024)
- DEFER-F (PROMPT 025)
- Other deps audit (separate batch se necessario)

---

## §8 — Reference

| Path | Purpose |
|---|---|
| https://github.com/Spen-Zosky/heuresys-advanced/security/dependabot | source CVE alerts |
| https://nvd.nist.gov/vuln/detail/CVE-2026-41907 | uuid CVE detail |
| https://nvd.nist.gov/vuln/detail/CVE-2026-8723 | qs CVE detail |
| `package.json` pnpm.overrides | target update location |

---

*End PROMPT 026 — fast batch X19.A. Pre-X19 main batches consigliato per chiudere security gap immediately.*
