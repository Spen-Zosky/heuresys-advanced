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
      ✅ **PROVA LIVE ESEGUITA il 2026-08-23 (S1078) — VERDE**, gateway `:8790` + API `:3001`,
      login reale con secondo fattore: `pnpm exec tsx scripts/live-perimetro.ts content`.
      La parametrizzazione era stata suggerita come economia; si è rivelata **la cura di un
      difetto**, e ha fatto emergerne tre.

### I tre difetti che la prova ha trovato (S1078)

**① La prova del TERZO perimetro non era mai potuta girare.** `live-perimetro-tenant-blueprints.ts`
era nato il 2026-08-19 copiando quello di `positions`, e in un punto il nome della variabile non
era stato rinominato: leggeva `opsPositions`, che in quel file non esisteva. Moriva con
`ERRORE: opsPositions is not defined` **prima del login**. Eppure il registro e questo piano lo
dichiaravano eseguito. Rifatto il 2026-08-23: **VERDE**.

**② Due criteri erano veri PER VUOTO, e stavano già nell'originale di `positions`** — quindi la
prova del secondo perimetro, che *è* girata, non misurava ciò che diceva:
- *«la mappa del perimetro non dichiara nessuna scrittura»* — il filtro iterava le chiavi di
  **radice** di `agent-operations.json` (`_fonti`, `_generato_da`, `concepts`) cercandovi il nome
  del perimetro. Nessuna lo contiene → sempre **zero operazioni** → «zero scritture» vero perché
  non aveva guardato niente. Proprio il criterio che il commento definiva *«quello che non
  dipende da cosa il modello ha tentato»*.
- *«nessuna lettura consentita su `users`»* — cercava `"concept":"users"` in un diario che quel
  campo **non aveva**. Sempre verde.

**③ Il diario del gate non sapeva dire SU COSA aveva deciso.** Gli strumenti parametrici si
chiamano tutti `hrx_entity_query`, e il concetto finiva dentro `argsHash`, cioè in un'impronta
illeggibile. Conseguenza: il criterio «almeno una lettura consentita sul perimetro» era
soddisfacibile **solo** dai perimetri con strumenti di dominio omonimi (`hrx_positions_list`
porta «positions» nel nome) e **impossibile** per tutti gli altri. Curato in `audit-sink.ts`:
il diario registra ora `concept` e `operation` — identificatori di risorsa, non dati, la stessa
classe del nome dello strumento che è sempre stato in chiaro. 5 test nuovi, sabotati: il campo
in più fa scattare anche le **due guardie preesistenti** sul «mai PII».

▸ **Conseguenza sui criteri**: distinguere `hrx_concept_describe` (elenco chiuso delle
operazioni — su un concetto non aperto è **vuoto**, `known:false`) da `hrx_entity_query` (le
righe). Il confine si misura sul secondo. E si è aggiunto il corno mancante: **almeno un
tentativo sulla sentinella dev'essere stato NEGATO**, o la domanda (3) è verde perché l'agente
non ha provato — successo davvero su `tenant-blueprints`, e l'ha detto il criterio, non un
ragionamento.

▸ **I quattro perimetri aperti, tutti riprovati coi criteri corretti** — `content` ·
`tenant-blueprints` · `positions` · `organization-units`: **4 VERDI**. I due script vecchi non
sono stati cancellati (divieto): sono diventati rimandi di poche righe a `live-perimetro.ts`.
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
