"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Button } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";
import { GoalTimelineDialog } from "@/components/goal-timeline-dialog";

interface GoalRow {
  goalId: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  progressPercent: number;
  dueDate: string | null;
}
interface GoalList { items: GoalRow[]; total: number }

function toneForStatus(s: string): "info" | "success" | "warning" | "danger" | "neutral" {
  if (s === "COMPLETED" || s === "ON_TRACK") return "success";
  if (s === "AT_RISK") return "warning";
  if (s === "BLOCKED" || s === "CANCELLED") return "danger";
  if (s === "IN_PROGRESS") return "info";
  return "neutral";
}

function buildColumns(t: TFunction, onTimeline: (g: GoalRow) => void): DataColumn<GoalRow>[] {
  return [
    { header: t("shared.name"), cell: (g) => <span className="font-medium text-foreground">{g.title}</span> },
    { header: t("goals.cols.type"), cell: (g) => <span className="text-xs text-muted-foreground">{g.type}</span> },
    { header: t("goals.cols.priority"), cell: (g) => <span className="text-xs text-muted-foreground">{g.priority}</span> },
    { header: t("goals.cols.progress"), cell: (g) => <span className="text-xs text-muted-foreground">{g.progressPercent}%</span> },
    { header: t("goals.cols.due"), cell: (g) => <span className="text-xs text-muted-foreground">{g.dueDate ?? "—"}</span> },
    { header: t("shared.status"), cell: (g) => <StatusPill tone={toneForStatus(g.status)}>{g.status}</StatusPill> },
    {
      header: "", align: "right",
      cell: (g) => (
        <Button variant="outline" size="sm" data-testid="goals-timeline-open" onClick={() => onTimeline(g)}>
          {t("goals.timeline.open")}
        </Button>
      ),
    },
  ];
}

export default function GoalsPage() {
  const { t } = useTranslation("hr");
  const [active, setActive] = useState<GoalRow | null>(null);
  const columns = useMemo(() => buildColumns(t, setActive), [t]);
  const goals = useQuery({
    queryKey: ["goals", "list"],
    queryFn: () => apiFetch<GoalList>("/v1/goals?limit=200"),
  });

  return (
    <>
      <DataTablePanel<GoalRow>
        pageTestId="goals-page"
        titleTestId="goals-title"
        countTestId="goals-count"
        title={t("goals.title")}
        description={t("goals.description")}
        count={goals.data ? t("goals.count", { count: goals.data.total }) : undefined}
        isLoading={goals.isLoading}
        isError={goals.isError}
        errorMessage={t("goals.errorMessage")}
        rows={goals.data?.items ?? []}
        rowKey={(g) => g.goalId}
        rowTestId="goals-row"
        columns={columns}
        emptyTestId="goals-empty"
        emptyTitle={t("goals.emptyTitle")}
        emptyDescription={t("goals.emptyDescription")}
        caption={t("goals.caption")}
      />
      {active ? (
        <GoalTimelineDialog
          goalId={active.goalId}
          goalTitle={active.title}
          open={active !== null}
          onOpenChange={(o) => { if (!o) setActive(null); }}
        />
      ) : null}
    </>
  );
}
