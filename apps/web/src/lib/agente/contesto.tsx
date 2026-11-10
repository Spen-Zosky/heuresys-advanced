"use client";

/**
 * apps/web/src/lib/agente/contesto.tsx — piano interfacce L10, voce A-8.
 *
 * Il contesto di pagina che il pannello comune dell'agente mostra e passa al gateway. È un
 * VALORE (decisione vincolante 2 di #159): una pagina che sa dire di più («la richiesta di
 * approvazione X») lo dichiara con `useContestoAgente`; le altre ricevono quello predefinito
 * del pannello (titolo della pagina e indirizzo).
 */
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import type { EsitoPagina } from "./vista-tabella";

/**
 * Il ponte con la pagina (piano dell'assistente nelle interfacce, blocco I1; logica L3 in
 * `docs/architecture/agenti/LOGICHE_assistente-nelle-interfacce.md`). Una parte della pagina (oggi
 * ogni `EntityTable`) dichiara che cosa mostra e quali comandi della vista accetta, e li esegue
 * quando l'assistente li manda. Vale l'ultima dichiarata ancora montata.
 */
export interface VistaDichiarata {
  /** Un riassunto di ciò che si vede (colonne, quante righe): mai le righe stesse. */
  vista: Record<string, unknown>;
  comandi: readonly string[];
  esegui: (nome: string, argomenti: Record<string, unknown>) => EsitoPagina;
}

interface ValoreContesto {
  contesto: string | null;
  imposta: (v: string | null) => void;
  registra: (id: string, v: VistaDichiarata | null) => void;
  vistaAttuale: () => VistaDichiarata | null;
}

const Contesto = createContext<ValoreContesto>({
  contesto: null,
  imposta: () => undefined,
  registra: () => undefined,
  vistaAttuale: () => null,
});

export function ContestoAgenteProvider({ children }: { children: ReactNode }) {
  const [contesto, imposta] = useState<string | null>(null);
  // In un riferimento e non nello stato: una tabella che cambia righe non deve ridisegnare il guscio.
  const viste = useRef(new Map<string, VistaDichiarata>());
  const registra = useCallback((id: string, v: VistaDichiarata | null) => {
    viste.current.delete(id);
    if (v) viste.current.set(id, v);
  }, []);
  const vistaAttuale = useCallback(() => [...viste.current.values()].at(-1) ?? null, []);
  const valore = useMemo(() => ({ contesto, imposta, registra, vistaAttuale }), [contesto, registra, vistaAttuale]);
  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>;
}

/** Una parte della pagina dichiara la sua vista e i comandi che esegue; smontandola si toglie. */
export function useVistaAgente(v: VistaDichiarata | null): void {
  const { registra } = useContext(Contesto);
  const id = useId();
  useEffect(() => {
    registra(id, v);
  }, [id, v, registra]);
  useEffect(() => () => registra(id, null), [id, registra]);
}

/** Per il pannello: la vista dichiarata in questo momento, letta quando serve (all'invio, a un comando). */
export function useVistaAttuale(): () => VistaDichiarata | null {
  return useContext(Contesto).vistaAttuale;
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
