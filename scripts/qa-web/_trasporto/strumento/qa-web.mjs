#!/usr/bin/env node
// qa-web — QA forense delle interfacce web, deterministico.
// Lo strumento scopre, censisce ed esercita ogni nodo; il modello giudica solo le righe
// che chiedono un occhio; il registro decide quando il lavoro è finito.
//
//   qa-web avvia    --profilo <qa-web.json> --giro <cartella>   prepara il giro e la coda
//   qa-web esegui   --giro <cartella> [--minuti N]               lavora la coda (riprendibile)
//   qa-web giudica  --giro <cartella> [--limite N]               elenca le righe da giudicare (TSV)
//   qa-web giudica  --giro <cartella> --verdetti <file.tsv>      registra i verdetti (id, verdetto, causa)
//   qa-web stato    --giro <cartella>                            esce 0 solo se ogni riga ha un verdetto e la coda è vuota
//   qa-web rapporto --giro <cartella>                            RAPPORTO.md, PIANO.md, registro.tsv dal registro
//
// Sicurezza: con ambiente «produzione» ogni richiesta che non sia GET/HEAD/OPTIONS viene
// bloccata nel browser prima di partire, salvo le eccezioni del profilo (per esempio il login).
process.removeAllListeners('warning');
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { apri, verifica as verificaGrezza, accoda, firmaNuova } from './lib/registro.mjs';
import { controllaTesto, incoerenzeEtichette, controllaPagina } from './lib/controlli.mjs';

const QUI = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const ora = () => new Date().toISOString();
// eccezioni dichiarate nel profilo: {codice, persona?, regex} su dettaglio o nome del nodo; la riga resta nel registro
// come NON-APPLICABILE con la ragione scritta nel profilo, così un'eccezione non nasconde niente
let ECCEZIONI = [];
function verifica(db, uid, nodo, codice, esito, dettaglio, evidenza, causa) {
  if (esito === 'FAIL' || esito === 'GIUDIZIO') {
    const u = db.prepare('select persona, url from unita where id=?').get(uid);
    const e = ECCEZIONI.find(x => x.codice === codice && (!x.persona || x.persona === u.persona) && (!x.url || new RegExp(x.url).test(u.url)) && (!x.regex || new RegExp(x.regex).test((dettaglio || '') + ' ' + (nodo?.nome || ''))));
    if (e) return verificaGrezza(db, uid, nodo, codice, 'NA', dettaglio, evidenza, 'eccezione del profilo: ' + (e.ragione || 'senza ragione'));
  }
  return verificaGrezza(db, uid, nodo, codice, esito, dettaglio, evidenza, causa);
}
const VERDETTI = new Set(['OK', 'DIFETTO', 'NON-APPLICABILE', 'BLOCCATO']);

function carica(giro) {
  const dir = resolve(giro);
  const profilo = JSON.parse(readFileSync(join(dir, 'profilo.json'), 'utf8'));
  ECCEZIONI = (profilo.eccezioni || []).filter(e => !e.testo);
  return { dir, profilo, db: apri(join(dir, 'registro.sqlite')) };
}

// ------------------------------------------------------------------ scoperta delle rotte
function rotteDalCodice(profilo, radice) {
  const r = profilo.rotte;
  if (!r) return [];
  if (r.tipo === 'next-app') {
    const base = resolve(radice, r.cartella);
    const out = [];
    const giu = (d, segs) => {
      for (const e of readdirSync(d)) {
        const p = join(d, e);
        if (statSync(p).isDirectory()) {
          if (e === 'api' || e.startsWith('_') || e.startsWith('@')) continue;
          giu(p, /^\(.*\)$/.test(e) ? segs : [...segs, e]);
        } else if (/^page\.(t|j)sx?$/.test(e)) out.push('/' + segs.join('/'));
      }
    };
    giu(base, []);
    return out.map(u => u.replace(/\/+$/, '') || '/');
  }
  if (r.tipo === 'elenco') return r.pagine;
  throw new Error('tipo di rotte non conosciuto: ' + r.tipo);
}
const dinamica = (u) => /\[[^\]]+\]/.test(u);
const modelloDi = (patt) => new RegExp('^' + patt.replace(/\[\.\.\.[^\]]+\]/g, '.+').replace(/\[[^\]]+\]/g, '[^/]+') + '$');

// ------------------------------------------------------------------ avvia
async function avvia() {
  const profiloFile = resolve(opt('profilo'));
  const dir = resolve(opt('giro'));
  mkdirSync(join(dir, 'schermate'), { recursive: true });
  const profilo = JSON.parse(readFileSync(profiloFile, 'utf8'));
  profilo.__radice = profilo.radice ? resolve(dirname(profiloFile), profilo.radice) : dirname(profiloFile);
  if (profilo.adattatore) profilo.__adattatore = resolve(dirname(profiloFile), profilo.adattatore);
  writeFileSync(join(dir, 'profilo.json'), JSON.stringify(profilo, null, 2));
  const db = apri(join(dir, 'registro.sqlite'));
  const rotte = rotteDalCodice(profilo, profilo.__radice);
  const statiche = rotte.filter(u => !dinamica(u));
  const din = rotte.filter(dinamica);
  db.prepare('insert or replace into meta values (?,?)').run('rotte', JSON.stringify(rotte));
  db.prepare('insert or replace into meta values (?,?)').run('avviato', ora());
  const ad = profilo.__adattatore ? await import(pathToFileURL(profilo.__adattatore).href) : {};
  const persone = ad.persone ? await ad.persone(profilo) : (profilo.persone || [{ sigla: 'ANON' }]);
  db.prepare('insert or replace into meta values (?,?)').run('persone', JSON.stringify(persone.map(p => ({ sigla: p.sigla, ruolo: p.ruolo || '' }))));
  const viewports = profilo.viewport || [[1440, 900], [390, 844]];
  const lingue = profilo.lingue || ['it'];
  let n = 0;
  const iniziali = [...new Set([...(profilo.pagine_iniziali || ['/']), ...statiche])];
  for (const p of persone) for (const [w, h] of viewports) for (const l of lingue)
    for (const u of iniziali) if (!(profilo.escludi || []).some(x => u.startsWith(x))) n += accoda(db, { url: u, persona: p.sigla, viewport: `${w}x${h}`, lingua: l, fonte: 'codice' }) ? 1 : 0;
  console.log(`giro pronto in ${dir}: ${rotte.length} rotte nel codice (${din.length} con parametri, si raggiungono dai collegamenti), ${persone.length} persone, ${viewports.length} formati, ${lingue.length} lingue, ${n} unità in coda`);
}

