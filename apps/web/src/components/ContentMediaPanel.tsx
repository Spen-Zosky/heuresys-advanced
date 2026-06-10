"use client";

/**
 * ContentMediaPanel — cap④ CMS P3 media attachments for /content/[id].
 * Page-specific composition of @heuresys/ui primitives (no new primitives).
 * Upload goes through a raw fetch (FormData — apiFetch is JSON-only) with the
 * CSRF header from csrfStore; downloads are plain same-origin links through
 * the /api proxy (GET, cookie-authenticated, attachment disposition).
 */

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import type { ListContentMediaResponse } from "@heuresys/shared";
import { apiFetch } from "../lib/api/fetch";
import { csrfStore } from "../lib/api/csrf-store";

const MAX_BYTES = 10 * 1024 * 1024;

function fmtSize(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

export function ContentMediaPanel({ documentId, canEdit }: { documentId: string; canEdit: boolean }) {
  const { t } = useTranslation("admin");
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const media = useQuery({
    queryKey: ["content", documentId, "media"],
    queryFn: ({ signal }) =>
      apiFetch<ListContentMediaResponse>(`/v1/content/${documentId}/media`, { signal }),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > MAX_BYTES) throw new Error(t("content.media.tooLarge"));
      const form = new FormData();
      form.append("file", file, file.name);
      const headers: Record<string, string> = { accept: "application/json" };
      const csrf = csrfStore.get();
      if (csrf) headers["x-csrf-token"] = csrf;
      const res = await fetch(`/api/v1/content/${documentId}/media`, {
        method: "POST",
        headers,
        credentials: "include",
        body: form,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(body?.error?.message ?? t("content.media.uploadError"));
      }
      return res.json();
    },
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ["content", documentId, "media"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : t("content.media.uploadError")),
  });

  const remove = useMutation({
    mutationFn: (mediaId: string) =>
      apiFetch<{ deleted: true }>(`/v1/content/media/${mediaId}`, { method: "DELETE" }),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ["content", documentId, "media"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : t("content.media.deleteError")),
  });

  const items = media.data?.items ?? [];

  return (
    <Card data-testid="content-media-panel">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("content.media.title")}</CardTitle>
        {canEdit && (
          <>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
              className="hidden"
              data-testid="content-media-file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload.mutate(f);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              size="sm"
              data-testid="content-media-upload"
              disabled={upload.isPending}
              onClick={() => fileInput.current?.click()}
            >
              {upload.isPending ? t("content.media.uploading") : t("content.media.upload")}
            </Button>
          </>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">{t("content.media.hint")}</p>
        {error && (
          <div
            role="alert"
            data-testid="content-media-error"
            className="text-sm text-danger"
          >
            {error}
          </div>
        )}
        {media.isLoading ? (
          <p className="text-sm text-muted-foreground">{t("content.media.loading")}</p>
        ) : items.length === 0 ? (
          <p data-testid="content-media-empty" className="text-sm text-muted-foreground">
            {t("content.media.empty")}
          </p>
        ) : (
          <ul className="divide-y">
            {items.map((m) => (
              <li
                key={m.mediaId}
                data-testid="content-media-row"
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0">
                  <a
                    href={`/api/v1/content/media/${m.mediaId}`}
                    data-testid="content-media-download"
                    className="block truncate text-sm font-medium underline-offset-2 hover:underline"
                  >
                    {m.filename}
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {m.mime} · {fmtSize(m.sizeBytes)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {/* Copy the embed markdown with the ADMIN url: the admin
                      preview reads it on any status; the ESS handbook rewrites
                      it to /api/v1/me/content/media/ (published-only). */}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    data-testid="content-media-copy-markdown"
                    onClick={() => {
                      void navigator.clipboard.writeText(
                        `![${m.filename}](/api/v1/content/media/${m.mediaId})`,
                      );
                    }}
                  >
                    {t("content.media.copyMarkdown")}
                  </Button>
                  {canEdit && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      data-testid="content-media-delete"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(m.mediaId)}
                    >
                      {t("content.media.delete")}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
