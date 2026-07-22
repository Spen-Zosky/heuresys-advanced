"use client";

import { type ReactNode } from "react";
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
import { useCurrentUser, useLogout, useMyInterfaces, useUpdateMyPreferences, type MyInterface } from "../../lib/api/auth";
import { isApiError, SessionExpiredError } from "../../lib/api/errors";
import { setLocale } from "../../lib/i18n";
import { PreferencesApplier } from "../../components/preferences-applier";
import { SectionTabs } from "../../components/section-tabs";

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
  const updatePrefs = useUpdateMyPreferences();

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

  // Build the sidebar from the DB-driven registry (GET /v1/me/interfaces). Server-side gating
  // means we render exactly what is returned. The registry groups interfaces into 5 always-present
  // SECTIONS (Panoramica / Governance / Forza lavoro / Intelligence / Area personale — S1009 IA
  // redesign, the old PET perspective filter is retired); each section becomes a collapsible
  // NavGroup whose label comes from i18n and whose items keep the registry order.
  const sections = ifaces.data?.perspectives ?? [];

  const navGroups: NavGroup[] = [];
  for (const section of sections) {
    const bySub = new Map<string, MyInterface[]>();
    for (const i of section.interfaces) {
      const arr = bySub.get(i.sidebarGroup);
      if (arr) arr.push(i);
      else bySub.set(i.sidebarGroup, [i]);
    }
    for (const [sub, items] of bySub) {
      navGroups.push({
        id: `${section.code}-${sub}`,
        label: t(`shell:nav.groups.${sub}`, { defaultValue: section.label }),
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

  const groups: NavGroup[] = navGroups;

  const roles = user.roles ?? [];
  const ADMIN_ROLES = new Set(["PLATFORM_ADMIN", "TENANT_ADMIN", "BLUEPRINT_MANAGER", "HRMS_MANAGER", "PROCESS_OWNER", "MANAGER", "ORG_DIRECTOR"]);
  const hasAdminRole = roles.some((r) => ADMIN_ROLES.has(r));
  const displayName = user.displayName?.trim() || user.email;
  const initials = (
    user.displayName?.trim()
      ? user.displayName.trim().split(/\s+/).map((w) => w.charAt(0)).join("").slice(0, 2)
      : user.email.slice(0, 2)
  ).toUpperCase();
  const primaryRole = roles[0] ?? "USER";
  const identity: UserIdentity = {
    initials,
    username: displayName,
    // label umana, mai il codice RBAC raw (census F4 S1025: 'PLATFORM_ADMIN'
    // renderizzato su ogni pagina admin)
    role: t(`shell:roles.${primaryRole}`, { defaultValue: primaryRole }),
    roleTone: hasAdminRole ? "info" : "warning",
  };

  async function handleLogout() {
    await logout.mutateAsync();
    router.replace("/login");
  }

  // Language lives in the HEADER (S1009): one toggle IT↔EN, persisted to sys_user_preferences
  // (server source of truth) so the choice follows the user across pages and devices. The cookie
  // covers same-device reloads; PreferencesApplier re-applies the server locale on a fresh device.
  function handleToggleLanguage() {
    const next = i18n.language === "it" ? "en" : "it";
    setLocale(next);
    updatePrefs.mutate({ locale: next });
  }

  return (
    <DashboardShell
      header={
        <DashboardHeader
          user={identity}
          language={i18n.language === "en" ? "EN" : "IT"}
          onToggleLanguage={handleToggleLanguage}
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
      {/* WS-4 P1: apply the user's server-stored theme + palette + locale (source of truth) once
          the session is known. Renders nothing. */}
      <PreferencesApplier />
      {/* S1009: in-page tab bar for the 6 merge groups; renders nothing off those routes. */}
      <SectionTabs />
      {children}
    </DashboardShell>
  );
}
