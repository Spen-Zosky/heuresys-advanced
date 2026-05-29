"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";
import { EntityTable } from "@/components/data-table-panel";
import { StatusBadge } from "@/components/status-pill";

interface PositionSkillReq {
  positionSkillRequirementId: string;
  skillId: string;
  skillCode: string;
  skillName: string;
  proficiency: string;
  weight: string;
}

export default function PositionSkillsPage() {
  const params = useParams<{ positionId: string }>();
  const positionId = params.positionId;
  const skills = useQuery({
    queryKey: ["positions", positionId, "skills"],
    queryFn: () => apiFetch<{ items: PositionSkillReq[] }>(`/v1/positions/${positionId}/skills`),
    enabled: !!positionId,
  });

  const items = skills.data?.items ?? [];

  return (
    <main data-testid="position-skills-page" className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="position-skills-title"
        title="Skill richieste"
        breadcrumbs={
          <Link
            href={`/positions/${positionId}`}
            data-testid="position-skills-back"
            className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            ← Posizione
          </Link>
        }
        badges={
          <span data-testid="position-skills-count" className="text-sm text-muted-foreground">
            {skills.data ? `${items.length} skill associate` : "Caricamento…"}
          </span>
        }
      />

      <Card>
        <CardHeader><CardTitle>Requisiti</CardTitle></CardHeader>
        <CardContent className="p-0">
          <EntityTable<PositionSkillReq>
            isLoading={skills.isLoading}
            isError={skills.isError}
            rows={items}
            rowKey={(s) => s.positionSkillRequirementId}
            rowTestId="position-skill-row"
            emptyTestId="position-skills-empty"
            emptyTitle="Nessuna skill richiesta dichiarata."
            caption="Skill richieste dalla posizione"
            columns={[
              { header: "Codice", cell: (s) => <span className="font-mono text-xs">{s.skillCode}</span> },
              { header: "Skill", cell: (s) => s.skillName },
              { header: "Proficiency", cell: (s) => <StatusBadge value={s.proficiency} /> },
              { header: "Peso", cell: (s) => <span className="text-xs">{s.weight}</span> },
            ]}
          />
        </CardContent>
      </Card>
    </main>
  );
}
