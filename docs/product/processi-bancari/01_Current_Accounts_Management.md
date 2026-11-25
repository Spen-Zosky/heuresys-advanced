# Retail Banking Operations
## Process: Current Accounts Management

---

# 1. Process Overview

The Current Accounts Management process governs the full lifecycle of retail and SME current accounts. It is the operational foundation of the customer-bank relationship because most other products and services depend on the existence of a valid, active, compliant account relationship.

For a regional retail bank, this process must combine commercial effectiveness, regulatory robustness, operational reliability, and customer experience across branch, web, mobile, and assisted channels.

---

# 2. Strategic Objectives

## Business Objectives
- Acquire new retail and SME customers through a reliable account-opening journey.
- Enable cross-selling of payment cards, savings products, loans, insurance, and digital services.
- Increase deposit base and stable transactional balances.
- Improve customer retention through frictionless account lifecycle management.
- Reduce branch and back-office cost per account.

## Operational Objectives
- Reduce average time required to open, modify, and close accounts.
- Increase first-time-right completion of customer and account records.
- Ensure consistent account status management across all channels.
- Minimize manual rework, duplicated data entry, and operational exceptions.
- Provide complete auditability of all account lifecycle changes.

## Regulatory / Control Objectives
- Ensure KYC and AML checks before account activation.
- Guarantee proper customer identification, tax classification, and document retention.
- Support GDPR, PSD2, FATCA/CRS, and local supervisory requirements.
- Maintain traceability of mandates, delegations, powers, and account restrictions.
- Enforce segregation of duties for sensitive account changes.

---

# 3. Process Scope

## Included Activities
- Account opening and activation.
- Account master data maintenance.
- Economic terms and fee profile management.
- Signatories, powers, mandates, and delegations.
- Account restrictions, blocks, legal freezes, and operational limitations.
- Account closure and final reporting.
- Document production, signature, retention, and audit trail management.

## Excluded Activities
- Loan origination and credit underwriting.
- Investment advisory and securities custody.
- Insurance product management.
- Interbank treasury and liquidity operations.
- Payroll processing for corporate clients.

---

# 4. Core Process Domains

## 4.1 Account Opening
- Customer request intake.
- Identity verification.
- KYC and AML screening.
- Tax and residency classification.
- Product eligibility checks.
- Account type selection.
- IBAN generation.
- Contract generation and signature.
- Account activation.

## 4.2 Account Maintenance
- Customer data update.
- Address, contact, residency, and tax status updates.
- Economic condition changes.
- Branch reassignment.
- Account status changes.
- Periodic review of account data quality.

## 4.3 Signatories and Delegations
- Joint-account holder management.
- Authorized signatory onboarding.
- Powers of attorney.
- Delegations and revocations.
- Signature specimen management.
- Authority limits and validity checks.

## 4.4 Account Restrictions and Freezing
- Operational blocks.
- Judicial freezes.
- AML-related restrictions.
- Deceased customer handling.
- Garnishment and attachment management.
- Suspicious account activity escalation.

## 4.5 Account Closure
- Closure request validation.
- Verification of linked products and pending transactions.
- Balance settlement.
- Closure of cards, mandates, and payment instruments.
- Final statement generation.
- Document archival.

---

# 5. End-to-End Workflow

```text
Customer request
  ↓
Customer identification and eligibility validation
  ↓
KYC / AML screening
  ↓
Account type and product configuration
  ↓
Approval workflow where required
  ↓
Contract generation
  ↓
Physical or digital signature
  ↓
IBAN and account activation
  ↓
Lifecycle maintenance
  ↓
Monitoring, restrictions, or account closure
  ↓
Final reporting and archival
```

---

# 6. Key Actors

| Actor | Responsibility |
| --- | --- |
| Customer | Provides request, personal data, documents, signatures, and instructions. |
| Branch Operator | Handles assisted onboarding, data capture, document collection, and front-office changes. |
| Relationship Manager | Manages commercial relationship and identifies cross-selling opportunities. |
| Operations Back Office | Performs administrative controls, quality checks, and exception handling. |
| Compliance / AML Officer | Reviews KYC/AML exceptions, high-risk cases, and suspicious restrictions. |
| Legal Office | Handles freezes, garnishments, deceased customer cases, and legal constraints. |
| IT / Core Banking | Executes system-level creation, updates, integration, and audit logging. |


---

# 7. Organizational Units Involved

- Retail Banking
- Branch Operations
- Customer Operations Back Office
- Compliance and AML
- Legal
- IT Operations
- Document Management
- Customer Support

---

# 8. Core Data Entities

