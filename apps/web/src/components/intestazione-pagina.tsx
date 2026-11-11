"use client";

/**
 * apps/web/src/components/intestazione-pagina.tsx — `PageHeader` compatto e riconoscibile
 * (classe C7 del piano docs/piani/PIANO_interfaccia-sistematica_20261111.md).
 *
 * Enzo, 2026-11-11: «pagine che lasciano spazio inutilizzato dopo l'header invece di essere
 * compatte, titoli di pagina che non hanno elementi distintivi rispetto all'altro testo». Il
 * `PageHeader` di @heuresys/ui ha 24 px sotto, una riga di separazione e un titolo semibold di
 * 24 px, poco più grande di un titolo di scheda. Qui: titolo più grande e in grassetto con una
 * barra di colore che lo segna, descrizione su una riga, niente aria morta sotto. Stessa firma:
 * le pagine importano `PageHeader` da qui invece che da @heuresys/ui.
 *
 * Sotto il titolo si monta il quadro degli insight (classe C15): ogni pagina con un titolo lo
 * riceve senza toccarla.
 */
import type { ReactNode } from "react";
import type { PageHeaderProps } from "@heuresys/ui";
import { QuadroInsight } from "@/components/quadro-insight";

export function PageHeader(props: PageHeaderProps & { children?: ReactNode }) {
  // `divider` della libreria non si usa: la barra di colore del titolo separa già
  const { title, description, breadcrumbs, actions, badges, className, ...resto } = props;
  const rest = { ...resto };
  delete rest.divider;
  return (
    <header {...rest} className={`flex flex-col gap-1 pb-2 ${className ?? ""}`}>
      {breadcrumbs ? <div className="text-xs text-muted-foreground">{breadcrumbs}</div> : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="border-l-4 border-primary pl-3 text-[1.75rem] font-bold leading-tight tracking-tight text-foreground">
              {title}
            </h1>
            {badges}
          </div>
          {description ? <p className="pl-4 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {/* C15: le cose che contano su questa pagina, prima di tutto il resto */}
      <QuadroInsight />
    </header>
  );
}
