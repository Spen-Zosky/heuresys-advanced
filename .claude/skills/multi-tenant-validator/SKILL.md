---
name: multi-tenant-validator
description: Validazione architettura multi-tenant e tenantId enforcement
trigger: auto
model: sonnet
---

# Multi-Tenant Validator

Verifica che tutte le query database in architetture multi-tenant includano correttamente `tenantId` per prevenire data leakage tra tenant.

## Obiettivo

Garantire data isolation tra tenant verificando:
- Tutte le query hanno filtro `tenantId`
- Nessun accesso cross-tenant non autorizzato
- Audit trail completo con tenantId
- Convenzioni naming multi-tenant rispettate

## Regole da Verificare

### 1. Query Database MUST Include tenantId

```typescript
// ❌ VIOLAZIONE: Missing tenantId filter
const users = await prisma.user.findMany()

// ✅ CORRETTO: tenantId sempre presente
const users = await prisma.user.findMany({
  where: { tenantId: currentTenantId }
})
```

### 2. Create/Update MUST Set tenantId

```typescript
// ❌ VIOLAZIONE: tenantId not set on create
await prisma.user.create({
  data: {
    name: 'John',
    email: 'john@example.com'
  }
})

// ✅ CORRETTO: tenantId set
await prisma.user.create({
  data: {
    name: 'John',
    email: 'john@example.com',
    tenantId: currentTenantId
  }
})
```

### 3. Relations MUST Respect Tenant Boundaries

```typescript
// ❌ VIOLAZIONE: Relation senza verifica tenant
await prisma.order.create({
  data: {
    userId: req.body.userId, // Potrebbe essere di altro tenant!
    tenantId: currentTenantId
  }
})

// ✅ CORRETTO: Verifica che user appartenga al tenant
const user = await prisma.user.findFirst({
  where: {
    id: req.body.userId,
    tenantId: currentTenantId // Verifica tenant
  }
})

if (!user) {
  throw new Error('User not found or belongs to different tenant')
}

await prisma.order.create({
  data: {
    userId: user.id,
    tenantId: currentTenantId
  }
})
```

### 4. Raw Queries MUST Include tenantId

```typescript
// ❌ VIOLAZIONE: Raw query senza tenantId
const result = await prisma.$queryRaw`
  SELECT * FROM users WHERE email = ${email}
`

// ✅ CORRETTO: tenantId in WHERE clause
const result = await prisma.$queryRaw`
  SELECT * FROM users
  WHERE email = ${email}
    AND tenant_id = ${currentTenantId}
`
```

## Prisma Schema Conventions

```prisma
// ✅ Tutte le tabelle multi-tenant devono avere:
model User {
  id        String   @id @default(uuid())
  email     String
  name      String

  // REQUIRED: tenantId field
  tenantId  String   @map("tenant_id")
  tenant    Tenant   @relation(fields: [tenantId], references: [id])

  // REQUIRED: Unique index including tenantId
  @@unique([email, tenantId])

  // REQUIRED: Index on tenantId for query performance
  @@index([tenantId])
}

// ❌ VIOLAZIONE: Unique senza tenantId
model User {
  id       String @id
  email    String @unique  // ❌ Permette duplicate email cross-tenant!
  tenantId String
}
```

## Middleware per Enforcement Automatico

```typescript
// prisma/middleware/tenant-filter.ts

export function tenantFilterMiddleware(currentTenantId: string) {
  return prisma.$use(async (params, next) => {
    // Modelli multi-tenant
    const multiTenantModels = ['User', 'Order', 'Product', 'Invoice']

    if (multiTenantModels.includes(params.model)) {
      // Query
      if (params.action === 'findUnique' || params.action === 'findFirst') {
        params.args.where = {
          ...params.args.where,
          tenantId: currentTenantId
        }
      }

      if (params.action === 'findMany') {
        if (params.args.where) {
          if (params.args.where.tenantId === undefined) {
            params.args.where.tenantId = currentTenantId
          }
        } else {
          params.args.where = { tenantId: currentTenantId }
        }
      }

      // Create/Update
      if (params.action === 'create') {
        params.args.data.tenantId = currentTenantId
      }

      if (params.action === 'createMany') {
        params.args.data = params.args.data.map((item: any) => ({
          ...item,
          tenantId: currentTenantId
        }))
      }

      // Update: Prevent changing tenantId
      if (params.action === 'update' || params.action === 'updateMany') {
        if (params.args.data.tenantId) {
          delete params.args.data.tenantId
        }
        params.args.where = {
          ...params.args.where,
          tenantId: currentTenantId
        }
      }

      // Delete
      if (params.action === 'delete' || params.action === 'deleteMany') {
        params.args.where = {
          ...params.args.where,
          tenantId: currentTenantId
        }
      }
    }

    return next(params)
  })
}
```

