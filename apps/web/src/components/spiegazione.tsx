"use client";

/**
 * apps/web/src/components/spiegazione.tsx — l'icona che spiega (classe C13 del piano
 * docs/piani/PIANO_interfaccia-sistematica_20261111.md). Si apre al passaggio del mouse e al
 * tocco, e il testo viene dal glossario (`lib/glossario.ts`).
 */
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@heuresys/ui";
import { spiegazioneDi, type Voce } from "@/lib/glossario";

export function Spiegazione({ voce, termine }: { voce: Voce; termine: string }) {
  const { t } = useTranslation("common");
  const [aperta, setAperta] = useState(false);
  // Il clic (o il tocco) la tiene aperta anche quando il mouse esce; si chiude con Esc o un
  // clic fuori (Radix, via onOpenChange).
  const [fissata, setFissata] = useState(false);
  return (
    <Popover
      open={aperta}
      onOpenChange={(o) => {
        setAperta(o);
        if (!o) setFissata(false);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("glossario.cosaVuolDire", { termine })}
          data-spiegazione=""
          onMouseEnter={() => setAperta(true)}
          onMouseLeave={() => {
            if (!fissata) setAperta(false);
          }}
          onClick={(e) => {
            // Radix farebbe il suo toggle (apre al passaggio, il clic richiude): lo si ferma.
            e.preventDefault();
            e.stopPropagation();
            setAperta(true);
            setFissata(true);
          }}
          className="ml-1 inline-flex align-middle text-muted-foreground/70 hover:text-primary focus-visible:text-primary"
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="max-w-xs text-xs font-normal normal-case tracking-normal leading-relaxed">
        <p className="font-semibold text-foreground">{voce.esteso ? `${termine} — ${voce.esteso}` : termine}</p>
        <p className="mt-1 text-muted-foreground">{voce.testo}</p>
      </PopoverContent>
    </Popover>
  );
}

/** Un titolo (colonna, indicatore) con la sua spiegazione se il glossario la conosce. */
export function ConSpiegazione({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  if (typeof children !== "string") return <>{children}</>;
  const s = spiegazioneDi(children, i18n.language);
  if (!s) return <>{children}</>;
  return (
    <span className="inline-flex items-center">
      {children}
      <Spiegazione voce={s} termine={s.termine} />
    </span>
  );
}
