/**
 * apps/api/scripts/collaudo-access.d.mts
 * Tipi per il modulo delle identità di collaudo (#169 F2). Il modulo è .mjs —
 * eseguibile direttamente da Node senza passo di build, perché lo usano anche
 * script lanciati a mano — quindi i tipi vivono qui accanto (stesso pattern di
 * derive-access.d.mts).
 */
export interface CollaudoIdentity {
  email: string;
  displayName: string;
  tenantCode: string;
  roleCode: string;
}
export declare const COLLAUDO_PATH: string;
export declare const COLLAUDO_IDENTITIES: readonly CollaudoIdentity[];
export declare function isCollaudoIdentity(email: string): boolean;
export declare function readCollaudoKey(): Buffer;
export declare function deriveCollaudoPassword(key: Buffer, email: string): string;
