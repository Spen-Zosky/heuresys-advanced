# 214 — Adozione dell'agente sui perimetri in coda, in ordine di rischio crescente

> **item**: #214
> **stato**: IN CORSO

Seconda metà della dottrina di Enzo del 2026-08-16 — *«l'agente va su qualunque perimetro dove
porta valore aggiunto»*. **La domanda è l'ORDINE, non quale.** Per natura non si chiude in una
sessione: è una coda che si consuma, un perimetro per volta.

```bash
python docs/kb/tools/check_concetti_agente.py     # la coda, ri-derivata · --riservati
python docs/kb/tools/build_agent_operations.py    # rigenera la mappa dopo un'apertura
```

## Decisioni vincolanti

1. **Aprire un perimetro è una decisione di esposizione di dati, e la prende Enzo.** Il criterio
   meccanico **ordina** la coda; non fornisce la motivazione di prodotto. La prima apertura
   (`organization-units`) l'ha decisa Enzo con una ragione scritta e datata: l'organigramma è
   rubrica aziendale (`#193`). La seconda (`positions`) idem, il 2026-08-17.
2. **Il costo di un'apertura è una riga** in `agent-perimetri.json` — fonte unica, letta dal
   generatore **e** dallo strumento — con `decisione` + `data`, e senza le rifiuta: un'apertura
   senza autore non è verificabile.
3. **Un perimetro escluso lo è uno per uno, col motivo**: 12 esclusi come presidio/isolamento.
   «Senza pagina che lo mostri» **non è un divieto**: cambia quando la pagina nasce.

## Fasi

- [x] **F1 Primo perimetro: `organization-units`** — FATTO 2026-08-16 (`#193`) · decisione di Enzo con motivazione di prodotto scritta: l'organigramma è rubrica aziendale
- [x] **F2 Secondo perimetro: `positions`, e il buco del criterio** — FATTO 2026-08-17 · `d26c20fb` · sola lettura, 8 operazioni derivate; prova live `live-perimetro-positions.ts` con login reale e secondo fattore. **Il buco era più largo di come l'avevo descritto**: tre falle della stessa forma — *assenza di misura letta come assenza di rischio* — e la coda «neutra» è passata da **31 a 16**, con 14 dichiarati NON MISURABILI
- [x] **F3 Il terzo perimetro: `tenant-blueprints`** — **FATTO 2026-08-19** · decisione di Enzo con motivazione scritta in `agent-perimetri.json`: è il fascicolo di configurazione di un'azienda — struttura, non persone — e `RESOURCE_SENZA_DATI_DI_PERSONA` lo dichiara tale con parole proprie. Prova live `live-perimetro-tenant-blueprints.ts` · sola lettura
      ⚠ **Questa riga era rimasta da spuntare fino a S1077**, e il menu di sessione continuava a
      dire «riprendi da F3» per una fase già eseguita due giorni prima. Il disallineamento non si
      vedeva dal piano: si è visto solo interrogando `check_concetti_agente.py`, che legge la
      fonte unica. È il motivo per cui la coda si ri-deriva e non si ricorda.
- [x] **F3-bis Il quarto perimetro: `content`** — **FATTO 2026-08-21 (S1077)** · sola lettura · mappa rigenerata: **4 concetti aperti, 24 operazioni risolvibili** (erano 17: +7 per `content` — `get`, `get_by_id`, `get_by_id_media`, `get_by_id_versions`, `get_categories`, `get_media_by_mediaid`, `get_search`)
      Scelto col **criterio meccanico**, non a intuito: primo della coda dei neutri per ampiezza
      di lettura (**7 letture · 3 pagine**), dichiarato privo di dati di persona da
      `RESOURCE_SENZA_DATI_DI_PERSONA`. Rischio crescente rispettato — dopo l'organigramma
      (rubrica), le posizioni (posti) e il fascicolo di configurazione (struttura), il contenuto è
      l'oggetto più vicino a un documento e più lontano da una persona. I candidati più ampi non
      erano in gara: `analytics` e `dashboard` stanno fra i **riservati** dal 2026-08-19 (F5).
      Decisione registrata sotto il mandato in blocco di Enzo del 2026-08-21.
      ⏳ **La prova live NON è stata eseguita**, e va detto invece di lasciarlo intendere: pretende
      il gateway su `:8790` e l'API su `:3001` avviati, più una corsa dell'agente. È il **primo
      passo del prossimo giro**, sul modello di `live-perimetro-tenant-blueprints.ts`:
      `cd apps/agent-gateway && pnpm exec tsx scripts/live-perimetro-content.ts`.
      ▸ E quando si scriverà, conviene **parametrizzare invece di duplicare**: i due script
      esistenti sono quasi identici e differiscono per il concetto, quindi il terzo sarebbe il
      momento giusto per farne uno solo che prende il perimetro come argomento.
