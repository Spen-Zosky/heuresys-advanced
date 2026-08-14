# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-14 (S1058).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`.

## Last session brief (S1058)

Tre fili. **Il punto fisso**: *un dato che per sua natura può variare si misura prima di
prenderlo per buono* — enunciato una volta sola in testa al `CLAUDE.md` dopo aver misurato che
era già scritto **sei volte nello stesso file**, ognuna per la sua materia e nessuna in generale.
L'ho enunciato dopo averlo violato, su rilievo di Enzo.

**Il rubinetto chiuso**: il brownfield non è più una fonte. Non un paragrafo — un ADR, un
invariante riscritto e un **cancello automatico**, che alla prima corsa ha segnalato sé stesso e
alla seconda ha trovato un file mancato dal censimento a mano: un modello di istruzioni che
mandava un agente a censire il legacy «per sapere cosa resta da importare».

**Le voci lunghe hanno una casa**: sette programmi in fasi da una sessione, stato su disco,
ripresa stampata dal boot. Tre prime fasi chiuse, ognuna ha sciolto un nodo invece di aprirne uno.

**Tema ricorrente, terza sessione di fila**: quasi ogni documento diceva qualcosa che il dato
smentiva — i sondaggi «che nessuno legge» erano letti da quattro moduli, i 139mila archi «da
importare» non esistevano ed erano stati esclusi apposta perché derivati.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti o task incompleti; doppia verifica e review
adversarial; le decisioni tecniche sono di Claude.

## Top priorities (prossima sessione)

1. **Il menu ora ha una corsia nuova**: `python docs/kb/tools/programmi.py` dice da dove si
   riprende ogni voce lunga. Le tre più mature: **#99 F3** (il resolver sull'albero delle unità —
   è la radice del ramo: sblocca #142 F2/F3), **#92 F4** (scritture del ciclo di valutazione, ma
   prima va sciolto il rilievo sul mapping RBAC più largo del disegno), **#50 F2** (il grafo delle
   competenze, ora che si sa che non va importato ma costruito).
2. **#187 è nato P1 e non è ancora stato toccato**: l'indice di salute organizzativa calcola su
   sondaggi fermi a gennaio 2025 mentre la rilevazione vera è aperta. È il difetto più concreto
   emerso oggi.
3. **#69 si è sbloccato e dimagrito**: resta la bonifica dei residui `staging.wave1_*` nel nostro
   database — piccola e senza dipendenze. Buona da aggregare a qualcosa di più grande.

## Open questions

- **#50 ha una strada sola ma un titolo nuovo**: il grafo si costruisce dai dati che abbiamo. Va
  confermato che la vista `/visualizations` sia la sede giusta, o se merita una pagina propria.
- **#54 F2 comincia da una scelta di modello** (quali entità del recruiting servono davvero) ora
  che l'import è escluso: è la prima fase che non ha più una sorgente da cui copiare la forma.
- **D-60 resta aperto e il rubinetto chiuso non lo tocca**: la password del database è condivisa
  con lo stack evo. È sicurezza, non ingestione.

## Verification

```bash
python docs/kb/tools/session_start.py                        # menu + salute, un giro
python docs/kb/tools/programmi.py                            # voci multi-sessione: da dove si riprende
python docs/kb/tools/guardiano.py --sorveglia                # contesto + finestra 5h (regola OR)
python docs/kb/tools/check_completezza_self.py               # completezza di `self` (C4/I17)
python docs/kb/tools/check_exposure.py                       # cancello di esposizione
python docs/kb/tools/check_no_legacy_ingest.py               # il rubinetto brownfield e' chiuso (ADR-0038)
sh scripts/hooks/hook.sh selftest                            # guardia di sessione
ssh linux-pc 'cd ~/heuresys-advanced && bash db/scripts/ci-rehearsal.sh'   # prova generale
```
