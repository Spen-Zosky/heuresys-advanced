"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../../lib/api/fetch";
import { isApiError } from "../../../../lib/api/errors";

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
      <main className="max-w-5xl mx-auto px-6 py-8">
        <span className="opacity-60">Caricamento…</span>
      </main>
    );
  }
  if (position.isError) {
    const code = isApiError(position.error) ? position.error.status : 0;
    return (
      <main className="max-w-5xl mx-auto px-6 py-8" data-testid="position-error">
        <Link href="/positions" className="underline text-sm">← Posizioni</Link>
        <p className="text-red-600 mt-4">
          {code === 404 ? "Posizione non trovata." : "Errore di caricamento."}
        </p>
      </main>
    );
  }
  const p = position.data!;
  return (
    <main data-testid="position-detail-page" className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <header>
        <Link href="/positions" className="underline text-sm" data-testid="position-back">← Posizioni</Link>
        <h1 className="text-2xl font-semibold mt-2" data-testid="position-title">{p.title}</h1>
        <p className="text-sm opacity-70 font-mono" data-testid="position-code">{p.code}</p>
      </header>

      <Card>
        <CardHeader><CardTitle>Position Intelligence Profile</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm" data-testid="position-fields">
            <dt className="opacity-70">Position ID</dt>
            <dd className="font-mono text-xs">{p.positionId}</dd>
            <dt className="opacity-70">Tenant ID</dt>
            <dd className="font-mono text-xs">{p.tenantId}</dd>
            <dt className="opacity-70">Org Unit</dt>
            <dd className="font-mono text-xs">{p.organizationUnitId ?? "—"}</dd>
            <dt className="opacity-70">Job Role</dt>
            <dd className="font-mono text-xs">{p.jobRoleId ?? "—"}</dd>
            <dt className="opacity-70">Owner</dt>
            <dd className="font-mono text-xs">{p.ownerUserId ?? "—"}</dd>
            <dt className="opacity-70">Riferisce a</dt>
            <dd className="font-mono text-xs">{p.reportsToPositionId ?? "—"}</dd>
            <dt className="opacity-70">Criticità</dt>
            <dd>{p.criticality ?? "—"}</dd>
            <dt className="opacity-70">Peso economico</dt>
            <dd>{p.economicWeight ?? "—"}</dd>
            <dt className="opacity-70">Attiva</dt>
            <dd>{p.isActive ? "sì" : "no"}</dd>
            <dt className="opacity-70">In vigore dal</dt>
            <dd>{p.effectiveFrom ?? "—"}</dd>
          </dl>
        </CardContent>
      </Card>
    </main>
  );
}
