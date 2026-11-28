/**
 * I testi della guida del Backstage, in italiano e in inglese (ADR-0063 D2, D4). Una pagina è
 * interamente nella lingua scelta: la guida ha le sue due versioni complete, non una traduzione a
 * frammenti. Le infografiche sono sorgenti mermaid, disegnate da `guida.tsx`.
 */

export type ParteGuida = { tipo: "md"; testo: string } | { tipo: "mermaid"; testo: string; didascalia: string };

const MAPPA_IT = `flowchart LR
  subgraph REALE["Organizzazione reale del tenant"]
    direction TB
    R0["Vertice<br/>Direttore Generale"] --> R1["Direzioni e divisioni<br/>con i loro responsabili"] --> R2["Unità operative<br/>persone e posizioni"]
  end
  subgraph BACK["Backstage: l'organizzazione ghost"]
    direction TB
    G0["Capo del vertice"] --> G1["Capi di divisione<br/>e di direzione"] --> G2["Squadre di specialisti<br/>persone, competenze, carriere,<br/>talenti, formazione, KPI, valutazioni"]
  end
  R0 -. "affianca" .-> G0
  R1 -. "affianca" .-> G1
  subgraph CICLO["Ciclo di allineamento"]
    direction TB
    DER{{"Deriva<br/>l'albero vivo è cambiato?"}} -- "sì" --> RIF[["Riforma<br/>chiude i periodi superati<br/>e apre i nuovi"]] --> STO[("Storia dei periodi")]
  end
  REALE ==> CICLO
  RIF ==> BACK
  subgraph USO["Lavoro con le persone"]
    direction TB
    P(("Persona collegata<br/>con i suoi permessi")) -- "conferma" --> W["Scrittura sui dati"]
  end
  G2 -- "prepara, legge, segnala" --> P
  classDef reale fill:#f4f4f5,stroke:#52525b,color:#18181b
  classDef ghost fill:#e4e4e7,stroke:#18181b,color:#18181b,stroke-width:2px
  classDef passo fill:#ffffff,stroke:#71717a,color:#18181b,stroke-dasharray:4 3
  classDef persona fill:#27272a,stroke:#18181b,color:#ffffff
  class R0,R1,R2 reale
  class G0,G1,G2 ghost
  class DER,RIF,STO passo
  class P,W persona
  style REALE fill:#fafafa,stroke:#a1a1aa,color:#18181b
  style BACK fill:#f4f4f5,stroke:#27272a,color:#18181b,stroke-width:2px
  style CICLO fill:#ffffff,stroke:#a1a1aa,color:#18181b,stroke-dasharray:4 3
  style USO fill:#ffffff,stroke:#a1a1aa,color:#18181b`;

const MAPPA_EN = `flowchart LR
  subgraph REALE["The tenant's real organisation"]
    direction TB
    R0["Apex<br/>General Manager"] --> R1["Departments and divisions<br/>with their heads"] --> R2["Operating units<br/>people and positions"]
  end
  subgraph BACK["Backstage: the ghost organisation"]
    direction TB
    G0["Apex Head"] --> G1["Division and<br/>department Heads"] --> G2["Specialist teams<br/>people, skills, careers,<br/>talent, learning, KPIs, reviews"]
  end
  R0 -. "works alongside" .-> G0
  R1 -. "works alongside" .-> G1
  subgraph CICLO["Alignment cycle"]
    direction TB
    DER{{"Drift<br/>has the live tree changed?"}} -- "yes" --> RIF[["Reform<br/>closes outdated periods<br/>and opens new ones"]] --> STO[("History of periods")]
  end
  REALE ==> CICLO
  RIF ==> BACK
  subgraph USO["Working with people"]
    direction TB
    P(("Signed-in person<br/>with their permissions")) -- "confirms" --> W["Write to the data"]
  end
  G2 -- "prepares, reads, flags" --> P
  classDef reale fill:#f4f4f5,stroke:#52525b,color:#18181b
  classDef ghost fill:#e4e4e7,stroke:#18181b,color:#18181b,stroke-width:2px
  classDef passo fill:#ffffff,stroke:#71717a,color:#18181b,stroke-dasharray:4 3
  classDef persona fill:#27272a,stroke:#18181b,color:#ffffff
  class R0,R1,R2 reale
  class G0,G1,G2 ghost
  class DER,RIF,STO passo
  class P,W persona
  style REALE fill:#fafafa,stroke:#a1a1aa,color:#18181b
  style BACK fill:#f4f4f5,stroke:#27272a,color:#18181b,stroke-width:2px
  style CICLO fill:#ffffff,stroke:#a1a1aa,color:#18181b,stroke-dasharray:4 3
  style USO fill:#ffffff,stroke:#a1a1aa,color:#18181b`;

