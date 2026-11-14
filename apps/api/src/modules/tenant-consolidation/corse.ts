/**
 * apps/api/src/modules/tenant-consolidation/corse.ts — il registro delle corse del modello (mig 000489).
 *
 * Una «corsa» è un prototipo che il datastore ha costruito e consegnato (cartella delle consegne,
 * ADR-0047): advanced la accoglie come versione di modello e la ricorda qui, per tenant, con le date
 * della corsa, il modello e quando l'ha caricato, la prima sessione di consolidamento fatta con lei e i
 * suoi risultati iniziali (quante voci, quante proposte, quanto tempo ha impiegato l'agente), e lo
 * stato: CARICATA, IN_CONSOLIDAMENTO, DEFINITIVA (il modello in uso), SUPERATA.
 *
 * ADR-0043: advanced non legge il database del datastore. Legge solo la cartella delle consegne, che
 * l'ambiente dichiara in `DATASTORE_CONSEGNE_DIR`; senza, l'elenco delle consegne è vuoto e lo dice.
 *
 * Accogliere una consegna riusa il caricatore verificato `db/scripts/pacchetto/accogli-pacchetto.mjs
 * ricevi`: verifica il manifesto e l'impronta prima di scrivere, fa solo inserimenti, è idempotente per
 * impronta e lascia una ricevuta per ogni esito (000460). Qui lo si lancia come processo figlio con
 * l'identità di connessione dell'API.
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { PoolClient } from "pg";
import type {
  AvailableDelivery,
  BlueprintRun,
  BlueprintRunGroupResult,
  ConsolidationGroup,
} from "@heuresys/shared";
import { env } from "../../config/env.js";
import { pool, withTransaction } from "../../db/client.js";
import { ConflictError, InternalError, NotFoundError, UnprocessableEntityError } from "../../errors/index.js";
import { BLUEPRINT_CONTENT_KEY } from "../tenant-materialization/blueprint-build-source.js";
import type { DbConnector } from "./repository.js";

const exec = promisify(execFile);
const QUI = path.dirname(fileURLToPath(import.meta.url));
/** Da src/ o da dist/ la profondità è la stessa: modules/tenant-consolidation → radice del repository. */
const RADICE = path.resolve(QUI, "../../../../..");
const CARICATORE = path.join(RADICE, "db/scripts/pacchetto/accogli-pacchetto.mjs");
const CODICE = /^p[0-9a-z_]{6,60}$/;

/* ── la cartella delle consegne ───────────────────────────────────────────────────────── */

export function cartellaConsegne(e: NodeJS.ProcessEnv = process.env): string | null {
  const d = e["DATASTORE_CONSEGNE_DIR"]?.trim();
  return d ? d : null;
}

