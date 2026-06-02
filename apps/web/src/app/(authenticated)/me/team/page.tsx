"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader, Card, CardHeader, CardTitle, CardContent, Badge, EmptyState, Spinner } from "@heuresys/ui";
import { Users, Crown } from "lucide-react";
import type { MyTeamsResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";

/**
 * "Il mio team" (WS-4 R1b) — the caller's own teams (lead + member), each with its members.
 * Pure live data: GET /v1/me/team (the teams service applies the "my team" scope axis server-side).
 */
export default function MeTeamPage() {
  const teams = useQuery({
    queryKey: ["me", "team"],
    queryFn: ({ signal }) => apiFetch<MyTeamsResponse>("/v1/me/team", { signal }),
    staleTime: 60_000,
    retry: 0,
  });

  return (
    <main data-testid="me-team-page" className="mx-auto max-w-5xl space-y-8 px-6 py-8">
      <PageHeader
        title="Il mio team"
        description="I team a cui appartieni o che guidi, con i relativi membri."
      />

      {teams.isLoading ? (
        <div className="flex justify-center py-12" data-testid="me-team-loading">
          <Spinner />
        </div>
      ) : teams.isError ? (
        <p className="text-sm text-danger" data-testid="me-team-error">
          Impossibile caricare i tuoi team.
        </p>
      ) : (teams.data?.teams.length ?? 0) === 0 ? (
        <EmptyState
          data-testid="me-team-empty"
          title="Nessun team"
          description="Non fai parte di alcun team al momento."
        />
      ) : (
        <section className="space-y-6" data-testid="me-team-list">
          {teams.data!.teams.map((team) => (
            <Card key={team.teamId} data-testid="me-team-card">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-3">
                  <CardTitle data-testid="me-team-name">{team.name}</CardTitle>
                  <Badge variant="secondary" className="font-mono text-xs">{team.code}</Badge>
                  <span className="ml-auto inline-flex items-center gap-1 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {team.memberCount}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border">
                  {team.members.map((m) => (
                    <li
                      key={m.userId}
                      data-testid="me-team-member-row"
                      className="flex items-center gap-3 py-2"
                    >
                      {m.role === "LEAD" ? (
                        <Crown className="h-4 w-4 text-palette-1" aria-label="Team lead" />
                      ) : (
                        <Users className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="font-medium text-foreground">{m.fullName ?? m.email ?? m.userId}</span>
                      {m.email && m.fullName ? (
                        <span className="text-xs text-muted-foreground">{m.email}</span>
                      ) : null}
                      <Badge
                        variant={m.role === "LEAD" ? "default" : "secondary"}
                        className="ml-auto text-xs"
                      >
                        {m.role === "LEAD" ? "Lead" : "Membro"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </main>
  );
}
