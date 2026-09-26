/**
 * Le SOGLIE in persone distinte — il CRITERIO in codice, mai i numeri (#251, ADR-0040 §3).
 *
 * ⭐ PERCHÉ NON CI SONO 25 E 40 SCRITTI QUI. 25 e 40 sono i valori iniziali di **RTL Bank**,
 * tarati il 2026-09-08. Su un cliente da 5.000 dipendenti sarebbero sbagliati, e nessuno
 * potrebbe accorgersene rileggendo il codice: un numero del genere è vero il giorno in cui lo
 * scrivi e falso poco dopo (⭐ IL PUNTO FISSO del progetto). Perciò qui vive **il criterio**,
 * e le misure a cui si applica arrivano dal file GENERATO `docs/kb/agent-soglie-persone.json`
 * (`docs/kb/tools/build_soglie_agente.py`, che esegue le tre interrogazioni dichiarate
 * dall'ADR). Se il tenant più grande cambia, si rigenera il file e le soglie seguono.
 *
 * IL CRITERIO, letto per intero dall'ADR §3 («il livello silenzioso copre l'unità più grande;
 * la conferma scatta appena sopra» + «coprono qualunque unità e il 90% delle catene»):
 *
 *   soglia ALTA  (oltre → si chiede) = l'unità più grande del tenant, arrotondata per
 *                                      eccesso al multiplo di 5. Nessuna unità, nemmeno la
 *                                      più grande e comprese le posizioni vacanti, fa
 *                                      fermare l'agente: la conferma scatta appena sopra.
 *   soglia BASSA (oltre → si scrive  = il p90 delle persone distinte per catena, idem. Il
 *                 nel diario)          90% delle catene — «la mia catena», l'uso normale —
 *                                      resta nel livello silenzioso.
 *
 * Sui dati di RTL Bank misurati il 2026-09-26 (38 posizioni nell'unità più grande, p90 delle
 * catene 21,4) il criterio produce **25 / 40**, cioè esattamente i valori iniziali dell'ADR:
 * è `soglie-persone.test.ts` a dimostrarlo, non questo commento.
 *
 * ⚠ LA MISURA (2) DELL'ADR — persone con incarico attivo per unità, max 9 — È SCARTATA, e la
 * ragione sta scritta perché non si rifaccia a memoria: metterebbe la soglia **sotto** l'unità
 * più grande, cioè attrito sull'uso normale. La decisione è D1 in
 * `.programmi/251-contatore-persone-distinte.md`.
 *
 * ⚠ SOGLIE ASSENTI ≠ «VA BENE». Se il file generato manca o è illeggibile, `caricaSoglie()`
 * restituisce `undefined` e il livello diventa `non-misurato`. Il contratto per `#252`:
 * `non-misurato` si tratta **come oltre la soglia alta** (si chiede), mai come silenzioso.
 * È la stessa dottrina di `AtlasOperationResolver`: l'ignoto non è un permesso.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

/** I quattro livelli della dottrina. `non-misurato` è il quarto, e non è un sinonimo di verde. */
export type LivelloPersone = "silenzioso" | "dichiarato" | "confermato" | "non-misurato";

/** Le misure che il criterio consuma. Nomi identici alle chiavi del file generato. */
export interface MisureTenant {
  tenantPiuGrande: string;
  /** Misura (1) dell'ADR: posizioni per unità, vacanti incluse. */
  massimoPosizioniPerUnita: number;
  /** Misura (3) dell'ADR: p90 delle persone distinte per catena (sottoalbero di unità). */
  p90PersonePerCatena: number;
  misuratoIl?: string;
}

export interface Soglie {
  /** Fino a questa, silenzioso. Oltre, il diario registra quante persone. */
  bassa: number;
  /** Oltre questa si chiede la conferma umana (`#252`). */
  alta: number;
  /** Da dove vengono i due numeri: il tenant e il giorno della misura. Per il diario e i referti. */
  provenienza: { tenant: string; misuratoIl: string };
}

