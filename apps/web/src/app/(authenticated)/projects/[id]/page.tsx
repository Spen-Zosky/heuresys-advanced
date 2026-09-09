"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useParams } from "next/navigation";
import {
  PageHeader, Card, CardHeader, CardTitle, CardContent, Badge, Spinner,
} from "@heuresys/ui";
import { Crown } from "lucide-react";
import type { ProjectDetail } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";

/**
 * `#143` F5 — il dettaglio di un progetto: il lavoro e chi lo fa.
 *
 * ⭐ QUESTA PAGINA E' LA DIMOSTRAZIONE DEL CONFINE I18, e va letta sapendolo.
 * Di ogni membro si mostrano nome, ruolo nel progetto e finestra di partecipazione —
 * e nient'altro. Non c'e' un collegamento al dossier, non c'e' la retribuzione, non ci
 * sono le valutazioni: l'autorita' di chi guida un progetto e' SUL LAVORO, NON SULLE
 * PERSONE. Un capo progetto gerarchicamente inferiore a un suo membro vede questa stessa
 * pagina, ed e' esattamente cio' che deve vedere.
 *
 * Il capo si riconosce dal RUOLO nell'appartenenza (`LEAD`), non da una colonna del
 * progetto: e' la decisione di F2, imposta dai dati.
 */
export default function ProjectDetailPage() {
  const { t } = useTranslation("hr");
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const q = useQuery({
    queryKey: ["projects", "detail", id],
    queryFn: ({ signal }) => apiFetch<ProjectDetail>(`/v1/projects/${id}`, { signal }),
    enabled: Boolean(id),
    staleTime: 60_000,
    retry: 0,
  });

  if (q.isLoading) {
    return (
      <main className="flex justify-center py-16" data-testid="project-detail-loading">
        <Spinner />
      </main>
    );
  }
  if (q.isError || !q.data) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-8" data-testid="project-detail-error">
        <p className="text-sm text-danger">{t("projects.detailError")}</p>
      </main>
    );
  }

  const p = q.data;
  const correnti = p.members.filter((m) => m.isCurrent);

  return (
    <main data-testid="project-detail-page" className="mx-auto max-w-4xl space-y-8 px-6 py-8">
      <PageHeader title={p.name} description={p.code} />

      <Card>
        <CardHeader>
          <CardTitle>{t("projects.overview")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div data-testid="field-status">
            <p className="text-xs text-muted-foreground">{t("projects.statusLabel")}</p>
            <Badge>{t(`projects.status.${p.status}`)}</Badge>
          </div>
          <div data-testid="field-progress">
            <p className="text-xs text-muted-foreground">{t("projects.progressLabel")}</p>
            <p className="text-sm">
              {p.progressPct === null ? t("projects.progressUnset") : `${p.progressPct}%`}
            </p>
          </div>
          {p.purpose && (
            <div className="sm:col-span-2" data-testid="field-purpose">
              <p className="text-xs text-muted-foreground">{t("projects.purpose")}</p>
              <p className="text-sm">{p.purpose}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("projects.membersTitle", { count: correnti.length })}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y" data-testid="project-members-list">
            {correnti.map((m) => (
              <li key={m.userId} className="flex items-center justify-between py-3"
                  data-testid="project-member-row">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" data-testid="member-name">
                    {m.fullName ?? m.email ?? m.userId}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("projects.since", { date: m.startsOn })}
                  </p>
                </div>
                <Badge data-testid="member-role">
                  {m.role === "LEAD" && <Crown className="mr-1 size-3" aria-hidden />}
                  {t(`projects.role.${m.role}`)}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}
