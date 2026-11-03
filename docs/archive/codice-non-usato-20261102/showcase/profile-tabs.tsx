"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * ProfileTabs — heuresys-advanced navtab for the /me profile (S1010).
 *
 * Mirrors the legacy portal pattern: query-param `?tab=` deep-linking + lazy-mount
 * (a tab's content is rendered only after it has been opened, so per-tab data fetch
 * happens on demand). Advanced-specific (URL routing + i18n labels) — composed from
 * @heuresys/ui primitives, not a generic shared Tabs primitive (per Design System
 * rules; promote upstream if/when a second consumer appears in F3).
 */
export interface ProfileTabDef {
  id: string;
  label: string;
  testId?: string;
  render: () => ReactNode;
}

export function ProfileTabs({ tabs, ariaLabel }: { tabs: ProfileTabDef[]; ariaLabel: string }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const initial = useMemo(() => {
    const urlTab = sp.get("tab");
    return tabs.find((t) => t.id === urlTab)?.id ?? tabs[0]?.id ?? "";
  }, [sp, tabs]);

  const [active, setActive] = useState(initial);
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set(initial ? [initial] : []));

  const change = useCallback(
    (id: string) => {
      setActive(id);
      setLoaded((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
      const next = new URLSearchParams(Array.from(sp.entries()));
      next.set("tab", id);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, sp],
  );

  return (
    <div className="space-y-6">
      <nav
        role="tablist"
        aria-label={ariaLabel}
        data-testid="profile-tabs"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {tabs.map((t) => {
          const selected = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-current={selected ? "page" : undefined}
              data-testid={t.testId ?? `profile-tab-${t.id}`}
              onClick={() => change(t.id)}
              className={[
                "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                selected
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" hidden={active !== t.id} data-testid={`profile-panel-${t.id}`}>
          {loaded.has(t.id) ? t.render() : null}
        </div>
      ))}
    </div>
  );
}
