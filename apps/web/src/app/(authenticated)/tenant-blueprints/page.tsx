"use client";

/**
 * apps/web/src/app/(authenticated)/tenant-blueprints/page.tsx
 * #131 Tenant Builder P1, T6 — l'elenco dei fascicoli di configurazione.
 *
 * Nessun dato finto: tutto viene da `/v1/tenant-blueprints`. Un elenco vuoto e'
 * un vuoto reale, non un segnaposto.
 */
import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { TenantBlueprint } from "@heuresys/shared";
import { Button, Input } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";

function buildColumns(t: TFunction): DataColumn<TenantBlueprint>[] {
  return [
    {
      header: t("dossier.name"),
      cell: (b) => (
        <div className="flex flex-col">
          <Link
            href={`/tenant-blueprints/${b.tenantBlueprintId}`}
            data-testid="tenant-blueprint-link"
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            {b.name}
          </Link>
          <span className="font-mono text-xs text-muted-foreground">{b.code}</span>
        </div>
      ),
    },
    {
      header: t("dossier.company"),
      // Un fascicolo senza azienda NON e' un dato mancante: e' una trattativa,
      // ed e' il caso che ha fatto nascere l'oggetto. Si dice per quello che e'.
      cell: (b) =>
        b.tenantId ? (
          <span className="font-mono text-xs text-muted-foreground">{b.tenantId}</span>
        ) : (
          <span className="text-xs uppercase text-muted-foreground">
            {t("dossier.negotiation")}
          </span>
        ),
    },
    {
      header: t("dossier.status"),
      cell: (b) => (
        <StatusPill tone={b.status === "ACTIVE" ? "success" : "neutral"}>{b.status}</StatusPill>
      ),
    },
  ];
}

export default function TenantBlueprintsPage() {
  const { t } = useTranslation("blueprints");
  const qc = useQueryClient();
  const perms = useCurrentUserPermissions();
  const canWrite = perms.data?.permissions.includes("tenant_blueprint:write") ?? false;

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [errore, setErrore] = useState<string | null>(null);

  const lista = usePaginatedList<TenantBlueprint>({
    queryKey: ["tenant-blueprints", "list"],
    path: "/v1/tenant-blueprints",
  });

  const crea = useMutation({
    mutationFn: (input: { code: string; name: string }) =>
      apiFetch<TenantBlueprint>("/v1/tenant-blueprints", { method: "POST", body: input }),
    onSuccess: async () => {
      setCode("");
      setName("");
      setErrore(null);
      await qc.invalidateQueries({ queryKey: ["tenant-blueprints", "list"] });
    },
    onError: (e: unknown) => setErrore(e instanceof Error ? e.message : String(e)),
  });

  return (
    <div className="space-y-6" data-testid="tenant-blueprints-page">
      {canWrite ? (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">{t("dossier.createTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("dossier.createHint")}</p>
          <form
            className="mt-3 flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              crea.mutate({ code: code.trim(), name: name.trim() });
            }}
          >
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">{t("dossier.code")}</span>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                data-testid="tenant-blueprint-code"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">{t("dossier.name")}</span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="tenant-blueprint-name"
                required
              />
            </label>
            <Button
              type="submit"
              data-testid="tenant-blueprint-create"
              disabled={crea.isPending || !code.trim() || !name.trim()}
            >
              {t("dossier.create")}
            </Button>
          </form>
          {errore ? (
            <p data-testid="tenant-blueprint-create-error" className="mt-2 text-sm text-danger">
              {errore}
            </p>
          ) : null}
        </section>
      ) : null}

      <DataTablePanel<TenantBlueprint>
        pageTestId="tenant-blueprints-list"
        titleTestId="tenant-blueprints-title"
        countTestId="tenant-blueprints-count"
        title={t("dossier.title")}
        description={t("dossier.description")}
        isLoading={lista.query.isLoading}
        isError={lista.query.isError}
        errorTestId="tenant-blueprints-error"
        errorMessage={t("dossier.error")}
        rows={lista.query.data?.items ?? []}
        server={lista.server}
        rowKey={(b) => b.tenantBlueprintId}
        rowTestId="tenant-blueprints-row"
        columns={buildColumns(t)}
        emptyTestId="tenant-blueprints-empty"
        emptyTitle={t("dossier.emptyTitle")}
        emptyDescription={t("dossier.emptyDescription")}
        caption={t("dossier.caption")}
      />
    </div>
  );
}
