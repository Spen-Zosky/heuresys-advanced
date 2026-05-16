# Career Planning, Talent Mobility and Succession
## Process 17: Career Paths, Mobility, Readiness and Critical Role Coverage

---

# Document Control

| Field | Value |
|---|---|
| Document ID | BPM-BANK-17 |
| Recommended File Name | `17_Career_Planning_Talent_Mobility_and_Succession.md` |
| Process Domain | Career Planning, Talent Mobility, Succession |
| Target Organization | Medium-sized regional retail bank, 158 employees, 5 branches |
| Intended Use | Career path design, talent mobility, successor readiness, critical role coverage |
| Status | Draft for bundle inclusion |
| Version | 1.0 |

---

# 1. Process Overview

The **Career Planning, Talent Mobility and Succession** process uses position intelligence, skill gaps, KPI performance, learning completion, potential indicators and readiness scores to define career paths and succession plans.

Career planning and succession are connected but distinct.

Career planning answers:

```text
Where can this person grow?
Which next positions are realistic?
Which gaps must be closed?
Which time horizon is plausible?
```

Succession answers:

```text
Who can cover this critical position?
Who is ready now?
Who is ready in 6–12 months?
Who is ready in 12–24 months?
What is the continuity risk?
```

---

# 2. Strategic Objectives

- Define position-based career paths.
- Support vertical, lateral, specialist, managerial and cross-functional mobility.
- Identify successors for critical roles.
- Reduce dependency on single incumbents.
- Convert gap analysis into development plans.
- Support retention of high-potential employees.
- Provide evidence-based talent decisions.
- Feed compensation and reward decision-support where appropriate.

---

# 3. Career Path Types

```yaml
career_path_type:
  - VERTICAL_PROMOTION
  - LATERAL_MOBILITY
  - SPECIALIST_TRACK
  - MANAGERIAL_TRACK
  - CROSS_FUNCTIONAL_MOVE
  - SUCCESSION_PATH
  - RESKILLING_PATH
```

Examples:

| Current Position | Target Position | Path Type |
|---|---|---|
| Retail Banker | Branch Manager | Vertical / Managerial |
| Retail Banker | SME Relationship Manager | Lateral / Specialist |
| Credit Analyst | Credit Monitoring Specialist | Specialist |
| Operations Analyst | Risk Analyst | Cross-functional |
| Workforce Planning Specialist | HR Organization Manager | Specialist / Managerial |

---

# 4. Readiness Levels

```yaml
readiness_level:
  - READY_NOW
  - READY_6_MONTHS
  - READY_12_MONTHS
  - READY_24_MONTHS
  - DEVELOPMENT_REQUIRED
  - NOT_SUITABLE
```

For each career or succession move, store:

```text
current_position
target_position
readiness_level
readiness_score
blocking_gaps
development_actions
estimated_time_to_readiness
manager_validation
hr_validation
```

---

# 5. Career Planning Workflow

```text
Employee profile selected
  ↓
Current position intelligence profile
  ↓
Career path candidates
  ↓
Target position requirements
  ↓
Fit and gap analysis
  ↓
Readiness scoring
  ↓
Development plan recommendation
  ↓
Manager / HR validation
  ↓
Career plan approval
  ↓
Monitoring and review
```

---

# 6. Succession Planning Workflow

```text
Critical position identified
  ↓
Position criticality and continuity risk assessment
  ↓
Potential successor pool generation
  ↓
Successor fit and readiness scoring
  ↓
Blocking gap identification
  ↓
Development actions
  ↓
Readiness timeline
  ↓
Management validation
  ↓
Succession plan approval
  ↓
Periodic review
```

---

# 7. Critical Position Coverage

Every critical position should have:

```text
position_criticality
incumbent
backup_person
successor_candidates
readiness_level
coverage_status
single_point_of_failure_flag
replacement_risk
succession_plan_status
```

Coverage statuses:

```yaml
coverage_status:
  - COVERED_READY_NOW
  - COVERED_READY_SOON
  - PARTIALLY_COVERED
  - UNCOVERED
  - CRITICAL_GAP
```

---

# 8. Career and Succession Inputs

- Position Intelligence Profile.
- Employee skill assessments.
- Learning completion.
- KPI performance.
- Behavioral assessment.
- Potential score.
- Manager assessment.
- Readiness score.
- Gap closure plan.
- Position criticality.
- Economic weight.
- Vacancy forecast.
- Workforce plan.

---

# 9. Career and Succession Outputs

- Career path recommendation.
- Target position.
- Development plan.
- Readiness level.
- Mobility recommendation.
- Succession candidate profile.
- Succession pool.
- Critical role coverage dashboard.
- Retention risk signal.
- Promotion readiness signal.
- Compensation review signal.

---

# 10. Core Data Entities

```text
career_path_catalog
career_path_step
position_career_path
employee_career_plan
employee_target_position
career_readiness_assessment
career_gap_plan
career_mobility_recommendation
critical_position
succession_pool
successor_candidate
successor_readiness
succession_gap
succession_development_plan
critical_role_coverage_status
```

---

# 11. Governance Requirements

- Career recommendations must be explainable.
- Succession candidates must be validated by management/HR.
- Sensitive talent data must be access-controlled.
- AI recommendations must remain candidate until validated.
- Critical role coverage must be reviewed periodically.
- Career path decisions must avoid discriminatory logic.
- Historical readiness changes must be retained.

---

# 12. Summary

This process turns workforce intelligence into mobility, development and continuity decisions.

It answers:

```text
What can this person become?
Who can cover this critical role?
What must be developed?
How long will readiness take?
```
