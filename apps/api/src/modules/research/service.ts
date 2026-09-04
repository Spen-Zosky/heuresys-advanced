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
import type {
  CorsaRicerca,
  PropostaRicerca,
  DecisionePropostaBody,
  ApplicaRicercaResponse,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { risolviDominio, chiaviDominio, dominiDichiarati } from "./domains/index.js";
import { DominioSconosciutoError } from "./domain.js";
import { eseguiCorsa, type ProposalSource } from "./engine.js";
import { HttpWebReader, type WebReader } from "./web-reader.js";
import {
  esigiDomandeSenzaCliente,
  terminiRiservati,
  DomandaNominaIlClienteError,
  esigiDominiDiFonteDichiarati,
  FonteConDominioIgnotoError,
} from "./guardia-domande.js";
import { sorgenteRegistrata } from "./sorgenti/index.js";
import { traduciProposte, conta } from "./ponte.js";

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
    // #239 — le parole che classificano un'azienda non la identificano: si sottraggono dai
    // termini riservati, o un cliente che porta nel nome il proprio settore non e'
    // ricercabile. Lette dalle tabelle della tassonomia, mai da un elenco scritto a mano.
    const vocabolario = await repo.vocabolarioDiDominio(pool);
    try {
      esigiDomandeSenzaCliente(domande, terminiRiservati(cliente, vocabolario));
    } catch (e) {
      if (e instanceof DomandaNominaIlClienteError) {
        throw new UnprocessableEntityError({ violazioni: e.violazioni }, e.message, e.code);
      }
      throw e;
    }

    // ④ le fonti: un dominio che confronta col registro e non ha nemmeno una fonte approvata
    //    NON e' ricercabile. Lo si dice adesso — «zero fonti approvate» e' un'informazione
    //    utile, e l'epica la vuole esplicita (§4.3: saperlo subito vale piu' che scoprirlo fra
    //    tre mesi) — invece di avviare una corsa che respingera' ogni proposta una per una.
    if (dominio.fontiConfrontateColRegistro) {
      const approvate = await repo.contaFontiApprovate(pool, dominio.chiave);
      if (approvate === 0) {
        throw new UnprocessableEntityError(
          { dominio: dominio.chiave },
          `Il dominio "${dominio.chiave}" confronta le fonti col registro, e per lui non ce n'e' nemmeno una approvata. Prima si approvano delle fonti (dominio "research_sources"), poi lo si puo' cercare.`,
          "RESEARCH_NO_APPROVED_SOURCES",
        );
      }
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

  /**
   * IL PONTE (#132 F6) — le proposte approvate diventano il contenuto del modello.
   *
   * ⚠ IL MODELLO DEV'ESSERE GIA' ANCORATO, e non e' una limitazione: ancorare una versione di
   * variante a un fascicolo scrive un **campo bloccante** (`D-85`), e i campi bloccanti non li
   * cambia la ricerca — li cambia il proprietario della piattaforma. Il ponte riempie il
   * modello che il consulente ha scelto; scegliere resta un atto suo.
   *
   * ⚠ O TUTTO O NIENTE. Se anche una sola proposta non e' traducibile — un tipo di unita' che
   * il catalogo non conosce, una posizione che siede in un'unita' che nessuno ha proposto — non
   * si applica **niente**. Un modello a meta' e' peggio di nessun modello: passerebbe il
   * cancello e si romperebbe alla costruzione, dove attribuire il difetto e' difficile.
   * Gli **avvisi** invece non fermano: sono cose da guardare, non da impedire.
   */
  async applicaRicerca(
    // L'attore e' gia' verificato dal permesso della rotta; qui non decide niente, e dirlo
    // col nome vale piu' di un commento.
    _a: ActorContext,
    blueprintId: string,
    numero: number,
  ): Promise<ApplicaRicercaResponse> {
    const versionId = await repo.versioneDaNumero(pool, blueprintId, numero);
    if (!versionId) throw new NotFoundError("Versione di fascicolo non trovata");

    const proposte = await repo.propostePerApplicazione(pool, versionId);
    if (proposte.length === 0) {
      throw new ConflictError(
        "Nessuna proposta approvata da applicare: prima si decide, poi si applica.",
        "RESEARCH_NOTHING_APPROVED",
      );
    }

    const cataloghi = await repo.cataloghiVeri(pool);
    const esito = traduciProposte(proposte, cataloghi);

    // ⚠ IL MODELLO ANCORATO SERVE SOLO SE C'E' CONTENUTO DI MODELLO DA SCRIVERE. Le proposte
    // di fonti hanno un'altra destinazione — il registro — e pretendere un modello per
    // scriverle bloccherebbe la PRIMA ondata, che e' proprio quella che il modello non ce
    // l'ha ancora. Ancorare resta un atto del consulente: scrive un campo bloccante (`D-85`),
    // e i campi bloccanti non li cambia la ricerca.
    const conMod = conta(esito.contenuto);
    const contenutoDiModello = conMod.units + conMod.positions + conMod.skills + conMod.kpis + conMod.processes;
    const variante = contenutoDiModello > 0 ? await repo.varianteAncorata(pool, versionId) : null;
    if (contenutoDiModello > 0 && !variante) {
      throw new ConflictError(
        "Il fascicolo non ha un modello ancorato: la ricerca riempie il modello che il consulente ha scelto, non lo sceglie al posto suo.",
        "BLUEPRINT_MODEL_NOT_PINNED",
      );
    }

    const bloccanti = esito.respinte.filter((r) => r.controllo.esito === "FAILED");
    if (bloccanti.length > 0) {
      throw new UnprocessableEntityError(
        {
          bloccanti: bloccanti.map((r) => ({
            chiave: r.chiaveNaturale,
            regola: r.controllo.regola,
            messaggio: r.controllo.messaggio ?? "",
          })),
        },
        `${bloccanti.length} proposta/e approvata/e non e' applicabile al modello: non si applica un modello a meta'.`,
        "RESEARCH_CONTENT_NOT_APPLICABLE",
      );
    }

    // #245 — IL DOMINIO DI UNA FONTE DEVE ESISTERE. Fino a S1086 questa colonna era testo
    // libero, e ci e' finito dentro `64.19` — un codice ATECO, cioe' un SETTORE — al posto
    // della chiave di un dominio ricercabile. La lettura filtra su quella colonna, quindi la
    // SOLA fonte approvata del sistema e' rimasta invisibile a ogni corsa per dieci giorni, e
    // tre voci del menu sono state ferme con la diagnosi sbagliata.
    //
    // L'incoerenza che questo chiude: l'AVVIO di una corsa il controllo ce l'ha gia'
    // (`RESEARCH_DOMAIN_UNKNOWN`), la REGISTRAZIONE di una fonte no. Stesso concetto,
    // validato in un punto solo.
    try {
      esigiDominiDiFonteDichiarati(esito.contenuto.sources, chiaviDominio());
    } catch (e) {
      if (e instanceof FonteConDominioIgnotoError) {
        throw new UnprocessableEntityError(
          { fonti: e.fonti, dichiarati: e.dichiarati },
          e.message,
          e.code,
        );
      }
      throw e;
    }

    let applicate = 0;
    await withTransaction(async (client) => {
      if (variante) await repo.sostituisciContenuto(client, variante, esito.contenuto);
      if (esito.contenuto.sources.length > 0) await repo.scriviFontiApprovate(client, esito.contenuto.sources);
      applicate = await repo.marcaApplicate(client, esito.applicate);
    });

    const dopo = variante
      ? await repo.contenutoEsistente(pool, variante)
      : { units: 0, positions: 0, skills: 0, kpis: 0, processes: 0 };
    return {
      variantVersionId: variante,
      proposteApplicate: applicate,
      fontiRegistrate: esito.contenuto.sources.length,
      contenuto: dopo,
      avvisi: esito.respinte
        .filter((r) => r.controllo.esito === "WARNING")
        .map((r) => ({ chiave: r.chiaveNaturale, regola: r.controllo.regola, messaggio: r.controllo.messaggio ?? "" })),
    };
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
