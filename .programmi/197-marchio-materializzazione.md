# 197 — Il marchio `materialized_from` non copre tutte le tabelle che lo stesso motore scrive

> **item**: #197
> **stato**: CHIUSO

`tenant-materialization/repository.ts` scrive `metadata.materialized_from` su tre tabelle
(`sys_organization_units:71`, `sys_skills:153`, `sys_kpi_definitions:194`) e **non** sulle altre
cinque che lo stesso motore popola (`sys_positions:103`, `sys_users:223`,
`sys_user_position_assignments:254`, `sys_user_skill_evidence:304`, `sys_user_kpi_evidence:317`).

**La natura del guaio è il falso negativo silenzioso**: «non marcata perché reale» e «non marcata
perché il motore non la marca» sono indistinguibili guardando il dato.

## Decisioni vincolanti

- **NON estendere il marchio alle altre cinque tabelle.** La fonte vera è
  `sys.sys_generated_record_origins` (forma decisa in P1 §4.7, prima che questo difetto
  emergesse). Il campo resta dov'è, come **appunto storico del motore**.
- **Il difetto è latente, non attivo**: la tabella del registro esiste ed è vuota, il motore non
  ha ancora costruito in produzione. 0 su 45 unità portano il marchio, 0 codici `RBR-%` ovunque
  (due misure indipendenti, 2026-08-16).

## Fasi

- [x] **F1 Il commento che dice cos'è davvero quel campo** — FATTO 2026-08-17 · `5ec40cf3` · l'intestazione di `tenant-materialization/repository.ts` dichiara che il campo **non è** il marchio di provenienza, che la copertura è 3 su 8 con le righe esatte, che la natura è il falso negativo silenzioso, e dove sta la fonte vera
- [x] **F2 Il controllo incrociato riporta la differenza fra le due coperture** — FATTO 2026-08-18 · `db/scripts/verifica-origine-vs-marchio.sql`, eseguito sulla prima azienda mai costruita dal motore (#198 T9a, gemello): **165 righe su 184 invisibili al marchio**, 19 coperte da entrambi
      Il controllo **doveva** trovare una differenza, o starebbe confrontando una cosa con sé
      stessa. La trova, e la nomina tabella per tabella: il marchio copre unità (7), competenze
      (8) e indicatori (4); il registro copre anche persone (11), posizioni (11), assegnazioni
      (11) ed evidenze (88+44).
      ⚠ **Lo strumento ha mentito alla prima stesura**, e va detto: la query finale ometteva
      competenze e indicatori dall'elenco del marchio e dichiarava scoperte 177 righe invece di
      165. Un controllo che **esagera** la differenza è inservibile quanto uno che la tace —
      nessuno dei due numeri si può usare. Trovato confrontando i suoi due blocchi fra loro.

## Chiuso quando

Il commento c'è (fatto), **e** il controllo incrociato di P3 riporta la differenza fra le due
coperture.
