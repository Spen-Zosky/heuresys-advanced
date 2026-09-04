-- db/scripts/244-fonte-approvata-per-un-dominio-inesistente.sql
--
-- #132 F7 — la sola fonte approvata del sistema era invisibile a tutti i domini.
--
-- IL FATTO, misurato il 2026-09-04 su produzione E sul gemello (stessa riga, stesso valore):
--
--   bancaditalia.it | APPROVED | dominio = '64.19' | INSTITUTIONAL | creata 2026-08-25
--
-- `research_source_domain` vuole la chiave di un **dominio ricercabile** — il commento della
-- colonna lo dice: «Il dominio ricercabile per cui questa fonte vale; NULLO = vale per tutti».
-- `64.19` e' un codice ATECO, cioe' un SETTORE: e' finito nella colonna sbagliata. La lettura
-- delle fonti filtra `WHERE research_source_domain IS NULL OR research_source_domain = $1` con
-- $1 = la chiave del dominio (`business_processes`), quindi quella riga non e' mai stata vista
-- da nessuno, e ogni corsa moriva con RESEARCH_NO_APPROVED_SOURCES.
--
-- E' il muro su cui si sono fermate le due prove di merito di #132 F7 — non «un input che solo
-- Enzo puo' dare», come dichiarava la nota di S1083: l'approvazione di Enzo era arrivata, e la
-- riga c'era. Era scritta nel posto sbagliato.
--
-- PERCHE' `business_processes` E NON `NULL`. NULL vorrebbe dire «vale per ogni dominio di
-- ricerca, presenti e futuri», ed e' piu' di quanto Enzo abbia approvato. `business_processes`
-- e' il dominio che serve alle due prove ed e' l'unico oggi dichiarato che confronti le fonti
-- col registro. Il settore non si perde: va in `research_source_metadata`.
--
-- Idempotente: se la riga e' gia' a posto, non fa nulla.
--
--   psql ... -v ON_ERROR_STOP=1 -f db/scripts/244-fonte-approvata-per-un-dominio-inesistente.sql

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE t_prima AS
SELECT count(*) FILTER (WHERE research_source_domain = '64.19')                    AS da_correggere,
       count(*) FILTER (WHERE research_source_domain = 'business_processes')       AS gia_corrette,
       count(*)                                                                    AS fonti_totali,
       count(*) FILTER (WHERE research_source_status = 'APPROVED')                 AS approvate
  FROM sys.sys_research_sources;

DO $guardia$
DECLARE p record;
BEGIN
  SELECT * INTO p FROM t_prima;
  IF p.da_correggere = 0 THEN
    RAISE NOTICE '#244: nessuna riga con dominio 64.19 — niente da fare.';
    RETURN;
  END IF;
  IF p.da_correggere <> 1 THEN
    RAISE EXCEPTION
      'GUARDIA #244: attesa UNA riga da correggere, trovate %. Il caso non e'' quello '
      'misurato: fermo invece di toccare righe che non conosco.', p.da_correggere;
  END IF;
  RAISE NOTICE '#244 guardia: 1 riga da correggere su % fonti — si procede.', p.fonti_totali;
END
$guardia$;

-- Il settore NON si perde: entra nei metadati, dove appartiene.
UPDATE sys.sys_research_sources
   SET research_source_metadata =
         research_source_metadata || jsonb_build_object(
           'ateco', research_source_domain,
           'correzione_244', 'il codice ATECO stava in research_source_domain, che vuole la '
                          || 'chiave di un dominio ricercabile (2026-09-04, S1086)'),
       research_source_domain = 'business_processes',
       updated_at = now()
 WHERE research_source_domain = '64.19';

DO $post$
DECLARE
  p            record;
  n_sbagliate  int;
  n_giuste     int;
  n_totali     int;
  n_approvate  int;
  n_ateco      int;
BEGIN
  SELECT * INTO p FROM t_prima;
  IF p.da_correggere = 0 THEN RETURN; END IF;

  SELECT count(*) FILTER (WHERE research_source_domain = '64.19'),
         count(*) FILTER (WHERE research_source_domain = 'business_processes'),
         count(*),
         count(*) FILTER (WHERE research_source_status = 'APPROVED'),
         count(*) FILTER (WHERE research_source_metadata ? 'ateco')
    INTO n_sbagliate, n_giuste, n_totali, n_approvate, n_ateco
    FROM sys.sys_research_sources;

  IF n_sbagliate <> 0 THEN
    RAISE EXCEPTION 'POST #244: restano % righe col dominio sbagliato. Fermo.', n_sbagliate;
  END IF;
  IF n_giuste <> p.gia_corrette + p.da_correggere THEN
    RAISE EXCEPTION 'POST #244: le righe su business_processes sono % invece di %. Fermo.',
      n_giuste, p.gia_corrette + p.da_correggere;
  END IF;
  -- cio' che NON doveva cambiare
  IF (n_totali, n_approvate) <> (p.fonti_totali, p.approvate) THEN
    RAISE EXCEPTION
      'POST #244: e'' cambiato cio'' che non doveva — fonti %/% approvate %/%. Fermo.',
      n_totali, p.fonti_totali, n_approvate, p.approvate;
  END IF;
  IF n_ateco < p.da_correggere THEN
    RAISE EXCEPTION 'POST #244: il settore non e'' stato conservato nei metadati. Fermo.';
  END IF;

  RAISE NOTICE
    '#244 post: % riga corretta · % fonti totali invariate · % approvate invariate · settore nei metadati.',
    p.da_correggere, n_totali, n_approvate;
END
$post$;

COMMIT;

SELECT research_source_host_suffix AS fonte,
       research_source_status      AS stato,
       research_source_domain      AS dominio,
       research_source_metadata ->> 'ateco' AS ateco_conservato
  FROM sys.sys_research_sources ORDER BY 1;
