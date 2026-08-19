/**
 * apps/api/src/modules/research/service.ts
 *
 * L'orchestrazione di una corsa di ricerca (#132 F4g).
 *
 * L'ordine dei passi non e' un dettaglio: **prima si verifica, poi si scrive**. Il fascicolo
 * esiste? I sei parametri ci sono? Il dominio e' dichiarato? Le domande non nominano il
 * cliente? Solo dopo nasce la riga della corsa. Una corsa registrata e poi rifiutata
 * lascerebbe nel registro un `RUNNING` che non e' mai partito, e chi lo legge domani non
 * saprebbe distinguerlo da uno caduto a meta'.
 */
import { pool, withTransaction } from "../../db/client.js";
import { NotFoundError, UnprocessableEntityError, ConflictError } from "../../errors/index.js";
import type { ActorContext } from "../../lib/actor.js";
import type { CorsaRicerca, PropostaRicerca, DecisionePropostaBody } from "@heuresys/shared";
import * as repo from "./repository.js";
import { risolviDominio, chiaviDominio, dominiDichiarati } from "./domains/index.js";
import { DominioSconosciutoError } from "./domain.js";
import { eseguiCorsa, type ProposalSource } from "./engine.js";
import { HttpWebReader, type WebReader } from "./web-reader.js";
import { esigiDomandeSenzaCliente, terminiRiservati, DomandaNominaIlClienteError } from "./guardia-domande.js";
import { sorgenteRegistrata } from "./sorgenti/index.js";

export interface DipendenzeCorsa {
  /** Chi propone. Iniettabile: i test ne passano una propria, la produzione usa quella vera. */
  sorgente?: ProposalSource;
  lettore?: WebReader;
}

