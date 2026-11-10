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
import { KPIStrip as KPIStripUi, StatsCard as StatsCardUi, type KPIStripProps, type StatsCardProps } from "@heuresys/ui";
import { useLeggibile } from "@/lib/leggibile";

export function StatsCard(props: StatsCardProps) {
  const l = useLeggibile();
  const value = typeof props.value === "number" || typeof props.value === "string" ? l.testo(String(props.value)) : props.value;
  return <StatsCardUi {...props} label={l.testo(props.label)} value={value} animate={false} />;
}

export function KPIStrip({ items }: KPIStripProps) {
  const l = useLeggibile();
  return (
    <KPIStripUi
      items={items.map((i) => ({
        ...i,
        label: l.testo(i.label),
        value: l.nodo(i.value),
        ...(i.unit !== undefined ? { unit: l.nodo(i.unit) } : {}),
      }))}
    />
  );
}
