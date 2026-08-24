# 225 — Due affermazioni del CLAUDE.md sono scadute

> **item**: #225
> **stato**: CHIUSO
> **chiuso**: S1079 (2026-08-24)
> **lab-id**: 2026-08-24-claude-md-due-affermazioni-scadute

## Perche' questo file e non solo il register

Il CLAUDE.md e' il primo file che ogni sessione carica. Un'istruzione che descrive il passato
non viene letta come storia: viene **eseguita**. Sono due righe, ma stanno nel posto dove un
errore si propaga a tutte le sessioni successive.

## Le due voci, e la misura che le regge

| # | Riga | Misurato in S1079 (2026-08-24) | Esito |
|---|---|---|---|
| ① | I16: «il resolver … e' il bersaglio di #99 F4 — **oggi percorre ancora** l'albero delle posizioni, riallineato dal rammendo #114» | `SOT_BACKLOG.md:1420` → **#99 status: DONE**, epica chiusa S1064, 10 fasi su 10, F3 (`63c0c7e8`, 2026-08-14) ha portato il perimetro sull'albero delle **unita'**. `:1405` → **#114 DONE** | la consegna REGGE |
| ② | rubinetto: «I **30** storici sono congelati in `legacy_ingest_allowlist.txt`» | `check_no_legacy_ingest.py` → exit 0, «**32** storici noti» | la consegna REGGE |

## Cosa si scrive, e cosa NON si scrive

- ① la frase va al **passato**, e il fatto si afferma al **presente**. Spariscono il rimando a
  «#99 F4 come bersaglio» e alla pezza #114.
- ② **non** si scrive 32. Si toglie il conteggio e resta il meccanismo. Scrivere il numero nuovo
  sarebbe ripetere l'errore fra due settimane — ed e' il ⭐ PUNTO FISSO enunciato nella stessa
  pagina che verrebbe violato una seconda volta.

## La prova che deve poter fallire

Dopo la correzione: cercare nel CLAUDE.md **altri** numeri che descrivano una misura variabile e
non siano dichiarati datati. Se ne resta uno, la correzione ha curato il sintomo e non la specie,
e serve una voce nuova.

## Chiuso quando

I16 non afferma piu' nulla al presente su un difetto chiuso · la riga del rubinetto non porta piu'
un conteggio · la ricerca dei numeri variabili non trova altri casi, oppure li elenca in una voce nuova.

---

## ESITO — S1079, 2026-08-24

**Le due correzioni chieste sono state applicate.** Ma la prova che deve poter fallire **è fallita**,
e ha trovato **tre casi in più della stessa specie** nello stesso file:

| caso | il file diceva | la misura del 2026-08-24 | cosa ho scritto |
|---|---|---|---|
| dimensione dei tre file di SoT | `156KB + 206KB + 65KB` | **837KB + 390KB + 132KB** — il register è **5,4 volte** più grande | «sono i tre documenti più grandi del repo e crescono a ogni sessione» |
| casi di selftest del rubinetto | `--selftest (9/9)` | 9/9 verdi **oggi**, ma cresce se si aggiungono casi | `--selftest` (deve uscire tutto verde) |
| dimensione di `.handoff/STATE.md` | `~3KB` | **4.576 byte** | il criterio («una frazione dei tre sopra»), non il numero |

**Non ho aperto una voce nuova**: erano la stessa correzione, sullo stesso file, applicabile subito.
Il primo caso non è cosmetico — quel numero esiste proprio per dire «non aprirli a boot», e
sottostimarlo di 5 volte rendeva l'avvertimento meno credibile di quanto dovesse essere.

**Stato: CHIUSO.**
