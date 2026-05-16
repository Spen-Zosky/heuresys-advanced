# Company HRMS / BPM Idempotent Blueprint Bundle

> This bundle is intentionally named **Company** because the architecture is generalizable across enterprise types. The included `FIN_BANKING` folder is the current banking reference blueprint, not the bundle boundary.


Generated: 2026-05-15 14:23:41

This is the canonical, idempotent company HRMS/BPM blueprint bundle, with FIN_BANKING as the included industry reference implementation.

## What This Bundle Is

This package is a **generalizable company HRMS/BPM blueprint-generation framework** and includes **FIN_BANKING** as a reference industry implementation that can later be reused for other enterprise types by replacing the industry-specific BPM layer.

## Reference Enterprise

| Attribute | Value |
|---|---|
| Enterprise type | Regional retail bank |
| Country context | Italy |
| Total employees | 158 |
| Branches | 5 |
| Branch employees | 25 total |
| Branch staffing model | 5 employees per branch |
| HRMS core object | Position |
| Industry blueprint | FIN_BANKING / Regional Retail Bank / Medium |

## Bundle Structure

```text
Company_HRMS_BPM_Idempotent_Blueprint_Bundle/
  README.md
  INDEX.md
  ISTRUZIONI.md
  manifest.json
  LOGICAL_DATA_MODEL_ADDENDUM.md
  config/
    process_registry.json
    scope_matrix.json
  schemas/
    position_intelligence_profile.schema.json
  scripts/
    apply_bundle.py
    apply_bundle.ps1
    apply_bundle.sh
    validate_bundle.py
  universal_hrms_framework/
    U01_...
  industry_blueprints/
    FIN_BANKING/
      processes/
        00_...
        ...
        22_...
  tenant_blueprints/
    RTL_BANK_REFERENCE/
      tenant_profile.json
      tenant_profile.yaml
```

## Canonical Numbering

- `00` = Enterprise Typing and Blueprint Configuration.
- `01–17` = core banking BPM process architecture.
- `18–22` = position-centric HRMS intelligence extension processes.

## Generalization Rule

The following layers are invariant:

- Enterprise Typing & Blueprint Configuration.
- Position-centric HRMS architecture.
- Position Intelligence Profile.
- Skill taxonomy model.
- KPI cascading model.
- Learning path model.
- Gap analysis / talent weighting.
- Career / succession model.
- Compensation intelligence model.

The following layers are industry-specific:

- BPM processes.
- Organigram.
- Position catalogue.
- ESCO occupation mappings.
- Process KPIs.
- Role-specific skills.
- Regulatory controls.
- Operating model.

## Scope

In scope:

- BPM process blueprinting.
- Organization design.
- Position management.
- Job architecture.
- ESCO occupation mapping.
- Skill taxonomy and position-skill requirements.
- KPI cascading and assessment.
- Position-based learning paths.
- Gap analysis and talent weighting.
- Career planning and succession.
- Compensation intelligence and reward input.
- AI-assisted workforce intelligence.

Out of scope:

- Core HR Administration.
- Payroll / Time & Attendance execution.
- Benefits / Welfare administration.
- Procurement / Vendor Governance.
- IAM / Badge / Device provisioning.
- Facilities / Workplace Services.

## Idempotent Installation

Run one of these commands from the extracted bundle folder.

PowerShell:

```powershell
./scripts/apply_bundle.ps1 -Target "C:\path\to\target"
```

Bash:

```bash
./scripts/apply_bundle.sh /path/to/target
```

Python:

```bash
python scripts/apply_bundle.py --target /path/to/target
```

The installer can be re-run. Existing changed files are backed up only when content differs.

## Validation

```bash
python scripts/validate_bundle.py
```

## Implementation Note

Logical names and data-model notes must be converted into approved Heuresys `sys.sys_*` schema conventions before SQL migration generation.

---

# v3 Additions — Full-Stack Bootstrap Scope

This version adds the full bootstrap requirements for a clean local project repository:

- tenant and user foundation;
- linked user profile and person evidence enrichment;
- authentication and authorization stack;
- API backend stack;
- frontend admin/blueprint console stack;
- updated PostgreSQL migration plan;
- security and privacy boundaries;
- repository scaffold scripts.

The platform remains position-centric. `sys.sys_users` is the platform person/account anchor, not a full Core HR employee master-data module.

---

# v4 Additions — Complete AI Coding Agent Bootstrap

This version adds the missing bootstrap components needed before starting a clean implementation repository:

- Seed Acquisition & Validation Engine.
- Source of Truth Registry.
- Research prompt templates for autonomous source-backed seed acquisition.
- Seed staging and approval model.
- Idempotent seeding rules.
- Learning catalogue, training initiatives and gap closure specification.
- Graph visualization and renderable artifact model.
- OpenAPI bootstrap contract.
- Auth policy matrix.
- Frontend route map.
- Acceptance tests.
- SQL migration skeletons.
- CSV seed templates.

The bundle remains generic at root level. The included `FIN_BANKING` model remains an industry-specific reference implementation.

---

# v5 Additions — Brownfield Adaptation and Legacy DB Reuse

This version adds a complete brownfield adaptation module.

It allows the Development Team to reuse useful legacy DBMS catalogues, mappings and reference data without changing the new architecture.

The old DBMS is treated as:

```text
brownfield enrichment source
```

not as:

```text
target schema
```

The new canonical architecture remains `sys.sys_*`, tenant-aware, authenticated and position-centric.
