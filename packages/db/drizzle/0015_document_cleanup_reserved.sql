-- Reserve materialization destinations until ownership is committed.
ALTER TABLE document_cleanup_jobs DROP CONSTRAINT IF EXISTS document_cleanup_jobs_status_valid;
ALTER TABLE document_cleanup_jobs ADD CONSTRAINT document_cleanup_jobs_status_valid CHECK (status IN ('reserved', 'pending', 'completed', 'failed'));
