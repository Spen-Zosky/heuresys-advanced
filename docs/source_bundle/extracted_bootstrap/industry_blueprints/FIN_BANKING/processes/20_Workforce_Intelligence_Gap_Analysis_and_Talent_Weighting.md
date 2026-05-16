# Workforce Intelligence, Gap Analysis and Talent Weighting
## Process 16: Position Fit, Gap Scoring, Readiness and Talent Analytics

---

# Document Control

| Field | Value |
|---|---|
| Document ID | BPM-BANK-16 |
| Recommended File Name | `16_Workforce_Intelligence_Gap_Analysis_and_Talent_Weighting.md` |
| Process Domain | Workforce Intelligence, Gap Analysis, Talent Scoring |
| Target Organization | Medium-sized regional retail bank, 158 employees, 5 branches |
| Intended Use | Fit scoring, gap prioritization, readiness assessment, talent intelligence |
| Status | Draft for bundle inclusion |
| Version | 1.0 |

---

# 1. Process Overview

The **Workforce Intelligence, Gap Analysis and Talent Weighting** process aggregates position requirements and person evidence to calculate fit, gaps, readiness, development priority and talent signals.

The core analytical comparison is:

```text
Position Requirement
  vs
Person Evidence
```

This process is the analytical engine that converts the static blueprint into an actionable workforce intelligence system.

---

# 2. Strategic Objectives

- Measure employee-position fit.
- Identify skill, learning, certification, KPI, behavioral and succession gaps.
- Prioritize gaps by severity and business impact.
- Estimate time to close gaps.
- Calculate readiness for current and target positions.
- Feed career planning and succession processes.
- Feed compensation intelligence where relevant.
- Provide explainable AI/rule-generated recommendations.
- Support human validation and management approval.

---

# 3. Position Intelligence Profile

The central object is the **Position Intelligence Profile**.

It aggregates:

```text
Organization placement
Job role
ESCO occupation
Required skills
Required proficiency
Learning paths
KPIs / objectives
Assessment methods
Career paths
Succession relevance
Compensation profile
Risk / compliance relevance
Position criticality
Economic weight
```

This profile is the source of requirements.

---

# 4. Requirement vs Evidence Model

| Position Requirement | Person Evidence |
|---|---|
| Required skill | Assessed skill |
| Required proficiency | Measured proficiency |
| Required learning path | Completed training |
| Required certification | Certification evidence |
| Required KPI | Actual KPI result |
| Required behavior | Manager / 360 assessment |
| Required experience | Career history |
| Required readiness | Talent / succession assessment |

The system must never confuse requirements with evidence.

---

# 5. Position Criticality Model

Suggested values:

```yaml
position_criticality:
  - LOW
  - STANDARD
  - IMPORTANT
  - CRITICAL
  - KEY_ROLE
  - REGULATED_CRITICAL_ROLE
```

Criticality drivers:

- business impact;
- customer impact;
- regulatory impact;
- scarcity of skills;
- succession difficulty;
- single-point-of-failure risk;
- operational continuity impact;
- economic weight.

---

# 6. Evidence Quality and Confidence

Every evidence record should carry:

```text
evidence_source
evidence_date
evidence_quality
confidence_score
validated_by
validation_status
```

Evidence examples:

| Evidence | Confidence |
|---|---:|
| Formal certification | High |
| Passed exam | High |
| System-measured KPI | High |
| Manager assessment | Medium |
| 360 feedback | Medium |
| Self-assessment | Low/Medium |
| AI-inferred skill | Candidate only |
| LMS completion | Medium for completion; lower for mastery |

---

# 7. Gap Types

```yaml
gap_type:
  - SKILL_GAP
  - PROFICIENCY_GAP
  - LEARNING_GAP
  - CERTIFICATION_GAP
  - KPI_GAP
  - EXPERIENCE_GAP
  - BEHAVIORAL_GAP
  - SUCCESSION_GAP
  - COVERAGE_GAP
  - REGULATORY_GAP
```

