# 227 — Le competenze isolate nel grafo: un terzo del catalogo senza un solo arco

> **item**: #227
> **stato**: NON AVVIATO
> **nasce-da**: `#222` F6-07, che dichiarava «da fare, con un piano proprio» — e quel piano
> **non è mai stato creato**. La voce `#222` è stata chiusa `DONE` e il residuo è rimasto orfano
> per tre giorni, invisibile a ogni elenco. Trovato in S1079 censendo i residui dichiarati
> dentro voci chiuse.

## La misura, ri-derivata il 2026-08-24 (non ricopiata da `#222`)

```sql
select (select count(*) from sys.sys_skills)                                  -- 14.033
     , (select count(*) from sys.sys_skill_taxonomy_edges)                    -- 18.420
     , (select count(*) from sys.sys_skills s where not exists (
          select 1 from sys.sys_skill_taxonomy_edges e
           where e.skill_taxonomy_edge_parent_id = s.skill_id
              or e.skill_taxonomy_edge_child_id  = s.skill_id));              -- 4.464
```

**4.464 competenze su 14.033 — il 31,8% — non hanno alcun arco tassonomico**, né in su né in giù.
`#222` diceva 4.467 su 14.036: la differenza sono le 3 competenze fuse in S1077 (mig `000351`).
Il numero regge, ed è **due ordini di grandezza** sopra le 84 che il dossier forense stimava.

## Perché conta, e perché non è una fase dentro un'altra voce

Il grafo delle competenze è il substrato di ciò che la piattaforma promette: somiglianza,
scostamento fra requisito e persona, percorsi formativi, successione. Una competenza senza archi
**esiste ma non partecipa**: non è simile a nulla, non colma nessuna lacuna, non appare in nessun
percorso. Un terzo del catalogo in questa condizione non è un difetto di integrità — è una
**capacità dichiarata che su un terzo dei casi non funziona**, e nessuna misura di integrità la
segnala, perché nulla è rotto.

È curatela, non riparazione: va decomposta prima di poter essere eseguita.

## Fasi

- [ ] **F1 Censire le 4.464, per specie** — un elenco piatto non è un piano di lavoro. Le domande, in ordine: quante vengono da ESCO (che *ha* una tassonomia propria, quindi l'arco è **derivabile**, non da inventare) e quante da `COMP::` o da altre provenienze · quante sono usate da qualcuno (assegnate a una persona, richieste da una posizione, dentro un modulo formativo) e quante non le usa nessuno · quante hanno un gemello quasi-identico già collegato. **fatto =** una tabella per specie con i conteggi e la strategia di ognuna, misurata e non stimata
- [ ] **F2 Le derivabili: l'arco si prende dalla fonte, non si inventa** — per le ESCO l'albero esiste a monte e va **letto**, non ricostruito a intuito. ⚠ Vincolo `I12`: il rubinetto del brownfield è chiuso, ma ESCO **non è brownfield** — è la tassonomia europea, e `reference_sync` è la sua casa dichiarata. **fatto =** archi scritti, il conteggio delle isolate scende del numero previsto da F1, e una post-condizione protegge ciò che NON doveva cambiare
- [ ] **F3 Le non derivabili e non usate: si ritirano o si dichiarano** — una competenza che nessuno usa e che nessuna tassonomia conosce è residuo, non catalogo. ⚠ `ADR-0035`: ritirare non è cancellare — si emenda il file che la crea. **fatto =** ogni riga o ritirata o tenuta **con la ragione scritta**, mai un jolly
- [ ] **F4 Le usate ma non derivabili: curatela vera** — sono quelle che qualcuno usa davvero e che nessuna fonte sa collocare. Qui l'arco è una **decisione**, e va presa con un criterio dichiarato, non a intuito. **fatto =** criterio scritto, applicato, e una sentinella che tiene il conto delle isolate perché non risalga in silenzio
- [ ] **F5 La sentinella** — oggi nessuna misura conta le competenze isolate: il numero è potuto crescere fino a un terzo del catalogo senza che niente lo dicesse. ⚠ Una vista `sys.v_*` nuova diventa **automaticamente** una sentinella che pretende zero righe (memoria `new_sys_view_becomes_sentinel`): qui zero non è l'atteso, quindi va dichiarata **informativa** con la sua soglia, o renderà rossa la prova generale. **fatto =** la misura esiste, ha una soglia motivata, ed è stata vista scattare

## Chiuso quando

Le quattro specie di F1 hanno tutte una destinazione eseguita, il conteggio delle isolate è sceso
al valore che F1 dichiara raggiungibile (**non a zero** — alcune resteranno, con la ragione
scritta), e una sentinella lo sorveglia perché non risalga senza che nessuno se ne accorga.
