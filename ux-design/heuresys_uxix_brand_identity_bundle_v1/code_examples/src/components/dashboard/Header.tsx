"use client";

import {
  Menu,
  Moon,
  Sun,
  Languages,
  UserCircle,
  LogOut,
} from "lucide-react";
import { HeuresysLogo } from "@/components/brand/HeuresysLogo";

export function Header() {
  return (
    <header className="z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          aria-label="Open global context menu"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Menu className="h-4 w-4" />
        </button>

        <a href="/app" aria-label="Open Heuresys primary initial page" className="flex items-center">
          <HeuresysLogo variant="horizontal" className="h-8 w-auto text-foreground" />
        </a>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Switch language between Italian and English"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Languages className="h-4 w-4" />
          <span className="font-medium">IT / EN</span>
        </button>

        <button
          type="button"
          aria-label="Open palette switcher"
          className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-2 hover:bg-accent"
        >
          <span className="h-4 w-4 rounded-sm bg-[var(--palette-1)]" />
          <span className="h-4 w-4 rounded-sm bg-[var(--palette-2)]" />
          <span className="h-4 w-4 rounded-sm bg-[var(--palette-3)]" />
          <span className="h-4 w-4 rounded-sm bg-[var(--palette-4)]" />
        </button>

        <button
          type="button"
          aria-label="Switch between light and dark theme"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Sun className="h-4 w-4 dark:hidden" />
          <Moon className="hidden h-4 w-4 dark:block" />
        </button>

        <div className="relative">
          <button
            type="button"
            aria-label="Open logged user menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <UserCircle className="h-5 w-5" />
          </button>

          {/* Replace this placeholder with a real accessible dropdown menu primitive. */}
          <div className="hidden">
            <button type="button" className="flex items-center gap-2">
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
