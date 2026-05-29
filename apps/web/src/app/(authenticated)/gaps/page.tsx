"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge, DataTableWithCrossHair, EmptyState, KPIStrip, PageHeader, type KpiCardData } from "@heuresys/ui";
import { Inbox } from "lucide-react";
import { apiFetch } from "@/lib/api/fetch";
import { StatusBadge } from "@/components/status-pill";

interface LearningGap {
  learningGapId: string;
  userId: string;
  positionId: string | null;
  skillId: string | null;
  severity: string;
  requiredProficiency: string | null;
  currentProficiency: string | null;
  detectedAt: string;
}

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
const SEV_TONE: Record<(typeof SEVERITIES)[number], KpiCardData["iconTone"]> = {
  CRITICAL: "danger",
  HIGH: "warning",
  MEDIUM: "palette-4",
  LOW: "info",
};

export default function AdminGapsPage() {
  const gaps = useQuery({
    queryKey: ["learning-gaps", "all"],
    queryFn: () => apiFetch<{ items: LearningGap[]; total: number }>("/v1/learning-gaps?limit=200"),
  });

  const items = gaps.data?.items ?? [];
  const bySev = items.reduce<Record<string, number>>((acc, g) => {
    acc[g.severity] = (acc[g.severity] ?? 0) + 1;
    return acc;
  }, {});

  const sevItems: KpiCardData[] = SEVERITIES.map((s) => ({
    label: s,
    value: <span data-testid={`gaps-severity-${s}`}>{bySev[s] ?? 0}</span>,
    iconTone: SEV_TONE[s],
  }));

  return (
    <main data-testid="gaps-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="gaps-title"
        title="Gap analysis"
        description="Gap di competenza per severità, sull'intero tenant."
        badges={
          <Badge variant="secondary" data-testid="gaps-count">
            {gaps.data ? `${gaps.data.total} gap registrati` : "…"}
          </Badge>
        }
      />

      <section data-testid="gaps-summary">
        <KPIStrip items={sevItems} />
      </section>

      {gaps.isLoading ? (
        <div className="rounded-card border border-border bg-card p-6 text-sm text-muted-foreground">Caricamento…</div>
      ) : gaps.isError ? (
        <div className="rounded-card border border-border bg-card p-6 text-sm text-destructive" data-testid="gaps-error">
          Impossibile caricare i gap.
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          data-testid="gaps-empty"
          icon={<Inbox className="h-6 w-6" />}
          title="Nessun gap registrato"
          description="Non ci sono gap di competenza al momento."
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
          <DataTableWithCrossHair caption="Elenco gap" className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2">User</th>
                <th className="px-4 py-2">Posizione</th>
                <th className="px-4 py-2">Skill</th>
                <th className="px-4 py-2">Severità</th>
                <th className="px-4 py-2">Richiesto</th>
                <th className="px-4 py-2">Attuale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((g) => (
                <tr key={g.learningGapId} data-testid="gaps-row" className="transition-colors hover:bg-muted/60">
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{g.userId.slice(0, 8)}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{g.positionId?.slice(0, 8) ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{g.skillId?.slice(0, 8) ?? "—"}</td>
                  <td className="px-4 py-2"><StatusBadge value={g.severity} /></td>
                  <td className="px-4 py-2 text-xs">{g.requiredProficiency ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">{g.currentProficiency ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </DataTableWithCrossHair>
        </div>
      )}
    </main>
  );
}
