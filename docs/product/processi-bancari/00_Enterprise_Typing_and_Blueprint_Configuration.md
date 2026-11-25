# Enterprise Typing and Blueprint Configuration
## Process 00: NACE / ATECO-Based Enterprise Classification and Blueprint Selection

---

# Document Control

| Field | Value |
|---|---|
| Document ID | BPM-BANK-00 |
| Recommended File Name | `00_Enterprise_Typing_and_Blueprint_Configuration.md` |
| Process Domain | Enterprise Typing, Industry Classification and Blueprint Configuration |
| Target Organization | Any tenant/company onboarded into the HRMS/BPM blueprint platform |
| Reference Case | Medium-sized regional retail bank, 158 employees, 5 branches |
| Intended Use | Tenant onboarding, enterprise classification, blueprint selection, BPM/HRMS configuration, seed generation |
| Document Type | Canonical BPM and HRMS entry process |
| Status | Draft for inclusion at the head of the blueprint bundle |
| Owner | Product / Enterprise Architecture |
| Maintainer | BPM / HRMS Product Team |
| Version | 1.0 |
| Last Updated | 2026-05-15 |

---

# 1. Process Overview

The **Enterprise Typing and Blueprint Configuration** process is the first formal process in the blueprint lifecycle.

Its purpose is to classify an enterprise using official economic-activity taxonomies and convert that classification into a structured platform configuration that determines which BPM, organization, position, job, skill, KPI and control blueprints should be activated.

The process uses:

- **NACE** as the European economic-activity classification layer.
- **ATECO** as the Italian national economic-activity classification layer.
- **Heuresys industry / subindustry mapping** as the platform-specific blueprint routing layer.
- **Size, operating model and regulatory intensity** as contextual refinement layers.
- **Human validation** as the final control before blueprint activation.

This process is intentionally placed before BPM, organization, position, job, skill and KPI generation because the enterprise type determines the expected operating model.

The process does **not** use ESCO to classify the enterprise. ESCO is used downstream to classify occupations, job roles and skills.

The correct classification chain is:

```text
NACE / ATECO
  → classifies the enterprise economic activity

Heuresys Industry / Subindustry
  → maps the enterprise to an internal blueprint family

Size / Operating Model / Regulatory Intensity
  → refines the enterprise profile

Blueprint Variant
  → activates BPM, organization, position, job, skill, KPI and control templates

ESCO / ISCO
  → classifies occupations and skills downstream
```

---

# 2. Strategic Objectives

## 2.1 Business Objectives

- Standardize enterprise onboarding across tenants.
- Avoid manual, inconsistent or arbitrary industry classification.
- Select the correct industry-specific BPM and HRMS blueprint.
- Support rapid blueprint generation for different enterprise types.
- Enable scalable tenant configuration using official classification sources.
- Improve comparability across tenants belonging to the same industry or subindustry.
- Provide a reusable foundation for industry-specific process, organization, position, job, skill and KPI models.

## 2.2 Operational Objectives

- Capture official company activity classification data.
- Map official NACE / ATECO codes to Heuresys industry and subindustry.
- Determine size class using employee count, FTE and optional financial/operational indicators.
- Determine operating model attributes such as branch network, digital channels, sites, regulated activities and outsourcing intensity.
- Determine blueprint family and blueprint variant.
- Generate proposed BPM, organization, position, skill, KPI and control seeds.
- Require human validation before freezing the enterprise typing profile.
- Maintain traceability, confidence score and version history for classification decisions.

## 2.3 Governance Objectives

- Use official economic-activity taxonomies as the primary classification source.
- Preserve source version, validity date and classification evidence.
- Support human review and override.
- Separate official classification from internal blueprint interpretation.
- Ensure that all downstream blueprint outputs are traceable to the enterprise typing profile.
- Prevent silent activation of inappropriate blueprints.
- Enable controlled reclassification when ATECO, NACE or the company’s business model changes.

---

# 3. Source Classifications

## 3.1 NACE

NACE is the European statistical classification of economic activities.

In the blueprint process, NACE is used to identify the enterprise’s economic activity at European level.

Recommended stored layers:

```text
NACE Section
NACE Division
NACE Group
NACE Class
NACE Version
NACE Source
NACE Validity Dates
```

For a banking institution, the relevant high-level NACE area is generally the financial and insurance activities domain.

