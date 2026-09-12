"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Card, CardContent, HeuresysWordmark, EmptyState, Spinner } from "@heuresys/ui";
import type { PublicJobPostingListResponse } from "@heuresys/shared/schemas/public-job-postings";

/**
 * `/jobs` — la vetrina PUBBLICA degli annunci (`#54` F4, percorso prospect ADR-0026).
 *
 * Nessun login: chiunque passi di qui legge gli annunci che un'azienda ha reso `PUBLIC` e
 * pubblicato. Il filtro non sta in questa pagina — sta in `/v1/public/job-postings`, che
 * restituisce SOLO quelli; un annuncio interno non arriva qui nemmeno se qualcuno indovina
 * l'indirizzo. Come `/investors`, la pagina usa `fetch` diretto verso il proxy `/api`:
 * niente sessione, niente CSRF, niente refresh.
 */
export default function PublicJobsPage() {
  const { t } = useTranslation("landing");
  const [data, setData] = useState<PublicJobPostingListResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/v1/public/job-postings", { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("jobs"))))
      .then((d) => { if (alive) setData(d as PublicJobPostingListResponse); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, []);

  return (
    <main data-testid="jobs-page" className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/" aria-label="Heuresys"><HeuresysWordmark /></Link>
        <Link href="/login" data-testid="jobs-login" className="text-sm text-muted-foreground hover:text-foreground">
          {t("jobs.login")}
        </Link>
      </header>

      <section className="mx-auto max-w-5xl space-y-6 px-6 pb-16">
        <div>
          <h1 className="text-3xl font-semibold">{t("jobs.title")}</h1>
          <p className="text-muted-foreground">{t("jobs.subtitle")}</p>
        </div>

        {error ? (
          <p className="text-sm text-danger" data-testid="jobs-error">{t("jobs.error")}</p>
        ) : data === null ? (
          <div className="flex justify-center py-12" data-testid="jobs-loading"><Spinner /></div>
        ) : data.items.length === 0 ? (
          <EmptyState data-testid="jobs-empty" title={t("jobs.emptyTitle")} description={t("jobs.emptyDesc")} />
        ) : (
          <>
            <p className="text-sm text-muted-foreground" data-testid="jobs-count">{t("jobs.count", { count: data.total })}</p>
            <ul className="grid gap-4 md:grid-cols-2" data-testid="jobs-list">
              {data.items.map((p) => (
                <li key={p.postingId}>
                  <Card data-testid="jobs-row">
                    <CardContent className="space-y-2 p-5">
                      <p className="text-xs uppercase text-muted-foreground" data-testid="jobs-row-company">{p.companyName}</p>
                      <h2 className="text-lg font-medium" data-testid="jobs-row-title">{p.title}</h2>
                      <p className="text-sm text-muted-foreground">
                        {p.location ?? t("jobs.noLocation")}
                        {p.publishedOn ? ` · ${t("jobs.publishedOn", { date: p.publishedOn })}` : ""}
                        {p.expiresOn ? ` · ${t("jobs.expiresOn", { date: p.expiresOn })}` : ""}
                      </p>
                      {p.description && <p className="whitespace-pre-line text-sm">{p.description}</p>}
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}
