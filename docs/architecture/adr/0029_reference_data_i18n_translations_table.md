# ADR-0029 — i18n dei dati di riferimento: IT canonico in-row + tabella centrale `sys_reference_translations`

**Status**: Accepted (S1024, 2026-07-21)
**Context**: mandato forense S1023 Fase 2.6 (`docs/kb/NEXT_SESSION_DB_FRONTEND_FORENSICS_KICKOFF.md` §2.6); survey in `docs/kb/db-forensics/F2_DB_CENSUS_2026-07-21.md` §5
**Decision authority**: Claude (technical decision per `feedback_claude_decides_technical`, S1022)

## Context

La UI statica è già bilingue (i18next, IT default, parity check `pnpm i18n:check`).
Il **dato dinamico dal DB è monolingua e bypassa i18next**: nessun endpoint
seleziona testo per locale. Stato misurato (S1024):

- Reference data IT-ificato **distruttivamente in-place** (mig 000156-000162,
  G-01/S1006): gli EN originali non sono più nel DB.
- Descrizioni skill 100% EN su 14.093 righe (nomi IT / corpi EN).
- Liste MISTE EN/IT: `sys_kpi_definitions` (243), `sys_job_roles` (136).
- Cataloghi governance interamente EN: permissions 182, roles 13,
  skill_families 77, categories 7, proficiency_levels 6, goal_templates 40,
  operating_model_catalog 6.
- Zero infrastruttura: 0 tabelle translation, 0 jsonb multilingua; l'unica
  coppia parallela (`sys_organization_unit_templates.name_en`, 225 righe) non
  è mai letta dall'API.

## Decision

1. **Lingua canonica in-row = IT** (conferma e completa la direzione G-01):
   i cataloghi ancora EN vengono IT-ificati in-row; il valore EN preesistente
   NON si butta — migra contestualmente nella tabella traduzioni.
2. **Una tabella centrale** `sys.sys_reference_translations`
   (`entity_table`, `entity_id uuid`, `field`, `locale varchar(5) CHECK IN ('en')`,
   `text`, `source CHECK IN ('HARVEST','ESCO','LLM','MANUAL')`,
   `UNIQUE(entity_table, entity_id, field, locale)`). Riferimento polimorfico
   **by-design** (stessa classe di `sys_inbox_notifications`, D-54): niente FK,
   integrità presidiata da vista orfani `sys.v_reference_translation_orphans`
   + adozione dell'helper cleanup sui hard-delete path.
3. **Risoluzione locale nell'API**: il fetch-layer web propaga l'header
   `x-locale` (dal cookie `NEXT_LOCALE`); un helper condiviso
   (`apps/api/src/lib/i18n/translate.ts`) fa overlay batch dei campi traducibili
   dichiarati per modulo; **fallback sempre al canonico IT** (mai buchi).
4. **Rollout a onde**: wave-1 = cataloghi governance (roles, permissions,
   skill families/categories/proficiency, goal_templates, operating_model,
   nomi EN residui di kpi_definitions e job_roles) — IT in-row + EN in
   translations nello stesso movimento. Le 14.093 descrizioni skill EN→IT
   sono un pipeline dedicato (ESCO API multilingua per le ~12.9k con URI, LLM
   per il resto) registrato come item a sé.

## Alternatives rejected

- **Colonne per-lingua (`name_en`, `description_en`, …)**: churn di schema su
  ~25 tabelle × N campi, non scala a lingue future, duplica i contratti Zod.
- **JSONB multilingua per-riga**: rompe l'ergonomia dei tipi Zod-inferred e
  degli indici/unique esistenti sui campi testo; partial-update rischiosi.
- **Traduzione runtime lato frontend**: il testo DB bypasserebbe comunque i
  cataloghi; nessuna fonte EN affidabile client-side; costi/latenza.

## Consequences

- Un utente EN riceve i cataloghi in EN dove la traduzione esiste, IT altrove
  (fallback esplicito, mai vuoto). Un utente IT non cambia nulla.
- Le migration future che aggiungono reference data DEVONO fornire il testo IT
  canonico e POSSONO fornire la riga EN in translations.
- La vista orfani entra nel giro di controlli (handoff/status_dashboard).
- `organization_unit_templates.name_en` (unica coppia legacy) verrà migrata
  nella tabella centrale e la colonna deprecata in una migration successiva.
