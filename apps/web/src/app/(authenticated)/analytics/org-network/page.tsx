"use client";

/**
 * /analytics/org-network — «Rete organizzativa».
 *
 * Piano docs/piani/PIANO_organigrammi-navigazione_20261115.md (N7). Enzo, 15/11/2026: i numeri
 * sembravano casuali e i grafici non dicevano che cosa spiegano. I numeri erano sbagliati davvero:
 * l'API contava anche le posizioni disattivate (316 invece di 162 su RTL). Ora contano solo le
 * attive, e ogni grafico ha un titolo che è una domanda in italiano, una nota che dice come si
 * legge, e per ogni barra il titolare «Cognome, Nome» accanto al titolo della posizione.
 */
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge } from "@heuresys/ui";
import { PageHeader } from "@/components/intestazione-pagina";
import { StatsCard } from "@/components/indicatori-leggibili";
import { GitBranch, Layers, Network, Sigma, UserX, Users } from "lucide-react";
import { EChartsCard } from "../../_charts-client";
import type {
  OrgNetworkAnalyticsResponse,
  OrgNetworkDepthRow,
  OrgNetworkReachRow,
  OrgNetworkSpanRow,
} from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { StatoCaricamento, StatoErrore, StatoVuoto } from "@/components/stato-pagina";

/** I token del tema sono colori completi: `_charts-client` li risolve per il canvas di ECharts. */
const COLOR_PALETTE_1 = "var(--palette-1)";
const COLOR_PALETTE_2 = "var(--palette-2)";
const COLOR_PALETTE_3 = "var(--palette-3)";
const AXIS_COLOR = "var(--muted-foreground)";
const GRID_COLOR = "var(--border)";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]!);

