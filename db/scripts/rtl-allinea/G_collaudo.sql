-- Voce 6 (mandato RTL 2026-11-11): residui di collaudo in RTL. Le prove automatiche creano i propri documenti
-- (`ZZZ Link E2E ${Date.now()}`, `E2E CMS Doc ${Date.now()}`) e non dipendono da righe preesistenti (verificato con grep su apps/ e scripts/).
-- Si ritirano: 4 documenti con versioni, collegamenti e media (a cascata) e 2 notifiche del fascicolo di prova. Idempotente.
-- Restano: la persona «Collaudo Hiring Manager» (hiring-manager@collaudo.invalid, la usano 3 file di prove API: utenza, I7) e le 2 richieste
-- di approvazione APPLIED del fascicolo di prova (storia della costruzione dell'azienda).
-- Giornale: staging.rtl_allinea_org_undo (riga intera in jsonb, per tabella). Rollback: INSERT dalle righe salvate nell'ordine documenti, versioni, link, media, notifiche.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_allinea_org_undo (
  salvato_il timestamptz NOT NULL DEFAULT now(), tabella text NOT NULL, chiave uuid NOT NULL, riga jsonb NOT NULL, PRIMARY KEY (tabella, chiave));
CREATE TEMP TABLE doc ON COMMIT DROP AS SELECT document_id FROM sys.sys_content_documents WHERE document_title ~ '^(ZZZ Link E2E|E2E CMS Doc) [0-9]+$';
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'sys_content_documents', d.document_id, to_jsonb(d) FROM sys.sys_content_documents d JOIN doc USING (document_id) ON CONFLICT DO NOTHING;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'sys_content_versions', v.version_id, to_jsonb(v) FROM sys.sys_content_versions v WHERE v.version_document_id IN (SELECT document_id FROM doc) ON CONFLICT DO NOTHING;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'sys_content_blueprint_links', l.link_id, to_jsonb(l) FROM sys.sys_content_blueprint_links l WHERE l.link_document_id IN (SELECT document_id FROM doc) ON CONFLICT DO NOTHING;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'sys_content_media', m.media_id, to_jsonb(m) FROM sys.sys_content_media m WHERE m.media_document_id IN (SELECT document_id FROM doc) ON CONFLICT DO NOTHING;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'sys_inbox_notifications', n.notification_id, to_jsonb(n) FROM sys.sys_inbox_notifications n WHERE n.notification_body ILIKE '%Fascicolo di prova 2026%' ON CONFLICT DO NOTHING;
UPDATE sys.sys_content_documents SET document_current_version_id = NULL WHERE document_id IN (SELECT document_id FROM doc);
DELETE FROM sys.sys_content_documents WHERE document_id IN (SELECT document_id FROM doc);
DELETE FROM sys.sys_inbox_notifications WHERE notification_body ILIKE '%Fascicolo di prova 2026%';
DO $$ DECLARE n int; BEGIN
  SELECT (SELECT count(*) FROM sys.sys_content_documents WHERE document_title ~ '^(ZZZ Link E2E|E2E CMS Doc)') + (SELECT count(*) FROM sys.sys_content_versions WHERE version_title ~ '^(ZZZ Link E2E|E2E CMS Doc)') INTO n;
  IF n>0 THEN RAISE EXCEPTION 'G: restano % residui', n; END IF; END $$;
COMMIT;
SELECT 'G ok' esito, (SELECT count(*) FROM staging.rtl_allinea_org_undo WHERE tabella IN ('sys_content_documents','sys_content_versions','sys_content_blueprint_links','sys_content_media','sys_inbox_notifications')) nel_giornale;
