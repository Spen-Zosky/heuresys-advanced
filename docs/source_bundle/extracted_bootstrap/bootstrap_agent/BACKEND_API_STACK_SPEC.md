# Backend API Stack Specification

---

# 1. Purpose

The backend API exposes tenant, auth, user, blueprint, position and HRMS intelligence data to the admin frontend.

---

# 2. Recommended Stack

Use:

```text
Node.js
TypeScript
Express or Fastify
PostgreSQL
node-postgres or Drizzle ORM
Zod validation
Argon2 or bcrypt
JWT or secure session auth
```

---

# 3. Required API Modules

```text
auth
tenants
users
user-profiles
user-position-assignments
enterprise-typing
blueprints
bpm-processes
organization-units
positions
job-roles
skills
kpis
learning
assessments
gap-analysis
career-succession
compensation-intelligence
```

---

# 4. Minimum Endpoints

```text
POST /auth/login
POST /auth/logout
GET /auth/me

GET /tenants
POST /tenants
GET /tenants/:tenantId

GET /users
POST /users
GET /users/:userId

GET /positions
GET /positions/:positionId
GET /positions/:positionId/intelligence-profile

GET /processes
GET /skills
GET /kpis
GET /learning-paths
GET /gap-analysis
GET /career-succession
GET /compensation-intelligence
```

---

# 5. API Rules

- All endpoints must be tenant-aware.
- All write endpoints require authorization.
- Validate request bodies with Zod.
- Return consistent error objects.
- Do not expose password hashes or secrets.
- Do not expose sensitive profile data unless authorized.
