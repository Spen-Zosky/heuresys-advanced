# Learning Catalogue, Training Initiatives and Gap Closure Specification

## Purpose

This subsystem connects course catalogues and training initiatives to learning paths and gap closure processes.

## Core Chain

```text
Position Skill Requirement
  ↓
Skill Gap
  ↓
Learning Recommendation
  ↓
Learning Assignment
  ↓
Training Initiative
  ↓
Completion Evidence
  ↓
Skill Reassessment
  ↓
Gap Closure
  ↓
Readiness Update
```

## Required Tables

```text
sys.sys_learning_modules
sys.sys_training_initiatives
sys.sys_learning_paths
sys.sys_learning_path_steps
sys.sys_skill_learning_mappings
sys.sys_position_learning_requirements
sys.sys_user_learning_assignments
sys.sys_user_learning_evidence
sys.sys_gap_closure_actions
```

## Course vs Initiative

A learning module is reusable.

A training initiative is a scheduled or organized delivery of a module.

Example:

```text
Module: AML Advanced Training
Initiative: AML Advanced Training — Q2 2026 — Online Cohort 1
```

## Skill-to-Learning Mapping

Use:

```text
skill_id
learning_module_id
supported_from_proficiency_level
supported_to_proficiency_level
mapping_strength
mapping_rationale
validation_status
```

## Gap Closure Status

```yaml
gap_closure_status:
  - NOT_STARTED
  - ASSIGNED
  - IN_PROGRESS
  - COMPLETED_PENDING_ASSESSMENT
  - PARTIALLY_CLOSED
  - CLOSED
  - FAILED
  - EXPIRED
```

## Rule

Training completion is evidence. It is not automatically skill mastery.
