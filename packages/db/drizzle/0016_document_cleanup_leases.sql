-- Make cleanup claims and materialization reservations lease-based.
ALTER TABLE document_cleanup_jobs DROP CONSTRAINT IF EXISTS document_cleanup_jobs_status_valid;
ALTER TABLE document_cleanup_jobs ADD CONSTRAINT document_cleanup_jobs_status_valid CHECK (status IN ('reserved', 'pending', 'processing', 'completed', 'failed'));
ALTER TABLE document_cleanup_jobs ADD COLUMN IF NOT EXISTS claim_token text;
ALTER TABLE document_cleanup_jobs ADD COLUMN IF NOT EXISTS claim_expires_at timestamptz;
ALTER TABLE document_cleanup_jobs ADD COLUMN IF NOT EXISTS reservation_expires_at timestamptz;
CREATE INDEX IF NOT EXISTS document_cleanup_jobs_claim_idx ON document_cleanup_jobs (status, claim_expires_at);
CREATE INDEX IF NOT EXISTS document_cleanup_jobs_reservation_idx ON document_cleanup_jobs (status, reservation_expires_at);
-- Existing reservations predate leases and cannot be proven safe to delete.
-- Keep them reserved until an operator explicitly inspects/releases them.
