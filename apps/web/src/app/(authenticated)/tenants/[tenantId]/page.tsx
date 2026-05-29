"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "typing", label: "Enterprise Typing" },
  { key: "users", label: "Utenti" },
];

export default function TenantDetailPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const [tab, setTab] = useState<Tab>("overview");

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
        <span className="text-sm text-muted-foreground">Caricamento…</span>
      </main>
    );
  }
  if (tenant.isError) {
    const status = isApiError(tenant.error) ? tenant.error.status : 0;
    return (
      <main className="mx-auto max-w-5xl px-6 py-8" data-testid="tenant-error">
        <Link href="/tenants" className="text-sm underline">← Tenant</Link>
        <p className="mt-4 text-destructive">
          {status === 404 ? "Tenant non trovato." : "Errore di caricamento."}
        </p>
      </main>
    );
  }
  const t = tenant.data!;
  return (
    <main data-testid="tenant-detail-page" className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="tenant-name"
        title={t.tenantName}
        breadcrumbs={
          <Link
            href="/tenants"
            data-testid="tenant-back"
            className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            ← Tenant
          </Link>
        }
        badges={
          <>
            <span data-testid="tenant-code" className="font-mono text-sm text-muted-foreground">{t.tenantCode}</span>
            <StatusBadge value={t.tenantStatus} />
          </>
        }
      />

      <nav className="flex gap-1 border-b border-border" data-testid="tenant-tabs">
        {TABS.map((tt) => (
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
          <CardHeader><CardTitle>Anagrafica</CardTitle></CardHeader>
          <CardContent>
            <FieldGrid
              fields={[
                { label: "Legal name", value: t.tenantLegalName ?? "—", testId: "tenant-legal-name" },
                { label: "Country", value: t.tenantCountryCode ?? "—" },
                { label: "Industry", value: t.tenantIndustryCode ?? "—" },
                { label: "Size band", value: t.tenantSizeBand ?? "—" },
                { label: "Stato", value: <StatusBadge value={t.tenantStatus} /> },
                { label: "Tenant ID", value: t.tenantId, mono: true },
                { label: "Creato", value: t.createdAt, mono: true },
              ]}
            />
            <p className="mt-4">
              <Link
                href={`/tenants/${t.tenantId}/enterprise-typing`}
                className="text-sm text-foreground underline-offset-2 hover:underline"
                data-testid="tenant-typing-wizard-link"
              >
                Apri wizard Enterprise Typing →
              </Link>
            </p>
          </CardContent>
        </Card>
      )}

      {tab === "typing" && (
        <Card data-testid="tenant-tab-content-typing">
          <CardHeader><CardTitle>Profili Enterprise Typing</CardTitle></CardHeader>
          <CardContent>
            {typing.isLoading ? (
              <span className="text-sm text-muted-foreground">Caricamento…</span>
            ) : typing.data && typing.data.items.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="tenant-typing-empty">
                Nessun profilo di tipizzazione registrato.
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
          <CardHeader><CardTitle>Utenti</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              La lista utenti completa è gestita nella pagina dedicata.{" "}
              <Link
                href="/users"
                className="text-foreground underline underline-offset-2"
                data-testid="tenant-users-link"
              >
                Apri /users →
              </Link>
            </p>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
