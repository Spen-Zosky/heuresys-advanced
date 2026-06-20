"use client";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";

// Gap#1 Porta 2 — Org-Director console. Live capability/maturity per org-unit,
// driven by the MLCE composite (/v1/capability/composition) + the Maturity engine
// (/v1/capability/maturity). No mock data: a real empty-state when the engines
// have not been recomputed yet.
interface CompositionItem { subjectId: string; label: string | null; value: number; coverage: number; childCount: number }
interface MaturityItem { orgUnitId: string; level: string; levelLabel: string }
interface OrgRow { ouId: string; name: string; capability: number; coverage: number; positions: number; level: string | null; levelLabel: string | null }

function toneForLevel(level: string | null): "info" | "success" | "warning" | "danger" | "neutral" {
  if (level === "L5" || level === "L4") return "success";
  if (level === "L3") return "info";
  if (level === "L2") return "warning";
  if (level === "L1" || level === "L0") return "danger";
  return "neutral";
}

function buildColumns(t: TFunction): DataColumn<OrgRow>[] {
  return [
    { header: t("orgDirector.cols.unit"), cell: (r) => <span className="font-medium text-foreground">{r.name}</span> },
    { header: t("orgDirector.cols.capability"), cell: (r) => <span className="text-xs text-muted-foreground">{r.capability}%</span> },
    { header: t("orgDirector.cols.coverage"), cell: (r) => <span className="text-xs text-muted-foreground">{r.coverage}%</span> },
    { header: t("orgDirector.cols.positions"), cell: (r) => <span className="text-xs text-muted-foreground">{r.positions}</span> },
    { header: t("orgDirector.cols.maturity"), cell: (r) => (r.level ? <StatusPill tone={toneForLevel(r.level)}>{`${r.level} · ${r.levelLabel ?? ""}`}</StatusPill> : <span className="text-xs text-muted-foreground">—</span>) },
  ];
}

export default function OrgDirectorPage() {
  const { t } = useTranslation("hr");
  const composition = useQuery({
    queryKey: ["capability", "composition", "ORG_UNIT"],
    queryFn: () => apiFetch<{ items: CompositionItem[] }>("/v1/capability/composition?subjectType=ORG_UNIT"),
  });
  const maturity = useQuery({
    queryKey: ["capability", "maturity", "list"],
    queryFn: () => apiFetch<{ items: MaturityItem[] }>("/v1/capability/maturity"),
  });

  const rows = useMemo<OrgRow[]>(() => {
    const matByOu = new Map((maturity.data?.items ?? []).map((m) => [m.orgUnitId, m]));
    return (composition.data?.items ?? [])
      .map((c) => {
        const m = matByOu.get(c.subjectId);
        return {
          ouId: c.subjectId, name: c.label ?? c.subjectId, capability: c.value, coverage: c.coverage,
          positions: c.childCount, level: m?.level ?? null, levelLabel: m?.levelLabel ?? null,
        };
      })
      .sort((a, b) => b.capability - a.capability);
  }, [composition.data, maturity.data]);

  const columns = useMemo(() => buildColumns(t), [t]);
  const isLoading = composition.isLoading || maturity.isLoading;
  const isError = composition.isError || maturity.isError;

  return (
    <DataTablePanel<OrgRow>
      pageTestId="org-director-page" titleTestId="org-director-title" countTestId="org-director-count"
      title={t("orgDirector.title")} description={t("orgDirector.description")}
      count={composition.data ? t("orgDirector.count", { count: rows.length }) : undefined}
      isLoading={isLoading} isError={isError} errorMessage={t("orgDirector.errorMessage")}
      rows={rows} rowKey={(r) => r.ouId} rowTestId="org-director-row" columns={columns}
      emptyTestId="org-director-empty" emptyTitle={t("orgDirector.emptyTitle")} emptyDescription={t("orgDirector.emptyDescription")} caption={t("orgDirector.caption")}
    />
  );
}
