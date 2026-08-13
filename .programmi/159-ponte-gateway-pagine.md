# 159 — Il ponte gateway↔pagine web deve valere per le pagine future

> **item**: #159 · **priorità**: P2 · **stima register**: era «da stimare» → **ri-stimata qui**
> **stato**: NON AVVIATO
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

- [ ] **F1 — INDAGINE: cosa rende una scheda «idonea»** — è la parte nuova e non è definita da nessuna parte. Fatto = criterio scritto e **applicato all'elenco reale delle pagine**, che produce la lista delle idonee (e delle non idonee, col motivo). Dipendenza dichiarata: **#156** decide quale superficie l'agente sa leggere · budget ~150k
- [ ] **F2 — Il ponte** — un canale in streaming + un componente riusabile, scritto **fuori** da qualunque pagina (è il rischio nominato) · budget ~250k
- [ ] **F3 — Adozione su tutte le pagine idonee** — la prova che il ponte è riusabile è che la seconda pagina non lo tocca · budget ~250k
- [ ] **F4 — Dimostrazione live** — login reale, agente attivo su almeno due schede idonee di natura diversa · budget ~120k

## Da dove si riprende

**F1**, e prima ancora va guardato **#156** (WAIT-INPUT su Enzo: *quale superficie aprire per
prima all'agente*). Senza quella risposta il criterio di idoneità si può scrivere, ma non si
può dimostrare.
