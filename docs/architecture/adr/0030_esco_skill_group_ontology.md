# ADR-0030 — Ontologia competenze ESCO come cittadino di prim'ordine (`sys_skill_groups`)

**Status**: Accepted (S1024, 2026-07-21)
**Context**: mandato forense S1023 Fase 2.5 (ontologia); decisione Enzo S1024 = ontologia 100%. Dataset: ESCO ufficiale v1.2.0 IT (`db/data/esco/README.md`).
**Decision authority**: Claude (technical decision per `feedback_claude_decides_technical`, S1022)

## Context

Census F2.5 (S1024): **8.360 competenze isolate** (0 edge tassonomico). I
`skill_group_uri`/`broader_uri` in `sys_skills.skill_metadata` sono **stale**:
400 gruppi distinti, **0 match** con il dataset ESCO ufficiale (importati da una
risoluzione live parziale precedente, mai completata). L'ontologia ESCO reale
non è skill→skill: è **skill → gruppo → gerarchia-gruppi**, con un ramo
secondario skill→skill IS-A. Fonte autoritativa = il dump `broaderRelations`
(20.822 relazioni), ancorato su `skill_esco_uri`.

## Decision

1. **I gruppi ESCO diventano una tabella di prim'ordine** `sys.sys_skill_groups`
   (reference data **globale**, senza tenant — come le skill globali):
   `skill_group_id` = **UUID v5 (RFC-4122)** deterministico dall'URI ESCO
   (stabile cross-DB, memoria `reference_deterministic_seed_uuid_rfc4122`),
   `esco_uri` UNIQUE, `name`/`description` IT, `code`, **`parent_id` self-FK**
   per la gerarchia (ON DELETE SET NULL).
2. **`sys_skills.skill_group_id`** — FK nullable → il gruppo primario della skill
   (`broaderHierarchyConcept` ESCO). NON si riusano i `skill_group_uri` stale.
3. **skill→skill IS-A** si appoggia alla tabella esistente
   `sys_skill_taxonomy_edges` con `kind='IS_A'` (già ammesso dal CHECK) — nessuno
   schema nuovo; `metadata.source='ESCO_v1.2.0'`.
4. **Popolamento** dal dump in `db/scripts/populate-skill-ontology-it.sql`
   (dati, non schema — pattern seed): 640 gruppi + 636 archi di gerarchia +
   13.647 legami skill→gruppo + 6.456 edge IS-A. Idempotente.

## Alternatives rejected

- **Riusare `skill_metadata->>'skill_group_uri'`**: stale (0 match col dump ESCO),
  perpetuerebbe dati sbagliati.
- **Gruppi come righe di `sys_skills` (`skill_kind='GROUP'`)**: sporcherebbe il
  catalogo competenze e i conteggi/ricerche; un gruppo non è una competenza.
- **Gruppi come `sys_skill_categories`**: quella tabella è un piano semantico
  diverso (7 categorie di dominio, non i ~640 concept-group ISCED/ESCO).

## Consequences

- Copertura ontologica **99,4%**: 13.952/14.041 skill collegate (gruppo o edge);
  89 scollegate reali = competenze custom `COMP::` senza URI ESCO (legittimamente
  fuori dall'ontologia ESCO) + 70 URI non nel dump v1.2.0.
- Gerarchia gruppi a 4 livelli, **aciclica** (verificato con CTE ricorsiva).
- `sys_skill_groups` è registrata come entità traducibile (ADR-0029): i nomi IT
  sono in-row, l'EN potrà essere harvestato dal dump ESCO inglese in un secondo
  momento.
- La gap-analysis / semantic-matching possono ora navigare la gerarchia dei
  gruppi (prima assente); i `skill_group_uri` stale restano nei metadata come
  storia, non più autorità (candidati a cleanup).
