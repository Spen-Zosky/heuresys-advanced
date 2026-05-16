# KPI Library, Cascading and Assessment Model
## Process 14: Process KPI Definition, Distribution and Assessment

---

# Document Control

| Field | Value |
|---|---|
| Document ID | BPM-BANK-14 |
| Recommended File Name | `14_KPI_Library_Cascading_and_Assessment_Model.md` |
| Process Domain | KPI Governance, Performance Measurement and Assessment |
| Target Organization | Medium-sized regional retail bank, 158 employees, 5 branches |
| Intended Use | KPI catalogue design, BPM process measurement, role-based performance assignment, objective weighting, assessment governance |
| Status | Draft for bundle inclusion |
| Version | 1.0 |

---

# 1. Process Overview

The **KPI Library, Cascading and Assessment Model** process defines how business-process KPIs are identified, standardized, distributed and assessed across the operating model of the bank.

The process connects:

```text
Business Process
  → Organizational Unit
  → Position / Job Role
  → Individual Employee
```

Its purpose is to ensure that every relevant position inherits a coherent set of performance expectations from the business processes in which it participates.

This process is **position-centric**. The system does not begin by assigning arbitrary objectives to people. Instead, it defines process-level KPIs, maps them to organizational units and positions, and only then assigns them to the person occupying the position.

---

# 2. Strategic Objectives

- Create a controlled KPI catalogue for banking BPM processes.
- Link process performance to organizational accountability.
- Convert process KPIs into position-specific performance expectations.
- Support objective weighting, performance assessment and compensation decision-support.
- Make KPI assignment explainable, auditable and reusable.
- Enable comparison across branches, departments, roles and periods.
- Support downstream gap analysis, career planning, talent management and reward input.

---

# 3. Process Scope

## 3.1 Included Activities

- Define KPI catalogue.
- Map KPIs to BPM processes.
- Map KPIs to organizational units.
- Map KPIs to positions and job roles.
- Define metric formulas and data sources.
- Define assessment methodology.
- Define KPI target values.
- Define KPI weights by position/role.
- Define assessment period and measurement frequency.
- Record KPI measurements.
- Calculate weighted KPI achievement.
- Feed performance, talent and compensation intelligence layers.

## 3.2 Excluded Activities

- Payroll execution.
- Final bonus payment.
- Accounting entries.
- Legal employment disputes.
- Pure financial reporting not linked to workforce or process performance.
- Benefits administration.

---

# 4. KPI Cascade Model

```text
Enterprise Strategy
  ↓
Business Process Objective
  ↓
Process KPI
  ↓
Organizational Unit Contribution
  ↓
Position KPI Requirement
  ↓
Employee KPI Assignment
  ↓
Assessment Result
  ↓
Weighted Performance Score
  ↓
Talent / Career / Compensation Intelligence
```

---

# 5. KPI Catalogue Structure

Each KPI should contain:

| Field | Description |
|---|---|
| KPI Code | Unique identifier. |
| KPI Name | Business-friendly label. |
| KPI Description | Meaning and rationale. |
| Process Domain | BPM process to which the KPI belongs. |
| KPI Type | Operational, financial, risk, compliance, customer, people, digital, quality. |
| Metric Formula | Calculation logic. |
| Unit of Measure | %, number, days, euro, score, index. |
| Data Source | System, manual assessment, survey, workflow log, audit evidence. |
| Frequency | Daily, weekly, monthly, quarterly, annual. |
| Assessment Method | Quantitative, manager assessment, compliance evidence, SLA, customer feedback, etc. |
| Target Rule | Static target, benchmark, threshold, trend, peer comparison. |
| Weighting Eligibility | Whether it can be weighted into role/employee assessment. |
| Compensation Relevance | Whether it contributes to reward calculation. |
| Governance Owner | Process owner or function owner. |
| Validation Status | Candidate, domain validated, HR validated, management approved. |

---

# 6. Assessment Methodologies

