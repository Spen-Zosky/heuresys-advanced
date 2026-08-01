"use client";

/**
 * Tassonomia competenze: famiglie, categorie, livelli di padronanza (#43 — linea C2).
 *
 * Tre moduli API — `skill-families`, `skill-categories`,
 * `skill-proficiency-levels` — esistevano da MVP-1 senza NESSUNA interfaccia:
 * l'ossatura sotto le 14.000 competenze si governava solo da database.
 *
 * Ordine della pagina = ordine della gerarchia: le famiglie contengono le
 * categorie, che classificano le competenze. I livelli di padronanza chiudono
 * come riferimento in sola lettura — l'API ne espone solo l'elenco (1 solo
 * endpoint), quindi non si finge un pannello di modifica che non esiste.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import type { SkillCategory, SkillFamily, SkillProficiencyLevel } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const LIST_LIMIT = 200;

const orNull = (v: string): string | null => (v.trim() === "" ? null : v.trim());

function messaggioErrore(err: unknown, t: (k: string) => string): string {
  if (isApiError(err)) {
    if (err.status === 403) return t("taxonomy.forbidden");
    if (err.status === 409) return t("taxonomy.conflict");
  }
  return t("taxonomy.saveError");
}

/* --- famiglie ------------------------------------------------------------ */

interface FamilyForm {
  code: string;
  name: string;
  description: string;
}

