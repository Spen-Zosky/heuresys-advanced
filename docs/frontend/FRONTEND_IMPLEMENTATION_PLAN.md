# Frontend Implementation Plan
## Heuresys Advanced — Admin / Blueprint Console (Next.js 15 App Router)

> **Status:** Planning deliverable #9 of 10.
> **Sources:** `FRONTEND_STACK_SPEC.md`, `FRONTEND_ROUTE_MAP.md`, `AUTH_POLICY_MATRIX.md`, `GRAPH_VISUALIZATION_MODEL_SPEC.md`, ADR‑0007, ADR‑0006.
> **Scope:** **two surfaces**: (a) Admin / Blueprint Console (MVP‑2a, 23 pages) — manager‑oriented; (b) Employee Self‑Service Portal (MVP‑2b, 13 pages) — `USER`‑role oriented, `self`‑scope only. Out of scope: payroll UI, benefits UI, attendance UI, medical UI, in‑app messaging, peer feedback flows, expense reports (deferred post‑MVP).

---

## 1. Stack & Versions

Per ADR‑0007:

| Component | Version | Why |
|-----------|---------|-----|
| Next.js | 15.x (App Router) | Server components, streaming, native ESM, latest LTS |
| React | 19.x | RSC support, `useTransition`, `useFormStatus` |
| TypeScript | 5.x | Project‑wide |
| Tailwind CSS | 4.x | Zero‑runtime utility CSS |
| shadcn/ui | latest | Copy‑in primitives (DataTable, Form, Dialog, Sheet, Toast, Command, Combobox, Calendar, …) |
| React Hook Form | 7.x | Form state |
| Zod | 3.x | Validation schemas (shared with API via `packages/shared`) |
| TanStack Query | v5 | Data fetching, cache, mutations, optimistic updates |
| React Flow (`@xyflow/react`) | 12.x | Graph renderer (org chart, process flow, career path, …) |
| Mermaid | 11.x | Fallback renderer for KPI cascade text export |
| pino (browser) | 9.x | Structured logs (optional; can fall back to console) |
| `next-intl` | 3.x | Bilingual it/en from MVP‑2 (see §13) |
| vitest + @testing-library/react | latest | Unit + component tests |
| playwright | 1.x | E2E smoke tests |

Node 20 LTS (>= 20.11). pnpm 9.

---

## 2. Directory Structure (`apps/web/`)

```
apps/web/
├── package.json
├── tsconfig.json
├── next.config.mjs
├── tailwind.config.ts
├── postcss.config.mjs
├── components.json                              # shadcn/ui config
├── public/
│   └── favicon.ico
└── src/
    ├── app/
    │   ├── layout.tsx                           # root layout (html, body, theme provider)
    │   ├── globals.css
    │   ├── (auth)/
    │   │   └── login/
    │   │       └── page.tsx
    │   ├── (ess)/                                # Employee Self-Service Portal (MVP-2b)
    │   │   ├── layout.tsx                        # ESS shell (lighter sidebar, "My HR" branding)
    │   │   ├── me/
    │   │   │   ├── page.tsx                      # /me — My HR landing dashboard
    │   │   │   ├── profile/page.tsx              # vista + edit profilo personale
    │   │   │   ├── positions/page.tsx            # current + history assignments
    │   │   │   ├── skills/
    │   │   │   │   ├── page.tsx                  # skill posseduti + proficiency
    │   │   │   │   └── self-assessment/page.tsx  # auto-assessment form
    │   │   │   ├── learning/
    │   │   │   │   ├── page.tsx                  # assignments + completion
    │   │   │   │   └── catalogue/page.tsx        # browse + self-enrollment
    │   │   │   ├── kpis/page.tsx                 # propri target + measurements
    │   │   │   ├── gaps/page.tsx                 # propri gap + closure plan
    │   │   │   ├── career/page.tsx               # career path + target request
    │   │   │   ├── certifications/page.tsx       # certs posseduti + upload URI
    │   │   │   ├── documents/page.tsx            # documenti personali (metadata)
    │   │   │   └── inbox/page.tsx                # notifiche (training scadute, manager feedback)
    │   ├── (admin)/
    │   │   ├── layout.tsx                       # admin shell layout (sidebar + topbar + breadcrumbs)
    │   │   ├── dashboard/page.tsx
    │   │   ├── tenants/
    │   │   │   ├── page.tsx                     # tenant registry
    │   │   │   └── [tenantId]/
    │   │   │       ├── page.tsx                 # tenant detail
    │   │   │       └── enterprise-typing/page.tsx
    │   │   ├── blueprints/
    │   │   │   ├── page.tsx
    │   │   │   └── [variantId]/page.tsx
    │   │   ├── processes/page.tsx
    │   │   ├── organization/
    │   │   │   ├── page.tsx                     # org structure list
    │   │   │   └── org-chart/page.tsx           # graph viewer (React Flow)
    │   │   ├── users/
    │   │   │   ├── page.tsx                     # user registry
    │   │   │   └── [userId]/
    │   │   │       ├── page.tsx
    │   │   │       └── assignments/page.tsx
    │   │   ├── positions/
    │   │   │   ├── page.tsx                     # position catalogue
    │   │   │   └── [positionId]/
    │   │   │       ├── page.tsx                 # intelligence profile
    │   │   │       ├── skills/page.tsx
    │   │   │       ├── kpis/page.tsx
    │   │   │       └── learning/page.tsx
    │   │   ├── skills/page.tsx                  # skill taxonomy
    │   │   ├── kpis/page.tsx                    # KPI catalogue
    │   │   ├── learning/
    │   │   │   ├── page.tsx                     # learning catalogue
    │   │   │   └── training-initiatives/page.tsx
    │   │   ├── gaps/page.tsx                    # gap analysis dashboard
    │   │   ├── career-succession/page.tsx
    │   │   ├── compensation-intelligence/page.tsx
    │   │   ├── visualizations/
    │   │   │   ├── page.tsx                     # visualization browser
    │   │   │   └── [graphId]/page.tsx
    │   │   ├── seed-acquisition/
    │   │   │   └── runs/page.tsx
    │   │   ├── brownfield-adaptation/page.tsx
    │   │   └── admin/
    │   │       └── roles/page.tsx               # role / permission management
    │   ├── error.tsx                            # root error boundary
    │   ├── not-found.tsx                        # 404
    │   └── api/                                 # optional: BFF route handlers if needed
    ├── components/
    │   ├── ui/                                  # shadcn/ui primitives (copied in)
    │   ├── layout/
    │   │   ├── Sidebar.tsx
    │   │   ├── Topbar.tsx
    │   │   └── Breadcrumbs.tsx
    │   ├── data/
    │   │   ├── DataTable.tsx                    # generic, sortable, paginated table
    │   │   └── ConfirmDialog.tsx
    │   └── forms/                                # generic form primitives
    ├── features/                                # one folder per domain
    │   ├── auth/
    │   │   ├── hooks/                           # useLogin, useLogout, useCurrentUser
    │   │   ├── lib/                             # csrf.ts (BroadcastChannel), apiClient.ts
    │   │   └── components/
    │   ├── tenants/
    │   ├── users/
    │   ├── positions/
    │   ├── skills/
    │   ├── kpis/
    │   ├── learning/
    │   ├── gaps/
    │   ├── career-succession/
    │   ├── compensation-intelligence/
    │   ├── visualizations/
    │   │   ├── components/
    │   │   │   ├── ReactFlowRenderer.tsx
    │   │   │   ├── MermaidRenderer.tsx
    │   │   │   └── ExportButton.tsx
    │   │   └── hooks/
    │   ├── seed-acquisition/
    │   └── brownfield-adaptation/
    └── lib/
        ├── api.ts                                # base fetch wrapper with CSRF + refresh on 401
        ├── env.ts                                # validated env (Zod)
        ├── i18n.ts                               # optional Italian/English toggle (post-MVP)
        └── query-client.ts                       # TanStack Query default config
```

