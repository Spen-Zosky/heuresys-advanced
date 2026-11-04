/**
 * apps/web/src/lib/format.ts — F-1 e F-8 del piano interfacce (lotto L6, 2026-11-04).
 *
 * Un solo modo di mettere in forma date, ore, numeri, importi, percentuali e durate, nella
 * lingua scelta nel portale. Prima c'erano 37 chiamate `toLocale*` senza lingua (la forma la
 * decideva il browser, non la persona), importi sempre in EUR anche quando il dato portava la
 * sua valuta, e date tagliate a mano (`.slice(0, 10)`) che mostravano `2026-11-04`.
 *
 * Regole:
 *   - l'API resta nel formato standard (ISO 8601, numeri JSON); la forma è compito della pagina;
 *   - un valore assente o illeggibile diventa «—», mai `NaN`, `Invalid Date` o una stringa vuota;
 *   - una data senza ora (`YYYY-MM-DD`) si mostra così com'è, senza spostarla di fuso;
 *   - le migliaia hanno sempre il separatore, anche a quattro cifre («1.000»): le colonne
 *     si leggono allineate, e l'italiano regionale («1000») qui non aiuta;
 *   - l'importo usa la valuta del dato; senza valuta si mostra il numero, non si inventa l'euro;
 *   - F-8, una sola convenzione per le percentuali: chi chiama dichiara la scala del dato
 *     (`"0-100"` oppure `"0-1"`), e la forma è sempre quella della lingua («42 %», «42%»).
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

export const VUOTO = "—";

/** Lingua del portale → impostazioni regionali. L'inglese è quello europeo: giorno prima del mese. */
export function localeDi(lingua: string | undefined): string {
  const l = (lingua ?? "it").toLowerCase();
  if (l.startsWith("en")) return "en-GB";
  if (l.startsWith("it")) return "it-IT";
  return l;
}

type Istante = string | number | Date | null | undefined;
const SOLO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

function aIstante(v: Istante): { d: Date; soloData: boolean } | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "string") {
    const m = SOLO_DATA.exec(v);
    if (m) return { d: new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))), soloData: true };
  }
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : { d, soloData: false };
}

