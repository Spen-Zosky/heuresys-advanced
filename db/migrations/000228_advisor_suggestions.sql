-- 000228_advisor_suggestions.sql
-- #58 F4 fase 1 — traccia di audit delle raccomandazioni prescrittive.
--
-- Perché una tabella e non solo una risposta HTTP: una raccomandazione che nessuno ha
-- registrato non è verificabile a posteriori. Se domani qualcuno chiede «su quale base la
-- piattaforma ha consigliato di assumere su questa capability?», la risposta deve esistere
-- con le citazioni che aveva quel giorno, non con quelle che risulterebbero oggi.
--
-- Le raccomandazioni sono funzione DETERMINISTICA delle scorecard F1/F2/F3: la riga qui è
-- una traccia, non uno stato di dominio. Per questo la sostituzione per tenant è totale e
-- limitata (stessa dottrina D-18 di sys_capability_scores): ri-eseguire non fa crescere la
-- tabella.
--
-- RD-08: nessun ENUM Postgres, varchar + CHECK. I codici corrispondono a
-- ADVISOR_RULES / ADVISOR_SUBJECT_TYPES in packages/shared.
-- Idempotente: IF NOT EXISTS ovunque.

CREATE TABLE IF NOT EXISTS sys.sys_advisor_suggestions (
  advisor_suggestion_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advisor_suggestion_tenant_id     uuid NOT NULL
    REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  advisor_suggestion_rule_id       varchar(48) NOT NULL,
  advisor_suggestion_subject_type  varchar(16) NOT NULL,
  advisor_suggestion_subject_id    uuid NOT NULL,
  advisor_suggestion_subject_label text NOT NULL,
  advisor_suggestion_priority      numeric(5,2) NOT NULL,
  advisor_suggestion_headline_key  varchar(120) NOT NULL,
  advisor_suggestion_headline_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Le citazioni COSÌ COME ERANO alla derivazione. È il valore probatorio della riga:
  -- ri-derivarle in lettura significherebbe non avere alcuna traccia.
  advisor_suggestion_citations     jsonb NOT NULL,
  advisor_suggestion_model_version varchar(32) NOT NULL,
  advisor_suggestion_generated_at  timestamptz NOT NULL DEFAULT now(),
  created_at                       timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sys_advisor_suggestion_subject_type_check'
  ) THEN
    ALTER TABLE sys.sys_advisor_suggestions
      ADD CONSTRAINT sys_advisor_suggestion_subject_type_check
      CHECK (advisor_suggestion_subject_type IN ('CAPABILITY', 'ORG_UNIT'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sys_advisor_suggestion_rule_id_check'
  ) THEN
    ALTER TABLE sys.sys_advisor_suggestions
      ADD CONSTRAINT sys_advisor_suggestion_rule_id_check
      CHECK (advisor_suggestion_rule_id IN (
        'CAPABILITY_GAP_ACQUIRE',
        'UNUSED_ADVANTAGE_DEPLOY',
        'ESSENTIAL_MASTERY_FRAGILE',
        'LAGGING_UNIT_INTERVENE',
        'INSUFFICIENT_COVERAGE_INSTRUMENT'
      ));
  END IF;

  -- Una raccomandazione senza fonte non deve poter entrare nemmeno passando dal database:
  -- lo schema condiviso la rifiuta, e qui il vincolo regge anche per una INSERT scritta a mano.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sys_advisor_suggestion_citations_check'
  ) THEN
    ALTER TABLE sys.sys_advisor_suggestions
      ADD CONSTRAINT sys_advisor_suggestion_citations_check
      CHECK (jsonb_typeof(advisor_suggestion_citations) = 'array'
             AND jsonb_array_length(advisor_suggestion_citations) >= 1);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS sys_advisor_suggestions_tenant_idx
  ON sys.sys_advisor_suggestions (advisor_suggestion_tenant_id, advisor_suggestion_generated_at DESC);

COMMENT ON TABLE sys.sys_advisor_suggestions IS
  'F4 fase 1 — traccia di audit delle raccomandazioni prescrittive derivate dalle scorecard '
  'F1/F2/F3 da un motore a REGOLE deterministico (non un LLM: la citazione e'' l''input da cui '
  'la raccomandazione nasce, non un''aggiunta al testo). Sostituzione totale per tenant a ogni '
  'derivazione, come sys_capability_scores.';
