"use client";

/**
 * apps/web/src/lib/agente/contesto.tsx — piano interfacce L10, voce A-8.
 *
 * Il contesto di pagina che il pannello comune dell'agente mostra e passa al gateway. È un
 * VALORE (decisione vincolante 2 di #159): una pagina che sa dire di più («la richiesta di
 * approvazione X») lo dichiara con `useContestoAgente`; le altre ricevono quello predefinito
 * del pannello (titolo della pagina e indirizzo).
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface ValoreContesto {
  contesto: string | null;
  imposta: (v: string | null) => void;
}

const Contesto = createContext<ValoreContesto>({ contesto: null, imposta: () => undefined });

export function ContestoAgenteProvider({ children }: { children: ReactNode }) {
  const [contesto, imposta] = useState<string | null>(null);
  return <Contesto.Provider value={{ contesto, imposta }}>{children}</Contesto.Provider>;
}

/** La pagina dichiara il proprio contesto; lasciando la pagina lo si toglie. */
export function useContestoAgente(valore: string | null): void {
  const { imposta } = useContext(Contesto);
  useEffect(() => {
    imposta(valore);
    return () => imposta(null);
  }, [valore, imposta]);
}

export function useContestoDichiarato(): string | null {
  return useContext(Contesto).contesto;
}
