import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  GraduationCap,
  LayoutDashboard,
  LineChart,
  ListChecks,
  Settings,
  Sparkles,
} from "lucide-react";

export const dashboardModules = [
  {
    id: "core",
    label: "Core Workspace",
    icon: LayoutDashboard,
    children: [
      {
        id: "executive",
        label: "Executive Dashboard",
        href: "/dashboard/executive",
        icon: BarChart3,
      },
      {
        id: "organization",
        label: "Organization",
        href: "/dashboard/organization/structure",
        icon: Building2,
      },
      {
        id: "positions",
        label: "Positions",
        href: "/dashboard/positions/catalogue",
        icon: BriefcaseBusiness,
      },
    ],
  },
  {
    id: "intelligence",
    label: "Workforce Intelligence",
    icon: Sparkles,
    children: [
      {
        id: "performance",
        label: "Performance",
        href: "/dashboard/performance/objectives",
        icon: ListChecks,
      },
      {
        id: "learning",
        label: "Learning",
        href: "/dashboard/learning/paths",
        icon: GraduationCap,
      },
      {
        id: "analytics",
        label: "Analytics",
        href: "/dashboard/analytics",
        icon: LineChart,
      },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    icon: Settings,
    children: [
      {
        id: "settings",
        label: "Settings",
        href: "/dashboard/settings",
        icon: Settings,
      },
    ],
  },
] as const;
