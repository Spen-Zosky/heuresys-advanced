# Forensic Inventory — `heuresys_advanced.audit`

**Snapshot**: 2026-05-20T02:31Z
**Scope**: 4 tables (audit trail per brownfield import + ESS self-service)
**Provenienza**: migration `000026_brownfield_import_validation.sql` (3 tables) + `000027_ess_inbox_and_audit.sql` (1 table)

---

## §1 — Tables

| Table | Rows | Purpose |
|---|---|---|
| `import_validation_results` | **207276** | Per-row validation audit (most dense audit table) |
| `import_approval_decisions` | 355 | Approval gate decisions per table_mapping |
| `import_run_logs` | 50 | High-level lifecycle events per run (STATE_*, *_COMPLETE) |
| `user_self_service_actions` | 0 | ESS audit (migration 000027, runtime empty) |

---

## §2 — `import_validation_results` (207,276 rows) — rule_code distribution

| Rule code | Status | Count | Significance |
|---|---|---|---|
| `WAVE1_ALL_RULES` | **PASSED** | **206425** | Validation phase passed for nearly every staged row (99.6%) |
| `LEGACY_NULL_LINEAGE_DOCUMENTED_V1` | **WARNING** | 446 | Goal 003 Item K hygiene: documents 446 NULL lineage orphans (decision D8) |
| `HANDLED_VIA_LINEAGE_WRITE_V1` | **SKIPPED** | 405 | LINEAGE_SOURCE_NK transform marker: no target write, lineage emitted |

**3 rule codes attivi**:
1. `WAVE1_ALL_RULES` — generic Wave 1 validation pass (most common)
2. `LEGACY_NULL_LINEAGE_DOCUMENTED_V1` — pre-existing NULL `source_lineage_import_run_id` rows documented (Goal 002 hygiene piggybacked in Goal 003)
3. `HANDLED_VIA_LINEAGE_WRITE_V1` — LINEAGE_SOURCE_NK transform marker (no upsert, lineage-only)

**Note: assenti**:
- `SKIPPED_UNSUPPORTED_TRANSFORM_V1` (count = 0) — confirms 0 unsupported transforms emitted ✅
- `no_conflict_inference_available` (count = 0) — confirms ON CONFLICT inference always available ✅

---

## §3 — `import_approval_decisions` (355 rows)

| Status | Count |
|---|---|
| `APPROVED` | **355** |

Tutte le 355 decisioni sono APPROVED (auto-approve per Wave 1 per design). Nessuna REJECTED / NEEDS_CHANGES / ESCALATED.

---

## §4 — `import_run_logs` (50 rows) — sample lifecycle (latest run `08d3bc9f`)

| Timestamp | Event | Payload |
|---|---|---|
| 18:52:51 | `RUN_CREATED` | `{mode: EXECUTE, wave: 1, initiated_by: 82c89e25...}` |
| 18:52:51 | `STATE_STAGING` | `{}` |
| 18:53:33 | `STAGE_COMPLETE` | `{mappings: 94, staged_rows_total: 41285}` |
| 18:53:33 | `STATE_VALIDATING` | `{}` |
| 18:53:55 | `VALIDATE_COMPLETE` | `{failed_rows_total: 0, validated_rows_total: 41285}` |
| 18:53:55 | `STATE_APPROVED` | `{}` |
| 18:54:05 | `APPROVE_COMPLETE` | `{approved: 71, rejected: 0}` |
| 18:54:05 | `STATE_UPSERTING` | `{}` |
| 19:41:07 | `UPSERT_COMPLETE` | `{lineage_rows_total: 3653, upserted_rows_total: 16733}` |
| 19:41:07 | `STATE_COMPLETE` | `{}` |

**Lifecycle**: 9 events × 5 wave runs Wave 1 + 5 events × 1 K-hygiene run = ~50 events totali.

**Latest run metrics** (Goal 003 retry):
- Wall-clock total: 18:52:51 → 19:41:07 = **48 minuti 16 secondi** (2896s)
- Staging phase: 42s
- Validation phase: 22s
- Approval phase: 10s
- **Upsert phase: 47 minuti 2 secondi** (dominant — è la fase più lenta)
- 41285 staged → 16733 upserted (40% hit ratio) + 3653 lineage rows

---

## §5 — Implicazione SDBI

### §5.1 Audit infrastructure è asset prezioso

207k audit rows = forensic trail RICCHISSIMO per analisi qualità Wave 1 retry. Permette diagnostic post-mortem dettagliato.

Per SDBI: stesso pattern (rule_code + status + payload + run_id) è riusabile. Eventual extension verso nuovi rule_codes (es. `AI_CONFIDENCE_HIGH_ACCEPTED`, `AI_LOW_CONFIDENCE_NEEDS_REVIEW`) è naturale.

### §5.2 Wall-clock 48 minuti per Wave 1 retry è benchmark

Per qualsiasi opzione (1/2/3): qualunque approccio scelto deve gestire questo volume in tempi ragionevoli.

- Wave 1 retry attuale: **48 min** per 16733 upserts + 3653 lineage
- Bottleneck identificato: upsert phase (97% del wall-clock)
- Rate sostenuto: ~6 upserts/sec, ~3.9 lineage/sec
- Scalabilità: per 100k rows totali (target esteso), atteso ~5 ore. Per 200k, ~10 ore.

### §5.3 Validation/Approval già super-fast

42s (staging) + 22s (validation) + 10s (approval) = ~74s totali per 41k rows. Excellent.

Bottleneck è SOLO upsert phase. Optimization mirata su upsert può ridurre wall-clock 5-10×.

---

## §6 — Verification

```sql
SELECT COUNT(*) FROM audit.import_validation_results;  -- 207276
SELECT import_validation_result_rule_code, import_validation_result_status, COUNT(*)
FROM audit.import_validation_results GROUP BY 1,2 ORDER BY 3 DESC;
SELECT COUNT(*) FROM audit.import_approval_decisions;  -- 355
SELECT COUNT(*) FROM audit.import_run_logs;  -- 50
```

---

*End of 02e_ADV_AUDIT.md*
