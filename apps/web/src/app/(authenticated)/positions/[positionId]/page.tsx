"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
      <main className="mx-auto max-w-5xl px-6 py-8">
        <span className="text-sm text-muted-foreground">{t("common:loading")}</span>
      </main>
    );
  }
  if (position.isError) {
    const code = isApiError(position.error) ? position.error.status : 0;
    return (
      <main className="mx-auto max-w-5xl px-6 py-8" data-testid="position-error">
        <Link href="/positions" className="text-sm underline">{t("positions.detail.back")}</Link>
        <p className="mt-4 text-danger">{code === 404 ? t("positions.detail.notFound") : t("positions.detail.loadError")}</p>
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
              { label: t("positions.detail.fields.owner"), value: p.ownerUserId ?? t("positions.detail.dash"), mono: true },
              { label: t("positions.detail.fields.reportsTo"), value: p.reportsToPositionId ?? t("positions.detail.dash"), mono: true },
              { label: t("positions.detail.fields.criticality"), value: <StatusBadge value={p.criticality} /> },
              { label: t("positions.detail.fields.economicWeight"), value: p.economicWeight ?? t("positions.detail.dash") },
              { label: t("positions.detail.fields.effectiveFrom"), value: p.effectiveFrom ?? t("positions.detail.dash") },
              { label: t("positions.detail.fields.effectiveTo"), value: p.effectiveTo ?? t("positions.detail.dash") },
            ]}
          />
        </CardContent>
      </Card>
    </main>
  );
}
