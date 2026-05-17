"use client";

import { useState } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { Footer } from "./Footer";

export function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="h-screen grid grid-rows-[64px_1fr_44px] overflow-hidden bg-background text-foreground">
      <Header />

      <div
        className={
          sidebarCollapsed
            ? "grid grid-cols-[72px_1fr] min-h-0 transition-[grid-template-columns] duration-200"
            : "grid grid-cols-[280px_1fr] min-h-0 transition-[grid-template-columns] duration-200"
        }
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
        />

        <main className="min-h-0 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      <Footer />
    </div>
  );
}