| Assessment Method | Description | Example |
|---|---|---|
| Quantitative System Metric | Automatically measured from source systems. | Credit decision turnaround time. |
| Workflow SLA Metric | Measured from BPM timestamps. | Account opening cycle time. |
| Manager Assessment | Rated by direct manager against structured rubric. | Leadership quality. |
| Compliance Evidence | Based on audit/control completion. | AML escalation timeliness. |
| Quality Review | Based on sampled file or case review. | Credit file completeness. |
| Customer Feedback | Based on survey, NPS or complaint data. | Branch service quality. |
| 360 Feedback | Multi-source assessment. | Team collaboration. |
| AI-Assisted Signal | AI-suggested indicator requiring human validation. | Anomaly in productivity pattern. |

---

# 7. Banking KPI Families

| KPI Family | Examples |
|---|---|
| Retail Banking Operations | Account opening time, first-time-right rate, service availability. |
| Payments & Transactions | Transaction success rate, exception rate, reconciliation breaks. |
| Cash & ATM | ATM uptime, cash discrepancy ratio, replenishment SLA. |
| Credit | Time to credit decision, file quality, delinquency early warning. |
| Risk | Risk appetite utilization, operational risk events, mitigation closure. |
| Compliance / AML | Alert closure time, KYC completion, overdue cases. |
| Finance & Treasury | Closing timeliness, budget variance, liquidity reporting timeliness. |
| Commercial | Sales conversion, portfolio growth, customer retention, cross-selling. |
| Branch | Waiting time, customer satisfaction, branch target achievement. |
| IT & Digital | System availability, incident resolution, digital adoption. |
| People / HRMS | Vacancy rate, skill gap index, training completion, succession coverage. |

---

# 8. KPI Distribution Rules

## 8.1 Process-to-Unit Rule

A KPI is assigned to an organizational unit if the unit materially contributes to the process outcome.

Example:

```text
Credit Origination KPI
  → Credit Department
  → Branch Network
  → Risk / Compliance where applicable
```

## 8.2 Unit-to-Position Rule

A KPI is assigned to a position if the position has direct accountability, operational contribution or control influence over the KPI.

Example:

```text
Branch customer satisfaction
  → Branch Manager
  → Universal Banker
  → Retail Relationship Manager
```

## 8.3 Position-to-Person Rule

The employee inherits KPI assignments from the position occupied during the assessment period.

If the person changes position during the period, assignment must be prorated or split by period.

---

# 9. KPI Weighting Rules

Each position should have a KPI weighting profile.

Example: Branch Manager

| KPI | Weight |
|---|---:|
| Branch commercial target achievement | 25% |
| Customer satisfaction | 20% |
| Operational error rate | 15% |
| AML/KYC escalation timeliness | 15% |
| Team training completion | 10% |
| Branch staffing coverage | 15% |

Rules:

- Total position KPI weight must equal 100%.
- Mandatory/regulatory KPIs may act as gates, not only as weighted metrics.
- Some KPIs may be informational and not included in scoring.
- Compensation-relevant KPIs must be explicitly flagged.
- Managerial override must require reason and approval.

---

# 10. KPI Assessment Output

Each KPI assessment should produce:

```text
target_value
actual_value
achievement_percentage
capped_achievement_percentage
weighted_score
assessment_status
evidence_source
evidence_quality
validated_by
validated_at
```

---

# 11. Core Data Entities

```text
kpi_catalog
process_kpi_template
org_unit_kpi_template
position_kpi_requirement
role_kpi_requirement
employee_kpi_assignment
kpi_metric_definition
kpi_target
kpi_measurement
kpi_assessment_method
kpi_weighting_rule
kpi_assessment_result
```

---

# 12. Governance Requirements

- KPIs must have clear owner.
- KPIs must have documented formula and data source.
- KPIs must be versioned.
- Position KPI weight must sum to 100%.
- Compensation-relevant KPIs require management approval.
- Regulatory or conduct KPIs may override commercial achievement.
- AI-suggested KPIs must remain candidate until validated.

---

# 13. Output to Downstream Processes

The process feeds:

- performance assessment;
- objective achievement calculation;
- compensation intelligence;
- talent segmentation;
- career planning;
- succession readiness;
- gap analysis;
- workforce analytics.

---

# 14. Summary

This process converts BPM performance expectations into position-level and employee-level assessment objects.

It is the bridge between:

```text
Business process performance
  → role accountability
  → employee assessment
  → talent / career / compensation intelligence
```
