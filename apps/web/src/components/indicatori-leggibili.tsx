"use client";

/**
 * apps/web/src/components/indicatori-leggibili.tsx — `StatsCard` e `KPIStrip` di @heuresys/ui con
 * i valori passati per la rete di leggibilità (classe C4 del piano
 * docs/piani/PIANO_interfaccia-sistematica_20261111.md).
 *
 * `StatsCard` riceveva numeri grezzi e li animava senza separatore delle migliaia («883217 h»).
 * Le pagine importano questi due nomi da qui invece che da @heuresys/ui: stessa firma, valori
 * in forma italiana («883.217 h»), etichette e unità tradotte se arrivano come codici.
 */
import {
  KPIStrip as KPIStripUi,
  StatsCard as StatsCardUi,
  type KPIStripProps,
  type StatsCardProps,
} from "@heuresys/ui";
import { useLeggibile } from "@/lib/leggibile";
import { spiegazioneDi } from "@/lib/glossario";
import { Spiegazione } from "@/components/spiegazione";

export function StatsCard(props: StatsCardProps) {
  const l = useLeggibile();
  const value =
    typeof props.value === "number" || typeof props.value === "string"
      ? l.testo(String(props.value))
      : props.value;
  const label = l.testo(props.label);
  const s = spiegazioneDi(label);
  const carta = (
    <StatsCardUi {...props} label={label} value={value} animate={false} />
  );
  if (!s) return carta;
  /* C13: l'indicatore dice che cosa misura, con l'icona nell'angolo */
  return (
    <div className="relative">
      {carta}
      <span className="absolute right-2 top-2">
        <Spiegazione voce={s} termine={s.termine} />
      </span>
    </div>
  );
}

export function KPIStrip({ items }: KPIStripProps) {
  const l = useLeggibile();
  return (
    <KPIStripUi
      items={items.map((i) => {
        const label = l.testo(i.label);
        const s = spiegazioneDi(label);
        return {
          ...i,
          label,
          ...(s && i.footerRight === undefined
            ? { footerRight: <Spiegazione voce={s} termine={s.termine} /> }
            : {}),
          value: l.nodo(i.value),
          ...(i.unit !== undefined ? { unit: l.nodo(i.unit) } : {}),
        };
      })}
    />
  );
}
