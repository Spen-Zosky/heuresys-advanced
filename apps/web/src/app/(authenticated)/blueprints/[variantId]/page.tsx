"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { EntityTable } from "@/components/data-table-panel";
import { StatusBadge, StatusPill } from "@/components/status-pill";

interface BlueprintVariant {
  blueprintVariantId: string;
  familyId: string;
  code: string;
  name: string;
  description: string | null;
}
interface BlueprintProcess {
  blueprintProcessId: string;
  code: string;
  name: string;
  ordinal: number;
  isOptional: boolean;
}
interface BlueprintActivation {
  blueprintActivationId: string;
  tenantId: string;
  variantId: string;
  status: string;
  activatedAt: string | null;
}

type Tab = "processes" | "activations";

const TABS: { key: Tab; label: string }[] = [
  { key: "processes", label: "Processi" },
  { key: "activations", label: "Attivazioni" },
];

export default function BlueprintVariantDetailPage() {
  const params = useParams<{ variantId: string }>();
  const variantId = params.variantId;
  const [tab, setTab] = useState<Tab>("processes");

  const variant = useQuery({
    queryKey: ["blueprint-variants", variantId],
    queryFn: () => apiFetch<BlueprintVariant>(`/v1/blueprint-variants/${variantId}`),
    enabled: !!variantId,
  });
  const processes = useQuery({
    queryKey: ["blueprint-processes", variantId],
    queryFn: () =>
      apiFetch<{ items: BlueprintProcess[]; total: number }>(
        `/v1/blueprint-processes?variantId=${variantId}&limit=200`,
      ),
    enabled: !!variantId && tab === "processes",
  });
  const activations = useQuery({
    queryKey: ["blueprint-activations", variantId],
    queryFn: () =>
      apiFetch<{ items: BlueprintActivation[]; total: number }>(
        `/v1/blueprint-activations?variantId=${variantId}&limit=200`,
      ),
    enabled: !!variantId && tab === "activations",
  });

  if (variant.isLoading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-8">
        <span className="text-sm text-muted-foreground">Caricamento…</span>
      </main>
    );
  }
  if (variant.isError) {
    const status = isApiError(variant.error) ? variant.error.status : 0;
    return (
      <main className="mx-auto max-w-5xl px-6 py-8" data-testid="blueprint-error">
        <Link href="/blueprints" className="text-sm underline">← Blueprint</Link>
        <p className="mt-4 text-destructive">
          {status === 404 ? "Variante non trovata." : "Errore."}
        </p>
      </main>
    );
  }
  const v = variant.data!;
  return (
    <main data-testid="blueprint-detail-page" className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="blueprint-name"
        title={v.name}
        breadcrumbs={
          <Link
            href="/blueprints"
            data-testid="blueprint-back"
            className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            ← Blueprint
          </Link>
        }
        badges={
          <span data-testid="blueprint-code" className="font-mono text-sm text-muted-foreground">{v.code}</span>
        }
      />

      <nav className="flex gap-1 border-b border-border" data-testid="blueprint-tabs">
        {TABS.map((tt) => (
          <button
            key={tt.key}
            type="button"
            onClick={() => setTab(tt.key)}
            data-testid={`blueprint-tab-${tt.key}`}
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

      {tab === "processes" && (
        <Card data-testid="blueprint-tab-content-processes">
          <CardHeader><CardTitle>Processi</CardTitle></CardHeader>
          <CardContent className="p-0">
            <EntityTable<BlueprintProcess>
              isLoading={processes.isLoading}
              isError={processes.isError}
              rows={processes.data?.items ?? []}
              rowKey={(p) => p.blueprintProcessId}
              rowTestId="blueprint-process-row"
              emptyTestId="blueprint-processes-empty"
              emptyTitle="Nessun processo."
              caption="Processi della variante blueprint"
              columns={[
                { header: "#", cell: (p) => <span className="text-xs text-muted-foreground">{p.ordinal}</span> },
                { header: "Codice", cell: (p) => <span className="font-mono text-xs">{p.code}</span> },
                { header: "Nome", cell: (p) => p.name },
                {
                  header: "Opzionale",
                  cell: (p) => (
                    <StatusPill tone={p.isOptional ? "info" : "neutral"}>
                      {p.isOptional ? "sì" : "no"}
                    </StatusPill>
                  ),
                },
              ]}
            />
          </CardContent>
        </Card>
      )}

      {tab === "activations" && (
        <Card data-testid="blueprint-tab-content-activations">
          <CardHeader><CardTitle>Attivazioni per tenant</CardTitle></CardHeader>
          <CardContent className="p-0">
            <EntityTable<BlueprintActivation>
              isLoading={activations.isLoading}
              isError={activations.isError}
              rows={activations.data?.items ?? []}
              rowKey={(a) => a.blueprintActivationId}
              rowTestId="blueprint-activation-row"
              emptyTestId="blueprint-activations-empty"
              emptyTitle="Nessuna attivazione."
              caption="Attivazioni della variante per tenant"
              columns={[
                { header: "Tenant ID", cell: (a) => <span className="font-mono text-xs">{a.tenantId.slice(0, 8)}</span> },
                { header: "Stato", cell: (a) => <StatusBadge value={a.status} /> },
                { header: "Attivata", cell: (a) => <span className="text-xs">{a.activatedAt ?? "—"}</span> },
              ]}
            />
          </CardContent>
        </Card>
      )}
    </main>
  );
}
