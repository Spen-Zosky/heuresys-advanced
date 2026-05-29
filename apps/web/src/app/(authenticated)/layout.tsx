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
import { useCurrentUser, useLogout } from "../../lib/api/auth";
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

  if (me.isLoading) {
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

  const adminGroups: NavGroup[] = [
    {
      id: "overview",
      label: "Overview",
      items: [
        item("dashboard", navLabel("nav-dashboard", "Dashboard"), "/dashboard", <LayoutDashboard className={ICON} />),
      ],
    },
    {
      id: "workforce",
      label: "Workforce",
      items: [
        item("positions", navLabel("nav-positions", "Posizioni"), "/positions", <Briefcase className={ICON} />),
        item("skills", "Competenze", "/skills", <Layers className={ICON} />),
        item("gaps", "Gap", "/gaps", <TriangleAlert className={ICON} />),
        item("career-succession", "Carriera & successione", "/career-succession", <TrendingUp className={ICON} />),
        item("learning", "Formazione", "/learning", <GraduationCap className={ICON} />),
      ],
    },
    {
      id: "operations",
      label: "Operations",
      items: [
        item("blueprints", "Blueprint", "/blueprints", <FileText className={ICON} />),
        item("processes", "Processi", "/processes", <GitBranch className={ICON} />),
        item("brownfield", "Brownfield", "/brownfield-adaptation", <Database className={ICON} />),
        item("seeds", "Seed acquisition", "/seed-acquisition/runs", <Sprout className={ICON} />),
      ],
    },
    {
      id: "intelligence",
      label: "Intelligence",
      items: [
        item("kpis", "KPI", "/kpis", <Gauge className={ICON} />),
        item("comp", "Compensation", "/compensation-intelligence", <Coins className={ICON} />),
        item("viz", "Visualizzazioni", "/visualizations", <Network className={ICON} />),
        item("org", "Organizzazione", "/organization", <Building2 className={ICON} />),
      ],
    },
    {
      id: "governance",
      label: "Governance",
      items: [
        item("tenants", "Tenant", "/tenants", <Building2 className={ICON} />),
        item("users", navLabel("nav-users", "Utenti"), "/users", <Users className={ICON} />),
        item("roles", "Ruoli", "/admin/roles", <ShieldCheck className={ICON} />),
        item("system-health", "System health", "/system-health", <Activity className={ICON} />),
      ],
    },
  ];

  const groups: NavGroup[] = hasAdminRole ? [...adminGroups, meGroup] : [meGroup];

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
