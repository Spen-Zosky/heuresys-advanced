"use client";

import { useState, type ReactNode } from "react";
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
  Clock,
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
  PieChart,
  ShieldCheck,
  Sprout,
  TrendingUp,
  TriangleAlert,
  User,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCurrentUser, useLogout, useMyInterfaces, type MyInterface } from "../../lib/api/auth";
import { isApiError, SessionExpiredError } from "../../lib/api/errors";
import { PreferencesApplier } from "../../components/preferences-applier";
import { LanguageSwitcher } from "../../components/language-switcher";

const ICON = "h-4 w-4 shrink-0";

/** Registry icon name (sys_ui_interfaces.icon) → lucide node. */
const ICON_MAP: Record<string, ReactNode> = {
  Activity: <Activity className={ICON} />,
  Briefcase: <Briefcase className={ICON} />,
  Building2: <Building2 className={ICON} />,
  Clock: <Clock className={ICON} />,
  Coins: <Coins className={ICON} />,
  Database: <Database className={ICON} />,
  FileText: <FileText className={ICON} />,
  Gauge: <Gauge className={ICON} />,
  GitBranch: <GitBranch className={ICON} />,
  GraduationCap: <GraduationCap className={ICON} />,
  Inbox: <Inbox className={ICON} />,
  Layers: <Layers className={ICON} />,
  LayoutDashboard: <LayoutDashboard className={ICON} />,
  Network: <Network className={ICON} />,
  PieChart: <PieChart className={ICON} />,
  ShieldCheck: <ShieldCheck className={ICON} />,
  Sprout: <Sprout className={ICON} />,
  TrendingUp: <TrendingUp className={ICON} />,
  TriangleAlert: <TriangleAlert className={ICON} />,
  User: <User className={ICON} />,
  Users: <Users className={ICON} />,
};

/** The 4 nav items the E2E suite targets by stable test-id. */
const NAV_TESTID: Record<string, string> = {
  dashboard: "nav-dashboard",
  "me-home": "nav-me",
  positions: "nav-positions",
  users: "nav-users",
};

/** Perspective filter codes. "ALL" (default) keeps every perspective visible — behaviour-
 *  preserving vs the old all-groups sidebar; the PET codes focus a single perspective.
 *  Labels are i18n (shell:nav.perspective.filters.*). */
const FILTERS = ["ALL", "PROCESS", "ENTERPRISE", "TALENT"] as const;
type FilterCode = (typeof FILTERS)[number];

function navLabel(testId: string, text: string) {
  return <span data-testid={testId}>{text}</span>;
}

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const pathname = usePathname() ?? "";
  const me = useCurrentUser();
  const ifaces = useMyInterfaces();
  const logout = useLogout();
  const [filter, setFilter] = useState<FilterCode>("ALL");

  if (me.isLoading || ifaces.isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <span data-testid="app-loading" className="text-sm text-muted-foreground">{t("loading")}</span>
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
        <span data-testid="app-error" className="text-sm text-danger">
          {me.error instanceof Error ? me.error.message : t("shell:session.error")}
        </span>
      </main>
    );
  }
  const user = me.data;
  if (!user) {
    router.replace("/login");
    return null;
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  // Build the sidebar from the DB-driven registry (GET /v1/me/interfaces); server-side gating means
  // we render exactly what is returned. Sub-groups (sidebar_group) become NavGroups, ordered by
  // perspective then by the registry order. The filter focuses a single perspective when not "ALL".
  const perspectives = ifaces.data?.perspectives ?? [];
  const shown = filter === "ALL" ? perspectives : perspectives.filter((p) => p.code === filter);

  const navGroups: NavGroup[] = [];
  for (const persp of shown) {
    const bySub = new Map<string, MyInterface[]>();
    for (const i of persp.interfaces) {
      const arr = bySub.get(i.sidebarGroup);
      if (arr) arr.push(i);
      else bySub.set(i.sidebarGroup, [i]);
    }
    for (const [sub, items] of bySub) {
      navGroups.push({
        id: `${persp.code}-${sub}`,
        label: t(`shell:nav.groups.${sub}`, { defaultValue: sub }),
        items: items.map((i) => {
          const testId = NAV_TESTID[i.code];
          return {
            id: i.code,
            label: testId ? navLabel(testId, i.label) : i.label,
            href: i.route,
            icon: ICON_MAP[i.icon ?? ""] ?? null,
            active: isActive(i.route),
          };
        }),
      });
    }
  }

  const switcherGroup: NavGroup = {
    id: "perspective-switch",
    label: t("shell:nav.perspective.label"),
    customContent: (
      // <li> root: the lib renders customContent as a direct child of the
      // sidebar <ul> — a bare <div> there is an axe "list" violation (WCAG
      // 1.3.1) on every authenticated route (S981 a11y slice).
      <li className="list-none">
      <div data-testid="perspective-switcher" className="flex flex-wrap gap-1 px-3 py-2">
        {FILTERS.map((code) => (
          <Button
            key={code}
            type="button"
            size="sm"
            variant={filter === code ? "default" : "outline"}
            data-testid={`perspective-${code.toLowerCase()}`}
            onClick={() => setFilter(code)}
          >
            {t(`shell:nav.perspective.filters.${code.toLowerCase()}`)}
          </Button>
        ))}
      </div>
      </li>
    ),
  };

  const emptyGroup: NavGroup[] =
    filter !== "ALL" && navGroups.length === 0
      ? [{
          id: "perspective-empty",
          label: t(`shell:nav.perspective.filters.${filter.toLowerCase()}`),
          customContent: (
            <li className="list-none">
              <p data-testid="perspective-empty" className="px-3 py-2 text-xs text-muted-foreground">
                {t("shell:nav.perspective.empty")}
              </p>
            </li>
          ),
        }]
      : [];

  const groups: NavGroup[] = [switcherGroup, ...navGroups, ...emptyGroup];

  const roles = user.roles ?? [];
  const ADMIN_ROLES = new Set(["PLATFORM_ADMIN", "TENANT_ADMIN", "BLUEPRINT_MANAGER", "HRMS_MANAGER", "PROCESS_OWNER", "MANAGER", "ORG_DIRECTOR"]);
  const hasAdminRole = roles.some((r) => ADMIN_ROLES.has(r));
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
          language={i18n.language === "en" ? "EN" : "IT"}
          logo={<HeuresysWordmark variant="brand" size={24} />}
          logoBadge={<HeuresysLogoBadge>{t("shell:brand.badge")}</HeuresysLogoBadge>}
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
              <LanguageSwitcher />
              <Button
                variant="outline"
                size="sm"
                data-testid="app-logout"
                className="w-full"
                onClick={handleLogout}
              >
                {t("shell:logout")}
              </Button>
            </div>
          }
        />
      }
      footer={
        <DashboardFooter
          rightSlot={
            <>
              <span>{t("shell:brand.version")}</span>
              <span aria-hidden className="text-border">·</span>
              <span>{identity.role}</span>
            </>
          }
        />
      }
    >
      {/* WS-4 P1: apply the user's server-stored theme + palette (source of truth) once the
          session is known. Renders nothing. */}
      <PreferencesApplier />
      {children}
    </DashboardShell>
  );
}
