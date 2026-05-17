export type DashboardModuleManifest = {
  id: string;
  label: string;
  description?: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  permissions?: string[];
  tenantFeatureFlag?: string;
  tabs?: Array<{
    id: string;
    label: string;
    href: string;
  }>;
};

export const exampleModule: DashboardModuleManifest = {
  id: "example",
  label: "Example",
  description: "Example module description.",
  href: "/dashboard/example",
};
