# #221 — Remediation forense W2 · Recuperi (F7)

**Capofila del programma**: `.programmi/220-remediation-dossier-forense.md` — lì stanno fonte, verifiche S1075, decisioni di Enzo (2026-08-20) e il metodo vincolante per ogni voce. Effort: ~80-120k token.

**Decisione di Enzo 2026-08-20**: NACE + crosswalk **si ripristinano**. **Ordine**: W2.1/W2.2 solo DOPO W1.1 di #220 (finché le FK sono `CASCADE`, un ritiro di catalogo azzererebbe di nuovo il crosswalk).

| id | rilievi | cosa | fatto = | stato |
|---|---|---|---|---|
| W2.1 | F7-04 | ripristino NACE 1.066 (preferito: `reference_sync` se ha la sorgente; fallback CSV `D:\heuresys-datastore\_recupero_20260716\nace_rev2.csv` con `@migrate: once` + undo) | 1.066 misurate, gerarchia integra | da fare |
| W2.2 | F7-01 | ripristino crosswalk 5.730 (3.890 dirette + 1.840 rimappate su ATECO 2025 per codice; CSV `crosswalk_ateco_nace.csv`) | conteggio + 0 orfani + impronta = CSV | da fare |
| W2.3 | F7-02 | datazione onesta dei vettori ricalcolati (min=max=2026-06-06 con testo cambiato) | tracciabilità misurabile | da fare |
| W2.4 | F7-03 | chiusura documentale (purghe deliberate mig 000197/000200/000235/000241, misurate S1075); misurare se i 59 corsi food con 199 assegnazioni esistono ancora → se sì, domanda a Enzo | registro datastore aggiornato con evidenza | da fare |
| W2.5 | F7-06 | verifica famiglie/ruoli rimaneggiati (referto 27 del vault datastore) | confermato/smentito con misura | da fare |
| W2.6 | F8-11, F8-12 | refresh `heuresys_ci` da prod DOPO i recuperi (`clone-vm-db.sh`) | conteggi ci = prod | da fare |
