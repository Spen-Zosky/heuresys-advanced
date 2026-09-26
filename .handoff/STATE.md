# STATE — vista rapida

*Ultimo aggiornamento: S1113 (2026-09-26), mandato Cowork ciclo 3 passaggio 3 — `#252` chiusa: il
ponte di approvazione umana si aggancia anche alle letture. I numeri stanno in
`docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

**`#252` DONE** (ADR-0040 R2, secondo dei tre passi che precedono `#254`). Oltre la soglia alta di
persone distinte anche una **lettura** si ferma e chiede conferma, passando dallo stesso ponte delle
scritture. Non è un tetto: chi conferma legge tutto il suo tenant (I22) e l'assenso vale per il
resto della conversazione, mentre il diniego vale per la singola chiamata — fra i dinieghi c'è il
timeout, che non è un atto umano. Tre casi fanno chiedere: livello `confermato`, `non-misurato`, e
**contatore assente**. Prova LIVE con login reale e secondo fattore: negata, l'agente si ferma a 55
persone; confermata a 56, riprende — 14 criteri su 14. Cinque rossi visti, due non cercati.

**Un difetto del presidio trovato e chiuso** (terza volta la stessa forma, dopo C2 e `#251`
F0b/F0c): il typecheck del gateway non includeva `scripts/`, quindi era verde su un errore di tipo
dentro l'unico strumento che dimostra il freno sul vivo. Controprova misurata; ora il typecheck del
pacchetto esegue due progetti.

**La prova LIVE ha girato contro il database vivo** — «in locale» qui significa opzione B. Le righe
che ne sono nate sono misurate, attribuite una per una e **lasciate dove sono** (dettaglio in
`.programmi/esiti-ciclo3/252.md`): nessun dato di dominio toccato.

**Nessuna propagazione, nessun armamento, nessun rilascio in questa sessione** — vietati dal
mandato del ciclo 3, li esegue il governo alla fine del ciclo. `refs/heads/prod` non spostato.

## Top priorities

1. **`#253`** (il diario del gate diventa interrogabile: id di conversazione, tabella in `audit`,
   vista sentinella) — P2, ~1 sessione: è il **terzo e ultimo** passo prima di `#254`, e adesso
   serve di più, perché le decisioni che contano (fermate e riprese oltre soglia) vivono solo in un
   JSONL. Pretende `runId` nella voce + `DbAuditSink` + migrazione.
2. **`#254`** (l'apertura di tutti i perimetri in una mossa) — resta GATED sul solo `#253`.
3. **`#260` — le due chiavi di collaudo sul linux-pc** (P2, pochi minuti sulla macchina): invariata.
4. Poi: `#149` F4 · `#159` F3 · `#257` · `#255` · `#205` F2 · `#256` · `#76` F3 · `#79` F3.

## Open questions

- **Oltre la soglia si ferma QUALUNQUE lettura, anche di soli metadati.** Nella corsa verde le due
  fermate sono cadute su `hrx_concepts_search`, che non porta dati di persona. È il verso
  conservativo e costa **una** domanda per conversazione (poi vale l'assenso). Distinguere metadati
  da dati sarebbe una decisione di prodotto da dichiarare, non una pulizia di passaggio.
- **Il limite di `#251` è ora anche il limite di `#252`**: se il web riprenderà una conversazione
  (`resume`), sia il contatore sia il **consenso** devono seguire quell'identificativo. Oggi vivono
  nella chiusura di `runHrAgent`, che è esattamente una conversazione: una ripresa ripartirebbe da
  zero, cioè il freno si aggirerebbe riprendendo.
- **Non misurato**: il comportamento del freno con `AGENT_GATEWAY_SUBSCRIPTION_AUTH` assente, e su
  un tenant diverso da RTL Bank (le soglie derivano dal tenant più grande).

## Verification

```bash
python docs/kb/tools/session_start.py
python docs/kb/tools/handoff_lint.py                      # atteso: 0 FAIL
python docs/kb/tools/aggiorna_numeri_sot.py --check       # atteso: exit 0
cd apps/agent-gateway && pnpm exec vitest run             # atteso: 147/147
cd apps/agent-gateway && pnpm run typecheck               # atteso: 0, e include scripts/
python docs/kb/tools/verify_gate.py run                    # atteso: GREEN
```