- [ ] **F4 I NON MISURABILI diventano misurabili** — budget ~50k · ▸ erano 14 quando la fase è nata, **oggi sono 11** (F5 ne ha resi misurabili 2, e il catalogo è cambiato). Il numero si ri-deriva, non si scrive qui
      Oggi si presentano come «non so», e prima della correzione si presentavano come «sicuro».
      Finché restano tali, quella parte della coda non è ordinabile.
- [x] **F5 Le classi di una resource multiclasse smettono di essere prosa** — FATTO 2026-08-19 · `RESOURCE_MULTICLASSE` passa da `Record<string,string>` (una frase) a `Record<string,{classi,perche}>` con le classi **enumerate e misurate sul database**, non trascritte dalla frase. Effetto sulla coda, misurato prima e dopo: **NON MISURABILI da 14 a 12**, riservati da 16 a 18 — `analytics` (`COMPENSATION, EVALUATION, PERSONAL, SKILL`) e `dashboard` (`ACTIVITY, PERSONAL, SKILL`) escono dal «non so» e cadono fra i riservati **per le classi che espongono davvero**. Aggiunte anche le 7 famiglie di `#142` (mig. `000326`), che senza una riga qui renderebbero rosso il cancello di `#99 F7`.
      🔬 **La misura ha smentito la prosa**: la frase su `analytics` nominava le «presenze», ma nessuna delle sue cinque voci dichiara `ACTIVITY`. Una descrizione che nessuno può contraddire invecchia senza che nessuno se ne accorga — ed è il motivo per cui questa fase esisteva.
      🔬 **Trovata e chiusa una cecità in attesa**: `check_concetti_agente.py` presidiava il caso «parser che non legge più nulla» per `RESOURCE_DATA_CLASS` e **per nessuna delle altre tre**. Cambiando forma, `MULTI` sarebbe tornato `{}` e ogni resource multiclasse sarebbe sparita in silenzio dalla classificazione. Ora la guardia c'è per `MULTI` e per `NO_PERSONE`.

## Stato misurato (2026-08-21, S1077 — ri-derivato, non ricordato)

**98 moduli** · **4 aperti** · **46 in coda** = 17 neutri + 11 NON MISURABILI + 18 riservati ·
12 esclusi come presidio/isolamento · 36 senza pagina che li mostri · 1 senza alcuna lettura.

*(la misura precedente, del 2026-08-17: 97 moduli · 2 aperti · 16+14+16 · 37 senza pagina —
tenuta come cronaca, non come stato: si ottiene con `check_concetti_agente.py`, che pretende
l'atlante fresco e si rifiuta di rispondere se non lo è.)*

## Cosa la prova live NON misura (dichiarato, non lasciato credere)

`hrx_positions_upsert`/`_delete` **esistono e sono montati** da prima dell'apertura, dietro
approvazione umana (`canUseTool` → HITL), e `write-gate.test.ts` lo misura: con `approve` finto a
`true` la scrittura **passa**. L'apertura di lettura non è ciò che le tiene chiuse.

## Chiuso quando

Non si chiude — **si misura**. Ogni sessione che apre un perimetro lo dichiara qui con data e
ragione.
