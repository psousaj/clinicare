-- Issue #26: allow external GOV.BR signature operations alongside local ones.
-- External operations carry the imported PDF as candidate and have no
-- handwritten placement or signature image; both columns become nullable
-- while local operations keep providing them as an application invariant.
ALTER TABLE signature_operations
  DROP CONSTRAINT IF EXISTS signature_operations_method_valid;
ALTER TABLE signature_operations
  ADD CONSTRAINT signature_operations_method_valid
  CHECK (method IN ('local_handwritten', 'govbr_external'));
ALTER TABLE signature_operations
  ALTER COLUMN placement DROP NOT NULL;
ALTER TABLE signature_operations
  ALTER COLUMN signature_image_hash DROP NOT NULL;
