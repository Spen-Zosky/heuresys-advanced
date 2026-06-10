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
  LinksForDocumentResponse,
  ContentBlueprintLinkRole,
  BlueprintProcess,
} from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";

type WorkflowAction = "submit-for-review" | "publish" | "unpublish" | "return-to-draft";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Option lists for the select inputs — see content/page.tsx for why these are
// local literals (apps/web can only import TYPES from @heuresys/shared). Keep in
// sync with packages/shared/src/schemas/content.ts.
const CONTENT_KINDS: readonly ContentKind[] = ["article", "policy", "announcement", "handbook", "process_doc"];
const CONTENT_FORMATS: readonly ContentBodyFormat[] = ["markdown", "html"];
const LINK_ROLES: readonly ContentBlueprintLinkRole[] = ["documentation", "policy", "procedure", "reference"];

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
  const [linkProcessId, setLinkProcessId] = useState("");
  const [linkRole, setLinkRole] = useState<ContentBlueprintLinkRole>("documentation");

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
  // cap④ P3: blueprint cross-links for this document + the process catalog for the attach select.
  const links = useQuery({
    queryKey: ["content", "links", id],
    queryFn: () => apiFetch<LinksForDocumentResponse>(`/v1/content-blueprint-links/by-document?documentId=${id}`),
  });
  const processes = useQuery({
    queryKey: ["blueprint-processes", "all"],
    queryFn: () => apiFetch<{ items: BlueprintProcess[]; total: number }>("/v1/blueprint-processes?limit=500"),
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

  const perms = useCurrentUserPermissions();
  const can = useMemo(() => {
    const set = new Set(perms.data?.permissions ?? []);
    return { update: set.has("content:update"), publish: set.has("content:publish") };
  }, [perms.data]);

  const invalidateDoc = () => {
    void qc.invalidateQueries({ queryKey: ["content", "doc", id] });
    void qc.invalidateQueries({ queryKey: ["content", "versions", id] });
    void qc.invalidateQueries({ queryKey: ["content", "list"] });
  };

  // Publish-workflow transitions (in_review chain). Bodyless POST → apiFetch adds the
  // CSRF header automatically; the server enforces the valid-transition + RBAC gates.
  const transition = useMutation({
    mutationFn: (action: WorkflowAction) => apiFetch<ContentDocument>(`/v1/content/${id}/${action}`, { method: "POST" }),
    onSuccess: () => { invalidateDoc(); setFeedback({ kind: "ok", msg: t("content.detail.workflowSuccess") }); },
    onError: (err) => setFeedback({ kind: "err", msg: err instanceof Error ? err.message : t("content.detail.errorUnexpected") }),
  });

  const restore = useMutation({
    mutationFn: (versionId: string) => apiFetch<ContentDocument>(`/v1/content/${id}/versions/${versionId}/restore`, { method: "POST" }),
    onSuccess: () => { invalidateDoc(); setFeedback({ kind: "ok", msg: t("content.detail.restoreSuccess") }); },
    onError: (err) => setFeedback({ kind: "err", msg: err instanceof Error ? err.message : t("content.detail.errorUnexpected") }),
  });

  const attachLink = useMutation({
    mutationFn: (v: { blueprintProcessId: string; role: ContentBlueprintLinkRole }) =>
      apiFetch(`/v1/content-blueprint-links`, { method: "POST", body: { documentId: id, blueprintProcessId: v.blueprintProcessId, role: v.role } }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["content", "links", id] }); setLinkProcessId(""); setFeedback({ kind: "ok", msg: t("content.links.attachSuccess") }); },
    onError: (err) => setFeedback({ kind: "err", msg: err instanceof Error ? err.message : t("content.detail.errorUnexpected") }),
  });
  const detachLink = useMutation({
    mutationFn: (linkId: string) => apiFetch(`/v1/content-blueprint-links/${linkId}`, { method: "DELETE" }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["content", "links", id] }); },
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
      {
        header: t("content.detail.vCols.actions"),
        align: "right",
        cell: (v) =>
          v.versionId === currentVersionId ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="content-version-restore"
              disabled={restore.isPending}
              onClick={() => restore.mutate(v.versionId)}
            >
              {t("content.detail.restore")}
            </Button>
          ),
      },
    ],
    [t, currentVersionId, restore],
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

      {doc && (
        <Card data-testid="content-workflow">
          <CardHeader>
            <CardTitle>{t("content.detail.workflowTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">{t("content.detail.statusLabel")}</span>
            <Badge variant={statusVariant(doc.status)} data-testid="content-workflow-status">
              {t(`content.status.${doc.status}`)}
            </Badge>
            {doc.status === "draft" && can.update && (
              <Button type="button" data-testid="content-submit-review" disabled={transition.isPending} onClick={() => transition.mutate("submit-for-review")}>
                {t("content.detail.submitReview")}
              </Button>
            )}
            {doc.status === "in_review" && can.publish && (
              <>
                <Button type="button" data-testid="content-publish" disabled={transition.isPending} onClick={() => transition.mutate("publish")}>
                  {t("content.detail.publish")}
                </Button>
                <Button type="button" variant="outline" data-testid="content-return-draft" disabled={transition.isPending} onClick={() => transition.mutate("return-to-draft")}>
                  {t("content.detail.returnToDraft")}
                </Button>
              </>
            )}
            {doc.status === "published" && can.publish && (
              <Button type="button" variant="outline" data-testid="content-unpublish" disabled={transition.isPending} onClick={() => transition.mutate("unpublish")}>
                {t("content.detail.unpublish")}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

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

      <ContentMediaPanel documentId={id} canEdit={can.update} />

      <Card data-testid="content-links">
        <CardHeader>
          <CardTitle>{t("content.links.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {can.update && (
            <form
              data-testid="content-link-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (linkProcessId) attachLink.mutate({ blueprintProcessId: linkProcessId, role: linkRole });
              }}
              className="flex flex-wrap items-end gap-3"
            >
              <div className="min-w-64 flex-1">
                <label htmlFor="link-process" className="mb-1 block text-xs font-medium text-muted-foreground">{t("content.links.process")}</label>
                <select id="link-process" data-testid="content-link-process" className={SELECT_CLASS} value={linkProcessId} onChange={(e) => setLinkProcessId(e.target.value)}>
                  <option value="">{t("content.links.selectProcess")}</option>
                  {(processes.data?.items ?? []).map((p) => (
                    <option key={p.blueprintProcessId} value={p.blueprintProcessId}>
                      {p.code} · {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-44">
                <label htmlFor="link-role" className="mb-1 block text-xs font-medium text-muted-foreground">{t("content.links.role")}</label>
                <select id="link-role" data-testid="content-link-role" className={SELECT_CLASS} value={linkRole} onChange={(e) => setLinkRole(e.target.value as ContentBlueprintLinkRole)}>
                  {LINK_ROLES.map((r) => (
                    <option key={r} value={r}>{t(`content.links.roles.${r}`)}</option>
                  ))}
                </select>
              </div>
              <Button type="submit" data-testid="content-link-attach" disabled={!linkProcessId || attachLink.isPending}>
                {t("content.links.attach")}
              </Button>
            </form>
          )}

          {(links.data?.items ?? []).length === 0 ? (
            <p data-testid="content-links-empty" className="text-sm text-muted-foreground">{t("content.links.empty")}</p>
          ) : (
            <ul data-testid="content-links-list" className="divide-y divide-border rounded-card border border-border">
              {(links.data?.items ?? []).map((l) => (
                <li key={l.linkId} data-testid="content-link-row" className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{l.blueprintProcessName}</span>
                    <span className="font-mono text-xs text-muted-foreground">{l.blueprintProcessCode}</span>
                    <Badge variant="secondary">{t(`content.links.roles.${l.role}`)}</Badge>
                  </span>
                  {can.update && (
                    <Button type="button" variant="outline" size="sm" data-testid="content-link-detach" disabled={detachLink.isPending} onClick={() => detachLink.mutate(l.linkId)}>
                      {t("content.links.detach")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
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
import { ContentMediaPanel } from "../../../../components/ContentMediaPanel";
