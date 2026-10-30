// Caricatore del pacchetto del datastore (voce #263, W0-A1). Portato da heuresys-datastore/scripts/piano034/accogli_pacchetto.mjs.
// O2-02: legge anche il pacchetto v0.3 (heuresys.prototipo.pacchetto/0.3) nelle tabelle della 000458; accetta ancora il v0.2.
//   - carica     prima convalida il pacchetto (convalida-pacchetto.mjs: schema della sua versione + limiti delle colonne) e lo rifiuta senza scrivere niente;
//                una sezione dichiarata vuota (null o []) produce zero righe; perimeter_status e' DICHIARATO solo se la sezione perimetro ha voci (ADR-0046 §1).
//   - rileggi    ricostruisce anche le sezioni v0.3, confronta, e RIPORTA le regole che marcano senza rifiutare (regole-di-ritorno.mjs): non cambia l'esito.
//
// C3 (consolidamento): `ricevi` accoglie una CONSEGNA (cartella con manifesto.json e pacchetto.json, ADR-0047). Prima del database
//   verifica il manifesto e l'impronta (manifesto-consegna.mjs): una consegna che non si verifica non scrive niente. Poi, sotto un blocco
//   consultivo per prototipo: stessa identita' (prototipo, numero del pacchetto) e stessa impronta = GIA_PRESENTE, zero righe nuove;
//   stessa identita' e impronta diversa = RIFIUTATO; un prototipo nuovo entra come variante nuova, versione 2 in DRAFT; un numero nuovo
//   di un prototipo gia' ricevuto entra come versione successiva in DRAFT della stessa variante (C4, R-58). Ogni esito lascia una riga in sys_blueprint_content_receipts (000460). Non scrive definizioni di indicatore
//   senza tenant: gli indicatori stanno nel contenuto del modello (sys_blueprint_content_kpis), e la costruzione del tenant li porta li'.
//
// Uso:  node db/scripts/pacchetto/accogli-pacchetto.mjs carica   <database> <pacchetto.json> <uscita.json> [famiglia]
//       node db/scripts/pacchetto/accogli-pacchetto.mjs ricevi   <database> <cartella_consegna> <uscita.json> [famiglia] [--produzione]
//       node db/scripts/pacchetto/accogli-pacchetto.mjs rileggi  <database> <pacchetto.json> <uscita.json> [famiglia]
//       node db/scripts/pacchetto/accogli-pacchetto.mjs scarica  <database> <pacchetto.json> <uscita.json> [famiglia]
//
// carica   fa SOLO inserimenti, in una transazione: una famiglia nuova, una variante con il codice del prototipo, la sua versione 2 in
//          DRAFT (la 1 la crea il trigger sys_blueprint_variant_ensure_version), le righe di ogni dominio, le traduzioni inglesi, i
//          legami con le prove e le definizioni di indicatore di piattaforma. Nessun TRUNCATE, nessun UPDATE. Se la famiglia c'e' gia', si ferma.
// rileggi  ricostruisce il pacchetto dalle sole righe e lo confronta con il file, percorso per percorso e per intero.
// scarica  toglie le sole righe caricate (traduzioni, definizioni di indicatore, famiglia: il resto va a cascata).
//
// Guardia a due condizioni: un database il cui nome non finisce con _prova<N> (copia usa-e-getta) si tocca solo con `ricevi`, cioe' con
// un manifesto verificato, E con l'opzione esplicita --produzione (che si da' dopo un backup verificato). Collegamento: PGHOST, PGPORT, PGUSER (default
// localhost, 5432, postgres); la password la legge il client dal pgpass di sistema, mai da qui.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const pg = createRequire(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../apps/api/package.json"))("pg");
import { DOMINI, fissi, ORIGINE, ORIGINE_INVERSA, INDICATORI_DI_PIATTAFORMA, versione3, LIVELLO_INVERSO, LEGAME_ATTORE_INVERSO } from "./definizione-pacchetto.mjs";
import { convalida } from "./convalida-pacchetto.mjs";
import { regoleMarcano } from "./regole-di-ritorno.mjs";
import { verificaConsegna, improntaJson } from "./manifesto-consegna.mjs";

