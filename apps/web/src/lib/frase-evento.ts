/**
 * apps/web/src/lib/frase-evento.ts — K26 del giro forense del 23/11/2026.
 *
 * La sintesi di un evento della storia di una persona è salvata nel dato come frase italiana
 * («Corso completato: GDPR e Privacy»). Nella pagina inglese restava italiana. Qui si separano il
 * tipo e il soggetto, e la pagina compone la frase con `dashboard.catalogo.evento.<tipo>` nella
 * lingua di chi guarda. I prefissi sono gli stessi che l'API riconosce per i cruscotti
 * (`apps/api/src/modules/dashboard/blocchi.ts`, PREFISSI_EVENTO): se la frase non comincia con un
 * prefisso noto, non si inventa niente e resta com'è.
 */
const PREFISSI: Record<string, string> = {
  COURSE_COMPLETED: "Corso completato: ",
  CERTIFICATION_EARNED: "Certificazione conseguita: ",
  HIRE: "Assunto come ",
};

export function parametriEvento(tipo: string, frase: string | null | undefined): { kind: string; subject: string } | null {
  const prefisso = PREFISSI[tipo];
  if (!prefisso || !frase || !frase.startsWith(prefisso)) return null;
  const subject = frase.slice(prefisso.length).trim();
  return subject === "" ? null : { kind: tipo, subject };
}
