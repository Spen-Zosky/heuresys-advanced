"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge, DataTableWithCrossHair, EmptyState, KPIStrip, PageHeader, type KpiCardData } from "@heuresys/ui";
import { Inbox } from "lucide-react";
import { apiFetch } from "@/lib/api/fetch";
import { StatusBadge, StatusPill } from "@/components/status-pill";

interface RewardGate {
  rewardGateId: string;
  userId: string | null;
  positionId: string | null;
  catalogCode: string;
  catalogName: string;
  isBlocking: boolean;
  periodStart: string;
  periodEnd: string;
  latestResult: {
    status: string;
    score: string | null;
    recordedAt: string;
  } | null;
}

const STATUSES = ["PASSED", "WARNING", "BLOCKED", "ESCALATED", "OVERRIDDEN_WITH_REASON", "PENDING"] as const;
const STATUS_TONE: Record<(typeof STATUSES)[number], KpiCardData["iconTone"]> = {
  PASSED: "success",
  WARNING: "warning",
  BLOCKED: "danger",
  ESCALATED: "danger",
  OVERRIDDEN_WITH_REASON: "palette-3",
  PENDING: "info",
};

export default function CompensationIntelligencePage() {
  const gates = useQuery({
    queryKey: ["compensation", "reward-gates"],
    queryFn: () => apiFetch<{ items: RewardGate[]; total: number }>("/v1/compensation/reward-gates?limit=200"),
  });

  const items = gates.data?.items ?? [];
  const counts = items.reduce<Record<string, number>>((acc, g) => {
    const k = g.latestResult?.status ?? "PENDING";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  const statusItems: KpiCardData[] = STATUSES.map((s) => ({
    label: s.replace(/_/g, " "),
    value: <span data-testid={`compensation-status-${s}`}>{counts[s] ?? 0}</span>,
    iconTone: STATUS_TONE[s],
  }));

  return (
    <main data-testid="compensation-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="compensation-title"
        title="Compensation intelligence"
        description="Reward gate per stato di valutazione, sull'intero tenant."
        badges={
          <Badge variant="secondary" data-testid="compensation-count">
            {gates.data ? `${gates.data.total} reward gate registrati` : "…"}
          </Badge>
        }
      />

      <section data-testid="compensation-summary">
        <KPIStrip items={statusItems} />
      </section>

      {gates.isLoading ? (
        <div className="rounded-card border border-border bg-card p-6 text-sm text-muted-foreground">Caricamento…</div>
      ) : gates.isError ? (
        <div className="rounded-card border border-border bg-card p-6 text-sm text-destructive" data-testid="compensation-error">
          Accesso negato o errore.
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          data-testid="compensation-empty"
          icon={<Inbox className="h-6 w-6" />}
          title="Nessun reward gate"
          description="Non ci sono reward gate registrati."
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
          <DataTableWithCrossHair caption="Reward gate" className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2">User</th>
                <th className="px-4 py-2">Gate</th>
                <th className="px-4 py-2">Periodo</th>
                <th className="px-4 py-2">Blocking</th>
                <th className="px-4 py-2">Stato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((g) => (
                <tr key={g.rewardGateId} data-testid="compensation-row" className="transition-colors hover:bg-muted/60">
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{g.userId?.slice(0, 8) ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span className="font-mono text-xs">{g.catalogCode}</span>
                    <span className="block text-xs text-muted-foreground">{g.catalogName}</span>
                  </td>
                  <td className="px-4 py-2 text-xs">{g.periodStart} → {g.periodEnd}</td>
                  <td className="px-4 py-2"><StatusPill tone={g.isBlocking ? "warning" : "neutral"}>{g.isBlocking ? "Sì" : "No"}</StatusPill></td>
                  <td className="px-4 py-2"><StatusBadge value={g.latestResult?.status ?? "PENDING"} /></td>
                </tr>
              ))}
            </tbody>
          </DataTableWithCrossHair>
        </div>
      )}
    </main>
  );
}
