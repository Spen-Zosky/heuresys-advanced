# Macro-area 05 — Time + Leave + Attendance

**Lexicon**: ITLAB (Italian Labor) + GOKMER (KPI relevance via attendance metrics)
**Tier 1 / Rank 1** (HIGHEST PRIORITY) · **Effort 8-12h pilot** · **Volume ~6220 rows**

---

## §1 — Source tables in `heuresys_platform.public` (live 2026-05-21)

| Table | Rows | Schema notes |
|---|---|---|
| `employee_attendance` | 5237 | ✅ live introspect needed — likely daily clock-in/out per employee |
| `employee_time_off_balances` | 501 | Annual balance per employee per leave_type |
| `employee_overtime` | 383 | Overtime approval requests |
| `employee_time_off_requests` | 99 | Leave/PTO requests with status |
| `employee_time_entries` | (unknown, verify) | Granular time logs (may overlap with attendance) |
| `attendance_corrections` | (unknown, verify) | Correction workflow |
| `overtime_approvals` | (unknown, verify) | Approval workflow |
| `holidays` | already in `legacy_mirror.holidays` (144) — ITLAB done | |

**Total importable**: ~6220 rows confirmed + potentially more.

---

## §2 — Proposed sys.* new tables

| sys.* table | Note |
|---|---|
| `sys_employee_attendance` | Date + employee_id + clock_in/out + status. LARGE 5237 rows → partition by tenant_id + month |
| `sys_employee_overtime` | overtime request + approval state |
| `sys_employee_time_off_balances` | employee_id + leave_type_code + balance + accrual_period |
| `sys_employee_time_off_requests` | employee_id + leave_type + start/end dates + status + approver_id |
| `sys_leave_types` | Reference catalog (vacation, sick, parental, public_holiday, etc.) — likely seed or extract from distinct values |
| `sys_attendance_corrections` | (optional, if source populated) |
| `sys_overtime_approvals` | (optional, separate workflow table) |

**Total new sys.* tables**: 4-7. Foundation: ITLAB extends current 144 holidays mirror to full attendance/leave stack.

---

## §3 — FK resolution strategy

- **employee_id**: lm.employees_core (C3.2 ready).
- **tenant_id**: brownfield.tenant_id_mappings.
- **approver_id** (overtime, time_off): lm.users.
- **leave_type_code**: derive `sys_leave_types` reference catalog from DISTINCT values in source, then FK constraint after population.
- **ITLAB CCNL coherence**: leave balances aligned with `legacy_mirror.ccnl_*` already-imported levels. NO cross-FK needed at row level — coherence is policy-driven.

---

## §4 — Estimated complexity

| Dimension | Assessment |
|---|---|
| **Pilot effort** | HIGH (8-12h). Largest single-table volume (5237) + reference catalog derivation + ITLAB CCNL semantic mapping |
| **Dependencies** | C3.2 users + employees. NO cross-macro deps. ITLAB already shipped (holidays/ccnl). |
| **Risks** | Performance on 5237 rows → batch insert chunks 500; UQ index on attendance natural key (employee_id, date) requires verification |
| **Recommended timing** | Wave 2 (C4 batch), 1st (highest priority, foundation for payroll cycle) |

---

## §5 — Recommended order in C4/C5/C6 scale

**C4 batch, 1st pilot** (highest HRMS criticality — payroll cycle blocker).
