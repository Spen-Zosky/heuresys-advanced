# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-17 (S1067).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`.

⚠ **`#132` HA CAMBIATO NATURA (E29)**: non produce più solo i processi, produce **il modello con cui
l'azienda viene costruita**, e l'archetipo scritto a mano **sparisce senza lasciare traccia**.
Piano in 8 fasi: `.programmi/132-ricerca-genera-il-modello.md`. Prima di aprirla, leggilo.

## Last session brief (S1067 «l'interruttore, e la domanda che ha smontato l'archetipo»)

Ciclo batch chiuso su tutte le voci, poi il lavoro è andato dove Enzo l'ha portato. Il motore che
costruisce un'azienda da un fascicolo è arrivato **a 7 task su 9**: costruisce da un piano senza
sapere da dove viene, l'atto è transazionale e registra ogni riga creata, e ora **le rotte lo
raggiungono** — fino a stamattina il meccanismo esisteva ma nessuno poteva azionarlo.

Il filo vero però è un altro: alla prova live del T6 Enzo ha chiesto **da dove venissero i numeri**.
Venivano da un file scritto a mano con **un solo archetipo**, una banca con tre filiali: il fascicolo
di un ospedale avrebbe prodotto la stessa banca. Da lì la decisione di ritirarlo e far generare il
modello dalla ricerca. Tre misure hanno riscritto la difficoltà del lavoro: il ritiro **non costa
dati** (l'archetipo non ha mai costruito niente in produzione), il confine per sostituirlo era stato
creato **quella stessa mattina**, e il vero ostacolo non era in nessun piano — **il contenuto di un
modello non ha dove stare**.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti o task incompleti; doppia verifica e review
adversarial; le decisioni tecniche sono di Claude.

## Top priorities (prossima sessione)

1. **`#132` F0 → F1** — F0 è piccola e va prima di tutto (i sei parametri obbligatori della ricerca +
   il vincolo fascia↔numero che **oggi non esiste**: si può dichiarare `XS` con 5000 addetti). F1 è
   dove vive il contenuto di un modello, e tocca `db/**` → **prova generale sul linux-pc prima del
   push** · `.programmi/132-ricerca-genera-il-modello.md`
2. **`#198` T7** — le due pagine (costruzione e registro) nel prodotto. Non dipende da dove nasce il
   modello, quindi si può intercalare in qualunque momento · `resume-from: T7`
3. **`#211` la cura della famiglia ①** — la suite E2E completa non può essere verde finché dura più
   dei 15 minuti di una sessione: da decidere se rinnovare i cookie dentro la corsa o rigenerare lo
   `storageState` per blocco

## Open questions

- **`#213`** — cinque percorsi formativi non hanno titolare e non sono catalogo comune: **nessuna
  azienda li vede**. Tre si chiamano `OLDDB::learning_paths::<uuid>`. A chi appartengono è una scelta
  di prodotto, non tecnica.
- **`#214`** — il criterio della coda dell'agente ha un buco: «più classi» non conta fra le riservate,
  quindi `analytics` passa fra i «neutri» pur toccando dati di persona. Chiudere il buco o aprire
  `positions` (il primo davvero neutro)?
- **`#197`** resta aperta a metà per costruzione: la sua seconda condizione è il T9 di `#198`.

## Verification

```bash
python docs/kb/tools/session_start.py               # menu + salute, un colpo solo
python docs/kb/tools/handoff_lint.py                # cancello di coerenza, bloccante
python docs/kb/tools/programmi.py                   # da dove riprendono gli 8 programmi
bash scripts/verifica-deploy.sh                     # DEPLOYATO · IN-VOLO · CI-ROSSA · DISALLINEATO · NON-VERIFICATO
```

⚠ **La verifica lunga si esegue sul linux-pc, non qui** (standard S1054):
```bash
ssh linux-pc 'source ~/.nvm/nvm.sh; nvm use 22; cd ~/heuresys-advanced/apps/api && pnpm exec vitest run'
```
