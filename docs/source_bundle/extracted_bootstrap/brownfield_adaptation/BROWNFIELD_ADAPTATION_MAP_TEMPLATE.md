# Brownfield Adaptation Map Template

The Development Team must produce `BROWNFIELD_ADAPTATION_MAP.md` before writing final import scripts.

## Required Matrix

| Existing Table | Existing Domain | Target Table | Strategy | Scope Status | Import Priority | Notes |
|---|---|---|---|---|---|---|
| public.tenants | tenant foundation | sys.sys_tenancies | IMPORT_ADAPT | IN_SCOPE | 1 | Rename id → tenant_id. |
| public.users | identity/auth | sys.sys_users + sys.sys_auth_* | SPLIT_TRANSFORM | PARTIAL | 2 | Separate identity from auth credentials. |
| public.job_templates | job architecture | sys.sys_job_roles | IMPORT_ADAPT | IN_SCOPE | 1 | Map templates to job roles. |
| public.tenant_jobs | tenant job/position | sys.sys_positions | TRANSFORM | IN_SCOPE | 2 | Must separate job role from position seat. |
| public.esco_skills | skills | sys.sys_skills | IMPORT_ADAPT | IN_SCOPE | 1 | Preserve ESCO URI as natural key. |
| public.courses | learning | sys.sys_learning_modules | IMPORT_ADAPT | IN_SCOPE | 1 | Convert to learning modules. |
| public.learning_paths | learning | sys.sys_learning_paths | IMPORT_ADAPT | IN_SCOPE | 1 | Convert path/course links to steps. |
| public.org_chart_snapshots | visualization | sys.sys_visualization_* | TRANSFORM | IN_SCOPE | 3 | Derive graph/nodes/edges. |
| public.employees_payroll | payroll | none | EXCLUDE | OUT_OF_SCOPE | none | Payroll execution out of scope. |
| public.medical_certificates | medical | none | EXCLUDE | OUT_OF_SCOPE | none | Medical/anamnestic data out of scope. |

## Strategy Values

```yaml
strategy:
  - IMPORT_ADAPT
  - SPLIT_TRANSFORM
  - TRANSFORM
  - REFERENCE_ONLY
  - EXCLUDE
```

## Scope Status

```yaml
scope_status:
  - IN_SCOPE
  - PARTIALLY_IN_SCOPE
  - OUT_OF_SCOPE
  - SENSITIVE_REVIEW_REQUIRED
```

## Priority

```yaml
import_priority:
  - 1_LOW_RISK_CATALOGUES
  - 2_TENANT_OPERATING_MODEL
  - 3_SYNTHETIC_PERSON_EVIDENCE
  - 4_ADVANCED_INTELLIGENCE
  - EXCLUDED
```
