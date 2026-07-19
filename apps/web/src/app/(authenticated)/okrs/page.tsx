"use client";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Button } from "@heuresys/ui";
import type { Okr } from "@heuresys/shared";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";
import { OkrCheckInsDialog } from "@/components/okr-checkins-dialog";

function toneForStatus(s: string): "info" | "success" | "warning" | "danger" | "neutral" {
  if (s === "ACHIEVED") return "success";
  if (s === "MISSED" || s === "CANCELLED") return "danger";
  if (s === "ACTIVE") return "info";
  return "neutral";
}
function buildColumns(t: TFunction, onCheckIns: (o: Okr) => void): DataColumn<Okr>[] {
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
  const [active, setActive] = useState<Okr | null>(null);
  const columns = useMemo(() => buildColumns(t, setActive), [t]);
  // C4 (#42): server-side pagination (was `?limit=200`).
  const okrs = usePaginatedList<Okr>({ queryKey: ["okrs", "list"], path: "/v1/okrs" });
  return (
    <>
      <DataTablePanel<Okr>
        pageTestId="okrs-page" titleTestId="okrs-title" countTestId="okrs-count"
        title={t("okrs.title")} description={t("okrs.description")}
        count={okrs.query.data ? t("okrs.count", { count: okrs.total }) : undefined}
        isLoading={okrs.query.isLoading} isError={okrs.query.isError} errorMessage={t("okrs.errorMessage")}
        rows={okrs.rows} server={okrs.server} rowKey={(o) => o.okrId} rowTestId="okrs-row" columns={columns}
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