Each gap should have:

```text
gap_severity
gap_priority
gap_owner
target_closure_date
recommended_action
estimated_time_to_close
evidence
status
```

---

# 8. Gap Severity

Suggested values:

```yaml
gap_severity:
  - LOW
  - MEDIUM
  - HIGH
  - CRITICAL
```

Severity formula should consider:

```text
position criticality
mandatory level
regulatory sensitivity
current proficiency gap
KPI impact
time to close
succession relevance
business continuity risk
```

Example:

| Gap | Severity |
|---|---|
| Missing AML certification for AML Officer | Critical |
| No successor for Head of Credit | Critical |
| Missing advanced SQL for BI Analyst | Medium/High |
| Weak customer empathy for teller | Medium |
| Missing optional course | Low |

---

# 9. Time to Close Gap

Every gap should estimate:

```text
time_to_close_days
effort_level
learning_required
practice_required
manager_support_required
certification_required
```

Examples:

| Gap | Time to close |
|---|---:|
| Internal policy training | 5 days |
| AML advanced course | 30–60 days |
| Credit risk modelling | 6–12 months |
| Leadership maturity | 12–24 months |

---

# 10. Scoring Dimensions

| Score | Meaning |
|---|---|
| Skill Fit Score | Match between required and actual skills. |
| Learning Completion Score | Completion of required learning path. |
| Certification Score | Required certification coverage. |
| KPI Performance Score | Measured role performance. |
| Behavioral Score | Soft/leadership assessment. |
| Potential Score | Future-readiness signal. |
| Succession Readiness Score | Readiness for target/critical role. |
| Risk Score | Exposure created by critical gaps. |

---

# 11. Position Readiness Index

Example baseline formula:

```text
Position Readiness Index =
  35% Skill Fit
+ 20% KPI Performance
+ 15% Learning Completion
+ 10% Certification Coverage
+ 10% Behavioral Assessment
+ 10% Manager / Talent Assessment
```

The weighting profile must be configurable by role family.

Example:

| Role Family | Skill Weight | KPI Weight | Compliance Weight |
|---|---:|---:|---:|
| Branch roles | 25% | 35% | 20% |
| Credit roles | 35% | 25% | 25% |
| Compliance roles | 30% | 20% | 35% |
| IT roles | 40% | 25% | 15% |
| HR/Organization roles | 35% | 25% | 10% |

---

# 12. Weighting Engines

## 12.1 Position Requirement Weighting Engine

Determines the relative importance of each skill, KPI, learning module, certification or assessment element for the position.

## 12.2 Employee Fit Engine

Compares person evidence against position requirements.

Outputs:

```text
fit score
gap score
gap severity
gap priority
recommended actions
```

## 12.3 Development Priority Engine

Prioritizes gaps based on:

```text
position criticality
mandatory level
regulatory sensitivity
KPI impact
succession relevance
gap severity
time to close gap
```

## 12.4 Talent and Succession Engine

Identifies:

```text
high-potential employees
successors for critical roles
ready-now candidates
ready-soon candidates
development-needed candidates
single-point-of-failure positions
```

---

# 13. Core Data Entities

```text
position_intelligence_profile
position_requirement_weight
role_weighting_profile
person_evidence_record
skill_assessment
kpi_assessment
learning_evidence
certification_evidence
behavioral_assessment
employee_position_fit_score
gap_analysis_result
gap_closure_plan
readiness_score
talent_score
succession_score
```

---

# 14. Governance Requirements

- All AI/rule-generated scores must be explainable.
- Evidence source and confidence must be visible.
- Scores should remain candidate until validated where used for material decisions.
- Regulatory gaps must override normal weighting where required.
- Gap closure plans must have owners and deadlines.
- Historical score versions must be retained.

---

# 15. Summary

This process is the intelligence layer that evaluates how well a person fits a position and what must be done to improve readiness.

It feeds:

```text
career planning
succession planning
development plans
learning recommendations
compensation decision-support
workforce risk analytics
```
