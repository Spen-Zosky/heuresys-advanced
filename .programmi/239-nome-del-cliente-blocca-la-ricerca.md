# 239 — Il nome del cliente può rendere la ricerca impossibile

> **item**: #239 · **priorità**: P2 · **stima**: ~1 sessione
> **stato**: FATTO (S1086, 2026-09-04)
> **nasce-da**: le due prove di merito di `#132` F7 (2026-08-31). **Trovato eseguendo**, non
> ragionando: la prova cercava tutt'altro — se la ricerca ripete l'archetipo bancario — e ha
> incontrato questo per strada.

## Il fatto, misurato

Ho creato un fascicolo per una società di consulenza e l'ho chiamato
*«Prova F7 — società di **consulenza** (ATECO 70.20)»*. La corsa è stata respinta:

```
422 RESEARCH_QUERY_LEAKS_CLIENT
  "consulenza" in «Quali processi aziendali governa di norma un'impresa italiana
   del settore ATECO ...»
```

La guardia §4.5 deriva i **termini riservati dal nome del cliente** e vieta le domande verso
terzi che lo nominino. Siccome il nome conteneva «consulenza», quella parola è diventata
riservata — e la domanda che il **motore genera da sé** sul settore la contiene per forza.

**La ricerca non parte mai.** Non c'è modo di aggirarla dall'interno: la domanda non la scrive
un umano, la costruisce il motore dal settore dichiarato nella carta d'identità.

## Perché non è un caso di laboratorio

Colpisce qualunque azienda che porti nel nome la parola del proprio settore, e nel mondo reale
sono tantissime: una «Consulenza Lombarda», una «Banca Popolare di …», una «Assicurazioni
Generali», una «Costruzioni Rossi». Sono esattamente i clienti per cui il Tenant Builder esiste.

⚠ **La guardia è giusta e non va indebolita.** Serve a non far uscire il nome del cliente verso
terzi, ed è uno dei presidi che rendono difendibile l'intera catena della ricerca (§4.5). Il
difetto non è che protegga troppo: è che **confonde il nome con il dominio**. «Consulenza»
dentro il nome di un'azienda e «consulenza» come settore merceologico sono due cose diverse, e
solo la prima va protetta.

## Cura proposta — da verificare, non ancora decisa

Due strade, e vanno misurate prima di sceglierne una:

1. **Sottrarre il vocabolario di dominio dai termini riservati**: le etichette ATECO, i nomi dei
   settori e dei modelli operativi sono già dichiarati altrove nel sistema. Una parola che
   appartiene a quel vocabolario non identifica il cliente, lo classifica.
2. **Confrontare la domanda con il nome intero** invece che con le sue parole singole. Più
   semplice, ma più debole: «Alfa Consulenza» non verrebbe riconosciuta in «la Alfa Consulenza
   di Milano».

La ① è più precisa e più costosa; la ② si scrive in un'ora ma protegge meno. La scelta dipende
da quanto è largo il vocabolario di dominio già dichiarato, che va misurato.

## Le prove che devono poter fallire

Sono **due e vanno insieme**, o si è solo indebolita la guardia:

- un fascicolo chiamato **col proprio settore** deve poter **partire**;
- una domanda che nomina davvero il cliente (`Alfa S.p.A.` dentro il testo) deve continuare a
  essere **respinta**.

Passare la prima rompendo la seconda è il modo ovvio di barare, ed è esattamente ciò che questa
voce non deve fare.

## Fasi

- [x] **F1 — Misurare il vocabolario di dominio** — FATTO 2026-09-04 — quante e quali parole sono già dichiarate
      come settori/modelli nel sistema. Senza questo numero la scelta fra ① e ② è un'opinione.
      **fatto =** il conteggio esiste, e con esso la decisione fra le due strade, scritta
- [x] **F2 — La cura, con le due prove insieme** — FATTO 2026-09-04 — quella scelta in F1, più i due casi sopra.
      **fatto =** entrambe verdi nella stessa corsa

## Chiuso quando

Un'azienda che si chiama come il proprio settore può essere cercata, e una domanda che nomina
il cliente continua a essere respinta.


---

## L'esito (S1086, 2026-09-04)

### F1 — la misura che ha deciso, e ha ribaltato la stima

Il piano dava la strada ① («sottrarre il vocabolario di dominio») come **più precisa e più
costosa**, e diceva che la scelta dipendeva da quanto quel vocabolario fosse largo. Misurato:

```
sys_industry_codes            12 righe
sys_operating_model_catalog    6 righe
parole distinte (>= 3 lettere) 33
```

**Diciotto righe.** La ① non è la strada costosa: è una query. La stima era sbagliata, e solo la
misura poteva dirlo — che è esattamente il motivo per cui F1 esisteva come fase a sé.

E il vocabolario contiene proprio le parole che fanno danno: «consulenza» compare in **due**
settori su dodici (`MGMT_CONSULTING` e `IT_SOFTWARE`), e con lei «banche», «assicurazioni»,
«costruzioni», «trasporto», «istruzione».

### F2 — la cura: le due strade non erano alternative

Il piano le presentava come un aut-aut. **Non lo sono**: la ② è la rete che rende sicura la ①.

- le **parole singole** che appartengono al vocabolario si sottraggono dai termini riservati —
  «consulenza» da sola *classifica*, non identifica;
- il **nome per esteso** resta sempre riservato — così un cliente che si chiamasse davvero
  «Costruzioni Lombarde» perde la protezione sulla parola comune, ma **non** sulla propria
  ragione sociale.

Sottrarre senza quella rete sarebbe stato indebolire la guardia, cioè il modo ovvio di barare su
questa voce. Il codice tiene `interi` e `parole` in due elenchi separati proprio per questo.

Il vocabolario si legge dalle **due tabelle che lo dichiarano**, mai da un elenco scritto a mano:
un elenco a mano invecchia in silenzio appena qualcuno aggiunge un settore.

### Le prove, insieme e falsificabili — 19/19 verdi sul gemello

| prova | cosa dimostra |
|---|---|
| il vocabolario viene dalle tabelle | non è un elenco cristallizzato; non fissa il numero esatto, che può variare |
| **A** — fascicolo col proprio settore | la corsa **parte** |
| **A'** — la stessa senza vocabolario | la corsa è **respinta** — senza questo caso, A sarebbe verde anche in un mondo dove la guardia non ha mai funzionato |
| **B** — domanda che nomina il cliente | resta **respinta** |
| **B'** — cliente chiamato come un settore | il nome per esteso lo protegge ancora |
| le sigle societarie | `spa` non diventa un termine riservato |

⚠ **Dove sono state eseguite, e perché**: sul **gemello**. Da Windows la suite muore con
`Connection terminated due to connection timeout` — e **muore anche sul baseline senza le mie
modifiche**, il che è la prova che è il tunnel e non il codice. Il tunnel è stato ricreato
(1,3 s contro i timeout precedenti) e non basta comunque per un pool che apre molte connessioni.

Il repo del gemello è stato rimesso a posto dopo la corsa — `file sporchi rimasti: 0` — perché
quella macchina è il gemello di produzione **e** il runner della CI, e questa sessione ha già
speso una notte a ripulire un processo dimenticato lì sopra.
