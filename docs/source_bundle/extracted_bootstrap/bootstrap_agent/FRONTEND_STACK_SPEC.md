# Frontend Stack Specification
## Admin / Blueprint Console

---

# 1. Purpose

The frontend bootstrap must create an Admin / Blueprint Console, not a full employee self-service portal.

The console should make the model inspectable and manageable.

---

# 2. Recommended Stack

Use:

```text
Next.js
TypeScript
Tailwind CSS
shadcn/ui
React Hook Form
Zod
TanStack Query
```

---

# 3. Initial Modules

```text
auth/login
tenant registry
enterprise typing wizard
blueprint browser
process registry
organization model viewer
position catalogue
position intelligence profile
user registry
user-position assignments
skill taxonomy
kpi catalogue
learning path catalogue
gap analysis dashboard
career/succession dashboard
compensation intelligence dashboard
admin role management
```

---

# 4. UX Requirements

- Professional enterprise dashboard.
- No playful UI.
- Clear left navigation.
- Breadcrumbs.
- Table views with filters/search.
- Detail pages for positions, users and tenants.
- Clear scope labels: in scope, partially out of scope, out of scope.
- Read-only inspection mode for blueprint documents.
- Forms with Zod validation.
- API error handling.
- Loading, empty and error states.

---

# 5. First Frontend Milestone

Implement:

```text
Login page
Dashboard shell
Tenant list
User list
Position list
Position detail / intelligence profile
Process registry browser
Skill taxonomy browser
```

Do not implement payroll, benefits, facilities, procurement or medical/anamnestic UI.