| Entity | Description |
| --- | --- |
| Customer | Natural person, legal entity, or SME customer profile. |
| Current Account | Banking relationship record with account status and configuration. |
| IBAN | Unique account identifier used for payments and settlement. |
| Contract | Account agreement and related documentation. |
| KYC Profile | Customer due diligence and risk classification record. |
| Mandate / Delegation | Operational authorization granted to a person. |
| Signatory | Individual authorized to operate on the account. |
| Account Restriction | Block, freeze, or operational limitation applied to the account. |
| Audit Trail | Trace of all changes, approvals, and events. |


---

# 9. Key Business Rules

- No account may be activated without completed mandatory customer identification.
- KYC and AML controls must be completed before operational activation.
- High-risk customers require enhanced due diligence and additional approval.
- Certain account changes require dual control or supervisor approval.
- Account closure cannot proceed while pending transactions, unpaid fees, active products, or unresolved legal restrictions exist.
- All signatory changes must be documented, authorized, dated, and auditable.
- Operational limits must be consistent with customer profile, channel, risk class, and product configuration.

---

# 10. Compliance & Regulatory Constraints

- AML customer due diligence and enhanced due diligence.
- PSD2 requirements for payment account access and strong customer authentication.
- GDPR principles for personal data processing and retention.
- FATCA/CRS tax classification where applicable.
- Supervisory rules on account documentation and record retention.
- Audit trail requirements for customer and account data changes.

---

# 11. Risk Areas

| Risk | Description |
| --- | --- |
| AML Risk | Account used for laundering, layering, or suspicious financial activity. |
| Fraud Risk | Identity theft, forged mandates, unauthorized changes, or account takeover. |
| Operational Risk | Incorrect account setup, missing documents, wrong status, or failed closure. |
| Compliance Risk | KYC/AML, privacy, tax, or documentation breaches. |
| Legal Risk | Incorrect handling of freezes, deceased customers, or garnishments. |
| Reputational Risk | Poor onboarding experience, account unavailability, or customer complaints. |


---

# 12. KPIs & Operational Metrics

- Average account opening time.
- Account opening first-time-right rate.
- KYC completion rate.
- Number of pending/incomplete account files.
- Account closure cycle time.
- Account maintenance error rate.
- Number of compliance exceptions per period.
- Customer complaints related to account management.

---

# 13. Technology Architecture

- Core Banking System for account creation, status, balances, and lifecycle events.
- CRM for customer relationship and interaction history.
- KYC/AML platform for due diligence and screening.
- Document Management System for contracts and evidence retention.
- Digital Signature platform for remote or branch-assisted signing.
- BPM/workflow engine for approvals, exceptions, SLAs, and escalations.
- IAM and audit logging platforms for access control and traceability.

---

# 14. Automation & AI Augmentation Opportunities

- Automatic pre-fill of customer and tax data from trusted sources.
- Document OCR and data extraction.
- Automated completeness checks before submission.
- Rule-based approval routing by risk, product, channel, and amount.
- AI-assisted anomaly detection in account-opening patterns.
- Automated account closure checklist.
- Digital assistant for branch operators and customer support.

---

# 15. Typical Pain Points

- Fragmented customer data across CRM, core banking, document systems, and compliance tools.
- Manual document checking and re-keying.
- Long onboarding times for high-risk customers or SMEs.
- Unclear ownership between branch, back office, compliance, and legal.
- Legacy core banking constraints that limit real-time account lifecycle orchestration.
- Incomplete audit trails for historical changes.

---

# 16. BPM Blueprint Requirements

- Configurable account-opening and maintenance workflows by customer segment and risk level.
- Human task management for branch, back office, compliance, and legal actors.
- SLA tracking, escalation, and exception queues.
- Document checklist management.
- Integrated approval matrix.
- Full audit trail of data changes and decisions.
- Event-driven integration with core banking, CRM, KYC/AML, DMS, and digital signature systems.

---

# 17. Future Evolution

- Fully digital account opening with remote identity verification.
- Real-time KYC refresh and continuous due diligence.
- API-first account servicing.
- AI-assisted compliance review.
- Omnichannel account lifecycle continuity.
- Embedded finance account-opening flows in partner ecosystems.

---

# 18. Suggested BPM Macro-Phases

| Phase | Description |
| --- | --- |
| Acquisition | Capture customer request and account need. |
| Identification | Verify customer identity and legal eligibility. |
| Due Diligence | Perform KYC, AML, tax, and risk checks. |
| Configuration | Select account type, conditions, limits, and channels. |
| Approval | Route exceptions or high-risk cases to authorized roles. |
| Activation | Create account, generate IBAN, sign contracts, and enable operations. |
| Lifecycle Management | Maintain account data, delegations, limits, and status. |
| Monitoring | Monitor compliance, restrictions, and data quality. |
| Closure | Close account, settle balances, remove linked instruments, and archive evidence. |

