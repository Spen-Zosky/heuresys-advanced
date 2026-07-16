"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Button } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";
import { OkrCheckInsDialog } from "@/components/okr-checkins-dialog";

interface OkrRow { okrId: string; objective: string; okrType: string; status: string; overallProgress: number; periodStart: string; periodEnd: string }
interface OkrList { items: OkrRow[]; total: number }

function toneForStatus(s: string): "info" | "success" | "warning" | "danger" | "neutral" {
  if (s === "ACHIEVED") return "success";
  if (s === "MISSED" || s === "CANCELLED") return "danger";
  if (s === "ACTIVE") return "info";
  return "neutral";
}
function buildColumns(t: TFunction, onCheckIns: (o: OkrRow) => void): DataColumn<OkrRow>[] {
  return [
    { header: t("okrs.cols.objective"), cell: (o) => <span className="font-medium text-foreground">{o.objective}</span> },
    { header: t("okrs.cols.type"), cell: (o) => <span className="text-xs text-muted-foreground">{o.okrType}</span> },
    { header: t("okrs.cols.period"), cell: (o) => <span className="text-xs text-muted-foreground">{o.periodStart} → {o.periodEnd}</span> },
    { header: t("okrs.cols.progress"), cell: (o) => <span className="text-xs text-muted-foreground">{o.overallProgress}%</span> },
    { header: t("shared.status"), cell: (o) => <StatusPill tone={toneForStatus(o.status)}>{o.status}</StatusPill> },
    {
      header: "", align: "right",
      cell: (o) => (
        <Button variant="outline" size="sm" data-testid="okrs-checkins-open" onClick={() => onCheckIns(o)}>
          {t("okrs.checkIns.open")}
        </Button>
      ),
    },
  ];
}
export default function OkrsPage() {
  const { t } = useTranslation("hr");
  const [active, setActive] = useState<OkrRow | null>(null);
  const columns = useMemo(() => buildColumns(t, setActive), [t]);
  const okrs = useQuery({ queryKey: ["okrs", "list"], queryFn: () => apiFetch<OkrList>("/v1/okrs?limit=200") });
  return (
    <>
      <DataTablePanel<OkrRow>
        pageTestId="okrs-page" titleTestId="okrs-title" countTestId="okrs-count"
        title={t("okrs.title")} description={t("okrs.description")}
        count={okrs.data ? t("okrs.count", { count: okrs.data.total }) : undefined}
        isLoading={okrs.isLoading} isError={okrs.isError} errorMessage={t("okrs.errorMessage")}
        rows={okrs.data?.items ?? []} rowKey={(o) => o.okrId} rowTestId="okrs-row" columns={columns}
        emptyTestId="okrs-empty" emptyTitle={t("okrs.emptyTitle")} emptyDescription={t("okrs.emptyDescription")} caption={t("okrs.caption")}
      />
      {active ? (
        <OkrCheckInsDialog
          okrId={active.okrId} okrTitle={active.objective}
          open={active !== null} onOpenChange={(o) => { if (!o) setActive(null); }}
        />
      ) : null}
    </>
  );
}
