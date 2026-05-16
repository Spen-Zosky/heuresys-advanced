# Banking BPM / HRMS Blueprint — Canonical Process Index

| # | File | Process | Purpose |
|---:|---|---|---|
| 00 | [`00_Enterprise_Typing_and_Blueprint_Configuration.md`](./industry_blueprints/FIN_BANKING/processes/00_Enterprise_Typing_and_Blueprint_Configuration.md) | Enterprise Typing and Blueprint Configuration | Initial ATECO/NACE-based enterprise classification, semantic reconciliation, size/operating-model typing and blueprint selection. |
| 01 | [`01_Current_Accounts_Management.md`](./industry_blueprints/FIN_BANKING/processes/01_Current_Accounts_Management.md) | Current Accounts Management | Lifecycle of current accounts: opening, maintenance, restrictions and closure. |
| 02 | [`02_Payments_and_Transactions_Management.md`](./industry_blueprints/FIN_BANKING/processes/02_Payments_and_Transactions_Management.md) | Payments and Transactions Management | Payments, transfers, cards, direct debits, settlement, exceptions and reconciliation. |
| 03 | [`03_Cash_Operations_Management.md`](./industry_blueprints/FIN_BANKING/processes/03_Cash_Operations_Management.md) | Cash Operations Management | Branch cash, ATM cash, vault, transport, balancing and cash reconciliation. |
| 04 | [`04_Deposit_Products_Management.md`](./industry_blueprints/FIN_BANKING/processes/04_Deposit_Products_Management.md) | Deposit Products Management | Savings, term deposits, certificates of deposit, interest and maturity handling. |
| 05 | [`05_Lending_and_Credit_Management.md`](./industry_blueprints/FIN_BANKING/processes/05_Lending_and_Credit_Management.md) | Lending and Credit Management | Credit origination, assessment, approval, servicing, monitoring, collections and NPL. |
| 06 | [`06_Customer_Relationship_Management.md`](./industry_blueprints/FIN_BANKING/processes/06_Customer_Relationship_Management.md) | Customer Relationship Management | Customer lifecycle, service, engagement, complaints, retention and relationship management. |
| 07 | [`07_Compliance_AML_and_Regulatory_Processes.md`](./industry_blueprints/FIN_BANKING/processes/07_Compliance_AML_and_Regulatory_Processes.md) | Compliance, AML and Regulatory Processes | KYC, AML, sanctions, compliance testing, controls and regulatory reporting. |
| 08 | [`08_Risk_Management.md`](./industry_blueprints/FIN_BANKING/processes/08_Risk_Management.md) | Risk Management | Credit, operational, liquidity, market and enterprise risk management. |
| 09 | [`09_Treasury_and_Finance.md`](./industry_blueprints/FIN_BANKING/processes/09_Treasury_and_Finance.md) | Treasury and Finance | Treasury, accounting, financial control, ALM, closing and reporting. |
| 10 | [`10_Digital_Banking_and_Channels.md`](./industry_blueprints/FIN_BANKING/processes/10_Digital_Banking_and_Channels.md) | Digital Banking and Channels | Web, mobile, API, omnichannel banking and digital customer access. |
| 11 | [`11_Sales_and_Commercial_Processes.md`](./industry_blueprints/FIN_BANKING/processes/11_Sales_and_Commercial_Processes.md) | Sales and Commercial Processes | Retail/SME commercial planning, campaigns, advisory, lead management and relationship development. |
| 12 | [`12_Branch_Operations.md`](./industry_blueprints/FIN_BANKING/processes/12_Branch_Operations.md) | Branch Operations | Daily branch operations, front office, service delivery, security and branch reconciliation. |
| 13 | [`13_Legal_and_Litigation.md`](./industry_blueprints/FIN_BANKING/processes/13_Legal_and_Litigation.md) | Legal and Litigation | Legal advisory, contracts, disputes, litigation and legal governance. |
| 14 | [`14_HR_and_Internal_Services.md`](./industry_blueprints/FIN_BANKING/processes/14_HR_and_Internal_Services.md) | People, Workforce and Internal Services Management | Position-centric HRMS/workforce blueprint, scoped for the project perimeter. |
| 15 | [`15_IT_and_Banking_Technology_Operations.md`](./industry_blueprints/FIN_BANKING/processes/15_IT_and_Banking_Technology_Operations.md) | IT and Banking Technology Operations | Core banking operations, ITSM, cybersecurity, IAM, data and integrations. |
| 16 | [`16_Business_Continuity_and_Security.md`](./industry_blueprints/FIN_BANKING/processes/16_Business_Continuity_and_Security.md) | Business Continuity and Security | Operational resilience, disaster recovery, fraud prevention and physical/logical security. |
| 17 | [`17_AI_Augmented_Banking_Processes.md`](./industry_blueprints/FIN_BANKING/processes/17_AI_Augmented_Banking_Processes.md) | AI-Augmented Banking Processes | AI-enabled customer service, fraud, analytics, automation and banking intelligence. |
| 18 | [`18_KPI_Library_Cascading_and_Assessment_Model.md`](./industry_blueprints/FIN_BANKING/processes/18_KPI_Library_Cascading_and_Assessment_Model.md) | KPI Library, Cascading and Assessment Model | Process-to-unit-to-position KPI distribution, metrics, weights and assessment methods. |
| 19 | [`19_Position_Based_Learning_Path_Management.md`](./industry_blueprints/FIN_BANKING/processes/19_Position_Based_Learning_Path_Management.md) | Position-Based Learning Path Management | Learning paths inherited from positions and linked to skills, proficiency and certifications. |
| 20 | [`20_Workforce_Intelligence_Gap_Analysis_and_Talent_Weighting.md`](./industry_blueprints/FIN_BANKING/processes/20_Workforce_Intelligence_Gap_Analysis_and_Talent_Weighting.md) | Workforce Intelligence, Gap Analysis and Talent Weighting | Position requirements vs person evidence, fit scores, gaps, readiness and talent weighting. |
| 21 | [`21_Career_Planning_Talent_Mobility_and_Succession.md`](./industry_blueprints/FIN_BANKING/processes/21_Career_Planning_Talent_Mobility_and_Succession.md) | Career Planning, Talent Mobility and Succession | Career paths, mobility, successor pools, critical role coverage and readiness levels. |
| 22 | [`22_Compensation_Intelligence_and_Objective_Based_Reward_Input.md`](./industry_blueprints/FIN_BANKING/processes/22_Compensation_Intelligence_and_Objective_Based_Reward_Input.md) | Compensation Intelligence and Objective-Based Reward Input | Reward decision-support, objective valuation, gates and payroll/benefits handoff only. |

