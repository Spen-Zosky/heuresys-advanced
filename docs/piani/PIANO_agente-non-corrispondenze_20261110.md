# Piano — l'agente di consolidamento interpreta le non corrispondenze (2026-11-10)

Richiesta di Enzo del 2026-11-10 (thread «Creare agente esperto bancario per le non corrispondenze»): un agente con competenze forti sul settore del tenant che, confrontando una corsa del datastore con i dati reali del tenant, interpreti ogni non corrispondenza e proponga una soluzione motivata; come passaggio preliminare, che riduca la polverizzazione dei processi con accorpamenti coerenti in tutti e due i lati; e che trovi criteri di consolidamento per ciascuno dei 22 domini del confronto. Documento di lavoro con analisi, proposte e criteri: https://claude.ai/artifact/RUA1rvyQRp8VmQsrwLpZPt

## Decisioni di Enzo

| data | decisione |
| --- | --- |
| 2026-11-10 | Si estende l'agente di consolidamento del tenant che c'è già, non se ne crea uno nuovo. |
| 2026-11-10 | Approvato il catalogo dei 21 processi unici qui sotto; si resta a 21, con il Legale separato dalla Compliance. |
| 2026-11-10 | Nell'armonizzazione la corsa è la fonte di verità: molti dati del tenant cambieranno per allinearsi. Fanno eccezione le filiali, che restano quelle reali del tenant, con il modello di filiale della corsa applicato a ciascuna. |
| 2026-11-10 | Le catene gerarchiche e funzionali devono essere coerenti: chi lavora in filiale risponde alla catena della filiale. |
| 2026-11-10 | Sola lettura e proposte finché Enzo non approva le scritture. |

La terza decisione rovescia, per questo caso, la regola R-13 della specifica dell'agente (il prototipo prende la lingua del tenant): l'interprete riceve la fonte di verità come parametro (`sourceOfTruth`), invece di averla scritta dentro.

## Il catalogo dei 21 processi (corsa p20261010010521tjb e RTL Bank)

| # | Processo unico | Corsa | RTL | Azione |
| --- | --- | --- | --- | --- |
| 1 | Strategia e governance aziendale | P01 + P02 + P06 | 00 | accorpa |
| 2 | Compliance e reportistica regolamentare | P03 | 11 | tieni |
| 3 | KYC / AML | fasi 11.1.4.8, 5.4.4.2, 5.4.4.3 | 02 | ricolloca le fasi |
| 4 | Gestione del rischio | P04 (senza AML) + P05 | 10 | accorpa |
| 5 | Audit interno | P07 | 12 | tieni, rinomina la corsa |
| 6 | Marketing e comunicazione | P08 + P09 + P10 | 15 | accorpa |
| 7 | Acquisizione e onboarding clienti | P11 (fasi commerciali) | 01 | tieni, ripulisci |
| 8 | Apertura e gestione conti | P12 + P13 + P14 | 03 | accorpa |
| 9 | Pagamenti e bonifici | P17 | 04 | tieni |
| 10 | Erogazione del credito | fasi di credito di P16, P12, P20 | 05 | ricolloca le fasi |
| 11 | Monitoraggio e recupero crediti | nessuno | 06 | adotta nella corsa |
| 12 | Tesoreria e ALM | P21 + fasi di liquidità di P20 | 09 | accorpa |
| 13 | Operatività di filiale | P15 + fasi di servizio di P16 | 13 | accorpa |
| 14 | Servizio clienti | P18 + P19 | 14 | accorpa |
| 15 | Gestione del capitale umano | P22 + P23 + P24 + P25 + P28 | 17 | accorpa |
| 16 | IT e cybersecurity | P26 | 16 + 22 | accorpa in RTL |
| 17 | Finanza e contabilità | P27 | 18 | tieni |
| 18 | Approvvigionamenti e gestione fornitori | P29 | 19 | tieni |
| 19 | Facility e immobili | P30 | 20 | tieni |
| 20 | Servizi di investimento | nessuno | 07 + 08 | accorpa in RTL, adotta nella corsa |
| 21 | Legale | nessuno | 21 | adotta nella corsa |

Con la corsa come fonte di verità, il nome del processo unico si prende dalla corsa quando la corsa ce l'ha; i processi obbligatori che la corsa non ha (11, 20, e l'antiriciclaggio come processo distinto) si aggiungono alla corsa.

## Voci

| id | cosa | chi | fatta quando | stato |
| --- | --- | --- | --- | --- |
| NC-1 | Profilo di settore bancario e criteri dei 22 domini (`apps/agent-gateway/src/settori/profili.ts`) | Claude | prove verdi | FATTO |
| NC-2 | Interprete delle non corrispondenze, rotta `POST /consolidation/interpret` (`apps/agent-gateway/src/consolidation-interpret.ts`) | Claude | prove verdi | FATTO |
| NC-3 | Giro vero dell'interprete sui Processi, dalla VM, con l'abbonamento | Claude | proposte confrontate con il giro a mano del 2026-11-10 | ACTIVE, dopo l'unione e il rilascio |
| NC-4 | Cliente dell'interprete nell'API e comando che lancia un dominio su una corsa e un tenant, in sola lettura | Claude | prova dal vivo | ACTIVE |
| NC-5 | Verifica delle catene persona per persona in RTL | Claude | riporti letti dal dump | WAIT-INPUT: riporti chiesti al thread dei ruoli |
| NC-6 | Applicazione delle proposte approvate | advanced, dopo il sì di Enzo | dimostrazione dal vivo | GATED: Enzo approva le scritture |

## Fuori da questo ciclo

Gli altri 21 domini girano dopo i Processi, uno alla volta, con i criteri di `profili.ts`; le scritture nel tenant aspettano il sì di Enzo.
