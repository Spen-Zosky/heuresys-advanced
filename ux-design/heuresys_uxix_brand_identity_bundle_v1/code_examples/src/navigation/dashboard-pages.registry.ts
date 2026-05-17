export type DashboardPageMeta = {
  id: string;
  title: string;
  subtitle?: string;
  breadcrumb: Array<{ label: string; href?: string }>;
  href: string;
  moduleId?: string;
  tabId?: string;
  primaryAction?: {
    label: string;
    href: string;
  };
};

export const dashboardPages: DashboardPageMeta[] = [
  {
    id: "executive.home",
    title: "Executive Dashboard",
    subtitle: "Strategic overview of organization, positions, skills and performance signals.",
    breadcrumb: [{ label: "Dashboard", href: "/dashboard" }, { label: "Executive" }],
    href: "/dashboard/executive",
    moduleId: "executive",
  },
  {
    id: "positions.catalogue",
    title: "Position Catalogue",
    subtitle: "Manage positions, role families, levels and organizational allocation.",
    breadcrumb: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Positions", href: "/dashboard/positions/catalogue" },
      { label: "Catalogue" },
    ],
    href: "/dashboard/positions/catalogue",
    moduleId: "positions",
    tabId: "catalogue",
    primaryAction: {
      label: "New Position",
      href: "/dashboard/positions/catalogue/new",
    },
  },
];

export function findPageMetaByPathname(pathname: string) {
  return dashboardPages.find((page) => page.href === pathname);
}
