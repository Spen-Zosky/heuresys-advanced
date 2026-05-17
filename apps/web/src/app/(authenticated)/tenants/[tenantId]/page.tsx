"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../../lib/api/fetch";
import { isApiError } from "../../../../lib/api/errors";

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
    return <main className="max-w-5xl mx-auto px-6 py-8 opacity-60">Caricamento…</main>;
  }
  if (tenant.isError) {
    const status = isApiError(tenant.error) ? tenant.error.status : 0;
    return (
      <main className="max-w-5xl mx-auto px-6 py-8" data-testid="tenant-error">
        <Link href="/tenants" className="underline text-sm">← Tenant</Link>
        <p className="text-red-600 mt-4">
          {status === 404 ? "Tenant non trovato." : "Errore di caricamento."}
        </p>
      </main>
    );
  }
  const t = tenant.data!;
  return (
    <main data-testid="tenant-detail-page" className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <header>
        <Link href="/tenants" className="underline text-sm" data-testid="tenant-back">← Tenant</Link>
        <h1 className="text-2xl font-semibold mt-2" data-testid="tenant-name">{t.tenantName}</h1>
        <p className="text-sm opacity-70 font-mono" data-testid="tenant-code">{t.tenantCode}</p>
      </header>

      <nav className="border-b flex gap-4 text-sm" data-testid="tenant-tabs">
        {(["overview", "typing", "users"] as Tab[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            data-testid={`tenant-tab-${k}`}
            className={`px-3 py-2 ${tab === k ? "border-b-2 border-black font-medium" : "opacity-60"}`}
          >
            {k === "overview" ? "Overview" : k === "typing" ? "Enterprise Typing" : "Utenti"}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <Card data-testid="tenant-tab-content-overview">
          <CardHeader><CardTitle>Anagrafica</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <dt className="opacity-70">Legal name</dt>
              <dd data-testid="tenant-legal-name">{t.tenantLegalName ?? "—"}</dd>
              <dt className="opacity-70">Country</dt>
              <dd>{t.tenantCountryCode ?? "—"}</dd>
              <dt className="opacity-70">Industry</dt>
              <dd>{t.tenantIndustryCode ?? "—"}</dd>
              <dt className="opacity-70">Size band</dt>
              <dd>{t.tenantSizeBand ?? "—"}</dd>
              <dt className="opacity-70">Stato</dt>
              <dd>{t.tenantStatus}</dd>
              <dt className="opacity-70">Tenant ID</dt>
              <dd className="font-mono text-xs">{t.tenantId}</dd>
              <dt className="opacity-70">Creato</dt>
              <dd className="text-xs">{t.createdAt}</dd>
            </dl>
            <p className="mt-4">
              <Link
                href={`/tenants/${t.tenantId}/enterprise-typing`}
                className="underline text-sm"
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
              <span className="opacity-60">Caricamento…</span>
            ) : typing.data && typing.data.items.length === 0 ? (
              <p className="opacity-60" data-testid="tenant-typing-empty">
                Nessun profilo di tipizzazione registrato.
              </p>
            ) : (
              <ul className="space-y-2 text-sm" data-testid="tenant-typing-list">
                {typing.data!.items.map((p) => (
                  <li
                    key={p.enterpriseTypingProfileId}
                    className="border rounded px-3 py-2"
                    data-testid="tenant-typing-item"
                  >
                    <span className="font-mono text-xs">{p.enterpriseTypingProfileId}</span>
                    <span className="ml-3 uppercase text-xs opacity-70">{p.status}</span>
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
            <p className="text-sm opacity-70">
              La lista utenti completa è gestita nella pagina dedicata.{" "}
              <Link href="/users" className="underline" data-testid="tenant-users-link">
                Apri /users →
              </Link>
            </p>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
