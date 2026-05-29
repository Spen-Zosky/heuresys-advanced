"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";

interface Skill {
  skillId: string;
  code: string;
  name: string;
  isGlobal: boolean;
  tenantId: string | null;
}

interface SkillsList {
  items: Skill[];
  total: number;
}

const COLUMNS: DataColumn<Skill>[] = [
  { header: "Codice", cell: (s) => <span className="font-mono text-xs">{s.code}</span> },
  { header: "Nome", cell: (s) => <span className="font-medium text-foreground">{s.name}</span> },
  {
    header: "Scope",
    cell: (s) => (
      <StatusPill tone={s.isGlobal ? "info" : "neutral"}>{s.isGlobal ? "global" : "tenant"}</StatusPill>
    ),
  },
];

export default function SkillsCataloguePage() {
  const skills = useQuery({
    queryKey: ["skills", "list"],
    queryFn: () => apiFetch<SkillsList>("/v1/skills?limit=200"),
  });

  return (
    <DataTablePanel<Skill>
      pageTestId="skills-page"
      titleTestId="skills-title"
      countTestId="skills-count"
      title="Catalogo skill"
      description="Skill visibili nel catalogo, globali e di tenant."
      count={skills.data ? `${skills.data.total} skill visibili` : undefined}
      isLoading={skills.isLoading}
      isError={skills.isError}
      errorMessage="Impossibile caricare le skill."
      rows={skills.data?.items ?? []}
      rowKey={(s) => s.skillId}
      rowTestId="skills-row"
      columns={COLUMNS}
      emptyTestId="skills-empty"
      emptyTitle="Nessuna skill"
      emptyDescription="Non ci sono skill nel catalogo."
      caption="Elenco skill"
    />
  );
}
