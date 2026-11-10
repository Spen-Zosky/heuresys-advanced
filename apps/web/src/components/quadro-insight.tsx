"use client";

/**
 * apps/web/src/components/quadro-insight.tsx — il quadro degli insight in testa alla pagina
 * (classe C15 del piano docs/piani/PIANO_interfaccia-sistematica_20261111.md).
 *
 * Enzo, 2026-11-11: «Dove sono gli insight che dovrebbero caratterizzare un prodotto smart?».
 * Sotto il titolo di ogni pagina, le cose che contano sul perimetro di chi guarda, in ordine di
 * gravità: rischi, cose da guardare, andamenti, buone notizie, ognuna con il posto dove si agisce.
 * Si monta da `PageHeader`, quindi ogni pagina che ha un titolo lo riceve; le aree vengono dalla
 * rotta (`lib/quadro-aree.ts`). Al massimo quattro voci in vista, il resto a un clic.
 */
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CheckCircle2, Eye, Info, TrendingDown, TrendingUp } from "lucide-react";
import type { Insight, QuadroResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { areeDellaRotta } from "@/lib/quadro-aree";

const STILE: Record<Insight["tono"], { icona: typeof Info; classe: string }> = {
  rischio: { icona: AlertTriangle, classe: "border-danger/40 bg-danger/5 text-danger" },
  attenzione: { icona: Eye, classe: "border-warning/40 bg-warning/5 text-warning" },
  informazione: { icona: Info, classe: "border-info/30 bg-info/5 text-info" },
  positivo: { icona: CheckCircle2, classe: "border-success/30 bg-success/5 text-success" },
};

function Voce({ i }: { i: Insight }) {
  const s = STILE[i.tono];
  const Icona = s.icona;
  return (
    <li className={`flex min-w-0 flex-col gap-1 rounded-lg border px-3 py-2 ${s.classe}`} data-insight={i.chiave} data-tono={i.tono}>
      <div className="flex items-start gap-2">
        <Icona className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p className="text-sm font-semibold leading-snug text-foreground">{i.titolo}</p>
        {i.andamento !== null ? (
          <span className="ml-auto flex shrink-0 items-center gap-0.5 text-xs font-medium">
            {i.andamento >= 0 ? <TrendingUp className="h-3.5 w-3.5" aria-hidden /> : <TrendingDown className="h-3.5 w-3.5" aria-hidden />}
            {`${i.andamento > 0 ? "+" : ""}${i.andamento.toLocaleString("it-IT")}%`}
          </span>
        ) : null}
      </div>
      <p className="pl-6 text-xs leading-snug text-muted-foreground">{i.dettaglio}</p>
      {i.azione ? (
        <Link href={i.azione.href} className="ml-6 inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline">
          {i.azione.etichetta}
          <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      ) : null}
    </li>
  );
}

export function QuadroInsight() {
  const pathname = usePathname();
  const aree = areeDellaRotta(pathname);
  const [tutte, setTutte] = useState(false);
  const q = useQuery({
    queryKey: ["me", "quadro", aree.join(",")],
    queryFn: ({ signal }) => apiFetch<QuadroResponse>(`/v1/me/quadro?aree=${aree.join(",")}`, { signal }),
    enabled: aree.length > 0,
    staleTime: 5 * 60_000,
    retry: 0,
  });
  const voci = q.data?.insight ?? [];
  if (aree.length === 0 || voci.length === 0) return null;
  const visibili = tutte ? voci : voci.slice(0, 4);
  return (
    <section aria-label="Da guardare" data-testid="quadro-insight" className="mt-1">
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {visibili.map((i) => (
          <Voce key={i.chiave} i={i} />
        ))}
      </ul>
      {voci.length > 4 ? (
        <button type="button" onClick={() => setTutte((x) => !x)} className="mt-1 text-xs font-medium text-primary hover:underline">
          {tutte ? "Mostra meno" : `Altre ${voci.length - 4} cose da guardare`}
        </button>
      ) : null}
    </section>
  );
}