// ------------------------------------------------------------------ esegui
async function esegui() {
  const { dir, profilo, db } = carica(opt('giro'));
  const fine = Date.now() + Number(opt('minuti', '100000')) * 60000;
  // Playwright si cerca accanto al progetto, poi accanto allo strumento, poi nella cartella corrente
  const { chromium } = (() => {
    for (const b of [profilo.__radice, QUI, process.cwd()].filter(Boolean)) { try { return createRequire(join(b, 'package.json'))('playwright'); } catch {} }
    return require('playwright');
  })();
  const ad = profilo.__adattatore ? await import(pathToFileURL(profilo.__adattatore).href) : {};
  const browser = await chromium.launch(process.env.QA_WEB_CHROMIUM ? { executablePath: process.env.QA_WEB_CHROMIUM } : {});
  const script = readFileSync(join(QUI, 'lib', 'nella-pagina.js'), 'utf8');
  const axe = (() => {
    for (const b of [profilo.__radice, join(profilo.__radice || '.', 'apps/web'), QUI, process.cwd()].filter(Boolean)) { try { return readFileSync(createRequire(join(b, 'package.json')).resolve('axe-core/axe.min.js'), 'utf8'); } catch {} }
    return null;
  })();
  const rotte = JSON.parse(db.prepare("select valore from meta where chiave='rotte'").get()?.valore || '[]');
  const modelli = rotte.map(r => ({ r, re: modelloDi(r) }));
  const persone = JSON.parse(db.prepare("select valore from meta where chiave='persone'").get()?.valore || '[]');
  const sessioni = new Map();
  const base = profilo.base.replace(/\/$/, '');
  const ammessa = (u, m) => ['GET', 'HEAD', 'OPTIONS'].includes(m) || profilo.ambiente !== 'produzione' ||
    (profilo.scritture_ammesse || []).some(re => new RegExp(re).test(new URL(u).pathname));
  const pausa = Number(profilo.pausa_ms ?? 400);

  async function contesto(sigla, viewport, lingua) {
    const [w, h] = viewport.split('x').map(Number);
    const chiave = sigla;
    if (!sessioni.has(chiave)) {
      const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: lingua === 'en' ? 'en-GB' : 'it-IT' });
      let esito = 'ok';
      if (sigla !== 'ANON' && ad.entra) esito = await ad.entra(c, persone.find(p => p.sigla === sigla) || { sigla }, profilo);
      sessioni.set(chiave, { stato: await c.storageState(), esito });
      await c.close();
    }
    const s = sessioni.get(chiave);
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, storageState: s.stato, locale: lingua === 'en' ? 'en-GB' : 'it-IT' });
    if (ad.impostaLingua) await ad.impostaLingua(ctx, lingua, profilo);
    return { ctx, esitoAccesso: s.esito };
  }

  let fatte = 0;
  for (;;) {
    if (Date.now() > fine) { console.log('tempo finito: il giro riprende con un nuovo «esegui»'); break; }
    const u = db.prepare("select * from unita where stato='da-fare' order by profondita, id limit 1").get();
    if (!u) {
      // ogni rotta con parametri che nessun collegamento ha raggiunto diventa una riga da giudicare:
      // o si trova la strada, o si scrive perché per quella persona non esiste
      const raggiunte = new Set(db.prepare("select distinct substr(fonte,6) r from unita where fonte like 'link:%'").all().map(r => r.r));
      for (const r of rotte.filter(dinamica).filter(r => !raggiunte.has(r))) {
        if (accoda(db, { url: r, persona: '*', viewport: '-', lingua: '-', fonte: 'non-raggiunta' })) {
          const id = db.prepare("select id from unita where url=? and persona='*'").get(r).id;
          db.prepare("update unita set stato='fatta', finita=? where id=?").run(ora(), id);
          verifica(db, id, null, 'P-NON-RAGGIUNTA', 'GIUDIZIO', `la rotta ${r} non è stata raggiunta da nessun collegamento, per nessuna persona: manca una strada nell'interfaccia, mancano dati, o la pagina è morta?`);
        }
      }
      console.log('coda vuota'); break;
    }
    db.prepare("update unita set stato='in-corso', iniziata=? where id=?").run(ora(), u.id);
    let ctx;
    try {
      const c = await contesto(u.persona, u.viewport, u.lingua);
      ctx = c.ctx;
      if (u.persona !== 'ANON' && !String(c.esitoAccesso).startsWith('ok')) {
        verifica(db, u.id, null, 'P-ACCESSO', 'BLOCCATO', 'accesso della persona non riuscito: ' + c.esitoAccesso, null, 'accesso non riuscito: ' + c.esitoAccesso);
        db.prepare("update unita set stato='fatta', finita=?, errore=? where id=?").run(ora(), 'accesso: ' + c.esitoAccesso, u.id);
        continue;
      }
      await lavora(ctx, u);
      // sessione persa a metà giro (scadenza, rinnovo revocato): si rientra una volta e si rifà l'unità
      const fu = db.prepare('select url_finale from unita where id=?').get(u.id).url_finale;
      if (u.persona !== 'ANON' && profilo.pagina_accesso && fu === profilo.pagina_accesso && u.url !== profilo.pagina_accesso && !u.errore) {
        sessioni.delete(u.persona);
        await ctx.close(); ctx = null;
        db.prepare('delete from verifica where unita_id=?').run(u.id);
        db.prepare("update unita set stato='da-fare', errore='sessione persa: rientrata' where id=?").run(u.id);
        verifica(db, u.id, null, 'P-SESSIONE', 'GIUDIZIO', 'la persona si è trovata fuori dalla sessione a metà giro: rientrata e unità rifatta. Se capita spesso è un difetto del rinnovo della sessione');
        continue;
      }
      db.prepare("update unita set stato='fatta', finita=? where id=?").run(ora(), u.id);
    } catch (e) {
      db.prepare("update unita set stato='fatta', finita=?, errore=? where id=?").run(ora(), String(e.message || e).slice(0, 500), u.id);
      verifica(db, u.id, null, 'X-ERRORE-GIRO', 'GIUDIZIO', 'lo strumento non ha completato l\'unità: ' + String(e.message || e).slice(0, 300));
    } finally { if (ctx) await ctx.close().catch(() => {}); }
    fatte++;
    if (fatte % 10 === 0) console.log(`${fatte} unità fatte; in coda ${db.prepare("select count(*) n from unita where stato='da-fare'").get().n}`);
  }
  await browser.close();

  // ---------------------------------------------------------------- una unità: pagina × persona × formato × lingua × stato
  async function lavora(ctx, u) {
    const percorso = JSON.parse(u.percorso);
    const primaria = u.viewport === (profilo.viewport?.[0] || [1440, 900]).join('x') && u.lingua === (profilo.lingue || ['it'])[0];
    const page = await ctx.newPage();
    const rete = [], errori = [];
    let azione = 'caricamento';
    await page.route('**/*', (route) => {
      const r = route.request();
      if (!ammessa(r.url(), r.method())) {
        rete.push({ azione, metodo: r.method(), url: r.url(), stato: 0, bloccata: 1, corpo: (r.postData() || '').slice(0, 300) });
        return route.abort('blockedbyclient');
      }
      return route.continue();
    });
    const t0 = new Map();
    page.on('request', r => t0.set(r, Date.now()));
    page.on('response', r => { const q = r.request(); if (['xhr', 'fetch', 'document'].includes(q.resourceType())) rete.push({ azione, metodo: q.method(), url: r.url(), stato: r.status(), bloccata: 0, ms: Date.now() - (t0.get(q) || Date.now()) }); });
    page.on('console', m => { if (m.type() === 'error') { if (!/ERR_BLOCKED_BY_CLIENT/.test(m.text())) errori.push({ azione, testo: m.text().slice(0, 300) }); }; });
    page.on('pageerror', e => errori.push({ azione, testo: 'eccezione: ' + String(e.message).slice(0, 300) }));
    page.on('dialog', d => d.dismiss().catch(() => {}));

    const vai = async () => {
      const t = Date.now();
      const resp = await page.goto(base + u.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForLoadState('networkidle', { timeout: Number(profilo.attesa_rete_ms ?? 6000) }).catch(() => {});
      await page.addScriptTag({ content: script });
      for (const a of percorso) { await agisci(page, a, true); }
      return { resp, ms: Date.now() - t };
    };
    const { resp, ms } = await vai();
    const finale = new URL(page.url()).pathname;
    const sigla = `u${u.id}`;
    const shot = join('schermate', sigla + '.png');
    await page.screenshot({ path: join(dir, shot), fullPage: true }).catch(() => {});
    const c = await page.evaluate(() => window.__qaWeb.censisci());
    const firmaBase = await page.evaluate(() => window.__qaWeb.firma());
    db.prepare('update unita set firma=?, url_finale=?, http=?, ms=?, screenshot=? where id=?').run(firmaBase, finale, resp?.status() ?? null, ms, shot, u.id);
    firmaNuova(db, `${finale}|${u.persona}|${u.viewport}|${u.lingua}`, firmaBase);

    // una pagina che rimanda a un'altra già censita si registra solo come rimando
    const giaVista = percorso.length === 0 && finale !== u.url.split('?')[0] && db.prepare("select 1 from unita where id<>? and url_finale=? and persona=? and viewport=? and lingua=? and percorso='[]' and stato='fatta' and screenshot is not null").get(u.id, finale, u.persona, u.viewport, u.lingua);
    if (giaVista) {
      verifica(db, u.id, null, 'P-HTTP', (resp?.status() ?? 0) >= 400 ? 'FAIL' : 'PASS', `risposta ${resp?.status()}`, shot);
      verifica(db, u.id, null, 'P-RIMANDO', 'GIUDIZIO', `la pagina ${u.url} porta a ${finale}, già censita: è voluto per questa persona?`, shot);
      await page.close(); return;
    }
    // --- la pagina in sé
    if (percorso.length === 0) {
      const st = resp?.status() ?? 0;
      verifica(db, u.id, null, 'P-HTTP', st >= 400 ? 'FAIL' : 'PASS', `risposta ${st}`, shot);
      if (finale !== u.url.split('?')[0]) verifica(db, u.id, null, 'P-RIMANDO', 'GIUDIZIO', `la pagina ${u.url} porta a ${finale}: è voluto per questa persona?`, shot);
      verifica(db, u.id, null, 'P-TEMPO', ms > 5000 ? 'GIUDIZIO' : 'PASS', `pronta in ${ms} ms`, shot);
      if (!c.layout.titolo) verifica(db, u.id, null, 'P-TITOLO', 'FAIL', 'la pagina non ha titolo', shot);
    }
    const lingAttesa = u.lingua;
    if (c.lingua && !c.lingua.startsWith(lingAttesa)) verifica(db, u.id, null, 'P-LANG', 'FAIL', `attributo lang «${c.lingua}» in una pagina ${lingAttesa}`, shot);
    verifica(db, u.id, null, 'L-SCORRIMENTO', c.layout.scorrimentoOrizzontale ? 'FAIL' : 'PASS', c.layout.scorrimentoOrizzontale ? `la pagina scorre in orizzontale a ${c.layout.larghezza} px` : 'nessuno scorrimento orizzontale', shot);
    verifica(db, u.id, null, 'G-RENDER', 'GIUDIZIO', `rendering, impaginazione e leggibilità della pagina ${u.url}${percorso.length ? ' dopo ' + percorso.map(a => a.descr).join(' → ') : ''} (${u.viewport}, ${u.lingua})`, shot);
    for (const r of rete.filter(r => r.azione === 'caricamento')) if (r.stato >= 400) verifica(db, u.id, null, 'R-RETE', 'FAIL', `${r.metodo} ${new URL(r.url).pathname} → ${r.stato} al caricamento`, shot);
    for (const e of errori.filter(e => e.azione === 'caricamento')) verifica(db, u.id, null, 'R-CONSOLE', 'FAIL', 'errore in console al caricamento: ' + e.testo, shot);

    // --- ogni testo
    const chiaveBase = (g) => `${u.persona}|${u.lingua}|${g ? '' : finale}`;
    for (const t of c.testi) {
      // il contenuto si controlla una volta per persona e lingua (il guscio una volta sola, non per pagina);
      // l'impaginazione una volta per formato
      const nuovoTesto = firmaNuova(db, 'T|' + chiaveBase(t.guscio), t.percorso + '|' + t.testo);
      const nuovoLayout = firmaNuova(db, 'L|' + chiaveBase(t.guscio) + '|' + u.viewport, t.percorso + '|' + t.testo);
      if (!nuovoTesto && !nuovoLayout) continue;
      const ril = controllaTesto(t, { linguaAttesa: lingAttesa, glossario: profilo.glossario, eccezioni: profilo.eccezioni });
      for (const r of ril) {
        const diLayout = ['T-TRONCATO', 'T-FUORI', 'T-CORPO'].includes(r.codice);
        if (diLayout ? nuovoLayout : nuovoTesto) verifica(db, u.id, { percorso: t.percorso, tipo: 'testo', nome: t.testo.slice(0, 120) }, r.codice, r.esito, r.dettaglio, shot);
      }
    }
    for (const r of controllaPagina(c.testoPagina || '')) if (firmaNuova(db, 'P|' + chiaveBase(false), r.dettaglio)) verifica(db, u.id, null, r.codice, r.esito, r.dettaglio, shot);
    const doppie = incoerenzeEtichette(c.interattivi.map(i => i.nome).filter(Boolean));
    for (const d of doppie) verifica(db, u.id, null, 'T-ETICHETTE', 'GIUDIZIO', 'la stessa etichetta scritta in modi diversi nella pagina: ' + d.join(' / '), shot);
    // --- tabelle, grafici, immagini
    for (const tb of c.tabelle) {
      if (!firmaNuova(db, 'G|' + chiaveBase(false) + '|' + u.viewport, tb.percorso + '|' + tb.intestazioni.join('|'))) continue;
      verifica(db, u.id, { percorso: tb.percorso, tipo: 'tabella', nome: tb.intestazioni.join(' | ').slice(0, 120) }, 'G-TABELLA', 'GIUDIZIO', `tabella di ${tb.righe} righe e ${tb.intestazioni.length} colonne: i dati sono leggibili e interpretabili da una persona (descrizioni e non codici, unità, ordine)?`, shot);
      if (tb.vuote) verifica(db, u.id, { percorso: tb.percorso, tipo: 'tabella' }, 'T-CELLE-VUOTE', 'FAIL', `${tb.vuote} celle vuote su ${tb.celle}, senza un segno che dica perché`, shot);
      if (!tb.intestazioni.length) verifica(db, u.id, { percorso: tb.percorso, tipo: 'tabella' }, 'T-INTESTAZIONI', 'FAIL', 'tabella senza intestazioni di colonna', shot);
    }
    for (const im of c.immagini) if (im.rotta) verifica(db, u.id, { percorso: im.percorso, tipo: 'immagine' }, 'I-ROTTA', 'FAIL', 'immagine che non si carica', shot);
    if (!primaria) { await page.close(); return; }

    // --- accessibilità
    if (axe && percorso.length === 0) {
      await page.addScriptTag({ content: axe });
      const ris = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.map(v => ({ id: v.id, impatto: v.impact, n: v.nodes.length, aiuto: v.help, nodi: v.nodes.slice(0, 5).map(n => n.target.join(' ')) })));
      for (const v of ris) verifica(db, u.id, { percorso: v.nodi.join(', '), tipo: 'a11y' }, 'A-' + v.id, 'FAIL', `${v.aiuto} (${v.impatto}, ${v.n} elementi)`, shot);
      if (!ris.length) verifica(db, u.id, null, 'A-AXE', 'PASS', 'nessuna violazione axe', shot);
    } else if (!axe && percorso.length === 0) verifica(db, u.id, null, 'A-AXE', 'BLOCCATO', 'axe-core non trovato', shot, 'axe-core non installato accanto allo strumento o nel progetto');

    // --- grafici: passaggio del mouse
    for (const g of c.grafici) {
      if (!firmaNuova(db, 'C|' + chiaveBase(false), g.percorso)) continue;
      const testi = new Set();
      for (let i = 1; i <= 8; i++) {
        await page.mouse.move(g.rett[0] + (g.rett[2] * i) / 9, g.rett[1] + g.rett[3] / 2);
        await page.waitForTimeout(150);
        const t = await page.evaluate(() => window.__qaWeb.tooltip());
        if (t) testi.add(t);
      }
      await page.mouse.move(0, 0);
      const nodo = { percorso: g.percorso, tipo: 'grafico', nome: g.etichetta };
      verifica(db, u.id, nodo, 'C-DINAMICO', testi.size >= 2 ? 'PASS' : 'FAIL', testi.size >= 2 ? `${testi.size} suggerimenti diversi al passaggio del mouse` : testi.size === 1 ? 'un solo suggerimento in otto punti: il grafico non segue il mouse' : 'nessun suggerimento al passaggio del mouse', shot);
      for (const t of testi) for (const r of controllaTesto({ testo: t }, { linguaAttesa: lingAttesa, glossario: profilo.glossario, eccezioni: profilo.eccezioni })) verifica(db, u.id, { ...nodo, nome: t.slice(0, 120) }, r.codice, r.esito, 'nel suggerimento del grafico: ' + r.dettaglio, shot);
      verifica(db, u.id, nodo, 'G-GRAFICO', 'GIUDIZIO', 'grafico leggibile: assi, legenda, unità, colori distinguibili, valori sensati?', shot);
    }

    // --- ogni elemento interattivo
    const elenco = c.interattivi;
    for (let i = 0; i < elenco.length; i++) {
      const n = elenco[i];
      // ogni elemento si esercita una volta: quelli del guscio (menu, testata) una volta per persona
      if (!firmaNuova(db, 'E|' + chiaveBase(n.guscio), n.percorso + '|' + n.nome + '|' + n.href)) continue;
      if (Date.now() > fine) { verifica(db, u.id, n, 'E-ESERCIZIO', 'GIUDIZIO', 'tempo del giro finito prima di questo elemento: rilanciare'); continue; }
      if ((profilo.escludi_nodi || []).some(re => new RegExp(re, 'i').test(n.nome))) { verifica(db, u.id, n, 'E-ESERCIZIO', 'NA', 'escluso dal profilo', null, 'escluso dal profilo: ' + n.nome); continue; }
      if (n.disabilitato) { verifica(db, u.id, n, 'E-ESERCIZIO', 'GIUDIZIO', 'elemento disabilitato: è chiaro a una persona perché?'); continue; }
      if (!n.nome && n.tipo !== 'riga' && n.tipo !== 'cliccabile') verifica(db, u.id, n, 'E-SENZA-NOME', 'FAIL', 'elemento interattivo senza nome leggibile');
      if (n.tipo === 'link' && n.href && !n.href.startsWith('#') && !n.href.startsWith('javascript')) { await provaLink(n); continue; }
      if (n.tipo === 'file') { verifica(db, u.id, n, 'E-ESERCIZIO', 'BLOCCATO', 'caricamento di file', null, 'caricare un file è una scrittura: non si prova in produzione'); continue; }
      azione = 'n' + i;
      const primaRete = rete.length, primaErr = errori.length;
      const primaUrl = page.url();
      const esiti = [];
      try {
        const a = { percorso: n.percorso, tipo: n.tipo, descr: `${n.tipo} «${n.nome.slice(0, 40)}»` };
        const varianti = n.tipo === 'select' ? n.opzioni.map(o => ({ ...a, valore: o, descr: a.descr + ' = ' + o })) : [a];
        for (const v of varianti) {
          const prima = await page.evaluate(() => window.__qaWeb.firma()).catch(() => '');
          const eff = await agisci(page, v, false);
          await page.waitForTimeout(pausa);
          await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
          const dopoUrl = page.url();
          let dopo = '';
          try { await page.addScriptTag({ content: script }); dopo = await page.evaluate(() => window.__qaWeb.firma()); } catch {}
          const tip = await page.evaluate(() => window.__qaWeb?.tooltip?.() || '').catch(() => '');
          esiti.push({ v, eff, cambioUrl: dopoUrl !== primaUrl, cambioStato: dopo && dopo !== prima, tip, dopoUrl, dopo });
          // uno stato nuovo dentro la stessa pagina si censisce ed esercita a sua volta
          if (dopoUrl === primaUrl && dopo && dopo !== prima && u.profondita < (profilo.profondita_stati ?? 3)) {
            if (firmaNuova(db, `${finale}|${u.persona}|${u.viewport}|${u.lingua}`, dopo))
              accoda(db, { url: u.url, persona: u.persona, viewport: u.viewport, lingua: u.lingua, percorso: [...percorso, v], profondita: u.profondita + 1, fonte: 'stato', padre: u.id });
          }
          if (dopoUrl !== primaUrl) scoperta(dopoUrl, u.id);
          // si torna allo stato di partenza
          if (dopoUrl !== primaUrl || (dopo && dopo !== firmaBase)) {
            await page.keyboard.press('Escape').catch(() => {});
            await page.waitForTimeout(150);
            const ora_ = await page.evaluate(() => window.__qaWeb?.firma?.()).catch(() => '');
            if (page.url() !== primaUrl || ora_ !== firmaBase) await vai();
          }
        }
      } catch (e) {
        verifica(db, u.id, n, 'E-ESERCIZIO', 'GIUDIZIO', 'l\'azione non è riuscita: ' + String(e.message).split('\n')[0].slice(0, 200));
        await vai().catch(() => {});
        continue;
      }
      const reteAz = rete.slice(primaRete);
      const bloccate = reteAz.filter(r => r.bloccata);
      // gli errori provocati dal nostro blocco delle scritture non sono difetti della pagina
      const errAz = errori.slice(primaErr).filter(e => !(bloccate.length && /ERR_BLOCKED_BY_CLIENT|Failed to fetch|NetworkError|Load failed/i.test(e.testo)));
      const guaste = reteAz.filter(r => !r.bloccata && r.stato >= 400);
      const effetto = esiti.some(e => e.cambioUrl || e.cambioStato || e.tip || e.eff === 'cambiato') || reteAz.length > 0;
      const descr = esiti.map(e => `${e.v.descr}: ${e.cambioUrl ? 'porta a ' + new URL(e.dopoUrl).pathname : e.cambioStato ? 'cambia lo stato della pagina' : e.tip ? 'suggerimento «' + e.tip.slice(0, 60) + '»' : e.eff === 'cambiato' ? 'valore cambiato' : 'nessun effetto visibile'}`).join('; ');
      let esito = 'PASS', det = descr;
      if (errAz.length) { esito = 'FAIL'; det = descr + ' | errori in console: ' + errAz.map(e => e.testo).join(' / ').slice(0, 300); }
      else if (guaste.length) { esito = 'FAIL'; det = descr + ' | chiamate in errore: ' + guaste.map(r => `${r.metodo} ${new URL(r.url).pathname} → ${r.stato}`).join(', '); }
      else if (!effetto) { esito = 'GIUDIZIO'; det = descr + ' | è un elemento che non deve fare niente?'; }
      if (bloccate.length) det += ' | scritture bloccate prima di partire: ' + bloccate.map(r => `${r.metodo} ${new URL(r.url).pathname}`).join(', ');
      verifica(db, u.id, n, 'E-ESERCIZIO', esito, det);
      for (const r of reteAz) db.prepare('insert into rete values (?,?,?,?,?,?,?)').run(u.id, n.percorso, r.metodo, r.url, r.stato, r.bloccata, r.ms ?? null);
    }
    await page.close();

    async function provaLink(n) {
      const assoluto = new URL(n.href, page.url()).toString();
      const interno = assoluto.startsWith(base);
      try {
        const r = await ctx.request.get(assoluto, { maxRedirects: 5, timeout: 20000 });
        verifica(db, u.id, n, 'E-LINK', r.status() >= 400 ? 'FAIL' : 'PASS', `${interno ? 'collegamento interno' : 'collegamento esterno'} ${assoluto} → ${r.status()}`);
      } catch (e) { verifica(db, u.id, n, 'E-LINK', 'FAIL', `collegamento ${assoluto} non raggiungibile: ${String(e.message).slice(0, 120)}`); }
      if (interno) scoperta(assoluto, u.id);
    }
  }

  function scoperta(assoluto, padre) {
    const url = new URL(assoluto);
    if (!url.toString().startsWith(base)) return;
    const path = url.pathname.replace(/\/$/, '') || '/';
    if ((profilo.escludi || []).some(x => path.startsWith(x))) return;
    const u = db.prepare('select persona, viewport, lingua from unita where id=?').get(padre);
    // una pagina con parametri si visita per ogni rotta del codice che la descrive, con gli id trovati
    const m = modelli.find(x => x.re.test(path));
    const conta = m && dinamica(m.r) ? db.prepare("select count(*) n from unita where fonte like ? and persona=? and viewport=? and lingua=?").get('link:' + m.r, u.persona, u.viewport, u.lingua).n : 0;
    if (m && dinamica(m.r) && conta >= (profilo.id_per_rotta ?? 3)) return;
    for (const [w, h] of profilo.viewport || [[1440, 900], [390, 844]]) for (const l of profilo.lingue || ['it'])
      accoda(db, { url: path + url.search, persona: u.persona, viewport: `${w}x${h}`, lingua: l, fonte: m && dinamica(m.r) ? 'link:' + m.r : 'link', padre });
  }
}

