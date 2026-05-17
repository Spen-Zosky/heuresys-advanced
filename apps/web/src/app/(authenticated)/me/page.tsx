"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../lib/api/fetch";

interface MeProfile {
  userId: string;
  email: string;
  displayName: string | null;
  tenantId: string | null;
  locale: string | null;
  timezone: string | null;
  roles: string[];
  bio: string | null;
}
interface MePositions {
  items: Array<{
    userPositionAssignmentId: string;
    positionTitle: string;
    positionCode: string;
    isPrimary: boolean;
    status: string;
  }>;
  total: number;
}
interface MeLearning {
  items: Array<{ learningPathName: string; status: string; dueDate: string | null }>;
  total: number;
}
interface MeGaps {
  items: Array<{ learningGapId: string; severity: string; skillName: string | null }>;
  total: number;
}

export default function MeLandingPage() {
  const profile = useQuery({
    queryKey: ["me", "profile"],
    queryFn: () => apiFetch<MeProfile>("/v1/me/profile"),
  });
  const positions = useQuery({
    queryKey: ["me", "positions"],
    queryFn: () => apiFetch<MePositions>("/v1/me/positions"),
  });
  const learning = useQuery({
    queryKey: ["me", "learning"],
    queryFn: () => apiFetch<MeLearning>("/v1/me/learning"),
  });
  const gaps = useQuery({
    queryKey: ["me", "gaps"],
    queryFn: () => apiFetch<MeGaps>("/v1/me/gaps"),
  });

  const primary = positions.data?.items.find((p) => p.isPrimary);

  return (
    <main data-testid="me-page" className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold" data-testid="me-greeting">
          Ciao, {profile.data?.displayName ?? profile.data?.email ?? "…"}
        </h1>
        <p className="text-sm opacity-70" data-testid="me-email">
          {profile.data?.email ?? ""}
        </p>
        <p className="text-sm opacity-70" data-testid="me-roles">
          Ruoli: {profile.data?.roles.join(", ") ?? "—"}
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card data-testid="me-card-primary-position">
          <CardHeader><CardTitle>Posizione attuale</CardTitle></CardHeader>
          <CardContent>
            {positions.isLoading ? (
              <span className="opacity-60">Caricamento…</span>
            ) : primary ? (
              <div>
                <p className="font-medium" data-testid="me-primary-position-title">{primary.positionTitle}</p>
                <p className="text-xs opacity-70">{primary.positionCode}</p>
              </div>
            ) : (
              <span data-testid="me-no-primary" className="opacity-60">
                Nessuna posizione primaria attiva.
              </span>
            )}
          </CardContent>
        </Card>

        <Card data-testid="me-card-learning">
          <CardHeader><CardTitle>Percorsi formativi</CardTitle></CardHeader>
          <CardContent>
            <p data-testid="me-learning-count">
              {learning.data?.total ?? 0} assegnati
            </p>
          </CardContent>
        </Card>

        <Card data-testid="me-card-gaps">
          <CardHeader><CardTitle>Gap di sviluppo</CardTitle></CardHeader>
          <CardContent>
            <p data-testid="me-gaps-count">
              {gaps.data?.total ?? 0} aperti
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
