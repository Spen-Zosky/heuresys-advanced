"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import type {
  SkillGapListResponse,
  SkillGapScore,
  SkillGapSegment,
  InsightsRecomputeResponse,
} from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { MaskedCell, isMasked } from "@/components/masked-cell";
import { EvidenceDrawer } from "@/components/evidence-drawer";

// Higher value = larger gap = worse: ALIGNED → success, MAJOR_GAP → destructive.
// Only confirmed @heuresys/ui Badge variants + registered text tokens.
const SEGMENT_BADGE: Record<SkillGapSegment, "success" | "secondary" | "destructive"> = {
  ALIGNED: "success",
  MINOR_GAP: "secondary",
  MODERATE_GAP: "secondary",
  MAJOR_GAP: "destructive",
};
const SEGMENT_TEXT: Record<SkillGapSegment, string> = {
  ALIGNED: "text-success",
  MINOR_GAP: "text-foreground",
  MODERATE_GAP: "text-warning",
  MAJOR_GAP: "text-danger",
};

const positionLabel = (r: SkillGapScore) => r.positionTitle ?? r.positionCode ?? r.positionId.slice(0, 8);

export default function SkillGapPage() {
  const { t } = useTranslation("admin");
  const qc = useQueryClient();
  const [selected, setSelected] = useState<SkillGapScore | null>(null);
  const [evidenceFor, setEvidenceFor] = useState<SkillGapScore | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const perms = useCurrentUserPermissions();
  const canAdmin = useMemo(() => new Set(perms.data?.permissions ?? []).has("insights:admin"), [perms.data]);

  const data = useQuery({
    queryKey: ["insights", "skill-gap"],
    queryFn: () => apiFetch<SkillGapListResponse>("/v1/insights/skill-gap"),
  });

  const recompute = useMutation({
    mutationFn: () => apiFetch<InsightsRecomputeResponse>("/v1/insights/skill-gap/recompute", { method: "POST" }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["insights", "skill-gap"] });
      setSelected(null);
      setFeedback({ kind: "ok", msg: t("insightsSkillGap.recomputeSuccess", { scored: r.scored }) });
    },
    onError: (err) => setFeedback({ kind: "err", msg: err instanceof Error ? err.message : t("insightsSkillGap.recomputeError") }),
  });

  const columns: DataColumn<SkillGapScore>[] = useMemo(
    () => [
      {
        header: t("insightsSkillGap.colSubject"),
        cell: (r) => (
          <button type="button" data-testid="skillgap-row-select" className="text-left font-medium text-foreground hover:underline" onClick={() => setSelected(r)}>
            {r.displayName ?? r.userId.slice(0, 8)}
          </button>
        ),
      },
      { header: t("insightsSkillGap.colPosition"), cell: (r) => <span className="text-foreground">{positionLabel(r)}</span> },
      { header: t("insightsSkillGap.colValue"), align: "right", cell: (r) => (
        // #124 D6: assente e dichiarato, non «—».
        isMasked(r, "value") || r.value === undefined
          ? <MaskedCell />
          : <span className={`font-mono font-semibold ${r.segment ? SEGMENT_TEXT[r.segment] : ""}`}>{r.value.toFixed(1)}</span>
      ) },
      { header: t("insightsSkillGap.colSegment"), cell: (r) => (
        isMasked(r, "segment") || r.segment === undefined
          ? <MaskedCell />
          : <Badge variant={SEGMENT_BADGE[r.segment]}>{t(`insightsSkillGap.segment.${r.segment}`)}</Badge>
      ) },
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      <DataTablePanel<SkillGapScore>
        pageTestId="skillgap-page"
        titleTestId="skillgap-title"
        countTestId="skillgap-count"
        title={t("insightsSkillGap.title")}
        description={data.data ? t("insightsSkillGap.descriptionScoped", { kind: data.data.scope.kind }) : t("insightsSkillGap.description")}
        count={data.data ? t("insightsSkillGap.count", { count: data.data.total }) : t("common:loading")}
        actions={
          canAdmin ? (
            <Button type="button" data-testid="skillgap-recompute" disabled={recompute.isPending} onClick={() => { setFeedback(null); recompute.mutate(); }}>
              {recompute.isPending ? t("insightsSkillGap.recomputing") : t("insightsSkillGap.recompute")}
            </Button>
          ) : undefined
        }
        isLoading={data.isLoading}
        isError={data.isError}
        errorMessage={t("insightsSkillGap.errorMessage")}
        rows={data.data?.items ?? []}
        rowKey={(r) => `${r.userId}:${r.positionId}`}
        rowTestId="skillgap-row"
        columns={columns}
        emptyTestId="skillgap-empty"
        emptyTitle={t("insightsSkillGap.emptyTitle")}
        emptyDescription={t("insightsSkillGap.emptyDescription")}
        caption={t("insightsSkillGap.caption")}
      />

      {feedback && (
        <p
          data-testid={feedback.kind === "ok" ? "skillgap-recompute-success" : "skillgap-recompute-error"}
          className={`mx-auto max-w-7xl px-6 text-sm font-medium ${feedback.kind === "ok" ? "text-success" : "text-danger"}`}
          role={feedback.kind === "err" ? "alert" : undefined}
        >
          {feedback.msg}
        </p>
      )}

      {selected && (
        <div className="mx-auto max-w-7xl px-6">
          <Card data-testid="skillgap-explain">
            <CardHeader>
              <CardTitle>{t("insightsSkillGap.explainTitle", { name: selected.displayName ?? selected.userId.slice(0, 8), position: positionLabel(selected) })}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("insightsSkillGap.explainDesc", { value: selected.value!.toFixed(1), segment: t(`insightsSkillGap.segment.${selected.segment}`), model: selected.modelVersion })}
              </p>
              <Button type="button" variant="outline" size="sm" data-testid="skillgap-evidence-open"
                      onClick={() => setEvidenceFor(selected)}>
                {t("insightsSkillGap.evidenceOpen")}
              </Button>
              {(selected.features ?? []).map((f) => (
                <div key={f.feature} data-testid="skillgap-feature" className="flex items-center gap-3 text-sm">
                  <span className="w-36 shrink-0 text-foreground">{t(`insightsSkillGap.feature.${f.feature}`, { defaultValue: f.feature })}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded bg-muted" aria-hidden="true">
                    <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, f.normalized ?? 0))}%` }} />
                  </div>
                  <span className="w-48 shrink-0 text-right font-mono text-xs text-muted-foreground">
                    {t("insightsSkillGap.featureDetail", { normalized: (f.normalized ?? 0).toFixed(0), weight: (f.weight * 100).toFixed(0), contribution: f.contribution.toFixed(1) })}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {evidenceFor && (
        <EvidenceDrawer
          subjectUserId={evidenceFor.userId}
          subjectName={evidenceFor.displayName ?? evidenceFor.userId.slice(0, 8)}
          open={evidenceFor !== null}
          onOpenChange={(o) => { if (!o) setEvidenceFor(null); }}
        />
      )}
    </div>
  );
}
