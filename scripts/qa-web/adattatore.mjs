// Adattatore di heuresys-advanced per lo strumento qa-web (skill «Fai QA web»).
// Sceglie le persone dal database e le fa entrare come fa il giro delle interfacce
// (scripts/analisi/giro-interfacce.ts): password derivata dalla chiave madre, secondo
// fattore dal fattore TOTP con etichetta derived-access. Database solo in READ ONLY.
// Nessuna password, nessun segreto e nessun codice finisce nel registro o a schermo.
// Va lanciato con tsx dalla cartella apps/api, perché importa sorgenti TypeScript:
//   cd apps/api && npx tsx <qa-web.mjs> esegui --giro <cartella>
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const radice = (p) => p.__radice;
let dbAperto = null;
async function db(profilo) {
  if (dbAperto) return dbAperto;
  const { pool } = await import(pathToFileURL(join(radice(profilo), 'apps/api/src/db/client.ts')).href);
  dbAperto = async (sql, par = []) => {
    const c = await pool.connect();
    try { await c.query('BEGIN READ ONLY'); const r = await c.query(sql, par); await c.query('ROLLBACK'); return r.rows; }
    catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; }
    finally { c.release(); }
  };
  return dbAperto;
}

// Una persona per ruolo e per tenant (attiva, STANDARD, con fattore derived-access), come il giro;
// per USER e TEAM_MEMBER chi non dirige; mai le persone reali escluse da derive-access.
// Con QA_WEB_SOLO=<sigla,sigla> si limita il giro a quelle persone.
export async function persone(profilo) {
  const q = await db(profilo);
  const { REAL_PERSON_EMAILS } = await import(pathToFileURL(join(radice(profilo), 'apps/api/scripts/derive-access.mjs')).href);
  const [rtl] = await q("select tenant_id from sys.sys_tenancies where tenant_code = 'RTL_BANK'");
  const righe = await q(`with base as (
       select r.auth_role_code ruolo, u.user_email email, u.user_id, u.user_tenant_id tenant_id,
              exists(select 1 from sys.sys_user_position_assignments a where a.user_position_assignment_user_id = u.user_id and a.user_position_assignment_status = 'ACTIVE') incarico,
              exists(select 1 from sys.sys_organization_units o where o.organization_unit_manager_user_id = u.user_id and o.organization_unit_is_active) dirige,
              exists(select 1 from sys.sys_auth_mfa_factors f where f.auth_mfa_factor_user_id = u.user_id and f.auth_mfa_factor_kind = 'TOTP' and f.auth_mfa_factor_metadata->>'label' = 'derived-access') fattore
         from sys.sys_user_auth_roles uar
         join sys.sys_auth_roles r on r.auth_role_id = uar.user_auth_role_role_id
         join sys.sys_users u on u.user_id = uar.user_auth_role_user_id
        where uar.user_auth_role_revoked_at is null and u.user_status = 'ACTIVE' and u.user_type = 'STANDARD'
          and lower(u.user_email) <> all($1::text[]))
     select * from base
      order by ruolo, tenant_id, fattore desc,
               case when ruolo in ('USER','TEAM_MEMBER') then not dirige else dirige end desc, incarico desc, email`,
    [REAL_PERSON_EMAILS.map((e) => e.toLowerCase())]);
  // per ogni ruolo e tenant la prima persona che può entrare e non è già stata scelta per un altro ruolo:
  // così ogni ruolo ha la sua persona, invece di sparire dietro chi ne ha già un altro
  const out = [{ sigla: 'ANON', ruolo: '(anonimo)' }];
  const viste = new Set(), coperti = new Set();
  const senzaFattore = [];
  for (const r of righe) {
    const k = r.ruolo + '|' + r.tenant_id;
    if (coperti.has(k) || viste.has(r.user_id)) continue;
    if (!r.fattore) { if (!righe.some((x) => x.ruolo === r.ruolo && x.tenant_id === r.tenant_id && x.fattore && !viste.has(x.user_id))) senzaFattore.push(k); continue; }
    coperti.add(k); viste.add(r.user_id);
    out.push({ sigla: `${r.tenant_id === rtl?.tenant_id ? 'RTL' : 'SYS'}-${r.ruolo}`, ruolo: r.ruolo, email: r.email, userId: r.user_id, fattore: r.fattore });
  }
  // un ruolo senza nessuna persona che possa entrare resta scritto nel registro come persona non visitabile
  for (const k of new Set(senzaFattore)) if (!coperti.has(k)) { const [ruolo, t] = k.split('|'); out.push({ sigla: `${t === rtl?.tenant_id ? 'RTL' : 'SYS'}-${ruolo}`, ruolo, email: null, nota: 'nessun titolare con secondo fattore derived-access' }); }
  const solo = (process.env.QA_WEB_SOLO || '').split(',').filter(Boolean);
  return solo.length ? out.filter((p) => solo.includes(p.sigla)) : out;
}

