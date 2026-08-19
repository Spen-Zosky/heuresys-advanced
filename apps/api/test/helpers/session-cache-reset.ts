/**
 * apps/api/test/helpers/session-cache-reset.ts — Z-251 F2, globalSetup.
 *
 * Azzera la cache delle sessioni e il contatore dei login veri **all'inizio di ogni corsa**.
 * Non è igiene formale: una sessione lasciata da una corsa precedente sarebbe valida per
 * firma anche se nel frattempo il database è stato ripristinato o si punta a un altro
 * ambiente — cioè un token giusto per una popolazione sbagliata. Meglio ricomprarsi sette
 * login all'avvio che diagnosticare quel genere di rosso.
 *
 * Sta in `globalSetup`, non in `setupFiles`, perché deve girare UNA volta per corsa: in
 * `setupFiles` girerebbe per ogni file, cancellando esattamente ciò che deve sopravvivere.
 */

import { azzeraCache, azzeraContatore } from "./session-cache.js";

export default function (): void {
  azzeraCache();
  azzeraContatore();
}
