# Piano S1054 — ciclo H: «sistema il residuo del clone e misura il rinfresco» (R24)

Richiesta di Enzo, 2026-08-11, nata dalla sua obiezione alla strategia di velocizzazione:
*«questo richiede la certezza che il dbms su linux-pc sia completamente allineato a quello prod»*.
L'obiezione è fondata e questo ciclo la affronta alla radice.

## Misura preliminare (H1, già fatta)

| | VM (produzione) | linux-pc (clone) |
|---|---|---|
| funzioni in `staging` | 88 | 88 |
| funzioni in `sys` · tabelle `staging` · viste `sys` · indici `sys` · schemi | 12 · 30 · 22 · 748 · 5 | 12 · 30 · 22 · 748 · 5 |
| migrazioni · utenti · obiettivi · predizioni · candidati · tabelle | 301 · 161 · 2189 · 468 · 20 · 241 | idem |

**Oggi i due coincidono. Ma non per merito dello script**: la funzione di troppo (`storia36_check_c6a(date)`,
firma vecchia) fu rimossa **a mano** in S1050. La causa è intatta e si ripresenterà al primo oggetto che
la produzione rimuove.

**La causa, letta nel codice**: `pg_restore --clean --if-exists` (riga 38) prova a droppare lo schema
`staging`, ma **non può**, perché ci sono funzioni che dipendono da esso; l'errore è un «notice» che lo script
tollera (riga 60), il ripristino prosegue, e i controlli passano — perché contano **righe di tre tabelle**
(riga 67) e una funzione di troppo non ha righe. Il clone resta un sovrainsieme della produzione, e nessuno
lo vede.

## Tabella del ciclo (stato per riga — la chiusura si legge da qui)

| id | cosa | chi | fatto significa | stato |
|---|---|---|---|---|
| H1 | **Misura**: il residuo esiste ancora? e qual è la causa nel codice? | Claude | Censimento oggetti sui due DB + la riga esatta che tollera l'errore | ✅ **FATTO** — oggi allineati (rimozione manuale S1050), causa intatta a `clone-vm-db.sh:38,60,67` |
| H2 | **Causa**: lo schema `staging` va rimosso *prima* del ripristino, in modo che non possa sopravvivere | Claude | `DROP SCHEMA IF EXISTS staging CASCADE` eseguito prima della pipe; il ripristino lo ricrea da zero | ✅ **FATTO** — nel rinfresco reale il CASCADE ha portato via 30 oggetti dipendenti (tabelle `storia36_*_undo`, `rtl_employees`, viste) e il ripristino li ha ricreati dal dump |
| H3 | **Rilevamento**: una post-condizione che confronti gli OGGETTI, non le righe di tre tabelle | Claude | Censimento identico sui due lati (funzioni, tabelle, viste, indici, schemi per namespace); differenza ⇒ **exit non-zero**, come già fa il confronto di righe | ✅ **FATTO** — 12 voci confrontate, delta stampato voce per voce; entra nello stesso `mismatch` che fa uscire lo script non-zero |
| H4 | **Prova che sappia dire NO** | Claude | Iniettata una funzione di troppo sul clone, la post-condizione diventa rossa; rimossa, torna verde | ✅ **FATTO** — `staging.fun=88` vs `89`, **lo scarto esatto di S1050**; funzione rimossa dal `trap` e verificata assente (88 e 0 occorrenze) |
| H5 | **Misura del rinfresco**: quanto dura un clone completo | Claude | Tempo cronometrato del `clone-vm-db.sh` corretto, end-to-end, con censimento prima/dopo | ✅ **FATTO** — **70,42 secondi** end-to-end. Dopo: righe 161/313/117.575 identiche, censimento oggetti 12/12 identiche |
| H6 | Register `#172` → RISOLTO con la prova | Claude | Blocco aggiornato; `handoff_lint` 0 FAIL | ✅ **FATTO** |

Chiusura binaria dal file: **CICLO CHIUSO = 6/6**, altrimenti **NON CHIUSO** con la voce mancante nominata.

## Simulazione a 5 domande (R24 §3)

**H2/H3** · *Precondizioni*: `linux-pc` raggiungibile come utente `enzo`, repo in `/home/enzo/heuresys-advanced`,
`.env` presente (verificato). Lo script gira **su linux-pc**, non qui. · *Meccanismo*: emenda a
`scripts/clone-vm-db.sh`; il `DROP SCHEMA … CASCADE` va eseguito come `postgres` sul DB **locale** e **prima**
della pipe — dopo sarebbe inutile. · *Propagazione*: lo script è versionato e arriva su linux-pc col normale
allineamento; per **provarlo ora** lo copio in `/tmp` sull'host ed eseguo con `ENV_FILE` esplicito, così non
sporco il working tree del clone del repo (che `align-clones` controlla). · *Chi*: Claude.
· *Guardia*: il `DROP … CASCADE` è **distruttivo per costruzione** — è tutto il punto — ma colpisce uno schema
che il ripristino successivo ricrea dal dump. Il rischio vero è che il dump non arrivi: quel caso è **già**
coperto dal controllo su `dump_rc` (righe 52-56), che dichiara il DB incompleto ed esce non-zero. Non lo
tocco e ci appoggio la mia guardia: se il dump fallisce, lo schema droppato è l'ultimo dei problemi e lo
script lo dice già.

**H4** · *Precondizioni*: la post-condizione esiste (H3). · *Meccanismo*: creare sul clone una funzione che in
produzione non c'è, rilanciare **solo** la parte di censimento, osservare il rosso, rimuoverla.
· *Propagazione*: nessuna, è un oggetto temporaneo sul clone. · *Chi*: Claude. · *Guardia*: la funzione di prova
ha un nome inequivocabile (`staging.prova_residuo_s1054`) e va rimossa nello stesso comando che la crea, in un
`trap`, così non sopravvive a un'interruzione — sarebbe il residuo che stiamo curando, creato da chi lo cura.

**H5** · *Precondizioni*: H2+H3 applicate. · *Meccanismo*: `time bash clone-vm-db.sh` su linux-pc.
· *Propagazione*: il clone viene **rifatto per intero** — è l'operazione stessa che si misura.
· *Chi*: Claude. · *Guardia*: è l'unica voce distruttiva del ciclo. Il clone è ricreabile per definizione (è
una copia), il gemello non serve la produzione, e i timer attivi su quell'host (`deploy-watch`, `approvals-sla`,
`backup`) non scrivono sul DB clone durante il ripristino — il `backup` gira alle 01:31, molto lontano.
Censimento prima e dopo: se dopo il clone i due lati non coincidono su **tutti** i conteggi, il rinfresco non
è riuscito e va dichiarato tale.

## Registro scoperte — fuori da questo ciclo

*(vuoto per ora)*
