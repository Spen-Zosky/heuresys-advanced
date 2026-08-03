"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import Link from "next/link";
import type { BlueprintVariant } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { Button } from "@heuresys/ui";
import { EntityTable } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";
import type { BlueprintActivation } from "@heuresys/shared";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";

// B-xx: BlueprintFamily stays a LOCAL interface (NOT deduped to @heuresys/shared) —
// the shared `BlueprintFamily` schema has no `industryCode` field at all, but the
// "Industry" column below renders `f.industryCode`. Flagged, not touched (C4/#42
// REGOLA CRITICA: used field missing from the shared type = STOP on this type).
interface BlueprintFamily {
  blueprintFamilyId: string;
  code: string;
  name: string;
  industryCode: string | null;
}
interface VariantRow extends BlueprintVariant {
  famName: string | null;
  industry: string | null;
}

function buildColumns(t: TFunction): DataColumn<VariantRow>[] {
  const na = t("common:value.na");
  return [
    {
      header: t("list.columns.name"),
      cell: (v) => (
        <div className="flex flex-col">
          <Link href={`/blueprints/${v.blueprintVariantId}`} data-testid="blueprint-link" className="font-medium text-foreground underline-offset-2 hover:underline">
            {v.name ? v.name : na}
          </Link>
          {v.code ? <span className="font-mono text-xs text-muted-foreground">{v.code}</span> : null}
        </div>
      ),
    },
    { header: t("list.columns.family"), cell: (v) => <span className="text-foreground">{v.famName ?? na}</span> },
    { header: t("list.columns.industry"), cell: (v) => <span className="text-xs uppercase text-muted-foreground">{v.industry ?? na}</span> },
  ];
}

// #45 C3 — attivazione dei blueprint dall'interfaccia. L'API esisteva e nessuna pagina
// la chiamava: proporre una variante per un'azienda voleva dire passare dal database.
// Il cancello è doppio come in C1/C3-tenant: il pannello si nasconde a chi non ha
// `blueprint:activate`, ma l'autorità resta il service.
export default function BlueprintsPage() {
  const { t } = useTranslation("blueprints");
  const qc = useQueryClient();
  const perms = useCurrentUserPermissions();
  const canActivate = perms.data?.permissions.includes("blueprint:activate") ?? false;
  const [variantId, setVariantId] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const activations = useQuery({
    queryKey: ["blueprint-activations", "list"],
    queryFn: () => apiFetch<{ items: BlueprintActivation[]; total: number }>("/v1/blueprint-activations?limit=200"),
  });

  const propose = useMutation({
    mutationFn: (id: string) =>
      apiFetch<BlueprintActivation>("/v1/blueprint-activations", {
        method: "POST",
        // Nasce PROPOSED, non ACTIVE: l'attivazione vera è una decisione, non l'effetto
        // collaterale di un clic su un elenco.
        body: { variantId: id, status: "PROPOSED" },
      }),
    onSuccess: () => {
      setNotice(t("activations.activated"));
      setVariantId("");
      void qc.invalidateQueries({ queryKey: ["blueprint-activations"] });
    },
  });
  // families: complete-lookup join (resolves family name/industry for EVERY variant
  // row across all pages) — not itself an EntityTable list, left as a full fetch.
  const families = useQuery({
    queryKey: ["blueprint-families", "list"],
    queryFn: () => apiFetch<{ items: BlueprintFamily[]; total: number }>("/v1/blueprint-families?limit=200"),
  });
  // C4 (#42): server-side pagination for the variants table (was `?limit=200`).
  const variants = usePaginatedList<BlueprintVariant>({
    queryKey: ["blueprint-variants", "list"],
    path: "/v1/blueprint-variants",
  });
  const familyById = new Map(families.data?.items.map((f) => [f.blueprintFamilyId, f]) ?? []);

  const rows: VariantRow[] = variants.rows.map((v) => {
    const fam = familyById.get(v.familyId);
    return { ...v, famName: fam?.name ?? null, industry: fam?.industryCode ?? null };
  });

  const columns = useMemo(() => buildColumns(t), [t]);

  const activationColumns = useMemo<DataColumn<BlueprintActivation>[]>(
    () => [
      {
        header: t("activations.colVariant"),
        cell: (a) => {
          const v = variants.rows.find((x) => x.blueprintVariantId === a.variantId);
          // Il nome della variante, non il suo identificativo: un elenco di UUID non è
          // consultabile da nessuno.
          return <span className="text-foreground">{v?.name ?? a.variantId}</span>;
        },
      },
      { header: t("activations.colStatus"), cell: (a) => <StatusPill tone="info">{a.status}</StatusPill> },
      { header: t("activations.colFrom"), cell: (a) => <span className="text-xs text-muted-foreground">{a.effectiveFrom}</span> },
    ],
    [t, variants.rows],
  );

  return (
    <div className="space-y-6">
      {canActivate ? (
        <section
          data-testid="blueprint-activation-panel"
          className="mx-auto max-w-7xl rounded-card border border-border bg-card px-6 py-4 shadow-card"
        >
          <h2 className="text-base font-semibold text-foreground">{t("activations.title")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("activations.hint")}</p>
          <form
            className="mt-3 flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setNotice(null);
              if (variantId) propose.mutate(variantId);
            }}
          >
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("activations.variantLabel")}
              <select
                data-testid="blueprint-activation-variant"
                required
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                className="rounded-input border border-border bg-background px-2 py-1 text-sm text-foreground"
              >
                <option value="">—</option>
                {variants.rows.map((v) => (
                  <option key={v.blueprintVariantId} value={v.blueprintVariantId}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" data-testid="blueprint-activation-submit" disabled={propose.isPending || !variantId}>
              {propose.isPending ? t("activations.activating") : t("activations.activate")}
            </Button>
          </form>
          {propose.isError ? (
            <p data-testid="blueprint-activation-error" className="mt-2 text-sm text-danger">
              {t("activations.error")}
            </p>
          ) : null}
          {notice ? (
            <p data-testid="blueprint-activation-notice" className="mt-2 text-sm text-success" role="status">
              {notice}
            </p>
          ) : null}
          <div className="mt-4">
            <EntityTable<BlueprintActivation>
              isLoading={activations.isLoading}
              isError={activations.isError}
              errorMessage={t("activations.loadError")}
              rows={activations.data?.items ?? []}
              rowKey={(a) => a.blueprintActivationId}
              rowTestId="blueprint-activation-row"
              columns={activationColumns}
              emptyTestId="blueprint-activation-empty"
              emptyTitle={t("activations.empty")}
              caption={t("activations.caption")}
            />
          </div>
        </section>
      ) : null}

      <DataTablePanel<VariantRow>
      pageTestId="blueprints-page"
      titleTestId="blueprints-title"
      countTestId="blueprints-count"
      title={t("list.title")}
      description={t("list.description")}
      count={variants.query.data ? t("list.count", { count: variants.total }) : undefined}
      isLoading={variants.query.isLoading || families.isLoading}
      isError={variants.query.isError}
      errorTestId="blueprints-error"
      errorMessage={t("list.error")}
      rows={rows}
      server={variants.server}
      rowKey={(v) => v.blueprintVariantId}
      rowTestId="blueprints-row"
      columns={columns}
      emptyTestId="blueprints-empty"
      emptyTitle={t("list.emptyTitle")}
      emptyDescription={t("list.emptyDescription")}
      caption={t("list.caption")}
      />
    </div>
  );
}