Route groups `(auth)` and `(admin)` separate the unauthenticated login flow from the admin shell. The admin layout enforces auth + role checks at the layout level (server‑side).

---

## 3. Layout Hierarchy

### 3.1 Root layout (`app/layout.tsx`)

Server component. Sets `<html>`, `<body>`, theme provider, TanStack Query provider, Toast portal. **Bilingual from MVP‑2**: default locale `it` (target market Italy), with `en` as full alternate; switcher in top‑bar. The `lang` attribute is dynamic on the locale segment (via `next-intl` route groups `/[locale]/...` or via cookie‑driven middleware redirect).

```tsx
import { getLocale } from "@/lib/i18n";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();   // "it" | "en"; "it" default, persisted via cookie or URL segment
  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers locale={locale}>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
```

`<Providers>` is a client component wrapping `NextIntlClientProvider` + TanStack Query + theme + auth context.

> **Bilingual implementation since MVP‑2** (promoted from post‑MVP after Review #7 decision). All UI strings live in `apps/web/src/locales/{it,en}.json` from day one; the app ships with `it` as default. See §13 for the strategy.

### 3.2 Admin layout (`app/(admin)/layout.tsx`)

Server component. Runs **server‑side auth check**:

```tsx
import { redirect } from "next/navigation";
import { getServerSession } from "@/features/auth/lib/server-session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();   // reads `hrx_access` cookie, verifies JWT
  if (!session) redirect("/login");

  return (
    <div className="grid grid-cols-[260px_1fr] h-screen">
      <Sidebar roles={session.roles} />
      <div className="flex flex-col">
        <Topbar user={session.user} />
        <Breadcrumbs />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

The sidebar filters menu items by role (see §5). The topbar shows the current tenant context (with switcher for `PLATFORM_ADMIN`).

### 3.3 Auth layout (`app/(auth)/login/page.tsx`)

Minimal centered card layout. No sidebar/topbar.

---

## 4. Route → Role Binding

Cross‑reference with `AUTH_SECURITY_PLAN.md` §6 (Role × Permission matrix). Each route declares the minimum required role(s); access is enforced server‑side by `AdminLayout` (coarse) + per‑page `requirePermission()` calls (fine).

| Route | Min role | Required permission | Notes |
|-------|----------|--------------------|-------|
| `/login` | (public) | — | redirect to `/dashboard` if already authenticated |
| `/dashboard` | USER | — | landing page; widgets gated individually |
| `/tenants` | PLATFORM_ADMIN | `tenant:list` | cross‑tenant |
| `/tenants/[id]` | TENANT_ADMIN+ | `tenant:read` | tenant scope check |
| `/tenants/[id]/enterprise-typing` | BLUEPRINT_MANAGER+ | `enterprise_typing:read` + `:update` | |
| `/blueprints` | BLUEPRINT_MANAGER+ | `blueprint:read` | |
| `/blueprints/[variantId]` | BLUEPRINT_MANAGER+ | `blueprint:read` | activate requires `blueprint:activate` |
| `/processes` | PROCESS_OWNER+ | `bpm_process:read` | |
| `/organization` | MANAGER+ | `organization_unit:read` | |
| `/organization/org-chart` | MANAGER+ | `visualization:read` + `organization_unit:read` | React Flow viewer |
| `/users` | MANAGER+ | `user:list` | scope filter: MANAGER sees team only |
| `/users/[userId]` | MANAGER+ | `user:read` | self‑service users see only `self` |
| `/users/[userId]/assignments` | HRMS_MANAGER+ | `user_position_assignment:read` | |
| `/positions` | USER+ | `position:list` | scope filter applies |
| `/positions/[positionId]` | USER+ | `position:read` | full Position Intelligence Profile view |
| `/positions/[positionId]/skills` | HRMS_MANAGER+ | `position:update` + `skill:read` | |
| `/positions/[positionId]/kpis` | HRMS_MANAGER+ | `position:update` + `kpi:read` | |
| `/positions/[positionId]/learning` | HRMS_MANAGER+ | `position:update` + `learning:read` | |
| `/skills` | USER+ | `skill:read` | full catalogue |
| `/kpis` | USER+ | `kpi:read` | |
| `/learning` | USER+ | `learning:read` | |
| `/learning/training-initiatives` | HRMS_MANAGER+ | `training_initiative:list` | |
| `/gaps` | HRMS_MANAGER+ | `gap_analysis:read` | scope filter applies for MANAGER |
| `/career-succession` | HRMS_MANAGER+ | `career_succession:read` | |
| `/compensation-intelligence` | HRMS_MANAGER+ | `compensation_intelligence:read` | restricted compensation visibility |
| `/visualizations` | USER+ | `visualization:read` | browser of all graphs |
| `/visualizations/[graphId]` | USER+ | `visualization:read` | per‑graph renderer |
| `/seed-acquisition/runs` | TENANT_ADMIN+ | `seed_acquisition:trigger` + `:read` | |
| `/brownfield-adaptation` | TENANT_ADMIN+ (PLATFORM_ADMIN for approve) | `brownfield_adaptation:read` | trigger/approve gated |
| `/admin/roles` | PLATFORM_ADMIN | `role:read` + `:create`/`:update` | |

Forbidden access patterns:

- Unauthenticated → redirect `/login`.
- Authenticated but missing role/permission → `403` page with sidebar + breadcrumb intact (no information leak via 404 vs 403 distinction).
- Tenant boundary violation (PLATFORM_ADMIN switches to a tenant they should not see) → enforced by API; UI shows generic 403.

---

## 5. Sidebar Navigation (filtered by role)

```tsx
const MENU = [
  { label: "Dashboard", href: "/dashboard", icon: HomeIcon, requires: [] },
  {
    section: "Tenants & Blueprints",
    items: [
      { label: "Tenants", href: "/tenants", requires: ["PLATFORM_ADMIN"] },
      { label: "Blueprints", href: "/blueprints", requires: ["BLUEPRINT_MANAGER", "TENANT_ADMIN", "PLATFORM_ADMIN"] },
      { label: "Processes", href: "/processes", requires: ["PROCESS_OWNER", "BLUEPRINT_MANAGER", "TENANT_ADMIN", "PLATFORM_ADMIN"] },
    ],
  },
  {
    section: "Organization & People",
    items: [
      { label: "Organization", href: "/organization", requires: ["MANAGER", "HRMS_MANAGER", "TENANT_ADMIN", "PLATFORM_ADMIN"] },
      { label: "Org Chart", href: "/organization/org-chart", requires: ["MANAGER", "HRMS_MANAGER", "TENANT_ADMIN", "PLATFORM_ADMIN"] },
      { label: "Users", href: "/users", requires: ["MANAGER", "HRMS_MANAGER", "TENANT_ADMIN", "PLATFORM_ADMIN"] },
      { label: "Positions", href: "/positions", requires: ["USER", "READ_ONLY"] /* visible to all */ },
    ],
  },
  {
    section: "Workforce Intelligence",
    items: [
      { label: "Skills", href: "/skills", requires: [] },
      { label: "KPIs", href: "/kpis", requires: [] },
      { label: "Learning", href: "/learning", requires: [] },
      { label: "Training Initiatives", href: "/learning/training-initiatives", requires: ["HRMS_MANAGER", "TENANT_ADMIN", "PLATFORM_ADMIN"] },
      { label: "Gap Analysis", href: "/gaps", requires: ["HRMS_MANAGER", "TENANT_ADMIN", "PLATFORM_ADMIN"] },
      { label: "Career & Succession", href: "/career-succession", requires: ["HRMS_MANAGER", "TENANT_ADMIN", "PLATFORM_ADMIN"] },
      { label: "Compensation Intelligence", href: "/compensation-intelligence", requires: ["HRMS_MANAGER", "TENANT_ADMIN", "PLATFORM_ADMIN"] },
    ],
  },
  {
    section: "Tools",
    items: [
      { label: "Visualizations", href: "/visualizations", requires: [] },
      { label: "Seed Acquisition", href: "/seed-acquisition/runs", requires: ["TENANT_ADMIN", "PLATFORM_ADMIN"] },
      { label: "Brownfield Adaptation", href: "/brownfield-adaptation", requires: ["TENANT_ADMIN", "PLATFORM_ADMIN"] },
    ],
  },
  {
    section: "Administration",
    items: [
      { label: "Roles & Permissions", href: "/admin/roles", requires: ["PLATFORM_ADMIN"] },
    ],
  },
];
```

The sidebar component filters items by intersection with the user's roles (empty `requires` = visible to all authenticated users).

---

## 6. Component Inventory (per page)

A page uses a curated set of shadcn primitives. Below is the inventory per page.

| Page | Primary primitives | Notes |
|------|--------------------|-------|
| `/login` | `Card`, `Form`, `Input`, `Button`, `Label`, `Alert` | Centered card; minimal copy; "Forgot password?" link |
| `/dashboard` | `Card` (KPI tiles), `Skeleton`, `Avatar` | Server‑rendered tiles; widget‑gated by role |
| `/tenants` | `DataTable`, `Button`, `Dialog`, `Form` | Filters, pagination, "Create tenant" dialog (PLATFORM_ADMIN only) |
| `/tenants/[id]` | `Tabs`, `Card`, `Badge` | Tabs: Overview, Enterprise Typing, Blueprints, Users, Settings |
| `/tenants/[id]/enterprise-typing` | `Form`, `Combobox`, `Select`, `Button` | ATECO/NACE wizard, blueprint variant choice |
| `/blueprints` | `DataTable`, `Combobox` | Filter by industry family |
| `/blueprints/[variantId]` | `Tabs`, `DataTable`, `Button` | Tabs: Processes, KPIs, Activations; Activate button |
| `/processes` | `DataTable`, `Sheet` | Right‑side sheet with full process detail |
| `/organization` | `Tree` (custom, built on shadcn) | Hierarchical org tree with expand/collapse |
| `/organization/org-chart` | `ReactFlowRenderer`, `Toolbar`, `ExportButton` | Drag/zoom; layout switcher (Dagre/ELK/Tree); export SVG/PDF |
| `/users` | `DataTable`, `Filter`, `Dialog`, `Form` | Search by name/email; per‑row "Manage assignments" |
| `/users/[userId]` | `Tabs`, `Card`, `Badge`, `Avatar` | Tabs: Profile, Assignments, Skills, Learning, KPIs, Roles |
| `/users/[userId]/assignments` | `DataTable`, `Dialog`, `Form` | History rows + "Add assignment" (interim/secondary) |
| `/positions` | `DataTable`, `Filter`, `Combobox` | Filter by org unit, job role, criticality |
| `/positions/[positionId]` | `Card` panels (PIP sections), `Tabs`, `ReactFlowRenderer` (mini) | Position Intelligence Profile + small graph fragment showing reports‑to chain |
| `/positions/[positionId]/skills` | `DataTable`, `Combobox`, `Form` | Add/remove required skill, proficiency, weight |
| `/positions/[positionId]/kpis` | `DataTable`, `Combobox`, `Form` | Add/remove required KPI, target template, weight |
| `/positions/[positionId]/learning` | `DataTable`, `Combobox`, `Form`, `Switch` | Add/remove learning path, mandatory toggle, deadline rule |
| `/skills` | `DataTable`, `Filter`, `Sheet`, `Form` | Skill taxonomy tree + detail sheet |
| `/kpis` | `DataTable`, `Sheet` | KPI catalogue + detail |
| `/learning` | `DataTable`, `Filter`, `Sheet` | Learning module catalogue |
| `/learning/training-initiatives` | `DataTable`, `Form`, `Dialog`, `Calendar` | Schedule training instances |
| `/gaps` | `DataTable`, `Chart` (recharts via shadcn), `Filter` | Gap analysis dashboard with chart + table |
| `/career-succession` | `DataTable`, `Tabs`, `ReactFlowRenderer` (career path graph) | Career paths + succession pools |
| `/compensation-intelligence` | `DataTable`, `Card`, `Badge`, `Alert` | Reward gates status; restricted visibility |
| `/visualizations` | `Combobox`, `DataTable` | Browse all `sys.sys_visualization_graphs` per tenant |
| `/visualizations/[graphId]` | `ReactFlowRenderer` (full‑viewport), `Toolbar`, `ExportButton`, `Sheet` (node detail) | Full graph view with edit‑layout mode |
| `/seed-acquisition/runs` | `DataTable`, `Dialog`, `Form`, `Badge` | Trigger run; per‑run candidate review |
| `/brownfield-adaptation` | `Tabs`, `DataTable`, `Alert`, `Form` | Tabs: Inventory, Mapping, Runs, Approvals |
| `/admin/roles` | `DataTable`, `Form`, `Combobox` | Role × permission editor (PLATFORM_ADMIN only) |

---

## 7. Data Fetching with TanStack Query

### 7.1 Base fetch wrapper

```ts
// apps/web/src/lib/api.ts
import { z } from "zod";
import { csrfTokenStore } from "@/features/auth/lib/csrf";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { schema?: z.ZodSchema<T>; isRetry?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.method && ['POST', 'PATCH', 'DELETE', 'PUT'].includes(init.method.toUpperCase())) {
    const csrf = csrfTokenStore.get();
    if (!csrf) throw new Error("Missing CSRF token");
    headers.set('X-CSRF-Token', csrf);
  }
  headers.set('Content-Type', 'application/json');

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',   // send cookies
  });

  if (res.status === 401 && !init.isRetry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiFetch(path, { ...init, isRetry: true });
    }
    window.location.href = '/login';
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error?.code, body.error?.message);
  }

  const data = await res.json();
  return init.schema ? init.schema.parse(data) : data;
}
```

### 7.2 Per‑module hooks

```ts
// apps/web/src/features/positions/hooks/usePositions.ts
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { PositionListSchema } from "@heuresys/shared/schemas/positions";

