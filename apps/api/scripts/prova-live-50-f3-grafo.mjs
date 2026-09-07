/**
 * apps/api/scripts/prova-live-50-f3-grafo.mjs — #50 F3.
 *
 * La dimostrazione LIVE che la Definition of Done pretende: login con una PERSONA
 * REALE e lettura del grafo delle competenze dai dati di produzione. Nessun dato
 * finto, nessun mock: catalogo e archi sono quelli del PostgreSQL della VM.
 *
 *   node apps/api/scripts/prova-live-50-f3-grafo.mjs [base] [email]
 *   node apps/api/scripts/prova-live-50-f3-grafo.mjs https://www.heuresys.com/api
 *
 * ⚠ La derivazione della password NON si riscrive: si IMPORTA da chi la definisce.
 * Riscriverla a memoria, la prima volta che ho scritto questo file, ha prodotto un
 * 401 che sembrava un problema di credenziali ed era invece una funzione inventata.
 *
 * Esiti, con vocabolario chiuso:
 *   0 = OK             il grafo risponde e ha vicinati veri
 *   1 = VUOTO          risponde ma nessuna competenza ha vicini: e' un difetto
 *   2 = NON MISURABILE il login non e' passato (es. 429 del presidio anti-tentativi).
 *                      NON e' un verde e NON e' un rosso: e' «non ho potuto guardare».
 */
import { readMaster, derivePassword } from "./derive-access.mjs";

const base = process.argv[2] ?? "https://www.heuresys.com/api";
const email = process.argv[3] ?? "federica.marchetti@rtl-bank.org";
const key = readMaster();

const jar = [];
async function call(path, opts = {}) {
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: { "content-type": "application/json", cookie: jar.join("; "), ...(opts.headers ?? {}) },
  });
  for (const c of res.headers.getSetCookie?.() ?? []) jar.push(c.split(";")[0]);
  return res;
}

const login = await call("/v1/auth/login", {
  method: "POST",
  body: JSON.stringify({ email, password: derivePassword(key, email) }),
});
const body = await login.json().catch(() => ({}));
console.log(`\n  login ${email} ... HTTP ${login.status}`);

if (login.status !== 200) {
  console.log(
    `  ESITO: NON MISURABILE — il login non e' passato (${login.status}). ` +
      "Non e' un giudizio sul grafo: non ho potuto guardare.",
  );
  process.exitCode = 2;
} else if (body.status === "mfa_required") {
  console.log(
    "  ESITO: NON MISURABILE — la persona ha il secondo fattore attivo e questo script " +
      "non lo completa. La prova con MFA la fa la suite E2E (skills-graph.spec.ts).",
  );
  process.exitCode = 2;
} else {
  const cat = await call("/v1/skills?search=inform&limit=5");
  const items = (await cat.json()).items ?? [];
  console.log(`  catalogo /v1/skills ... HTTP ${cat.status}, ${items.length} competenze`);

  let conVicini = 0;
  for (const s of items) {
    const g = await call(`/v1/skills/graph?root=${s.skillId}&depth=2`);
    if (g.status !== 200) {
      console.log(`  grafo «${s.name}»: HTTP ${g.status}`);
      continue;
    }
    const b = await g.json();
    console.log(
      `  grafo «${s.name}» — nodi ${b.counts.nodes} · dichiarati ${b.counts.explicitEdges} · appartenenza ${b.counts.groupEdges}`,
    );
    if (b.counts.nodes > 1) conVicini++;
  }

  if (conVicini > 0) {
    console.log(`\n  ESITO: OK — ${conVicini} competenze con vicinato vero, lette da una persona reale\n`);
  } else {
    console.log("\n  ESITO: VUOTO — il grafo risponde ma nessuna competenza ha vicini\n");
    process.exitCode = 1;
  }
}