// esegue un'azione su un nodo; restituisce 'cambiato' se il valore del controllo è cambiato
async function agisci(page, a, rigioca) {
  const loc = page.locator(a.percorso.replace(/^html>/, 'html > ').replace(/>/g, ' > ')).first();
  const t = a.tipo;
  if (t === 'select') { await loc.selectOption(a.valore, { timeout: 5000 }); return 'cambiato'; }
  if (['input', 'search', 'textarea', 'searchbox', 'textbox'].includes(t)) {
    const prima = await loc.inputValue({ timeout: 3000 }).catch(() => '');
    await loc.fill('qa', { timeout: 5000 }); await page.waitForTimeout(300);
    if (!rigioca) await loc.fill(prima, { timeout: 5000 });
    return 'cambiato';
  }
  if (t === 'date') { await loc.fill('2026-01-15', { timeout: 5000 }); return 'cambiato'; }
  if (['checkbox', 'switch', 'radio', 'menuitemcheckbox', 'menuitemradio'].includes(t)) {
    const prima = await loc.evaluate(e => e.checked ?? e.getAttribute('aria-checked')).catch(() => null);
    await loc.click({ timeout: 5000 });
    const dopo = await loc.evaluate(e => e.checked ?? e.getAttribute('aria-checked')).catch(() => null);
    if (!rigioca && t !== 'radio') await loc.click({ timeout: 5000 }).catch(() => {});
    return String(prima) !== String(dopo) ? 'cambiato' : 'fermo';
  }
  await loc.hover({ timeout: 5000 }).catch(() => {});
  await loc.click({ timeout: 5000 });
  return 'cliccato';
}

