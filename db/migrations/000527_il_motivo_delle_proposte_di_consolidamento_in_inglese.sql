-- 000527 — il motivo delle proposte di consolidamento ha anche la versione inglese.
--
-- Difetto del 2026-11-28 (prova dal vivo della #566): nella pagina inglese del consolidamento la colonna
-- «Reason» e il dialogo della decisione mostravano il motivo in italiano, perché la proposta lo salvava in
-- una lingua sola. Ora la proposta porta anche `..._reason_en`: lo scrive il giudice insieme all'italiano,
-- e per i quattro testi fissi del motore lo scrive questa migrazione sulle proposte già salvate.
--
-- Idempotente e senza operazioni distruttive: aggiunge una colonna nullable e riempie SOLO le righe che
-- hanno ancora il valore nullo e un testo fisso noto (uguaglianza esatta). I motivi scritti dal modello non
-- si toccano qui: restano nulli e la pagina ripiega sull'italiano finché non sono tradotti con lo script
-- guardato (rollback: la colonna si svuota con UPDATE ... SET ..._reason_en = NULL).
ALTER TABLE sys.sys_tenant_consolidation_proposals
  ADD COLUMN IF NOT EXISTS tenant_consolidation_proposal_reason_en text;

UPDATE sys.sys_tenant_consolidation_proposals
   SET tenant_consolidation_proposal_reason_en = CASE tenant_consolidation_proposal_reason
     WHEN 'Stesso indirizzo ESCO da entrambe le parti.'
       THEN 'Same ESCO address on both sides.'
     WHEN 'Stesso tipo (secondo il vocabolario comune approvato), stesso livello e stessa voce madre.'
       THEN 'Same type (according to the approved common vocabulary), same level and same parent item.'
     WHEN 'Il prototipo ha questa voce e il tenant non ha niente che le corrisponda.'
       THEN 'The prototype has this item and the tenant has nothing that matches it.'
     WHEN 'Questa voce è del tenant e il prototipo non la conosce: resta sua.'
       THEN 'This item belongs to the tenant and the prototype does not know it: it stays the tenant''s own.'
   END
 WHERE tenant_consolidation_proposal_reason_en IS NULL
   AND tenant_consolidation_proposal_reason IN (
     'Stesso indirizzo ESCO da entrambe le parti.',
     'Stesso tipo (secondo il vocabolario comune approvato), stesso livello e stessa voce madre.',
     'Il prototipo ha questa voce e il tenant non ha niente che le corrisponda.',
     'Questa voce è del tenant e il prototipo non la conosce: resta sua.');
