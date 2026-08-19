/**
 * apps/api/test/unit/suite-lock.unit.test.ts
 * IL LUCCHETTO DELLA SUITE DEVE POTER RICONOSCERE UN LOCK MORTO (S1072).
 *
 * IL CASO REALE che ha prodotto questa prova, misurato il 2026-08-19 alle 16:50: la suite
 * di integrazione era inavviabile perché `.zp/suite.lock` dichiarava il PID `10720`,
 * scritto alle 02:38. Quel processo era morto da quattordici ore, ma il sistema aveva
 * **riciclato il numero** e sotto `10720` girava `svchost.exe`. `kill(pid, 0)` rispondeva
 * «vivo», e il lucchetto stava proteggendo il database da un servizio di Windows.
 *
 * Il lucchetto era stato scritto proprio per NON diventare un blocco permanente — il suo
 * commento lo dichiara: «un lock stantio viene ignorato e sovrascritto, altrimenti il primo
 * processo ucciso trasformerebbe il rimedio in un blocco permanente». La difesa c'era, ed
 * era **falsa**: un identificativo che il sistema riusa non identifica nessuno.
 *
 * PERCHÉ QUESTI CASI E NON ALTRI. Ognuno spegne UNA delle due difese e verifica che l'altra
 * regga da sola — che è l'unico modo di sapere che sono davvero due e non una scritta due
 * volte.
 */
import { describe, expect, it } from "vitest";
import { vivo, type Occupante } from "../helpers/suite-lock.js";

const ORA = new Date().toISOString();
const QUATTORDICI_ORE_FA = new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString();

function occupante(pid: number, avviato: string): Occupante {
  return { pid, avviato, comando: "vitest run (finto, per la prova)" };
}

describe("il lucchetto della suite riconosce un lock morto", () => {
  it("il processo che gira ADESSO questa prova è node, ed è vivo: il lucchetto lo rispetta", () => {
    // Il caso positivo viene per primo di proposito. Senza, i tre negativi qui sotto
    // sarebbero verdi anche se `vivo()` tornasse sempre `false` — cioè con il lucchetto
    // completamente disattivato, che è il difetto opposto e altrettanto grave.
    expect(vivo(occupante(process.pid, ORA))).toBe(true);
  });

  it("un PID che non esiste più è morto", () => {
    // PID irraggiungibile per costruzione: `kill(0, 0)` sonda il gruppo di processi, non un
    // processo — quindi si usa un numero altissimo, che nessun sistema assegna.
    expect(vivo(occupante(4_000_000_000, ORA))).toBe(false);
  });

  it("IL CASO DEL 2026-08-19: PID vivo ma vecchissimo → la scadenza lo dichiara morto", () => {
    // Qui il PID esiste DAVVERO (è questo processo) ed è node: entrambe le altre difese
    // direbbero «vivo». Regge solo la scadenza, ed è ciò che questo caso misura.
    expect(vivo(occupante(process.pid, QUATTORDICI_ORE_FA))).toBe(false);
  });

  it("un PID riciclato da un processo che non è node è morto, anche se il lock è appena nato", () => {
    // Lo specchio del caso precedente: data recente, quindi la scadenza NON aiuta. Deve
    // reggere il solo riconoscimento del programma.
    //
    // Il PID 4 è `System` su Windows e `kthreadd` su Linux: esiste sempre, non è mai node,
    // e nessuno può riassegnarlo. Su macOS il PID 1 (`launchd`) fa la stessa cosa.
    const pidDiSistema = process.platform === "darwin" ? 1 : 4;
    expect(vivo(occupante(pidDiSistema, ORA))).toBe(false);
  });
});
