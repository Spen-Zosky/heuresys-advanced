"use client";

/**
 * Famiglie professionali: elenco, creazione, modifica (#43 — linea C2).
 *
 * `job-families` era uno dei due moduli API del catalogo senza ALCUNA pagina:
 * 5 endpoint scritti, testati e irraggiungibili da un browser.
 *
 * Le famiglie sono l'ossatura del catalogo mansioni — ogni ruolo professionale
 * ne discende — quindi stanno in cima alla pagina, prima dei ruoli.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import type { JobFamily } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";

const LIST_LIMIT = 200;

interface FamilyForm {
  code: string;
  name: string;
  description: string;
}

const orNull = (v: string): string | null => (v.trim() === "" ? null : v.trim());

function messaggioErrore(err: unknown, t: (k: string) => string): string {
  if (isApiError(err)) {
    if (err.status === 403) return t("jobCatalog.forbidden");
    if (err.status === 409) return t("jobCatalog.duplicate");
  }
  return t("jobCatalog.saveError");
}

export function JobFamiliesPanel() {
  const { t } = useTranslation("admin");
  const qc = useQueryClient();
  const perms = new Set(useCurrentUserPermissions().data?.permissions ?? []);
  const canCreate = perms.has("job_family:create");
  const canUpdate = perms.has("job_family:update");

  const [editing, setEditing] = useState<JobFamily | null>(null);
  // 27 famiglie oggi, ma il catalogo cresce: la ricerca la fa il server
  // (l'API la offre) invece di filtrare una pagina gia' impaginata.
  const [cerca, setCerca] = useState("");

  const families = useQuery({
    queryKey: ["job-families", "list", cerca],
    queryFn: () =>
      apiFetch<{ items: JobFamily[] }>(
        `/v1/job-families?limit=${LIST_LIMIT}${cerca.trim() ? `&search=${encodeURIComponent(cerca.trim())}` : ""}`,
      ),
  });

  const createForm = useForm<FamilyForm>({ defaultValues: { code: "", name: "", description: "" } });
  const editForm = useForm<FamilyForm>({
    values: editing
      ? { code: editing.code, name: editing.name, description: editing.description ?? "" }
      : undefined,
  });

  const create = useMutation({
    mutationFn: (v: FamilyForm) =>
      apiFetch<JobFamily>("/v1/job-families", {
        method: "POST",
        body: { code: v.code.trim(), name: v.name.trim(), description: orNull(v.description) },
      }),
    onSuccess: () => {
      createForm.reset({ code: "", name: "", description: "" });
      void qc.invalidateQueries({ queryKey: ["job-families"] });
    },
  });

  const save = useMutation({
    // `code` è immutabile sull'API (UpdateJobFamilyBody non lo prevede): il
    // form lo mostra ma non lo invia, così non si promette ciò che non si può.
    mutationFn: (v: FamilyForm) =>
      apiFetch<JobFamily>(`/v1/job-families/${editing!.jobFamilyId}`, {
        method: "PATCH",
        body: { name: v.name.trim(), description: orNull(v.description) },
      }),
    onSuccess: () => {
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["job-families"] });
    },
  });

  const columns: DataColumn<JobFamily>[] = [
    { header: t("jobCatalog.family.code"), cell: (f) => <span className="font-mono text-xs">{f.code}</span> },
    { header: t("jobCatalog.family.name"), cell: (f) => <span className="font-medium text-foreground">{f.name}</span> },
    {
      header: t("jobCatalog.family.description"),
      cell: (f) => <span className="text-sm text-muted-foreground">{f.description ?? t("jobCatalog.dash")}</span>,
    },
    ...(canUpdate
      ? [
          {
            header: t("common:actions"),
            cell: (f: JobFamily) => (
              <Button type="button" variant="outline" data-testid={`family-edit-${f.code}`} onClick={() => setEditing(f)}>
                {t("jobCatalog.edit")}
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <Card data-testid="job-families-panel">
      <CardHeader>
        <CardTitle>
          {t("jobCatalog.family.title")}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {families.data?.items.length ?? 0}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-sm">
          <label htmlFor="family-search" className="mb-1 block text-sm font-medium text-foreground">
            {t("jobCatalog.search")}
          </label>
          <Input
            id="family-search"
            data-testid="family-search"
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
            placeholder={t("jobCatalog.searchPlaceholder")}
          />
        </div>

        <EntityTable<JobFamily>
          isLoading={families.isLoading}
          isError={families.isError}
          errorMessage={t("jobCatalog.loadError")}
          rows={families.data?.items ?? []}
          rowKey={(f) => f.jobFamilyId}
          rowTestId="family-row"
          columns={columns}
          emptyTestId="job-families-empty"
          emptyTitle={t("jobCatalog.family.emptyTitle")}
          caption={t("jobCatalog.family.caption")}
        />

        {canCreate && !editing && (
          <form
            data-testid="family-create-form"
            className="grid grid-cols-1 gap-3 border-t pt-4 md:grid-cols-3"
            noValidate
            onSubmit={(e) => {
              void createForm.handleSubmit((v) => create.mutateAsync(v).catch(() => undefined))(e);
            }}
          >
            <div>
              <label htmlFor="fam-code" className="mb-1 block text-sm font-medium text-foreground">
                {t("jobCatalog.family.code")} <span aria-hidden="true">*</span>
              </label>
              <Input id="fam-code" data-testid="family-create-code" {...createForm.register("code", { required: true, maxLength: 64 })} />
            </div>
            <div>
              <label htmlFor="fam-name" className="mb-1 block text-sm font-medium text-foreground">
                {t("jobCatalog.family.name")} <span aria-hidden="true">*</span>
              </label>
              <Input id="fam-name" data-testid="family-create-name" {...createForm.register("name", { required: true, maxLength: 255 })} />
            </div>
            <div>
              <label htmlFor="fam-desc" className="mb-1 block text-sm font-medium text-foreground">
                {t("jobCatalog.family.description")}
              </label>
              <Input id="fam-desc" data-testid="family-create-description" {...createForm.register("description", { maxLength: 2048 })} />
            </div>
            <div className="flex items-center gap-3 md:col-span-3">
              <Button type="submit" data-testid="family-create-submit" disabled={create.isPending}>
                {create.isPending ? t("common:saving") : t("jobCatalog.family.create")}
              </Button>
              {create.isError && (
                <span data-testid="family-create-error" className="text-sm text-danger">
                  {messaggioErrore(create.error, t)}
                </span>
              )}
            </div>
          </form>
        )}

        {editing && (
          <form
            data-testid="family-edit-form"
            className="grid grid-cols-1 gap-3 border-t pt-4 md:grid-cols-3"
            noValidate
            onSubmit={(e) => {
              void editForm.handleSubmit((v) => save.mutateAsync(v).catch(() => undefined))(e);
            }}
          >
            <div>
              <label htmlFor="fam-edit-code" className="mb-1 block text-sm font-medium text-foreground">
                {t("jobCatalog.family.code")}
              </label>
              <Input id="fam-edit-code" data-testid="family-edit-code" disabled {...editForm.register("code")} />
              <p className="mt-1 text-xs text-muted-foreground">{t("jobCatalog.codeImmutable")}</p>
            </div>
            <div>
              <label htmlFor="fam-edit-name" className="mb-1 block text-sm font-medium text-foreground">
                {t("jobCatalog.family.name")} <span aria-hidden="true">*</span>
              </label>
              <Input id="fam-edit-name" data-testid="family-edit-name" {...editForm.register("name", { required: true, maxLength: 255 })} />
            </div>
            <div>
              <label htmlFor="fam-edit-desc" className="mb-1 block text-sm font-medium text-foreground">
                {t("jobCatalog.family.description")}
              </label>
              <Input id="fam-edit-desc" data-testid="family-edit-description" {...editForm.register("description", { maxLength: 2048 })} />
            </div>
            <div className="flex items-center gap-3 md:col-span-3">
              <Button type="submit" data-testid="family-edit-save" disabled={save.isPending}>
                {save.isPending ? t("common:saving") : t("jobCatalog.save")}
              </Button>
              <Button type="button" variant="outline" data-testid="family-edit-cancel" onClick={() => setEditing(null)}>
                {t("jobCatalog.cancel")}
              </Button>
              {save.isError && (
                <span data-testid="family-edit-error" className="text-sm text-danger">
                  {messaggioErrore(save.error, t)}
                </span>
              )}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