---

# Bootstrap Agent Documents

| File | Purpose |
|---|---|
| `bootstrap_agent/AI_CODING_AGENT_BOOTSTRAP_PROMPT.md` | Main prompt for the Development Team / AI coding agent. |
| `bootstrap_agent/DBMS_BOOTSTRAP_SPEC.md` | PostgreSQL schema and migration requirements. |
| `bootstrap_agent/TENANT_USER_PROFILE_MODEL.md` | Tenant, user, profile and evidence model. |
| `bootstrap_agent/AUTH_STACK_SPEC.md` | Authentication and authorization stack. |
| `bootstrap_agent/FRONTEND_STACK_SPEC.md` | Admin frontend stack and modules. |
| `bootstrap_agent/BACKEND_API_STACK_SPEC.md` | Backend API stack and modules. |
| `bootstrap_agent/SECURITY_AND_PRIVACY_BOUNDARIES.md` | Security, privacy and sensitive-data boundaries. |
| `bootstrap_agent/REPOSITORY_STRUCTURE.md` | Clean repository target structure. |

---

# v4 Bootstrap Additions

| Area | Files |
|---|---|
| Seed acquisition | `seed_acquisition/SEED_ACQUISITION_ENGINE_SPEC.md`, `seed_acquisition/SOURCE_OF_TRUTH_REGISTRY.md`, `seed_acquisition/source_registry.seed.json` |
| Research prompts | `seed_acquisition/prompts/*.md` |
| Seed schemas | `seed_acquisition/schemas/*.json` |
| Learning catalogue | `bootstrap_agent/specs/LEARNING_CATALOG_AND_GAP_CLOSURE_SPEC.md` |
| Visualization graph model | `bootstrap_agent/specs/GRAPH_VISUALIZATION_MODEL_SPEC.md` |
| API contract | `bootstrap_agent/contracts/OPENAPI_BOOTSTRAP_SPEC.yaml` |
| Auth policy | `bootstrap_agent/specs/AUTH_POLICY_MATRIX.md` |
| Frontend routes | `bootstrap_agent/specs/FRONTEND_ROUTE_MAP.md` |
| Acceptance gates | `bootstrap_agent/checklists/ACCEPTANCE_TESTS.md` |
| Migration skeletons | `db/migration_skeletons/*.sql` |
| Seed templates | `db/seed_templates/*.csv` |

---

# v5 Brownfield Adaptation Module

| File | Purpose |
|---|---|
| `brownfield_adaptation/BROWNFIELD_IMPORT_STRATEGY.md` | Strategy for using legacy DBMS as enrichment source. |
| `brownfield_adaptation/BROWNFIELD_ADAPTATION_MAP_TEMPLATE.md` | Required adaptation map template. |
| `brownfield_adaptation/BROWNFIELD_TABLE_CLASSIFICATION_RULES.md` | Import/transform/reference/exclude rules. |
| `brownfield_adaptation/BROWNFIELD_IMPORT_PIPELINE_SPEC.md` | End-to-end import pipeline. |
| `brownfield_adaptation/BROWNFIELD_LINEAGE_MODEL.md` | Source lineage model. |
| `brownfield_adaptation/BROWNFIELD_EXCLUSION_RULES.md` | Excluded sensitive/out-of-scope domains. |
| `brownfield_adaptation/BROWNFIELD_VALIDATION_CHECKLIST.md` | Validation gates before canonical import. |
| `brownfield_adaptation/BROWNFIELD_IMPORT_WAVES.md` | Recommended phased import order. |
| `brownfield_adaptation/BROWNFIELD_AI_AGENT_TASK.md` | Coding-agent task definition. |
| `brownfield_adaptation/scripts/*.py` | Brownfield inspection/adaptation script skeletons. |
| `db/migration_skeletons/000024–000026_*.sql` | Brownfield migration skeletons. |
