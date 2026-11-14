"use client";

/**
 * apps/web/src/components/schede-pagina.tsx — le schede orizzontali di una pagina lunga (classe
 * C5 del piano docs/piani/PIANO_interfaccia-sistematica_20261111.md).
 *
 * Enzo, 2026-11-11: «pagine con tante sezioni lunghissime da scorrere invece di essere organizzate
 * per tab orizzontali». Una pagina passa le sue sezioni come schede: in vista c'è una sezione
 * sola, la scheda scelta resta nell'indirizzo (`?scheda=`), così un collegamento o il tasto
 * indietro riportano allo stesso punto, e un conteggio accanto al titolo dice che cosa c'è dentro
 * senza aprirla. Le schede che non stanno in larghezza scorrono (`TabsOverflow` di @heuresys/ui
 * non serve: qui il contenuto è sempre di questa pagina).
 */
import { useCallback, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@heuresys/ui";

export interface SchedaPagina {
  id: string;
  titolo: string;
  /** un numero accanto al titolo (elementi dentro la scheda) */
  conteggio?: number | null;
  contenuto: ReactNode;
  nascosta?: boolean;
}

export function SchedePagina({ schede, chiave = "scheda" }: { schede: SchedaPagina[]; chiave?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const visibili = schede.filter((s) => !s.nascosta);
  const scelta = params.get(chiave);
  const attiva = visibili.some((s) => s.id === scelta) ? scelta! : visibili[0]?.id ?? "";
  const cambia = useCallback(
    (id: string) => {
      const p = new URLSearchParams(params.toString());
      if (id === visibili[0]?.id) p.delete(chiave);
      else p.set(chiave, id);
      const q = p.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [params, pathname, router, chiave, visibili],
  );
  if (visibili.length === 0) return null;
  return (
    <Tabs value={attiva} onValueChange={cambia} className="mt-2">
      <TabsList className="w-full justify-start overflow-x-auto" data-testid="schede-pagina">
        {visibili.map((s) => (
          <TabsTrigger key={s.id} value={s.id} className="shrink-0" data-testid={`scheda-${s.id}`}>
            {s.titolo}
            {typeof s.conteggio === "number" ? (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                {s.conteggio.toLocaleString("it-IT")}
              </span>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
      {visibili.map((s) => (
        <TabsContent key={s.id} value={s.id} className="mt-3 space-y-4">
          {s.contenuto}
        </TabsContent>
      ))}
    </Tabs>
  );
}
