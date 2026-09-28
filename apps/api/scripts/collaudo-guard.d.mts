/**
 * apps/api/scripts/collaudo-guard.d.mts
 * Tipi per la guardia di collaudo (#261). Il modulo è .mjs — eseguibile
 * direttamente da Node senza passo di build, perché lo usano script lanciati
 * a mano — quindi i tipi vivono qui accanto (stesso pattern di collaudo-access.d.mts).
 */
export declare const MACCHINE_GEMELLO: ReadonlySet<string>;

export interface CondizioneMacchina {
  hostname: string | undefined;
  postgresHost: string | undefined;
  postgresPort: string | number | undefined;
}

export interface CondizioneCollaudo extends CondizioneMacchina {
  nodeEnv: string | undefined;
  postgresDb: string | undefined;
}

export declare function dbSiDichiaraDiCollaudo(postgresDb: string | undefined): boolean;
export declare function suGemelloLocale(cond: CondizioneMacchina): boolean;
export declare function eDiCollaudoDa(cond: CondizioneCollaudo): boolean;
