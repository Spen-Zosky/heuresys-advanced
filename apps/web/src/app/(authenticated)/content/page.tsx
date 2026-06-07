"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, PageHeader } from "@heuresys/ui";
import type {
  ContentDocument,
  ContentDocumentListResponse,
  ContentCategory,
  ContentCategoryListResponse,
  ContentKind,
  ContentStatus,
  ContentBodyFormat,
} from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Option lists for the select inputs. Source of truth = @heuresys/shared
// Content*Enum + the migration 000086 CHECK constraints (RD-08 varchar+CHECK).
// Duplicated here as plain literals because apps/web can only import TYPES from
// @heuresys/shared — the barrel's `.js` re-exports don't resolve under the
// Next/Turbopack `transpilePackages` build for runtime VALUE imports. Keep in
// sync with packages/shared/src/schemas/content.ts.
const CONTENT_KINDS: readonly ContentKind[] = ["article", "policy", "announcement", "handbook", "process_doc"];
const CONTENT_STATUSES: readonly ContentStatus[] = ["draft", "in_review", "published", "archived"];
const CONTENT_FORMATS: readonly ContentBodyFormat[] = ["markdown", "html"];

interface CreateDocValues {
  title: string;
  kind: ContentKind;
  categoryId: string;
  bodyFormat: ContentBodyFormat;
  body: string;
  changeNote: string;
}
interface CreateCatValues {
  name: string;
  description: string;
}

const EMPTY_DOC: CreateDocValues = { title: "", kind: "article", categoryId: "", bodyFormat: "markdown", body: "", changeNote: "" };
const EMPTY_CAT: CreateCatValues = { name: "", description: "" };

function statusVariant(s: ContentStatus): "secondary" | "success" {
  return s === "published" ? "success" : "secondary";
}

