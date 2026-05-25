# REPORT 023 — CLI Batch X19 (Brownfield Wave 1 full-47k SQL upsert)

**Goal ID**: 023 · **Status**: ⚠️ **HALT P1** (run COMPLETED clean, acceptance NOT met — engine residual)
**Executed**: 2026-05-25 (sequenza autonoma C19, batch 2/3) · **HEAD**: `b01c331`
**Run**: `6f531559-4704-4f29-80e0-3f924bb6bcac` — COMPLETED 2026-05-25T01:34Z (~47min) · **Duration batch**: ~50min

---

## §0 — Esito sintetico

Il full Wave-1 re-run è girato end-to-end e **COMPLETED senza errori** (34509 upserted, 0 failed, R-A2 intatto), ma **NON ha popolato nessuna nuova tabella** (59/134 pre=post). 6 IMPORT target residui restano vuoti per cause **strutturali** (engine silent-filter + scope gap). Condizione HALT P1 di PROMPT §4 → escalation a Cowork, **X20 non eseguito** (no-cascade).

## §1 — Pre-flight (live state, schema reale vs PROMPT)

Tunnel 5433 ristabilito ✅. HEAD `b01c331` descendant di `82a30a1` ✅. **Schema drift PROMPT corretti inline (read-only adaptation, CW-B40/B52)**:
- `brownfield.table_mappings`: colonne `table_mapping_*` (PROMPT usava `classification`/`target_table`/`wave_id` non-prefissati).
- staging tables = `staging.wave1_*` (PROMPT assumeva `staging.brownfield_*`).
- `import_runs` privo di `total_rows_upserted`/`total_errors`; status enum senza `COMPLETED_WITH_ERRORS`.
- Engine NON in `apps/api/src/brownfield/` (path PROMPT errato) → reale: `apps/api/src/modules/brownfield-wave-executor/`.

Baseline: `sys_users=433`, sys.* TRUE populated **59/134**, staging 59211 rows, 83 IMPORT mappings wave1, ultimo run COMPLETED 2026-05-23.

## §2 — Block A: engine state

- CW-B49 patch presente (`upsert-sql.ts` `replaceTargetColsInConflictInference`) ✅.
- Engine test suite (5 file): **40 passed / 1 skipped** — no regression ✅.
- Entrypoint reale: `scripts/run-wave1-fullscale.mjs` (HTTP login+CSRF → POST `/v1/brownfield/wave-executor/runs` `{wave:1,mode:EXECUTE}`).

## §3 — Block B: execution (CW-B48 polling pattern)

- API server `:3001` avviato (RBAC 8 roles/394 mappings). Runner triggerato → nuovo run `6f531559` RUNNING (00:47:45Z).
- Client undici "fetch failed" a ~5min (atteso, CW-B48 keepalive socket timeout) — **server-side prosegue sincrono**. Polling su `brownfield.import_runs` fino a COMPLETE.
- Stall osservato su `wave1_skill_taxonomy_edges` (~8min single INSERT, graph 2-hop) + lineage-resolve query (~5min) — pattern noto CW-B23, NON hang (pg_stat_activity active, no wait_event).
- COMPLETED 01:34:05Z. Phase payloads: STAGE 83 mappings/57313 staged · VALIDATE 57313/0 failed · APPROVE **64**/0 rejected · UPSERT **34509** upserted/34538 lineage.

## §4 — Block C/D: acceptance — **NOT MET**

| Gate PROMPT §2 D | Target | Reale | Esito |
|---|---|---|---|
| sys.* populated | ≥75/134 (soft), floor 60 | **59/134** (pre=post) | ❌ irraggiungibile (solo 19 distinct IMPORT target wave1) |
| IMPORT targets populated | ≥12/15 (3 residual ok) | **13/19, 6 empty** | ❌ 6 > 3 residual ammessi |
| import_runs status | COMPLETED/_WITH_ERRORS | COMPLETED | ✅ |
| total_errors < 10% | — | 0 failed | ✅ |
| R-A2 sys_users | 433 | **433** | ✅ |
| vitest brownfield | 0 regression | 40 passed/1 skip | ✅ |

## §5 — Diagnosi residual (empirica) — vedi halt notify

**Reversal documentato (CW-B58 bidirezionale)**: ipotesi preliminare "residual strutturale, re-run inutile" → confutata da timestamp git (patch CW-B49 17:17 UTC **dopo** ultimo run 16:16 UTC) → premessa PROMPT corretta, run eseguito → esito empirico: residual **confermato strutturale** (2 categorie):

- **(A) Engine silent-filter**: `sys_skill_categories`(32), `sys_activity_classification_mappings`(14), `sys_process_kpi_templates`(81) — AUTO_APPROVED + 0 validation-fail ma **0 upserted, 0 log WARNING/ERROR**. `executeUpsert` filtra tutto silenziosamente (oltre CW-B49). Forensic engine = Cowork.
- **(B) Scope gap**: `sys_blueprint_overrides`, `sys_position_learning_requirements`, `sys_position_skill_requirements` — nessuna `staging.wave1_*` → `stagingTableFor`→null skip. Nessun source Wave-1. Scope decision = Cowork.

## §6 — Bias

- **CW-B60** claimed (registry §2): engine silent-filter su approved+validated mappings + Wave-1 scope gap + meta CW-B52 (acceptance ≥75/134 irraggiungibile). PENDING Cowork forensic. **Non fixato inline** (Inline Mitigation Scope §1.4: engine transform/SUPPORTED_TRANSFORMS = halt+escalate).

## §7 — Commit + halt

- Commit locale: `feat(db): X19 Brownfield Wave 1 re-run post-CW-B49 — COMPLETED, 6-target residual HALT P1` (NO push).
- Halt notify: `cowork/pending/2026-05-25T01-44-28Z__023__halt_engine_residual_6_targets.md`.
- **HALT P1 → X20 NON eseguito** (no-cascade). Await Cowork decision (3 opzioni in halt notify). Tunnel 5433 + API :3001 lasciati UP.

## §8 — Next (Cowork decision)

Opzioni in halt notify: (1) accept-as-residual + procedi X20, (2) forensic engine batch (A), (3) scope batch (B). DECISION AUTHORITY: Enzo.

---

*End REPORT 023 — X19 COMPLETED-clean ma acceptance non raggiunta, HALT P1 engine residual.*
