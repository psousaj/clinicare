-- Task #23: patient local-signature operations and immutable document revision links.
ALTER TABLE signature_participants ADD COLUMN IF NOT EXISTS identity_snapshot jsonb;
ALTER TABLE signature_tokens ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;
ALTER TABLE signature_tokens ADD COLUMN IF NOT EXISTS phone_verification_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE signature_tokens ADD COLUMN IF NOT EXISTS phone_locked_until timestamptz;

CREATE TABLE IF NOT EXISTS signature_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  document_id uuid NOT NULL,
  base_revision_id uuid NOT NULL,
  candidate_object_key text NOT NULL,
  candidate_hash text NOT NULL,
  candidate_size integer NOT NULL,
  method text NOT NULL DEFAULT 'local_handwritten',
  placement jsonb NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  signature_image_hash text NOT NULL,
  acceptance_text text NOT NULL,
  identity_snapshot jsonb,
  fingerprint jsonb,
  status text NOT NULL DEFAULT 'prepared',
  stale_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  CONSTRAINT signature_operations_tenant_participant_fk FOREIGN KEY (tenant_id, participant_id) REFERENCES signature_participants(tenant_id, id),
  CONSTRAINT signature_operations_tenant_document_fk FOREIGN KEY (tenant_id, document_id) REFERENCES applied_documents(tenant_id, id),
  CONSTRAINT signature_operations_tenant_base_revision_fk FOREIGN KEY (tenant_id, document_id, base_revision_id) REFERENCES applied_document_revisions(tenant_id, document_id, id),
  CONSTRAINT signature_operations_method_valid CHECK (method IN ('local_handwritten')),
  CONSTRAINT signature_operations_status_valid CHECK (status IN ('prepared', 'confirmed', 'stale', 'rejected')),
  CONSTRAINT signature_operations_hash_valid CHECK (candidate_hash ~ '^[0-9a-fA-F]{64}$'),
  CONSTRAINT signature_operations_request_hash_valid CHECK (request_hash ~ '^[0-9a-fA-F]{64}$'),
  CONSTRAINT signature_operations_signature_hash_valid CHECK (signature_image_hash ~ '^[0-9a-fA-F]{64}$'),
  CONSTRAINT signature_operations_size_positive CHECK (candidate_size > 0),
  CONSTRAINT signature_operations_idempotency_not_empty CHECK (length(trim(idempotency_key)) > 0),
  CONSTRAINT signature_operations_candidate_key_opaque CHECK (candidate_object_key !~ '[/:]')
);
CREATE UNIQUE INDEX IF NOT EXISTS signature_operations_idempotency_unique ON signature_operations (tenant_id, participant_id, idempotency_key);
CREATE INDEX IF NOT EXISTS signature_operations_document_idx ON signature_operations (tenant_id, document_id, created_at);
ALTER TABLE signature_revisions ADD COLUMN IF NOT EXISTS operation_id uuid;
ALTER TABLE signature_revisions ADD COLUMN IF NOT EXISTS document_revision_id uuid;
ALTER TABLE signature_revisions ADD COLUMN IF NOT EXISTS method text;
ALTER TABLE signature_revisions ADD COLUMN IF NOT EXISTS placement jsonb;
ALTER TABLE signature_revisions ADD COLUMN IF NOT EXISTS signature_image_hash text;

-- Keep every relationship tenant-scoped. The referenced tables already expose
-- tenant/id pairs for this purpose; drop the earlier single-column variants so
-- a row from another tenant cannot be linked by ID alone.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signature_operations_tenant_id_unique' AND conrelid = 'signature_operations'::regclass) THEN
    ALTER TABLE signature_operations ADD CONSTRAINT signature_operations_tenant_id_unique UNIQUE (tenant_id, id);
  END IF;
  ALTER TABLE signature_revisions DROP CONSTRAINT IF EXISTS signature_revisions_operation_fk;
  ALTER TABLE signature_revisions DROP CONSTRAINT IF EXISTS signature_revisions_document_revision_fk;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signature_revisions_tenant_operation_fk' AND conrelid = 'signature_revisions'::regclass) THEN
    ALTER TABLE signature_revisions ADD CONSTRAINT signature_revisions_tenant_operation_fk FOREIGN KEY (tenant_id, operation_id) REFERENCES signature_operations(tenant_id, id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signature_revisions_tenant_document_revision_fk' AND conrelid = 'signature_revisions'::regclass) THEN
    ALTER TABLE signature_revisions ADD CONSTRAINT signature_revisions_tenant_document_revision_fk FOREIGN KEY (tenant_id, document_revision_id) REFERENCES applied_document_revisions(tenant_id, id);
  END IF;
END $$;
