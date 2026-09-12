const fs = require("node:fs");
const path = require("node:path");

/**
 * La porta dell'API letta dal `.env` di radice (la riga `PORT=`), mai da `process.env.PORT`:
 * sotto `next dev -p N` quella variabile vale N, cioe' la porta del WEB, e il proxy si
 * chiuderebbe su se stesso. Ritorna `null` se il file o la riga non ci sono.
 */
function portaApiDalDotenv() {
  try {
    const testo = fs.readFileSync(path.join(__dirname, "..", "..", ".env"), "utf8");
    const m = testo.match(/^PORT=\s*"?(\d+)"?\s*$/m);
    return m ? `http://localhost:${m[1]}` : null;
  } catch {
    return null;
  }
}

/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // @heuresys/shared is consumed as its compiled dist (exports default -> ./dist/*.js)
  // so Turbopack resolves real .js files (D-58). The source-first branch of those exports
  // is gated behind the CUSTOM "heuresys-source" condition, which no bundler applies on
  // its own — only apps/api opts in explicitly (tsx + tsup). Using the standard
  // "development" name made `next dev` silently pick the .ts sources and fail on their
  // NodeNext ".js" specifiers (D-76). Only @heuresys/ui still needs transpiling.
  transpilePackages: ["@heuresys/ui"],
  experimental: {
    optimizePackageImports: ["lucide-react", "@heuresys/ui"],
  },
  // Proxy /api/* to the Fastify API so cookies (HttpOnly, SameSite=Lax) remain
  // same-origin and CSRF double-submit works without CORS preflights.
  //
  // ⚠ IL RIPIEGO NON E' PIU' MUTO (#219, 2026-09-05). Qui c'era
  // `|| "http://localhost:3001"` in silenzio, e la 3001 non e' l'API di nessuno: e' solo
  // questo ripiego. Quando la suite E2E avvia il proprio web, quel processo non eredita
  // `NEXT_PUBLIC_API_PROXY_BASE_URL` da nessuna parte — l'unit systemd ce l'ha, ma e' un
  // altro processo — e ogni login moriva in `ECONNREFUSED 127.0.0.1:3001`. Misurato sul
  // gemello con l'API viva e sana: `4 failed` (i quattro `auth.setup`) e `82 did not run`.
  // Sono gli stessi quattro che S1083 aveva attribuito al TUNNEL: diagnosi plausibile e
  // sbagliata, e la prova e' che qui il tunnel non c'e' e il guasto era identico.
  //
  // Ora: si deriva da `PORT` quando c'e' (la stessa che il `.env` dichiara per l'API), e
  // se si finisce sul ripiego lo si DICE. Un ripiego silenzioso su un valore inventato non
  // e' un default: e' un depistaggio che costa una corsa e un triage sbagliato.
  //
  // ⚠ E IL RIPIEGO SU `PORT` SI MORDEVA LA CODA (S1097, 2026-09-12, misurato). `next dev -p 3000`
  // scrive `process.env.PORT=3000` nel PROPRIO processo: la riga qui sotto leggeva quella, e il
  // proxy `/api/*` puntava al web stesso — `GET /api/readyz` rispondeva `307 /login?next=/readyz`,
  // ogni login «Impossibile contattare il server», 12/12 `auth.setup` rossi con l'API viva su
  // :3001. La `PORT` che interessa e' quella dell'API, e sta nel `.env` di radice: si legge DA
  // LI', non dall'ambiente del processo, che `next` ha gia' riscritto.
  async rewrites() {
    const esplicita = process.env.NEXT_PUBLIC_API_PROXY_BASE_URL;
    const daPort = portaApiDalDotenv();
    const base = esplicita ?? daPort ?? "http://localhost:3001";
    if (!esplicita && !daPort) {
      console.warn(
        "[next.config] NEXT_PUBLIC_API_PROXY_BASE_URL e PORT non sono dichiarate: " +
          "il proxy /api/* ripiega su http://localhost:3001, che non e' l'API di nessuno. " +
          "Se i login falliscono con ECONNREFUSED, la causa e' questa riga, non il prodotto.",
      );
    }
    return [{ source: "/api/:path*", destination: `${base}/:path*` }];
  },
};