export async function entra(ctx, p, profilo) {
  if (!p.email) return 'persona senza email nel giro';
  const base = profilo.base.replace(/\/$/, '');
  const { readMaster, derivePassword } = await import(pathToFileURL(join(radice(profilo), 'apps/api/scripts/derive-access.mjs')).href);
  const password = derivePassword(readMaster(), p.email);
  const r1 = await ctx.request.post(`${base}/api/v1/auth/login`, { data: { email: p.email, password } });
  if (r1.status() !== 200) return `rifiutato al primo passo (${r1.status()})`;
  const b1 = await r1.json();
  if (b1.status === 'success' || b1.status === undefined) return 'ok';
  if (b1.status !== 'mfa_required') return `stato inatteso ${b1.status}`;
  const q = await db(profilo);
  const [f] = await q(`select f.auth_mfa_factor_secret s from sys.sys_auth_mfa_factors f
      where f.auth_mfa_factor_user_id = $1 and f.auth_mfa_factor_kind = 'TOTP' and f.auth_mfa_factor_metadata->>'label' = 'derived-access' limit 1`, [p.userId]);
  if (!f) return 'secondo fattore richiesto e nessun fattore derived-access';
  const { decryptSecret } = await import(pathToFileURL(join(radice(profilo), 'apps/api/src/modules/auth/secret-crypto.ts')).href);
  const otp = createRequire(join(radice(profilo), 'apps/api/package.json'))('otpauth');
  const codice = new otp.TOTP({ algorithm: 'SHA1', digits: 6, period: 30, secret: otp.Secret.fromBase32(decryptSecret(f.s)) }).generate();
  const r2 = await ctx.request.post(`${base}/api/v1/auth/login`, { data: { email: p.email, password, challengeToken: b1.challengeToken, mfaCode: codice } });
  const b2 = await r2.json().catch(() => ({}));
  return r2.status() === 200 && b2.status === 'success' ? 'ok (secondo fattore)' : `rifiutato al secondo passo (${r2.status()})`;
}

// La lingua: il cookie NEXT_LOCALE per il primo disegno, e la preferenza salvata (GET /v1/me/preferences)
// riscritta nella sola risposta al browser, così il giro in inglese non scrive niente sul profilo della persona.
export async function impostaLingua(ctx, lingua, profilo) {
  const host = new URL(profilo.base).hostname;
  await ctx.addCookies([{ name: 'NEXT_LOCALE', value: lingua, domain: host, path: '/' }]);
  await ctx.route('**/v1/me/preferences', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const r = await route.fetch();
    let corpo = await r.text();
    try { const j = JSON.parse(corpo); const giu = (o) => { if (o && typeof o === 'object') for (const k of Object.keys(o)) { if (k === 'locale') o[k] = lingua; else giu(o[k]); } }; giu(j); corpo = JSON.stringify(j); } catch {}
    return route.fulfill({ response: r, body: corpo });
  });
}