export function SkillFamiliesPanel() {
  const { t } = useTranslation("hr");
  const qc = useQueryClient();
  const perms = new Set(useCurrentUserPermissions().data?.permissions ?? []);
  const canCreate = perms.has("skill_taxonomy:create");
  const canUpdate = perms.has("skill_taxonomy:update");
  const canDelete = perms.has("skill_taxonomy:delete");

  const [editing, setEditing] = useState<SkillFamily | null>(null);
  const [aperto, setAperto] = useState(false);
  // 77 famiglie: la tabella ne impagina 25, quindi senza filtro una famiglia
  // appena creata resta irraggiungibile per modificarla. Il filtro lo applica
  // il SERVER (l'API lo offre) — lezione gia' pagata su /skills e /job-catalog.
  const [cerca, setCerca] = useState("");

  const families = useQuery({
    queryKey: ["skill-families", "list", cerca],
    queryFn: () =>
      apiFetch<{ items: SkillFamily[] }>(
        `/v1/skill-families?limit=${LIST_LIMIT}${cerca.trim() ? `&search=${encodeURIComponent(cerca.trim())}` : ""}`,
      ),
  });

  const createForm = useForm<FamilyForm>({ defaultValues: { code: "", name: "", description: "" } });
  const editForm = useForm<FamilyForm>({
    values: editing ? { code: editing.code, name: editing.name, description: editing.description ?? "" } : undefined,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["skill-families"] });
    // le categorie mostrano il nome della famiglia: se cambia, va rinfrescato
    void qc.invalidateQueries({ queryKey: ["skill-categories"] });
  };

  const create = useMutation({
    mutationFn: (v: FamilyForm) =>
      apiFetch<SkillFamily>("/v1/skill-families", {
        method: "POST",
        body: { code: v.code.trim(), name: v.name.trim(), description: orNull(v.description) },
      }),
    onSuccess: () => {
      createForm.reset({ code: "", name: "", description: "" });
      setAperto(false);
      invalidate();
    },
  });

  const save = useMutation({
    // `code` è immutabile sull'API: mostrato, non inviato.
    mutationFn: (v: FamilyForm) =>
      apiFetch<SkillFamily>(`/v1/skill-families/${editing!.skillFamilyId}`, {
        method: "PATCH",
        body: { name: v.name.trim(), description: orNull(v.description) },
      }),
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/v1/skill-families/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
  });

  const columns: DataColumn<SkillFamily>[] = [
    { header: t("shared.code"), cell: (f) => <span className="font-mono text-xs">{f.code}</span> },
    { header: t("shared.name"), cell: (f) => <span className="font-medium text-foreground">{f.name}</span> },
    {
      header: t("taxonomy.description"),
      cell: (f) => <span className="text-sm text-muted-foreground">{f.description ?? t("taxonomy.dash")}</span>,
    },
    ...(canUpdate || canDelete
      ? [
          {
            header: t("common:actions"),
            cell: (f: SkillFamily) => (
              <div className="flex gap-2">
                {canUpdate && (
                  <Button type="button" variant="outline" data-testid={`family-edit-${f.code}`} onClick={() => setEditing(f)}>
                    {t("taxonomy.edit")}
                  </Button>
                )}
                {canDelete && (
                  <Button
                    type="button"
                    variant="outline"
                    data-testid={`family-delete-${f.code}`}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(f.skillFamilyId)}
                  >
                    {t("taxonomy.delete")}
                  </Button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <Card data-testid="skill-families-panel">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span>
            {t("taxonomy.families.title")}
            <span className="ml-2 text-sm font-normal text-muted-foreground">{families.data?.items.length ?? 0}</span>
          </span>
          {canCreate && (
            <Button type="button" variant="outline" data-testid="family-create-toggle" onClick={() => setAperto((v) => !v)}>
              {aperto ? t("taxonomy.close") : t("taxonomy.families.create")}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-sm">
          <label htmlFor="sf-search" className="mb-1 block text-sm font-medium text-foreground">
            {t("taxonomy.search")}
          </label>
          <Input
            id="sf-search"
            data-testid="family-search"
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
            placeholder={t("taxonomy.searchPlaceholder")}
          />
        </div>

        <EntityTable<SkillFamily>
          isLoading={families.isLoading}
          isError={families.isError}
          errorMessage={t("taxonomy.loadError")}
          rows={families.data?.items ?? []}
          rowKey={(f) => f.skillFamilyId}
          rowTestId="skill-family-row"
          columns={columns}
          emptyTestId="skill-families-empty"
          emptyTitle={t("taxonomy.families.emptyTitle")}
          caption={t("taxonomy.families.caption")}
        />

        {remove.isError && (
          <p data-testid="family-delete-error" className="text-sm text-danger">
            {messaggioErrore(remove.error, t)}
          </p>
        )}

        {canCreate && aperto && !editing && (
          <form
            data-testid="family-create-form"
            className="grid grid-cols-1 gap-3 border-t pt-4 md:grid-cols-3"
            noValidate
            onSubmit={(e) => {
              void createForm.handleSubmit((v) => create.mutateAsync(v).catch(() => undefined))(e);
            }}
          >
            <div>
              <label htmlFor="sf-code" className="mb-1 block text-sm font-medium text-foreground">
                {t("shared.code")} <span aria-hidden="true">*</span>
              </label>
              <Input id="sf-code" data-testid="family-create-code" {...createForm.register("code", { required: true, maxLength: 64 })} />
            </div>
            <div>
              <label htmlFor="sf-name" className="mb-1 block text-sm font-medium text-foreground">
                {t("shared.name")} <span aria-hidden="true">*</span>
              </label>
              <Input id="sf-name" data-testid="family-create-name" {...createForm.register("name", { required: true, maxLength: 128 })} />
            </div>
            <div>
              <label htmlFor="sf-desc" className="mb-1 block text-sm font-medium text-foreground">
                {t("taxonomy.description")}
              </label>
              <Input id="sf-desc" data-testid="family-create-description" {...createForm.register("description", { maxLength: 2048 })} />
            </div>
            <div className="flex items-center gap-3 md:col-span-3">
              <Button type="submit" data-testid="family-create-submit" disabled={create.isPending}>
                {create.isPending ? t("common:saving") : t("taxonomy.families.create")}
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
              <label htmlFor="sf-edit-code" className="mb-1 block text-sm font-medium text-foreground">
                {t("shared.code")}
              </label>
              <Input id="sf-edit-code" data-testid="family-edit-code" disabled {...editForm.register("code")} />
              <p className="mt-1 text-xs text-muted-foreground">{t("taxonomy.codeImmutable")}</p>
            </div>
            <div>
              <label htmlFor="sf-edit-name" className="mb-1 block text-sm font-medium text-foreground">
                {t("shared.name")} <span aria-hidden="true">*</span>
              </label>
              <Input id="sf-edit-name" data-testid="family-edit-name" {...editForm.register("name", { required: true, maxLength: 128 })} />
            </div>
            <div>
              <label htmlFor="sf-edit-desc" className="mb-1 block text-sm font-medium text-foreground">
                {t("taxonomy.description")}
              </label>
              <Input id="sf-edit-desc" data-testid="family-edit-description" {...editForm.register("description", { maxLength: 2048 })} />
            </div>
            <div className="flex items-center gap-3 md:col-span-3">
              <Button type="submit" data-testid="family-edit-save" disabled={save.isPending}>
                {save.isPending ? t("common:saving") : t("taxonomy.save")}
              </Button>
              <Button type="button" variant="outline" data-testid="family-edit-cancel" onClick={() => setEditing(null)}>
                {t("taxonomy.cancel")}
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

/* --- categorie ----------------------------------------------------------- */

interface CategoryForm {
  code: string;
  name: string;
  description: string;
  familyId: string;
}

export function SkillCategoriesPanel() {
  const { t } = useTranslation("hr");
  const qc = useQueryClient();
  const perms = new Set(useCurrentUserPermissions().data?.permissions ?? []);
  const canCreate = perms.has("skill_taxonomy:create");
  const canUpdate = perms.has("skill_taxonomy:update");

  const [editing, setEditing] = useState<SkillCategory | null>(null);
  const [aperto, setAperto] = useState(false);
  const [filtroFamiglia, setFiltroFamiglia] = useState("");
  const [cerca, setCerca] = useState("");

  const families = useQuery({
    queryKey: ["skill-families", "list"],
    queryFn: () => apiFetch<{ items: SkillFamily[] }>(`/v1/skill-families?limit=${LIST_LIMIT}`),
  });
  const categories = useQuery({
    queryKey: ["skill-categories", "list", filtroFamiglia, cerca],
    queryFn: () => {
      const q = new URLSearchParams({ limit: String(LIST_LIMIT) });
      if (filtroFamiglia) q.set("familyId", filtroFamiglia);
      if (cerca.trim()) q.set("search", cerca.trim());
      return apiFetch<{ items: SkillCategory[] }>(`/v1/skill-categories?${q.toString()}`);
    },
  });

  const nomeFamiglia = (id: string): string =>
    families.data?.items.find((f) => f.skillFamilyId === id)?.name ?? t("taxonomy.dash");

  const createForm = useForm<CategoryForm>({ defaultValues: { code: "", name: "", description: "", familyId: "" } });
  const editForm = useForm<CategoryForm>({
    values: editing
      ? { code: editing.code, name: editing.name, description: editing.description ?? "", familyId: editing.familyId }
      : undefined,
  });

  const create = useMutation({
    mutationFn: (v: CategoryForm) =>
      apiFetch<SkillCategory>("/v1/skill-categories", {
        method: "POST",
        body: {
          familyId: v.familyId,
          code: v.code.trim(),
          name: v.name.trim(),
          description: orNull(v.description),
        },
      }),
    onSuccess: () => {
      createForm.reset({ code: "", name: "", description: "", familyId: "" });
      setAperto(false);
      void qc.invalidateQueries({ queryKey: ["skill-categories"] });
    },
  });

  const save = useMutation({
    mutationFn: (v: CategoryForm) =>
      apiFetch<SkillCategory>(`/v1/skill-categories/${editing!.skillCategoryId}`, {
        method: "PATCH",
        body: { familyId: v.familyId, name: v.name.trim(), description: orNull(v.description) },
      }),
    onSuccess: () => {
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["skill-categories"] });
    },
  });

  const opzioniFamiglia = (families.data?.items ?? []).map((f) => (
    <option key={f.skillFamilyId} value={f.skillFamilyId}>
      {f.name}
    </option>
  ));

  const columns: DataColumn<SkillCategory>[] = [
    { header: t("shared.code"), cell: (c) => <span className="font-mono text-xs">{c.code}</span> },
    { header: t("shared.name"), cell: (c) => <span className="font-medium text-foreground">{c.name}</span> },
    {
      header: t("taxonomy.categories.family"),
      cell: (c) => <span className="text-sm text-muted-foreground">{nomeFamiglia(c.familyId)}</span>,
    },
    ...(canUpdate
      ? [
          {
            header: t("common:actions"),
            cell: (c: SkillCategory) => (
              <Button type="button" variant="outline" data-testid={`category-edit-${c.code}`} onClick={() => setEditing(c)}>
                {t("taxonomy.edit")}
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <Card data-testid="skill-categories-panel">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span>
            {t("taxonomy.categories.title")}
            <span className="ml-2 text-sm font-normal text-muted-foreground">{categories.data?.items.length ?? 0}</span>
          </span>
          {canCreate && (
            <Button type="button" variant="outline" data-testid="category-create-toggle" onClick={() => setAperto((v) => !v)}>
              {aperto ? t("taxonomy.close") : t("taxonomy.categories.create")}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <div className="min-w-56 flex-1">
            <label htmlFor="sc-search" className="mb-1 block text-sm font-medium text-foreground">
              {t("taxonomy.search")}
            </label>
            <Input
              id="sc-search"
              data-testid="category-search"
              value={cerca}
              onChange={(e) => setCerca(e.target.value)}
              placeholder={t("taxonomy.searchPlaceholder")}
            />
          </div>
          <div className="min-w-56">
            <label htmlFor="cat-filter-family" className="mb-1 block text-sm font-medium text-foreground">
              {t("taxonomy.categories.family")}
            </label>
            <select
              id="cat-filter-family"
              data-testid="category-filter-family"
              className={SELECT_CLASS}
              value={filtroFamiglia}
              onChange={(e) => setFiltroFamiglia(e.target.value)}
            >
              <option value="">{t("taxonomy.categories.allFamilies")}</option>
              {opzioniFamiglia}
            </select>
          </div>
        </div>

        <EntityTable<SkillCategory>
          isLoading={categories.isLoading}
          isError={categories.isError}
          errorMessage={t("taxonomy.loadError")}
          rows={categories.data?.items ?? []}
          rowKey={(c) => c.skillCategoryId}
          rowTestId="skill-category-row"
          columns={columns}
          emptyTestId="skill-categories-empty"
          emptyTitle={t("taxonomy.categories.emptyTitle")}
          caption={t("taxonomy.categories.caption")}
        />

        {canCreate && aperto && !editing && (
          <form
            data-testid="category-create-form"
            className="grid grid-cols-1 gap-3 border-t pt-4 md:grid-cols-4"
            noValidate
            onSubmit={(e) => {
              void createForm.handleSubmit((v) => create.mutateAsync(v).catch(() => undefined))(e);
            }}
          >
            <div>
              <label htmlFor="sc-code" className="mb-1 block text-sm font-medium text-foreground">
                {t("shared.code")} <span aria-hidden="true">*</span>
              </label>
              <Input id="sc-code" data-testid="category-create-code" {...createForm.register("code", { required: true, maxLength: 64 })} />
            </div>
            <div>
              <label htmlFor="sc-name" className="mb-1 block text-sm font-medium text-foreground">
                {t("shared.name")} <span aria-hidden="true">*</span>
              </label>
              <Input id="sc-name" data-testid="category-create-name" {...createForm.register("name", { required: true, maxLength: 128 })} />
            </div>
            <div>
              <label htmlFor="sc-family" className="mb-1 block text-sm font-medium text-foreground">
                {t("taxonomy.categories.family")} <span aria-hidden="true">*</span>
              </label>
              {/* La famiglia è OBBLIGATORIA sull'API (CreateSkillCategoryBody la
                  richiede): niente opzione vuota, una categoria orfana non esiste. */}
              <select id="sc-family" data-testid="category-create-family" className={SELECT_CLASS} {...createForm.register("familyId", { required: true })}>
                <option value="">{t("taxonomy.categories.pickFamily")}</option>
                {opzioniFamiglia}
              </select>
            </div>
            <div>
              <label htmlFor="sc-desc" className="mb-1 block text-sm font-medium text-foreground">
                {t("taxonomy.description")}
              </label>
              <Input id="sc-desc" data-testid="category-create-description" {...createForm.register("description", { maxLength: 2048 })} />
            </div>
            <div className="flex items-center gap-3 md:col-span-4">
              <Button type="submit" data-testid="category-create-submit" disabled={create.isPending}>
                {create.isPending ? t("common:saving") : t("taxonomy.categories.create")}
              </Button>
              {create.isError && (
                <span data-testid="category-create-error" className="text-sm text-danger">
                  {messaggioErrore(create.error, t)}
                </span>
              )}
            </div>
          </form>
        )}

        {editing && (
          <form
            data-testid="category-edit-form"
            className="grid grid-cols-1 gap-3 border-t pt-4 md:grid-cols-4"
            noValidate
            onSubmit={(e) => {
              void editForm.handleSubmit((v) => save.mutateAsync(v).catch(() => undefined))(e);
            }}
          >
            <div>
              <label htmlFor="sc-edit-code" className="mb-1 block text-sm font-medium text-foreground">
                {t("shared.code")}
              </label>
              <Input id="sc-edit-code" data-testid="category-edit-code" disabled {...editForm.register("code")} />
              <p className="mt-1 text-xs text-muted-foreground">{t("taxonomy.codeImmutable")}</p>
            </div>
            <div>
              <label htmlFor="sc-edit-name" className="mb-1 block text-sm font-medium text-foreground">
                {t("shared.name")} <span aria-hidden="true">*</span>
              </label>
              <Input id="sc-edit-name" data-testid="category-edit-name" {...editForm.register("name", { required: true, maxLength: 128 })} />
            </div>
            <div>
              <label htmlFor="sc-edit-family" className="mb-1 block text-sm font-medium text-foreground">
                {t("taxonomy.categories.family")}
              </label>
              <select id="sc-edit-family" data-testid="category-edit-family" className={SELECT_CLASS} {...editForm.register("familyId", { required: true })}>
                {opzioniFamiglia}
              </select>
            </div>
            <div>
              <label htmlFor="sc-edit-desc" className="mb-1 block text-sm font-medium text-foreground">
                {t("taxonomy.description")}
              </label>
              <Input id="sc-edit-desc" data-testid="category-edit-description" {...editForm.register("description", { maxLength: 2048 })} />
            </div>
            <div className="flex items-center gap-3 md:col-span-4">
              <Button type="submit" data-testid="category-edit-save" disabled={save.isPending}>
                {save.isPending ? t("common:saving") : t("taxonomy.save")}
              </Button>
              <Button type="button" variant="outline" data-testid="category-edit-cancel" onClick={() => setEditing(null)}>
                {t("taxonomy.cancel")}
              </Button>
              {save.isError && (
                <span data-testid="category-edit-error" className="text-sm text-danger">
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

/* --- livelli di padronanza (riferimento, sola lettura) ------------------- */

export function ProficiencyLevelsPanel() {
  const { t } = useTranslation("hr");

  const levels = useQuery({
    queryKey: ["skill-proficiency-levels", "list"],
    queryFn: () => apiFetch<{ items: SkillProficiencyLevel[] }>("/v1/skill-proficiency-levels"),
  });

  const columns: DataColumn<SkillProficiencyLevel>[] = [
    { header: t("taxonomy.levels.rank"), cell: (l) => <span className="font-mono text-xs">{l.rank}</span> },
    { header: t("shared.code"), cell: (l) => <span className="font-mono text-xs">{l.code}</span> },
    { header: t("shared.name"), cell: (l) => <span className="font-medium text-foreground">{l.name}</span> },
    {
      header: t("taxonomy.description"),
      cell: (l) => <span className="text-sm text-muted-foreground">{l.description ?? t("taxonomy.dash")}</span>,
    },
  ];

  return (
    <Card data-testid="proficiency-levels-panel">
      <CardHeader>
        <CardTitle>
          {t("taxonomy.levels.title")}
          <span className="ml-2 text-sm font-normal text-muted-foreground">{levels.data?.items.length ?? 0}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* L'API espone SOLO l'elenco: nessun pannello di modifica, perché non
            esiste l'endpoint per farlo. Meglio dirlo che simularlo. */}
        <p className="text-sm text-muted-foreground">{t("taxonomy.levels.readOnlyNote")}</p>
        <EntityTable<SkillProficiencyLevel>
          isLoading={levels.isLoading}
          isError={levels.isError}
          errorMessage={t("taxonomy.loadError")}
          rows={levels.data?.items ?? []}
          rowKey={(l) => l.proficiencyLevelId}
          rowTestId="proficiency-level-row"
          columns={columns}
          emptyTestId="proficiency-levels-empty"
          emptyTitle={t("taxonomy.levels.emptyTitle")}
          caption={t("taxonomy.levels.caption")}
        />
      </CardContent>
    </Card>
  );
}
