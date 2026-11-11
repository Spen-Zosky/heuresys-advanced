"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@heuresys/ui";
import { PageHeader } from "@/components/intestazione-pagina";
import { Users, Crown } from "lucide-react";
import type { MyTeamsResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { StatoCaricamento, StatoErrore, StatoVuoto } from "@/components/stato-pagina";
import { Riferimento } from "@/components/scheda-rapida";
import { useRubrica } from "@/lib/leggibile";

/**
 * "Il mio team" (WS-4 R1b) — the caller's own teams (lead + member), each with its members.
 * Pure live data: GET /v1/me/team (the teams service applies the "my team" scope axis server-side).
 */
export default function MeTeamPage() {
  const { t } = useTranslation("ess");
  const teams = useQuery({
    queryKey: ["me", "team"],
    queryFn: ({ signal }) => apiFetch<MyTeamsResponse>("/v1/me/team", { signal }),
    staleTime: 60_000,
    retry: 0,
  });
  // Ogni persona si mostra «Cognome, Nome» con la sua posizione e apre la sua scheda (C2, C12):
  // l'email non serve a lavorare con il proprio team.
  const rubrica = useRubrica();
  const persone = new Map((rubrica.data?.persone ?? []).map((p) => [p.id, p]));
  const membri = (lista: MyTeamsResponse["teams"][number]["members"]) =>
    [...lista].sort((a, b) => (persone.get(a.userId)?.etichetta ?? a.fullName ?? "").localeCompare(persone.get(b.userId)?.etichetta ?? b.fullName ?? "", "it"));

  return (
    <main data-testid="me-team-page" className="mx-auto max-w-5xl space-y-8 px-6 pb-8">
      <PageHeader
        title={t("team.title")}
        description={t("team.description")}
      />

      {teams.isLoading ? (
        <StatoCaricamento testId="me-team-loading" />
      ) : teams.isError ? (
        <StatoErrore errore={teams.error} titolo={t("team.error")} testId="me-team-error" onRiprova={() => void teams.refetch()} />
      ) : (teams.data?.teams.length ?? 0) === 0 ? (
        <StatoVuoto testId="me-team-empty" titolo={t("team.emptyTitle")} motivo={t("team.emptyDesc")} />
      ) : (
        <section className="space-y-6" data-testid="me-team-list">
          {teams.data!.teams.map((team) => (
            <Card key={team.teamId} data-testid="me-team-card">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-3">
                  <CardTitle data-testid="me-team-name">{team.name}</CardTitle>
                  <span className="ml-auto inline-flex items-center gap-1 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {team.memberCount}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border">
                  {membri(team.members).map((m) => (
                    <li
                      key={m.userId}
                      data-testid="me-team-member-row"
                      className="flex items-center gap-3 py-2"
                    >
                      {m.role === "LEAD" ? (
                        <Crown className="h-4 w-4 text-palette-1" aria-label={t("team.leadAria")} />
                      ) : (
                        <Users className="h-4 w-4 text-muted-foreground" />
                      )}
                      <Riferimento tipo="persona" id={m.userId}>
                        {persone.get(m.userId)?.etichetta ?? m.fullName ?? t("team.member")}
                      </Riferimento>
                      {persone.get(m.userId)?.posizione ? (
                        <span className="text-xs text-muted-foreground">{persone.get(m.userId)?.posizione}</span>
                      ) : null}
                      <Badge
                        variant={m.role === "LEAD" ? "default" : "secondary"}
                        className="ml-auto text-xs"
                      >
                        {m.role === "LEAD" ? t("team.lead") : t("team.member")}
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
