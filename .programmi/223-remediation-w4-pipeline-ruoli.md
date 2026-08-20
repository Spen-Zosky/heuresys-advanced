# #223 — Remediation forense W4 · Pipeline, separazione ruoli, prestazioni

**Capofila del programma**: `.programmi/220-remediation-dossier-forense.md` — fonte, metodo vincolante, fuori-perimetro (incluso F8-02 chiuso per decisione: status quo RPO 24h accettato, Enzo 2026-08-20). Effort: ~120-200k token.

| id | rilievi | cosa | stato |
|---|---|---|---|
| W4.1 | F3-02 | UPDATE condizionale in `upsertEscoSkillHierarchy` (`modules/reference-sync/repository.ts`): oggi riscriverebbe ~14.000 righe identiche a ogni corsa | da fare |
| W4.2 | F3-09 | `@migrate: once` sulle migrazioni pesanti (000120 = 65,4s in testa); misura della catena prima/dopo. Ridimensionato S1075: il tick oneshot non si sovrappone, ma 000007 risulta eseguita 347× | da fare |
| W4.3 | F5-01, F4-08 | separazione ruoli migrator/app/readonly — voce grossa: tocca deploy, `.env`, pool API. Simulazione R24 completa PRIMA di aprire | da fare |
| W4.4 | F8-06, F8-14 | `shared_buffers` 128MB su 11GB (VM condivisa fra 7 progetti: misurare la RAM libera prima; restart pianificato) | da fare |
| W4.5 | F8-09 | segnale di staleness della copia locale (porta 5435, oggi vecchia di 5 settimane e muta) | da fare |
| W4.6 | A-03, A-10, A-11 | igiene: 3 sorgenti dichiarate vs 5 nel DB; tabella vuota da 944kB; 7 numeri stantii nella doc di progetto | da fare |
