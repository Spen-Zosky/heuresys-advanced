-- ============================================================================
-- 000480, PROVA DELLE GUARDIE (fuori catena). Solo su una copia usa-e-getta, mai sulla produzione
-- né su heuresys_ci: scrive righe di prova dentro una transazione e alla fine fa ROLLBACK.
--
--   psql -v ON_ERROR_STOP=1 -f db/scripts/agenti/prova-000480.sql <copia>
--
-- Ogni caso «deve fallire» si prova in un SAVEPOINT: se l'istruzione passa, la prova è rossa.
-- Esce con un errore al primo caso sbagliato; stampa «000480 prova: N casi verdi» alla fine.
-- ============================================================================
\set ON_ERROR_STOP on
BEGIN;

DO $guardia$
BEGIN
  IF current_database() !~ '(ci|prova|rehearsal|copia)' THEN
    RAISE EXCEPTION 'prova-000480: il database % non si dichiara di collaudo dal nome, non scrivo', current_database();
  END IF;
END $guardia$;

CREATE TEMP TABLE prova_esiti (caso text, verde boolean) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp.deve_fallire(caso text, istruzione text) RETURNS void
LANGUAGE plpgsql AS $f$
BEGIN
  BEGIN
    EXECUTE istruzione;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO prova_esiti VALUES (caso, true);
    RETURN;
  END;
  RAISE EXCEPTION 'ROSSO: il caso «%» doveva fallire ed è passato', caso;
END;
$f$;

CREATE OR REPLACE FUNCTION pg_temp.deve_passare(caso text, istruzione text) RETURNS void
LANGUAGE plpgsql AS $f$
BEGIN
  EXECUTE istruzione;
  INSERT INTO prova_esiti VALUES (caso, true);
END;
$f$;

-- un tenant e una persona qualsiasi della copia
SELECT tenant_id AS t FROM sys.sys_tenancies ORDER BY tenant_id LIMIT 1 \gset
SELECT user_id AS u FROM sys.sys_users ORDER BY user_id LIMIT 1 \gset

INSERT INTO sys.sys_agent_capabilities (agent_capability_id, agent_capability_code, agent_capability_agent_code,
  agent_capability_description, agent_capability_undo_mechanism, agent_capability_undo_ref, agent_capability_volume_cap,
  agent_capability_created_by)
VALUES ('00000000-0000-4000-8000-000000000b01', 'prova.struttura.collega', 'prova', 'capacità di prova B',
        'RIGA_SOSTITUTIVA', 'prova_supersedes_id', 10, :'u'),
       ('00000000-0000-4000-8000-000000000c01', 'prova.struttura.togli', 'prova', 'capacità di prova con una C',
        'RIGA_SOSTITUTIVA', 'prova_supersedes_id', 10, :'u');

SELECT pg_temp.deve_fallire('codice senza punto', $$INSERT INTO sys.sys_agent_capabilities (agent_capability_code,
  agent_capability_agent_code, agent_capability_description, agent_capability_undo_mechanism, agent_capability_undo_ref,
  agent_capability_volume_cap) VALUES ('senzapunto', 'prova', 'x', 'RIGA_SOSTITUTIVA', 'x', 1)$$);
SELECT pg_temp.deve_fallire('tetto a zero', $$INSERT INTO sys.sys_agent_capabilities (agent_capability_code,
  agent_capability_agent_code, agent_capability_description, agent_capability_undo_mechanism, agent_capability_undo_ref,
  agent_capability_volume_cap) VALUES ('prova.tetto', 'prova', 'x', 'RIGA_SOSTITUTIVA', 'x', 0)$$);
SELECT pg_temp.deve_fallire('ritorno sconosciuto', $$INSERT INTO sys.sys_agent_capabilities (agent_capability_code,
  agent_capability_agent_code, agent_capability_description, agent_capability_undo_mechanism, agent_capability_undo_ref,
  agent_capability_volume_cap) VALUES ('prova.ritorno', 'prova', 'x', 'NESSUNO', 'x', 1)$$);

-- le classi delle operazioni
SELECT pg_temp.deve_fallire('una POST di classe A', $$INSERT INTO sys.sys_agent_capability_operations
  (agent_capability_operation_capability_id, agent_capability_operation_concept_id, agent_capability_operation_operation_id,
   agent_capability_operation_http_method, agent_capability_operation_action_class)
  VALUES ('00000000-0000-4000-8000-000000000b01', 'c', 'o1', 'POST', 'A')$$);