export const researchService = {
  /** I domini che questa piattaforma sa cercare. Vivono in codice (E10). */
  domini() {
    return {
      items: dominiDichiarati().map((d) => ({
        chiave: d.chiave,
        etichetta: d.etichetta,
        minimoFonti: d.minimoFonti,
        fontiConfrontateColRegistro: d.fontiConfrontateColRegistro,
      })),
    };
  },

  /**
   * Avvia una ricerca per una versione di fascicolo e un dominio.
   *
   * Restituisce la corsa **conclusa**: la ricerca e' sincrona per costruzione, perche' cio'
   * che scrive e' una proposta e non un effetto — e una proposta che nessuno vede finche' un
   * lavoro di sfondo non finisce e' una proposta che nessuno controlla. Se in futuro le corse
   * diventassero lunghe, il posto dove spezzarle e' qui, non nel motore.
   */
  async avvia(
    a: ActorContext,
    versionId: string,
    dominioChiave: string,
    dip: DipendenzeCorsa = {},
  ): Promise<CorsaRicerca> {
    // ① il dominio esiste?
    let dominio;
    try {
      dominio = risolviDominio(dominioChiave);
    } catch (e) {
      if (e instanceof DominioSconosciutoError) {
        throw new UnprocessableEntityError(
          { dominio: dominioChiave, dichiarati: chiaviDominio() },
          e.message,
          "RESEARCH_DOMAIN_UNKNOWN",
        );
      }
      throw e;
    }

    // ② i sei parametri ci sono? Senza, la ricerca non e' mirata — e l'esito non lo
    //    rivelerebbe: ne uscirebbe un'azienda plausibile e generica.
    const { contesto, mancanti } = await repo.contestoDaVersione(pool, versionId);
    if (!contesto) {
      if (mancanti[0] === "versione") throw new NotFoundError("Versione di fascicolo non trovata");
      throw new UnprocessableEntityError(
        { mancanti },
        `La ricerca pretende sei parametri, e ne mancano ${mancanti.length}: ${mancanti.join(", ")}`,
        "RESEARCH_PARAMETERS_MISSING",
      );
    }

    // ③ §4.5 — le domande non devono nominare il cliente. Si controlla PRIMA di scrivere
    //    la corsa: una corsa registrata e poi rifiutata sarebbe un RUNNING mai partito.
    const domande = dominio.domande(contesto);
    const cliente = await repo.identitaClienteDaVersione(pool, versionId);
    try {
      esigiDomandeSenzaCliente(domande, terminiRiservati(cliente));
    } catch (e) {
      if (e instanceof DomandaNominaIlClienteError) {
        throw new UnprocessableEntityError({ violazioni: e.violazioni }, e.message, e.code);
      }
      throw e;
    }

    const sorgente = dip.sorgente ?? sorgenteRegistrata();
    const lettore = dip.lettore ?? new HttpWebReader();
    const tenantId = await repo.tenantDelFascicolo(pool, versionId);
    const [registro, chiaviGiaPresenti] = await Promise.all([
      repo.registroFonti(pool, dominio.chiave),
      repo.chiaviGiaPresenti(pool, versionId, dominio.chiave),
    ]);

    const progressivo = (await repo.contaCorse(pool, versionId, dominio.chiave)) + 1;
    const code = `RICERCA-${dominio.chiave.toUpperCase()}-${progressivo}-${versionId.slice(0, 8)}`;

    // ④ la corsa vera. Cio' che va storto qui non e' un guasto del sistema: e' un esito, e
    //    si registra come tale (corsa `FAILED` col motivo), non come un 500.
    const runId = await repo.creaCorsa(pool, {
      versionId,
      tenantId,
      code,
      domande,
      perimetro: registro.map((f) => ({ hostSuffix: f.hostSuffix, classe: f.classe, stato: f.stato })),
      metadata: { dominio: dominio.chiave, sorgente: sorgente.chiave, avviataDa: a.userId },
      createdBy: a.userId,
    });

    try {
      const esito = await eseguiCorsa({
        dominio,
        contesto,
        lettore,
        sorgente,
        registroFonti: registro,
        chiaviGiaPresenti,
      });

      // ⑤ la scrittura, tutta dentro una transazione: proposte, fonti ed esiti dei controlli
      //    sono la stessa cosa detta in tre tabelle. Meta' scritta sarebbe peggio di niente.
      await withTransaction(async (client) => {
        for (const p of esito.proposte) {
          const candidateId = await repo.scriviProposta(client, {
            runId,
            tenantId,
            dominio: dominio.chiave,
            chiaveNaturale: p.chiaveNaturale,
            contenuto: p.contenuto,
            stato: p.stato,
            metadata: { fonti: p.evidenze.map((e) => e.url) },
          });
          await repo.scriviEvidenze(client, candidateId, p.evidenze);
          await repo.scriviValidazioni(
            client,
            candidateId,
            p.controlli.map((c) => ({ regola: c.regola, esito: c.esito, ...(c.messaggio ? { messaggio: c.messaggio } : {}) })),
          );
        }
        await repo.chiudiCorsa(client, runId, "COMPLETED", {
          dominio: dominio.chiave,
          sorgente: esito.sorgente,
          pagineLette: esito.letture.length,
          pagineNegate: esito.letturenegate.length,
          letturenegate: esito.letturenegate,
        });
      });

      const conteggi = {
        proposteTotali: esito.proposte.length,
        propostePassate: esito.proposte.filter((p) => p.stato === "PASSED").length,
        proposteRespinte: esito.proposte.filter((p) => p.stato === "FAILED").length,
        proposteConAvviso: esito.proposte.filter((p) => p.stato === "WARNING").length,
      };
      const corsa = await repo.corsaPerId(pool, runId);
      return {
        runId,
        code,
        dominio: dominio.chiave,
        stato: "COMPLETED",
        domande,
        pagineLette: esito.letture.length,
        pagineNegate: esito.letturenegate.length,
        ...conteggi,
        iniziataIl: corsa?.iniziataIl ?? new Date().toISOString(),
        finitaIl: corsa?.finitaIl ?? null,
      };
    } catch (e) {
      // La corsa caduta resta nel registro col motivo: e' l'unico modo di sapere, dopo, che
      // era stata tentata. Cancellarla renderebbe indistinguibile «non e' mai partita» da
      // «e' andata male», e sono due cose diverse.
      const motivo = e instanceof Error ? e.message : String(e);
      await repo.chiudiCorsa(pool, runId, "FAILED", { errore: motivo });
      throw new ConflictError(`La ricerca non e' andata a buon fine: ${motivo}`, "RESEARCH_RUN_FAILED");
    }
  },

  /** Come `avvia`, ma partendo dal fascicolo e dal numero di versione che l'utente vede. */
  async avviaPerVersione(
    a: ActorContext,
    blueprintId: string,
    numero: number,
    dominioChiave: string,
    dip: DipendenzeCorsa = {},
  ): Promise<CorsaRicerca> {
    const versionId = await repo.versioneDaNumero(pool, blueprintId, numero);
    if (!versionId) throw new NotFoundError("Versione di fascicolo non trovata");
    return this.avvia(a, versionId, dominioChiave, dip);
  },

  /** Le proposte di una corsa: stato, controlli applicati, fonti, decisione. */
  async proposte(_a: ActorContext, runId: string): Promise<{ items: PropostaRicerca[]; total: number }> {
    const corsa = await repo.corsaPerId(pool, runId);
    if (!corsa) throw new NotFoundError("Corsa di acquisizione non trovata");
    const righe = await repo.propostePerCorsa(pool, runId);
    return {
      items: righe.map((r) => ({
        candidateId: r.candidateId,
        dominio: r.dominio,
        chiaveNaturale: r.chiaveNaturale,
        contenuto: r.contenuto,
        stato: r.stato as PropostaRicerca["stato"],
        controlli: r.controlli.map((c) => ({
          regola: c.regola,
          esito: c.esito as PropostaRicerca["controlli"][number]["esito"],
          messaggio: c.messaggio,
        })),
        evidenze: r.evidenze,
        decisione: r.decisione,
      })),
      total: righe.length,
    };
  },

  /**
   * La decisione del consulente, **con motivazione obbligatoria**.
   *
   * Una proposta gia' respinta dai controlli non si approva: significherebbe scavalcare a
   * mano una regola che ha detto no, e il posto per farlo non e' un bottone — e' cambiare la
   * regola, o la proposta.
   */
  async decidi(a: ActorContext, candidateId: string, body: DecisionePropostaBody): Promise<PropostaRicerca> {
    const p = await repo.propostaPerId(pool, candidateId);
    if (!p) throw new NotFoundError("Proposta non trovata");

    if (body.decisione === "APPROVED" && p.stato === "FAILED") {
      throw new ConflictError(
        "La proposta e' stata respinta dai controlli: non si approva a mano. Va corretta la proposta, o la regola che l'ha respinta.",
        "RESEARCH_CANDIDATE_FAILED_CHECKS",
      );
    }
    if (p.stato === "APPLIED") {
      throw new ConflictError("La proposta e' gia' stata applicata al modello", "RESEARCH_CANDIDATE_ALREADY_APPLIED");
    }

    await repo.registraDecisione(pool, {
      candidateId,
      decisione: body.decisione,
      motivazione: body.motivazione,
      approverId: a.userId,
    });

    const dopo = await repo.propostePerCorsa(pool, p.runId);
    const riga = dopo.find((x) => x.candidateId === candidateId);
    if (!riga) throw new NotFoundError("Proposta non trovata");
    return {
      candidateId: riga.candidateId,
      dominio: riga.dominio,
      chiaveNaturale: riga.chiaveNaturale,
      contenuto: riga.contenuto,
      stato: riga.stato as PropostaRicerca["stato"],
      controlli: riga.controlli.map((c) => ({
        regola: c.regola,
        esito: c.esito as PropostaRicerca["controlli"][number]["esito"],
        messaggio: c.messaggio,
      })),
      evidenze: riga.evidenze,
      decisione: riga.decisione,
    };
  },
};
