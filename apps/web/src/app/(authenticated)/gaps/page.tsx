"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, DataTableWithCrossHair, EmptyState, KPIStrip, PageHeader, type KpiCardData } from "@heuresys/ui";
import { Inbox } from "lucide-react";
import { apiFetch } from "@/lib/api/fetch";
import { StatusBadge } from "@/components/status-pill";

interface LearningGap {
  learningGapId: string;
  userId: string;
  userName: string | null;
  positionId: string | null;
  positionTitle: string | null;
  skillId: string | null;
  skillName: string | null;
  severity: string;
  requiredProficiency: string | null;
  currentProficiency: string | null;
  detectedAt: string;
}

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
const SEV_TONE: Record<(typeof SEVERITIES)[number], KpiCardData["iconTone"]> = {
  CRITICAL: "danger",
  HIGH: "warning",
  MEDIUM: "palette-4",
  LOW: "info",
};

export default function AdminGapsPage() {
  const { t } = useTranslation("hr");
  const gaps = useQuery({
    queryKey: ["learning-gaps", "all"],
    queryFn: () => apiFetch<{ items: LearningGap[]; total: number }>("/v1/learning-gaps?limit=200"),
  });

  const items = gaps.data?.items ?? [];
  const bySev = items.reduce<Record<string, number>>((acc, g) => {
    acc[g.severity] = (acc[g.severity] ?? 0) + 1;
    return acc;
  }, {});

  const sevItems: KpiCardData[] = SEVERITIES.map((s) => ({
    label: s,
    value: <span data-testid={`gaps-severity-${s}`}>{bySev[s] ?? 0}</span>,
    iconTone: SEV_TONE[s],
  }));

  return (
    <main data-testid="gaps-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="gaps-title"
        title={t("gaps.title")}
        description={t("gaps.description")}
        badges={
          <Badge variant="secondary" data-testid="gaps-count">
            {gaps.data ? t("gaps.count", { count: gaps.data.total }) : "…"}
          </Badge>
        }
      />

      <section data-testid="gaps-summary">
        <KPIStrip items={sevItems} />
      </section>

      {gaps.isLoading ? (
        <div className="rounded-card border border-border bg-card p-6 text-sm text-muted-foreground">{t("common:loading")}</div>
      ) : gaps.isError ? (
        <div className="rounded-card border border-border bg-card p-6 text-sm text-danger" data-testid="gaps-error">
          {t("gaps.error")}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          data-testid="gaps-empty"
          icon={<Inbox className="h-6 w-6" />}
          title={t("gaps.emptyTitle")}
          description={t("gaps.emptyDescription")}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
          <DataTableWithCrossHair caption={t("gaps.caption")} className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2">{t("gaps.cols.user")}</th>
                <th className="px-4 py-2">{t("gaps.cols.position")}</th>
                <th className="px-4 py-2">{t("gaps.cols.skill")}</th>
                <th className="px-4 py-2">{t("gaps.cols.severity")}</th>
                <th className="px-4 py-2">{t("gaps.cols.required")}</th>
                <th className="px-4 py-2">{t("gaps.cols.current")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((g) => (
                <tr key={g.learningGapId} data-testid="gaps-row" className="transition-colors hover:bg-muted/60">
                  <td className="px-4 py-2 text-xs text-foreground">{g.userName ?? g.userId.slice(0, 8)}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{g.positionTitle ?? (g.positionId ? g.positionId.slice(0, 8) : "—")}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{g.skillName ?? (g.skillId ? g.skillId.slice(0, 8) : "—")}</td>
                  <td className="px-4 py-2"><StatusBadge value={g.severity} /></td>
                  <td className="px-4 py-2 text-xs">{g.requiredProficiency ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">{g.currentProficiency ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </DataTableWithCrossHair>
        </div>
      )}
    </main>
  );
}
