# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-17 (S1068).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`.

⚠ **IL MOTORE COSTRUISCE, MA COSTRUISCE SEMPRE UNA BANCA.** `#198` è a **8 task su 9**, ma la
sorgente resta l'archetipo `RETAIL_BANK_REFERENCE` — **7 unità e 11 posizioni** contro le
**158** di RTL vera: un fascicolo di qualunque settore produrrebbe quella banca. È la ragione
di `#132` e la risposta alla domanda di Enzo a fine sessione (→ Top priorities).

## Last session brief (S1068 «sette difetti trovati eseguendo, cinque nei miei strumenti»)

**Ciclo NON chiuso: 7 voci su 13**, confine dichiarato all'apertura e ragione accanto a ognuna
delle sei non aperte → `.programmi/mandati/mandato-S1068-p3-p1-p2.md`; cronaca in
`docs/archive/HANDOFF_S1068.md` (**non SoT**).

Il filo: **sette difetti trovati eseguendo, non ragionando** — cinque nei miei stessi strumenti
di misura, compresi due rimedi che contenevano la bugia che stavano correggendo.

⚠ **FUORI REPO, e non si vede dal git log**: un pacchetto di skill installato il 2026-08-17
alle 17:57 aveva **sovrascritto `handoff` e `code-review`** con versioni omonime, e la chiusura
di S1068 è partita su quella sbagliata (stato non aggiornato). Le 26 skill sono state rimosse,
le originali ripristinate dal linux-pc, backup in
`[Backup]/matt-pocock-skills-rimosse_20260818`. → memoria `skill_name_collision_masking`.
## Top priorities (prossima sessione)

1. **Il campo di prova + `#198` T9** — è ciò che Enzo ha chiesto esplicitamente a fine
   sessione: *«se e quando sarà possibile testare la creazione di un nuovo tenant/azienda»*.
   Serve la procedura sul **gemello** (E27) con `scripts/banco_tenant.py` coi due pulsanti
   *crea usa-e-getta* / *disfa*, poi T9: creare un'azienda vera, costruirla, misurarla,
   archiviarla. **Nessuna dipendenza aperta · ~1 sessione** · chiude `#198` e sblocca `#197`
2. **`#132` F1** — dove vive il contenuto di un modello (unità/posizioni/competenze/
   indicatori). Tocca `db/**` → **prova generale sul linux-pc prima del push**. È la fase più
   grossa del programma · `.programmi/132-ricerca-genera-il-modello.md`
   ⚠ **La stima «~2 sessioni» nel register è del 5 agosto**, precedente alla riscrittura
   E29/E30 che ha cambiato la natura della voce. Con le 7 fasi residue la stima onesta —
   **dichiarata, non misurata** — è 4-6 sessioni
3. **`#211`** — le famiglie ②③④⑤⑥ (18 casi) e il reperto degli **80 casi non eseguiti**, causa
   **non isolata** (escluse `maxFailures` e i blocchi `serial`)

## Open questions

- **`#215`** (nuova) — lo stato impossibile di `#213` in altre due tabelle, ma la cura è
  **l'opposto**: le 29 righe di `sys_compensation_bands` sono i **CCNL e i sindacati**, che I21
  vuole aperti a ogni industria — classificate male, non residui. Cancellarle sarebbe stato l'errore
- **`apps/web/next-env.d.ts`** — riscritto da `next build`, oscilla fra build di sviluppo e di
  produzione. Va deciso **una volta** come trattarlo, o torna a ogni corsa
- **Commit locali non pushati**: il push non è stato autorizzato in S1068 (l'autorizzazione è
  per-sessione)
- **`#197`** resta aperta a metà per costruzione: la sua seconda condizione è il T9 di `#198`

## Verification

```bash
python docs/kb/tools/session_start.py               # menu + salute, un colpo solo
python docs/kb/tools/handoff_lint.py                # cancello di coerenza, bloccante
python docs/kb/tools/programmi.py                   # da dove riprendono gli 8 programmi
bash scripts/verifica-deploy.sh                     # DEPLOYATO · IN-VOLO · CI-ROSSA · DISALLINEATO · NON-VERIFICATO
ssh linux-pc 'source ~/.nvm/nvm.sh; nvm use 22; cd ~/heuresys-advanced/apps/api && pnpm exec vitest run'
```

⚠ La verifica lunga si esegue **sul linux-pc, non qui** (standard S1054). La suite E2E
completa passa ora da un wrapper a fasi (`#211` ①): `cd apps/web && pnpm test:e2e:prod`,
che esce **rosso** anche a fasi verdi se un caso non è stato eseguito.
