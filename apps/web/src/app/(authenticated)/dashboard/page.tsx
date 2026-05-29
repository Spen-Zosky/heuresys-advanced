"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AuditFeed,
  type AuditEvent,
  type AuditTone,
  Badge,
  EmptyState,
  PageHeader,
  StatsCard,
  formatRelativeTime,
} from "@heuresys/ui";
import {
  Activity,
  BadgeCheck,
  BookOpen,
  Briefcase,
  Building2,
  Coins,
  FileText,
  GraduationCap,
  ShieldCheck,
  TriangleAlert,
  Users,
} from "lucide-react";
import type { DashboardTrendKey, DashboardWidgetsResponse } from "@heuresys/shared";
import { apiFetch } from "../../../lib/api/fetch";

/** Map a free-text activity kind to a branded icon + tone (no fabricated data —
 *  purely a presentation choice over the real `kind` string). */
function activityVisual(kind: string): { icon: AuditEvent["icon"]; tone: AuditTone } {
  const k = kind.toLowerCase();
  if (k.includes("learning") || k.includes("complet")) return { icon: <BookOpen className="h-3.5 w-3.5" />, tone: "success" };
  if (k.includes("gap") || k.includes("skill")) return { icon: <TriangleAlert className="h-3.5 w-3.5" />, tone: "warning" };
  if (k.includes("position") || k.includes("career")) return { icon: <Briefcase className="h-3.5 w-3.5" />, tone: "palette-1" };
  if (k.includes("cert")) return { icon: <BadgeCheck className="h-3.5 w-3.5" />, tone: "info" };
  return { icon: <Activity className="h-3.5 w-3.5" />, tone: "info" };
}

const SEVERITY_CLASS: Record<string, string> = {
  CRITICAL: "bg-destructive/10 text-destructive",
  HIGH: "bg-warning/15 text-warning",
};

const ICON_CLS = "h-4 w-4";

/** Counters that carry a real week-over-week trend + sparkline series. */
const TRENDED_CARDS: ReadonlyArray<{ key: DashboardTrendKey; testId: string; label: string; icon: ReactNode }> = [
  { key: "users", testId: "counter-users", label: "Utenti", icon: <Users className={`${ICON_CLS} text-palette-2`} /> },
  { key: "positions", testId: "counter-positions", label: "Posizioni", icon: <Briefcase className={`${ICON_CLS} text-palette-1`} /> },
  { key: "organizationUnits", testId: "counter-ous", label: "Org Units", icon: <Building2 className={`${ICON_CLS} text-palette-3`} /> },
  { key: "learningPaths", testId: "counter-learning", label: "Learning Paths", icon: <GraduationCap className={`${ICON_CLS} text-palette-4`} /> },
  { key: "learningGaps", testId: "counter-gaps", label: "Learning Gaps", icon: <TriangleAlert className={`${ICON_CLS} text-warning`} /> },
];

export default function DashboardPage() {
  const widgets = useQuery({
    queryKey: ["dashboard", "widgets"],
    queryFn: () => apiFetch<DashboardWidgetsResponse>("/v1/dashboard/widgets"),
  });

  if (widgets.isLoading) {
    return (
      <main data-testid="dashboard-loading" className="mx-auto max-w-7xl px-6 py-8">
        <span className="text-sm text-muted-foreground">Caricamento…</span>
      </main>
    );
  }
  if (widgets.isError) {
    return (
      <main data-testid="dashboard-error" className="mx-auto max-w-7xl px-6 py-8">
        <p className="text-sm text-destructive">Impossibile caricare il dashboard.</p>
      </main>
    );
  }
  const w = widgets.data!;

  const trendByKey = new Map(w.trends.map((t) => [t.key, t]));

  // Platform/tenant-only counters without a trend series — rendered as plain
  // value StatsCards (no fabricated sparkline).
  const extraCards: Array<{ testId: string; label: string; value: number; icon: ReactNode }> = [];
  if (w.counters.tenants !== null) {
    extraCards.push({ testId: "counter-tenants", label: "Tenant", value: w.counters.tenants, icon: <Building2 className={`${ICON_CLS} text-palette-1`} /> });
  }
  if (w.counters.blueprints !== null) {
    extraCards.push({ testId: "counter-blueprints", label: "Blueprint", value: w.counters.blueprints, icon: <FileText className={`${ICON_CLS} text-palette-2`} /> });
  }
  if (w.counters.pendingRecommendations !== null) {
    extraCards.push({ testId: "counter-recommendations", label: "Reward proposte", value: w.counters.pendingRecommendations, icon: <Coins className={`${ICON_CLS} text-info`} /> });
  }

  const activityEvents: AuditEvent[] = w.recentActivity.map((a) => {
    const v = activityVisual(a.kind);
    return { icon: v.icon, tone: v.tone, title: a.summary, meta: formatRelativeTime(a.occurredAt) };
  });

  return (
    <main data-testid="dashboard-page" className="mx-auto max-w-7xl space-y-8 px-6 py-8">
      <PageHeader
        data-testid="dashboard-title"
        title="Dashboard"
        description="Panoramica cross-modulo del tuo ambito operativo."
        badges={
          <Badge variant="secondary" data-testid="dashboard-scope">
            Ambito {w.scope.kind} · {w.role}
          </Badge>
        }
      />

      <section data-testid="dashboard-counters" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {TRENDED_CARDS.map((def) => {
          const t = trendByKey.get(def.key);
          return (
            <div key={def.key} data-testid={def.testId}>
              <StatsCard
                label={def.label}
                value={w.counters[def.key]}
                icon={def.icon}
                {...(t
                  ? { trend: t.deltaPct, trendDirection: t.direction, sparkline: t.series, description: "vs settimana prec." }
                  : {})}
              />
            </div>
          );
        })}
        {extraCards.map((c) => (
          <div key={c.testId} data-testid={c.testId}>
            <StatsCard label={c.label} value={c.value} icon={c.icon} />
          </div>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-base font-semibold tracking-tight">Gap critici/alti recenti</h2>
          {w.upcomingLearningDeadlines.length === 0 ? (
            <EmptyState
              data-testid="deadlines-empty"
              icon={<ShieldCheck className="h-6 w-6" />}
              title="Nessun gap critico"
              description="Non ci sono gap critici o alti aperti al momento."
            />
          ) : (
            <ul data-testid="dashboard-deadlines" className="divide-y divide-border overflow-hidden rounded-card border border-border bg-card">
              {w.upcomingLearningDeadlines.map((d) => (
                <li key={d.learningGapId} data-testid="deadline-item" className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="truncate">
                    {d.userDisplayName} — {d.skillName ?? "Generale"}
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${SEVERITY_CLASS[d.severity] ?? "bg-muted text-muted-foreground"}`}>
                    {d.severity}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold tracking-tight">Attività recente</h2>
          {activityEvents.length === 0 ? (
            <EmptyState
              icon={<Activity className="h-6 w-6" />}
              title="Nessuna attività recente"
              description="Le azioni recenti del tuo ambito appariranno qui."
            />
          ) : (
            <AuditFeed events={activityEvents} title="Attività recente" subtitle={`Ambito ${w.scope.kind}`} />
          )}
        </div>
      </section>
    </main>
  );
}
