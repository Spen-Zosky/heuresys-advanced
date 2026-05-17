"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { dashboardModules } from "@/navigation/dashboard-modules.registry";

type SidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

export function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    core: true,
    intelligence: true,
    administration: false,
  });

  const toggleGroup = (groupId: string) => {
    setOpenGroups((current) => ({
      ...current,
      [groupId]: !current[groupId],
    }));
  };

  return (
    <aside className="min-h-0 border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
          {!collapsed && <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Navigation</span>}
          <button
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={onToggleCollapsed}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {dashboardModules.map((group) => {
            const GroupIcon = group.icon;
            const groupOpen = openGroups[group.id] ?? false;

            return (
              <div key={group.id} className="mb-2">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-expanded={groupOpen}
                >
                  <GroupIcon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="min-w-0 flex-1 truncate">{group.label}</span>}
                  {!collapsed && (groupOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
                </button>

                {!collapsed && groupOpen && (
                  <div className="mt-1 space-y-1 pl-6">
                    {group.children.map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <ItemIcon className="h-3.5 w-3.5" />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
