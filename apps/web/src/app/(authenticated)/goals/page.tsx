"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Button } from "@heuresys/ui";
import type { Goal } from "@heuresys/shared";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { EnumStatusPill } from "@/components/enum-badge";
import { useEnumLabel, type EnumLabelFn } from "@/lib/enum-labels";
import { GoalTimelineDialog } from "@/components/goal-timeline-dialog";

function toneForStatus(s: string): "info" | "success" | "warning" | "danger" | "neutral" {
  if (s === "COMPLETED" || s === "ON_TRACK") return "success";
  if (s === "AT_RISK") return "warning";
  if (s === "BLOCKED" || s === "CANCELLED") return "danger";
  if (s === "IN_PROGRESS") return "info";
  return "neutral";
}

function buildColumns(t: TFunction, enumLabel: EnumLabelFn, onTimeline: (g: Goal) => void): DataColumn<Goal>[] {
  return [
    { header: t("shared.name"), cell: (g) => <span className="font-medium text-foreground">{g.title}</span> },
    { header: t("goals.cols.type"), cell: (g) => <span className="text-xs text-muted-foreground">{enumLabel("goalType", g.type)}</span> },
    { header: t("goals.cols.priority"), cell: (g) => <span className="text-xs text-muted-foreground">{enumLabel("goalPriority", g.priority)}</span> },
    { header: t("goals.cols.progress"), cell: (g) => <span className="text-xs text-muted-foreground">{g.progressPercent}%</span> },
    { header: t("goals.cols.due"), cell: (g) => <span className="text-xs text-muted-foreground">{g.dueDate ?? "—"}</span> },
    { header: t("shared.status"), cell: (g) => <EnumStatusPill domain="goalStatus" value={g.status} tone={toneForStatus(g.status)} /> },
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
  const enumLabel = useEnumLabel();
  const [active, setActive] = useState<Goal | null>(null);
  const columns = useMemo(() => buildColumns(t, enumLabel, setActive), [t, enumLabel]);
  // C4 (#42): server-side pagination (was `?limit=200`).
  const goals = usePaginatedList<Goal>({ queryKey: ["goals", "list"], path: "/v1/goals" });

  return (
    <>
      <DataTablePanel<Goal>
        pageTestId="goals-page"
        titleTestId="goals-title"
        countTestId="goals-count"
        title={t("goals.title")}
        description={t("goals.description")}
        count={goals.query.data ? t("goals.count", { count: goals.total }) : undefined}
        isLoading={goals.query.isLoading}
        isError={goals.query.isError}
        errorMessage={t("goals.errorMessage")}
        rows={goals.rows}
        server={goals.server}
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