## Audit Trail

```prisma
// Tutte le modifiche devono essere auditate
model AuditLog {
  id        String   @id @default(uuid())
  tenantId  String   @map("tenant_id")
  userId    String   @map("user_id")
  action    String   // CREATE, UPDATE, DELETE
  entity    String   // User, Order, etc.
  entityId  String   @map("entity_id")
  changes   Json     // Before/after values
  ipAddress String   @map("ip_address")
  createdAt DateTime @default(now()) @map("created_at")

  @@index([tenantId, createdAt])
  @@index([entityId])
}

// Funzione audit
async function auditAction(params: AuditParams) {
  await prisma.auditLog.create({
    data: {
      tenantId: params.tenantId,
      userId: params.userId,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      changes: params.changes,
      ipAddress: params.ipAddress
    }
  })
}
```

## Workflow Validazione

1. **Scansione file** in `src/api`, `src/lib`
2. **Identificare query Prisma** (`prisma.*.find`, `prisma.$queryRaw`)
3. **Verificare presenza tenantId** in WHERE clause
4. **Segnalare violazioni** con location esatta
5. **Suggerire fix** automatico
6. **Verificare Prisma schema** per index e unique constraints

## Output Format

```markdown
# Multi-Tenant Validation Report

## Summary
- Files scanned: 45
- Queries analyzed: 234
- Violations found: 8
- Critical: 3
- Warnings: 5

## Critical Violations

### 1. Missing tenantId in findMany
**Location:** `src/api/users/list.ts:23`
**Severity:** CRITICAL (data leakage risk)

**Current Code:**
\`\`\`typescript
const users = await prisma.user.findMany({
  where: { status: 'active' }
})
\`\`\`

**Fixed Code:**
\`\`\`typescript
const users = await prisma.user.findMany({
  where: {
    status: 'active',
    tenantId: req.user.tenantId
  }
})
\`\`\`

**Impact:** Returns users from ALL tenants (severe data leak)

### 2. Cross-tenant relation risk
**Location:** `src/api/orders/create.ts:45`
**Severity:** CRITICAL

**Current Code:**
\`\`\`typescript
await prisma.order.create({
  data: {
    userId: req.body.userId, // Not validated!
    tenantId: req.user.tenantId
  }
})
\`\`\`

**Fixed Code:**
\`\`\`typescript
// Verify user belongs to tenant
const user = await prisma.user.findFirst({
  where: {
    id: req.body.userId,
    tenantId: req.user.tenantId
  }
})

if (!user) {
  throw new Error('Invalid user')
}

await prisma.order.create({
  data: {
    userId: user.id,
    tenantId: req.user.tenantId
  }
})
\`\`\`

## Schema Issues

### Missing Tenant Index
\`\`\`prisma
model Product {
  id       String @id
  tenantId String
  // ❌ Missing: @@index([tenantId])
}
\`\`\`

**Fix:** Add index for query performance
\`\`\`prisma
model Product {
  id       String @id
  tenantId String

  @@index([tenantId])
}
\`\`\`

## Recommendations

1. **Implement middleware:** Auto-inject tenantId in all queries
2. **Add tests:** Verify tenant isolation
3. **Enable RLS:** Consider PostgreSQL Row Level Security
4. **Audit logging:** Track all cross-entity operations
```
