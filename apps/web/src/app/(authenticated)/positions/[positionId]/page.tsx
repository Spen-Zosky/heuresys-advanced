"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { FieldGrid } from "@/components/detail-panel";
import { StatusBadge, StatusPill } from "@/components/status-pill";

interface PositionDetail {
  positionId: string;
  code: string;
  title: string;
  tenantId: string;
  organizationUnitId: string | null;
  jobRoleId: string | null;
  reportsToPositionId: string | null;
  ownerUserId: string | null;
  criticality: string | null;
  economicWeight: string | null;
  isActive: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export default function PositionDetailPage() {
  const params = useParams<{ positionId: string }>();
  const positionId = params.positionId;
  const position = useQuery({
    queryKey: ["positions", positionId],
    queryFn: () => apiFetch<PositionDetail>(`/v1/positions/${positionId}`),
    enabled: !!positionId,
  });

  if (position.isLoading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-8">
        <span className="text-sm text-muted-foreground">Caricamento…</span>
      </main>
    );
  }
  if (position.isError) {
    const code = isApiError(position.error) ? position.error.status : 0;
    return (
      <main className="mx-auto max-w-5xl px-6 py-8" data-testid="position-error">
        <Link href="/positions" className="text-sm underline">← Posizioni</Link>
        <p className="mt-4 text-destructive">{code === 404 ? "Posizione non trovata." : "Errore di caricamento."}</p>
      </main>
    );
  }
  const p = position.data!;
  return (
    <main data-testid="position-detail-page" className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="position-title"
        title={p.title}
        breadcrumbs={
          <Link href="/positions" data-testid="position-back" className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            ← Posizioni
          </Link>
        }
        badges={
          <>
            <span data-testid="position-code" className="font-mono text-sm text-muted-foreground">{p.code}</span>
            <StatusBadge value={p.criticality} />
            <StatusPill tone={p.isActive ? "success" : "neutral"}>{p.isActive ? "Attiva" : "Inattiva"}</StatusPill>
          </>
        }
      />

      <Card>
        <CardHeader><CardTitle>Position Intelligence Profile</CardTitle></CardHeader>
        <CardContent>
          <FieldGrid
            testId="position-fields"
            fields={[
              { label: "Position ID", value: p.positionId, mono: true },
              { label: "Tenant ID", value: p.tenantId, mono: true },
              { label: "Org Unit", value: p.organizationUnitId ?? "—", mono: true },
              { label: "Job Role", value: p.jobRoleId ?? "—", mono: true },
              { label: "Owner", value: p.ownerUserId ?? "—", mono: true },
              { label: "Riferisce a", value: p.reportsToPositionId ?? "—", mono: true },
              { label: "Criticità", value: <StatusBadge value={p.criticality} /> },
              { label: "Peso economico", value: p.economicWeight ?? "—" },
              { label: "In vigore dal", value: p.effectiveFrom ?? "—" },
              { label: "In vigore al", value: p.effectiveTo ?? "—" },
            ]}
          />
        </CardContent>
      </Card>
    </main>
  );
}
