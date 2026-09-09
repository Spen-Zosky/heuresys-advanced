"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import {
  PageHeader, Card, CardContent, Badge, EmptyState, Spinner,
} from "@heuresys/ui";
import { FolderKanban } from "lucide-react";
import type { ProjectListResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";

/**
 * `#143` F5 — i progetti, dall'API reale e da nient'altro.
 *
 * Cio' che si vede qui dipende da CHI guarda, e il filtro sta sul server: un mandato HR
 * vede tutti i progetti del tenant, chiunque altro i soli progetti a cui partecipa adesso
 * (asse funzionale, `resolveActivityScope`). La pagina non conosce quel criterio e non
 * deve conoscerlo: chiede `/v1/projects` e mostra cio' che le torna.
 *
 * ⚠ Nessun dato sensibile compare qui, ed e' il confine I18: il numero dei membri si',
 * chi siano e cosa guadagnino no. Il dettaglio mostra nome, ruolo e finestra, che e' tutto
 * cio' che l'appartenenza a un progetto concede.
 */
export default function ProjectsPage() {
  const { t } = useTranslation("hr");
  const q = useQuery({
    queryKey: ["projects", "list"],
    queryFn: ({ signal }) =>
      apiFetch<ProjectListResponse>("/v1/projects?limit=200", { signal }),
    staleTime: 60_000,
    retry: 0,
  });

  const items = q.data?.items ?? [];

  return (
    <main data-testid="projects-page" className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <PageHeader
        title={t("projects.title")}
        description={t("projects.description")}
      />

      {q.isLoading ? (
        <div className="flex justify-center py-12" data-testid="projects-loading">
          <Spinner />
        </div>
      ) : q.isError ? (
        <p className="text-sm text-danger" data-testid="projects-error">
          {t("projects.error")}
        </p>
      ) : items.length === 0 ? (
        <EmptyState
          data-testid="projects-empty"
          title={t("projects.emptyTitle")}
          description={t("projects.emptyDesc")}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground" data-testid="projects-count">
            {t("projects.count", { count: q.data?.total ?? 0 })}
          </p>
          <section className="grid gap-4 md:grid-cols-2" data-testid="projects-list">
            {items.map((p) => (
              <Card key={p.projectId} data-testid="projects-row">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/projects/${p.projectId}`}
                        data-testid="project-link"
                        className="font-medium hover:underline"
                      >
                        {p.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{p.code}</p>
                    </div>
                    <Badge data-testid="project-status">
                      {t(`projects.status.${p.status}`)}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1" data-testid="project-members">
                      <FolderKanban className="size-4" aria-hidden />
                      {t("projects.members", { count: p.memberCount })}
                    </span>
                    {/* `progressPct` e' `null` finche' nessuno lo dichiara: un progetto
                        senza avanzamento dichiarato non e' un progetto fermo a zero, e
                        mostrarlo come 0% sarebbe inventare un dato. */}
                    {p.progressPct !== null && (
                      <span data-testid="project-progress">
                        {t("projects.progress", { pct: p.progressPct })}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
