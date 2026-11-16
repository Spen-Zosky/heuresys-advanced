# Endpoint senza consumatori: misura e classificazione (2026-11-16, main 44ac94c)

Sola lettura. Nessun endpoint è stato toccato.

## Misura (correzione al rapporto del 31/10)

- Lo strumento V1 contava 775 righe, ma le rotte reali sono 727: nel file `apps/api/src/modules/tenant-consolidation/routes.ts` attribuiva a ognuno dei tre prefissi (`tenant-consolidations`, `consolidation-vocabulary`, `consolidation-runs`) tutte le rotte del file, mentre ciascun prefisso ne ha solo alcune. L'estrattore corretto è `estrai_rotte_corretto.py` (assegna a ogni prefisso solo le rotte del suo plugin) e dà 727.
- Orfani V1 sulle 727 rotte reali: 340. Tolti i 18 falsi (un chiamante c'è), le 140 letture esposte all'agente (`docs/kb/atlas/agent-operations.json`) e le 6 pubbliche (login e annuncio pubblico), restano **176 orfani veri**, il 24%. I test non contano come consumatori.
- Onda 1 (questa PR): vocabolario comune e distanza dal modello nella pagina `/consolidation`: tre rotte che smettono di essere orfane.

## Come ripetere

0. Sostituire `estrai_rotte.py` di V1 con `estrai_rotte_corretto.py`.
1. `HEURESYS_ADVANCED=<repo> HEURESYS_DATASTORE=<repo datastore> bash <V1>/strumenti/esegui_tutto.sh <uscita>`
2. `python3 misura_orfani.py <uscita> orfani.json` (dalla radice del repo)
3. `python3 classifica.py <uscita> orfani.json ENDPOINT_ORFANI_CLASSIFICATI_20261116.tsv`

## Classi (colonna `classe` del TSV)

- `a` manca la schermata: `destinazione` dice quale pagina (esistente o nuova).
- `b` da affidare all'agente: strumento con approvazione umana (`apps/agent-gateway/src/write-gate.ts`), nessuna scrittura da sola.
- `c` superata: si ritira disattivando (stato o validità), non si cancella (ADR-0035).
- `fantasma`: riga dell'estrattore senza rotta vera, da ignorare.

La classificazione è una proposta ragionata: la colonna `fiducia` dice quanto è solida (alta = verificata nel codice, media = coerente con il modulo, bassa = ipotesi da confermare con Enzo). La colonna `prova` cita file e riga. Le ondate sono in `ondata`.