## 3.2 ATECO

ATECO is the Italian national classification of economic activities and provides the Italian operational detail aligned to the European NACE framework.

For Italian companies, ATECO should be stored together with NACE because ATECO is the operational classification used in Italian administrative and statistical contexts.

Recommended stored layers:

```text
ATECO Section
ATECO Division
ATECO Group
ATECO Class
ATECO Category
ATECO Subcategory
ATECO Version
ATECO Source
ATECO Validity Dates
```

## 3.3 ESCO and ISCO

ESCO and ISCO are not used to classify the enterprise.

They are used downstream:

```text
ESCO Occupations / ISCO-08
  → classify jobs, roles and occupations

ESCO Skills
  → classify skill and competence requirements
```

This separation is essential:

| Classification | What it classifies | Used for |
|---|---|---|
| NACE | Enterprise economic activity | Industry typing |
| ATECO | Italian enterprise economic activity | Italian enterprise typing |
| Heuresys industry/subindustry | Internal blueprint routing | Blueprint selection |
| ESCO / ISCO | Occupations and skills | Job, position and skill modelling |

---

# 4. Process Scope

## 4.1 Included Activities

- Collect company legal and business identity.
- Collect or retrieve official NACE and ATECO codes.
- Validate primary and secondary economic activities.
- Map official classification to Heuresys industry and subindustry.
- Determine enterprise size class.
- Determine operating model attributes.
- Determine regulatory intensity.
- Select blueprint family.
- Select blueprint variant.
- Generate proposed blueprint activation profile.
- Identify modules to activate.
- Identify modules to exclude.
- Generate classification confidence score.
- Trigger human validation workflow.
- Freeze validated enterprise typing profile.
- Store classification version and audit evidence.

## 4.2 Excluded Activities

- ESCO occupation validation.
- ESCO skill validation.
- Detailed position catalogue generation.
- Detailed job description generation.
- Employee master data creation.
- Payroll configuration.
- IAM provisioning.
- Procurement/vendor configuration.
- Physical site/facilities setup.
- Final SQL migration execution.

Those processes are downstream or outside the current project scope.

---

# 5. Input Data

## 5.1 Legal and Registry Inputs

| Input | Description |
|---|---|
| Legal name | Registered company name. |
| Tax identifier / VAT number | Official tax or VAT identifier. |
| Registered office | Legal registered address. |
| Country | Country of registration. |
| Legal form | Corporate/legal form. |
| Official ATECO code | Italian economic activity code, if applicable. |
| Official NACE code | European economic activity code, if available. |
| Business register source | Chamber of Commerce or equivalent registry source. |
| Regulatory license status | Relevant for banks, insurance, financial firms, healthcare, etc. |

## 5.2 Business Description Inputs

| Input | Description |
|---|---|
| Business description | Free-text description of activities. |
| Products and services | Main products/services offered. |
| Customer segments | Retail, SME, corporate, public sector, etc. |
| Distribution channels | Branches, digital, agents, partners, direct sales. |
| Geographic footprint | Local, regional, national, international. |
| Revenue model | Fees, interest, subscriptions, services, trading, etc. |
| Operating model | Branch-based, digital-first, manufacturing, consulting, etc. |

## 5.3 Size and Complexity Inputs

| Input | Description |
|---|---|
| Employee count | Total employees. |
| FTE count | Full-time-equivalent count. |
| Number of sites | Branches, offices, plants or operating locations. |
| Number of business units | Organizational complexity indicator. |
| Countries/regions | Geographic complexity. |
| Digital intensity | Relevance of digital channels and systems. |
| Outsourcing intensity | Degree of reliance on external providers. |
| Regulatory intensity | Low, medium, high, critical. |

---

# 6. Classification Workflow

```text
Enterprise onboarding started
  ↓
Collect legal, registry and business data
  ↓
Retrieve or input official ATECO / NACE codes
  ↓
Validate primary and secondary economic activities
  ↓
Map NACE / ATECO to Heuresys industry
  ↓
Map industry to Heuresys subindustry
  ↓
Determine size class
  ↓
Determine operating model attributes
  ↓
Determine regulatory intensity
  ↓
Select blueprint family
  ↓
Select blueprint variant
  ↓
Generate proposed BPM / organization / position / job / skill / KPI / control seeds
  ↓
Human validation
  ↓
Freeze enterprise typing profile
  ↓
Activate tenant blueprint configuration
```

