"use client";

/**
 * Il nome e la descrizione di una categoria si correggono sul posto (`PATCH /v1/content/categories/:id`,
 * ondata 2 degli endpoint senza consumatori, 2026-11-17): prima una categoria scritta male si poteva
 * solo eliminare e rifare, perdendo i documenti collegati.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input } from "@heuresys/ui";
import type { ContentCategory } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";

export function NomeCategoria({ categoria, puoModificare }: { categoria: ContentCategory; puoModificare: boolean }) {
  const { t } = useTranslation("admin");
  const qc = useQueryClient();
  const [inModifica, setInModifica] = useState(false);
  const [nome, setNome] = useState(categoria.name);
  const [descrizione, setDescrizione] = useState(categoria.description ?? "");
  const salva = useMutation({
    mutationFn: () => apiFetch(`/v1/content/categories/${categoria.categoryId}`, {
      method: "PATCH", body: { name: nome.trim(), description: descrizione.trim() },
    }),
    onSuccess: () => { setInModifica(false); void qc.invalidateQueries({ queryKey: ["content", "categories"] }); },
  });
  if (!inModifica) {
    return (
      <span className="flex items-center gap-2">
        <span className="font-medium text-foreground">{categoria.name}</span>
        {puoModificare && (
          <Button type="button" size="sm" variant="outline" data-testid="content-category-edit" onClick={() => setInModifica(true)}>
            {t("content.categories.modifica")}
          </Button>
        )}
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Input aria-label={t("content.categories.nameLabel")} data-testid="content-category-edit-name" className="w-48" value={nome} maxLength={255}
        onChange={(e) => setNome(e.target.value)} />
      <Input aria-label={t("content.categories.descriptionLabel")} data-testid="content-category-edit-desc" className="w-64" value={descrizione}
        onChange={(e) => setDescrizione(e.target.value)} />
      <Button type="button" size="sm" data-testid="content-category-edit-save" disabled={!nome.trim() || salva.isPending} onClick={() => salva.mutate()}>
        {salva.isPending ? t("common:saving") : t("content.categories.salva")}
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => setInModifica(false)}>{t("content.categories.annulla")}</Button>
      {salva.isError && <span className="text-xs text-danger">{t("content.categories.erroreModifica")}</span>}
    </span>
  );
}
