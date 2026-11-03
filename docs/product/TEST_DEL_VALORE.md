# Il test del valore come misura (F0-3)

Il PRD (`BUSINESS_SCOPE_AND_PRD.md` §1.2 e §2.8) tiene come stella polare il «test del valore»: Heuresys crea valore se e solo se il dato inserito genera decisioni diverse da quelle che l'organizzazione prenderebbe senza il sistema. Fino al 3/11/2026 era una frase. Da questo mandato del programma change management (`PROGRAMMA_change_management_20261103.md`, F0-3) è una misura: un registro, una definizione e una query.

## La definizione unica di «decisione tracciabile»

Una decisione è tracciabile quando porta tutte e cinque queste informazioni:

1. **chi**: una persona del tenant, presa dal token di sessione e mai da ciò che dichiara il client; con il tipo di attore, persona oppure agente che agisce per lei;
2. **che cosa**: un tipo di decisione del catalogo chiuso `audit.valore_tipi_decisione`;
3. **su che cosa**: l'oggetto deciso, con tipo e identificativo;
4. **quando**: l'istante in cui l'API ha accettato la decisione (risposta 2xx);
5. **da dove**: la superficie, cioè una pagina del web o un agente.

La sola forma eseguibile della definizione è la vista `sys.v_valore_decisioni_tracciabili` (migrazione `000470`). Ogni altro testo che parli di decisioni tracciabili rimanda a quella vista.

Una decisione che arriva senza superficie (uno script, un'integrazione, una chiamata diretta all'API) si registra lo stesso, con superficie `api`, ma non è tracciabile: si conta a parte come `decisioni_senza_traccia`. Il motivo è il test stesso: un dato entrato nel sistema non prova che il sistema abbia guidato una scelta.

## Che cosa conta come decisione

Il catalogo è dati nel database, non codice, così la definizione è una sola e la si interroga con una query:

```sql
SELECT t.categoria, t.codice, t.etichetta, r.metodo, r.rotta, r.oggetto_tipo
  FROM audit.valore_tipi_decisione t
  JOIN audit.valore_rotte_decisione r USING (codice)
 WHERE t.attivo
 ORDER BY t.categoria, t.codice, r.rotta;
```

Il criterio di scelta: una rotta entra se registra una scelta fra alternative fatta da chi ha un mandato (approvare o respingere, proporre un incarico o un trasferimento, nominare un successore, assegnare un obiettivo, delegare, decidere una proposta di consolidamento, ridisegnare unità e posizioni, affidare un processo). Restano fuori le preferenze personali, le notifiche, l'anagrafica, le operazioni di piattaforma senza tenant e il reclutamento, dichiarato non attivo. Un tipo nuovo entra solo con una migrazione.

## La misura: per tenant e per settimana

```bash
psql -v ON_ERROR_STOP=1 -v tenant="'<codice del tenant>'" -f db/scripts/valore/settimana.sql
```

La query legge `sys.v_valore_settimana` e restituisce, per tenant e per settimana (dal lunedì, ora di Roma): le decisioni tracciabili, quante prese da una persona e quante da un agente, i decisori distinti, gli oggetti decisi, i tipi di decisione, le decisioni senza traccia, le persone che hanno usato pagine o agenti e gli usi orari. Il codice del tenant si legge da `sys.sys_tenancies.tenant_code`; senza `-v tenant` la query restituisce tutti i tenant.

## Come nasce un evento

L'API scrive in `audit.valore_eventi` dopo aver risposto (`apps/api/src/lib/valore/registro.ts`): una decisione per ogni risposta 2xx su una rotta del catalogo, e un uso per ogni lettura 2xx che arriva da una pagina o da un agente, al più uno per persona, superficie e ora. La superficie viaggia nell'intestazione `x-heuresys-superficie`: il web la mette su ogni chiamata con il percorso della pagina senza identificativi (`apps/web/src/lib/api/fetch.ts`), il gateway degli agenti con il codice dell'agente (`apps/agent-gateway/src/heuresys-client.ts`). Il registro non rompe mai una risposta: un errore finisce nel log come avviso.

Il modello è quello delle dichiarazioni di Experience API (xAPI, ADL) e dei modelli a eventi dell'analisi di prodotto: attore, verbo, oggetto, contesto, istante; una riga per fatto; un catalogo chiuso dei verbi.

## Limiti dichiarati

La superficie è dichiarata dal client: dice da dove è partita la richiesta, non è un'identità, e un client scorretto potrebbe dichiararne una falsa. L'identità forte degli agenti, con il «per conto di», è il mandato F3-1 (registro degli agenti).

Il registro comincia a contare dal rilascio che lo porta in produzione: le decisioni prese prima non hanno superficie e restano nelle loro tabelle di dominio.

La misura conta decisioni prese con il sistema, non ancora decisioni diverse da quelle che si sarebbero prese senza: per quello servono un confronto prima e dopo, per esempio sullo stesso tipo di decisione in unità che usano le pagine e in unità che non le usano. È il lavoro di F4-6 (adozione misurata), che userà questo registro.

GDPR: la colonna dell'attore è registrata in `sys.sys_gdpr_data_map` come riferimento di autore (`ACTOR`) e conservata come registro di accountability (`RETAIN`); non entra nel fascicolo dell'art. 15 perché porterebbe decisioni prese su altre persone.
