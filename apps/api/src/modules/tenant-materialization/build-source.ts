/**
 * apps/api/src/modules/tenant-materialization/build-source.ts
 * DA DOVE NASCE UN PIANO DI COSTRUZIONE (#198 T4, E21 — S1067 · ritiro dell'archetipo #132 F3).
 *
 * E21, la decisione di Enzo: **il motore viene prima della sorgente**. Una `BuildSource`
 * risponde a una sola domanda — *quali righe vanno create, e perché* — e la risposta è un
 * `BuildPlan`. Il motore non sa da dove viene: oggi il contenuto di un modello letto dal
 * database (`BlueprintBuildSource`, `#132` F2), domani una ricerca (F4), un'estrazione
 * (P4, `#206`), o un fascicolo compilato a mano.
 *
 * ⚠ QUI VIVEVA LA SORGENTE CHE LEGGEVA L'ARCHETIPO, ED È STATA RITIRATA (`#132` F3 — E29 di
 * Enzo, 2026-08-17): *«Il fascicolo non può avere un archetipo aprioristico, altrimenti
 * genera sempre una banca come RTL. I dati hardcoded del file di codice scritto a mano devono
 * scomparire — non deve rimanere traccia — e l'archetipo deve essere generato dalla ricerca.»*
 * Con lei se n'è andato `blueprints.ts`: 296 righe che descrivevano una banca al dettaglio, e
 * che facevano nascere banca **ogni** azienda costruita — misurato il 2026-08-19 su
 * un'azienda di prova in produzione, poi disfatta per intero.
 *
 * L'interfaccia resta, e adesso ha un solo esemplare per una ragione opposta a quella di
 * prima: prima ne aveva uno perché il secondo non era ancora nato, ora perché il primo è
 * stato tolto. Ciò che rende il confine **verificabile** non cambia:
 *   grep -n "blueprints" apps/api/src/modules/tenant-materialization/repository.ts
 * deve non trovare niente — il motore non guarda dentro nessuna sorgente.
 */
import type { PoolClient } from "pg";
import type { pool } from "../../db/client.js";
import type { BuildPlan } from "./build-plan.js";

/**
 * Il connettore che una sorgente usa per leggere.
 *
 * Sta qui e non nel `repository.ts` del motore perché è ciò di cui una **sorgente** ha
 * bisogno: se vivesse nel motore, ogni sorgente dovrebbe importare il modulo che non deve
 * conoscerla, e il confine di E21 sarebbe scritto al contrario.
 */
export type DbConnector = typeof pool | PoolClient;

/**
 * Da dove nasce un piano di costruzione. `key` è ciò che il modello dichiara nel campo
 * `blueprint_variant_version_build_source_key`.
 */
export interface BuildSource {
  key: string;
  /** Il piano che questa sorgente produce. Asincrono: una sorgente vera legge (DB, rete). */
  plan(): Promise<BuildPlan>;
}
