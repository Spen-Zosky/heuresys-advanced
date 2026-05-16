# Universal Position-Centric HRMS Architecture

## Purpose

This document defines the reusable HRMS architecture that can be applied to any enterprise after industry-specific BPM generation.

## Core Principle

The central HRMS object is the **Position**, not the Employee.

```text
Enterprise Type
  → Business Processes
  → Organizational Units
  → Positions
  → Job Roles
  → Skills / Competencies
  → Learning Paths
  → KPIs / Objectives
  → Assessment
  → Gap Analysis
  → Career / Succession
  → Compensation Intelligence
```

## Invariant Capabilities

- Organization design.
- Position management.
- Job architecture.
- Role requirements.
- Skills and competency profiles.
- KPI cascading.
- Learning path assignment.
- Position requirements vs person evidence.
- Gap analysis.
- Talent and succession.
- Compensation decision-support.

## Configurable Scope

Each tenant may configure modules as:

```yaml
module_status:
  - IN_SCOPE
  - PARTIALLY_IN_SCOPE
  - OUT_OF_SCOPE
```

This allows Core HR, Payroll, Benefits, IAM, Procurement or Facilities to remain excluded or become active depending on the tenant.
