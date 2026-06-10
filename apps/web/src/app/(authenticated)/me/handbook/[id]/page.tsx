"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader, MarkdownView } from "@heuresys/ui";
import type { ContentDocumentDetailResponse, ListContentMediaResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";

/**
 * ESS knowledge-base document view (cap④ CMS P2). Reads a PUBLISHED document via
 * GET /v1/me/content/:id (404 for drafts / cross-tenant — no leak). The body is
 * rendered as rich markdown via the lib MarkdownView primitive (cap4 CMS P3,
 * S981 — react-markdown is XSS-safe by default: raw HTML is never executed).
 * primitive (apps/web must not add a UI runtime dep).
 *
 * Media (cap④ P3 close, S982): authors embed images with the ADMIN media URL
 * (/api/v1/content/media/:id — the panel's "copy markdown" button); employees
 * lack content:read, so the img renderer rewrites that prefix to the ESS
 * published-only endpoint (/api/v1/me/content/media/:id, inline images).
 * Attachments (e.g. PDF) are listed below the body from the ESS media list.
 */

const ADMIN_MEDIA_PREFIX = "/api/v1/content/media/";
const ESS_MEDIA_PREFIX = "/api/v1/me/content/media/";

function toEssMediaUrl(src: string): string {
  return src.startsWith(ADMIN_MEDIA_PREFIX)
    ? ESS_MEDIA_PREFIX + src.slice(ADMIN_MEDIA_PREFIX.length)
    : src;
}

function fmtSize(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

export default function MeHandbookDetailPage() {
  const { t } = useTranslation("ess");
  const params = useParams<{ id: string }>();
  const id = params.id;

  const detail = useQuery({
    queryKey: ["me", "handbook", "doc", id],
    queryFn: () => apiFetch<ContentDocumentDetailResponse>(`/v1/me/content/${id}`),
  });

  const media = useQuery({
    queryKey: ["me", "handbook", "doc", id, "media"],
    queryFn: () => apiFetch<ListContentMediaResponse>(`/v1/me/content/${id}/media`),
    enabled: detail.isSuccess,
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
  const attachments = media.data?.items ?? [];

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
            <MarkdownView
              content={body}
              components={{
                // Rewrite admin media URLs to the ESS published-only endpoint
                // (same-origin, cookie-authenticated, inline for images).
                img: ({ src, alt }) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={typeof src === "string" ? toEssMediaUrl(src) : undefined}
                    alt={alt ?? ""}
                    className="max-w-full rounded-card"
                    data-testid="handbook-media-img"
                  />
                ),
              }}
            />
          </div>
        </CardContent>
      </Card>

      {attachments.length > 0 && (
        <Card data-testid="handbook-attachments">
          <CardHeader>
            <CardTitle>{t("handbook.attachments")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {attachments.map((m) => (
                <li key={m.mediaId} data-testid="handbook-attachment-row" className="flex items-center justify-between gap-3 py-2">
                  <a
                    href={`${ESS_MEDIA_PREFIX}${m.mediaId}`}
                    data-testid="handbook-attachment-link"
                    className="block truncate text-sm font-medium underline-offset-2 hover:underline"
                  >
                    {m.filename}
                  </a>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {m.mime} · {fmtSize(m.sizeBytes)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
