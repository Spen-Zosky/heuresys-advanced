"use client";

import { useEffect } from "react";
import { Menu, Search, Languages, Sun, Moon, UserCircle, ChevronRight } from "lucide-react";
import { HeuresysLogo } from "@/components/brand/HeuresysLogo";
import { PaletteDropdown } from "@/components/dashboard/PaletteDropdown";

/**
 * Dashboard header — full composition.
 * Spec: docs/06_header_specification.md (extended).
 *
 * Left:  hamburger | logo | breadcrumb
 * Mid:   command palette trigger (⌘K)
 * Right: language | palette dropdown | theme toggle | user identity card
 */

export type HeaderBreadcrumb = ReadonlyArray<Readonly<{ label: string; href?: string }>>;

export type HeaderProps = Readonly<{
  breadcrumb?: HeaderBreadcrumb;
  user?: Readonly<{ initials: string; username: string; role: string; roleTone?: string }>;
  language?: "IT" | "EN";
  onToggleLanguage?: () => void;
}>;

const STORAGE_THEME = "heuresys-theme";

function applyTheme(theme: "light" | "dark") {
  const html = document.documentElement;
  if (theme === "dark") html.classList.add("dark");
  else html.classList.remove("dark");
}

export function Header({ breadcrumb, user, language = "IT", onToggleLanguage }: HeaderProps) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_THEME);
    if (saved === "light" || saved === "dark") applyTheme(saved);
  }, []);

  function toggleTheme() {
    const isDark = document.documentElement.classList.toggle("dark");
    window.localStorage.setItem(STORAGE_THEME, isDark ? "dark" : "light");
  }

  return (
    <header
      role="banner"
      className="z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75"
    >
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" aria-label="Apri menu contesto globale"
                className="inline-flex h-9 w-9 items-center justify-center rounded-control border border-border text-muted-foreground transition hover:bg-accent hover:text-foreground hover:border-foreground/30">
          <Menu className="h-4 w-4" />
        </button>

        <a href="/app" aria-label="Heuresys — pagina iniziale autenticata" className="flex items-center">
          <HeuresysLogo variant="horizontal" className="h-8 w-auto text-foreground" />
        </a>

        {breadcrumb && breadcrumb.length > 0 && (
          <>
            <span className="text-muted-foreground/40">/</span>
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground">
              {breadcrumb.map((b, i) => {
                const isLast = i === breadcrumb.length - 1;
                return (
                  <span key={i} className="flex items-center gap-2">
                    {isLast ? <span className="font-medium text-foreground">{b.label}</span>
                            : <a href={b.href ?? "#"}>{b.label}</a>}
                    {!isLast && <ChevronRight className="h-3 w-3 opacity-50" />}
                  </span>
                );
              })}
            </nav>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button id="js-command-palette-trigger" type="button" aria-label="Apri command palette"
                className="hidden md:inline-flex h-9 items-center gap-2 rounded-control border border-border bg-card px-3 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground hover:border-foreground/30">
          <Search className="h-4 w-4" />
          <span>Cerca tenant, log, audit…</span>
          <kbd className="ml-2 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">⌘ K</kbd>
        </button>

        <button type="button" aria-label="Cambia lingua tra italiano e inglese" onClick={onToggleLanguage}
                className="inline-flex h-9 items-center gap-2 rounded-control border border-border px-3 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground hover:border-foreground/30">
          <Languages className="h-4 w-4" />
          <span className="font-medium">{language}</span>
        </button>

        <PaletteDropdown />

        <button id="js-theme-toggle" type="button" aria-label="Alterna tema chiaro/scuro" onClick={toggleTheme}
                className="inline-flex h-9 w-9 items-center justify-center rounded-control border border-border text-muted-foreground transition hover:bg-accent hover:text-foreground hover:border-foreground/30">
          <Sun className="h-4 w-4 dark:hidden" />
          <Moon className="hidden h-4 w-4 dark:block" />
        </button>

        {user ? (
          <div className="ml-1 flex items-center gap-2 rounded-control border border-border bg-card px-2 py-1.5">
            <span className={`relative inline-flex h-7 w-7 items-center justify-center rounded-full bg-${user.roleTone ?? "palette-3"}/20 text-xs font-semibold text-${user.roleTone ?? "palette-3"}`}>
              {user.initials}
            </span>
            <div className="hidden flex-col leading-tight sm:flex">
              <span className="text-xs font-medium text-foreground">{user.username}</span>
              <span className={`font-mono text-[10px] uppercase tracking-wider text-${user.roleTone ?? "warning"}`}>{user.role}</span>
            </div>
          </div>
        ) : (
          <button type="button" aria-label="Open logged user menu"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-accent hover:text-foreground hover:border-foreground/30">
            <UserCircle className="h-5 w-5" />
          </button>
        )}
      </div>
    </header>
  );
}
