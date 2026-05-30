"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Button,
  DashboardShell,
  DashboardHeader,
  DashboardSidebar,
  DashboardFooter,
  HeuresysWordmark,
  HeuresysLogoBadge,
  type NavGroup,
  type UserIdentity,
} from "@heuresys/ui";
import {
  Activity,
  Briefcase,
  Building2,
  Coins,
  Database,
  FileText,
  Gauge,
  GitBranch,
  GraduationCap,
  Inbox,
  Layers,
  LayoutDashboard,
  Network,
  ShieldCheck,
  Sprout,
  TrendingUp,
  TriangleAlert,
  User,
  Users,
} from "lucide-react";
import { useCurrentUser, useCurrentUserPermissions, useLogout } from "../../lib/api/auth";
import { isApiError, SessionExpiredError } from "../../lib/api/errors";

const ADMIN_ROLES = new Set([
  "PLATFORM_ADMIN",
  "TENANT_ADMIN",
  "BLUEPRINT_MANAGER",
  "HRMS_MANAGER",
  "PROCESS_OWNER",
  "MANAGER",
]);

const ICON = "h-4 w-4 shrink-0";

/** Wrap a nav label so the E2E suite can target it by test-id. */
function navLabel(testId: string, text: string) {
  return <span data-testid={testId}>{text}</span>;
}

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const me = useCurrentUser();
  const logout = useLogout();
  const perms = useCurrentUserPermissions();

  if (me.isLoading || perms.isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <span data-testid="app-loading" className="text-sm opacity-60">Caricamento…</span>
      </main>
    );
  }
  if (me.isError) {
    if (me.error instanceof SessionExpiredError || (isApiError(me.error) && me.error.status === 401)) {
      router.replace("/login");
      return null;
    }
    return (
      <main className="min-h-screen flex items-center justify-center">
        <span data-testid="app-error" className="text-sm text-red-600">
          {me.error instanceof Error ? me.error.message : "Errore sessione"}
        </span>
      </main>
    );
  }
  const user = me.data;
  if (!user) {
    router.replace("/login");
    return null;
  }

  const roles = user.roles ?? [];
  const hasAdminRole = roles.some((r) => ADMIN_ROLES.has(r));

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const item = (id: string, label: ReactNode, href: string, icon: ReactNode) => ({
    id,
    label,
    href,
    icon,
    active: isActive(href),
  });

  const meGroup: NavGroup = {
    id: "me",
    label: "Me",
    items: [
      item("me-home", navLabel("nav-me", "My HR"), "/me", <User className={ICON} />),
      item("me-skills", "Le mie competenze", "/me/skills", <Layers className={ICON} />),
      item("me-learning", "Formazione", "/me/learning", <GraduationCap className={ICON} />),
      item("me-career", "Carriera", "/me/career", <TrendingUp className={ICON} />),
      item("me-inbox", "Inbox", "/me/inbox", <Inbox className={ICON} />),
    ],
  };

  // Per-permission nav gating: each admin item declares the permission code that gates it,
  // mirroring the API requirePermission gate. Items the user lacks are filtered out and empty
  // groups dropped. The permission set comes from GET /v1/me/permissions (D4 RBAC->UI port).
  const permSet = new Set(perms.data?.permissions ?? []);
  type GatedItem = { gate: string; node: ReturnType<typeof item> };
  const gItem = (id: string, label: ReactNode, href: string, icon: ReactNode, gate: string): GatedItem => ({
    gate,
    node: item(id, label, href, icon),
  });

  const adminGroupDefs: { id: string; label: string; items: GatedItem[] }[] = [
    {
      id: "workforce",
      label: "Workforce",
      items: [
        gItem("positions", navLabel("nav-positions", "Posizioni"), "/positions", <Briefcase className={ICON} />, "position:read"),
        gItem("skills", "Competenze", "/skills", <Layers className={ICON} />, "skill:read"),
        gItem("gaps", "Gap", "/gaps", <TriangleAlert className={ICON} />, "gap_analysis:read"),
        gItem("career-succession", "Carriera & successione", "/career-succession", <TrendingUp className={ICON} />, "career_succession:read"),
        gItem("learning", "Formazione", "/learning", <GraduationCap className={ICON} />, "learning:read"),
      ],
    },
    {
      id: "operations",
      label: "Operations",
      items: [
        gItem("blueprints", "Blueprint", "/blueprints", <FileText className={ICON} />, "blueprint:read"),
        gItem("processes", "Processi", "/processes", <GitBranch className={ICON} />, "bpm_process:read"),
        gItem("brownfield", "Brownfield", "/brownfield-adaptation", <Database className={ICON} />, "brownfield_adaptation:read"),
        gItem("seeds", "Seed acquisition", "/seed-acquisition/runs", <Sprout className={ICON} />, "seed_acquisition:read"),
      ],
    },
    {
      id: "intelligence",
      label: "Intelligence",
      items: [
        gItem("kpis", "KPI", "/kpis", <Gauge className={ICON} />, "kpi:read"),
        gItem("comp", "Compensation", "/compensation-intelligence", <Coins className={ICON} />, "compensation_intelligence:read"),
        gItem("viz", "Visualizzazioni", "/visualizations", <Network className={ICON} />, "visualization:read"),
        gItem("org", "Organizzazione", "/organization", <Building2 className={ICON} />, "organization_unit:read"),
      ],
    },
    {
      id: "governance",
      label: "Governance",
      items: [
        gItem("tenants", "Tenant", "/tenants", <Building2 className={ICON} />, "tenant:read"),
        gItem("users", navLabel("nav-users", "Utenti"), "/users", <Users className={ICON} />, "user:read"),
        gItem("roles", "Ruoli", "/admin/roles", <ShieldCheck className={ICON} />, "role:read"),
        gItem("system-health", "System health", "/system-health", <Activity className={ICON} />, "tenant:read"),
      ],
    },
  ];

  const survivingAdmin: NavGroup[] = adminGroupDefs
    .map((g) => ({ id: g.id, label: g.label, items: g.items.filter((i) => permSet.has(i.gate)).map((i) => i.node) }))
    .filter((g) => g.items.length > 0);
  // "Dashboard" has no dedicated permission; surface it whenever the user has any admin reach.
  const overview: NavGroup[] = survivingAdmin.length > 0
    ? [{ id: "overview", label: "Overview", items: [item("dashboard", navLabel("nav-dashboard", "Dashboard"), "/dashboard", <LayoutDashboard className={ICON} />)] }]
    : [];
  const groups: NavGroup[] = [...overview, ...survivingAdmin, meGroup];

  const displayName = user.displayName?.trim() || user.email;
  const initials = (
    user.displayName?.trim()
      ? user.displayName.trim().split(/\s+/).map((w) => w.charAt(0)).join("").slice(0, 2)
      : user.email.slice(0, 2)
  ).toUpperCase();
  const identity: UserIdentity = {
    initials,
    username: displayName,
    role: roles[0] ?? "USER",
    roleTone: hasAdminRole ? "info" : "warning",
  };

  async function handleLogout() {
    await logout.mutateAsync();
    router.replace("/login");
  }

  return (
    <DashboardShell
      header={
        <DashboardHeader
          user={identity}
          language="IT"
          logo={<HeuresysWordmark variant="brand" size={24} />}
          logoBadge={<HeuresysLogoBadge>advanced</HeuresysLogoBadge>}
        />
      }
      sidebar={
        <DashboardSidebar
          groups={groups}
          footerSlot={
            <div className="space-y-2 border-t border-border px-3 py-3">
              <p data-testid="app-user-email" className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
              <Button
                variant="outline"
                size="sm"
                data-testid="app-logout"
                className="w-full"
                onClick={handleLogout}
              >
                Esci
              </Button>
            </div>
          }
        />
      }
      footer={
        <DashboardFooter
          rightSlot={
            <>
              <span>v5 · heuresys-advanced</span>
              <span aria-hidden className="text-border">·</span>
              <span>{identity.role}</span>
            </>
          }
        />
      }
    >
      {children}
    </DashboardShell>
  );
}
