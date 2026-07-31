"use client";

/**
 * Ruoli professionali: elenco, creazione, modifica (#43 — linea C2).
 *
 * Secondo dei due moduli del catalogo mansioni rimasti senza pagina.
 *
 * Una sfumatura del contratto, rispettata invece che nascosta: in creazione la
 * famiglia può essere NULLA (ADR-0015: i ruoli importati dal vecchio sistema
 * possono non averla), ma in modifica l'API accetta solo un identificativo —
 * non permette di TOGLIERLA. Quindi il menù, in modifica, non offre un'opzione
 * vuota quando la famiglia c'è già, e se manca lasciare il campo vuoto
 * significa "non toccare": il campo viene omesso dalla richiesta, non inviato
 * nullo (che l'API rifiuterebbe).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import type { JobFamily, JobRole, JobRoleSeniority } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { useEnumLabel } from "@/lib/enum-labels";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Lista locale: il web importa TIPI, non valori.
const SENIORITIES: readonly JobRoleSeniority[] = ["ENTRY", "JUNIOR", "MID", "SENIOR", "LEAD", "EXECUTIVE"];

const LIST_LIMIT = 200;

interface RoleForm {
  code: string;
  name: string;
  description: string;
  jobFamilyId: string;
  seniorityLevel: string;
}

const orNull = (v: string): string | null => (v.trim() === "" ? null : v.trim());

function messaggioErrore(err: unknown, t: (k: string) => string): string {
  if (isApiError(err)) {
    if (err.status === 403) return t("jobCatalog.forbidden");
    if (err.status === 409) return t("jobCatalog.duplicate");
  }
  return t("jobCatalog.saveError");
}

export function JobRolesPanel() {
  const { t } = useTranslation("admin");
  const enumLabel = useEnumLabel();
  const qc = useQueryClient();
  const perms = new Set(useCurrentUserPermissions().data?.permissions ?? []);
  const canCreate = perms.has("job_role:create");
  const canUpdate = perms.has("job_role:update");

  const [editing, setEditing] = useState<JobRole | null>(null);
  // 137 ruoli: senza ricerca la tabella li impagina e trovarne uno per
  // modificarlo diventa una caccia. Filtri lato SERVER (l'API li offre).
  const [cerca, setCerca] = useState("");
  const [filtroFamiglia, setFiltroFamiglia] = useState("");

  const roles = useQuery({
    queryKey: ["job-roles", "list", cerca, filtroFamiglia],
    queryFn: () => {
      const q = new URLSearchParams({ limit: String(LIST_LIMIT) });
      if (cerca.trim()) q.set("search", cerca.trim());
      if (filtroFamiglia) q.set("jobFamilyId", filtroFamiglia);
      return apiFetch<{ items: JobRole[] }>(`/v1/job-roles?${q.toString()}`);
    },
  });
  const families = useQuery({
    queryKey: ["job-families", "list"],
    queryFn: () => apiFetch<{ items: JobFamily[] }>(`/v1/job-families?limit=${LIST_LIMIT}`),
  });

  const nomeFamiglia = (id: string | null): string =>
    id ? (families.data?.items.find((f) => f.jobFamilyId === id)?.name ?? t("jobCatalog.dash")) : t("jobCatalog.dash");

  const createForm = useForm<RoleForm>({
    defaultValues: { code: "", name: "", description: "", jobFamilyId: "", seniorityLevel: "" },
  });
  const editForm = useForm<RoleForm>({
    values: editing
      ? {
          code: editing.code,
          name: editing.name,
          description: editing.description ?? "",
          jobFamilyId: editing.jobFamilyId ?? "",
          seniorityLevel: editing.seniorityLevel ?? "",
        }
      : undefined,
  });

  const create = useMutation({
    mutationFn: (v: RoleForm) =>
      apiFetch<JobRole>("/v1/job-roles", {
        method: "POST",
        body: {
          code: v.code.trim(),
          name: v.name.trim(),
          description: orNull(v.description),
          jobFamilyId: orNull(v.jobFamilyId),
          seniorityLevel: orNull(v.seniorityLevel),
        },
      }),
    onSuccess: () => {
      createForm.reset({ code: "", name: "", description: "", jobFamilyId: "", seniorityLevel: "" });
      void qc.invalidateQueries({ queryKey: ["job-roles"] });
    },
  });

  const save = useMutation({
    mutationFn: (v: RoleForm) => {
      const body: Record<string, unknown> = {
        name: v.name.trim(),
        description: orNull(v.description),
        seniorityLevel: orNull(v.seniorityLevel),
      };
      // Vedi la nota in testa: la famiglia si può impostare o cambiare, non
      // togliere. Campo vuoto = "non toccare" → si omette dalla richiesta.
      if (v.jobFamilyId.trim() !== "") body.jobFamilyId = v.jobFamilyId.trim();
      return apiFetch<JobRole>(`/v1/job-roles/${editing!.jobRoleId}`, { method: "PATCH", body });
    },
    onSuccess: () => {
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["job-roles"] });
    },
  });

  const columns: DataColumn<JobRole>[] = [
    { header: t("jobCatalog.role.code"), cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { header: t("jobCatalog.role.name"), cell: (r) => <span className="font-medium text-foreground">{r.name}</span> },
    {
      header: t("jobCatalog.role.family"),
      cell: (r) => <span className="text-sm text-muted-foreground">{nomeFamiglia(r.jobFamilyId)}</span>,
    },
    {
      header: t("jobCatalog.role.seniority"),
      cell: (r) => (
        <span className="text-xs uppercase text-muted-foreground">
          {r.seniorityLevel ? enumLabel("jobRoleSeniority", r.seniorityLevel) : t("jobCatalog.dash")}
        </span>
      ),
    },
    ...(canUpdate
      ? [
          {
            header: t("common:actions"),
            cell: (r: JobRole) => (
              <Button type="button" variant="outline" data-testid={`role-edit-${r.code}`} onClick={() => setEditing(r)}>
                {t("jobCatalog.edit")}
              </Button>
            ),
          },
        ]
      : []),
  ];

  const opzioniFamiglia = (families.data?.items ?? []).map((f) => (
    <option key={f.jobFamilyId} value={f.jobFamilyId}>
      {f.name}
    </option>
  ));
  const opzioniSeniority = SENIORITIES.map((s) => (
    <option key={s} value={s}>
      {enumLabel("jobRoleSeniority", s)}
    </option>
  ));

  return (
    <Card data-testid="job-roles-panel">
      <CardHeader>
        <CardTitle>
          {t("jobCatalog.role.title")}
          <span className="ml-2 text-sm font-normal text-muted-foreground">{roles.data?.items.length ?? 0}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <div className="min-w-56 flex-1">
            <label htmlFor="role-search" className="mb-1 block text-sm font-medium text-foreground">
              {t("jobCatalog.search")}
            </label>
            <Input
              id="role-search"
              data-testid="role-search"
              value={cerca}
              onChange={(e) => setCerca(e.target.value)}
              placeholder={t("jobCatalog.searchPlaceholder")}
            />
          </div>
          <div className="min-w-56">
            <label htmlFor="role-filter-family" className="mb-1 block text-sm font-medium text-foreground">
              {t("jobCatalog.role.family")}
            </label>
            <select
              id="role-filter-family"
              data-testid="role-filter-family"
              className={SELECT_CLASS}
              value={filtroFamiglia}
              onChange={(e) => setFiltroFamiglia(e.target.value)}
            >
              <option value="">{t("jobCatalog.allFamilies")}</option>
              {opzioniFamiglia}
            </select>
          </div>
        </div>

        <EntityTable<JobRole>
          isLoading={roles.isLoading}
          isError={roles.isError}
          errorMessage={t("jobCatalog.loadError")}
          rows={roles.data?.items ?? []}
          rowKey={(r) => r.jobRoleId}
          rowTestId="role-row"
          columns={columns}
          emptyTestId="job-roles-empty"
          emptyTitle={t("jobCatalog.role.emptyTitle")}
          caption={t("jobCatalog.role.caption")}
        />

        {canCreate && !editing && (
          <form
            data-testid="role-create-form"
            className="grid grid-cols-1 gap-3 border-t pt-4 md:grid-cols-3"
            noValidate
            onSubmit={(e) => {
              void createForm.handleSubmit((v) => create.mutateAsync(v).catch(() => undefined))(e);
            }}
          >
            <div>
              <label htmlFor="role-code" className="mb-1 block text-sm font-medium text-foreground">
                {t("jobCatalog.role.code")} <span aria-hidden="true">*</span>
              </label>
              <Input id="role-code" data-testid="role-create-code" {...createForm.register("code", { required: true, maxLength: 64 })} />
            </div>
            <div>
              <label htmlFor="role-name" className="mb-1 block text-sm font-medium text-foreground">
                {t("jobCatalog.role.name")} <span aria-hidden="true">*</span>
              </label>
              <Input id="role-name" data-testid="role-create-name" {...createForm.register("name", { required: true, maxLength: 255 })} />
            </div>
            <div>
              <label htmlFor="role-family" className="mb-1 block text-sm font-medium text-foreground">
                {t("jobCatalog.role.family")}
              </label>
              <select id="role-family" data-testid="role-create-family" className={SELECT_CLASS} {...createForm.register("jobFamilyId")}>
                <option value="">{t("jobCatalog.none")}</option>
                {opzioniFamiglia}
              </select>
            </div>
            <div>
              <label htmlFor="role-seniority" className="mb-1 block text-sm font-medium text-foreground">
                {t("jobCatalog.role.seniority")}
              </label>
              <select id="role-seniority" data-testid="role-create-seniority" className={SELECT_CLASS} {...createForm.register("seniorityLevel")}>
                <option value="">{t("jobCatalog.none")}</option>
                {opzioniSeniority}
              </select>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="role-desc" className="mb-1 block text-sm font-medium text-foreground">
                {t("jobCatalog.role.description")}
              </label>
              <Input id="role-desc" data-testid="role-create-description" {...createForm.register("description", { maxLength: 2048 })} />
            </div>
            <div className="flex items-center gap-3 md:col-span-3">
              <Button type="submit" data-testid="role-create-submit" disabled={create.isPending}>
                {create.isPending ? t("common:saving") : t("jobCatalog.role.create")}
              </Button>
              {create.isError && (
                <span data-testid="role-create-error" className="text-sm text-danger">
                  {messaggioErrore(create.error, t)}
                </span>
              )}
            </div>
          </form>
        )}

        {editing && (
          <form
            data-testid="role-edit-form"
            className="grid grid-cols-1 gap-3 border-t pt-4 md:grid-cols-3"
            noValidate
            onSubmit={(e) => {
              void editForm.handleSubmit((v) => save.mutateAsync(v).catch(() => undefined))(e);
            }}
          >
            <div>
              <label htmlFor="role-edit-code" className="mb-1 block text-sm font-medium text-foreground">
                {t("jobCatalog.role.code")}
              </label>
              <Input id="role-edit-code" data-testid="role-edit-code" disabled {...editForm.register("code")} />
              <p className="mt-1 text-xs text-muted-foreground">{t("jobCatalog.codeImmutable")}</p>
            </div>
            <div>
              <label htmlFor="role-edit-name" className="mb-1 block text-sm font-medium text-foreground">
                {t("jobCatalog.role.name")} <span aria-hidden="true">*</span>
              </label>
              <Input id="role-edit-name" data-testid="role-edit-name" {...editForm.register("name", { required: true, maxLength: 255 })} />
            </div>
            <div>
              <label htmlFor="role-edit-family" className="mb-1 block text-sm font-medium text-foreground">
                {t("jobCatalog.role.family")}
              </label>
              <select id="role-edit-family" data-testid="role-edit-family" className={SELECT_CLASS} {...editForm.register("jobFamilyId")}>
                {/* nessuna opzione vuota se la famiglia c'è già: l'API non la toglie */}
                {!editing.jobFamilyId && <option value="">{t("jobCatalog.none")}</option>}
                {opzioniFamiglia}
              </select>
              {!editing.jobFamilyId && (
                <p className="mt-1 text-xs text-muted-foreground">{t("jobCatalog.role.familyHint")}</p>
              )}
            </div>
            <div>
              <label htmlFor="role-edit-seniority" className="mb-1 block text-sm font-medium text-foreground">
                {t("jobCatalog.role.seniority")}
              </label>
              <select id="role-edit-seniority" data-testid="role-edit-seniority" className={SELECT_CLASS} {...editForm.register("seniorityLevel")}>
                <option value="">{t("jobCatalog.none")}</option>
                {opzioniSeniority}
              </select>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="role-edit-desc" className="mb-1 block text-sm font-medium text-foreground">
                {t("jobCatalog.role.description")}
              </label>
              <Input id="role-edit-desc" data-testid="role-edit-description" {...editForm.register("description", { maxLength: 2048 })} />
            </div>
            <div className="flex items-center gap-3 md:col-span-3">
              <Button type="submit" data-testid="role-edit-save" disabled={save.isPending}>
                {save.isPending ? t("common:saving") : t("jobCatalog.save")}
              </Button>
              <Button type="button" variant="outline" data-testid="role-edit-cancel" onClick={() => setEditing(null)}>
                {t("jobCatalog.cancel")}
              </Button>
              {save.isError && (
                <span data-testid="role-edit-error" className="text-sm text-danger">
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
