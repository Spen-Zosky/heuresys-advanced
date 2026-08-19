/**
 * apps/api/src/modules/research/sorgenti/gateway.ts
 *
 * LA SORGENTE VERA (#132 F4h) — due giri, e il secondo vede solo cio' che il primo ha fatto
 * leggere DAVVERO.
 *
 *   ① «dove guardare»  → il gateway propone degli indirizzi (li conosce, non li cerca su un
 *                         motore: le domande verso terzi restano fuori, §4.5)
 *   ② l'API li apre     → guardie, limiti, impronta: e' `web-reader.ts`, e non si scavalca
 *   ③ «cosa se ne ricava» → il gateway riceve **solo** il testo delle pagine aperte, avvolto e
 *                         dichiarato non fidato, e restituisce proposte strutturate
 *
 * ⚠ PERCHE' DUE GIRI E NON UNO. Se chi propone potesse citare come fonte un indirizzo che
 * nessuno ha aperto, la proposta porterebbe una fonte **senza impronta** — cioe' una
 * citazione. Il motore la respinge (`SOURCES_PRESENT`), ma la respingerebbe *dopo*: cosi'
 * invece la domanda «da dove viene questo?» ha una risposta per costruzione.
 *
 * Il segreto non compare mai in un messaggio d'errore: se manca, si dice che manca.
 */
import type { ProposalSource, MandatoRicerca, PropostaGrezza } from "../engine.js";
import { risolviDominio } from "../domains/index.js";
import { avvolgiTestoNonFidato } from "../guardia-domande.js";
import { SorgenteNonDisponibileError } from "./index.js";
import { z } from "zod";

export interface ConfigurazioneGateway {
  /** Base del gateway, es. `http://localhost:8790`. */
  url: string;
  token: string;
  /** Quante pagine si chiede di aprire al massimo in una corsa. */
  indirizziMassimi?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

async function chiama(cfg: ConfigurazioneGateway, corpo: unknown): Promise<unknown> {
  const f = cfg.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs ?? 180_000);
  try {
    const res = await f(`${cfg.url.replace(/\/$/, "")}/research/propose`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-research-token": cfg.token },
      body: JSON.stringify(corpo),
      signal: ctrl.signal,
    });
    const testo = await res.text();
    if (!res.ok) {
      throw new SorgenteNonDisponibileError(
        `il fornitore ha risposto ${res.status} — ${testo.slice(0, 300)}`,
      );
    }
    return JSON.parse(testo) as unknown;
  } catch (e) {
    if (e instanceof SorgenteNonDisponibileError) throw e;
    const scaduto = e instanceof Error && e.name === "AbortError";
    throw new SorgenteNonDisponibileError(
      scaduto ? `nessuna risposta entro ${cfg.timeoutMs ?? 180_000} ms` : `${e instanceof Error ? e.message : String(e)}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

export function creaSorgenteGateway(cfg: ConfigurazioneGateway): ProposalSource {
  return {
    chiave: "agent-gateway",
    async proponi(m: MandatoRicerca): Promise<PropostaGrezza[]> {
      const dominio = risolviDominio(m.dominio);

      // ① dove guardare
      const passo1 = (await chiama(cfg, {
        fase: "indirizzi",
        dominio: m.dominio,
        domande: m.domande,
        contesto: m.contesto,
        massimo: cfg.indirizziMassimi ?? 8,
      })) as { indirizzi?: unknown };
      const indirizzi = Array.isArray(passo1.indirizzi)
        ? passo1.indirizzi.filter((x): x is string => typeof x === "string")
        : [];

      // ② l'API apre le pagine: qui passano guardie, limiti e impronta.
      const pagine: Array<{ url: string; testo: string }> = [];
      for (const url of indirizzi) {
        try {
          const p = await m.leggi(url);
          pagine.push({ url: p.url, testo: avvolgiTestoNonFidato(p) });
        } catch {
          // Una pagina che non si apre non ferma la corsa: il motore la registra fra le
          // letture negate, col motivo. Chi propone semplicemente non la vede.
        }
      }
      if (pagine.length === 0) return [];

      // ③ cosa se ne ricava
      const passo2 = (await chiama(cfg, {
        fase: "proposte",
        dominio: m.dominio,
        domande: m.domande,
        contesto: m.contesto,
        pagine,
        schema: z.toJSONSchema(dominio.forma as z.ZodType<unknown>),
      })) as { proposte?: unknown };

      const grezze = Array.isArray(passo2.proposte) ? passo2.proposte : [];
      return grezze
        .filter((x): x is { contenuto: unknown; fonti?: unknown } => typeof x === "object" && x !== null)
        .map((x) => ({
          contenuto: x.contenuto,
          fonti: Array.isArray(x.fonti) ? x.fonti.filter((u): u is string => typeof u === "string") : [],
        }));
    },
  };
}

/**
 * La sorgente configurata dall'ambiente, o `null` se non lo e'.
 *
 * `null` non e' un guasto: e' la dichiarazione che su questa macchina non c'e' chi propone —
 * e chi la riceve (l'avvio dell'applicazione) lascia in piedi la sorgente che lo **dice**,
 * invece di una che finge corse vuote.
 */
export function sorgenteGatewayDaAmbiente(env: NodeJS.ProcessEnv = process.env): ProposalSource | null {
  const url = env.RESEARCH_GATEWAY_URL;
  const token = env.RESEARCH_GATEWAY_TOKEN;
  if (!url || !token) return null;
  const massimi = Number.parseInt(env.RESEARCH_GATEWAY_MAX_PAGES ?? "", 10);
  return creaSorgenteGateway({
    url,
    token,
    ...(Number.isFinite(massimi) && massimi > 0 ? { indirizziMassimi: massimi } : {}),
  });
}