function aNumero(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Separatore delle migliaia sempre presente. `"always"` è nello standard (ECMA-402 v3) e nei
 * motori che usiamo, ma i tipi di TypeScript qui conoscono solo il booleano.
 */
const MIGLIAIA_SEMPRE = { useGrouping: "always" } as unknown as Intl.NumberFormatOptions;

export type ScalaPercento = "0-100" | "0-1";

export interface Formati {
  locale: string;
  /** 04/11/2026 */
  data(v: Istante): string;
  /** 04/11/2026, 07:31 */
  dataOra(v: Istante): string;
  /** 07:31 */
  ora(v: Istante): string;
  /** 1.234 · 1.234,5 (decimali massimi, predefinito 0) */
  numero(v: number | string | null | undefined, decimali?: number): string;
  /** 3,0 · 1.234,50 — decimali fissi, per punteggi e indici che si confrontano in colonna */
  numeroFisso(v: number | string | null | undefined, decimali: number): string;
  /** 1.234,50 € con la valuta del dato; senza valuta, il solo numero */
  importo(v: number | string | null | undefined, valuta: string | null | undefined, decimali?: number): string;
  /** 42 % — la scala del dato è dichiarata da chi chiama (F-8) */
  percento(v: number | string | null | undefined, scala: ScalaPercento, decimali?: number): string;
  /** 1 h 5 min · 42 s · 350 ms */
  durata(ms: number | null | undefined): string;
  /** 512 B · 34 KB · 1,2 MB */
  dimensione(byte: number | null | undefined): string;
  /** «3 giorni fa» */
  relativo(v: Istante, ora?: number): string;
}

export function formati(lingua: string | undefined): Formati {
  const locale = localeDi(lingua);
  const it = locale.startsWith("it");

  const data = (v: Istante) => {
    const x = aIstante(v);
    if (!x) return VUOTO;
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      ...(x.soloData ? { timeZone: "UTC" } : {}),
    }).format(x.d);
  };
  const dataOra = (v: Istante) => {
    const x = aIstante(v);
    if (!x) return VUOTO;
    if (x.soloData) return data(v);
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(x.d);
  };
  const ora = (v: Istante) => {
    const x = aIstante(v);
    if (!x || x.soloData) return VUOTO;
    return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(x.d);
  };
  const numero = (v: number | string | null | undefined, decimali = 0) => {
    const n = aNumero(v);
    return n === null ? VUOTO : new Intl.NumberFormat(locale, { ...MIGLIAIA_SEMPRE, maximumFractionDigits: decimali }).format(n);
  };
  const numeroFisso = (v: number | string | null | undefined, decimali: number) => {
    const n = aNumero(v);
    return n === null
      ? VUOTO
      : new Intl.NumberFormat(locale, { ...MIGLIAIA_SEMPRE, minimumFractionDigits: decimali, maximumFractionDigits: decimali }).format(n);
  };
  const importo = (v: number | string | null | undefined, valuta: string | null | undefined, decimali = 2) => {
    const n = aNumero(v);
    if (n === null) return VUOTO;
    if (!valuta) return numero(n, decimali);
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: valuta,
        ...MIGLIAIA_SEMPRE,
        minimumFractionDigits: decimali,
        maximumFractionDigits: decimali,
      }).format(n);
    } catch {
      return `${numero(n, decimali)} ${valuta}`;
    }
  };
  const percento = (v: number | string | null | undefined, scala: ScalaPercento, decimali = 0) => {
    const n = aNumero(v);
    if (n === null) return VUOTO;
    const frazione = scala === "0-100" ? n / 100 : n;
    return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: decimali }).format(frazione);
  };
  const durata = (ms: number | null | undefined) => {
    const n = aNumero(ms ?? null);
    if (n === null) return VUOTO;
    if (n < 1000) return `${numero(n)} ms`;
    const s = n / 1000;
    if (s < 60) return `${numero(s, s < 10 ? 1 : 0)} s`;
    const min = Math.floor(s / 60);
    if (min < 60) return `${numero(min)} min ${numero(Math.round(s % 60))} s`;
    const h = Math.floor(min / 60);
    if (h < 48) return `${numero(h)} h ${numero(min % 60)} min`;
    const g = Math.floor(h / 24);
    return `${numero(g)} ${it ? (g === 1 ? "giorno" : "giorni") : g === 1 ? "day" : "days"} ${numero(h % 24)} h`;
  };
  const dimensione = (byte: number | null | undefined) => {
    const n = aNumero(byte ?? null);
    if (n === null) return VUOTO;
    if (n >= 1024 * 1024) return `${numero(n / (1024 * 1024), 1)} MB`;
    if (n >= 1024) return `${numero(n / 1024)} KB`;
    return `${numero(n)} B`;
  };
  const relativo = (v: Istante, adesso = Date.now()) => {
    const x = aIstante(v);
    if (!x) return VUOTO;
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    const sec = Math.round((x.d.getTime() - adesso) / 1000);
    const abs = Math.abs(sec);
    if (abs < 60) return rtf.format(sec, "second");
    if (abs < 3600) return rtf.format(Math.round(sec / 60), "minute");
    if (abs < 86_400) return rtf.format(Math.round(sec / 3600), "hour");
    if (abs < 30 * 86_400) return rtf.format(Math.round(sec / 86_400), "day");
    return data(v);
  };

  return { locale, data, dataOra, ora, numero, numeroFisso, importo, percento, durata, dimensione, relativo };
}

/** Le funzioni di forma nella lingua corrente del portale. */
export function useFormat(): Formati {
  const { i18n } = useTranslation();
  const lingua = i18n.language;
  return useMemo(() => formati(lingua), [lingua]);
}