---

# 7. Decision Layers

## 7.1 Layer 1 — Official Economic Classification

This layer captures and validates the official classification.

```text
NACE section
NACE division
NACE group
NACE class

ATECO section
ATECO division
ATECO group
ATECO class
ATECO category/subcategory
```

The output of this layer is not yet a Heuresys blueprint. It is the official activity classification foundation.

## 7.2 Layer 2 — Heuresys Industry Mapping

This layer maps official activity codes to the platform’s internal industry taxonomy.

Example mapping:

| Official classification | Heuresys mapping |
|---|---|
| NACE financial activities | Finance |
| Banking / credit institution activity | Banking |
| Retail and SME banking | Retail Banking |
| Regional bank with branch network | Regional Retail Bank |

Recommended internal values:

```yaml
industry_code: FIN
industry_name: Finance
subindustry_code: FIN_BANK_RETAIL_REGIONAL
subindustry_name: Regional Retail Banking
```

## 7.3 Layer 3 — Size Classification

The baseline size class can be derived from employee count:

| Size class | Employee range |
|---|---:|
| MICRO | 1–9 |
| SMALL | 10–49 |
| MEDIUM | 50–249 |
| LARGE | 250+ |

The platform should also allow industry-specific overrides or additional dimensions.

For banking, a 158-employee bank is:

```yaml
size_class: MEDIUM
regulated_complexity_class: HIGH
```

## 7.4 Layer 4 — Operating Model Attributes

NACE and ATECO identify the activity, but they do not fully describe the operating model.

Operating model attributes refine the blueprint.

Example for the reference bank:

```yaml
operating_model:
  branch_network: true
  branch_count: 5
  branch_employees: 25
  employees_per_branch: 5
  digital_channels: true
  retail_customers: true
  sme_customers: true
  lending_activity: true
  payments_activity: true
  deposit_activity: true
  treasury_activity: limited
  investment_advisory: optional_or_limited
  outsourcing_intensity: medium
  regulatory_intensity: high
```

## 7.5 Layer 5 — Blueprint Selection

This layer selects the correct blueprint family and variant.

For the reference bank:

```yaml
blueprint_family: FIN_BANKING
blueprint_variant: REGIONAL_RETAIL_BANK_MEDIUM
blueprint_operating_model: BRANCH_AND_DIGITAL
```

The blueprint should activate:

- banking BPM process model;
- banking organization model;
- regional bank organigram;
- branch staffing model;
- position catalogue;
- job catalogue;
- ESCO occupation mapping backlog;
- skill taxonomy;
- KPI library;
- control library;
- AI augmentation candidates.

## 7.6 Layer 6 — Human Validation

The system should not silently finalize enterprise typing.

A human reviewer must confirm:

- official codes are correct;
- business activity interpretation is correct;
- industry and subindustry mapping is correct;
- size class is appropriate;
- operating model attributes are correct;
- blueprint variant is appropriate;
- excluded modules are correctly excluded;
- generated seeds are appropriate for the tenant.

---

# 8. Rule Engine Logic

## 8.1 Example Rules

```text
IF NACE section = Financial and insurance activities
AND business description includes banking / credit institution / monetary intermediation
THEN industry_code = FIN
```

```text
IF industry_code = FIN
AND subindustry = banking
AND employee_count BETWEEN 50 AND 249
AND branch_count > 1
THEN blueprint_variant = REGIONAL_RETAIL_BANK_MEDIUM
```

```text
IF blueprint_variant = REGIONAL_RETAIL_BANK_MEDIUM
THEN activate:
- Retail Banking BPM blueprint
- Lending & Credit BPM blueprint
- Risk & Compliance BPM blueprint
- Finance & Treasury BPM blueprint
- Operations BPM blueprint
- Commercial Network BPM blueprint
- IT & Digital Banking BPM blueprint
- People / Workforce HRMS blueprint
- Branch staffing model
- Position-centric workforce model
```

## 8.2 Confidence Scoring

Suggested scoring dimensions:

| Dimension | Weight |
|---|---:|
| Official NACE / ATECO code available | 25% |
| Business description matches official code | 20% |
| Heuresys industry mapping confidence | 20% |
| Operating model data completeness | 15% |
| Size data completeness | 10% |
| Regulatory/activity confirmation | 10% |

Example statuses:

```yaml
confidence_score:
  0_50: NEEDS_REVIEW
  51_75: AUTO_CLASSIFIED_WITH_WARNINGS
  76_90: HIGH_CONFIDENCE
  91_100: READY_FOR_VALIDATION
```

---

# 9. Human Review Screen

The review screen should show:

```text
Official classification
Detected industry
Detected subindustry
Detected operating model
Detected size class
Recommended blueprint
Activated modules
Excluded modules
Confidence score
Warnings
Human override options
```

Example:

```yaml
official_classification:
  nace_section: K
  nace_description: Financial and insurance activities
  ateco_code: to_be_validated
  ateco_description: banking / credit institution activity

detected_profile:
  industry: Finance
  subindustry: Regional Retail Banking
  size_class: Medium
  employees: 158
  branches: 5
  regulatory_intensity: High

recommended_blueprint:
  FIN_BANKING_REGIONAL_RETAIL_MEDIUM

activated_blueprint_modules:
  - BPM Retail Banking Operations
  - BPM Lending and Credit Management
  - BPM Compliance, AML and Regulatory Processes
  - BPM Risk Management
  - BPM Treasury and Finance
  - BPM Operations
  - BPM Commercial Network
  - BPM IT and Digital Banking
  - BPM People, Workforce and HRMS
  - Position-Centric HRMS Model
  - ESCO Occupation Mapping
  - Skill Taxonomy
  - KPI Library

excluded_modules:
  - Core HR Administration
  - Payroll / Time and Attendance
  - Benefits / Welfare
  - Procurement / Vendor Governance
  - IAM / Badge / Device Provisioning
  - Facilities / Workplace Services
```

---

# 10. Process Outputs

## 10.1 Tenant Enterprise Typing Profile

For the reference bank:

```yaml
tenant_profile:
  tenant_name: Regional Retail Bank Reference Model
  country: IT
  employee_count: 158
  fte_count: 158
  branch_count: 5
  branch_employees: 25
  employees_per_branch: 5
  size_class: MEDIUM
  nace_section: K
  industry_code: FIN
  industry_name: Finance
  subindustry_code: FIN_BANK_RETAIL_REGIONAL
  subindustry_name: Regional Retail Banking
  operating_model:
    branch_network: true
    digital_channels: true
    retail_customers: true
    sme_customers: true
    lending: true
    payments: true
    deposits: true
  regulatory_intensity: HIGH
  blueprint_family: FIN_BANKING
  blueprint_variant: REGIONAL_RETAIL_BANK_MEDIUM
  classification_status: HUMAN_VALIDATED
```

## 10.2 Blueprint Activation Profile

```yaml
blueprint_activation:
  bpm_process_blueprints:
    - Retail Banking Operations
    - Lending and Credit Management
    - Customer Relationship Management
    - Compliance, AML and Regulatory Processes
    - Risk Management
    - Treasury and Finance
    - Digital Banking and Channels
    - Sales and Commercial Processes
    - Branch Operations
    - Legal and Litigation
    - People, Workforce and Internal Services
    - IT and Banking Technology Operations
    - Business Continuity and Security
    - AI-Augmented Banking Processes

  hrms_blueprints:
    - Position-Centric Workforce Planning
    - Organization Design
    - Position Management
    - Job Architecture
    - ESCO Occupation Mapping
    - Position-Skill Mapping
    - Skill Taxonomy
    - Performance Expectations
    - Learning Paths
    - Succession and Critical Role Coverage
    - People Analytics
    - AI-Assisted Workforce Intelligence

  excluded_blueprints:
    - Core HR Administration
    - Payroll / Time and Attendance
    - Benefits / Welfare
    - Procurement / Vendor Governance
    - IAM / Badge / Device Provisioning
    - Facilities / Workplace Services
```

---

# 11. Suggested Data Model

## 11.1 Official Classification Tables

```text
sys.sys_nace_sections
sys.sys_nace_divisions
sys.sys_nace_groups
sys.sys_nace_classes

sys.sys_ateco_sections
sys.sys_ateco_divisions
sys.sys_ateco_groups
sys.sys_ateco_classes
sys.sys_ateco_subclasses
```

Recommended fields:

```text
code
parent_code
label_it
label_en
description_it
description_en
version
valid_from
valid_to
source_name
source_uri
is_active
created_at
updated_at
```

