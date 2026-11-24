"use client";

/**
 * apps/web/src/components/nome-persona.tsx — K22 del giro forense del 23/11/2026.
 *
 * R1 del repertorio interfacce: in ogni elenco una persona si scrive «Cognome, Nome». Molte risposte
 * dell'API portano di una persona solo l'id e il nome visualizzato («Tommaso Esposito»); la rubrica
 * del perimetro ne conosce l'etichetta «Cognome, Nome». Se la rubrica non la conosce resta il nome
 * che la pagina ha; se manca anche quello, «senza nome» (F-3).
 */
import { useRubrica } from "@/lib/leggibile";
import { etichettaDaRubrica } from "@/lib/person-label";
import { NomeOppure } from "@/components/senza-nome";
import type { TestoVisto } from "@/lib/agente/vista-tabella";

export function NomePersona({ nome, id }: { nome: string | null | undefined; id: string | null | undefined }) {
  const rubrica = useRubrica();
  return <NomeOppure nome={etichettaDaRubrica(rubrica.data, id) ?? nome} id={id ?? null} />;
}

/* Il testo che la cella mostra, per la ricerca e l'ordinamento dell'assistente (vista-tabella.ts):
 * lo stesso «Cognome, Nome» della rubrica, non il nome grezzo con l'identificativo. */
(NomePersona as TestoVisto).testoVisto = (p, persona) =>
  (typeof p.id === "string" ? persona?.(p.id) : null) ?? (typeof p.nome === "string" ? p.nome : "");
