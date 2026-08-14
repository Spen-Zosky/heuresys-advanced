# 159 — Il ponte gateway↔pagine web deve valere per le pagine future

> **item**: #159 · **priorità**: P2 · **stima register**: era «da stimare» → **ri-stimata qui**
> **stato**: IN CORSO
> **fonti**: `docs/kb/COWORK_INBOX.md` decisione **D3** (2026-08-07) · direzione di Enzo 2026-08-13

## Decisioni vincolanti (non si ri-chiedono)

- È un **vincolo dichiarato PRIMA di costruire**, non una correzione dopo. Il ponte non esiste
  ancora.
- (1) un solo canale in streaming e **un solo componente riusabile** — il ponte non sa nulla
  delle pagine; aggiungere una pagina = usare il componente, **zero lavoro sul ponte**.
- (2) il contesto di pagina («sto guardando l'unità X») è un **parametro libero**, mai un ramo
  condizionale per tipo di pagina.
- (3) i permessi restano automatici: li applica il server sulla sessione inoltrata.
- **Rischio nominato**: scrivere il primo prototipo DENTRO una pagina. Funziona subito e rende
  costosa ogni pagina successiva.
- **NON è automatico** che l'agente sappia rispondere sui dati nuovi: quello dipende da **#156**
  e dalla rigenerazione dell'atlante, **non** dal ponte. Sono due metà distinte e confonderle
  porta a promettere ciò che il ponte non dà.
- ✅ **Direzione di Enzo 2026-08-13 — il bersaglio è cresciuto**: l'assistente va in **TUTTE le
  schede che hanno i requisiti per eseguirlo**, non in una seconda pagina scelta a mano. La
  scelta della pagina-dimostrazione è **delegata a Claude**. La seconda pagina serve a
  **provare** la riusabilità, non è il traguardo.

## Ri-stima (era «da stimare»)

Il lavoro non è più «ponte + un secondo consumatore» ma **ponte + criterio di idoneità +
adozione su tutte le pagine idonee**. Stima: **~3-4 sessioni**, così ripartite.

## Fasi

- [x] **F1 — INDAGINE: cosa rende una scheda «idonea»** — **FATTA 2026-08-15 (S1061)**. Il criterio non è un testo: è `docs/kb/tools/check_idoneita_agente.py`, quattro prove meccaniche lette dal codice, ri-eseguibile. Esito su 115 pagine: **83 IDONEE** (16 parametriche + 67 d'insieme) · **32 no** — 25 non autenticate (`P1`), 7 di presidio (`P4`, elencate una per una col motivo), **`P2` a zero**. Dettaglio in §F1
  - 🔎 **IL REPERTO CHE CAMBIA F2: il ponte esiste già, e sta esattamente dove questo file temeva.** Le decisioni vincolanti dicevano *«il ponte non esiste ancora»* e nominavano il rischio *«scrivere il primo prototipo DENTRO una pagina»*. Misurato: **`apps/web/src/app/(authenticated)/dev/agent/page.tsx`, 300 righe**, che aprono il canale SSE verso il gateway, ne consumano lo stream, gestiscono l'approvazione umana e il rendering. **Il rischio non è da evitare: è già avvenuto.** F2 non è quindi «costruire da zero» ma **estrarre**, ed è un lavoro diverso — con un consumatore reale già in mano che serve da collaudo.
  - **le quattro prove**, in ordine: `P1` autenticata (fuori vetrina e login: senza sessione i permessi non si applicano) · `P2` interroga almeno un endpoint `/v1/*` **direttamente o tramite i componenti che importa** · `P3` il contesto è **un valore** (segmento dinamico o vista d'insieme), mai un ramo per tipo di pagina · `P4` non è superficie di servizio né a isolamento assoluto.
  - ⚠ **`P2` è nato con tre falsi negativi, ed è stato il correttivo a valere più del numero**: `/job-catalog` (37 righe), `/skill-taxonomy` (42) e `/me/career` risultavano «pagine mute» perché la chiamata sta nei loro pannelli. Cercare `/v1/` nel solo file della pagina **dichiara muta una pagina che parla per bocca d'altri** — e le pagine sottili sono la forma normale, non l'eccezione. Seguendo un livello di import (`@/…` e relativi `./…`), `P2` passa da 3 a **0**: nessuna pagina autenticata è senza dati.
  - ⚠ **il primo giro dava «0 pagine totali» e non protestava** — un falso verde perfetto, causato dall'esecuzione fuori dalla radice. Lo strumento ora **esce `NON MISURABILE`** invece di stampare zeri sereni.
  - **resta di F1 la sola dimostrazione**: quale delle 83 aprire per prima dipende da **#156** (WAIT-INPUT su Enzo). Il criterio non ne dipende — la lista è già prodotta.
- [ ] **F2 — Il ponte** — un canale in streaming + un componente riusabile, scritto **fuori** da qualunque pagina (è il rischio nominato) · budget ~250k
- [ ] **F3 — Adozione su tutte le pagine idonee** — la prova che il ponte è riusabile è che la seconda pagina non lo tocca · budget ~250k
- [ ] **F4 — Dimostrazione live** — login reale, agente attivo su almeno due schede idonee di natura diversa · budget ~120k

## Da dove si riprende

**F2 — il ponte**, e con un punto di partenza diverso da quello scritto in origine: non si
costruisce da zero, si **estrae** dalle 300 righe di `(authenticated)/dev/agent/page.tsx`, che
sono già un ponte funzionante nel posto sbagliato. Il criterio di idoneità è chiuso e
ri-eseguibile (`python docs/kb/tools/check_idoneita_agente.py` → 83 idonee su 115).

**#156** resta la dipendenza per la *dimostrazione*, non per il ponte: decide quale superficie
l'agente sa leggere, cioè su quale delle 83 la si mostra per prima.
