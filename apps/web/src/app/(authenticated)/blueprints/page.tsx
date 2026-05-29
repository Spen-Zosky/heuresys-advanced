"use client";

import { useQuery } from "@tanstack/react-query";
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

const COLUMNS: DataColumn<VariantRow>[] = [
  { header: "Codice", cell: (v) => <span className="font-mono text-xs text-muted-foreground">{v.code}</span> },
  {
    header: "Nome",
    cell: (v) => (
      <Link href={`/blueprints/${v.blueprintVariantId}`} data-testid="blueprint-link" className="font-medium text-foreground underline-offset-2 hover:underline">
        {v.name}
      </Link>
    ),
  },
  { header: "Famiglia", cell: (v) => <span className="text-foreground">{v.famName ?? "—"}</span> },
  { header: "Industry", cell: (v) => <span className="text-xs uppercase text-muted-foreground">{v.industry ?? "—"}</span> },
];

export default function BlueprintsPage() {
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

  return (
    <DataTablePanel<VariantRow>
      pageTestId="blueprints-page"
      titleTestId="blueprints-title"
      countTestId="blueprints-count"
      title="Blueprint"
      description="Varianti di blueprint con famiglia e industry."
      count={variants.data ? `${variants.data.total} varianti` : undefined}
      isLoading={variants.isLoading || families.isLoading}
      isError={variants.isError}
      errorTestId="blueprints-error"
      errorMessage="Impossibile caricare i blueprint."
      rows={rows}
      rowKey={(v) => v.blueprintVariantId}
      rowTestId="blueprints-row"
      columns={COLUMNS}
      emptyTestId="blueprints-empty"
      emptyTitle="Nessuna variante"
      emptyDescription="Non ci sono varianti di blueprint."
      caption="Varianti di blueprint"
    />
  );
}
