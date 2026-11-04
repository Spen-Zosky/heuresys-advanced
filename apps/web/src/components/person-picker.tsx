"use client";

/**
 * apps/web/src/components/person-picker.tsx
 *
 * V-2 del piano interfacce (2026-11-04). La scelta di una persona caricava i primi 200 utenti
 * del tenant e basta: oltre il duecentesimo, una persona non si poteva scegliere, e nessuno lo
 * vedeva. Qui si cerca sul server (`GET /v1/users?search=`, ILIKE su nome ed email, nel
 * perimetro di chi cerca) dalla terza lettera, e le persone scelte restano visibili sopra il
 * campo, ciascuna con il suo pulsante per toglierla.
 */

import { useEffect, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { User, UserListResponse } from "@heuresys/shared";
import { Button, Input } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";
import { useEnumLabel } from "@/lib/enum-labels";
import { etichettaPersona } from "@/lib/person-label";

export const LETTERE_MINIME = 3;

export interface PersonPickerProps {
  /** Etichetta visibile del campo. */
  label: string;
  /** Persone scelte, nell'ordine in cui sono state aggiunte. */
  value: User[];
  onChange: (next: User[]) => void;
  hint?: string;
  testId?: string;
  enabled?: boolean;
}

export function PersonPicker({ label, value, onChange, hint, testId = "person-picker", enabled = true }: PersonPickerProps) {
  const { t } = useTranslation("common");
  const enumLabel = useEnumLabel();
  const inputId = useId();
  const listId = useId();
  const [testo, setTesto] = useState("");
  const [cercato, setCercato] = useState("");

  // Si cerca quando chi scrive si ferma, non a ogni tasto.
  useEffect(() => {
    const h = setTimeout(() => setCercato(testo.trim()), 250);
    return () => clearTimeout(h);
  }, [testo]);

  const attivo = enabled && cercato.length >= LETTERE_MINIME;
  const risultati = useQuery({
    queryKey: ["person-picker", cercato],
    queryFn: () => apiFetch<UserListResponse>(`/v1/users?${new URLSearchParams({ search: cercato, limit: "20" }).toString()}`),
    enabled: attivo,
  });

  const scelti = new Set(value.map((u) => u.userId));
  const proposte = (risultati.data?.items ?? []).filter((u) => !scelti.has(u.userId));

  return (
    <div data-testid={testId}>
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-foreground">
        {label} <span aria-hidden="true">*</span>
      </label>
      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2" aria-label={t("personPicker.selected")} data-testid={`${testId}-selected`}>
          {value.map((u) => (
            <li key={u.userId} className="flex items-center gap-1 rounded-control border border-border bg-muted px-2 py-1 text-sm">
              <span>{etichettaPersona(u, enumLabel)}</span>
              <button
                type="button"
                className="rounded-control px-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={t("personPicker.remove", { name: u.displayName })}
                onClick={() => onChange(value.filter((x) => x.userId !== u.userId))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <Input
        id={inputId}
        data-testid={`${testId}-input`}
        value={testo}
        onChange={(e) => setTesto(e.target.value)}
        placeholder={t("personPicker.placeholder", { count: LETTERE_MINIME })}
        aria-describedby={`${listId}-stato`}
        autoComplete="off"
      />
      <p id={`${listId}-stato`} className="mt-1 text-xs text-muted-foreground" aria-live="polite">
        {!attivo
          ? hint ?? t("personPicker.typeMore", { count: LETTERE_MINIME })
          : risultati.isLoading
            ? t("loading")
            : risultati.isError
              ? t("personPicker.error")
              : t("personPicker.found", { count: risultati.data?.total ?? 0 })}
      </p>
      {attivo && proposte.length > 0 && (
        <ul id={listId} className="mt-1 max-h-56 overflow-auto rounded-control border border-border bg-card" data-testid={`${testId}-results`}>
          {proposte.map((u) => (
            <li key={u.userId}>
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-start"
                data-testid={`${testId}-option`}
                onClick={() => {
                  onChange([...value, u]);
                  setTesto("");
                }}
              >
                {etichettaPersona(u, enumLabel)}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
