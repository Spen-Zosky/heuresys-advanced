"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button, Input } from "@heuresys/ui";
import type { OccupationMatch, SkillMatch } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { ApiError } from "@/lib/api/errors";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";

/**
 * #40 (S1018) — free-text semantic search over the live pgvector embeddings
 * (25k+ occupations/skills). GET /v1/matching/search embeds the query at
 * REQUEST time via Voyage (billable, rate-limited 30/min per route), so the
 * search fires ONLY on explicit submit — never on keystroke — and results are
 * cached 5 min per identical query. Shared by /me/matching (ESS) and /skills
 * (admin catalog); i18n keys live in the `common` namespace.
 */

interface FreeTextSearchResponse {
  occupations: OccupationMatch[];
  skills: SkillMatch[];
}

/** Last path segment of an ESCO URI, fallback when label is null. */
function escoUriTail(uri: string): string {
  const trimmed = uri.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
}

export function SemanticSearchPanel() {
  const { t } = useTranslation();
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState("");

  const search = useQuery({
    queryKey: ["matching", "search", submitted],
    queryFn: () =>
      apiFetch<FreeTextSearchResponse>(
        `/v1/matching/search?q=${encodeURIComponent(submitted)}&limit=20`,
      ),
    enabled: submitted.length >= 2,
    retry: false, // 404 flag-off / 429 throttle must surface, never auto-re-bill
    staleTime: 5 * 60_000,
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(term.trim());
  };

  const flagOff = search.error instanceof ApiError && search.error.status === 404;
  const throttled = search.error instanceof ApiError && search.error.status === 429;

  const occColumns = useMemo<DataColumn<OccupationMatch>[]>(
    () => [
      {
        header: t("semanticSearch.colOccupation"),
        cell: (m) => <span className="font-medium text-foreground">{m.label ?? escoUriTail(m.escoUri)}</span>,
      },
      {
        header: t("semanticSearch.colIsco"),
        cell: (m) => <span className="text-xs text-muted-foreground">{m.iscoCode ?? "—"}</span>,
      },
      {
        header: t("semanticSearch.colScore"),
        align: "right",
        cell: (m) => (
          <span className="font-medium tabular-nums text-foreground">{`${(m.score * 100).toFixed(0)}%`}</span>
        ),
      },
    ],
    [t],
  );
  const skillColumns = useMemo<DataColumn<SkillMatch>[]>(
    () => [
      {
        header: t("semanticSearch.colSkill"),
        cell: (m) => <span className="font-medium text-foreground">{m.skillName ?? m.skillId}</span>,
      },
      {
        header: t("semanticSearch.colScore"),
        align: "right",
        cell: (m) => (
          <span className="font-medium tabular-nums text-foreground">{`${(m.score * 100).toFixed(0)}%`}</span>
        ),
      },
    ],
    [t],
  );

  return (
    <section data-testid="semantic-search" className="space-y-4 rounded-card border border-border bg-card p-4 shadow-card">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{t("semanticSearch.title")}</h2>
        <p className="text-xs text-muted-foreground">{t("semanticSearch.description")}</p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
        <Input
          data-testid="semantic-search-input"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={t("semanticSearch.placeholder")}
          aria-label={t("semanticSearch.title")}
          className="max-w-md flex-1"
        />
        <Button
          type="submit"
          data-testid="semantic-search-submit"
          disabled={term.trim().length < 2 || search.isFetching}
        >
          {search.isFetching ? t("loading") : t("semanticSearch.submit")}
        </Button>
      </form>

      {flagOff ? (
        <p data-testid="semantic-search-disabled" className="text-sm text-muted-foreground">
          {t("semanticSearch.disabled")}
        </p>
      ) : null}
      {throttled ? (
        <p data-testid="semantic-search-throttled" className="text-sm text-warning">
          {t("semanticSearch.throttled")}
        </p>
      ) : null}

      {submitted.length >= 2 && !flagOff && !throttled ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("semanticSearch.occupations")}
            </h3>
            <EntityTable<OccupationMatch>
              isLoading={search.isLoading}
              isError={search.isError && !flagOff && !throttled}
              errorMessage={t("semanticSearch.error")}
              rows={search.data?.occupations ?? []}
              rowKey={(m) => m.escoUri}
              rowTestId="semantic-search-occ-row"
              columns={occColumns}
              emptyTestId="semantic-search-occ-empty"
              emptyTitle={t("semanticSearch.emptyTitle")}
              emptyDescription={t("semanticSearch.emptyDesc")}
              caption={t("semanticSearch.occupations")}
            />
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("semanticSearch.skills")}
            </h3>
            <EntityTable<SkillMatch>
              isLoading={search.isLoading}
              isError={search.isError && !flagOff && !throttled}
              errorMessage={t("semanticSearch.error")}
              rows={search.data?.skills ?? []}
              rowKey={(m) => m.skillId}
              rowTestId="semantic-search-skill-row"
              columns={skillColumns}
              emptyTestId="semantic-search-skill-empty"
              emptyTitle={t("semanticSearch.emptyTitle")}
              emptyDescription={t("semanticSearch.emptyDesc")}
              caption={t("semanticSearch.skills")}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
