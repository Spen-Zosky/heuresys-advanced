/**
 * apps/web/src/lib/api/download.ts
 *
 * Scarica un documento servito dall'API (non JSON) e lo consegna al browser.
 *
 * `apiFetch` non serve a questo: interpreta sempre il corpo come JSON. Qui il
 * corpo è il documento — un SVG, un Mermaid, un JSON da salvare su file — con
 * il proprio MIME e il nome scelto dal server in `content-disposition`.
 *
 * Passa dallo stesso proxy same-origin `/api/*`, così il cookie di sessione
 * HttpOnly viaggia esattamente come per le altre chiamate.
 */

/** Estrae il nome file da `content-disposition`, se il server lo indica. */
function filenameFrom(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const quoted = header.match(/filename="([^"]+)"/);
  if (quoted?.[1]) return quoted[1];
  const bare = header.match(/filename=([^;]+)/);
  return bare?.[1]?.trim() ?? fallback;
}

export interface DownloadResult {
  filename: string;
  byteSize: number;
}

/**
 * Scarica `path` (relativo all'API, es. `/v1/visualization-exports/<id>/download`)
 * e apre il salvataggio del file. Restituisce nome e dimensione di ciò che è
 * arrivato davvero, così il chiamante può mostrarlo o verificarlo.
 */
export async function apiDownload(path: string, fallbackName: string): Promise<DownloadResult> {
  const res = await fetch(`/api${path.startsWith("/") ? path : `/${path}`}`, {
    credentials: "include",
  });
  if (!res.ok) {
    // Il corpo di un errore resta JSON: si prova a leggerne il codice tipizzato.
    let code = String(res.status);
    try {
      const body = (await res.json()) as { error?: { code?: string } };
      if (body.error?.code) code = body.error.code;
    } catch {
      /* corpo non-JSON: resta lo status */
    }
    throw new Error(code);
  }

  const blob = await res.blob();
  const filename = filenameFrom(res.headers.get("content-disposition"), fallbackName);

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  return { filename, byteSize: blob.size };
}
