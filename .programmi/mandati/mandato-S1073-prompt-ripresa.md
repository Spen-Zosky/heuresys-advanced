# Mandato S1073 — prompt di ripresa, da copiare nella sessione nuova

> **mandato di ciclo**, non programma di voce → vive in `.programmi/mandati/`, fuori dal radar di
> `programmi.py`. **stato**: DA APRIRE
> **scritto**: 2026-08-19, a chiusura di S1072, su richiesta di Enzo
> **come si usa**: si copia il blocco qui sotto e lo si incolla come primo messaggio della sessione
> nuova. Nomina già una task, quindi il boot salta il menu e parte diritto.

La coda in fondo è stata **ri-derivata** con `build_menu.py` alla chiusura di S1072, non ricordata:
gli avanzamenti (`#132` 2/8, `#211` 4/5, `Z-251` 3/4) sono quelli reali di quel momento. Se la
sessione nuova si apre molto dopo, il boot li ri-deriva da sé e vince il boot.

---

```
avvia sessione

Riprendo da #132 F2. Il piano è .programmi/132-ricerca-genera-il-modello.md;
F1 è chiusa (mig. 000327: cinque tabelle di contenuto agganciate alla versione
di variante, in produzione).

CONTESTO CHE NON DEVI RI-CHIEDERMI

Il motore di costruzione produce sempre una banca, perché l'archetipo è cablato
in apps/api/src/modules/tenant-materialization/blueprints.ts (296 righe). Il
2026-08-19 ha costruito una terza banca in produzione e l'abbiamo disfatta per
intero. Mia decisione E29: l'archetipo deve sparire e il modello deve nascere
dalla ricerca. E il flusso di creazione di un'azienda di un tipo mai visto deve
GENERARE la famiglia e la variante, non trovarle già pronte (è F6).

VINCOLO: finché F3 non ha ritirato blueprints.ts, non costruire nessuna azienda
di prova — ne uscirebbe un'altra banca.

METODO DI LAVORO (è già implementato: usalo, non reinventarlo)

· Ogni voce multi-sessione ha il suo piano in .programmi/<id>-<slug>.md, con le
  fasi, il budget dichiarato e l'evidenza accanto a ogni spunta. Una spunta senza
  evidenza è un difetto: lo dice `python docs/kb/tools/programmi.py --verifica`.
· Il menu di avvio si DERIVA da register + piani (build_menu.py). Non ricopiare
  mai l'avanzamento nel register: è vietato da un cancello.
· Prima di aprire una fase, misura la capienza:
  `python docs/kb/tools/guardiano.py --budget N`. Se non ci sta, non aprirla a
  metà: fai l'indagine, che è essa stessa un deliverable, e scrivine l'esito.
· Ordine dentro la coda: prima ciò che protegge la verifica del resto, poi le
  voci corte, poi le lunghe.
· Commit atomico a ogni fase conclusa, push a fine voce. Prima di ogni push che
  tocca db/, la prova generale sul linux-pc (ci-rehearsal.sh, due passate).
· Ogni prova deve poter fallire: sabotala e verifica che diventi rossa.
· Le decisioni di business e di esposizione dati sono mie; tutte le decisioni
  tecniche le prendi ed esegui tu.
· Alla soglia del guardiano: interrompi, registra, committa, pusha, chiudi.

DOPO LA CORSA INIZIALE, avvia in quest'ordine

 1. #132 F2→F7 — la corsa iniziale. Sblocca le due voci successive.
 2. #198 T9b — la costruzione in produzione, da rifare solo dopo #132.
 3. #211 F4 — il criterio di verde della suite E2E. Corta (4/5 fatte) e protegge
    la verifica di tutto il resto: la corsa integrale è rossa su 13 casi mai
    triati, diversi dai sei già risolti.
 4. Z-251 F4 — costa solo leggere la CI: servono 3 corse integrali verdi
    consecutive coi limiti a 20s/30s. Contatore nel piano, 1 già registrata.
 5. #218 F1→F4 — i residui del legacy senza referente locale: censirli tutti,
    poi per ognuno eliminare (preferito) o creare il referente.
 6. #69 — i 18 residui staging.wave1_*, ~1 sessione.
 7. #205 F1→F3 — si sblocca appena #132 è chiusa.
 8. #214 F3 — il quarto perimetro dell'agente: fermati e chiedimelo, la scelta
    è mia.
 9. Le lunghe, in quest'ordine: #159 (~3-4) · #143 (~4-6) · #50 (~2) · #54 (~5-7).
10. Continuative, si applicano quando ricorre il caso: #79 F3 (a ogni lavoro che
    popola tabelle) · #149 F4 (a ogni consegna del lab).

Non chiedermi conferma fra una voce e l'altra: procedi, committa e apri la
successiva. Fermati solo su operazioni distruttive, sul punto 8, e sulla soglia.
```

---

## Perché l'ordine è quello, e non le priorità nude

Non segue P1→P2→P3, e la ragione è la stessa che il mandato di S1071 aveva già scelto: **prima ciò
che protegge la verifica del resto, poi le corte, poi le lunghe**. In più pesano due dipendenze
vere, che le priorità da sole non mostrano:

- **`#198` T9b e `#205` dipendono da `#132`** — il primo di fatto (rifarlo prima significherebbe
  costruire un'altra banca), il secondo per dichiarazione (`⛔ GATED su #132` nel register).
- **`#211` F4 sta prima delle voci lunghe** benché sia P2: finché il criterio di verde della suite
  non è dichiarato, ogni lavoro successivo si verifica con uno strumento che nessuno guarda — che è
  il difetto che quella voce esiste per curare.

## Cosa NON mettere in un prompt di ripresa

I **numeri** che il boot ri-deriva da sé (conteggi del database, migrazioni, avanzamenti): scriverli
qui significherebbe cristallizzare una misura variabile, che è ciò che il ⭐ PUNTO FISSO vieta. Nel
blocco sopra ci sono solo **decisioni** e **vincoli** — le cose che nessuno strumento può ricavare
dal repo.
