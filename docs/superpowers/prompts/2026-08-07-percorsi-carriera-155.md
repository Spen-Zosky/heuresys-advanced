# Mandato — #155: i percorsi di carriera puntano a posizioni morte

**Data consegna**: 2026-08-07 · **Origine**: Cowork · **Esecutore**: Claude Code CLI
**Referto atteso**: `../specs/2026-08-0X-percorsi-carriera-155.md`

**Contesto della decisione**: il referto del 2026-08-07 mette #155 davanti a tutto il
programma AI/RAG, e la gerarchia è corretta: è l'unica voce che una persona vera vede
aprendo la propria pagina. Cowork aggiunge un motivo che il referto non collega — #155
insiste sulla **stessa area** (successione e percorsi) su cui si stava progettando la
dimostrazione al cliente. È precondizione, non alternativa.

**Numeri riverificati da Cowork il 2026-08-07 sul database live**: 252 percorsi in
`sys_position_career_paths`, di cui **207 su posizioni con `position_is_active = false`**.
Coincidono con la misura di S1047.

---

Lavori sul repo heuresys-advanced. Verifica la root con `git rev-parse --show-toplevel`.

REGOLA DI INGAGGIO
Non modificare nulla finche' non ti ho confermato il piano. Prima leggi e diagnostichi,
poi mi esponi una strategia, poi ti fermi e aspetti il mio ok.
Questa e' la voce che il backlog classifica "lavoro di dominio, non meccanico": il
rischio principale non e' sbagliare una query, e' **inventare una corrispondenza**
fra posizioni morte e posizioni vive. Non farlo. Vedi TASK 2.

LEGGI PRIMA DI AGIRE (obbligatorio)
- CLAUDE.md nella root
- docs/kb/SOT_BACKLOG.md, la voce #155 (intorno a riga 52) e le voci #112 e #114
- qa_artifacts/storia36/custodia-2026-08-06.md, in particolare il check C5c(iii)
- db/scripts/storia36.sh
- le migrazioni della ricostruzione dell'organigramma citate nella voce #155
  (serie 000244-000251): localizzale tu, non ti do il path a memoria

DA DOVE VIENE IL GUASTO
La ricostruzione dell'organigramma ha cambiato l'albero delle posizioni. Tre cataloghi
dipendevano da quell'albero: i requisiti (#112), l'albero posizioni stesso (#114) e i
percorsi di carriera. I primi due sono stati riparati. Il terzo e' **il pezzo dimenticato
in quella riparazione**. Non e' un difetto di prodotto: e' un danno collaterale noto,
della stessa classe di due danni gia' sanati.

Conseguenza per le persone: **130 obiettivi di carriera su 153 attivi non sono
raggiungibili da alcun percorso**. Esempio nominato nella scheda:
`alberto.colombo@rtl-bank.org`.

OBIETTIVO
Zero percorsi di carriera che puntano a posizioni non attive, e il check C5c(iii) verde
su una corsa reale di `bash db/scripts/storia36.sh custodia`. E' il criterio di chiusura
scritto nel backlog: non inventarne altri, non accontentarti di meno.

TASK 1 — Diagnosi: capire com'e' rotto, e se la mappa esiste gia'
Non proporre riparazioni in questo task. Solo capire.
a) Le 207 righe rotte: quante posizioni morte distinte coinvolgono? Sono concentrate su
   poche posizioni o sparse? Le 45 righe sane cos'hanno di diverso?
b) LA DOMANDA CHE DECIDE TUTTO: le migrazioni della ricostruzione hanno lasciato una
   corrispondenza vecchia -> nuova posizione? Cerca nelle migrazioni 000244-000251, in
   eventuali tabelle di mappatura, nel modulo brownfield, e nel modo in cui sono stati
   riparati #112 e #114. Se quei due sono stati sanati, **come** hanno ritrovato la
   posizione giusta? La stessa via probabilmente vale qui.
c) Se una mappa esiste: dimmi dove, e quante delle 207 righe copre.
   Se NON esiste: dillo chiaramente. Cambia tutto il seguito.
d) Riporta anche quante persone sono realmente toccate (obiettivi non raggiungibili) e
   verifica il caso `alberto.colombo@rtl-bank.org` citato nella scheda.

TASK 2 — Strategia, e poi FERMATI
Sulla base della diagnosi, proponimi come ripararlo. Distingui esplicitamente:
- quante righe si riparano in modo **derivabile** (esiste una corrispondenza tracciabile);
- quante richiederebbero un **giudizio di dominio** (nessuna corrispondenza: bisogna
  decidere quale posizione viva sostituisce quella morta);
- quante andrebbero semplicemente **rimosse** perche' il percorso non ha piu' senso.
DIVIETO CENTRALE: per le righe del secondo gruppo NON scegliere tu. Portami l'elenco e
la proposta, con il criterio che suggeriresti, e aspetta. Un percorso di carriera
inventato e' peggio di un percorso mancante: mancante si vede, inventato no.
Se la maggioranza delle 207 cade nel secondo gruppo, dimmelo subito: significa che
questa non e' una sessione di riparazione ma una decisione di prodotto per Enzo.

TASK 3 — Esecuzione, solo su mio ok esplicito
Prima di scrivere: riporta i numeri PRIMA. Poi applica. Poi i numeri DOPO.
La riparazione dev'essere una **migrazione**, nelle convenzioni della serie gia' in uso,
non uno script una-tantum: cosi' viaggia verso la VM e il PC Linux come tutto il resto.
Se tocchi righe che richiedevano giudizio, devono essere solo quelle che ti ho
autorizzato nominatamente.

TASK 4 — Chiusura secondo il criterio del backlog
Esegui `bash db/scripts/storia36.sh custodia` per intero e riporta l'esito di C5c(iii).
Verde e zero percorsi su posizioni non attive = chiuso. Qualunque altro esito = non
chiuso, e lo dici.
Verifica anche che non si sia rotto altro: la suite dei moduli toccati deve restare verde.

DIVIETI
- Non inventare corrispondenze fra posizioni morte e vive (vedi task 2)
- Non scrivere nel database senza il mio ok esplicito
- Non fare push: i commit restano locali
- Non toccare il lavoro AI/RAG: catalogo generico, corpus dei concetti, agent-gateway
  restano fermi. Questo ciclo e' solo #155
- Non riportare valori di segreti
- Se un numero che ti ho dato diverge dalla realta', segnala la divergenza e non
  riallineare l'atteso

SE QUALCOSA VA STORTO
Se la diagnosi del task 1 non trova nessuna mappa e nessuna traccia di come furono
riparati #112 e #114: fermati e dimmelo. Non ricostruire l'organigramma a intuito.
Se `storia36.sh custodia` fallisce per ragioni estranee a #155: riportale separatamente,
non tentare di sistemarle in questo ciclo.
Se scopri che il guasto e' piu' esteso di 207 righe: riportalo, non allargare il lavoro
di tua iniziativa.
