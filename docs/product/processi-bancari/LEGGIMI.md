# Processi bancari di riferimento (FIN_BANKING)

I diciotto blueprint di processo del settore bancario del bootstrap pack v5 (2026-05-15). Stavano in `docs/source_bundle/extracted_bootstrap/industry_blueprints/FIN_BANKING/processes/` e sono stati accorpati qui il 2026-11-25, con il riordino della documentazione, senza cambiarne il testo: sono l'unica fonte nel repository di questa conoscenza di dominio. I processi 18-22 del pacchetto (KPI, percorsi di apprendimento, gap, carriere, compensi) erano copie identiche dei modelli universali e restano solo in `docs/source_bundle/extracted_bootstrap/universal_hrms_framework/` (U04-U08).

Sono un riferimento di settore, non lo stato del prodotto. Nel datastore la famiglia bancaria vive nel catalogo dei processi (migrazione `0110_la_famiglia_bancaria.sql`); il tenant RTL Bank ne vede il proprio perimetro (ADR-0043). Quando si definisce un processo si usano insieme questo quadro di settore e quello cross-industry.

| file | processo |
|---|---|
| `00_Enterprise_Typing_and_Blueprint_Configuration.md` | Enterprise Typing and Blueprint Configuration |
| `01_Current_Accounts_Management.md` | Retail Banking Operations — Current Accounts Management |
| `02_Payments_and_Transactions_Management.md` | Retail Banking Operations — Payments & Transactions Management |
| `03_Cash_Operations_Management.md` | Retail Banking Operations — Cash Operations Management |
| `04_Deposit_Products_Management.md` | Retail Banking Operations — Deposit Products Management |
| `05_Lending_and_Credit_Management.md` | Lending & Credit Management — Retail and SME Lending |
| `06_Customer_Relationship_Management.md` | Customer Relationship Management — Customer Lifecycle, Service and Engagement |
| `07_Compliance_AML_and_Regulatory_Processes.md` | Compliance, AML & Regulatory Processes — Compliance, KYC, AML and Supervisory Reporting |
| `08_Risk_Management.md` | Risk Management — Enterprise Risk Management |
| `09_Treasury_and_Finance.md` | Treasury & Finance — Treasury, Accounting, ALM and Financial Control |
| `10_Digital_Banking_and_Channels.md` | Digital Banking & Channels — Digital and Omnichannel Banking |
| `11_Sales_and_Commercial_Processes.md` | Sales & Commercial Processes — Retail and SME Commercial Development |
| `12_Branch_Operations.md` | Branch Operations — Branch Administration and Front Office Operations |
| `13_Legal_and_Litigation.md` | Legal & Litigation — Legal Advisory, Contracts and Litigation Management |
| `14_HR_and_Internal_Services.md` | Retail Banking Operations — People, Workforce and Internal Services Management |
| `15_IT_and_Banking_Technology_Operations.md` | IT & Banking Technology Operations — Core Banking, ITSM, Cybersecurity and Data Operations |
| `16_Business_Continuity_and_Security.md` | Business Continuity & Security — Operational Resilience, Fraud Prevention and Physical Security |
| `17_AI_Augmented_Banking_Processes.md` | AI-Augmented Banking — AI-Enabled Banking Intelligence and Automation |
