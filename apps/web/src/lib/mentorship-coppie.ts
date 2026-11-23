/**
 * apps/web/src/lib/mentorship-coppie.ts — K30 (forense 23/11/2026).
 *
 * L'elenco delle coppie di mentoring mostra una coppia se almeno una delle due persone è nel
 * perimetro di chi guarda, e il nome dell'altra arriva vuoto (la pagina lo scrive {omissis}).
 * Gli incontri di una coppia, invece, l'API li dà solo se entrambe le persone sono nel perimetro
 * (`GET /v1/mentorship/pairings/:id/sessions`, apps/api/src/modules/mentorship/service.ts): per una
 * coppia con una persona fuori perimetro risponde 404, e la pagina offriva un pulsante che falliva
 * sempre. Questa funzione dice quando il pulsante ha senso.
 */
export interface CoppiaVisibile {
  mentorUserId: string | null;
  menteeUserId: string | null;
  mentorName: string | null;
  menteeName: string | null;
}

/** true se nessuna delle due persone è nascosta: solo allora gli incontri si possono leggere. */
export function incontriLeggibili(c: CoppiaVisibile): boolean {
  const nascosta = (id: string | null, nome: string | null) => id !== null && !nome;
  return !nascosta(c.mentorUserId, c.mentorName) && !nascosta(c.menteeUserId, c.menteeName);
}
