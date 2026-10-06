-- Issue #26: align the external operation method with the existing
-- revision-origin vocabulary ('govbr_external', as in
-- applied_document_revisions_origin_valid from 0018).
ALTER TABLE signature_operations
  DROP CONSTRAINT IF EXISTS signature_operations_method_valid;
ALTER TABLE signature_operations
  ADD CONSTRAINT signature_operations_method_valid
  CHECK (method IN ('local_handwritten', 'govbr_external'));
