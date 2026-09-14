--
-- 000417 — Prova del caso (iv) del mandato K (F0.4, sezione 3.5): questo file e' NATO INCOMPLETO,
--          senza la riga di chiusura `-- FINE 000417`, e `dove_siamo.py` lo ha detto ROSSO
--          (exit 1, «FILE INCOMPLETO … caso (iv): si riscrive per intero» — evidenza in
--          .programmi/K-ruoli-direzione/evidenze/F0.4_ripresa_s2_202609150135.txt).
--
-- Poi e' stato RISCRITTO PER INTERO (sovrascrittura, non cancellazione) come migrazione vuota:
-- un numero prenotato non si lascia mai buco (esiti/F0.6_migrazioni.md §3a), perche' il runner
-- applica in ordine lessicale e non controlla la contiguita' — un numero basso scritto tardi
-- girerebbe prima di quelli che lo seguono nel nome.
--
-- Scritta da Claude Code CLI (S1103, 2026-09-15). Non tocca nulla.
--
BEGIN;
select 1;
COMMIT;
-- FINE 000417