// ------------------------------------------------------------------ giudica
function giudica() {
  const { db } = carica(opt('giro'));
  const file = opt('verdetti');
  if (!file) {
    const lim = Number(opt('limite', '200'));
    const righe = db.prepare(`select v.id, u.url, u.persona, u.viewport, u.lingua, v.controllo, v.nodo_tipo, v.nodo_nome, v.dettaglio, v.evidenza
      from verifica v join unita u on u.id=v.unita_id where v.verdetto is null order by v.controllo, v.id limit ?`).all(lim);
    console.log(['id', 'url', 'persona', 'formato', 'lingua', 'controllo', 'tipo', 'nodo', 'dettaglio', 'schermata'].join('\t'));
    for (const r of righe) console.log([r.id, r.url, r.persona, r.viewport, r.lingua, r.controllo, r.nodo_tipo || '', (r.nodo_nome || '').replace(/\s+/g, ' '), (r.dettaglio || '').replace(/\s+/g, ' '), r.evidenza || ''].join('\t'));
    const n = db.prepare('select count(*) n from verifica where verdetto is null').get().n;
    console.error(`${righe.length} mostrate, ${n} in tutto da giudicare`);
    return;
  }
  const linee = readFileSync(file, 'utf8').split(/\r?\n/).filter(l => l.trim() && !/^id\t/.test(l));
  const up = db.prepare("update verifica set verdetto=?, causa=?, da='giudizio', quando=? where id=?");
  let ok = 0, scarti = [];
  for (const l of linee) {
    const [id, verd, ...causa] = l.split('\t');
    const c = causa.join(' ').trim();
    if (!VERDETTI.has(verd)) { scarti.push(`${id}: verdetto «${verd}» non ammesso`); continue; }
    if (verd !== 'OK' && !c) { scarti.push(`${id}: ${verd} senza causa`); continue; }
    if (up.run(verd, c || null, ora(), Number(id)).changes) ok++; else scarti.push(`${id}: riga inesistente`);
  }
  console.log(`${ok} verdetti registrati`);
  if (scarti.length) { console.log('scartati:\n' + scarti.join('\n')); process.exitCode = 1; }
}

