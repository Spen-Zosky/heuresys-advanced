# HALT P1 — X19 Brownfield Wave 1 (engine residual, 6 IMPORT targets)

**Type**: halt_notify · **Severity**: P1 (handoff, NON-catastrophic) · **Goal**: 023 · **Batch**: X19
**Raised**: 2026-05-25T01:44Z · **Run**: `6f531559-4704-4f29-80e0-3f924bb6bcac` (COMPLETED, no error)
**Cascade impact**: per launching directive "NO cascade procede se previous batch halted" → **X20 (MFA) NON eseguito**, await Cowork.

---

## TL;DR

Il full Wave-1 re-run **post-CW-B49** (primo end-to-end con l'engine patchato) è girato pulito (47min, 34509 upserted, 0 failed, R-A2 `sys_users=433` intatto) ma **NON ha sbloccato i 6 IMPORT target residui**. La premessa di PROMPT 023 ("re-run end-to-end → ≥75/134") è **empiricamente refutata** (pattern CW-B58). Trigger esatto della condizione HALT P1 di PROMPT 023 §4 ("≥4 IMPORT mapping sotto soglia = engine logic gap residual oltre CW-B49"). **Nessun fix applicato inline** (engine logic = halt+escalate, Inline Mitigation Scope §1.4).

## Evidenza empirica (test matrix, non narrativa)

| Fatto | Valore | Verified-by |
|---|---|---|
| Engine patch CW-B49 (`7ea09f0`) committed | 2026-05-23 17:17 UTC | `git log` |
| Ultimo run COMPLETED **pre-patch** | 2026-05-23 16:16 UTC | `brownfield.import_runs` |
| → premessa PROMPT corretta: post-patch mai eseguito | ✓ | timestamp diff |
| Re-run post-patch `6f531559` | COMPLETED, 34509 upsert, 0 failed, ~47min | `import_run_logs` |
| sys.* TRUE populated pre→post | **59/134 → 59/134** (0 nuove) | `query_to_xml COUNT(*)` |
| IMPORT wave1 distinct targets | **13/19 populated, 6 empty** (invariato) | idem |

## Residual — 2 categorie, entrambe halt+escalate

**(A) Engine silent-filter** — 3 target AUTO_APPROVED + 0 validation-fail ma **0 righe upsertate, ZERO log WARNING/ERROR**:
- `sys_skill_categories` (32 staging rows) · `sys_activity_classification_mappings` (14) · `sys_process_kpi_templates` (81)
- `executeUpsert` filtra silenziosamente tutte le righe (probabile NK/required/FK exclusion o SKIPPED_UNSUPPORTED_TRANSFORM — oltre CW-B49 che era conflict-inference). **Anche gap di observability**: nessun log emesso. Root-cause forensic = scope Cowork engine.

**(B) Scope gap (no source)** — 3 target IMPORT senza alcuna `staging.wave1_*` → `stagingTableFor`→null → skip silenzioso:
- `sys_blueprint_overrides` (×4 mappings) · `sys_position_learning_requirements` · `sys_position_skill_requirements` (×7)
- Nessun source export Wave-1. Probabilmente derived/computed o Wave 2. Decisione di scope = Cowork.

**META (CW-B52)**: acceptance `≥75/134` irraggiungibile — esistono solo 19 distinct IMPORT target in Wave 1 (max teorico ~62/134). Spec PROMPT staleness.

## Decisione richiesta a Cowork (opzioni — DECISION AUTHORITY Enzo)

1. **Accept-as-residual**: dichiarare Wave-1 chiuso a 13/19 IMPORT (+ residual A/B documentati come CW-B60), procedere a X20 MFA in batch separato. (raccomandato se la milestone non richiede i 6 target).
2. **Forensic engine batch (A)**: dedicato a capire perché i 3 approved-target danno 0 righe (transform/NK/FK) + aggiungere logging. Effort ~2-3h.
3. **Scope batch (B)**: definire fonte/derivazione per i 3 no-source target (Wave 2 ADR o computed views).

## Stato repo / artefatti

- Bias: **CW-B60** claimed (registry §2, Next→B61).
- REPORT: `_04_REPORT_023_batch_x19.md`. Run artifacts: `qa_artifacts/x19_brownfield_wave1_run.json` + `_progress.log`.
- Block A engine tests: **40 passed / 1 skipped** (no regression).
- Commit locale: `feat(db): X19 Brownfield Wave 1 re-run post-CW-B49 — COMPLETED, 6-target residual HALT P1` (NO push).
- Tunnel 5433 + API :3001 lasciati UP per eventuale forensic immediato.

*End halt notify — X19 P1, sequenza C19 fermata prima di X20.*
