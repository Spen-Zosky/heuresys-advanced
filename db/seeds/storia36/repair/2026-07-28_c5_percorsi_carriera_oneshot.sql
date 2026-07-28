-- ============================================================================
-- storia36 C5 — riparazione one-shot: i percorsi di carriera non descrivono
-- alcun mestiere.
--
-- Misura al 2026-07-28: 40 legami posizione↔percorso, distribuiti a caso.
--   Technology Leadership Track → Bank Manager, Compliance Officer, Financial
--                                 Analyst, HR Director, Investment Advisor
--                                 (nessun ruolo tecnologico)
--   Risk Management Track       → Bank Teller, Payment Specialist, Operations
--                                 Director, Securities Dealer, Risk Analyst
-- Un percorso di carriera che porta un cassiere alla direzione rischi non e' un
-- percorso: e' rumore d'importazione. E siccome il controllo C5c pretende che
-- l'obiettivo di carriera stia su un percorso condiviso con la posizione
-- attuale, quel rumore renderebbe VERO qualunque obiettivo — cioe' renderebbe
-- il controllo inutile.
--
-- Inoltre i legami coprivano 40 posizioni su 177: 120 persone su 158 non
-- avevano alcun percorso su cui muoversi.
--
-- Riparazione (triage esito c): alla mappatura incoerente se ne AFFIANCA una
-- per TITOLO, che e' l'unico criterio disponibile nel dato e l'unico
-- che descriva un mestiere. Le righe dell'import restano: le usa un test di
-- riconciliazione e vi si appoggiano 113 piani di carriera.
--
-- Idempotente: alla seconda corsa non trova legami da rifare.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

BEGIN;

DO $$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  c_ns  constant uuid := '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  v_n   bigint;
BEGIN
  -- ADDITIVA, non distruttiva. La v1 di questa riparazione cancellava i legami
  -- dell'import: sbagliato due volte — cancellava senza filtro di tenant, e
  -- soprattutto quelle 40 righe sono il RISULTATO di un'importazione che un test
  -- di riconciliazione verifica, e 113 piani di carriera vi facevano riferimento
  -- (92 sono rimasti incoerenti). Le righe dell'import restano dove sono: la
  -- mappatura coerente si AGGIUNGE, e chi ha bisogno di direzione (gli obiettivi
  -- di carriera, il check C5c) usa solo quella, riconoscibile dal marcatore.

  INSERT INTO sys.sys_position_career_paths (
    position_career_path_id, position_id, position_career_path_tenant_id,
    career_path_id, position_career_path_metadata)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C5::PCP::' || p.position_id || '::' || cp.career_path_id),
         p.position_id, c_rtl, cp.career_path_id,
         jsonb_build_object('storia36', 'C5', 'criterio', 'famiglia professionale dal titolo')
    FROM sys.sys_positions p
    JOIN sys.sys_career_paths cp
      ON cp.career_path_name = (
        -- cascata per dominio: le funzioni di vertice seguono il LORO mestiere,
        -- non un generico «management»
        CASE
          WHEN p.position_title ~* 'develop|software|system|IT |tecnolog|data |architect|engineer'
            THEN 'Technology Leadership Track'
          WHEN p.position_title ~* 'risk|rischi|audit|credit'
            THEN 'Risk Management Track'
          WHEN p.position_title ~* 'complian|legal|AML|antiricicl|counsel'
            THEN 'Compliance & Legal Track'
          WHEN p.position_title ~* 'invest|securit|treasur|financ|commercial|corporate|advisor|market'
            THEN 'Corporate Banking Track'
          ELSE 'Banking Operations Track'
        END)
   WHERE p.position_tenant_id = c_rtl
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'storia36 C5 repair: % posizioni collegate al percorso del proprio mestiere', v_n;
END $$;

COMMIT;
