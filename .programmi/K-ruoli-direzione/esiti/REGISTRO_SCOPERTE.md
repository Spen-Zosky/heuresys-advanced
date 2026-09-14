# Registro delle scoperte — fuori da questo ciclo (R24 §5)

Cose trovate lavorando che NON sono voci del mandato: si presentano una volta sola come «fuori da questo ciclo: lo vuoi nel prossimo?». Non entrano in «cosa resta», non bloccano nessuna chiusura.

| data | trovata in | scoperta | proposta |
|---|---|---|---|
| 2026-09-14 | F0.1 | Gli orfani del registro di provenienza (registro > tabella) sono **11 tabelle**, non le 2 del dossier (che guardava solo le amministrative): sys_skills 19.764/14.031, sys_learning_modules 4.959/92, sys_learning_paths 3.294/66, sys_goal_updates, sys_goal_comments, sys_job_roles, sys_skill_categories, sys_job_families, sys_okrs, sys_compensation_bands, sys_leave_balance_transactions. | La eredita I-D (passo 17) e S-3: nessuna azione nuova, ma la vista S-3 nascera' con 11 righe, non 2. |
| 2026-09-14 | F0.2 | Negli script W0/W1/W2 la spia si considera trovata solo se il verificatore riporta la STRINGA del comando identica; i verificatori la riscrivono (tolgono `python q.py`, aggiungono un prefisso) e il confronto fallisce anche quando il numero prova che l'hanno trovata (2 casi su 6 in W0). | Nel prossimo giro: confrontare il NUMERO (atteso = valore alterato) oltre alla stringa. Non emendato di iniziativa: il mandato vuole gli script «esattamente come sono scritti». |
| 2026-09-14 | F0.2 | I file `<oggetto>_lettore.json` / `_verifica.json` scritti a mano dagli agenti non coincidono sempre con l'esito strutturato del run (14 vs 16 scrittori; un file non e' JSON valido). | La fonte e' `_risultato.json` (esito strutturato, validato dallo schema); i file a mano sono materiale grezzo. Applicato gia' in `tools/esito_w0.py`. |
| 2026-09-14 | F0.2 | Tre regex «equivalenti» danno tre numeri (53/56/55) per «migrazioni che scrivono sys_auth_role_permissions». | Nessuna: e' il motivo per cui ogni numero porta il comando esatto. |
