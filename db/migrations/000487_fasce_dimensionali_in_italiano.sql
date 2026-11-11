-- 000487: nomi italiani delle fasce dimensionali di impresa (voce 3 del mandato RTL, ADR-0035).
-- La fonte e' la 000021 (emendata); qui si aggiornano le righe gia' presenti, solo se portano ancora il nome inglese originale.
-- Idempotente, non distruttiva: una fascia rinominata a mano dal cliente non si tocca.
UPDATE sys.sys_enterprise_size_bands SET enterprise_size_band_name = CASE enterprise_size_band_code
    WHEN 'XS' THEN 'Molto piccola' WHEN 'S' THEN 'Piccola' WHEN 'M' THEN 'Media' WHEN 'L' THEN 'Grande' WHEN 'XL' THEN 'Molto grande' END
 WHERE (enterprise_size_band_code, enterprise_size_band_name) IN (('XS','Extra Small'),('S','Small'),('M','Medium'),('L','Large'),('XL','Extra Large'));