## 11.2 Crosswalk and Mapping Tables

```text
sys.sys_nace_ateco_crosswalks
sys.sys_activity_blueprint_mappings
```

Recommended fields:

```text
mapping_id
nace_code
ateco_code
industry_code
subindustry_code
blueprint_family_code
blueprint_variant_code
mapping_confidence
mapping_method
requires_human_validation
valid_from
valid_to
is_active
```

## 11.3 Heuresys Blueprint Tables

These must be harmonized with the existing Heuresys source of truth before SQL migration generation.

```text
sys.sys_industries
sys.sys_subindustries
sys.sys_blueprint_families
sys.sys_blueprint_variants
sys.sys_size_classes
sys.sys_operating_model_attributes
```

Important implementation note:

```text
sys.sys_industries should be extended with NAICS / ISIC / NACE / ATECO reference fields where appropriate.

Avoid introducing non-approved br_* tables or naming conventions that conflict with the Heuresys schema standards.
```

## 11.4 Tenant Activity Profile

```text
sys.sys_tenant_activity_profiles
```

Recommended fields:

```text
tenant_activity_profile_id
tenant_id
legal_name
country_code
primary_nace_code
primary_ateco_code
secondary_nace_codes
secondary_ateco_codes
industry_code
subindustry_code
size_class_code
employee_count
fte_count
branch_count
operating_model_profile_json
regulatory_intensity_code
blueprint_family_code
blueprint_variant_code
classification_confidence_score
classification_status
validation_status
validated_by
validated_at
created_at
updated_at
```

## 11.5 Blueprint Activation

```text
sys.sys_tenant_blueprint_activations
```

Recommended fields:

```text
tenant_blueprint_activation_id
tenant_id
tenant_activity_profile_id
blueprint_family_code
blueprint_variant_code
size_class_code
activated_process_templates_json
activated_org_templates_json
activated_position_templates_json
activated_skill_templates_json
activated_kpi_templates_json
activated_control_templates_json
excluded_modules_json
activation_status
activated_by
activated_at
created_at
updated_at
```

---

# 12. Suggested Status Values

## 12.1 Classification Status

```yaml
classification_status:
  - DRAFT
  - AUTO_CLASSIFIED
  - NEEDS_REVIEW
  - HUMAN_VALIDATED
  - APPROVED
  - SUPERSEDED
  - REJECTED
```

## 12.2 Validation Status

```yaml
validation_status:
  - UNVALIDATED
  - OFFICIAL_CODE_VERIFIED
  - BUSINESS_DESCRIPTION_VERIFIED
  - BLUEPRINT_MAPPING_VERIFIED
  - READY_FOR_BLUEPRINT_GENERATION
```

## 12.3 Activation Status

```yaml
activation_status:
  - NOT_STARTED
  - PROPOSED
  - PARTIALLY_ACTIVATED
  - ACTIVATED
  - FAILED
  - SUPERSEDED
  - ROLLED_BACK
```

---

# 13. BPM Blueprint Requirements

The process requires:

- guided onboarding workflow;
- official classification input fields;
- activity-description capture;
- NACE / ATECO lookup integration;
- mapping rule engine;
- size-class calculation;
- operating-model questionnaire;
- blueprint recommendation engine;
- confidence scoring;
- warning and exception handling;
- human validation queue;
- override reason capture;
- versioned enterprise typing profile;
- downstream blueprint activation events;
- audit trail.

---

# 14. Typical Pain Points

- Company classified only by generic industry label.
- ATECO/NACE code treated as if it fully described the operating model.
- No distinction between official classification and internal blueprint mapping.
- Same blueprint used for companies with different size or complexity.
- No explicit human validation.
- No versioning of classification decisions.
- Downstream BPM, org and skill models not traceable to the initial enterprise profile.
- ESCO used incorrectly to classify enterprises rather than occupations and skills.
- Operating-model attributes omitted from onboarding.
- Regulatory intensity not considered in blueprint selection.

---

# 15. Future Evolution

## 15.1 Multi-Classification Support

Extend the classification layer beyond NACE/ATECO to include:

- ISIC;
- NAICS;
- SIC where needed;
- local national classifications.

## 15.2 AI-Assisted Classification

Use AI to suggest likely NACE/ATECO mappings from:

- website text;
- business descriptions;
- product descriptions;
- public registry data;
- financial statements;
- service catalogues.

