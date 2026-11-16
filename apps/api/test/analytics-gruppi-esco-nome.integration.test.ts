/**
 * Giudizio qa-web 16/11, A3 (F1526, F1811, F2391): sette gruppi ESCO (S1.4.2, S1.6.2, S1.9.1, S2.2.1,
 * S3.3.3, S4.0.0, S4.3.1) comparivano col codice perche' la mappa dei nomi era per URI, mentre le competenze
 * portano l'URI a codice (skill/S4.3.1) e sys_skill_groups quello a UUID. Il nome c'e' nella tassonomia ESCO
 * del database, per codice (skill_group_code). Chiama il repository sul database vivo, senza login.
 */
import { describe, it, expect, afterAll } from "vitest";
import { closePool, pool } from "../src/db/client.js";
import { getSkillsGroupShare } from "../src/modules/analytics/repository.js";

afterAll(async () => {
  await closePool();
});

describe("skills-group-share: il nome del gruppo si ricava dalla tassonomia ESCO per codice", () => {
  it("ogni gruppo il cui codice esiste in sys_skill_groups porta il nome di quella riga", async () => {
    const corpo = await getSkillsGroupShare(pool, null);
    const { rows } = await pool.query<{ code: string; name: string }>(
      `SELECT skill_group_code AS code, skill_group_name AS name
         FROM sys.sys_skill_groups WHERE skill_group_code IS NOT NULL`,
    );
    const perCodice = new Map(rows.map((r) => [r.code, r.name]));
    const soloCodice = (c: string): string => c.replace(/^[^/]+\//, "");
    const attesi = corpo.groups.filter((g) => perCodice.has(soloCodice(g.groupCode)));
    expect(attesi.length).toBeGreaterThan(0);
    for (const g of attesi) {
      expect(g.groupName, g.groupCode).toBe(perCodice.get(soloCodice(g.groupCode)));
    }
  });
});
