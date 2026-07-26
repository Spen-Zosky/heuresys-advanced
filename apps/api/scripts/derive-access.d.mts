/**
 * apps/api/scripts/derive-access.d.mts
 * Tipi per il modulo di derivazione (Z-262). Il modulo è .mjs — eseguibile
 * direttamente da Node senza passo di build, perché lo usano anche script
 * lanciati a mano — quindi i tipi vivono qui accanto.
 */
export declare const REPO: string;
export declare const MASTER_PATH: string;
export declare const REAL_PERSON_EMAILS: readonly string[];
export declare function isRealPerson(email: string): boolean;
export declare function toBase32(buf: Uint8Array): string;
export declare function readMaster(): Buffer;
export declare function derivePassword(master: Buffer, email: string): string;
export declare function deriveTotpSecret(master: Buffer, email: string): string;
