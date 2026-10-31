/**
 * apps/api/src/modules/tenant-consolidation/giudice.ts — AC-8.
 *
 * Il cliente del giudice: manda un lotto al gateway (`POST /consolidation/propose`, AC-6) e ne
 * convalida la risposta con lo schema condiviso. Il gateway non si fida del modello, l'API non
 * si fida del gateway: una risposta fuori forma è un guasto, non un elenco vuoto.
 *
 * Il lotto si controlla due volte prima di partire: lo schema `.strict()` (nessun campo in più)
 * e la ricerca dei nomi di persona (`batchCarriesPersonKeys`), lo stesso criterio del gateway.
 * Il segreto non compare mai in un messaggio d'errore.
 */
import { batchCarriesPersonKeys, JudgeBatchSchema, JudgeResponseSchema } from "@heuresys/shared";
import { InternalError } from "../../errors/index.js";
import type { Giudice } from "./engine.js";

export interface ConfigurazioneGiudice {
  url: string;
  token: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export function creaGiudice(cfg: ConfigurazioneGiudice): Giudice {
  return async (lotto) => {
    const valido = JudgeBatchSchema.parse(lotto);
    if (batchCarriesPersonKeys(valido)) {
      throw new InternalError("CONSOLIDATION_BATCH_PERSON", "il lotto contiene un identificativo di persona");
    }
    const f = cfg.fetchImpl ?? fetch;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs ?? 180_000);
    try {
      const res = await f(`${cfg.url.replace(/\/$/, "")}/consolidation/propose`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-consolidation-token": cfg.token },
        body: JSON.stringify(valido),
        signal: ctrl.signal,
      });
      const testo = await res.text();
      if (!res.ok) {
        throw new InternalError(
          "CONSOLIDATION_JUDGE_FAILED",
          `il giudice ha risposto ${res.status} — ${testo.slice(0, 300)}`,
          "Il giudice del consolidamento non ha risposto",
        );
      }
      return JudgeResponseSchema.parse(JSON.parse(testo)).answers;
    } catch (e) {
      if (e instanceof InternalError) throw e;
      const scaduto = e instanceof Error && e.name === "AbortError";
      throw new InternalError(
        "CONSOLIDATION_JUDGE_FAILED",
        scaduto ? `nessuna risposta entro ${cfg.timeoutMs ?? 180_000} ms` : e instanceof Error ? e.message : String(e),
        "Il giudice del consolidamento non ha risposto",
      );
    } finally {
      clearTimeout(timer);
    }
  };
}

/** Il giudice configurato dall'ambiente, o `null`: senza gateway non si fanno giri semantici. */
export function giudiceDaAmbiente(env: NodeJS.ProcessEnv = process.env): Giudice | null {
  const url = env.CONSOLIDATION_GATEWAY_URL;
  const token = env.CONSOLIDATION_GATEWAY_TOKEN;
  if (!url || !token) return null;
  return creaGiudice({ url, token });
}
