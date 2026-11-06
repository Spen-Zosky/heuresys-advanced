// Il registro del giro: un file SQLite, una riga per ogni verifica.
// È la sola fonte del rapporto: un difetto che non è qui non esiste.
import { DatabaseSync } from 'node:sqlite';

export function apri(file) {
  const db = new DatabaseSync(file);
  db.exec(`
  pragma journal_mode = wal;
  create table if not exists meta (chiave text primary key, valore text);
  create table if not exists unita (
    id integer primary key, url text not null, persona text not null, viewport text not null, lingua text not null,
    percorso text not null default '[]', profondita integer not null default 0, fonte text, padre integer,
    stato text not null default 'da-fare', errore text, firma text, url_finale text, http integer, ms integer,
    screenshot text, iniziata text, finita text,
    unique (url, persona, viewport, lingua, percorso));
  create table if not exists verifica (
    id integer primary key, unita_id integer not null, nodo text, nodo_tipo text, nodo_nome text,
    controllo text not null, esito_auto text not null, dettaglio text, evidenza text,
    verdetto text, causa text, da text, quando text);
  create index if not exists v_unita on verifica(unita_id);
  create index if not exists v_verdetto on verifica(verdetto);
  create table if not exists rete (unita_id integer, azione text, metodo text, url text, stato integer, bloccata integer, ms integer);
  create table if not exists firme (chiave text, firma text, primary key (chiave, firma));
  `);
  return db;
}

const VERDETTO_AUTO = { PASS: ['OK', null], FAIL: ['DIFETTO', null], GIUDIZIO: [null, null] };

export function verifica(db, u, nodo, controllo, esito, dettaglio, evidenza, causaBloccato) {
  let [verd, causa] = VERDETTO_AUTO[esito] || [null, null];
  if (esito === 'BLOCCATO') { verd = 'BLOCCATO'; causa = causaBloccato || dettaglio; }
  if (esito === 'NA') { verd = 'NON-APPLICABILE'; causa = causaBloccato || dettaglio; }
  db.prepare(`insert into verifica (unita_id, nodo, nodo_tipo, nodo_nome, controllo, esito_auto, dettaglio, evidenza, verdetto, causa, da, quando)
              values (?,?,?,?,?,?,?,?,?,?,?,?)`).run(u, nodo?.percorso ?? null, nodo?.tipo ?? null, nodo?.nome ?? null,
    controllo, esito, dettaglio ?? null, evidenza ?? null, verd, causa, verd ? 'automatico' : null, verd ? new Date().toISOString() : null);
}

export function accoda(db, r) {
  const res = db.prepare(`insert or ignore into unita (url, persona, viewport, lingua, percorso, profondita, fonte, padre)
                          values (?,?,?,?,?,?,?,?)`).run(r.url, r.persona, r.viewport, r.lingua, JSON.stringify(r.percorso || []), r.profondita || 0, r.fonte || null, r.padre ?? null);
  return res.changes > 0;
}

export function firmaNuova(db, chiave, firma) {
  return db.prepare('insert or ignore into firme (chiave, firma) values (?,?)').run(chiave, firma).changes > 0;
}
