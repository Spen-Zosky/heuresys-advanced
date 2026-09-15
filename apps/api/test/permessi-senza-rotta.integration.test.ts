/**
 * S-2 (mandato K, F2) — ogni permesso del catalogo e' chiesto da almeno una rotta.
 *
 * Un permesso che nessuna rotta chiede e' un potere che esiste solo nel database: si concede e si
 * revoca senza che cambi nulla. Il dossier di settembre ne contava 34. Questo test li CONGELA in una
 * allowlist con motivo per riga (`permessi-senza-rotta.allowlist.json`) e pretende due cose:
 *   1. nessun permesso NUOVO senza rotta (un permesso nasce con la sua rotta, o entra in allowlist
 *      con un motivo scritto — es. i 5 `user_position_assignment:*` in attesa del gesto G-1);
 *   2. l'allowlist puo' solo SCENDERE: se un permesso in allowlist oggi ha una rotta, la riga va tolta
 *      nello stesso commit (altrimenti l'allowlist mente).
 *
 * Il catalogo e' `sys.sys_auth_permissions` (la SoT: non esiste una lista in packages/shared, misurato
 * in I-F/S-2 il 2026-09-15), quindi il test legge il database: e' d'integrazione, non unitario come
 * il mandato scriveva — deviazione dichiarata, non una scelta di comodo. Le rotte si leggono dal
 * sorgente con lo stesso meccanismo del test di deriva (#99 F3): scansione di `apps/api/src` per
 * `requirePermission("<codice>")`, piu' le due costanti `READ`/`WRITE` di `tenant-blueprints/routes.ts`
 * (le sole chiamate non letterali: 20 su 610, misurato).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { pool } from "../src/db/client.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const SRC = join(QUI, "..", "src");
const ALLOWLIST = join(QUI, "permessi-senza-rotta.allowlist.json");

function fileTs(dir: string): string[] {
  const out: string[] = [];
  for (const voce of readdirSync(dir)) {
    const p = join(dir, voce);
    if (statSync(p).isDirectory()) out.push(...fileTs(p));
    else if (voce.endsWith(".ts")) out.push(p);
  }
  return out;
}

/** I permessi chiesti da almeno una rotta: letterali + costanti locali risolte nello stesso file. */
export function permessiChiestiDalleRotte(): Set<string> {
  const chiesti = new Set<string>();
  for (const p of fileTs(SRC)) {
    const testo = readFileSync(p, "utf8");
    const costanti = new Map<string, string>();
    for (const m of testo.matchAll(/const\s+([A-Z_]+)\s*=\s*"([a-z_-]+:[a-z_:.-]+)"/g)) costanti.set(m[1]!, m[2]!);
    for (const m of testo.matchAll(/requirePermission\(\s*(?:"([a-z_-]+:[a-z_:.-]+)"|([A-Z_]+))/g)) {
      if (m[1]) chiesti.add(m[1]);
      else if (m[2] && costanti.has(m[2])) chiesti.add(costanti.get(m[2])!);
    }
  }
  return chiesti;
}

type Allowlist = { permessi: Record<string, string> };

describe("S-2 — ogni permesso del catalogo e' chiesto da almeno una rotta, o e' in allowlist con motivo", () => {
  it("nessun permesso nuovo senza rotta; l'allowlist puo' solo scendere", async () => {
    const r = await pool.query<{ code: string }>(
      "SELECT auth_permission_code AS code FROM sys.sys_auth_permissions ORDER BY 1",
    );
    const catalogo = r.rows.map((x) => x.code);
    expect(catalogo.length, "il catalogo dei permessi e' vuoto: il test non sta guardando il database giusto").toBeGreaterThan(100);

    const chiesti = permessiChiestiDalleRotte();
    expect(chiesti.size, "nessun requirePermission trovato nel sorgente").toBeGreaterThan(100);

    const allow = (JSON.parse(readFileSync(ALLOWLIST, "utf8")) as Allowlist).permessi;
    for (const [code, motivo] of Object.entries(allow)) {
      expect(motivo.trim().length, `allowlist: «${code}» senza motivo`).toBeGreaterThan(0);
    }

    const senzaRotta = catalogo.filter((c) => !chiesti.has(c));
    const nuovi = senzaRotta.filter((c) => !(c in allow));
    const stantii = Object.keys(allow).filter((c) => chiesti.has(c) || !catalogo.includes(c));

    expect(nuovi, "permessi SENZA ROTTA non in allowlist (un permesso nasce con la sua rotta, o entra in allowlist con motivo)").toEqual([]);
    expect(stantii, "righe di allowlist STANTIE (il permesso ha una rotta, o non esiste piu'): l'allowlist puo' solo scendere").toEqual([]);
  });

  it("la prova puo' fallire: il lettore delle rotte riconosce una chiamata quando la vede", () => {
    const chiesti = permessiChiestiDalleRotte();
    // due permessi che il sorgente chiede di sicuro: uno letterale e uno via costante READ/WRITE
    expect(chiesti.has("whistleblowing:read")).toBe(true);
    expect(chiesti.has("tenant_blueprint:read")).toBe(true);
  });
});
