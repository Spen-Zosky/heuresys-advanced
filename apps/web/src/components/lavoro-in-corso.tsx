"use client";

/**
 * apps/web/src/components/lavoro-in-corso.tsx — il riquadro di un lavoro lungo che blocca la pagina
 * (regola `.claude/rules/attese-bloccanti.md`, Enzo 2026-11-16).
 *
 * Mentre `attivo` è vero mostra `WorkInProgress` di `@heuresys/ui` (animazione evidente, titolo,
 * dettaglio, barra determinata se arriva `valore`/`massimo` dall'API). Quando il lavoro finisce dopo
 * almeno qualche secondo suona il segnale di fine, discreto, che la persona spegne con l'interruttore
 * nel riquadro (la scelta resta nel browser). Il segnale non sostituisce l'esito scritto della pagina.
 */
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { WorkInProgress, isEndSignalEnabled, playEndSignal, setEndSignalEnabled } from "@heuresys/ui";

/** Sotto questa durata un lavoro non è «lungo» e la fine non suona. */
const DURATA_MINIMA_MS = 3000;

export interface LavoroInCorsoProps {
  attivo: boolean;
  titolo: string;
  dettaglio?: string;
  valore?: number | null;
  massimo?: number;
}

export function LavoroInCorso({ attivo, titolo, dettaglio, valore, massimo }: LavoroInCorsoProps) {
  const { t } = useTranslation();
  const inizio = useRef<number | null>(null);
  const [suono, setSuono] = useState(true);

  useEffect(() => {
    setSuono(isEndSignalEnabled());
  }, []);

  useEffect(() => {
    if (attivo) {
      inizio.current ??= Date.now();
      return;
    }
    const partito = inizio.current;
    inizio.current = null;
    if (partito !== null && Date.now() - partito >= DURATA_MINIMA_MS) void playEndSignal();
  }, [attivo]);

  if (!attivo) return null;
  return (
    <WorkInProgress
      title={titolo}
      {...(dettaglio ? { detail: dettaglio } : {})}
      {...(valore !== undefined ? { value: valore } : {})}
      {...(massimo !== undefined ? { max: massimo } : {})}
      className="my-4"
    >
      <label className="flex items-center gap-2 text-xs text-muted-fg">
        <input
          type="checkbox"
          checked={suono}
          onChange={(e) => {
            setSuono(e.target.checked);
            setEndSignalEnabled(e.target.checked);
          }}
        />
        {t("attesa.suonoAllaFine")}
      </label>
    </WorkInProgress>
  );
}
