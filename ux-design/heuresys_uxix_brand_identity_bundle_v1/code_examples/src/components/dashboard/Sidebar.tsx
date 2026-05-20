"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { dashboardModules } from "@/navigation/dashboard-modules.registry";
import { GroupToggle } from "@/components/dashboard/GroupToggle";

/**
 * Dashboard sidebar — full composition with collapse + group toggles.
 * Spec: docs/07_sidebar_specification.md (extended).
 *
 * Sidebar collapse state is driven by body[data-sidebar="collapsed"] +
 * inline grid-template-columns override on the shell grid wrapper.
 * Group toggles use the GroupToggle component (aria-expanded driven).
 */

const STORAGE_SIDEBAR = "heuresys-sidebar";

function applySidebarState(collapsed: boolean) {
  const body = document.body;
  const grid = document.querySelector<HTMLElement>('[data-shell="grid"]');
  if (collapsed) {
    body.setAttribute("data-sidebar", "collapsed");
    if (grid) grid.style.setProperty("grid-template-columns", "72px 1fr", "important");
  } else {
    body.removeAttribute("data-sidebar");
    if (grid) grid.style.setProperty("grid-template-columns", "260px 1fr", "important");
  }
}

export function Sidebar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_SIDEBAR);
    applySidebarState(saved === "collapsed");
  }, []);

  function toggleSidebar() {
    const isCollapsed = document.body.getAttribute("data-sidebar") === "collapsed";
    applySidebarState(!isCollapsed);
    window.localStorage.setItem(STORAGE_SIDEBAR, !isCollapsed ? "collapsed" : "expanded");
  }

  return (
    <aside className="min-h-0 overflow-hidden border-r border-border bg-sidebar text-sidebar-foreground"
           aria-label="Navigazione principale">
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
          <span className="sidebar-section-label text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Navigation
          </span>
          <button id="js-sidebar-toggle" type="button" aria-label="Comprimi/espandi sidebar" onClick={toggleSidebar}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-control text-muted-foreground transition hover:bg-accent hover:text-foreground hover:border-foreground/30">
            <PanelLeftClose className="sidebar-icon-collapse h-4 w-4" />
            <PanelLeftOpen className="sidebar-icon-expand hidden h-4 w-4" />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {dashboardModules.map((group) => {
            const GroupIcon = group.icon;
            return (
              <GroupToggle key={group.id} groupId={group.id} label={group.label}>
                {group.children.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <li key={item.id}>
                      <Link href={item.href}
                            className="nav-link flex items-center gap-2 rounded-control px-2 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground">
                        <ItemIcon className="h-4 w-4 shrink-0" />
                        <span className="nav-label truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </GroupToggle>
            );
          })}
        </nav>

        <div className="sidebar-footer-card shrink-0 border-t border-border p-3">
          <div className="rounded-control border border-border bg-card p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Build</span>
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
            </div>
            <div className="mt-1 font-mono text-[11px] text-foreground">v5.0.0-mvp3</div>
            <div className="font-mono text-[10px] text-muted-foreground">— · production</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
