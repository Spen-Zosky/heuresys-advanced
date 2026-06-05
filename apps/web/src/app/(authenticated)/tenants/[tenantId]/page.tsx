"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { FieldGrid } from "@/components/detail-panel";
import { StatusBadge } from "@/components/status-pill";

interface Tenant {
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  tenantLegalName: string | null;
  tenantCountryCode: string | null;
  tenantIndustryCode: string | null;
  tenantSizeBand: string | null;
  tenantStatus: string;
  tenantMetadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface EnterpriseProfile {
  enterpriseTypingProfileId: string;
  tenantId: string;
  blueprintFamilyId: string | null;
  blueprintVariantId: string | null;
  activityClassificationId: string | null;
  enterpriseSizeBandId: string | null;
  operatingModelId: string | null;
  status: string;
  decidedAt: string | null;
}

type Tab = "overview" | "typing" | "users";

export default function TenantDetailPage() {
  const { t } = useTranslation("admin");
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const [tab, setTab] = useState<Tab>("overview");

  const tabs = useMemo<{ key: Tab; label: string }[]>(
    () => [
      { key: "overview", label: t("tenants.detail.tabs.overview") },
      { key: "typing", label: t("tenants.detail.tabs.typing") },
      { key: "users", label: t("tenants.detail.tabs.users") },
    ],
    [t],
  );

  const tenant = useQuery({
    queryKey: ["tenants", tenantId],
    queryFn: () => apiFetch<Tenant>(`/v1/tenants/${tenantId}`),
    enabled: !!tenantId,
  });

  const typing = useQuery({
    queryKey: ["enterprise-typing-profiles", tenantId],
    queryFn: () =>
      apiFetch<{ items: EnterpriseProfile[]; total: number }>(
        `/v1/enterprise-typing-profiles?tenantId=${tenantId}&limit=10`,
      ),
    enabled: !!tenantId && tab === "typing",
  });

  if (tenant.isLoading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-8">
        <span className="text-sm text-muted-foreground">{t("common:loading")}</span>
      </main>
    );
  }
  if (tenant.isError) {
    const status = isApiError(tenant.error) ? tenant.error.status : 0;
    return (
      <main className="mx-auto max-w-5xl px-6 py-8" data-testid="tenant-error">
        <Link href="/tenants" className="text-sm underline">{t("tenants.detail.back")}</Link>
        <p className="mt-4 text-destructive">
          {status === 404 ? t("tenants.detail.notFound") : t("tenants.detail.loadError")}
        </p>
      </main>
    );
  }
  const tn = tenant.data!;
  return (
    <main data-testid="tenant-detail-page" className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="tenant-name"
        title={tn.tenantName}
        breadcrumbs={
          <Link
            href="/tenants"
            data-testid="tenant-back"
            className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {t("tenants.detail.back")}
          </Link>
        }
        badges={
          <>
            <span data-testid="tenant-code" className="font-mono text-sm text-muted-foreground">{tn.tenantCode}</span>
            <StatusBadge value={tn.tenantStatus} />
          </>
        }
      />

      <nav className="flex gap-1 border-b border-border" data-testid="tenant-tabs">
        {tabs.map((tt) => (
          <button
            key={tt.key}
            type="button"
            onClick={() => setTab(tt.key)}
            data-testid={`tenant-tab-${tt.key}`}
            className={`px-3 py-2 text-sm transition-colors ${
              tab === tt.key
                ? "border-b-2 border-primary font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tt.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <Card data-testid="tenant-tab-content-overview">
          <CardHeader><CardTitle>{t("tenants.detail.overviewTitle")}</CardTitle></CardHeader>
          <CardContent>
            <FieldGrid
              fields={[
                { label: t("tenants.detail.fields.legalName"), value: tn.tenantLegalName ?? t("tenants.detail.dash"), testId: "tenant-legal-name" },
                { label: t("tenants.detail.fields.country"), value: tn.tenantCountryCode ?? t("tenants.detail.dash") },
                { label: t("tenants.detail.fields.industry"), value: tn.tenantIndustryCode ?? t("tenants.detail.dash") },
                { label: t("tenants.detail.fields.sizeBand"), value: tn.tenantSizeBand ?? t("tenants.detail.dash") },
                { label: t("tenants.detail.fields.status"), value: <StatusBadge value={tn.tenantStatus} /> },
                { label: t("tenants.detail.fields.tenantId"), value: tn.tenantId, mono: true },
                { label: t("tenants.detail.fields.createdAt"), value: tn.createdAt, mono: true },
              ]}
            />
            <p className="mt-4">
              <Link
                href={`/tenants/${tn.tenantId}/enterprise-typing`}
                className="text-sm text-foreground underline-offset-2 hover:underline"
                data-testid="tenant-typing-wizard-link"
              >
                {t("tenants.detail.wizardLink")}
              </Link>
            </p>
          </CardContent>
        </Card>
      )}

      {tab === "typing" && (
        <Card data-testid="tenant-tab-content-typing">
          <CardHeader><CardTitle>{t("tenants.detail.typingTitle")}</CardTitle></CardHeader>
          <CardContent>
            {typing.isLoading ? (
              <span className="text-sm text-muted-foreground">{t("common:loading")}</span>
            ) : typing.data && typing.data.items.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="tenant-typing-empty">
                {t("tenants.detail.typingEmpty")}
              </p>
            ) : (
              <ul className="space-y-2 text-sm" data-testid="tenant-typing-list">
                {(typing.data?.items ?? []).map((p) => (
                  <li
                    key={p.enterpriseTypingProfileId}
                    className="flex items-center gap-3 rounded-card border border-border px-3 py-2"
                    data-testid="tenant-typing-item"
                  >
                    <span className="font-mono text-xs text-foreground">{p.enterpriseTypingProfileId}</span>
                    <StatusBadge value={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "users" && (
        <Card data-testid="tenant-tab-content-users">
          <CardHeader><CardTitle>{t("tenants.detail.usersTitle")}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t("tenants.detail.usersHint")}{" "}
              <Link
                href="/users"
                className="text-foreground underline underline-offset-2"
                data-testid="tenant-users-link"
              >
                {t("tenants.detail.usersLink")}
              </Link>
            </p>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
