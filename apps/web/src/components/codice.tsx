import { codiceLeggibile } from "@/lib/codice-importazione";

/** Il codice in monospazio se è leggibile; una chiave di importazione diventa un trattino (C5). */
export function Codice({ value, className = "font-mono text-xs" }: { value: string | null | undefined; className?: string }) {
  const c = codiceLeggibile(value);
  return c ? <span className={className}>{c}</span> : <span className="text-xs text-muted-foreground">—</span>;
}