const ARGV = process.argv.slice(2);
const PRODUZIONE = ARGV.includes("--produzione");
const [cmd, DB, FILE, OUT, FAMIGLIA_ARG] = ARGV.filter((a) => a !== "--produzione");
if (!["carica", "ricevi", "rileggi", "scarica"].includes(cmd) || !DB || !FILE || !OUT) throw new Error("uso: carica|ricevi|rileggi|scarica <database> <pacchetto.json | cartella_consegna> <uscita.json> [famiglia] [--produzione]");
const PROVA = /_prova\d*$/.test(DB);
if (PRODUZIONE && cmd !== "ricevi") throw new Error("rifiuto: --produzione vale solo per «ricevi», che verifica il manifesto");
if (!PROVA && !(cmd === "ricevi" && PRODUZIONE)) throw new Error("rifiuto: " + DB + " non è una copia di prova (fuori dalle copie si entra solo con «ricevi» e --produzione, dopo un backup)");
const FAMIGLIA = FAMIGLIA_ARG ?? "PACCHETTO_DATASTORE";
// la consegna si verifica PRIMA di aprire il database: se non regge, non si scrive niente, nemmeno nel registro
const consegna = cmd === "ricevi" ? verificaConsegna(FILE) : null;
if (consegna && !consegna.ok) {
  fs.writeFileSync(OUT, JSON.stringify({ comando: cmd, database: DB, consegna: FILE, esito: "rifiutato", ricevimento: "NON_VERIFICATO", errori: consegna.errori, finito: new Date().toISOString() }, null, 1));
  console.log(JSON.stringify({ esito: "rifiutato", ricevimento: "NON_VERIFICATO", errori: consegna.errori }, null, 1));
  process.exit(1);
}
const raw = consegna ? consegna.pacchetto : JSON.parse(fs.readFileSync(FILE, "utf8"));
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v))); // numeric
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v))); // bigint
pg.types.setTypeParser(1082, (v) => v); // date: resta la stringa AAAA-MM-GG, senza passare dal fuso del processo (mig. 000456)
pg.types.setTypeParser(1184, (v) => (v === null ? null : new Date(v.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00")).toISOString())); // timestamptz: istante ISO in UTC (mig. 000456)
const cli = new pg.Client({ host: process.env.PGHOST ?? "localhost", port: Number(process.env.PGPORT ?? 5432), user: process.env.PGUSER ?? "postgres", database: DB, application_name: "accogli_pacchetto" });
await cli.connect();
const q = async (s, a = []) => (await cli.query(s, a)).rows;
const D = (k) => DOMINI.find((d) => d.chiave === k);
const esito = { comando: cmd, database: DB, pacchetto: FILE, avviato: new Date().toISOString() };

// la versione che porta QUESTO pacchetto: quella con la sua impronta, se c'e' (C3), altrimenti la piu' recente che porta un pacchetto
const versione = async () => {
  const r = await q(`SELECT v.blueprint_variant_id AS var, vv.blueprint_variant_version_id AS ver FROM sys.sys_blueprint_families f
    JOIN sys.sys_blueprint_variants v ON v.blueprint_variant_family_id = f.blueprint_family_id
    JOIN sys.sys_blueprint_variant_versions vv ON vv.blueprint_variant_version_variant_id = v.blueprint_variant_id
    JOIN sys.sys_blueprint_content_packages p ON p.blueprint_content_package_version_id = vv.blueprint_variant_version_id
    WHERE f.blueprint_family_code = $1 AND v.blueprint_variant_code = $2
    ORDER BY (p.blueprint_content_package_hash = $3) DESC NULLS LAST, vv.blueprint_variant_version_number DESC LIMIT 1`, [FAMIGLIA, raw.meta.prototipoId, improntaJson(raw)]);
  return r[0] ? { varianteId: r[0].var, versionId: r[0].ver } : null;
};

async function carica(op = {}) {
  // prima del database: il pacchetto deve passare lo schema della sua versione e i limiti delle colonne (convalida-pacchetto.mjs)
  const cv = convalida(raw);
  esito.convalida = { schema: cv.schema, ok: cv.ok };
  if (!cv.ok) throw new Error(`pacchetto rifiutato (${cv.schema}), niente e' stato scritto: ` + cv.errori.join(" | "));
  if (!op.ricevimento) await cli.query("BEGIN"); // ricevi apre la transazione da se', con il blocco consultivo
  const famEsistente = (await q("SELECT blueprint_family_id AS id FROM sys.sys_blueprint_families WHERE blueprint_family_code = $1", [FAMIGLIA]))[0]?.id;
  if (famEsistente && !op.ricevimento) throw new Error("la famiglia " + FAMIGLIA + " c'è già: niente si sovrascrive");
  const fam = famEsistente ?? (await q(`INSERT INTO sys.sys_blueprint_families (blueprint_family_code, blueprint_family_name, blueprint_family_description) VALUES ($1, 'Pacchetto del datastore', 'Famiglia che accoglie i pacchetti dei prototipi del datastore') RETURNING blueprint_family_id`, [FAMIGLIA]))[0].blueprint_family_id;
  const banda = (await q("SELECT enterprise_size_band_id FROM sys.sys_enterprise_size_bands WHERE enterprise_size_band_code = $1", [raw.contesto.fasciaAdvanced]))[0]?.enterprise_size_band_id ?? null;
  // la variante e' il prototipo: si crea al primo pacchetto, e i successivi diventano versioni nuove della stessa (C3)
  const varEsistente = op.ricevimento ? (await q("SELECT blueprint_variant_id AS id, blueprint_variant_family_id AS fam FROM sys.sys_blueprint_variants WHERE blueprint_variant_code = $1", [raw.meta.prototipoId]))[0] : undefined;
  if (varEsistente && varEsistente.fam !== fam) throw new Error(`la variante ${raw.meta.prototipoId} esiste in un'altra famiglia: niente si sposta`);
  const varId = varEsistente?.id ?? (await q(`INSERT INTO sys.sys_blueprint_variants (blueprint_variant_family_id, blueprint_variant_code, blueprint_variant_name, blueprint_variant_description, blueprint_variant_size_band_id) VALUES ($1,$2,$3,$4,$5) RETURNING blueprint_variant_id`, [fam, raw.meta.prototipoId, raw.contesto.descrizione.it.slice(0, 250), raw.contesto.descrizione.it, banda]))[0].blueprint_variant_id;
  // la versione 1 la crea il trigger alla nascita della variante: il contenuto entra sempre in una versione nuova, la prima e' la 2
  const numero = Number((await q("SELECT coalesce(max(blueprint_variant_version_number), 1) + 1 AS n FROM sys.sys_blueprint_variant_versions WHERE blueprint_variant_version_variant_id = $1", [varId]))[0].n);
  const verId = (await q(`INSERT INTO sys.sys_blueprint_variant_versions (blueprint_variant_version_variant_id, blueprint_variant_version_number, blueprint_variant_version_status, blueprint_variant_version_notes) VALUES ($1, $2, 'DRAFT', $3) RETURNING blueprint_variant_version_id`, [varId, numero, "Accoglienza del pacchetto " + raw.meta.schema]))[0].blueprint_variant_version_id;
  const c = { versionId: verId, varianteId: varId };
  const ids = {}; const conti = {}; let trad = 0; const orig = {}; let legami = 0, vuoti = 0;
  for (const d of DOMINI) {
    ids[d.chiave] = new Map(); const rr = d.righe(raw);
    for (const r of rr) {
      const v = { ...fissi(d, c), ...Object.fromEntries(Object.entries(r.v).filter(([, x]) => x !== undefined)), ...(r.md ? { metadata: JSON.stringify(r.md) } : {}) };
      const cols = Object.keys(v);
      let id; try { id = (await q(`INSERT INTO sys.${d.t} (${cols.map((x) => d.p + x).join(", ")}) VALUES (${cols.map((_, i) => "$" + (i + 1)).join(", ")}) RETURNING ${d.p}id AS id`, cols.map((x) => v[x])))[0].id; } catch (e) { throw new Error(`${d.chiave} «${r.k}»: ${e.message}`); }
      ids[d.chiave].set(r.k, id);
      for (const t of r.tr ?? []) {
        const src = ORIGINE[t.origine]; if (!src) throw new Error(`origine sconosciuta ${t.origine} in ${d.chiave} ${r.k}`);
        await q("INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source) VALUES ($1,$2,$3,'en',$4,$5)", [d.t, id, t.campo, t.en, src]);
        trad++; orig[src] = (orig[src] ?? 0) + 1;
      }
      for (const ev of [].concat(r.ev ?? [])) { // una riga puo' portare piu' di un riscontro (la strategia: leva e ambizione)
        const lega = async (pid, ruolo) => { await q(`INSERT INTO sys.sys_blueprint_content_evidence_links (blueprint_content_evidence_link_version_id, blueprint_content_evidence_link_entity_kind, blueprint_content_evidence_link_entity_code, blueprint_content_evidence_link_proof_code, blueprint_content_evidence_link_role) VALUES ($1,$2,$3,$4,$5)`, [verId, ev.kind, ev.code, pid, ruolo]); legami++; };
        for (const pid of ev.fonti) await lega(pid, "SOURCE");
        for (const pid of ev.proveOrg ?? []) await lega(pid, "HEADCOUNT");
        if (ev.senza) { await q(`INSERT INTO sys.sys_blueprint_content_evidence_gaps (blueprint_content_evidence_gap_version_id, blueprint_content_evidence_gap_entity_kind, blueprint_content_evidence_gap_entity_code) VALUES ($1,$2,$3)`, [verId, ev.kind, ev.code]); vuoti++; }
      }
    }
    conti[d.t] = rr.length;
  }
  // gli indicatori come definizioni di piattaforma, legati al loro processo (indicatore → obiettivo → processo)
  const pre = INDICATORI_DI_PIATTAFORMA.prefisso(raw.meta.prototipoId);
  const processoDi = new Map(raw.obiettivi.map((o) => [o.codice, o.processoCodice]));
  const perProcesso = new Map();
  for (const i of raw.indicatori) { const pc = processoDi.get(i.obiettivoCodice); perProcesso.set(pc, [...(perProcesso.get(pc) ?? []), i]); }
  let defs = 0, modelli = 0;
  for (const [pc, ii] of op.ricevimento ? [] : perProcesso) { // C3: niente definizioni senza tenant al ricevimento
    const procId = ids.processes.get(pc); if (!procId) throw new Error("indicatore legato a un processo che non c'è: " + pc);
    for (const i of ii) {
      const kid = (await q(`INSERT INTO sys.sys_kpi_definitions (kpi_definition_tenant_id, kpi_definition_code, kpi_definition_name, kpi_definition_description, kpi_definition_formula, kpi_definition_unit, kpi_definition_polarity, kpi_definition_is_global, kpi_definition_metadata) VALUES (NULL,$1,$2,$3,$4,$5,$6,true,$7) RETURNING kpi_definition_id`,
        [pre + i.codice, i.nome.it, i.riferimento?.it ?? null, i.formula?.it ?? null, i.unita, i.direzioneAdvanced, JSON.stringify({ origine: "datastore", prototipo: raw.meta.prototipoId, pacchetto: raw.meta.schema, indicatore: i.codice })]))[0].kpi_definition_id;
      defs++;
      // il nome inglese della definizione: senza, la guardia di copertura della 000255 ferma la catena al deploy successivo
      for (const [campo, testo] of [["name", i.nome], ["description", i.riferimento]]) {
        if (!testo?.en) continue;
        const src = ORIGINE[testo.enOrigine]; if (!src) throw new Error(`origine sconosciuta ${testo.enOrigine} nell'indicatore ${i.codice}`);
        await q("INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source) VALUES ('sys_kpi_definitions',$1,$2,'en',$3,$4)", [kid, campo, testo.en, src]);
        trad++; orig[src] = (orig[src] ?? 0) + 1;
      }
      const bersaglio = i.bersaglio ? { minimo: i.bersaglio.minimo, obiettivo: i.bersaglio.obiettivo, massimo: i.bersaglio.massimo } : {};
      await q(`INSERT INTO sys.sys_process_kpi_templates (process_kpi_template_process_id, process_kpi_template_kpi_id, process_kpi_template_default_weight, process_kpi_template_default_target, process_kpi_template_metadata) VALUES ($1,$2,$3,$4,$5)`,
        [procId, kid, INDICATORI_DI_PIATTAFORMA.peso(ii.length), JSON.stringify({ unita: i.unita, direzione: i.direzioneAdvanced, ...bersaglio }), JSON.stringify({ origine: "datastore " + raw.meta.prototipoId, obiettivo: i.obiettivoCodice })]);
      modelli++;
    }
  }
  if (op.ricevimento) {
    const m = consegna.manifesto;
    const n = (await cli.query(`UPDATE sys.sys_blueprint_content_packages SET blueprint_content_package_package_version = $2, blueprint_content_package_hash = $3 WHERE blueprint_content_package_version_id = $1`, [verId, m.versione, m.impronta.valore])).rowCount;
    if (n !== 1) throw new Error("la riga del pacchetto non c'è: il ricevimento non si registra al buio");
    await op.registra("CARICATO", verId, null);
  }
  await cli.query("COMMIT");
  // le statistiche delle tabelle appena riempite: senza, db_health conta le tabelle popolate e mai analizzate
  const toccate = [...new Set([...DOMINI.map((d) => d.t), "sys_blueprint_families", "sys_blueprint_variants", "sys_blueprint_variant_versions", "sys_reference_translations", "sys_blueprint_content_evidence_links", "sys_blueprint_content_evidence_gaps", "sys_kpi_definitions", "sys_process_kpi_templates", ...(op.ricevimento ? ["sys_blueprint_content_receipts"] : [])])];
  for (const t of toccate) await cli.query(`ANALYZE sys.${t}`);
  Object.assign(esito, { famiglia: FAMIGLIA, variante: varId, versione: verId, numero_di_versione: numero, righe_per_tabella: conti, righe: Object.values(conti).reduce((a, b) => a + b, 0), traduzioni: trad, origini: orig, legami_con_prove: legami, senza_riscontro: vuoti, definizioni_di_indicatore: defs, modelli_di_indicatore_per_processo: modelli, tabelle_analizzate: toccate.length });
}

// ---- ricevimento di una consegna (C3)
async function ricevi() {
  const m = consegna.manifesto;
  esito.consegna = { prototipo: m.prototipo, versione_del_pacchetto: m.versione, impronta: m.impronta.valore, correlazione: m.correlazione, produzione: !PROVA };
  const registra = (esitoR, ver, motivo) => q(`INSERT INTO sys.sys_blueprint_content_receipts
      (blueprint_content_receipt_prototype_ref, blueprint_content_receipt_package_version, blueprint_content_receipt_hash, blueprint_content_receipt_schema_version,
       blueprint_content_receipt_variant_version_id, blueprint_content_receipt_outcome, blueprint_content_receipt_reason, blueprint_content_receipt_correlation,
       blueprint_content_receipt_delivered_at, blueprint_content_receipt_delivered_by, blueprint_content_receipt_metadata)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [m.prototipo, m.versione, m.impronta.valore, m.contratto, ver, esitoR, motivo, m.correlazione, m.consegnatoIl, m.consegnatoDa,
     JSON.stringify({ fascicoloVersione: m.fascicoloVersione, edizioni: m.edizioni, famiglia: FAMIGLIA, caricatore: "accogli-pacchetto.mjs ricevi" })]);
  await cli.query("BEGIN");
  await q("SELECT pg_advisory_xact_lock(hashtext($1))", ["ricevimento-pacchetto:" + m.prototipo]);
  const gia = (await q(`SELECT blueprint_content_package_hash AS h, blueprint_content_package_version_id AS ver FROM sys.sys_blueprint_content_packages
    WHERE blueprint_content_package_prototype_ref = $1 AND blueprint_content_package_package_version = $2`, [m.prototipo, m.versione]))[0];
  if (gia && gia.h === m.impronta.valore) {
    await registra("GIA_PRESENTE", gia.ver, null);
    await cli.query("COMMIT");
    Object.assign(esito, { ricevimento: "GIA_PRESENTE", versione: gia.ver });
    return;
  }
  if (gia) {
    const motivo = `il pacchetto ${m.versione} del prototipo ${m.prototipo} c'è già con un'altra impronta (${gia.h}): advanced non lo sovrascrive, il datastore deve consegnare un numero nuovo`;
    await registra("RIFIUTATO", null, motivo);
    await cli.query("COMMIT");
    esito.ricevimento = "RIFIUTATO";
    throw new Error(motivo);
  }
  // un numero nuovo di un prototipo gia' ricevuto entra come versione nuova (DRAFT) della stessa variante: dalla 000463 (C4)
  // i processi sono unici per versione (R-58), e nessun tenant cambia versione finche' qualcuno non la pubblica e non la adotta
  // per lui (PATCH /v1/blueprint-activations/:id con variantVersionId).
  await carica({ ricevimento: true, registra });
  esito.ricevimento = "CARICATO";
}

// ---- rilettura: dal database al pacchetto
const T = (itv, t) => (itv === null && !t ? undefined : { it: itv, ...(t ? { en: t.text, enOrigine: ORIGINE_INVERSA[t.source] } : {}) });
const togliVuoti = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
async function ricostruisci(c) {
  const righe = async (d) => q(`SELECT * FROM sys.${d.t} WHERE ${Object.keys(fissi(d, c)).map((x, i) => `${d.p}${x} = $${i + 1}`).join(" AND ")}`, Object.values(fissi(d, c)));
  const R = {}; const tutti = [];
  for (const d of DOMINI) { R[d.chiave] = (await righe(d)).map((r) => { const o = { _id: r[d.p + "id"] }; for (const [k, v] of Object.entries(r)) if (k.startsWith(d.p)) o[k.slice(d.p.length)] = v; return o; }); tutti.push(...R[d.chiave].map((x) => x._id)); }
  const trs = await q("SELECT entity_id, field, text, source FROM sys.sys_reference_translations WHERE locale = 'en' AND entity_id = ANY($1::uuid[])", [tutti]);
  const TR = new Map(trs.map((t) => [`${t.entity_id}|${t.field}`, t]));
  const t = (r, campo) => TR.get(`${r._id}|${campo}`);
  const lk = await q("SELECT blueprint_content_evidence_link_entity_kind k, blueprint_content_evidence_link_entity_code c, blueprint_content_evidence_link_proof_code p, blueprint_content_evidence_link_role r FROM sys.sys_blueprint_content_evidence_links WHERE blueprint_content_evidence_link_version_id = $1", [c.versionId]);
  const gp = new Set((await q("SELECT blueprint_content_evidence_gap_entity_kind k, blueprint_content_evidence_gap_entity_code c FROM sys.sys_blueprint_content_evidence_gaps WHERE blueprint_content_evidence_gap_version_id = $1", [c.versionId])).map((x) => `${x.k}|${x.c}`));
  const fonti = (k, code, ruolo = "SOURCE") => lk.filter((x) => x.k === k && x.c === code && x.r === ruolo).map((x) => x.p);
  const ev = (k, code) => ({ fonti: fonti(k, code), ...(gp.has(`${k}|${code}`) ? { senzaRiscontro: true } : {}) });
  const per = (chiave, campo, val) => R[chiave].filter((x) => x[campo] === val);
  const data = (d) => (d === null ? null : d instanceof Date ? d.toISOString() : d);
  const pk = R.packages[0]; const cx = R.context[0];
  // v0.3: l'inverso dei campi che il pacchetto dice e le colonne no (nulli, gruppi, lati: vedi definizione-pacchetto.mjs)
  const es3 = versione3({ meta: { schema: pk.schema_version } });
  const mdr = (r) => r.metadata ?? {};
  const nv = (v, r, k) => v ?? (mdr(r).nulli?.includes(k) ? null : undefined);
  const HA = (r, k) => mdr(r).gruppi?.includes(k) === true;
  const attore = (kind, code) => ({ tipo: kind, codice: code });
  const ordinati = (xs) => [...xs].sort((a, b) => a.ordinal - b.ordinal);
  const sez3 = !es3 ? {} : (() => {
    const S = R.strategies[0];
    const voci = (kind, evk, mappa) => ordinati(R.strategy_items.filter((y) => y.kind === kind)).map((y) => togliVuoti({ codice: y.code, nome: T(y.name, t(y, "name")), descrizione: T(y.description, t(y, "description")), ...mappa(y), ...ev(evk, y.code) }));
    const attori = (kind, code) => attore(kind, code);
    return {
      strategia: S ? togliVuoti({
        leva: togliVuoti({ prevalente: S.competitive_lever, secondaria: nv(S.secondary_lever, S, "secondaria"), motivazione: T(S.lever_rationale, t(S, "lever_rationale")), ...ev("STRATEGY_LEVER", "STRATEGIA") }),
        segmenti: HA(S, "segmenti") ? voci("SEGMENTO", "SEGMENT", (y) => ({ canale: y.channel ?? undefined })) : undefined,
        lineeOfferta: HA(S, "lineeOfferta") ? voci("LINEA_OFFERTA", "OFFERING", (y) => ({ condividonoCompetenze: y.shares_skills ?? undefined, condividonoImpianti: y.shares_plants ?? undefined })) : undefined,
        ambizione: mdr(S).ambizione ? togliVuoti({ crescita: S.growth_ambition ?? undefined, presenzaEstera: S.foreign_presence ?? undefined, ...ev("STRATEGY_AMBITION", "STRATEGIA") }) : undefined,
        competenzeScarse: HA(S, "competenzeScarse") ? voci("COMPETENZA_SCARSA", "SCARCE_SKILL", (y) => ({ competenzaCodice: nv(y.skill_code, y, "competenzaCodice") })) : undefined,
        dipendenze: HA(S, "dipendenze") ? voci("DIPENDENZA", "DEPENDENCY", (y) => ({ tipo: y.dependency_kind ?? undefined })) : undefined,
        priorita: voci("PRIORITA", "PRIORITY", (y) => ({ obiettivoCodice: nv(y.goal_code, y, "obiettivoCodice") })),
      }) : null,
      capability: R.capabilities.map((c) => { const lk = (kind) => R.capability_links.filter((l) => l.capability_code === c.code && l.link_kind === kind);
        return togliVuoti({ codice: c.code, nome: T(c.name, t(c, "name")), descrizione: T(c.description, t(c, "description")), natura: c.nature, criticita: c.criticality ?? undefined,
          processiCodici: lk("PROCESSO").filter((l) => mdr(l).lati?.includes("capability")).map((l) => l.link_code),
          competenzeCodici: HA(c, "competenzeCodici") ? lk("COMPETENZA").map((l) => l.link_code) : undefined,
          strumentiDati: HA(c, "strumentiDati") ? ordinati(lk("STRUMENTO_DATO")).map((l) => T(l.text, t(l, "text"))) : undefined,
          coordinamento: T(c.coordination, t(c, "coordination")), ...ev("CAPABILITY", c.code) }); }),
      ruoli: R.job_roles.map((r) => { const lk = (kind) => R.job_role_links.filter((l) => l.job_role_code === r.code && l.link_kind === kind);
        return togliVuoti({ codice: r.code, nome: T(r.name, t(r, "name")), missione: T(r.mission, t(r, "mission")), famigliaProfessionale: T(r.professional_family, t(r, "professional_family")),
          occupazioneEsco: r.esco_uri === null ? undefined : { uri: r.esco_uri, nome: T(r.esco_name, t(r, "esco_name")) }, professioneCp2021: nv(r.cp2021_code, r, "professioneCp2021"),
          attivita: HA(r, "attivita") ? lk("ATTIVITA").map((l) => togliVuoti({ processoCodice: l.process_code, faseCodice: nv(l.step_code, l, "faseCodice") })) : undefined,
          competenze: HA(r, "competenze") ? lk("COMPETENZA").map((l) => togliVuoti({ competenzaCodice: l.skill_code, livello: LIVELLO_INVERSO[l.proficiency], processoCodice: nv(l.process_code, l, "processoCodice") })) : undefined,
          impattoAi: nv(r.ai_impact, r, "impattoAi"), ...ev("JOB_ROLE", r.code) }); }),
      decisioni: R.decisions.map((d) => togliVuoti({ codice: d.code, processoCodice: d.process_code, descrizione: T(d.description, t(d, "description")), frequenza: d.frequency ?? undefined,
        diritti: R.decision_rights.filter((r) => r.decision_code === d.code).map((r) => ({ diritto: r.right, attore: attori(r.actor_kind, r.actor_code) })),
        escalation: d.escalation_actor_kind === null ? undefined : { soglia: T(d.escalation_threshold, t(d, "escalation_threshold")), saleA: attori(d.escalation_actor_kind, d.escalation_actor_code) }, ...ev("DECISION", d.code) })),
      entita: R.legal_entities.map((e) => togliVuoti({ codice: e.code, nome: T(e.name, t(e, "name")), formaGiuridica: e.legal_form ?? undefined, paese: e.country,
        sediCodici: [...R.sites.filter((s) => s.legal_entity_code === e.code).map((s) => s.code), ...(mdr(e).sediFuori ?? [])], ...ev("LEGAL_ENTITY", e.code) })),
      agenti: R.agents.map((a) => { const lk = (kind) => R.agent_links.filter((l) => l.agent_code === a.code && l.link_kind === kind);
        return togliVuoti({ codice: a.code, nome: T(a.name, t(a, "name")), descrizione: T(a.description, t(a, "description")), tipo: a.agent_type ?? undefined,
          attivita: lk("ATTIVITA").map((l) => togliVuoti({ processoCodice: l.process_code, faseCodice: nv(l.step_code, l, "faseCodice") })),
          responsabile: attori(a.accountable_kind, a.accountable_code), misure: HA(a, "misure") ? lk("INDICATORE").map((l) => l.kpi_code) : undefined, ...ev("AGENT", a.code) }); }),
      principi: R.design_principles.map((x) => togliVuoti({ codice: x.code, ambito: x.scope, enunciato: T(x.statement, t(x, "statement")), ...ev("PRINCIPLE", x.code) })),
      perimetro: pk.dossier_version === null ? null : togliVuoti({ fascicoloVersione: Number(pk.dossier_version), estendeVersione: pk.extends_version !== null ? Number(pk.extends_version) : nv(undefined, pk, "estendeVersione"), richiestaEstensione: T(pk.extension_request, t(pk, "extension_request")),
        voci: Object.fromEntries((mdr(pk).perimetroGruppi ?? []).map((g) => [g, R.perimeters.filter((x) => mdr(x).gruppo === g).map((x) => togliVuoti({ schema: x.scheme, codice: x.code, uri: x.uri ?? undefined, nome: T(x.name, t(x, "name")), usataDalModello: mdr(x).senzaUsata ? undefined : x.used_by_model }))])) }),
    };
  })();
  return {
    meta: togliVuoti({ lingue: pk.languages, schema: pk.schema_version, creatoIl: pk.source_created_at, generatoDa: pk.generator, lingueBase: pk.base_language, prototipoId: pk.prototype_ref,
      origine: pk.source_schema_version === null ? undefined : togliVuoti({ schema: pk.source_schema_version, convertitoIl: data(pk.converted_at), convertitore: pk.converter, impronta: pk.source_hash ?? undefined }),
      completezza: pk.is_complete === null ? undefined : togliVuoti({ completo: pk.is_complete, passiAccettati: pk.steps_accepted, passiCascata: pk.steps_total, nota: mdr(pk).completezzaNota }) }),
    ...sez3,
    contesto: togliVuoti({ addetti: cx.employees, ateco: { codice: cx.ateco_code, nome: T(cx.ateco_name, t(cx, "ateco_name")), schema: cx.ateco_scheme }, classeDimensionale: cx.size_class, descrizione: T(cx.description, t(cx, "description")), fasciaAdvanced: cx.size_band_code, intensitaRegolatoria: cx.regulatory_intensity ?? undefined, modelloOperativo: cx.operating_model ?? undefined, paese: cx.country, sedi: R.sites.map((s) => s.code) }),
    sedi: R.sites.map((s) => togliVuoti({ codice: s.code, tipo: s.kind, nome: T(s.name, t(s, "name")), note: T(s.note, t(s, "note")), addetti: s.headcount ?? undefined, indirizzo: s.address ?? undefined })),
    unita: R.units.map((u) => togliVuoti({ codice: u.code, nome: T(u.name, t(u, "name")), padre: u.parent_code, tipoAdvanced: u.type, livello: u.level, sedeCodice: u.site_code, organicoPrevisto: u.planned_headcount, tipo: u.source_kind, motivazioneOrganico: T(u.headcount_note, t(u, "headcount_note")), mandato: T(u.mandate, t(u, "mandate")), budget: u.budget_centre === null ? undefined : togliVuoti({ centro: u.budget_centre, voce: T(u.budget_item, t(u, "budget_item")) }), ...ev("UNIT", u.code), proveOrganico: fonti("UNIT", u.code, "HEADCOUNT") })),
    posizioni: R.positions.map((x) => togliVuoti({ codice: x.code, titolo: T(x.title, t(x, "title")), unitaCodice: x.unit_code, criticita: x.criticality ?? undefined, riportaA: x.reports_to_code, categoriaContrattuale: x.contract_category, livelloCcnl: x.ccnl_level_code, organicoPrevisto: x.planned_headcount, responsabileUnita: x.is_unit_head, criticitaMotivo: T(x.criticality_note, t(x, "criticality_note")), gradoAziendale: x.company_grade ?? undefined, ruoloCodice: nv(x.job_role_code, x, "ruoloCodice"), riportoFunzionale: nv(x.functional_reports_to_code, x, "riportoFunzionale"), ccnlCodice: nv(x.ccnl_code, x, "ccnlCodice"),
      tipiResponsabilita: HA(x, "tipiResponsabilita") ? per("position_responsibilities", "position_code", x.code).map((y) => y.kind) : undefined,
      oreProcessi: HA(x, "oreProcessi") ? per("position_processes", "position_code", x.code).filter((y) => y.weekly_hours !== null).map((y) => ({ processoCodice: y.process_code, oreSettimanali: y.weekly_hours })) : undefined,
      processiCodici: per("position_processes", "position_code", x.code).filter((y) => !mdr(y).soloOre).map((y) => y.process_code), occupazioniEsco: per("position_occupations", "position_code", x.code).map((o) => ({ uri: o.esco_uri, nome: T(o.name, t(o, "name")) })), ...ev("POSITION", x.code) })),
    competenze: R.skills.map((s) => togliVuoti({ codice: s.code, nome: T(s.name, t(s, "name")), tipo: s.kind ?? undefined, categoria: s.category ?? undefined, categoriaOrigine: s.category_origin ?? undefined, escoUri: s.esco_uri, tipoOrigine: s.kind_origin ?? undefined, requisiti: per("position_skill_requirements", "skill_code", s.code).map((r) => ({ posizioneCodice: r.position_code, livello: r.source_level, livelloAdvanced: r.proficiency, criticita: r.source_criticality, criticitaAdvanced: r.criticality })), ...ev("SKILL", s.code) })),
    processi: R.processes.map((x) => togliVuoti({ codice: x.code, nome: T(x.name, t(x, "name")), ordine: x.ordinal, descrizione: T(x.description, t(x, "description")), responsabilePosizioneCodice: x.owner_position_code, tipo: x.kind, pcf: x.pcf_code, specifico: x.is_specific, motivazione: T(x.rationale, t(x, "rationale")), collegamentiUnita: per("unit_processes", "process_code", x.code).map((l) => ({ unitaCodice: l.unit_code, funzione: l.source_role, funzioneAdvanced: l.role })), sediCodici: per("process_sites", "process_code", x.code).map((s) => s.site_code),
      capabilityCodici: HA(x, "capabilityCodici") ? R.capability_links.filter((l) => l.link_kind === "PROCESSO" && l.link_code === x.code && mdr(l).lati?.includes("processo")).map((l) => l.capability_code) : undefined,
      fasi: HA(x, "fasi") ? per("process_steps", "process_code", x.code).sort((a, b) => a.ordinal - b.ordinal).map((f) => togliVuoti({ codice: f.code, nome: T(f.name, t(f, "name")), ordine: f.ordinal, ingresso: T(f.input, t(f, "input")), uscita: T(f.output, t(f, "output")),
        esecutore: f.executor_kind === null ? null : attore(f.executor_kind, f.executor_code), naturaLavoro: f.work_nature ?? undefined, erogazione: f.delivery_model ?? undefined, oreTipichePerCiclo: nv(f.typical_hours_per_cycle, f, "oreTipichePerCiclo") })) : undefined, ...ev("PROCESS", x.code) })),
    indicatori: R.kpis.map((i) => togliVuoti({ codice: i.code, nome: T(i.name, t(i, "name")), unita: i.unit, direzioneAdvanced: i.direction, direzione: i.source_direction, formula: T(i.formula, t(i, "formula")), frequenza: i.frequency, frequenzaNota: i.frequency_note, fonteDato: T(i.data_source, t(i, "data_source")), riferimento: T(i.reference_text, t(i, "reference_text")), obiettivoCodice: i.goal_code, bersaglio: (es3 ? !HA(i, "bersaglio") : [i.target_min, i.target_value, i.target_max, i.target_note, i.target_valid_from].every((v) => v === null)) ? undefined : togliVuoti({ minimo: es3 ? nv(i.target_min, i, "bersaglio.minimo") : i.target_min, obiettivo: es3 ? nv(i.target_value, i, "bersaglio.obiettivo") : i.target_value, massimo: es3 ? nv(i.target_max, i, "bersaglio.massimo") : i.target_max, nota: i.target_note ?? undefined, periodo: i.target_valid_from === null ? undefined : togliVuoti({ dal: i.target_valid_from, al: nv(i.target_valid_to, i, "periodo.al") }) }),
      perimetro: T(i.scope, t(i, "scope")), baseline: i.baseline_date === null ? undefined : togliVuoti({ valore: i.baseline_value, data: i.baseline_date, nota: T(i.baseline_note, t(i, "baseline_note")) }), responsabilePosizioneCodice: nv(i.owner_position_code, i, "responsabilePosizioneCodice"), esclusioni: T(i.exclusions, t(i, "exclusions")), famiglia: i.family ?? undefined, ...ev("KPI", i.code) })),
    obiettivi: R.goals.map((o) => togliVuoti({ codice: o.code, titolo: T(o.title, t(o, "title")), orizzonte: o.horizon, durataGiorni: o.duration_days, dimensione: o.dimension, processoCodice: o.process_code, unitaCodice: o.unit_code, posizioneCodice: o.position_code, peso: o.weight ?? undefined, pesoOrigine: o.weight_origin ?? undefined, livello: o.level ?? undefined, padre: nv(o.parent_code, o, "padre"), capabilityCodice: nv(o.capability_code, o, "capabilityCodice"), ...ev("GOAL", o.code) })),
    ccnl: R.ccnl.map((x) => togliVuoti({ codice: x.code, nome: T(x.name, t(x, "name")), ambito: T(x.scope, t(x, "scope")), parti: T(x.parties, t(x, "parties")), decorrenza: x.effective ?? undefined, ...ev("CCNL", x.code),
      livelli: per("ccnl_levels", "ccnl_code", x.code).map((l) => togliVuoti({ codice: l.code, nome: T(l.name, t(l, "name")), categoria: l.category ?? undefined, minimoAnnuoEur: l.annual_minimum_eur, notaMinimo: T(l.minimum_note, t(l, "minimum_note")), mansioni: T(l.duties, t(l, "duties")) })),
      istituti: per("ccnl_institutes", "ccnl_code", x.code).sort((a, b) => a.ordinal - b.ordinal).map((i) => { const cond = R.ccnl_conditions.filter((k) => k.ccnl_code === x.code && k.institute_ordinal === i.ordinal).sort((a, b) => a.ordinal - b.ordinal); return togliVuoti({ tipo: i.kind, descrizione: T(i.description, t(i, "description")), valore: i.value, unita: i.unit ?? undefined, validoDal: i.valid_from ?? undefined, condizioni: cond.length ? cond.map((k) => togliVuoti({ ambito: k.scope, descrizione: T(k.description, t(k, "description")), valore: k.value, unita: k.unit ?? undefined })) : undefined }); }) })),
    obblighi: R.obligations.map((o) => togliVuoti({ codice: o.code, norma: T(o.norm, t(o, "norm")), ambito: o.scope, soggetto: T(o.subject, t(o, "subject")), formazioneRichiesta: T(o.training_required, t(o, "training_required")), periodicita: o.periodicity, ruoloMancante: T(o.missing_role, t(o, "missing_role")), posizioniCodici: per("obligation_positions", "obligation_code", o.code).map((y) => y.position_code), ...ev("OBLIGATION", o.code) })),
    formazione: R.training.map((m) => togliVuoti({ codice: m.code, titolo: T(m.title, t(m, "title")), tipo: m.kind, modalita: m.delivery ?? undefined, durataMinuti: m.duration_minutes, obbligoCodice: m.obligation_code, posizioniCodici: per("training_positions", "training_code", m.code).map((y) => y.position_code), competenzeCodici: per("training_skills", "training_code", m.code).map((y) => y.skill_code), ...ev("TRAINING", m.code) })),
    carriere: R.career_paths.map((x) => ({ codice: x.code, nome: T(x.name, t(x, "name")), tipo: x.kind, passi: per("career_steps", "path_code", x.code).sort((a, b) => a.step_order - b.step_order).map((s) => ({ ordine: s.step_order, posizioneCodice: s.position_code })), ...ev("CAREER", x.code) })),
    incentivi: R.incentives.map((x) => { const l = (k) => R.incentive_links.filter((y) => y.incentive_code === x.code && y.link_kind === k).map((y) => y.link_code); return { codice: x.code, nome: T(x.name, t(x, "name")), tipo: x.kind, regola: T(x.rule, t(x, "rule")), posizioniCodici: l("POSITION"), obiettiviCodici: l("GOAL"), categorie: l("CATEGORY"), dimensioni: l("DIMENSION"), ...ev("INCENTIVE", x.code) }; }),
    commesse: R.engagements.map((x) => { const righe = (k) => R.engagement_links.filter((y) => y.engagement_code === x.code && y.link_kind === k); const l = (k) => righe(k).map((y) => y.link_code);
      const elenco = (y) => !mdr(y).lati || mdr(y).lati.includes("elenco");
      return togliVuoti({ codice: x.code, nome: T(x.name, t(x, "name")), tipo: x.kind, descrizione: T(x.description, t(x, "description")), natura: x.nature ?? undefined, unitaCodici: l("UNIT"), posizioniCodici: righe("POSITION").filter(elenco).map((y) => y.link_code),
        composizione: HA(x, "composizione") ? R.engagement_links.filter((y) => y.engagement_code === x.code && mdr(y).lati?.includes("composizione")).map((y) => ({ attore: attore(LEGAME_ATTORE_INVERSO[y.link_kind], y.link_code), quotaCapacita: y.capacity_share })) : undefined,
        obiettiviCodici: HA(x, "obiettiviCodici") ? l("GOAL") : undefined, ...ev("ENGAGEMENT", x.code) }); }),
    prove: R.evidence.map((x) => togliVuoti({ id: x.proof_code, url: x.url, titolo: x.title, estratto: x.excerpt, tipo: x.kind, esito: x.read_outcome, lettura: x.read_at === null && x.http_status === null && x.bytes === null && x.sha256 === null ? undefined : togliVuoti({ quando: data(x.read_at) ?? undefined, status: x.http_status ?? undefined, byte: x.bytes ?? undefined, sha256: x.sha256 ?? undefined }), motivo: x.read_note ?? undefined })),
    derivazioni: R.derivations.map((x) => ({ campo: x.field, regola: T(x.rule, t(x, "rule")) })),
    vuoti: R.gaps.map((x) => ({ dominio: x.domain, motivo: T(x.reason, t(x, "reason")) })),
  };
}

// confronto: per percorso (multinsieme dei valori foglia, e contenitori vuoti) e per intero (elenchi ordinati in forma canonica)
const foglie = (n, p, acc) => {
  const a = (k) => (acc[k] ??= new Map());
  const add = (k, v) => a(k).set(v, (a(k).get(v) ?? 0) + 1);
  if (Array.isArray(n)) { if (!n.length) add(p + "[]", "<vuoto>"); for (const x of n) foglie(x, p + "[]", acc); }
  else if (n && typeof n === "object") { if (!Object.keys(n).length) add(p, "<vuoto>"); for (const [k, v] of Object.entries(n)) foglie(v, p ? `${p}.${k}` : k, acc); }
  else add(p, JSON.stringify(n));
};
const canonico = (n) => Array.isArray(n) ? n.map(canonico).map((x) => JSON.stringify(x)).sort().map((s) => JSON.parse(s)) : n && typeof n === "object" ? Object.fromEntries(Object.keys(n).sort().map((k) => [k, canonico(n[k])])) : n;
async function rileggi() {
  const c = await versione(); if (!c) throw new Error("niente da rileggere: la prova non è caricata");
  const ric = await ricostruisci(c);
  const A = {}, B = {}; foglie(raw, "", A); foglie(ric, "", B);
  const percorsi = [...new Set([...Object.keys(A), ...Object.keys(B)])].sort();
  const diff = [];
  for (const p of percorsi) {
    const a = A[p] ?? new Map(), b = B[p] ?? new Map(); let persi = 0, inPiu = 0, valori = 0;
    for (const [v, n] of a) { valori += n; const m = b.get(v) ?? 0; if (m < n) persi += n - m; }
    for (const [v, n] of b) { const m = a.get(v) ?? 0; if (n > m) inPiu += n - m; }
    if (persi || inPiu || !A[p]) diff.push({ percorso: p, nel_pacchetto: valori, persi, in_piu: inPiu, esempio: [...a.keys()].find((v) => (b.get(v) ?? 0) < a.get(v))?.slice(0, 120) ?? [...b.keys()].find((v) => (a.get(v) ?? 0) < b.get(v))?.slice(0, 120) });
  }
  const uguale = JSON.stringify(canonico(raw)) === JSON.stringify(canonico(ric));
  const sez = Object.keys(raw).map((k) => ({ sezione: k, uguale: JSON.stringify(canonico(raw[k])) === JSON.stringify(canonico(ric[k])) }));
  Object.assign(esito, { versione: c.versionId, percorsi_nel_pacchetto: Object.keys(A).length, percorsi_ricostruiti: Object.keys(B).length, percorsi_con_differenze: diff.length, differenze: diff, sezioni: sez, pacchetto_ricostruito_uguale: uguale, valori_foglia: [...Object.values(A)].reduce((s, m) => s + [...m.values()].reduce((x, y) => x + y, 0), 0) });
  if (versione3(raw)) esito.regole_che_marcano = await regoleMarcano(q, c.versionId); // riporta e basta: l'esito non cambia
  fs.writeFileSync(OUT.replace(/\.json$/, "_ricostruito.json"), JSON.stringify(ric, null, 1));
}

async function scarica() {
  const c = await versione(); if (!c) throw new Error("niente da scaricare: la prova non è caricata");
  await cli.query("BEGIN");
  const tutti = [];
  for (const d of DOMINI) tutti.push(...(await q(`SELECT ${d.p}id AS id FROM sys.${d.t} WHERE ${Object.keys(fissi(d, c)).map((x, i) => `${d.p}${x} = $${i + 1}`).join(" AND ")}`, Object.values(fissi(d, c)))).map((r) => r.id));
  const trad = (await cli.query("DELETE FROM sys.sys_reference_translations WHERE entity_id = ANY($1::uuid[]) AND entity_table LIKE 'sys_blueprint_%'", [tutti])).rowCount;
  // le definizioni di indicatore della prova (i loro modelli per processo vanno via a cascata), e prima i loro nomi inglesi
  await cli.query("DELETE FROM sys.sys_reference_translations WHERE entity_table = 'sys_kpi_definitions' AND entity_id IN (SELECT kpi_definition_id FROM sys.sys_kpi_definitions WHERE kpi_definition_tenant_id IS NULL AND kpi_definition_code LIKE $1 AND kpi_definition_metadata->>'prototipo' = $2)", [INDICATORI_DI_PIATTAFORMA.prefisso(raw.meta.prototipoId) + "%", raw.meta.prototipoId]);
  const defs = (await cli.query("DELETE FROM sys.sys_kpi_definitions WHERE kpi_definition_tenant_id IS NULL AND kpi_definition_code LIKE $1 AND kpi_definition_metadata->>'prototipo' = $2", [INDICATORI_DI_PIATTAFORMA.prefisso(raw.meta.prototipoId) + "%", raw.meta.prototipoId])).rowCount;
  const fam = (await cli.query("DELETE FROM sys.sys_blueprint_families WHERE blueprint_family_code = $1", [FAMIGLIA])).rowCount;
  const resto = Number((await q("SELECT count(*) n FROM sys.sys_blueprint_variant_versions WHERE blueprint_variant_version_id = $1", [c.versionId]))[0].n);
  if (fam !== 1 || resto !== 0) throw new Error("scarico incompleto: famiglie " + fam + ", versione rimasta " + resto);
  await cli.query("COMMIT");
  Object.assign(esito, { versione: c.versionId, righe_di_contenuto: tutti.length, traduzioni_tolte: trad, definizioni_di_indicatore_tolte: defs, famiglie_tolte: fam });
}

try { await { carica: () => carica(), ricevi, rileggi, scarica }[cmd](); esito.esito = "ok"; }
catch (e) { esito.esito = "errore"; esito.errore = e.message; try { await cli.query("ROLLBACK"); } catch {} }
await cli.end();
esito.finito = new Date().toISOString();
fs.writeFileSync(OUT, JSON.stringify(esito, null, 1));
const { differenze, ...corto } = esito;
console.log(JSON.stringify({ ...corto, differenze: differenze?.slice(0, 15) }, null, 1));
process.exitCode = esito.esito === "ok" && (cmd !== "rileggi" || (esito.percorsi_con_differenze === 0 && esito.pacchetto_ricostruito_uguale)) ? 0 : 1;
