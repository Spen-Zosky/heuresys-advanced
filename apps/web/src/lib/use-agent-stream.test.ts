/**
 * apps/web/src/lib/use-agent-stream.test.ts — #159 F2, S1092.
 *
 * La prova dinamica che l'estrazione del canale non aveva. S1091 ha portato lo stream
 * dell'agente fuori dalla pagina e lo ha lasciato coperto dai soli cancelli **statici**,
 * scrivendolo apertamente: *«due cancelli statici verdi non sono una prova che il canale si
 * comporti come prima»*. Questo file prova la parte che si può provare senza montare nulla.
 *
 * ⚠ **Il perimetro è dichiarato, o il verde mentirebbe.** Qui si prova `parseSseBlock`, che
 * è una funzione **pura**: dato un blocco di testo SSE, restituisce tipo e dati. NON si prova
 * `useAgentStream`, che è un hook React e pretende un renderer — cioè dipendenze nuove e
 * infrastruttura ulteriore. Un file verde qui significa «l'interprete dei blocchi si comporta
 * come deve», non «il canale funziona»: sono due affermazioni diverse e la seconda resta
 * senza prova automatica.
 *
 * I casi sono scritti a partire dal **protocollo**, non dall'implementazione: è il modo in
 * cui una prova può ancora fallire quando l'implementazione cambia in silenzio.
 */

import { describe, it, expect } from "vitest";

import { parseSseBlock } from "./use-agent-stream.js";

describe("parseSseBlock — l'interprete dei blocchi SSE", () => {
  it("legge tipo e dati da un blocco completo", () => {
    const r = parseSseBlock('event: chunk\ndata: {"text":"ciao"}');
    expect(r.kind).toBe("chunk");
    expect(r.data).toBe('{"text":"ciao"}');
  });

  it("senza `event:` il tipo è `message` — è il default del protocollo, non un caso limite", () => {
    // Un server che manda solo `data:` sta mandando un messaggio: lo dice la specifica SSE,
    // e un interprete che restituisse stringa vuota romperebbe uno smistamento per tipo.
    const r = parseSseBlock('data: {"text":"senza tipo"}');
    expect(r.kind).toBe("message");
    expect(r.data).toBe('{"text":"senza tipo"}');
  });

  it("⭐ unisce le righe `data:` multiple con un a-capo, non concatenandole", () => {
    // È la regola SSE che un interprete ingenuo sbaglia più spesso: un payload lungo arriva
    // spezzato su più righe `data:`, e unirle senza a-capo produce un JSON incollato che non
    // si riesce più a leggere. Il difetto sarebbe invisibile finché i payload restano corti.
    const r = parseSseBlock("event: chunk\ndata: prima\ndata: seconda\ndata: terza");
    expect(r.data).toBe("prima\nseconda\nterza");
  });

  it("tollera il ritorno a capo di Windows senza portarselo dentro i dati", () => {
    // Lo stream attraversa la rete: un `\r` residuo finirebbe dentro il valore e farebbe
    // fallire un confronto di tipo che a occhio sembra giusto.
    const r = parseSseBlock("event: done\r\ndata: fine\r\n");
    expect(r.kind).toBe("done");
    expect(r.data).toBe("fine");
  });

  it("un blocco vuoto non è un errore: tipo di default e dati vuoti", () => {
    const r = parseSseBlock("");
    expect(r.kind).toBe("message");
    expect(r.data).toBe("");
  });

  it("ignora le righe che non sono né `event:` né `data:` — i commenti SSE compresi", () => {
    // Le righe che iniziano con `:` sono commenti di keep-alive: un interprete che le
    // scambiasse per dati inietterebbe rumore nella conversazione.
    const r = parseSseBlock("event: chunk\n: keep-alive\nid: 42\ndata: vero");
    expect(r.kind).toBe("chunk");
    expect(r.data).toBe("vero");
  });

  it("⭐ non taglia i due punti che stanno DENTRO al valore", () => {
    // `slice` sulla lunghezza del prefisso, non uno `split(":")`: un JSON contiene due punti
    // a ogni chiave, e tagliare sul primo separatore trovato distruggerebbe ogni payload.
    const r = parseSseBlock('event: chunk\ndata: {"ora":"12:30","dove":"qui"}');
    expect(r.data).toBe('{"ora":"12:30","dove":"qui"}');
  });
});
