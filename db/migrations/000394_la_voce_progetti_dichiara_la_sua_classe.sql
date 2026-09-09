-- 000394 — la voce di menu «projects» dichiara la classe ACTIVITY.
--
-- IL FATTO (cancello verify_gate, 2026-09-09): `data-classes.ts` classificava `project`
-- come non-esistente in nessuno dei quattro elenchi — la stessa crepa che #99 F7 (S1064)
-- aveva chiuso per le altre resource. Classificata ACTIVITY (mig. gemella, stesso ciclo:
-- membership di progetto, come `team` — chi lavora su cosa, non un fatto sensibile sulla
-- persona). Ma classificarla in `data-classes.ts` non basta: il cancello "esige la classe
-- su ogni voce la cui resource è person-level" pretende ANCHE la riga in
-- `sys_ui_interface_data_classes`, o la voce di menu sparirebbe per chi non ha domini aperti
-- su ACTIVITY (I17). Questo file aggiunge quella riga.

\set ON_ERROR_STOP on

BEGIN;

INSERT INTO sys.sys_ui_interface_data_classes (ui_interface_id, data_class)
SELECT i.ui_interface_id, 'ACTIVITY'
  FROM sys.sys_ui_interfaces i
 WHERE i.ui_interface_code = 'projects'
ON CONFLICT (ui_interface_id, data_class) DO NOTHING;

DO $$
DECLARE n_projects int; n_totale int;
BEGIN
  -- responsabilità propria: la riga di projects c'è ed è una sola
  SELECT count(*) INTO n_projects
    FROM sys.sys_ui_interface_data_classes dc
    JOIN sys.sys_ui_interfaces i ON i.ui_interface_id = dc.ui_interface_id
   WHERE i.ui_interface_code = 'projects';
  IF n_projects <> 1 THEN
    RAISE EXCEPTION '000394: projects ha % dichiarazioni, ne era attesa 1', n_projects;
  END IF;

  -- IL TOTALE ESATTO, raccolto dalla 000366 (che l'aveva raccolto dalla 000326, che
  -- l'aveva raccolto dalla 000317): 42 + 1 (projects) = 43. Chi aggiungerà righe dopo
  -- di me deve spostare QUESTO conteggio nel proprio file, e ridurre questa guardia
  -- alla propria sola responsabilità — come questo file ha appena fatto a 000366.
  SELECT count(*) INTO n_totale FROM sys.sys_ui_interface_data_classes;
  IF n_totale <> 43 THEN
    RAISE EXCEPTION '000394: le dichiarazioni di classe totali sono % invece di 43 — se è '
                    'un''aggiunta legittima, il conteggio esatto va spostato nella '
                    'migrazione che la introduce', n_totale;
  END IF;
END $$;

COMMIT;