/** Barre verticali: livello (0 = vertice) → numero di posizioni. */
function depthBarOption(rows: OrgNetworkDepthRow[], seriesName: string, etichetta: (d: number) => string) {
  return {
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    tooltip: { trigger: "axis" as const, axisPointer: { type: "shadow" as const } },
    xAxis: {
      type: "category" as const,
      data: rows.map((r) => etichetta(r.depth)),
      axisLabel: { color: AXIS_COLOR },
      axisLine: { lineStyle: { color: GRID_COLOR } },
    },
    yAxis: {
      type: "value" as const,
      minInterval: 1,
      axisLabel: { color: AXIS_COLOR },
      splitLine: { lineStyle: { color: GRID_COLOR } },
    },
    series: [
      {
        name: seriesName,
        type: "bar" as const,
        data: rows.map((r) => r.positionCount),
        label: { show: true, position: "top" as const, color: AXIS_COLOR },
        itemStyle: { color: COLOR_PALETTE_1, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 48,
      },
    ],
  };
}

type RigaBarra = { positionTitle: string; orgUnit: string; holder: string | null; valore: number };

/** Barre orizzontali: «posizione — titolare» → valore, la più grande in cima. */
function barreOption(rows: RigaBarra[], seriesName: string, colore: string, scoperta: string, unita: string) {
  const ordinate = [...rows].sort((a, b) => a.valore - b.valore);
  const nome = (r: RigaBarra) => `${r.positionTitle} — ${r.holder ?? scoperta}`;
  return {
    grid: { left: 8, right: 32, top: 12, bottom: 8, containLabel: true },
    tooltip: {
      trigger: "item" as const,
      formatter: (p: unknown) => {
        const r = ordinate[(p as { dataIndex: number }).dataIndex]!;
        return `<b>${esc(r.positionTitle)}</b><br/>${esc(r.holder ?? scoperta)}<br/>${esc(unita)}: ${esc(r.orgUnit)}<br/>${esc(seriesName)}: <b>${r.valore}</b>`;
      },
    },
    xAxis: {
      type: "value" as const,
      minInterval: 1,
      axisLabel: { color: AXIS_COLOR },
      splitLine: { lineStyle: { color: GRID_COLOR } },
    },
    yAxis: {
      type: "category" as const,
      data: ordinate.map(nome),
      axisLabel: { color: AXIS_COLOR, width: 300, overflow: "truncate" as const },
      axisLine: { lineStyle: { color: GRID_COLOR } },
    },
    series: [
      {
        name: seriesName,
        type: "bar" as const,
        data: ordinate.map((r) => r.valore),
        label: { show: true, position: "right" as const, color: AXIS_COLOR },
        itemStyle: { color: colore, borderRadius: [0, 4, 4, 0] },
        barMaxWidth: 22,
      },
    ],
  };
}

const daSpan = (r: OrgNetworkSpanRow): RigaBarra => ({ positionTitle: r.positionTitle, orgUnit: r.orgUnit, holder: r.holder, valore: r.directReports });
const daReach = (r: OrgNetworkReachRow): RigaBarra => ({ positionTitle: r.positionTitle, orgUnit: r.orgUnit, holder: r.holder, valore: r.reach });

export default function OrgNetworkAnalyticsPage() {
  const { t } = useTranslation("analytics");
  const q = useQuery({
    queryKey: ["analytics", "org-network"],
    queryFn: () => apiFetch<OrgNetworkAnalyticsResponse>("/v1/analytics/org-network"),
  });

  if (q.isLoading) {
    return (
      <main className="mx-auto max-w-7xl px-6 pb-8">
        <StatoCaricamento testId="analytics-org-network-loading" />
      </main>
    );
  }
  if (q.isError) {
    return (
      <main className="mx-auto max-w-7xl px-6 pb-8">
        <StatoErrore errore={q.error} titolo={t("error")} testId="analytics-org-network-error" onRiprova={() => void q.refetch()} />
      </main>
    );
  }

  const d = q.data!;
  const hasData = d.totalPositions > 0;
  const livello = (n: number) => (n === 0 ? t("orgNetwork.depthTop") : t("orgNetwork.depthLevel", { n }));
  const scoperta = t("orgNetwork.vacant");

  return (
    <main data-testid="analytics-org-network-page" className="mx-auto max-w-7xl space-y-8 px-6 pb-8">
      <PageHeader
        data-testid="analytics-org-network-title"
        title={t("orgNetwork.title")}
        description={t("orgNetwork.description")}
        badges={
          <Badge variant="secondary" data-testid="analytics-org-network-scope">
            {t("scope", { kind: d.scope.kind })}
          </Badge>
        }
      />
      <p className="text-sm text-muted-foreground" data-testid="analytics-org-network-guida">{t("orgNetwork.guida")}</p>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div data-testid="org-network-total-positions">
          <StatsCard
            label={t("orgNetwork.stats.positionsLabel")}
            value={d.totalPositions}
            icon={<Network className="h-4 w-4 text-palette-1" />}
            description={t("orgNetwork.stats.positionsDesc")}
          />
        </div>
        <div data-testid="org-network-vacant-positions">
          <StatsCard
            label={t("orgNetwork.stats.vacantLabel")}
            value={d.vacantPositions}
            icon={<UserX className="h-4 w-4 text-palette-3" />}
            description={t("orgNetwork.stats.vacantDesc")}
          />
        </div>
        <StatsCard
          label={t("orgNetwork.stats.rootsLabel")}
          value={d.rootPositions}
          icon={<GitBranch className="h-4 w-4 text-palette-2" />}
          description={t("orgNetwork.stats.rootsDesc")}
        />
        <StatsCard
          label={t("orgNetwork.stats.managersLabel")}
          value={d.managersCount}
          icon={<Users className="h-4 w-4 text-palette-3" />}
          description={t("orgNetwork.stats.managersDesc")}
        />
        <StatsCard
          label={t("orgNetwork.stats.spanLabel")}
          value={d.avgSpanOfControl ?? 0}
          icon={<Sigma className="h-4 w-4 text-palette-1" />}
          description={t("orgNetwork.stats.spanDesc")}
        />
        <StatsCard
          label={t("orgNetwork.stats.depthLabel")}
          value={d.maxDepth}
          icon={<Layers className="h-4 w-4 text-palette-2" />}
          description={t("orgNetwork.stats.depthDesc")}
        />
      </section>

      {hasData ? (
        <section className="space-y-8">
          <div className="space-y-2">
            <h2 className="text-base font-semibold tracking-tight text-foreground">{t("orgNetwork.depthTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("orgNetwork.depthNote", { totale: d.totalPositions })}</p>
            <div data-testid="analytics-org-network-depth-chart" className="rounded-card border border-border bg-card p-4">
              <EChartsCard
                option={depthBarOption(d.byDepth, t("orgNetwork.stats.positionsLabel"), livello)}
                height={320}
                ariaLabel={t("orgNetwork.depthAria")}
              />
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-2">
              <h2 className="text-base font-semibold tracking-tight text-foreground">{t("orgNetwork.spanTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("orgNetwork.spanNote")}</p>
              {d.topSpan.length > 0 ? (
                <div data-testid="analytics-org-network-span-chart" className="rounded-card border border-border bg-card p-4">
                  <EChartsCard
                    option={barreOption(d.topSpan.map(daSpan), t("orgNetwork.seriesDirectReports"), COLOR_PALETTE_2, scoperta, t("orgNetwork.unit"))}
                    height={Math.max(280, d.topSpan.length * 28)}
                    ariaLabel={t("orgNetwork.spanAria")}
                  />
                </div>
              ) : (
                <StatoVuoto
                  testId="analytics-org-network-span-empty"
                  icona={<Users className="h-6 w-6" />}
                  titolo={t("orgNetwork.spanEmptyTitle")}
                  motivo={t("orgNetwork.spanEmptyDesc")}
                />
              )}
            </div>

            <div className="space-y-2">
              <h2 className="text-base font-semibold tracking-tight text-foreground">{t("orgNetwork.reachTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("orgNetwork.reachNote", { n: Math.max(0, d.totalPositions - d.rootPositions) })}</p>
              {d.topReach.length > 0 ? (
                <div data-testid="analytics-org-network-reach-chart" className="rounded-card border border-border bg-card p-4">
                  <EChartsCard
                    option={barreOption(d.topReach.map(daReach), t("orgNetwork.seriesReach"), COLOR_PALETTE_3, scoperta, t("orgNetwork.unit"))}
                    height={Math.max(280, d.topReach.length * 28)}
                    ariaLabel={t("orgNetwork.reachAria")}
                  />
                </div>
              ) : (
                <StatoVuoto
                  testId="analytics-org-network-reach-empty"
                  icona={<Network className="h-6 w-6" />}
                  titolo={t("orgNetwork.spanEmptyTitle")}
                  motivo={t("orgNetwork.spanEmptyDesc")}
                />
              )}
            </div>
          </div>
        </section>
      ) : (
        <StatoVuoto
          testId="analytics-org-network-empty"
          icona={<Network className="h-6 w-6" />}
          titolo={t("empty.title")}
          motivo={t("orgNetwork.emptyDesc")}
        />
      )}
    </main>
  );
}
