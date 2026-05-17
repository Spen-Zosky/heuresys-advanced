"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type DashboardTab = {
  id: string;
  label: string;
  href: string;
};

export function TopTabs({ tabs }: { tabs: DashboardTab[] }) {
  const pathname = usePathname();

  return (
    <div className="border-b border-border">
      <nav className="flex gap-4 overflow-x-auto" aria-label="Module tabs">
        {tabs.map((tab) => {
          const active = pathname === tab.href;

          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "border-b-2 border-primary px-1 py-3 text-sm font-medium text-foreground"
                  : "px-1 py-3 text-sm text-muted-foreground hover:text-foreground"
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
