"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../../../lib/api/fetch";

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

  return (
    <main data-testid="position-skills-page" className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <header>
        <Link href={`/positions/${positionId}`} className="underline text-sm" data-testid="position-skills-back">
          ← Posizione
        </Link>
        <h1 className="text-2xl font-semibold mt-2" data-testid="position-skills-title">
          Skill richieste
        </h1>
        <p className="text-sm opacity-70" data-testid="position-skills-count">
          {skills.data ? `${skills.data.items.length} skill associate` : "Caricamento…"}
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>Requisiti</CardTitle></CardHeader>
        <CardContent className="p-0">
          {skills.isLoading ? (
            <div className="p-6 opacity-60">Caricamento…</div>
          ) : skills.data && skills.data.items.length === 0 ? (
            <div className="p-6 opacity-60" data-testid="position-skills-empty">
              Nessuna skill richiesta dichiarata.
            </div>
          ) : (
            <table className="w-full text-sm" data-testid="position-skills-table">
              <thead>
                <tr className="text-left border-b">
                  <th className="px-4 py-2">Codice</th>
                  <th className="px-4 py-2">Skill</th>
                  <th className="px-4 py-2">Proficiency</th>
                  <th className="px-4 py-2">Peso</th>
                </tr>
              </thead>
              <tbody>
                {skills.data!.items.map((s) => (
                  <tr key={s.positionSkillRequirementId} className="border-b last:border-b-0" data-testid="position-skill-row">
                    <td className="px-4 py-2 font-mono text-xs">{s.skillCode}</td>
                    <td className="px-4 py-2">{s.skillName}</td>
                    <td className="px-4 py-2 text-xs uppercase">{s.proficiency}</td>
                    <td className="px-4 py-2 text-xs">{s.weight}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