export default function ContentPage() {
  const { t } = useTranslation("admin");
  const qc = useQueryClient();
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [q, setQ] = useState("");
  const [docFeedback, setDocFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [catFeedback, setCatFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (kind) p.set("kind", kind);
    if (status) p.set("status", status);
    if (categoryId) p.set("categoryId", categoryId);
    if (q) p.set("q", q);
    p.set("limit", "200");
    return p.toString();
  }, [kind, status, categoryId, q]);

  const docs = useQuery({
    queryKey: ["content", "list", kind, status, categoryId, q],
    queryFn: () => apiFetch<ContentDocumentListResponse>(`/v1/content?${queryString}`),
  });

  const cats = useQuery({
    queryKey: ["content", "categories"],
    queryFn: () => apiFetch<ContentCategoryListResponse>("/v1/content/categories"),
  });

  const catMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of cats.data?.items ?? []) m.set(c.categoryId, c.name);
    return m;
  }, [cats.data]);

  const createDoc = useMutation({
    mutationFn: (v: CreateDocValues) => {
      const body: Record<string, unknown> = { title: v.title, kind: v.kind, bodyFormat: v.bodyFormat };
      if (v.categoryId) body.categoryId = v.categoryId;
      if (v.body) body.body = v.body;
      if (v.changeNote) body.changeNote = v.changeNote;
      return apiFetch<ContentDocument>("/v1/content", { method: "POST", body });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["content", "list"] });
      setDocFeedback({ kind: "ok", msg: t("content.create.successMsg") });
      resetDoc(EMPTY_DOC);
    },
    onError: (err) => setDocFeedback({ kind: "err", msg: err instanceof Error ? err.message : t("content.create.errorUnexpected") }),
  });

  const createCat = useMutation({
    mutationFn: (v: CreateCatValues) => {
      const body: Record<string, unknown> = { name: v.name };
      if (v.description) body.description = v.description;
      return apiFetch<ContentCategory>("/v1/content/categories", { method: "POST", body });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["content", "categories"] });
      setCatFeedback({ kind: "ok", msg: t("content.categories.successMsg") });
      resetCat(EMPTY_CAT);
    },
    onError: (err) => setCatFeedback({ kind: "err", msg: err instanceof Error ? err.message : t("content.create.errorUnexpected") }),
  });

  const deleteCat = useMutation({
    mutationFn: (id: string) => apiFetch<{ deleted: true }>(`/v1/content/categories/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["content", "categories"] }),
  });

  const {
    register: regDoc,
    handleSubmit: handleSubmitDoc,
    reset: resetDoc,
    formState: { errors: docErrors, isSubmitting: docSubmitting },
  } = useForm<CreateDocValues>({ defaultValues: EMPTY_DOC });

  const {
    register: regCat,
    handleSubmit: handleSubmitCat,
    reset: resetCat,
    formState: { errors: catErrors, isSubmitting: catSubmitting },
  } = useForm<CreateCatValues>({ defaultValues: EMPTY_CAT });

  const onSubmitDoc = handleSubmitDoc(async (v) => {
    setDocFeedback(null);
    await createDoc.mutateAsync(v);
  });
  const onSubmitCat = handleSubmitCat(async (v) => {
    setCatFeedback(null);
    await createCat.mutateAsync(v);
  });

  const columns: DataColumn<ContentDocument>[] = useMemo(
    () => [
      {
        header: t("content.columns.title"),
        cell: (d) => (
          <Link href={`/content/${d.documentId}`} data-testid="content-row-link" className="font-medium text-foreground hover:underline">
            {d.title}
          </Link>
        ),
      },
      { header: t("content.columns.kind"), cell: (d) => <span className="text-muted-foreground">{t(`content.kind.${d.kind}`)}</span> },
      { header: t("content.columns.status"), cell: (d) => <Badge variant={statusVariant(d.status)}>{t(`content.status.${d.status}`)}</Badge> },
      {
        header: t("content.columns.category"),
        cell: (d) => <span className="text-muted-foreground">{d.categoryId ? catMap.get(d.categoryId) ?? "—" : "—"}</span>,
      },
      { header: t("content.columns.updated"), cell: (d) => <span className="text-xs text-muted-foreground">{d.updatedAt.slice(0, 10)}</span> },
    ],
    [t, catMap],
  );

  return (
    <main data-testid="content-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="content-title"
        title={t("content.title")}
        description={t("content.description")}
        badges={
          <Badge variant="secondary" data-testid="content-count">
            {docs.data ? t("content.count", { count: docs.data.total }) : t("common:loading")}
          </Badge>
        }
      />

      {/* Create document */}
      <Card>
        <CardHeader>
          <CardTitle>{t("content.create.cardTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            data-testid="content-create-form"
            onSubmit={(e) => {
              void onSubmitDoc(e);
            }}
            className="grid grid-cols-1 gap-3 md:grid-cols-2"
            noValidate
          >
            <div>
              <label htmlFor="content-title-input" className="mb-1 block text-sm font-medium text-foreground">
                {t("content.create.titleLabel")} <span aria-hidden="true">*</span>
              </label>
              <Input
                id="content-title-input"
                data-testid="content-create-title"
                aria-invalid={docErrors.title !== undefined}
                {...regDoc("title", { required: true, maxLength: 255 })}
              />
              {docErrors.title && <p className="mt-1 text-xs text-danger">{t("content.validation.required")}</p>}
            </div>
            <div>
              <label htmlFor="content-kind-input" className="mb-1 block text-sm font-medium text-foreground">
                {t("content.create.kindLabel")}
              </label>
              <select id="content-kind-input" data-testid="content-create-kind" className={SELECT_CLASS} {...regDoc("kind")}>
                {CONTENT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`content.kind.${k}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="content-category-input" className="mb-1 block text-sm font-medium text-foreground">
                {t("content.create.categoryLabel")}
              </label>
              <select id="content-category-input" data-testid="content-create-category" className={SELECT_CLASS} {...regDoc("categoryId")}>
                <option value="">{t("content.create.noCategory")}</option>
                {(cats.data?.items ?? []).map((c) => (
                  <option key={c.categoryId} value={c.categoryId}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="content-format-input" className="mb-1 block text-sm font-medium text-foreground">
                {t("content.create.formatLabel")}
              </label>
              <select id="content-format-input" data-testid="content-create-format" className={SELECT_CLASS} {...regDoc("bodyFormat")}>
                {CONTENT_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {t(`content.format.${f}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="content-body-input" className="mb-1 block text-sm font-medium text-foreground">
                {t("content.create.bodyLabel")}
              </label>
              <textarea id="content-body-input" data-testid="content-create-body" rows={6} className={SELECT_CLASS} {...regDoc("body")} />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="content-changenote-input" className="mb-1 block text-sm font-medium text-foreground">
                {t("content.create.changeNoteLabel")}
              </label>
              <Input id="content-changenote-input" data-testid="content-create-changenote" {...regDoc("changeNote")} />
            </div>
            <div className="flex items-center gap-3 md:col-span-2">
              <Button type="submit" data-testid="content-create-submit" disabled={docSubmitting || createDoc.isPending}>
                {docSubmitting || createDoc.isPending ? t("content.create.submitting") : t("content.create.submit")}
              </Button>
              {docFeedback && (
                <p
                  data-testid={docFeedback.kind === "ok" ? "content-create-success" : "content-create-error"}
                  className={docFeedback.kind === "ok" ? "text-sm font-medium text-success" : "text-sm font-medium text-danger"}
                  role={docFeedback.kind === "err" ? "alert" : undefined}
                >
                  {docFeedback.msg}
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Filters */}
      <div data-testid="content-filters" className="flex flex-wrap items-end gap-3">
        <div className="w-44">
          <label htmlFor="content-filter-kind" className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("content.columns.kind")}
          </label>
          <select id="content-filter-kind" data-testid="content-filter-kind" className={SELECT_CLASS} value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">{t("content.filters.kindAll")}</option>
            {CONTENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`content.kind.${k}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="w-44">
          <label htmlFor="content-filter-status" className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("content.columns.status")}
          </label>
          <select id="content-filter-status" data-testid="content-filter-status" className={SELECT_CLASS} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t("content.filters.statusAll")}</option>
            {CONTENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`content.status.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="w-52">
          <label htmlFor="content-filter-category" className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("content.columns.category")}
          </label>
          <select id="content-filter-category" data-testid="content-filter-category" className={SELECT_CLASS} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">{t("content.filters.categoryAll")}</option>
            {(cats.data?.items ?? []).map((c) => (
              <option key={c.categoryId} value={c.categoryId}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-52 flex-1">
          <label htmlFor="content-filter-q" className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("content.filters.searchLabel")}
          </label>
          <Input
            id="content-filter-q"
            data-testid="content-filter-q"
            placeholder={t("content.filters.searchPlaceholder")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {/* Documents table */}
      <div data-testid="content-table">
        <EntityTable<ContentDocument>
          isLoading={docs.isLoading}
          isError={docs.isError}
          errorMessage={t("content.errorMessage")}
          rows={docs.data?.items ?? []}
          rowKey={(d) => d.documentId}
          rowTestId="content-row"
          columns={columns}
          emptyTestId="content-empty"
          emptyTitle={t("content.emptyTitle")}
          emptyDescription={t("content.emptyDescription")}
          caption={t("content.caption")}
        />
      </div>

      {/* Categories */}
      <Card data-testid="content-categories">
        <CardHeader>
          <CardTitle>{t("content.categories.cardTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            data-testid="content-category-form"
            onSubmit={(e) => {
              void onSubmitCat(e);
            }}
            className="grid grid-cols-1 gap-3 md:grid-cols-3"
            noValidate
          >
            <div>
              <label htmlFor="cat-name-input" className="mb-1 block text-sm font-medium text-foreground">
                {t("content.categories.nameLabel")} <span aria-hidden="true">*</span>
              </label>
              <Input id="cat-name-input" data-testid="content-category-name" aria-invalid={catErrors.name !== undefined} {...regCat("name", { required: true, maxLength: 255 })} />
              {catErrors.name && <p className="mt-1 text-xs text-danger">{t("content.validation.required")}</p>}
            </div>
            <div className="md:col-span-2">
              <label htmlFor="cat-desc-input" className="mb-1 block text-sm font-medium text-foreground">
                {t("content.categories.descriptionLabel")}
              </label>
              <Input id="cat-desc-input" data-testid="content-category-desc" {...regCat("description")} />
            </div>
            <div className="flex items-center gap-3 md:col-span-3">
              <Button type="submit" data-testid="content-category-submit" disabled={catSubmitting || createCat.isPending}>
                {catSubmitting || createCat.isPending ? t("content.categories.submitting") : t("content.categories.submit")}
              </Button>
              {catFeedback && (
                <p
                  data-testid={catFeedback.kind === "ok" ? "content-category-success" : "content-category-error"}
                  className={catFeedback.kind === "ok" ? "text-sm font-medium text-success" : "text-sm font-medium text-danger"}
                  role={catFeedback.kind === "err" ? "alert" : undefined}
                >
                  {catFeedback.msg}
                </p>
              )}
            </div>
          </form>

          {(cats.data?.items ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("content.categories.empty")}</p>
          ) : (
            <ul className="divide-y divide-border rounded-card border border-border">
              {(cats.data?.items ?? []).map((c) => (
                <li key={c.categoryId} data-testid="content-category-row" className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                  <span className="font-medium text-foreground">{c.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{c.slug ?? "—"}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid="content-category-delete"
                    disabled={deleteCat.isPending}
                    onClick={() => deleteCat.mutate(c.categoryId)}
                  >
                    {t("content.categories.delete")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
