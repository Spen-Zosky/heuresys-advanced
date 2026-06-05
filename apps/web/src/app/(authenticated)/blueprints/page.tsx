"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import Link from "next/link";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";

interface BlueprintVariant {
  blueprintVariantId: string;
  familyId: string;
  code: string;
  name: string;
  description: string | null;
}
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

export default function BlueprintsPage() {
  const { t } = useTranslation("blueprints");
  const families = useQuery({
    queryKey: ["blueprint-families", "list"],
    queryFn: () => apiFetch<{ items: BlueprintFamily[]; total: number }>("/v1/blueprint-families?limit=200"),
  });
  const variants = useQuery({
    queryKey: ["blueprint-variants", "list"],
    queryFn: () => apiFetch<{ items: BlueprintVariant[]; total: number }>("/v1/blueprint-variants?limit=200"),
  });
  const familyById = new Map(families.data?.items.map((f) => [f.blueprintFamilyId, f]) ?? []);

  const rows: VariantRow[] = (variants.data?.items ?? []).map((v) => {
    const fam = familyById.get(v.familyId);
    return { ...v, famName: fam?.name ?? null, industry: fam?.industryCode ?? null };
  });

  const columns = useMemo(() => buildColumns(t), [t]);

  return (
    <DataTablePanel<VariantRow>
      pageTestId="blueprints-page"
      titleTestId="blueprints-title"
      countTestId="blueprints-count"
      title={t("list.title")}
      description={t("list.description")}
      count={variants.data ? t("list.count", { count: variants.data.total }) : undefined}
      isLoading={variants.isLoading || families.isLoading}
      isError={variants.isError}
      errorTestId="blueprints-error"
      errorMessage={t("list.error")}
      rows={rows}
      rowKey={(v) => v.blueprintVariantId}
      rowTestId="blueprints-row"
      columns={columns}
      emptyTestId="blueprints-empty"
      emptyTitle={t("list.emptyTitle")}
      emptyDescription={t("list.emptyDescription")}
      caption={t("list.caption")}
    />
  );
}
