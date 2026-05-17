"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../lib/api/fetch";

interface Skill {
  skillId: string;
  code: string;
  name: string;
  isGlobal: boolean;
  tenantId: string | null;
}

export default function SkillsCataloguePage() {
  const skills = useQuery({
    queryKey: ["skills", "list"],
    queryFn: () => apiFetch<{ items: Skill[]; total: number }>("/v1/skills?limit=200"),
  });

  return (
    <main data-testid="skills-page" className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold" data-testid="skills-title">Catalogo skill</h1>
        <p className="text-sm opacity-70" data-testid="skills-count">
          {skills.data ? `${skills.data.total} skill visibili` : "Caricamento…"}
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>Skill</CardTitle></CardHeader>
        <CardContent className="p-0">
          {skills.isLoading ? (
            <div className="p-6 opacity-60">Caricamento…</div>
          ) : skills.data && skills.data.items.length === 0 ? (
            <div className="p-6 opacity-60" data-testid="skills-empty">Nessuna skill.</div>
          ) : (
            <table className="w-full text-sm" data-testid="skills-table">
              <thead>
                <tr className="text-left border-b">
                  <th className="px-4 py-2">Codice</th>
                  <th className="px-4 py-2">Nome</th>
                  <th className="px-4 py-2">Scope</th>
                </tr>
              </thead>
              <tbody>
                {skills.data!.items.map((s) => (
                  <tr key={s.skillId} className="border-b last:border-b-0" data-testid="skills-row">
                    <td className="px-4 py-2 font-mono text-xs">{s.code}</td>
                    <td className="px-4 py-2">{s.name}</td>
                    <td className="px-4 py-2 text-xs uppercase opacity-70">
                      {s.isGlobal ? "global" : "tenant"}
                    </td>
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
