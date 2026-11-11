/**
 * Repertorio interfacce, R5: il numero accanto al titolo è il totale del server, e se la
 * tabella ne mostra meno lo dice («200 di 312») invece di troncare l'elenco in silenzio.
 */
export function conteggio(
  data: { items: unknown[]; total: number } | undefined,
  t: (k: string, o?: Record<string, unknown>) => string,
): string {
  if (!data) return "";
  const shown = data.items.length;
  return shown < data.total ? t("jobCatalog.countOf", { shown, total: data.total }) : String(data.total);
}
