# 205 — Tenant Builder 2b e 2c: la coda dei domini ricercabili, e il patrimonio senza le parole di un altro

> **item**: #205
> **stato**: NON AVVIATO · ⚠ gate CADUTO ma **F1 resta non eseguibile in modo utile** — misura del 2026-09-05, sotto

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


---

## ⚠ Misurato il 2026-09-05 (S1087): il gate e' caduto, ma F1 non e' diventata eseguibile

La dipendenza dura diceva: «la coda non e' calcolabile finche' 2a non e' fatta — la prova R2
dipende da `sys_research_sources`, che **non esiste**». `#132` e' stata chiusa (con F7) in S1086,
e la tabella ora esiste davvero:

```
to_regclass('sys.sys_research_sources') -> presente, 15 colonne
select research_source_status, research_source_domain, count(*) ... :
  APPROVED | business_processes | 1
```

**Una riga sola, per un dominio solo — e quel dominio e' proprio quello gia' percorso da 2a.**

Conseguenza diretta sulla prova R2 («esiste almeno una fonte ammessa che ne parla»): applicata
oggi, escluderebbe **ogni** candidato tranne `business_processes`. Lo strumento di F1 nascerebbe
verde e restituirebbe una coda con dentro solo cio' che e' gia' fatto — cioe' **un verde nato dal
vuoto**, che e' esattamente la forma di falso verde che questo repository ha imparato a
riconoscere. E la sua autoprova a esiti opposti («un dominio che deve passare e uno che deve
essere escluso da *ciascuna* delle tre prove») **non sarebbe costruibile su R2**, perche' non
esiste un secondo dominio con cui provare il «no».

Non e' la decisione di Enzo a mancare (quella su «che cosa passa a un cliente nuovo» riguarda F1
ma e' separabile): **manca la materia**. Il registro delle fonti si popola percorrendo domini, e
percorrere domini e' F2 — che dipende da F1. Il nodo si scioglie approvando altre fonti, che e'
un atto di business, oppure dichiarando che R2 vale «una fonte ammessa **puo'** esistere per quel
dominio» invece di «esiste» — ma quella e' una riscrittura del criterio, non la sua applicazione,
e questo piano vieta esplicitamente di scrivere a mano un criterio.

**Sta a Enzo**, e sono due domande, non una:
1. quali altre fonti si approvano (business: da quali siti la piattaforma accetta di imparare);
2. se R2 va riscritta al potenziale — e con quale ordine, dato che il criterio 4 dice «per
   ricaduta», che si calcola sulle relazioni e non sulle fonti.
