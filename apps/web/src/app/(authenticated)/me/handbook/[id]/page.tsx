"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, Card, CardContent, PageHeader, MarkdownView } from "@heuresys/ui";
import type { ContentDocumentDetailResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";

/**
 * ESS knowledge-base document view (cap④ CMS P2). Reads a PUBLISHED document via
 * GET /v1/me/content/:id (404 for drafts / cross-tenant — no leak). The body is
 * rendered as rich markdown via the lib MarkdownView primitive (cap4 CMS P3,
 * S981 — react-markdown is XSS-safe by default: raw HTML is never executed).
 * primitive (apps/web must not add a UI runtime dep).
 */
export default function MeHandbookDetailPage() {
  const { t } = useTranslation("ess");
  const params = useParams<{ id: string }>();
  const id = params.id;

  const detail = useQuery({
    queryKey: ["me", "handbook", "doc", id],
    queryFn: () => apiFetch<ContentDocumentDetailResponse>(`/v1/me/content/${id}`),
  });

  if (detail.isError) {
    return (
      <main data-testid="handbook-detail-page" className="mx-auto max-w-3xl space-y-4 px-6 py-8">
        <Link href="/me/handbook" data-testid="handbook-back" className="inline-flex text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          {t("handbook.back")}
        </Link>
        <p className="text-sm text-danger">{t("handbook.notFound")}</p>
      </main>
    );
  }

  const doc = detail.data?.document;
  const body = detail.data?.currentVersion?.body ?? doc?.body ?? "";

  return (
    <main data-testid="handbook-detail-page" className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <Link href="/me/handbook" data-testid="handbook-back" className="inline-flex text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
        {t("handbook.back")}
      </Link>
      <PageHeader
        data-testid="handbook-detail-title"
        title={doc?.title ?? t("common:loading")}
        badges={doc ? <Badge variant="secondary">{t(`handbook.kind.${doc.kind}`)}</Badge> : undefined}
      />
      <Card>
        <CardContent className="py-6">
          <div data-testid="handbook-body" className="break-words text-sm leading-relaxed text-foreground">
            <MarkdownView content={body} />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
