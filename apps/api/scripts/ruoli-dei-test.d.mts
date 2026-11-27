/**
 * apps/api/scripts/ruoli-dei-test.d.mts — tipi di ruoli-dei-test.mjs (stesso pattern di
 * collaudo-access.d.mts: il modulo è .mjs e i tipi vivono qui accanto).
 */
export interface ConcessioneDiTest {
  email: string;
  ruolo: string;
  motivo: string;
  test: string[];
}

export declare const RUOLI_DEI_TEST_PATH: string;
export declare function leggiDichiarazione(percorso?: string): ConcessioneDiTest[];
