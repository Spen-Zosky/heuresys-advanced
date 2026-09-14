import type { z } from "zod";

/**
 * Il limite massimo di un campo di testo, LETTO dal contratto condiviso invece che riscritto.
 *
 * PERCHE' ESISTE (S1101, 2026-09-14). Un form ha bisogno dei propri messaggi tradotti, quindi
 * costruisce uno schema suo; ma i LIMITI dei campi appartengono al contratto (`@heuresys/shared`),
 * e finche' il form li ricopiava (`.max(255)`) esistevano due copie dello stesso numero senza
 * niente che le tenesse allineate. Con questa funzione il numero e' scritto una volta sola: il
 * form lo legge da `Schema.shape.campo` e aggiunge solo il messaggio.
 *
 * Sbuccia `optional()` / `nullable()` / `default()` finche' trova lo `ZodString`. Se il contratto
 * NON dichiara un massimo, lancia: un form che credeva di avere un limite e non ce l'ha piu' deve
 * fallire al primo disegno, non tacere.
 */
export function limiteMassimo(campo: z.ZodType, nome = "campo"): number {
  let s: unknown = campo;
  for (let i = 0; i < 6; i++) {
    const anyS = s as { maxLength?: number | null; unwrap?: () => unknown; removeDefault?: () => unknown };
    if (typeof anyS.maxLength === "number") return anyS.maxLength;
    if (typeof anyS.unwrap === "function") { s = anyS.unwrap(); continue; }
    if (typeof anyS.removeDefault === "function") { s = anyS.removeDefault(); continue; }
    break;
  }
  throw new Error(`il contratto non dichiara un massimo per «${nome}»: il form non puo' derivarlo`);
}
