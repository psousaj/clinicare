ALTER TABLE signature_preview_candidates
  ADD COLUMN IF NOT EXISTS fingerprint_digest text;

ALTER TABLE signature_preview_candidates
  ADD CONSTRAINT signature_preview_candidates_fingerprint_digest_valid
  CHECK (fingerprint_digest IS NULL OR fingerprint_digest ~ '^[0-9a-fA-F]{64}$');
