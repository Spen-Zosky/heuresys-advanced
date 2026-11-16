# Endpoint senza consumatori: misura e classificazione (2026-11-16, main 44ac94c)

Sola lettura. Nessun endpoint è stato toccato.

## Misura (correzione al rapporto del 31/10)

- Lo strumento V1 (`/mnt/project-files/analisi-interfacce/V1_inventario`) conta 775 righe, ma le rotte reali sono 727: nel file `apps/api/src/modules/tenant-consolidation/routes.ts` registra ogni rotta sotto tutti e tre i prefissi (`tenant-consolidations`, `consolidation-vocabulary`, `consolidation-runs`) mentre ciascun prefisso ne ha solo alcune. 48 righe sono fantasma, 43 fra gli orfani.
- Orfani V1 reali: 343 su 727. Tolti i 18 falsi (un chiamante c'è), le 140 letture esposte all'agente (`docs/kb/atlas/agent-operations.json`) e le 6 pubbliche (login e annuncio pubblico), restano **179 orfani veri**, il 25% delle rotte reali. I test non contano come consumatori.

## Come ripetere

1. `HEURESYS_ADVANCED=<repo> HEURESYS_DATASTORE=<repo datastore> bash <V1>/strumenti/esegui_tutto.sh <uscita>`
2. `python3 misura_orfani.py <uscita> orfani.json` (dalla radice del repo)
3. `python3 classifica.py <uscita> orfani.json ENDPOINT_ORFANI_CLASSIFICATI_20261116.tsv`

## Classi (colonna `classe` del TSV)

- `a` manca la schermata: `destinazione` dice quale pagina (esistente o nuova).
- `b` da affidare all'agente: strumento con approvazione umana (`apps/agent-gateway/src/write-gate.ts`), nessuna scrittura da sola.
- `c` superata: si ritira disattivando (stato o validità), non si cancella (ADR-0035).
- `fantasma`: riga dell'estrattore senza rotta vera, da ignorare.

La classificazione è una proposta ragionata: la colonna `fiducia` dice quanto è solida (alta = verificata nel codice, media = coerente con il modulo, bassa = ipotesi da confermare con Enzo). La colonna `prova` cita file e riga. Le ondate sono in `ondata`.
