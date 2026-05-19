"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import { apiFetch } from "../../../../../lib/api/fetch";

interface LearningPath {
  learningPathId: string;
  code: string;
  name: string;
  description: string | null;
  isMandatoryDefault: boolean;
  isGlobal: boolean;
}

export default function MeLearningCataloguePage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [lastEnrolled, setLastEnrolled] = useState<string | null>(null);

  const paths = useQuery({
    queryKey: ["learning-paths", "catalogue"],
    queryFn: () => apiFetch<{ items: LearningPath[]; total: number }>("/v1/learning-paths?limit=200"),
  });

  const enroll = useMutation({
    mutationFn: (learningPathId: string) =>
      apiFetch("/v1/me/learning/enrollments", {
        method: "POST",
        body: { learningPathId },
      }),
    onSuccess: (_data, learningPathId) => {
      setLastEnrolled(learningPathId);
      qc.invalidateQueries({ queryKey: ["me", "learning"] });
    },
  });

  const filtered = (paths.data?.items ?? []).filter((p) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
  });

  return (
    <main data-testid="learning-catalogue-page" className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <header>
        <Link href="/me/learning" className="underline text-sm" data-testid="learning-catalogue-back">
          ← I miei percorsi
        </Link>
        <h1 className="text-2xl font-semibold mt-2" data-testid="learning-catalogue-title">
          Catalogo percorsi
        </h1>
        <p className="text-sm opacity-70" data-testid="learning-catalogue-count">
          {paths.data ? `${paths.data.total} percorsi disponibili` : "Caricamento…"}
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>Filtro</CardTitle></CardHeader>
        <CardContent>
          <Input
            data-testid="learning-catalogue-filter"
            placeholder="Cerca per nome o codice…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Percorsi</CardTitle></CardHeader>
        <CardContent className="p-0">
          {paths.isLoading ? (
            <div className="p-6 opacity-60">Caricamento…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 opacity-60" data-testid="learning-catalogue-empty">
              Nessun percorso corrisponde al filtro.
            </div>
          ) : (
            <ul className="divide-y" data-testid="learning-catalogue-list">
              {filtered.slice(0, 50).map((p) => (
                <li
                  key={p.learningPathId}
                  className="px-4 py-3 flex items-center justify-between gap-4"
                  data-testid="learning-catalogue-row"
                >
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs font-mono opacity-70">{p.code}</p>
                    {p.description && <p className="text-xs opacity-70 mt-1">{p.description}</p>}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid="learning-catalogue-enroll"
                    disabled={enroll.isPending}
                    onClick={() => void enroll.mutate(p.learningPathId)}
                  >
                    {enroll.isPending ? "…" : "Iscriviti"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {enroll.isError && (
        <p className="text-sm text-red-600" data-testid="learning-catalogue-error">
          Errore durante l&apos;iscrizione.
        </p>
      )}
      {lastEnrolled && (
        <p className="text-sm text-green-700" data-testid="learning-catalogue-enrolled">
          Iscrizione confermata per {lastEnrolled}.
        </p>
      )}
    </main>
  );
}