export function usePositions(filters: PositionFilters) {
  return useQuery({
    queryKey: ["positions", filters],
    queryFn: () => apiFetch(`/positions?${new URLSearchParams(filters).toString()}`, {
      schema: PositionListSchema,
    }),
  });
}
```

### 7.3 Mutations with optimistic updates

```ts
export function useCreatePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePositionInput) =>
      apiFetch('/positions', { method: 'POST', body: JSON.stringify(payload), schema: PositionSchema }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['positions'] });
      toast.success("Position created");
    },
    onError: (e: ApiError) => {
      toast.error(e.message || "Failed to create position");
    },
  });
}
```

### 7.4 QueryClient defaults

```ts
// apps/web/src/lib/query-client.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (err) => { /* default toast */ },
    },
  },
});
```

---

## 8. Forms — React Hook Form + Zod

Shared schemas live in `packages/shared/src/schemas/` and are imported by both `apps/web` and `apps/api`. Example:

```ts
// packages/shared/src/schemas/positions.ts
export const CreatePositionSchema = z.object({
  position_code: z.string().min(1).max(128),
  position_title: z.string().min(1).max(255),
  position_organization_unit_id: z.string().uuid().nullable(),
  position_job_role_id: z.string().uuid().nullable(),
  position_owner_user_id: z.string().uuid().nullable(),
  position_criticality: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  position_economic_weight: z.number().min(0).max(1).optional(),
  position_effective_from: z.coerce.date().default(() => new Date()),
});
export type CreatePositionInput = z.infer<typeof CreatePositionSchema>;
```

Frontend form:

```tsx
// apps/web/src/features/positions/components/PositionForm.tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreatePositionSchema, type CreatePositionInput } from "@heuresys/shared/schemas/positions";

