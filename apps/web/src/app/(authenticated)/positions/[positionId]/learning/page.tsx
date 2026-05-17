"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../../../lib/api/fetch";

interface LearningGap {
  learningGapId: string;
  userId: string;
  skillId: string | null;
  severity: string;
  detectedAt: string;
}

export default function PositionLearningPage() {
  const params = useParams<{ positionId: string }>();
  const positionId = params.positionId;
  // No dedicated /positions/:id/learning endpoint — compose from
  // /v1/learning-gaps?positionId= (gaps associated to the position).
  const gaps = useQuery({
    queryKey: ["learning-gaps", "by-position", positionId],
    queryFn: () =>
      apiFetch<{ items: LearningGap[]; total: number }>(
        `/v1/learning-gaps?positionId=${positionId}&limit=200`,
      ),
    enabled: !!positionId,
  });

  return (
    <main data-testid="position-learning-page" className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <header>
        <Link href={`/positions/${positionId}`} className="underline text-sm" data-testid="position-learning-back">
          ← Posizione
        </Link>
        <h1 className="text-2xl font-semibold mt-2" data-testid="position-learning-title">
          Gap formativi della posizione
        </h1>
        <p className="text-sm opacity-70" data-testid="position-learning-count">
          {gaps.data ? `${gaps.data.total} gap aperti` : "Caricamento…"}
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>Gap aperti</CardTitle></CardHeader>
        <CardContent className="p-0">
          {gaps.isLoading ? (
            <div className="p-6 opacity-60">Caricamento…</div>
          ) : gaps.data && gaps.data.items.length === 0 ? (
            <div className="p-6 opacity-60" data-testid="position-learning-empty">
              Nessun gap formativo associato a questa posizione.
            </div>
          ) : (
            <table className="w-full text-sm" data-testid="position-learning-table">
              <thead>
                <tr className="text-left border-b">
                  <th className="px-4 py-2">User</th>
                  <th className="px-4 py-2">Skill</th>
                  <th className="px-4 py-2">Severità</th>
                  <th className="px-4 py-2">Rilevato</th>
                </tr>
              </thead>
              <tbody>
                {gaps.data!.items.map((g) => (
                  <tr key={g.learningGapId} className="border-b last:border-b-0" data-testid="position-learning-row">
                    <td className="px-4 py-2 font-mono text-xs">{g.userId.slice(0, 8)}</td>
                    <td className="px-4 py-2 font-mono text-xs">{g.skillId?.slice(0, 8) ?? "—"}</td>
                    <td className="px-4 py-2 text-xs uppercase">{g.severity}</td>
                    <td className="px-4 py-2 text-xs">{g.detectedAt.slice(0, 10)}</td>
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
