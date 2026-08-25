# 231 — Consumare i lavori attivi: la sequenza, e le tre voci che non erano eseguibili

> **item**: #231 (ciclo di esecuzione — mandato di Enzo S1080)
> **stato**: IN CORSO
> **aperto**: S1080 (2026-08-25)

## Il mandato

Enzo, S1080: *«consumiamo i lavori attivi nell'elenco: decidi tu priorità e sequenze»*. Batch
delegato: decido ordine, eseguo end-to-end, committo a ogni voce chiusa, non chiedo fra una e
l'altra.

## Prima di decidere la sequenza: cosa è davvero eseguibile

Il menu dichiarava **14 voci ACTIVE**. Verificate una per una le **precondizioni** della prossima
fase (R24 §3), tre non sono eseguibili oggi, e due non sono lavoro.

### ⛔ Tre voci ferme su una tua approvazione — una sola, e sono in fila indiana

- **`#132`** [7/8] — la sua unica fase residua, `F7`, è marcata **`blocked-on-Enzo`** nel piano
  stesso: *«nel registro non c'è ancora nessuna fonte approvata»*. E l'approvazione è tua per **tua
  richiesta esplicita** del 2026-08-05: *«l'elenco delle fonti ammesse non lo scrive nessuno a
  mano: nasce da una ricerca e lo approva Enzo»*. Il codice la rende meccanica — una fonte
  `APPROVED` senza approvatore, data e motivazione è impossibile per vincolo.
- **`#198`** [9/10] — `T9b` dipende da `#132`: *«rifarla DOPO `#132`, quando il modello sarà
  generato dalla ricerca»*. **Misurato, non dedotto dalla spunta di F6**: le quattro tabelle del
  contenuto sono **vuote** (`sys_blueprint_content_{units,positions,skills,kpis}` → 0 righe). Senza
  modello la costruzione si rifiuta con `BLUEPRINT_CONTENT_EMPTY` invece di costruire.
- **`#205`** — `GATED` su `#132`, dichiarato.

**Cosa aspetta esattamente**: la corsa di `F4h` ha già lasciato **una proposta `PASSED`** —
`bancaditalia.it`, istituzionale, con due evidenze e le loro impronte. Serve deciderla con una
motivazione e applicarla. Da lì i cinque domini diventano ricercabili e **la fila di tre voci si
muove**: `#132` chiude, `#198` può rifare la prova, `#205` si sblocca. Sono **~6-8 sessioni di
lavoro ferme su una decisione di pochi minuti** — nominato qui una volta sola, non entra in «cosa
resta».

### Due voci non sono lavoro: sono regole permanenti

- **`#79`** `F3` — *«il prossimo lavoro che popola tabelle»*
- **`#149`** `F4` — *«la prossima consegna che arriva»*

Non hanno un comando da eseguire oggi: sono cancelli che scattano **dentro** altro lavoro. Metterle
in coda a un consumo sarebbe fingere di poterle chiudere. Restano `ACTIVE` a ragione, e si
consumano da sé quando il lavoro che le innesca passa.

## Fasi — la sequenza decisa

Criterio, in quest'ordine: **(a)** chiude una voce intera · **(b)** costo crescente · **(c)**
rischio crescente. La prima parte per prima perché è **quasi tutta attesa** e gira mentre lavoro
sulle altre.

- [ ] **S1 `#219` F5 — la corsa integrale E2E, 0 falliti** — budget ~20k, in gran parte attesa. Comando: `cd apps/web && pnpm test:e2e:prod:node22` (Node ≥23 → il wrapper è obbligatorio, D-36). Chiude `#219`, e con essa il criterio di `#211` per portare la suite in CI. **Guardia**: un verde che nasce da casi *non eseguiti* non è un verde — questa suite ha già mentito due volte così (263 DID NOT RUN letti come verdi; «4/4 fasi» che contava le fasi e non i casi). Si legge il conteggio dei **casi**, non delle fasi
- [x] **S2 `#148` — il rendiconto delle chiusure** — FATTO 2026-08-25 · voce **CHIUSA** 3/3, commit `3217b3ec`. Decisione registrata: **non si riscrive** in quattro verbi — il rilascio pesa 232 passi contro i 74 dei tre verbi che lo escluderebbero. Due reperti fuori scope nominati una volta sola (60 `apertura` contro 2 `chiusura`; 127 corse su 169 con un solo passo)
- [ ] **S3 `#169` — i due segreti che nascono dalla stessa chiave** — **in corso, e la direttiva di Enzo del 2026-08-25 l'ha riaperta in grande**: F1 FATTA (censimento, 10 punti derivano il segreto — 7 su 10 hanno bisogno solo di *entrare*), F2 **progettata** dopo la direttiva «utenze di collaudo con permessi propri e autonomi». Il progetto è nel piano `#169`: tre identità `SERVICE`, mandati veri e non ruoli-ombra, chiave separata, esenzione dal secondo fattore col meccanismo già esistente. ⛔ **l'applicazione aspetta la fine di S1**: creare utenze in produzione mentre la suite integrale gira altererebbe ciò che sta misurando
- [ ] **S4 `#214` F6 — un perimetro dell'agente** — consumabile a pezzi. ⚠ l'ordine **non si ricopia dal piano**: si ri-deriva con `check_concetti_agente.py`, perché una pagina nuova sposta un modulo in coda
- [ ] **S5 `#227` F1 — censire le 4.464 competenze isolate, per specie** — la voce che Enzo ha nominato in apertura

## Confine di sessione, dichiarato adesso

**Non entrano in questa sessione** e non sono in «cosa resta»: `#143` (modello dati squadre, ~4-6
sessioni) · `#159` (il ponte gateway↔pagine, ~3-4) · `#54` (recruiting/ATS, ~5-7) · `#50` F2 (il
grafo delle competenze, ~200k) · le fasi 2-5 di `#227`. Sono lavori da sessioni dedicate: dirlo
adesso è più onesto che scoprirlo a metà.
