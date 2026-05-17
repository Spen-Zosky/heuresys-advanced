"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../../lib/api/fetch";

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
    <main data-testid="me-skills-page" className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold" data-testid="me-skills-title">Le mie skill</h1>
        <p className="text-sm opacity-70" data-testid="me-skills-count">
          {skills.data ? `${skills.data.total} evidenze` : "Caricamento…"}
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>Evidenze raccolte</CardTitle></CardHeader>
        <CardContent className="p-0">
          {skills.isLoading ? (
            <div className="p-6 opacity-60">Caricamento…</div>
          ) : skills.data && skills.data.items.length === 0 ? (
            <div className="p-6 opacity-60" data-testid="me-skills-empty">
              Nessuna skill ancora dichiarata.
            </div>
          ) : (
            <table className="w-full text-sm" data-testid="me-skills-table">
              <thead>
                <tr className="text-left border-b">
                  <th className="px-4 py-2">Skill</th>
                  <th className="px-4 py-2">Codice</th>
                  <th className="px-4 py-2">Livello</th>
                  <th className="px-4 py-2">Fonte</th>
                  <th className="px-4 py-2">Punteggio</th>
                  <th className="px-4 py-2">Data</th>
                </tr>
              </thead>
              <tbody>
                {skills.data!.items.map((s) => (
                  <tr key={s.userSkillEvidenceId} className="border-b last:border-b-0" data-testid="me-skill-row">
                    <td className="px-4 py-2">{s.skillName}</td>
                    <td className="px-4 py-2 font-mono text-xs">{s.skillCode}</td>
                    <td className="px-4 py-2 text-xs uppercase">{s.declaredProficiency}</td>
                    <td className="px-4 py-2 text-xs">{s.source}</td>
                    <td className="px-4 py-2 text-xs">{s.score ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{s.assessedAt.slice(0, 10)}</td>
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
