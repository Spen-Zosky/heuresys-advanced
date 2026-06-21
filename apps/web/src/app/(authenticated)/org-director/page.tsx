"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Badge, Button, CapabilityRadar, PageHeader } from "@heuresys/ui";
import type { CapabilityMaturityScore, MaturityCriterion } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";

// Gap#1 Porta 2 — Org-Director console. Live capability/maturity per org-unit,
// driven by the MLCE composite (/v1/capability/composition) + the Maturity engine
// (/v1/capability/maturity). Gap#1 follow-up: selecting an org-unit opens a
// CapabilityRadar (@heuresys/ui) of its live Maturity dimensions — the gate metrics
// the engine already derives (composite, skill coverage, KPI achievement, readiness,
// gap-freeness), normalized 0-100. No mock data: real empty-states throughout.
interface CompositionItem { subjectId: string; label: string | null; value: number; coverage: number; childCount: number }
interface OrgRow { ouId: string; name: string; capability: number; coverage: number; positions: number; level: string | null; levelLabel: string | null; criteria: MaturityCriterion[] | null }

interface SelectedOu { ouId: string; name: string; criteria: MaturityCriterion[] }

function toneForLevel(level: string | null): "info" | "success" | "warning" | "danger" | "neutral" {
  if (level === "L5" || level === "L4") return "success";
  if (level === "L3") return "info";
  if (level === "L2") return "warning";
  if (level === "L1" || level === "L0") return "danger";
  return "neutral";
}

// The Maturity engine's gate metrics live in criteria[] (metric/value). composite is
// 0-100; skill/kpi/readiness/majorGap are 0-1 ratios → ×100. majorGapRatio is inverted
// to "gap-freeness" so every radar axis reads higher-is-better.
function metricValue(criteria: MaturityCriterion[], metric: string): number {
  const c = criteria.find((x) => x.metric === metric);
  return c?.value ?? 0;
}
function radarValues(criteria: MaturityCriterion[]): number[] {
  return [
    Math.round(metricValue(criteria, "composite")),
    Math.round(metricValue(criteria, "skillCoverage") * 100),
    Math.round(metricValue(criteria, "kpiAchievement") * 100),
    Math.round(metricValue(criteria, "readinessCoverage") * 100),
    Math.round((1 - metricValue(criteria, "majorGapRatio")) * 100),
  ];
}

function buildColumns(t: TFunction, onSelect: (o: SelectedOu) => void, selectedId: string | null): DataColumn<OrgRow>[] {
  return [
    { header: t("orgDirector.cols.unit"), cell: (r) => <span className="font-medium text-foreground">{r.name}</span> },
    { header: t("orgDirector.cols.capability"), cell: (r) => <span className="text-xs text-muted-foreground">{r.capability}%</span> },
    { header: t("orgDirector.cols.coverage"), cell: (r) => <span className="text-xs text-muted-foreground">{r.coverage}%</span> },
    { header: t("orgDirector.cols.positions"), cell: (r) => <span className="text-xs text-muted-foreground">{r.positions}</span> },
    { header: t("orgDirector.cols.maturity"), cell: (r) => (r.level ? <StatusPill tone={toneForLevel(r.level)}>{`${r.level} · ${r.levelLabel ?? ""}`}</StatusPill> : <span className="text-xs text-muted-foreground">—</span>) },
    {
      header: t("orgDirector.cols.actions"), align: "right",
      cell: (r) => (
        <Button
          type="button" size="sm" variant={selectedId === r.ouId ? "secondary" : "outline"}
          data-testid="org-director-radar-btn" disabled={!r.criteria}
          onClick={() => { if (r.criteria) onSelect({ ouId: r.ouId, name: r.name, criteria: r.criteria }); }}
        >
          {t("orgDirector.radar.view")}
        </Button>
      ),
    },
  ];
}

export default function OrgDirectorPage() {
  const { t } = useTranslation("hr");
  const [selected, setSelected] = useState<SelectedOu | null>(null);

  const composition = useQuery({
    queryKey: ["capability", "composition", "ORG_UNIT"],
    queryFn: () => apiFetch<{ items: CompositionItem[] }>("/v1/capability/composition?subjectType=ORG_UNIT"),
  });
  const maturity = useQuery({
    queryKey: ["capability", "maturity", "list"],
    queryFn: () => apiFetch<{ items: CapabilityMaturityScore[] }>("/v1/capability/maturity"),
  });

  const rows = useMemo<OrgRow[]>(() => {
    const matByOu = new Map((maturity.data?.items ?? []).map((m) => [m.orgUnitId, m]));
    return (composition.data?.items ?? [])
      .map((c) => {
        const m = matByOu.get(c.subjectId);
        return {
          ouId: c.subjectId, name: c.label ?? c.subjectId, capability: c.value, coverage: c.coverage,
          positions: c.childCount, level: m?.level ?? null, levelLabel: m?.levelLabel ?? null,
          criteria: m?.criteria ?? null,
        };
      })
      .sort((a, b) => b.capability - a.capability);
  }, [composition.data, maturity.data]);

  const columns = useMemo(() => buildColumns(t, setSelected, selected?.ouId ?? null), [t, selected]);
  const isLoading = composition.isLoading || maturity.isLoading;
  const isError = composition.isError || maturity.isError;

  const radarAxes = useMemo(() => [
    { id: "composite", label: t("orgDirector.radar.axes.composite") },
    { id: "skill", label: t("orgDirector.radar.axes.skill") },
    { id: "kpi", label: t("orgDirector.radar.axes.kpi") },
    { id: "readiness", label: t("orgDirector.radar.axes.readiness") },
    { id: "gapFree", label: t("orgDirector.radar.axes.gapFree") },
  ], [t]);

  return (
    <main data-testid="org-director-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="org-director-title"
        title={t("orgDirector.title")}
        description={t("orgDirector.description")}
        badges={composition.data ? <Badge variant="secondary" data-testid="org-director-count">{t("orgDirector.count", { count: rows.length })}</Badge> : undefined}
      />
      <EntityTable<OrgRow>
        isLoading={isLoading} isError={isError} errorMessage={t("orgDirector.errorMessage")}
        rows={rows} rowKey={(r) => r.ouId} rowTestId="org-director-row" columns={columns}
        emptyTestId="org-director-empty" emptyTitle={t("orgDirector.emptyTitle")} emptyDescription={t("orgDirector.emptyDescription")} caption={t("orgDirector.caption")}
      />

      <section data-testid="org-director-radar" className="space-y-3">
        <PageHeader
          data-testid="org-director-radar-title"
          title={selected ? t("orgDirector.radar.title", { unit: selected.name }) : t("orgDirector.radar.titleIdle")}
          description={t("orgDirector.radar.subtitle")}
        />
        {selected === null ? (
          <div data-testid="org-director-radar-hint" className="rounded-card border border-dashed border-border bg-card px-4 py-6 text-sm text-muted-foreground">
            {t("orgDirector.radar.hint")}
          </div>
        ) : (
          <div data-testid="org-director-radar-chart" className="flex justify-center rounded-card border border-border bg-card p-6 shadow-card">
            <CapabilityRadar
              axes={radarAxes}
              series={[{ id: selected.ouId, label: selected.name, values: radarValues(selected.criteria) }]}
              max={100} showLegend
            />
          </div>
        )}
      </section>
    </main>
  );
}
