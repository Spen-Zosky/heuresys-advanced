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
 * ⚠ IL PID DA SOLO NON BASTA, e il blocco permanente e' arrivato lo stesso (misurato
 * il 2026-08-19, S1072). Un lock delle 02:38 rendeva la suite inavviabile alle 16:50:
 * il processo era morto da ore, ma il sistema aveva **riciclato il suo PID** e quel
 * numero apparteneva ormai a `svchost.exe`. `kill(pid, 0)` rispondeva «vivo», e il
 * lucchetto proteggeva il database da un processo di Windows.
 * Un identificativo che il sistema RIUSA non identifica: serve anche sapere CHE COSA
 * sta girando sotto quel numero. Due difese, per due modi di sbagliare:
 *   · si verifica che il processo sia davvero **node** (`/proc/<pid>/cmdline` dove
 *     c'e', `tasklist` su Windows). Un PID riciclato da un altro programma non
 *     inganna piu';
 *   · una **scadenza**: un lock piu' vecchio di 3 ore e' stantio comunque. Nessuna
 *     corsa dura tanto (la piu' lunga misurata e' ~45 minuti), quindi la scadenza
 *     non puo' interrompere un lavoro vero — ed e' la rete che regge anche nel caso
 *     peggiore, un PID riciclato **da un altro node**.
 *
 * Via di fuga esplicita: `SUITE_LOCK=0` lo disattiva, per i casi in cui si SA di
 * volere due run insieme.
 */
import { execFileSync } from "node:child_process";
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

export interface Occupante {
  pid: number;
  avviato: string;
  comando: string;
}

/** Oltre questa eta' un lock e' stantio comunque: nessuna corsa dura tre ore. */
const SCADENZA_MS = 3 * 60 * 60 * 1000;

/** Il PID esiste? `kill(pid, 0)` non uccide: sonda e basta. Non dice CHI sia. */
function esiste(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM = esiste ma appartiene a un altro utente → esiste a tutti gli effetti.
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * Sotto quel PID gira davvero node?
 *
 * Nel dubbio risponde `true` — un lucchetto che si apre da solo quando non riesce a
 * guardare sarebbe peggio del blocco che evita: la scadenza resta comunque a coprire
 * il caso. Cio' che non si puo' misurare non diventa un permesso.
 */
function eNode(pid: number): boolean {
  try {
    if (process.platform === "win32") {
      const out = execFileSync("tasklist", ["/FI", `PID eq ${pid}`, "/NH", "/FO", "CSV"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      // Nessuna riga con quel PID = il processo non c'e' piu' (tasklist stampa un avviso).
      if (!out.includes(`"${pid}"`)) return false;
      return /^"node(\.exe)?"/i.test(out.trim());
    }
    const cmdline = readFileSync(`/proc/${pid}/cmdline`, "utf8");
    return cmdline.includes("node");
  } catch {
    return true; // non misurabile → si rispetta il lock, e la scadenza fa da rete
  }
}

/**
 * Il lock e' di un processo che sta DAVVERO girando la suite, adesso?
 *
 * Esportata perche' `test/unit/suite-lock.unit.test.ts` la interroga sui casi che il
 * 2026-08-19 hanno prodotto il blocco permanente. Una difesa contro i falsi positivi
 * che nessuno puo' vedere fallire non e' una difesa: e' una promessa.
 */
export function vivo(chi: Occupante): boolean {
  if (!esiste(chi.pid)) return false;
  const eta = Date.now() - new Date(chi.avviato).getTime();
  if (!Number.isNaN(eta) && eta > SCADENZA_MS) return false;
  return eNode(chi.pid);
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
  if (chi && vivo(chi)) {
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
