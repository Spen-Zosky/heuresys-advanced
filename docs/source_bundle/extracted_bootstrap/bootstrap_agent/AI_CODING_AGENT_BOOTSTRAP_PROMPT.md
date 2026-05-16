# AI Coding Agent Bootstrap Prompt
## Company HRMS/BPM Platform — Clean Repository Bootstrap

You are the **Development Team**.

Your task is to initialize a clean local repository for the Company HRMS/BPM Blueprint Platform.

You must consume the provided `Company_HRMS_BPM_Idempotent_Blueprint_Bundle_v3.zip` as the Source of Truth.

The platform must be implemented as a tenant-aware, authenticated, position-centric HRMS/BPM intelligence system.

---

# 1. Non-Negotiable Architecture

## 1.1 Central HRMS Object

The central HRMS object is:

```text
Position
```

not:

```text
Employee
```

The platform models organizational capacity through governed positions.

A user/person may occupy a position, but the position remains the structural object that carries job role, skills, learning paths, KPIs, assessment logic, career paths, succession relevance and compensation-intelligence profile.

## 1.2 Tenant Foundation

Every enterprise using the platform is a tenant.

You must implement:

```text
sys.sys_tenancies
sys.sys_users
```

with a one-to-many relationship:

```text
sys.sys_tenancies.tenant_id
  1 → N
sys.sys_users.user_tenant_id
```

## 1.3 User Foundation

Each user represents a platform person/account belonging to one tenant.

A user is not the full Core HR employee dossier.

The `sys.sys_users` table is the platform identity/person anchor and must not be overloaded with detailed personal, educational, family, health, payroll or benefits data.

## 1.4 Position Assignment

A user may be assigned to a position over time.

You must create a separate bridge table:

```text
sys.sys_user_position_assignments
```

Do not store only one `position_id` directly in `sys.sys_users` as the primary assignment mechanism.

This is required to support:

- historical assignments;
- primary and secondary assignments;
- interim assignments;
- future multiple assignments;
- vacancy tracking;
- succession and readiness analysis.

## 1.5 Authentication Separation

Authentication is a separate layer.

Do not store passwords or credential secrets in `sys.sys_users`.

Create a dedicated auth foundation for:

- auth identities;
- password credentials;
- sessions;
- refresh tokens;
- login events;
- password reset tokens;
- MFA factors;
- roles;
- permissions;
- user-role assignments.

## 1.6 Scope Boundary

The platform is **not**:

- Core HR Administration;
- Payroll execution;
- Time & Attendance execution;
- Benefits/Welfare administration;
- Procurement/Vendor Governance;
- IAM/Badge/Device provisioning;
- Facilities management;
- medical/anamnestic record management.

The platform is:

- tenant-aware;
- authenticated;
- position-centric;
- BPM-aware;
- skill/KPI/learning/gap/career/succession/compensation-intelligence oriented.

---

# 2. Required Bootstrap Milestones

## MVP-0 — Repository and DBMS

Create:

- repository structure;
- Docker Compose;
- PostgreSQL 16;
- sys schema;
- idempotent migrations;
- reference seed data;
- validation scripts.

## MVP-1 — API Layer

Create:

- TypeScript API;
- authentication module;
- tenants module;
- users module;
- enterprise typing module;
- blueprints module;
- positions module;
- skills module;
- KPIs module;
- learning module;
- assessment/gap module;
- career/succession module;
- compensation-intelligence module.

## MVP-2 — Admin Frontend

Create an admin/blueprint console for:

- login;
- tenant registry;
- enterprise typing wizard;
- blueprint browser;
- process registry;
- organization model;
- position catalogue;
- user registry;
- user-position assignments;
- skill taxonomy;
- KPI catalogue;
- learning path catalogue;
- gap analysis dashboard;
- career/succession dashboard;
- compensation intelligence dashboard.

Do not implement a full employee self-service portal yet.

---

# 3. Required Stack

## Backend

Use:

- Node.js;
- TypeScript;
- Express or Fastify;
- PostgreSQL;
- node-postgres or Drizzle ORM;
- Zod validation;
- password hashing via Argon2 or bcrypt;
- session/JWT authentication;
- structured logging.

## Frontend

Use:

- Next.js;
- TypeScript;
- Tailwind CSS;
- shadcn/ui;
- React Hook Form;
- Zod;
- TanStack Query.

## Database

Use:

- PostgreSQL 16;
- schema `sys`;
- table names `sys.sys_*`;
- plural table names;
- idempotent SQL migrations.

---

# 4. Heuresys Naming Rules

Follow these rules strictly:

```text
Use schema sys.
Use table names sys.sys_*.
Use plural table names.
Do not introduce br_* tables.
Do not use RLS as tenant isolation strategy.
```

For users:

```text
Use user_* field prefixes.
Never use usr_*.
```

The FK from users to tenants must be:

```text
sys.sys_users.user_tenant_id
  → sys.sys_tenancies.tenant_id
```

The tenant primary key must be:

```text
sys.sys_tenancies.tenant_id
```

---

# 5. Required Output

At the end of bootstrap, the repository must contain:

- working Docker Compose;
- PostgreSQL schema;
- executable migrations;
- seed reference bank tenant;
- synthetic user/person records for development only;
- position catalogue;
- user-position assignments;
- skill/KPI/learning/gap/career/compensation data foundation;
- API server scaffold;
- frontend admin scaffold;
- DB validation scripts;
- README with run instructions;
- evidence that all validation scripts pass.

Do not mark the task complete unless validation passes.

---

# v5 Brownfield Adaptation Requirement

If a legacy `db-export.zip` is provided, you must treat it as a brownfield enrichment source, not as the target schema.

You must:

1. build the clean target architecture first;
2. inspect the legacy export;
3. produce `BROWNFIELD_ADAPTATION_MAP.md`;
4. classify every legacy table as IMPORT, TRANSFORM, REFERENCE_ONLY or EXCLUDE;
5. stage candidate records;
6. validate and approve candidates;
7. apply only approved records into canonical `sys.sys_*` tables;
8. preserve source lineage;
9. exclude Core HR, payroll, benefits, medical/anamnestic, attendance, raw PII, raw SAP HR and RLS/runtime artifacts.

Do not copy the old public schema as the new schema.
Do not allow the legacy DBMS to alter the position-centric target architecture.