// ------------------------------------------------------------------ stato: la chiusura binaria
function stato() {
  const { db } = carica(opt('giro'));
  const q = (s, ...p) => db.prepare(s).get(...p);
  const unita = q('select count(*) n, sum(stato=\'fatta\') f, sum(stato=\'da-fare\') d, sum(errore is not null) e from unita');
  const ver = q('select count(*) n, sum(verdetto is null) aperte, sum(verdetto=\'OK\') ok, sum(verdetto=\'DIFETTO\') dif, sum(verdetto=\'NON-APPLICABILE\') na, sum(verdetto=\'BLOCCATO\') bl from verifica');
  console.log(`unità: ${unita.n} (fatte ${unita.f || 0}, in coda ${unita.d || 0}, con errore ${unita.e || 0})`);
  console.log(`verifiche: ${ver.n} — OK ${ver.ok || 0}, DIFETTO ${ver.dif || 0}, NON-APPLICABILE ${ver.na || 0}, BLOCCATO ${ver.bl || 0}, senza verdetto ${ver.aperte || 0}`);
  const chiuso = !unita.d && !ver.aperte && ver.n > 0;
  console.log(chiuso ? 'GIRO CHIUSO — ogni riga ha un verdetto' : 'GIRO NON CHIUSO — ' + [unita.d ? `${unita.d} unità in coda` : '', ver.aperte ? `${ver.aperte} righe senza verdetto` : ''].filter(Boolean).join(', '));
  process.exitCode = chiuso ? 0 : 3;
}

