# Wargames — battle plan eseguibili (2026-07-06)

Battle plan prodotti da Claude Fable 5 (Cowork) il 2026-07-06, prima dell'uscita di Fable dalle subscription Claude Code. Ogni piano è una simulazione mossa-per-mossa (azione → osservazione attesa → fallimento probabile → contro-mossa, fork con trigger, abort condition, verification run) progettata per essere eseguita **blind** da Claude Code CLI su un modello inferiore, senza fare domande.

Questa directory è **self-contained** — tutto ciò che serve è qui dentro:

- `NN-*.md` — i battle plan (il deliverable da eseguire)
- `SUCCESS.md` — lo standard a 8 punti che ogni piano deve rispettare (usato per il grading)
- `reviews/REVIEW-NN.md` — le review adversariali indipendenti (spot-check evidenze contro repo/web); le patch sono GIÀ integrate nei piani
- `tasks/NN-*.md` — i mission brief originali (WARGAME ORDER + brief): servono solo per ri-wargamare una missione da capo o crearne di nuove sullo stesso stampo
- `LEDGER.md` — registro dei run: self-grade, esiti review, patch applicate

## Come si usa

Da Claude Code CLI nel repo:

```
Esegui il battle plan docs/wargames/16-heuresys-approval-effects.md.
Seguilo mossa per mossa: rispetta fork trigger, abort condition e verification run.
Non deviare dal piano; se un fatto sul repo contraddice il piano, la SoT vince e lo segnali.
```

Per il setup AI locale (non è un item di backlog, vale per le tue macchine):

```
Leggi docs/wargames/03-localai.md, identifica su quale macchina stai girando
come indicato nel machine fork iniziale, ed esegui la rotta corrispondente.
```

## Mappa piano → backlog

| File | Item backlog | Oggetto | Nota |
|---|---|---|---|
| 11-heuresys-evidence.md | #27 A/L2 | Evidence layer sotto gli score (explainability/AI-Act) | ~8-12h |
| 12-heuresys-goals-okr.md | #26 A/L1 | Vita dei goal/OKR (timeline sub-risorse) | zero migration, confermato da review |
| 13-heuresys-f4-activity.md | #24 F4 | Asse funzionale/attività ADR-0027 | fork A/B = decisione Enzo (RN-1) |
| 14-heuresys-provenance.md | #28 A/L0 | Trust Ledger /v1/provenance (70.972 righe lineage) | ~4h |
| 15-heuresys-pricing.md | #4 GTM | Pricing page pubblica | prezzi/tier = WAIT-INPUT Enzo (Q1-Q8) |
| 16-heuresys-approval-effects.md | #34 B/B3 | Handler approval-effects (primo flusso BPM reale) | authz H-1 = WAIT-INPUT Enzo |
| 17-heuresys-wave3.md | #17 L2/L3 | Onboarding SmartFood+EcoNova (SCRIVE IN PRODUZIONE) | rotta A/B = decisione Enzo; snapshot pre-deploy obbligatorio |
| 03-localai.md | — (fleet) | Setup AI locale multi-macchina (PC Win / Mac 2012 / VM OCI) | fork per macchina; sulla VM budget RAM/CPU per non toccare PROD |

## Decisioni aperte (WAIT-INPUT Enzo — i piani partono comunque, con default o fork)

1. **15/pricing**: question set Q1-Q8 (tier, cifre pubbliche o contact-us, unità fatturazione, annuale/mensile). Senza risposte la pagina shippa in modalità contact-card.
2. **13/F4**: master fork route A (task model generico) vs B (riuso goals) — tabella evidenze nel piano §5.3.
3. **17/Wave-3**: multi-industry (programma, 4-8 sessioni) vs reference banking (1.5-2.5 sessioni); "B ora + A dopo" supportato.
4. **16/H-1**: chi può creare richieste TENANT_MATERIALIZATION (gate creator-parity nel piano; flip se decidi diversamente).

## Creare una missione nuova

Prendi un file in `tasks/` come stampo: il wrapper WARGAME ORDER (le prime ~13 righe) resta identico, sostituisci solo il MISSION BRIEF con il tuo obiettivo e i vincoli reali. Poi chiedi al modello più capace disponibile di wargamarla contro `SUCCESS.md` e salva il risultato qui come `NN-nome.md`.

Questi file sono untracked: committali quando vuoi (suggerito: `docs(wargames): battle plans 2026-07-06 + adversarial reviews + kit standard`).
