# 218 — I residui del legacy senza referente locale: analizzarli tutti, e risolverli uno per uno

> **item**: #218
> **stato**: NON AVVIATO

## Decisione vincolante (non si ri-chiede)

**Enzo, 2026-08-19** — *«tutti i dati provenienti dal db legacy che non hanno mai avuto un
referente locale devono essere analizzati e trattati correttamente: per ognuno si deve decidere
se eliminarli o se è opportuno/necessario creare il referente locale. È comunque da privilegiare
la cancellazione/bonifica per l'igiene del DBMS attuale, che ormai ha superato il legacy ed è
completamente autonomo.»*

E la previsione operativa, da verificare: *«un'attenta e approfondita analisi del DBMS sarà in
grado di restituire le informazioni necessarie e di permettere una pulizia profonda del DBMS che
ne assicura l'indipendenza e l'autonomia»*.

**Ordine di preferenza, dichiarato**: eliminare › creare il referente › lasciare com'è **solo**
con una ragione scritta.

## Il caso che l'ha prodotta

Le **225** righe di `sys_organization_unit_templates` portano
`organization_unit_template_blueprint_id`, che punta a **9** identificativi inesistenti in tutte
e quattro le tabelle di blueprint. Avevo concluso «225 righe orfane»; il file che le crea diceva
altro — mig. `000064`: `-- legacy template_id group (the 9)`. Sono il `template_id` del sistema
di provenienza, conservato come raggruppamento, **senza FK perché non c'è nulla a cui agganciarlo**.

Non è un guasto e non è a posto: è un **residuo mai risolto**, e questa voce esiste per non
lasciarne altri.

## Perché conta

Un riferimento ereditato che non punta a nulla di locale **mente sul proprio nome**, e a occhio è
indistinguibile da un difetto — come ha dimostrato la mia lettura sbagliata. Finché ce ne sono, il
database non è autonomo dal legacy nemmeno nella propria descrizione di sé.

## Non è in conflitto con I12

«Il rubinetto è chiuso» vieta di **importare** nuove righe dal legacy. Questa voce chiede di
**risolvere** ciò che è già dentro `sys.*`: materia diversa, direzione opposta.

## Vincoli

Le quattro cose di `db-migrations.md` — misura prima · guardia al momento dell'esecuzione ·
post-condizione che protegge ciò che **non** doveva cambiare · rollback dichiarato — e **ADR-0035**:
si emenda il file che crea l'oggetto, non si cancella solo a valle, o al deploy dopo torna.

## Fasi

- [ ] **F1 Il censimento: quante sono, e dove** — budget ~60k
      Criterio meccanico da costruire: una colonna che **nomina un oggetto**
      (`..._blueprint_id`, `..._template_id`, `..._external_code`, valori `LEGACY_*`) e **non ha
      una FK**. Si interroga `pg_constraint` e `information_schema`, non si va a memoria. L'esito è
      un elenco con, per ciascuna: quante righe, quale migrazione la crea, e cosa quel file dichiara
      che sia. **È un deliverable a sé**: senza il numero, «privilegiare la bonifica» non è una
      decisione ma un'intenzione.
- [ ] **F2 La decisione, una per una** — budget ~40k
      Per ogni voce del censimento: eliminare (preferito), creare il referente locale, o lasciare
      con ragione scritta. La decisione si scrive **accanto alla voce**, non in un documento a parte.
- [ ] **F3 La bonifica, con le quattro cose** — budget dipende da F1
      Migrazioni che emendano i file che creano gli oggetti, più la rimozione degli esemplari
      esistenti. Prova generale sul gemello prima del push, sempre.
- [ ] **F4 La guardia che impedisce il prossimo** — budget ~30k
      Un cancello che rende rosso un riferimento nuovo che nomina un oggetto e non lo aggancia.
      Senza, il censimento di F1 è una fotografia e non una cura.

## Chiuso quando

Ogni residuo censito in F1 ha una decisione eseguita, e un cancello impedisce che ne nascano di
nuovi senza che qualcuno se ne accorga.
