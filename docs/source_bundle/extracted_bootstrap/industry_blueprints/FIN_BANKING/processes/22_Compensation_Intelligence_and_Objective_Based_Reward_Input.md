# Compensation Intelligence and Objective-Based Reward Input
## Process 18: Reward Decision Support, Objective Valuation and Payroll Handoff

---

# Document Control

| Field | Value |
|---|---|
| Document ID | BPM-BANK-18 |
| Recommended File Name | `18_Compensation_Intelligence_and_Objective_Based_Reward_Input.md` |
| Process Domain | Compensation Decision-Support, Variable Pay, Reward Input |
| Target Organization | Medium-sized regional retail bank, 158 employees, 5 branches |
| Intended Use | Objective-based reward input, variable pay recommendation, compensation review support |
| Status | Draft for bundle inclusion |
| Version | 1.0 |

---

# 1. Process Overview

The **Compensation Intelligence and Objective-Based Reward Input** process uses position value, role criticality, KPI achievement, objective weighting, performance evidence and governance gates to produce compensation decision-support.

This process does **not** execute payroll and does **not** administer benefits.

It produces structured recommendations and handoff outputs for authorized compensation review and external payroll/benefits execution where applicable.

The scope boundary is:

```text
In scope:
  compensation intelligence
  objective achievement valuation
  variable pay recommendation
  salary review signal
  reward governance gates
  payroll handoff record

Out of scope:
  payroll execution
  tax/contribution calculation
  payslip generation
  benefit enrollment
  welfare provider administration
```

---

# 2. Strategic Objectives

- Link objective achievement to economic reward input.
- Support fair and explainable compensation review.
- Connect compensation recommendations to position weight and role criticality.
- Avoid rewarding excessive risk-taking or poor conduct.
- Provide auditable variable pay calculations.
- Support manager and executive compensation approval workflows.
- Produce structured handoff to payroll execution systems without becoming payroll.

---

# 3. Compensation Intelligence Chain

```text
Position
  ↓
Role level / criticality / economic weight
  ↓
Assigned objectives / KPIs
  ↓
Objective weights
  ↓
Measured achievement
  ↓
Performance score
  ↓
Reward eligibility gates
  ↓
Variable pay / compensation recommendation
  ↓
Human approval
  ↓
Payroll / Benefits execution handoff
```

---

# 4. Position Economic Weight

Each position should have a strategic economic weight.

This is not salary and not payroll. It is an HRMS intelligence indicator.

It may consider:

- role level;
- business impact;
- KPI contribution;
- budget responsibility;
- risk exposure;
- skill scarcity;
- criticality;
- customer impact;
- regulatory impact.

Example:

| Position | Economic Weight |
|---|---:|
| CEO / Direzione Generale | 100 |
| Head of Credit | 85 |
| AML Officer | 70 |
| Branch Manager | 65 |
| Retail Relationship Manager | 50 |
| Back Office Officer | 35 |

---

# 5. Objective Economic Valuation

Each objective/KPI should have:

```text
objective_id
position_id
employee_id
period_id
objective_weight
target_value
actual_value
achievement_percentage
capped_achievement_percentage
weighted_score
economic_weight
bonus_pool_eligibility
payout_curve_id
calculated_reward_amount
manager_adjustment
final_approved_reward_amount
approval_status
```

---

# 6. Payout Curve Model

A payout curve prevents naive linear payout.

Example:

| Achievement | Payout Factor |
|---:|---:|
| <80% | 0% |
| 80–99% | 50–90% |
| 100% | 100% |
| 101–120% | 110–130% |
| >120% | Capped at 130% |

Example formula:

```text
variable_reward =
  target_bonus
  × weighted_objective_score
  × payout_factor
  × role_multiplier
  × company_modifier
  × manager_adjustment
```

---

# 7. Banking-Specific Reward Gates

In banking, incentive systems must not reward outcomes achieved through conduct, risk or compliance failures.

Suggested gates:

```yaml
reward_gate:
  - CONDUCT_GATE
  - COMPLIANCE_GATE
  - RISK_GATE
  - TRAINING_GATE
  - CERTIFICATION_GATE
  - CUSTOMER_HARM_GATE
  - AUDIT_FINDING_GATE
```

Example:

```text
Commercial target achieved = 120%
but conduct gate failed
→ payout blocked or escalated
```

Gate outputs:

```yaml
gate_status:
  - PASSED
  - WARNING
  - BLOCKED
  - ESCALATED
  - OVERRIDDEN_WITH_REASON
```

---

# 8. Compensation Review Signals

The system may generate:

- variable pay recommendation;
- salary review recommendation;
- promotion-related compensation signal;
- retention risk signal;
- below-band / above-band positioning signal;
- high-performance recognition signal;
- conduct/risk-based reduction signal;
- compensation governance warning.

---

# 9. Benefits Boundary

Benefits administration is out of scope.

However, the system may generate decision-support signals such as:

```text
reward tier
benefit eligibility signal
retention package signal
career level impact
recognition programme suggestion
```

The system must not manage:

```text
benefit enrollment
insurance administration
welfare provider workflows
payroll deductions
provider payments
```

---

# 10. Compensation Workflow

```text
Assessment period closed
  ↓
KPI/objective achievement calculated
  ↓
Weighted performance score generated
  ↓
Reward gates applied
  ↓
Position economic weight and role multiplier applied
  ↓
Compensation recommendation generated
  ↓
Manager review
  ↓
HR / Compensation review
  ↓
Executive approval if required
  ↓
Payroll handoff record generated
  ↓
Audit trail archived
```

---

# 11. Core Data Entities

```text
compensation_band
position_compensation_profile
position_economic_weight
employee_compensation_positioning
objective_reward_rule
payout_curve
bonus_pool
objective_achievement_result
variable_pay_calculation
reward_gate
reward_gate_result
manager_adjustment
compensation_recommendation
compensation_review_decision
payroll_handoff_record
compensation_audit_trail
```

---

# 12. Governance Requirements

- Compensation recommendations must be explainable.
- Objective weights must be approved before the period begins.
- Payout curves must be versioned.
- Manager adjustments must require reason.
- Reward gates must be visible and auditable.
- Blocked or escalated payouts require documented decision.
- Payroll handoff must be controlled and traceable.
- AI-generated compensation recommendations must remain candidate until approved.

---

# 13. Summary

This process turns position-based objectives and performance results into structured compensation decision-support.

It preserves the scope boundary:

```text
Compensation intelligence = in scope
Objective-based economic valuation = in scope
Reward recommendation = in scope
Payroll execution = out of scope
Benefits administration = out of scope
```