SELECT pg_temp.deve_fallire('una GET di classe B', $$INSERT INTO sys.sys_agent_capability_operations
  (agent_capability_operation_capability_id, agent_capability_operation_concept_id, agent_capability_operation_operation_id,
   agent_capability_operation_http_method, agent_capability_operation_action_class)
  VALUES ('00000000-0000-4000-8000-000000000b01', 'c', 'o2', 'GET', 'B')$$);
SELECT pg_temp.deve_fallire('una DELETE di classe B', $$INSERT INTO sys.sys_agent_capability_operations
  (agent_capability_operation_capability_id, agent_capability_operation_concept_id, agent_capability_operation_operation_id,
   agent_capability_operation_http_method, agent_capability_operation_action_class)
  VALUES ('00000000-0000-4000-8000-000000000b01', 'c', 'o3', 'DELETE', 'B')$$);
SELECT pg_temp.deve_passare('una GET di classe A e una PUT di classe B', $$INSERT INTO sys.sys_agent_capability_operations
  (agent_capability_operation_capability_id, agent_capability_operation_concept_id, agent_capability_operation_operation_id,
   agent_capability_operation_http_method, agent_capability_operation_action_class)
  VALUES ('00000000-0000-4000-8000-000000000b01', 'c', 'leggi', 'GET', 'A'),
         ('00000000-0000-4000-8000-000000000b01', 'c', 'collega', 'PUT', 'B'),
         ('00000000-0000-4000-8000-000000000c01', 'c', 'collega', 'PUT', 'B'),
         ('00000000-0000-4000-8000-000000000c01', 'c', 'togli', 'DELETE', 'C')$$);

-- LIBERA su una capacità in BOZZA
SELECT pg_temp.deve_fallire('LIBERA su una capacità in bozza', format($$INSERT INTO sys.sys_agent_capability_activations
  (agent_capability_activation_tenant_id, agent_capability_activation_capability_id, agent_capability_activation_mode,
   agent_capability_activation_notice_ref, agent_capability_activation_rollback_proof_ref, agent_capability_activation_reason,
   agent_capability_activation_decided_by)
  VALUES (%L, '00000000-0000-4000-8000-000000000b01', 'LIBERA', 'informativa v1', 'ritorno provato', 'prova', %L)$$, :'t', :'u'));

UPDATE sys.sys_agent_capabilities SET agent_capability_status = 'PUBBLICATA', agent_capability_published_at = now()
 WHERE agent_capability_id IN ('00000000-0000-4000-8000-000000000b01', '00000000-0000-4000-8000-000000000c01');

-- pubblicata non cambia
SELECT pg_temp.deve_fallire('tetto cambiato su una capacità pubblicata', $$UPDATE sys.sys_agent_capabilities
  SET agent_capability_volume_cap = 999 WHERE agent_capability_id = '00000000-0000-4000-8000-000000000b01'$$);
SELECT pg_temp.deve_fallire('operazione aggiunta a una capacità pubblicata', $$INSERT INTO sys.sys_agent_capability_operations
  (agent_capability_operation_capability_id, agent_capability_operation_concept_id, agent_capability_operation_operation_id,
   agent_capability_operation_http_method, agent_capability_operation_action_class)
  VALUES ('00000000-0000-4000-8000-000000000b01', 'c', 'altra', 'POST', 'B')$$);
SELECT pg_temp.deve_fallire('capacità pubblicata cancellata', $$DELETE FROM sys.sys_agent_capabilities
  WHERE agent_capability_id = '00000000-0000-4000-8000-000000000b01'$$);
SELECT pg_temp.deve_fallire('pubblicata riportata in bozza', $$UPDATE sys.sys_agent_capabilities
  SET agent_capability_status = 'BOZZA', agent_capability_published_at = NULL
  WHERE agent_capability_id = '00000000-0000-4000-8000-000000000b01'$$);

-- le condizioni del modo LIBERA
SELECT pg_temp.deve_fallire('LIBERA senza informativa', format($$INSERT INTO sys.sys_agent_capability_activations
  (agent_capability_activation_tenant_id, agent_capability_activation_capability_id, agent_capability_activation_mode,
   agent_capability_activation_rollback_proof_ref, agent_capability_activation_reason, agent_capability_activation_decided_by)
  VALUES (%L, '00000000-0000-4000-8000-000000000b01', 'LIBERA', 'ritorno provato', 'prova', %L)$$, :'t', :'u'));
