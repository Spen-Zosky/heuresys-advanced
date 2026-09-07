# S1091 — piano di sessione

> **stato**: IN CORSO
> **nasce-da**: mandato di Enzo all'avvio (2026-09-07) — *«esegui tutti da P0 a P3 in autonomia e
> automaticamente prendendo decisioni per mio conto, nell'ordine che ritieni più appropriato.
> L'unico guardiano che comanda è quello della capienza»*.

## Il mandato, e cosa cambia

Nessun menu, nessuna attesa di scelta, nessuna domanda di indirizzo: l'ordine lo decido io e lo
dichiaro qui **prima** di cominciare. Le decisioni che il registro attribuiva a Enzo — la custodia
whistleblowing di `#169`, l'accensione della ricerca semantica in CI, il presidio di `#249` — le
prendo io e le motivo nella voce. Restano fuori dalla delega **solo** le tre eccezioni di sempre:
azione distruttiva/irreversibile, divieto di sicurezza, impossibilità tecnica accertata.

Guardiano all'apertura: contesto **11,0 %** (109.668 / 1.000.000) · finestra 5h **8,0 %** —
«si continua». Le soglie restano 75 % / 80 %, regola OR.

## Confine di sessione, dichiarato adesso

Le voci **V1–V8** sono l'obiettivo dichiarato di questa sessione: sono economiche o hanno un
residuo piccolo, e devono chiudersi tutte. Le voci **V9–V12** sono programmi da più sessioni
(`#50` stimata ~250k da sola, `#159` ~3-4 sessioni, `#143` ~4-6, `#54` ~5-7): si aprono **in
quest'ordine** e si portano avanti finché la capienza regge. **Non staranno tutte**, ed è dichiarato
ora, non alla resa dei conti. Dove si arriva lo dice il guardiano, e la chiusura lo scrive.

La propagazione dei cloni (P0) è **V13** e sta in fondo per una ragione: propagare adesso
significherebbe rifarlo dopo ogni commit di questa sessione. Si propaga una volta sola, alla fine,
con tutto il lavoro dentro.

## Le voci

| id | cosa | chi | cosa significa fatto | stato |
|---|---|---|---|---|
| **V1** | I due RED dello staleness: derivati 2/3 superati · cronaca al 39 % del register (soglia 25 %) | io | `session_start.py` non stampa più i due `[!!]`; verdetto staleness senza RED | ✅ **FATTO** — peso 38,7 % → **20,6 % VERDE**; il RED «derivati» era di provenienza, non di contenuto |
| **V2** | `#249` **F3** — il presidio: il cancello `programmi.py --verifica` va interrogato da qualcuno | io | il presidio esiste ed è stato **visto scattare** su un difetto finto, poi tolto | ✅ **FATTO** |
| **V3** | `#231` **S7** — ri-leggere il residuo ora che `#219` è chiusa | io | il piano dice cosa resta davvero, o la voce si chiude | ✅ **FATTO** — S7 senza bersaglio (corsa `34060405061` success, 0 falliti); voce **CHIUSA**, 0 fasi aperte |
| **V4** | `#149` **F4** — la prossima consegna del lab trattata come non verificata | io | consegna trattata, oppure «nessuna consegna nuova» misurato e dichiarato | ✅ **FATTO** — inbox vuota, misurata due volte (`lab_inbox.py` + `ls`); il presidio ha però lavorato su un'affermazione ereditata da `STATE.md`, ri-misurata con `gh` |
| **V5** | `#79` **F3** — cancello di esposizione sul prossimo lavoro che popola tabelle | io | `check_exposure.py` interrogato sul lavoro di questa sessione, o no-op dichiarato | ⏳ |
| **V6** | `#214` **F6** — un perimetro dalla coda dei neutri, in ordine di rischio crescente | io | una riga nuova in `agent-perimetri.json` con decisione e data | ✅ **FATTO** — nono perimetro `enterprise-size-bands`, pari a sette sciolto col rischio crescente, mig `000378` con guardia a due porte, live in produzione |
| **V7** | `#169` **F3** — il segreto smette di essere derivato. ⚠ include la decisione sulla custodia whistleblowing, che prendo io | io | i due segreti separati, e la decisione scritta con la sua ragione | ⏳ |
| **V8** | `#198`/`#205` — la domanda ferma da tre voci: da quali fonti la piattaforma impara com'è fatta un'azienda | io | risposta decisa e scritta; le due voci escono da WAIT-INPUT | ⏳ |
| **V9** | `#50` **F3** — la vista del grafo delle competenze (~250k) | io | la vista esiste e mostra dati reali | ⏳ |
| **V10** | `#159` **F2** — il ponte gateway↔pagine | io | il ponte esiste e vale per le pagine future | ⏳ |
| **V11** | `#143` **F3** — asse funzionale vivo | io | l'asse funzionale è vivo end-to-end | ⏳ |
| **V12** | `#54` **F3** — API del cluster recruiting | io | le rotte esistono, testate, live | ⏳ |
| **V13** | Propagazione: VM + linux-pc allineate, deploy armato | io | `verifica-deploy.sh` non dice più `DISALLINEATO` | ⏳ |

## Registro «fuori da questo ciclo»

Le scoperte nuove si scrivono qui e **non entrano in «cosa resta»**. Si presentano una volta sola
alla fine, come *«fuori da questo ciclo: lo vuoi nel prossimo?»*.

- *(vuoto all'apertura)*

## Le prove che devono poter fallire

- **V1** — un verde ottenuto rigenerando i derivati senza che nulla sia cambiato sarebbe falso: si
  guarda che i tre derivati abbiano un contenuto **diverso** da prima, non solo un timestamp nuovo.
- **V2** — un presidio che non si è mai visto rosso non è un presidio: si introduce un difetto finto
  in un piano di prova, si verifica che il presidio lo fermi, poi lo si toglie.
- **V4/V5** — un «no-op» va **misurato**, non dedotto: se non c'è consegna nuova, il comando che lo
  dimostra va allegato.
- **V13** — `verifica-deploy.sh` ha un vocabolario chiuso, e `NON-VERIFICATO` **non** è «a posto».