export function PositionForm({ onSubmit }: { onSubmit: (data: CreatePositionInput) => void }) {
  const form = useForm<CreatePositionInput>({
    resolver: zodResolver(CreatePositionSchema),
    defaultValues: { position_code: "", position_title: "" },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="position_code" render={({ field }) => (
          <FormItem>
            <FormLabel>Position Code</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        {/* ... */}
        <Button type="submit" disabled={form.formState.isSubmitting}>Create</Button>
      </form>
    </Form>
  );
}
```

The Zod schema is the **single source of truth** — same validation runs on the server.

---

## 9. Auth Client (Cookie + Refresh + CSRF)

### 9.1 Session bootstrap

```ts
// apps/web/src/features/auth/hooks/useCurrentUser.ts
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { UserSchema } from "@heuresys/shared/schemas/users";

export function useCurrentUser() {
  return useQuery({
    queryKey: ["currentUser"],
    queryFn: () => apiFetch("/auth/me", { schema: UserSchema }),
    staleTime: 5 * 60_000,
    retry: false,
  });
}
```

### 9.2 Login mutation

```ts
export function useLogin() {
  return useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      const res = await apiFetch<{ user: User; roles: string[]; csrfToken: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
      });
      csrfTokenStore.set(res.csrfToken);
      return res;
    },
    onSuccess: () => router.push("/dashboard"),
  });
}
```

### 9.3 Logout

```ts
export function useLogout() {
  return useMutation({
    mutationFn: () => apiFetch("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      csrfTokenStore.clear();
      qc.clear();
      router.push("/login");
    },
  });
}
```

### 9.4 Silent refresh on 401

Handled inside `apiFetch` (see §7.1). On a 401 not already retried, the wrapper calls `/auth/refresh`; if successful, the original request retries; otherwise the user is redirected to `/login`.

### 9.5 Cross‑tab CSRF rotation

```ts
// apps/web/src/features/auth/lib/csrf.ts
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("hrx_csrf_rotation") : null;

