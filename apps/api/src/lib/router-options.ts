/**
 * apps/api/src/lib/router-options.ts — le opzioni del router di Fastify (K27, forense 23/11/2026).
 *
 * Fastify risponde 414 «URI Too Long» quando un parametro di percorso supera `maxParamLength`,
 * che per difetto vale 100. Le sezioni collegate del faldone hanno come identificativo la catena
 * `<figlia>.<colonna>@<madre>.<colonna>` (modules/faldone/catalogo.ts), che arriva a 150 caratteri
 * e oltre: «Mostra le righe» di quelle sezioni falliva sempre con 414. Il contratto ammette fino a
 * 200 caratteri (FaldoneSezioneParamSchema); il tetto qui li copre con la `@` codificata (`%40`).
 * Qui e non dentro app.ts, così la prova lo legge senza le chiavi dell'ambiente.
 */
export const ROUTER_OPTIONS = { maxParamLength: 256 } as const;
