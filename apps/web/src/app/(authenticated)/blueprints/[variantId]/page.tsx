"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../../lib/api/fetch";
import { isApiError } from "../../../../lib/api/errors";

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
    return <main className="max-w-5xl mx-auto px-6 py-8 opacity-60">Caricamento…</main>;
  }
  if (variant.isError) {
    const status = isApiError(variant.error) ? variant.error.status : 0;
    return (
      <main className="max-w-5xl mx-auto px-6 py-8" data-testid="blueprint-error">
        <Link href="/blueprints" className="underline text-sm">← Blueprint</Link>
        <p className="text-red-600 mt-4">
          {status === 404 ? "Variante non trovata." : "Errore."}
        </p>
      </main>
    );
  }
  const v = variant.data!;
  return (
    <main data-testid="blueprint-detail-page" className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <header>
        <Link href="/blueprints" className="underline text-sm" data-testid="blueprint-back">← Blueprint</Link>
        <h1 className="text-2xl font-semibold mt-2" data-testid="blueprint-name">{v.name}</h1>
        <p className="text-sm opacity-70 font-mono" data-testid="blueprint-code">{v.code}</p>
      </header>

      <nav className="border-b flex gap-4 text-sm" data-testid="blueprint-tabs">
        {(["processes", "activations"] as Tab[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            data-testid={`blueprint-tab-${k}`}
            className={`px-3 py-2 ${tab === k ? "border-b-2 border-black font-medium" : "opacity-60"}`}
          >
            {k === "processes" ? "Processi" : "Attivazioni"}
          </button>
        ))}
      </nav>

      {tab === "processes" && (
        <Card data-testid="blueprint-tab-content-processes">
          <CardHeader><CardTitle>Processi</CardTitle></CardHeader>
          <CardContent className="p-0">
            {processes.isLoading ? (
              <div className="p-6 opacity-60">Caricamento…</div>
            ) : processes.data && processes.data.items.length === 0 ? (
              <div className="p-6 opacity-60" data-testid="blueprint-processes-empty">Nessun processo.</div>
            ) : (
              <table className="w-full text-sm" data-testid="blueprint-processes-table">
                <thead>
                  <tr className="text-left border-b">
                    <th className="px-4 py-2">#</th>
                    <th className="px-4 py-2">Codice</th>
                    <th className="px-4 py-2">Nome</th>
                    <th className="px-4 py-2">Opzionale</th>
                  </tr>
                </thead>
                <tbody>
                  {processes.data!.items.map((p) => (
                    <tr key={p.blueprintProcessId} className="border-b last:border-b-0" data-testid="blueprint-process-row">
                      <td className="px-4 py-2 text-xs opacity-70">{p.ordinal}</td>
                      <td className="px-4 py-2 font-mono text-xs">{p.code}</td>
                      <td className="px-4 py-2">{p.name}</td>
                      <td className="px-4 py-2 text-xs">{p.isOptional ? "sì" : "no"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "activations" && (
        <Card data-testid="blueprint-tab-content-activations">
          <CardHeader><CardTitle>Attivazioni per tenant</CardTitle></CardHeader>
          <CardContent className="p-0">
            {activations.isLoading ? (
              <div className="p-6 opacity-60">Caricamento…</div>
            ) : activations.data && activations.data.items.length === 0 ? (
              <div className="p-6 opacity-60" data-testid="blueprint-activations-empty">
                Nessuna attivazione.
              </div>
            ) : (
              <table className="w-full text-sm" data-testid="blueprint-activations-table">
                <thead>
                  <tr className="text-left border-b">
                    <th className="px-4 py-2">Tenant ID</th>
                    <th className="px-4 py-2">Stato</th>
                    <th className="px-4 py-2">Attivata</th>
                  </tr>
                </thead>
                <tbody>
                  {activations.data!.items.map((a) => (
                    <tr key={a.blueprintActivationId} className="border-b last:border-b-0" data-testid="blueprint-activation-row">
                      <td className="px-4 py-2 font-mono text-xs">{a.tenantId.slice(0, 8)}</td>
                      <td className="px-4 py-2 text-xs uppercase">{a.status}</td>
                      <td className="px-4 py-2 text-xs">{a.activatedAt ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
