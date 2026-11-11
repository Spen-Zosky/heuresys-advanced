"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { PageHeader } from "@/components/intestazione-pagina";
import type {
  EngagementSurveyListResponse,
  EngagementSurvey,
  EngagementPulseResponse,
} from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { StatoCaricamento, StatoErrore, StatoVuoto } from "@/components/stato-pagina";
import { useEnumLabel } from "@/lib/enum-labels";
import { EChartsCard } from "../_charts-client";

function statusVariant(s: string): "success" | "secondary" {
  return s === "active" ? "success" : "secondary";
}

/** Multi-series pulse trend over weeks (mood / workload / satisfaction). */
function pulseOption(items: EngagementPulseResponse["items"], lbl: { mood: string; workload: string; satisfaction: string; week: (n: number | null) => string }) {
  return {
    tooltip: { trigger: "axis" as const },
    legend: { data: [lbl.mood, lbl.workload, lbl.satisfaction] },
    grid: { left: 56, right: 20, top: 40, bottom: 48 },
    xAxis: { type: "category" as const, data: items.map((i) => lbl.week(i.weekNumber)) },
    yAxis: { type: "value" as const },
    series: [
      { name: lbl.mood, type: "line" as const, smooth: true, data: items.map((i) => i.avgMood) },
      { name: lbl.workload, type: "line" as const, smooth: true, data: items.map((i) => i.avgWorkload) },
      { name: lbl.satisfaction, type: "line" as const, smooth: true, data: items.map((i) => i.avgSatisfaction) },
    ],
  };
}

export default function EngagementPage() {
  const { t, i18n } = useTranslation("admin");
  const enumLabel = useEnumLabel();

  const surveys = useQuery({
    queryKey: ["engagement", "surveys"],
    queryFn: () => apiFetch<EngagementSurveyListResponse>("/v1/engagement/surveys"),
  });
  const pulse = useQuery({
    queryKey: ["engagement", "pulse"],
    queryFn: () => apiFetch<EngagementPulseResponse>("/v1/engagement/pulse"),
  });

  const columns: DataColumn<EngagementSurvey>[] = useMemo(
    () => [
      {
        header: t("engagement.columns.title"),
        cell: (s) => (
          <Link href={`/engagement/${s.surveyId}`} data-testid="engagement-row-link" className="font-medium text-foreground hover:underline">
            {s.title}
          </Link>
        ),
      },
      { header: t("engagement.columns.type"), cell: (s) => <span className="text-muted-foreground">{enumLabel("surveyCategory", s.type)}</span> },
      { header: t("engagement.columns.responses"), cell: (s) => <span className="text-muted-foreground">{s.responseCount}</span> },
      { header: t("engagement.columns.questions"), cell: (s) => <span className="text-muted-foreground">{s.questionCount}</span> },
      { header: t("engagement.columns.invitations"), cell: (s) => <span className="text-muted-foreground">{s.totalInvitations}</span> },
      // Repertorio interfacce, R3: lo stato chiude la riga.
      { header: t("engagement.columns.status"), cell: (s) => <Badge variant={statusVariant(s.status)}>{t(`engagement.status.${s.status}`, s.status)}</Badge> },
    ],
    [t, enumLabel],
  );

  const pulseLabels = {
    mood: t("engagement.pulse.mood"),
    workload: t("engagement.pulse.workload"),
    satisfaction: t("engagement.pulse.satisfaction"),
    week: (n: number | null) => (n === null ? "—" : t("engagement.pulse.weekShort", { n })),
  };

  return (
    <main data-testid="engagement-page" className="mx-auto max-w-7xl space-y-6 px-6 pb-8">
      <PageHeader
        data-testid="engagement-title"
        title={t("engagement.title")}
        description={t("engagement.description")}
        badges={
          <Badge variant="secondary" data-testid="engagement-count">
            {surveys.data ? t("engagement.count", { count: surveys.data.total }) : surveys.isError ? t("common:stato.nonDisponibile") : t("common:loading")}
          </Badge>
        }
      />

      {/* Surveys overview */}
      <div data-testid="engagement-table">
        <EntityTable<EngagementSurvey> originPath={"/v1/engagement/surveys"}
          isLoading={surveys.isLoading}
          isError={surveys.isError}
          error={surveys.error}
          errorMessage={t("engagement.errorMessage")}
          rows={surveys.data?.items ?? []}
          rowKey={(s) => s.surveyId}
          rowTestId="engagement-row"
          columns={columns}
          emptyTestId="engagement-empty"
          emptyTitle={t("engagement.emptyTitle")}
          emptyDescription={t("engagement.emptyDescription")}
          caption={t("engagement.caption")}
        />
      </div>

      {/* Pulse trend */}
      <Card data-testid="engagement-pulse">
        <CardHeader>
          <CardTitle>{t("engagement.pulse.cardTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pulse.isLoading ? (
            <StatoCaricamento />
          ) : pulse.isError ? (
            <StatoErrore
              errore={pulse.error}
              titolo={t("engagement.errorMessage")}
              testId="engagement-pulse-error"
              onRiprova={() => void pulse.refetch()}
            />
          ) : (pulse.data?.items.length ?? 0) === 0 ? (
            <StatoVuoto titolo={t("engagement.pulse.empty")} testId="engagement-pulse-empty" />
          ) : (
            <>
              <Badge variant="secondary" data-testid="engagement-pulse-total">
                {t("engagement.pulse.totalChecks", { count: pulse.data?.totalChecks ?? 0 })}
              </Badge>
              <EChartsCard
                option={pulseOption(pulse.data!.items, pulseLabels)}
                height={340}
                ariaLabel={t("engagement.pulse.cardTitle")}
                assi={{ x: t("engagement.pulse.axisWeek"), y: t("engagement.pulse.axisScore") }}
                lingua={i18n.language}
                tabella={{
                  titolo: t("engagement.pulse.tableTitle"),
                  colonne: [t("engagement.pulse.axisWeek"), pulseLabels.mood, pulseLabels.workload, pulseLabels.satisfaction, t("engagement.pulse.colCount")],
                  righe: pulse.data!.items.map((i) => [
                    pulseLabels.week(i.weekNumber),
                    i.avgMood ?? "—",
                    i.avgWorkload ?? "—",
                    i.avgSatisfaction ?? "—",
                    i.count,
                  ]),
                }}
              />
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