// ------------------------------------------------------------------ rapporto e piano, generati dal registro
function rapporto() {
  const { dir, profilo, db } = carica(opt('giro'));
  const tutte = db.prepare(`select v.*, u.url, u.persona, u.viewport, u.lingua, u.percorso from verifica v join unita u on u.id=v.unita_id order by v.controllo, u.url`).all();
  const tsv = ['id\turl\tpersona\tformato\tlingua\tcontrollo\tesito_auto\tverdetto\tcausa\ttipo\tnodo\tdettaglio\tschermata\tpercorso_nodo'];
  for (const r of tutte) tsv.push([r.id, r.url, r.persona, r.viewport, r.lingua, r.controllo, r.esito_auto, r.verdetto || '', r.causa || '', r.nodo_tipo || '', r.nodo_nome || '', r.dettaglio || '', r.evidenza || '', r.nodo || ''].map(x => String(x).replace(/[\t\r\n]+/g, ' ')).join('\t'));
  writeFileSync(join(dir, 'registro.tsv'), tsv.join('\r\n') + '\r\n');
  const dif = tutte.filter(r => r.verdetto === 'DIFETTO');
  const perCod = new Map();
  for (const r of dif) { if (!perCod.has(r.controllo)) perCod.set(r.controllo, []); perCod.get(r.controllo).push(r); }
  const NOMI = { 'T-UUID': 'identificativi tecnici mostrati', 'T-CODICE': 'codici al posto di descrizioni', 'T-CHIAVE': 'chiavi di traduzione non risolte', 'T-TECNICO': 'valori tecnici in chiaro', 'T-DATA-ISO': 'date in formato macchina', 'T-DATA-US': 'date in formato americano', 'T-NUMERO-EN': 'numeri in formato inglese', 'T-NUMERO-IT': 'numeri in formato italiano in pagina inglese', 'T-LINGUA': 'testi nella lingua sbagliata', 'T-TRONCATO': 'testi troncati illeggibili', 'T-FUORI': 'testi fuori dalla finestra', 'T-CELLE-VUOTE': 'celle vuote senza spiegazione', 'T-ACCENTO': 'apostrofi al posto degli accenti', 'T-PLURALE': 'plurali sbagliati', 'T-DECIMALE': 'decimali con il punto', 'T-ATTACCATO': 'testi attaccati', 'T-TOTALI': 'totali che non tornano con la paginazione', 'T-ETICHETTE': 'etichette incoerenti', 'P-NON-RAGGIUNTA': 'pagine non raggiungibili', 'P-SESSIONE': 'sessione persa', 'T-INTESTAZIONI': 'tabelle senza intestazioni', 'C-DINAMICO': 'grafici che non rispondono al mouse', 'E-ESERCIZIO': 'elementi che danno errore', 'E-LINK': 'collegamenti rotti', 'E-SENZA-NOME': 'elementi senza nome', 'R-RETE': 'chiamate in errore al caricamento', 'R-CONSOLE': 'errori in console', 'L-SCORRIMENTO': 'pagine che scorrono in orizzontale', 'P-HTTP': 'pagine in errore', 'P-LANG': 'lingua della pagina dichiarata male', 'P-TITOLO': 'pagine senza titolo', 'I-ROTTA': 'immagini rotte' };
  const q = (s) => db.prepare(s).get();
  const u = q("select count(*) n, count(distinct url) p, count(distinct persona) pe from unita");
  const conteggi = q("select count(*) n, sum(verdetto='OK') ok, sum(verdetto='DIFETTO') d, sum(verdetto='NON-APPLICABILE') na, sum(verdetto='BLOCCATO') b, sum(verdetto is null) a from verifica");
  const R = [];
  R.push(`# Rapporto QA web — ${profilo.progetto}`, '', `Generato dal registro il ${ora()} (${join(dir, 'registro.sqlite')}). Ogni numero qui sotto si rifà con «qa-web stato --giro ${dir}».`, '');
  R.push(`Copertura: ${u.n} unità (pagina × persona × formato × lingua × stato), ${u.p} indirizzi, ${u.pe} persone. Verifiche: ${conteggi.n}; OK ${conteggi.ok || 0}, DIFETTO ${conteggi.d || 0}, NON-APPLICABILE ${conteggi.na || 0}, BLOCCATO ${conteggi.b || 0}, senza verdetto ${conteggi.a || 0}.`, '');
  R.push('## Difetti per tipo', '', '| codice | che cosa | righe | indirizzi |', '|---|---|---|---|');
  for (const [k, v] of [...perCod].sort((a, b) => b[1].length - a[1].length)) R.push(`| ${k} | ${NOMI[k] || k} | ${v.length} | ${new Set(v.map(r => r.url)).size} |`);
  R.push('', '## Difetti, uno per riga', '');
  for (const [k, v] of perCod) { R.push(`### ${k} — ${NOMI[k] || k}`, ''); for (const r of v) R.push(`- [${r.id}] ${r.url} (${r.persona}, ${r.viewport}, ${r.lingua}) ${r.nodo_tipo ? r.nodo_tipo + ' «' + (r.nodo_nome || '').slice(0, 60) + '»' : ''}: ${r.causa || r.dettaglio}${r.evidenza ? ' — ' + r.evidenza : ''}`); R.push(''); }
  const bl = tutte.filter(r => r.verdetto === 'BLOCCATO' || r.verdetto === 'NON-APPLICABILE');
  R.push('## Righe non verificate e perché', '');
  const perCausa = new Map(); for (const r of bl) { const c = r.verdetto + ': ' + r.causa; perCausa.set(c, (perCausa.get(c) || 0) + 1); }
  for (const [c, n] of perCausa) R.push(`- ${n} righe — ${c}`);
  writeFileSync(join(dir, 'RAPPORTO.md'), R.join('\r\n') + '\r\n');
  // piano: un gruppo per tipo di difetto, la causa radice da accertare, la correzione proposta, la prova di chiusura
  const RIMEDIO = { 'T-UUID': 'mostrare il nome dell\'oggetto al posto dell\'identificativo (risolvere il riferimento nella chiamata o nel componente)', 'T-CODICE': 'tradurre il codice nella sua descrizione dal catalogo, nella lingua della pagina', 'T-CHIAVE': 'aggiungere la traduzione mancante o correggere la chiave', 'T-TECNICO': 'trattare il valore assente con un segno esplicito («non indicato»)', 'T-DATA-ISO': 'passare la data dal formattatore unico della lingua', 'T-DATA-US': 'passare la data dal formattatore unico della lingua', 'T-NUMERO-EN': 'passare il numero dal formattatore unico della lingua', 'T-NUMERO-IT': 'passare il numero dal formattatore unico della lingua', 'T-LINGUA': 'tradurre il testo nel catalogo della lingua', 'T-TRONCATO': 'dare spazio al testo o il testo intero in un suggerimento', 'T-CELLE-VUOTE': 'mostrare un segno esplicito e il perché del valore mancante', 'C-DINAMICO': 'aggiungere il suggerimento con i valori al passaggio del mouse', 'E-ESERCIZIO': 'correggere l\'errore dell\'azione (vedi console e chiamate nella riga)', 'E-LINK': 'correggere il collegamento o la pagina di arrivo', 'R-RETE': 'correggere la chiamata o i permessi', 'R-CONSOLE': 'correggere l\'errore del codice della pagina', 'L-SCORRIMENTO': 'rendere la pagina adattabile alla larghezza' };
  const P = [`# Piano di recovery, remediation e risoluzione — ${profilo.progetto}`, '', 'Stato: DA APPROVARE. Generato dal registro: ogni voce raccoglie le righe DIFETTO di un tipo. Nessuna voce si esegue prima del sì.', '', 'Per ogni voce: 1) accertare la causa radice comune (spesso un componente o un formattatore solo), 2) correggere alla radice, 3) rifare il giro sulle sole righe della voce, 4) la voce è chiusa quando tutte le sue righe tornano OK.', '', '| voce | tipo | righe | indirizzi | correzione proposta | prova di chiusura |', '|---|---|---|---|---|---|'];
  let i = 1;
  for (const [k, v] of [...perCod].sort((a, b) => b[1].length - a[1].length)) P.push(`| R${i++} | ${k} ${NOMI[k] || ''} | ${v.length} | ${new Set(v.map(r => r.url)).size} | ${RIMEDIO[k] || 'da stabilire dopo l\'esame delle righe'} | giro ripetuto: 0 righe ${k} |`);
  writeFileSync(join(dir, 'PIANO.md'), P.join('\r\n') + '\r\n');
  console.log(`scritti ${join(dir, 'RAPPORTO.md')}, PIANO.md, registro.tsv (${tutte.length} righe)`);
}

const CMD = { avvia, esegui, giudica, stato, rapporto };
if (!CMD[cmd]) { console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 16).map(l => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(cmd ? 2 : 0); }
await CMD[cmd]();
