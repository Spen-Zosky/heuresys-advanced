"use client";

/**
 * apps/web/src/lib/leggibile.tsx — la rete di leggibilità (classi C1, C2, C4 del piano
 * docs/piani/PIANO_interfaccia-sistematica_20261111.md).
 *
 * Enzo, 2026-11-11: «quando ti segnalo un problema tu lo affronti come problema unico senza
 * verificare se si ripete altrove». Un codice inglese, un'email al posto di una persona o un
 * numero senza separatori non sono difetti di una pagina: sono valori che passano senza filtro da
 * un dato a uno schermo. Questa rete sta nel punto di passaggio comune (la cella di `EntityTable`,
 * i valori degli indicatori) e trasforma ogni testo che arriva così com'è dal dato:
 *
 *   - un identificativo (UUID) di persona, posizione o unità → il suo nome dalla rubrica;
 *   - un'email di una persona del perimetro → «Cognome, Nome»;
 *   - una data ISO → la data nella forma della lingua;
 *   - un numero → separatore delle migliaia e virgola decimale («883.217», «0,5»);
 *   - un codice di macchina o una frase inglese nota → la sua etichetta italiana.
 *
 * Non tocca ciò che una pagina ha già messo in forma (un testo con parole italiane resta com'è),
 * e un elemento con `data-grezzo` si attraversa senza modifiche (per esempio dove l'email è il
 * dato che si sta guardando). È una rete: ogni pagina dovrebbe già mostrare il valore giusto, e il
 * giro (§3) misura dove la rete sta lavorando al posto della pagina.
 */
import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { RubricaResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { useFormat } from "@/lib/format";
import { costruisci, type Leggi } from "@/lib/leggibile-nucleo";
import { Riferimento, useScheda } from "@/components/scheda-rapida";

export type { Leggi };

/** La rubrica del perimetro, una volta per sessione (cambia di rado). */
export function useRubrica() {
  return useQuery({
    queryKey: ["me", "rubrica"],
    queryFn: ({ signal }) => apiFetch<RubricaResponse>("/v1/me/rubrica", { signal }),
    staleTime: 10 * 60_000,
    retry: 0,
  });
}

/** Le etichette dei valori enumerati, da tutti i domini: codice → etichetta. */
function useEnumiPiatti(): Map<string, string> {
  const { i18n } = useTranslation("common");
  const lingua = i18n.language;
  return useMemo(() => {
    const m = new Map<string, string>();
    const bundle = i18n.getResourceBundle(lingua, "common") as { enums?: Record<string, Record<string, string>> } | undefined;
    for (const dominio of Object.values(bundle?.enums ?? {})) {
      for (const [codice, etichetta] of Object.entries(dominio)) if (!m.has(codice)) m.set(codice, etichetta);
    }
    return m;
  }, [i18n, lingua]);
}

export function useLeggibile(): Leggi {
  const fmt = useFormat();
  const enumi = useEnumiPiatti();
  const rubrica = useRubrica();
  const { i18n } = useTranslation();
  const italiano = (i18n.language ?? "it").startsWith("it");
  const schede = useScheda();
  return useMemo(
    () =>
      costruisci(
        fmt, enumi, rubrica.data, italiano,
        schede ? (tipo, id, etichetta) => <Riferimento key={id} tipo={tipo} id={id}>{etichetta}</Riferimento> : undefined,
      ),
    [fmt, enumi, rubrica.data, italiano, schede],
  );
}

/** Per i punti che non passano da `EntityTable`: `<Leggibile>{valore}</Leggibile>`. */
export function Leggibile({ children }: { children: ReactNode }) {
  const l = useLeggibile();
  return <>{l.nodo(children)}</>;
}
