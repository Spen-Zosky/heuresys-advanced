"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, PageHeader } from "@heuresys/ui";
import type {
  ContentDocument,
  ContentDocumentDetailResponse,
  ContentCategoryListResponse,
  ContentVersion,
  ContentVersionListResponse,
  ContentKind,
  ContentBodyFormat,
  ContentStatus,
} from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Option lists for the select inputs — see content/page.tsx for why these are
// local literals (apps/web can only import TYPES from @heuresys/shared). Keep in
// sync with packages/shared/src/schemas/content.ts.
const CONTENT_KINDS: readonly ContentKind[] = ["article", "policy", "announcement", "handbook", "process_doc"];
const CONTENT_FORMATS: readonly ContentBodyFormat[] = ["markdown", "html"];

interface EditValues {
  title: string;
  kind: ContentKind;
  categoryId: string;
  bodyFormat: ContentBodyFormat;
  body: string;
  changeNote: string;
}

function statusVariant(s: ContentStatus): "secondary" | "success" {
  return s === "published" ? "success" : "secondary";
}

export default function ContentEditPage() {
  const { t } = useTranslation("admin");
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const qc = useQueryClient();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const detail = useQuery({
    queryKey: ["content", "doc", id],
    queryFn: () => apiFetch<ContentDocumentDetailResponse>(`/v1/content/${id}`),
  });
  const versions = useQuery({
    queryKey: ["content", "versions", id],
    queryFn: () => apiFetch<ContentVersionListResponse>(`/v1/content/${id}/versions`),
  });
  const cats = useQuery({
    queryKey: ["content", "categories"],
    queryFn: () => apiFetch<ContentCategoryListResponse>("/v1/content/categories"),
  });

  const formValues = useMemo<EditValues | undefined>(() => {
    const d = detail.data?.document;
    if (!d) return undefined;
    return {
      title: d.title,
      kind: d.kind,
      categoryId: d.categoryId ?? "",
      bodyFormat: d.bodyFormat,
      body: detail.data?.currentVersion?.body ?? d.body ?? "",
      changeNote: "",
    };
  }, [detail.data]);

  const save = useMutation({
    mutationFn: (v: EditValues) => {
      const body: Record<string, unknown> = {
        title: v.title,
        kind: v.kind,
        bodyFormat: v.bodyFormat,
        categoryId: v.categoryId ? v.categoryId : null,
        body: v.body,
      };
      if (v.changeNote) body.changeNote = v.changeNote;
      return apiFetch<ContentDocument>(`/v1/content/${id}`, { method: "PATCH", body });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["content", "doc", id] });
      void qc.invalidateQueries({ queryKey: ["content", "versions", id] });
      void qc.invalidateQueries({ queryKey: ["content", "list"] });
      setFeedback({ kind: "ok", msg: t("content.detail.saveSuccess") });
    },
    onError: (err) => setFeedback({ kind: "err", msg: err instanceof Error ? err.message : t("content.detail.errorUnexpected") }),
  });

  const remove = useMutation({
    mutationFn: () => apiFetch<{ outcome: "archived" | "deleted" }>(`/v1/content/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["content", "list"] });
      router.push("/content");
    },
    onError: (err) => setFeedback({ kind: "err", msg: err instanceof Error ? err.message : t("content.detail.errorUnexpected") }),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditValues>({
    defaultValues: { title: "", kind: "article", categoryId: "", bodyFormat: "markdown", body: "", changeNote: "" },
    values: formValues,
  });

  const onSubmit = handleSubmit(async (v) => {
    setFeedback(null);
    await save.mutateAsync(v);
  });

  const currentVersionId = detail.data?.document.currentVersionId ?? null;
  const versionColumns: DataColumn<ContentVersion>[] = useMemo(
    () => [
      {
        header: t("content.detail.vCols.version"),
        cell: (v) => (
          <span className="flex items-center gap-2">
            <span className="font-mono text-foreground">{t("content.detail.vCols.versionValue", { n: v.versionNumber })}</span>
            {v.versionId === currentVersionId && (
              <Badge variant="success" data-testid="content-version-current">
                {t("content.detail.currentBadge")}
              </Badge>
            )}
          </span>
        ),
      },
      { header: t("content.detail.vCols.title"), cell: (v) => <span className="text-foreground">{v.title ?? "—"}</span> },
      { header: t("content.detail.vCols.changeNote"), cell: (v) => <span className="text-muted-foreground">{v.changeNote ?? "—"}</span> },
      { header: t("content.detail.vCols.author"), cell: (v) => <span className="font-mono text-xs text-muted-foreground">{v.authorUserId ? v.authorUserId.slice(0, 8) : "—"}</span> },
      { header: t("content.detail.vCols.created"), cell: (v) => <span className="text-xs text-muted-foreground">{v.createdAt.slice(0, 10)}</span> },
    ],
    [t, currentVersionId],
  );

  if (detail.isError) {
    return (
      <main data-testid="content-edit-page" className="mx-auto max-w-3xl space-y-4 px-6 py-8">
        <Link href="/content" data-testid="content-edit-back" className="inline-flex text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          {t("content.detail.back")}
        </Link>
        <p className="text-sm text-danger">{t("content.detail.notFound")}</p>
      </main>
    );
  }

  const doc = detail.data?.document;

  return (
    <main data-testid="content-edit-page" className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <div className="space-y-3">
        <Link href="/content" data-testid="content-edit-back" className="inline-flex text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          {t("content.detail.back")}
        </Link>
        <PageHeader
          data-testid="content-edit-title"
          title={doc?.title ?? t("common:loading")}
          description={t("content.detail.editCardTitle")}
          badges={
            doc ? (
              <Badge variant={statusVariant(doc.status)} data-testid="content-edit-status">
                {t(`content.status.${doc.status}`)}
              </Badge>
            ) : undefined
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("content.detail.editCardTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            data-testid="content-edit-form"
            onSubmit={(e) => {
              void onSubmit(e);
            }}
            className="grid grid-cols-1 gap-3 md:grid-cols-2"
            noValidate
          >
            <div className="md:col-span-2">
              <label htmlFor="edit-title-input" className="mb-1 block text-sm font-medium text-foreground">
                {t("content.create.titleLabel")} <span aria-hidden="true">*</span>
              </label>
              <Input id="edit-title-input" data-testid="content-edit-title-input" aria-invalid={errors.title !== undefined} {...register("title", { required: true, maxLength: 255 })} />
              {errors.title && <p className="mt-1 text-xs text-danger">{t("content.validation.required")}</p>}
            </div>
            <div>
              <label htmlFor="edit-kind-input" className="mb-1 block text-sm font-medium text-foreground">
                {t("content.create.kindLabel")}
              </label>
              <select id="edit-kind-input" data-testid="content-edit-kind" className={SELECT_CLASS} {...register("kind")}>
                {CONTENT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`content.kind.${k}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="edit-category-input" className="mb-1 block text-sm font-medium text-foreground">
                {t("content.create.categoryLabel")}
              </label>
              <select id="edit-category-input" data-testid="content-edit-category" className={SELECT_CLASS} {...register("categoryId")}>
                <option value="">{t("content.detail.noCategory")}</option>
                {(cats.data?.items ?? []).map((c) => (
                  <option key={c.categoryId} value={c.categoryId}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="edit-format-input" className="mb-1 block text-sm font-medium text-foreground">
                {t("content.create.formatLabel")}
              </label>
              <select id="edit-format-input" data-testid="content-edit-format" className={SELECT_CLASS} {...register("bodyFormat")}>
                {CONTENT_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {t(`content.format.${f}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="edit-body-input" className="mb-1 block text-sm font-medium text-foreground">
                {t("content.create.bodyLabel")}
              </label>
              <textarea id="edit-body-input" data-testid="content-edit-body" rows={10} className={SELECT_CLASS} {...register("body")} />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="edit-changenote-input" className="mb-1 block text-sm font-medium text-foreground">
                {t("content.create.changeNoteLabel")}
              </label>
              <Input id="edit-changenote-input" data-testid="content-edit-changenote" {...register("changeNote")} />
            </div>
            <div className="flex flex-wrap items-center gap-3 md:col-span-2">
              <Button type="submit" data-testid="content-edit-submit" disabled={isSubmitting || save.isPending || !doc}>
                {isSubmitting || save.isPending ? t("content.detail.saving") : t("content.detail.save")}
              </Button>
              <Button
                type="button"
                variant="outline"
                data-testid="content-delete"
                disabled={remove.isPending || !doc}
                onClick={() => remove.mutate()}
              >
                {remove.isPending ? t("content.detail.deleting") : t("content.detail.delete")}
              </Button>
              {feedback && (
                <p
                  data-testid={feedback.kind === "ok" ? "content-edit-success" : "content-edit-error"}
                  className={feedback.kind === "ok" ? "text-sm font-medium text-success" : "text-sm font-medium text-danger"}
                  role={feedback.kind === "err" ? "alert" : undefined}
                >
                  {feedback.msg}
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("content.detail.versionsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div data-testid="content-versions-table">
            <EntityTable<ContentVersion>
              isLoading={versions.isLoading}
              isError={versions.isError}
              errorMessage={t("content.detail.loadError")}
              rows={versions.data?.items ?? []}
              rowKey={(v) => v.versionId}
              rowTestId="content-version-row"
              columns={versionColumns}
              emptyTestId="content-versions-empty"
              emptyTitle={t("content.detail.versionsEmpty")}
              caption={t("content.detail.versionsCaption")}
            />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
