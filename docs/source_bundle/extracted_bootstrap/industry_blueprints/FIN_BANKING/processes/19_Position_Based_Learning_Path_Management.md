# Position-Based Learning Path Management
## Process 15: Learning Paths, Skill Development and Certification Requirements by Position

---

# Document Control

| Field | Value |
|---|---|
| Document ID | BPM-BANK-15 |
| Recommended File Name | `15_Position_Based_Learning_Path_Management.md` |
| Process Domain | Learning, Skills, Certification and Development |
| Target Organization | Medium-sized regional retail bank, 158 employees, 5 branches |
| Intended Use | Position learning paths, skill-gap closure, certification linkage, workforce development |
| Status | Draft for bundle inclusion |
| Version | 1.0 |

---

# 1. Process Overview

The **Position-Based Learning Path Management** process defines training and development paths linked to positions, job roles and required skills.

The person does not receive training because of a generic HR rule only. The person inherits learning requirements from the position occupied, from the skills required by that position, and from the gap between required and actual proficiency.

The core logic is:

```text
Position
  → Required Skills
  → Required Proficiency
  → Required Learning Modules
  → Certifications / Evidence
  → Employee Learning Assignment
```

---

# 2. Strategic Objectives

- Convert position requirements into structured learning paths.
- Link skills and proficiency gaps to specific training modules.
- Support regulatory-sensitive and certification-linked learning where in scope.
- Provide objective evidence for role readiness.
- Support career planning and succession readiness.
- Reduce arbitrary or manual training assignment.
- Feed workforce intelligence and gap-analysis engines.

---

# 3. Process Scope

## 3.1 Included Activities

- Define learning catalogue.
- Define learning modules.
- Define learning paths by position.
- Map skills to learning modules.
- Define minimum proficiency supported by each learning module.
- Define mandatory, preferred and developmental learning requirements.
- Generate employee learning assignments from position requirements.
- Track completion and evidence.
- Use learning completion in fit, readiness and gap scoring.
- Recommend learning paths for career moves and succession.

## 3.2 Partially Out of Scope

- Mandatory training governance is partially out of scope where it becomes a formal compliance administration process.
- Certification evidence may be used for readiness and skills intelligence, while operational compliance tracking may be handled elsewhere.

## 3.3 Out of Scope

- Payroll-linked training reimbursement.
- Provider procurement.
- External vendor management.
- Full LMS administration.
- Legal compliance administration.

---

# 4. Learning Architecture

```text
Skill Requirement
  ↓
Learning Objective
  ↓
Learning Module
  ↓
Learning Path
  ↓
Position Learning Requirement
  ↓
Employee Learning Assignment
  ↓
Completion Evidence
  ↓
Skill / Readiness Update
```

---

# 5. Learning Requirement Types

| Type | Meaning |
|---|---|
| Required | Needed to perform the position. |
| Preferred | Useful but not mandatory. |
| Developmental | Needed for career growth or succession. |
| Certification-linked | Required for formal evidence/certification. |
| Remedial | Assigned to close a performance or skill gap. |
| Optional | Available for enrichment. |

---

# 6. Learning Path Examples

## 6.1 Branch Manager

| Skill / Requirement | Learning Module | Requirement Type |
|---|---|---|
| Branch operations management | Branch Management Fundamentals | Required |
| AML escalation handling | AML for Branch Managers | Certification-linked |
| Team leadership | People Management for Managers | Required |
| Sales performance monitoring | Commercial Dashboard Training | Required |
| Conduct risk awareness | Conduct Risk and Customer Protection | Required |
| Operational risk awareness | Operational Risk in Branches | Required |

## 6.2 Retail Credit Analyst

| Skill / Requirement | Learning Module | Requirement Type |
|---|---|---|
| Creditworthiness assessment | Retail Credit Analysis | Required |
| Financial statement analysis | Financial Statements for Lending | Required |
| Collateral evaluation | Guarantees and Collateral | Required |
| Credit policy knowledge | Credit Policy and Delegation Rules | Required |
| Risk documentation quality | Credit File Quality Standards | Required |
| Analytical judgment | Credit Case Simulation Workshop | Developmental |

## 6.3 AML Officer

| Skill / Requirement | Learning Module | Requirement Type |
|---|---|---|
| Suspicious transaction analysis | Advanced AML Investigation | Required |
| KYC due diligence | KYC and Customer Due Diligence | Required |
| Sanctions screening | Sanctions and PEP Screening | Required |
| Regulatory reporting | AML Reporting Obligations | Certification-linked |
| Investigation documentation | AML Case Documentation | Required |

## 6.4 Workforce Planning & Organization Specialist

| Skill / Requirement | Learning Module | Requirement Type |
|---|---|---|
| Workforce planning | Workforce Planning Methods | Required |
| Job architecture design | Job Architecture and Role Frameworks | Required |
| Position management | Position-Centric HRMS Design | Required |
| Skills gap analysis | Competency Gap Analytics | Required |
| Organizational design | Organization Design for Banking | Required |

---

# 7. Learning Assignment Rules

## 7.1 Position Inheritance Rule

An employee inherits learning requirements from the position occupied.

```text
employee_position_assignment
  → position_learning_requirements
  → employee_learning_assignments
```

## 7.2 Gap-Driven Rule

If actual proficiency is below required proficiency, assign remedial or developmental learning.

```text
required_proficiency > assessed_proficiency
  → learning_gap
  → recommended_learning_modules
```

## 7.3 Career Path Rule

If an employee is mapped to a target position, assign target-position learning gaps.

```text
target_position
  → target_position_skill_requirements
  → target_learning_path
```

## 7.4 Succession Rule

If a person is a successor candidate, assign learning required to reach readiness.

```text
succession_candidate
  → readiness_gap
  → succession_development_learning_path
```

---

# 8. Proficiency Model

| Level | Label | Meaning |
|---:|---|---|
| 1 | Awareness | Understands terms and basic concepts. |
| 2 | Working Knowledge | Can apply the skill in standard situations. |
| 3 | Practitioner | Works independently in normal cases. |
| 4 | Advanced | Handles complex cases and supports others. |
| 5 | Expert | Defines standards, trains others, manages exceptions. |

Learning modules should specify the proficiency level they support.

Example:

```text
Retail Credit Analysis
  supports proficiency from 1 to 3

Advanced Credit Risk Workshop
  supports proficiency from 3 to 4
```

---

# 9. Core Data Entities

```text
learning_catalog
learning_module
learning_path
learning_path_step
position_learning_requirement
skill_learning_module_map
certification_requirement
employee_learning_assignment
learning_completion_record
learning_evidence
learning_gap
learning_recommendation
```

---

# 10. Assessment and Evidence

Learning completion should not automatically equal mastery.

Evidence should include:

| Evidence Type | Confidence |
|---|---|
| Course completion | Medium |
| Exam passed | High |
| Certification achieved | High |
| Manager observation | Medium |
| Simulation result | Medium/High |
| KPI improvement after training | High if measurable |
| AI-inferred improvement | Candidate only |

---

# 11. Output to Downstream Processes

This process feeds:

- skill gap analysis;
- readiness scoring;
- career planning;
- succession planning;
- talent development;
- compensation recommendation where learning/certification gates apply;
- workforce analytics.

---

# 12. Summary

This process transforms learning from a generic HR activity into a position-driven capability-building mechanism.

Its core rule is:

```text
The position defines the required learning path.
The person inherits it.
The system compares completion and evidence against role requirements.
```
