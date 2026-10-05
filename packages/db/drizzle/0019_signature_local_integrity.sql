-- Task #23 remediation: durable local-signature evidence, preview candidates, and recovery metadata.
ALTER TABLE signature_operations
  ADD COLUMN IF NOT EXISTS signature_image_object_key text;

CREATE TABLE IF NOT EXISTS signature_preview_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  document_id uuid NOT NULL,
  base_revision_id uuid NOT NULL,
  object_key text NOT NULL,
  content_hash text NOT NULL,
  content_size integer NOT NULL,
  signature_image_hash text NOT NULL,
  placement jsonb NOT NULL,
  idempotency_key text NOT NULL,
  fingerprint jsonb,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT signature_preview_candidates_tenant_participant_fk FOREIGN KEY (tenant_id, participant_id) REFERENCES signature_participants(tenant_id, id),
  CONSTRAINT signature_preview_candidates_tenant_document_fk FOREIGN KEY (tenant_id, document_id) REFERENCES applied_documents(tenant_id, id),
  CONSTRAINT signature_preview_candidates_tenant_revision_fk FOREIGN KEY (tenant_id, document_id, base_revision_id) REFERENCES applied_document_revisions(tenant_id, document_id, id),
  CONSTRAINT signature_preview_candidates_hash_valid CHECK (content_hash ~ '^[0-9a-fA-F]{64}$'),
  CONSTRAINT signature_preview_candidates_image_hash_valid CHECK (signature_image_hash ~ '^[0-9a-fA-F]{64}$')
);
CREATE UNIQUE INDEX IF NOT EXISTS signature_preview_candidates_idempotency_unique ON signature_preview_candidates (tenant_id, participant_id, idempotency_key);
CREATE INDEX IF NOT EXISTS signature_preview_candidates_expiry_idx ON signature_preview_candidates (expires_at);

CREATE TABLE IF NOT EXISTS signature_storage_cleanup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  participant_id uuid,
  object_key text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT signature_storage_cleanup_jobs_tenant_participant_fk FOREIGN KEY (tenant_id, participant_id) REFERENCES signature_participants(tenant_id, id)
);
CREATE INDEX IF NOT EXISTS signature_storage_cleanup_jobs_pending_idx ON signature_storage_cleanup_jobs (tenant_id, created_at) WHERE completed_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS signature_operations_signature_image_key_unique ON signature_operations (tenant_id, signature_image_object_key) WHERE signature_image_object_key IS NOT NULL;

ALTER TABLE signature_operations
  ADD CONSTRAINT signature_operations_signature_image_key_valid CHECK (signature_image_object_key IS NULL OR length(signature_image_object_key) > 0);
