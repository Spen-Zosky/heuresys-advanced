"use client";

/**
 * apps/web/src/components/section-tabs.tsx
 *
 * In-page tab bar for the 6 "merge" entries of the S1009 sidebar IA redesign. The
 * sidebar shows one entry per merged group (e.g. "Analisi Skill"); the pages it
 * absorbed stay as live routes and are reached from this tab bar. Enzo's rule:
 * "le altre diventano tab dentro la pagina principale" (navigation merge, not a
 * content rewrite).
 *
 * Mounted ONCE in the authenticated layout (above the page <main>): it derives the
 * active group from the current pathname and renders nothing on routes that are not
 * part of a merge group — so non-merged pages are unaffected. The max-w-7xl/px-6
 * container matches the analytics pages' own <main>, so the bar lines up with them.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { cn } from "@heuresys/ui";

type Tab = { href: string; key: string };
type Group = { id: string; tabs: ReadonlyArray<Tab> };

/** The 6 merge groups. `key` indexes i18n `shell:tabs.*`. The first tab of each
 *  group is its sidebar entry (the "principale"); the rest are absorbed pages. */
const MERGE_GROUPS: ReadonlyArray<Group> = [
  { id: "org", tabs: [
    { href: "/organization", key: "org.overview" },
    { href: "/analytics/org-network", key: "org.network" },
  ] },
  { id: "attendance", tabs: [
    { href: "/analytics/attendance", key: "attendance.main" },
    { href: "/analytics/overtime", key: "attendance.overtime" },
  ] },
  { id: "skill", tabs: [
    { href: "/analytics/skills", key: "skill.coverage" },
    { href: "/analytics/skills-by-category", key: "skill.category" },
    { href: "/analytics/skills-group-share", key: "skill.group" },
    // #50 F3 (S1091): la vista del grafo. Entra come SCHEDA del gruppo skill e non
    // come voce nuova di sidebar — e' la regola di Enzo S1009, «le altre diventano
    // tab dentro la pagina principale», ed e' anche cio' che rende la pagina
    // raggiungibile per check_pagine_raggiungibili senza una migrazione di menu.
    { href: "/analytics/skills-graph", key: "skill.graph" },
    { href: "/skills", key: "skill.catalog" },
    { href: "/gaps", key: "skill.gap" },
    { href: "/insights/skill-gap", key: "skill.skillGap" },
  ] },
  { id: "compensation", tabs: [
    { href: "/analytics/compensation", key: "comp.analytics" },
    { href: "/compensation-intelligence", key: "comp.intelligence" },
  ] },
  { id: "kpi", tabs: [
    { href: "/analytics/kpi", key: "kpi.analytics" },
    { href: "/kpis", key: "kpi.catalog" },
  ] },
  { id: "career", tabs: [
    { href: "/career-succession", key: "career.main" },
    { href: "/insights/succession-readiness", key: "career.readiness" },
  ] },
  // #54 F4: il cluster del recruiting. La voce di sidebar e' `/recruiting` (mig 000406); le
  // altre tre sono schede della pagina principale, come vuole la regola S1009 — ed e' cio'
  // che le rende raggiungibili per `check_pagine_raggiungibili` senza tre voci di menu.
  { id: "recruiting", tabs: [
    { href: "/recruiting", key: "recruiting.pipeline" },
    { href: "/recruiting/requisitions", key: "recruiting.requisitions" },
    { href: "/recruiting/postings", key: "recruiting.postings" },
    { href: "/recruiting/candidates", key: "recruiting.candidates" },
  ] },
];

/** Match with a "/" boundary so /analytics/skills does NOT swallow
 *  /analytics/skills-by-category (a bare startsWith would). */
function matchHref(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SectionTabs() {
  const pathname = usePathname() ?? "";
  const { t } = useTranslation("shell");
  const group = MERGE_GROUPS.find((g) => g.tabs.some((tb) => matchHref(pathname, tb.href)));
  if (!group) return null;

  return (
    <div className="mx-auto max-w-7xl px-6 pt-6">
      <nav
        data-testid="section-tabs"
        aria-label={t("tabs.label")}
        className="flex gap-1 overflow-x-auto border-b border-border"
      >
        {group.tabs.map((tb) => {
          const active = matchHref(pathname, tb.href);
          return (
            <Link
              key={tb.href}
              href={tb.href}
              aria-current={active ? "page" : undefined}
              data-testid={`section-tab-${tb.key}`}
              className={cn(
                "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition",
                active
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {t(`tabs.${tb.key}`)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