const CICLO_IT = `stateDiagram-v2
  direction LR
  [*] --> Aperto: formazione o unità nuova
  Aperto --> Aperto: albero invariato
  Aperto --> Chiuso_modificata: cambia nome, codice, tipo, livello o unità sopra
  Aperto --> Chiuso_uscita: unità disattivata, scaduta o sotto il secondo livello
  Chiuso_modificata --> [*]
  Chiuso_uscita --> [*]
  Chiuso_modificata: Chiuso (modificata)<br/>si apre subito il periodo nuovo
  Chiuso_uscita: Chiuso (uscita)
  Aperto: Periodo aperto<br/>in vigore
  classDef aperto fill:#e4e4e7,stroke:#18181b,color:#18181b,stroke-width:2px
  classDef chiuso fill:#fafafa,stroke:#71717a,color:#18181b
  class Aperto aperto
  class Chiuso_modificata,Chiuso_uscita chiuso`;

const CICLO_EN = `stateDiagram-v2
  direction LR
  [*] --> Open: formation or new unit
  Open --> Open: tree unchanged
  Open --> Closed_changed: name, code, type, level or parent unit changes
  Open --> Closed_left: unit deactivated, expired or below the second level
  Closed_changed --> [*]
  Closed_left --> [*]
  Closed_changed: Closed (changed)<br/>the new period opens at once
  Closed_left: Closed (left)
  Open: Open period<br/>in force
  classDef aperto fill:#e4e4e7,stroke:#18181b,color:#18181b,stroke-width:2px
  classDef chiuso fill:#fafafa,stroke:#71717a,color:#18181b
  class Open aperto
  class Closed_changed,Closed_left chiuso`;

