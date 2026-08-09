/**
 * apps/api/test/helpers/suite-lock.ts — un lucchetto per la suite di integrazione.
 *
 * PERCHE' ESISTE
 * --------------
 * I test di integrazione condividono UN PostgreSQL (la VM, via tunnel). Niente
 * impediva a due processi di avviare la suite insieme, e niente lo segnalava.
 *
 * Misurato nella notte del 2026-08-05, non ipotizzato: due esecuzioni in parallelo
 * sullo stesso database hanno prodotto **14 file falliti su 232**; la stessa suite,
 * stesso codice e stesso working tree, su database libero ne ha prodotti **4**. La
 * concorrenza ha piu' che triplicato i rossi — e NESSUNO era un fallimento di
 * asserzione: 1549 test passati, zero test falliti. I file cadevano prima di
 * eseguire, su lock e connessioni contese.
 *
 * Il danno peggiore non e' il tempo perso (45 minuti di suite inutilizzabile): e'
 * che senza accorgersene si sarebbero "corretti" dieci fallimenti inesistenti. La
 * concorrenza fu scoperta guardando i processi a mano.
 *
 * COME
 * ----
 * `globalSetup` (una volta per run, non per file): chi arriva primo scrive
 * `.zp/suite.lock` con PID, orario e comando; chi arriva dopo si ferma dicendo CHI
 * sta girando e DA QUANTO.
 *
 * Un lock STANTIO — PID che non esiste piu' — viene ignorato e sovrascritto:
 * altrimenti il primo processo ucciso (Ctrl-C, crash, TaskStop) trasformerebbe il
 * rimedio in un blocco permanente. E' il caso che rende il lucchetto utilizzabile
 * invece che odioso.
 *
 * Via di fuga esplicita: `SUITE_LOCK=0` lo disattiva, per i casi in cui si SA di
 * volere due run insieme.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

// Il lucchetto protegge UN DATABASE, non una cartella. Derivandolo solo dal file
// sorgente, due copie del repo (i worktree dei lavoratori di gov, #173) ne
// otterrebbero uno per cartella: due lucchetti diversi, nessuna protezione, e si
// tornerebbe esattamente al caso misurato il 2026-08-05. Chi apre piu' cartelle di
// lavoro sullo stesso PostgreSQL impone il percorso con SUITE_LOCK_FILE.
const LOCK = process.env["SUITE_LOCK_FILE"] || join(REPO, ".zp", "suite.lock");

interface Occupante {
  pid: number;
  avviato: string;
  comando: string;
}

/** Il processo esiste ancora? `kill(pid, 0)` non uccide: sonda e basta. */
function vivo(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM = esiste ma appartiene a un altro utente → vivo a tutti gli effetti.
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

function leggi(): Occupante | null {
  try {
    return JSON.parse(readFileSync(LOCK, "utf8")) as Occupante;
  } catch {
    return null; // assente o illeggibile: per il lucchetto e' come non esserci
  }
}

export async function setup(): Promise<void> {
  if (process.env["SUITE_LOCK"] === "0") return;

  const chi = leggi();
  if (chi && vivo(chi.pid)) {
    const da = Math.round((Date.now() - new Date(chi.avviato).getTime()) / 1000);
    throw new Error(
      `La suite e' gia' in esecuzione: PID ${chi.pid}, avviata ${da}s fa (${chi.avviato}).\n` +
        `  comando: ${chi.comando}\n` +
        `  Due suite sullo stesso database si contendono lock e connessioni, e producono rossi\n` +
        `  che non sono difetti (misurato 2026-08-05: 14 file falliti in concorrenza contro 4 su\n` +
        `  database libero, con ZERO test falliti in entrambi i casi).\n` +
        `  Aspetta che finisca, oppure — se sai quello che fai — SUITE_LOCK=0.`,
    );
  }

  mkdirSync(dirname(LOCK), { recursive: true });
  writeFileSync(
    LOCK,
    JSON.stringify(
      { pid: process.pid, avviato: new Date().toISOString(), comando: process.argv.slice(1).join(" ") },
      null,
      2,
    ),
    "utf8",
  );
}

export async function teardown(): Promise<void> {
  if (process.env["SUITE_LOCK"] === "0") return;
  // Si rimuove SOLO il proprio lock: se un altro processo lo ha riscritto (perche' il
  // nostro era stantio), cancellarlo lascerebbe quello vero senza protezione.
  const chi = leggi();
  if (chi && chi.pid === process.pid) rmSync(LOCK, { force: true });
}
