"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Badge, Button, PageHeader } from "@heuresys/ui";
import type { OrgUnitProcessForProcess, OrgUnitProcessesForProcessResponse, OrgUnitProcessRole } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";

// Gap#1 Porta 1 — Process-Owner console. Live blueprint-process catalog
// (/v1/blueprint-processes) PLUS the RACI drill-down (Gap#1 follow-up): selecting a
// process loads its org-unit ↔ process assignments from
// /v1/organization-unit-processes/by-process/:id (live sys_organization_unit_processes,
// RACI role per assignment). Graph navigation of the process layer (NOT BPM runtime,
// which is Gap #2). No mock data: a real empty-state at each level.
interface ProcessRow { blueprintProcessId: string; code: string; name: string; ordinal: number; isOptional: boolean }
interface ProcessList { items: ProcessRow[]; total: number }

interface SelectedProcess { id: string; name: string }

// RACI assignment-role → badge tone. OWNER≈Accountable, CONTRIBUTOR≈Responsible.
function raciTone(role: OrgUnitProcessRole): "success" | "info" | "warning" | "neutral" {
  switch (role) {
    case "OWNER": return "success";
    case "CONTRIBUTOR": return "info";
    case "CONSULTED": return "warning";
    case "INFORMED": return "neutral";
  }
}

function buildProcessColumns(t: TFunction, onSelect: (p: SelectedProcess) => void, selectedId: string | null): DataColumn<ProcessRow>[] {
  return [
    { header: t("processOwner.cols.ordinal"), cell: (p) => <span className="text-xs text-muted-foreground">{p.ordinal}</span> },
    { header: t("processOwner.cols.code"), cell: (p) => <span className="text-xs text-muted-foreground">{p.code}</span> },
    { header: t("processOwner.cols.name"), cell: (p) => <span className="font-medium text-foreground">{p.name}</span> },
    { header: t("processOwner.cols.kind"), cell: (p) => <StatusPill tone={p.isOptional ? "neutral" : "info"}>{p.isOptional ? t("processOwner.optional") : t("processOwner.core")}</StatusPill> },
    {
      header: t("processOwner.cols.actions"), align: "right",
      cell: (p) => (
        <Button
          type="button" size="sm" variant={selectedId === p.blueprintProcessId ? "secondary" : "outline"}
          data-testid="process-owner-raci-btn"
          onClick={() => onSelect({ id: p.blueprintProcessId, name: p.name })}
        >
          {t("processOwner.raci.view")}
        </Button>
      ),
    },
  ];
}

function buildRaciColumns(t: TFunction): DataColumn<OrgUnitProcessForProcess>[] {
  return [
    { header: t("processOwner.raci.cols.unit"), cell: (r) => <span className="font-medium text-foreground">{r.orgUnitName}</span> },
    { header: t("processOwner.raci.cols.code"), cell: (r) => <span className="text-xs text-muted-foreground">{r.orgUnitCode}</span> },
    { header: t("processOwner.raci.cols.role"), cell: (r) => <StatusPill tone={raciTone(r.role)}>{t(`processOwner.raci.roles.${r.role}`)}</StatusPill> },
  ];
}

export default function ProcessOwnerPage() {
  const { t } = useTranslation("hr");
  const [selected, setSelected] = useState<SelectedProcess | null>(null);

  const processes = useQuery({
    queryKey: ["blueprint-processes", "list"],
    queryFn: () => apiFetch<ProcessList>("/v1/blueprint-processes?limit=200"),
  });
  const rows = useMemo<ProcessRow[]>(
    () => [...(processes.data?.items ?? [])].sort((a, b) => a.ordinal - b.ordinal),
    [processes.data],
  );

  const raci = useQuery({
    queryKey: ["org-unit-processes", "by-process", selected?.id],
    queryFn: () => apiFetch<OrgUnitProcessesForProcessResponse>(`/v1/organization-unit-processes/by-process/${selected!.id}`),
    enabled: selected !== null,
  });
  const raciRows = useMemo<OrgUnitProcessForProcess[]>(() => raci.data?.items ?? [], [raci.data]);

  const processColumns = useMemo(() => buildProcessColumns(t, setSelected, selected?.id ?? null), [t, selected]);
  const raciColumns = useMemo(() => buildRaciColumns(t), [t]);

  return (
    <main data-testid="process-owner-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="process-owner-title"
        title={t("processOwner.title")}
        description={t("processOwner.description")}
        badges={processes.data ? <Badge variant="secondary" data-testid="process-owner-count">{t("processOwner.count", { count: processes.data.total })}</Badge> : undefined}
      />
      <EntityTable<ProcessRow>
        isLoading={processes.isLoading} isError={processes.isError} errorMessage={t("processOwner.errorMessage")}
        rows={rows} rowKey={(p) => p.blueprintProcessId} rowTestId="process-owner-row" columns={processColumns}
        emptyTestId="process-owner-empty" emptyTitle={t("processOwner.emptyTitle")} emptyDescription={t("processOwner.emptyDescription")} caption={t("processOwner.caption")}
      />

      <section data-testid="raci-drill" className="space-y-3">
        <PageHeader
          data-testid="raci-drill-title"
          title={selected ? t("processOwner.raci.title", { process: selected.name }) : t("processOwner.raci.titleIdle")}
          description={t("processOwner.raci.subtitle")}
          badges={selected && raci.data ? <Badge variant="secondary" data-testid="raci-drill-count">{t("processOwner.raci.count", { count: raci.data.total })}</Badge> : undefined}
        />
        {selected === null ? (
          <div data-testid="raci-drill-hint" className="rounded-card border border-dashed border-border bg-card px-4 py-6 text-sm text-muted-foreground">
            {t("processOwner.raci.hint")}
          </div>
        ) : (
          <EntityTable<OrgUnitProcessForProcess>
            isLoading={raci.isLoading} isError={raci.isError} errorMessage={t("processOwner.raci.errorMessage")}
            rows={raciRows} rowKey={(r) => r.orgUnitProcessId} rowTestId="raci-drill-row" columns={raciColumns}
            emptyTestId="raci-drill-empty" emptyTitle={t("processOwner.raci.empty")} caption={t("processOwner.raci.caption")}
          />
        )}
      </section>
    </main>
  );
}
