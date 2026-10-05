-- Tasks #24-#28: immutable technical evidence, external GOV.BR attempts, and revision provenance.
ALTER TABLE signature_operations
  ADD COLUMN IF NOT EXISTS fingerprint_collector_version text,
  ADD COLUMN IF NOT EXISTS fingerprint_normalization_version text,
  ADD COLUMN IF NOT EXISTS fingerprint_digest text,
  ADD COLUMN IF NOT EXISTS observed_ip text,
  ADD COLUMN IF NOT EXISTS evidence_received_at timestamptz;

ALTER TABLE applied_document_revisions
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'initial',
  ADD COLUMN IF NOT EXISTS source_external_receipt_id uuid;

CREATE TABLE IF NOT EXISTS signature_external_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  document_id uuid NOT NULL,
  base_revision_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'govbr',
  lifecycle_status text NOT NULL DEFAULT 'reserved',
  validation_status text,
  idempotency_key text NOT NULL,
  export_object_key text NOT NULL,
  export_hash text NOT NULL,
  export_size integer NOT NULL,
  export_expires_at timestamptz NOT NULL,
  exported_at timestamptz NOT NULL DEFAULT now(),
  import_object_key text,
  import_hash text,
  import_size integer,
  imported_at timestamptz,
  export_fingerprint jsonb,
  import_fingerprint jsonb,
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT signature_external_attempts_provider_valid CHECK (provider = 'govbr'),
  CONSTRAINT signature_external_attempts_lifecycle_valid CHECK (lifecycle_status IN ('reserved', 'return_received', 'completed', 'expired', 'cancelled')),
  CONSTRAINT signature_external_attempts_validation_valid CHECK (validation_status IS NULL OR validation_status IN ('validated', 'invalid', 'indeterminate', 'unsupported')),
  CONSTRAINT signature_external_attempts_hash_valid CHECK (export_hash ~ '^[0-9a-fA-F]{64}$' AND (import_hash IS NULL OR import_hash ~ '^[0-9a-fA-F]{64}$')),
  CONSTRAINT signature_external_attempts_size_valid CHECK (export_size > 0 AND (import_size IS NULL OR import_size > 0)),
  CONSTRAINT signature_external_attempts_tenant_participant_fk FOREIGN KEY (tenant_id, participant_id) REFERENCES signature_participants(tenant_id, id),
  CONSTRAINT signature_external_attempts_tenant_document_fk FOREIGN KEY (tenant_id, document_id) REFERENCES applied_documents(tenant_id, id),
  CONSTRAINT signature_external_attempts_tenant_revision_fk FOREIGN KEY (tenant_id, document_id, base_revision_id) REFERENCES applied_document_revisions(tenant_id, document_id, id),
  CONSTRAINT signature_external_attempts_idempotency_unique UNIQUE (tenant_id, participant_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS signature_external_attempts_status_idx ON signature_external_attempts (tenant_id, participant_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS signature_external_attempts_expiry_idx ON signature_external_attempts (tenant_id, export_expires_at);

CREATE TABLE IF NOT EXISTS signature_external_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  attempt_id uuid NOT NULL,
  object_key text NOT NULL,
  content_hash text NOT NULL,
  content_size integer NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  validation_status text NOT NULL DEFAULT 'indeterminate',
  validation_report jsonb,
  signer_identity jsonb,
  certificate_fingerprint text,
  covered_revision_ids jsonb,
  detected_signature_ids jsonb,
  promoted_revision_id uuid,
  rejected_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT signature_external_receipts_hash_valid CHECK (content_hash ~ '^[0-9a-fA-F]{64}$'),
  CONSTRAINT signature_external_receipts_size_valid CHECK (content_size > 0),
  CONSTRAINT signature_external_receipts_validation_valid CHECK (validation_status IN ('validated', 'invalid', 'indeterminate', 'unsupported')),
  CONSTRAINT signature_external_receipts_tenant_attempt_fk FOREIGN KEY (tenant_id, attempt_id) REFERENCES signature_external_attempts(tenant_id, id),
  CONSTRAINT signature_external_receipts_tenant_revision_fk FOREIGN KEY (tenant_id, promoted_revision_id) REFERENCES applied_document_revisions(tenant_id, id)
);
CREATE INDEX IF NOT EXISTS signature_external_receipts_attempt_idx ON signature_external_receipts (tenant_id, attempt_id, received_at);

CREATE TABLE IF NOT EXISTS signature_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  document_id uuid NOT NULL,
  document_revision_id uuid,
  operation_id uuid,
  external_attempt_id uuid,
  event_type text NOT NULL,
  collector_version text,
  normalization_version text,
  attributes jsonb,
  unavailable_attributes jsonb,
  normalized_representation jsonb,
  digest text,
  observed_ip text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT signature_evidence_digest_valid CHECK (digest IS NULL OR digest ~ '^[0-9a-fA-F]{64}$'),
  CONSTRAINT signature_evidence_tenant_participant_fk FOREIGN KEY (tenant_id, participant_id) REFERENCES signature_participants(tenant_id, id),
  CONSTRAINT signature_evidence_tenant_document_fk FOREIGN KEY (tenant_id, document_id) REFERENCES applied_documents(tenant_id, id),
  CONSTRAINT signature_evidence_tenant_revision_fk FOREIGN KEY (tenant_id, document_revision_id) REFERENCES applied_document_revisions(tenant_id, id),
  CONSTRAINT signature_evidence_tenant_operation_fk FOREIGN KEY (tenant_id, operation_id) REFERENCES signature_operations(tenant_id, id),
  CONSTRAINT signature_evidence_tenant_attempt_fk FOREIGN KEY (tenant_id, external_attempt_id) REFERENCES signature_external_attempts(tenant_id, id)
);
CREATE INDEX IF NOT EXISTS signature_evidence_participant_idx ON signature_evidence (tenant_id, participant_id, observed_at);

ALTER TABLE signature_revisions ADD COLUMN IF NOT EXISTS external_receipt_id uuid;
ALTER TABLE signature_revisions ADD CONSTRAINT signature_revisions_tenant_external_receipt_fk FOREIGN KEY (tenant_id, external_receipt_id) REFERENCES signature_external_receipts(tenant_id, id);
ALTER TABLE applied_document_revisions ADD CONSTRAINT applied_document_revisions_origin_valid CHECK (origin IN ('initial', 'local_handwritten', 'govbr_external'));
