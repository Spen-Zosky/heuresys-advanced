"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { PageHeader } from "@/components/intestazione-pagina";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { StatoCaricamento, StatoErrore } from "@/components/stato-pagina";
import { FieldGrid } from "@/components/detail-panel";
import { StatusBadge, StatusPill } from "@/components/status-pill";
import { MaskedCell, isMasked } from "@/components/masked-cell";
import { PositionEditor } from "./_components/position-editor";

interface PositionDetail {
  positionId: string;
  code: string;
  title: string;
  tenantId: string;
  organizationUnitId: string | null;
  jobRoleId: string | null;
  reportsToPositionId: string | null;
  /** S-7: assenti e dichiarati in `masked` a chi non vede le retribuzioni. */
  ownerUserId?: string | null;
  criticality: string | null;
  economicWeight?: string | null;
  isActive: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  masked?: string[];
}

export default function PositionDetailPage() {
  const { t } = useTranslation("admin");
  const params = useParams<{ positionId: string }>();
  const positionId = params.positionId;
  const position = useQuery({
    queryKey: ["positions", positionId],
    queryFn: () => apiFetch<PositionDetail>(`/v1/positions/${positionId}`),
    enabled: !!positionId,
  });

  if (position.isLoading) {
    return (
      <main className="mx-auto max-w-5xl px-6 pb-8">
        <StatoCaricamento />
      </main>
    );
  }
  if (position.isError) {
    const code = isApiError(position.error) ? position.error.status : 0;
    return (
      <main className="mx-auto max-w-5xl px-6 pb-8" data-testid="position-error">
        <Link href="/positions" className="text-sm underline">{t("positions.detail.back")}</Link>
        <div className="mt-4">
          <StatoErrore
            errore={position.error}
            titolo={code === 404 ? t("positions.detail.notFound") : t("positions.detail.loadError")}
            testId="position-error-state"
            onRiprova={() => void position.refetch()}
          />
        </div>
      </main>
    );
  }
  const p = position.data!;
  return (
    <main data-testid="position-detail-page" className="mx-auto max-w-5xl space-y-6 px-6 pb-8">
      <PageHeader
        data-testid="position-title"
        title={p.title}
        breadcrumbs={
          <Link href="/positions" data-testid="position-back" className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            {t("positions.detail.back")}
          </Link>
        }
        badges={
          <>
            <span data-testid="position-code" className="font-mono text-sm text-muted-foreground">{p.code}</span>
            <StatusBadge value={p.criticality} />
            <StatusPill tone={p.isActive ? "success" : "neutral"}>{p.isActive ? t("positions.detail.activeOn") : t("positions.detail.activeOff")}</StatusPill>
          </>
        }
      />

      {/* Le tre sotto-pagine della posizione: senza questi collegamenti non le raggiungeva nessuno (consolidamento C13, R-33). */}
      <nav data-testid="position-subpages" className="flex flex-wrap gap-4 text-sm">
        {(["skills", "kpis", "learning"] as const).map((k) => (
          <Link key={k} href={`/positions/${positionId}/${k}`} data-testid={`position-subpage-${k}`} className="underline-offset-2 hover:underline">
            {t(`positions.${k}.title`)}
          </Link>
        ))}
      </nav>

      <Card>
        <CardHeader><CardTitle>{t("positions.detail.cardTitle")}</CardTitle></CardHeader>
        <CardContent>
          <FieldGrid
            testId="position-fields"
            fields={[
              { label: t("positions.detail.fields.positionId"), value: p.positionId, mono: true },
              { label: t("positions.detail.fields.tenantId"), value: p.tenantId, mono: true },
              { label: t("positions.detail.fields.orgUnit"), value: p.organizationUnitId ?? t("positions.detail.dash"), mono: true },
              { label: t("positions.detail.fields.jobRole"), value: p.jobRoleId ?? t("positions.detail.dash"), mono: true },
              { label: t("positions.detail.fields.owner"), value: isMasked(p, "ownerUserId") ? <MaskedCell /> : (p.ownerUserId ?? t("positions.detail.dash")), mono: true },
              { label: t("positions.detail.fields.reportsTo"), value: p.reportsToPositionId ?? t("positions.detail.dash"), mono: true },
              { label: t("positions.detail.fields.criticality"), value: <StatusBadge value={p.criticality} /> },
              { label: t("positions.detail.fields.economicWeight"), value: isMasked(p, "economicWeight") ? <MaskedCell /> : (p.economicWeight ?? t("positions.detail.dash")) },
              { label: t("positions.detail.fields.effectiveFrom"), value: p.effectiveFrom ?? t("positions.detail.dash") },
              { label: t("positions.detail.fields.effectiveTo"), value: p.effectiveTo ?? t("positions.detail.dash") },
            ]}
          />
        </CardContent>
      </Card>

      {/* Sopra si LEGGE la posizione, qui la si RIDISEGNA: legami scelti per
          nome da elenchi veri, non incollando identificativi (#44). */}
      <PositionEditor positionId={positionId} />
    </main>
  );
}