export const GUIDA_BACKSTAGE: Record<"it" | "en", { parti: ParteGuida[] }> = {
  it: {
    parti: [
      {
        tipo: "md",
        testo: `## A che cosa serve

Il **Backstage** è l'organizzazione che lavora dietro le quinte di quella reale. Per il vertice e per ogni divisione e direzione del tenant esiste un'unità del Backstage, e ognuna avrà un **Capo agente** con la sua squadra di specialisti. Il Capo affianca il responsabile reale dell'unità: legge i dati con i permessi della persona che serve, prepara analisi e scenari what-if, segnala ciò che merita attenzione.

Il Backstage non è un secondo organigramma da mantenere a mano. **Si ricava dall'albero vivo delle unità**: il vertice e i due livelli sotto di lui. Quando l'organizzazione reale cambia, il Backstage lo vede e si riallinea; ogni forma che ha avuto resta nella storia.

> Gli agenti preparano, leggono e segnalano. **Nessuna scrittura sui dati parte senza la conferma della persona collegata** che la chiede, e nel limite dei suoi permessi.`,
      },
      {
        tipo: "mermaid",
        testo: MAPPA_IT,
        didascalia: "Come il Backstage affianca l'organizzazione reale, e come resta allineato all'albero vivo",
      },
      {
        tipo: "md",
        testo: `## Perché serve

- **Un interlocutore per ogni area.** Ogni divisione e direzione ha un Capo che conosce il suo perimetro: le persone, le posizioni, i KPI, i processi. Le domande trovano chi sa rispondere.
- **Sempre coerente con la struttura vera.** Il Backstage non inventa unità: se una direzione cambia nome o una divisione si chiude, la deriva lo mostra e la riforma riallinea.
- **Tracciabile nel tempo.** La storia dice quale forma aveva il Backstage in ogni giorno, e perché è cambiata: utile per capire a quale Capo apparteneva un lavoro fatto mesi fa.
- **Sicuro per costruzione.** Un Capo legge sempre con il perimetro della persona che serve: se lei non vede un dato, non lo vede neanche il Capo.

## Come si usa

1. **Albero.** L'organigramma del Backstage, dal vertice in giù, con le persone di ogni unità reale e il responsabile in grassetto. Si apre adattato all'area; la rotella e i pulsanti **+** e **−** ingrandiscono e riducono, il trascinamento sposta, il **doppio clic su un'area vuota** torna alla vista adattata. Un **doppio clic su un riquadro** apre la scheda dell'unità.
2. **Elenco.** Le unità del Backstage in tabella: tipo, livello, unità sopra, responsabile, persone, data di inizio e stato. Il nome apre la scheda.
3. **Storia.** Tutti i periodi, dal più recente: quando ognuno è iniziato, quando è finito e per quale motivo.
4. **Deriva.** Le differenze fra il Backstage e l'albero vivo di oggi, voce per voce: unità nuove, uscite o modificate, con il valore prima e dopo. Le unità in deriva sono evidenziate anche nell'albero.

### La scheda di un'unità

La scheda dice chi affianca il Capo, il tipo e il livello, l'unità reale, il responsabile, le persone e le posizioni dell'unità, le unità sotto e la storia dei suoi periodi. Ogni nome è cliccabile e apre la sua scheda **sopra la precedente**: il filo in alto riporta a qualunque passo, **Esc** chiude solo l'ultima scheda. Le finestre si ridimensionano dall'angolo in basso a destra.

### Aggiorna e riforma

- **Aggiorna** rilegge tutto dal vivo: Backstage, storia, deriva e organigramma.
- **Riforma**, nella scheda Deriva, riallinea il Backstage all'albero vivo. Compare solo a chi può aggiornare l'organigramma e parte solo dopo la conferma. Se l'albero non è cambiato non scrive niente.`,
      },
      {
        tipo: "mermaid",
        testo: CICLO_IT,
        didascalia: "Il ciclo di vita di un periodo nella storia del Backstage",
      },
      {
        tipo: "md",
        testo: `## Le parole del Backstage

| Termine | Che cosa vuol dire |
|---|---|
| Vertice | L'unità in cima all'albero, guidata dal Direttore Generale |
| Divisione | Un'unità reale di tipo divisione, entro il secondo livello sotto il vertice |
| Direzione | Ogni altra unità entro il secondo livello, Direzione generale compresa |
| Capo agente | L'agente che affianca il responsabile di un'unità del Backstage |
| Periodo | Un tratto di tempo in cui un'unità del Backstage ha avuto la stessa forma |
| Deriva | La differenza fra il Backstage e l'albero vivo di oggi |
| Riforma | Il riallineamento: chiude i periodi superati e apre i nuovi |

## Chi vede che cosa

Vede il Backstage chi può leggere l'organigramma del tenant; lo riforma chi può aggiornarlo. Un mandato di piattaforma sceglie il cliente dalla casella in alto. I nomi dei responsabili sono gli stessi che l'organigramma già mostra.`,
      },
    ],
  },
  en: {
    parti: [
      {
        tipo: "md",
        testo: `## What it is for

**Backstage** is the organisation working behind the scenes of the real one. The apex and every division and department of the tenant have a Backstage unit, and each will have an **agent Head** with its own team of specialists. The Head works alongside the unit's real head: it reads data with the permissions of the person it serves, prepares analyses and what-if scenarios, and flags what deserves attention.

Backstage is not a second org chart to maintain by hand. **It is derived from the live tree of units**: the apex and the two levels below it. When the real organisation changes, Backstage notices and realigns; every shape it has had stays in the history.

> Agents prepare, read and flag. **No write to the data starts without the confirmation of the signed-in person** who asks for it, and within their permissions.`,
      },
      {
        tipo: "mermaid",
        testo: MAPPA_EN,
        didascalia: "How Backstage works alongside the real organisation, and how it stays aligned with the live tree",
      },
      {
        tipo: "md",
        testo: `## Why it matters

- **One counterpart for every area.** Each division and department has a Head that knows its scope: people, positions, KPIs, processes. Questions find someone who can answer.
- **Always consistent with the real structure.** Backstage does not invent units: if a department is renamed or a division closes, the drift shows it and the reform realigns.
- **Traceable over time.** The history tells which shape Backstage had on any day, and why it changed: useful to see which Head owned a piece of work months ago.
- **Safe by design.** A Head always reads with the scope of the person it serves: if they cannot see a piece of data, neither can the Head.

## How to use it

1. **Tree.** The Backstage org chart, from the apex down, with the people of each real unit and the head in bold. It opens fitted to the area; the mouse wheel and the **+** and **−** buttons zoom in and out, dragging pans, a **double click on an empty area** returns to the fitted view. A **double click on a box** opens the unit's card.
2. **List.** The Backstage units in a table: type, level, parent unit, head, people, start date and status. The name opens the card.
3. **History.** Every period, most recent first: when each began, when it ended and why.
4. **Drift.** The differences between Backstage and today's live tree, item by item: new, departed or changed units, with the value before and after. Drifting units are also highlighted in the tree.

### A unit's card

The card says whom the Head works alongside, the type and level, the real unit, the head, the unit's people and positions, the units below and the history of its periods. Every name is clickable and opens its card **on top of the previous one**: the trail at the top goes back to any step, **Esc** closes only the last card. Windows resize from the bottom-right corner.

### Refresh and reform

- **Refresh** rereads everything live: Backstage, history, drift and org chart.
- **Reform**, in the Drift tab, realigns Backstage with the live tree. Only people who can update the org chart see it, and it starts only after confirmation. If the tree has not changed it writes nothing.`,
      },
      {
        tipo: "mermaid",
        testo: CICLO_EN,
        didascalia: "The life cycle of a period in the Backstage history",
      },
      {
        tipo: "md",
        testo: `## Backstage vocabulary

| Term | What it means |
|---|---|
| Apex | The unit at the top of the tree, led by the General Manager |
| Division | A real unit of type division, within the second level below the apex |
| Department | Any other unit within the second level, General Management included |
| Agent Head | The agent working alongside the head of a Backstage unit |
| Period | A span of time in which a Backstage unit kept the same shape |
| Drift | The difference between Backstage and today's live tree |
| Reform | The realignment: closes outdated periods and opens new ones |

## Who sees what

Anyone who can read the tenant's org chart sees Backstage; anyone who can update it can reform it. A platform mandate picks the client from the box at the top. The heads' names are the same the org chart already shows.`,
      },
    ],
  },
};
