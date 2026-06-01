"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge, EmptyState, PageHeader } from "@heuresys/ui";
import { Inbox } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { apiFetch } from "@/lib/api/fetch";

interface MeSkillEvidence {
  userSkillEvidenceId: string;
  skillCode: string;
  skillName: string;
  declaredProficiency: string;
  source: string;
  assessedAt: string;
  score: number | null;
  comment: string | null;
}

export default function MeSkillsPage() {
  const skills = useQuery({
    queryKey: ["me", "skills"],
    queryFn: () => apiFetch<{ items: MeSkillEvidence[]; total: number }>("/v1/me/skills"),
  });

  return (
    <main data-testid="me-skills-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="me-skills-title"
        title="Le mie skill"
        description="Evidenze di competenza raccolte sul tuo profilo."
        badges={
          <Badge variant="secondary" data-testid="me-skills-count">
            {skills.data ? `${skills.data.total} evidenze` : "Caricamento…"}
          </Badge>
        }
      />

      {skills.isLoading ? (
        <div className="rounded-card border border-border bg-card p-6 text-sm text-muted-foreground">
          Caricamento…
        </div>
      ) : skills.data && skills.data.items.length === 0 ? (
        <EmptyState
          data-testid="me-skills-empty"
          icon={<Inbox className="h-6 w-6" />}
          title="Nessuna skill ancora dichiarata"
          description="Le evidenze di competenza appariranno qui una volta raccolte."
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
          <table className="w-full border-collapse text-sm" data-testid="me-skills-table">
            <thead>
              <tr className="border-b border-border bg-muted text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2">Skill</th>
                <th className="px-4 py-2">Codice</th>
                <th className="px-4 py-2">Livello</th>
                <th className="px-4 py-2">Fonte</th>
                <th className="px-4 py-2">Punteggio</th>
                <th className="px-4 py-2">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {skills.data!.items.map((s) => (
                <tr
                  key={s.userSkillEvidenceId}
                  data-testid="me-skill-row"
                  className="transition-colors hover:bg-muted/60"
                >
                  <td className="px-4 py-2 align-middle font-medium text-foreground">{s.skillName}</td>
                  <td className="px-4 py-2 align-middle font-mono text-xs text-muted-foreground">{s.skillCode}</td>
                  <td className="px-4 py-2 align-middle">
                    <StatusPill tone="info">{s.declaredProficiency}</StatusPill>
                  </td>
                  <td className="px-4 py-2 align-middle text-xs text-muted-foreground">{s.source}</td>
                  <td className="px-4 py-2 align-middle text-xs text-muted-foreground">{s.score ?? "—"}</td>
                  <td className="px-4 py-2 align-middle text-xs text-muted-foreground">{s.assessedAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
