"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import type { FlightRiskListResponse, FlightRiskScore, FlightRiskBand, InsightsRecomputeResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";

// Band → @heuresys/ui Badge variant (only confirmed variants) + registered text token.
const BAND_BADGE: Record<FlightRiskBand, "success" | "secondary" | "destructive"> = {
  LOW: "success",
  MEDIUM: "secondary",
  HIGH: "secondary",
  CRITICAL: "destructive",
};
const BAND_TEXT: Record<FlightRiskBand, string> = {
  LOW: "text-success",
  MEDIUM: "text-foreground",
  HIGH: "text-warning",
  CRITICAL: "text-danger",
};

export default function InsightsPage() {
  const { t } = useTranslation("admin");
  const qc = useQueryClient();
  const [selected, setSelected] = useState<FlightRiskScore | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const perms = useCurrentUserPermissions();
  const canAdmin = useMemo(() => new Set(perms.data?.permissions ?? []).has("insights:admin"), [perms.data]);

  const data = useQuery({
    queryKey: ["insights", "flight-risk"],
    queryFn: () => apiFetch<FlightRiskListResponse>("/v1/insights/flight-risk"),
  });

  const recompute = useMutation({
    mutationFn: () => apiFetch<InsightsRecomputeResponse>("/v1/insights/recompute", { method: "POST" }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["insights", "flight-risk"] });
      setSelected(null);
      setFeedback({ kind: "ok", msg: t("insights.recomputeSuccess", { scored: r.scored }) });
    },
    onError: (err) => setFeedback({ kind: "err", msg: err instanceof Error ? err.message : t("insights.recomputeError") }),
  });

  const columns: DataColumn<FlightRiskScore>[] = useMemo(
    () => [
      {
        header: t("insights.colSubject"),
        cell: (r) => (
          <button type="button" data-testid="insights-row-select" className="text-left font-medium text-foreground hover:underline" onClick={() => setSelected(r)}>
            {r.displayName ?? r.userId.slice(0, 8)}
          </button>
        ),
      },
      { header: t("insights.colScore"), align: "right", cell: (r) => <span className={`font-mono font-semibold ${BAND_TEXT[r.band]}`}>{r.score.toFixed(1)}</span> },
      { header: t("insights.colBand"), cell: (r) => <Badge variant={BAND_BADGE[r.band]}>{t(`insights.band.${r.band}`)}</Badge> },
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      <DataTablePanel<FlightRiskScore>
        pageTestId="insights-page"
        titleTestId="insights-title"
        countTestId="insights-count"
        title={t("insights.title")}
        description={data.data ? t("insights.descriptionScoped", { kind: data.data.scope.kind }) : t("insights.description")}
        count={data.data ? t("insights.count", { count: data.data.total }) : t("common:loading")}
        actions={
          canAdmin ? (
            <Button type="button" data-testid="insights-recompute" disabled={recompute.isPending} onClick={() => { setFeedback(null); recompute.mutate(); }}>
              {recompute.isPending ? t("insights.recomputing") : t("insights.recompute")}
            </Button>
          ) : undefined
        }
        isLoading={data.isLoading}
        isError={data.isError}
        errorMessage={t("insights.errorMessage")}
        rows={data.data?.items ?? []}
        rowKey={(r) => r.userId}
        rowTestId="insights-row"
        columns={columns}
        emptyTestId="insights-empty"
        emptyTitle={t("insights.emptyTitle")}
        emptyDescription={t("insights.emptyDescription")}
        caption={t("insights.caption")}
      />

      {feedback && (
        <p
          data-testid={feedback.kind === "ok" ? "insights-recompute-success" : "insights-recompute-error"}
          className={`mx-auto max-w-7xl px-6 text-sm font-medium ${feedback.kind === "ok" ? "text-success" : "text-danger"}`}
          role={feedback.kind === "err" ? "alert" : undefined}
        >
          {feedback.msg}
        </p>
      )}

      {selected && (
        <div className="mx-auto max-w-7xl px-6">
          <Card data-testid="insights-explain">
            <CardHeader>
              <CardTitle>{t("insights.explainTitle", { name: selected.displayName ?? selected.userId.slice(0, 8) })}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("insights.explainDesc", { score: selected.score.toFixed(1), band: t(`insights.band.${selected.band}`), model: selected.modelVersion })}
              </p>
              {selected.features.map((f) => (
                <div key={f.feature} data-testid="insights-feature" className="flex items-center gap-3 text-sm">
                  <span className="w-36 shrink-0 text-foreground">{t(`insights.feature.${f.feature}`, { defaultValue: f.feature })}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded bg-muted" aria-hidden="true">
                    <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, f.normalized ?? 0))}%` }} />
                  </div>
                  <span className="w-48 shrink-0 text-right font-mono text-xs text-muted-foreground">
                    {t("insights.featureDetail", { normalized: (f.normalized ?? 0).toFixed(0), weight: (f.weight * 100).toFixed(0), contribution: f.contribution.toFixed(1) })}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
