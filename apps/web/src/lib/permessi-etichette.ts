/**
 * Etichetta di un permesso nella matrice dei ruoli (/admin/roles).
 * La risorsa è la colonna `permission_resource`; l'azione si ricava dal CODICE (`leave:read:self` → `read:self`),
 * perché in alcune righe della tabella la colonna azione è più corta del codice (`leave:read` e `leave:read:self`
 * avevano entrambe `read`, e la pagina mostrava due volte «Assenze · leggere»).
 */
export const chiaveEtichetta = (codice: string): string => codice.replace(/[:.-]/g, "_");

export function risorsaEAzione(
  codice: string,
  risorsa: string,
  azione: string,
): { risorsa: string; azione: string } {
  const prefisso = `${risorsa}:`;
  return { risorsa, azione: codice.startsWith(prefisso) ? codice.slice(prefisso.length) : azione };
}
