"use client";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, PageHeader } from "@heuresys/ui";
import type { VrioCapabilityItem, VrioScorecard, VrioVerdict } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";

// #56 F2 — VRIO scorecard. Board-ready reading of the capabilities the organization
// actually uses (skill groups in play), classified with Barney's lattice over four
// derived dimensions. Everything on this page comes from
// GET /v1/capability/composition/vrio — no mock data, real empty-state.
//
// The four columns are PERCENTILES within this tenant's own capability set, not absolute
// scores: the raw measures are shown next to them so a reader can always see both the
// ranking and the underlying figure. The rule applied (thresholds + weights) is echoed by
// the API and rendered in the subtitle, so the page never asserts an undocumented constant.

const VERDICT_TONE: Record<VrioVerdict, "info" | "success" | "warning" | "danger" | "neutral"> = {
  SUSTAINED_ADVANTAGE: "success",
  UNUSED_ADVANTAGE: "info",
  TEMPORARY_ADVANTAGE: "warning",
  PARITY: "neutral",
  DISADVANTAGE: "warning",
  CAPABILITY_GAP: "danger",
};

/** Order the board summary reads in: strongest first, the gap last. */
const VERDICT_ORDER: VrioVerdict[] = [
  "SUSTAINED_ADVANTAGE", "UNUSED_ADVANTAGE", "TEMPORARY_ADVANTAGE", "PARITY", "DISADVANTAGE",
  "CAPABILITY_GAP",
];

const pct = (v: number): string => `${Math.round(v * 100)}%`;

/** A dimension cell: the percentile, with the raw measure and the threshold verdict beneath. */
function DimensionCell({ percentile, raw, present }: { percentile: number; raw: number; present: boolean }) {
  return (
    <span className="inline-flex flex-col items-end leading-tight">
      <span className={present ? "font-semibold tabular-nums text-foreground" : "tabular-nums text-muted-foreground"}>
        {pct(percentile)}
      </span>
      <span className="tabular-nums text-[10px] text-muted-foreground">{raw.toFixed(2)}</span>
    </span>
  );
}

function buildColumns(
  t: ReturnType<typeof useTranslation>["t"],
): DataColumn<VrioCapabilityItem>[] {
  return [
    {
      header: t("vrio.cols.capability"),
      cell: (r) => (
        <span className="flex flex-col leading-tight">
          <span className="font-medium text-foreground">{r.skillGroupName}</span>
          <span className="text-[10px] text-muted-foreground">
            {t("vrio.cols.skillCount", { count: r.skillCount })}
          </span>
        </span>
      ),
    },
    {
      header: t("vrio.cols.value"), align: "right",
      cell: (r) => <DimensionCell percentile={r.value} raw={r.evidence.valueRaw} present={r.isValuable} />,
    },
    {
      header: t("vrio.cols.rarity"), align: "right",
      cell: (r) => <DimensionCell percentile={r.rarity} raw={r.evidence.rarityRaw} present={r.isRare} />,
    },
    {
      header: t("vrio.cols.inimitability"), align: "right",
      cell: (r) => <DimensionCell percentile={r.inimitability} raw={r.evidence.inimitabilityRaw} present={r.isInimitable} />,
    },
    {
      header: t("vrio.cols.organization"), align: "right",
      cell: (r) => <DimensionCell percentile={r.organization} raw={r.evidence.organizationRaw} present={r.isOrganized} />,
    },
    {
      header: t("vrio.cols.verdict"),
      // StatusPill comes from @heuresys/ui and does not forward arbitrary props, so the
      // test hook lives on a local wrapper rather than on the shared component.
      cell: (r) => (
        <span data-testid={`vrio-verdict-${r.verdict}`}>
          <StatusPill tone={VERDICT_TONE[r.verdict]}>{t(`vrio.verdicts.${r.verdict}`)}</StatusPill>
        </span>
      ),
    },
    {
      header: t("vrio.cols.evidence"), align: "right",
      cell: (r) => (
        <span className="tabular-nums text-[11px] text-muted-foreground">
          {t("vrio.cols.evidenceValue", {
            positions: r.evidence.positionsRequiring,
            holders: r.evidence.holders,
            headcount: r.evidence.headcount,
            covered: r.evidence.coveredRequirements,
            required: r.evidence.totalRequirements,
          })}
        </span>
      ),
    },
  ];
}

export default function VrioScorecardPage() {
  const { t } = useTranslation("hr");

  const scorecard = useQuery({
    queryKey: ["capability", "vrio"],
    queryFn: () => apiFetch<VrioScorecard>("/v1/capability/composition/vrio"),
  });

  const columns = useMemo(() => buildColumns(t), [t]);
  const data = scorecard.data;

  return (
    <main data-testid="vrio-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="vrio-title"
        title={t("vrio.title")}
        description={
          data
            ? t("vrio.description", {
                headcount: data.headcount,
                value: Math.round(data.weights.value.econ * 100),
                crit: Math.round(data.weights.value.crit * 100),
                threshold: Math.round(data.thresholds.value * 100),
              })
            : t("vrio.descriptionIdle")
        }
        badges={
          data ? (
            <Badge variant="secondary" data-testid="vrio-count">
              {t("vrio.count", { count: data.total })}
            </Badge>
          ) : undefined
        }
      />

      {/* Board summary: how many capabilities land in each class. */}
      {data ? (
        <section data-testid="vrio-summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {VERDICT_ORDER.map((v) => (
            <div
              key={v}
              data-testid={`vrio-summary-${v}`}
              className="rounded-card border border-border bg-card px-4 py-3 shadow-card"
            >
              <div className="text-2xl font-semibold tabular-nums text-foreground">{data.summary[v]}</div>
              <div className="mt-1 text-xs text-muted-foreground">{t(`vrio.verdicts.${v}`)}</div>
            </div>
          ))}
        </section>
      ) : null}

      <EntityTable<VrioCapabilityItem>
        isLoading={scorecard.isLoading}
        isError={scorecard.isError}
        errorMessage={t("vrio.errorMessage")}
        rows={data?.items ?? []}
        rowKey={(r) => r.skillGroupId}
        rowTestId="vrio-row"
        columns={columns}
        emptyTestId="vrio-empty"
        emptyTitle={t("vrio.emptyTitle")}
        emptyDescription={t("vrio.emptyDescription")}
        caption={t("vrio.caption")}
      />

      <p data-testid="vrio-method" className="text-xs text-muted-foreground">
        {t("vrio.method")}
      </p>
    </main>
  );
}
