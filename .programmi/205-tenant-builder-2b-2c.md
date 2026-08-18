# 205 — Tenant Builder 2b e 2c: la coda dei domini ricercabili, e il patrimonio senza le parole di un altro

> **item**: #205
> **stato**: NON AVVIATO

Con questa e con P4, tutte e quattro le parti del Tenant Builder sono progettate: P1 chiusa ·
P2a `#132` · 2b/2c qui · P3 `#198` · P4 consegnata.

⛔ **DIPENDENZA DURA, da non aggirare con una stima**: la coda **non è calcolabile** finché 2a non
è fatta — la prova R2 dipende da `sys_research_sources`, che **non esiste** (verificato) ed è di
`#132`.

## Decisioni vincolanti

1. **2b non è una scelta di domini: è una CODA.** P2a §4.1 lo dice già — «ogni ondata successiva
   è dichiarare un dominio, non costruire un motore». È la stessa dottrina di `#156`/`#214` sui
   perimetri dell'agente: ovunque porti valore aggiunto, la domanda è **l'ordine**, non quale.
   Si progetta una coda, mai un menu.
2. **Le tre prove meccaniche**: R1 è contenuto di un'azienda (colonna `%tenant_id`, il metro di
   E18) · R2 esiste almeno una fonte ammessa che ne parla · R3 **non descrive una persona**.
3. **R3 è definizione, non prudenza**: `sys_position_skill_requirements` («quali competenze una
   posizione richiede») è ricercabile; `sys_user_skills` («quali competenze Marco possiede») non
   lo è. La distinzione è sottile e si perde facilmente.
4. **L'ordine è per RICADUTA**, usando le relazioni che il metro di E18 già calcola: un dominio
   che ne sblocca molti altri va prima. A parità, quello con più fonti ammesse.
5. **2c: la garanzia è una FORMA, non un controllo.** Confrontare i testi e bloccare i troppo
   simili è la risposta **debole** — si aggira cambiando le parole e non si può dimostrare che
   funzioni. La risposta forte è a due strati: «completo e attribuito» legato al tenant
   proprietario, e «forma» (struttura, **zero** campi di testo libero).

## Da NON fare

Scrivere a mano l'elenco dei domini · rendere ricercabile un dominio che descrive persone ·
riusare le righe di `sys_organization_unit_templates` come patrimonio (P2a §9: copie identiche di
una struttura orfana, con una «Direzione Direzione Generale» — residuo, non sapere) · costruire
il confronto di somiglianza fra testi · **citare il numero 196**, che non si riproduce.

## Fasi

- [ ] **F1 Lo strumento che ri-deriva la coda** — ⛔ GATED su `#132` · budget ~60k
      `check_domini_ricercabili.py`, gemello dichiarato di `check_concetti_agente.py`, che
      ri-deriva la coda dal catalogo reale a ogni esecuzione. **Autoprova a esiti opposti
      obbligatoria**: un dominio che deve passare e uno che deve essere escluso da *ciascuna*
      delle tre prove. Se non sa dire di no tre volte non è un criterio, è un elenco con una
      funzione davanti.
- [ ] **F2 Il primo dominio della coda, dichiarato e percorso** — ⛔ GATED su F1 · budget ~80k
      Deve produrre proposte approvate, non solo comparire in cima a una lista.
- [ ] **F3 Lo strato di forma (2c) e la prova della frase riconoscibile** — budget ~60k
      Prendere una proposta approvata del cliente A con una frase riconoscibile, promuoverla a
      patrimonio, e cercare **quella frase** nello strato di forma: deve dare **zero** riscontri.
      Se la trova, la spoliazione non è avvenuta e E12 è finta.

## Decisioni che restano a Enzo (non le prendo io)

- **F1 — che cosa passa esattamente a un cliente nuovo.** La sola struttura è la più sicura e la
  meno utile; includere le tassonomie è molto più utile e comincia a somigliare a contenuto.
  Nessuna misura può rispondere: dipende da cosa Heuresys vende. È anche il confine del limite
  dichiarato su 2c — una forma troppo povera manderebbe il cliente nuovo a ripartire da zero,
  cioè E11 non si realizzerebbe.
- **F2 — il tetto di costo per corsa**, da ri-porre su 150 tabelle invece che sul numero 196.

## Verifica avversariale già fatta (S1066, `#149`) — non ri-eseguirla

Misure ri-fatte sul vivo: `sys` ha 225 tabelle · 150 tabelle di tenant, 144 popolate da RTL, 329
relazioni · `sys_research_sources` **non esiste** (la dipendenza dura regge) ·
`check_concetti_agente.py` esiste.

❌ **Rilievo respinto, ed è sostanziale**: il documento apre con «P2a ha COSTRUITO il motore e lo
ha DIMOSTRATO su business_processes». È **falso**: `#132` è ACTIVE, mai implementata. Nessun
motore esiste, nessuna dimostrazione è avvenuta.

## Chiuso quando

Esiste lo strumento che ri-deriva la coda con autoprova a esiti opposti, il primo dominio è stato
dichiarato e ha prodotto proposte approvate, e la prova della frase riconoscibile sullo strato di
forma dà zero riscontri.
