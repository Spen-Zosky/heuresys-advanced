# STATE — vista rapida

> Priorità e domande aperte. I numeri stanno in `docs/kb/SOT_STATE.md`, l'altra metà.

## Last session brief — l'ultima sessione, in breve

**S1080 — il vassoio «aspetta te» passa da sei voci a una, e lo strumento che decide quando
chiudere ha mentito tre volte in un'ora.** Chiusa `#148`; ritirate `#85` `#16`; parcheggiate
`#8` `#52` `#4` `#39`; `#169` riaperta in grande da una direttiva di Enzo.

Il filo della sessione: **le voci non erano false quando furono scritte — sono invecchiate, e
la corsia non aveva modo di dirlo.** Verificate una per una, tre su quattro non aspettavano
nulla: una aveva la risposta già scritta nel CLAUDE.md, una chiedeva una credenziale che
Microsoft non emette più da aprile, una era già stata esclusa altrove.

Poi la direttiva di Enzo — *«utenze di collaudo con permessi propri e autonomi»* — che ha
riaperto `#169` con un progetto vero, e che a fine giornata si è rivelata la chiave di un'altra
voce: **la suite E2E non riesce più a entrare**, e la causa è un'utenza sparita dall'anagrafica.

**La lezione più cara**: ho scritto **due prove che non provavano niente**, e sarebbero rimaste
verdi togliendo il codice che dovevano verificare. Le ho scoperte solo sabotandole. «Le prove
devono poter fallire» non è un principio da citare: è una verifica da eseguire, ogni volta.

## Top priorities — le priorità

1. **`#169` — le utenze di collaudo, e sono la chiave di due voci.** Direttiva di Enzo:
   verifiche del progetto (frontend compreso) senza impersonare le persone reali. `F1` fatta,
   `F2` progettata; il modello è già pronto per il 90% (tipo `SERVICE`, esenzione MFA solo per
   quel tipo, censimento che esclude i `SERVICE`). Manca costruirle.
   → `.programmi/169-due-segreti-dalla-stessa-chiave.md` · ~1 sessione
2. **`#219` F5 — NON è chiudibile prima di `#169`, e ora si sa perché.** La corsa integrale
   lanciata in S1080 ha dato `expected 0 · unexpected 6 · skipped 84`: i sei rossi sono **tutti
   e soli i setup di autenticazione**, gli 84 sono saltati perché ne dipendono. Rilanciarla
   oggi rifarebbe 44 minuti per riottenere gli stessi rossi.
   → `.programmi/219-otto-guasti-suite-e2e.md` · dopo `#169` F3
3. **`#227` — le 4.464 competenze isolate**, il 31,8% del catalogo. Invariata da S1079: cinque
   fasi, la prima è un censimento **per specie** (un elenco piatto di 4.464 righe non è un piano).
   → `.programmi/227-competenze-isolate-nel-grafo.md` · ~2-3 sessioni

## Open questions — le domande aperte

1. **Una fila di tre voci è ferma su una tua approvazione di pochi minuti**: `#132` `F7` è
   `blocked-on-Enzo` per l'approvazione della prima fonte — la corsa ha già lasciato una
   proposta *PASSED* (`bancaditalia.it`, con due evidenze). Approvandola: `#132` chiude, `#198`
   può rifare la prova, `#205` si sblocca. Sono ~6-8 sessioni di lavoro dietro quella firma.
2. **`#86` — l'ultima voce rimasta in «aspetta te»**: `claude login` sul solo linux-pc, cinque
   minuti tuoi. Le altre cinque le ho decise io su tua delega; questa non era fra quelle. Se
   vuoi che esca dagli elenchi con lo stesso criterio, dimmelo.
3. **Il fornitore di proposte non è configurato in produzione** (`RESEARCH_GATEWAY_URL` /
   `_TOKEN` nel `.env`, che è tuo). Finché mancano, l'API dice «non c'è chi propone».
4. **Sulla VM resta una vecchia unit di servizio accanto a quella viva**
   (`heuresys-advanced-web.service.dev.bak`). È **inerte** — verificato — ma è configurazione
   di un servizio di produzione. Si sposta, si tiene, o si lascia?

## Verification — la verifica

```bash
python docs/kb/tools/session_start.py            # menu + salute, un giro solo
python docs/kb/tools/guardiano.py                # contesto e finestra 5h — 3 fix in S1080
python docs/kb/tools/guardiano.py --selftest     # 47 casi; i 3 nuovi sabotati e verificati
python docs/kb/tools/check_marciume.py           # cio' che marcisce senza produrre un diff
```
