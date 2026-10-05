-- Durable outbox for object-store cleanup. Object keys are snapshotted as one JSONB array
-- so one retry can atomically reconcile every object owned by a document aggregate.
CREATE TABLE IF NOT EXISTS document_cleanup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  document_id uuid,
  object_keys jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  attempted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_cleanup_jobs_object_keys_array CHECK (jsonb_typeof(object_keys) = 'array'),
  CONSTRAINT document_cleanup_jobs_status_valid CHECK (status IN ('pending', 'completed', 'failed')),
  CONSTRAINT document_cleanup_jobs_attempts_valid CHECK (attempts >= 0)
);
CREATE INDEX IF NOT EXISTS document_cleanup_jobs_status_idx ON document_cleanup_jobs (tenant_id, status, updated_at);
CREATE INDEX IF NOT EXISTS document_cleanup_jobs_document_idx ON document_cleanup_jobs (tenant_id, document_id);
