"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@heuresys/ui";
import type { OrganizationUnit } from "@heuresys/shared";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";
import { useEnumLabel } from "@/lib/enum-labels";
import { OrgUnitCreator, OrgUnitEditor } from "./_components/org-unit-forms";
import { SenzaNome } from "@/components/senza-nome";

export default function OrganizationPage() {
  const { t } = useTranslation("admin");
  const enumLabel = useEnumLabel();
  // L'unità in lavorazione: la tabella resta l'indice, il pannello di modifica
  // si apre sopra di essa (#44). Nessuna rotta di dettaglio da inventare.
  const [editingId, setEditingId] = useState<string | null>(null);
  // C4 (#42): server-side pagination (was `?limit=200`).
  // D3-14: il numero in testa conta le unità che si vedono. Si parte dalle attive (le non attive,
  // ritirate con una data di fine, si chiedono) e il totale è quello del filtro.
  const [stato, setStato] = useState<"active" | "inactive" | "all">("active");
  const ous = usePaginatedList<OrganizationUnit>({
    queryKey: ["organization-units", "list", stato],
    path: "/v1/organization-units",
    params: { isActive: stato === "all" ? "" : stato === "active" ? "true" : "false" },
  });

  const columns = useMemo<DataColumn<OrganizationUnit>[]>(
    () => [
      // Repertorio interfacce (B2): il nome dell'unità apre la riga, il codice tecnico non va a video (R2, R4).
      { header: t("organization.columns.name"), cell: (o) => <span className="font-medium text-foreground" data-testid="organization-name">{o.name}</span> },
      { header: t("organization.columns.type"), cell: (o) => <span className="text-sm text-muted-foreground">{enumLabel("orgUnitType", o.type)}</span> },
      {
        header: t("organization.columns.parent"),
        cell: (o) => <span className="text-xs text-muted-foreground">{o.parentName ?? (o.parentId ? <SenzaNome id={o.parentId} /> : t("organization.dash"))}</span>,
      },
      {
        header: t("organization.columns.active"),
        cell: (o) => <StatusPill tone={o.isActive ? "success" : "neutral"}>{o.isActive ? t("organization.activeYes") : t("organization.activeNo")}</StatusPill>,
      },
      {
        header: t("common:table.actions"),
        cell: (o) => (
          <Button
            type="button"
            variant="outline"
            data-testid={`organization-edit-${o.code}`}
            onClick={() => setEditingId(o.organizationUnitId)}
          >
            {t("organization.form.edit")}
          </Button>
        ),
      },
    ],
    [t, enumLabel],
  );

  return (
    <DataTablePanel<OrganizationUnit>
      pageTestId="organization-page"
      titleTestId="organization-title"
      countTestId="organization-count"
      title={t("organization.title")}
      description={t("organization.description")}
      count={ous.query.data ? t("organization.count", { count: ous.total }) : undefined}
      isLoading={ous.query.isLoading}
      isError={ous.query.isError}
      error={ous.query.error}
      errorMessage={t("organization.errorMessage")}
      rows={ous.rows}
      server={ous.server}
      rowKey={(o) => o.organizationUnitId}
      rowTestId="organization-row"
      columns={columns}
      emptyTestId="organization-empty"
      emptyTitle={t("organization.emptyTitle")}
      emptyDescription={t("organization.emptyDescription")}
      caption={t("organization.caption")}
    >
      {/* Fra l'intestazione e la tabella: creare una nuova unità, e — quando
          una riga è selezionata — modificarla o spostarla nell'albero (#44). */}
      <div className="w-48">
        <label htmlFor="organization-filter-status" className="mb-1 block text-xs font-medium text-muted-foreground">
          {t("organization.columns.active")}
        </label>
        <select
          id="organization-filter-status"
          data-testid="organization-filter-status"
          className="w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={stato}
          onChange={(e) => setStato(e.target.value as "active" | "inactive" | "all")}
        >
          <option value="active">{t("organization.filters.active")}</option>
          <option value="inactive">{t("organization.filters.inactive")}</option>
          <option value="all">{t("organization.filters.all")}</option>
        </select>
      </div>
      <OrgUnitCreator />
      {editingId && <OrgUnitEditor ouId={editingId} onClose={() => setEditingId(null)} />}
    </DataTablePanel>
  );
}
