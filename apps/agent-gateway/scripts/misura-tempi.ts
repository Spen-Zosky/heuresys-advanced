/**
 * Misura dal vivo dei tempi dell'assistente — piano dell'assistente nelle interfacce, blocco I6 (L8).
 *
 * Manda la stessa richiesta al gateway MISURE_GIRI volte, ognuna in una conversazione nuova, e per
 * ogni giro scrive quanto si è aspettato il primo segno di vita, il primo comando della vista, il
 * primo strumento, la prima frase e la fine (tappe in `src/misura-tempi.ts`). Il primo giro dopo
 * l'avvio del gateway è «a freddo»; gli altri sono «a caldo». A un comando della vista risponde
 * «rifiutata» con la ragione vera (qui non c'è una pagina), così il giro non resta ad aspettare.
 *
 * Sessione: AGENT_COOKIE con i cookie hrx_access e hrx_csrf di una persona ammessa (per esempio
 * dal banco di verifica). Non legge né scrive niente da sé: le letture le fa l'assistente.
 *
 *   AGENT_GATEWAY=http://127.0.0.1:8791 AGENT_COOKIE='hrx_access=…; hrx_csrf=…' \
 *   MISURE_GIRI=3 pnpm --filter @heuresys/agent-gateway exec tsx scripts/misura-tempi.ts
 *
 * Uscita: 0 se ogni giro è finito con done, 1 altrimenti, 2 se manca la sessione.
 */
import { mediana, tappe, type BloccoArrivato, type Tappe } from "../src/misura-tempi.js";

const GATEWAY = (process.env.AGENT_GATEWAY ?? "http://127.0.0.1:8790").replace(/\/$/, "");
const COOKIE = process.env.AGENT_COOKIE ?? "";
const GIRI = Math.max(1, Number(process.env.MISURE_GIRI ?? "3") || 3);
const PROMPT =
  process.env.MISURE_PROMPT ?? "Quante unità organizzative ha il mio tenant? Rispondi con una frase sola.";
const PAGINA = { percorso: "/organization", titolo: "Organizzazione", comandi: ["filtra", "ordina"] };

function csrf(): string {
  const m = /(?:^|;\s*)hrx_csrf=([^;]+)/.exec(COOKIE);
  return m?.[1] ?? "";
}

async function rifiutaComando(testo: string): Promise<void> {
  const riga = testo.split("\n").find((r) => r.startsWith("data:"));
  if (!riga) return;
  const { commandId } = JSON.parse(riga.slice(5)) as { commandId?: string };
  if (!commandId) return;
  await fetch(`${GATEWAY}/agent/esiti`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: COOKIE, "x-csrf-token": csrf() },
    body: JSON.stringify({ commandId, stato: "rifiutata", dettaglio: "misura dei tempi: nessuna pagina aperta" }),
  });
}

async function giro(): Promise<Tappe> {
  const t0 = performance.now();
  const r = await fetch(`${GATEWAY}/agent`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: COOKIE },
    body: JSON.stringify({ prompt: PROMPT, pagina: PAGINA }),
  });
  if (!r.ok || !r.body) throw new Error(`gateway HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const blocchi: BloccoArrivato[] = [];
  const lettore = r.body.getReader();
  const dec = new TextDecoder();
  let resto = "";
  for (;;) {
    const { done, value } = await lettore.read();
    if (done) break;
    resto += dec.decode(value, { stream: true });
    const pezzi = resto.split("\n\n");
    resto = pezzi.pop() ?? "";
    for (const testo of pezzi) {
      if (!testo.trim()) continue;
      blocchi.push({ ms: Math.round(performance.now() - t0), testo });
      if (testo.startsWith("event: page_command")) void rifiutaComando(testo);
    }
  }
  return tappe(blocchi);
}

const s = (v: number | null) => (v === null ? "—" : `${(v / 1000).toFixed(1)} s`);

async function main(): Promise<number> {
  if (!COOKIE.includes("hrx_access=")) {
    console.error("manca AGENT_COOKIE con hrx_access (e hrx_csrf per rispondere ai comandi)");
    return 2;
  }
  console.log(`misura dei tempi — gateway ${GATEWAY}, ${GIRI} giri, ${new Date().toISOString()}`);
  console.log("giro | primo byte | primo strumento | primo comando | primo testo | fine | esito");
  const tutti: Tappe[] = [];
  for (let i = 1; i <= GIRI; i++) {
    const t = await giro();
    tutti.push(t);
    const tipo = i === 1 ? "freddo" : "caldo";
    console.log(
      `${i} (${tipo}) | ${s(t.primoByte)} | ${s(t.primoStrumento)} | ${s(t.primoComando)} | ${s(t.primoTesto)} | ${s(t.fine)} | ${t.esito ?? "chiuso"}`,
    );
  }
  const caldi = tutti.slice(1);
  if (caldi.length > 0) {
    console.log(
      `mediana a caldo | ${s(mediana(caldi.map((t) => t.primoByte)))} | ${s(mediana(caldi.map((t) => t.primoStrumento)))} | ${s(mediana(caldi.map((t) => t.primoComando)))} | ${s(mediana(caldi.map((t) => t.primoTesto)))} | ${s(mediana(caldi.map((t) => t.fine)))} |`,
    );
  }
  return tutti.every((t) => t.esito === "done") ? 0 : 1;
}

main().then(
  (c) => process.exit(c),
  (e) => {
    console.error("misura fallita:", e);
    process.exit(1);
  },
);
