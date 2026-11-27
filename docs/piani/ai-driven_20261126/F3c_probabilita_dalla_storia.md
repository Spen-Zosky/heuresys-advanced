# F3c — Le probabilità stimate sulla storia del tenant (2026-11-26)

Voce F3c dell'onda 1 del piano [PIANO_heuresys-ai-driven_20261126.md](../PIANO_heuresys-ai-driven_20261126.md), in attuazione di [ADR-0063](../../architecture/adr/0063_heuresys_ai_driven_l_organizzazione_ghost.md) D5 (i numeri li calcola il codice, ogni stima porta la sua incertezza). Le stime entrano nel motore degli scenari di [F3a](F3a_motore_degli_scenari.md) come ipotesi di tipo STIMA, con la banda e la fonte STORIA; la famiglia di calcolo «nel tempo» (F3b-2) le prende così come sono.

Metro ADR-0063: asse 6, 7; criterio 4

## 1. Che cosa c'è

| file | che cosa fa |
|---|---|
| `apps/api/src/modules/insights/probabilita.ts` | gli stimatori puri, senza accesso al database: frequenze con la Beta di Jeffreys, probabilità su più trimestri, tempi con il quantile empirico e la banda bootstrap a seme fisso, intervallo predittivo Beta-binomiale e prova sul periodo tenuto da parte; `comeIpotesi` dà la forma di `ScenarioAssumption` |
| `apps/api/src/modules/insights/storia-repository.ts` | le letture della storia, filtrate sul tenant: persone in forza e uscite per trimestre, giorni di selezione, giorni di formazione e scadenze, coppie di valutazioni di prontezza, segno della storia generata |
| `apps/api/src/modules/insights/stime.ts` | compone le stime: uscita entro dodici mesi, mediana e 90° percentile dei giorni di selezione, mediana dei giorni di formazione, corso completato entro la scadenza, successore che sale di un gradino di prontezza |
| `apps/api/src/modules/insights/stime-cli.ts` | stampa le stime e la prova di un tenant, in sola lettura: `pnpm --filter @heuresys/api insights:stime -- RTL_BANK` |
| `apps/api/test/unit/probabilita.unit.test.ts` | le prove degli stimatori con i valori attesi da formule chiuse |
| `apps/api/test/insights-stime.integration.test.ts` | le stime sulla copia di RTL della CI: ogni ipotesi passa lo schema del motore, ha banda e fonte STORIA, dichiara la storia generata |

## 2. I metodi, e perché questi

- Una frequenza k su n (uscire in un trimestre, finire un corso entro la scadenza, salire di prontezza) si stima con la media a posteriori della Beta(k + 1/2, n − k + 1/2), la Beta di Jeffreys, e la banda è il suo intervallo centrale al 90%. Regge con pochi casi e con zero casi: con zero uscite la stima non è zero e la banda dice fin dove il tasso potrebbe arrivare.
- La probabilità su dodici mesi viene dal tasso trimestrale q con 1 − (1 − q)^4. La funzione è monotona, quindi gli estremi della banda si trasformano allo stesso modo.
- Un tempo si stima con il quantile empirico, e la banda con il bootstrap a percentili su 2000 ricampionamenti con un generatore a seme fisso: due corse sugli stessi dati danno gli stessi numeri, come vuole D5. Con meno di due casi la stima non si fa e la nota lo dice.
- La prova di F3c: il tasso si stima sui trimestri prima degli ultimi quattro, e le uscite vere degli ultimi quattro si confrontano con l'intervallo predittivo Beta-binomiale, che somma l'incertezza della stima e quella del caso. `provaUscite.dentro` dice se le uscite vere stanno nella banda.
- Ogni ipotesi porta due fonti STORIA: la pagina dei dati da cui nasce e questa nota. Se la storia del tenant è generata (la storia36 lascia `metadata ? 'storia36'` sulle requisizioni e sulle iniziative di formazione), la frase dell'ipotesi lo dichiara e `dettaglio.storiaGenerata` è vero.

La regola lineare del rischio di uscita (`flight-risk-v1` in `service.ts`) resta per la pagina degli insight, che mostra un punteggio da 0 a 100; nel motore degli scenari serve una probabilità con la sua banda, e quella la danno queste stime.

## 3. Che cosa dice oggi la storia di RTL

Misure in sola lettura sul database di produzione del 2026-11-26, da rifare con il comando della sezione 1 perché la storia avanza:

- uscite: nessuna nella storia (`sys_user_employment.user_employment_termination_date` sempre nulla, nessuna chiusura di assegnazione senza un'assegnazione nuova entro sette giorni). La stima esce con `senzaEventi` e la nota «la banda è un limite superiore, non un tasso osservato». Lo zero è un effetto della popolazione chiusa con cui la storia è stata generata, non un comportamento.
- selezione: le offerte accettate collegate alla loro requisizione danno i giorni dall'apertura all'ingresso.
- formazione: i corsi con iniziativa danno i giorni dall'inizio dell'iniziativa al primo attestato; i corsi del vecchio percorso, senza data, restano fuori.
- prontezza: nessun successore è mai passato alla posizione bersaglio, quindi la stima usa i passaggi fra valutazioni successive dello stesso candidato.

Decisione di Enzo del 2026-11-26 (scheda nel thread «Stimare le probabilità degli scenari»): alla storia di RTL si aggiungono ex dipendenti, usciti negli ultimi tre anni con tassi da banca e con le loro sostituzioni, senza toccare le persone attive. Quando ci saranno, la stima delle uscite e la prova sul periodo tenuto da parte diventano informative senza cambiare il codice.

## 4. Fuori da questa voce

- 25 corsi IN_PROGRESS di RTL hanno già un attestato di completamento: incoerenza della storia, da proporre alla custodia di storia36.
