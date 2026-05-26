# Macro-area 08 — Predictions + ML

**Lexicon**: EPRA (Embedding-Prediction-Recommendation-Action) — already partially shipped via embeddings in sys_skills
**Tier 3 / Rank 11 — LAST** · **Effort 4-6h pilot** · **Volume ~550 rows**

---

## §1 — Source tables in `heuresys_platform.public` (live 2026-05-21)

| Table | Rows | Schema notes |
|---|---|---|
| `model_predictions` | 267 | Generic ML prediction outputs per employee per model |
| `turnover_risk_scores` | 267 | Specific prediction subset — turnover-focused. Possibly view of model_predictions or distinct table |
| `predictive_models` | 16 | Model registry (id, name, version, type, training_date) |
| `prediction_features` | (unknown, verify) | Feature inputs to predictions |
| `model_training_jobs` | (unknown, verify) | Training run logs |

**Total importable**: ~550 rows confirmed.

---

## §2 — Proposed sys.* new tables

| sys.* table | Note |
|---|---|
| `sys_predictive_models` | model_id, model_name, model_version, model_type, training_date, owner_user_id |
| `sys_model_predictions` | prediction_model_id → sys_predictive_models, prediction_subject_user_id → lm.users, prediction_value, prediction_confidence, prediction_at, prediction_features jsonb |
| `sys_turnover_risk_scores` | Specialized view OR separate table. Recommend SEPARATE (specific score schema) |
| `sys_prediction_features` (optional, if source populated) | Feature inputs |

**Total new sys.* tables**: 3-4.

---

## §3 — FK resolution strategy

- **prediction_subject_user_id / prediction_subject_employee_id**: lm.users / lm.employees_core.
- **prediction_model_id**: sys_predictive_models (within macro-area). Insert models FIRST.
- **Cross-area dependency**: predictions are typed against features from #1 Performance, #2 Recruiting, #5 Time, etc. → run LAST after all input features exist. Defer FK to features as metadata jsonb (not strict FK).

---

## §4 — Estimated complexity

| Dimension | Assessment |
|---|---|
| **Pilot effort** | LOW (4-6h). 16 + 267 + 267 rows is light. Schema is straightforward |
| **Dependencies** | C3.2 users+employees. Soft on ALL OTHER macro-aree (uses their outputs as input features) → schedule LAST |
| **Risks** | Stale predictions (snapshot at import time may already be outdated). Flag in metadata |
| **Recommended timing** | Wave 4 (C6 batch), LAST (#11 = 4th and #8 = LAST) |

---

## §5 — Recommended order in C4/C5/C6 scale

**C6 batch, LAST pilot** (depends on all features being in place; can be re-run later when models retrained).
