# model-map.md — selezione modello×effort per agente (token-optimized, qualita' garantita)

| Attivita' | model | effort | Razionale |
|---|---|---|---|
| Inventari meccanici (ops, liste, mtime, probe) | haiku | low | estrazione senza giudizio |
| Sweep semantico code-chunk (api/web/shared) | sonnet | low | file:line affidabile al minor costo |
| db-live + legacy (SQL/SSH, precisione) | sonnet | medium | query esatte, zero allucinazioni |
| Sintesi curated + verify adversariale | (omesso = modello di sessione) | high | il giudizio non si delega in giu' |
| Modi query e dossier | main loop, ZERO subagenti | — | l'atlas esiste apposta |

Regole:
1. Fallback: in dubbio OMETTI `model` (eredita la sessione). MAI downgrade su task di giudizio.
2. Promozione adattiva (self-learning): se il coverage check scarta frammenti di una famiglia
   per 2 run consecutivi → promuovi quella famiglia di un gradino (haiku→sonnet, sonnet→sessione),
   registra il perche' nel run-record e l'override in `atlas.config.yaml → adaptive.model_overrides`.
3. Demozione: consentita SOLO manualmente (mai automatica).
