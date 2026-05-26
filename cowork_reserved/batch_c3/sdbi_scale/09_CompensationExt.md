# Macro-area 09 — Compensation extension

**Lexicon**: SMERTO (Salary-Merit-Equity-Reward-Total)
**Tier 1 / Rank 3** · **Effort 4-6h pilot** · **Volume ~781 rows**

---

## §1 — Source tables in `heuresys_platform.public` (live 2026-05-21)

| Table | Rows | Schema notes |
|---|---|---|
| `salary_history` | 317 | Historical compensation per employee over time |
| `bonus_allocations` | 244 | Bonus pool allocations by tenant/period |
| `merit_recommendations` | 208 | Manager recommendation for raise |
| `equity_grants` | 12 | Stock option grants |
| `compensation_packages` | (unknown, verify) | Bundled offers (may overlap with #2 Recruiting offers) |
| `compensation_cycles` | (unknown, verify) | Annual review cycles |

**Total importable**: ~781 rows confirmed.

---

## §2 — Proposed sys.* new tables

| sys.* table | Note |
|---|---|
| `sys_salary_history` | employee_id, effective_date, salary_amount, currency, reason_code (PROMOTION/MERIT/COLA/etc), source_band_id (FK to existing sys_compensation_bands 75 rows ✅) |
| `sys_bonus_allocations` | tenant_id, period (year), allocation_pool_total, allocation_per_employee jsonb (or normalized) |
| `sys_merit_recommendations` | employee_id, recommender_user_id, recommended_amount, recommended_percent, justification, status, cycle_id |
| `sys_equity_grants` | employee_id, grant_date, vesting_schedule jsonb, share_count, strike_price |
| `sys_compensation_cycles` | Reference cycle (annual review window) |
| `sys_compensation_packages` (optional) | Bundled package linking to recruiting offers cross-area #2 |

**Total new sys.* tables**: 5-6.

---

## §3 — FK resolution strategy

- **employee_id**: lm.employees_core (C3.2 ready).
- **recommender_user_id**: lm.users.
- **band_id (salary_history)**: existing `sys.sys_compensation_bands` (75 rows shipped). Strong FK — verify each salary_history.band_code resolves to a band.
- **tenant_id**: brownfield.tenant_id_mappings.
- **Cross-area dependency**: compensation_packages may FK to #2 sys_recruiting_offers. If #2 not done first, store legacy ref in metadata.

---

## §4 — Estimated complexity

| Dimension | Assessment |
|---|---|
| **Pilot effort** | LOW (4-6h). Small volume, existing sys_compensation_bands provides anchor, simple FK |
| **Dependencies** | C3.2 users+employees. SMERTO foundation extends ✅-shipped sys_compensation_bands |
| **Risks** | salary_history band_code resolution (CW-B26 phantom risk if codes don't match the 75 bands) — PRE-FLIGHT cross-check distinct values |
| **Recommended timing** | Wave 2 (C4 batch), 3rd (after #5 + #1, light close to wave) |

---

## §5 — Recommended order in C4/C5/C6 scale

**C4 batch, 3rd pilot** (light-effort closure of Wave 2 + SMERTO foundation).