AI suggestions must remain human-validated.

## 15.3 Blueprint Recommendation Engine

Build an engine that recommends:

- process maps;
- organization models;
- position catalogues;
- role catalogues;
- skills;
- KPIs;
- controls;
- AI augmentation use cases.

## 15.4 Versioned Blueprint Evolution

When classifications or operating model attributes change, the platform should support:

- comparison against current blueprint;
- impact analysis;
- recommended blueprint migration;
- approval workflow;
- version history;
- rollback where needed.

---

# 16. Reference Case — Regional Retail Bank

## 16.1 Input Profile

```yaml
enterprise_type: Medium-sized regional retail bank
country: Italy
employees: 158
branches: 5
branch_employees: 25
employees_per_branch: 5
operating_model:
  retail_banking: true
  sme_banking: true
  branch_network: true
  digital_channels: true
  deposits: true
  lending: true
  payments: true
  credit_monitoring: true
  compliance_aml: true
  risk_management: true
```

## 16.2 Generated Blueprint Direction

```yaml
industry: Finance
subindustry: Regional Retail Banking
size_class: Medium
regulated_complexity: High
blueprint_variant: Regional Retail Bank — Medium — Branch and Digital Model
```

## 16.3 Activated Downstream Artifacts

```text
BPM business process blueprint
Bank organigram
5-branch model
158-seat workforce allocation
Position catalogue
ESCO occupation mapping backlog
Position-skill matrix
Skill taxonomy
Position-centric HRMS logical model
Performance/learning/succession model
AI-assisted workforce intelligence layer
```

---

---

# ATECO-First Reconciliation Principle

For Italian enterprises, the platform treats **ATECO** as the primary operational classification source.

NACE is derived through official correspondence tables where available and through semantic best-fit reconciliation where necessary.

The platform must preserve both:

```text
primary_ateco_code
mapped_nace_code
```

because ATECO may contain national-level detail that is not fully represented in NACE.

When the ATECO-to-NACE mapping is ambiguous, broader/narrower, partial or semantically uncertain, the system must require human validation before blueprint activation.

## Reconciliation Priority

```text
1. ATECO code validation
2. Official ATECO ↔ NACE correspondence where available
3. Semantic comparison of labels, notes, inclusions and exclusions
4. Business-description and operating-model fit
5. Human validation / override
6. Heuresys industry, subindustry and blueprint mapping
```

## Discrepancy Types

| Discrepancy Type | Meaning | Handling |
|---|---|---|
| Structural mismatch | ATECO has more detailed national levels than NACE. | Preserve ATECO detail, map to nearest NACE class. |
| One-to-many | One ATECO code maps to multiple NACE candidates. | Apply semantic scoring and require validation. |
| Many-to-one | Multiple ATECO codes map to one NACE class. | Preserve ATECO as operational truth, use NACE for EU grouping. |
| Revision mismatch | ATECO and NACE versions are not aligned. | Use versioned crosswalks. |
| Content mismatch | Labels are similar but notes differ. | Compare inclusions/exclusions. |
| Business-model mismatch | Official code is correct but too generic for blueprinting. | Use operating-model questionnaire. |
| Multi-activity enterprise | Enterprise has primary and secondary activities. | Generate primary blueprint plus optional secondary modules. |

## Additional Mapping Fields

```text
mapping_type                    -- EXACT / BROADER / NARROWER / PARTIAL / SEMANTIC / MANUAL
mapping_method                  -- OFFICIAL_CROSSWALK / SEMANTIC_MATCH / HUMAN_OVERRIDE
mapping_confidence_score
semantic_similarity_score
requires_human_validation
validation_status
override_reason
```

# 17. Summary

The Enterprise Typing and Blueprint Configuration process is the entry point for the entire blueprint system.

It ensures that the platform does not generate generic HRMS or BPM content. Instead, it generates a controlled, industry-specific, size-aware and operating-model-aware blueprint.

For the reference banking case, this process confirms:

```text
NACE / ATECO economic activity
  → Finance / Banking
  → Regional Retail Bank
  → Medium size
  → 158 employees
  → 5 branches
  → high regulatory intensity
  → position-centric workforce blueprint
  → banking BPM and HRMS configuration
```

This process should be placed at the head of the bundle as:

```text
00_Enterprise_Typing_and_Blueprint_Configuration.md
```