/** Il codice della corsa porta l'istante in cui è nata, in UTC: p20261010010521tjb → 2026-10-10T01:05:21Z. */
export function inizioDalCodice(code: string): string | null {
  const m = /^p(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(code);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000Z`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

interface Consegna {
  code: string;
  packageVersion: number;
  packageHash: string;
  contract: string;
  deliveredAt: string;
  description: string | null;
  executedFrom: string | null;
  executedTo: string | null;
  dir: string;
}

/** Il pacchetto pesa megabyte: se ne leggono le poche righe che servono una volta per impronta. */
const memoria = new Map<string, { description: string | null; executedTo: string | null }>();

function leggiConsegna(dir: string): Consegna | null {
  let m: Record<string, unknown>;
  try {
    m = JSON.parse(fs.readFileSync(path.join(dir, "manifesto.json"), "utf8")) as Record<string, unknown>;
  } catch {
    return null; // una cartella senza manifesto leggibile non è una consegna completa
  }
  const impronta = (m["impronta"] as { valore?: unknown } | undefined)?.valore;
  if (typeof m["prototipo"] !== "string" || !CODICE.test(m["prototipo"]) || typeof m["versione"] !== "number"
      || typeof impronta !== "string" || typeof m["consegnatoIl"] !== "string") return null;
  let extra = memoria.get(impronta);
  if (!extra) {
    try {
      const p = JSON.parse(fs.readFileSync(path.join(dir, "pacchetto.json"), "utf8")) as {
        meta?: { creatoIl?: unknown };
        contesto?: { descrizione?: { it?: unknown } };
      };
      extra = {
        description: typeof p.contesto?.descrizione?.it === "string" ? p.contesto.descrizione.it : null,
        executedTo: typeof p.meta?.creatoIl === "string" ? p.meta.creatoIl : null,
      };
    } catch {
      extra = { description: null, executedTo: null };
    }
    memoria.set(impronta, extra);
  }
  return {
    code: m["prototipo"],
    packageVersion: m["versione"],
    packageHash: impronta,
    contract: typeof m["contratto"] === "string" ? m["contratto"] : "",
    deliveredAt: m["consegnatoIl"],
    description: extra.description,
    executedFrom: inizioDalCodice(m["prototipo"]),
    executedTo: extra.executedTo,
    dir,
  };
}

/** Tutte le consegne complete della cartella: `<prototipo>/<versione>/manifesto.json`. */
export function consegne(radice: string): Consegna[] {
  const out: Consegna[] = [];
  let prototipi: string[] = [];
  try {
    prototipi = fs.readdirSync(radice).filter((d) => CODICE.test(d));
  } catch {
    return out;
  }
  for (const p of prototipi) {
    let versioni: string[] = [];
    try {
      versioni = fs.readdirSync(path.join(radice, p)).filter((v) => /^\d+$/.test(v));
    } catch {
      continue;
    }
    for (const v of versioni) {
      const c = leggiConsegna(path.join(radice, p, v));
      if (c && c.code === p && String(c.packageVersion) === v) out.push(c);
    }
  }
  return out.sort((a, b) => b.deliveredAt.localeCompare(a.deliveredAt));
}

/* ── il registro ──────────────────────────────────────────────────────────────────────── */

interface RigaCorsa {
  blueprint_run_id: string;
  blueprint_run_code: string;
  blueprint_run_package_version: number;
  blueprint_run_package_hash: string;
  blueprint_run_description: string | null;
  blueprint_run_executed_from: Date | null;
  blueprint_run_executed_to: Date | null;
  blueprint_run_variant_version_id: string | null;
  blueprint_run_model_label: string;
  blueprint_run_model_loaded_at: Date;
  blueprint_run_status: BlueprintRun["status"];
  blueprint_run_first_consolidation_id: string | null;
  blueprint_run_initial_results: BlueprintRun["initialResults"] | null;
  blueprint_run_definitive_at: Date | null;
  in_use: boolean;
  consolidations: number;
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

function mappa(r: RigaCorsa): BlueprintRun {
  return {
    runId: r.blueprint_run_id,
    code: r.blueprint_run_code,
    packageVersion: r.blueprint_run_package_version,
    packageHash: r.blueprint_run_package_hash,
    description: r.blueprint_run_description,
    executedFrom: iso(r.blueprint_run_executed_from),
    executedTo: iso(r.blueprint_run_executed_to),
    variantVersionId: r.blueprint_run_variant_version_id,
    modelLabel: r.blueprint_run_model_label,
    modelLoadedAt: r.blueprint_run_model_loaded_at.toISOString(),
    status: r.blueprint_run_status,
    inUse: r.in_use,
    firstConsolidationId: r.blueprint_run_first_consolidation_id,
    consolidations: r.consolidations,
    initialResults: r.blueprint_run_initial_results ?? {},
    definitiveAt: iso(r.blueprint_run_definitive_at),
  };
}

const SELEZIONE = `
  SELECT r.*,
         EXISTS (SELECT 1 FROM sys.sys_blueprint_activations a
                  WHERE a.blueprint_activation_tenant_id = r.blueprint_run_tenant_id
                    AND a.blueprint_activation_status = 'ACTIVE'
                    AND a.blueprint_activation_variant_version_id = r.blueprint_run_variant_version_id) AS in_use,
         (SELECT count(*)::int FROM sys.sys_tenant_consolidations c
           WHERE c.tenant_consolidation_run_id = r.blueprint_run_id) AS consolidations
    FROM sys.sys_blueprint_runs r`;

/** Il registro del tenant, dalla corsa caricata più di recente. */
export async function elencoCorse(q: DbConnector, tenantId: string): Promise<BlueprintRun[]> {
  const { rows } = await q.query<RigaCorsa>(
    `${SELEZIONE} WHERE r.blueprint_run_tenant_id = $1
      ORDER BY r.blueprint_run_model_loaded_at DESC, r.created_at DESC`,
    [tenantId],
  );
  return rows.map(mappa);
}

export async function corsa(q: DbConnector, tenantId: string, runId: string): Promise<BlueprintRun | null> {
  const { rows } = await q.query<RigaCorsa>(
    `${SELEZIONE} WHERE r.blueprint_run_tenant_id = $1 AND r.blueprint_run_id = $2`,
    [tenantId, runId],
  );
  return rows[0] ? mappa(rows[0]) : null;
}

/** Le consegne della cartella, con la corsa del registro che già le porta (per non rifarle). */
export async function consegneDisponibili(
  tenantId: string,
  radice: string | null = cartellaConsegne(),
): Promise<{ configured: boolean; items: AvailableDelivery[] }> {
  if (!radice) return { configured: false, items: [] };
  const registro = await elencoCorse(pool, tenantId);
  const chiave = (c: string, v: number) => `${c}#${v}`;
  const gia = new Map(registro.map((r) => [chiave(r.code, r.packageVersion), r.runId]));
  return {
    configured: true,
    items: consegne(radice).map(({ dir: _dir, ...c }) => ({ ...c, runId: gia.get(chiave(c.code, c.packageVersion)) ?? null })),
  };
}

/**
 * Registra la corsa che porta la versione di modello `variantVersionId`. Idempotente: la stessa
 * corsa (codice e numero del pacchetto) entra una volta per tenant.
 */
export async function registraCorsa(
  q: DbConnector,
  tenantId: string,
  c: Omit<Consegna, "dir" | "contract" | "deliveredAt">,
  variantVersionId: string,
  userId: string | null,
): Promise<string> {
  const { rows } = await q.query<{ id: string }>(
    `INSERT INTO sys.sys_blueprint_runs
       (blueprint_run_tenant_id, blueprint_run_code, blueprint_run_package_version, blueprint_run_package_hash,
        blueprint_run_description, blueprint_run_executed_from, blueprint_run_executed_to,
        blueprint_run_variant_version_id, blueprint_run_model_label, blueprint_run_model_loaded_at, created_by)
     SELECT $1, $2, $3, $4, $5, $6, $7, vv.blueprint_variant_version_id,
            -- il nome della variante del datastore è la descrizione intera: basta la parte prima dei due punti
            left(format('%s — versione %s', coalesce(nullif(trim(split_part(v.blueprint_variant_name, ':', 1)), ''), v.blueprint_variant_code),
                        vv.blueprint_variant_version_number), 250),
            vv.created_at, $9
       FROM sys.sys_blueprint_variant_versions vv
       JOIN sys.sys_blueprint_variants v ON v.blueprint_variant_id = vv.blueprint_variant_version_variant_id
      WHERE vv.blueprint_variant_version_id = $8
     ON CONFLICT (blueprint_run_tenant_id, blueprint_run_code, blueprint_run_package_version) DO NOTHING
     RETURNING blueprint_run_id AS id`,
    [tenantId, c.code, c.packageVersion, c.packageHash, c.description, c.executedFrom, c.executedTo,
     variantVersionId, userId],
  );
  if (rows[0]) return rows[0].id;
  const r = await q.query<{ id: string }>(
    `SELECT blueprint_run_id AS id FROM sys.sys_blueprint_runs
      WHERE blueprint_run_tenant_id = $1 AND blueprint_run_code = $2 AND blueprint_run_package_version = $3`,
    [tenantId, c.code, c.packageVersion],
  );
  if (!r.rows[0]) throw new NotFoundError("Versione di modello non trovata", "BLUEPRINT_RUN_VERSION_NOT_FOUND");
  return r.rows[0].id;
}

/**
 * Accoglie una consegna come versione di modello e la registra per il tenant. Se il registro la
 * porta già, la restituisce senza toccare niente: è così che il registro evita le corse doppie.
 */
export async function accogliConsegna(
  tenantId: string,
  userId: string | null,
  code: string,
  packageVersion: number,
  radice: string | null = cartellaConsegne(),
): Promise<BlueprintRun> {
  if (!radice) {
    throw new UnprocessableEntityError(
      { code: "cartella non configurata" },
      "Questo server non ha la cartella delle consegne del datastore",
      "BLUEPRINT_RUN_DELIVERIES_UNAVAILABLE",
    );
  }
  const c = consegne(radice).find((x) => x.code === code && x.packageVersion === packageVersion);
  if (!c) throw new NotFoundError("Consegna non trovata nella cartella del datastore", "BLUEPRINT_RUN_DELIVERY_NOT_FOUND");

  const gia = (await elencoCorse(pool, tenantId)).find((r) => r.code === code && r.packageVersion === packageVersion);
  if (gia) {
    if (gia.packageHash !== c.packageHash) {
      throw new ConflictError("La corsa è nel registro con un'altra impronta", "BLUEPRINT_RUN_HASH_MISMATCH");
    }
    return gia;
  }

  const versione = await caricaVersione(c.dir);
  const runId = await registraCorsa(pool, tenantId, c, versione, userId);
  return (await corsa(pool, tenantId, runId))!;
}

/** Lancia il caricatore verificato e ne legge l'esito: la versione di modello che porta la consegna. */
async function caricaVersione(dir: string): Promise<string> {
  const lavoro = fs.mkdtempSync(path.join(os.tmpdir(), "accogli-"));
  const uscita = path.join(lavoro, "esito.json");
  const user = env.POSTGRES_APP_USER ?? env.POSTGRES_USER;
  const password = env.POSTGRES_APP_USER ? (env.POSTGRES_APP_PASSWORD ?? "") : env.POSTGRES_PASSWORD;
  try {
    try {
      await exec(process.execPath, [CARICATORE, "ricevi", env.POSTGRES_DB, dir, uscita, "--produzione"], {
        env: {
          PATH: process.env["PATH"] ?? "",
          PGHOST: env.POSTGRES_HOST,
          PGPORT: String(env.POSTGRES_PORT),
          PGUSER: user,
          PGPASSWORD: password,
        },
        timeout: 10 * 60_000,
        maxBuffer: 16 * 1024 * 1024,
      });
    } catch {
      // l'esito, se il caricatore l'ha scritto, dice perché; il messaggio del processo non va al chiamante
    }
    let esito: { ricevimento?: string; versione?: string; errore?: string } = {};
    try {
      esito = JSON.parse(fs.readFileSync(uscita, "utf8")) as typeof esito;
    } catch {
      /* niente esito: sotto diventa un errore */
    }
    if ((esito.ricevimento === "CARICATO" || esito.ricevimento === "GIA_PRESENTE") && esito.versione) return esito.versione;
    if (esito.ricevimento === "RIFIUTATO" || esito.ricevimento === "NON_VERIFICATO") {
      throw new UnprocessableEntityError(
        { code: esito.ricevimento },
        "La consegna non si è potuta accogliere: il manifesto o l'impronta non reggono, o il pacchetto c'è già con un'altra impronta",
        "BLUEPRINT_RUN_DELIVERY_REJECTED",
      );
    }
    throw new InternalError("BLUEPRINT_RUN_LOAD_FAILED", "il caricatore non ha prodotto un esito", "Il caricamento del modello non è riuscito");
  } finally {
    fs.rmSync(lavoro, { recursive: true, force: true });
  }
}

/* ── il registro durante il consolidamento ────────────────────────────────────────────── */

/** Una sessione nasce con la corsa: la prima diventa la sessione di riferimento dei risultati iniziali. */
export async function sessioneAperta(q: DbConnector, runId: string, consolidationId: string): Promise<void> {
  await q.query(
    `UPDATE sys.sys_blueprint_runs
        SET blueprint_run_first_consolidation_id = coalesce(blueprint_run_first_consolidation_id, $2),
            blueprint_run_status = CASE WHEN blueprint_run_status = 'CARICATA' THEN 'IN_CONSOLIDAMENTO' ELSE blueprint_run_status END
      WHERE blueprint_run_id = $1`,
    [runId, consolidationId],
  );
}

/**
 * Il primo giro di un gruppo nella prima sessione della corsa scrive i risultati iniziali; i giri
 * successivi (rifacimenti dopo un rifiuto, sessioni nuove) non li toccano: sono la misura di partenza.
 */
export async function risultatoIniziale(
  q: DbConnector,
  consolidationId: string,
  group: ConsolidationGroup,
  r: BlueprintRunGroupResult,
): Promise<void> {
  await q.query(
    `UPDATE sys.sys_blueprint_runs
        SET blueprint_run_initial_results = blueprint_run_initial_results || jsonb_build_object($2::text, $3::jsonb)
      WHERE blueprint_run_first_consolidation_id = $1
        AND NOT blueprint_run_initial_results ? $2`,
    [consolidationId, group, JSON.stringify(r)],
  );
}

/* ── la corsa definitiva ──────────────────────────────────────────────────────────────── */

/**
 * Perché qui basta il mandato del Direttore HR e non `blueprint:activate` (rilievo di sicurezza del
 * 2026-11-14, valutato): la versione è nel registro di QUESTO tenant (la si cerca per tenant), e dalla
 * 000463 ogni attivazione fissa la propria versione, quindi pubblicarla la rende adottabile ma non
 * cambia il modello di nessun altro tenant. Il catalogo dei prototipi non è un dato di un cliente.
 *
 * La corsa diventa il modello in uso del tenant: la sua versione si pubblica (se è una bozza),
 * l'attivazione del tenant passa a lei (l'attivazione di un'altra variante si ritira, quella della
 * stessa variante cambia versione), la definitiva di prima diventa SUPERATA.
 */
export async function rendiDefinitiva(tenantId: string, runId: string, userId: string | null): Promise<BlueprintRun> {
  await withTransaction(async (c: PoolClient) => {
    const { rows } = await c.query<{ ver: string | null; stato: string; variante: string | null; vstato: string | null }>(
      `SELECT r.blueprint_run_variant_version_id AS ver, r.blueprint_run_status AS stato,
              vv.blueprint_variant_version_variant_id AS variante, vv.blueprint_variant_version_status AS vstato
         FROM sys.sys_blueprint_runs r
         LEFT JOIN sys.sys_blueprint_variant_versions vv ON vv.blueprint_variant_version_id = r.blueprint_run_variant_version_id
        WHERE r.blueprint_run_tenant_id = $1 AND r.blueprint_run_id = $2
        FOR UPDATE OF r`,
      [tenantId, runId],
    );
    const r = rows[0];
    if (!r) throw new NotFoundError("Corsa non trovata", "BLUEPRINT_RUN_NOT_FOUND");
    if (!r.ver || !r.variante) {
      throw new ConflictError("La versione di modello di questa corsa non c'è più", "BLUEPRINT_RUN_VERSION_MISSING");
    }
    if (r.vstato === "RETIRED") throw new ConflictError("La versione di modello è ritirata", "BLUEPRINT_RUN_VERSION_RETIRED");
    // Il profilo del tenant (lib/scope/profilo.ts) legge ruoli e cruscotti dalla versione attiva: una
    // versione che non li porta svuoterebbe il catalogo dei ruoli e i cruscotti del tenant. Il pacchetto
    // 0.3 del datastore oggi non li porta (richiesta M2-M6 del programma di consolidamento): si rifiuta.
    // Le porte di ricompensa sono della variante e la 000400 pretende che ogni tenant attivo ne abbia:
    // una variante senza porte non si adotta da qui (il catalogo è di piattaforma, non lo scrive un tenant).
    const pieno = await c.query<{ ruoli: number; cruscotti: number; porte: number }>(
      `SELECT (SELECT count(*)::int FROM sys.sys_blueprint_content_job_roles WHERE blueprint_content_job_role_version_id = $1) AS ruoli,
              (SELECT count(*)::int FROM sys.sys_blueprint_content_dashboards WHERE blueprint_content_dashboard_version_id = $1) AS cruscotti,
              (SELECT count(*)::int FROM sys.sys_reward_gate_catalog WHERE reward_gate_catalog_blueprint_variant_id = $2) AS porte`,
      [r.ver, r.variante],
    );
    const vuoto = pieno.rows[0]!;
    const mancano = [vuoto.ruoli === 0 ? "i ruoli" : null, vuoto.cruscotti === 0 ? "i cruscotti" : null,
      vuoto.porte === 0 ? "le porte di ricompensa" : null].filter((x): x is string => x !== null);
    if (mancano.length > 0) {
      throw new ConflictError(
        `Il modello di questa corsa non porta ancora ${mancano.join(", ")}: renderlo il modello in uso svuoterebbe quelli del tenant`,
        "BLUEPRINT_RUN_NOT_ACTIVATABLE",
      );
    }
    if (r.vstato !== "PUBLISHED") {
      await c.query(
        `UPDATE sys.sys_blueprint_variant_versions
            SET blueprint_variant_version_status = 'PUBLISHED', blueprint_variant_version_published_at = now(),
                blueprint_variant_version_build_source_key = coalesce(blueprint_variant_version_build_source_key, $2)
          WHERE blueprint_variant_version_id = $1`,
        [r.ver, BLUEPRINT_CONTENT_KEY],
      );
    }
    const att = await c.query<{ id: string; variante: string }>(
      `SELECT blueprint_activation_id AS id, blueprint_activation_variant_id AS variante
         FROM sys.sys_blueprint_activations
        WHERE blueprint_activation_tenant_id = $1 AND blueprint_activation_status = 'ACTIVE'
        FOR UPDATE`,
      [tenantId],
    );
    const a = att.rows[0];
    if (a && a.variante === r.variante) {
      await c.query(
        `UPDATE sys.sys_blueprint_activations
            SET blueprint_activation_variant_version_id = $2, updated_by = $3
          WHERE blueprint_activation_id = $1`,
        [a.id, r.ver, userId],
      );
    } else {
      if (a) {
        await c.query(
          `UPDATE sys.sys_blueprint_activations
              SET blueprint_activation_status = 'RETIRED',
                  blueprint_activation_effective_to = greatest(current_date, blueprint_activation_effective_from),
                  updated_by = $2
            WHERE blueprint_activation_id = $1`,
          [a.id, userId],
        );
      }
      await c.query(
        `INSERT INTO sys.sys_blueprint_activations
           (blueprint_activation_tenant_id, blueprint_activation_variant_id, blueprint_activation_variant_version_id,
            blueprint_activation_status, blueprint_activation_effective_from, blueprint_activation_metadata, created_by, updated_by)
         VALUES ($1, $2, $3, 'ACTIVE', current_date, jsonb_build_object('origine', 'registro delle corse', 'corsa', $4::text), $5, $5)`,
        [tenantId, r.variante, r.ver, runId, userId],
      );
    }
    await c.query(
      `UPDATE sys.sys_blueprint_runs SET blueprint_run_status = 'SUPERATA'
        WHERE blueprint_run_tenant_id = $1 AND blueprint_run_status = 'DEFINITIVA' AND blueprint_run_id <> $2`,
      [tenantId, runId],
    );
    await c.query(
      `UPDATE sys.sys_blueprint_runs
          SET blueprint_run_status = 'DEFINITIVA', blueprint_run_definitive_at = now(), blueprint_run_definitive_by = $2
        WHERE blueprint_run_id = $1`,
      [runId, userId],
    );
  });
  return (await corsa(pool, tenantId, runId))!;
}