/**
 * Arrotondamento per eccesso al multiplo di 5. Non è estetica: una soglia che segue la misura
 * al decimale cambierebbe a ogni assunzione, e un freno che si sposta ogni giorno non è
 * leggibile da chi lo subisce. Il gradino di 5 la rende stabile e dichiarabile a voce.
 */
export function arrotondaPerEccesso(valore: number, gradino = 5): number {
  if (!Number.isFinite(valore) || valore <= 0) return gradino;
  return Math.ceil(valore / gradino) * gradino;
}

/** Il criterio dell'ADR §3, applicato alle misure. Pura: nessun file, nessun database. */
export function derivaSoglie(m: MisureTenant): Soglie {
  const alta = arrotondaPerEccesso(m.massimoPosizioniPerUnita);
  const bassa = arrotondaPerEccesso(m.p90PersonePerCatena);
  return {
    // Se le due misure si incrociassero (un tenant con catene larghe e unità piccole) la
    // bassa non può superare l'alta: due soglie invertite renderebbero il livello
    // `dichiarato` impossibile, cioè cancellerebbero un livello senza che nessuno lo decida.
    bassa: Math.min(bassa, alta),
    alta,
    provenienza: { tenant: m.tenantPiuGrande, misuratoIl: m.misuratoIl ?? "non dichiarato" },
  };
}

/** Il livello di una conversazione che ha toccato `persone` persone distinte. */
export function livelloDi(persone: number, soglie?: Soglie): LivelloPersone {
  if (!soglie) return "non-misurato";
  if (persone > soglie.alta) return "confermato";
  if (persone > soglie.bassa) return "dichiarato";
  return "silenzioso";
}

/**
 * La radice del repo, RISALITA dalla posizione di questo modulo — non dalla cwd: il gateway
 * parte dalla radice e i test da `apps/agent-gateway`. Stessa ragione, stesso codice e stesso
 * commento di `atlas-resolver.ts`, dove il difetto fu trovato eseguendo, non ragionandoci.
 */
function radiceRepo(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const su = dirname(dir);
    if (su === dir) break;
    dir = su;
  }
  return process.cwd();
}

export const PERCORSO_MISURE = "docs/kb/agent-soglie-persone.json";

/**
 * Legge le misure generate e ri-deriva le soglie. `undefined` se il file manca, non è
 * leggibile o non porta le due misure: il chiamante lo traduce in `non-misurato`.
 *
 * ⚠ Si rideriva a ogni chiamata dalle MISURE del file, e non si leggono soglie dal file
 * nemmeno se ci fossero: così il file non può mentire sul criterio. Chi lo modificasse a mano
 * potrebbe cambiare la misura — che è un fatto verificabile con una query — non la regola.
 */
export function caricaSoglie(percorso?: string): Soglie | undefined {
  const p = percorso
    ? isAbsolute(percorso) ? percorso : resolvePath(radiceRepo(), percorso)
    : join(radiceRepo(), PERCORSO_MISURE);
  if (!existsSync(p)) return undefined;
  try {
    const dati = JSON.parse(readFileSync(p, "utf8")) as Partial<MisureTenant>;
    if (typeof dati.massimoPosizioniPerUnita !== "number") return undefined;
    if (typeof dati.p90PersonePerCatena !== "number") return undefined;
    return derivaSoglie({
      tenantPiuGrande: typeof dati.tenantPiuGrande === "string" ? dati.tenantPiuGrande : "non dichiarato",
      massimoPosizioniPerUnita: dati.massimoPosizioniPerUnita,
      p90PersonePerCatena: dati.p90PersonePerCatena,
      ...(typeof dati.misuratoIl === "string" ? { misuratoIl: dati.misuratoIl } : {}),
    });
  } catch {
    return undefined; // illeggibile o non JSON → non-misurato, non un valore inventato
  }
}