SELECT pg_temp.deve_fallire('LIBERA senza ritorno provato', format($$INSERT INTO sys.sys_agent_capability_activations
  (agent_capability_activation_tenant_id, agent_capability_activation_capability_id, agent_capability_activation_mode,
   agent_capability_activation_notice_ref, agent_capability_activation_reason, agent_capability_activation_decided_by)
  VALUES (%L, '00000000-0000-4000-8000-000000000b01', 'LIBERA', 'informativa v1', 'prova', %L)$$, :'t', :'u'));
SELECT pg_temp.deve_fallire('LIBERA su una capacità con una C', format($$INSERT INTO sys.sys_agent_capability_activations
  (agent_capability_activation_tenant_id, agent_capability_activation_capability_id, agent_capability_activation_mode,
   agent_capability_activation_notice_ref, agent_capability_activation_rollback_proof_ref, agent_capability_activation_reason,
   agent_capability_activation_decided_by)
  VALUES (%L, '00000000-0000-4000-8000-000000000c01', 'LIBERA', 'informativa v1', 'ritorno provato', 'prova', %L)$$, :'t', :'u'));
SELECT pg_temp.deve_fallire('il sistema che libera', format($$INSERT INTO sys.sys_agent_capability_activations
  (agent_capability_activation_tenant_id, agent_capability_activation_capability_id, agent_capability_activation_mode,
   agent_capability_activation_source, agent_capability_activation_notice_ref, agent_capability_activation_rollback_proof_ref,
   agent_capability_activation_reason)
  VALUES (%L, '00000000-0000-4000-8000-000000000b01', 'LIBERA', 'AUTOMATICO', 'informativa v1', 'ritorno provato', 'prova')$$, :'t'));
SELECT pg_temp.deve_fallire('una persona che non dice chi è', format($$INSERT INTO sys.sys_agent_capability_activations
  (agent_capability_activation_tenant_id, agent_capability_activation_capability_id, agent_capability_activation_mode,
   agent_capability_activation_reason)
  VALUES (%L, '00000000-0000-4000-8000-000000000b01', 'CONFERMA', 'prova')$$, :'t'));

SELECT pg_temp.deve_passare('LIBERA con le condizioni', format($$INSERT INTO sys.sys_agent_capability_activations
  (agent_capability_activation_id, agent_capability_activation_tenant_id, agent_capability_activation_capability_id,
   agent_capability_activation_mode, agent_capability_activation_notice_ref, agent_capability_activation_rollback_proof_ref,
   agent_capability_activation_reason, agent_capability_activation_decided_by, agent_capability_activation_decided_at)
  VALUES ('00000000-0000-4000-8000-0000000000a1', %L, '00000000-0000-4000-8000-000000000b01', 'LIBERA',
          'informativa v1', 'ritorno provato', 'prova', %L, now() - interval '1 minute')$$, :'t', :'u'));
SELECT pg_temp.deve_passare('lo spegnimento da sé', format($$INSERT INTO sys.sys_agent_capability_activations
  (agent_capability_activation_tenant_id, agent_capability_activation_capability_id, agent_capability_activation_mode,
   agent_capability_activation_source, agent_capability_activation_reason, agent_capability_activation_supersedes_id)
  VALUES (%L, '00000000-0000-4000-8000-000000000b01', 'CONFERMA', 'AUTOMATICO', 'scrittura senza attribuzione',
          '00000000-0000-4000-8000-0000000000a1')$$, :'t'));

DO $vista$
BEGIN
  IF (SELECT agent_capability_activation_mode FROM sys.v_agent_capability_activations_current
       WHERE agent_capability_activation_capability_id = '00000000-0000-4000-8000-000000000b01') <> 'CONFERMA' THEN
    RAISE EXCEPTION 'ROSSO: la vista non mostra lo spegnimento come modo in vigore';
  END IF;
  INSERT INTO prova_esiti VALUES ('la vista mostra il modo più recente', true);
END $vista$;

SELECT pg_temp.deve_fallire('attivazione modificata', $$UPDATE sys.sys_agent_capability_activations
  SET agent_capability_activation_mode = 'CONFERMA' WHERE agent_capability_activation_id = '00000000-0000-4000-8000-0000000000a1'$$);
SELECT pg_temp.deve_fallire('attivazione cancellata', $$DELETE FROM sys.sys_agent_capability_activations
  WHERE agent_capability_activation_id = '00000000-0000-4000-8000-0000000000a1'$$);

SELECT format('000480 prova: %s casi verdi', count(*)) AS esito FROM prova_esiti WHERE verde;
ROLLBACK;