class CsrfTokenStore {
  private token: string | null = null;

  constructor() {
    if (typeof document !== "undefined") {
      const match = document.cookie.match(/hrx_csrf=([^;]+)/);
      this.token = match?.[1] ?? null;
    }
    channel?.addEventListener("message", (e) => {
      if (e.data?.type === "CSRF_ROTATED") this.token = e.data.token;
    });
  }

  get(): string | null { return this.token; }

  set(token: string) {
    this.token = token;
    channel?.postMessage({ type: "CSRF_ROTATED", token });
  }

  clear() {
    this.token = null;
    channel?.postMessage({ type: "CSRF_ROTATED", token: null });
  }
}

export const csrfTokenStore = new CsrfTokenStore();
```

---

## 10. Visualization Renderer

### 10.1 React Flow integration

```tsx
// apps/web/src/features/visualizations/components/ReactFlowRenderer.tsx
import ReactFlow, { Background, Controls, MiniMap, useReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

export function ReactFlowRenderer({ graphId, layoutId }: { graphId: string; layoutId?: string }) {
  const { data: graph } = useGraph(graphId, layoutId);
  const updateNodeLayout = useUpdateNodeLayout(graphId, layoutId);

  if (!graph) return <Skeleton className="h-full w-full" />;

  return (
    <ReactFlow
      nodes={graph.nodes}
      edges={graph.edges}
      onNodeDragStop={(_, node) => {
        updateNodeLayout.mutate({ nodeId: node.id, x: node.position.x, y: node.position.y });
      }}
      fitView
      proOptions={{ hideAttribution: true }}
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}
```

> ⚠️ **React Flow Pro licensing notice**. The `proOptions.hideAttribution: true` flag suppresses the "React Flow" badge shown by default. This is only permitted under a **React Flow Pro** commercial license (see <https://reactflow.dev/pro>). For local development, internal demos and personal projects the badge can stay visible (`hideAttribution: false`) and no license is required. **Before any commercial production deployment** of `apps/web`, decide between: (a) purchase React Flow Pro subscription and keep `hideAttribution: true`; (b) remove the flag, accept visible attribution; (c) swap React Flow with a custom D3 renderer (significant rewrite). The MVP‑2 build uses option (a) under the assumption of personal/dev use; an ADR (`0012_react_flow_pro_licensing`) will be opened when production deployment is on the table.

`onNodeDragStop` updates **only** `sys.sys_visualization_node_layouts` via `PATCH /visualizations/{graphId}/layouts/{layoutId}/nodes/{nodeId}` — never the semantic graph (per ADR‑0009 + I10).

### 10.2 Layout switcher

A toolbar offers:

```text
[Layout: Dagre ▾]  [Engine: Auto ▾]  [Save layout v2]  [Export ▾]
```

Selecting "Dagre" calls `POST /visualizations/{graphId}/layouts` with `layout_engine = DAGRE`, which the server computes (using `dagre` npm at the API or pre‑computed in a worker) and returns. The viewer switches to the new `layoutId`.

### 10.3 Mermaid fallback

For graphs with `graph_type = KPI_CASCADE`, the renderer falls back to a Mermaid diagram (better for hierarchical text rendering):

```tsx
import mermaid from "mermaid";
mermaid.initialize({ startOnLoad: false, theme: "default" });

export function MermaidRenderer({ source }: { source: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) mermaid.run({ nodes: [ref.current] });
  }, [source]);
  return <pre ref={ref} className="mermaid">{source}</pre>;
}
```

The API returns the Mermaid source as part of the graph payload when `export_format = MERMAID`.

### 10.4 Export

`ExportButton` triggers `GET /visualizations/{graphId}/exports?format=svg|pdf|png|mermaid|react_flow_json`. The server pre‑computes the export (in `sys.sys_visualization_exports.payload_uri`) and returns the file or a download URL.

---

## 11. Initial Pages — Summary

| # | Page | Route | Purpose |
|---|------|-------|---------|
| 1 | Login | `/login` | Email + password |
| 2 | Dashboard | `/dashboard` | KPI tiles per role |
| 3 | Tenant registry | `/tenants` | List tenants (PLATFORM_ADMIN) |
| 4 | Enterprise typing wizard | `/tenants/[id]/enterprise-typing` | ATECO/NACE + blueprint variant |
| 5 | Blueprint browser | `/blueprints` | Industry blueprint families/variants |
| 6 | Process registry | `/processes` | 23 BPM processes |
| 7 | Organization model viewer | `/organization` | Tree + table |
| 8 | Org chart viewer | `/organization/org-chart` | React Flow |
| 9 | User registry | `/users` | List + filter + add user |
| 10 | User detail / assignments | `/users/[userId]` + `/assignments` | Profile, history, current assignments |
| 11 | Position catalogue | `/positions` | List + filters |
| 12 | Position Intelligence Profile | `/positions/[positionId]` | Full PIP view (consumes the view) |
| 13 | Position skill requirements | `/positions/[positionId]/skills` | Manage required skills |
| 14 | Position KPI requirements | `/positions/[positionId]/kpis` | Manage required KPIs |
| 15 | Position learning requirements | `/positions/[positionId]/learning` | Manage required learning paths |
| 16 | Skill taxonomy | `/skills` | Browse skills + family tree |
| 17 | KPI catalogue | `/kpis` | Browse KPI definitions |
| 18 | Learning catalogue | `/learning` | Browse learning modules |
| 19 | Training initiatives | `/learning/training-initiatives` | Schedule cohorts |
| 20 | Gap analysis dashboard | `/gaps` | Chart + table |
| 21 | Career & Succession dashboard | `/career-succession` | Career paths + succession pools |
| 22 | Compensation intelligence dashboard | `/compensation-intelligence` | Reward gates status, profile |
| 23 | Visualization browser | `/visualizations` | All available graphs |
| 24 | Visualization viewer | `/visualizations/[graphId]` | Full‑viewport graph + edit layout |
| 25 | Seed acquisition runs | `/seed-acquisition/runs` | Trigger + review candidates |
| 26 | Brownfield adaptation | `/brownfield-adaptation` | Inventory + map + waves |
| 27 | Roles & permissions | `/admin/roles` | Platform admin only |

(27 routes covering the 23 functional pages; some functional pages have sub‑routes.)

### 11.1 Employee Self‑Service Portal — Pages (MVP‑2b)

13 pages under `(ess)` route group. Visible to any authenticated `USER` (any role tier — even `PLATFORM_ADMIN` can use ESS on themselves via the top‑bar switch).

| # | Page | Route | Purpose |
|---|------|-------|---------|
| ESS‑1 | My HR landing | `/me` | Personal dashboard: current position card, pending learning, open gaps count, next deadlines |
| ESS‑2 | My Profile | `/me/profile` | View + edit `display_name`, `locale`, `timezone`, contact preferences; read‑only fields: tenant, employee code |
| ESS‑3 | My Positions | `/me/positions` | Current PRIMARY assignment + history table (all kinds: PRIMARY/SECONDARY/INTERIM/ACTING) |
| ESS‑4 | My Skills | `/me/skills` | Skills owned with proficiency level + last assessment date + evidence count |
| ESS‑5 | My Skills — Self Assessment | `/me/skills/self-assessment` | Form: select skill, declare current proficiency, optional comment; produces `sys.sys_user_skill_evidence` row with `evidence_source = SELF_ASSESSMENT` |
| ESS‑6 | My Learning | `/me/learning` | Assigned learning paths + training initiatives + completion status |
| ESS‑7 | My Learning — Catalogue | `/me/learning/catalogue` | Browse `sys.sys_learning_modules` + `sys.sys_learning_paths`; "Enroll" CTA for non‑mandatory items |
| ESS‑8 | My KPIs | `/me/kpis` | Own KPI targets + measurements timeline + assessment results |
| ESS‑9 | My Gaps | `/me/gaps` | Own gap analysis: required vs evidenced skill/KPI/learning gaps; closure plan progress |
| ESS‑10 | My Career | `/me/career` | Available career paths from current position + "Request as target" CTA → creates `sys.sys_user_target_positions` row for manager review |
| ESS‑11 | My Certifications | `/me/certifications` | Owned certifications + "Add certification" CTA (URI metadata only, no binary) |
| ESS‑12 | My Documents | `/me/documents` | URI metadata of own documents (CV link, training certificates link); no binaries stored |
| ESS‑13 | Inbox | `/me/inbox` | System notifications: training deadlines, assessment requests received, manager feedback ready, career target request status |

### 11.2 Per‑role landing redirect

| User roles after login | Landing route | Top‑bar switcher |
|------------------------|---------------|------------------|
| Pure `USER` (no other roles) | `/me` | none (no admin access) |
| Pure `READ_ONLY` (no other roles) | `/me` (view‑only — every form/CTA disabled) | none |
| `READ_ONLY + USER` | `/me` (interactive) | none |
| `MANAGER` (with or without `USER`) | `/dashboard` | "Switch to My HR" → `/me` |
| `HRMS_MANAGER` / `BLUEPRINT_MANAGER` / `PROCESS_OWNER` / `TENANT_ADMIN` (with or without `USER`) | `/dashboard` | "Switch to My HR" → `/me` |
| `PLATFORM_ADMIN` | `/dashboard` (own platform tenant context) | tenant selector for cross‑tenant + "Switch to My HR" |

**Rationale `READ_ONLY` only → `/me` view‑only**: a read‑only user still wants to see their own assignment / KPIs / learning. Sending them to `/dashboard` (which is manager‑oriented) would confuse and reveal aggregated info they can't act on. `/me` view‑only is the right surface; every interactive component is rendered disabled (e.g. "Submit Self‑Assessment" button rendered grey with tooltip "Your role does not allow this action — contact your manager").

---

## 12. Out of Scope (explicit)

These will **not** be built in MVP‑2:

- ~~Employee self‑service portal~~ — **now IN SCOPE** as MVP‑2b (see §11.1 ESS pages and §3.4 ESS layout).
- Payroll UI (no payroll execution per I8).
- Benefits UI (out of scope I8).
- Time & attendance UI (out of scope I8).
- Medical / health UI (out of scope I8).
- Recruiting / applicant‑tracking UI (out of scope I8).
- Onboarding / preboarding workflow UI (out of scope I8).
- In‑app messaging / peer feedback flows / manager 1:1 scheduling (post‑MVP).
- Expense reports (post‑MVP, out of HRMS scope).
- Performance review self‑editing (post‑MVP; current MVP allows only viewing of received assessments).
- Mobile app (post‑MVP).
- Public marketing site.

### 12.1 ESS Boundaries (MVP‑2b in scope, but with explicit limits)

A `USER` in MVP‑2b **can**:

- View own profile, edit `display_name`, `locale`, `timezone`, contact preferences.
- View current + historical position assignments (`/me/positions`).
- View own skills with proficiency + submit self‑assessment (`/me/skills`).
- View assigned learning + browse catalogue + self‑enroll in non‑mandatory courses (`/me/learning`).
- View own KPI targets and measurements (`/me/kpis`).
- View own gap analysis + closure plan (`/me/gaps`).
- View own career path + request target position (creates a record manager will review) (`/me/career`).
- View own certifications + upload new certification URI metadata (no binary) (`/me/certifications`).
- View own document metadata (`/me/documents`).
- View inbox of system notifications (training deadlines, assessment requests) (`/me/inbox`).

A `USER` in MVP‑2b **cannot**:

- See any other user's profile, skills, KPIs, gaps, career, compensation.
- Approve own learning enrollment for mandatory courses (manager‑gated).
- Modify own assessment results (assessments are written by managers / 360 feedback only).
- Modify own KPI targets (set by HRMS_MANAGER+).
- Modify own compensation profile (never).
- Access admin routes (`/dashboard`, `/tenants/*`, `/positions/*`, `/admin/*` → 403 by layout guard).
- Trigger seed acquisition, brownfield import, role assignment, etc.

---

## 13. Internationalization (MVP‑2 — bilingual it/en)

> **Promoted from post‑MVP after Review #7 decision.** The platform is built **bilingual from MVP‑2**: default locale Italian (`it`), full alternate English (`en`). Both locales ship with parity from day one; no "EN UI + IT lang attribute" mismatch.

### 13.1 Library and strategy

- **Library**: `next-intl` (canonical for Next 15 App Router; locale segment `/it/...` or `/en/...` with middleware redirect from `/` to default `/it`).
- **Locale source**: cookie `hrx_locale` (read by middleware, falls back to `Accept-Language` header, then default `it`). URL segment is the source of truth; cookie reflects it.
- **Translation store**: `apps/web/src/locales/{it,en}.json` (flat key namespace per module: `auth.login.title`, `dashboard.kpi.label`, etc.).
- **Server components**: `getTranslations()` from `next-intl/server`; rendered at request time.
- **Client components**: `useTranslations()` hook (NextIntlClientProvider in root layout).
- **Date / number / currency**: `next-intl/format` wraps `Intl.*` APIs with locale awareness.
- **Switcher**: top‑bar dropdown `IT / EN` writes the cookie + navigates to the same path under the new locale segment.

### 13.2 Parity discipline

- A CI script `pnpm i18n:check` parses both `it.json` and `en.json` and fails if keys are missing in either side.
- Pre‑commit hook (lefthook / husky) runs the same check on changed locale files.
- Every PR that adds a UI string must add it in both `it.json` and `en.json`; reviewer enforces.

### 13.3 Scope clarification

- **In MVP‑2**: all 27 admin pages + 13 ESS pages have keys present in both `it` and `en`. Initial translation: `it` is authored, `en` is machine‑assisted then human‑reviewed.
- **Post‑MVP**: additional languages (es, fr, de) can be added by dropping a new `<lang>.json` file alongside it/en; framework supports without code change.
- **Date format**: short date locale‑aware (`it`: `dd/mm/yyyy`; `en`: `mm/dd/yyyy`). Date columns in DB remain `date` type (Q‑R3 Review #3 confirmation), the locale formatting is rendering‑only.

---

## 14. Testing Strategy

| Layer | Tool | Coverage |
|-------|------|----------|
| Unit (utilities, hooks) | vitest | 80% of `lib/`, `hooks/` |
| Component | @testing-library/react + vitest | Critical components (PositionForm, ReactFlowRenderer, Sidebar) |
| Integration (page) | vitest + msw (mock service worker) | Each page's data flow with mocked API |
| E2E smoke | playwright | Login → dashboard → tenant list → position detail → gap dashboard → logout |
| Accessibility | axe via playwright | Run on each main page; no critical violations |

CI gate: all green required to merge.

---

## 15. Performance Budget

- LCP < 2.5s on dashboard (RSC streaming).
- Bundle (client) per route < 250 KB gzipped (excluding React Flow which is loaded on demand).
- React Flow loaded with `next/dynamic` only on visualization routes.
- TanStack Query devtools loaded only in dev (`NODE_ENV !== 'production'`).

---

## 16. Accessibility

- shadcn/ui primitives are accessible by default (focus traps, ARIA roles, keyboard navigation).
- Form labels via `<Label htmlFor>` and `aria-describedby` for errors.
- Color contrast WCAG AA minimum.
- Keyboard navigation tested with playwright + axe.
- Avoid color‑only signals; pair with icons / text.

---

## 17. Verification Checklist (planning deliverable)

- [x] Stack + versions enumerated (§1)
- [x] Directory structure (§2)
- [x] Layout hierarchy with server‑side auth check (§3)
- [x] Route → role binding table (§4) — cross‑ref with `AUTH_SECURITY_PLAN.md` §6
- [x] Sidebar filtered by role (§5)
- [x] Component inventory per page (§6)
- [x] Data fetching pattern with TanStack Query (§7)
- [x] Forms with RHF + Zod from shared schemas (§8)
- [x] Auth client: cookie + refresh on 401 + CSRF rotation across tabs (§9)
- [x] Visualization renderer: React Flow + node layout PATCH respects ADR‑0009 (§10)
- [x] 23+ initial pages enumerated (§11)
- [x] Out‑of‑scope explicit (§12)
- [x] Testing strategy (§14)
- [x] Aligned with ADR‑0007 (frontend stack) + ADR‑0006 (auth strategy)
