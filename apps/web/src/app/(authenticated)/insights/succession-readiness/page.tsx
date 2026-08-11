"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import type {
  SuccessionReadinessListResponse,
  SuccessionReadinessScore,
  SuccessionReadinessHorizon,
  InsightsRecomputeResponse,
} from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { MaskedCell, isMasked } from "@/components/masked-cell";

// Higher readiness = better: READY_NOW → success, NOT_READY → destructive.
// Only confirmed @heuresys/ui Badge variants + registered text tokens.
const HORIZON_BADGE: Record<SuccessionReadinessHorizon, "success" | "secondary" | "destructive"> = {
  READY_NOW: "success",
  READY_6_MONTHS: "secondary",
  READY_1_YEAR: "secondary",
  READY_2_YEARS: "secondary",
  NOT_READY: "destructive",
};
const HORIZON_TEXT: Record<SuccessionReadinessHorizon, string> = {
  READY_NOW: "text-success",
  READY_6_MONTHS: "text-foreground",
  READY_1_YEAR: "text-foreground",
  READY_2_YEARS: "text-warning",
  NOT_READY: "text-danger",
};

const positionLabel = (r: SuccessionReadinessScore) => r.positionTitle ?? r.positionCode ?? r.positionId.slice(0, 8);

export default function SuccessionReadinessPage() {
  const { t } = useTranslation("admin");
  const qc = useQueryClient();
  const [selected, setSelected] = useState<SuccessionReadinessScore | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const perms = useCurrentUserPermissions();
  const canAdmin = useMemo(() => new Set(perms.data?.permissions ?? []).has("insights:admin"), [perms.data]);

  const data = useQuery({
    queryKey: ["insights", "succession-readiness"],
    queryFn: () => apiFetch<SuccessionReadinessListResponse>("/v1/insights/succession-readiness"),
  });

  const recompute = useMutation({
    mutationFn: () => apiFetch<InsightsRecomputeResponse>("/v1/insights/succession-readiness/recompute", { method: "POST" }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["insights", "succession-readiness"] });
      setSelected(null);
      setFeedback({ kind: "ok", msg: t("insightsReadiness.recomputeSuccess", { scored: r.scored }) });
    },
    onError: (err) => setFeedback({ kind: "err", msg: err instanceof Error ? err.message : t("insightsReadiness.recomputeError") }),
  });

  const columns: DataColumn<SuccessionReadinessScore>[] = useMemo(
    () => [
      {
        header: t("insightsReadiness.colSubject"),
        cell: (r) => (
          <button type="button" data-testid="readiness-row-select" className="text-left font-medium text-foreground hover:underline" onClick={() => setSelected(r)}>
            {r.displayName ?? r.userId.slice(0, 8)}
          </button>
        ),
      },
      { header: t("insightsReadiness.colPosition"), cell: (r) => <span className="text-foreground">{positionLabel(r)}</span> },
      { header: t("insightsReadiness.colValue"), align: "right", cell: (r) => (
        // #124 D6: assente e dichiarato, non «—».
        isMasked(r, "value") || r.value === undefined
          ? <MaskedCell />
          : <span className={`font-mono font-semibold ${r.horizon ? HORIZON_TEXT[r.horizon] : ""}`}>{r.value.toFixed(1)}</span>
      ) },
      { header: t("insightsReadiness.colHorizon"), cell: (r) => (
        isMasked(r, "horizon") || r.horizon === undefined
          ? <MaskedCell />
          : <Badge variant={HORIZON_BADGE[r.horizon]}>{t(`insightsReadiness.horizon.${r.horizon}`)}</Badge>
      ) },
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      <DataTablePanel<SuccessionReadinessScore>
        pageTestId="readiness-page"
        titleTestId="readiness-title"
        countTestId="readiness-count"
        title={t("insightsReadiness.title")}
        description={data.data ? t("insightsReadiness.descriptionScoped", { kind: data.data.scope.kind }) : t("insightsReadiness.description")}
        count={data.data ? t("insightsReadiness.count", { count: data.data.total }) : t("common:loading")}
        actions={
          canAdmin ? (
            <Button type="button" data-testid="readiness-recompute" disabled={recompute.isPending} onClick={() => { setFeedback(null); recompute.mutate(); }}>
              {recompute.isPending ? t("insightsReadiness.recomputing") : t("insightsReadiness.recompute")}
            </Button>
          ) : undefined
        }
        isLoading={data.isLoading}
        isError={data.isError}
        errorMessage={t("insightsReadiness.errorMessage")}
        rows={data.data?.items ?? []}
        rowKey={(r) => `${r.userId}:${r.positionId}`}
        rowTestId="readiness-row"
        columns={columns}
        emptyTestId="readiness-empty"
        emptyTitle={t("insightsReadiness.emptyTitle")}
        emptyDescription={t("insightsReadiness.emptyDescription")}
        caption={t("insightsReadiness.caption")}
      />

      {feedback && (
        <p
          data-testid={feedback.kind === "ok" ? "readiness-recompute-success" : "readiness-recompute-error"}
          className={`mx-auto max-w-7xl px-6 text-sm font-medium ${feedback.kind === "ok" ? "text-success" : "text-danger"}`}
          role={feedback.kind === "err" ? "alert" : undefined}
        >
          {feedback.msg}
        </p>
      )}

      {selected && (
        <div className="mx-auto max-w-7xl px-6">
          <Card data-testid="readiness-explain">
            <CardHeader>
              <CardTitle>{t("insightsReadiness.explainTitle", { name: selected.displayName ?? selected.userId.slice(0, 8), position: positionLabel(selected) })}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("insightsReadiness.explainDesc", { value: selected.value!.toFixed(1), horizon: t(`insightsReadiness.horizon.${selected.horizon}`), model: selected.modelVersion })}
              </p>
              {(selected.features ?? []).map((f) => (
                <div key={f.feature} data-testid="readiness-feature" className="flex items-center gap-3 text-sm">
                  <span className="w-36 shrink-0 text-foreground">{t(`insightsReadiness.feature.${f.feature}`, { defaultValue: f.feature })}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded bg-muted" aria-hidden="true">
                    <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, f.normalized ?? 0))}%` }} />
                  </div>
                  <span className="w-48 shrink-0 text-right font-mono text-xs text-muted-foreground">
                    {t("insightsReadiness.featureDetail", { normalized: (f.normalized ?? 0).toFixed(0), weight: (f.weight * 100).toFixed(0), contribution: f.contribution.toFixed(1) })}
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
